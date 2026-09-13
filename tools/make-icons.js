// Genera todos los iconos de la marca: los de la web (PWA) y los que necesitan
// las apps de Android y iOS.
//
// El dibujo está aquí una vez y de él salen todos los archivos, para no tener
// varias versiones del logo conviviendo. Si se toca, hay que tocar también
// brandLogo() en js/app.js y el favicon en línea de index.html.
//
// Se ejecuta a mano y solo cuando cambie la marca:
//   CHROMIUM_PATH=/ruta/al/chromium node tools/make-icons.js
//
// Lo que deja en icons/ lo usa la web directamente. Lo que deja en assets/ es
// la materia prima de @capacitor/assets, que es quien saca de ahí los tamaños
// concretos que piden Android e iOS:
//   npx capacitor-assets generate
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const LANZAR = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};
const RAIZ = path.join(__dirname, '..');

const ROJO  = '#D9182B';
const NEGRO = '#08090B';
const CLARO = '#F5F5F7';

// Las tres barras del logo, en proporciones sobre el lado del cuadro rojo.
const BARRAS = [[0.203, 0.531, 0.25], [0.422, 0.391, 0.39], [0.641, 0.219, 0.562]];

// `pad` es el hueco alrededor del cuadro rojo, en tanto por uno del lienzo.
// `redondeo` es el radio de sus esquinas, sobre el lado del cuadro.
// `fondo` puede ser null para dejarlo transparente.
function svg(opts){
  const s = 1024;
  const m = s * opts.pad, w = s - m*2;
  const fondo = opts.fondo
    ? `<rect width="${s}" height="${s}" fill="${opts.fondo}"/>` : '';
  // El fondo del icono adaptativo de Android es solo color: el cuadro y las
  // barras van en la capa de delante, que es la que el lanzador mueve.
  if(opts.soloFondo) return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"
      viewBox="0 0 ${s} ${s}">${fondo}</svg>`;
  const barras = BARRAS.map(b => {
    const bw = w * 0.156;
    return `<rect x="${m + w*b[0]}" y="${m + w*b[1]}" width="${bw}"
                  height="${w*b[2]}" rx="${bw*0.28}" fill="${CLARO}"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
    ${fondo}
    <rect x="${m}" y="${m}" width="${w}" height="${w}" rx="${w*opts.redondeo}" fill="${ROJO}"/>
    ${barras}
  </svg>`;
}

// El splash es solo el cuadro de la marca centrado sobre el negro de la app.
// Sin el nombre escrito a propósito: la tipografía de la app es la del sistema
// y aquí saldría la del navegador que genera la imagen, que es otra.
function svgSplash(lado){
  const logo = lado * 0.22, x = (lado - logo) / 2;
  const barras = BARRAS.map(b => {
    const bw = logo * 0.156;
    return `<rect x="${x + logo*b[0]}" y="${x + logo*b[1]}" width="${bw}"
                  height="${logo*b[2]}" rx="${bw*0.28}" fill="${CLARO}"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}" viewBox="0 0 ${lado} ${lado}">
    <rect width="${lado}" height="${lado}" fill="${NEGRO}"/>
    <rect x="${x}" y="${x}" width="${logo}" height="${logo}" rx="${logo*0.219}" fill="${ROJO}"/>
    ${barras}
  </svg>`;
}

const TRABAJOS = [
  // --- la web ---
  { file:'icons/icon-192.png', size:192, svg: svg({ pad:0, redondeo:0.219, fondo:NEGRO }) },
  { file:'icons/icon-512.png', size:512, svg: svg({ pad:0, redondeo:0.219, fondo:NEGRO }) },
  // Zona segura de un icono "maskable": el círculo central del 80%. Con este
  // hueco el cuadro rojo cae entero dentro, se recorte como se recorte.
  { file:'icons/icon-maskable.png', size:512, svg: svg({ pad:0.18, redondeo:0.16, fondo:NEGRO }) },
  // iOS no aplica máscara: recorta un cuadrado y le pone él las esquinas.
  { file:'icons/apple-touch-icon.png', size:180, svg: svg({ pad:0, redondeo:0, fondo:ROJO }) },

  // --- materia prima de las apps ---
  // Sin esquinas redondeadas y sin transparencia: cada sistema las redondea a
  // su manera, y un icono de iOS con transparencia lo rechaza la App Store.
  { file:'assets/icon.png', size:1024, svg: svg({ pad:0, redondeo:0, fondo:ROJO }) },
  // Icono adaptativo de Android: el fondo y el dibujo van por separado y el
  // lanzador los recorta con la forma que use. El dibujo se queda en el centro
  // porque de los 108 dp del lienzo solo se ven 72.
  { file:'assets/icon-background.png', size:1024, svg: svg({ pad:0, fondo:ROJO, soloFondo:true }) },
  { file:'assets/icon-foreground.png', size:1024, svg: svg({ pad:0.30, redondeo:0.16, fondo:null }) },
  // Pantalla de carga. Cuadrada y grande para que valga en cualquier aparato y
  // orientación: el sistema recorta lo que le sobra del centro.
  { file:'assets/splash.png', size:2732, svg: svgSplash(2732) },
  { file:'assets/splash-dark.png', size:2732, svg: svgSplash(2732) }
];

(async () => {
  const browser = await chromium.launch(LANZAR);
  const page = await browser.newPage();
  for(const t of TRABAJOS){
    const destino = path.join(RAIZ, t.file);
    fs.mkdirSync(path.dirname(destino), { recursive:true });
    await page.setViewportSize({ width:t.size, height:t.size });
    await page.setContent(
      `<style>html,body{margin:0;padding:0;background:transparent;}
       svg{display:block;width:${t.size}px;height:${t.size}px;}</style>` + t.svg);
    // omitBackground deja el PNG con transparencia donde el SVG no pinta nada,
    // que es lo que necesita el dibujo del icono adaptativo de Android.
    await page.screenshot({ path:destino, omitBackground:true });
    console.log('  ' + t.file);
  }
  await browser.close();
})();
