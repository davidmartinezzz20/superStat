// Service worker: lo que hace que la app abra en un pabellón sin cobertura.
//
// Los datos ya funcionaban sin red —store.js escribe en el navegador y sube al
// volver la conexión—, pero eso solo servía si la página ya estaba abierta: al
// entrar de cero hacían falta el HTML, el CSS, los tres scripts y supabase-js,
// y todo eso venía de la red. Aquí se guardan una vez y se sirven desde el
// aparato.
//
// La estrategia es distinta según qué se pida, y a propósito:
//   - El shell (html/css/js, supabase-js incluido, que ahora vive en el propio
//     repo): primero la red y la caché como red de seguridad. Así una versión
//     nueva llega en cuanto hay cobertura, en vez de quedarse una vieja pegada
//     durante días.
//   - Todo lo demás (la API de Supabase, Google): directo a la red, sin tocar.
//     Guardar respuestas de la base sería servir datos viejos como si fueran
//     buenos, y de eso ya se encarga el espejo local, que sí sabe fusionarlos.
//
// Al cambiar cualquier archivo del shell hay que subir VERSION, o los
// navegadores que ya tengan la caché vieja seguirán sirviéndola.
const VERSION = 'superstat-v11';

const SHELL = [
  './',
  './index.html',
  './css/styles.css',
  './vendor/supabase-js-2.116.0.js',
  './vendor/capacitor-core-8.5.2.js',
  './js/config.js',
  './js/db.js',
  './js/store.js',
  './js/native.js',
  './js/i18n.js',
  './js/app.js',
  './js/sw-register.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  // Estos dos no los pide el navegador al cargar la página —el maskable lo usa
  // el sistema al instalarla desde el manifest, y el de Apple al añadirla a la
  // pantalla de inicio—, así que es fácil olvidarlos aquí. Para entonces puede
  // no haber cobertura: test/archivos.js vigila que no vuelvan a faltar.
  './icons/icon-maskable.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    // Uno a uno y sin romper la instalación si alguno falla: vale más una app
    // instalada a medias que ninguna.
    await Promise.all(SHELL.map(url =>
      cache.add(new Request(url, { cache:'reload' })).catch(() => {})
    ));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(n => n !== VERSION).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

function esDelShell(url){
  return url.origin === self.location.origin &&
         SHELL.some(p => url.pathname === new URL(p, self.registration.scope).pathname);
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if(req.method !== 'GET') return;

  const url = new URL(req.url);
  if(!esDelShell(url)) return;    // la base y Google van directos a la red

  event.respondWith((async () => {
    try{
      const res = await fetch(req);
      if(res && res.ok){
        const cache = await caches.open(VERSION);
        cache.put(req, res.clone());
      }
      return res;
    }catch(e){
      const hit = await caches.match(req);
      if(hit) return hit;
      // Navegación sin red y sin esa ruta guardada: se sirve la portada, que es
      // la única página que hay (el resto son pantallas dentro del mismo HTML).
      if(req.mode === 'navigate'){
        const home = await caches.match('./index.html');
        if(home) return home;
      }
      throw e;
    }
  })());
});
