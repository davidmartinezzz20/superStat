// Que los dos idiomas digan lo mismo, y que no quede texto escrito a mano.
//
// Traducir una app que ya existía tiene dos modos de fallo, y los dos son
// silenciosos —la app no se rompe, simplemente aparece una palabra en el idioma
// que no toca— así que son justo lo que una prueba pilla y una persona no:
//
//   1. Una clave que está en español y no en inglés (o al revés). En pantalla
//      sale el respaldo en español y hay que verlo para enterarse.
//   2. Un texto que se quedó escrito dentro de una plantilla de app.js. Ese no
//      cambia de idioma nunca, ni con el respaldo.
//
// Lo tercero que se comprueba es que no se hayan traducido los valores que
// viajan a Postgres: las posiciones se guardan como 'Portero' y los tipos de
// evento como 'turnover'. Si alguien los traduce "para que se vea bien", la
// plantilla se parte en dos según el idioma que tuviera la app el día que se
// dio de alta al jugador, y eso no lo arregla ya nadie.
//
// No hace falta ni navegador ni servidor: es leer dos archivos.
//
//   node test/i18n.js
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const leer = rel => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

let fallos = 0, pasadas = 0;
function check(nombre, ok, detalle){
  if(ok){ pasadas++; console.log('  ok   ' + nombre); }
  else { fallos++; console.log('  FALLA ' + nombre + (detalle ? '  → ' + detalle : '')); }
}

// js/i18n.js se escribe para el navegador (window.I18N = ...), así que aquí se
// carga dándole un window de mentira. Es más honesto que volver a escribir los
// diccionarios en la prueba: lo que se comprueba es el archivo de verdad.
function cargarI18N(){
  const fuente = leer('js/i18n.js');
  const win = {};
  const fn = new Function('window', 'navigator', 'location', 'document', 'console', fuente);
  fn(win,
     { language:'es-ES', languages:['es-ES'] },
     { search:'' },
     { documentElement:{} },                 // lo justo para el atributo lang
     { warn(){}, error(){} });
  return win.I18N;
}

const I18N = cargarI18N();
const { es: ES, en: EN } = I18N.DICTS;

console.log('1. Los dos diccionarios tienen las mismas claves');

const clavesES = Object.keys(ES).sort();
const clavesEN = Object.keys(EN).sort();

const faltanEnEN = clavesES.filter(k => EN[k] === undefined);
const sobranEnEN = clavesEN.filter(k => ES[k] === undefined);

check('ninguna clave del español falta en inglés', faltanEnEN.length === 0,
      faltanEnEN.slice(0, 8).join(', '));
check('ninguna clave del inglés sobra sobre el español', sobranEnEN.length === 0,
      sobranEnEN.slice(0, 8).join(', '));
check('hay claves de sobra para que la comprobación signifique algo', clavesES.length > 200,
      clavesES.length + ' claves');

const vacias = clavesES.filter(k => !String(ES[k]).trim() || !String(EN[k] || '').trim());
check('ninguna traducción está vacía', vacias.length === 0, vacias.slice(0, 8).join(', '));

// Un {marcador} que está en un idioma y no en el otro deja un hueco sin rellenar
// —"Mejor racha: {n} goles"— o pierde un dato por el camino.
const marcadores = s => (String(s).match(/\{(\w+)\}/g) || []).sort().join(',');
const descuadradas = clavesES.filter(k => marcadores(ES[k]) !== marcadores(EN[k]));
check('los marcadores {…} coinciden en los dos idiomas', descuadradas.length === 0,
      descuadradas.slice(0, 8).join(', '));

// Las formas de plural van de dos en dos: con _one y sin _other, el plural del
// inglés se cae al respaldo y sale la forma del singular.
const sueltos = clavesES.filter(k => {
  if(k.endsWith('_one')) return ES[k.slice(0, -4) + '_other'] === undefined;
  if(k.endsWith('_other')) return ES[k.slice(0, -6) + '_one'] === undefined;
  return false;
});
check('cada plural tiene sus dos formas, _one y _other', sueltos.length === 0,
      sueltos.slice(0, 8).join(', '));

console.log('\n2. Los valores que van a la base no se traducen');

// Las posiciones se guardan tal cual en players.position, así que la clave del
// diccionario ES tiene que seguir siendo la palabra en castellano y su
// traducción al español, la misma palabra.
const POSICIONES = ['Portero','Lateral izquierdo','Central','Lateral derecho',
                    'Extremo izquierdo','Extremo derecho','Pivote'];
