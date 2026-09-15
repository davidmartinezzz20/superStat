// Que los cuatro idiomas digan lo mismo, y que no quede texto escrito a mano.
//
// Traducir una app que ya existía tiene dos modos de fallo, y los dos son
// silenciosos —la app no se rompe, simplemente aparece una palabra en el idioma
// que no toca— así que son justo lo que una prueba pilla y una persona no:
//
//   1. Una clave que está en español y no en otro idioma (o al revés). En
//      pantalla sale el respaldo en español y hay que verlo para enterarse.
//      Con cuatro diccionarios esto pasa de ser probable a ser seguro, así que
//      cada uno se compara contra el español, que es la fuente de la verdad.
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
const ES = I18N.DICTS.es;

// El español es la referencia: los demás se comparan contra él, uno a uno, para
// que el fallo diga en qué idioma está y no solo que algo no cuadra.
const OTROS = I18N.LANGS.filter(c => c !== 'es');

console.log('1. Los cuatro diccionarios tienen las mismas claves');

const clavesES = Object.keys(ES).sort();
check('hay claves de sobra para que la comprobación signifique algo', clavesES.length > 200,
      clavesES.length + ' claves');
check('están los cuatro idiomas', I18N.LANGS.join(',') === 'es,en,fr,de', I18N.LANGS.join(','));
check('cada idioma tiene su nombre para el selector',
      I18N.LANGS.every(c => I18N.langName(c) !== c),
      I18N.LANGS.map(c => I18N.langName(c)).join(' · '));

// Un {marcador} que está en un idioma y no en el otro deja un hueco sin rellenar
// —"Mejor racha: {n} goles"— o pierde un dato por el camino.
const marcadores = s => (String(s).match(/\{(\w+)\}/g) || []).sort().join(',');

for(const code of OTROS){
  const dict = I18N.DICTS[code];

  const faltan = clavesES.filter(k => dict[k] === undefined);
  const sobran = Object.keys(dict).filter(k => ES[k] === undefined);
  check('ninguna clave del español falta en ' + code, faltan.length === 0,
        faltan.slice(0, 8).join(', '));
  check('ninguna clave de ' + code + ' sobra sobre el español', sobran.length === 0,
        sobran.slice(0, 8).join(', '));

  const vacias = clavesES.filter(k => !String(dict[k] || '').trim());
  check('ninguna traducción vacía en ' + code, vacias.length === 0, vacias.slice(0, 8).join(', '));

  const descuadradas = clavesES.filter(k => marcadores(ES[k]) !== marcadores(dict[k]));
  check('los marcadores {…} coinciden en ' + code, descuadradas.length === 0,
        descuadradas.slice(0, 8).join(', '));
}

const vaciasES = clavesES.filter(k => !String(ES[k]).trim());
check('ninguna traducción vacía en es', vaciasES.length === 0, vaciasES.slice(0, 8).join(', '));

// Las formas de plural van de dos en dos: con _one y sin _other, el plural se
// cae al respaldo y sale la forma del singular. Se mira en todos los idiomas,
// que la regla de dónde parte el plural no es la misma en todos (ver PLURAL).
for(const code of I18N.LANGS){
  const dict = I18N.DICTS[code];
  const sueltos = Object.keys(dict).filter(k => {
    if(k.endsWith('_one')) return dict[k.slice(0, -4) + '_other'] === undefined;
    if(k.endsWith('_other')) return dict[k.slice(0, -6) + '_one'] === undefined;
    return false;
  });
  check('cada plural de ' + code + ' tiene sus dos formas, _one y _other', sueltos.length === 0,
        sueltos.slice(0, 8).join(', '));
}

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
  check('event.' + id + ' está en los cuatro idiomas',
        I18N.LANGS.every(c => I18N.DICTS[c]['event.' + id] !== undefined));
});

['EI','LI','CE','LD','ED','PIV','7M'].forEach(id => {
  check('origin.' + id + ' está en los cuatro idiomas',
        I18N.LANGS.every(c => I18N.DICTS[c]['origin.' + id] !== undefined));
});

// Las posiciones se traducen, pero su clave no: si alguien tradujera también la
// clave en un idioma nuevo, esa plantilla quedaría sin nombre de posición.
POSICIONES.forEach(p => {
  check('position.' + p + ' tiene texto en los cuatro idiomas',
        I18N.LANGS.every(c => String(I18N.DICTS[c]['position.' + p] || '').trim()));
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

I18N.setLang('fr');
check('t() devuelve el francés', I18N.t('nav.teams') === 'Équipes', I18N.t('nav.teams'));
check('el plural francés sale bien', I18N.t('map.shots', { n:3 }) === '3 tirs');
// El francés parte el plural en otro sitio: 0 va en singular. Una temporada
// recién empezada enseña ceros por todas partes, así que se nota enseguida.
check('el cero francés va en singular', I18N.t('map.shots', { n:0 }) === '0 tir',
      I18N.t('map.shots', { n:0 }));

I18N.setLang('de');
check('t() devuelve el alemán', I18N.t('nav.account') === 'Konto', I18N.t('nav.account'));
check('el plural alemán sale bien', I18N.t('map.shots', { n:3 }) === '3 Würfe');
check('el cero alemán va en plural, como el español',
      I18N.t('map.shots', { n:0 }) === '0 Würfe', I18N.t('map.shots', { n:0 }));

// La fecha no es solo el nombre del mes: cambia el orden y la puntuación.
I18N.setLang('en');
check('la fecha se monta en el orden de cada idioma',
      I18N.t('date.short', { d:13, mes:'Sep' }) === 'Sep 13');
I18N.setLang('de');
check('y en alemán el día lleva punto',
      I18N.t('date.short', { d:13, mes:'Jan.' }) === '13. Jan.',
      I18N.t('date.short', { d:13, mes:'Jan.' }));
I18N.setLang('es');
check('y en español al revés que en inglés',
      I18N.t('date.short', { d:13, mes:'sep' }) === '13 sep');

console.log('\n' + pasadas + ' comprobaciones pasadas, ' + fallos + ' fallidas');
process.exit(fallos ? 1 : 0);
