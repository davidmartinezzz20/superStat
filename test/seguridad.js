// Las decisiones de seguridad que no se ven mirando la pantalla.
//
// Todo lo que hay aquí falla en silencio: nadie nota que la
// Content-Security-Policy se ha quedado sin `script-src`, ni que alguien ha
// vuelto a dar permiso de lectura sobre `avisos` entera, ni que un import de una
// Edge Function ha perdido su versión. No se rompe nada; simplemente deja de
// estar protegido lo que estaba protegido, y no hay forma de enterarse hasta que
// pasa algo. Eso es exactamente lo que detecta una prueba y no una persona.
//
// Mira los archivos como texto: no hace falta ni navegador ni servidor, así que
// corre la primera junto a test/archivos.js.
//
//   node test/seguridad.js
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const leer = rel => fs.readFileSync(path.join(RAIZ, rel), 'utf8');
const existe = rel => fs.existsSync(path.join(RAIZ, rel));

let fallos = 0, pasadas = 0;
function check(nombre, ok, detalle){
  if(ok){ pasadas++; console.log('  ok   ' + nombre); }
  else { fallos++; console.log('  FALLA ' + nombre + (detalle ? '  → ' + detalle : '')); }
}

const index = leer('index.html');
const vercel = JSON.parse(leer('vercel.json'));
const esquema = leer('supabase/schema.sql');

// ------------------------------------------------------------------- la CSP

// Las directivas, de una política escrita de corrido o en varias líneas.
function directivas(csp){
  const out = {};
  csp.split(';').forEach(trozo => {
    const partes = trozo.trim().split(/\s+/).filter(Boolean);
    if(partes.length) out[partes[0]] = partes.slice(1);
  });
  return out;
}

console.log('\n1. La página declara una Content-Security-Policy');
const meta = index.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([\s\S]*?)">/);
check('index.html lleva la CSP en <meta>', Boolean(meta));

const dMeta = meta ? directivas(meta[1]) : {};

// Sin default-src, todo lo que no se nombre queda abierto.
check("default-src es 'self'", (dMeta['default-src'] || []).join(' ') === "'self'",
      (dMeta['default-src'] || []).join(' '));

// La que de verdad para un XSS. 'unsafe-inline' aquí la anularía entera: por eso
// el registro del service worker vive en js/sw-register.js y no en una etiqueta
// suelta dentro del HTML.
const script = (dMeta['script-src'] || []).join(' ');
check("script-src es 'self' más Google y Vercel Analytics",
      script === "'self' https://accounts.google.com https://cdn.vercel-insights.com", script);
check("script-src no lleva 'unsafe-inline' ni 'unsafe-eval'",
      !/unsafe-(inline|eval)/.test(script), script);

// Y si la CSP prohíbe los scripts en línea, lo que hay dentro del HTML tiene
// que ser exactamente dos cosas: el de Vercel Analytics que inicializa
// window.va, y el bloque de datos estructurados. Se mira sin los comentarios
// (sinComentarios() está más abajo): el propio comentario que explica la CSP
// usa la palabra <script> como ejemplo, y eso tiene que poder seguir escrito.
//
// El de datos estructurados no es una excepción a la CSP sino algo que la CSP
// no mira: type="application/ld+json" es un bloque de datos, el navegador no lo
// ejecuta nunca y script-src no interviene. Por eso se permite sin abrir la
// política, y solo si es JSON de verdad: lo que se sigue prohibiendo, que es de
// lo que va todo esto, es JavaScript escrito dentro del HTML.
const enLinea = sinComentarios(index)
  .match(/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/g) || [];
const vaScript = enLinea.filter(s => /window\.va.*window\.vaq/.test(s));
const datos = enLinea.filter(s => /type="application\/ld\+json"/.test(s));
const otrosScripts = enLinea.length - vaScript.length - datos.length;
check('index.html no tiene más scripts en línea que el de Vercel Analytics y los datos',
      otrosScripts === 0,
      enLinea.length + ' encontrados (' + otrosScripts + ' no permitidos)');

// A dónde puede hablar la página. Es la mitad que importa cuando el escapado
// falla: sin connect-src, un script colado se lleva los datos a donde quiera.
const connect = (dMeta['connect-src'] || []).join(' ');
check('connect-src solo deja Supabase, Google y Vercel Analytics',
      connect === "'self' https://*.supabase.co https://accounts.google.com https://vitals.vercel-insights.com", connect);

for(const d of ['base-uri', 'object-src', 'form-action']){
  check(d + " está en 'none'", (dMeta[d] || []).join(' ') === "'none'",
        (dMeta[d] || []).join(' '));
}

console.log('\n1 bis. Los datos estructurados no venden nada');
// index.html se copia tal cual dentro del binario de Android e iPhone
// (tools/build-www.js), así que lo que se escriba aquí viaja dentro de la app.
// Apple (guía 3.1.1) y Google prohíben que una app lleve a comprar fuera de su
// sistema de pago, y no hace falta un botón: cuenta un texto o una dirección.
// El precio va en las portadas de superstat.online, que son web; aquí no.
//
// Esta comprobación vive aquí y no en test/nativo.js §7 por dos razones: la de
// nativo lee el texto visible de #app y esto está en el <head>, y necesita
// Playwright, mientras que ésta corre en cada push (.github/workflows).
check('index.html lleva un bloque de datos estructurados y solo uno',
      datos.length === 1, datos.length + ' encontrados');

