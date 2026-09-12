# Marcador — estadísticas de balonmano

App de una sola página para llevar las estadísticas de un equipo de
balonmano: plantilla, partidos y mapa de tiros por zona de portería.

## Funcionalidades

- Registro/inicio de sesión simple (usuario y contraseña).
- Gestión de uno o varios equipos, cada uno con su plantilla (nombre,
  dorsal, posición).
- Alta de partidos nuevos contra un rival, con dos porterías dibujadas
  (propia y rival) divididas en una cuadrícula de 9 zonas.
  - Un toque en una zona = **gol**.
  - Doble toque en una zona = **parada**.
  - Botón aparte para **tiro fuera** (no tiene zona).
  - "Deshacer último" por si te equivocas durante el partido.
  - Al marcar un gol a favor se pregunta qué jugador ha tirado; al marcar
    una parada propia se pregunta qué portero ha sido.
- Ficha de cada partido con el resultado, goles/paradas/fuera por lado,
  % de efectividad, mapa de calor por zona, goleadores del partido y
  paradas por portero.
- Historial de partidos anteriores por equipo.

## Cómo ejecutarlo

Es HTML/CSS/JS puro, sin build ni dependencias de verdad. Cualquiera de
estas opciones funciona:

```bash
npm start
# o
npx serve .
# o simplemente abrir index.html en el navegador
```

## Datos

Todo se guarda en `localStorage` del navegador (por dispositivo/navegador,
no hay servidor ni base de datos). Ver `CLAUDE.md` para el detalle del
modelo de datos y las claves usadas.

## Estructura

```
index.html       esqueleto de la página
css/styles.css    estilos
js/app.js         toda la lógica de la app
```
