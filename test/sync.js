const { chromium } = require('playwright');
const fs = require('fs');
const DIR = require('os').tmpdir();
const STUB = fs.readFileSync(__dirname + '/supabase-stub.js', 'utf8');
const GSTUB = fs.readFileSync(__dirname + '/google-stub.js', 'utf8');
const BASE = 'http://localhost:5173/index.html';
// Si el Chromium que trae Playwright no está instalado, se le puede pasar uno
// con CHROMIUM_PATH=/ruta/al/chromium.
const LANZAR = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};

let fallos = 0, pasadas = 0;
function check(nombre, ok, detalle){
  if(ok){ pasadas++; console.log('  ok   ' + nombre); }
  else { fallos++; console.log('  FALLA ' + nombre + (detalle ? '  → ' + detalle : '')); }
}

// El "servidor" vive en el navegador; para simular dos dispositivos se pasa su
// estado de una página a otra.
async function nuevaPagina(browser, serverState){
  // El service worker se bloquea en las pruebas: si sirviera el shell desde su
  // caché, se saltaría los page.route() con los que se sustituyen el CDN y la
  // configuración, y las pruebas dejarían de probar lo que creen.
  const ctx = await browser.newContext({ viewport:{ width:390, height:844 }, serviceWorkers:'block' });
  await ctx.addInitScript({ content:
    (serverState ? 'window.__SERVER__ = ' + JSON.stringify(serverState) + ';' : '') + '\n' + STUB + '\n' + GSTUB
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fallos++; console.log('  FALLA error en página: ' + e.message); });
  // el CDN no es alcanzable desde aquí: se sirve el doble en su lugar
  await page.route('**/supabase-js*/**', r => r.fulfill({ contentType:'application/javascript', body:'' }));
  // Google Identity Services tampoco es alcanzable: el doble ya está puesto por
  // addInitScript, así que su script se sirve vacío.
  await page.route('**/gsi/client*', r => r.fulfill({ contentType:'application/javascript', body:'' }));
  await page.route('**/js/config.js', r => r.fulfill({ contentType:'application/javascript',
    body:"window.SUPERSTAT_CONFIG={SUPABASE_URL:'https://test.supabase.co',SUPABASE_ANON_KEY:'anon-test',GOOGLE_CLIENT_ID:'cliente-de-prueba.apps.googleusercontent.com'};" }));
  return { ctx, page };
}

const server = p => p.evaluate(() => window.__SERVER__);
const cuenta = (s, t) => Object.values(s.rows[t]).filter(r => !r.deleted_at).length;

async function setOffline(page, off){
  await page.evaluate(o => {
    window.__OFFLINE__ = o;
    Object.defineProperty(navigator, 'onLine', { value: !o, configurable:true });
    window.dispatchEvent(new Event(o ? 'offline' : 'online'));
  }, off);
}

async function crearCuenta(page){
  await page.waitForSelector('#auth-user');
  await page.fill('#auth-user', 'david@correo.com');
  await page.fill('#auth-pass', 'balonmano1');
  await page.click('#auth-toggle');            // pasar a "Crear cuenta"
  await page.fill('#auth-user', 'david@correo.com');
  await page.fill('#auth-pass', 'balonmano1');
  await page.click('#auth-submit');
  await page.waitForSelector('#create-team-btn', { timeout: 10000 });
}

async function altaEquipo(page, nombre, jugadores){
  await page.fill('#new-team-name', nombre);
  await page.click('#create-team-btn');
  await page.waitForSelector('#add-player-btn');
  for(const [n, d, pos] of jugadores){
    await page.fill('#p-name', n);
    await page.fill('#p-dorsal', d);
    await page.selectOption('#p-pos', pos);
    await page.click('#add-player-btn');
  }
}

