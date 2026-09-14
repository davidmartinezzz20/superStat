// Genera las capturas de pantalla de la ficha de Google Play y de Instagram.
//
//   node tools/make-screenshots.js                 → play/capturas/    (español)
//   IDIOMA=en node tools/make-screenshots.js       → play/capturas-en/ (inglés)
//   CHROMIUM_PATH=/ruta/al/chromium node tools/make-screenshots.js
//
// Deja ocho PNG de 1080×1920 en play/capturas/, que es el tamaño que recomienda
// Play para teléfono y el que acepta sin recortar (relación 9:16). Se rinde a
// 360×640 con densidad 3, que es un móvil Android de los normales: la app se ve
// exactamente como se ve en un aparato, no como una web encogida.
//
// La app que se fotografía es la de verdad, servida desde este mismo repo. Lo
// único falso es lo de detrás: se le enchufan los dobles de test/, así que las
// capturas se generan sin Supabase, sin cuenta y sin red, y no hay forma de que
// una captura acabe enseñando datos de nadie. El partido que sale es inventado
// aquí abajo.
//
// El azar tiene semilla fija a propósito: volver a ejecutarlo tiene que dar las
// mismas imágenes, o cada ejecución llena el repo de PNG distintos que no
// cambian nada. Si se toca el guion, cambian todas y hay que mirarlas.
//
// Requiere Playwright instalado aparte, como las pruebas (ver test/README.md).
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');

// La app es bilingüe, así que las capturas también: las castellanas son las que
// sube Play y las inglesas, las de la cuenta de Instagram en inglés
// (docs/instagram.md). Es el mismo partido inventado con la misma semilla; lo
// único que cambia es el idioma con el que se abre la página.
//
// La variable se llama IDIOMA y no LANG a propósito: LANG ya significa otra
// cosa en cualquier terminal de Unix y pisarla sería pedir un disgusto.
const IDIOMA = process.env.IDIOMA || 'es';
if(IDIOMA !== 'es' && IDIOMA !== 'en'){
  console.error('IDIOMA tiene que ser es o en, no "' + IDIOMA + '"');
  process.exit(1);
}
const DEST = path.join(RAIZ, 'play', IDIOMA === 'es' ? 'capturas' : 'capturas-en');
const STUB  = fs.readFileSync(path.join(RAIZ, 'test', 'supabase-stub.js'), 'utf8');
const GSTUB = fs.readFileSync(path.join(RAIZ, 'test', 'google-stub.js'), 'utf8');
const { rutasDePrueba } = require(path.join(RAIZ, 'test', 'rutas.js'));
const LANZAR = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};

const ANCHO = 360, ALTO = 640, ESCALA = 3;   // → 1080×1920

// El reloj de la app cuenta tiempo real, y anotar ochenta jugadas a golpe de
// clic lleva medio minuto: sin tocar nada, las capturas saldrían con el
// descanso en el minuto 1. Se le acelera el reloj multiplicando lo que avanza
// Date.now(), que es de donde saca el minuto (ver clockMs en js/app.js). Solo
// afecta al reloj: las fechas de los partidos se ponen a mano más abajo.
const VELOCIDAD = 95;
const RELOJ_RAPIDO = `(() => {
  const real = Date.now.bind(Date);
  const t0 = real();
  Date.now = () => t0 + Math.round((real() - t0) * ${VELOCIDAD});
})();`;

// Nuestro portero: el primero de la plantilla, y el que la app pregunta una
// sola vez en el primer tiro que recibimos.
const PORTERO = '1';

// ------------------------------------------------------------------ servidor

// La app no se puede abrir con file:// (lo dice el README), así que el propio
// script se sirve el repo. Es un servidor de estáticos de veinte líneas: no
// hace falta más y evita el "¿has arrancado el servidor?" de las pruebas.
const TIPOS = {
  '.html':'text/html; charset=utf-8',
  '.js':'application/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8',
  '.json':'application/json; charset=utf-8',
  '.webmanifest':'application/manifest+json',
  '.png':'image/png', '.svg':'image/svg+xml'
};

