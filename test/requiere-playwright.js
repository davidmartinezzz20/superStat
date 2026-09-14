// Lo que hace falta para que una prueba pueda correr, comprobado antes de
// correrla.
//
// Playwright no está en package.json a propósito (ver test/README.md): son
// cientos de megas de navegadores para un proyecto cuya seña de identidad es no
// tener build ni dependencias. El precio de esa decisión es que `npm test` en
// una máquina limpia fallaba con un "Cannot find module 'playwright'", que no
// dice nada de lo que hay que hacer. Lo mismo con el servidor: sin nada
// sirviendo en el puerto, las pruebas fallaban una a una con "connection
// refused" hasta el final.
//
// Aquí se comprueban las dos cosas y se dice exactamente qué falta. Va en su
// propio archivo, como test/rutas.js, para que una prueba nueva no se pueda
// olvidar: basta con pedirle el chromium a este módulo en vez de a playwright.
const BASE_URL = process.env.SUPERSTAT_URL || 'http://localhost:5173';

function falta(mensaje){
  console.error('\n' + mensaje + '\n');
  process.exit(1);
}

let playwright;
try{
  playwright = require('playwright');
}catch(e){
  falta(
    'Falta Playwright, que las pruebas necesitan y no está en package.json.\n' +
    'Se instala aparte, una vez:\n\n' +
    '  npm install -g playwright && playwright install chromium\n\n' +
    'Si ya tienes un Chromium por tu cuenta:\n\n' +
    '  CHROMIUM_PATH=/ruta/al/chromium npm test'
  );
}

// Si el Chromium que trae Playwright no está instalado, se le puede pasar uno
// con CHROMIUM_PATH=/ruta/al/chromium.
const LANZAR = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};

// La app se sirve tal cual, sin build, así que las pruebas necesitan algo
// sirviéndola. No se arranca desde aquí a propósito: un servidor por suite
// pelearía por el puerto con el que ya esté levantado.
// La app es bilingüe y elige idioma por el del navegador (ver js/i18n.js). Un
// Chromium recién lanzado dice que habla inglés, así que sin esto las pruebas
// buscarían "Guardar" en una app que pone "Save" y fallarían sin motivo.
//
// Se le dice que es un navegador en español, que es lo que asumen las
// aserciones. Va aquí y no en cada suite por lo mismo que lo demás: para que
// una prueba nueva no se pueda olvidar. Una prueba que quiera ver la app en
// inglés abre la página con ?lang=en, que manda sobre esto.
const CONTEXTO = { locale: 'es-ES' };

async function servidorListo(){
  try{
    const res = await fetch(BASE_URL + '/index.html');
    if(!res.ok) throw new Error('respuesta ' + res.status);
  }catch(e){
    falta(
      'No hay nada sirviendo la app en ' + BASE_URL + ' (' + e.message + ').\n' +
      'Arráncala en otra terminal antes de las pruebas:\n\n' +
      '  npm start\n\n' +
      'o, si lo prefieres:  python3 -m http.server 5173'
    );
  }
}

module.exports = { chromium: playwright.chromium, LANZAR, CONTEXTO, BASE_URL, servidorListo };
