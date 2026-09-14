// Genera las imágenes de las dos cuentas de Instagram, la castellana y la
// inglesa. Los textos que las acompañan —biografía, pies y etiquetas— están en
// docs/instagram.md; aquí solo están los titulares que van dibujados dentro de
// la imagen.
//
//   node tools/make-instagram-assets.js
//   CHROMIUM_PATH=/ruta/al/chromium node tools/make-instagram-assets.js
//
// Deja en instagram/:
//
//   perfil-1080.png            la foto de perfil, la misma en las dos cuentas
//   es/<n>-<tema>/<orden>.png  las tres publicaciones en castellano
//   en/<n>-<tema>/<orden>.png  las mismas en inglés
//
// Cada publicación es un carrusel: una portada con el titular y una o dos
// capturas de la app enmarcadas. Van numeradas por el orden en que se suben.
//
// Las capturas salen de play/capturas/ y play/capturas-en/, que las genera
// tools/make-screenshots.js de la app de verdad con un partido inventado: no
// hay forma de que acabe publicándose el equipo de nadie. **Hay que generarlas
// antes**, y en los dos idiomas.
//
// Se ejecuta a mano, solo al preparar o refrescar las cuentas. No entra en
// ningún binario ni en la web, igual que play/.
//
// Dos técnicas, y no es capricho: la foto de perfil es un dibujo y va en SVG,
// como el icono de la tienda; las publicaciones son maquetación —un titular, un
// pie y una captura dentro de un marco— y van en HTML y CSS, que es lo que sabe
// colocar eso sin contar píxeles a mano.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// El dibujo de la marca y la paleta se piden prestados al generador de la ficha
// de Play en vez de volver a copiarlos aquí.
const { marca, ROJO, ROJO_2, NEGRO, CLARO, GRIS } = require('./make-play-assets.js');

const LANZAR = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};
const RAIZ = path.join(__dirname, '..');
const DEST = path.join(RAIZ, 'instagram');

// Instagram recorta la foto de perfil en un círculo, y el muro quiere 4:5.
const PERFIL = 1080;
const ANCHO = 1080, ALTO = 1350;

const FUENTE = `-apple-system, "Segoe UI", Roboto, system-ui, sans-serif`;

// ------------------------------------------------------------ foto de perfil

// El cuadro rojo entero y las tres barras en medio. Al recortarlo en círculo
// queda un círculo rojo con las barras dentro, que es la marca reconocible a
// tamaño de avatar: el wordmark ahí no se leería.
//
// Las barras ocupan del 20% al 80% del lado, así que sus esquinas caen a 0,42
// lados del centro y el círculo inscrito llega a 0,50: ya cabrían a sangre. Aun
// así se encogen al 76%, porque Instagram recorta un pelo por dentro del
// círculo y una barra rozando el borde se ve apretada.
const LADO_MARCA = Math.round(PERFIL * 0.76);
const MARGEN = Math.round((PERFIL - LADO_MARCA) / 2);

const SVG_PERFIL = `<svg xmlns="http://www.w3.org/2000/svg" width="${PERFIL}" height="${PERFIL}" viewBox="0 0 ${PERFIL} ${PERFIL}">
  <rect width="${PERFIL}" height="${PERFIL}" fill="${ROJO}"/>
  ${marca(LADO_MARCA, MARGEN, MARGEN, 0)}
</svg>`;

// --------------------------------------------------------- las publicaciones

