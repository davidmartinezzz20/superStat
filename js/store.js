// Espejo local de los datos + cola de sincronización.
//
// La app nunca espera a la red: toda mutación se escribe primero aquí y se
// encola; el sincronizador vacía la cola cuando hay conexión. Por eso se puede
// registrar un partido entero en un pabellón sin cobertura.
//
// Tres reglas hacen que esto se pueda resolver sin sorpresas:
//  1. Los ids se generan en el navegador (UUID), así que subir un alta dos
//     veces es un upsert sobre el mismo id y no crea un duplicado.
//  2. Los borrados son lógicos (deleted_at). Con un borrado físico, al fusionar
//     no se distingue "lo borré en el móvil" de "aún no lo he subido", y lo
//     borrado reaparece.
//  3. Gana la escritura más reciente (updated_at), salvo que la fila esté
//     pendiente en la cola local: entonces gana lo local y no se pisa.
window.Store = (function(){

  const TABLES = ['teams','players','matches','shots'];

  let userId = null;
  let cache = empty();
  let queue = [];          // [{seq, table, id, row}] — siempre upserts
  let seq = 0;
  let syncing = false;
  let lastError = null;
  let listeners = [];

  function empty(){
    return { teams:{}, players:{}, matches:{}, shots:{}, cursors:{} };
  }

  function uuid(){
    if(window.crypto && crypto.randomUUID) return crypto.randomUUID();
    // Respaldo para navegadores viejos o contextos sin crypto.randomUUID
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random()*16|0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  function now(){ return new Date().toISOString(); }
  function alive(r){ return r && !r.deleted_at; }

  // ------------------------------------------------------ persistencia local

  function cacheKey(){ return 'hb:cache:' + userId; }
  function queueKey(){ return 'hb:queue:' + userId; }

  function persist(){
    try{
      localStorage.setItem(cacheKey(), JSON.stringify(cache));
      localStorage.setItem(queueKey(), JSON.stringify(queue));
    }catch(e){
      console.error('no se pudo guardar en el navegador', e);
    }
  }

  function load(){
    try{
      const c = localStorage.getItem(cacheKey());
      const q = localStorage.getItem(queueKey());
      cache = c ? JSON.parse(c) : empty();
      queue = q ? JSON.parse(q) : [];
      for(const t of TABLES) if(!cache[t]) cache[t] = {};
      if(!cache.cursors) cache.cursors = {};
      seq = queue.reduce((m, op) => Math.max(m, op.seq || 0), 0);
    }catch(e){
      cache = empty();
      queue = [];
    }
  }

  // ------------------------------------------------------------ suscripción

  function onChange(fn){ listeners.push(fn); }
  function notify(){ listeners.forEach(fn => { try{ fn(); }catch(e){} }); }

  // ----------------------------------------------------------- mutaciones

  function enqueue(table, row){
    // Una sola operación pendiente por fila: como son upserts de la fila
    // entera, la última sustituye a la anterior y la cola no crece sin freno.
    queue = queue.filter(op => !(op.table === table && op.id === row.id));
    queue.push({ seq: ++seq, table, id: row.id, row });
  }

  function write(table, row){
    row.user_id = userId;
    row.updated_at = now();
    cache[table][row.id] = row;
    enqueue(table, row);
    persist();
    notify();
    sync();               // sin await: la pantalla no espera a la red
    return row;
  }

  function softDelete(table, id){
    const row = cache[table][id];
    if(!row) return;
    row.deleted_at = now();
    write(table, row);
  }

  // --------------------------------------------------------------- lectura
  // Traduce las filas de la base al formato que ya usan las pantallas.

  function playersOf(teamId){
    return Object.values(cache.players)
      .filter(p => p.team_id === teamId && alive(p))
      .sort((a,b) => a.dorsal - b.dorsal)
      .map(p => ({ id:p.id, name:p.name, dorsal:p.dorsal, position:p.position }));
  }

  function teams(){
    return Object.values(cache.teams)
      .filter(alive)
      .sort((a,b) => (a.created_sort || '').localeCompare(b.created_sort || ''))
      .map(t => ({ id:t.id, name:t.name, players: playersOf(t.id) }));
  }

  function shotToApp(r){
    return {
      zone: r.zone,
      type: r.result,
      player: r.player_id || null,
      origin: r.origin_x === null || r.origin_x === undefined
        ? null
        : { x: Number(r.origin_x), y: Number(r.origin_y) }
    };
  }

  function matches(teamId){
    const byMatch = {};
    Object.values(cache.shots).forEach(s => {
      (byMatch[s.match_id] = byMatch[s.match_id] || []).push(s);
    });
    return Object.values(cache.matches)
      .filter(m => m.team_id === teamId && alive(m))
      .map(m => {
        const shots = (byMatch[m.id] || []).sort((a,b) => a.ordinal - b.ordinal);
        return {
          id: m.id,
          rival: m.rival,
          date: m.played_on,
          outOwn: m.out_own,
          outRival: m.out_rival,
          shotsOwn:   shots.filter(s => s.side === 'own').map(shotToApp),
          shotsRival: shots.filter(s => s.side === 'rival').map(shotToApp)
        };
      });
  }

  // ------------------------------------------------------------- escrituras

  function createTeam(name){
    const row = { id: uuid(), name, created_sort: now(), deleted_at: null };
    write('teams', row);
    return { id: row.id, name, players: [] };
  }

  function addPlayer(teamId, player){
    const row = {
      id: uuid(), team_id: teamId,
      name: player.name, dorsal: player.dorsal, position: player.position,
      deleted_at: null
    };
    write('players', row);
    return row.id;
  }

  function deletePlayer(playerId){ softDelete('players', playerId); }

  // Un partido terminado se convierte en su fila y en una fila por tiro.
  function saveMatch(teamId, draft){
    const matchId = uuid();
    write('matches', {
      id: matchId, team_id: teamId,
      rival: draft.rival, played_on: draft.date,
      out_own: draft.outOwn, out_rival: draft.outRival,
      deleted_at: null
    });
    let ordinal = 0;
    const push = (side, shots) => shots.forEach(s => {
      write('shots', {
        id: uuid(), match_id: matchId,
        side, zone: s.zone, result: s.type,
        player_id: s.player || null,
        origin_x: s.origin ? s.origin.x : null,
        origin_y: s.origin ? s.origin.y : null,
        ordinal: ordinal++
      });
    });
    push('own', draft.shotsOwn);
    push('rival', draft.shotsRival);
    return matchId;
  }

  // ---------------------------------------------------------- sincronización

  function groupQueue(upTo){
    const byTable = {};
    queue.filter(op => op.seq <= upTo).forEach(op => {
      // created_sort es solo para ordenar en la pantalla: no existe en la base.
      const row = Object.assign({}, op.row);
      delete row.created_sort;
      (byTable[op.table] = byTable[op.table] || []).push(row);
    });
    return byTable;
  }

  function merge(result){
    for(const table of TABLES){
      (result.rows[table] || []).forEach(row => {
        // Si la fila está pendiente de subir, lo local es más nuevo por
        // definición: no se pisa con lo que hay en el servidor.
        if(queue.some(op => op.table === table && op.id === row.id)) return;
        const mine = cache[table][row.id];
        if(mine && mine.updated_at && mine.updated_at > row.updated_at) return;
        cache[table][row.id] = Object.assign({}, mine, row);
      });
    }
    cache.cursors = result.cursors;
  }

  async function sync(){
    if(syncing || !userId) return;
    if(!window.DB || !DB.isConfigured()) return;
    if(typeof navigator !== 'undefined' && navigator.onLine === false) return;
    syncing = true;
    notify();
    try{
      if(queue.length){
        const upTo = queue[queue.length - 1].seq;
        await DB.push(groupQueue(upTo));
        // Solo se descarta lo que se subió: lo encolado durante la subida
        // lleva un seq mayor y se queda para la vuelta siguiente.
        queue = queue.filter(op => op.seq > upTo);
      }
      merge(await DB.pull(cache.cursors));
      lastError = null;
      persist();
    }catch(e){
      lastError = e;
      console.error('fallo al sincronizar', e);
    }finally{
      syncing = false;
      notify();
    }
  }

  function status(){
    if(!window.DB || !DB.isConfigured()) return 'local';
    if(typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline';
    if(syncing) return 'syncing';
    if(queue.length) return 'pending';
    if(lastError) return 'error';
    return 'synced';
  }

  function pendingCount(){ return queue.length; }

  // ------------------------------------------------------------- migración
  // Datos de la versión que guardaba todo en el navegador, sin cuentas reales.

  function legacyKeys(){
    const out = [];
    for(let i = 0; i < localStorage.length; i++){
      const k = localStorage.key(i);
      if(k && k.indexOf('hb:teams:') === 0) out.push(k);
    }
    return out;
  }

  function hasLegacyData(){
    if(localStorage.getItem('hb:migrated:' + userId)) return false;
    return legacyKeys().some(k => {
      try{ return (JSON.parse(localStorage.getItem(k)) || []).length > 0; }
      catch(e){ return false; }
    });
  }

  function importLegacy(){
    let imported = 0;
    legacyKeys().forEach(key => {
      const user = key.slice('hb:teams:'.length);
      let oldTeams = [];
      try{ oldTeams = JSON.parse(localStorage.getItem(key)) || []; }catch(e){ return; }
      oldTeams.forEach(t => {
        const team = createTeam(t.name);
        const playerMap = {};
        (t.players || []).forEach(p => {
          playerMap[p.id] = addPlayer(team.id, p);
        });
        let oldMatches = [];
        try{ oldMatches = JSON.parse(localStorage.getItem('hb:matches:'+user+':'+t.id)) || []; }
        catch(e){ oldMatches = []; }
        oldMatches.forEach(m => {
          // Los ids de jugador cambian al migrar; hay que reapuntarlos.
          const remap = shots => (shots || []).map(s => Object.assign({}, s, {
            player: s.player ? (playerMap[s.player] || null) : null
          }));
          saveMatch(team.id, {
            rival: m.rival, date: m.date,
            outOwn: m.outOwn || 0, outRival: m.outRival || 0,
            shotsOwn: remap(m.shotsOwn), shotsRival: remap(m.shotsRival)
          });
          imported++;
        });
      });
    });
    skipLegacy();
    return imported;
  }

  // Marcar como resuelto sin importar nada, para no volver a preguntar.
  function skipLegacy(){
    localStorage.setItem('hb:migrated:' + userId, now());
    // Contraseñas en claro de la versión anterior: ya no pintan nada aquí.
    localStorage.removeItem('hb:users');
  }

  // ------------------------------------------------------------------ ciclo

  async function start(id){
    userId = id;
    load();
    notify();
    await sync();
  }

  function stop(){
    userId = null;
    cache = empty();
    queue = [];
    lastError = null;
  }

  if(typeof window !== 'undefined'){
    window.addEventListener('online', () => sync());
    document.addEventListener('visibilitychange', () => {
      if(!document.hidden) sync();
    });
  }

  return {
    uuid, start, stop, onChange, sync, status, pendingCount,
    teams, matches, createTeam, addPlayer, deletePlayer, saveMatch,
    hasLegacyData, importLegacy, skipLegacy
  };
})();
