// Las fronteras de las zonas de lanzamiento, y que la pista dibujada y la pista
// que se toca sean la misma.
//
// zoneFromPoint() es una función pura: de un punto en metros saca la zona con
// la que se agrupan los lanzamientos en las estadísticas. Como la zona no se
// guarda —siempre se recalcula—, cambiar un umbral cambia de golpe cómo se
// cuentan todos los partidos ya registrados. Aquí se fija cada umbral por los
// dos lados.
//
// Y lo otro que comprueba es el acoplamiento que avisa CLAUDE.md y que hasta
// ahora no miraba nadie: el aspect-ratio de .court-svg en el CSS tiene que
// coincidir con el viewBox del SVG, o el toque se convierte a unos metros que
// no son los que se ven.
//
// Sin navegador ni servidor: la función se extrae de js/app.js y se evalúa
// suelta.
//
//   node test/pista.js
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(RAIZ, 'js/app.js'), 'utf8');
const css = fs.readFileSync(path.join(RAIZ, 'css/styles.css'), 'utf8');

let fallos = 0, pasadas = 0;
function check(nombre, ok, detalle){
  if(ok){ pasadas++; console.log('  ok   ' + nombre); }
  else { fallos++; console.log('  FALLA ' + nombre + (detalle ? '  → ' + detalle : '')); }
}

// app.js es una IIFE que no exporta nada —y está bien así, no hay que abrirla
// para esto—, de modo que el trozo que interesa se saca del texto. Si el
// anclaje no aparece, se dice; el error de no encontrarlo no tiene por qué
// parecerse a un fallo de la función.
function trozo(re, que){
  const m = app.match(re);
  if(!m) throw new Error('no se encontró ' + que + ' en js/app.js: ¿cambió de ' +
                         'nombre o de forma? Esta prueba lo busca por el texto.');
  return m[0];
}

const fuente =
  trozo(/const COURT\s*=\s*\{[^}]*\};/, 'la constante COURT') + '\n' +
  trozo(/const COURT_VB\s*=\s*\{[^}]*\};/, 'la constante COURT_VB') + '\n' +
  trozo(/ {2}function zoneFromPoint\(p\)\{[\s\S]*?\n {2}\}/, 'la función zoneFromPoint()');

const { COURT, COURT_VB, zoneFromPoint } =
  new Function(fuente + '\nreturn { COURT, COURT_VB, zoneFromPoint };')();

const z = (x, y) => zoneFromPoint({ x, y });

console.log('\n1. Sin punto no hay zona');
check('un tiro sin punto marcado no tiene zona', z === undefined ? false : zoneFromPoint(null) === null);

console.log('\n2. Los extremos, a los dos lados de 5.5 y 14.5');
check('x=5.4 es extremo izquierdo', z(5.4, 8) === 'EI');
check('x=5.5 ya no es extremo izquierdo', z(5.5, 8) !== 'EI', z(5.5, 8));
check('x=14.6 es extremo derecho', z(14.6, 8) === 'ED');
check('x=14.5 ya no es extremo derecho', z(14.5, 8) !== 'ED', z(14.5, 8));
check('la banda izquierda entera es extremo', z(0, 12) === 'EI');
check('la banda derecha entera es extremo', z(20, 12) === 'ED');

console.log('\n3. El pivote: cerca de la portería y por el centro');
// Sin centrar del todo: justo en el centro y a esa altura manda el 7M, que se
// comprueba aparte.
check('a 6.4 m de la línea es pivote', z(11, 6.4) === 'PIV');
check('a 6.6 m de la línea ya no es pivote', z(11, 6.6) !== 'PIV', z(11, 6.6));
check('desviado 2.4 m del centro sigue siendo pivote', z(12.4, 5) === 'PIV');
check('desviado 2.5 m del centro ya no es pivote', z(12.5, 5) !== 'PIV', z(12.5, 5));

console.log('\n4. Los laterales empiezan en los postes');
check('justo antes del poste izquierdo es lateral izquierdo', z(8.4, 10) === 'LI');
check('entre los postes es central', z(10, 10) === 'CE');
check('en el poste izquierdo ya es central', z(COURT.postL, 10) === 'CE');
check('justo pasado el poste derecho es lateral derecho', z(11.6, 10) === 'LD');
check('en el poste derecho todavía no es lateral', z(COURT.postR, 10) === 'CE');

console.log('\n5. El 7 metros manda sobre todo lo demás');
check('el punto de penalti es 7M', z(10, 7) === '7M');
check('a 0.7 m del punto sigue siendo 7M', z(10.7, 7) === '7M');
check('a 0.8 m del punto ya no es 7M', z(10.8, 7) !== '7M', z(10.8, 7));
// El círculo del 7M se solapa con la franja del pivote y se mira antes: un
// penalti no se cuenta como tiro de pivote.
check('el 7M gana al pivote, que ocupa la misma franja',
      z(11, 6.4) === 'PIV' && z(10, 6.4) === '7M');

console.log('\n6. La pista dibujada y la pista que se toca son la misma');
// courtPointFromEvent() convierte el toque a metros con COURT_VB; si la caja
// que pinta el CSS tiene otra proporción, el punto cae desplazado.
const regla = css.match(/\.court-svg\{[^}]*\}/);
check('.court-svg existe en el CSS', Boolean(regla));
const ar = regla && regla[0].match(/aspect-ratio\s*:\s*([\d.]+)\s*\/\s*([\d.]+)/);
check('.court-svg fija un aspect-ratio', Boolean(ar),
      regla ? regla[0].replace(/\s+/g, ' ') : '');
if(ar){
  const enCss = Number(ar[1]) / Number(ar[2]);
  const enSvg = COURT_VB.w / COURT_VB.h;
  check('el aspect-ratio del CSS coincide con el viewBox de courtSvg()',
        Math.abs(enCss - enSvg) < 1e-9,
        'css ' + ar[1] + '/' + ar[2] + ' vs viewBox ' + COURT_VB.w + '/' + COURT_VB.h);
}

console.log('\n7. El viewBox cubre la pista que se dibuja');
check('el viewBox abarca los 20 m de ancho', COURT_VB.x <= 0 && COURT_VB.x + COURT_VB.w >= COURT.width);
check('el viewBox abarca los 15 m de fondo', COURT_VB.h >= COURT.depth);

console.log(`\n${pasadas} comprobaciones pasadas, ${fallos} fallidas`);
process.exit(fallos ? 1 : 0);
