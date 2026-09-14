// Genera los dos gráficos que pide la ficha de Google Play:
//
//   play/icono-512.png          icono de la tienda, 512×512
//   play/grafico-1024x500.png   gráfico de cabecera, 1024×500
//
// Van aparte de tools/make-icons.js a propósito. Aquél saca los iconos que
// usan la web y las apps, que son archivos del producto; esto son materiales
// de la ficha de la tienda, no entran en ningún binario y solo hacen falta al
// publicar. El dibujo de la marca sí es el mismo, y se mantiene con las mismas
// proporciones que allí: si se toca el logo hay que tocar los dos.
//
// Se ejecuta a mano, solo al preparar o refrescar la ficha:
//   node tools/make-play-assets.js
//   CHROMIUM_PATH=/ruta/al/chromium node tools/make-play-assets.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const LANZAR = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};
const RAIZ = path.join(__dirname, '..');
const DEST = path.join(RAIZ, 'play');

const ROJO  = '#D9182B';
// El mismo rojo aclarado, el que la app usa para la parte "Stat" del wordmark
// (--brand-2): sobre negro, el rojo puro se queda corto de contraste.
const ROJO_2 = '#FF5A68';
const NEGRO = '#08090B';
const CLARO = '#F5F5F7';
const GRIS  = '#8A8F98';
const VERDE = '#33A17F';
const AZUL  = '#4C8FD6';

// Las tres barras del logo, en proporciones sobre el lado del cuadro rojo.
// Son las mismas de tools/make-icons.js y de brandLogo() en js/app.js.
const BARRAS = [[0.203, 0.531, 0.25], [0.422, 0.391, 0.39], [0.641, 0.219, 0.562]];

function marca(lado, x, y, redondeo){
  const barras = BARRAS.map(b => {
    const bw = lado * 0.156;
    return `<rect x="${x + lado*b[0]}" y="${y + lado*b[1]}" width="${bw}"
                  height="${lado*b[2]}" rx="${bw*0.28}" fill="${CLARO}"/>`;
  }).join('');
  return `<rect x="${x}" y="${y}" width="${lado}" height="${lado}"
                rx="${lado*redondeo}" fill="${ROJO}"/>${barras}`;
}

// --------------------------------------------------------------- el icono

// Play pide un PNG de 512×512 y le pone él las esquinas redondeadas, así que
// este va a cuadro lleno y sin transparencia, igual que assets/icon.png.
const ICONO = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  ${marca(512, 0, 0, 0)}
</svg>`;

// ---------------------------------------------------- el gráfico de cabecera

// 1024×500. Play lo recorta por los lados en algunos sitios, así que el texto
// se queda dentro y lo único que llega al borde es el fondo. A la derecha, la
// cuadrícula de 9 zonas de la portería —que es lo que hace la app— con una
// celda de gol y una de parada encendidas, con los mismos colores de la app.
function porteria(x, y, w, h){
  const cw = w/3, ch = h/3;
  let celdas = '';
  // [columna, fila, color]: un gol arriba a la escuadra y una parada abajo.
  const encendidas = { '2,0': VERDE, '0,2': AZUL };
  for(let f = 0; f < 3; f++){
    for(let c = 0; c < 3; c++){
      const tono = encendidas[c + ',' + f];
      celdas += `<rect x="${x + c*cw}" y="${y + f*ch}" width="${cw}" height="${ch}" rx="6"
        fill="${tono || 'rgba(255,255,255,0.04)'}" fill-opacity="${tono ? 0.9 : 1}"
        stroke="rgba(255,255,255,0.12)" stroke-width="2"/>`;
    }
  }
  // Los postes: el marco de la portería, más gruesos que las separaciones.
  const postes = `<path d="M${x-7} ${y+h+7} V${y-7} H${x+w+7} V${y+h+7}"
    fill="none" stroke="${CLARO}" stroke-opacity="0.85" stroke-width="9"
    stroke-linecap="round" stroke-linejoin="round"/>`;
  return celdas + postes;
}

const GRAFICO = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">
  <defs>
    <radialGradient id="brillo" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${ROJO}" stop-opacity="0.30"/>
      <stop offset="1" stop-color="${ROJO}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="500" fill="${NEGRO}"/>
  <ellipse cx="150" cy="120" rx="520" ry="420" fill="url(#brillo)"/>

  ${marca(96, 84, 132, 0.219)}

  <text x="84" y="322" fill="${CLARO}" font-family="Roboto, 'Segoe UI', system-ui, sans-serif"
        font-size="86" font-weight="700" letter-spacing="-3">Super<tspan fill="${ROJO_2}">Stat</tspan></text>
  <text x="88" y="376" fill="${GRIS}" font-family="Roboto, 'Segoe UI', system-ui, sans-serif"
        font-size="29" font-weight="500" letter-spacing="-0.3">Estadísticas de balonmano, tiro a tiro</text>

  ${porteria(700, 150, 240, 200)}
</svg>`;

// `alfa` decide si el PNG sale con canal alfa o sin él, y no es un detalle:
// Play pide el icono en PNG de **32 bits** y el gráfico de cabecera en 24 bits.
//
// Una captura de pantalla no sirve para el icono: como el dibujo tapa el
// lienzo entero, Chromium ve que no hay ni un píxel transparente y guarda el
// PNG en 24 bits, que es justo lo que Play rechaza. El rodeo es dibujar el SVG
// en un `<canvas>` y pedirle a él el PNG: `toDataURL` escribe siempre RGBA,
// tenga o no transparencia, y sale un PNG de 32 bits con la alfa a tope.
const TRABAJOS = [
  { file:'play/icono-512.png',        w:512,  h:512, alfa:true,  svg:ICONO },
  { file:'play/grafico-1024x500.png', w:1024, h:500, alfa:false, svg:GRAFICO }
];

// El dibujo de la marca y la paleta se exportan para tools/make-instagram-assets.js,
// que pinta la foto de perfil con el mismo cuadro rojo. Es una copia menos del
// logo: ya hay tres (brandLogo(), el favicon de index.html y make-icons.js) y
// cada una es un sitio más donde olvidarse al cambiarlo.
module.exports = { marca, ROJO, ROJO_2, NEGRO, CLARO, GRIS, VERDE, AZUL, BARRAS };

// Ejecutado a mano genera los archivos; requerido desde otro guion, solo
// presta el dibujo.
if(require.main !== module) return;

(async () => {
  const browser = await chromium.launch(LANZAR);
  const page = await browser.newPage();
  for(const t of TRABAJOS){
    const destino = path.join(RAIZ, t.file);
    fs.mkdirSync(path.dirname(destino), { recursive:true });
    await page.setViewportSize({ width:t.w, height:t.h });
    await page.setContent(
      `<style>html,body{margin:0;padding:0;background:${NEGRO};}
       svg{display:block;width:${t.w}px;height:${t.h}px;}</style>` + t.svg);

    if(t.alfa){
      const datos = await page.evaluate(async ([svg, w, h]) => {
        const img = new Image();
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
        await img.decode();
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        return c.toDataURL('image/png');
      }, [t.svg, t.w, t.h]);
      fs.writeFileSync(destino, Buffer.from(datos.split(',')[1], 'base64'));
    }else{
      await page.screenshot({ path:destino });
    }
    console.log('  ' + t.file);
  }
  await browser.close();
  console.log('\nListo. Están en play/, junto a las capturas.');
})();