function servir(){
  return new Promise(ok => {
    const s = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
      const abs = path.join(RAIZ, rel);
      if(!abs.startsWith(RAIZ) || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()){
        res.writeHead(404); res.end('no'); return;
      }
      res.writeHead(200, { 'content-type': TIPOS[path.extname(abs)] || 'application/octet-stream' });
      fs.createReadStream(abs).pipe(res);
    });
    s.listen(0, '127.0.0.1', () => ok(s));
  });
}

// --------------------------------------------------------------- el partido

const PLANTILLA = [
  // Ordenada por dorsal, que es como la app ordena los botones del modal.
  ['Marc Pons',     '1',  'Portero'],
  ['Pau Ferrer',    '4',  'Central'],
  ['Iker Lago',     '5',  'Extremo izquierdo'],
  ['Joan Vidal',    '7',  'Lateral izquierdo'],
  ['Aleix Serra',   '9',  'Pivote'],
  ['Guillem Sala',  '10', 'Lateral derecho'],
  ['Nil Roca',      '12', 'Portero'],
  ['Adrià Vila',    '14', 'Extremo derecho'],
  ['Èric Costa',    '17', 'Extremo izquierdo'],
  ['Bruno Mena',    '22', 'Pivote']
];

// Desde dónde lanza cada puesto, en metros: x de banda a banda (0-20) e y como
// distancia a la línea de gol. Son las mismas coordenadas que guarda la app.
const PUNTO = {
  'Extremo izquierdo': [2.4, 6.4],
  'Extremo derecho':   [17.6, 6.4],
  'Lateral izquierdo': [6.4, 10.2],
  'Lateral derecho':   [13.6, 10.2],
  'Central':           [10.0, 10.8],
  'Pivote':            [10.0, 6.2]
};

// Un generador de números pseudoaleatorios cualquiera, pero con semilla: lo
// que importa es que la misma semilla dé siempre el mismo partido.
function azar(semilla){
  let s = semilla >>> 0;
  return () => {
    s = (s * 1103515245 + 12345) >>> 0;
    return s / 4294967296;
  };
}

// Las esquinas se buscan para marcar y el centro es donde para el portero: con
// los tiros repartidos a ciegas, la cuadrícula de la ficha no dice nada.
const ZONAS_GOL    = [1,3,7,9,7,9,1,3,4,6];
const ZONAS_PARADA = [5,2,8,5,4,6,5,8];

function jugadas(semilla, plan){
  const r = azar(semilla);
  const uno = arr => arr[Math.floor(r()*arr.length)];
  const campo = PLANTILLA.filter(p => p[2] !== 'Portero');
  const punto = pos => {
    const [x, y] = PUNTO[pos];
    return [ +(x + (r()-0.5)*1.6).toFixed(2), +(y + (r()-0.5)*1.6).toFixed(2) ];
  };
  const nuestra = resultado => {
    const p = uno(campo);
    return { lado:'rival', resultado, dorsal:p[1], punto:punto(p[2]),
             zona: resultado === 'goal' ? uno(ZONAS_GOL) : uno(ZONAS_PARADA) };
  };
  const suya = resultado => ({
    lado:'own', resultado, punto: punto(uno(Object.keys(PUNTO))),
    zona: resultado === 'goal' ? uno(ZONAS_GOL) : uno(ZONAS_PARADA)
  });

  const lista = [];
  const meter = (n, hacer) => { for(let i = 0; i < n; i++) lista.push(hacer()); };
  meter(plan.golesNuestros,   () => nuestra('goal'));
  meter(plan.paradasRival,    () => nuestra('save'));
  meter(plan.fueraNuestros,   () => nuestra('out'));
  meter(plan.palosNuestros,   () => nuestra('post'));
  meter(plan.golesSuyos,      () => suya('goal'));
  meter(plan.paradasNuestras, () => suya('save'));
  meter(plan.fueraSuyos || 0, () => suya('out'));

  // Barajado determinista: un partido son ataques alternos, no primero todos
  // los goles nuestros y luego los suyos. El orden es además lo que dibuja la
  // evolución del marcador y lo que decide el más/menos.
  for(let i = lista.length - 1; i > 0; i--){
    const j = Math.floor(r() * (i+1));
    [lista[i], lista[j]] = [lista[j], lista[i]];
  }
  return lista;
}

