// Lo que ninguna prueba puede traerse de verdad.
//
// Hay tres cosas que la página pide al arrancar y que en una prueba no deben
// llegar nunca a su origen real:
//
//   - `js/config.js`, que es la importante: ahí viven la URL y la clave anon
//     del proyecto de Supabase de verdad. Una prueba que lo carga tal cual
//     apunta a la base de producción, y una prueba que apunta a producción es
//     una prueba que puede escribir en ella.
//   - `vendor/supabase-js-*.js`, que pisaría el doble que `addInitScript` acaba
//     de dejar en `window.supabase`.
//   - el script de Google, que no es alcanzable y cuyo doble ya está puesto.
//
// Vive en su propio archivo y no copiado en cada suite para que una prueba
// nueva no se pueda olvidar de ninguna de las tres.
//
// `donde` es una página o un contexto: los dos entienden `route()`. Para el
// service worker hace falta el contexto, porque las peticiones que hace él
// —las de `cache.add()` al instalarse— no pasan por `page.route()`.

const CONFIG_DE_PRUEBA =
  "window.SUPERSTAT_CONFIG={SUPABASE_URL:'https://test.supabase.co'," +
  "SUPABASE_ANON_KEY:'anon-test'," +
  "GOOGLE_CLIENT_ID:'cliente-de-prueba.apps.googleusercontent.com'," +
  // El precio que enseña la pantalla de Pro. Quien cobra es Stripe; esto es
  // solo el cartel, y por eso puede ser de mentira aquí.
  "PRO_PRICE:'4,99 \\u20ac'};";

// Sin URL ni clave: es como se ve la app recién descargada del repositorio.
const CONFIG_SIN_RELLENAR =
  "window.SUPERSTAT_CONFIG={SUPABASE_URL:'',SUPABASE_ANON_KEY:''};";

const vacio = r => r.fulfill({ contentType:'application/javascript', body:'' });

// Solo la configuración. Es lo que necesita la prueba del service worker, que a
// propósito deja que todo lo demás se cargue de verdad.
async function rutaConfig(donde, cuerpo){
  await donde.route('**/js/config.js', r => r.fulfill({
    contentType:'application/javascript',
    body: cuerpo === undefined ? CONFIG_DE_PRUEBA : cuerpo
  }));
}

// Las tres, que es lo que quiere cualquier prueba que trabaje contra el doble.
async function rutasDePrueba(donde, cuerpo){
  await donde.route('**/vendor/supabase-js-*.js', vacio);
  await donde.route('**/gsi/client*', vacio);
  await rutaConfig(donde, cuerpo);
}

module.exports = { rutasDePrueba, rutaConfig, CONFIG_DE_PRUEBA, CONFIG_SIN_RELLENAR };
