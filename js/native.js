// Puente con la app nativa (Android e iOS).
//
// La misma web se empaqueta con Capacitor: dentro de la app, el HTML, el CSS y
// los scripts son archivos del aparato y no una página descargada. Casi todo
// funciona igual, pero hay tres cosas que no, y son las que resuelve este
// archivo:
//
//   1. **Entrar con Google.** Google bloquea su propio flujo web dentro de un
//      WebView embebido (responde `disallowed_useragent`), así que el botón que
//      dibuja GIS no sirve en la app. Hay que pedirle el id_token al sistema
//      operativo. Lo bueno es que lo que se hace con él después es exactamente
//      lo mismo: cambiarlo por sesión con `signInWithIdToken`.
//   2. **Descargar un archivo.** Un `<a download>` no hace nada dentro de un
//      WebView: no hay carpeta de descargas ni barra del navegador. El CSV hay
//      que escribirlo con Filesystem y enseñárselo al usuario.
//   3. **Compartir.** `navigator.share` no está en el WebView de Android; la
//      hoja de compartir del sistema se abre con el plugin Share.
//
// Sin bundler, y eso condiciona cómo se habla con los plugins.
//
// Los paquetes de npm (`@capacitor/share` y compañía) son ESM y hacen falta
// para que el proyecto nativo incluya su código Java y Swift, pero su
// envoltorio de JavaScript no se puede importar desde una etiqueta `<script>`.
// El puente que inyecta el sistema tampoco trae `registerPlugin`: solo deja en
// `window.Capacitor` las piezas de bajo nivel.
//
// La que sí vale es la compilación global de `@capacitor/core`, copiada en
// vendor/ como el resto. Deja en `window.capacitorExports` tanto la API de
// Capacitor como `registerPlugin()`, que devuelve un proxy que llama al plugin
// nativo por su nombre. Con eso la app se sigue cargando con etiquetas
// `<script>` y sin compilar nada, que es como está hecho el resto del proyecto.
//
// En el navegador todo esto no existe: `Native.isNative()` devuelve false y
// cada función devuelve null para que quien llame use el camino de siempre.
window.Native = (function(){

  function exports_(){ return window.capacitorExports || null; }

  function cap(){
    const ex = exports_();
    return (ex && ex.Capacitor) || window.Capacitor || null;
  }

  // Nativo es solo Android e iOS. Capacitor también se puede servir en el
  // navegador, y ahí lo que vale es el camino web.
  function isNative(){
    const c = cap();
    return Boolean(c && typeof c.isNativePlatform === 'function' && c.isNativePlatform());
  }

  function platform(){
    const c = cap();
    return c && typeof c.getPlatform === 'function' ? c.getPlatform() : 'web';
  }

  // Un plugin solo existe si se instaló en el proyecto nativo. Se pide con
  // cuidado para que una app compilada sin alguno no reviente entera.
  const registrados = {};
  function plugin(nombre){
    if(!isNative()) return null;
    if(registrados[nombre] !== undefined) return registrados[nombre];
    const ex = exports_();
    if(!ex || typeof ex.registerPlugin !== 'function'){
      registrados[nombre] = null;
      return null;
    }
    try{
      // registerPlugin siempre devuelve un proxy, exista o no el plugin nativo:
      // es al llamarlo cuando falla. Por eso se comprueba antes si el puente
      // dice que está, y así una app compilada sin alguno no revienta entera.
      const c = cap();
      if(c && typeof c.isPluginAvailable === 'function' && !c.isPluginAvailable(nombre)){
        console.warn('plugin no instalado en esta app: ' + nombre);
        registrados[nombre] = null;
        return null;
      }
      registrados[nombre] = ex.registerPlugin(nombre);
    }catch(e){
      console.warn('plugin no disponible: ' + nombre, e);
      registrados[nombre] = null;
    }
    return registrados[nombre];
  }

  function config(){ return window.SUPERSTAT_CONFIG || {}; }

  // ------------------------------------------------------------ arranque

  let googleListo = false;

  async function start(){
    if(!isNative()) return;

    // Barra de estado: fondo negro y texto claro, como el resto de la app.
    // 'DARK' en Capacitor quiere decir "fondo oscuro, contenido claro".
    const barra = plugin('StatusBar');
    if(barra){
      try{
        await barra.setStyle({ style:'DARK' });
        if(platform() === 'android') await barra.setBackgroundColor({ color:'#08090B' });
      }catch(e){}
    }

    // El botón atrás de Android: si hay un modal abierto lo cierra, y si no,
    // deja salir de la app. Sin esto, atrás cierra la app en mitad de un
    // partido, que es la peor forma posible de perder lo anotado.
    const app = plugin('App');
    if(app){
      try{
        app.addListener('backButton', ({ canGoBack }) => {
          if(window.SuperStatBack && window.SuperStatBack()) return;
          if(canGoBack) window.history.back();
          else app.exitApp();
        });
      }catch(e){}
    }

    await initGoogle();

    // La pantalla de carga se quita cuando ya hay algo que enseñar, no antes.
    const splash = plugin('SplashScreen');
    if(splash){ try{ await splash.hide(); }catch(e){} }
  }

  // ------------------------------------------------------ entrar con Google

  async function initGoogle(){
    const social = plugin('SocialLogin');
    if(!social || googleListo) return Boolean(social);
    const c = config();
    if(!c.GOOGLE_CLIENT_ID) return false;
    try{
      await social.initialize({
        google: {
          // En Android e iOS el cliente que valida el token sigue siendo el
          // "web" de Google Cloud: es el que Supabase tiene configurado como
          // audiencia. El cliente propio de cada plataforma existe (Android
          // con su SHA-1, iOS con su bundle id) pero no se nombra aquí, salvo
          // el de iOS, que el sistema sí necesita saber.
          webClientId: c.GOOGLE_CLIENT_ID,
          iOSClientId: c.GOOGLE_CLIENT_ID_IOS || undefined
        }
      });
      googleListo = true;
      return true;
    }catch(e){
      console.warn('no se pudo preparar el login de Google nativo', e);
      return false;
    }
  }

  // Devuelve el id_token de Google que da el sistema operativo, o null si aquí
  // no toca (navegador, plugin sin instalar, configuración a medias).
  //
  // A propósito sin nonce: en el flujo web hay que darle a Google el resumen
  // SHA-256 y a Supabase el original, y el SDK nativo no sigue ese mismo
  // reparto. Sin nonce, el token no lleva esa reclamación y Supabase no la
  // exige, que es el camino que no se puede equivocar. La protección que da el
  // nonce —que un token pedido para otra pantalla no valga aquí— la cubre en
  // nativo que el token lo emite el sistema para esta app en concreto.
  async function googleIdToken(){
    const social = plugin('SocialLogin');
    if(!social) return null;
    if(!googleListo && !(await initGoogle())) return null;
    const res = await social.login({
      provider: 'google',
      options: { scopes: ['email', 'profile'] }
    });
    const r = res && res.result;
    if(!r || !r.idToken) throw new Error('google-sin-token');
    return r.idToken;
  }

  async function googleSignOut(){
    const social = plugin('SocialLogin');
    if(!social) return;
    try{ await social.logout({ provider:'google' }); }catch(e){}
  }

  // -------------------------------------------------------------- archivos

  function blobToBase64(blob){
    return new Promise((ok, fallo) => {
      const fr = new FileReader();
      fr.onerror = () => fallo(fr.error || new Error('no se pudo leer el archivo'));
      // readAsDataURL da "data:<tipo>;base64,<datos>"; al plugin solo le
      // interesa la parte de después de la coma.
      fr.onload = () => ok(String(fr.result).split(',')[1] || '');
      fr.readAsDataURL(blob);
    });
  }

  async function escribir(blob, nombre, directorio){
    const fs = plugin('Filesystem');
    if(!fs) return null;
    const data = await blobToBase64(blob);
    const res = await fs.writeFile({ path: nombre, data, directory: directorio, recursive: true });
    return res && res.uri;
  }

  // Guardar de verdad en el aparato, en la carpeta de documentos, que es la que
  // el usuario puede abrir después desde su gestor de archivos.
  // Devuelve la ruta escrita, o null si esto no es nativo.
  async function saveFile(blob, nombre){
    if(!isNative()) return null;
    return escribir(blob, nombre, 'DOCUMENTS');
  }

  // Abrir la hoja de compartir del sistema con el archivo dentro. Se escribe
  // antes en la caché: es un archivo de paso, no algo que el usuario tenga que
  // encontrar luego.
  // Devuelve true si se compartió, false si el usuario canceló, null si aquí no
  // toca y hay que usar el camino del navegador.
  async function shareFile(blob, nombre, titulo){
    if(!isNative()) return null;
    const share = plugin('Share');
    if(!share) return null;
    const uri = await escribir(blob, nombre, 'CACHE');
    if(!uri) return null;
    try{
      await share.share({ title: titulo, dialogTitle: titulo, files: [uri] });
      return true;
    }catch(e){
      // Cancelar la hoja de compartir llega como error; no es un fallo.
      const m = (e && e.message ? e.message : '').toLowerCase();
      if(m.includes('cancel') || m.includes('abort')) return false;
      throw e;
    }
  }

  return { isNative, platform, start, googleIdToken, googleSignOut, saveFile, shareFile };
})();
