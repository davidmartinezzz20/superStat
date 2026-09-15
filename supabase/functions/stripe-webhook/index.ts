// Lo que Stripe cuenta sobre las suscripciones, guardado en la base.
//
// Esta función es la única que escribe public.subscriptions, y lo hace con la
// clave de servicio. **Ahí está toda la seguridad del asunto**: la clave anon
// la tiene cualquiera que abra la web, así que si el navegador pudiera escribir
// esa tabla, el Pro sería gratis. Por eso su política RLS es de solo lectura.
//
// Aquí no hay token de Supabase: quien autentica es la firma de Stripe. De ahí
// el verify_jwt = false de config.toml, que en esta función no afloja nada.
//
// Se despliega aparte del esquema (ver docs/suscripcion.md):
//
//   supabase functions deploy stripe-webhook
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0';
import Stripe from 'https://esm.sh/stripe@22.6.2?target=deno';
import { enviarAviso } from '../_shared/correo.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  httpClient: Stripe.createFetchHttpClient(),
  apiVersion: '2025-08-27.basil'
});

// La comprobación de firma tiene que ser la asíncrona y con este proveedor: la
// versión síncrona usa el crypto de Node, que aquí no existe, y falla siempre.
const cripto = Stripe.createSubtleCryptoProvider();

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// Los estados en los que la suscripción da derecho a Pro. 'past_due' entra a
// propósito: el recibo ha fallado pero Stripe lo va a reintentar, y quitarle la
// app a alguien por una tarjeta caducada antes de que le dé tiempo a cambiarla
// es la peor forma de perder un cliente que ya paga.
const VIVOS = new Set(['trialing', 'active', 'past_due']);

const iso = (segundos: number | null | undefined) =>
  segundos ? new Date(segundos * 1000).toISOString() : null;

// Dónde vive el fin del periodo. En las versiones nuevas de la API de Stripe se
// mudó de la suscripción a su primera línea, así que se miran los dos sitios y
// no hay que tocar nada cuando cambie la versión fijada arriba.
function finDePeriodo(sub: any): string | null {
  return iso(sub?.current_period_end ?? sub?.items?.data?.[0]?.current_period_end);
}

// Un id de usuario de Supabase es un uuid y nada más. Lo que llega en los
// metadatos y en client_reference_id lo escribió la función `pago`, pero se
// comprueba igual antes de usarlo: si algún día entrara por ahí cualquier otra
// cosa —una suscripción creada a mano desde el panel de Stripe, una prueba
// olvidada—, sin esto se iría tal cual a un `upsert`, la clave ajena lo
// rechazaría, la función devolvería 500 y Stripe reintentaría el mismo evento
// durante días. Con la comprobación se cae al cliente de Stripe, que es la vía
// que sí sabe resolverlo.
const esUuid = (s: unknown): s is string =>
  typeof s === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

// De quién es este evento. Por orden de fiabilidad:
//   1. Los metadatos que puso la función `pago`. Van en todos los eventos de la
//      suscripción, incluido el primero, que es justo el que puede llegar
//      **antes** que el del checkout: sin esto, ese primero se perdería.
//   2. El client_reference_id, que solo trae el checkout.
//   3. El cliente de Stripe, buscando la fila que ya se escribió.
async function deQuienEs(obj: any): Promise<string | null> {
  const meta = obj?.metadata?.supabase_user_id;
  if (esUuid(meta)) return meta;

  const ref = obj?.client_reference_id;
  if (esUuid(ref)) return ref;

  const cliente = typeof obj?.customer === 'string' ? obj.customer : obj?.customer?.id;
  if (!cliente) return null;
  const { data } = await admin
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', cliente)
    .maybeSingle();
  return esUuid(data?.user_id) ? data!.user_id : null;
}