// ------------------------------------------------------------------ la app

async function nuevaPagina(browser, base){
  const ctx = await browser.newContext({
    viewport:{ width:ANCHO, height:ALTO },
    deviceScaleFactor: ESCALA,
    serviceWorkers:'block',
    locale: IDIOMA === 'es' ? 'es-ES' : 'en-GB'
  });
  await ctx.addInitScript({ content: STUB + '\n' + GSTUB + '\n' + RELOJ_RAPIDO });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('  ! error en página: ' + e.message));
  // Las mismas rutas que las pruebas, con una configuración de mentira propia:
  // aquí tampoco puede cargarse el config.js del repositorio, que apunta al
  // proyecto de verdad.
  await rutasDePrueba(page,
    "window.SUPERSTAT_CONFIG={SUPABASE_URL:'https://demo.supabase.co'," +
    "SUPABASE_ANON_KEY:'anon-demo',GOOGLE_CLIENT_ID:'demo.apps.googleusercontent.com'};");
  // El idioma va en la URL y no solo en el `locale` del contexto: ?lang manda
  // sobre todo lo demás en js/i18n.js, así que la captura sale en el idioma que
  // se pide aunque el navegador diga otra cosa.
  await page.goto(base + '/index.html?lang=' + IDIOMA);
  return { ctx, page };
}

async function entrar(page){
  await page.waitForSelector('#auth-user');
  await page.fill('#auth-user', 'entrenador@cbsabadell.cat');
  await page.fill('#auth-pass', 'balonmano1');
  await page.click('#auth-toggle');
  await page.fill('#auth-user', 'entrenador@cbsabadell.cat');
  await page.fill('#auth-pass', 'balonmano1');
  await page.click('#auth-submit');
  await page.waitForSelector('#create-team-btn', { timeout:15000 });
}

async function altaEquipo(page, nombre){
  await page.fill('#new-team-name', nombre);
  await page.click('#create-team-btn');
  await page.waitForSelector('#add-player-btn');
  for(const [n, d, pos] of PLANTILLA){
    await page.fill('#p-name', n);
    await page.fill('#p-dorsal', d);
    await page.selectOption('#p-pos', pos);
    await page.click('#add-player-btn');
  }
}

const porDorsal = (modal, dorsal) =>
  `${modal} .modal-player-btn:has(.dorsal-mini:text-is("${dorsal}"))`;

// Toca un punto de la media pista dibujada, en metros. Las constantes son las
// de COURT y COURT_VB en js/app.js: si cambian allí, cambian aquí.
async function tocarPista(page, xm, ym){
  const px = await page.$eval('#pending-modal .court-svg', (svg, p) => {
    const VB = { x:-0.25, y:-0.25, w:20.5, h:16.35 }, D = 15;
    const r = svg.getBoundingClientRect();
    return { x: r.left + (p[0]-VB.x)/VB.w*r.width, y: r.top + (D-p[1]-VB.y)/VB.h*r.height };
  }, [xm, ym]);
  await page.mouse.click(px.x, px.y);
}

async function anotar(page, a){
  const grid = `.goals-row [data-grid="${a.lado}"]`;
  if(a.resultado === 'goal'){
    await page.click(`${grid} [data-zone="${a.zona}"]`);
  }else if(a.resultado === 'save'){
    // Dos toques seguidos dentro de la ventana de 260 ms = parada.
    await page.click(`${grid} [data-zone="${a.zona}"]`);
    await page.click(`${grid} [data-zone="${a.zona}"]`);
  }else{
    await page.click(`.goals-row [data-${a.resultado}="${a.lado}"]`);
  }
  await page.waitForSelector('#pending-modal', { timeout:10000 });
  // De los tiros nuestros se pregunta siempre el tirador. De los del rival no
  // se pregunta nadie salvo la primera vez, para fijar nuestro portero: por eso
  // el paso puede no estar y hay que mirar si el botón existe.
  const quien = a.dorsal || PORTERO;
  if(await page.$(porDorsal('#pending-modal', quien))){
    await page.click(porDorsal('#pending-modal', quien));
  }
  await page.waitForSelector('#pending-modal .court-svg');
  await tocarPista(page, a.punto[0], a.punto[1]);
  await page.waitForSelector('#pending-modal', { state:'detached' });
}

