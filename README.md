# SuperStat — estadísticas de balonmano

App de una sola página para llevar las estadísticas de un equipo de
balonmano: plantilla, partidos y mapa de tiros por zona de portería.

## Funcionalidades

- Cuenta propia: se entra con **Google** o con correo y contraseña.
- Los datos se guardan en la nube y se **sincronizan entre dispositivos**:
  registras el partido en el móvil y lo consultas en el ordenador.
- **Funciona sin conexión.** En un pabellón sin cobertura se registra igual;
  lo pendiente se sube solo al volver la red, y la app te dice cuánto queda.
- Gestión de uno o varios equipos, cada uno con su plantilla (nombre,
  dorsal, posición).
- Alta de partidos nuevos contra un rival, con las dos porterías dibujadas
  una al lado de la otra (propia y rival), divididas en una cuadrícula de
  9 zonas.
  - Un toque en una zona = **gol**.
  - Doble toque en una zona = **parada**.
  - Botón aparte para **tiro fuera** (no tiene zona).
  - "Deshacer" por si te equivocas durante el partido.
  - Al marcar un gol a favor se pregunta qué jugador ha tirado; al marcar
    una parada propia se pregunta qué portero ha sido.
  - **Zona de lanzamiento**: con un toque sobre una media pista dibujada a
    escala (área de 6 m, línea de 9 m, marcas de 7 y 4 m) se marca el punto
    exacto desde el que se lanzó. Se puede apagar con el interruptor de la
    propia pantalla si prefieres registrar más rápido.
- Ficha de cada partido con el resultado, goles/paradas/fuera por lado,
  % de efectividad, mapa de calor por zona de portería, goleadores del
  partido, paradas por portero y un **mapa de tiros sobre la pista** con un
  punto por lanzamiento, más su reparto por zona, tanto de los nuestros
  como de los del rival.
- Historial de partidos anteriores por equipo.

## Puesta a punto

Hace falta un proyecto de Supabase (gratis). Los pasos completos —crear las
tablas, activar el login de Google y las URLs de redirección— están en
**[`docs/supabase.md`](docs/supabase.md)**. En resumen:

1. Ejecutar `supabase/schema.sql` en el editor SQL de Supabase.
2. Pegar la URL del proyecto y la clave anon en `js/config.js`.
3. Configurar el proveedor de Google siguiendo la guía.

## Cómo ejecutarlo

Sigue sin haber build. Se sirve estático:

```bash
npm start
# o
python3 -m http.server 5173
```

Abrir `index.html` con `file://` ya no vale: el login con Google redirige y
necesita un origen http(s).

## Datos

Los datos viven en Postgres, en Supabase, con RLS: cada cuenta solo ve lo suyo.
El navegador guarda un espejo local y una cola de cambios pendientes, que es lo
que permite trabajar sin conexión. Ver `CLAUDE.md` para el detalle.

Si ya tenías equipos y partidos guardados de la versión anterior, la app te
ofrece importarlos la primera vez que entras con tu cuenta.

## Estructura

```
index.html           esqueleto de la página
css/styles.css       estilos
js/config.js         URL y clave anon de Supabase
js/db.js             sesión, login y sincronización con Supabase
js/store.js          espejo local, cola de cambios y fusión
js/app.js            pantallas y lógica de la app
supabase/schema.sql  tablas y políticas de seguridad
docs/supabase.md     puesta a punto paso a paso
```