// Los webhooks se reintentan y llegan desordenados. Sin esta comprobación, un
// 'trialing' reintentado puede pisar al 'active' que vino después y dejar a
// alguien que paga con la fecha de fin de la prueba.
async function esViejo(uid: string, cuando: string): Promise<boolean> {
  const { data } = await admin
    .from('subscriptions')
    .select('event_at')
    .eq('user_id', uid)
    .maybeSingle();
  return Boolean(data?.event_at && data.event_at >= cuando);
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method-not-allowed', { status: 405 });

  const secreto = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!secreto) {
    console.error('falta STRIPE_WEBHOOK_SECRET: ver docs/suscripcion.md');
    return new Response('sin-configurar', { status: 500 });
  }

  const firma = req.headers.get('stripe-signature');
  if (!firma) return new Response('sin-firma', { status: 400 });

  // El cuerpo se lee en crudo y sin parsear: la firma se calcula sobre los
  // bytes exactos, y volver a serializar un JSON ya no da los mismos.
  const crudo = await req.text();

  let evento: Stripe.Event;
  try {
    evento = await stripe.webhooks.constructEventAsync(crudo, firma, secreto, undefined, cripto);
  } catch (e) {
    console.warn('firma que no cuadra', e);
    return new Response('firma-no-valida', { status: 400 });
  }

  const obj: any = evento.data.object;
  const cuando = new Date(evento.created * 1000).toISOString();

  try {
    const uid = await deQuienEs(obj);
    if (!uid) {
      // Se responde 200 igual: si se devolviera un error, Stripe lo reintentaría
      // durante días y no hay reintento que arregle un evento que no es de nadie.
      console.warn('evento sin usuario', evento.type, obj?.id);
      return new Response('sin-usuario', { status: 200 });
    }

    if (evento.type === 'checkout.session.completed') {
      // Lo único que aporta este evento es el enlace entre la cuenta y el
      // cliente de Stripe. El estado de la suscripción llega en sus propios
      // eventos, así que aquí no se toca ni pro_until ni event_at.
      const cliente = typeof obj.customer === 'string' ? obj.customer : obj.customer?.id;
      if (cliente) {
        await admin.from('subscriptions').upsert({
          user_id: uid,
          stripe_customer_id: cliente,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
      }
      return new Response('ok', { status: 200 });
    }

    if (evento.type === 'customer.subscription.trial_will_end') {
      // Stripe avisa tres días antes. Es el momento de decirle a la persona que
      // va a empezar a pagar, que es lo que se espera de cualquiera que cobre.
      await enviarAviso(admin, uid, 'prueba');
      return new Response('ok', { status: 200 });
    }

    if (evento.type === 'customer.subscription.created' ||
        evento.type === 'customer.subscription.updated' ||
        evento.type === 'customer.subscription.deleted') {

      if (await esViejo(uid, cuando)) {
        console.warn('evento más viejo que lo guardado, se ignora', evento.type);
        return new Response('viejo', { status: 200 });
      }

      const estado: string = obj.status;
      // Cancelar "al final del periodo" llega como updated con el fin intacto,
      // así que el Pro se conserva hasta esa fecha, que es lo correcto: está
      // pagado. Cancelar a la brava llega como deleted y se corta cuando Stripe
      // diga, no cuando llegue el aviso.
      const proUntil = VIVOS.has(estado)
        ? finDePeriodo(obj)
        : (iso(obj.ended_at) ?? new Date().toISOString());

      const cliente = typeof obj.customer === 'string' ? obj.customer : obj.customer?.id;

      const { error } = await admin.from('subscriptions').upsert({
        user_id: uid,
        pro_until: proUntil,
        status: estado,
        stripe_customer_id: cliente ?? null,
        event_at: cuando,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

      if (error) {
        // Aquí sí interesa que Stripe reintente: es un fallo nuestro y el
        // siguiente intento puede salir bien.
        console.error('no se pudo guardar la suscripción', error);
        return new Response('no-se-pudo-guardar', { status: 500 });
      }
      return new Response('ok', { status: 200 });
    }

    // Cualquier otro evento que esté suscrito en el panel y aquí no se trate.
    return new Response('ignorado', { status: 200 });
  } catch (e) {
    console.error('fallo tratando ' + evento.type, e);
    return new Response('error', { status: 500 });
  }
});
