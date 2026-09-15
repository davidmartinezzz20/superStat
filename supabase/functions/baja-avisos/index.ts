// Darse de baja de los avisos por correo, desde el enlace del pie del correo.
//
// Es pública a propósito, y por eso lleva verify_jwt = false: un enlace de baja
// que exija iniciar sesión no es un enlace de baja. Quien lo pulsa muchas veces
// está en el ordenador del trabajo, o en el móvil sin la sesión abierta, y lo
// que espera es que funcione a la primera.
//
// Lo que sustituye a la sesión es el token: un uuid aleatorio por cuenta
// (avisos.baja_token) que no sale nunca al navegador —la app lee esa tabla sin
// esa columna— y que solo viaja dentro del correo de su dueño.
//
// Acepta GET (la persona pulsando) y POST (el "cancelar suscripción" que
// enseñan Gmail y Apple Mail por su cuenta, que va por la cabecera
// List-Unsubscribe-Post que se manda en _shared/correo.ts).
//
//   supabase functions deploy baja-avisos
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TEXTOS: Record<string, { titulo: string; cuerpo: string }> = {
  es: {
    titulo: 'Ya no recibirás más avisos',
    cuerpo: 'Te hemos dado de baja de los correos de SuperStat. Tus datos y tu ' +
            'cuenta no cambian, y puedes volver a activarlos cuando quieras desde ' +
            'la pantalla de Cuenta.'
  },
  en: {
    titulo: 'You will not get any more emails',
    cuerpo: 'You have been unsubscribed from SuperStat emails. Your data and your ' +
            'account are unchanged, and you can turn them back on at any time from ' +
            'the Account screen.'
  }
};

const ERROR: Record<string, { titulo: string; cuerpo: string }> = {
  es: {
    titulo: 'Este enlace ya no vale',
    cuerpo: 'No hemos podido encontrar a quién dar de baja. Puedes desactivar los ' +
            'avisos desde la pantalla de Cuenta de la app.'
  },
  en: {
    titulo: 'This link no longer works',
    cuerpo: 'We could not find who to unsubscribe. You can turn the emails off from ' +
            'the Account screen in the app.'
  }
};

// Una página suelta, sin CSS ni scripts del resto de la app, como
// privacidad.html: se abre desde un correo, en cualquier navegador, y no
// depende de que nada más cargue.
function pagina(t: { titulo: string; cuerpo: string }, status: number): Response {
  const html = `<!doctype html>
<html lang="es"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SuperStat</title>
</head>
<body style="margin:0;padding:40px 20px;background:#08090B;color:#F5F5F7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:440px;margin:0 auto;">
    <div style="font-size:13px;font-weight:700;letter-spacing:0.08em;color:#FF5A68;">SUPERSTAT</div>
    <h1 style="font-size:24px;line-height:1.25;margin:16px 0 12px;letter-spacing:-0.02em;">${t.titulo}</h1>
    <p style="font-size:15px;line-height:1.6;color:#8A8F98;margin:0;">${t.cuerpo}</p>
  </div>
</body></html>`;
  return new Response(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response('method-not-allowed', { status: 405 });
  }

  const token = new URL(req.url).searchParams.get('t') || '';
  // Se comprueba la forma antes de consultar: así un token inventado no llega
  // ni a tocar la base.
  const esUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);
  if (!esUuid) return pagina(ERROR.es, 400);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data, error } = await admin
    .from('avisos')
    .update({ email_ok: false, updated_at: new Date().toISOString() })
    .eq('baja_token', token)
    .select('lang')
    .maybeSingle();

  if (error || !data) {
    if (error) console.warn('no se pudo dar de baja', error);
    return pagina(ERROR.es, 404);
  }

  // En el idioma en el que se le escribió, que es el que esa persona entiende.
  return pagina(TEXTOS[data.lang === 'en' ? 'en' : 'es'], 200);
});
