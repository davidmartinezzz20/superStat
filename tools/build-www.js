// Junta en www/ los archivos que se empaquetan dentro de la app de móvil.
//
// La web sigue sin build: se sirve el repo tal cual y esto no hace falta para
// nada. Existe solo porque Capacitor copia entero el directorio que se le diga
// (`webDir`), y apuntarlo a la raíz metería dentro de la app las pruebas, las
// herramientas, el esquema de la base y node_modules.
//
// No copia nada que no esté en la lista, así que añadir un archivo nuevo a la
// app web obliga a añadirlo aquí. Es a propósito: vale más una lista que haya
// que mantener que una app con dentro cosas que no pintan nada.
//
//   node tools/build-www.js
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const DEST = path.join(RAIZ, 'www');

// El service worker no va: dentro de la app los archivos ya están en el
// aparato, así que no hay nada que cachear, y un service worker sirviendo una
// versión vieja dentro de un binario solo da problemas. index.html ya se cuida
// de no registrarlo cuando corre en nativo.
const COPIAR = [
  'index.html',
  'manifest.webmanifest',
  'css/styles.css',
  'vendor/supabase-js-2.116.0.js',
  'vendor/capacitor-core-8.5.2.js',
  'js/config.js',
  'js/db.js',
  'js/store.js',
  'js/native.js',
  'js/i18n.js',
  'js/app.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable.png',
  'icons/apple-touch-icon.png'
];

fs.rmSync(DEST, { recursive:true, force:true });
let n = 0;
for(const rel of COPIAR){
  const origen = path.join(RAIZ, rel);
  if(!fs.existsSync(origen)){
    console.error('falta ' + rel + ': revisa la lista de tools/build-www.js');
    process.exit(1);
  }
  const destino = path.join(DEST, rel);
  fs.mkdirSync(path.dirname(destino), { recursive:true });
  fs.copyFileSync(origen, destino);
  n++;
}
console.log(`www/ listo con ${n} archivos`);
