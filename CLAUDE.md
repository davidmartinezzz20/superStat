# SuperStat — estadísticas de balonmano

App web de una sola página (vanilla HTML/CSS/JS, sin build ni frameworks) para
llevar estadísticas de equipos de balonmano: plantillas, partidos y mapa de
tiros por zona de portería.

Pensada como punto de partida: hoy cubre balonmano, pero el nombre del
proyecto y la estructura están para poder añadir otros deportes más adelante.

## Cómo ejecutarlo

No hay proceso de build. Basta con servir los archivos estáticos:

```
npm start
```

(usa `npx serve` bajo el capó; también vale abrir `index.html` directamente
en el navegador, o `python3 -m http.server`).

## Estructura

- `index.html` — esqueleto de la página y carga de fuentes/estilos/script.
- `css/styles.css` — todos los estilos (tema oscuro tipo pabellón, tarjetas,
  la portería dibujada con postes/red/soportes, el modal de selección de
  jugador, etc.).
- `js/app.js` — toda la lógica: es una single-page app hecha a mano con
  `render()` que reconstruye `#app` según `state.screen`, sin frameworks.

## Modelo de datos (localStorage)

Todo se guarda en `localStorage` del navegador, en JSON, bajo estas claves:

- `hb:users` → `{ usuario: contraseña }` (autenticación básica, sin cifrado;
  es una demo de flujo, no un sistema de seguridad real).
- `hb:teams:<usuario>` → array de equipos `{ id, name, players: [{ id, name,
  dorsal, position }] }`.
- `hb:matches:<usuario>:<teamId>` → array de partidos `{ id, rival, date,
  shotsOwn, shotsRival, outOwn, outRival }`.

Cada tiro es `{ zone: 1-9, type: 'goal'|'save', player: idJugador|null,
origin: zonaPista|null }`.

`origin` es la zona de la pista desde la que se lanzó, uno de los `id` de la
constante `ORIGINS`: `EI`, `LI`, `CE`, `LD`, `ED`, `7M`, `PIV` (extremos,
laterales, central, siete metros y pivote). Se pregunta con un toque sobre una
media pista dibujada con una cuadrícula de 5x3 —de ahí los `col`/`row` de cada
entrada de `ORIGINS`—, y siempre con izquierda y derecha vistas desde el
ataque. Es opcional: se activa y desactiva con el interruptor de la pantalla de
partido en vivo (`draft.askOrigin`, encendido por defecto) y los partidos
guardados antes de existir esta opción tienen `origin: null`, que se muestra
como "Sin especificar".

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
  textos visibles para el usuario.
- Evitar dependencias externas más allá de las Google Fonts ya cargadas en
  `index.html`.
- `esc()` debe usarse siempre que se inserte texto de usuario (nombre de
  jugador, rival, etc.) en una plantilla HTML, para evitar inyección.

## Ideas pendientes (mencionadas pero no implementadas)

- Ranking de goleadores/porteros a nivel de temporada (agregando todos los
  partidos de un equipo, no solo uno).
- Mostrar iniciales del jugador directamente sobre la casilla de la red.
- Editar o borrar un partido ya guardado.
- Extender a otros deportes además de balonmano.
