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
    authNotice: '',
    authBusy: false,
    formError: '',
    pendingShot: null,
    pendingEvent: null,
    // Filtros del mapa de tiros de la ficha de partido. No se guardan: son una
    // forma de mirar los datos, no un dato.
    mapFilter: { player:'all', period:'all', heat:false },
    editingMatch: false,
    // Jugador que se está corrigiendo en la pantalla de equipo: con él puesto,
    // el formulario de alta de abajo pasa a ser el de edición.
    editingPlayerId: null,
    // Borrar la cuenta se pide dos veces: el botón abre la tarjeta y dentro hay
    // que escribir BORRAR. No se guarda nada de esto en ninguna parte.
    deletingAccount: false,
    deleteAccountError: '',
    deleteAccountBusy: false
  };

  // Atajo para los textos. Todo lo que se enseña sale de js/i18n.js: en las
  // plantillas de este archivo no debe quedar ni una palabra escrita a mano.
  const t = I18N.t;

  // Las posiciones **son un dato**, no un texto: se guardan así en la base y
  // keepersOf() compara con 'Portero'. La lista son ids en castellano y
  // positionName() es lo único que traduce, al pintarlos. Traducirlos como dato
  // partiría la plantilla en dos según el idioma que tuviera la app ese día.
  const POSITIONS = ['Portero','Lateral izquierdo','Central','Lateral derecho','Extremo izquierdo','Extremo derecho','Pivote'];
  const GOALKEEPER = 'Portero';

  function positionName(id){ return t('position.' + id); }

  // Los botones del registro rápido, en el orden en que salen en pantalla.
  // Quitar uno de aquí lo quita del panel y nada más: lo que ya estuviera
  // anotado con ese tipo se sigue guardando, leyendo y contando.
  //
  // El `id` es lo que viaja a la base y no cambia con el idioma; el nombre y el
  // código corto de la chapa salen del diccionario (PE/RO en español, TO/ST en
  // inglés), porque son texto y no dato.
  const EVENT_TYPES = [
    { id:'turnover',  tone:'bad'  },
    { id:'steal',     tone:'good' },
    { id:'exclusion', tone:'bad'  },
    { id:'yellow',    tone:'warn' },
    { id:'red',       tone:'bad'  }
  ];

  // Orden en el que se listan los tipos en las estadísticas. Tiene más entradas
  // que botones tiene el panel a propósito: la base acepta todas (ver el check
  // de `events` en schema.sql), así que un partido anotado con una versión
  // anterior de la app —o desde otro dispositivo que aún no se haya
  // actualizado— tiene que poder enseñarse con su nombre y no como un código.
  const EVENT_ORDER = ['turnover','steal','exclusion','yellow','red','assist','block','foul7m'];

  // Un tipo que no conozca ninguna de las dos listas se enseña con su propio
  // código antes que en blanco: la base acepta más de los que hay aquí.
  function eventName(id){
    return EVENT_ORDER.indexOf(id) === -1 && id !== 'in' && id !== 'out'
      ? id : t('event.' + id);
  }

  // Los tipos que de verdad aparecen en unos datos, en el orden de arriba. Se
  // recorre lo anotado y no la lista de botones, para que quitar un botón no
  // haga desaparecer de las estadísticas lo que ya se había anotado con él.
  function eventTypesIn(counts){
    const ids = Object.keys(counts).filter(id => id !== 'in' && id !== 'out');
    return ids.sort((a,b) => {
      const ia = EVENT_ORDER.indexOf(a), ib = EVENT_ORDER.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
  }

  // Balonmano: siete en pista. No se impide pasarse —hay que poder anotar lo que
  // de verdad pasó, incluida una alineación indebida— pero se avisa.
  const ON_COURT_MAX = 7;

  // ---------- media pista ----------
  // Medidas reales de balonmano en metros. La media pista se dibuja de banda a
  // banda (20 m) y sólo hasta DEPTH metros de la portería: más allá no se lanza
  // casi nunca y recortarla da más precisión al marcar el punto.
  // Coordenadas de un lanzamiento: x de 0 a 20 de izquierda a derecha de quien
  // ataca, y = distancia a la línea de gol (0 = línea de gol).
  const COURT = { width:20, depth:15, goalWidth:3, postL:8.5, postR:11.5 };
  // viewBox: la pista más un margen para el trazo y el hueco de la portería.
  const COURT_VB = { x:-0.25, y:-0.25, w:20.5, h:16.35 };

  // Zonas con las que se agrupan los lanzamientos en las estadísticas. El punto
  // exacto es lo que se guarda; la zona se deduce de él al mostrar los datos.
  // Igual que las posiciones: el id es lo que se recalcula desde el punto y lo
  // que se escribe en el CSV; el nombre se traduce solo al enseñarlo.
  const ORIGINS = ['EI','LI','CE','LD','ED','PIV','7M'];

  function originName(id){ return t('origin.' + id); }

  function zoneFromPoint(p){
    if(!p) return null;
    const dx = p.x - COURT.width/2;
    if(Math.abs(dx) < 0.75 && Math.abs(p.y - 7) < 0.75) return '7M';
    if(p.x < 5.5) return 'EI';
    if(p.x > 14.5) return 'ED';
    if(p.y < 6.5 && Math.abs(dx) < 2.5) return 'PIV';
    if(p.x < COURT.postL) return 'LI';
    if(p.x > COURT.postR) return 'LD';
    return 'CE';
  }

  // Los partidos registrados con la primera versión de esta función guardaban
  // directamente el id de la zona en vez del punto.
  function shotZone(s){
    if(!s.origin) return null;
    return typeof s.origin === 'string' ? s.origin : zoneFromPoint(s.origin);
  }

  function shotPoint(s){
    return s.origin && typeof s.origin === 'object' ? s.origin : null;
  }

  // Media pista dibujada a escala: área de 6 m, línea de 9 m discontinua,
  // marcas de 7 y 4 m y la portería con su red. Se usa tanto para marcar el
  // lanzamiento (interactive) como para pintar el mapa de tiros de un partido.
  function courtSvg(opts){
    const o = opts || {};
    const id = o.id || 'court';
    const D = COURT.depth;             // y del svg = D - distancia a portería
    const L = COURT.postL, R = COURT.postR;
    const y6 = D - 6, y9 = D - 9, y7 = D - 7, y4 = D - 4;
    // la línea de 9 m se sale por las bandas: se corta donde cruza x=0 y x=20
    const y9edge = D - Math.sqrt(81 - L*L);
    const area6 = `M ${L-6} ${D} A 6 6 0 0 1 ${L} ${y6} L ${R} ${y6} A 6 6 0 0 1 ${R+6} ${D} Z`;
    const line9 = `M 0 ${y9edge.toFixed(2)} A 9 9 0 0 1 ${L} ${y9} L ${R} ${y9} A 9 9 0 0 1 20 ${y9edge.toFixed(2)}`;
    const dots = o.heat ? heatLayer(o.shots || [], id) : (o.shots || []).map(s => {
      const p = shotPoint(s);
      if(!p) return '';
      return `<circle class="shot-dot ${s.type}" cx="${p.x}" cy="${(D - p.y).toFixed(2)}" r="0.34"/>`;
    }).join('');
    return `
      <svg class="court-svg${o.interactive ? ' interactive' : ''}"
           viewBox="${COURT_VB.x} ${COURT_VB.y} ${COURT_VB.w} ${COURT_VB.h}"
           ${o.interactive ? 'data-court="1"' : 'role="img"'}>
        <title>${esc(t('court.title'))}</title>
        <defs>
          <pattern id="parquet-${id}" width="1.15" height="4" patternUnits="userSpaceOnUse">
            <rect width="1.15" height="4" fill="#AC8455"/>
            <rect width="0.55" height="4" fill="#B68D5C"/>
            <rect width="0.07" height="4" fill="#9A7446"/>
          </pattern>
          <pattern id="net-${id}" width="0.42" height="0.42" patternUnits="userSpaceOnUse">
            <rect width="0.42" height="0.42" fill="#0F1A27"/>
            <path d="M0 0 L0.42 0.42 M0.42 0 L0 0.42" stroke="#8C97A6" stroke-width="0.05"/>
          </pattern>
          <pattern id="post-${id}" width="0.5" height="0.5" patternUnits="userSpaceOnUse">
            <rect width="0.5" height="0.5" fill="#F2F4F7"/>
            <rect width="0.25" height="0.25" fill="#CC2F26"/>
            <rect x="0.25" y="0.25" width="0.25" height="0.25" fill="#CC2F26"/>
          </pattern>
          <filter id="heat-${id}" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="0.75"/>
          </filter>
        </defs>
        <rect class="court-floor" x="0" y="0" width="20" height="${D}" fill="url(#parquet-${id})"/>
        <path class="court-area" d="${area6}"/>
        <path class="court-line dashed" d="${line9}"/>
        <path class="court-line" d="${area6}"/>
        <line class="court-mark" x1="9.5" y1="${y7}" x2="10.5" y2="${y7}"/>
        <line class="court-mark" x1="9.75" y1="${y4}" x2="10.25" y2="${y4}"/>
        <rect class="court-border" x="0" y="0" width="20" height="${D}"/>
        <rect x="${L}" y="${D}" width="${COURT.goalWidth}" height="0.9" fill="url(#net-${id})"/>
        <rect class="court-goal-frame" x="${L}" y="${D}" width="${COURT.goalWidth}" height="0.9"
              stroke="url(#post-${id})"/>
        ${dots}
      </svg>
    `;
  }

  // Mapa de calor: en vez de un punto por tiro, la pista se parte en casillas de
  // un metro y cada una se pinta según cuántos tiros cayeron dentro. Con muchos
  // tiros, los puntos se amontonan y ya no dicen nada; esto sí.
  function heatLayer(shots, id){
    const CELL = 1;
    const counts = {};
    shots.forEach(s => {
      const p = shotPoint(s);
      if(!p) return;
      const k = Math.floor(p.x/CELL) + ':' + Math.floor(p.y/CELL);
      counts[k] = (counts[k] || 0) + 1;
    });
    const values = Object.keys(counts).map(k => counts[k]);
    if(values.length === 0) return '';
    const max = Math.max.apply(null, values);
    const rects = Object.keys(counts).map(k => {
      const parts = k.split(':');
      const cx = Number(parts[0]), cy = Number(parts[1]);
      const a = 0.18 + 0.62 * (counts[k] / max);
      return `<rect x="${cx*CELL}" y="${(COURT.depth - (cy+1)*CELL).toFixed(2)}"
                    width="${CELL}" height="${CELL}" fill="#FF5A68" opacity="${a.toFixed(2)}"/>`;
    }).join('');
    return `<g filter="url(#heat-${id})">${rects}</g>`;
  }

  function courtPointFromEvent(svg, ev){
    const r = svg.getBoundingClientRect();
    if(!r.width || !r.height) return null;
    const ux = COURT_VB.x + (ev.clientX - r.left) / r.width * COURT_VB.w;
    const uy = COURT_VB.y + (ev.clientY - r.top) / r.height * COURT_VB.h;
    const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
    return {
      x: Math.round(clamp(ux, 0, COURT.width) * 100) / 100,
      y: Math.round(clamp(COURT.depth - uy, 0, COURT.depth) * 100) / 100
    };
  }

  function esc(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  // ---------- datos ----------
  // Todo pasa por Store: escribe en el espejo local y encola la subida, así que
  // ninguna pantalla espera a la red. Ver js/store.js.

  function reloadTeams(){
    state.teams = Store.teams();
  }

  function reloadMatches(){
    state.matches = Store.matches(state.currentTeamId)
      .sort((a,b) => b.date.localeCompare(a.date));
  }

  // ---------- toast ----------
  function toast(msg){
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(()=>el.remove(), 2200);
  }

  // ---------- sesión y sincronización ----------

  function userLabel(){
    const u = state.user;
    if(!u) return '';
    const meta = u.user_metadata || {};
    return meta.name || meta.full_name || u.email || t('common.myAccount');
  }

  // Solo aparece cuando hay algo que contar: si todo está al día, estorba.
  function syncBanner(){
    const st = Store.status();
    if(st === 'synced') return '';
    // El recuento importa también sin conexión: es lo que te dice cuánto
    // llevas anotado que todavía no está a salvo en ningún otro sitio.
    const n = Store.pendingCount();
    const extra = n && (st === 'pending' || st === 'offline' || st === 'error')
      ? t('sync.pendingCount', { n }) : '';
    return `
      <button class="sync-banner st-${st}" id="sync-banner">
        <span class="sync-dot"></span>
        ${esc(t('sync.' + st) + extra)}
      </button>
    `;
  }

  // La marca, en un solo sitio para no volver a escribirla a mano en cada
  // pantalla. El SVG va en línea y sin <defs> a propósito: así la misma marca
  // se puede pintar varias veces en la página sin sufijar ids, que es lo que
  // sí necesita courtSvg() por sus patrones. El tamaño lo pone el CSS según
  // dónde esté (banner o topbar), por eso no se pasa por parámetro. El cuadro
  // va como aria-hidden: el nombre ya lo dice el texto de al lado, y con
  // <title> un lector de pantalla leería "SuperStat" dos veces.
  function brandLogo(){
    return `
      <span class="brand">
        <svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
          <rect class="tile" x="0" y="0" width="32" height="32" rx="7"/>
          <rect class="bar" x="6.5" y="17" width="5" height="8" rx="1.4"/>
          <rect class="bar" x="13.5" y="12.5" width="5" height="12.5" rx="1.4"/>
          <rect class="bar" x="20.5" y="7" width="5" height="18" rx="1.4"/>
        </svg>
        <span class="brand-word">Super<i>Stat</i></span>
      </span>
    `;
  }

  // Iconos de la interfaz, dibujados a mano como SVG en línea por lo mismo que
  // el logo: no hace falta traer una librería para cuatro trazos. Todos usan
  // currentColor, así que el color lo manda el CSS del botón que los contiene.
  const ICONS = {
    back:  '<path d="M15 5 8 12l7 7"/>',
    home:  '<path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>',
    list:  '<rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M4 9.5h16M9 3.5v3M15 3.5v3M8 14h3"/>',
    user:  '<circle cx="12" cy="8.5" r="3.7"/><path d="M4.6 20a7.4 7.4 0 0 1 14.8 0"/>',
    plus:  '<path d="M12 5.5v13M5.5 12h13"/>',
    play:  '<path d="M8 5.5 18.5 12 8 18.5z" fill="currentColor" stroke-linejoin="round"/>',
    pause: '<path d="M9 5.5v13M15 5.5v13"/>',
    share: '<path d="M12 15.5V4m0 0L8.5 7.5M12 4l3.5 3.5"/><path d="M5.5 13v5.5a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5V13"/>',
    trash: '<path d="M5 7h14M10 7V5.5A1.5 1.5 0 0 1 11.5 4h1A1.5 1.5 0 0 1 14 5.5V7m-7 0 .8 11.1A1.5 1.5 0 0 0 9.3 20h5.4a1.5 1.5 0 0 0 1.5-1.4L17 7"/>',
    pencil:'<path d="M16.5 4.5 19.5 7.5M4.5 19.5l.9-3.6L16 5.3a1.2 1.2 0 0 1 1.7 0l1 1a1.2 1.2 0 0 1 0 1.7L8.1 18.6z"/>'
  };

  function icon(name){
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"
      aria-hidden="true">${ICONS[name] || ''}</svg>`;
  }

  // Cabecera de tres huecos con el logo siempre en el del medio. Sustituye a
  // las cabeceras que cada pantalla escribía a mano; los ids de los botones son
  // los de siempre, así attachHandlers() no se entera del cambio.
  function topbar(o){
    const opt = o || {};
    const side = (html) => html || '';
    return `
      <header class="topbar">
        <div class="slot left">${side(opt.left)}</div>
        ${brandLogo()}
        <div class="slot right">${side(opt.right)}</div>
      </header>
    `;
  }

  function backBtn(id, label){
    return `<button class="back-btn" id="${id}" aria-label="${esc(label)}" title="${esc(label)}">${icon('back')}</button>`;
  }

  // El nombre de la pantalla ya no cabe en la cabecera: va dentro del contenido
  // como título grande, que es como lo resuelve iOS.
  function pageTitle(title, sub){
    return `<h1 class="page-title">${esc(title)}${sub ? `<small>${esc(sub)}</small>` : ''}</h1>`;
  }

  // ---------- tarjetas con color ----------
  // Ningún color se guarda: el de un equipo sale de su nombre y el de un
  // partido, del resultado. Así las listas tienen color sin pedirle al usuario
  // que elija ninguno, y dos dispositivos pintan lo mismo sin sincronizar nada.
  const TEAM_TINTS = [
    { solid:'#D9182B', wash:'rgba(217,24,43,0.40)' },
    { solid:'#33A17F', wash:'rgba(51,161,127,0.40)' },
    { solid:'#4C8FD6', wash:'rgba(76,143,214,0.40)' },
    { solid:'#E8B84B', wash:'rgba(232,184,75,0.34)' }
  ];

  function teamTint(name){
    let h = 0;
    for(let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return TEAM_TINTS[h % TEAM_TINTS.length];
  }

  function initials(name){
    return name.trim().split(/\s+/).slice(0,2).map(w => w[0] || '').join('').toUpperCase();
  }

  // '2026-09-13' → '13 sep' en español y 'Sep 13' en inglés: cambia el mes y
  // también el orden, que es lo que hace date.short una plantilla y no una
  // concatenación. Si viniera algo raro, se devuelve tal cual.
  function shortDate(iso){
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if(!m) return iso || '';
    return t('date.short', {
      d: parseInt(m[3], 10),
      mes: t('month.' + parseInt(m[2], 10))
    });
  }

  function teamCardHtml(team){
    const tint = teamTint(team.name);
    return `
      <button class="tint-card team-card" data-team="${team.id}"
              style="--tint:${tint.wash};--tint-solid:${tint.solid};">
        <span class="team-badge">${esc(initials(team.name))}</span>
        <span class="team-text">
          <span class="team-name">${esc(team.name)}</span>
          <span class="team-meta">${esc(t('team.playerCount', { n: team.players.length }))}</span>
        </span>
        <span class="chev">${icon('back')}</span>
      </button>
    `;
  }

  function matchCardHtml(team, m){
    const gf = m.shotsRival.filter(s=>s.type==='goal').length;
    const ga = m.shotsOwn.filter(s=>s.type==='goal').length;
    const res = gf > ga ? 'win' : (gf < ga ? 'loss' : 'draw');
    const tint = res === 'win'  ? { solid:'#33A17F', wash:'rgba(51,161,127,0.40)', tag:t('result.win') }
               : res === 'loss' ? { solid:'#C1443A', wash:'rgba(193,68,58,0.40)',  tag:t('result.loss') }
               :                  { solid:'#8A8F98', wash:'rgba(138,143,152,0.28)', tag:t('result.draw') };
    return `
      <button class="tint-card match-card" data-match="${m.id}"
              style="--tint:${tint.wash};--tint-solid:${tint.solid};">
        <span class="side">${esc(team.name)}</span>
        <span class="mid">
          <span class="tag">${esc(tint.tag)}</span>
          <span class="score">${gf} – ${ga}</span>
          <span class="when">${esc(shortDate(m.date))}</span>
        </span>
        <span class="side away">${esc(m.rival)}</span>
      </button>
    `;
  }

  function onStoreChange(){
    // Repintar entero solo donde no puede haber un formulario a medias: en la
    // pantalla de equipo se estaría escribiendo un jugador y se perdería.
    if(state.screen === 'dashboard' || state.screen === 'matchList' || state.screen === 'account'){
      render();
      return;
    }
    refreshSyncBanner();
  }

  function refreshSyncBanner(){
    const el = document.getElementById('sync-banner');
    const html = syncBanner();
    // Si la banda aparece o desaparece cambia el hueco: hay que repintar.
    if((!el && html) || (el && !html)){
      if(state.screen === 'team') render();
      return;
    }
    if(el && html){
      const tmp = document.createElement('div');
      tmp.innerHTML = html;
      el.className = tmp.firstElementChild.className;
      el.innerHTML = tmp.firstElementChild.innerHTML;
    }
  }

  function renderMigrate(){
    return `
      ${topbar()}
      <main>
        ${pageTitle(t('migrate.title'))}
        <div class="card">
          <p style="margin:0 0 10px;font-size:14px;line-height:1.5;">
            ${esc(t('migrate.body'))}
          </p>
          <p style="margin:0;font-size:12.5px;color:var(--muted);line-height:1.5;">
            ${esc(t('migrate.note'))}
          </p>
        </div>
        <div style="height:14px;"></div>
        <button class="primary" id="migrate-yes">${esc(t('migrate.yes'))}</button>
        <div style="height:10px;"></div>
        <button class="secondary" id="migrate-no">${esc(t('migrate.no'))}</button>
      </main>
    `;
  }

  async function enterApp(user){
    if(state.user && state.user.id === user.id) return;  // onAuthChange repite
    state.user = user;
    state.authError = '';
    state.authNotice = '';
    state.authBusy = false;
    state.screen = 'loading';
    render();
    await Store.start(user.id);
    reloadTeams();
    // Un partido a medias sobrevive a que el navegador descarte la pestaña, que
    // es lo que hace un móvil cuando cambias de aplicación. No se entra solo en
    // él: se ofrece desde el panel, por si lo que quería era otra cosa.
    const saved = Store.loadDraft();
    state.draft = saved && state.teams.some(tm => tm.id === saved.teamId) ? saved : null;
    if(!state.draft) Store.clearDraft();
    state.screen = Store.hasLegacyData() ? 'migrate' : 'dashboard';
    render();
  }

  function leaveApp(){
    Store.stop();
    state = Object.assign({}, state, {
      screen:'auth', user:null, teams:[], matches:[], currentTeamId:null,
      currentMatchId:null, draft:null, authMode:'login', authError:'',
      authNotice:'', authBusy:false, formError:'', pendingShot:null,
      editingPlayerId:null, deletingAccount:false, deleteAccountError:'',
      deleteAccountBusy:false
    });
    render();
  }

  // ---------- render root ----------
  function render(){
    const app = document.getElementById('app');
    // Lo que solo tiene sentido dentro de una pantalla se cierra al salir de
    // ella, en un sitio y no en cada botón que navega.
    if(state.screen !== 'team') state.editingPlayerId = null;
    if(state.screen !== 'account'){
      state.deletingAccount = false;
      state.deleteAccountError = '';
    }
    // Las pantallas de datos se releen del store en cada pintada: así lo que
    // llega de otro dispositivo aparece sin tener que recordar refrescarlo.
    if(state.user){
      if(state.screen === 'dashboard' || state.screen === 'team' || state.screen === 'account') reloadTeams();
      if(state.screen === 'matchList' || state.screen === 'matchDetail' || state.screen === 'season'){
        reloadTeams();
        reloadMatches();
      }
    }
    let html = '';
    if(state.screen === 'auth') html = renderAuth();
    else if(state.screen === 'dashboard') html = renderDashboard();
    else if(state.screen === 'team') html = renderTeam();
    else if(state.screen === 'matchList') html = renderMatchList();
    else if(state.screen === 'matchDetail') html = renderMatchDetail();
    else if(state.screen === 'season') html = renderSeason();
    else if(state.screen === 'newMatchSetup') html = renderNewMatchSetup();
    else if(state.screen === 'liveMatch') html = renderLiveMatch();
    else if(state.screen === 'migrate') html = renderMigrate();
    else if(state.screen === 'account') html = renderAccount();
    else html = `<div class="loading-msg">${esc(t('common.loading'))}</div>`;
    // La barra inferior la pone aquí el render y no cada pantalla, para que
    // añadir una vista nueva no obligue a acordarse de ella.
    const withNav = NAV_SCREENS.indexOf(state.screen) !== -1;
    app.className = 'screen-' + state.screen + (withNav ? ' has-nav' : '');
    app.innerHTML = html + (withNav ? bottomNav() : '');
    attachHandlers();
  }

  // Pantallas que llevan barra inferior. Fuera quedan la entrada, la migración,
  // los formularios y el partido en vivo, donde taparía lo que se está tocando.
  const NAV_SCREENS = ['dashboard','team','matchList','matchDetail','season','account'];

  function bottomNav(){
    const s = state.screen;
    const tab = s === 'account' ? 'account'
              : (s === 'matchList' || s === 'matchDetail' || s === 'season') ? 'matches'
              : 'home';
    const btn = (id, name, ic, label) => `
      <button class="nav-btn${tab === name ? ' on' : ''}" id="${id}">
        ${icon(ic)}<span>${label}</span>
      </button>`;
    return `
      <nav class="bottom-nav">
        ${btn('tab-home','home','home',esc(t('nav.teams')))}
        ${btn('tab-matches','matches','list',esc(t('nav.matches')))}
        ${btn('tab-account','account','user',esc(t('nav.account')))}
        <button class="nav-add" id="tab-add" aria-label="${esc(t('nav.newMatch'))}" title="${esc(t('nav.newMatch'))}">
          ${icon('plus')}
        </button>
      </nav>
    `;
  }

  // ---------- AUTH ----------
  function renderAuth(){
    const isLogin = state.authMode === 'login';
    if(!DB.isConfigured()){
      return `
        <div class="brand-banner">${brandLogo()}</div>
        <main>
          <div class="error-msg">${t('auth.noConfig')}</div>
          <div class="hint-text">${esc(t('auth.noConfigHint'))}</div>
        </main>
      `;
    }
    const submit = isLogin ? t('auth.login') : t('auth.register');
    return `
      <div class="brand-banner">
        ${brandLogo()}
        <p class="brand-tagline">${esc(t('app.tagline'))}</p>
      </div>
      <main>
        <div class="google-slot" id="google-slot"></div>
        <div class="auth-divider"><span>${esc(t('auth.orEmail'))}</span></div>

        <h2 style="font-size:19px;margin-bottom:16px;">${esc(submit)}</h2>
        <div class="field">
          <label for="auth-user">${esc(t('auth.email'))}</label>
          <input id="auth-user" type="email" autocomplete="email" placeholder="${esc(t('auth.emailHint'))}">
        </div>
        <div class="field">
          <label for="auth-pass">${esc(t('auth.password'))}</label>
          <input id="auth-pass" type="password" autocomplete="${isLogin ? 'current-password' : 'new-password'}" placeholder="••••••••">
        </div>
        ${state.authError ? `<div class="error-msg">${esc(state.authError)}</div>` : ''}
        ${state.authNotice ? `<div class="notice-msg">${esc(state.authNotice)}</div>` : ''}
        <button class="primary" id="auth-submit" ${state.authBusy ? 'disabled' : ''}>
          ${esc(state.authBusy ? t('common.wait') : submit)}
        </button>
        <div style="text-align:center;margin-top:14px;">
          <button class="link-btn" id="auth-toggle">${esc(isLogin ? t('auth.toRegister') : t('auth.toLogin'))}</button>
        </div>
      </main>
      <footer class="note">${esc(t('auth.footer'))}</footer>
    `;
  }

  // Los mensajes de Supabase vienen siempre en inglés, los lea quien los lea, y
  // no son para enseñárselos a nadie tal cual ("invalid login credentials"). Se
  // reconocen por su texto original y se cambian por uno nuestro, que sí tiene
  // los dos idiomas.
  function authErrorText(e){
    const m = (e && e.message ? e.message : String(e)).toLowerCase();
    // Lo que puede fallar solo en la app de móvil. Cancelar el diálogo de
    // Google llega como error y no lo es: no se enseña nada.
    if(m.includes('cancel') || m.includes('12501') || m.includes('user_cancel')) return '';
    if(m.includes('google-sin-token')) return t('authError.googleNoToken');
    if(m.includes('sin-plataforma-nativa')) return t('authError.googleOff');
    if(m.includes('10:') || m.includes('developer_error')) return t('authError.googleSign');
    if(m.includes('invalid login credentials')) return t('authError.badLogin');
    if(m.includes('user already registered')) return t('authError.alreadyUser');
    if(m.includes('password should be at least')) return t('authError.shortPassword');
    if(m.includes('unable to validate email')) return t('authError.badEmail');
    if(m.includes('email not confirmed')) return t('authError.notConfirmed');
    // Así llama supabase-js a que la petición a la Edge Function no llegó a
    // tener respuesta: no existe, o el navegador la descartó por CORS. Es
    // distinto de que la función responda un error, y por eso tiene su propio
    // texto: al usuario le queda la vía del correo, que es la que promete
    // privacidad.html, y en la consola queda la pista de desplegarla (db.js).
    if(m.includes('edge function')) return t('authError.edgeFunction');
    if(m.includes('failed to fetch') || m.includes('network')) return t('authError.network');
    // El de último recurso lleva dentro el mensaje original de Supabase, en
    // inglés: no hay forma de traducir lo que todavía no se ha visto nunca, y
    // es lo que hace falta para dar el aviso por bueno.
    return t('authError.generic', { msg: (e && e.message) ? e.message : t('authError.unknown') });
  }

  // El botón de Google.
  //
  // En el navegador lo dibuja Google dentro de #google-slot, así que no hay
  // click propio que enlazar: se monta después de cada render de la entrada. Si
  // no se puede dibujar, se dice ahí mismo en vez de dejar un hueco mudo.
  //
  // En la app de móvil ese botón no sirve —Google no admite su flujo web dentro
  // de un WebView— así que se pinta uno nuestro que le pide el token al
  // sistema operativo.
  function mountGoogleButton(){
    const slot = document.getElementById('google-slot');
    if(!slot) return;
    if(window.Native && Native.isNative()){
      slot.innerHTML = `
        <button class="google-native-btn" id="google-native">
          <svg viewBox="0 0 18 18" aria-hidden="true" width="18" height="18">
            <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/>
            <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"/>
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.9 11.42 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/>
          </svg>
          <span>${esc(t('auth.googleBtn'))}</span>
        </button>
      `;
      const btn = document.getElementById('google-native');
      btn.addEventListener('click', async () => {
        if(state.authBusy) return;
        state.authBusy = true;
        state.authError = '';
        render();
        try{
          await DB.signInWithGoogleNative();
          // La sesión la recoge onAuthChange, igual que con el correo.
        }catch(e){
          state.authError = authErrorText(e);
        }finally{
          state.authBusy = false;
          if(state.screen === 'auth') render();
        }
      });
      return;
    }
    DB.renderGoogleButton(slot, (e) => {
      state.authError = authErrorText(e);
      render();
    }).catch((e) => {
      slot.innerHTML = `<div class="hint-text">${esc(googleUnavailableText(e))}</div>`;
    });
  }

  function googleUnavailableText(e){
    const m = (e && e.message) || '';
    if(m === 'falta-client-id')     return t('google.noClientId');
    if(m === 'sin-contexto-seguro') return t('google.noSecureContext');
    if(m === 'google-no-carga')     return t('google.notLoaded');
    return t('authError.googleOff');
  }

  async function handleAuthSubmit(){
    if(state.authBusy) return;
    const email = document.getElementById('auth-user').value.trim();
    const pass = document.getElementById('auth-pass').value;
    if(!email || !pass){ state.authError = t('auth.needBoth'); render(); return; }
    state.authError = '';
    state.authNotice = '';
    state.authBusy = true;
    render();
    try{
      if(state.authMode === 'login'){
        await DB.signInWithPassword(email, pass);
      } else {
        const res = await DB.signUpWithPassword(email, pass);
        if(res.needsConfirmation){
          state.authBusy = false;
          state.authMode = 'login';
          state.authNotice = t('auth.confirmSent');
          render();
          return;
        }
      }
      // La sesión nueva la recoge onAuthChange, que llama a enterApp().
    }catch(e){
      state.authError = authErrorText(e);
    }finally{
      state.authBusy = false;
      if(state.screen === 'auth') render();
    }
  }

  // ---------- DASHBOARD ----------
  function renderDashboard(){
    const teamsHtml = state.teams.length ? state.teams.map(teamCardHtml).join('') : `
      <div class="empty-state">
        <div class="big-num">${esc(t('dashboard.empty'))}</div>
        ${esc(t('dashboard.emptyHint'))}
      </div>
    `;
    return `
      ${topbar({ right:`<button class="back-btn" id="to-account" aria-label="${esc(t('nav.account'))}" title="${esc(t('nav.account'))}">${icon('user')}</button>` })}
      <main>
        ${pageTitle(t('dashboard.title'))}
        ${syncBanner()}
        ${resumeCardHtml()}
        ${teamsHtml}
        <div class="section-label">${esc(t('dashboard.newTeam'))}</div>
        <div class="field">
          <label for="new-team-name">${esc(t('dashboard.teamName'))}</label>
          <input id="new-team-name" type="text" maxlength="80" placeholder="${esc(t('dashboard.teamHint'))}">
        </div>
        <button class="primary" id="create-team-btn">${esc(t('dashboard.create'))}</button>
      </main>
    `;
  }

  // Un partido sin guardar es lo único que no está a salvo en ningún sitio: se
  // enseña arriba del todo hasta que se guarda o se descarta.
  function resumeCardHtml(){
    const d = state.draft;
    if(!d || state.screen !== 'dashboard') return '';
    const gf = d.shotsRival.filter(s => s.type === 'goal').length;
    const ga = d.shotsOwn.filter(s => s.type === 'goal').length;
    const team = state.teams.find(tm => tm.id === d.teamId);
    return `
      <div class="resume-card">
        <div class="resume-head">
          <span class="resume-live">${esc(t('resume.unsaved'))}</span>
          <span class="resume-score">${gf} – ${ga}</span>
        </div>
        <div class="resume-sub">
          ${esc((team && team.name) || t('common.yourTeam'))} · ${esc(d.rival)} ·
          ${esc(t('live.half', { n: d.period }))}, ${clockText(d)}
        </div>
        <div class="resume-actions">
          <button class="primary slim" id="resume-match">${esc(t('resume.continue'))}</button>
          <button class="secondary slim" id="drop-match">${esc(t('resume.drop'))}</button>
        </div>
      </div>
    `;
  }

  // ---------- CUENTA ----------
  // Vive aquí lo que antes colgaba de la cabecera del panel: quién eres, cómo
  // va la sincronización y el botón de salir.
  function renderAccount(){
    const label = userLabel();
    const teams = state.teams.length;
    return `
      ${topbar({ left: backBtn('to-dashboard', t('nav.teams')) })}
      <main>
        ${pageTitle(t('account.title'))}
        <div class="account-head">
          <div class="account-avatar">${esc(initials(label || '?'))}</div>
          <div>
            <div class="account-name">${esc(label)}</div>
            <div class="account-sub">${esc(t('account.teams', { n: teams }))}</div>
          </div>
        </div>
        <div class="section-label">${esc(t('account.sync'))}</div>
        ${syncBanner() || `
          <div class="card">
            <div class="card-title">${esc(t('account.allGood'))}</div>
            <div class="card-sub">${esc(t('account.allGoodSub'))}</div>
          </div>
        `}
        <div class="section-label">
          ${esc(t('account.language'))}
          <small>${esc(t('account.languageSub'))}</small>
        </div>
        ${languageHtml()}
        <div class="section-label">${esc(t('account.session'))}</div>
        <button class="secondary" id="logout-btn">${esc(t('account.logout'))}</button>

        <div class="section-label">${esc(t('account.deleteTitle'))}</div>
        ${deleteAccountHtml()}
      </main>
    `;
  }

  // El idioma es del aparato y no de la cuenta (lo guarda Store en su propia
  // clave, sin userId), así que vive aquí junto a lo demás que es de este
  // dispositivo y no se sincroniza. Se pintan las dos opciones como chips, del
  // mismo modo que los filtros del mapa, para no meter un <select> más.
  function languageHtml(){
    const actual = I18N.lang();
    return `
      <div class="chip-row">
        ${I18N.LANGS.map(code => `
          <button class="filter-chip${code === actual ? ' on' : ''}" data-lang="${code}">
            ${esc(I18N.langName(code))}
          </button>
        `).join('')}
      </div>
    `;
  }

  // Borrar la cuenta desde dentro de la app, que es lo que promete
  // privacidad.html y lo que Google prefiere para la ficha de Play. Se pide dos
  // veces —el botón abre la tarjeta, y dentro hay que escribir BORRAR— porque no
  // hay vuelta atrás: al terminar no queda nada, ni aquí ni en el servidor.
  function deleteAccountHtml(){
    if(!state.deletingAccount){
      return `
        <div class="card">
          <div class="card-sub">${esc(t('account.deleteSub'))}</div>
          <button class="danger slim" id="delete-account">${icon('trash')} ${esc(t('account.deleteBtn'))}</button>
        </div>
      `;
    }
    const palabra = t('account.deleteWord');
    return `
      <div class="card edit-card">
        <div class="card-title">${esc(t('account.deleteNoUndo'))}</div>
        <div class="card-sub">${t('account.deleteAsk', { palabra: esc(palabra) })}</div>
        <div class="field">
          <label for="delete-account-word">${esc(t('account.deleteLabel'))}</label>
          <input id="delete-account-word" type="text" autocomplete="off" placeholder="${esc(palabra)}">
        </div>
        ${state.deleteAccountError ? `<div class="error-msg">${esc(state.deleteAccountError)}</div>` : ''}
        <div class="export-row">
          <button class="danger slim" id="delete-account-confirm" ${state.deleteAccountBusy ? 'disabled' : ''}>
            ${esc(state.deleteAccountBusy ? t('account.deleting') : t('account.deleteGo'))}
          </button>
          <button class="secondary slim" id="delete-account-cancel">${esc(t('common.cancel'))}</button>
        </div>
      </div>
    `;
  }

  // El orden importa y no es intercambiable: primero el servidor, y solo si
  // responde bien se limpia lo local. Al revés, un fallo de red dejaría el
  // aparato vacío con la cuenta todavía viva y sin forma de recuperar lo que
  // hubiera sin subir.
  async function handleDeleteAccount(){
    const campo = document.getElementById('delete-account-word');
    const escrito = (campo ? campo.value : '').trim().toUpperCase();
    // La palabra depende del idioma —BORRAR o DELETE— y es la misma que se pide
    // en pantalla, así que se compara con la del diccionario y no con una
    // escrita aquí: con dos copias, cambiar una dejaría el botón inservible.
    const palabra = t('account.deleteWord');
    if(escrito !== palabra.toUpperCase()){
      state.deleteAccountError = t('account.deleteType', { palabra });
      render();
      return;
    }
    state.deleteAccountBusy = true;
    state.deleteAccountError = '';
    render();
    try{
      await DB.deleteAccount();
    }catch(e){
      state.deleteAccountBusy = false;
      state.deleteAccountError = authErrorText(e) || t('account.deleteFailed');
      render();
      return;
    }
    Store.wipeLocal();
    await DB.signOut();
    leaveApp();
    toast(t('account.deleted'));
  }

  async function handleCreateTeam(){
    const name = document.getElementById('new-team-name').value.trim();
    if(!name) return;
    if(name.length > 80){
      state.formError = t('dashboard.nameTooLong');
      render();
      return;
    }
    const team = Store.createTeam(name);
    reloadTeams();
    state.currentTeamId = team.id;
    state.screen = 'team';
    render();
  }

  function currentTeam(){
    return state.teams.find(tm => tm.id === state.currentTeamId);
  }

  // ---------- TEAM / ROSTER ----------
  function renderTeam(){
    const team = currentTeam();
    const players = [...team.players].sort((a,b)=>a.dorsal-b.dorsal);
    const rows = players.length ? players.map(p => `
      <div class="player-row${state.editingPlayerId === p.id ? ' editing' : ''}">
        <div class="dorsal-badge">${esc(p.dorsal)}</div>
        <div class="player-info">
          <div class="player-name">${esc(p.name)}</div>
          <div class="player-pos">${esc(positionName(p.position))}</div>
        </div>
        <button class="icon-btn" data-edit-player="${p.id}" title="${esc(t('common.edit'))}">${icon('pencil')}</button>
        <button class="icon-btn" data-del-player="${p.id}" title="${esc(t('common.delete'))}">✕</button>
      </div>
    `).join('') : `<div class="empty-state" style="padding:20px 0;">${esc(t('team.noPlayers'))}</div>`;

    // El mismo formulario da de alta y corrige: con editingPlayerId puesto llega
    // relleno y guarda sobre la misma fila, que es lo que conserva el historial
    // del jugador. Un modal aparte sería repetir estos tres campos.
    const editando = state.editingPlayerId
      ? players.find(p => p.id === state.editingPlayerId)
      : null;

    return `
      ${topbar({ left: backBtn('to-dashboard', t('nav.teams')) })}
      <main>
        ${pageTitle(team.name, t('team.rosterCount', { n: players.length }))}
        <div class="section-label">${esc(t('team.roster'))}</div>
        <div class="card">${rows}</div>

        <div class="section-label">${esc(editando ? t('team.editPlayer') : t('team.newPlayer'))}</div>
        <div class="row">
          <div class="field" style="flex:2;">
            <label for="p-name">${esc(t('team.name'))}</label>
            <input id="p-name" type="text" maxlength="80" placeholder="${esc(t('team.nameHint'))}"
                   value="${editando ? esc(editando.name) : ''}">
          </div>
          <div class="field" style="flex:1;">
            <label for="p-dorsal">${esc(t('team.dorsal'))}</label>
            <input id="p-dorsal" type="number" min="0" max="99" placeholder="7"
                   value="${editando ? esc(editando.dorsal) : ''}">
          </div>
        </div>
        <div class="field">
          <label for="p-pos">${esc(t('team.position'))}</label>
          <select id="p-pos">
            ${POSITIONS.map(p=>`<option value="${esc(p)}"${editando && editando.position === p ? ' selected' : ''}>${esc(positionName(p))}</option>`).join('')}
          </select>
        </div>
        ${state.formError ? `<div class="error-msg">${esc(state.formError)}</div>` : ''}
        ${editando ? `
          <div class="export-row">
            <button class="primary slim" id="save-player-btn">${esc(t('common.saveChanges'))}</button>
            <button class="secondary slim" id="cancel-player-btn">${esc(t('common.cancel'))}</button>
          </div>
        ` : `<button class="secondary" id="add-player-btn">${esc(t('team.addPlayer'))}</button>`}

        <div class="section-label">${esc(t('team.matches'))}</div>
        <button class="primary" id="new-match-btn">${esc(t('team.newMatch'))}</button>
        <div style="height:10px;"></div>
        <button class="secondary" id="view-matches-btn">${esc(t('team.viewMatches'))}</button>
        <div style="height:10px;"></div>
        <button class="secondary" id="view-season-btn">${esc(t('team.viewSeason'))}</button>

        <div class="section-label">${esc(t('team.deleteTitle'))}</div>
        <div class="card">
          <div class="card-sub">${esc(t('team.deleteSub'))}</div>
          <button class="danger slim" id="delete-team">${icon('trash')} ${esc(t('team.deleteBtn'))}</button>
        </div>
      </main>
    `;
  }

  // Lee y valida los tres campos del formulario de plantilla. Devuelve null si
  // algo no cuadra, después de dejar el aviso en pantalla: lo usan igual el alta
  // y la edición, que comparten formulario.
  function readPlayerForm(){
    const name = document.getElementById('p-name').value.trim();
    const dorsalRaw = document.getElementById('p-dorsal').value;
    const position = document.getElementById('p-pos').value;
    const mal = (msg) => { state.formError = msg; render(); return null; };
    if(!name || dorsalRaw === '') return mal(t('team.needNameDorsal'));
    const dorsal = parseInt(dorsalRaw, 10);
    if(!Number.isInteger(dorsal) || dorsal < 0 || dorsal > 99){
      return mal(t('team.badDorsal'));
    }
    if(name.length > 80) return mal(t('team.nameTooLong'));
    return { name, dorsal, position };
  }

  async function handleAddPlayer(){
    const player = readPlayerForm();
    if(!player) return;
    Store.addPlayer(state.currentTeamId, player);
    state.formError = '';
    reloadTeams();
    render();
  }

  // Corregir un dorsal mal escrito o un nombre no puede costar el historial del
  // jugador: se guarda sobre su misma fila, con su mismo id, que es el que
  // llevan dentro todos sus tiros y sus eventos.
  async function handleSavePlayer(){
    const player = readPlayerForm();
    if(!player) return;
    Store.updatePlayer(state.editingPlayerId, player);
    state.editingPlayerId = null;
    state.formError = '';
    reloadTeams();
    render();
    toast(t('team.playerSaved'));
  }

  async function handleDeletePlayer(id){
    Store.deletePlayer(id);
    if(state.editingPlayerId === id) state.editingPlayerId = null;
    reloadTeams();
    render();
  }

  // Lo que promete la política de privacidad: con el equipo se va todo lo suyo.
  // El recuento de partidos va en la pregunta a propósito, porque desde esta
  // pantalla no se ven y es fácil olvidar cuántos hay detrás.
  function handleDeleteTeam(){
    const team = currentTeam();
    if(!team) return;
    const n = Store.matches(team.id).length;
    if(!confirm(t('team.deleteAsk', { equipo: team.name, n }))) return;
    // Un partido a medias de este equipo se queda sin sitio donde guardarse.
    if(state.draft && state.draft.teamId === team.id){
      state.draft = null;
      Store.clearDraft();
    }
    Store.deleteTeam(team.id);
    state.currentTeamId = null;
    state.currentMatchId = null;
    state.matches = [];
    state.editingMatch = false;
    state.formError = '';
    reloadTeams();
    state.screen = 'dashboard';
    render();
    toast(t('team.deleted'));
  }

  // ---------- MATCH LIST ----------
  function renderMatchList(){
    const team = currentTeam();
    const list = [...state.matches].sort((a,b)=> b.date.localeCompare(a.date));
    const rows = list.length
      ? list.map(m => matchCardHtml(team, m)).join('')
      : `<div class="empty-state">${esc(t('matchList.empty'))}</div>`;

    return `
      ${topbar({ left: backBtn('to-team', team.name) })}
      <main>
        ${pageTitle(t('matchList.title'), team.name)}
        ${list.length ? `<button class="secondary slim" id="to-season">${esc(t('matchList.season'))}</button><div style="height:14px;"></div>` : ''}
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
    const p = id === 'none' ? null : team.players.find(pp => pp.id === id);
    return p ? `${p.dorsal} · ${p.name}` : t('common.unspecified');
  }

  // Versión corta para cuando hay que nombrar a varios en una línea: el dorsal
  // y el nombre de pila, que es como se llaman entre ellos.
  function playerShort(team, id){
    const p = id === 'none' ? null : team.players.find(pp => pp.id === id);
    return p ? `${p.dorsal} ${p.name.split(/\s+/)[0]}` : t('common.unassigned');
  }

  // Todos los lanzamientos de un lado: los que fueron a puerta y los que no.
  // Para el porcentaje de acierto hay que contar también los que se fueron
  // fuera, o sale un acierto inflado.
  function attemptsOf(m, side){
    return side === 'own'
      ? m.shotsOwn.concat(m.missOwn || [])
      : m.shotsRival.concat(m.missRival || []);
  }

  // Tiros agrupados por la zona de la pista desde la que se lanzó. Los partidos
  // guardados antes de registrar la zona caen todos en "Sin especificar".
  function originStatsHtml(shots){
    const rows = ORIGINS.map(id => {
      const arr = shots.filter(s => shotZone(s) === id);
      if(arr.length === 0) return '';
      const goals = arr.filter(s => s.type === 'goal').length;
      const pct = Math.round(goals/arr.length*100);
      return `
        <div class="stat-list-row">
          <span>${esc(originName(id))}</span>
          <span class="count">${goals}/${arr.length} · ${pct}%</span>
        </div>
      `;
    }).filter(Boolean);
    const unknown = shots.filter(s => !s.origin).length;
    if(unknown){
      rows.push(`
        <div class="stat-list-row">
          <span>${esc(t('common.unspecified'))}</span>
          <span class="count">${esc(t('stats.shotsUnit', { n: unknown }))}</span>
        </div>
      `);
    }
    if(rows.length === 0) return `<div class="hint-text">${esc(t('common.noData'))}</div>`;
    return rows.join('');
  }

  // ---------- filtros del mapa ----------
  // No son un dato del partido: son una forma de mirarlo. Por eso viven en
  // state.mapFilter y no se guardan en ninguna parte.

  function applyMapFilter(shots, side){
    const f = state.mapFilter;
    return shots.filter(s => {
      if(f.period !== 'all' && s.period !== Number(f.period)) return false;
      // El filtro por jugador solo tiene sentido en los tiros nuestros: de los
      // del rival no se lleva plantilla.
      if(side === 'rival' && f.player !== 'all' && s.player !== f.player) return false;
      return true;
    });
  }

  function mapFilterHtml(team, m, side){
    const f = state.mapFilter;
    const hasPeriods = attemptsOf(m, side).some(s => s.period);
    const chip = (val, label) => `
      <button class="filter-chip${String(f.period) === String(val) ? ' on' : ''}" data-period="${val}">${label}</button>`;
    const players = sortedPlayers(team.players);
    return `
      <div class="filter-row">
        ${hasPeriods ? chip('all', esc(t('map.all')))
                     + chip('1', esc(t('map.half', { n:1 })))
                     + chip('2', esc(t('map.half', { n:2 }))) : ''}
        <button class="filter-chip${f.heat ? ' on' : ''}" id="toggle-heat">${esc(t('map.heat'))}</button>
      </div>
      ${side === 'rival' && players.length ? `
        <div class="filter-row">
          <select class="filter-select" id="filter-player">
            <option value="all">${esc(t('map.allPlayers'))}</option>
            ${players.map(p => `
              <option value="${p.id}"${f.player === p.id ? ' selected' : ''}>${esc(p.dorsal + ' · ' + p.name)}</option>
            `).join('')}
          </select>
        </div>` : ''}
    `;
  }

  // Mapa de tiros sobre la pista: un punto por lanzamiento con el punto exacto
  // registrado, o el mapa de calor si se pide. Sólo aparece si hay alguno.
  function shotMapHtml(shots, id){
    const withPoint = shots.filter(shotPoint);
    if(withPoint.length === 0){
      const filtrado = state.mapFilter.period !== 'all' || state.mapFilter.player !== 'all';
      return `<div class="hint-text">${esc(t(filtrado ? 'map.noPointsFiltered' : 'map.noPoints'))}</div>`;
    }
    const goals = withPoint.filter(s => s.type === 'goal').length;
    const missed = withPoint.filter(s => s.type === 'out' || s.type === 'post').length;
    const saved = withPoint.length - goals - missed;
    return `
      ${courtSvg({ shots: withPoint, id, heat: state.mapFilter.heat })}
      <div class="court-legend">
        ${state.mapFilter.heat
          ? `<span>${esc(t('map.shots', { n: withPoint.length }))}</span>`
          : `<span><i class="dot-goal"></i> ${esc(t('map.goals', { n: goals }))}</span>
             <span><i class="dot-save"></i> ${esc(t('map.saves', { n: saved }))}</span>
             ${missed ? `<span><i class="dot-out"></i> ${esc(t('map.out', { n: missed }))}</span>` : ''}`}
      </div>
    `;
  }

  // ---------- cruce pista × portería ----------
  // Desde dónde se lanza contra a qué parte de la portería se tira. Es el dato
  // que de verdad se usa para preparar a un portero: "el lateral zurdo siempre
  // busca el palo largo abajo".
  function crossMatrixHtml(shots){
    const rows = ORIGINS.map(id => {
      const arr = shots.filter(s => shotZone(s) === id && s.zone);
      if(arr.length === 0) return null;
      const cells = [];
      let max = 0;
      for(let z = 1; z <= 9; z++){
        const inZone = arr.filter(s => s.zone === z);
        const goals = inZone.filter(s => s.type === 'goal').length;
        cells.push({ z, n: inZone.length, goals });
        if(inZone.length > max) max = inZone.length;
      }
      return { id, cells, max, total: arr.length };
    }).filter(Boolean);
    if(rows.length === 0) return `<div class="hint-text">${esc(t('stats.needOrigin'))}</div>`;
    return `
      <div class="cross-wrap">
        ${rows.map(r => `
          <div class="cross-row">
            <div class="cross-name">${esc(originName(r.id))}<small>${r.total}</small></div>
            <div class="cross-grid">
              ${r.cells.map(c => `
                <div class="cross-cell${c.n ? '' : ' empty'}"
                     style="--fill:${c.n ? (0.15 + 0.6*(c.n/r.max)).toFixed(2) : 0}"
                     title="${esc(t('stats.crossCell', { zona: t('goalZone.' + c.z), goles: c.goals, n: c.n }))}">
                  ${c.n ? c.goals + '/' + c.n : ''}
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
      <div class="hint-text">${esc(t('stats.crossLegend'))}</div>
    `;
  }

  // ---------- porteros ----------
  // Esto es lo que antes no se podía calcular: hacía falta saber qué portero
  // estaba en portería también en los goles, no solo en las paradas.
  function keeperStatsHtml(team, m){
    const byKeeper = {};
    m.shotsOwn.forEach(s => {
      const k = s.keeper || 'none';
      const e = byKeeper[k] = byKeeper[k] || { faced:0, saves:0 };
      e.faced++;
      if(s.type === 'save') e.saves++;
    });
    const rows = Object.keys(byKeeper)
      .sort((a,b) => byKeeper[b].faced - byKeeper[a].faced)
      .map(id => {
        const e = byKeeper[id];
        const pct = e.faced ? Math.round(e.saves/e.faced*100) : 0;
        return `
          <div class="stat-list-row">
            <span>${esc(playerLabel(team, id))}</span>
            <span class="count">${e.saves}/${e.faced} · ${pct}%</span>
          </div>
        `;
      });
    if(rows.length === 0) return `<div class="hint-text">${esc(t('stats.noShotsAtUs'))}</div>`;
    return rows.join('');
  }

  // ---------- más/menos ----------
  // Se reconstruye el partido en orden (tiros y eventos comparten el ordinal) y
  // se va llevando quién está en pista: cada gol suma o resta a los que estaban.
  // Los partidos en los que no se marcó la pista no dan nada, y está bien así.
  function plusMinus(m){
    const seq = [];
    m.shotsRival.forEach(s => { if(s.type === 'goal') seq.push({ ordinal:s.ordinal, goal:1 }); });
    m.shotsOwn.forEach(s => { if(s.type === 'goal') seq.push({ ordinal:s.ordinal, goal:-1 }); });
    (m.events || []).forEach(e => {
      if(e.type === 'in' || e.type === 'out') seq.push({ ordinal:e.ordinal, sub:e.type, player:e.player });
    });
    seq.sort((a,b) => a.ordinal - b.ordinal);
    const onCourt = {}, out = {};
    seq.forEach(item => {
      if(item.sub === 'in' && item.player) onCourt[item.player] = true;
      else if(item.sub === 'out' && item.player) delete onCourt[item.player];
      else if(item.goal){
        Object.keys(onCourt).forEach(id => {
          const e = out[id] = out[id] || { plus:0, minus:0 };
          if(item.goal > 0) e.plus++; else e.minus++;
        });
      }
    });
    return out;
  }

  function plusMinusHtml(team, m){
    const pm = plusMinus(m);
    const ids = Object.keys(pm).sort((a,b) => (pm[b].plus - pm[b].minus) - (pm[a].plus - pm[a].minus));
    if(ids.length === 0){
      return `<div class="hint-text">${esc(t('stats.needCourtMark'))}</div>`;
    }
    return ids.map(id => {
      const e = pm[id];
      const diff = e.plus - e.minus;
      return `
        <div class="stat-list-row">
          <span>${esc(playerLabel(team, id))}</span>
          <span class="count ${diff > 0 ? 'good' : (diff < 0 ? 'bad' : '')}">
            ${diff > 0 ? '+' : ''}${diff} <small>${e.plus}·${e.minus}</small>
          </span>
        </div>
      `;
    }).join('');
  }

  // ---------- eventos ----------
  function eventStatsHtml(team, m){
    const evs = (m.events || []).filter(e => e.type !== 'in' && e.type !== 'out');
    if(evs.length === 0) return `<div class="hint-text">${esc(t('stats.noEvents'))}</div>`;
    const porTipo = {};
    evs.forEach(e => { porTipo[e.type] = true; });
    return eventTypesIn(porTipo).map(tipo => {
      const arr = evs.filter(e => e.type === tipo);
      const byPlayer = {};
      arr.forEach(e => { const k = e.player || 'none'; byPlayer[k] = (byPlayer[k]||0)+1; });
      const who = Object.keys(byPlayer)
        .sort((a,b) => byPlayer[b] - byPlayer[a])
        .map(pid => `${esc(playerShort(team, pid))}${byPlayer[pid] > 1 ? ' ×'+byPlayer[pid] : ''}`)
        .join(', ');
      return `
        <div class="stat-list-row">
          <span>${esc(eventName(tipo))}<small class="who">${who}</small></span>
          <span class="count">${arr.length}</span>
        </div>
      `;
    }).join('');
  }

  // ---------- evolución del marcador ----------
  // Un partido de balonmano se decide en rachas de tres o cuatro goles
  // seguidos; en la lista de tiros eso no se ve y en una línea sí.
  function scoreRun(m){
    const goals = m.shotsRival.filter(s => s.type === 'goal').map(s => ({ o:s.ordinal, t:1, m:s.minute }))
      .concat(m.shotsOwn.filter(s => s.type === 'goal').map(s => ({ o:s.ordinal, t:-1, m:s.minute })))
      .sort((a,b) => a.o - b.o);
    let best = { n:0, t:0, from:null, to:null }, cur = { n:0, t:0, from:null, to:null };
    goals.forEach(g => {
      if(g.t === cur.t){ cur.n++; cur.to = g.m; }
      else cur = { n:1, t:g.t, from:g.m, to:g.m };
      if(cur.n > best.n) best = Object.assign({}, cur);
    });
    return { goals, best };
  }

  function timelineHtml(m){
    const { goals, best } = scoreRun(m);
    const timed = goals.filter(g => g.m !== null && g.m !== undefined);
    if(goals.length < 2) return '';
    const W = 100, H = 34;
    const maxMin = Math.max(1, timed.length ? timed[timed.length-1].m : goals.length);
    let diff = 0, maxAbs = 1;
    const pts = goals.map((g, i) => {
      diff += g.t;
      if(Math.abs(diff) > maxAbs) maxAbs = Math.abs(diff);
      const x = timed.length ? ((g.m || 0)/maxMin)*W : (i/(goals.length-1))*W;
      return { x, diff };
    });
    const y = v => (H/2) - (v/maxAbs)*(H/2 - 2);
    // Línea en escalera: el marcador salta, no sube en diagonal.
    let path = `M 0 ${y(0).toFixed(2)}`;
    let prev = 0;
    pts.forEach(p => {
      path += ` L ${p.x.toFixed(2)} ${y(prev).toFixed(2)} L ${p.x.toFixed(2)} ${y(p.diff).toFixed(2)}`;
      prev = p.diff;
    });
    path += ` L ${W} ${y(prev).toFixed(2)}`;
    const halfX = m.halfTime && timed.length ? (m.halfTime/maxMin)*W : null;
    const runText = best.n >= 3
      ? t(best.t > 0 ? 'timeline.bestRunUs' : 'timeline.bestRunThem', { n: best.n })
        + (best.from !== null && best.from !== undefined
            ? t('timeline.bestRunWhen', { desde: best.from, hasta: best.to }) : '')
      : '';
    return `
      <div class="timeline-card">
        <svg class="timeline-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img">
          <title>${esc(t('timeline.title'))}</title>
          <defs>
            <clipPath id="tl-up"><rect x="0" y="0" width="${W}" height="${H/2}"/></clipPath>
            <clipPath id="tl-down"><rect x="0" y="${H/2}" width="${W}" height="${H/2}"/></clipPath>
          </defs>
          <line class="tl-zero" x1="0" y1="${H/2}" x2="${W}" y2="${H/2}"/>
          ${halfX !== null ? `<line class="tl-half" x1="${halfX.toFixed(2)}" y1="0" x2="${halfX.toFixed(2)}" y2="${H}"/>` : ''}
          <!-- La misma línea dos veces, recortada por arriba y por abajo de la
               línea de cero: verde cuando vamos por delante, roja cuando no. -->
          <path class="tl-line up" d="${path}" clip-path="url(#tl-up)"/>
          <path class="tl-line down" d="${path}" clip-path="url(#tl-down)"/>
        </svg>
        <div class="timeline-foot">
          <span class="tl-range">${esc(timed.length ? t('timeline.range', { n: maxMin }) : t('timeline.goalByGoal'))}</span>
          ${runText ? `<span>${esc(runText)}</span>` : ''}
        </div>
      </div>
    `;
  }

  // `unidad` es la clave del diccionario, no la palabra ya montada: la cifra va
  // dentro del texto ("1 gol" / "3 goles") y quién manda en el singular es la
  // propia clave. Antes se pasaba la palabra suelta y salía "1 goles".
  function playerListHtml(team, entries, unidad){
    if(entries.length === 0) return `<div class="hint-text">${esc(t('common.noData'))}</div>`;
    return entries.map(([id, count]) => `
      <div class="stat-list-row">
        <span>${esc(playerLabel(team, id))}</span>
        <span class="count">${esc(t(unidad, { n: count }))}</span>
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

    const ourShots = applyMapFilter(attemptsOf(m, 'rival'), 'rival');
    const theirShots = applyMapFilter(attemptsOf(m, 'own'), 'own');
    return `
      ${topbar({
        left: backBtn('to-matches', t('nav.matches')),
        right: `<button class="back-btn" id="edit-match" aria-label="${esc(t('match.edit'))}" title="${esc(t('match.edit'))}">${icon('pencil')}</button>`
      })}
      <main>
        ${pageTitle(t('match.vs', { rival: m.rival }),
                    shortDate(m.date) + (m.halfTime !== null ? ' · ' + t('match.halfTimeAt', { n: m.halfTime }) : ''))}
        <div class="card score-hero">
          <div class="score-hero-num">${gf} – ${ga}</div>
          <div class="score-hero-lbl">${esc(team.name)} · ${esc(m.rival)}</div>
        </div>
        ${state.editingMatch ? editMatchHtml(m) + annotationsHtml(team, m) : ''}
        ${timelineHtml(m)}

        <div class="section-label">${esc(t('match.ourShots'))}</div>
        <div class="stat-grid">
          <div class="stat-cell"><div class="num" style="color:var(--goal)">${gf}</div><div class="lbl">${esc(t('match.goals'))}</div></div>
          <div class="stat-cell"><div class="num" style="color:var(--save)">${sv_r}</div><div class="lbl">${esc(t('match.savedByRival'))}</div></div>
          <div class="stat-cell"><div class="num" style="color:var(--out)">${out_r}</div><div class="lbl">${esc(t('match.outAndPosts'))}</div></div>
          <div class="stat-cell"><div class="num">${effR}%</div><div class="lbl">${esc(t('match.efficiency'))}</div></div>
        </div>
        ${miniGrid(m.shotsRival)}

        <div class="section-label">${esc(t('match.scorers'))}</div>
        <div class="card">${playerListHtml(team, groupByPlayer(m.shotsRival, 'goal'), 'match.goalsUnit')}</div>

        <div class="section-label">${esc(t('match.whereWeShoot'))} <small>${esc(t('match.goalsPerShots'))}</small></div>
        ${mapFilterHtml(team, m, 'rival')}
        ${shotMapHtml(ourShots, 'mapRival')}
        <div class="card">${originStatsHtml(ourShots)}</div>

        <div class="section-label">${esc(t('match.whereInGoal'))} <small>${esc(t('match.fromEachZone'))}</small></div>
        ${crossMatrixHtml(attemptsOf(m, 'rival'))}

        <div class="section-label">${esc(t('match.rivalShots'))}</div>
        <div class="stat-grid">
          <div class="stat-cell"><div class="num" style="color:var(--out)">${ga}</div><div class="lbl">${esc(t('match.conceded'))}</div></div>
          <div class="stat-cell"><div class="num" style="color:var(--save)">${sv_o}</div><div class="lbl">${esc(t('match.ourSaves'))}</div></div>
          <div class="stat-cell"><div class="num">${out_o}</div><div class="lbl">${esc(t('match.rivalOut'))}</div></div>
          <div class="stat-cell"><div class="num">${effO}%</div><div class="lbl">${esc(t('match.savePct'))}</div></div>
        </div>
        ${miniGrid(m.shotsOwn)}

        <div class="section-label">${esc(t('match.keepers'))} <small>${esc(t('match.savesPerFaced'))}</small></div>
        <div class="card">${keeperStatsHtml(team, m)}</div>

        <div class="section-label">${esc(t('match.whereTheyShoot'))} <small>${esc(t('match.goalsPerShots'))}</small></div>
        ${mapFilterHtml(team, m, 'own')}
        ${shotMapHtml(theirShots, 'mapOwn')}
        <div class="card">${originStatsHtml(theirShots)}</div>

        <div class="section-label">${esc(t('match.plusMinus'))} <small>${esc(t('match.plusMinusSub'))}</small></div>
        <div class="card">${plusMinusHtml(team, m)}</div>

        <div class="section-label">${esc(t('match.otherRecords'))}</div>
        <div class="card">${eventStatsHtml(team, m)}</div>

        <div class="section-label">${esc(t('match.share'))}</div>
        <div class="export-row">
          <button class="secondary slim" id="share-match">${icon('share')} ${esc(t('match.shareImage'))}</button>
          <button class="secondary slim" id="csv-match">${esc(t('match.downloadCsv'))}</button>
        </div>
      </main>
    `;
  }

  function editMatchHtml(m){
    return `
      <div class="card edit-card">
        <div class="card-title">${esc(t('match.edit'))}</div>
        <div class="field">
          <label for="edit-rival">${esc(t('match.rival'))}</label>
          <input id="edit-rival" type="text" maxlength="80" value="${esc(m.rival)}">
        </div>
        <div class="field">
          <label for="edit-date">${esc(t('match.date'))}</label>
          <input id="edit-date" type="date" value="${esc(m.date)}">
        </div>
        <div class="field">
          <label for="edit-halftime">${esc(t('match.halfTimeMinute'))}</label>
          <input id="edit-halftime" type="number" min="0" max="200" placeholder="${esc(t('match.halfTimeEmpty'))}"
                 value="${m.halfTime === null || m.halfTime === undefined ? '' : esc(m.halfTime)}">
        </div>
        ${state.formError ? `<div class="error-msg">${esc(state.formError)}</div>` : ''}
        <div class="export-row">
          <button class="primary slim" id="save-match-edit">${esc(t('common.saveChanges'))}</button>
          <button class="secondary slim" id="cancel-match-edit">${esc(t('common.cancel'))}</button>
        </div>
        <button class="danger slim" id="delete-match">${icon('trash')} ${esc(t('match.deleteBtn'))}</button>
      </div>
    `;
  }

  // ---------- corregir lo anotado ----------
  //
  // Anotando en vivo se cuela un gol del jugador que no era o un tiro de más, y
  // hasta ahora la única salida era borrar el partido entero y volverlo a meter.
  // Aquí está todo lo que se registró, en el orden real —tiros y eventos
  // comparten el ordinal, así que ordenar por él devuelve el partido tal y como
  // se anotó— y cada anotación se puede quitar.
  //
  // Corregir es borrar y volver a anotar. No hay edición de la fila porque
  // habría que repetir aquí el modal de jugador, el de zona y el punto de la
  // pista, y con dos toques se consigue lo mismo.

  // 'in' y 'out' no salen en las estadísticas de eventos, pero aquí sí se
  // listan: son parte de lo anotado y de ellos sale el más/menos. Sus nombres
  // están en el diccionario junto a los demás (event.in, event.out).

  function annotationEntries(m){
    const out = [];
    const add = (list, side) => (list || []).forEach(shot => out.push({ shot, side }));
    add(m.shotsRival, 'rival');
    add(m.missRival, 'rival');
    add(m.shotsOwn, 'own');
    add(m.missOwn, 'own');
    (m.events || []).forEach(event => out.push({ event }));
    const ordinal = e => ((e.shot || e.event).ordinal) || 0;
    return out.sort((a, b) => ordinal(a) - ordinal(b));
  }

  function annotationText(team, e){
    if(e.event){
      const name = eventName(e.event.type);
      return e.event.player
        ? t('annot.withPlayer', { que: name, quien: playerShort(team, e.event.player) })
        : name;
    }
    const s = e.shot;
    const clave = 'annot.' + e.side + '.' + s.type;
    const base = I18N.DICTS.es[clave] === undefined ? t('annot.shot') : t(clave);
    // De los tiros nuestros interesa quién lanzó; de los del rival, qué portero
    // nuestro lo recibió, que es lo único de los nuestros que hay en ellos.
    if(e.side === 'rival'){
      return s.player ? t('annot.by', { que: base, quien: playerShort(team, s.player) }) : base;
    }
    return s.keeper ? t('annot.keeper', { que: base, quien: playerShort(team, s.keeper) }) : base;
  }

  function annotationWhen(x){
    const min = x.minute, per = x.period;
    if(min === null || min === undefined) return per ? t('annot.half', { n: per }) : '';
    return per ? t('annot.minuteHalf', { n: min, parte: per }) : t('annot.minute', { n: min });
  }

  function annotationsHtml(team, m){
    const entries = annotationEntries(m);
    const rows = entries.length ? entries.map(e => {
      const dato = e.shot || e.event;
      const attr = e.shot ? 'data-del-shot' : 'data-del-event';
      return `
        <div class="stat-list-row">
          <span>${esc(annotationText(team, e))}<small class="who">${esc(annotationWhen(dato))}</small></span>
          <button class="icon-btn" ${attr}="${dato.id}" title="${esc(t('annot.delete'))}" aria-label="${esc(t('annot.delete'))}">✕</button>
        </div>
      `;
    }).join('') : `<div class="hint-text">${esc(t('annot.empty'))}</div>`;
    return `
      <div class="section-label">${esc(t('annot.title'))} <small>${esc(t('annot.titleSub'))}</small></div>
      <div class="card">${rows}</div>
    `;
  }

  function handleDeleteAnnotation(tipo, id){
    if(tipo === 'shot') Store.deleteShot(id);
    else Store.deleteEvent(id);
    reloadMatches();
    render();
    toast(t('annot.deleted'));
  }

  function handleSaveMatchEdit(){
    const rival = document.getElementById('edit-rival').value.trim();
    const date = document.getElementById('edit-date').value;
    if(!rival || !date){
      state.formError = t('match.needRivalDate');
      render();
      return;
    }
    if(rival.length > 80){
      state.formError = t('match.rivalTooLong');
      render();
      return;
    }
    // El minuto del descanso se marca con un botón en mitad del partido y es
    // fácil pulsarlo tarde. Vacío no es el minuto 0: es un partido sin descanso
    // marcado, y así se guarda.
    const halfRaw = document.getElementById('edit-halftime').value.trim();
    const halfTime = halfRaw === '' ? null : parseInt(halfRaw, 10);
    if(halfTime !== null && (!Number.isInteger(halfTime) || halfTime < 0)){
      state.formError = t('match.badHalfTime');
      render();
      return;
    }
    Store.updateMatch(state.currentMatchId, { rival, date, halfTime });
    state.formError = '';
    state.editingMatch = false;
    reloadMatches();
    render();
    toast(t('match.saved'));
  }

  function handleDeleteMatch(){
    const m = state.matches.find(mm => mm.id === state.currentMatchId);
    if(!m) return;
    if(!confirm(t('match.deleteAsk', { rival: m.rival }))) return;
    Store.deleteMatch(state.currentMatchId);
    state.editingMatch = false;
    state.currentMatchId = null;
    reloadMatches();
    state.screen = 'matchList';
    render();
    toast(t('match.deleted'));
  }

  // ---------- TEMPORADA ----------
  //
  // El acumulado de todos los partidos del equipo. Se calcula aquí y no con una
  // consulta a Postgres porque el espejo local ya tiene todos los datos: así
  // sale igual de rápido, funciona sin cobertura y no hay una segunda forma de
  // contar lo mismo que pueda acabar diciendo otra cosa que la ficha de partido.

  function seasonStats(team, matches){
    const s = {
      played: matches.length, won:0, drawn:0, lost:0,
      gf:0, ga:0, attempts:0, faced:0, saves:0,
      scorers:{}, keepers:{}, origins:{}, plus:{}, events:{}
    };
    matches.forEach(m => {
      const gf = m.shotsRival.filter(x => x.type === 'goal').length;
      const ga = m.shotsOwn.filter(x => x.type === 'goal').length;
      s.gf += gf; s.ga += ga;
      if(gf > ga) s.won++; else if(gf < ga) s.lost++; else s.drawn++;
      s.attempts += attemptsOf(m, 'rival').length;
      s.faced += m.shotsOwn.length;
      s.saves += m.shotsOwn.filter(x => x.type === 'save').length;

      m.shotsRival.forEach(x => {
        if(x.type !== 'goal') return;
        const k = x.player || 'none';
        s.scorers[k] = (s.scorers[k] || 0) + 1;
      });
      m.shotsOwn.forEach(x => {
        const k = x.keeper || 'none';
        const e = s.keepers[k] = s.keepers[k] || { faced:0, saves:0 };
        e.faced++;
        if(x.type === 'save') e.saves++;
      });
      attemptsOf(m, 'rival').forEach(x => {
        const z = shotZone(x);
        if(!z) return;
        const e = s.origins[z] = s.origins[z] || { n:0, goals:0 };
        e.n++;
        if(x.type === 'goal') e.goals++;
      });
      const pm = plusMinus(m);
      Object.keys(pm).forEach(id => {
        const e = s.plus[id] = s.plus[id] || { plus:0, minus:0 };
        e.plus += pm[id].plus;
        e.minus += pm[id].minus;
      });
      (m.events || []).forEach(ev => {
        if(ev.type === 'in' || ev.type === 'out') return;
        s.events[ev.type] = (s.events[ev.type] || 0) + 1;
      });
    });
    return s;
  }

  function renderSeason(){
    const team = currentTeam();
    const matches = state.matches;
    if(matches.length === 0){
      return `
        ${topbar({ left: backBtn('to-team', team.name) })}
        <main>
          ${pageTitle(t('season.title'), team.name)}
          <div class="empty-state">
            <div class="big-num">${esc(t('season.empty'))}</div>
            ${esc(t('season.emptyHint'))}
          </div>
        </main>
      `;
    }
    const s = seasonStats(team, matches);
    const per = n => (n / s.played).toFixed(1).replace('.', t('number.decimal'));
    const eff = s.attempts ? Math.round(s.gf/s.attempts*100) : 0;
    const savePct = s.faced ? Math.round(s.saves/s.faced*100) : 0;

    const scorers = Object.keys(s.scorers).sort((a,b) => s.scorers[b] - s.scorers[a]);
    const keepers = Object.keys(s.keepers).sort((a,b) => s.keepers[b].faced - s.keepers[a].faced);
    const pmIds = Object.keys(s.plus)
      .sort((a,b) => (s.plus[b].plus - s.plus[b].minus) - (s.plus[a].plus - s.plus[a].minus));

    const list = (rows, vacio) => rows.length ? rows.join('') : `<div class="hint-text">${esc(vacio)}</div>`;

    return `
      ${topbar({ left: backBtn('to-team', team.name) })}
      <main>
        ${pageTitle(t('season.title'), `${team.name} · ${t('season.played', { n: s.played })}`)}

        <div class="card score-hero">
          <div class="score-hero-num">${s.won}–${s.drawn}–${s.lost}</div>
          <div class="score-hero-lbl">${esc(t('season.record'))}</div>
        </div>

        <div class="section-label">${esc(t('season.total'))}</div>
        <div class="stat-grid">
          <div class="stat-cell"><div class="num" style="color:var(--goal)">${s.gf}</div><div class="lbl">${esc(t('season.goalsFor', { n: per(s.gf) }))}</div></div>
          <div class="stat-cell"><div class="num" style="color:var(--out)">${s.ga}</div><div class="lbl">${esc(t('season.goalsAgainst', { n: per(s.ga) }))}</div></div>
          <div class="stat-cell"><div class="num">${eff}%</div><div class="lbl">${esc(t('season.effIn', { n: s.attempts }))}</div></div>
          <div class="stat-cell"><div class="num" style="color:var(--save)">${savePct}%</div><div class="lbl">${esc(t('season.savesIn', { n: s.faced }))}</div></div>
        </div>

        <div class="section-label">${esc(t('season.scorers'))} <small>${esc(t('season.wholeSeason'))}</small></div>
        <div class="card">${list(scorers.map(id => `
          <div class="stat-list-row">
            <span>${esc(playerLabel(team, id))}</span>
            <span class="count">${s.scorers[id]} <small>${esc(t('season.perMatch', { n: per(s.scorers[id]) }))}</small></span>
          </div>`), t('season.noScorers'))}</div>

        <div class="section-label">${esc(t('match.keepers'))} <small>${esc(t('match.savesPerFaced'))}</small></div>
        <div class="card">${list(keepers.map(id => {
          const e = s.keepers[id];
          return `
            <div class="stat-list-row">
              <span>${esc(playerLabel(team, id))}</span>
              <span class="count">${e.saves}/${e.faced} · ${e.faced ? Math.round(e.saves/e.faced*100) : 0}%</span>
            </div>`;
        }), t('season.noFaced'))}</div>

        <div class="section-label">${esc(t('season.bestZones'))} <small>${esc(t('match.goalsPerShots'))}</small></div>
        <div class="card">${list(ORIGINS.filter(id => s.origins[id]).map(id => {
          const e = s.origins[id];
          return `
            <div class="stat-list-row">
              <span>${esc(originName(id))}</span>
              <span class="count">${e.goals}/${e.n} · ${Math.round(e.goals/e.n*100)}%</span>
            </div>`;
        }), t('season.noOrigins'))}</div>

        <div class="section-label">${esc(t('season.plusMinus'))}</div>
        <div class="card">${list(pmIds.map(id => {
          const e = s.plus[id], diff = e.plus - e.minus;
          return `
            <div class="stat-list-row">
              <span>${esc(playerLabel(team, id))}</span>
              <span class="count ${diff > 0 ? 'good' : (diff < 0 ? 'bad' : '')}">
                ${diff > 0 ? '+' : ''}${diff} <small>${e.plus}·${e.minus}</small>
              </span>
            </div>`;
        }), t('season.noPlusMinus'))}</div>

        <div class="section-label">${esc(t('match.otherRecords'))}</div>
        <div class="card">${list(eventTypesIn(s.events).map(tipo => `
          <div class="stat-list-row">
            <span>${esc(eventName(tipo))}</span>
            <span class="count">${s.events[tipo]}</span>
          </div>`), t('season.noEvents'))}</div>
      </main>
    `;
  }

  // ---------- EXPORTAR ----------
  //
  // Dos formas de sacar un partido de la app: el CSV para quien quiera hacer
  // sus cuentas en una hoja de cálculo, y una imagen para el grupo del equipo,
  // que es por donde de verdad circulan estas cosas.

  // Guardar un archivo. En el navegador es un enlace con `download`; dentro de
  // la app de móvil eso no hace nada —no hay carpeta de descargas ni barra del
  // navegador— y hay que escribirlo con Filesystem.
  async function saveBlob(blob, filename){
    if(window.Native && Native.isNative()){
      const ruta = await Native.saveFile(blob, filename);
      if(ruta){ toast(t('share.savedTo', { archivo: filename })); return; }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Sin esto el objeto se queda en memoria hasta recargar la página.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(t('share.downloaded'));
  }

  function csvCell(v){
    const s = v === null || v === undefined ? '' : String(v);
    return /[",;\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s;
  }

  function slug(s){
    return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'')
      .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || t('csv.fileName');
  }

  function matchCsv(team, m){
    // Punto y coma: es lo que espera un Excel en español, que es donde va a
    // acabar esto.
    //
    // Las cabeceras y las palabras de las columnas de texto sí se traducen: el
    // CSV lo abre una persona, no la app, y no se vuelve a leer desde aquí. Lo
    // que no cambia es la columna `resultado` de los tiros (goal/save/out/post)
    // ni la zona de pista (EI, LI…), que son los mismos códigos que guarda la
    // base y lo que hace que dos exportaciones se puedan juntar.
    const head = ['csv.type','csv.period','csv.minute','csv.side','csv.result',
                  'csv.goalZone','csv.player','csv.dorsal','csv.courtZone',
                  'csv.originX','csv.originY'].map(k => t(k));
    const lines = [head.join(';')];
    const nameOf = id => {
      const p = team.players.find(pp => pp.id === id);
      return p ? [p.name, p.dorsal] : ['', ''];
    };
    const pushShot = (side, s) => {
      const who = nameOf(side === 'own' ? s.keeper : s.player);
      lines.push([
        t('csv.shot'), s.period, s.minute, t(side === 'own' ? 'csv.ourGoal' : 'csv.rivalGoal'),
        s.type, s.zone, who[0], who[1], shotZone(s) || '',
        s.origin ? s.origin.x : '', s.origin ? s.origin.y : ''
      ].map(csvCell).join(';'));
    };
    attemptsOf(m, 'rival').sort((a,b)=>a.ordinal-b.ordinal).forEach(s => pushShot('rival', s));
    attemptsOf(m, 'own').sort((a,b)=>a.ordinal-b.ordinal).forEach(s => pushShot('own', s));
    (m.events || []).forEach(e => {
      const who = nameOf(e.player);
      lines.push([
        t('csv.event'), e.period, e.minute, '', eventName(e.type), '',
        who[0], who[1], '', '', ''
      ].map(csvCell).join(';'));
    });
    return lines.join('\n');
  }

  async function downloadMatchCsv(){
    const team = currentTeam();
    const m = state.matches.find(mm => mm.id === state.currentMatchId);
    if(!m) return;
    // El BOM es lo que hace que Excel abra las tildes bien.
    const blob = new Blob(['﻿' + matchCsv(team, m)], { type:'text/csv;charset=utf-8' });
    await saveBlob(blob, `${slug(team.name)}-${slug(m.rival)}-${m.date}.csv`);
  }

  // El resumen dibujado a mano en un canvas: sin librerías y con la misma
  // tipografía del sistema que el resto de la app.
  function matchSummaryCanvas(team, m){
    const W = 1080, H = 1350, c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    const gf = m.shotsRival.filter(s=>s.type==='goal').length;
    const ga = m.shotsOwn.filter(s=>s.type==='goal').length;

    g.fillStyle = '#08090B'; g.fillRect(0,0,W,H);
    g.fillStyle = gf > ga ? 'rgba(51,161,127,0.16)' : (gf < ga ? 'rgba(193,68,58,0.16)' : 'rgba(138,143,152,0.12)');
    g.fillRect(0,0,W,420);

    const font = (size, weight) => {
      g.font = `${weight||400} ${size}px -apple-system, "Segoe UI", Roboto, system-ui, sans-serif`;
    };
    const center = (text, y) => g.fillText(text, W/2 - g.measureText(text).width/2, y);

    // la marca
    g.fillStyle = '#D9182B';
    roundRect(g, W/2 - 150, 70, 56, 56, 12); g.fill();
    g.fillStyle = '#F5F5F7';
    [[12,30,10,14],[26,22,10,22],[40,12,10,32]].forEach(b => {
      roundRect(g, W/2 - 150 + b[0], 70 + b[1], b[2], b[3], 3); g.fill();
    });
    font(38, 700);
    g.fillText('SuperStat', W/2 - 80, 112);

    font(140, 700);
    g.fillStyle = '#F5F5F7';
    center(`${gf} – ${ga}`, 290);
    font(32, 600);
    g.fillStyle = '#8A8F98';
    center(`${team.name}  ·  ${m.rival}`, 350);
    font(26, 400);
    center(shortDate(m.date) + (m.halfTime !== null ? '  ·  ' + t('match.halfTimeAt', { n: m.halfTime }) : ''), 392);

    // cuadro de cifras
    const attempts = attemptsOf(m, 'rival').length;
    const savesOwn = m.shotsOwn.filter(s=>s.type==='save').length;
    const facedOwn = m.shotsOwn.length;
    const cells = [
      [t('share.efficiency'), attempts ? Math.round(gf/attempts*100) + '%' : '—'],
      [t('share.shots'), String(attempts)],
      [t('share.saves'), String(savesOwn)],
      [t('share.savePct'), facedOwn ? Math.round(savesOwn/facedOwn*100) + '%' : '—']
    ];
    cells.forEach((cell, i) => {
      const x = 60 + (i % 2) * 500, y = 480 + Math.floor(i/2) * 150;
      g.fillStyle = '#141619';
      roundRect(g, x, y, 460, 125, 18); g.fill();
      g.fillStyle = '#F5F5F7'; font(52, 700);
      g.fillText(cell[1], x + 28, y + 68);
      g.fillStyle = '#8A8F98'; font(24, 400);
      g.fillText(cell[0], x + 28, y + 102);
    });

    // goleadores
    let y = 810;
    g.fillStyle = '#8A8F98'; font(24, 600);
    g.fillText(t('share.scorers'), 60, y);
    y += 46;
    const scorers = groupByPlayer(m.shotsRival, 'goal').slice(0, 7);
    if(scorers.length === 0){
      g.fillStyle = '#8A8F98'; font(28, 400);
      g.fillText(t('share.noScorers'), 60, y + 10);
    }
    scorers.forEach(entry => {
      g.fillStyle = '#F5F5F7'; font(30, 500);
      g.fillText(playerLabel(team, entry[0]), 60, y);
      g.fillStyle = '#E8B84B'; font(30, 700);
      const texto = t('share.goal', { n: entry[1] });
      g.fillText(texto, W - 60 - g.measureText(texto).width, y);
      g.fillStyle = '#1C1F24';
      g.fillRect(60, y + 16, W - 120, 1);
      y += 62;
    });

    g.fillStyle = '#8A8F98'; font(22, 400);
    center(t('share.madeWith'), H - 60);
    return c;
  }

  function roundRect(g, x, y, w, h, r){
    g.beginPath();
    g.moveTo(x+r, y);
    g.arcTo(x+w, y, x+w, y+h, r);
    g.arcTo(x+w, y+h, x, y+h, r);
    g.arcTo(x, y+h, x, y, r);
    g.arcTo(x, y, x+w, y, r);
    g.closePath();
  }

  async function shareMatchImage(){
    const team = currentTeam();
    const m = state.matches.find(mm => mm.id === state.currentMatchId);
    if(!m) return;
    const canvas = matchSummaryCanvas(team, m);
    const blob = await new Promise(ok => canvas.toBlob(ok, 'image/png'));
    if(!blob){ toast(t('share.failed')); return; }
    const name = `${slug(team.name)}-${slug(m.rival)}-${m.date}.png`;
    const titulo = `${team.name} – ${m.rival}`;

    // Dentro de la app, la hoja de compartir la abre el sistema: navigator.share
    // no existe en el WebView de Android.
    if(window.Native && Native.isNative()){
      try{
        const hecho = await Native.shareFile(blob, name, titulo);
        if(hecho !== null) return;    // compartido o cancelado; en ambos, listo
      }catch(e){
        console.warn('no se pudo compartir', e);
      }
    }

    const file = new File([blob], name, { type:'image/png' });
    // En el móvil se abre la hoja de compartir; en el escritorio, que casi
    // nunca la tiene, se descarga y ya la manda el usuario por donde quiera.
    if(navigator.canShare && navigator.canShare({ files:[file] })){
      try{
        await navigator.share({ files:[file], title: titulo });
        return;
      }catch(e){
        if(e && e.name === 'AbortError') return;   // lo ha cancelado el usuario
      }
    }
    await saveBlob(blob, name);
  }

  // ---------- NEW MATCH SETUP ----------
  function renderNewMatchSetup(){
    const team = currentTeam();
    return `
      ${topbar({ left: backBtn('to-team', t('common.cancel')) })}
      <main>
        ${pageTitle(t('setup.title'), team.name)}
        <div class="field">
          <label for="rival-name">${esc(t('setup.rivalName'))}</label>
          <input id="rival-name" type="text" maxlength="80" placeholder="${esc(t('setup.rivalHint'))}">
        </div>
        <div class="field">
          <label for="match-date">${esc(t('setup.date'))}</label>
          <input id="match-date" type="date" value="${new Date().toISOString().slice(0,10)}">
        </div>
        ${state.formError ? `<div class="error-msg">${esc(state.formError)}</div>` : ''}
        <button class="primary" id="start-match-btn">${esc(t('setup.start'))}</button>
      </main>
    `;
  }

  async function handleStartMatch(){
    const rival = document.getElementById('rival-name').value.trim();
    const date = document.getElementById('match-date').value;
    if(!rival || !date){
      state.formError = t('match.needRivalDate');
      render();
      return;
    }
    if(rival.length > 80){
      state.formError = t('match.rivalTooLong');
      render();
      return;
    }
    state.formError = '';
    state.draft = newDraft(state.currentTeamId, rival, date);
    state.pendingShot = null;
    state.pendingEvent = null;
    state.screen = 'liveMatch';
    saveDraft();
    render();
  }

  function newDraft(teamId, rival, date){
    return {
      id: Store.uuid(),
      teamId,
      rival,
      date,
      shotsOwn: [],   // tiros a NUESTRA portería (tira el rival)
      shotsRival: [], // tiros a la portería RIVAL (tiramos nosotros)
      missOwn: [],    // fuera y palo del rival
      missRival: [],  // fuera y palo nuestros
      events: [],     // asistencias, pérdidas, tarjetas, altas y bajas de pista
      askOrigin: true,// preguntar desde qué punto de la pista se ha lanzado
      seq: 0,         // ordinal compartido por tiros y eventos
      period: 1,
      halfTime: null, // minuto en que se dio por acabada la primera parte
      clock: { running:false, elapsed:0, since:null },
      keeper: null,   // portero nuestro en pista
      onCourt: [],    // jugadores nuestros en pista
      log: []         // orden de lo anotado, para deshacer
    };
  }

  // ---------- reloj del partido ----------
  //
  // El tiempo corre de verdad: `since` es la hora del reloj del aparato en que
  // se puso en marcha, así que si el navegador descarta la pestaña y se vuelve,
  // el partido sigue en el minuto que le toca en vez de donde se quedó.
  //
  // Es un único cronómetro que no se reinicia en el descanso: la segunda parte
  // sigue contando desde donde acabó la primera y `halfTime` guarda el corte.
  // Un partido de dos partes de 25 no es raro, y así no hay que dar por hecho
  // ninguna duración.

  function clockMs(d){
    const c = (d || state.draft).clock;
    return c.elapsed + (c.running && c.since ? Date.now() - c.since : 0);
  }

  function clockMinute(d){
    return Math.floor(clockMs(d) / 60000);
  }

  function clockText(d){
    const total = Math.floor(clockMs(d) / 1000);
    return `${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;
  }

  function toggleClock(){
    const c = state.draft.clock;
    if(c.running){
      c.elapsed = clockMs();
      c.running = false;
      c.since = null;
    } else {
      c.running = true;
      c.since = Date.now();
    }
    saveDraft();
    render();
  }

  // El usuario decide cuándo se acaba la primera parte, así que esto es un
  // botón y no una cuenta atrás. Deja el reloj parado, como en el descanso.
  function endFirstHalf(){
    const d = state.draft;
    if(d.period !== 1) return;
    d.halfTime = clockMinute(d);
    d.period = 2;
    d.clock.elapsed = clockMs(d);
    d.clock.running = false;
    d.clock.since = null;
    saveDraft();
    render();
    toast(t('live.halfEnded', { n: d.halfTime }));
  }

  // Cada anotación se queda con el minuto y la parte en que se hizo, y con un
  // ordinal único dentro del partido: es lo que permite reconstruir después el
  // orden real de todo y saber quién estaba en pista en cada gol.
  function stamp(){
    const d = state.draft;
    return { minute: clockMinute(d), period: d.period, ordinal: d.seq++ };
  }

  function saveDraft(){
    Store.saveDraft(state.draft);
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
    const miss = side === 'own' ? state.draft.missOwn : state.draft.missRival;
    const outs = miss.filter(s=>s.type==='out').length;
    const posts = miss.filter(s=>s.type==='post').length;
    return `
      <div class="goal-block">
        <div class="goal-header">
          <div class="goal-title">${esc(label)}</div>
          <div class="goal-sub">${esc(sub)}</div>
          <div class="goal-tally">${esc(t('live.tally', { g: goals, p: saves, f: outs })
            + (posts ? t('live.tallyPost', { n: posts }) : ''))}</div>
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
          <div class="goal-ground"></div>
        </div>
        <div class="goal-actions">
          <button class="btn-out" data-out="${side}">${esc(t('live.out'))}</button>
          <button class="btn-post" data-post="${side}">${esc(t('live.post'))}</button>
          <button class="btn-undo" data-undo="${side}">${esc(t('live.undo'))}</button>
        </div>
      </div>
    `;
  }

  const SHOT_ON_TARGET = { goal:true, save:true };

  function sortedPlayers(list){
    return list.slice().sort((a,b) => a.dorsal - b.dorsal);
  }

  function keepersOf(team){
    return sortedPlayers(team.players.filter(p => p.position === GOALKEEPER));
  }

  // Quién hay que preguntar antes de anotar el tiro.
  //
  // Los tiros nuestros (side 'rival') preguntan siempre el tirador, entre o no:
  // sin eso no hay porcentaje de acierto por jugador, solo goles. Los del rival
  // no preguntan tirador porque su plantilla no se lleva en la app; lo que hace
  // falta ahí es nuestro portero, y ese se fija una vez y se queda puesto.
  function candidatesFor(side, type){
    const team = currentTeam();
    if(side === 'rival') return sortedPlayers(team.players);
    if(SHOT_ON_TARGET[type] && !state.draft.keeper) return keepersOf(team);
    return [];
  }

  // El mismo paso de elegir jugador sirve para el tirador y para el portero: lo
  // que cambia es qué se hace con la respuesta, y eso lo dice `role`.
  function playerRoleFor(side, type){
    return side === 'own' && SHOT_ON_TARGET[type] ? 'keeper' : 'shooter';
  }

  const SHOT_TITLE = { goal:'ask.goal', save:'ask.save', out:'ask.out', post:'ask.post' };

  function renderPlayerStep(p){
    const title = p.role === 'keeper'
      ? t('ask.keeper')
      : t(SHOT_TITLE[p.type] || 'ask.player');
    const sub = p.role === 'keeper' ? t('ask.keeperSub') : '';
    const btns = p.candidates.map(pl => `
      <button class="modal-player-btn" data-select-player="${pl.id}">
        <span class="dorsal-mini">${pl.dorsal}</span> ${esc(pl.name)}
      </button>
    `).join('');
    return `
      <div class="modal-title">${esc(title)}</div>
      ${sub ? `<div class="modal-sub">${esc(sub)}</div>` : ''}
      ${btns}
      <button class="modal-skip-btn" id="skip-player-btn">${esc(t('common.unspecified'))}</button>
    `;
  }

  function renderEventModal(){
    const p = state.pendingEvent;
    if(!p) return '';
    const btns = p.candidates.map(pl => `
      <button class="modal-player-btn" data-event-player="${pl.id}">
        <span class="dorsal-mini">${pl.dorsal}</span> ${esc(pl.name)}
      </button>
    `).join('');
    return `
      <div class="modal-overlay" id="event-modal">
        <div class="modal-box">
          <div class="modal-title">${esc(eventName(p.type))}</div>
          <div class="modal-sub">${esc(t('ask.whichPlayer'))}</div>
          ${btns}
          <button class="modal-skip-btn" id="skip-event-player">${esc(t('common.unspecified'))}</button>
          <button class="modal-cancel-btn" id="cancel-event-btn">${esc(t('common.cancelNoRecord'))}</button>
        </div>
      </div>
    `;
  }

  function renderOriginStep(p){
    const team = currentTeam();
    const who = p.side === 'own' ? state.draft.rival : team.name;
    return `
      <div class="modal-title">${esc(t('ask.origin'))}</div>
      <div class="modal-sub">${esc(t('ask.originSub', { quien: who }))}</div>
      ${courtSvg({ interactive:true, id:'pick' })}
      <button class="modal-skip-btn" id="skip-origin-btn">${esc(t('common.unspecified'))}</button>
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
          <button class="modal-cancel-btn" id="cancel-shot-btn">${esc(t('common.cancelNoRecord'))}</button>
        </div>
      </div>
    `;
  }

  function playerById(id){
    const team = currentTeam();
    return team.players.find(p => p.id === id) || null;
  }

  function playerChip(p, on, attr){
    return `
      <button class="court-chip${on ? ' on' : ''}" ${attr}="${p.id}">
        <span class="dorsal-mini">${p.dorsal}</span>${esc(p.name.split(/\s+/)[0])}
      </button>
    `;
  }

  function clockHtml(){
    const d = state.draft;
    const running = d.clock.running;
    return `
      <div class="clock-bar">
        <button class="clock-play${running ? ' on' : ''}" id="toggle-clock"
                aria-label="${esc(running ? t('live.clockStop') : t('live.clockStart'))}">
          ${running ? icon('pause') : icon('play')}
        </button>
        <div class="clock-read">
          <div class="clock-time" id="clock-time">${clockText(d)}</div>
          <div class="clock-period">${esc(t('live.half', { n: d.period })
            + (d.halfTime !== null ? ' · ' + t('match.halfTimeAt', { n: d.halfTime }) : ''))}</div>
        </div>
        ${d.period === 1
          ? `<button class="clock-half" id="end-half-btn">${esc(t('live.endFirstHalf'))}</button>`
          : `<span class="clock-half done">${esc(t('live.half', { n: 2 }))}</span>`}
      </div>
    `;
  }

  // Quién está en portería y quién en pista. Fijar el portero es lo que hace que
  // los goles encajados tengan dueño y que el porcentaje de paradas signifique
  // algo; marcar los siete de pista es lo que permite calcular el más/menos.
  function lineupHtml(){
    const team = currentTeam();
    const d = state.draft;
    const keepers = keepersOf(team);
    const field = sortedPlayers(team.players.filter(p => p.position !== GOALKEEPER));
    const onCount = d.onCourt.length;
    return `
      <div class="section-label">
        ${esc(t('live.inGoal'))}
        ${d.keeper ? '' : `<small>${esc(t('live.keeperUnset'))}</small>`}
      </div>
      <div class="chip-row">
        ${keepers.length
          ? keepers.map(p => playerChip(p, d.keeper === p.id, 'data-keeper')).join('')
          : `<div class="hint-text">${esc(t('live.noKeepers'))}</div>`}
      </div>

      <div class="section-label">
        ${esc(t('live.onCourt'))}
        <small>${onCount}/${ON_COURT_MAX}${onCount > ON_COURT_MAX ? esc(t('live.tooMany')) : ''}</small>
      </div>
      <div class="chip-row">
        ${field.length
          ? field.map(p => playerChip(p, d.onCourt.indexOf(p.id) !== -1, 'data-court-player')).join('')
          : `<div class="hint-text">${esc(t('live.noFieldPlayers'))}</div>`}
      </div>
      <div class="hint-text">${esc(t('live.courtHint'))}</div>
    `;
  }

  // "Deshacer pérdida de Marc" / "Undo turnover by Marc". El nombre del evento
  // va en minúscula porque en mitad de la frase no es un título; en los dos
  // idiomas se escribe igual, así que basta con bajarlo.
  function undoEventLabel(ev){
    const que = eventName(ev.type).toLowerCase();
    const quien = ev.player ? (playerById(ev.player) || {}).name : null;
    return quien ? t('live.undoEventOf', { que, quien }) : t('live.undoEvent', { que });
  }

  function eventPadHtml(){
    const last = state.draft.events.filter(e => e.type !== 'in' && e.type !== 'out').slice(-1)[0];
    return `
      <div class="section-label">${esc(t('live.quickLog'))}</div>
      <div class="event-pad">
        ${EVENT_TYPES.map(e => `
          <button class="event-btn tone-${e.tone}" data-event="${e.id}">
            <span class="ev-short">${esc(t('eventShort.' + e.id))}</span>
            <span class="ev-name">${esc(eventName(e.id))}</span>
          </button>
        `).join('')}
      </div>
      ${last ? `
        <button class="secondary slim" id="undo-event-btn">
          ${esc(undoEventLabel(last))}
        </button>` : ''}
    `;
  }

  function renderLiveMatch(){
    const team = currentTeam();
    const d = state.draft;
    const gf = d.shotsRival.filter(s=>s.type==='goal').length;
    const ga = d.shotsOwn.filter(s=>s.type==='goal').length;
    const keeper = d.keeper ? playerById(d.keeper) : null;
    return `
      ${topbar({ right:`<button class="back-btn wide" id="finish-match-btn">${esc(t('live.save'))}</button>` })}
      <main class="live-main">
        <div class="scoreboard">
          <div class="score-box"><div class="num" style="color:var(--goal)">${gf}</div><div class="lbl">${esc(team.name)}</div></div>
          <div class="score-box"><div class="num" style="color:var(--out)">${ga}</div><div class="lbl">${esc(d.rival)}</div></div>
        </div>

        ${clockHtml()}

        <div class="goals-row">
          ${goalGridHtml('own', t('live.ourGoal'), keeper
              ? t('live.keeperIs', { quien: `${keeper.dorsal} ${keeper.name}` })
              : t('live.rivalShoots'))}
          ${goalGridHtml('rival', t('live.rivalGoal'), t('live.weShoot'))}
        </div>
        <div class="hint-text center">${esc(t('live.tapHint'))}</div>

        ${eventPadHtml()}
        ${lineupHtml()}

        <div class="section-label">${esc(t('live.options'))}</div>
        <button class="origin-toggle ${d.askOrigin ? 'on' : ''}" id="toggle-origin">
          <span class="dot"></span>
          <span>${esc(t('live.askOrigin'))}</span>
        </button>

        <button class="secondary" id="cancel-match-btn">${esc(t('live.discard'))}</button>
      </main>
      ${renderPendingModal()}
      ${renderEventModal()}
    `;
  }

  // Un tiro puede necesitar preguntar el jugador, el punto de lanzamiento, las
  // dos cosas o ninguna: se monta la lista de pasos y se van recorriendo.
  function beginShot(side, zone, type){
    const candidates = candidatesFor(side, type);
    const steps = [];
    if(candidates.length > 0) steps.push('player');
    if(state.draft.askOrigin) steps.push('origin');
    if(steps.length === 0){
      registerShot(side, zone, type, null, null);
      return;
    }
    state.pendingShot = {
      side, zone, type, candidates, player:null, origin:null, steps, step:0,
      role: playerRoleFor(side, type)
    };
    render();
  }

  function advancePending(patch){
    const p = state.pendingShot;
    if(!p) return;
    Object.assign(p, patch);
    p.step++;
    if(p.step >= p.steps.length){
      // Si lo que se ha preguntado era el portero, la respuesta no es el autor
      // del tiro: es quién tenemos en portería a partir de ahora.
      if(p.role === 'keeper'){
        if(p.player) state.draft.keeper = p.player;
        p.player = null;
      }
      registerShot(p.side, p.zone, p.type, p.player, p.origin);
    } else {
      render();
    }
  }

  function registerShot(side, zone, type, playerId, origin){
    const d = state.draft;
    const st = stamp();
    const entry = {
      zone: zone === undefined ? null : zone,
      type,
      player: playerId || null,
      origin: origin || null,
      minute: st.minute, period: st.period, ordinal: st.ordinal
    };
    // Los tiros a nuestra portería llevan el portero que estaba en ese momento,
    // vayan dentro o los pare: sin el denominador no hay porcentaje de paradas.
    if(side === 'own') entry.keeper = d.keeper || null;
    const onTarget = Boolean(SHOT_ON_TARGET[type]);
    const arr = side === 'own'
      ? (onTarget ? d.shotsOwn : d.missOwn)
      : (onTarget ? d.shotsRival : d.missRival);
    arr.push(entry);
    d.log.push({ side, kind: onTarget ? 'shot' : 'miss' });
    state.pendingShot = null;
    saveDraft();
    render();
    // El destello va después del render, colgado del DOM que el usuario está
    // viendo. No es adorno: los tiros que no preguntan nada —el rival a nuestra
    // portería con el portero ya fijado y el punto de pista apagado— se
    // registran al toque, y sin esto lo único que cambia en pantalla es el
    // contador pequeño de la casilla. La zona es la guarda buena: es null
    // exactamente cuando el tiro no fue a puerta.
    if(entry.zone !== null) flashCell(side, entry.zone, type);
  }

  function undoLast(side){
    const d = state.draft;
    for(let i = d.log.length - 1; i >= 0; i--){
      if(d.log[i].side === side){
        const action = d.log[i];
        const arr = action.kind === 'shot'
          ? (side === 'own' ? d.shotsOwn : d.shotsRival)
          : (side === 'own' ? d.missOwn : d.missRival);
        arr.pop();
        d.log.splice(i, 1);
        break;
      }
    }
    saveDraft();
    render();
  }

  // ---------- eventos y alineación ----------

  function beginEvent(type){
    const spec = EVENT_TYPES.find(e => e.id === type);
    if(!spec) return;
    const candidates = sortedPlayers(currentTeam().players);
    if(candidates.length === 0){
      registerEvent(type, null);
      return;
    }
    state.pendingEvent = { type, candidates };
    render();
  }

  function registerEvent(type, playerId){
    const st = stamp();
    state.draft.events.push({
      type, player: playerId || null,
      minute: st.minute, period: st.period, ordinal: st.ordinal
    });
    state.pendingEvent = null;
    saveDraft();
    render();
  }

  function undoLastEvent(){
    const evs = state.draft.events;
    for(let i = evs.length - 1; i >= 0; i--){
      if(evs[i].type !== 'in' && evs[i].type !== 'out'){
        evs.splice(i, 1);
        break;
      }
    }
    saveDraft();
    render();
  }

  // Entrar y salir de la pista se anota como evento para poder reconstruir
  // después quién estaba dentro en cada gol, que es de donde sale el más/menos.
  function toggleCourt(playerId){
    const d = state.draft;
    const i = d.onCourt.indexOf(playerId);
    const st = stamp();
    if(i === -1){
      d.onCourt.push(playerId);
      d.events.push({ type:'in', player:playerId, minute:st.minute, period:st.period, ordinal:st.ordinal });
    } else {
      d.onCourt.splice(i, 1);
      d.events.push({ type:'out', player:playerId, minute:st.minute, period:st.period, ordinal:st.ordinal });
    }
    saveDraft();
    render();
  }

  function setKeeper(playerId){
    const d = state.draft;
    d.keeper = d.keeper === playerId ? null : playerId;
    saveDraft();
    render();
  }

  function flashCell(side, zone, type){
    const grid = document.querySelector(`[data-grid="${side}"]`);
    if(!grid) return;
    const cell = grid.querySelector(`[data-zone="${zone}"]`);
    if(!cell) return;
    const fl = document.createElement('div');
    fl.className = 'flash ' + type;
    fl.textContent = type === 'goal' ? t('live.flashGoal') : t('live.flashSave');
    cell.appendChild(fl);
    setTimeout(()=> fl.remove(), 500);
  }

  // El reloj se refresca solo su propio hueco cada segundo: repintar la
  // pantalla entera cada segundo se cargaría el modal abierto y el punto que se
  // está tocando en la pista.
  let clockTimer = null;

  function startClockTick(){
    if(clockTimer){ clearInterval(clockTimer); clockTimer = null; }
    if(state.screen !== 'liveMatch' || !state.draft || !state.draft.clock.running) return;
    clockTimer = setInterval(() => {
      const el = document.getElementById('clock-time');
      if(!el || !state.draft){ clearInterval(clockTimer); clockTimer = null; return; }
      el.textContent = clockText(state.draft);
    }, 1000);
  }

  async function handleFinishMatch(){
    const matchId = Store.saveMatch(state.currentTeamId, state.draft);
    state.draft = null;
    Store.clearDraft();
    reloadMatches();
    state.currentMatchId = matchId;
    toast(t(Store.status() === 'synced' ? 'live.matchSaved' : 'live.matchSavedHere'));
    state.screen = 'matchDetail';
    render();
  }

  // ---------- event wiring ----------
  function attachHandlers(){
    const app = document.getElementById('app');

    const bind = (id, ev, fn) => { const el = document.getElementById(id); if(el) el.addEventListener(ev, fn); };

    bind('auth-submit','click', handleAuthSubmit);
    mountGoogleButton();
    bind('auth-toggle','click', () => {
      state.authMode = state.authMode === 'login' ? 'register' : 'login';
      state.authError = '';
      state.authNotice = '';
      render();
    });
    bind('logout-btn','click', async () => { await DB.signOut(); leaveApp(); });
    bind('delete-account','click', () => {
      state.deletingAccount = true;
      state.deleteAccountError = '';
      render();
    });
    bind('delete-account-confirm','click', handleDeleteAccount);
    bind('delete-account-cancel','click', () => {
      state.deletingAccount = false;
      state.deleteAccountError = '';
      render();
    });
    bind('sync-banner','click', () => Store.sync());
    // Cambiar de idioma es repintar: no hay ni un texto guardado en el estado,
    // todos salen de t() en cada render, así que basta con volver a pintar.
    app.querySelectorAll('[data-lang]').forEach(el => {
      el.addEventListener('click', () => {
        I18N.setLang(el.getAttribute('data-lang'));
        document.title = t('app.title');
        render();
      });
    });
    bind('migrate-yes','click', () => {
      const n = Store.importLegacy();
      reloadTeams();
      state.screen = 'dashboard';
      render();
      toast(n ? t('migrate.done', { n }) : t('migrate.doneEmpty'));
    });
    bind('migrate-no','click', () => {
      Store.skipLegacy();
      state.screen = 'dashboard';
      render();
    });

    bind('resume-match','click', () => {
      state.currentTeamId = state.draft.teamId;
      state.screen = 'liveMatch';
      render();
    });
    bind('drop-match','click', () => {
      if(!confirm(t('resume.dropAsk'))) return;
      state.draft = null;
      Store.clearDraft();
      render();
    });

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
    bind('to-account','click', () => { state.screen='account'; render(); });

    // barra inferior. "Partidos" y "+" necesitan un equipo elegido: si no lo
    // hay, llevan al panel en vez de dejar la pantalla a medias.
    bind('tab-home','click', () => { state.screen='dashboard'; state.formError=''; render(); });
    bind('tab-account','click', () => { state.screen='account'; render(); });
    bind('tab-matches','click', () => {
      if(!state.currentTeamId){ state.screen='dashboard'; render(); toast(t('nav.pickTeam')); return; }
      reloadMatches();
      state.screen='matchList';
      render();
    });
    bind('tab-add','click', () => {
      if(!state.currentTeamId){ state.screen='dashboard'; render(); toast(t('nav.pickTeam')); return; }
      state.formError='';
      state.screen='newMatchSetup';
      render();
    });
    bind('add-player-btn','click', handleAddPlayer);
    bind('save-player-btn','click', handleSavePlayer);
    bind('cancel-player-btn','click', () => {
      state.editingPlayerId = null;
      state.formError = '';
      render();
    });
    bind('delete-team','click', handleDeleteTeam);
    app.querySelectorAll('[data-edit-player]').forEach(el => {
      el.addEventListener('click', () => {
        state.editingPlayerId = el.getAttribute('data-edit-player');
        state.formError = '';
        render();
      });
    });
    app.querySelectorAll('[data-del-player]').forEach(el => {
      el.addEventListener('click', () => handleDeletePlayer(el.getAttribute('data-del-player')));
    });
    bind('new-match-btn','click', () => { state.formError=''; state.screen='newMatchSetup'; render(); });
    bind('view-matches-btn','click', async () => {
      reloadMatches();
      state.screen = 'matchList';
      render();
    });
    bind('view-season-btn','click', () => {
      reloadMatches();
      state.screen = 'season';
      render();
    });
    bind('to-season','click', () => { state.screen = 'season'; render(); });

    bind('to-team','click', () => { state.screen='team'; render(); });
    app.querySelectorAll('[data-match]').forEach(el => {
      el.addEventListener('click', () => {
        state.currentMatchId = el.getAttribute('data-match');
        state.screen = 'matchDetail';
        render();
      });
    });
    bind('to-matches','click', () => {
      state.screen='matchList';
      state.editingMatch = false;
      render();
    });

    bind('edit-match','click', () => {
      state.editingMatch = !state.editingMatch;
      state.formError = '';
      render();
    });
    bind('save-match-edit','click', handleSaveMatchEdit);
    bind('cancel-match-edit','click', () => {
      state.editingMatch = false;
      state.formError = '';
      render();
    });
    bind('delete-match','click', handleDeleteMatch);
    app.querySelectorAll('[data-del-shot]').forEach(el => {
      el.addEventListener('click', () => handleDeleteAnnotation('shot', el.getAttribute('data-del-shot')));
    });
    app.querySelectorAll('[data-del-event]').forEach(el => {
      el.addEventListener('click', () => handleDeleteAnnotation('event', el.getAttribute('data-del-event')));
    });
    bind('share-match','click', shareMatchImage);
    bind('csv-match','click', downloadMatchCsv);

    app.querySelectorAll('[data-period]').forEach(el => {
      el.addEventListener('click', () => {
        state.mapFilter.period = el.getAttribute('data-period');
        render();
      });
    });
    bind('toggle-heat','click', () => { state.mapFilter.heat = !state.mapFilter.heat; render(); });
    const fp = document.getElementById('filter-player');
    if(fp) fp.addEventListener('change', () => { state.mapFilter.player = fp.value; render(); });

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
          beginShot(side, zone, 'save');
        } else {
          clickTimers[key] = setTimeout(() => {
            beginShot(side, zone, 'goal');
            delete clickTimers[key];
          }, 260);
        }
      });
    });
    app.querySelectorAll('[data-out]').forEach(el => {
      el.addEventListener('click', () => beginShot(el.getAttribute('data-out'), null, 'out'));
    });
    app.querySelectorAll('[data-post]').forEach(el => {
      el.addEventListener('click', () => beginShot(el.getAttribute('data-post'), null, 'post'));
    });
    app.querySelectorAll('[data-undo]').forEach(el => {
      el.addEventListener('click', () => undoLast(el.getAttribute('data-undo')));
    });
    app.querySelectorAll('[data-event]').forEach(el => {
      el.addEventListener('click', () => beginEvent(el.getAttribute('data-event')));
    });
    app.querySelectorAll('[data-event-player]').forEach(el => {
      el.addEventListener('click', () => registerEvent(state.pendingEvent.type, el.getAttribute('data-event-player')));
    });
    bind('skip-event-player','click', () => registerEvent(state.pendingEvent.type, null));
    bind('cancel-event-btn','click', () => { state.pendingEvent = null; render(); });
    bind('undo-event-btn','click', undoLastEvent);
    app.querySelectorAll('[data-keeper]').forEach(el => {
      el.addEventListener('click', () => setKeeper(el.getAttribute('data-keeper')));
    });
    app.querySelectorAll('[data-court-player]').forEach(el => {
      el.addEventListener('click', () => toggleCourt(el.getAttribute('data-court-player')));
    });
    bind('toggle-clock','click', toggleClock);
    bind('end-half-btn','click', endFirstHalf);
    app.querySelectorAll('[data-select-player]').forEach(el => {
      el.addEventListener('click', () => advancePending({ player: el.getAttribute('data-select-player') }));
    });
    bind('skip-player-btn','click', () => advancePending({ player: null }));
    app.querySelectorAll('[data-court]').forEach(svg => {
      svg.addEventListener('click', ev => {
        const point = courtPointFromEvent(svg, ev);
        if(point) advancePending({ origin: point });
      });
    });
    bind('skip-origin-btn','click', () => advancePending({ origin: null }));
    bind('cancel-shot-btn','click', () => { state.pendingShot = null; render(); });

    bind('toggle-origin','click', () => {
      state.draft.askOrigin = !state.draft.askOrigin;
      saveDraft();
      render();
    });

    bind('finish-match-btn','click', handleFinishMatch);
    bind('cancel-match-btn','click', () => {
      if(confirm(t('live.discardAsk'))){
        state.draft = null;
        Store.clearDraft();
        state.screen = 'team';
        render();
      }
    });

    // El reloj se refresca aparte del render, así que hay que volver a armarlo
    // después de cada pintada.
    startClockTick();
  }

  // El botón atrás de Android. Lo llama js/native.js y devuelve true si se ha
  // ocupado él; si devuelve false, el sistema cierra la app.
  //
  // Desde el partido en vivo se sale al panel en vez de quedarse atrapado: lo
  // anotado sobrevive como borrador y la tarjeta de "seguir con el partido"
  // está esperando ahí, así que no se pierde nada.
  const ATRAS = {
    matchDetail: 'matchList',
    matchList: 'team',
    season: 'team',
    newMatchSetup: 'team',
    liveMatch: 'dashboard',
    team: 'dashboard',
    account: 'dashboard',
    migrate: null,
    auth: null,
    dashboard: null
  };

  window.SuperStatBack = function(){
    if(state.pendingShot){ state.pendingShot = null; render(); return true; }
    if(state.pendingEvent){ state.pendingEvent = null; render(); return true; }
    if(state.editingMatch){ state.editingMatch = false; render(); return true; }
    const destino = ATRAS[state.screen];
    if(!destino) return false;
    state.screen = destino;
    state.formError = '';
    render();
    return true;
  };

  // ---------- boot ----------
  (async function boot(){
    // index.html no puede saber en qué idioma va a arrancar la app: el <title>
    // y el "Cargando…" del hueco vienen escritos en español y se cambian aquí,
    // que es el primer momento en que ya está elegido el idioma.
    document.title = t('app.title');
    state.screen = 'loading';
    render();

    // Barra de estado, botón atrás, login nativo y quitar la pantalla de carga.
    // En el navegador no hace nada.
    if(window.Native) Native.start().catch(e => console.warn('arranque nativo', e));

    if(!DB.isConfigured()){
      state.screen = 'auth';
      render();
      return;
    }

    DB.init();
    Store.onChange(onStoreChange);

    // getSession() resuelve después de que la librería haya leído el token que
    // Google deja en la URL; hasta entonces no se puede limpiar la barra.
    const user = await DB.currentUser();
    DB.cleanAuthUrl();

    DB.onAuthChange((u) => { if(u) enterApp(u); else if(state.user) leaveApp(); });

    if(user) await enterApp(user);
    else { state.screen = 'auth'; render(); }
  })();

})();