async function evento(page, tipo, dorsal){
  await page.click(`[data-event="${tipo}"]`);
  await page.waitForSelector('#event-modal .modal-player-btn');
  await page.click(porDorsal('#event-modal', dorsal));
  await page.waitForSelector('#event-modal', { state:'detached' });
}

// Juega un partido entero y lo guarda. Devuelve con la ficha ya en pantalla.
async function jugarPartido(page, rival, plan, semilla, opciones){
  const o = opciones || {};
  await page.click('#new-match-btn');
  await page.fill('#rival-name', rival);
  await page.click('#start-match-btn');
  await page.waitForSelector('.goals-row');

  // Los seis de pista, para que el más/menos tenga de dónde salir.
  for(const d of ['4','5','7','9','10','14']){
    await page.click(`.chip-row [data-court-player]:has(.dorsal-mini:text-is("${d}"))`);
  }

  await page.click('#toggle-clock');
  const lista = jugadas(semilla, plan);
  const corte = Math.floor(lista.length/2);
  for(let i = 0; i < lista.length; i++){
    if(i === corte){
      await page.click('#end-half-btn');
      await page.waitForSelector('.clock-half.done');
      await page.click('#toggle-clock');
    }
    if(o.antesDe && o.antesDe[i]) await o.antesDe[i](page);
    await anotar(page, lista[i]);
  }
  for(const [tipo, dorsal] of (plan.eventos || [])) await evento(page, tipo, dorsal);
  if(o.alFinal) await o.alFinal(page);

  await page.click('#finish-match-btn');
  await page.waitForSelector('.section-label');
}

// ------------------------------------------------------------------ capturas

// Para desplazarse hasta una sección hay que nombrarla, y su rótulo cambia con
// el idioma. Se le pregunta a la propia página por el texto de la clave, en vez
// de escribirlo aquí en dos idiomas: así el guion sigue funcionando si alguien
// reescribe el rótulo, y no hay una segunda copia de los textos fuera de
// js/i18n.js.
async function seccion(page, clave){
  const texto = await page.evaluate(k => window.I18N.t(k), clave);
  return `main .section-label:has-text("${texto}")`;
}

async function captura(page, nombre, selector){
  // Que se vaya antes el aviso flotante ("Partido guardado…"), o sale tapando
  // media captura. Dura 2,2 s y se quita solo.
  await page.waitForSelector('.toast', { state:'detached', timeout:6000 }).catch(() => {});
  if(selector){
    // La cabecera va fija, así que scrollIntoView() a secas esconde detrás el
    // título de la sección: se deja un hueco por debajo de ella.
    await page.$eval(selector, el => {
      window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 72);
    });
    await page.waitForTimeout(200);
  }
  const destino = path.join(DEST, nombre + '.png');
  await page.screenshot({ path:destino });
  console.log('  ' + nombre + '.png');
}

