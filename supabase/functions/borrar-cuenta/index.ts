// Borra la cuenta entera: las cinco tablas y la fila de auth.users.
//
// Por qué esto no lo hace la app: con la clave anon y RLS se pueden marcar las
// filas propias como borradas, pero no se puede tocar auth.users. Mientras esa
// fila siga viva, la cuenta existe —se puede volver a entrar con ella— y lo que
// promete privacidad.html no es cierto. Hace falta la clave de servicio, y esa
// no puede vivir en el navegador, así que vive aquí.
//
// Dos decisiones que conviene no deshacer:
//
//   1. **De quién es la cuenta lo dice el token, nunca el cuerpo de la
//      petición.** La clave anon la tiene cualquiera que abra la web; si el id
//      del usuario llegara como parámetro, cualquiera podría borrar la cuenta de
//      otro. Aquí se resuelve con auth.getUser(token) y se ignora todo lo demás.
//   2. **El borrado es físico, no lógico.** En la app los borrados son lógicos
//      (deleted_at) porque hay que distinguir "lo borré" de "aún no lo he
//      subido" al sincronizar varios dispositivos. Aquí no queda ningún
//      dispositivo con el que reconciliar: la cuenta desaparece.
//
// Se despliega aparte del esquema (ver docs/supabase.md):
//
//   supabase functions deploy borrar-cuenta
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0';
import Stripe from 'https://esm.sh/stripe@22.6.2?target=deno';
import { json, preflight } from '../_shared/cors.ts';

// El orden importa: los hijos antes que los padres. Las claves ajenas de
// schema.sql tienen "on delete cascade", pero borrar en orden no depende de eso
// y deja claro qué se va.
//
// subscriptions y avisos van detrás porque no cuelgan de nada más que del
// usuario. Y tienen que ir: una suscripción que sobreviviera al borrado dejaría
// a alguien pagando por una cuenta que ya no existe.
const TABLAS = ['events', 'shots', 'matches', 'players', 'teams',
                'subscriptions', 'avisos'];

// CORS y la respuesta JSON, en _shared/cors.ts: quién puede llamar desde un
// navegador es la misma lista para las tres funciones que llama la app.

// Cancela la suscripción y borra el cliente de Stripe, que es donde queda el
// correo de la persona y su historial de pagos. Es la otra mitad de lo que
// promete privacidad.html: borrar la cuenta tiene que borrarla también donde
// está fuera de Supabase.
//
// No lanza: el borrado de la cuenta no puede quedarse a medias porque Stripe
// esté caído. Lo que no salga se queda registrado y se limpia a mano.
async function cancelarEnStripe(admin: any, uid: string): Promise<void> {
  const clave = Deno.env.get('STRIPE_SECRET_KEY');
  if (!clave) return;   // proyecto sin cobro configurado: no hay nada que cancelar
  try {
    const { data } = await admin
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', uid)
      .maybeSingle();
    const cliente = data?.stripe_customer_id;
    if (!cliente) return;

    const stripe = new Stripe(clave, {
      httpClient: Stripe.createFetchHttpClient(),
      apiVersion: '2025-08-27.basil'
    });
    // Borrar el cliente cancela sus suscripciones, pero se cancelan antes una a
    // una para que quede dicho: lo que no puede pasar es que siga un cobro.
    const subs = await stripe.subscriptions.list({ customer: cliente, status: 'all', limit: 100 });
    for (const s of subs.data) {
      if (s.status !== 'canceled' && s.status !== 'incomplete_expired') {
        await stripe.subscriptions.cancel(s.id);
      }
    }
    await stripe.customers.del(cliente);
  } catch (e) {
    console.warn('no se pudo cancelar en Stripe; la cuenta se borra igual', e);
  }
}

Deno.serve(async (req) => {
  // El navegador pregunta antes de llamar desde otro origen.
  if (req.method === 'OPTIONS') return preflight(req);
  if (req.method !== 'POST') return json(req, { error: 'method-not-allowed' }, 405);

  const auth = req.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return json(req, { error: 'sin-sesion' }, 401);

  // SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY las pone Supabase en el entorno de
  // la función: no hay que declararlas ni subirlas a ninguna parte.
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: quien, error: errorSesion } = await admin.auth.getUser(token);
  if (errorSesion || !quien?.user) return json(req, { error: 'sesion-no-valida' }, 401);
  const uid = quien.user.id;

  // Antes de borrar nada: cancelar lo que esté cobrándose en Stripe. Si no,
  // quien borra su cuenta se encuentra el recibo del mes que viene, y para
  // entonces ya no existe la fila que diría de quién era.
  //
  // Va aparte del bucle de abajo y con su propio try: si Stripe no responde, se
  // sigue borrando igual. Un cliente huérfano en Stripe se arregla a mano desde
  // su panel; una cuenta a medio borrar, no.
  await cancelarEnStripe(admin, uid);

  const borradas: Record<string, number> = {};
  for (const tabla of TABLAS) {
    const { error, count } = await admin
      .from(tabla)
      .delete({ count: 'exact' })
      .eq('user_id', uid);
    if (error) return json(req, { error: 'no-se-pudo-borrar', tabla, detalle: error.message }, 500);
    borradas[tabla] = count ?? 0;
  }

  // Lo último: mientras la fila de auth.users viva, la cuenta existe. Si esto
  // falla, los datos ya no están y se puede reintentar sin estropear nada, que
  // es mejor reparto que quedarse con los datos y sin cuenta.
  const { error: errorUsuario } = await admin.auth.admin.deleteUser(uid);
  if (errorUsuario) return json(req, { error: 'no-se-pudo-borrar-el-usuario', detalle: errorUsuario.message }, 500);

  return json(req, { ok: true, borradas });
});
