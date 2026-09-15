// El puente con la app de Android e iOS (js/native.js).
//
// Son las tres cosas que un WebView no sabe hacer solo —entrar con Google,
// guardar un archivo y compartir— y hasta ahora lo único que se comprobaba de
// ellas es que en el navegador se apartan (test/live.js). Lo que pasa dentro de
// la app no lo veía nadie, y es justo lo que se rompe al actualizar un plugin:
// un método que cambia de nombre, o una cancelación que deja de llegar como
// error y empieza a llegar como resultado.
//
// Aquí la página se carga con el doble de test/capacitor-stub.js puesto, así que
// native.js se cree que está dentro de la app.
//
//   python3 -m http.server 5173 &
//   node test/nativo.js
const { chromium, LANZAR, CONTEXTO, BASE_URL, servidorListo } = require('./requiere-playwright.js');
const fs = require('fs');
const CAPSTUB = fs.readFileSync(__dirname + '/capacitor-stub.js', 'utf8');
const STUB = fs.readFileSync(__dirname + '/supabase-stub.js', 'utf8');
const GSTUB = fs.readFileSync(__dirname + '/google-stub.js', 'utf8');
const { rutasDePrueba } = require('./rutas.js');
const BASE = BASE_URL + '/index.html';

let fallos = 0, pasadas = 0;
function check(nombre, ok, detalle){
  if(ok){ pasadas++; console.log('  ok   ' + nombre); }
  else { fallos++; console.log('  FALLA ' + nombre + (detalle ? '  → ' + detalle : '')); }
}

// La configuración del doble va antes que el doble, y el doble antes que la
// página: plugin() guarda lo que encuentra la primera vez, y Native.start() se
// llama nada más arrancar la app.
async function appNativa(browser, conf){
  const ctx = await browser.newContext(Object.assign({}, CONTEXTO, { viewport:{ width:390, height:844 }, serviceWorkers:'block' }));
  await ctx.addInitScript({ content:
    'window.__NATIVO_CONF__ = ' + JSON.stringify(conf || {}) + ';\n' +
    CAPSTUB + '\n' + STUB + '\n' + GSTUB
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fallos++; console.log('  FALLA error en página: ' + e.message); });
  await rutasDePrueba(page);
  // El capacitor-core de vendor/ deja él mismo su window.capacitorExports, y
  // pisaría el doble diciendo que la plataforma es "web". En el resto de las
  // pruebas se carga de verdad a propósito —ahí lo que se comprueba es que el
  // puente se aparta en el navegador—, así que esto se queda aquí y no en
  // test/rutas.js.
  await page.route('**/vendor/capacitor-core-*.js', r => r.fulfill({
    contentType:'application/javascript', body:''
  }));
  await page.goto(BASE);
  await page.waitForSelector('#auth-submit', { timeout:10000 });
  return { ctx, page };
}

const llamadas = page => page.evaluate(() => window.__NATIVO__.llamadas);