// El titular va partido en líneas a mano y no con un ancho máximo: una frase de
// marketing se corta donde cambia la idea, no donde se acaba el renglón.
const POSTS = {
  es: [
    {
      slug: '1-un-toque',
      titulo: ['Un toque, gol.', 'Dos toques, parada.'],
      pie: 'Anota el partido entero sin levantar la vista de la pista.',
      capturas: [
        ['01-partido-en-vivo', 'Las dos porterías, el reloj y el registro rápido']
      ]
    },
    {
      slug: '2-desde-donde',
      titulo: ['¿Desde dónde', 'marcáis de verdad?'],
      pie: 'Toca el punto exacto de la pista. Al pitido final, el mapa te lo cuenta.',
      capturas: [
        ['02-zona-de-lanzamiento', 'Un dedo sobre la media pista, a escala'],
        ['04-mapa-de-tiros', 'Y al acabar, el mapa de calor']
      ]
    },
    {
      slug: '3-sin-cobertura',
      titulo: ['El pabellón no', 'tiene cobertura.', 'La app no la', 'necesita.'],
      pie: 'Se abre y se anota igual. Lo pendiente se sube solo cuando vuelve la red.',
      capturas: [
        ['03-ficha-del-partido', 'La ficha, hecha al pitido final'],
        ['06-temporada', 'Y la temporada, que se suma sola']
      ]
    }
  ],
  en: [
    {
      slug: '1-one-tap',
      titulo: ['One tap, goal.', 'Two taps, save.'],
      pie: 'Log the whole match without taking your eyes off the court.',
      capturas: [
        ['01-partido-en-vivo', 'Both goals, the clock and the quick log']
      ]
    },
    {
      slug: '2-where-from',
      titulo: ['Where do you', 'really score from?'],
      pie: 'Tap the exact spot on the court. At full time, the map tells you.',
      capturas: [
        ['02-zona-de-lanzamiento', 'One finger on a half-court drawn to scale'],
        ['04-mapa-de-tiros', 'And afterwards, the heat map']
      ]
    },
    {
      slug: '3-offline',
      titulo: ['The sports hall', 'has no signal.', 'The app does not', 'need one.'],
      pie: 'It opens and records anyway. Whatever is pending uploads itself once you are back.',
      capturas: [
        ['03-ficha-del-partido', 'The match report, done at full time'],
        ['06-temporada', 'And the season, adding itself up']
      ]
    }
  ]
};

const CAPTURAS = { es: 'capturas', en: 'capturas-en' };

// El tamaño del titular baja según cuántas líneas tenga, para que una portada de
// cuatro líneas no se salga por abajo.
const CUERPO = n => (n <= 2 ? 92 : (n === 3 ? 78 : 68));

const ESTILO = `
  <style>
    *{ margin:0; padding:0; box-sizing:border-box; }
    body{ width:${ANCHO}px; height:${ALTO}px; background:${NEGRO};
          font-family:${FUENTE}; color:${CLARO}; overflow:hidden; position:relative; }
    /* El mismo resplandor rojo del gráfico de cabecera de la ficha de Play. */
    .brillo{ position:absolute; left:-280px; top:-340px; width:1400px; height:1200px;
             background:radial-gradient(closest-side, rgba(217,24,43,0.34), rgba(217,24,43,0)); }
    .hoja{ position:relative; height:100%; display:flex; flex-direction:column;
           padding:86px 80px; }
    .marca{ display:flex; align-items:center; gap:22px; }
    .marca svg{ width:76px; height:76px; display:block; }
    .wordmark{ font-size:44px; font-weight:700; letter-spacing:-1.6px; }
    .wordmark i{ color:${ROJO_2}; font-style:normal; }
    /* Todo el hueco que sobra se va arriba, en un solo sitio: con dos
       margin-top:auto el aire se repartía entre el titular y el pie de página y
       la portada quedaba flotando en medio de la nada. */
    .bloque{ margin-top:auto; }
    h1{ font-size:${'{CUERPO}'}px; font-weight:700; letter-spacing:-3px;
        line-height:1.06; }
    .pie{ font-size:34px; font-weight:500; color:${GRIS}; letter-spacing:-0.4px;
          line-height:1.32; margin-top:34px; }

    /* Lámina de captura: rótulo arriba y el móvil debajo, centrado. */
    .rotulo{ font-size:40px; font-weight:700; letter-spacing:-1.2px; margin-top:40px; }
    .movil{ flex:1; display:flex; align-items:center; justify-content:center;
            margin-top:36px; min-height:0; }
    .movil img{ height:100%; width:auto; display:block; border-radius:34px;
                border:3px solid rgba(255,255,255,0.14); }
  </style>
`;