const json = (datos[0] || '').replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '');
let ld = null;
try { ld = JSON.parse(json); } catch(e){ ld = e; }
check('los datos estructurados parsean como JSON',
      ld !== null && !(ld instanceof Error),
      ld instanceof Error ? ld.message : 'no hay bloque application/ld+json');
check('describen la app (SoftwareApplication) con el @id de superstat.online',
      Boolean(ld) && !(ld instanceof Error) &&
      ld['@type'] === 'SoftwareApplication' &&
      ld['@id'] === 'https://superstat.online/#app',
      ld && !(ld instanceof Error) ? ld['@type'] + ' · ' + ld['@id'] : '');

const venta = /stripe|checkout|"offers"|priceCurrency|€|suscrip|precio/i;
check('no dicen ni precio, ni oferta, ni dónde se paga', !venta.test(json),
      (json.match(venta) || []).join(''));

console.log('\n2. Las cabeceras del servidor dicen lo mismo');
const todas = (vercel.headers || []).find(h => h.source === '/(.*)');
check('vercel.json pone cabeceras en todas las rutas', Boolean(todas));

const cab = {};
(todas ? todas.headers : []).forEach(h => { cab[h.key] = h.value; });

check('hay Content-Security-Policy en cabecera', Boolean(cab['Content-Security-Policy']));

// La CSP de la cabecera y la del <meta> tienen que decir lo mismo. La del HTML
// es la única que llega dentro de la app de móvil, donde no hay servidor; la de
// la cabecera añade frame-ancestors, que en <meta> el navegador ignora. Que se
// separen es el fallo silencioso clásico: se endurece una y la otra se queda.
const dCab = directivas(cab['Content-Security-Policy'] || '');
const soloCabecera = ['frame-ancestors'];
const distintas = Object.keys({ ...dMeta, ...dCab }).filter(d =>
  !soloCabecera.includes(d) &&
  (dMeta[d] || []).join(' ') !== (dCab[d] || []).join(' '));
check('la CSP del <meta> y la de la cabecera coinciden',
      distintas.length === 0, 'se separan en: ' + distintas.join(', '));
check("la cabecera añade frame-ancestors 'none'",
      (dCab['frame-ancestors'] || []).join(' ') === "'none'");

const esperadas = {
  'Strict-Transport-Security': /max-age=\d{7,}/,
  'X-Content-Type-Options': /^nosniff$/,
  'X-Frame-Options': /^DENY$/,
  'Referrer-Policy': /origin/,
  // Con same-origin, la ventana de Google no puede contestarle a la app y el
  // login se queda colgado. Es la única que tiene que ser exactamente esta.
  'Cross-Origin-Opener-Policy': /^same-origin-allow-popups$/,
  'Permissions-Policy': /camera=\(\)/
};
for(const [k, re] of Object.entries(esperadas)){
  check(k + ' está y dice lo que tiene que decir', re.test(cab[k] || ''), cab[k]);
}

// ------------------------------------------------------------ lo del servidor

console.log('\n3. Ningún secreto de servidor en lo que se descarga');
// js/config.js se publica a propósito: la clave anon viaja dentro del JavaScript
// de cualquiera que abra la web. Lo que no puede aparecer jamás en el navegador
// es la clave de servicio, que se salta RLS entera, ni una clave de Stripe o de
// Resend. Se mira en todo lo que se sirve, no solo en config.js.
// Los .html se buscan en la raíz en vez de nombrarlos: hay uno por idioma de la
// política de privacidad y el día que se añada otro nadie se acordará de
// apuntarlo aquí. Lo que se sirve del sitio es lo que hay que barrer.
const DELCLIENTE = fs.readdirSync(RAIZ)
  .filter(f => f.endsWith('.html'))
  .concat(['sw.js', 'css/styles.css'])
  .concat(fs.readdirSync(path.join(RAIZ, 'js')).map(f => 'js/' + f));

check('el barrido alcanza index.html y todas las políticas de privacidad',
      DELCLIENTE.includes('index.html') &&
      DELCLIENTE.filter(f => f.startsWith('privacidad')).length >= 1,
      DELCLIENTE.filter(f => f.endsWith('.html')).join(', '));

const VENENO = [
  [/service_role/, 'la clave de servicio'],
  [/\bsk_(live|test)_[A-Za-z0-9]/, 'una clave secreta de Stripe'],
  [/\bwhsec_[A-Za-z0-9]/, 'el secreto del webhook de Stripe'],
  [/\bre_[A-Za-z0-9]{16,}/, 'una clave de Resend'],
  [/GOCSPX-/, 'el secreto de cliente de Google'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'una clave privada']
];
// Sin los comentarios: js/config.js explica en los suyos que la clave
// `service_role` no va ahí, y esa frase tiene que poder seguir escrita. Lo que
// se busca es un secreto de verdad en el código, no una advertencia sobre él.
function sinComentarios(src){
  return src
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').map(l => l.replace(/(^|\s)\/\/.*$/, '')).join('\n');
}

