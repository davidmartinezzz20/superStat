// Capa de acceso a Supabase: sesión, autenticación y las dos operaciones de
// sincronización (traer cambios y subirlos). No sabe nada de pantallas ni de
// cómo se guardan los datos en el navegador; de eso se encarga store.js.
window.DB = (function(){

  // Orden de dependencias: un jugador necesita que su equipo exista antes, y un
  // tiro o un evento necesitan su partido. Subir y aplicar siempre en este orden.
  const TABLES = ['teams','players','matches','shots','events'];
  const PAGE = 1000;

  let client = null;

  function config(){ return window.SUPERSTAT_CONFIG || {}; }

  function isConfigured(){
    const c = config();
    return Boolean(c.SUPABASE_URL && c.SUPABASE_ANON_KEY);
  }

  function init(){
    if(client) return client;
    if(!isConfigured()) return null;
    if(!window.supabase || !window.supabase.createClient) return null;
    client = window.supabase.createClient(config().SUPABASE_URL, config().SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true  // recoge la vuelta del login de Google
      }
    });
    return client;
  }

  // ---------------------------------------------------------------- sesión

  async function currentUser(){
    const c = init();
    if(!c) return null;
    const { data, error } = await c.auth.getSession();
    if(error || !data.session) return null;
    return data.session.user;
  }

  function onAuthChange(cb){
    const c = init();
    if(!c) return;
    c.auth.onAuthStateChange((event, session) => cb(session ? session.user : null, event));
  }

  // La vuelta de Google trae el token en la URL; una vez recogido se limpia
  // para que no quede a la vista ni se reenvíe al recargar.
  function cleanAuthUrl(){
    if(window.location.hash.includes('access_token') || window.location.search.includes('code=')){
      history.replaceState({}, document.title, window.location.pathname);
    }
  }

  // ------------------------------------------------------ entrar con Google
  //
  // El botón lo dibuja Google Identity Services dentro de esta misma página, en
  // vez de usar signInWithOAuth, que mandaba al callback del proyecto. Ese
  // rodeo era el que hacía que Google anunciara "Ir a <referencia>.supabase.co":
  // enseña el dominio de quien pide el token, y quien lo pedía era Supabase.
  // Ahora el token se pide desde el origen de la app y solo después se cambia
  // por una sesión, así que en pantalla sale la app. Para que además ponga
  // "SuperStat" en vez del dominio hay que verificar la marca en Google.

  // El nonce viaja dos veces y no de la misma forma: a Google se le da su
  // resumen SHA-256 en hexadecimal, y a Supabase el original, que es quien
  // comprueba que uno corresponde al otro. Mandar el mismo a los dos falla.
  function randomNonce(){
    const b = new Uint8Array(32);
    crypto.getRandomValues(b);
    return Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
  }

  async function sha256Hex(text){
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf), x => x.toString(16).padStart(2, '0')).join('');
  }

  // El script de Google se carga con async, así que puede no estar listo cuando
  // se pinta la pantalla de entrada por primera vez.
  function whenGoogleReady(ms){
    const limite = Date.now() + (ms || 8000);
    return new Promise((ok, fallo) => {
      (function mirar(){
        if(window.google && window.google.accounts && window.google.accounts.id) return ok();
        if(Date.now() > limite) return fallo(new Error('google-no-carga'));
        setTimeout(mirar, 50);
      })();
    });
  }

  // Dibuja el botón dentro de `el`. `onError` recoge lo que falle *después*, ya
  // con el usuario dentro del flujo de Google; lo que falle antes (falta el ID
  // de cliente, no carga el script) sale por el rechazo de la promesa, porque
  // entonces no hay botón que enseñar.
  async function renderGoogleButton(el, onError){
    const c = init();
    if(!c) throw new Error('Supabase no está configurado.');
    if(!config().GOOGLE_CLIENT_ID) throw new Error('falta-client-id');
    // crypto.subtle solo existe en contexto seguro: https o localhost.
    if(!window.crypto || !crypto.subtle) throw new Error('sin-contexto-seguro');
    await whenGoogleReady();

    const nonce = randomNonce();
    const hashed = await sha256Hex(nonce);

    window.google.accounts.id.initialize({
      client_id: config().GOOGLE_CLIENT_ID,
      nonce: hashed,
      callback: async (respuesta) => {
        try{
          const { error } = await c.auth.signInWithIdToken({
            provider: 'google',
            token: respuesta.credential,
            nonce: nonce
          });
          if(error) throw error;
          // La sesión entra por onAuthChange, igual que con el correo.
        }catch(e){ if(onError) onError(e); }
      }
    });

    el.innerHTML = '';
    window.google.accounts.id.renderButton(el, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'signin_with',
      shape: 'rectangular',
      locale: 'es',
      // Google solo acepta anchos entre 200 y 400.
      width: Math.max(200, Math.min(400, el.clientWidth || 320))
    });
  }

  // Entrar con Google dentro de la app de Android o iOS.
  //
  // Google no deja usar su flujo web dentro de un WebView embebido, así que
  // allí el id_token lo pide el sistema operativo (ver js/native.js). Lo que
  // viene después es exactamente lo mismo que en la web: el token se cambia por
  // una sesión de Supabase. Va sin nonce a propósito, y el motivo está contado
  // en native.js, donde se pide el token.
  async function signInWithGoogleNative(){
    const c = init();
    if(!c) throw new Error('Supabase no está configurado.');
    if(!window.Native || !Native.isNative()) throw new Error('sin-plataforma-nativa');
    const token = await Native.googleIdToken();
    if(!token) throw new Error('google-sin-token');
    const { error } = await c.auth.signInWithIdToken({ provider:'google', token });
    if(error) throw error;
    // La sesión entra por onAuthChange, igual que con el correo.
  }

  async function signInWithPassword(email, password){
    const c = init();
    if(!c) throw new Error('Supabase no está configurado.');
    const { data, error } = await c.auth.signInWithPassword({ email, password });
    if(error) throw error;
    return data.user;
  }

  async function signUpWithPassword(email, password){
    const c = init();
    if(!c) throw new Error('Supabase no está configurado.');
    const { data, error } = await c.auth.signUp({
      email, password,
      options: { emailRedirectTo: window.location.origin + window.location.pathname }
    });
    if(error) throw error;
    // Si el proyecto exige confirmar el correo, todavía no hay sesión.
    return { user: data.user, needsConfirmation: !data.session };
  }

  async function signOut(){
    const c = init();
    if(c) await c.auth.signOut();
    // En la app hay además una sesión de Google en el propio sistema: si no se
    // cierra, el siguiente "entrar con Google" vuelve a entrar con la misma
    // cuenta sin preguntar, y no hay forma de cambiar de usuario.
    if(window.Native && Native.isNative()) await Native.googleSignOut();
  }

  // ---------------------------------------------------- borrar la cuenta
  //
  // Borrar la cuenta entera no lo puede hacer el navegador: la clave anon no
  // llega a auth.users, y con RLS solo se pueden tocar las filas propias, no
  // borrar al usuario. Lo hace una Edge Function con la clave de servicio
  // (supabase/functions/borrar-cuenta), que además de las cinco tablas borra la
  // fila de auth.users. Aquí solo se la llama: invoke() le manda el token de la
  // sesión y es ella quien saca de él de quién es la cuenta, para que nadie
  // pueda pedir que se borre otra.
  async function deleteAccount(){
    const c = init();
    if(!c) throw new Error('Supabase no está configurado.');
    const { data, error } = await c.functions.invoke('borrar-cuenta', { method:'POST' });
    if(error){
      // "Failed to send a request to the Edge Function" quiere decir que el
      // fetch no llegó a tener respuesta, y eso casi siempre es que la función
      // no está desplegada en el proyecto. La pantalla no puede decir esto
      // —quien la lee no es quien despliega—, así que va a la consola.
      const m = (error.message || '').toLowerCase();
      if(m.includes('edge function')){
        console.warn('borrar-cuenta no responde. ¿Está desplegada? Ver docs/supabase.md, paso 5.', error);
      }
      throw error;
    }
    return data;
  }

  // ------------------------------------------------------- sincronización

  // Trae lo que haya cambiado en el servidor desde la última vez. El corte se
  // hace por server_at (hora del servidor) y no por updated_at (hora del
  // móvil), para que un reloj desajustado no deje filas sin traer.
  async function pull(cursors){
    const c = init();
    if(!c) throw new Error('Supabase no está configurado.');
    const out = { rows:{}, cursors: Object.assign({}, cursors) };
    for(const table of TABLES){
      const rows = [];
      let since = (cursors && cursors[table]) || '1970-01-01T00:00:00Z';
      for(;;){
        const { data, error } = await c.from(table)
          .select('*')
          .gt('server_at', since)
          .order('server_at', { ascending: true })
          .limit(PAGE);
        if(error) throw error;
        rows.push.apply(rows, data);
        if(data.length < PAGE) break;
        since = data[data.length - 1].server_at;  // siguiente página
      }
      out.rows[table] = rows;
      // El corte nuevo sale de las propias filas, nunca del reloj local.
      if(rows.length) out.cursors[table] = rows[rows.length - 1].server_at;
    }
    return out;
  }

  // Sube operaciones pendientes. Todas son upsert: un borrado es una fila con
  // deleted_at puesto, así que subirla dos veces da el mismo resultado.
  async function push(opsByTable){
    const c = init();
    if(!c) throw new Error('Supabase no está configurado.');
    for(const table of TABLES){
      const rows = opsByTable[table];
      if(!rows || !rows.length) continue;
      const { error } = await c.from(table).upsert(rows, { onConflict: 'id' });
      if(error) throw error;
    }
  }

  return {
    TABLES, init, isConfigured, currentUser, onAuthChange, cleanAuthUrl,
    renderGoogleButton, signInWithGoogleNative,
    signInWithPassword, signUpWithPassword, signOut, deleteAccount,
    pull, push
  };
})();
