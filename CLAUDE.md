# SuperStat — estadísticas de balonmano

App web de una sola página (vanilla HTML/CSS/JS, sin build ni frameworks) para
llevar estadísticas de equipos de balonmano: plantillas, partidos y mapa de
tiros por zona de portería.

Los datos viven en **Supabase** (Postgres + Auth) y se sincronizan solos entre
dispositivos. La app funciona entera sin conexión: escribe en un espejo local y
sube los cambios cuando vuelve la red.

Pensada como punto de partida: hoy cubre balonmano, pero el nombre del
proyecto y la estructura están para poder añadir otros deportes más adelante.

## Cómo ejecutarlo

No hay proceso de build. Basta con servir los archivos estáticos:

```
npm start
```

(usa `npx serve` bajo el capó; también vale `python3 -m http.server`).

Antes de que arranque hay que rellenar `js/config.js` con la URL y la clave
anon del proyecto de Supabase; si están vacías, la app lo dice en pantalla y no
deja entrar. La puesta a punto completa —incluido el login con Google— está en
`docs/supabase.md`.

Ya no vale abrir `index.html` a pelo con `file://`: el botón de Google solo
funciona desde un origen declarado en Google Cloud, y el nonce se calcula con
`crypto.subtle`, que solo existe en contexto seguro (https o localhost).

La app es una PWA: `sw.js` guarda el HTML, el CSS, los scripts y las librerías
de `vendor/`, así que abre sin cobertura y se puede instalar en la pantalla de
inicio. **Si tocas cualquier archivo del shell, sube `VERSION` en `sw.js`**, o
los navegadores que ya tengan la caché vieja seguirán sirviéndola.

La misma web se empaqueta además como app de **Android y iOS** con Capacitor.
No hay un segundo código: las apps abren un WebView con estos mismos archivos
dentro del aparato. Lo que cambia está aislado en `js/native.js`, y compilar y
publicar está en `docs/movil.md`.

**Nada de lo que hace falta para arrancar puede venir de fuera.** Por eso
`supabase-js` y `capacitor-core` están copiados en `vendor/` en vez de traerse
de un CDN: con un CDN de por medio, ni la app ni la web abren la primera vez sin
cobertura, que es justo el caso para el que está hecha. Hay una prueba que lo
vigila. La excepción es el script de Google, que solo hace falta para entrar y
no para usar la app.

## Estructura

- `index.html` — esqueleto de la página y carga de fuentes/estilos/scripts.
- `css/styles.css` — todos los estilos (tema oscuro sobre negro con la
  tipografía del sistema, cabecera y barra inferior flotantes, tarjetas,
  la portería dibujada con postes y red, el modal de selección de
  jugador, etc.).
- `js/config.js` — URL y clave anon de Supabase, y el ID de cliente de Google.
  Las tres se publican a propósito.
- `js/db.js` — todo lo que habla con Supabase: sesión, login y las dos
  operaciones de sincronización (`pull` y `push`). No sabe de pantallas.
- `js/store.js` — espejo local, cola de sincronización y fusión. Es la única
  puerta de entrada a los datos para el resto de la app.
- `js/app.js` — toda la lógica de pantalla: una single-page app hecha a mano
  con `render()` que reconstruye `#app` según `state.screen`, sin frameworks.
- `js/native.js` — puente con Android e iOS: las tres cosas que un WebView no
  sabe hacer (entrar con Google, descargar un archivo y compartir). En el
  navegador se aparta y no hace nada.
- `vendor/` — librerías de terceros copiadas sin tocar, para no depender de un
  CDN. Tiene su propio README con cómo actualizarlas.
- `supabase/schema.sql` — tablas, índices, migraciones y políticas RLS.
- `supabase/functions/borrar-cuenta/` — la única pieza de servidor del proyecto.
  Borra la cuenta entera, incluida la fila de `auth.users`, que es lo que la app
  no puede hacer: con la clave anon y RLS se marcan las filas propias, pero al
  usuario no se le toca. Se despliega aparte del esquema (`docs/supabase.md`) y,
  sin desplegar, el botón de *Cuenta* da error.
