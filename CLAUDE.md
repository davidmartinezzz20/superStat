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

Ya no vale abrir `index.html` a pelo con `file://`: el login con Google
redirige y necesita un origen http(s).

## Estructura

- `index.html` — esqueleto de la página y carga de fuentes/estilos/scripts.
- `css/styles.css` — todos los estilos (tema oscuro tipo pabellón, tarjetas,
  la portería dibujada con postes/red/soportes, el modal de selección de
  jugador, etc.).
- `js/config.js` — URL y clave anon de Supabase. Se publica a propósito.
- `js/db.js` — todo lo que habla con Supabase: sesión, login y las dos
  operaciones de sincronización (`pull` y `push`). No sabe de pantallas.
- `js/store.js` — espejo local, cola de sincronización y fusión. Es la única
  puerta de entrada a los datos para el resto de la app.
- `js/app.js` — toda la lógica de pantalla: una single-page app hecha a mano
  con `render()` que reconstruye `#app` según `state.screen`, sin frameworks.
- `supabase/schema.sql` — tablas, índices y políticas RLS.
- `docs/supabase.md` — puesta a punto de Supabase y de Google.

## Modelo de datos

La verdad está en Postgres (`supabase/schema.sql`): cuatro tablas —`teams`,
`players`, `matches` y `shots`— con `user_id` en todas para que las políticas
RLS sean directas. **RLS es lo único que separa los datos de un usuario de los
de otro**, porque la clave anon la tiene cualquiera que abra la web: si añades
una tabla, añade su política en el mismo commit.

Cada fila lleva dos marcas de tiempo y no son intercambiables:

- `updated_at` la pone el navegador. Decide quién gana en un conflicto, y tiene
  que ser del cliente para que un cambio hecho sin red conserve su momento real.
- `server_at` la pone un trigger en la base. Es por la que se piden los cambios
  nuevos, para que un reloj desajustado no deje filas sin traer.

En el navegador, `store.js` guarda un espejo de esas filas y una cola:

- `hb:cache:<userId>` → espejo de las cuatro tablas más los cursores de `pull`.
- `hb:queue:<userId>` → operaciones sin subir. Todas son upsert de la fila
  entera, así que subir una dos veces no duplica nada.

Reglas de las que depende que la sincronización sea resoluble:

1. **Los ids se generan en el navegador** (`Store.uuid()`), nunca en la base.
2. **Los borrados son lógicos** (`deleted_at`). Con borrado físico no se
   distingue "lo borré" de "aún no lo he subido" y lo borrado reaparece.
3. **Gana lo más reciente**, salvo que la fila esté pendiente en la cola: en ese
   caso gana lo local y no se pisa.

El partido en curso (`state.draft`) no pasa por el store: es un borrador en
memoria que solo se convierte en filas al pulsar Guardar. Anotar tiros no
depende de la red.

En pantalla, un tiro sigue siendo `{ zone: 1-9, type: 'goal'|'save',
player: idJugador|null, origin: {x,y}|null }`; `store.js` lo traduce a la fila
de `shots` (`result`, `player_id`, `origin_x`, `origin_y`) y al revés.

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
- Al marcar gol en `shotsRival` se pregunta qué jugador ha tirado (todos los
  jugadores). Al marcar parada en `shotsOwn` se pregunta qué portero ha sido
  (solo jugadores con `position === 'Portero'`). El resto de combinaciones no
  pide jugador porque correspondería a la plantilla del rival, que no se
  gestiona en la app.

## Convenciones al tocar el código

- Todo vive en un único `state` global y una función `render()` que
  reconstruye el HTML del screen actual; los manejadores de eventos se
  vuelven a enlazar en `attachHandlers()` después de cada render. Si añades
  una vista nueva, sigue ese mismo patrón (no introduzcas un framework).
- `render()` pone en `#app` la clase `screen-<pantalla>`, que es como el
  partido en vivo se permite ser más ancho que el resto de la app.
- Un tiro puede necesitar varias preguntas antes de registrarse (jugador,
  zona de lanzamiento, las dos o ninguna). Se resuelve con la lista
  `pendingShot.steps` y `advancePending()`: si añades otra pregunta, mete un
  paso más en esa lista en vez de encadenar modales.
- Los textos de la interfaz están en español; mantener ese idioma en nuevos
  textos visibles para el usuario. Los errores que devuelve Supabase vienen en
  inglés: traducirlos en `authErrorText()`.
- `app.js` nunca toca `localStorage` ni Supabase directamente: todo pasa por
  `Store`. Si necesitas un dato nuevo, expón un método en `store.js`.
- `render()` relee los datos del store en las pantallas de lista, así que basta
  con cambiar el store para que la pantalla se entere.
- Dependencias externas: solo las Google Fonts y `supabase-js`, cargadas por CDN
  en `index.html` con la versión fijada. No añadir más sin motivo fuerte, y
  seguir sin build ni framework.
- `esc()` debe usarse siempre que se inserte texto de usuario (nombre de
  jugador, rival, etc.) en una plantilla HTML, para evitar inyección.

## Ideas pendientes (mencionadas pero no implementadas)

- Ranking de goleadores/porteros a nivel de temporada (agregando todos los
  partidos de un equipo, no solo uno). Ahora que hay Postgres, esto sale de una
  consulta en vez de recorrerlo todo en el navegador.
- Mostrar iniciales del jugador directamente sobre la casilla de la red.
- Editar o borrar un partido ya guardado.
- Extender a otros deportes además de balonmano.
