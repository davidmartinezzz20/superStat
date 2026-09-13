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
    pendingShot: null
  };

  const POSITIONS = ['Portero','Lateral izquierdo','Central','Lateral derecho','Extremo izquierdo','Extremo derecho','Pivote'];

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
  const ORIGINS = [
    { id:'EI',  name:'Extremo izquierdo' },
    { id:'LI',  name:'Lateral izquierdo' },
    { id:'CE',  name:'Central' },
    { id:'LD',  name:'Lateral derecho' },
    { id:'ED',  name:'Extremo derecho' },
    { id:'PIV', name:'Pivote' },
    { id:'7M',  name:'7 metros' }
  ];

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
    const dots = (o.shots || []).map(s => {
      const p = shotPoint(s);
      if(!p) return '';
      return `<circle class="shot-dot ${s.type}" cx="${p.x}" cy="${(D - p.y).toFixed(2)}" r="0.34"/>`;
    }).join('');
    return `
      <svg class="court-svg${o.interactive ? ' interactive' : ''}"
           viewBox="${COURT_VB.x} ${COURT_VB.y} ${COURT_VB.w} ${COURT_VB.h}"
           ${o.interactive ? 'data-court="1"' : 'role="img"'}>
        <title>Media pista de balonmano</title>
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
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(()=>t.remove(), 2200);
  }

  // ---------- sesión y sincronización ----------

  function userLabel(){
    const u = state.user;
    if(!u) return '';
    const meta = u.user_metadata || {};
    return meta.name || meta.full_name || u.email || 'mi cuenta';
  }

  const SYNC_TEXT = {
    syncing: 'Sincronizando…',
    pending: 'Cambios pendientes de subir',
    offline: 'Sin conexión: se guarda aquí y se sube al volver',
    error:   'No se ha podido sincronizar. Se reintentará solo.',
    local:   'Supabase sin configurar: los datos solo están en este dispositivo'
  };

  // Solo aparece cuando hay algo que contar: si todo está al día, estorba.
  function syncBanner(){
    const st = Store.status();
    if(st === 'synced') return '';
    // El recuento importa también sin conexión: es lo que te dice cuánto
    // llevas anotado que todavía no está a salvo en ningún otro sitio.
    const n = Store.pendingCount();
    const extra = n && (st === 'pending' || st === 'offline' || st === 'error')
      ? ` · ${n} sin subir` : '';
    return `
      <button class="sync-banner st-${st}" id="sync-banner">
        <span class="sync-dot"></span>
        ${esc(SYNC_TEXT[st] || '')}${extra}
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
    plus:  '<path d="M12 5.5v13M5.5 12h13"/>'
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

  const MONTHS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

  // '2026-09-13' → '13 sep'. Si viniera algo raro, se devuelve tal cual.
  function shortDate(iso){
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if(!m) return iso || '';
    return `${parseInt(m[3],10)} ${MONTHS[parseInt(m[2],10) - 1] || ''}`;
  }

  function teamCardHtml(t){
    const tint = teamTint(t.name);
    return `
      <button class="tint-card team-card" data-team="${t.id}"
              style="--tint:${tint.wash};--tint-solid:${tint.solid};">
        <span class="team-badge">${esc(initials(t.name))}</span>
        <span class="team-text">
          <span class="team-name">${esc(t.name)}</span>
          <span class="team-meta">${t.players.length} jugador${t.players.length===1?'':'es'}</span>
        </span>
        <span class="chev">${icon('back')}</span>
      </button>
    `;
  }

  function matchCardHtml(team, m){
    const gf = m.shotsRival.filter(s=>s.type==='goal').length;
    const ga = m.shotsOwn.filter(s=>s.type==='goal').length;
    const res = gf > ga ? 'win' : (gf < ga ? 'loss' : 'draw');
    const tint = res === 'win'  ? { solid:'#33A17F', wash:'rgba(51,161,127,0.40)', tag:'Victoria' }
               : res === 'loss' ? { solid:'#C1443A', wash:'rgba(193,68,58,0.40)',  tag:'Derrota' }
               :                  { solid:'#8A8F98', wash:'rgba(138,143,152,0.28)', tag:'Empate' };
    return `
      <button class="tint-card match-card" data-match="${m.id}"
              style="--tint:${tint.wash};--tint-solid:${tint.solid};">
        <span class="side">${esc(team.name)}</span>
        <span class="mid">
          <span class="tag">${tint.tag}</span>
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
        ${pageTitle('Datos de este navegador')}
        <div class="card">
          <p style="margin:0 0 10px;font-size:14px;line-height:1.5;">
            Este navegador tiene equipos y partidos guardados de antes de que
            hubiera cuentas. ¿Los quieres pasar a la tuya?
          </p>
          <p style="margin:0;font-size:12.5px;color:var(--muted);line-height:1.5;">
            Se copian, no se borran. Si dices que no, se quedan donde están y no
            se vuelve a preguntar.
          </p>
        </div>
        <div style="height:14px;"></div>
        <button class="primary" id="migrate-yes">Importar a mi cuenta</button>
        <div style="height:10px;"></div>
        <button class="secondary" id="migrate-no">No, empezar de cero</button>
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
    state.screen = Store.hasLegacyData() ? 'migrate' : 'dashboard';
    render();
  }

  function leaveApp(){
    Store.stop();
    state = Object.assign({}, state, {
      screen:'auth', user:null, teams:[], matches:[], currentTeamId:null,
      currentMatchId:null, draft:null, authMode:'login', authError:'',
      authNotice:'', authBusy:false, formError:'', pendingShot:null
    });
    render();
  }

  // ---------- render root ----------
  function render(){
    const app = document.getElementById('app');
    // Las pantallas de datos se releen del store en cada pintada: así lo que
    // llega de otro dispositivo aparece sin tener que recordar refrescarlo.
    if(state.user){
      if(state.screen === 'dashboard' || state.screen === 'team' || state.screen === 'account') reloadTeams();
      if(state.screen === 'matchList' || state.screen === 'matchDetail'){
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
    else if(state.screen === 'newMatchSetup') html = renderNewMatchSetup();
    else if(state.screen === 'liveMatch') html = renderLiveMatch();
    else if(state.screen === 'migrate') html = renderMigrate();
    else if(state.screen === 'account') html = renderAccount();
    else html = '<div class="loading-msg">Cargando…</div>';
    // La barra inferior la pone aquí el render y no cada pantalla, para que
    // añadir una vista nueva no obligue a acordarse de ella.
    const withNav = NAV_SCREENS.indexOf(state.screen) !== -1;
    app.className = 'screen-' + state.screen + (withNav ? ' has-nav' : '');
    app.innerHTML = html + (withNav ? bottomNav() : '');
    attachHandlers();
  }

  // Pantallas que llevan barra inferior. Fuera quedan la entrada, la migración,
  // los formularios y el partido en vivo, donde taparía lo que se está tocando.
  const NAV_SCREENS = ['dashboard','team','matchList','matchDetail','account'];

  function bottomNav(){
    const s = state.screen;
    const tab = s === 'account' ? 'account'
              : (s === 'matchList' || s === 'matchDetail') ? 'matches'
              : 'home';
    const btn = (id, name, ic, label) => `
      <button class="nav-btn${tab === name ? ' on' : ''}" id="${id}">
        ${icon(ic)}<span>${label}</span>
      </button>`;
    return `
      <nav class="bottom-nav">
        ${btn('tab-home','home','home','Equipos')}
        ${btn('tab-matches','matches','list','Partidos')}
        ${btn('tab-account','account','user','Cuenta')}
        <button class="nav-add" id="tab-add" aria-label="Nuevo partido" title="Nuevo partido">
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
          <div class="error-msg">
            Falta configurar Supabase. Rellena <code>js/config.js</code> con la URL
            del proyecto y la clave anon (Project Settings → API).
          </div>
          <div class="hint-text">Mientras tanto no se puede entrar ni guardar nada.</div>
        </main>
      `;
    }
    return `
      <div class="brand-banner">
        ${brandLogo()}
        <p class="brand-tagline">
          Estadísticas de partidos de balonmano, equipo a equipo, tiro a tiro.
        </p>
      </div>
      <main>
        <div class="google-slot" id="google-slot"></div>
        <div class="auth-divider"><span>o con tu correo</span></div>

        <h2 style="font-size:19px;margin-bottom:16px;">${isLogin ? 'Entrar' : 'Crear cuenta'}</h2>
        <div class="field">
          <label for="auth-user">Correo electrónico</label>
          <input id="auth-user" type="email" autocomplete="email" placeholder="tu@correo.com">
        </div>
        <div class="field">
          <label for="auth-pass">Contraseña</label>
          <input id="auth-pass" type="password" autocomplete="${isLogin ? 'current-password' : 'new-password'}" placeholder="••••••••">
        </div>
        ${state.authError ? `<div class="error-msg">${esc(state.authError)}</div>` : ''}
        ${state.authNotice ? `<div class="notice-msg">${esc(state.authNotice)}</div>` : ''}
        <button class="primary" id="auth-submit" ${state.authBusy ? 'disabled' : ''}>
          ${state.authBusy ? 'Un momento…' : (isLogin ? 'Entrar' : 'Crear cuenta')}
        </button>
        <div style="text-align:center;margin-top:14px;">
          <button class="link-btn" id="auth-toggle">${isLogin ? '¿No tienes cuenta? Crea una' : '¿Ya tienes cuenta? Entra'}</button>
        </div>
      </main>
      <footer class="note">Tus datos se guardan en tu cuenta y se sincronizan entre tus dispositivos.</footer>
    `;
  }

  // Los mensajes de Supabase vienen en inglés; se traducen los habituales.
  function authErrorText(e){
    const m = (e && e.message ? e.message : String(e)).toLowerCase();
    if(m.includes('invalid login credentials')) return 'Correo o contraseña incorrectos.';
    if(m.includes('user already registered')) return 'Ya existe una cuenta con ese correo. Entra en vez de crearla.';
    if(m.includes('password should be at least')) return 'La contraseña es demasiado corta: mínimo 6 caracteres.';
    if(m.includes('unable to validate email')) return 'Ese correo no parece válido.';
    if(m.includes('email not confirmed')) return 'Tienes que confirmar el correo antes de entrar. Mira tu bandeja.';
    if(m.includes('failed to fetch') || m.includes('network')) return 'Sin conexión con el servidor. Revisa la red.';
    return 'No se ha podido completar: ' + (e && e.message ? e.message : 'error desconocido');
  }

  // El botón de Google lo dibuja él mismo dentro de #google-slot, así que no hay
  // click propio que enlazar: se monta después de cada render de la entrada.
  // Si no se puede dibujar, se dice ahí mismo en vez de dejar un hueco mudo.
  function mountGoogleButton(){
    const slot = document.getElementById('google-slot');
    if(!slot) return;
    DB.renderGoogleButton(slot, (e) => {
      state.authError = authErrorText(e);
      render();
    }).catch((e) => {
      slot.innerHTML = `<div class="hint-text">${esc(googleUnavailableText(e))}</div>`;
    });
  }

  function googleUnavailableText(e){
    const m = (e && e.message) || '';
    if(m === 'falta-client-id')     return 'Para entrar con Google falta el ID de cliente en js/config.js.';
    if(m === 'sin-contexto-seguro') return 'Entrar con Google necesita https (o localhost).';
    if(m === 'google-no-carga')     return 'No se ha podido cargar el botón de Google. Comprueba la conexión.';
    return 'Ahora mismo no se puede entrar con Google.';
  }

  async function handleAuthSubmit(){
    if(state.authBusy) return;
    const email = document.getElementById('auth-user').value.trim();
    const pass = document.getElementById('auth-pass').value;
    if(!email || !pass){ state.authError = 'Escribe tu correo y la contraseña.'; render(); return; }
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
          state.authNotice = 'Cuenta creada. Confirma el correo que te hemos enviado y entra.';
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
        <div class="big-num">Aún no tienes ningún equipo</div>
        Crea tu primer equipo para empezar a registrar partidos.
      </div>
    `;
    return `
      ${topbar({ right:`<button class="back-btn" id="to-account" aria-label="Cuenta" title="Cuenta">${icon('user')}</button>` })}
      <main>
        ${pageTitle('Equipos')}
        ${syncBanner()}
        ${teamsHtml}
        <div class="section-label">Nuevo equipo</div>
        <div class="field">
          <label for="new-team-name">Nombre del equipo</label>
          <input id="new-team-name" type="text" maxlength="80" placeholder="Ej. CB Sabadell">
        </div>
        <button class="primary" id="create-team-btn">Crear equipo</button>
      </main>
    `;
  }

  // ---------- CUENTA ----------
  // Vive aquí lo que antes colgaba de la cabecera del panel: quién eres, cómo
  // va la sincronización y el botón de salir.
  function renderAccount(){
    const label = userLabel();
    const teams = state.teams.length;
    return `
      ${topbar({ left: backBtn('to-dashboard','Equipos') })}
      <main>
        ${pageTitle('Cuenta')}
        <div class="account-head">
          <div class="account-avatar">${esc(initials(label || '?'))}</div>
          <div>
            <div class="account-name">${esc(label)}</div>
            <div class="account-sub">${teams} equipo${teams===1?'':'s'} en esta cuenta</div>
          </div>
        </div>
        <div class="section-label">Sincronización</div>
        ${syncBanner() || `
          <div class="card">
            <div class="card-title">Todo al día</div>
            <div class="card-sub">Tus datos están guardados en la nube y en este dispositivo.</div>
          </div>
        `}
        <div class="section-label">Sesión</div>
        <button class="secondary" id="logout-btn">Salir de la cuenta</button>
      </main>
    `;
  }

  async function handleCreateTeam(){
    const name = document.getElementById('new-team-name').value.trim();
    if(!name) return;
    if(name.length > 80){
      state.formError = 'El nombre del equipo es demasiado largo (máximo 80).';
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
      ${topbar({ left: backBtn('to-dashboard','Equipos') })}
      <main>
        ${pageTitle(team.name, `${players.length} jugador${players.length===1?'':'es'} en plantilla`)}
        <div class="section-label">Plantilla</div>
        <div class="card">${rows}</div>

        <div class="row">
          <div class="field" style="flex:2;">
            <label for="p-name">Nombre</label>
            <input id="p-name" type="text" maxlength="80" placeholder="Nombre del jugador">
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
    const dorsal = parseInt(dorsalRaw, 10);
    if(!Number.isInteger(dorsal) || dorsal < 0 || dorsal > 99){
      state.formError = 'El dorsal tiene que ser un número entre 0 y 99.';
      render();
      return;
    }
    if(name.length > 80){
      state.formError = 'El nombre es demasiado largo (máximo 80 caracteres).';
      render();
      return;
    }
    Store.addPlayer(state.currentTeamId, { name, dorsal, position });
    state.formError = '';
    reloadTeams();
    render();
  }

  async function handleDeletePlayer(id){
    Store.deletePlayer(id);
    reloadTeams();
    render();
  }

  // ---------- MATCH LIST ----------
  function renderMatchList(){
    const team = currentTeam();
    const list = [...state.matches].sort((a,b)=> b.date.localeCompare(a.date));
    const rows = list.length
      ? list.map(m => matchCardHtml(team, m)).join('')
      : `<div class="empty-state">Todavía no hay partidos guardados.</div>`;

    return `
      ${topbar({ left: backBtn('to-team', team.name) })}
      <main>
        ${pageTitle('Partidos', team.name)}
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
      const arr = shots.filter(s => shotZone(s) === o.id);
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

  // Mapa de tiros sobre la pista: un punto por lanzamiento con el punto exacto
  // registrado. Sólo aparece si el partido tiene alguno.
  function shotMapHtml(shots, id){
    const withPoint = shots.filter(shotPoint);
    if(withPoint.length === 0) return '';
    const goals = withPoint.filter(s => s.type === 'goal').length;
    return `
      ${courtSvg({ shots: withPoint, id })}
      <div class="court-legend">
        <span><i class="dot-goal"></i> ${goals} gol${goals === 1 ? '' : 'es'}</span>
        <span><i class="dot-save"></i> ${withPoint.length - goals} parada${withPoint.length - goals === 1 ? '' : 's'}</span>
      </div>
    `;
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
      ${topbar({ left: backBtn('to-matches','Partidos') })}
      <main>
        ${pageTitle('vs ' + m.rival, shortDate(m.date))}
        <div class="card score-hero">
          <div class="score-hero-num">${gf} – ${ga}</div>
          <div class="score-hero-lbl">${esc(team.name)} · ${esc(m.rival)}</div>
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
        ${shotMapHtml(m.shotsRival, 'mapRival')}
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
        ${shotMapHtml(m.shotsOwn, 'mapOwn')}
        <div class="card">${originStatsHtml(m.shotsOwn)}</div>
      </main>
    `;
  }

  // ---------- NEW MATCH SETUP ----------
  function renderNewMatchSetup(){
    const team = currentTeam();
    return `
      ${topbar({ left: backBtn('to-team','Cancelar') })}
      <main>
        ${pageTitle('Nuevo partido', team.name)}
        <div class="field">
          <label for="rival-name">Nombre del equipo rival</label>
          <input id="rival-name" type="text" maxlength="80" placeholder="Ej. BM Granollers">
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
    if(rival.length > 80){
      state.formError = 'El nombre del rival es demasiado largo (máximo 80).';
      render();
      return;
    }
    state.formError = '';
    state.draft = {
      id: Store.uuid(),
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

  function renderOriginStep(p){
    const team = currentTeam();
    const who = p.side === 'own' ? state.draft.rival : team.name;
    return `
      <div class="modal-title">¿Desde dónde ha lanzado?</div>
      <div class="modal-sub">Ataque de ${esc(who)} · toca el punto exacto de la pista</div>
      ${courtSvg({ interactive:true, id:'pick' })}
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
      ${topbar({ right:`<button class="back-btn wide" id="finish-match-btn">Guardar</button>` })}
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
    const matchId = Store.saveMatch(state.currentTeamId, state.draft);
    state.draft = null;
    reloadMatches();
    state.currentMatchId = matchId;
    toast(Store.status() === 'synced' ? 'Partido guardado' : 'Partido guardado en este dispositivo');
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
    bind('sync-banner','click', () => Store.sync());
    bind('migrate-yes','click', () => {
      const n = Store.importLegacy();
      reloadTeams();
      state.screen = 'dashboard';
      render();
      toast(n ? `Importados ${n} partido${n===1?'':'s'}` : 'Datos importados');
    });
    bind('migrate-no','click', () => {
      Store.skipLegacy();
      state.screen = 'dashboard';
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
      if(!state.currentTeamId){ state.screen='dashboard'; render(); toast('Elige primero un equipo'); return; }
      reloadMatches();
      state.screen='matchList';
      render();
    });
    bind('tab-add','click', () => {
      if(!state.currentTeamId){ state.screen='dashboard'; render(); toast('Elige primero un equipo'); return; }
      state.formError='';
      state.screen='newMatchSetup';
      render();
    });
    bind('add-player-btn','click', handleAddPlayer);
    app.querySelectorAll('[data-del-player]').forEach(el => {
      el.addEventListener('click', () => handleDeletePlayer(el.getAttribute('data-del-player')));
    });
    bind('new-match-btn','click', () => { state.formError=''; state.screen='newMatchSetup'; render(); });
    bind('view-matches-btn','click', async () => {
      reloadMatches();
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
    state.screen = 'loading';
    render();

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
