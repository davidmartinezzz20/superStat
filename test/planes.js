// El plan Gratis, el plan Pro y el tope de equipos.
//
// Lo que se comprueba aquí es lo que decide si alguien puede seguir usando la
// app y si alguien puede pagar, y casi todo son casos que no se ven mirando la
// pantalla un rato:
//
//   - Que el tope **solo** esté en crear. Quien acaba una prueba con tres
//     equipos se queda con los tres: quitarle datos a alguien por dejar de
//     pagar sería otra cosa muy distinta de lo que se vende, y además rompería
//     la app en la cara de quien ya la usa.
//   - Que el derecho sobreviva a quedarse sin cobertura, que es la mitad de la
//     app: se guarda la fecha de fin, no un sí/no.
//   - Que una fecha ya pasada no desbloquee aunque siga en la caché.
//   - Que al salir de la cuenta el Pro no se le quede al siguiente que entre en
//     el mismo móvil.
//
// La app nativa tiene lo suyo en test/nativo.js: allí lo que se vigila es que
// **no** aparezca nada de comprar, que es lo que haría que la tumbaran en la
// revisión de la tienda.
//
//   python3 -m http.server 5173 &
//   node test/planes.js
const { chromium, LANZAR, CONTEXTO, BASE_URL, servidorListo } = require('./requiere-playwright.js');
const fs = require('fs');
const STUB = fs.readFileSync(__dirname + '/supabase-stub.js', 'utf8');
const GSTUB = fs.readFileSync(__dirname + '/google-stub.js', 'utf8');
const { rutasDePrueba } = require('./rutas.js');
const BASE = BASE_URL + '/index.html';

let fallos = 0, pasadas = 0;
function check(nombre, ok, detalle){
  if(ok){ pasadas++; console.log('  ok   ' + nombre); }
  else { fallos++; console.log('  FALLA ' + nombre + (detalle ? '  → ' + detalle : '')); }
}

async function nuevaPagina(browser){
  const ctx = await browser.newContext(Object.assign({}, CONTEXTO, {
    viewport:{ width:390, height:844 }, serviceWorkers:'block'
  }));
  await ctx.addInitScript({ content: STUB + '\n' + GSTUB });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fallos++; console.log('  FALLA error en página: ' + e.message); });
  await rutasDePrueba(page);
  // La pantalla de pago de Stripe no existe: se contesta con una página vacía
  // para poder comprobar que el botón lleva de verdad hasta allí.
  await page.route('**/pago.de.mentira/**', r => r.fulfill({
    contentType:'text/html', body:'<html><body>stripe</body></html>'
  }));
  return { ctx, page };
}

async function crearCuenta(page, correo){
  await page.waitForSelector('#auth-user');
  await page.click('#auth-toggle');            // pasar a "Crear cuenta"
  await page.fill('#auth-user', correo || 'david@correo.com');
  await page.fill('#auth-pass', 'balonmano1');
  await page.click('#auth-submit');
  await page.waitForSelector('#create-team-btn', { timeout:10000 });
}

async function altaEquipo(page, nombre){
  await page.fill('#new-team-name', nombre);
  await page.click('#create-team-btn');
  await page.waitForSelector('#add-player-btn', { timeout:10000 });
  await page.click('#to-dashboard');
  await page.waitForSelector('[data-team]');
}

// Deja en el "servidor" la fila de suscripción de quien esté dentro. Es lo que
// escribiría el webhook de Stripe, que es el único que puede hacerlo: la
// política RLS de esa tabla es de solo lectura para el usuario.
async function ponerPro(page, dias, estado){
  await page.evaluate(({ dias, estado }) => {
    const s = window.__SERVER__;
    const uid = s.session.user.id;
    s.rows.subscriptions[uid] = {
      user_id: uid,
      pro_until: new Date(Date.now() + dias * 86400000).toISOString(),
      status: estado || 'active',
      server_at: '2026-01-01T00:00:00.000Z'
    };
    try{ sessionStorage.setItem('__server__', JSON.stringify(s)); }catch(e){}
  }, { dias, estado });
  await page.evaluate(() => Store.sync());
  await page.waitForTimeout(250);
}