- `supabase/config.toml` — lo justo para que la CLI sepa a qué proyecto
  desplegar esa función, y para que su `verify_jwt = false` viaje en el
  repositorio en vez de en un ajuste del panel: con la comprobación del token en
  la puerta de enlace, el preflight de CORS —que va sin `Authorization`— se
  rechaza y el borrado falla con el mismo error que si no estuviera desplegada.
  Quien comprueba el token es la propia función, así que no se pierde nada.
- `sw.js` — service worker: guarda el shell para poder abrir sin cobertura.
- `manifest.webmanifest` e `icons/` — instalación en la pantalla de inicio.
- `capacitor.config.json` y `assets/` — configuración de las apps nativas y la
  materia prima de sus iconos.
- `tools/make-icons.js` — genera los iconos de todo, web y apps, desde el
  dibujo de la marca.
- `tools/build-www.js` — arma `www/` con lo que se empaqueta dentro de la app.
  **Si añades un archivo a la web, hay que añadirlo a su lista**, o no entrará.
- `privacidad.html` — política de privacidad. Página suelta, sin CSS ni scripts
  del resto: Google Play exige una URL pública que se abra sin instalar nada ni
  entrar con una cuenta. **No entra en `tools/build-www.js` a propósito**: lo
  que pide Play es el enlace en la ficha, no una pantalla más dentro de la app.
- `play/` — icono, gráfico de cabecera y capturas de la ficha de Google Play.
  No son producto: no entran en ningún binario y solo hacen falta al publicar.
- `tools/make-play-assets.js` — genera el icono y la cabecera de la ficha.
- `tools/make-screenshots.js` — genera las capturas: abre la app de verdad con
  los dobles de `test/` detrás, juega un partido inventado con semilla fija y
  fotografía ocho pantallas.
- `docs/supabase.md` — puesta a punto de Supabase y de Google, y el despliegue
  de la Edge Function de borrado de cuenta.
- `docs/movil.md` — compilar y publicar en Google Play y la App Store.
- `docs/play.md` — la ficha de Play: textos, respuestas de los formularios y la
  cuenta para el revisor.
- `docs/publicar-android.md` — el recorrido completo para publicar en Google
  Play, en orden de ejecución. No repite lo de los otros tres documentos: dice
  en qué orden se hacen las cosas y cuáles dependen de otra anterior.

## Modelo de datos

La verdad está en Postgres (`supabase/schema.sql`): cinco tablas —`teams`,
`players`, `matches`, `shots` y `events`— con `user_id` en todas para que las
políticas RLS sean directas. **RLS es lo único que separa los datos de un
usuario de los de otro**, porque la clave anon la tiene cualquiera que abra la
web: si añades una tabla, añade su política en el mismo commit.

El archivo se puede volver a ejecutar entero sobre una base que ya tiene datos:
lo que se añadió después de la primera versión está en su sección de
migraciones, todo con `if exists` / `if not exists`.

Cada fila lleva dos marcas de tiempo y no son intercambiables:

- `updated_at` la pone el navegador. Decide quién gana en un conflicto, y tiene
  que ser del cliente para que un cambio hecho sin red conserve su momento real.
- `server_at` la pone un trigger en la base. Es por la que se piden los cambios
  nuevos, para que un reloj desajustado no deje filas sin traer.

En el navegador, `store.js` guarda un espejo de esas filas y una cola:

- `hb:cache:<userId>` → espejo de las cinco tablas más los cursores de `pull`.
- `hb:queue:<userId>` → operaciones sin subir. Todas son upsert de la fila
  entera, así que subir una dos veces no duplica nada.
- `hb:draft:<userId>` → el partido en curso. No es una fila todavía y no pasa
  por la cola: es el borrador en memoria volcado en cada cambio, para que un
  partido a medias sobreviva a que el móvil descarte la pestaña.

Reglas de las que depende que la sincronización sea resoluble:

1. **Los ids se generan en el navegador** (`Store.uuid()`), nunca en la base.
2. **Los borrados son lógicos** (`deleted_at`). Con borrado físico no se
   distingue "lo borré" de "aún no lo he subido" y lo borrado reaparece. Por eso
   `Store.deleteTeam()` marca fila a fila el equipo, su plantilla, sus partidos
   y los tiros y eventos de esos partidos: el `on delete cascade` de Postgres
   solo actúa en un borrado físico, y una fila sin marcar volvería al espejo del
   siguiente dispositivo que sincronice. La cascada escribe con el volcado
   diferido y hace un solo `persist()` al final (`flush()`), o un partido con
   doscientas anotaciones deja el móvil pensando. El borrado definitivo llega a
   los 90 días, y lo hace la base: `public.purgar_borrados()` programada con
   `pg_cron` en `supabase/schema.sql`. Es lo que promete `privacidad.html`.