(async () => {
  fs.rmSync(DEST, { recursive:true, force:true });
  fs.mkdirSync(DEST, { recursive:true });

  const srv = await servir();
  const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await chromium.launch(LANZAR);
  const { ctx, page } = await nuevaPagina(browser, base);

  console.log('Preparando el equipo…');
  await entrar(page);
  await altaEquipo(page, 'CB Sabadell');
  // Al alta del último jugador la pantalla se queda abajo, en el formulario.
  await page.evaluate(() => window.scrollTo(0, 0));
  await captura(page, '08-plantilla');

  console.log('\nJugando el partido de la ficha…');
  // El partido que sale en las capturas: 28-25, con su reparto de paradas y
  // fallos. Las dos capturas del directo se hacen a media faena, con el
  // marcador ya puesto pero el partido sin terminar.
  await jugarPartido(page, 'CE Granollers', {
    golesNuestros:28, paradasRival:9, fueraNuestros:5, palosNuestros:2,
    golesSuyos:25, paradasNuestras:11, fueraSuyos:4,
    eventos:[['steal','9'],['turnover','22'],['exclusion','7'],['steal','5'],
             ['yellow','10'],['turnover','4'],['steal','14'],['exclusion','9']]
  }, 20240413, {
    antesDe: {
      // A mitad del partido, con el marcador ya crecido, las dos capturas del
      // directo: la pantalla entera y el modal de la zona de lanzamiento.
      40: async p => {
        await p.evaluate(() => window.scrollTo(0, 0));
        // El destello verde de "GOL" dura medio segundo sobre la casilla que se
        // acaba de tocar. Si la foto lo pilla, tapa el recuento de esa casilla y
        // además sale en unas ejecuciones sí y en otras no. Se espera a que se
        // apague: es lo que hace captura() con el aviso flotante.
        await p.waitForSelector('.flash', { state:'detached', timeout:3000 }).catch(() => {});
        await captura(p, '01-partido-en-vivo');
        await p.click('.goals-row [data-grid="rival"] [data-zone="3"]');
        await p.waitForSelector('#pending-modal .modal-player-btn');
        await p.click(porDorsal('#pending-modal', '7'));
        await p.waitForSelector('#pending-modal .court-svg');
        await captura(p, '02-zona-de-lanzamiento');
        await tocarPista(p, 6.2, 10.4);
        await p.waitForSelector('#pending-modal', { state:'detached' });
      }
    }
  });

  console.log('\nLa ficha del partido…');
  await page.evaluate(() => window.scrollTo(0, 0));
  await captura(page, '03-ficha-del-partido');

  // El mapa de tiros, en modo mapa de calor: es lo que más se entiende de un
  // vistazo en la tienda.
  await page.click('#toggle-heat');
  await page.waitForTimeout(200);
  await captura(page, '04-mapa-de-tiros', await seccion(page, 'match.whereWeShoot'));
  await page.click('#toggle-heat');

  await captura(page, '05-goleadores', await seccion(page, 'match.scorers'));

  console.log('\nDos partidos más para la temporada…');
  await page.click('#to-matches');
  await page.waitForSelector('#to-team');
  await page.click('#to-team');
  await page.waitForSelector('#new-match-btn');
  await jugarPartido(page, 'Handbol Terrassa', {
    golesNuestros:24, paradasRival:7, fueraNuestros:4, palosNuestros:1,
    golesSuyos:26, paradasNuestras:8, fueraSuyos:3,
    eventos:[['steal','5'],['turnover','7'],['exclusion','22']]
  }, 20240427);
  await page.click('#to-matches');
  await page.waitForSelector('#to-team');
  await page.click('#to-team');
  await page.waitForSelector('#new-match-btn');
  await jugarPartido(page, 'BM La Roca', {
    golesNuestros:31, paradasRival:6, fueraNuestros:3, palosNuestros:1,
    golesSuyos:22, paradasNuestras:13, fueraSuyos:5,
    eventos:[['steal','9'],['steal','4'],['yellow','14'],['turnover','10']]
  }, 20240511);

  // Fechas distintas, para que la lista y la temporada parezcan una temporada
  // y no tres partidos del mismo día.
  const FECHAS = { 'CE Granollers':'2026-04-13', 'Handbol Terrassa':'2026-04-27', 'BM La Roca':'2026-05-11' };
  await page.click('#to-matches');
  await page.waitForSelector('[data-match]');
  for(const [rival, fecha] of Object.entries(FECHAS)){
    await page.click(`[data-match]:has-text("${rival}")`);
    await page.waitForSelector('#edit-match');
    await page.click('#edit-match');
    await page.waitForSelector('#edit-date');
    await page.fill('#edit-date', fecha);
    await page.click('#save-match-edit');
    await page.waitForTimeout(200);
    await page.click('#to-matches');
    await page.waitForSelector('[data-match]');
  }

  await page.evaluate(() => window.scrollTo(0, 0));
  await captura(page, '07-partidos-anteriores');

  console.log('\nEl acumulado de la temporada…');
  await page.click('#to-season');
  await page.waitForSelector('.score-hero-num');
  await page.evaluate(() => window.scrollTo(0, 0));
  await captura(page, '06-temporada');

  await ctx.close();
  await browser.close();
  srv.close();
  console.log('\nListas en ' + path.relative(RAIZ, DEST) + '/');
})();