(async () => {
  const browser = await chromium.launch(LANZAR);

  // ---------------------------------------------------------------- 1. alta
  console.log('\n1. Crear cuenta y dar de alta datos con conexión');
  let { ctx, page } = await nuevaPagina(browser);
  await page.goto(BASE);
  await crearCuenta(page);
  check('entra en la app tras crear la cuenta', await page.$('#create-team-btn') !== null);

  await altaEquipo(page, 'CB Sabadell', [
    ['Marc Pons','1','Portero'], ['Joan Vidal','7','Lateral izquierdo'], ['Aleix Serra','9','Pivote'],
  ]);
  // un dorsal fuera de rango lo rechaza la base: hay que pararlo antes de
  // encolarlo, o la cola se atasca reintentando una fila imposible
  await page.fill('#p-name', 'Dorsal imposible');
  await page.fill('#p-dorsal', '150');
  await page.click('#add-player-btn');
  check('rechaza un dorsal fuera de 0-99 antes de encolarlo',
        (await page.textContent('.error-msg') || '').includes('entre 0 y 99'));

  await page.waitForFunction(() => window.Store.status() === 'synced', null, { timeout: 8000 })
    .catch(() => {});
  let s = await server(page);
  check('el equipo llegó al servidor', cuenta(s,'teams') === 1, 'teams=' + cuenta(s,'teams'));
  check('los 3 jugadores llegaron', cuenta(s,'players') === 3, 'players=' + cuenta(s,'players'));
  check('la cola queda vacía', await page.evaluate(() => Store.pendingCount()) === 0);
  check('no se muestra la banda de aviso', await page.$('#sync-banner') === null);

  // ------------------------------------------------------------- 2. sin red
  console.log('\n2. Partido entero sin conexión');
  await setOffline(page, true);
  const pushesAntes = (await server(page)).pushes;

  await page.click('#new-match-btn');
  await page.fill('#rival-name', 'BM Granollers');
  await page.click('#start-match-btn');
  await page.waitForSelector('.goals-row');
  check('se puede empezar el partido sin red', await page.$('.goals-row') !== null);

  const tocarPista = async (xm, ym) => {
    const px = await page.$eval('.court-svg.interactive', (svg, p) => {
      const VB={x:-0.25,y:-0.25,w:20.5,h:16.35}, D=15, r=svg.getBoundingClientRect();
      return { x:r.left+(p[0]-VB.x)/VB.w*r.width, y:r.top+(D-p[1]-VB.y)/VB.h*r.height };
    }, [xm, ym]);
    await page.mouse.click(px.x, px.y);
  };
  await page.click('.goals-row [data-grid="rival"] [data-zone="3"]');
  await page.waitForSelector('#pending-modal .modal-player-btn');
  await page.click('#pending-modal .modal-player-btn:nth-of-type(2)');
  await page.waitForSelector('#pending-modal .court-svg');
  await tocarPista(6, 9);
  await page.waitForSelector('#pending-modal', { state:'detached' });
  await page.click('.goals-row [data-grid="own"] [data-zone="7"]');
  // El primer tiro a nuestra portería pregunta qué portero tenemos, y se queda
  // puesto para el resto del partido.
  await page.waitForSelector('#pending-modal .modal-player-btn');
  await page.click('#pending-modal .modal-player-btn:nth-of-type(1)');
  await page.waitForSelector('#pending-modal .court-svg');
  await tocarPista(17.5, 3);
  await page.waitForSelector('#pending-modal', { state:'detached' });
  await page.click('#finish-match-btn');
  await page.waitForSelector('.section-label');
  check('el partido se guarda y se ve la ficha sin red',
        (await page.$$eval('.shot-dot', e => e.length)) === 2);

  s = await server(page);
  check('no llegó nada al servidor mientras no había red', s.pushes === pushesAntes,
        'pushes ' + pushesAntes + ' → ' + s.pushes);
  const pendientes = await page.evaluate(() => Store.pendingCount());
  check('la cola acumula lo pendiente', pendientes >= 3, 'cola=' + pendientes);
  await page.click('#to-matches'); await page.click('#to-team'); await page.click('#to-dashboard');
  const banda = (await page.textContent('#sync-banner') || '').replace(/\s+/g,' ').trim();
  check('la banda avisa de que no hay red y de cuánto queda sin subir',
        banda.includes('Sin conexión') && banda.includes('sin subir'), banda);

  // --------------------------------------------------------- 3. vuelve la red
  console.log('\n3. Vuelve la conexión');
  await setOffline(page, false);
  await page.waitForFunction(() => Store.pendingCount() === 0, null, { timeout: 8000 })
    .catch(() => {});
  s = await server(page);
  check('la cola se vacía sola', await page.evaluate(() => Store.pendingCount()) === 0);
  check('el partido llegó al servidor', cuenta(s,'matches') === 1, 'matches=' + cuenta(s,'matches'));
  check('los 2 tiros llegaron', cuenta(s,'shots') === 2, 'shots=' + cuenta(s,'shots'));
  const tiro = Object.values(s.rows.shots).find(r => r.side === 'rival');
  check('el tiro conserva el punto exacto de la pista',
        Number(tiro.origin_x) === 5.98 && Number(tiro.origin_y) === 9.03,
        JSON.stringify([tiro.origin_x, tiro.origin_y]));
  check('el tiro conserva el jugador', Boolean(tiro.player_id));
  check('la banda desaparece al quedar todo al día', await page.$('#sync-banner') === null);

  // ------------------------------------------------- 4. segundo dispositivo
  console.log('\n4. Los datos aparecen en otro dispositivo');
  const estado = await server(page);
  estado.session = null;            // otro dispositivo: se entra desde cero
  await ctx.close();
  const dos = await nuevaPagina(browser, estado);
  await dos.page.goto(BASE);
  await dos.page.waitForSelector('#auth-user');
  await dos.page.fill('#auth-user', 'david@correo.com');
  await dos.page.fill('#auth-pass', 'balonmano1');
  await dos.page.click('#auth-submit');
  await dos.page.waitForSelector('[data-team]', { timeout: 10000 });
  check('el equipo se ve en el otro dispositivo',
        (await dos.page.textContent('[data-team]')).includes('CB Sabadell'));
  await dos.page.click('[data-team]');
  await dos.page.waitForSelector('#view-matches-btn');
  const jugadores = await dos.page.$$eval('.player-name', e => e.map(x => x.textContent));
  check('la plantilla se ve entera', jugadores.length === 3, jugadores.join(', '));
  await dos.page.click('#view-matches-btn');
  await dos.page.waitForSelector('[data-match]');
  await dos.page.click('[data-match]');
  await dos.page.waitForSelector('.court-svg');
  check('el mapa de tiros se reconstruye desde la base',
        (await dos.page.$$eval('.shot-dot', e => e.length)) === 2);

  // ---------------------------------------------------- 5. borrado y vuelta
  console.log('\n5. Un borrado no resucita al sincronizar');
  await dos.page.click('#to-matches'); await dos.page.click('#to-team');
  await dos.page.click('[data-del-player]');
  await dos.page.waitForFunction(() => Store.pendingCount() === 0, null, { timeout:8000 }).catch(()=>{});
  check('queda un jugador menos', (await dos.page.$$('.player-name')).length === 2);
  await dos.page.evaluate(() => Store.sync());
  await dos.page.waitForTimeout(400);
  await dos.page.click('#to-dashboard'); await dos.page.click('[data-team]');
  check('sigue borrado tras volver a sincronizar',
        (await dos.page.$$('.player-name')).length === 2);
  const s5 = await server(dos.page);
  check('en el servidor queda como borrado, no desaparecido',
        Object.values(s5.rows.players).filter(r => r.deleted_at).length === 1);

  // ------------------------------------------- 6. lo local pendiente manda
  console.log('\n6. Con un cambio pendiente, gana lo local');
  await setOffline(dos.page, true);
  await dos.page.fill('#p-name', 'Pau Roca');
  await dos.page.fill('#p-dorsal', '4');
  await dos.page.click('#add-player-btn');
  // mientras tanto, el servidor cambia el nombre del equipo por otra vía
  await dos.page.evaluate(() => {
    const t = Object.values(window.__SERVER__.rows.teams)[0];
    t.name = 'Nombre puesto desde otro sitio';
    t.updated_at = new Date(Date.now() + 60000).toISOString();
    window.__SERVER__.clock++;
    t.server_at = new Date(Date.UTC(2026,0,1) + window.__SERVER__.clock*1000).toISOString();
  });
  await setOffline(dos.page, false);
  await dos.page.waitForFunction(() => Store.pendingCount() === 0, null, { timeout:8000 }).catch(()=>{});
  await dos.page.click('#to-dashboard');
  check('el jugador creado sin red sobrevive',
        (await dos.page.textContent('[data-team]')).includes('3 jugadores'));
  check('el cambio del servidor sí se aplica (no había edición local pendiente)',
        (await dos.page.textContent('[data-team]')).includes('Nombre puesto desde otro sitio'));

  await dos.ctx.close();

  // --------------------------------------------------------- 7. migración
  console.log('\n7. Importar datos de la versión anterior');
  const tres = await nuevaPagina(browser, Object.assign({}, estado, { session:null }));
  await tres.page.goto(BASE);
  await tres.page.evaluate(() => {
    localStorage.setItem('hb:users', JSON.stringify({ david: 'clave-en-claro' }));
    localStorage.setItem('hb:teams:david', JSON.stringify([
      { id:'t1', name:'Equipo viejo', players:[{ id:'p1', name:'Nil', dorsal:3, position:'Central' }] }
    ]));
    localStorage.setItem('hb:matches:david:t1', JSON.stringify([
      { id:'m1', rival:'BM Antiguo', date:'2025-05-05', outOwn:1, outRival:0,
        shotsOwn:[], shotsRival:[{ zone:3, type:'goal', player:'p1', origin:{x:6,y:9} }] }
    ]));
  });
  await tres.page.reload();
  await tres.page.waitForSelector('#auth-user');
  await tres.page.fill('#auth-user', 'otro@correo.com');
  await tres.page.fill('#auth-pass', 'balonmano1');
  await tres.page.click('#auth-toggle');
  await tres.page.fill('#auth-user', 'otro@correo.com');
  await tres.page.fill('#auth-pass', 'balonmano1');
  await tres.page.click('#auth-submit');
  await tres.page.waitForSelector('#migrate-yes', { timeout:10000 });
  check('ofrece importar lo que había en el navegador', true);
  await tres.page.click('#migrate-yes');
  await tres.page.waitForSelector('[data-team]');
  check('el equipo viejo aparece importado',
        (await tres.page.textContent('[data-team]')).includes('Equipo viejo'));
  check('las contraseñas en claro se borran del navegador',
        await tres.page.evaluate(() => localStorage.getItem('hb:users')) === null);
  await tres.page.click('[data-team]');
  await tres.page.click('#view-matches-btn');
  await tres.page.waitForSelector('[data-match]');
  await tres.page.click('[data-match]');
  await tres.page.waitForSelector('.stat-list-row');
  const filas = await tres.page.$$eval('.stat-list-row', e => e.map(x => x.textContent.replace(/\s+/g,' ').trim()));
  check('el partido importado conserva jugador y zona',
        filas.some(f => f.includes('Nil')) && filas.some(f => f.includes('Lateral izquierdo')),
        filas.join(' | '));
  await tres.page.reload();
  await tres.page.waitForSelector('[data-team]', { timeout:10000 });
  check('no vuelve a preguntar por la migración', await tres.page.$('#migrate-yes') === null);
  await tres.ctx.close();

  // ------------------------------------------- 8. Google, salir, sin config
  console.log('\n8. Entrar con Google, salir y app sin configurar');
  const g = await nuevaPagina(browser, { rows:{teams:{},players:{},matches:{},shots:{}},
                                          clock:0, users:{}, session:null, pushes:0 });
  await g.page.goto(BASE);
  await g.page.waitForSelector('#google-btn');
  check('el botón lo dibuja Google con nuestro ID de cliente',
        await g.page.evaluate(() => window.__GOOGLE__.clientId) === 'cliente-de-prueba.apps.googleusercontent.com');
  await g.page.click('#google-btn');
  await g.page.waitForSelector('#create-team-btn', { timeout:10000 });
  // Si entra es que el nonce resumido fue a Google y el original a Supabase: el
  // doble rechaza el login si los dos reciben el mismo.
  check('entra con Google', await g.page.$('#create-team-btn') !== null);
  await g.page.fill('#new-team-name', 'Equipo Google');
  await g.page.click('#create-team-btn');
  await g.page.waitForSelector('#to-dashboard');
  await g.page.click('#to-dashboard');
  // El nombre de la cuenta y el botón de salir viven en la pantalla de cuenta:
  // en la cabecera manda el logo.
  await g.page.click('#tab-account');
  await g.page.waitForSelector('#logout-btn');
  check('la pantalla de cuenta muestra el nombre de la cuenta de Google',
        (await g.page.textContent('.account-name')).includes('David'));
  await g.page.click('#logout-btn');
  await g.page.waitForSelector('#google-btn', { timeout:10000 });
  check('al salir vuelve a la pantalla de entrada', await g.page.$('#google-btn') !== null);
  check('no quedan datos de la sesión anterior en pantalla',
        await g.page.$('[data-team]') === null);
  await g.page.screenshot({ path: DIR + '/10-login.png', animations:'disabled' });
  await g.ctx.close();

  // sin config.js relleno la app no deja hacer nada, pero lo dice claro.
  // Se sirve un config.js vacío en vez de confiar en que el del repositorio lo
  // esté: ahí viven las credenciales reales del proyecto.
  const sc = await browser.newContext();
  const scp = await sc.newPage();
  await scp.route('**/supabase-js*/**', r => r.fulfill({ contentType:'application/javascript', body:'' }));
  await scp.route('**/gsi/client*', r => r.fulfill({ contentType:'application/javascript', body:'' }));
  await scp.route('**/js/config.js', r => r.fulfill({ contentType:'application/javascript',
    body:"window.SUPERSTAT_CONFIG={SUPABASE_URL:'',SUPABASE_ANON_KEY:''};" }));
  await scp.goto(BASE);
  await scp.waitForSelector('.error-msg', { timeout:10000 });
  check('avisa de que falta configurar Supabase',
        (await scp.textContent('.error-msg')).includes('config.js'));
  await sc.close();

  console.log(`\n${pasadas} comprobaciones pasadas, ${fallos} fallidas`);
  await browser.close();
  process.exit(fallos ? 1 : 0);
})();