3. **Gana lo más reciente**, salvo que la fila esté pendiente en la cola: en ese
   caso gana lo local y no se pisa.

El partido en curso (`state.draft`) sigue sin pasar por el store como dato: solo
se convierte en filas al pulsar Guardar. Lo único que hace `Store.saveDraft()`
es volcarlo en `hb:draft:<userId>` después de cada anotación, y `loadDraft()`
lo recupera al entrar para ofrecer seguir con él desde el panel. Anotar tiros no
depende de la red.

En pantalla, un tiro es `{ zone: 1-9|null, type: 'goal'|'save'|'out'|'post',
player, keeper, origin: {x,y}|null, minute, period, ordinal }`; `store.js` lo
traduce a la fila de `shots` y al revés. `zone` es null justo cuando el tiro no
fue a puerta (`out` o `post`), y esa correspondencia la comprueba la base.

`keeper` es **nuestro** portero cuando el tiro va a nuestra portería, y va en
`goalkeeper_id`. Se pone en todos los tiros recibidos y no solo en las paradas:
sin los goles encajados no hay denominador y el porcentaje de paradas por
portero no se puede calcular. Los partidos de antes guardaban el portero en
`player_id` y solo en las paradas; `shotToApp()` lee los dos sitios.

`minute` y `period` los pone el reloj de la pantalla de partido. El reloj es uno
solo y no se reinicia en el descanso: el usuario decide cuándo acaba la primera
parte con un botón, y el minuto en que lo hace se guarda en
`matches.half_time_minute`. No se da por hecho ninguna duración de parte.

`ordinal` es un contador único dentro del partido **compartido entre tiros y
eventos**. Es lo que permite reconstruir el orden real de todo y, con los
eventos `in` y `out`, saber quién estaba en pista en cada gol: de ahí sale el
más/menos. Si añades otra cosa que se anote en vivo, sácale el ordinal del mismo
contador (`stamp()`).

Lo que no es un tiro va a `events`: pérdida, robo, 2 minutos y tarjetas, más las
altas y bajas de pista. Para añadir un tipo nuevo basta con meterlo en
`EVENT_TYPES` y en `EVENT_NAME` (app.js) y, si no estuviera ya, en el `check` de
la tabla; no hay que tocar la sincronización.

`EVENT_TYPES` son los botones del panel y `EVENT_NAME` los nombres para
enseñarlos, y tiene más entradas a propósito (`assist`, `block`, `foul7m`): la
base los sigue aceptando, así que un partido anotado con otra versión de la app
se enseña con su nombre. Por eso las estadísticas recorren los tipos que
aparecen en los datos (`eventTypesIn()`) y no la lista de botones: quitar un
botón no hace desaparecer lo que ya se anotó con él.

`origin` es el punto de la pista desde el que se lanzó, `{ x, y }` en **metros**:
`x` de 0 a 20 de banda a banda (de izquierda a derecha vistas desde el ataque) e
`y` = distancia a la línea de gol, 0 en la portería. Se marca con un toque sobre
la media pista dibujada a escala en `courtSvg()`, y `courtPointFromEvent()` es
quien convierte el toque a metros.

Las medidas viven en la constante `COURT`. La pista se dibuja sólo hasta
`COURT.depth` (15 m) porque más lejos no se lanza casi nunca y recortarla da más
precisión al marcar. Cuidado con una cosa: el `aspect-ratio` de `.court-svg` en
el CSS tiene que seguir coincidiendo con `COURT_VB`, o el punto tocado deja de
caer donde toca.

Para agrupar en las estadísticas, `zoneFromPoint()` deduce del punto una de las
zonas de `ORIGINS` (`EI`, `LI`, `CE`, `LD`, `ED`, `7M`, `PIV`). La zona no se
guarda: siempre se recalcula, así que se puede cambiar el criterio sin migrar
nada. Usa `shotZone(shot)` y no `zoneFromPoint()` a pelo, porque los partidos
de la primera versión guardaban en `origin` el id de la zona en vez del punto y
`shotZone()` entiende los dos formatos.

