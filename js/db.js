// Capa de acceso a Supabase: sesión, autenticación y las dos operaciones de
// sincronización (traer cambios y subirlos). No sabe nada de pantallas ni de
// cómo se guardan los datos en el navegador; de eso se encarga store.js.
window.DB = (function(){

  // Orden de dependencias: un jugador necesita que su equipo exista antes, y un
  // tiro necesita su partido. Subir y aplicar siempre en este orden.
  const TABLES = ['teams','players','matches','shots'];
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

  async function signInWithGoogle(){
    const c = init();
    if(!c) throw new Error('Supabase no está configurado.');
    const { error } = await c.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + window.location.pathname }
    });
    if(error) throw error;
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
    signInWithGoogle, signInWithPassword, signUpWithPassword, signOut,
    pull, push
  };
})();
