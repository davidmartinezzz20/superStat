// Doble de @supabase/supabase-js para las pruebas: implementa solo lo que usa
// db.js, contra un "servidor" en memoria que vive en window.__SERVER__.
// Permite simular caída de red (window.__OFFLINE__) y ver qué llegó al servidor.
(function(){
  // El servidor de pruebas sobrevive a las recargas, como el de verdad.
  function restore(){
    try{
      const raw = sessionStorage.getItem('__server__');
      if(raw) return JSON.parse(raw);
    }catch(e){}
    return null;
  }
  const SERVER = window.__SERVER__ = restore() || window.__SERVER__ || {
    rows: { teams:{}, players:{}, matches:{}, shots:{}, events:{},
            // Las dos del plan. No se sincronizan —no están en DB.TABLES— y
            // aquí solo se leen, igual que en la base de verdad: quien las
            // escribe allí es el webhook de Stripe con la clave de servicio.
            subscriptions:{}, avisos:{} },
    clock: 0,
    users: {},
    session: null,
    pushes: 0,
    // Las llamadas a Edge Functions, en orden, para poder comprobar que el
    // aviso del tope se pide una vez y no una por render.
    invocaciones: []
  };
  function save(){
    try{ sessionStorage.setItem('__server__', JSON.stringify(SERVER)); }catch(e){}
  }

  function netCheck(){
    if(window.__OFFLINE__) throw new Error('Failed to fetch');
  }
  function stamp(){
    SERVER.clock++;
    return new Date(Date.UTC(2026,0,1,0,0,0) + SERVER.clock*1000).toISOString();
  }

  class Query {
    constructor(table){ this.table = table; this.filters = []; this._limit = 1000; }
    select(){ return this; }
    order(){ return this; }
    limit(n){ this._limit = n; return this; }
    gt(col, val){ this.filters.push(r => String(r[col]) > String(val)); return this; }
    eq(col, val){ this.filters.push(r => String(r[col]) === String(val)); return this; }
    // Una fila o ninguna, sin que "ninguna" sea un error. Es como se leen las
    // tablas del plan, que tienen el usuario como clave primaria.
    maybeSingle(){ this._single = true; return this; }
    // update() se encadena antes que los .eq(), así que no puede escribir aquí:
    // se guarda lo que hay que cambiar y se aplica al resolver, cuando ya están
    // todos los filtros puestos.
    update(patch){ this._update = patch; return this; }
    async upsert(rows){
      try{ netCheck(); }catch(e){ return { error:e }; }
      SERVER.pushes++;
      rows.forEach(r => {
        const row = Object.assign({}, r, { server_at: stamp() });
        SERVER.rows[this.table][row.id] = row;
      });
      save();
      return { error:null };
    }
    then(resolve, reject){
      try{ netCheck(); }catch(e){ return resolve({ data:null, error:e }); }
      // Una tabla que no existe se lee como vacía y no revienta: hay pruebas
      // que se construyen su propio servidor a mano y no nombran todas.
      let data = Object.values(SERVER.rows[this.table] || {})
        // El doble de RLS: solo se ve lo propio.
        .filter(r => !SERVER.session || r.user_id === SERVER.session.user.id)
        .filter(r => this.filters.every(f => f(r)))
        .sort((a,b) => String(a.server_at || '').localeCompare(String(b.server_at || '')))
        .slice(0, this._limit);

      if(this._update){
        data.forEach(r => Object.assign(r, this._update));
        save();
      }
      if(this._single) return resolve({ data: data[0] || null, error:null });
      return resolve({ data, error:null });
    }
  }

  const authListeners = [];
  function emit(event){
    authListeners.forEach(cb => cb(event, SERVER.session));
  }

  window.supabase = {
    createClient(){
      return {
        from(table){ return new Query(table); },
        // El doble de las Edge Functions. La de verdad (borrar-cuenta) corre en
        // Supabase con la clave de servicio; aquí se hace lo mismo sobre el
        // servidor de mentira, incluida la parte que importa: de quién es la
        // cuenta lo dice la sesión y no lo que mande quien llama.
        functions: {
          async invoke(nombre, opciones){
            try{ netCheck(); }catch(e){ return { data:null, error:e }; }
            SERVER.invocaciones.push(nombre);
            save();

            // Abrir el pago. La de verdad tampoco cobra: devuelve una dirección
            // de Stripe a la que la app manda el navegador.
            if(nombre === 'pago'){
              if(window.__SIN_PAGO__){
                return { data:null, error:new Error('Failed to send a request to the Edge Function') };
              }
              if(!SERVER.session) return { data:null, error:new Error('sin-sesion') };
              const cuerpo = (opciones && opciones.body) || {};
              return { data:{ url:'https://pago.de.mentira/' + (cuerpo.accion || 'suscribir') },
                       error:null };
            }

            // El aviso del tope. Aquí no se manda ningún correo; lo que importa
            // de esta función en las pruebas es que la app la llame, y que la
            // llame una sola vez.
            if(nombre === 'aviso-tope'){
              if(!SERVER.session) return { data:null, error:new Error('sin-sesion') };
              return { data:{ ok:true, enviado:true }, error:null };
            }

            // Sin desplegar, la función no existe y el navegador se queda sin
            // respuesta que leer: supabase-js lo da con este mensaje exacto, y
            // copiarlo es lo que permite probar cómo lo traduce la app.
            if(nombre !== 'borrar-cuenta' || window.__SIN_FUNCION__){
              return { data:null, error:new Error('Failed to send a request to the Edge Function') };
            }
            if(!SERVER.session) return { data:null, error:new Error('sin-sesion') };
            const uid = SERVER.session.user.id;
            // Borrado físico y no lógico, como la función de verdad: no queda
            // ningún dispositivo con el que reconciliar nada.
            Object.keys(SERVER.rows).forEach(tabla => {
              Object.values(SERVER.rows[tabla]).forEach(r => {
                if(r.user_id === uid) delete SERVER.rows[tabla][r.id];
              });
            });
            Object.keys(SERVER.users).forEach(correo => {
              if(SERVER.users[correo].id === uid) delete SERVER.users[correo];
            });
            save();
            return { data:{ ok:true }, error:null };
          }
        },
        auth: {
          async getSession(){ return { data:{ session: SERVER.session }, error:null }; },
          onAuthStateChange(cb){ authListeners.push(cb); return { data:{ subscription:{ unsubscribe(){} } } }; },
          async signInWithIdToken({ token, nonce }){
            try{ netCheck(); }catch(e){ return { data:null, error:e }; }
            // Supabase recibe el nonce sin resumir y comprueba que corresponde
            // al que se le dio a Google. Mandarle el mismo a los dos es el fallo
            // clásico de este flujo, así que aquí se rechaza igual que allí.
            const esperado = (window.__GOOGLE__ || {}).nonce;
            const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(nonce || ''));
            const hex = Array.from(new Uint8Array(buf), x => x.toString(16).padStart(2,'0')).join('');
            if(!esperado || hex !== esperado){
              return { data:null, error:new Error('Passed nonce and nonce in id_token should either both exist or not.') };
            }
            const payload = JSON.parse(atob(String(token).split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
            SERVER.session = { user: { id:'user-google', email:payload.email,
                                       user_metadata:{ name:payload.name } } };
            save(); emit('SIGNED_IN');
            return { data:{ user:SERVER.session.user, session:SERVER.session }, error:null };
          },
          async signInWithPassword({ email, password }){
            try{ netCheck(); }catch(e){ return { data:null, error:e }; }
            const u = SERVER.users[email];
            if(!u || u.password !== password){
              return { data:null, error:new Error('Invalid login credentials') };
            }
            SERVER.session = { user:{ id:u.id, email, user_metadata:{} } };
            save(); emit('SIGNED_IN');
            return { data:{ user:SERVER.session.user }, error:null };
          },
          async signUp({ email, password }){
            try{ netCheck(); }catch(e){ return { data:null, error:e }; }
            if(SERVER.users[email]) return { data:null, error:new Error('User already registered') };
            if(password.length < 6) return { data:null, error:new Error('Password should be at least 6 characters') };
            const id = 'user-' + Object.keys(SERVER.users).length;
            SERVER.users[email] = { id, password };
            SERVER.session = { user:{ id, email, user_metadata:{} } };
            save(); emit('SIGNED_IN');
            return { data:{ user:SERVER.session.user, session:SERVER.session }, error:null };
          },
          async signOut(){ SERVER.session = null; save(); emit('SIGNED_OUT'); return { error:null }; }
        }
      };
    }
  };
})();
