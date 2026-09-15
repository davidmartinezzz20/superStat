// Abre la pantalla de pago de Stripe, o la de gestionar la suscripción.
//
// Esta función no cobra nada: devuelve una dirección de Stripe a la que la web
// manda el navegador. Ni un dato de tarjeta pasa por SuperStat, que es la única
// forma sensata de no tener que cuidarlos.
//
// Por qué el cobro vive fuera y no dentro de la app: Apple y Google se llevan
// entre el 15 y el 30 % de lo que se cobra con su sistema, y a cambio exigen
// usarlo. Cobrando en la web no hay comisión, pero la contrapartida es que la
// app **no puede** llevar hasta aquí: ni un botón, ni un enlace, ni un texto
// que diga dónde se compra (ver puedeComprar() en js/app.js). Por eso a esta
// función solo se llega desde el navegador.
//
// Dos decisiones que conviene no deshacer:
//
//   1. **De quién es la cuenta lo dice el token, nunca el cuerpo de la
//      petición.** Es la misma regla que borrar-cuenta, y aquí importa igual:
//      con el id como parámetro, cualquiera podría pagarle el Pro a otro o,
//      peor, abrirle su portal de facturación.
//   2. **El id de usuario viaja en los metadatos de la suscripción**, no solo
//      en client_reference_id. El webhook lo necesita, y el evento
//      customer.subscription.created puede llegarle antes que el del checkout.
//
// Se despliega aparte del esquema (ver docs/suscripcion.md):
//
//   supabase functions deploy pago
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@22.6.2?target=deno';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' }
  });

// createFetchHttpClient: el SDK de Stripe viene preparado para Node y aquí no
// hay Node. Sin esto no sale ni una petición.
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  httpClient: Stripe.createFetchHttpClient(),
  apiVersion: '2025-08-27.basil'
});

const web = () => Deno.env.get('SUPERSTAT_WEB') ?? 'https://super-stat.vercel.app';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);

  if (!Deno.env.get('STRIPE_SECRET_KEY')) {
    console.error('falta STRIPE_SECRET_KEY: ver docs/suscripcion.md');
    return json({ error: 'pago-sin-configurar' }, 500);
  }

  const auth = req.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return json({ error: 'sin-sesion' }, 401);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: quien, error: errorSesion } = await admin.auth.getUser(token);
  if (errorSesion || !quien?.user) return json({ error: 'sesion-no-valida' }, 401);
  const uid = quien.user.id;
  const email = quien.user.email ?? undefined;

  let accion = 'suscribir';
  try {
    const cuerpo = await req.json();
    if (cuerpo && typeof cuerpo.accion === 'string') accion = cuerpo.accion;
  } catch (_e) { /* sin cuerpo: se suscribe, que es lo normal */ }

  // El cliente de Stripe de esta cuenta, si ya lo tiene de una suscripción
  // anterior. La fila la escribe el webhook; aquí solo se lee.
  const { data: fila } = await admin
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', uid)
    .maybeSingle();
  const clienteExistente: string | undefined = fila?.stripe_customer_id ?? undefined;

  try {
    if (accion === 'gestionar') {
      // Sin cliente en Stripe no hay nada que gestionar. Pasa si alguien llega
      // aquí sin haber pagado nunca.
      if (!clienteExistente) return json({ error: 'sin-suscripcion' }, 400);
      const portal = await stripe.billingPortal.sessions.create({
        customer: clienteExistente,
        return_url: web()
      });
      return json({ url: portal.url });
    }

    if (accion !== 'suscribir') return json({ error: 'accion-desconocida' }, 400);

    const precio = Deno.env.get('STRIPE_PRICE_ID');
    if (!precio) {
      console.error('falta STRIPE_PRICE_ID: ver docs/suscripcion.md');
      return json({ error: 'pago-sin-configurar' }, 500);
    }

    const sesion = await stripe.checkout.sessions.create({
      mode: 'subscription',
      // Con cliente conocido se reutiliza, y si no se crea uno con su correo:
      // así no se acumulan clientes duplicados en Stripe por persona.
      customer: clienteExistente,
      customer_email: clienteExistente ? undefined : email,
      client_reference_id: uid,
      line_items: [{ price: precio, quantity: 1 }],
      subscription_data: {
        trial_period_days: 7,
        // Esto es lo que permite que el webhook sepa de quién es cada evento
        // aunque llegue antes que el del checkout.
        metadata: { supabase_user_id: uid }
      },
      // Se guarda también en la sesión, por si hiciera falta reconstruir algo a
      // mano desde el panel de Stripe.
      metadata: { supabase_user_id: uid },
      allow_promotion_codes: true,
      success_url: `${web()}/?pago=ok`,
      cancel_url: `${web()}/?pago=no`
    });

    if (!sesion.url) return json({ error: 'sin-url-de-pago' }, 500);
    return json({ url: sesion.url });
  } catch (e) {
    console.error('Stripe falló al abrir ' + accion, e);
    return json({ error: 'stripe-no-responde' }, 502);
  }
});
