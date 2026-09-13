// Genera los iconos de la PWA a partir del mismo dibujo de la marca.
//
// Hacen falta en PNG porque el manifest de Android y el icono de pantalla de
// inicio de iOS no aceptan SVG. El dibujo está aquí una vez y de él salen los
// tres archivos, para no tener tres versiones distintas del logo conviviendo.
//
// Se ejecuta a mano y solo cuando cambie la marca:
//   CHROMIUM_PATH=/ruta/al/chromium node tools/make-icons.js
//
// Si se toca el dibujo, hay que tocar también brandLogo() en js/app.js y el
// favicon en línea de index.html.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const LANZAR = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};
const DEST = path.join(__dirname, '..', 'icons');

// `pad` es el hueco que queda alrededor del cuadro rojo, en tanto por uno. El
// icono normal va a sangre; el "maskable" se deja con aire porque Android le
// recorta las esquinas con la forma que use el lanzador de aplicaciones.
function svg(pad, redondeo){
  const s = 512, m = s * pad, w = s - m*2;
  const bar = (x, y, h) => {
    const bw = w * 0.156, bx = m + w * x, by = m + w * y, bh = w * h;
    return `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="${bw*0.28}" fill="#F5F5F7"/>`;
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
    <rect width="${s}" height="${s}" fill="#08090B"/>
    <rect x="${m}" y="${m}" width="${w}" height="${w}" rx="${w*redondeo}" fill="#D9182B"/>
    ${bar(0.203, 0.531, 0.25)}
    ${bar(0.422, 0.391, 0.39)}
    ${bar(0.641, 0.219, 0.562)}
  </svg>`;
}

const ICONOS = [
  { file:'icon-192.png',      size:192, pad:0,    redondeo:0.219 },
  { file:'icon-512.png',      size:512, pad:0,    redondeo:0.219 },
  // Zona segura de un icono maskable: el círculo central del 80%. Con este
  // hueco el cuadro rojo entero cae dentro, se recorte como se recorte.
  { file:'icon-maskable.png', size:512, pad:0.18, redondeo:0.16  },
  // iOS no aplica máscara: recorta un cuadrado y le pone él las esquinas.
  { file:'apple-touch-icon.png', size:180, pad:0, redondeo:0 }
];

(async () => {
  fs.mkdirSync(DEST, { recursive:true });
  const browser = await chromium.launch(LANZAR);
  const page = await browser.newPage();
  for(const ic of ICONOS){
    await page.setViewportSize({ width: ic.size, height: ic.size });
    await page.setContent(`<style>html,body{margin:0;padding:0;}svg{display:block;width:${ic.size}px;height:${ic.size}px;}</style>`
      + svg(ic.pad, ic.redondeo));
    await page.screenshot({ path: path.join(DEST, ic.file), omitBackground:false });
    console.log('  ' + ic.file);
  }
  await browser.close();
})();
