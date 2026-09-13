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
    rows: { teams:{}, players:{}, matches:{}, shots:{} },
    clock: 0,
    users: {},
    session: null,
    pushes: 0
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
      let data = Object.values(SERVER.rows[this.table])
        .filter(r => !SERVER.session || r.user_id === SERVER.session.user.id)
        .filter(r => this.filters.every(f => f(r)))
        .sort((a,b) => a.server_at.localeCompare(b.server_at))
        .slice(0, this._limit);
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
        auth: {
          async getSession(){ return { data:{ session: SERVER.session }, error:null }; },
          onAuthStateChange(cb){ authListeners.push(cb); return { data:{ subscription:{ unsubscribe(){} } } }; },
          async signInWithOAuth(){
            try{ netCheck(); }catch(e){ return { error:e }; }
            // el OAuth real redirige; aquí se da la sesión por buena al vuelo
            SERVER.session = { user: { id:'user-google', email:'david@gmail.com',
                                       user_metadata:{ name:'David' } } };
            save(); emit('SIGNED_IN');
            return { error:null };
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