(async () => {
  await servidorListo();
  const browser = await chromium.launch(LANZAR);

  // ------------------------------------------------------- 1. el arranque
  console.log('\n1. La app arranca como nativa');
  let { ctx, page } = await appNativa(browser, { plataforma:'android' });

  check('Native se reconoce dentro de la app', await page.evaluate(() => Native.isNative()) === true);
  check('y sabe en qué plataforma está', await page.evaluate(() => Native.platform()) === 'android');

  // start() se llama solo al arrancar (js/app.js), así que a estas alturas ya
  // tiene que haber dejado la app presentable.
  await page.waitForFunction(() => window.__NATIVO__.llamadas.includes('SplashScreen.hide'), null, { timeout:5000 })
    .catch(() => {});
  const arranque = await llamadas(page);
  check('pone la barra de estado en oscuro', arranque.includes('StatusBar.setStyle') &&
        await page.evaluate(() => window.__NATIVO__.args['StatusBar.setStyle'].style) === 'DARK');
  check('y en Android también le da color de fondo',
        arranque.includes('StatusBar.setBackgroundColor') &&
        await page.evaluate(() => window.__NATIVO__.args['StatusBar.setBackgroundColor'].color) === '#08090B');
  check('engancha el botón atrás de Android', arranque.includes('App.addListener') &&
        await page.evaluate(() => window.__NATIVO__.args['App.addListener']) === 'backButton');
  check('quita la pantalla de carga al final', arranque.includes('SplashScreen.hide'));

  // El botón atrás cierra lo que haya abierto antes de salir de la app: sin
  // esto, atrás cierra la app en mitad de un partido.
  const atras = await page.evaluate(async () => {
    const antes = window.__NATIVO__.llamadas.filter(l => l === 'App.exitApp').length;
    await window.__NATIVO__.listeners.backButton({ canGoBack:false });
    return window.__NATIVO__.llamadas.filter(l => l === 'App.exitApp').length - antes;
  });
  check('sin nada abierto y sin historial, atrás sale de la app', atras === 1);

  // ----------------------------------------------- 2. el botón de Google
  console.log('\n2. Entrar con Google lo pide el sistema');
  check('en la app el botón de Google es el nuestro, no el de GIS',
        await page.$('#google-native') !== null && await page.$('#google-btn') === null);

  const token = await page.evaluate(() => Native.googleIdToken());
  check('devuelve el id_token que da el sistema', token === 'id-token-de-mentira', String(token));
  check('inicializa el plugin con el ID de cliente de la configuración',
        await page.evaluate(() => window.__NATIVO__.args['SocialLogin.initialize'].google.webClientId)
          === 'cliente-de-prueba.apps.googleusercontent.com');
  check('pide el token a Google y no a otra cosa',
        await page.evaluate(() => window.__NATIVO__.args['SocialLogin.login'].provider) === 'google');

  // initialize() se llama una vez y no en cada intento.
  await page.evaluate(() => Native.googleIdToken());
  check('no vuelve a inicializar el plugin en el segundo intento',
        (await llamadas(page)).filter(l => l === 'SocialLogin.initialize').length === 1);

  await page.evaluate(() => Native.googleSignOut());
  check('salir cierra también la sesión de Google del sistema',
        (await llamadas(page)).includes('SocialLogin.logout'),
        'sin esto, el siguiente login entra con la misma cuenta sin preguntar');

  // Google puede responder sin token: eso sí es un fallo y tiene que decirlo,
  // no devolver algo que luego Supabase rechace sin explicación.
  const sinToken = await appNativa(browser, { googleSinToken:true });
  check('si Google no devuelve token, se dice',
        await sinToken.page.evaluate(async () => {
          try{ await Native.googleIdToken(); return 'sin error'; }
          catch(e){ return e.message; }
        }) === 'google-sin-token');
  await sinToken.ctx.close();

  // ------------------------------------------------------- 3. archivos
  console.log('\n3. Guardar y compartir un archivo');
  const guardado = await page.evaluate(async () => {
    const blob = new Blob(['hola;que;tal'], { type:'text/csv' });
    const ruta = await Native.saveFile(blob, 'partido.csv');
    const w = window.__NATIVO__.args['Filesystem.writeFile'];
    return { ruta, directorio: w.directory, nombre: w.path, datos: w.data };
  });
  check('el CSV se escribe en la carpeta de documentos', guardado.directorio === 'DOCUMENTS',
        guardado.directorio);
  check('con su nombre y devolviendo la ruta escrita',
        guardado.nombre === 'partido.csv' && String(guardado.ruta).includes('partido.csv'),
        String(guardado.ruta));
  check('el contenido va en base64 y sin la cabecera del data URI',
        guardado.datos === btoaNode('hola;que;tal'), guardado.datos);

  const compartido = await page.evaluate(async () => {
    const blob = new Blob(['x'], { type:'image/png' });
    const ok = await Native.shareFile(blob, 'partido.png', 'Partido');
    return { ok, directorio: window.__NATIVO__.args['Filesystem.writeFile'].directory,
             archivos: window.__NATIVO__.args['Share.share'].files };
  });
  check('compartir escribe antes en la caché, que es de paso', compartido.directorio === 'CACHE');
  check('y abre la hoja del sistema con el archivo dentro',
        compartido.ok === true && compartido.archivos.length === 1);
  await ctx.close();

  // ----------------------------------------- 4. cancelar no es un fallo
  console.log('\n4. Cancelar la hoja de compartir');
  // Cancelar llega como error desde el plugin. Si se tomara por un fallo de
  // verdad, el usuario vería un aviso de error por haber dicho que no.
  ({ ctx, page } = await appNativa(browser, { shareError:'User cancelled the share' }));
  const cancelado = await page.evaluate(async () => {
    const blob = new Blob(['x'], { type:'image/png' });
    return Native.shareFile(blob, 'partido.png', 'Partido');
  });
  check('cancelar devuelve false y no revienta', cancelado === false, String(cancelado));
  await ctx.close();

  ({ ctx, page } = await appNativa(browser, { shareError:'no such file' }));
  const roto = await page.evaluate(async () => {
    const blob = new Blob(['x'], { type:'image/png' });
    try{ await Native.shareFile(blob, 'partido.png', 'Partido'); return 'sin error'; }
    catch(e){ return 'error: ' + e.message; }
  });
  check('un fallo de verdad sí se propaga', roto.indexOf('error:') === 0, roto);
  await ctx.close();

  // --------------------------------- 5. una app compilada sin un plugin
  console.log('\n5. Un plugin que no está instalado');
  // registerPlugin() siempre devuelve un proxy, exista o no el plugin: si no se
  // preguntara antes, la llamada reventaría dentro y se llevaría por delante lo
  // que la rodea. Aquí se comprueba que se pregunta.
  ({ ctx, page } = await appNativa(browser, { sinPlugins:['Share','Filesystem'] }));
  check('sin el plugin, compartir se aparta en vez de fallar',
        await page.evaluate(async () => {
          const blob = new Blob(['x'], { type:'image/png' });
          return Native.shareFile(blob, 'partido.png', 'Partido');
        }) === null);
  check('sin Filesystem, guardar también devuelve null',
        await page.evaluate(async () => {
          const blob = new Blob(['x'], { type:'text/csv' });
          return Native.saveFile(blob, 'partido.csv');
        }) === null);
  check('ni siquiera se le pide el plugin al puente',
        (await llamadas(page)).every(l => l !== 'registerPlugin:Share'));
  check('y lo que sí está instalado sigue funcionando',
        (await llamadas(page)).includes('registerPlugin:StatusBar'));
  await ctx.close();

  // --------------------------------------- 6. servido en el navegador
  console.log('\n6. Capacitor servido en el navegador');
  // Capacitor también se puede servir en un navegador normal. Ahí manda el
  // camino web, aunque el puente exista.
  ({ ctx, page } = await appNativa(browser, { web:true }));
  check('con plataforma web no se considera nativo',
        await page.evaluate(() => Native.isNative()) === false);
  check('y las tres funciones devuelven null para que se use el camino de siempre',
        await page.evaluate(async () => {
          const blob = new Blob(['x']);
          return [await Native.googleIdToken(),
                  await Native.saveFile(blob, 'a.csv'),
                  await Native.shareFile(blob, 'a.png', 'x')].every(r => r === null);
        }));
  await ctx.close();

  // ------------------------------------------ 7. dentro de la app no se vende
  //
  // Esta es la comprobación que evita que tumben la app en la revisión de la
  // tienda. Apple (guía 3.1.1) y Google prohíben que una app lleve a comprar
  // fuera de su sistema de pago, y no hace falta un enlace: cuenta también un
  // texto que diga dónde se compra. Como SuperStat cobra en la web, aquí dentro
  // no puede haber ni botón, ni precio, ni dirección, ni la palabra Stripe.
  //
  // Es exactamente el tipo de regla que alguien deshace sin querer dentro de
  // seis meses añadiendo un botón "muy útil", y para entonces nadie se acuerda
  // de por qué no estaba. La única forma de que no se cuele en una
  // actualización es que falle una prueba.
  console.log('\n7. Dentro de la app no se vende nada');
  ({ ctx, page } = await appNativa(browser, { plataforma:'ios' }));

  // Una cuenta con un equipo: justo el estado en el que aparece el tope.
  await page.click('#auth-toggle');
  await page.fill('#auth-user', 'tienda@correo.com');
  await page.fill('#auth-pass', 'balonmano1');
  await page.click('#auth-submit');
  await page.waitForSelector('#create-team-btn', { timeout:10000 });
  await page.fill('#new-team-name', 'CB Sabadell');
  await page.click('#create-team-btn');
  await page.waitForSelector('#add-player-btn', { timeout:10000 });
  await page.click('#to-dashboard');
  await page.waitForSelector('#team-limit-card', { timeout:10000 });

  check('al llegar al tope no hay botón de comprar',
        await page.$('#go-pro') === null && await page.$('#go-checkout') === null);

  const visible = (await page.textContent('#app')).toLowerCase();
  const prohibidas = ['stripe', '€', 'http', '.com', '.online', 'suscri', 'precio', 'pago'];
  const encontradas = prohibidas.filter(p => visible.includes(p));
  check('ni precio, ni dirección, ni una palabra sobre dónde se paga',
        encontradas.length === 0, 'aparece: ' + encontradas.join(', '));

  // Y si alguien llega a la pantalla de Pro por una ruta olvidada, tampoco.
  const aDondeVa = await page.evaluate(() => {
    window.SuperStatBack();              // por tener un gesto cualquiera antes
    const app = document.getElementById('app');
    return app.className;
  });
  check('el panel sigue siendo el panel', aDondeVa.includes('screen-'), aDondeVa);

  await page.click('#tab-account');
  await page.waitForSelector('#logout-btn', { timeout:10000 });
  check('la pantalla de Cuenta enseña el plan pero no lo vende',
        (await page.textContent('#app')).includes('Gratis') &&
        await page.$('#manage-plan') === null && await page.$('#go-pro') === null);
  await ctx.close();

  console.log(`\n${pasadas} comprobaciones pasadas, ${fallos} fallidas`);
  await browser.close();
  process.exit(fallos ? 1 : 0);
})();

// El contenido del archivo viaja en base64; aquí se calcula el esperado.
function btoaNode(txt){ return Buffer.from(txt, 'utf8').toString('base64'); }
