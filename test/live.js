// Pruebas de lo que pasa durante un partido: el reloj, el corte de la primera
// parte, el portero en pista, los eventos, la alineación y que un partido a
// medias sobreviva a que se cierre la pestaña.
//
// Se ejecutan igual que las de sincronización:
//   python3 -m http.server 5173 &
//   node test/live.js
const { chromium, LANZAR, CONTEXTO, BASE_URL, servidorListo } = require('./requiere-playwright.js');
const fs = require('fs');
const STUB = fs.readFileSync(__dirname + '/supabase-stub.js', 'utf8');
const GSTUB = fs.readFileSync(__dirname + '/google-stub.js', 'utf8');
const { rutasDePrueba, rutaConfig, CONFIG_DE_PRUEBA } = require('./rutas.js');
const BASE = BASE_URL + '/index.html';

let fallos = 0, pasadas = 0;
function check(nombre, ok, detalle){
  if(ok){ pasadas++; console.log('  ok   ' + nombre); }
  else { fallos++; console.log('  FALLA ' + nombre + (detalle ? '  → ' + detalle : '')); }
}

async function nuevaPagina(browser){
  // El service worker se bloquea en las pruebas: si sirviera el shell desde su
  // caché, se saltaría los page.route() con los que se sustituyen el CDN y la
  // configuración, y las pruebas dejarían de probar lo que creen.
  const ctx = await browser.newContext(Object.assign({}, CONTEXTO, { viewport:{ width:390, height:844 }, serviceWorkers:'block', acceptDownloads:true }));
  await ctx.addInitScript({ content: STUB + '\n' + GSTUB });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fallos++; console.log('  FALLA error en página: ' + e.message); });
  await rutasDePrueba(page);
  return { ctx, page };
}

