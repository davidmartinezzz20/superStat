// Que las tres listas de archivos digan lo mismo.
//
// Los mismos archivos están escritos en tres sitios que hay que mantener a mano:
//
//   1. Las etiquetas <script> y <link> de index.html.
//   2. El array SHELL de sw.js, que es lo que el service worker guarda para
//      poder abrir la app sin cobertura.
//   3. El array COPIAR de tools/build-www.js, que es lo que entra dentro de la
//      app de Android y iOS.
//
// Los dos modos de fallo son silenciosos, que es justo lo que una prueba
// detecta y una persona no: un archivo que se queda fuera del SHELL no rompe
// nada hasta que alguien abre la app sin cobertura, y uno que se queda fuera de
// COPIAR no rompe nada hasta que se compila el binario. Cuando se escribió esta
// prueba, al SHELL le faltaban dos iconos que sí estaban en las otras dos listas.
//
// No hace falta ni navegador ni servidor: es leer cuatro archivos.
//
//   node test/archivos.js
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const leer = rel => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

let fallos = 0, pasadas = 0;
function check(nombre, ok, detalle){
  if(ok){ pasadas++; console.log('  ok   ' + nombre); }
  else { fallos++; console.log('  FALLA ' + nombre + (detalle ? '  → ' + detalle : '')); }
}

// Las listas se leen como texto y no se ejecutan: sw.js es un service worker y
// build-www.js borra y escribe www/ nada más cargarse.
function arrayDe(fuente, nombre, archivo){
  const m = fuente.match(new RegExp('const ' + nombre + '\\s*=\\s*\\[([\\s\\S]*?)\\]'));
  if(!m) throw new Error('no se encontró el array ' + nombre + ' en ' + archivo +
                         ': ¿cambió de nombre? Esta prueba lo busca por ahí.');
  return (m[1].match(/'[^']*'|"[^"]*"/g) || []).map(s => s.slice(1, -1));
}

// './css/styles.css', 'css/styles.css' y './' hablan de lo mismo; se comparan
// en la forma que usa build-www.js, sin el './' delante.
const normal = p => p.replace(/^\.\//, '');

// Lo que index.html pide al cargarse, sin lo que viene de fuera (Google) ni el
// favicon, que va en línea como data URI.
function rutasDeIndex(html){
  const out = [];
  const re = /(?:src|href)\s*=\s*"([^"]+)"/g;
  let m;
  while((m = re.exec(html))){
    const url = m[1];
    if(/^(https?:|data:|mailto:|#)/.test(url)) continue;
    out.push(normal(url));
  }
  return out;
}

const index = leer('index.html');
const sw = leer('sw.js');
const build = leer('tools/build-www.js');
const manifest = JSON.parse(leer('manifest.webmanifest'));

const enIndex = rutasDeIndex(index);
const SHELL = arrayDe(sw, 'SHELL', 'sw.js').map(normal);
const COPIAR = arrayDe(build, 'COPIAR', 'tools/build-www.js').map(normal);
const iconos = (manifest.icons || []).map(i => normal(i.src));

console.log('\n1. Lo que index.html carga está en las dos listas');
for(const rel of enIndex){
  check(rel + ' está en el SHELL de sw.js', SHELL.includes(rel));
  check(rel + ' está en el COPIAR de build-www.js', COPIAR.includes(rel));
}

console.log('\n2. Los iconos del manifest también');
// El manifest no lo pide el navegador al cargar: lo pide al instalar la app, y
// para entonces puede no haber cobertura.
check('manifest.webmanifest está en el SHELL', SHELL.includes('manifest.webmanifest'));
check('manifest.webmanifest está en el COPIAR', COPIAR.includes('manifest.webmanifest'));
for(const rel of iconos){
  check(rel + ' está en el SHELL de sw.js', SHELL.includes(rel));
  check(rel + ' está en el COPIAR de build-www.js', COPIAR.includes(rel));
}

console.log('\n3. Todo lo que las listas nombran existe en disco');
// './' es la portada, no un archivo: se sirve index.html, que ya se comprueba.
const existe = rel => fs.existsSync(path.join(RAIZ, rel));
for(const rel of SHELL){
  if(rel === '') continue;
  check('sw.js nombra un archivo que existe: ' + rel, existe(rel));
}
for(const rel of COPIAR){
  check('build-www.js nombra un archivo que existe: ' + rel, existe(rel));
}

console.log('\n4. El service worker sirve la portada');
check("el SHELL incluye './' además de index.html",
      arrayDe(sw, 'SHELL', 'sw.js').includes('./'));
check('sw.js tiene una VERSION con la que invalidar la caché vieja',
      /const VERSION\s*=\s*'superstat-v\d+'/.test(sw),
      (sw.match(/const VERSION[^\n]*/) || ['no se encontró'])[0]);

console.log(`\n${pasadas} comprobaciones pasadas, ${fallos} fallidas`);
process.exit(fallos ? 1 : 0);
