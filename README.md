# SuperStat — estadísticas de balonmano

App de una sola página para llevar las estadísticas de un equipo de
balonmano: plantilla, partidos y mapa de tiros por zona de portería.

## Funcionalidades

- Cuenta propia: se entra con **Google** o con correo y contraseña.
- Los datos se guardan en la nube y se **sincronizan entre dispositivos**:
  registras el partido en el móvil y lo consultas en el ordenador.
- **Funciona sin conexión.** En un pabellón sin cobertura se abre y se registra
  igual; lo pendiente se sube solo al volver la red, y la app te dice cuánto
  queda. Se puede **instalar en la pantalla de inicio** como una app más.
- Gestión de uno o varios equipos, cada uno con su plantilla (nombre,
  dorsal, posición).
- Alta de partidos nuevos contra un rival, con las dos porterías dibujadas
  una al lado de la otra (propia y rival), divididas en una cuadrícula de
  9 zonas.
  - Un toque en una zona = **gol**.
  - Doble toque en una zona = **parada**.
  - Botones aparte para **fuera** y **palo** (no tienen zona de portería).
  - "Deshacer" por si te equivocas durante el partido.
  - **Reloj de partido** con pausa, y un botón para decidir tú cuándo acaba la
    primera parte: cada anotación se queda con su minuto y su parte, sin dar
    por hecho que las partes duren 30 minutos.
  - **Portero en pista**: se pregunta una sola vez y se queda puesto, así que
    los goles encajados también tienen portero y el porcentaje de paradas de
    cada uno significa algo.
  - En todos los tiros nuestros se pregunta quién ha lanzado, entre o no.
  - **Registro rápido** de lo que no es un tiro: pérdida, robo, 2 minutos y
    tarjetas.
  - **Quién está en pista**, para saber qué pasa en el marcador con cada
    jugador dentro (el más/menos).
  - **Zona de lanzamiento**: con un toque sobre una media pista dibujada a
    escala (área de 6 m, línea de 9 m, marcas de 7 y 4 m) se marca el punto
    exacto desde el que se lanzó. Se puede apagar con el interruptor de la
    propia pantalla si prefieres registrar más rápido.
  - Si el móvil cierra la pestaña a mitad de partido **no se pierde nada**: al
    volver a entrar, la app ofrece seguir donde lo dejaste.
- Ficha de cada partido con el resultado, goles/paradas/fuera por lado,
  % de efectividad, cuadrícula por zona de portería, **evolución del marcador**
  con la mejor racha, goleadores, **paradas por portero**, **más/menos** por
  jugador, el resto de registros y un **mapa de tiros sobre la pista** —con
  filtro por jugador y por parte, y mapa de calor— más el cruce de **desde
  dónde se lanza contra a qué parte de la portería**, tanto de los nuestros
  como de los del rival.
- **Acumulado de temporada** por equipo: balance, goleadores, porteros, dónde
  se lanza mejor y más/menos sumando todos los partidos.
- Historial de partidos anteriores por equipo, y se pueden **editar o borrar**.
  Anotando en vivo se cuela un gol del jugador que no era: desde la ficha del
  partido se puede **borrar una anotación suelta** y volver a meterla, sin
  rehacer el partido entero.
- **Corregir sin rehacer**: el nombre, el dorsal y la posición de un jugador se
  editan sin que pierda su historial —sus goles de antes siguen siendo suyos—, y
  de un partido guardado se pueden cambiar el rival, la fecha y el minuto del
  descanso.
- Un **equipo se borra desde su pantalla** y con él se van su plantilla y todos
  sus partidos.
- La **cuenta entera se borra desde la app**, en *Cuenta → Borrar la cuenta*:
  desaparece todo, aquí y en la nube, sin pedirle nada a nadie.
- **Exportar** un partido en CSV o compartirlo como imagen resumen.

## Android y iOS

