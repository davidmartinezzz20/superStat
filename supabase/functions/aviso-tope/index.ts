// "Alguien ha chocado con el tope del plan gratis": decide si se le escribe.
//
// La llama la app cuando enseña el cartel del límite. Y la llama **siempre**,
// sin mirar nada: quien decide si el correo sale o no es esta función, no el
// navegador. Un límite que se comprueba en el cliente no es un límite, porque
// el cliente se puede recargar cincuenta veces seguidas.
//
// Tres cosas hay que cumplir para que salga:
//   1. Que la persona no se haya dado de baja de los avisos.
//   2. Que no se le haya escrito por esto en los últimos 30 días.
//   3. Que haya una clave de Resend configurada.
//
// Responde 200 en todos los casos, mande o no. La pantalla no cambia por esto y
// no tiene nada que hacer con la respuesta: contarle al usuario que hay un
// correo en camino sería, dentro de la app de móvil, otra forma de llevarlo a
// comprar fuera (ver puedeComprar() en js/app.js).
//
//   supabase functions deploy aviso-tope
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { enviarAviso } from '../_shared/correo.ts';

const DIAS_ENTRE_AVISOS = 30;

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);

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

  // El idioma con el que la app está funcionando ahora mismo. Es una copia para
  // los correos: la preferencia de interfaz es del aparato y no se sincroniza
  // (ver Store.setLang), así que sin esto el servidor no sabría en qué idioma
  // escribir. Solo se aceptan los dos que existen.
  let lang: string | null = null;
  try {
    const cuerpo = await req.json();
    if (cuerpo?.lang === 'es' || cuerpo?.lang === 'en') lang = cuerpo.lang;
  } catch (_e) { /* sin cuerpo: se queda el que hubiera */ }
  if (lang) await admin.from('avisos').update({ lang }).eq('user_id', uid);

  const { data: fila } = await admin
    .from('avisos')
    .select('tope_avisado_at')
    .eq('user_id', uid)
    .maybeSingle();

  const corte = Date.now() - DIAS_ENTRE_AVISOS * 24 * 60 * 60 * 1000;
  if (fila?.tope_avisado_at && new Date(fila.tope_avisado_at).getTime() > corte) {
    return json({ ok: true, enviado: false, motivo: 'hace-poco' });
  }

  // enviarAviso ya mira si la persona quiere que se le escriba, y no lanza: si
  // el correo no sale, no se sella la fecha y se podrá volver a intentar.
  const enviado = await enviarAviso(admin, uid, 'tope');
  if (enviado) {
    await admin.from('avisos')
      .update({ tope_avisado_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('user_id', uid);
  }

  return json({ ok: true, enviado });
});