Registrar el punto es opcional: se activa y desactiva con el interruptor de la
pantalla de partido en vivo (`draft.askOrigin`, encendido por defecto). Los
tiros sin punto tienen `origin: null` y se muestran como "Sin especificar".

- `shotsOwn` = tiros del **rival** a nuestra portería (gol = encajado,
  parada = la hizo nuestro portero).
- `shotsRival` = tiros de **nuestro equipo** a la portería rival (gol =
  anotado, parada = la hizo el portero rival).
- `missOwn` y `missRival` = los que no fueron a puerta, fuera o al palo, con la
  misma forma. `outOwn`/`outRival` siguen siendo el total de fallados, sumando
  los contadores sueltos de los partidos de la primera versión.
- En **todos** los tiros nuestros (`shotsRival` y `missRival`, entren o no) se
  pregunta quién ha lanzado: sin eso solo hay goles por jugador, no acierto.
  En los del rival no se pregunta tirador, porque sería su plantilla y no se
  gestiona en la app; lo que hace falta ahí es nuestro portero, y ese se
  pregunta una sola vez —en el primer tiro que recibimos— y se queda fijado.
  También se puede cambiar cuando se quiera desde la pantalla de partido.

## Convenciones al tocar el código

- Todo vive en un único `state` global y una función `render()` que
  reconstruye el HTML del screen actual; los manejadores de eventos se
  vuelven a enlazar en `attachHandlers()` después de cada render. Si añades
  una vista nueva, sigue ese mismo patrón (no introduzcas un framework).
- `render()` pone en `#app` la clase `screen-<pantalla>`, que es como el
  partido en vivo se permite ser más ancho que el resto de la app, y la clase
  `has-nav` cuando toca barra inferior.
- Todas las pantallas montan su cabecera con `topbar({left, right})`: tres
  huecos con el logo siempre centrado. El nombre de la pantalla no va ahí, va
  en el contenido con `pageTitle(titulo, subtitulo)`. Los botones redondos de
  los lados se hacen con `backBtn(id, etiqueta)` e `icon(nombre)`.
- La barra inferior la añade `render()` a las pantallas de `NAV_SCREENS`, no
  cada vista: así una pantalla nueva solo tiene que entrar (o no) en esa lista.
  La pestaña activa se deduce de `state.screen`, sin estado nuevo.
- El color de las tarjetas no se guarda en ninguna parte: el de un equipo sale
  de su nombre (`teamTint()`) y el de un partido, del resultado
  (`matchCardHtml()`). Si hace falta otro sitio con color, deducirlo igual en
  vez de añadir un campo a la base.
- Un tiro puede necesitar varias preguntas antes de registrarse (jugador,
  zona de lanzamiento, las dos o ninguna). Se resuelve con la lista
  `pendingShot.steps` y `advancePending()`: si añades otra pregunta, mete un
  paso más en esa lista en vez de encadenar modales. `pendingShot.role` dice si
  el jugador que se está eligiendo es el tirador o el portero, porque el paso
  es el mismo y lo que cambia es qué se hace con la respuesta.
- El reloj se refresca solo su hueco (`#clock-time`) con un `setInterval`, no
  repintando la pantalla: un `render()` por segundo cerraría el modal abierto y
  se cargaría el punto que se está tocando en la pista. `startClockTick()` se
  vuelve a armar al final de `attachHandlers()`.
- Corregir un partido guardado es borrar la anotación que sobra y volver a
  anotarla, no editar la fila: la lista de `annotationsHtml()` sale al abrir el
  lápiz de la ficha, ordena tiros y eventos por su `ordinal` compartido y cada
  línea llama a `Store.deleteShot()` o `Store.deleteEvent()`. Editar en sitio
  obligaría a repetir ahí el modal de jugador, el de zona y el punto de la pista.
- Las pantallas de estadística no guardan nada de lo que enseñan. Los filtros
  del mapa viven en `state.mapFilter` y el acumulado de temporada se calcula
  sobre el espejo local (`seasonStats()`), no con una consulta aparte: así sale
  igual sin cobertura y no hay dos formas distintas de contar lo mismo.
