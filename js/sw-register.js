// Registro del service worker.
//
// Estaba escrito dentro de index.html, en una etiqueta <script> suelta. Está
// aquí desde que la página lleva Content-Security-Policy: un script en línea
// obliga a abrir la política con 'unsafe-inline', y eso es justo lo que la
// política sirve para cerrar. Con el archivo aparte la regla puede ser
// `script-src 'self'` a secas, que es la que de verdad protege.
//
// Lo que hace es lo de antes, sin cambios: en el navegador registra sw.js para
// poder abrir sin cobertura; dentro de la app de Android o iOS no registra nada,
// porque allí los archivos ya están en el aparato y un service worker sirviendo
// una versión vieja desde dentro de un binario solo da problemas. Desde file://
// tampoco se registra —hace falta https o localhost— y la app sigue funcionando
// sin él.
(function(){
  if(!('serviceWorker' in navigator)) return;
  if(window.Native && Native.isNative()) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(e => {
      console.warn('no se pudo registrar el service worker', e);
    });
  });
})();