const esPro = page => page.evaluate(() => Store.isPro());
const equipos = page => page.evaluate(() => Store.teams().length);
const avisos = page => page.evaluate(() =>
  window.__SERVER__.invocaciones.filter(n => n === 'aviso-tope').length);

(async () => {
  await servidorListo();
  const browser = await chromium.launch(LANZAR);

  // ------------------------------------------------------------ 1. el tope
  console.log('\n1. El plan Gratis llega a un equipo');
  let { ctx, page } = await nuevaPagina(browser);
  await page.goto(BASE);
  await crearCuenta(page);

  check('una cuenta nueva no es Pro', await esPro(page) === false);
  await altaEquipo(page, 'CB Sabadell');
  check('el primer equipo se crea', await equipos(page) === 1);

  await page.waitForSelector('#team-limit-card', { timeout:5000 });
  check('el formulario de alta desaparece y sale el tope',
        await page.$('#create-team-btn') === null);
  check('el cartel dice a cuántos equipos llega el plan',
        (await page.textContent('#team-limit-card')).includes('1'));
  check('y no se ha creado ningún equipo de más', await equipos(page) === 1);

  // ------------------------------------- 2. lo que ya existe sigue entero
  console.log('\n2. Con el cupo agotado, el equipo que ya hay no se toca');
  await page.click('[data-team]');
  await page.waitForSelector('#add-player-btn');
  await page.fill('#p-name', 'Joan Vidal');
  await page.fill('#p-dorsal', '7');
  await page.selectOption('#p-pos', 'Lateral izquierdo');
  await page.click('#add-player-btn');
  await page.waitForSelector('.player-row');
  check('se puede seguir dando de alta jugadores', await page.$('.player-row') !== null);

  await page.click('#new-match-btn');
  await page.waitForSelector('#rival-name', { timeout:5000 });
  check('y se puede empezar un partido nuevo', await page.$('#rival-name') !== null);
  await page.click('#to-team');
  await page.waitForSelector('#add-player-btn');
  await page.click('#to-dashboard');
  await page.waitForSelector('#team-limit-card', { timeout:5000 });

  // --------------------------------------------------- 3. el aviso por correo
  console.log('\n3. El aviso del tope se pide una vez, no una por render');
  check('se ha pedido el aviso al enseñar el tope', await avisos(page) === 1,
        'llamadas: ' + await avisos(page));
  await page.click('#tab-account');
  await page.waitForSelector('#logout-btn');
  await page.click('#tab-home');
  await page.waitForSelector('#team-limit-card');
  check('volver a la pantalla no vuelve a pedirlo', await avisos(page) === 1,
        'llamadas: ' + await avisos(page));

  // ------------------------------------------------------------ 4. el paywall
  console.log('\n4. La pantalla de Pro y el botón de pago');
  await page.click('#go-pro');
  await page.waitForSelector('#go-checkout', { timeout:5000 });
  check('se llega a la pantalla de Pro', await page.$('#go-checkout') !== null);
  check('enseña el precio de js/config.js',
        (await page.textContent('main')).includes('4,99'));
  check('y dice que el pago lo gestiona Stripe',
        (await page.textContent('.plan-legal')).toLowerCase().includes('stripe'));

  await page.click('#go-checkout');
  await page.waitForURL('**/pago.de.mentira/**', { timeout:10000 });
  check('el botón lleva a la pantalla de pago de Stripe',
        page.url().includes('pago.de.mentira/suscribir'), page.url());

  // ------------------------------------------------- 5. la vuelta del pago
  console.log('\n5. Volver de pagar desbloquea sin recargar a mano');
  await page.goto(BASE);
  await page.waitForSelector('#team-limit-card', { timeout:10000 });
  // El webhook ha escrito la fila mientras el usuario estaba en Stripe.
  await page.evaluate(() => {
    const s = window.__SERVER__;
    const uid = s.session.user.id;
    s.rows.subscriptions[uid] = {
      user_id: uid,
      pro_until: new Date(Date.now() + 30 * 86400000).toISOString(),
      status: 'trialing',
      server_at: '2026-01-01T00:00:00.000Z'
    };
    try{ sessionStorage.setItem('__server__', JSON.stringify(s)); }catch(e){}
  });
  await page.goto(BASE + '?pago=ok');
  await page.waitForSelector('#create-team-btn', { timeout:15000 });
  check('vuelve de Stripe y el tope ya no está', await esPro(page) === true);
  check('la barra de direcciones queda limpia', !page.url().includes('pago='), page.url());

  // ------------------------------------------------------ 6. Pro de verdad
  console.log('\n6. Con Pro se crean los equipos que haga falta');
  await altaEquipo(page, 'CB Terrassa');
  check('el segundo equipo se crea', await equipos(page) === 2);
  await altaEquipo(page, 'CB Granollers');
  check('y el tercero también', await equipos(page) === 3);

  await page.click('#tab-account');
  await page.waitForSelector('#manage-plan', { timeout:5000 });
  check('la pantalla de Cuenta dice que la prueba está en marcha',
        (await page.textContent('main')).toLowerCase().includes('prueba'));

  // ------------------------------------------------------- 7. sin cobertura
  console.log('\n7. Sin conexión, el Pro guardado sigue valiendo');
  await page.evaluate(() => {
    window.__OFFLINE__ = true;
    Object.defineProperty(navigator, 'onLine', { value:false, configurable:true });
    window.dispatchEvent(new Event('offline'));
  });
  await page.click('#tab-home');
  await page.waitForSelector('#create-team-btn', { timeout:5000 });
  check('sigue siendo Pro sin red', await esPro(page) === true);
  await altaEquipo(page, 'CB Vic');
  check('y se puede crear un equipo sin cobertura', await equipos(page) === 4);
  await page.evaluate(() => {
    window.__OFFLINE__ = false;
    Object.defineProperty(navigator, 'onLine', { value:true, configurable:true });
    window.dispatchEvent(new Event('online'));
  });

  // --------------------------------------------------- 8. la fecha se acaba
  console.log('\n8. Una fecha pasada no desbloquea aunque esté en la caché');
  await ponerPro(page, -1, 'canceled');
  check('con la fecha vencida deja de ser Pro', await esPro(page) === false);
  await page.click('#tab-home');
  await page.waitForSelector('#team-limit-card', { timeout:5000 });
  check('vuelve a salir el tope', await page.$('#create-team-btn') === null);
  check('pero los cuatro equipos siguen ahí', await equipos(page) === 4);
  check('y se siguen pudiendo abrir', await page.$('[data-team]') !== null);

  // ----------------------------------------------------------- 9. la salida
  console.log('\n9. El Pro no se le queda al siguiente que entre');
  await ponerPro(page, 30, 'active');
  check('vuelve a ser Pro', await esPro(page) === true);
  await page.click('#tab-account');
  await page.waitForSelector('#logout-btn');
  await page.click('#logout-btn');
  await page.waitForSelector('#auth-submit', { timeout:10000 });
  check('al salir ya no hay Pro en memoria', await esPro(page) === false);

  await crearCuenta(page, 'otra@correo.com');
  check('la cuenta nueva empieza en Gratis', await esPro(page) === false);
  await altaEquipo(page, 'BM Granollers');
  await page.waitForSelector('#team-limit-card', { timeout:5000 });
  check('y tiene su propio tope de un equipo', await equipos(page) === 1);

  await ctx.close();

  console.log(`\n${pasadas} comprobaciones pasadas, ${fallos} fallidas`);
  await browser.close();
  process.exit(fallos ? 1 : 0);
})();