async function crearCuenta(page){
  await page.waitForSelector('#auth-user');
  await page.fill('#auth-user', 'david@correo.com');
  await page.fill('#auth-pass', 'balonmano1');
  await page.click('#auth-toggle');
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

// Toca un punto de la media pista dibujada, en metros.
async function tocarPista(page, xm, ym){
  const px = await page.$eval('.court-svg.interactive', (svg, p) => {
    const VB = { x:-0.25, y:-0.25, w:20.5, h:16.35 }, D = 15;
    const r = svg.getBoundingClientRect();
    return { x: r.left + (p[0]-VB.x)/VB.w*r.width, y: r.top + (D-p[1]-VB.y)/VB.h*r.height };
  }, [xm, ym]);
  await page.mouse.click(px.x, px.y);
}

// Un tiro nuestro a la zona `z`: gol de un toque, con su jugador y su punto.
async function golNuestro(page, z, jugador){
  await page.click(`.goals-row [data-grid="rival"] [data-zone="${z}"]`);
  await page.waitForSelector('#pending-modal .modal-player-btn');
  await page.click(`#pending-modal .modal-player-btn:nth-of-type(${jugador})`);
  await page.waitForSelector('#pending-modal .court-svg');
  await tocarPista(page, 6, 9);
  await page.waitForSelector('#pending-modal', { state:'detached' });
}

const draft = page => page.evaluate(() => JSON.parse(localStorage.getItem('hb:draft:' + Object.keys(localStorage)
  .filter(k => k.indexOf('hb:draft:') === 0).map(k => k.slice('hb:draft:'.length))[0])));

(async () => {
  await servidorListo();
  const browser = await chromium.launch(LANZAR);
  let { ctx, page } = await nuevaPagina(browser);
  await page.goto(BASE);
  await crearCuenta(page);
  await altaEquipo(page, 'CB Sabadell', [
    ['Marc Pons','1','Portero'],
    ['Nil Roca','12','Portero'],
    ['Joan Vidal','7','Lateral izquierdo'],
    ['Aleix Serra','9','Pivote'],
  ]);

  // ------------------------------------------------------------ 1. el reloj
  console.log('\n1. Reloj y final de la primera parte');
  await page.click('#new-match-btn');
  await page.fill('#rival-name', 'BM Granollers');
  await page.click('#start-match-btn');
  await page.waitForSelector('.goals-row');

  check('el reloj empieza parado en 00:00', (await page.textContent('#clock-time')).trim() === '00:00');
  check('empieza en la primera parte', (await page.textContent('.clock-period')).includes('1ª parte'));

  await page.click('#toggle-clock');
  await page.waitForTimeout(1200);
  const corriendo = (await page.textContent('#clock-time')).trim();
  check('el reloj corre al ponerlo en marcha', corriendo !== '00:00', corriendo);

  await page.click('#end-half-btn');
  await page.waitForSelector('.clock-half.done');
  check('pasa a la segunda parte al cortar', (await page.textContent('.clock-period')).includes('2ª parte'));
  check('el reloj se para en el descanso', await page.$('.clock-play.on') === null);
  let d = await draft(page);
  check('guarda el minuto del descanso', d.halfTime !== null && d.halfTime !== undefined, 'halfTime=' + d.halfTime);
  check('lo anotado a partir de ahí va a la segunda parte', d.period === 2);

  // ------------------------------------------------- 2. el portero en pista
  console.log('\n2. Portero en pista');
  // Primer tiro a nuestra portería: al no haber portero fijado, lo pregunta.
  await page.click('.goals-row [data-grid="own"] [data-zone="5"]');
  await page.waitForSelector('#pending-modal .modal-player-btn');
  check('pregunta el portero en el primer tiro a nuestra portería',
        (await page.textContent('#pending-modal .modal-title')).includes('portería'));
  await page.click('#pending-modal .modal-player-btn:nth-of-type(1)');   // Marc Pons
  await page.waitForSelector('#pending-modal .court-svg');
  await tocarPista(page, 10, 8);
  await page.waitForSelector('#pending-modal', { state:'detached' });

  d = await draft(page);
  check('el gol encajado se atribuye al portero', d.shotsOwn[0].keeper === d.keeper && !!d.keeper);
  check('el portero se queda fijado', await page.$('.court-chip.on[data-keeper]') !== null);

  // El segundo ya no pregunta: usa el portero que está en pista.
  await page.click('.goals-row [data-grid="own"] [data-zone="1"]');
  await page.click('.goals-row [data-grid="own"] [data-zone="1"]');   // doble toque = parada
  await page.waitForSelector('#pending-modal .court-svg');
  await tocarPista(page, 4, 7);
  await page.waitForSelector('#pending-modal', { state:'detached' });
  d = await draft(page);
  check('no vuelve a preguntar el portero', d.shotsOwn.length === 2);
  check('la parada lleva el mismo portero', d.shotsOwn[1].keeper === d.keeper);
  check('el tiro lleva minuto y parte', d.shotsOwn[1].period === 2 && d.shotsOwn[1].minute !== null);

  // ----------------------------------------------------- 3. fuera y palo
  console.log('\n3. Fuera y palo');
  await page.click('.goals-row [data-post="rival"]');
  await page.waitForSelector('#pending-modal .modal-player-btn');
  await page.click('#pending-modal .modal-player-btn:nth-of-type(3)');  // Joan Vidal
  await page.waitForSelector('#pending-modal .court-svg');
  await tocarPista(page, 15, 6);
  await page.waitForSelector('#pending-modal', { state:'detached' });
  d = await draft(page);
  check('el palo se guarda como tiro sin zona de portería',
        d.missRival.length === 1 && d.missRival[0].type === 'post' && d.missRival[0].zone === null);
  check('el palo se atribuye a quien lo tiró', !!d.missRival[0].player);

  // ------------------------------------------------ 4. eventos y alineación
  console.log('\n4. Eventos y alineación');
  await page.click('[data-event="steal"]');
  await page.waitForSelector('#event-modal .modal-player-btn');
  await page.click('#event-modal .modal-player-btn:nth-of-type(4)');    // Aleix Serra
  await page.waitForSelector('#event-modal', { state:'detached' });
  d = await draft(page);
  const robos = d.events.filter(e => e.type === 'steal');
  check('el robo se registra con jugador y minuto',
        robos.length === 1 && !!robos[0].player && robos[0].minute !== null);

  await page.click('.chip-row [data-court-player]:nth-of-type(1)');
  d = await draft(page);
  check('entrar a pista se anota como evento', d.events.some(e => e.type === 'in'));
  check('la pista lleva la cuenta', d.onCourt.length === 1);

  await page.click('#undo-event-btn');
  d = await draft(page);
  check('deshacer quita el último evento pero no las altas de pista',
        d.events.filter(e => e.type === 'steal').length === 0 && d.events.some(e => e.type === 'in'));

  // ------------------------------------- 5. el partido sobrevive a la recarga
  console.log('\n5. El partido a medias sobrevive a cerrar la pestaña');
  const antes = await draft(page);
  await page.reload();
  await page.waitForSelector('#resume-match', { timeout: 10000 });
  check('al volver ofrece seguir con el partido', await page.$('#resume-match') !== null);
  await page.click('#resume-match');
  await page.waitForSelector('.goals-row');
  const ahora = await draft(page);
  check('no se ha perdido nada de lo anotado',
        ahora.shotsOwn.length === antes.shotsOwn.length &&
        ahora.missRival.length === antes.missRival.length &&
        ahora.events.length === antes.events.length);
  check('sigue en la segunda parte', ahora.period === 2);

  // ------------------------------------------------ 6. guardar y releer todo
  console.log('\n6. Se guarda y se vuelve a leer entero');
  await golNuestro(page, 3, 3);
  await page.click('#finish-match-btn');
  await page.waitForSelector('.section-label');

  const guardado = await page.evaluate(() => {
    const m = Store.matches(Store.teams()[0].id)[0];
    return {
      halfTime: m.halfTime,
      shotsOwn: m.shotsOwn.length,
      keepers: m.shotsOwn.filter(s => s.keeper).length,
      miss: m.missRival.length,
      outRival: m.outRival,
      eventos: m.events.length,
      minutos: m.shotsOwn.every(s => s.minute !== null),
      periodos: m.shotsOwn.map(s => s.period)
    };
  });
  check('el partido guardado conserva el minuto del descanso', guardado.halfTime !== null);
  check('conserva los tiros a nuestra portería', guardado.shotsOwn === 2, 'n=' + guardado.shotsOwn);
  check('todos llevan portero', guardado.keepers === 2, 'n=' + guardado.keepers);
  check('el palo cuenta como tiro fallado', guardado.miss === 1 && guardado.outRival === 1);
  check('conserva los eventos', guardado.eventos >= 1, 'n=' + guardado.eventos);
  check('conserva minutos y partes', guardado.minutos && guardado.periodos.every(p => p === 2));

  check('el borrador se borra al guardar',
        await page.evaluate(() => Object.keys(localStorage).filter(k => k.indexOf('hb:draft:') === 0)
          .every(k => !localStorage.getItem(k))));

  // --------------------------------------------- 7. la ficha del partido
  console.log('\n7. Lo que sale en la ficha del partido');
  const ficha = () => page.evaluate(() => document.querySelector('main').textContent.replace(/\s+/g,' '));
  let texto = await ficha();
  check('el portero sale con sus paradas sobre los tiros recibidos',
        /Marc Pons\s*1\/2 · 50%/.test(texto.replace(/\s+/g,' ')), texto.match(/Porteros.{0,80}/));
  check('el más/menos cuenta solo los goles con el jugador en pista',
        /Joan Vidal\s*\+1/.test(texto), texto.match(/Más\/menos.{0,120}/));
  check('los filtros del mapa están', await page.$('#toggle-heat') !== null);

  await page.click('#toggle-heat');
  check('el mapa de calor se dibuja', await page.$('.court-svg g[filter]') !== null);
  await page.click('#toggle-heat');
  check('vuelven los puntos', await page.$('.shot-dot') !== null);

  await page.click('[data-period="1"]');
  check('el filtro por parte deja el mapa sin tiros de la primera parte',
        (await ficha()).includes('Ningún lanzamiento con punto registrado con este filtro'));
  await page.click('[data-period="all"]');

  check('el cruce pista × portería tiene celdas', (await page.$$('.cross-cell')).length >= 9);

  // ----------------------------------------------------- 8. CSV y temporada
  console.log('\n8. Exportar y acumulado de temporada');
  const [descarga] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#csv-match')
  ]);
  const csv = fs.readFileSync(await descarga.path(), 'utf8');
  check('el CSV se descarga con nombre de partido', /granollers/.test(descarga.suggestedFilename()),
        descarga.suggestedFilename());
  check('el CSV lleva cabecera y una fila por anotación',
        csv.split('\n')[0].startsWith('﻿' + 'tipo;parte;minuto') && csv.split('\n').length > 3,
        csv.split('\n')[0]);
  check('el CSV incluye los eventos', csv.includes('evento;'));

  await page.click('#to-matches');
  await page.waitForSelector('#to-season');
  await page.click('#to-season');
  await page.waitForSelector('.score-hero-num');
  const temporada = await ficha();
  check('la temporada cuenta el partido', temporada.includes('1 partido'));
  check('la temporada suma goleadores', /GOLEADORES/i.test(temporada));

  // --------------------------------------------- 9. corregir un jugador
  // privacidad.html promete, en el derecho de rectificación, que lo que la app
  // guarda se edita desde la app. Lo que hay que comprobar no es que el nombre
  // cambie, sino que cambiar no cuesta el historial: el jugador conserva su id,
  // y con él todos los tiros y eventos que ya llevaban su nombre dentro.
  console.log('\n9. Corregir un jugador sin perder su historial');
  await page.click('#to-team');
  await page.waitForSelector('[data-edit-player]');
  const idJugador = await page.evaluate(() => {
    const fila = [...document.querySelectorAll('.player-row')]
      .find(r => r.textContent.includes('Joan Vidal'));
    return fila.querySelector('[data-edit-player]').getAttribute('data-edit-player');
  });
  await page.click(`[data-edit-player="${idJugador}"]`);
  await page.waitForSelector('#save-player-btn');
  check('el formulario llega relleno con el jugador',
        await page.inputValue('#p-name') === 'Joan Vidal' &&
        await page.inputValue('#p-dorsal') === '7' &&
        await page.inputValue('#p-pos') === 'Lateral izquierdo');
  await page.fill('#p-name', 'Joan Vidal Ros');
  await page.fill('#p-dorsal', '8');
  await page.selectOption('#p-pos', 'Central');
  await page.click('#save-player-btn');
  await page.waitForSelector('#add-player-btn');
  check('el jugador corregido se ve ya en la plantilla',
        (await ficha()).includes('Joan Vidal Ros'));
  check('sigue siendo el mismo jugador, no uno nuevo',
        await page.evaluate(() => Object.values(window.__SERVER__.rows.players)
          .filter(p => !p.deleted_at).length) === 4 &&
        await page.evaluate(id => {
          const p = window.__SERVER__.rows.players[id];
          return !!p && !p.deleted_at && p.name === 'Joan Vidal Ros' && Number(p.dorsal) === 8;
        }, idJugador));

  await page.click('#view-matches-btn');
  await page.waitForSelector('[data-match]');
  await page.click('[data-match]');
  await page.waitForSelector('.score-hero-num');
  const tras = await ficha();
  check('sus goles de antes siguen siendo suyos, con el nombre nuevo',
        /Joan Vidal Ros/.test(tras) && !/Joan Vidal[^ R]/.test(tras.replace(/Joan Vidal Ros/g, '')),
        tras.match(/Goleadores.{0,80}/));
  check('el más/menos también lo sigue contando',
        /Joan Vidal Ros\s*\+1/.test(tras), tras.match(/Más\/menos.{0,120}/));

  // Un dorsal fuera de rango se rechaza igual que en el alta.
  await page.click('#to-matches');
  await page.click('#to-team');
  await page.waitForSelector('[data-edit-player]');
  await page.click(`[data-edit-player="${idJugador}"]`);
  await page.waitForSelector('#save-player-btn');
  await page.fill('#p-dorsal', '140');
  await page.click('#save-player-btn');
  await page.waitForSelector('.error-msg');
  check('un dorsal imposible no se guarda',
        (await page.textContent('.error-msg')).includes('entre 0 y 99'));
  await page.click('#cancel-player-btn');
  await page.waitForSelector('#add-player-btn');
  check('cancelar deja al jugador como estaba',
        await page.evaluate(id => Number(window.__SERVER__.rows.players[id].dorsal), idJugador) === 8);

  // ----------------------------------------------- 10. editar y borrar
  console.log('\n10. Editar y borrar un partido guardado');
  // Se sigue en la pantalla del equipo, donde terminó el bloque anterior.
  await page.click('#view-matches-btn');
  await page.waitForSelector('[data-match]');
  await page.click('[data-match]');
  await page.waitForSelector('#edit-match');
  await page.click('#edit-match');
  await page.waitForSelector('#edit-rival');
  await page.fill('#edit-rival', 'BM Granollers B');
  await page.click('#save-match-edit');
  await page.waitForTimeout(200);
  check('el rival editado se guarda', (await ficha()).includes('BM Granollers B'));

  // El minuto del descanso se fija con un botón en mitad del partido y es fácil
  // pulsarlo tarde; hasta ahora era lo único del partido que no se podía tocar.
  await page.click('#edit-match');
  await page.waitForSelector('#edit-halftime');
  await page.fill('#edit-halftime', '31');
  await page.click('#save-match-edit');
  await page.waitForTimeout(200);
  check('el minuto del descanso se puede corregir',
        (await ficha()).includes('descanso en el 31'), await ficha());
  await page.click('#edit-match');
  await page.waitForSelector('#edit-halftime');
  await page.fill('#edit-halftime', '');
  await page.click('#save-match-edit');
  await page.waitForTimeout(200);
  check('dejarlo vacío es un partido sin descanso marcado, no el minuto 0',
        !(await ficha()).includes('descanso en el') &&
        await page.evaluate(() => Object.values(window.__SERVER__.rows.matches)[0].half_time_minute) === null);
  await page.click('#edit-match');
  await page.waitForSelector('#edit-halftime');
  await page.fill('#edit-halftime', '30');
  await page.click('#save-match-edit');
  await page.waitForTimeout(200);

  // Corregir sin rehacer el partido: el partido tiene cinco anotaciones (gol
  // encajado, parada, palo, un alta de pista y un gol nuestro) y se quita la
  // que sobra de una en una.
  await page.click('#edit-match');
  await page.waitForSelector('[data-del-shot]');
  check('la ficha lista todo lo anotado',
        (await page.$$('[data-del-shot], [data-del-event]')).length === 5,
        'n=' + (await page.$$('[data-del-shot], [data-del-event]')).length);
  check('las anotaciones salen en el orden en que se registraron',
        await page.evaluate(() => {
          const filas = [...document.querySelectorAll('.stat-list-row')]
            .filter(r => r.querySelector('[data-del-shot],[data-del-event]'));
          return filas[0].textContent.includes('Gol encajado')
              && filas[filas.length-1].textContent.includes('Gol de');
        }));

  const idTiro = await page.evaluate(() => {
    const fila = [...document.querySelectorAll('.stat-list-row')]
      .find(r => r.querySelector('[data-del-shot]') && r.textContent.includes('Gol de'));
    return fila && fila.querySelector('[data-del-shot]').getAttribute('data-del-shot');
  });
  await page.click(`[data-del-shot="${idTiro}"]`);
  await page.waitForTimeout(200);
  check('la anotaci\u00f3n borrada desaparece de la lista',
        await page.$(`[data-del-shot="${idTiro}"]`) === null);
  check('el marcador se recalcula sin el tiro borrado',
        (await page.textContent('.score-hero-num')).replace(/\s/g,'') === '0\u20131',
        await page.textContent('.score-hero-num'));
  check('el tiro queda en el servidor marcado como borrado, no desaparecido',
        await page.evaluate(id => {
          const r = window.__SERVER__.rows.shots[id];
          return !!r && !!r.deleted_at;
        }, idTiro));

  const idEvento = await page.evaluate(() => {
    const b = document.querySelector('[data-del-event]');
    return b && b.getAttribute('data-del-event');
  });
  await page.click(`[data-del-event="${idEvento}"]`);
  await page.waitForTimeout(200);
  check('los eventos tambi\u00e9n se pueden quitar de uno en uno',
        await page.$(`[data-del-event="${idEvento}"]`) === null &&
        await page.evaluate(id => !!window.__SERVER__.rows.events[id].deleted_at, idEvento));
  await page.click('#edit-match');          // cerrar la ficha de correcci\u00f3n

  await page.click('#edit-match');
  await page.waitForSelector('#delete-match');
  page.once('dialog', d => d.accept());   // el confirm de "¿borrar?"
  await page.click('#delete-match');
  await page.waitForTimeout(300);
  check('el partido borrado desaparece de la lista',
        (await ficha()).includes('Todavía no hay partidos guardados'));
  check('en el servidor queda marcado como borrado, no desaparecido',
        await page.evaluate(() => {
          const rows = Object.values(window.__SERVER__.rows.matches);
          return rows.length === 1 && !!rows[0].deleted_at;
        }));

  // ------------------------------------------------ 11. borrar un equipo
  // La pol\u00edtica de privacidad promete que con el equipo se va su plantilla y
  // todo lo anotado en sus partidos. Aqu\u00ed se comprueba que de verdad se va, y
  // que se va marcado y no desaparecido: un borrado f\u00edsico reaparecer\u00eda en el
  // siguiente dispositivo que sincronice.
  console.log('\n11. Borrar un equipo entero');
  await page.click('#to-team');
  await page.waitForSelector('#delete-team');
  page.once('dialog', d => d.accept());
  await page.click('#delete-team');
  await page.waitForSelector('#create-team-btn');
  check('el equipo borrado desaparece del panel',
        (await ficha()).includes('A\u00fan no tienes ning\u00fan equipo'));

  const cascada = await page.waitForFunction(() => {
    const r = window.__SERVER__.rows;
    return ['teams','players','matches','shots','events']
      .every(t => Object.values(r[t]).every(x => !!x.deleted_at));
  }, null, { timeout: 8000 }).then(() => true).catch(() => false);
  check('con el equipo se van su plantilla, sus partidos y lo anotado', cascada,
        await page.evaluate(() => {
          const r = window.__SERVER__.rows;
          return ['teams','players','matches','shots','events']
            .map(t => t + '=' + Object.values(r[t]).filter(x => !x.deleted_at).length).join(' ');
        }));
  check('nada se borra de la base: queda marcado',
        await page.evaluate(() => {
          const r = window.__SERVER__.rows;
          return Object.values(r.teams).length === 1
              && Object.values(r.players).length === 4
              && Object.values(r.shots).length === 4;
        }));

  await ctx.close();

  // ------------------------------------------ 12. la app abre sin cobertura
  // Aquí sí se deja trabajar al service worker: es justo lo que se prueba. Sin
  // dobles ni rutas interceptadas, porque lo que se comprueba es que el HTML,
  // el CSS y los scripts salen de la caché y no de la red.
  console.log('\n12. La app abre sin cobertura (service worker)');
  const swCtx = await browser.newContext(Object.assign({}, CONTEXTO, { viewport:{ width:390, height:844 } }));
  // La única ruta que sí se intercepta aquí, y va en el contexto y no en la
  // página: el service worker se guarda el shell con sus propias peticiones, y
  // esas no pasan por page.route(). Sin esto la prueba cargaría el config.js
  // del repositorio, donde están las credenciales del proyecto de verdad.
  await rutaConfig(swCtx);
  const swPage = await swCtx.newPage();
  // Nada de lo que hace falta para arrancar puede venir de fuera: con un CDN de
  // por medio, ni la app de móvil ni la web abren la primera vez sin cobertura.
  const fuera = [];
  swPage.on('request', r => {
    const h = new URL(r.url()).host;
    if(h !== 'localhost:5173' && !h.startsWith('localhost')) fuera.push(h);
  });
  await swPage.goto(BASE);
  await swPage.waitForTimeout(500);
  check('no se pide ningún script a un CDN para arrancar',
        fuera.filter(h => h.includes('jsdelivr') || h.includes('unpkg')).length === 0,
        fuera.join(' '));
  check('en el navegador el puente nativo se aparta',
        await swPage.evaluate(() => Boolean(window.Native) && Native.isNative() === false
                                    && Native.platform() === 'web'));
  const activo = await swPage.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return Boolean(reg.active);
  }).catch(() => false);
  check('el service worker queda activo', activo);
  check('la prueba no carga el config.js del repositorio',
        await swPage.evaluate(() => window.SUPERSTAT_CONFIG.SUPABASE_URL) === 'https://test.supabase.co');

  const guardados = await swPage.evaluate(async () => {
    const names = await caches.keys();
    if(!names.length) return [];
    const c = await caches.open(names[0]);
    return (await c.keys()).map(r => new URL(r.url).pathname);
  });
  check('guarda el HTML y los scripts propios',
        ['/index.html','/css/styles.css','/js/app.js','/js/store.js','/js/db.js']
          .every(p => guardados.indexOf(p) !== -1),
        guardados.join(' '));

  await swCtx.setOffline(true);
  await swPage.reload();
  const abreSinRed = await swPage.waitForSelector('#auth-user', { timeout: 10000 })
    .then(() => true).catch(() => false);
  check('sin red, la app se abre igual desde la caché', abreSinRed);
  // Lo que sirve la caché es lo que el service worker guardó al instalarse: si
  // ahí hubiera entrado el config del repositorio, saldría ahora.
  check('lo guardado en la caché tampoco lleva las credenciales de verdad',
        await swPage.evaluate(() => window.SUPERSTAT_CONFIG.SUPABASE_URL) === 'https://test.supabase.co');
  await swCtx.setOffline(false);
  await swCtx.close();

  await browser.close();
  console.log(`\n${pasadas} bien, ${fallos} mal`);
  process.exit(fallos ? 1 : 0);
})();