POSICIONES.forEach(p => {
  check('position.' + p + ' existe y en español es su propio id',
        ES['position.' + p] === p, ES['position.' + p]);
});

const app = leer('js/app.js');
check('POSITIONS sigue siendo la lista de ids en castellano',
      POSICIONES.every(p => app.includes("'" + p + "'")));
check('el portero se filtra por la constante y no por un texto suelto',
      app.includes('const GOALKEEPER') && !/position [!=]== 'Portero'/.test(app));

['turnover','steal','exclusion','yellow','red','assist','block','foul7m'].forEach(id => {
  check('event.' + id + ' está en los dos idiomas',
        ES['event.' + id] !== undefined && EN['event.' + id] !== undefined);
});

['EI','LI','CE','LD','ED','PIV','7M'].forEach(id => {
  check('origin.' + id + ' está en los dos idiomas',
        ES['origin.' + id] !== undefined && EN['origin.' + id] !== undefined);
});

console.log('\n3. En app.js no queda texto escrito a mano');

// Se buscan frases castellanas dentro de las plantillas: dos palabras seguidas
// con una letra acentuada o una ñ de por medio es texto para leer, no código.
// Las líneas de comentario no cuentan, que ahí sí se escribe en español.
const lineas = app.split('\n');
const sospechosas = [];
lineas.forEach((linea, i) => {
  const limpia = linea.replace(/^\s*\/\/.*$/, '');
  // Texto entre etiquetas: >Guardar cambios<
  const entreEtiquetas = limpia.match(/>[^<>${}]*[áéíóúñÁÉÍÓÚÑ¿¡][^<>${}]*</g) || [];
  // Cadenas con acento que no sean una posición (que es un id) ni un separador
  const enCadenas = (limpia.match(/'[^']*[áéíóúñ¿¡][^']*'/g) || [])
    .filter(s => !POSICIONES.some(p => s.includes(p)));
  const hallazgos = entreEtiquetas.concat(enCadenas)
    // ' · ' y ' × ' son separadores, no texto
    .filter(s => /[a-záéíóúñ]{2,}/i.test(s.replace(/[·×–—]/g, '')));
  if(hallazgos.length) sospechosas.push((i + 1) + ': ' + hallazgos[0].trim());
});
check('ninguna frase en castellano suelta en las plantillas', sospechosas.length === 0,
      sospechosas.slice(0, 5).join(' | '));

// El atajo tiene que existir y usarse: si alguien lo borra, todo lo de arriba
// sigue pasando y la app se queda muda.
check('app.js usa t() del diccionario', /const t = I18N\.t/.test(app));
check('app.js llama a t() muchas veces', (app.match(/\bt\(/g) || []).length > 150,
      (app.match(/\bt\(/g) || []).length + ' llamadas');

console.log('\n4. El motor responde como debe');

I18N.setLang('es');
check('setLang cambia el idioma activo', I18N.lang() === 'es');
check('t() devuelve el español', I18N.t('nav.teams') === 'Equipos', I18N.t('nav.teams'));
check('el singular sale bien', I18N.t('team.playerCount', { n:1 }) === '1 jugador');
check('el plural sale bien', I18N.t('team.playerCount', { n:3 }) === '3 jugadores');

I18N.setLang('en');
check('t() devuelve el inglés', I18N.t('nav.teams') === 'Teams', I18N.t('nav.teams'));
check('el plural inglés sale bien', I18N.t('team.playerCount', { n:3 }) === '3 players');
check('los marcadores se rellenan',
      I18N.t('match.vs', { rival:'CE Granollers' }) === 'vs CE Granollers');
check('una clave que no existe se devuelve tal cual', I18N.t('no.existe') === 'no.existe');

// La fecha no es solo el nombre del mes: en inglés cambia el orden.
check('la fecha se monta en el orden de cada idioma',
      I18N.t('date.short', { d:13, mes:'Sep' }) === 'Sep 13');
I18N.setLang('es');
check('y en español al revés',
      I18N.t('date.short', { d:13, mes:'sep' }) === '13 sep');

console.log('\n' + pasadas + ' comprobaciones pasadas, ' + fallos + ' fallidas');
process.exit(fallos ? 1 : 0);
