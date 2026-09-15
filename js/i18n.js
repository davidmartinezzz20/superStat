// Los textos de la interfaz, en español y en inglés.
//
// La app se escribió entera en español, con los textos dentro de las plantillas
// de app.js. Esto los saca de ahí y los deja en un solo sitio, para que la
// misma pantalla se pueda pintar en los dos idiomas sin duplicar ni una vista.
//
// Sin framework y sin build, como el resto: un objeto por idioma y una función
// que busca la clave. El español es la fuente de la verdad —es el idioma en el
// que se piensa la app—, así que si una clave falta en inglés se cae al español
// y se avisa por consola en vez de enseñar la clave cruda al usuario.
//
// **Lo que NO se traduce nunca**: los valores que viajan a Postgres. La
// posición de un jugador se guarda como 'Portero', el tipo de un evento como
// 'turnover' y la zona de lanzamiento como 'EI'. Esos son ids, no texto, y se
// traducen solo al pintarlos (POSITION_NAME, EVENT_NAME, ORIGIN_NAME en
// app.js). Traducirlos como dato partiría en dos la base según el idioma en que
// estuviera la app el día que se anotó el partido.
//
// Cómo se elige el idioma, por orden:
//   1. ?lang=en en la URL, que es lo que usan las capturas de tools/.
//   2. Lo que el usuario haya elegido en la pantalla de Cuenta (Store).
//   3. El idioma del navegador.
//   4. Español.
//
// Al añadir un texto visible hay que meterlo en los dos diccionarios: no vale
// dejarlo escrito en la plantilla. test/i18n.js lo comprueba.
window.I18N = (function(){

  const ES = {
    // ---------------------------------------------------------------- común
    'common.loading':        'Cargando…',
    'common.cancel':         'Cancelar',
    'common.saveChanges':    'Guardar cambios',
    'common.unspecified':    'Sin especificar',
    'common.unassigned':     'sin asignar',
    'common.noData':         'Sin datos todavía.',
    'common.myAccount':      'mi cuenta',
    'common.yourTeam':       'Tu equipo',
    'common.edit':           'Editar',
    'common.delete':         'Eliminar',
    'common.wait':           'Un momento…',
    'common.cancelNoRecord': 'Cancelar, no registrar',

    'app.title':    'SuperStat — Estadísticas de balonmano',
    'app.tagline':  'Estadísticas de partidos de balonmano, equipo a equipo, tiro a tiro.',

    // -------------------------------------------------------- sincronización
    'sync.syncing':      'Sincronizando…',
    'sync.pending':      'Cambios pendientes de subir',
    'sync.offline':      'Sin conexión: se guarda aquí y se sube al volver',
    'sync.error':        'No se ha podido sincronizar. Se reintentará solo.',
    'sync.local':        'Supabase sin configurar: los datos solo están en este dispositivo',
    'sync.pendingCount': ' · {n} sin subir',

    // ----------------------------------------------------------- barra y nav
    'nav.teams':     'Equipos',
    'nav.matches':   'Partidos',
    'nav.account':   'Cuenta',
    'nav.newMatch':  'Nuevo partido',
    'nav.pickTeam':  'Elige primero un equipo',

    // ------------------------------------------------------------- la pista
    'court.title':   'Media pista de balonmano',

    // -------------------------------------------------------- posiciones
    // La clave es el valor guardado en la base y no se toca nunca.
    'position.Portero':            'Portero',
    'position.Lateral izquierdo':  'Lateral izquierdo',
    'position.Central':            'Central',
    'position.Lateral derecho':    'Lateral derecho',
    'position.Extremo izquierdo':  'Extremo izquierdo',
    'position.Extremo derecho':    'Extremo derecho',
    'position.Pivote':             'Pivote',

    // ------------------------------------------------- zonas de lanzamiento
    'origin.EI':   'Extremo izquierdo',
    'origin.LI':   'Lateral izquierdo',
    'origin.CE':   'Central',
    'origin.LD':   'Lateral derecho',
    'origin.ED':   'Extremo derecho',
    'origin.PIV':  'Pivote',
    'origin.7M':   '7 metros',

    // ---------------------------------------------------- zonas de portería
    'goalZone.1':  'arriba izq.',
    'goalZone.2':  'arriba centro',
    'goalZone.3':  'arriba der.',
    'goalZone.4':  'media izq.',
    'goalZone.5':  'media centro',
    'goalZone.6':  'media der.',
    'goalZone.7':  'abajo izq.',
    'goalZone.8':  'abajo centro',
    'goalZone.9':  'abajo der.',

    // -------------------------------------------------------------- eventos
    'event.turnover':   'Pérdida',
    'event.steal':      'Robo',
    'event.exclusion':  '2 minutos',
    'event.yellow':     'Amarilla',
    'event.red':        'Roja',
    'event.assist':     'Asistencia',
    'event.block':      'Blocaje',
    'event.foul7m':     '7 m provocado',
    'event.in':         'Entra a pista',
    'event.out':        'Sale de pista',

    'eventShort.turnover':  'PE',
    'eventShort.steal':     'RO',
    'eventShort.exclusion': '2′',
    'eventShort.yellow':    'TA',
    'eventShort.red':       'TR',

    // --------------------------------------------------------------- meses
    'month.1':  'ene', 'month.2':  'feb', 'month.3':  'mar', 'month.4':  'abr',
    'month.5':  'may', 'month.6':  'jun', 'month.7':  'jul', 'month.8':  'ago',
    'month.9':  'sep', 'month.10': 'oct', 'month.11': 'nov', 'month.12': 'dic',
    'date.short': '{d} {mes}',
    // El separador decimal de "3,4 goles por partido": coma en español y punto
    // en inglés. Es una sola cifra con un decimal en toda la app (el promedio
    // por partido), así que no hace falta traer Intl.NumberFormat para esto.
    'number.decimal': ',',

    // ------------------------------------------------------------- tarjetas
    'team.playerCount_one':   '{n} jugador',
    'team.playerCount_other': '{n} jugadores',
    'team.rosterCount_one':   '{n} jugador en plantilla',
    'team.rosterCount_other': '{n} jugadores en plantilla',
    'result.win':   'Victoria',
    'result.loss':  'Derrota',
    'result.draw':  'Empate',

    // ------------------------------------------------------------- entrada
    'auth.noConfig':      'Falta configurar Supabase. Rellena <code>js/config.js</code> con la URL del proyecto y la clave anon (Project Settings → API).',
    'auth.noConfigHint':  'Mientras tanto no se puede entrar ni guardar nada.',
    'auth.orEmail':       'o con tu correo',
    'auth.login':         'Entrar',
    'auth.register':      'Crear cuenta',
    'auth.email':         'Correo electrónico',
    'auth.emailHint':     'tu@correo.com',
    'auth.password':      'Contraseña',
    'auth.toLogin':       '¿Ya tienes cuenta? Entra',
    'auth.toRegister':    '¿No tienes cuenta? Crea una',
    'auth.footer':        'Tus datos se guardan en tu cuenta y se sincronizan entre tus dispositivos.',
    'auth.googleBtn':     'Entrar con Google',
    'auth.needBoth':      'Escribe tu correo y la contraseña.',
    'auth.confirmSent':   'Cuenta creada. Confirma el correo que te hemos enviado y entra.',

    // errores de Supabase, que vienen en inglés
    'authError.googleNoToken':  'Google no ha devuelto la sesión. Inténtalo otra vez.',
    'authError.googleOff':      'Ahora mismo no se puede entrar con Google.',
    'authError.googleSign':     'La app no está dada de alta en Google con esta firma. Revisa el ID de cliente y la huella SHA-1.',
    'authError.badLogin':       'Correo o contraseña incorrectos.',
    'authError.alreadyUser':    'Ya existe una cuenta con ese correo. Entra en vez de crearla.',
    'authError.shortPassword':  'La contraseña es demasiado corta: mínimo 6 caracteres.',
    'authError.badEmail':       'Ese correo no parece válido.',
    'authError.notConfirmed':   'Tienes que confirmar el correo antes de entrar. Mira tu bandeja.',
    'authError.edgeFunction':   'No se ha podido contactar con el servicio de borrado. Revisa la conexión; si sigue igual, puedes pedir el borrado por correo desde la política de privacidad.',
    'authError.network':        'Sin conexión con el servidor. Revisa la red.',
    'authError.generic':        'No se ha podido completar: {msg}',
    'authError.unknown':        'error desconocido',
    'google.noClientId':        'Para entrar con Google falta el ID de cliente en js/config.js.',
    'google.noSecureContext':   'Entrar con Google necesita https (o localhost).',
    'google.notLoaded':         'No se ha podido cargar el botón de Google. Comprueba la conexión.',

    // ------------------------------------------------------------- migración
    'migrate.title':    'Datos de este navegador',
    'migrate.body':     'Este navegador tiene equipos y partidos guardados de antes de que hubiera cuentas. ¿Los quieres pasar a la tuya?',
    'migrate.note':     'Se copian, no se borran. Si dices que no, se quedan donde están y no se vuelve a preguntar.',
    'migrate.yes':      'Importar a mi cuenta',
    'migrate.no':       'No, empezar de cero',
    'migrate.done_one':   'Importado {n} partido',
    'migrate.done_other': 'Importados {n} partidos',
    'migrate.doneEmpty':  'Datos importados',

    // --------------------------------------------------------------- panel
    'dashboard.title':      'Equipos',
    'dashboard.empty':      'Aún no tienes ningún equipo',
    'dashboard.emptyHint':  'Crea tu primer equipo para empezar a registrar partidos.',
    'dashboard.newTeam':    'Nuevo equipo',
    'dashboard.teamName':   'Nombre del equipo',
    'dashboard.teamHint':   'Ej. CB Sabadell',
    'dashboard.create':     'Crear equipo',
    'dashboard.nameTooLong':'El nombre del equipo es demasiado largo (máximo 80).',

    'resume.unsaved':   'Sin guardar',
    'resume.continue':  'Seguir con el partido',
    'resume.drop':      'Descartar',
    'resume.dropAsk':   '¿Descartar el partido sin guardar? Se perderá lo anotado.',

    // --------------------------------------------------------------- cuenta
    'account.title':        'Cuenta',
    'account.teams_one':    '{n} equipo en esta cuenta',
    'account.teams_other':  '{n} equipos en esta cuenta',
    'account.sync':         'Sincronización',
    'account.allGood':      'Todo al día',
    'account.allGoodSub':   'Tus datos están guardados en la nube y en este dispositivo.',
    'account.session':      'Sesión',
    'account.logout':       'Salir de la cuenta',
    'account.language':     'Idioma',
    'account.languageSub':  'Solo en este dispositivo: no se sincroniza con la cuenta.',
    'account.deleteTitle':  'Borrar la cuenta',
    'account.deleteSub':    'Se borran la cuenta y todo lo suyo: equipos, plantillas, partidos, tiros y eventos, en este dispositivo y en la nube. No se puede deshacer.',
    'account.deleteBtn':    'Borrar mi cuenta',
    'account.deleteNoUndo': 'Esto no se puede deshacer',
    'account.deleteAsk':    'Escribe <strong>{palabra}</strong> para confirmar que quieres eliminar la cuenta y todo lo que guarda.',
    'account.deleteWord':   'BORRAR',
    'account.deleteLabel':  'Confirmación',
    'account.deleteGo':     'Borrar la cuenta',
    'account.deleting':     'Borrando…',
    'account.deleteType':   'Escribe {palabra} para confirmar.',
    'account.deleteFailed': 'No se ha podido borrar la cuenta.',
    'account.deleted':      'Cuenta borrada',

    // ---------------------------------------------------------------- plan
    // Ojo con estos textos: `limit.subApp` es el que ve la app de Android e
    // iPhone, y allí no se puede vender ni decir dónde se compra (ver
    // puedeComprar en app.js). Ni precio, ni "entra en", ni nombrar la web.
    'plan.title':        'Plan',
    'plan.free':         'Plan Gratis',
    'plan.pro':          'SuperStat Pro',
    'plan.trialing':     'SuperStat Pro · prueba',
    'plan.until':        'Activo hasta el {d}',
    'plan.manage':       'Gestionar la suscripción',
    'plan.emails':       'Avisos por correo',
    'plan.emailsSub':    'Novedades y avisos sobre tu plan. Puedes darte de baja cuando quieras.',
    'plan.emailsFailed': 'No se ha podido guardar el cambio.',
    'plan.freeUse':      'Llevas {n} de {tope} partidos guardados.',

    'limit.title_one':   'El plan Gratis llega a {n} equipo',
    'limit.title_other': 'El plan Gratis llega a {n} equipos',
    'limit.subWeb':      'Con SuperStat Pro llevas todos los equipos que quieras, cada uno con su plantilla y sus partidos.',
    'limit.subApp':      'Puedes seguir anotando partidos y editando el equipo que ya tienes.',
    'limit.matchTitle_one':   'El plan Gratis llega a {n} partido guardado',
    'limit.matchTitle_other': 'El plan Gratis llega a {n} partidos guardados',
    'limit.matchSubWeb':      'Con SuperStat Pro guardas todos los partidos que quieras, con su mapa de tiros y su temporada.',
    'limit.matchSubApp':      'Los partidos que ya tienes siguen ahí: se abren, se corrigen y se exportan como siempre.',
    'limit.seePro':      'Ver SuperStat Pro',

    'paywall.title':      'SuperStat Pro',
    'paywall.sub':        'Todos tus equipos y todos tus partidos en la misma cuenta',
    'paywall.f1':         'Equipos sin límite, cada uno con su plantilla',
    'paywall.f2':         'Partidos sin límite, con su mapa de tiros y su temporada',
    'paywall.f3':         'Los mismos datos en el móvil y en el ordenador, también sin cobertura',
    'paywall.priceMonth': '{p} al mes',
    'paywall.trial':      'Los 7 primeros días son gratis. Cancela cuando quieras.',
    'paywall.go':         'Empezar la prueba de 7 días',
    'paywall.going':      'Abriendo el pago…',
    'paywall.failed':     'No se ha podido abrir la pantalla de pago. Inténtalo otra vez.',
    'paywall.legal':      'El pago lo gestiona Stripe. SuperStat no guarda los datos de tu tarjeta.',
    'paywall.checking':   'Comprobando el pago…',
    'paywall.welcome':    'Ya tienes SuperStat Pro',
    'paywall.soon':       'El pago ha entrado. El plan se activa en un momento.',

    // -------------------------------------------------------------- equipo
    'team.roster':        'Plantilla',
    'team.noPlayers':     'Sin jugadores todavía.',
    'team.editPlayer':    'Editar jugador',
    'team.newPlayer':     'Nuevo jugador',
    'team.name':          'Nombre',
    'team.nameHint':      'Nombre del jugador',
    'team.dorsal':        'Dorsal',
    'team.position':      'Posición',
    'team.addPlayer':     'Añadir jugador',
    'team.matches':       'Partidos',
    'team.newMatch':      '＋ Nuevo partido',
    'team.viewMatches':   'Ver estadísticas de partidos anteriores',
    'team.viewSeason':    'Acumulado de la temporada',
    'team.deleteTitle':   'Borrar',
    'team.deleteSub':     'Con el equipo se van su plantilla y todos sus partidos, con todo lo anotado en ellos. No se puede deshacer.',
    'team.deleteBtn':     'Borrar este equipo',
    'team.deleteAsk_one':   '¿Borrar el equipo {equipo}? Se irán su plantilla y {n} partido, con todo lo anotado. No se puede deshacer.',
    'team.deleteAsk_other': '¿Borrar el equipo {equipo}? Se irán su plantilla y {n} partidos, con todo lo anotado. No se puede deshacer.',
    'team.deleted':       'Equipo borrado',
    'team.playerSaved':   'Jugador actualizado',
    'team.needNameDorsal':'Escribe nombre y dorsal.',
    'team.badDorsal':     'El dorsal tiene que ser un número entre 0 y 99.',
    'team.nameTooLong':   'El nombre es demasiado largo (máximo 80 caracteres).',

    // ------------------------------------------------------ lista de partidos
    'matchList.title':   'Partidos',
    'matchList.empty':   'Todavía no hay partidos guardados.',
    'matchList.season':  'Ver el acumulado de la temporada',

    // ------------------------------------------------------ ficha de partido
    'match.vs':             'vs {rival}',
    'match.halfTimeAt':     'descanso en el {n}′',
    'match.ourShots':       'Nuestros disparos (portería rival)',
    'match.goals':          'Goles',
    'match.savedByRival':   'Parados por el rival',
    'match.outAndPosts':    'Fuera y palos',
    'match.efficiency':     'Efectividad',
    'match.scorers':        'Goleadores del partido',
    'match.goalsUnit_one':   '{n} gol',
    'match.goalsUnit_other': '{n} goles',
    'match.whereWeShoot':   'Desde dónde lanzamos',
    'match.goalsPerShots':  'goles / lanzamientos',
    'match.whereInGoal':    'A qué parte de la portería',
    'match.fromEachZone':   'desde cada zona',
    'match.rivalShots':     'Disparos rivales (portería propia)',
    'match.conceded':       'Goles encajados',
    'match.ourSaves':       'Paradas de tu portero',
    'match.rivalOut':       'Fuera del rival',
    'match.savePct':        '% Paradas portero',
    'match.keepers':        'Porteros',
    'match.savesPerFaced':  'paradas / tiros recibidos',
    'match.whereTheyShoot': 'Desde dónde nos lanzan',
    'match.plusMinus':      'Más/menos',
    'match.plusMinusSub':   'con cada jugador en pista',
    'match.otherRecords':   'Otros registros',
    'match.share':          'Compartir',
    'match.shareImage':     'Imagen',
    'match.downloadCsv':    'Descargar CSV',
    'match.edit':           'Editar partido',
    'match.rival':          'Rival',
    'match.date':           'Fecha',
    'match.halfTimeMinute': 'Minuto del descanso',
    'match.halfTimeEmpty':  'Sin marcar',
    'match.deleteBtn':      'Borrar este partido',
    'match.deleteAsk':      '¿Borrar el partido contra {rival}? No se puede deshacer.',
    'match.deleted':        'Partido borrado',
    'match.saved':          'Partido actualizado',
    'match.needRivalDate':  'Indica el rival y la fecha.',
    'match.rivalTooLong':   'El nombre del rival es demasiado largo (máximo 80).',
    'match.badHalfTime':    'El minuto del descanso tiene que ser un número de minutos.',

    'stats.noShotsAtUs':    'Sin tiros a nuestra portería todavía.',
    'stats.needCourtMark':  'Marca quién está en pista durante el partido y aquí sale lo que pasa en el marcador mientras cada uno juega.',
    'stats.noEvents':       'No se anotó ninguno en este partido.',
    'stats.needOrigin':     'Hace falta registrar el punto de lanzamiento para cruzarlo con la portería.',
    'stats.crossLegend':    'Goles / lanzamientos a cada parte de la portería. Cuanto más claro, más se tira ahí.',
    'stats.crossCell':      '{zona}: {goles} de {n}',
    'stats.shotsUnit_one':   '{n} tiro',
    'stats.shotsUnit_other': '{n} tiros',

    // --------------------------------------------------------- mapa de tiros
    'map.all':        'Todo',
    'map.half':       '{n}ª parte',
    'map.heat':       'Mapa de calor',
    'map.allPlayers': 'Todos los jugadores',
    'map.noPoints':   'Ningún lanzamiento con punto registrado.',
    'map.noPointsFiltered': 'Ningún lanzamiento con punto registrado con este filtro.',
    'map.shots_one':   '{n} lanzamiento',
    'map.shots_other': '{n} lanzamientos',
    'map.goals_one':   '{n} gol',
    'map.goals_other': '{n} goles',
    'map.saves_one':   '{n} parada',
    'map.saves_other': '{n} paradas',
    'map.out':         '{n} fuera',

    // ----------------------------------------------------------- anotaciones
    'annot.title':        'Anotaciones',
    'annot.titleSub':     'en el orden en que se registraron',
    'annot.empty':        'Este partido no tiene anotaciones.',
    'annot.delete':       'Borrar anotación',
    'annot.deleted':      'Anotación borrada',
    'annot.rival.goal':   'Gol',
    'annot.rival.save':   'Parada del portero rival',
    'annot.rival.out':    'Tiro fuera',
    'annot.rival.post':   'Palo',
    'annot.own.goal':     'Gol encajado',
    'annot.own.save':     'Parada',
    'annot.own.out':      'Tiro fuera del rival',
    'annot.own.post':     'Palo del rival',
    'annot.shot':         'Tiro',
    'annot.by':           '{que} de {quien}',
    'annot.keeper':       '{que} · portero {quien}',
    'annot.withPlayer':   '{que} · {quien}',
    'annot.minute':       '{n}′',
    'annot.minuteHalf':   '{n}′ · {parte}ª parte',
    'annot.half':         '{n}ª parte',

    // ------------------------------------------------------------- temporada
    'season.title':       'Temporada',
    'season.empty':       'Todavía no hay partidos',
    'season.emptyHint':   'Cuando guardes alguno, aquí se suma todo: goleadores, porteros y desde dónde se tira mejor.',
    'season.played_one':  '{n} partido',
    'season.played_other':'{n} partidos',
    'season.record':      'victorias · empates · derrotas',
    'season.total':       'En total',
    'season.goalsFor':    'Goles a favor · {n}/partido',
    'season.goalsAgainst':'En contra · {n}/partido',
    'season.effIn_one':     'Efectividad en {n} lanzamiento',
    'season.effIn_other':   'Efectividad en {n} lanzamientos',
    'season.savesIn_one':   'Paradas en {n} tiro recibido',
    'season.savesIn_other': 'Paradas en {n} tiros recibidos',
    'season.scorers':     'Goleadores',
    'season.wholeSeason': 'toda la temporada',
    'season.perMatch':    '{n}/partido',
    'season.noScorers':   'Sin goles asignados a jugador todavía.',
    'season.noFaced':     'Sin tiros recibidos todavía.',
    'season.bestZones':   'Desde dónde lanzamos mejor',
    'season.noOrigins':   'Hace falta registrar el punto de lanzamiento.',
    'season.plusMinus':   'Más/menos acumulado',
    'season.noPlusMinus': 'Marca quién está en pista durante los partidos para verlo aquí.',
    'season.noEvents':    'No se anotó ninguno todavía.',

    // --------------------------------------------------------- marcador y CSV
    'timeline.title':     'Evolución de la diferencia de goles',
    'timeline.range':     'min 0 – {n}',
    'timeline.goalByGoal':'gol a gol',
    'timeline.bestRunUs':    'Mejor racha: {n} goles seguidos nuestros',
    'timeline.bestRunThem':  'Mejor racha: {n} goles seguidos del rival',
    'timeline.bestRunWhen':  ' (min {desde}–{hasta})',

    'csv.type':       'tipo',
    'csv.period':     'parte',
    'csv.minute':     'minuto',
    'csv.side':       'lado',
    'csv.result':     'resultado',
    'csv.goalZone':   'zona_porteria',
    'csv.player':     'jugador',
    'csv.dorsal':     'dorsal',
    'csv.courtZone':  'zona_pista',
    'csv.originX':    'origen_x',
    'csv.originY':    'origen_y',
    'csv.shot':       'tiro',
    'csv.event':      'evento',
    'csv.ourGoal':    'nuestra porteria',
    'csv.rivalGoal':  'porteria rival',
    'csv.fileName':   'partido',

    'share.efficiency':  'Efectividad',
    'share.shots':       'Lanzamientos',
    'share.saves':       'Paradas',
    'share.savePct':     '% paradas',
    'share.scorers':     'GOLEADORES',
    'share.noScorers':   'Sin goles registrados por jugador',
    'share.madeWith':    'Hecho con SuperStat',
    'share.goal_one':    '{n} gol',
    'share.goal_other':  '{n} goles',
    'share.failed':      'No se ha podido generar la imagen',
    'share.savedTo':     'Guardado en Documentos: {archivo}',
    'share.downloaded':  'Descargado',

    // ------------------------------------------------------- partido en vivo
    'setup.title':      'Nuevo partido',
    'setup.rivalName':  'Nombre del equipo rival',
    'setup.rivalHint':  'Ej. CE Granollers',
    'setup.date':       'Fecha',
    'setup.start':      'Empezar a registrar tiros',

    'live.save':          'Guardar',
    'live.ourGoal':       'Nuestra portería',
    'live.rivalGoal':     'Portería rival',
    'live.keeperIs':      'para {quien}',
    'live.rivalShoots':   'tira el rival',
    'live.weShoot':       'tiramos nosotros',
    'live.tally':         '{g} G · {p} P · {f} fuera',
    'live.tallyPost':     ' · {n} palo',
    'live.out':           'Fuera',
    'live.post':          'Palo',
    'live.undo':          'Deshacer',
    'live.tapHint':       '1 toque = gol · 2 toques = parada',
    'live.quickLog':      'Registro rápido',
    'live.undoEvent':     'Deshacer {que}',
    'live.undoEventOf':   'Deshacer {que} de {quien}',
    'live.inGoal':        'En portería',
    'live.keeperUnset':   'sin fijar: los goles encajados no tendrán portero',
    'live.noKeepers':     'No hay ningún portero en la plantilla.',
    'live.onCourt':       'En pista',
    'live.tooMany':       ' · te has pasado',
    'live.noFieldPlayers':'No hay jugadores de campo en la plantilla.',
    'live.courtHint':     'Toca a quien entra o sale. Con esto sale el más/menos de cada uno.',
    'live.options':       'Opciones',
    'live.askOrigin':     'Preguntar zona de lanzamiento',
    'live.discard':       'Descartar partido',
    'live.discardAsk':    '¿Descartar este partido? Se perderán los tiros registrados.',
    'live.half':          '{n}ª parte',
    'live.endFirstHalf':  'Fin 1ª parte',
    'live.clockStop':     'Parar el reloj',
    'live.clockStart':    'Poner el reloj en marcha',
    'live.halfEnded':     'Fin de la primera parte en el minuto {n}',
    'live.flashGoal':     'GOL',
    'live.flashSave':     'PARADA',
    'live.matchSaved':    'Partido guardado',
    'live.matchSavedHere':'Partido guardado en este dispositivo',

    'ask.goal':      '¿Quién ha marcado?',
    'ask.save':      '¿Quién ha lanzado?',
    'ask.out':       '¿Quién ha tirado fuera?',
    'ask.post':      '¿Quién ha dado en el palo?',
    'ask.player':    'Selecciona jugador',
    'ask.keeper':    '¿Qué portero tenemos en portería?',
    'ask.keeperSub': 'Se queda puesto para el resto del partido; puedes cambiarlo cuando entre otro.',
    'ask.whichPlayer':'¿De qué jugador?',
    'ask.origin':    '¿Desde dónde ha lanzado?',
    'ask.originSub': 'Ataque de {quien} · toca el punto exacto de la pista'
  };

  const EN = {
    // ---------------------------------------------------------------- común
    'common.loading':        'Loading…',
    'common.cancel':         'Cancel',
    'common.saveChanges':    'Save changes',
    'common.unspecified':    'Not specified',
    'common.unassigned':     'unassigned',
    'common.noData':         'No data yet.',
    'common.myAccount':      'my account',
    'common.yourTeam':       'Your team',
    'common.edit':           'Edit',
    'common.delete':         'Delete',
    'common.wait':           'One moment…',
    'common.cancelNoRecord': 'Cancel, do not record',

    'app.title':    'SuperStat — Handball statistics',
    'app.tagline':  'Handball match statistics, team by team, shot by shot.',

    // -------------------------------------------------------- sincronización
    'sync.syncing':      'Syncing…',
    'sync.pending':      'Changes waiting to upload',
    'sync.offline':      'Offline: saved here and uploaded when you are back',
    'sync.error':        'Could not sync. It will try again on its own.',
    'sync.local':        'Supabase not set up: your data is only on this device',
    'sync.pendingCount': ' · {n} not uploaded',

    // ----------------------------------------------------------- barra y nav
    'nav.teams':     'Teams',
    'nav.matches':   'Matches',
    'nav.account':   'Account',
    'nav.newMatch':  'New match',
    'nav.pickTeam':  'Pick a team first',

    // ------------------------------------------------------------- la pista
    'court.title':   'Handball half-court',

    // -------------------------------------------------------- posiciones
    'position.Portero':            'Goalkeeper',
    'position.Lateral izquierdo':  'Left back',
    'position.Central':            'Centre back',
    'position.Lateral derecho':    'Right back',
    'position.Extremo izquierdo':  'Left wing',
    'position.Extremo derecho':    'Right wing',
    'position.Pivote':             'Pivot',

    // ------------------------------------------------- zonas de lanzamiento
    'origin.EI':   'Left wing',
    'origin.LI':   'Left back',
    'origin.CE':   'Centre back',
    'origin.LD':   'Right back',
    'origin.ED':   'Right wing',
    'origin.PIV':  'Pivot',
    'origin.7M':   '7 metres',

    // ---------------------------------------------------- zonas de portería
    'goalZone.1':  'top left',
    'goalZone.2':  'top centre',
    'goalZone.3':  'top right',
    'goalZone.4':  'mid left',
    'goalZone.5':  'mid centre',
    'goalZone.6':  'mid right',
    'goalZone.7':  'bottom left',
    'goalZone.8':  'bottom centre',
    'goalZone.9':  'bottom right',

    // -------------------------------------------------------------- eventos
    'event.turnover':   'Turnover',
    'event.steal':      'Steal',
    'event.exclusion':  '2 minutes',
    'event.yellow':     'Yellow card',
    'event.red':        'Red card',
    'event.assist':     'Assist',
    'event.block':      'Block',
    'event.foul7m':     '7 m drawn',
    'event.in':         'Comes on',
    'event.out':        'Goes off',

    'eventShort.turnover':  'TO',
    'eventShort.steal':     'ST',
    'eventShort.exclusion': '2′',
    'eventShort.yellow':    'YC',
    'eventShort.red':       'RC',

    // --------------------------------------------------------------- meses
    'month.1':  'Jan', 'month.2':  'Feb', 'month.3':  'Mar', 'month.4':  'Apr',
    'month.5':  'May', 'month.6':  'Jun', 'month.7':  'Jul', 'month.8':  'Aug',
    'month.9':  'Sep', 'month.10': 'Oct', 'month.11': 'Nov', 'month.12': 'Dec',
    'date.short': '{mes} {d}',
    'number.decimal': '.',

    // ------------------------------------------------------------- tarjetas
    'team.playerCount_one':   '{n} player',
    'team.playerCount_other': '{n} players',
    'team.rosterCount_one':   '{n} player on the roster',
    'team.rosterCount_other': '{n} players on the roster',
    'result.win':   'Win',
    'result.loss':  'Loss',
    'result.draw':  'Draw',

    // ------------------------------------------------------------- entrada
    'auth.noConfig':      'Supabase is not set up. Fill in <code>js/config.js</code> with the project URL and the anon key (Project Settings → API).',
    'auth.noConfigHint':  'Until then you cannot sign in or save anything.',
    'auth.orEmail':       'or with your email',
    'auth.login':         'Sign in',
    'auth.register':      'Create account',
    'auth.email':         'Email',
    'auth.emailHint':     'you@email.com',
    'auth.password':      'Password',
    'auth.toLogin':       'Already have an account? Sign in',
    'auth.toRegister':    'No account yet? Create one',
    'auth.footer':        'Your data is stored in your account and synced across your devices.',
    'auth.googleBtn':     'Sign in with Google',
    'auth.needBoth':      'Enter your email and password.',
    'auth.confirmSent':   'Account created. Confirm the email we sent you and sign in.',

    'authError.googleNoToken':  'Google did not return a session. Try again.',
    'authError.googleOff':      'Signing in with Google is not available right now.',
    'authError.googleSign':     'This app is not registered with Google under this signature. Check the client ID and the SHA-1 fingerprint.',
    'authError.badLogin':       'Wrong email or password.',
    'authError.alreadyUser':    'An account with that email already exists. Sign in instead of creating one.',
    'authError.shortPassword':  'That password is too short: 6 characters minimum.',
    'authError.badEmail':       'That email does not look valid.',
    'authError.notConfirmed':   'You have to confirm your email before signing in. Check your inbox.',
    'authError.edgeFunction':   'Could not reach the deletion service. Check your connection; if it keeps failing, you can request deletion by email from the privacy policy.',
    'authError.network':        'No connection to the server. Check your network.',
    'authError.generic':        'Could not complete: {msg}',
    'authError.unknown':        'unknown error',
    'google.noClientId':        'Signing in with Google needs the client ID in js/config.js.',
    'google.noSecureContext':   'Signing in with Google needs https (or localhost).',
    'google.notLoaded':         'Could not load the Google button. Check your connection.',

    // ------------------------------------------------------------- migración
    'migrate.title':    'Data in this browser',
    'migrate.body':     'This browser has teams and matches saved from before there were accounts. Do you want to move them into yours?',
    'migrate.note':     'They are copied, not deleted. If you say no, they stay where they are and you will not be asked again.',
    'migrate.yes':      'Import into my account',
    'migrate.no':       'No, start from scratch',
    'migrate.done_one':   'Imported {n} match',
    'migrate.done_other': 'Imported {n} matches',
    'migrate.doneEmpty':  'Data imported',

    // --------------------------------------------------------------- panel
    'dashboard.title':      'Teams',
    'dashboard.empty':      'You do not have any team yet',
    'dashboard.emptyHint':  'Create your first team to start recording matches.',
    'dashboard.newTeam':    'New team',
    'dashboard.teamName':   'Team name',
    'dashboard.teamHint':   'e.g. CB Sabadell',
    'dashboard.create':     'Create team',
    'dashboard.nameTooLong':'That team name is too long (80 characters max).',

    'resume.unsaved':   'Not saved',
    'resume.continue':  'Continue the match',
    'resume.drop':      'Discard',
    'resume.dropAsk':   'Discard the unsaved match? Everything recorded will be lost.',

    // --------------------------------------------------------------- cuenta
    'account.title':        'Account',
    'account.teams_one':    '{n} team in this account',
    'account.teams_other':  '{n} teams in this account',
    'account.sync':         'Sync',
    'account.allGood':      'All up to date',
    'account.allGoodSub':   'Your data is stored in the cloud and on this device.',
    'account.session':      'Session',
    'account.logout':       'Sign out',
    'account.language':     'Language',
    'account.languageSub':  'On this device only: it is not synced with your account.',
    'account.deleteTitle':  'Delete account',
    'account.deleteSub':    'The account and everything in it is deleted: teams, rosters, matches, shots and events, on this device and in the cloud. This cannot be undone.',
    'account.deleteBtn':    'Delete my account',
    'account.deleteNoUndo': 'This cannot be undone',
    'account.deleteAsk':    'Type <strong>{palabra}</strong> to confirm that you want to delete the account and everything it holds.',
    'account.deleteWord':   'DELETE',
    'account.deleteLabel':  'Confirmation',
    'account.deleteGo':     'Delete the account',
    'account.deleting':     'Deleting…',
    'account.deleteType':   'Type {palabra} to confirm.',
    'account.deleteFailed': 'Could not delete the account.',
    'account.deleted':      'Account deleted',

    // ---------------------------------------------------------------- plan
    'plan.title':        'Plan',
    'plan.free':         'Free plan',
    'plan.pro':          'SuperStat Pro',
    'plan.trialing':     'SuperStat Pro · trial',
    'plan.until':        'Active until {d}',
    'plan.manage':       'Manage subscription',
    'plan.emails':       'Email updates',
    'plan.emailsSub':    'News and updates about your plan. You can unsubscribe at any time.',
    'plan.emailsFailed': 'The change could not be saved.',
    'plan.freeUse':      'You have saved {n} of {tope} matches.',

    'limit.title_one':   'The Free plan covers {n} team',
    'limit.title_other': 'The Free plan covers {n} teams',
    'limit.subWeb':      'With SuperStat Pro you can run as many teams as you like, each with its own roster and matches.',
    'limit.subApp':      'You can carry on recording matches and editing the team you already have.',
    'limit.matchTitle_one':   'The Free plan covers {n} saved match',
    'limit.matchTitle_other': 'The Free plan covers {n} saved matches',
    'limit.matchSubWeb':      'With SuperStat Pro you can save as many matches as you like, each with its shot map and season stats.',
    'limit.matchSubApp':      'The matches you already have stay put: you can open, correct and export them as always.',
    'limit.seePro':      'See SuperStat Pro',

    'paywall.title':      'SuperStat Pro',
    'paywall.sub':        'All your teams and all your matches in one account',
    'paywall.f1':         'Unlimited teams, each with its own roster',
    'paywall.f2':         'Unlimited matches, each with its shot map and season stats',
    'paywall.f3':         'The same data on your phone and your computer, offline too',
    'paywall.priceMonth': '{p} per month',
    'paywall.trial':      'The first 7 days are free. Cancel any time.',
    'paywall.go':         'Start the 7-day trial',
    'paywall.going':      'Opening checkout…',
    'paywall.failed':     'The checkout page could not be opened. Please try again.',
    'paywall.legal':      'Payments are handled by Stripe. SuperStat never stores your card details.',
    'paywall.checking':   'Checking your payment…',
    'paywall.welcome':    'You now have SuperStat Pro',
    'paywall.soon':       'Payment received. Your plan will be active shortly.',

    // -------------------------------------------------------------- equipo
    'team.roster':        'Roster',
    'team.noPlayers':     'No players yet.',
    'team.editPlayer':    'Edit player',
    'team.newPlayer':     'New player',
    'team.name':          'Name',
    'team.nameHint':      'Player name',
    'team.dorsal':        'Number',
    'team.position':      'Position',
    'team.addPlayer':     'Add player',
    'team.matches':       'Matches',
    'team.newMatch':      '＋ New match',
    'team.viewMatches':   'See stats from previous matches',
    'team.viewSeason':    'Season totals',
    'team.deleteTitle':   'Delete',
    'team.deleteSub':     'Deleting the team also deletes its roster and all its matches, with everything recorded in them. This cannot be undone.',
    'team.deleteBtn':     'Delete this team',
    'team.deleteAsk_one':   'Delete the team {equipo}? Its roster and {n} match will go, with everything recorded. This cannot be undone.',
    'team.deleteAsk_other': 'Delete the team {equipo}? Its roster and {n} matches will go, with everything recorded. This cannot be undone.',
    'team.deleted':       'Team deleted',
    'team.playerSaved':   'Player updated',
    'team.needNameDorsal':'Enter a name and a number.',
    'team.badDorsal':     'The number has to be between 0 and 99.',
    'team.nameTooLong':   'That name is too long (80 characters max).',

    // ------------------------------------------------------ lista de partidos
    'matchList.title':   'Matches',
    'matchList.empty':   'No matches saved yet.',
    'matchList.season':  'See the season totals',

    // ------------------------------------------------------ ficha de partido
    'match.vs':             'vs {rival}',
    'match.halfTimeAt':     'half time at {n}′',
    'match.ourShots':       'Our shots (rival goal)',
    'match.goals':          'Goals',
    'match.savedByRival':   'Saved by the rival',
    'match.outAndPosts':    'Wide and posts',
    'match.efficiency':     'Efficiency',
    'match.scorers':        'Scorers in this match',
    'match.goalsUnit_one':   '{n} goal',
    'match.goalsUnit_other': '{n} goals',
    'match.whereWeShoot':   'Where we shoot from',
    'match.goalsPerShots':  'goals / shots',
    'match.whereInGoal':    'Which part of the goal',
    'match.fromEachZone':   'from each zone',
    'match.rivalShots':     'Rival shots (our goal)',
    'match.conceded':       'Goals conceded',
    'match.ourSaves':       'Saves by your keeper',
    'match.rivalOut':       'Rival shots wide',
    'match.savePct':        'Keeper save %',
    'match.keepers':        'Goalkeepers',
    'match.savesPerFaced':  'saves / shots faced',
    'match.whereTheyShoot': 'Where they shoot from',
    'match.plusMinus':      'Plus/minus',
    'match.plusMinusSub':   'with each player on court',
    'match.otherRecords':   'Other records',
    'match.share':          'Share',
    'match.shareImage':     'Image',
    'match.downloadCsv':    'Download CSV',
    'match.edit':           'Edit match',
    'match.rival':          'Opponent',
    'match.date':           'Date',
    'match.halfTimeMinute': 'Half-time minute',
    'match.halfTimeEmpty':  'Not marked',
    'match.deleteBtn':      'Delete this match',
    'match.deleteAsk':      'Delete the match against {rival}? This cannot be undone.',
    'match.deleted':        'Match deleted',
    'match.saved':          'Match updated',
    'match.needRivalDate':  'Enter the opponent and the date.',
    'match.rivalTooLong':   'That opponent name is too long (80 characters max).',
    'match.badHalfTime':    'The half-time minute has to be a number of minutes.',

    'stats.noShotsAtUs':    'No shots at our goal yet.',
    'stats.needCourtMark':  'Mark who is on court during the match and this shows what happens on the scoreboard while each player is playing.',
    'stats.noEvents':       'None were recorded in this match.',
    'stats.needOrigin':     'You need to record the shooting point to cross it with the goal.',
    'stats.crossLegend':    'Goals / shots at each part of the goal. The lighter it is, the more they shoot there.',
    'stats.crossCell':      '{zona}: {goles} of {n}',
    'stats.shotsUnit_one':   '{n} shot',
    'stats.shotsUnit_other': '{n} shots',

    // --------------------------------------------------------- mapa de tiros
    'map.all':        'All',
    'map.half':       'Half {n}',
    'map.heat':       'Heat map',
    'map.allPlayers': 'All players',
    'map.noPoints':   'No shot has a recorded point.',
    'map.noPointsFiltered': 'No shot has a recorded point with this filter.',
    'map.shots_one':   '{n} shot',
    'map.shots_other': '{n} shots',
    'map.goals_one':   '{n} goal',
    'map.goals_other': '{n} goals',
    'map.saves_one':   '{n} save',
    'map.saves_other': '{n} saves',
    'map.out':         '{n} wide',

    // ----------------------------------------------------------- anotaciones
    'annot.title':        'Records',
    'annot.titleSub':     'in the order they were recorded',
    'annot.empty':        'This match has nothing recorded.',
    'annot.delete':       'Delete record',
    'annot.deleted':      'Record deleted',
    'annot.rival.goal':   'Goal',
    'annot.rival.save':   'Save by the rival keeper',
    'annot.rival.out':    'Shot wide',
    'annot.rival.post':   'Post',
    'annot.own.goal':     'Goal conceded',
    'annot.own.save':     'Save',
    'annot.own.out':      'Rival shot wide',
    'annot.own.post':     'Rival hit the post',
    'annot.shot':         'Shot',
    'annot.by':           '{que} by {quien}',
    'annot.keeper':       '{que} · keeper {quien}',
    'annot.withPlayer':   '{que} · {quien}',
    'annot.minute':       '{n}′',
    'annot.minuteHalf':   '{n}′ · half {parte}',
    'annot.half':         'Half {n}',

    // ------------------------------------------------------------- temporada
    'season.title':       'Season',
    'season.empty':       'No matches yet',
    'season.emptyHint':   'Once you save one, everything adds up here: scorers, goalkeepers and where you shoot best from.',
    'season.played_one':  '{n} match',
    'season.played_other':'{n} matches',
    'season.record':      'wins · draws · losses',
    'season.total':       'Overall',
    'season.goalsFor':    'Goals for · {n}/match',
    'season.goalsAgainst':'Against · {n}/match',
    'season.effIn_one':     'Efficiency over {n} shot',
    'season.effIn_other':   'Efficiency over {n} shots',
    'season.savesIn_one':   'Saves over {n} shot faced',
    'season.savesIn_other': 'Saves over {n} shots faced',
    'season.scorers':     'Scorers',
    'season.wholeSeason': 'the whole season',
    'season.perMatch':    '{n}/match',
    'season.noScorers':   'No goals assigned to a player yet.',
    'season.noFaced':     'No shots faced yet.',
    'season.bestZones':   'Where we shoot best from',
    'season.noOrigins':   'You need to record the shooting point.',
    'season.plusMinus':   'Plus/minus for the season',
    'season.noPlusMinus': 'Mark who is on court during matches to see it here.',
    'season.noEvents':    'None recorded yet.',

    // --------------------------------------------------------- marcador y CSV
    'timeline.title':     'How the goal difference moved',
    'timeline.range':     'min 0 – {n}',
    'timeline.goalByGoal':'goal by goal',
    'timeline.bestRunUs':    'Best run: {n} goals in a row for us',
    'timeline.bestRunThem':  'Best run: {n} goals in a row for the rival',
    'timeline.bestRunWhen':  ' (min {desde}–{hasta})',

    'csv.type':       'type',
    'csv.period':     'half',
    'csv.minute':     'minute',
    'csv.side':       'side',
    'csv.result':     'result',
    'csv.goalZone':   'goal_zone',
    'csv.player':     'player',
    'csv.dorsal':     'number',
    'csv.courtZone':  'court_zone',
    'csv.originX':    'origin_x',
    'csv.originY':    'origin_y',
    'csv.shot':       'shot',
    'csv.event':      'event',
    'csv.ourGoal':    'our goal',
    'csv.rivalGoal':  'rival goal',
    'csv.fileName':   'match',

    'share.efficiency':  'Efficiency',
    'share.shots':       'Shots',
    'share.saves':       'Saves',
    'share.savePct':     'save %',
    'share.scorers':     'SCORERS',
    'share.noScorers':   'No goals recorded by player',
    'share.madeWith':    'Made with SuperStat',
    'share.goal_one':    '{n} goal',
    'share.goal_other':  '{n} goals',
    'share.failed':      'Could not build the image',
    'share.savedTo':     'Saved to Documents: {archivo}',
    'share.downloaded':  'Downloaded',

    // ------------------------------------------------------- partido en vivo
    'setup.title':      'New match',
    'setup.rivalName':  'Opponent name',
    'setup.rivalHint':  'e.g. CE Granollers',
    'setup.date':       'Date',
    'setup.start':      'Start recording shots',

    'live.save':          'Save',
    'live.ourGoal':       'Our goal',
    'live.rivalGoal':     'Rival goal',
    'live.keeperIs':      'for {quien}',
    'live.rivalShoots':   'the rival shoots',
    'live.weShoot':       'we shoot',
    'live.tally':         '{g} G · {p} S · {f} wide',
    'live.tallyPost':     ' · {n} post',
    'live.out':           'Wide',
    'live.post':          'Post',
    'live.undo':          'Undo',
    'live.tapHint':       '1 tap = goal · 2 taps = save',
    'live.quickLog':      'Quick log',
    'live.undoEvent':     'Undo {que}',
    'live.undoEventOf':   'Undo {que} by {quien}',
    'live.inGoal':        'In goal',
    'live.keeperUnset':   'not set: conceded goals will have no keeper',
    'live.noKeepers':     'There is no goalkeeper on the roster.',
    'live.onCourt':       'On court',
    'live.tooMany':       ' · that is too many',
    'live.noFieldPlayers':'There are no outfield players on the roster.',
    'live.courtHint':     'Tap whoever comes on or goes off. This is what gives each player their plus/minus.',
    'live.options':       'Options',
    'live.askOrigin':     'Ask for the shooting zone',
    'live.discard':       'Discard match',
    'live.discardAsk':    'Discard this match? The shots recorded will be lost.',
    'live.half':          'Half {n}',
    'live.endFirstHalf':  'End half 1',
    'live.clockStop':     'Stop the clock',
    'live.clockStart':    'Start the clock',
    'live.halfEnded':     'First half ended on minute {n}',
    'live.flashGoal':     'GOAL',
    'live.flashSave':     'SAVE',
    'live.matchSaved':    'Match saved',
    'live.matchSavedHere':'Match saved on this device',

    'ask.goal':      'Who scored?',
    'ask.save':      'Who shot?',
    'ask.out':       'Who shot wide?',
    'ask.post':      'Who hit the post?',
    'ask.player':    'Pick a player',
    'ask.keeper':    'Which keeper do we have in goal?',
    'ask.keeperSub': 'They stay set for the rest of the match; you can change them when another one comes on.',
    'ask.whichPlayer':'Which player?',
    'ask.origin':    'Where did the shot come from?',
    'ask.originSub': '{quien} attacking · tap the exact point on the court'
  };

  const DICTS = { es: ES, en: EN };
  const LANGS = ['es', 'en'];
  const NAMES = { es:'Español', en:'English' };

  let lang = 'es';

  // ?lang gana sobre todo lo demás porque es lo que usan las herramientas de
  // captura: piden una pantalla en un idioma concreto sin tocar la preferencia
  // guardada del que esté usando el navegador.
  function detect(){
    let fromUrl = null;
    try{
      fromUrl = new URLSearchParams(location.search).get('lang');
    }catch(e){ /* sin location utilizable: se sigue con lo demás */ }
    if(fromUrl && DICTS[fromUrl]) return fromUrl;

    const saved = window.Store && Store.lang ? Store.lang() : null;
    if(saved && DICTS[saved]) return saved;

    const nav = (navigator.languages && navigator.languages[0]) || navigator.language || '';
    const base = String(nav).toLowerCase().split('-')[0];
    return DICTS[base] ? base : 'es';
  }

  function setLang(code){
    if(!DICTS[code]) return;
    lang = code;
    if(window.Store && Store.setLang) Store.setLang(code);
    if(document.documentElement) document.documentElement.lang = code;
  }

  // Sustituye {marcador} por el valor. No escapa nada: escapar es cosa de quien
  // monta el HTML, que es el que sabe si el hueco va en un atributo o en texto.
  function fill(text, params){
    if(!params) return text;
    return text.replace(/\{(\w+)\}/g, (todo, k) => (
      params[k] === undefined || params[k] === null ? todo : String(params[k])
    ));
  }

  // Con `n` en los parámetros se prueba primero la forma de plural. El inglés y
  // el español coinciden en partir por "uno / los demás", así que basta con dos
  // formas; si algún día entra un idioma con más, es aquí donde se amplía.
  function lookup(dict, key, params){
    if(params && params.n !== undefined){
      const suf = Number(params.n) === 1 ? '_one' : '_other';
      if(dict[key + suf] !== undefined) return dict[key + suf];
    }
    return dict[key];
  }

  function t(key, params){
    const dict = DICTS[lang] || ES;
    let text = lookup(dict, key, params);
    if(text === undefined){
      // Una clave sin traducir se enseña en español antes que como clave: el
      // usuario ve una palabra rara, no "season.noEvents". El aviso es para
      // quien programa, y test/i18n.js hace que no llegue a producción.
      text = lookup(ES, key, params);
      if(text === undefined){
        console.warn('texto sin clave: ' + key);
        return key;
      }
      console.warn('sin traducir en ' + lang + ': ' + key);
    }
    return fill(text, params);
  }

  lang = detect();
  if(document.documentElement) document.documentElement.lang = lang;

  return {
    t,
    setLang,
    lang: () => lang,
    langName: (code) => NAMES[code] || code,
    LANGS,
    // Los diccionarios en crudo, para que test/i18n.js pueda compararlos.
    DICTS
  };
})();
