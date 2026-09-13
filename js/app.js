(function(){

  // ---------- state ----------
  let state = {
    screen: 'loading',
    user: null,
    teams: [],
    currentTeamId: null,
    matches: [],
    currentMatchId: null,
    draft: null,
    authMode: 'login',
    authError: '',
    formError: '',
    pendingShot: null
  };

  const POSITIONS = ['Portero','Lateral izquierdo','Central','Lateral derecho','Extremo izquierdo','Extremo derecho','Pivote'];

  // Zonas de la pista desde las que se puede lanzar. col/row son la posición
  // en la cuadrícula de 5x3 con la que se dibuja la media pista en el modal:
  // los extremos ocupan las bandas enteras, y de arriba abajo se va desde los
  // 9 m (laterales y central) hasta la línea de 6 m (pivote), pegada a portería.
  const ORIGINS = [
    { id:'EI',  name:'Extremo izquierdo', short:'EI',     col:'1',        row:'1 / span 3' },
    { id:'LI',  name:'Lateral izquierdo', short:'LI',     col:'2',        row:'1' },
    { id:'CE',  name:'Central',           short:'CE',     col:'3',        row:'1' },
    { id:'LD',  name:'Lateral derecho',   short:'LD',     col:'4',        row:'1' },
    { id:'ED',  name:'Extremo derecho',   short:'ED',     col:'5',        row:'1 / span 3' },
    { id:'7M',  name:'7 metros',          short:'7 m',    col:'2 / span 3', row:'2' },
    { id:'PIV', name:'Pivote',            short:'Pivote', col:'2 / span 3', row:'3' }
  ];

  function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
  function esc(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  // ---------- storage helpers (browser localStorage) ----------
  async function getVal(key, fallback){
    try{
      const raw = localStorage.getItem(key);
      return raw !== null ? JSON.parse(raw) : fallback;
    }catch(e){
      return fallback;
    }
  }
  async function setVal(key, value){
    try{
      localStorage.setItem(key, JSON.stringify(value));
    }catch(e){
      console.error('storage error', e);
    }
  }

  function usersKey(){ return 'hb:users'; }
  function teamsKey(user){ return 'hb:teams:'+user; }
  function matchesKey(user, teamId){ return 'hb:matches:'+user+':'+teamId; }

  // ---------- toast ----------
  function toast(msg){
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(()=>t.remove(), 2200);
  }

  // ---------- render root ----------
  function render(){
    const app = document.getElementById('app');
    let html = '';
    if(state.screen === 'auth') html = renderAuth();
    else if(state.screen === 'dashboard') html = renderDashboard();
    else if(state.screen === 'team') html = renderTeam();
    else if(state.screen === 'matchList') html = renderMatchList();
    else if(state.screen === 'matchDetail') html = renderMatchDetail();
    else if(state.screen === 'newMatchSetup') html = renderNewMatchSetup();
    else if(state.screen === 'liveMatch') html = renderLiveMatch();
    else html = '<div class="loading-msg">Cargando…</div>';
    app.className = 'screen-' + state.screen; // el partido en vivo necesita más ancho
    app.innerHTML = html;
    attachHandlers();
  }

  // ---------- AUTH ----------
  function renderAuth(){
    const isLogin = state.authMode === 'login';
    return `
      <header class="topbar">
        <div class="title">🤾 SuperStat</div>
      </header>
      <main>
        <div class="field" style="margin-bottom:26px;">
          <p style="color:var(--muted);font-size:13.5px;line-height:1.5;margin:0;">
            Estadísticas de partidos de balonmano, equipo a equipo, tiro a tiro.
          </p>
        </div>
        <h2 style="font-size:19px;margin-bottom:16px;">${isLogin ? 'Entrar' : 'Crear cuenta'}</h2>
        <div class="field">
          <label for="auth-user">Usuario</label>
          <input id="auth-user" type="text" autocomplete="username" placeholder="tu_usuario">
        </div>
        <div class="field">
          <label for="auth-pass">Contraseña</label>
          <input id="auth-pass" type="password" autocomplete="${isLogin ? 'current-password' : 'new-password'}" placeholder="••••••••">
        </div>
        ${state.authError ? `<div class="error-msg">${esc(state.authError)}</div>` : ''}
        <button class="primary" id="auth-submit">${isLogin ? 'Entrar' : 'Crear cuenta'}</button>
        <div style="text-align:center;margin-top:14px;">
          <button class="link-btn" id="auth-toggle">${isLogin ? '¿No tienes cuenta? Crea una' : '¿Ya tienes cuenta? Entra'}</button>
        </div>
      </main>
      <footer class="note">Los datos se guardan solo en tu cuenta, sin cifrado adicional.</footer>
    `;
  }

  async function handleAuthSubmit(){
    const user = document.getElementById('auth-user').value.trim();
    const pass = document.getElementById('auth-pass').value;
    if(!user || !pass){ state.authError = 'Escribe usuario y contraseña.'; render(); return; }
    const users = await getVal(usersKey(), {});
    if(state.authMode === 'login'){
      if(!users[user] || users[user] !== pass){
        state.authError = 'Usuario o contraseña incorrectos.';
        render();
        return;
      }
    } else {
      if(users[user]){
        state.authError = 'Ese usuario ya existe.';
        render();
        return;
      }
      users[user] = pass;
      await setVal(usersKey(), users);
    }
    state.authError = '';
    state.user = user;
    state.teams = await getVal(teamsKey(user), []);
    state.screen = 'dashboard';
    render();
  }

  // ---------- DASHBOARD ----------
  function renderDashboard(){
    const teamsHtml = state.teams.length ? state.teams.map(t => `
      <div class="card clickable" data-team="${t.id}">
        <div class="card-title">${esc(t.name)}</div>
        <div class="card-sub">${t.players.length} jugador${t.players.length===1?'':'es'}</div>
      </div>
    `).join('') : `
      <div class="empty-state">
        <div class="big-num">Aún no tienes ningún equipo</div>
        Crea tu primer equipo para empezar a registrar partidos.
      </div>
    `;
    return `
      <header class="topbar">
        <div class="title">🤾 SuperStat <small>${esc(state.user)}</small></div>
        <button class="back-btn" id="logout-btn">Salir</button>
      </header>
      <main>
        <div class="section-label">Tus equipos</div>
        ${teamsHtml}
        <div class="section-label">Nuevo equipo</div>
        <div class="field">
          <label for="new-team-name">Nombre del equipo</label>
          <input id="new-team-name" type="text" placeholder="Ej. CB Sabadell">
        </div>
        <button class="primary" id="create-team-btn">Crear equipo</button>
      </main>
    `;
  }

  async function handleCreateTeam(){
    const name = document.getElementById('new-team-name').value.trim();
    if(!name) return;
    const team = { id: uid(), name, players: [] };
    state.teams.push(team);
    await setVal(teamsKey(state.user), state.teams);
    state.currentTeamId = team.id;
    state.screen = 'team';
    render();
  }

  function currentTeam(){
    return state.teams.find(t => t.id === state.currentTeamId);
  }

  // ---------- TEAM / ROSTER ----------
  function renderTeam(){
    const team = currentTeam();
    const players = [...team.players].sort((a,b)=>a.dorsal-b.dorsal);
    const rows = players.length ? players.map(p => `
      <div class="player-row">
        <div class="dorsal-badge">${esc(p.dorsal)}</div>
        <div class="player-info">
          <div class="player-name">${esc(p.name)}</div>
          <div class="player-pos">${esc(p.position)}</div>
        </div>
        <button class="icon-btn" data-del-player="${p.id}" title="Eliminar">✕</button>
      </div>
    `).join('') : `<div class="empty-state" style="padding:20px 0;">Sin jugadores todavía.</div>`;

    return `
      <header class="topbar">
        <div class="title">${esc(team.name)}</div>
        <button class="back-btn" id="to-dashboard">Equipos</button>
      </header>
      <main>
        <div class="section-label">Plantilla</div>
        <div class="card">${rows}</div>

        <div class="row">
          <div class="field" style="flex:2;">
            <label for="p-name">Nombre</label>
            <input id="p-name" type="text" placeholder="Nombre del jugador">
          </div>
          <div class="field" style="flex:1;">
            <label for="p-dorsal">Dorsal</label>
            <input id="p-dorsal" type="number" min="0" max="99" placeholder="7">
          </div>
        </div>
        <div class="field">
          <label for="p-pos">Posición</label>
          <select id="p-pos">
            ${POSITIONS.map(p=>`<option value="${p}">${p}</option>`).join('')}
          </select>
        </div>
        ${state.formError ? `<div class="error-msg">${esc(state.formError)}</div>` : ''}
        <button class="secondary" id="add-player-btn">Añadir jugador</button>

        <div class="section-label">Partidos</div>
        <button class="primary" id="new-match-btn">＋ Nuevo partido</button>
        <div style="height:10px;"></div>
        <button class="secondary" id="view-matches-btn">Ver estadísticas de partidos anteriores</button>
      </main>
    `;
  }

  async function handleAddPlayer(){
    const name = document.getElementById('p-name').value.trim();
    const dorsalRaw = document.getElementById('p-dorsal').value;
    const position = document.getElementById('p-pos').value;
    if(!name || dorsalRaw === ''){
      state.formError = 'Escribe nombre y dorsal.';
      render();
      return;
    }
    const team = currentTeam();
    team.players.push({ id: uid(), name, dorsal: parseInt(dorsalRaw,10), position });
    state.formError = '';
    await setVal(teamsKey(state.user), state.teams);
    render();
  }

  async function handleDeletePlayer(id){
    const team = currentTeam();
    team.players = team.players.filter(p => p.id !== id);
    await setVal(teamsKey(state.user), state.teams);
    render();
  }

  // ---------- MATCH LIST ----------
  function renderMatchList(){
    const team = currentTeam();
    const list = [...state.matches].sort((a,b)=> b.date.localeCompare(a.date));
    const rows = list.length ? list.map(m => {
      const gf = m.shotsRival.filter(s=>s.type==='goal').length;
      const ga = m.shotsOwn.filter(s=>s.type==='goal').length;
      return `
        <div class="card clickable" data-match="${m.id}">
          <div class="card-title">${esc(team.name)} ${gf} — ${ga} ${esc(m.rival)}</div>
          <div class="card-sub">${esc(m.date)}</div>
        </div>
      `;
    }).join('') : `<div class="empty-state">Todavía no hay partidos guardados.</div>`;

    return `
      <header class="topbar">
        <div class="title">Partidos</div>
        <button class="back-btn" id="to-team">${esc(team.name)}</button>
      </header>
      <main>
        <span class="team-pill">${esc(team.name)}</span>
        ${rows}
      </main>
    `;
  }

  // ---------- MATCH DETAIL ----------
  function zoneCounts(shots){
    const counts = {};
    for(let z=1; z<=9; z++) counts[z] = {goal:0, save:0};
    shots.forEach(s => {
      if(s.zone && counts[s.zone]) counts[s.zone][s.type]++;
    });
    return counts;
  }

  function miniGrid(shots){
    const c = zoneCounts(shots);
    let html = '<div class="mini-grid">';
    for(let z=1; z<=9; z++){
      html += `<div class="mini-cell">
        <div class="n" style="color:var(--goal)">${c[z].goal}G</div>
        <div class="n" style="color:var(--save)">${c[z].save}P</div>
      </div>`;
    }
    html += '</div>';
    return html;
  }

  function groupByPlayer(shots, type){
    const map = {};
    shots.filter(s => s.type === type).forEach(s => {
      const key = s.player || 'none';
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map).sort((a,b) => b[1]-a[1]);
  }

  function playerLabel(team, id){
    if(id === 'none') return 'Sin especificar';
    const p = team.players.find(pp => pp.id === id);
    return p ? `${p.dorsal} · ${p.name}` : 'Sin especificar';
  }

  // Tiros agrupados por la zona de la pista desde la que se lanzó. Los partidos
  // guardados antes de registrar la zona caen todos en "Sin especificar".
  function originStatsHtml(shots){
    const rows = ORIGINS.map(o => {
      const arr = shots.filter(s => s.origin === o.id);
      if(arr.length === 0) return '';
      const goals = arr.filter(s => s.type === 'goal').length;
      const pct = Math.round(goals/arr.length*100);
      return `
        <div class="stat-list-row">
          <span>${esc(o.name)}</span>
          <span class="count">${goals}/${arr.length} · ${pct}%</span>
        </div>
      `;
    }).filter(Boolean);
    const unknown = shots.filter(s => !s.origin).length;
    if(unknown){
      rows.push(`
        <div class="stat-list-row">
          <span>Sin especificar</span>
          <span class="count">${unknown} tiros</span>
        </div>
      `);
    }
    if(rows.length === 0) return `<div class="hint-text">Sin datos todavía.</div>`;
    return rows.join('');
  }

  function playerListHtml(team, entries, unit){
    if(entries.length === 0) return `<div class="hint-text">Sin datos todavía.</div>`;
    return entries.map(([id, count]) => `
      <div class="stat-list-row">
        <span>${esc(playerLabel(team, id))}</span>
        <span class="count">${count} ${unit}</span>
      </div>
    `).join('');
  }

  function renderMatchDetail(){
    const team = currentTeam();
    const m = state.matches.find(mm => mm.id === state.currentMatchId);
    const gf = m.shotsRival.filter(s=>s.type==='goal').length;
    const sv_r = m.shotsRival.filter(s=>s.type==='save').length;
    const out_r = m.outRival;
    const ga = m.shotsOwn.filter(s=>s.type==='goal').length;
    const sv_o = m.shotsOwn.filter(s=>s.type==='save').length;
    const out_o = m.outOwn;
    const totalOwnShots = ga + sv_o + out_o;
    const totalRivalShots = gf + sv_r + out_r;
    const effR = totalRivalShots ? Math.round(gf/totalRivalShots*100) : 0;
    const effO = totalOwnShots ? Math.round((sv_o/totalOwnShots)*100) : 0;

    return `
      <header class="topbar">
        <div class="title">${esc(m.rival)}</div>
        <button class="back-btn" id="to-matches">Partidos</button>
      </header>
      <main>
        <div class="card" style="text-align:center;">
          <div style="font-size:12px;color:var(--muted);margin-bottom:6px;">${esc(m.date)}</div>
          <div style="font-family:'Oswald',sans-serif;font-size:32px;font-weight:700;">
            ${gf} — ${ga}
          </div>
          <div style="font-size:12.5px;color:var(--muted);margin-top:4px;">${esc(team.name)} vs ${esc(m.rival)}</div>
        </div>

        <div class="section-label">Nuestros disparos (portería rival)</div>
        <div class="stat-grid">
          <div class="stat-cell"><div class="num" style="color:var(--goal)">${gf}</div><div class="lbl">Goles</div></div>
          <div class="stat-cell"><div class="num" style="color:var(--save)">${sv_r}</div><div class="lbl">Parados por el rival</div></div>
          <div class="stat-cell"><div class="num" style="color:var(--out)">${out_r}</div><div class="lbl">Fuera</div></div>
          <div class="stat-cell"><div class="num">${effR}%</div><div class="lbl">Efectividad</div></div>
        </div>
        ${miniGrid(m.shotsRival)}

        <div class="section-label">Goleadores del partido</div>
        <div class="card">${playerListHtml(team, groupByPlayer(m.shotsRival, 'goal'), 'goles')}</div>

        <div class="section-label">Desde dónde lanzamos <small>goles / tiros a puerta</small></div>
        <div class="card">${originStatsHtml(m.shotsRival)}</div>

        <div class="section-label">Disparos rivales (portería propia)</div>
        <div class="stat-grid">
          <div class="stat-cell"><div class="num" style="color:var(--out)">${ga}</div><div class="lbl">Goles encajados</div></div>
          <div class="stat-cell"><div class="num" style="color:var(--save)">${sv_o}</div><div class="lbl">Paradas de tu portero</div></div>
          <div class="stat-cell"><div class="num">${out_o}</div><div class="lbl">Fuera del rival</div></div>
          <div class="stat-cell"><div class="num">${effO}%</div><div class="lbl">% Paradas portero</div></div>
        </div>
        ${miniGrid(m.shotsOwn)}

        <div class="section-label">Paradas por portero</div>
        <div class="card">${playerListHtml(team, groupByPlayer(m.shotsOwn, 'save'), 'paradas')}</div>

        <div class="section-label">Desde dónde nos lanzan <small>goles / tiros a puerta</small></div>
        <div class="card">${originStatsHtml(m.shotsOwn)}</div>
      </main>
    `;
  }

  // ---------- NEW MATCH SETUP ----------
  function renderNewMatchSetup(){
    const team = currentTeam();
    return `
      <header class="topbar">
        <div class="title">Nuevo partido</div>
        <button class="back-btn" id="to-team">Cancelar</button>
      </header>
      <main>
        <span class="team-pill">${esc(team.name)}</span>
        <div class="field">
          <label for="rival-name">Nombre del equipo rival</label>
          <input id="rival-name" type="text" placeholder="Ej. BM Granollers">
        </div>
        <div class="field">
          <label for="match-date">Fecha</label>
          <input id="match-date" type="date" value="${new Date().toISOString().slice(0,10)}">
        </div>
        ${state.formError ? `<div class="error-msg">${esc(state.formError)}</div>` : ''}
        <button class="primary" id="start-match-btn">Empezar a registrar tiros</button>
      </main>
    `;
  }

  async function handleStartMatch(){
    const rival = document.getElementById('rival-name').value.trim();
    const date = document.getElementById('match-date').value;
    if(!rival || !date){
      state.formError = 'Indica el rival y la fecha.';
      render();
      return;
    }
    state.formError = '';
    state.draft = {
      id: uid(),
      rival,
      date,
      shotsOwn: [],   // shots faced at OUR goal (rival shooting)
      shotsRival: [], // shots taken at RIVAL goal (our team shooting)
      outOwn: 0,
      outRival: 0,
      askOrigin: true, // preguntar desde qué zona de la pista se ha lanzado
      log: []  // ordered log of actions for undo: {side:'own'|'rival', kind:'shot'|'out', zone, type}
    };
    state.pendingShot = null;
    state.screen = 'liveMatch';
    render();
  }

  // ---------- LIVE MATCH ----------
  let clickTimers = {}; // per-cell timers for single/double click disambiguation

  function goalGridHtml(side, label, sub){
    const team = currentTeam();
    const shots = side === 'own' ? state.draft.shotsOwn : state.draft.shotsRival;
    const counts = zoneCounts(shots);
    let cells = '';
    for(let z=1; z<=9; z++){
      const c = counts[z];
      const chips = (c.goal ? `<span class="mark-chip goal">${c.goal}G</span>` : '') +
                    (c.save ? `<span class="mark-chip save">${c.save}P</span>` : '');
      cells += `<div class="goal-cell" data-side="${side}" data-zone="${z}"><div class="marks">${chips}</div></div>`;
    }
    const goals = shots.filter(s=>s.type==='goal').length;
    const saves = shots.filter(s=>s.type==='save').length;
    const outs = side === 'own' ? state.draft.outOwn : state.draft.outRival;
    return `
      <div class="goal-block">
        <div class="goal-header">
          <div class="goal-title">${esc(label)}</div>
          <div class="goal-sub">${esc(sub)}</div>
          <div class="goal-tally">${goals} G · ${saves} P · ${outs} fuera</div>
        </div>
        <div class="goal-wrap">
          <div class="goal-frame">
            <div class="goal-post top"></div>
            <div class="goal-post left"></div>
            <div class="goal-post right"></div>
            <div class="goal-net">
              <div class="goal-grid" data-grid="${side}">${cells}</div>
            </div>
          </div>
          <div class="goal-support left"></div>
          <div class="goal-support right"></div>
          <div class="goal-ground"></div>
        </div>
        <div class="goal-actions">
          <button class="btn-out" data-out="${side}">Tiro fuera</button>
          <button class="btn-undo" data-undo="${side}">Deshacer</button>
        </div>
      </div>
    `;
  }

  function candidatesFor(side, type){
    const team = currentTeam();
    if(side === 'rival' && type === 'goal'){
      return team.players.slice().sort((a,b)=>a.dorsal-b.dorsal);
    }
    if(side === 'own' && type === 'save'){
      return team.players.filter(p => p.position === 'Portero').sort((a,b)=>a.dorsal-b.dorsal);
    }
    return [];
  }

  function renderPlayerStep(p){
    let title = 'Selecciona jugador';
    if(p.side === 'rival' && p.type === 'goal') title = '¿Quién ha marcado?';
    if(p.side === 'own' && p.type === 'save') title = '¿Qué portero ha parado?';
    const btns = p.candidates.map(pl => `
      <button class="modal-player-btn" data-select-player="${pl.id}">
        <span class="dorsal-mini">${pl.dorsal}</span> ${esc(pl.name)}
      </button>
    `).join('');
    return `
      <div class="modal-title">${title}</div>
      ${btns}
      <button class="modal-skip-btn" id="skip-player-btn">Sin especificar</button>
    `;
  }

  // Media pista dibujada con una cuadrícula de 5x3: un toque en una zona
  // registra desde dónde se hizo el lanzamiento.
  function renderOriginStep(p){
    const team = currentTeam();
    const who = p.side === 'own' ? state.draft.rival : team.name;
    const zones = ORIGINS.map(o => `
      <button class="court-zone" data-select-origin="${o.id}"
              style="grid-column:${o.col};grid-row:${o.row};">${esc(o.short)}</button>
    `).join('');
    return `
      <div class="modal-title">¿Desde dónde ha lanzado?</div>
      <div class="modal-sub">Ataque de ${esc(who)} · izquierda y derecha vistas desde el ataque</div>
      <div class="court">${zones}</div>
      <div class="court-goal"></div>
      <div class="court-caption">Portería</div>
      <button class="modal-skip-btn" id="skip-origin-btn">Sin especificar</button>
    `;
  }

  function renderPendingModal(){
    const p = state.pendingShot;
    if(!p) return '';
    const body = p.steps[p.step] === 'player' ? renderPlayerStep(p) : renderOriginStep(p);
    return `
      <div class="modal-overlay" id="pending-modal">
        <div class="modal-box">
          ${body}
          <button class="modal-cancel-btn" id="cancel-shot-btn">Cancelar, no registrar</button>
        </div>
      </div>
    `;
  }

  function renderLiveMatch(){
    const team = currentTeam();
    const d = state.draft;
    const gf = d.shotsRival.filter(s=>s.type==='goal').length;
    const ga = d.shotsOwn.filter(s=>s.type==='goal').length;
    return `
      <header class="topbar">
        <div class="title">${esc(team.name)} vs ${esc(d.rival)}</div>
        <button class="back-btn" id="finish-match-btn">Guardar</button>
      </header>
      <main class="live-main">
        <div class="scoreboard">
          <div class="score-box"><div class="num" style="color:var(--goal)">${gf}</div><div class="lbl">${esc(team.name)}</div></div>
          <div class="score-box"><div class="num" style="color:var(--out)">${ga}</div><div class="lbl">${esc(d.rival)}</div></div>
        </div>

        <button class="origin-toggle ${d.askOrigin ? 'on' : ''}" id="toggle-origin">
          <span class="dot"></span>
          <span>Preguntar zona de lanzamiento</span>
        </button>

        <div class="goals-row">
          ${goalGridHtml('own', 'Nuestra portería', 'tira el rival')}
          ${goalGridHtml('rival', 'Portería rival', 'tiramos nosotros')}
        </div>
        <div class="hint-text center">1 toque = gol · 2 toques = parada</div>

        <button class="secondary" id="cancel-match-btn">Descartar partido</button>
      </main>
      ${renderPendingModal()}
    `;
  }

  // Un tiro puede necesitar preguntar el jugador, la zona de lanzamiento, las
  // dos cosas o ninguna: se monta la lista de pasos y se van recorriendo.
  function maybeAskPlayer(side, zone, type){
    const candidates = candidatesFor(side, type);
    const steps = [];
    if(candidates.length > 0) steps.push('player');
    if(state.draft.askOrigin) steps.push('origin');
    if(steps.length === 0){
      registerShot(side, zone, type, null, null);
      return;
    }
    state.pendingShot = { side, zone, type, candidates, player:null, origin:null, steps, step:0 };
    renderLiveMatchInPlace();
  }

  function advancePending(patch){
    const p = state.pendingShot;
    if(!p) return;
    Object.assign(p, patch);
    p.step++;
    if(p.step >= p.steps.length){
      registerShot(p.side, p.zone, p.type, p.player, p.origin);
    } else {
      renderLiveMatchInPlace();
    }
  }

  function registerShot(side, zone, type, playerId, origin){
    const d = state.draft;
    const entry = { zone, type, player: playerId || null, origin: origin || null };
    if(side === 'own') d.shotsOwn.push(entry); else d.shotsRival.push(entry);
    d.log.push({ side, kind:'shot' });
    state.pendingShot = null;
    renderLiveMatchInPlace();
  }

  function registerOut(side){
    const d = state.draft;
    if(side === 'own') d.outOwn++; else d.outRival++;
    d.log.push({ side, kind:'out' });
    renderLiveMatchInPlace();
  }

  function undoLast(side){
    const d = state.draft;
    for(let i = d.log.length - 1; i >= 0; i--){
      if(d.log[i].side === side){
        const action = d.log[i];
        if(action.kind === 'shot'){
          const arr = side === 'own' ? d.shotsOwn : d.shotsRival;
          arr.pop();
        } else {
          if(side === 'own') d.outOwn = Math.max(0, d.outOwn - 1);
          else d.outRival = Math.max(0, d.outRival - 1);
        }
        d.log.splice(i, 1);
        break;
      }
    }
    renderLiveMatchInPlace();
  }

  function flashCell(side, zone, type){
    const grid = document.querySelector(`[data-grid="${side}"]`);
    if(!grid) return;
    const cell = grid.querySelector(`[data-zone="${zone}"]`);
    if(!cell) return;
    const fl = document.createElement('div');
    fl.className = 'flash ' + type;
    fl.textContent = type === 'goal' ? 'GOL' : 'PARADA';
    cell.appendChild(fl);
    setTimeout(()=> fl.remove(), 500);
  }

  function renderLiveMatchInPlace(){
    // re-render only the live match main content to keep it snappy
    render();
  }

  async function handleFinishMatch(){
    const d = state.draft;
    const match = {
      id: d.id, rival: d.rival, date: d.date,
      shotsOwn: d.shotsOwn, shotsRival: d.shotsRival,
      outOwn: d.outOwn, outRival: d.outRival
    };
    state.matches.push(match);
    await setVal(matchesKey(state.user, state.currentTeamId), state.matches);
    state.draft = null;
    state.currentMatchId = match.id;
    toast('Partido guardado');
    state.screen = 'matchDetail';
    render();
  }

  // ---------- event wiring ----------
  function attachHandlers(){
    const app = document.getElementById('app');

    const bind = (id, ev, fn) => { const el = document.getElementById(id); if(el) el.addEventListener(ev, fn); };

    bind('auth-submit','click', handleAuthSubmit);
    bind('auth-toggle','click', () => { state.authMode = state.authMode === 'login' ? 'register' : 'login'; state.authError=''; render(); });
    bind('logout-btn','click', () => { state = {screen:'auth', user:null, teams:[], authMode:'login', authError:'', formError:''}; render(); });

    bind('create-team-btn','click', handleCreateTeam);
    app.querySelectorAll('[data-team]').forEach(el => {
      el.addEventListener('click', async () => {
        state.currentTeamId = el.getAttribute('data-team');
        state.formError = '';
        state.screen = 'team';
        render();
      });
    });

    bind('to-dashboard','click', () => { state.screen='dashboard'; state.formError=''; render(); });
    bind('add-player-btn','click', handleAddPlayer);
    app.querySelectorAll('[data-del-player]').forEach(el => {
      el.addEventListener('click', () => handleDeletePlayer(el.getAttribute('data-del-player')));
    });
    bind('new-match-btn','click', () => { state.formError=''; state.screen='newMatchSetup'; render(); });
    bind('view-matches-btn','click', async () => {
      state.matches = await getVal(matchesKey(state.user, state.currentTeamId), []);
      state.screen = 'matchList';
      render();
    });

    bind('to-team','click', () => { state.screen='team'; render(); });
    app.querySelectorAll('[data-match]').forEach(el => {
      el.addEventListener('click', () => {
        state.currentMatchId = el.getAttribute('data-match');
        state.screen = 'matchDetail';
        render();
      });
    });
    bind('to-matches','click', () => { state.screen='matchList'; render(); });

    bind('start-match-btn','click', handleStartMatch);

    // goal grid cells: single click = goal, double click(within window) = save
    app.querySelectorAll('.goal-cell').forEach(cell => {
      cell.addEventListener('click', () => {
        const side = cell.getAttribute('data-side');
        const zone = parseInt(cell.getAttribute('data-zone'),10);
        const key = side + '-' + zone;
        if(clickTimers[key]){
          clearTimeout(clickTimers[key]);
          delete clickTimers[key];
          maybeAskPlayer(side, zone, 'save');
        } else {
          clickTimers[key] = setTimeout(() => {
            maybeAskPlayer(side, zone, 'goal');
            delete clickTimers[key];
          }, 260);
        }
      });
    });
    app.querySelectorAll('[data-out]').forEach(el => {
      el.addEventListener('click', () => registerOut(el.getAttribute('data-out')));
    });
    app.querySelectorAll('[data-undo]').forEach(el => {
      el.addEventListener('click', () => undoLast(el.getAttribute('data-undo')));
    });
    app.querySelectorAll('[data-select-player]').forEach(el => {
      el.addEventListener('click', () => advancePending({ player: el.getAttribute('data-select-player') }));
    });
    bind('skip-player-btn','click', () => advancePending({ player: null }));
    app.querySelectorAll('[data-select-origin]').forEach(el => {
      el.addEventListener('click', () => advancePending({ origin: el.getAttribute('data-select-origin') }));
    });
    bind('skip-origin-btn','click', () => advancePending({ origin: null }));
    bind('cancel-shot-btn','click', () => { state.pendingShot = null; render(); });

    bind('toggle-origin','click', () => {
      state.draft.askOrigin = !state.draft.askOrigin;
      render();
    });

    bind('finish-match-btn','click', handleFinishMatch);
    bind('cancel-match-btn','click', () => {
      if(confirm('¿Descartar este partido? Se perderán los tiros registrados.')){
        state.draft = null;
        state.screen = 'team';
        render();
      }
    });
  }

  // ---------- boot ----------
  (async function boot(){
    state.screen = 'auth';
    render();
  })();

})();