for(const rel of DELCLIENTE){
  const src = sinComentarios(leer(rel));
  const malo = VENENO.filter(([re]) => re.test(src));
  check(rel + ' no lleva secretos de servidor', malo.length === 0,
        malo.map(m => m[1]).join(', '));
}

// Y que la clave que sí va sea la anon y no otra: el rol viaja dentro del propio
// JWT, así que se puede comprobar sin preguntarle a nadie.
const config = leer('js/config.js');
const jwt = (config.match(/SUPABASE_ANON_KEY:\s*'([^']+)'/) || [])[1] || '';
const cuerpo = jwt.split('.')[1];
let rol = null;
if(cuerpo){
  try{ rol = JSON.parse(Buffer.from(cuerpo, 'base64').toString('utf8')).role; }
  catch(e){ /* no es un JWT: lo dice el check de abajo */ }
}
check('la clave de js/config.js es la anon', rol === 'anon', 'rol: ' + rol);

console.log('\n4. Las Edge Functions traen sus dependencias con versión');
// Un import sin versión se resuelve a lo último que haya el día del despliegue.
// Estas funciones corren con la clave de servicio: si el paquete de turno sale
// comprometido, se lleva por delante la base entera. Con la versión fijada, lo
// que se despliega es lo que se leyó.
const funciones = [];
(function recorrer(dir){
  for(const f of fs.readdirSync(path.join(RAIZ, dir))){
    const rel = dir + '/' + f;
    if(fs.statSync(path.join(RAIZ, rel)).isDirectory()) recorrer(rel);
    else if(f.endsWith('.ts')) funciones.push(rel);
  }
})('supabase/functions');

for(const rel of funciones){
  const sinVersion = (leer(rel).match(/from '(https:\/\/[^']+)'/g) || [])
    .filter(l => !/@\d+\.\d+\.\d+/.test(l));
  check(rel + ' fija la versión de todo lo que importa', sinVersion.length === 0,
        sinVersion.join(', '));
}

console.log('\n5. RLS y permisos por columna en el esquema');
const TABLAS = ['teams','players','matches','shots','events','subscriptions','avisos'];
for(const tabla of TABLAS){
  check(tabla + ' tiene RLS activada',
        new RegExp('alter table public\\.' + tabla + '\\s+enable row level security')
          .test(esquema));
}

// La política de subscriptions es de **solo lectura**, y es lo único que impide
// que cualquiera se regale el Pro: la escribe el webhook de Stripe con la clave
// de servicio. Un "for all" aquí sería el plan de pago regalado.
const polSubs = esquema.match(/create policy [^;]*on public\.subscriptions[^;]*;/g) || [];
check('subscriptions tiene una sola política y es de lectura',
      polSubs.length === 1 && /for select/.test(polSubs[0]),
      polSubs.length + ' políticas');

// Lo que el navegador puede leer de las dos tablas del plan, columna a columna.
check('se revoca el select sobre avisos y subscriptions',
      /revoke select on public\.avisos\s+from anon, authenticated;/.test(esquema) &&
      /revoke select on public\.subscriptions\s+from anon, authenticated;/.test(esquema));
check('baja_token no está entre las columnas que se conceden',
      !/grant\s+select[^;]*baja_token/.test(esquema));
check('stripe_customer_id tampoco',
      !/grant\s+select[^;]*stripe_customer_id/.test(esquema));

// Y el interruptor de avisos solo puede tocar dos columnas.
check('el usuario solo puede escribir email_ok y lang de avisos',
      /revoke update on public\.avisos from authenticated;/.test(esquema) &&
      /grant\s+update \(email_ok, lang\) on public\.avisos to authenticated;/.test(esquema));

// La purga de lo borrado corre con security definer: si la pudiera llamar un
// cliente con la clave anon, cualquiera forzaría el borrado definitivo antes de
// tiempo, que es justo lo contrario de lo que promete privacidad.html.
check('purgar_borrados no se le concede a nadie',
      /revoke all on function public\.purgar_borrados\(integer\) from anon, authenticated;/
        .test(esquema));

console.log('\n6. El CSV no se abre como una fórmula');
// Excel y compañía ejecutan cualquier celda que empiece por = + @ o tabulador.
// El nombre de un jugador lo escribe una persona, y el CSV lo abre otra.
const app = leer('js/app.js');
check('csvCell neutraliza las celdas que parecen fórmula',
      /const FORMULA\s*=/.test(app) && /FORMULA\.test\(s\)/.test(app));

console.log('\n7. Lo que no puede entrar en el repositorio');
const ignore = leer('.gitignore');
for(const patron of ['.env', '*.keystore', '*.jks', '*.p12']){
  check('.gitignore ignora ' + patron, ignore.split('\n').includes(patron));
}
check('existe SECURITY.md', existe('SECURITY.md'));

console.log(`\n${pasadas} comprobaciones pasadas, ${fallos} fallidas`);
process.exit(fallos ? 1 : 0);
