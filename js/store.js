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

  // La lista vive en db.js y aquí solo se consume. Tenerla escrita dos veces
  // era duplicación silenciosa: añadir una tabla y olvidarse de este sitio no
  // daba ningún error, simplemente esa tabla no se sincronizaba. db.js es quien
  // habla con Supabase y quien sabe en qué orden hay que subirlas, así que la
  // lista es suya. El orden de carga lo fija index.html (db.js antes que este
  // archivo), y test/archivos.js vigila que las tres listas no se separen.
  const TABLES = DB.TABLES;

  let userId = null;
  let cache = empty();
  let queue = [];          // [{seq, table, id, row}] — siempre upserts
  let seq = 0;
  let syncing = false;
  let lastError = null;
  let listeners = [];

  function empty(){
    // Se construye desde TABLES para que añadir una tabla sea de verdad un solo
    // sitio. Los cursores van aparte: no son una tabla, son por dónde iba pull().
    const c = { cursors:{} };
    for(const t of TABLES) c[t] = {};
    return c;
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

  // Con diferido=true se escribe en el espejo y se encola, pero no se vuelca ni
  // se avisa a nadie: lo hace quien manda, al terminar. Es para los borrados en
  // cascada, donde volcar la caché entera una vez por tiro deja el móvil
  // pensando varios segundos en un partido con doscientas anotaciones.
  function write(table, row, diferido){
    row.user_id = userId;
    row.updated_at = now();
    cache[table][row.id] = row;
    enqueue(table, row);
    if(diferido) return row;
    persist();
    notify();
    sync();               // sin await: la pantalla no espera a la red
    return row;
  }

  function softDelete(table, id, diferido){
    const row = cache[table][id];
    if(!row) return;
    row.deleted_at = now();
    write(table, row, diferido);
  }

  // El cierre de una tanda diferida.
  function flush(){
    persist();
    notify();
    sync();
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

  // Un número que llega de Postgres puede venir como texto (numeric) o como
  // null; todo lo que no sea un número de verdad vale más como null que como 0,
  // que en un minuto o una zona significaría otra cosa.
  function num(v){
    return v === null || v === undefined || v === '' ? null : Number(v);
  }

  function shotToApp(r){
    return {
      id: r.id,
      zone: num(r.zone),
      type: r.result,
      player: r.player_id || null,
      // Los partidos viejos guardaban el portero en player_id, y solo en las
      // paradas. Se leen los dos sitios para que sigan contando.
      keeper: r.goalkeeper_id || (r.side === 'own' ? (r.player_id || null) : null),
      minute: num(r.minute),
      period: num(r.period),
      ordinal: r.ordinal || 0,
      origin: r.origin_x === null || r.origin_x === undefined
        ? null
        : { x: Number(r.origin_x), y: Number(r.origin_y) }
    };
  }

  function eventToApp(r){
    return {
      id: r.id,
      type: r.type,
      player: r.player_id || null,
      minute: num(r.minute),
      period: num(r.period),
      ordinal: r.ordinal || 0
    };
  }

  // A puerta (gol o parada) y fuera (palo o fuera) se separan al leer: las
  // pantallas de estadística tratan unos y otros de forma distinta, y así
  // shotsOwn/shotsRival siguen significando lo mismo que siempre.
  const ON_TARGET = { goal:true, save:true };

  function matches(teamId){
    const shotsByMatch = {}, eventsByMatch = {};
    Object.values(cache.shots).forEach(s => {
      if(!alive(s)) return;
      (shotsByMatch[s.match_id] = shotsByMatch[s.match_id] || []).push(s);
    });
    Object.values(cache.events).forEach(e => {
      if(!alive(e)) return;
      (eventsByMatch[e.match_id] = eventsByMatch[e.match_id] || []).push(e);
    });
    return Object.values(cache.matches)
      .filter(m => m.team_id === teamId && alive(m))
      .map(m => {
        const shots = (shotsByMatch[m.id] || []).sort((a,b) => a.ordinal - b.ordinal);
        const side = (s, want) => shots
          .filter(s2 => s2.side === s && Boolean(ON_TARGET[s2.result]) === want)
          .map(shotToApp);
        const missOwn = side('own', false), missRival = side('rival', false);
        return {
          id: m.id,
          rival: m.rival,
          date: m.played_on,
          halfTime: num(m.half_time_minute),
          // out_own/out_rival son de los partidos de la primera versión, cuando
          // un tiro fuera era solo un contador. Los nuevos son filas de shots.
          outOwn: (m.out_own || 0) + missOwn.length,
          outRival: (m.out_rival || 0) + missRival.length,
          shotsOwn:   side('own', true),
          shotsRival: side('rival', true),
          missOwn, missRival,
          events: (eventsByMatch[m.id] || []).sort((a,b) => a.ordinal - b.ordinal).map(eventToApp)
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

  // Corregir un jugador ya dado de alta. Se cambia la fila y no se borra para
  // crear otra: el id es el que llevan dentro todos sus tiros y sus eventos, así
  // que rehacerlo le borraría el historial. Es lo que promete la política de
  // privacidad en el derecho de rectificación.
  function updatePlayer(playerId, patch){
    const row = cache.players[playerId];
    if(!row) return;
    if(patch.name !== undefined) row.name = patch.name;
    if(patch.dorsal !== undefined) row.dorsal = patch.dorsal;
    if(patch.position !== undefined) row.position = patch.position;
    write('players', row);
  }

  function deletePlayer(playerId){ softDelete('players', playerId); }

  // Borrar un equipo se lleva por delante su plantilla, sus partidos y los
  // tiros y eventos de esos partidos. Es lo que promete la política de
  // privacidad, y hay que marcarlo fila a fila: el "on delete cascade" de
  // Postgres solo actúa en un borrado físico, y aquí nunca se borra así. Una
  // fila que se quedara sin marcar volvería al espejo de otro dispositivo en la
  // siguiente sincronización.
  function deleteTeam(teamId){
    const enElEquipo = {};
    Object.values(cache.matches).forEach(m => {
      if(m.team_id === teamId) enElEquipo[m.id] = true;
    });
    const hijos = (tabla) => Object.values(cache[tabla])
      .filter(r => enElEquipo[r.match_id] && alive(r))
      .forEach(r => softDelete(tabla, r.id, true));
    hijos('shots');
    hijos('events');
    Object.keys(enElEquipo).forEach(id => softDelete('matches', id, true));
    Object.values(cache.players)
      .filter(p => p.team_id === teamId && alive(p))
      .forEach(p => softDelete('players', p.id, true));
    softDelete('teams', teamId, true);
    flush();
  }

  // Un partido terminado se convierte en su fila, una por tiro y una por evento.
  // El ordinal de cada anotación viene del borrador y es único dentro del
  // partido entre tiros y eventos: es lo que permite reconstruir después quién
  // estaba en pista en cada momento.
  function saveMatch(teamId, draft){
    const matchId = uuid();
    write('matches', {
      id: matchId, team_id: teamId,
      rival: draft.rival, played_on: draft.date,
      half_time_minute: draft.halfTime === undefined ? null : draft.halfTime,
      // Los contadores sueltos solo los usa la importación de la versión vieja:
      // lo que se anota ahora es una fila de tiro con su minuto y su jugador.
      out_own: draft.outOwn || 0, out_rival: draft.outRival || 0,
      deleted_at: null
    });
    let fallback = 0;
    const shotRow = (side, s) => ({
      id: uuid(), match_id: matchId,
      side, zone: s.zone === undefined ? null : s.zone, result: s.type,
      player_id: s.player || null,
      goalkeeper_id: side === 'own' ? (s.keeper || null) : null,
      minute: s.minute === undefined ? null : s.minute,
      period: s.period === undefined ? null : s.period,
      origin_x: s.origin ? s.origin.x : null,
      origin_y: s.origin ? s.origin.y : null,
      ordinal: s.ordinal === undefined ? fallback++ : s.ordinal,
      deleted_at: null
    });
    const push = (side, shots) => (shots || []).forEach(s => write('shots', shotRow(side, s)));
    push('own', draft.shotsOwn);
    push('rival', draft.shotsRival);
    push('own', draft.missOwn);
    push('rival', draft.missRival);
    (draft.events || []).forEach(e => write('events', {
      id: uuid(), match_id: matchId,
      type: e.type, player_id: e.player || null,
      minute: e.minute === undefined ? null : e.minute,
      period: e.period === undefined ? null : e.period,
      ordinal: e.ordinal === undefined ? fallback++ : e.ordinal,
      deleted_at: null
    }));
    return matchId;
  }

  // Corregir un partido ya guardado: el rival y la fecha, que son lo que se
  // escribe con prisa antes de empezar, y el minuto del descanso, que se fija
  // con un botón en vivo y hasta aquí no había forma de tocar. null es un
  // partido sin descanso marcado, que no es lo mismo que el minuto 0.
  function updateMatch(matchId, patch){
    const row = cache.matches[matchId];
    if(!row) return;
    if(patch.rival !== undefined) row.rival = patch.rival;
    if(patch.date !== undefined) row.played_on = patch.date;
    if(patch.halfTime !== undefined) row.half_time_minute = patch.halfTime;
    write('matches', row);
  }

  // Borrar el partido basta con marcar su fila: sus tiros y sus eventos solo se
  // leen a través de él, y en la base cuelgan con "on delete cascade".
  function deleteMatch(matchId){ softDelete('matches', matchId); }

  // Corregir un partido guardado es borrar la anotación que sobra y, si hace
  // falta, volver a anotarla: los dos son borrados lógicos y se sincronizan
  // como cualquier otro cambio.
  function deleteShot(shotId){ softDelete('shots', shotId); }
  function deleteEvent(eventId){ softDelete('events', eventId); }

  // ------------------------------------------------------ partido a medias
  //
  // El partido en curso no son filas todavía: es un borrador que solo se
  // convierte en datos al pulsar Guardar. Pero tiene que sobrevivir a que el
  // navegador descarte la pestaña, que es lo que hace un móvil cuando cambias
  // de aplicación en mitad de un partido. Va en su propia clave y nunca en la
  // cola de sincronización: no se sube nada hasta que se guarda.

  function draftKey(){ return 'hb:draft:' + userId; }

  function saveDraft(draft){
    if(!userId) return;
    try{
      if(draft) localStorage.setItem(draftKey(), JSON.stringify(draft));
      else localStorage.removeItem(draftKey());
    }catch(e){
      console.error('no se pudo guardar el partido en curso', e);
    }
  }

  function loadDraft(){
    if(!userId) return null;
    try{
      const raw = localStorage.getItem(draftKey());
      const d = raw ? JSON.parse(raw) : null;
      return d && d.rival ? d : null;
    }catch(e){ return null; }
  }

  function clearDraft(){ saveDraft(null); }

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
    if(!DB.isConfigured()) return;
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
    if(!DB.isConfigured()) return 'local';
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

  // No queda rastro de la cuenta en este aparato: el espejo, la cola, el partido
  // a medias y la marca de la migración. Lo llama el borrado de cuenta, y solo
  // después de que el servidor haya confirmado: al revés se perdería lo local
  // con la cuenta todavía viva.
  function wipeLocal(){
    if(!userId) return;
    try{
      localStorage.removeItem(cacheKey());
      localStorage.removeItem(queueKey());
      localStorage.removeItem(draftKey());
      localStorage.removeItem('hb:migrated:' + userId);
    }catch(e){
      console.error('no se pudo limpiar el navegador', e);
    }
    stop();
  }

  if(typeof window !== 'undefined'){
    window.addEventListener('online', () => sync());
    document.addEventListener('visibilitychange', () => {
      if(!document.hidden) sync();
    });
  }

  return {
    uuid, start, stop, wipeLocal, onChange, sync, status, pendingCount,
    teams, matches, createTeam, addPlayer, updatePlayer, deletePlayer, deleteTeam,
    saveMatch, updateMatch, deleteMatch, deleteShot, deleteEvent,
    saveDraft, loadDraft, clearDraft,
    hasLegacyData, importLegacy, skipLegacy
  };
})();