Además de la web, el proyecto se empaqueta como app nativa con Capacitor: el
mismo código, sin un segundo proyecto que mantener.

```bash
npm install
npx cap add android     # y/o: npx cap add ios, solo en macOS
npm run assets          # iconos y splash de cada plataforma
npm run android         # abre Android Studio  (npm run ios para Xcode)
```

Los pasos completos —el ID de cliente de Google por plataforma, firmar el AAB y
lo que pide cada tienda— están en **[`docs/movil.md`](docs/movil.md)**, y lo que
hay que rellenar en la ficha de Google Play —textos, gráficos, los formularios
de seguridad de los datos y de clasificación, y la cuenta para el revisor— en
**[`docs/play.md`](docs/play.md)**. Y el recorrido entero hasta tener la app
publicada, en orden de ejecución, en
**[`docs/publicar-android.md`](docs/publicar-android.md)**.

iOS solo se puede compilar desde macOS; mientras tanto, en iPhone la app se
instala desde Safari con *Añadir a pantalla de inicio*.

## Puesta a punto

Hace falta un proyecto de Supabase (gratis). Los pasos completos —crear las
tablas, activar el login de Google y las URLs de redirección— están en
**[`docs/supabase.md`](docs/supabase.md)**. En resumen:

1. Ejecutar `supabase/schema.sql` en el editor SQL de Supabase.
2. Pegar la URL del proyecto, la clave anon y el ID de cliente de Google en
   `js/config.js`.
3. Configurar el proveedor de Google siguiendo la guía: el ID de cliente va
   también en Supabase, y los orígenes desde los que se abre la app, en Google.

## Cómo ejecutarlo

Sigue sin haber build. Se sirve estático:

```bash
npm start
# o
python3 -m http.server 5173
```

Abrir `index.html` con `file://` ya no vale: el login con Google redirige y
necesita un origen http(s), y el service worker tampoco se registra ahí.

Las pruebas (`npm test`) necesitan Playwright y la app servida, y lo dicen con el
comando exacto si falta alguno; están en [`test/README.md`](test/README.md).

## Datos

Los datos viven en Postgres, en Supabase, con RLS: cada cuenta solo ve lo suyo.
El navegador guarda un espejo local y una cola de cambios pendientes, que es lo
que permite trabajar sin conexión. Ver `CLAUDE.md` para el detalle.

Si ya tenías equipos y partidos guardados de la versión anterior, la app te
ofrece importarlos la primera vez que entras con tu cuenta.

## Estructura

```
index.html             esqueleto de la página
css/styles.css         estilos
js/config.js           URL y clave anon de Supabase, y los ID de Google
js/db.js               sesión, login y sincronización con Supabase
js/store.js            espejo local, cola de cambios y fusión
js/native.js           puente con la app de Android/iOS
js/app.js              pantallas y lógica de la app
vendor/                supabase-js y capacitor-core, copiados sin tocar
sw.js                  caché del shell, para abrir sin cobertura
manifest.webmanifest   instalación en la pantalla de inicio
capacitor.config.json  configuración de las apps nativas
icons/  assets/        iconos de la web y materia prima de los de las apps
tools/make-icons.js    genera todo eso desde el dibujo de la marca
tools/build-www.js     junta lo que se empaqueta dentro de la app
supabase/schema.sql    tablas, migraciones y políticas de seguridad
supabase/functions/    la Edge Function que borra la cuenta entera
privacidad.html        política de privacidad (la URL que pide Google Play)
play/                  icono, cabecera y capturas de la ficha de Play
tools/make-play-assets.js  genera el icono y la cabecera de la ficha
tools/make-screenshots.js  genera las capturas desde la app de verdad
docs/supabase.md       puesta a punto paso a paso
docs/movil.md          compilar y publicar en Google Play y la App Store
docs/play.md           textos y formularios de la ficha de Google Play
docs/publicar-android.md  el recorrido completo hasta publicar en Play
test/                  pruebas con Playwright
```