- La marca (el cuadro rojo con las barras más el wordmark) se pinta con
  `brandLogo()`, nunca escribiendo "SuperStat" a mano en una vista nueva. Su
  SVG va sin `<defs>` a propósito: así se puede repetir en la misma página sin
  sufijar ids, que es lo que sí necesita `courtSvg()`. El mismo dibujo está
  duplicado como favicon en `index.html`; si cambia uno, cambia el otro.
- Los textos de la interfaz están en español; mantener ese idioma en nuevos
  textos visibles para el usuario. Los errores que devuelve Supabase vienen en
  inglés: traducirlos en `authErrorText()`.
- `app.js` nunca toca `localStorage` ni Supabase directamente: todo pasa por
  `Store`. Si necesitas un dato nuevo, expón un método en `store.js`. Por eso
  limpiar el aparato al borrar la cuenta es `Store.wipeLocal()` y no cuatro
  `removeItem` en la pantalla.
- Rectificar es cambiar la fila, no rehacerla: `Store.updatePlayer()` guarda
  sobre el mismo id porque es el que llevan dentro todos los tiros y eventos de
  ese jugador. Dar de baja y volver a dar de alta le borraría el historial.
- `render()` relee los datos del store en las pantallas de lista, así que basta
  con cambiar el store para que la pantalla se entere.
- La tipografía es la del sistema (`--font`: San Francisco en los aparatos de
  Apple y la nativa en el resto). No hay fuentes de CDN y no conviene volver a
  meterlas: la app tiene que verse igual sin conexión. Los titulares se marcan
  con peso y `letter-spacing` negativo, no con otra familia.
- Dependencias externas: `supabase-js` y `capacitor-core`, copiadas en
  `vendor/` con la versión en el nombre, y Google Identity Services, que es lo
  único que sigue viniendo de fuera porque Google sirve una sola URL y no
  publica versiones (y solo hace falta para entrar). No añadir más sin motivo
  fuerte, y seguir sin build ni framework.
- Los plugins de Capacitor se instalan con npm para que el proyecto nativo
  incluya su código Java y Swift, pero desde el JavaScript **no se importan**:
  son módulos ESM y aquí no hay bundler. Se les habla con
  `capacitorExports.registerPlugin(nombre)`, y eso está encapsulado en
  `plugin()` dentro de `js/native.js`. Si añades un plugin, se usa igual.
- Entrar con Google no usa `signInWithOAuth`: el botón lo dibuja GIS en la propia
  página y el id_token se cambia por sesión con `signInWithIdToken`. Se hizo así
  porque el rodeo por el callback de Supabase hacía que Google anunciara
  "Ir a <referencia>.supabase.co". Cuidado con el nonce: a Google se le da el
  resumen SHA-256 y a Supabase el original; mandar el mismo a los dos falla.
- `esc()` debe usarse siempre que se inserte texto de usuario (nombre de
  jugador, rival, etc.) en una plantilla HTML, para evitar inyección.

- La marca del logo también está duplicada en `tools/make-icons.js`, que genera
  los PNG del manifest. Si cambia el dibujo hay que tocar `brandLogo()`, el
  favicon de `index.html` y ese archivo, y volver a generar los iconos.

## Al añadir un archivo o una pantalla

Hay tres listas de los mismos archivos que se mantienen a mano —las etiquetas de
`index.html`, el `SHELL` de `sw.js` y el `COPIAR` de `tools/build-www.js`— y
olvidarse de una falla en silencio: sin el `SHELL`, la app no abre sin cobertura;
sin `COPIAR`, el archivo no entra en el binario. `test/archivos.js` las compara,
así que basta con ejecutarlo (`npm test` ya lo hace primero).

## Ideas pendientes (mencionadas pero no implementadas)

- **Compartir un equipo con el cuerpo técnico** (que el segundo entrenador
  anote y el delegado mire). Es la que falta de la lista y no es pequeña: hoy
  RLS es `user_id = auth.uid()` en las cinco tablas y `pull()` se lo trae todo
  por usuario. Hace falta una tabla de membresías, reescribir las cinco
  políticas y que la sincronización pida por equipo y no por usuario. Como RLS
  es lo único que separa una cuenta de otra y su aislamiento solo se puede
  comprobar a mano contra el proyecto de verdad (ver `docs/supabase.md`), no se
  ha hecho a ciegas junto con el resto.
- Mostrar iniciales del jugador directamente sobre la casilla de la red.
- Extender a otros deportes además de balonmano.