function marcaHtml(){
  // El mismo cuadro, en SVG en línea, a 32 unidades como brandLogo().
  return `
    <div class="marca">
      <svg viewBox="0 0 ${100} ${100}">${marca(100, 0, 0, 0.219)}</svg>
      <span class="wordmark">Super<i>Stat</i></span>
    </div>
  `;
}

function portadaHtml(post){
  return ESTILO.replace('{CUERPO}', CUERPO(post.titulo.length)) + `
    <div class="brillo"></div>
    <div class="hoja">
      ${marcaHtml()}
      <div class="bloque">
        <h1>${post.titulo.map(esc).join('<br>')}</h1>
        <div class="pie">${esc(post.pie)}</div>
      </div>
    </div>
  `;
}

function capturaHtml(rotulo, dataUri){
  return ESTILO.replace('{CUERPO}', CUERPO(2)) + `
    <div class="brillo"></div>
    <div class="hoja">
      ${marcaHtml()}
      <div class="rotulo">${esc(rotulo)}</div>
      <div class="movil"><img src="${dataUri}"></div>
    </div>
  `;
}

function esc(s){
  return String(s).replace(/[&<>]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;' }[c]));
}

function comoDataUri(rel){
  const abs = path.join(RAIZ, rel);
  if(!fs.existsSync(abs)){
    console.error('\nFalta ' + rel + '.\nGenera antes las capturas en los dos idiomas:\n' +
                  '  node tools/make-screenshots.js\n' +
                  '  IDIOMA=en node tools/make-screenshots.js\n');
    process.exit(1);
  }
  return 'data:image/png;base64,' + fs.readFileSync(abs).toString('base64');
}

// ------------------------------------------------------------------ pintar

(async () => {
  fs.rmSync(DEST, { recursive:true, force:true });
  fs.mkdirSync(DEST, { recursive:true });

  const browser = await chromium.launch(LANZAR);
  const page = await browser.newPage();

  // La foto de perfil, con canal alfa. Es el mismo rodeo que en la ficha de
  // Play y por el mismo motivo: el dibujo tapa el lienzo entero, así que una
  // captura de pantalla saldría en 24 bits. toDataURL() escribe siempre RGBA.
  await page.setViewportSize({ width:PERFIL, height:PERFIL });
  const datos = await page.evaluate(async ([svg, lado]) => {
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    await img.decode();
    const c = document.createElement('canvas');
    c.width = lado; c.height = lado;
    c.getContext('2d').drawImage(img, 0, 0, lado, lado);
    return c.toDataURL('image/png');
  }, [SVG_PERFIL, PERFIL]);
  fs.writeFileSync(path.join(DEST, 'perfil-1080.png'), Buffer.from(datos.split(',')[1], 'base64'));
  console.log('  perfil-1080.png');

  await page.setViewportSize({ width:ANCHO, height:ALTO });

  for(const idioma of Object.keys(POSTS)){
    console.log('\n' + idioma + ':');
    for(const post of POSTS[idioma]){
      const carpeta = path.join(DEST, idioma, post.slug);
      fs.mkdirSync(carpeta, { recursive:true });

      const laminas = [['1-portada', portadaHtml(post)]].concat(
        post.capturas.map(([nombre, rotulo], i) => [
          (i + 2) + '-' + nombre,
          capturaHtml(rotulo, comoDataUri(path.join('play', CAPTURAS[idioma], nombre + '.png')))
        ])
      );

      for(const [nombre, html] of laminas){
        await page.setContent(html);
        // Las capturas van como data URI: hay que esperar a que estén
        // decodificadas o la lámina sale con el hueco vacío.
        await page.evaluate(() => Promise.all(
          Array.from(document.images).map(i => i.decode().catch(() => {}))
        ));
        const destino = path.join(carpeta, nombre + '.png');
        await page.screenshot({ path: destino });
        console.log('  ' + path.relative(DEST, destino));
      }
    }
  }

  await browser.close();
  console.log('\nListas en instagram/. Los textos que las acompañan, en docs/instagram.md.');
})();
