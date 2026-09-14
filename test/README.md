# Pruebas

Prueban la parte que no se puede comprobar a ojo: que la app funciona sin
conexión, que lo pendiente se sube al volver la red, que un borrado no
reaparece y que los datos llegan a otro dispositivo.

No hay dependencias en `package.json` a propósito: son cientos de megas de
navegadores para un proyecto cuya seña de identidad es no tener build ni
dependencias. Playwright se instala aparte, una vez:

```bash
npm install -g playwright && playwright install chromium
npm start &                          # servir la app en el 5173
npm test                             # las cinco suites, en orden
```

Sueltas:

```bash
node test/archivos.js                # las tres listas de archivos, sin navegador
node test/pista.js                   # las zonas de lanzamiento, sin navegador
node test/sync.js                    # cuentas, sincronización, migración y borrar la cuenta
node test/live.js                    # el partido, las estadísticas y la PWA
node test/nativo.js                  # el puente con Android e iOS
```

Las dos primeras no necesitan ni navegador ni servidor: son leer archivos.

El precio de no declarar Playwright era que `npm test` en una máquina limpia
fallaba con un «Cannot find module», que no dice qué hacer. De eso se encarga
`requiere-playwright.js`: comprueba que Playwright está y que hay algo sirviendo
la app, y si falta alguno lo dice con el comando exacto. Cualquier suite nueva
debería pedirle a él el `chromium` en vez de a `playwright`, por el mismo motivo
que `rutas.js`.

Si ya tienes un Chromium por tu cuenta y no quieres que Playwright se baje otro:
`CHROMIUM_PATH=/ruta/al/chromium npm test`. Y si sirves la app en otro puerto,
`SUPERSTAT_URL=http://localhost:8080 npm test`.

`sync.js` cubre las cuentas y la sincronización, y termina borrando la cuenta
entera: que no quede ninguna fila en el servidor ni ninguna clave en el
navegador, que sin conexión no se borre nada —primero el servidor, y solo si
confirma se toca lo local— y que haya que escribir la palabra para confirmar.

`live.js` cubre lo que pasa durante un partido y después: el reloj y el corte de
la primera parte, que el portero en pista quede en todos los tiros recibidos,
fuera y palo, los eventos y la alineación, que un partido a medias sobreviva a
que se cierre la pestaña, lo que sale en la ficha (porteros, más/menos, filtros
del mapa, mapa de calor, cruce con la portería), el CSV, el acumulado de
temporada, editar un partido, borrar una anotación suelta, borrar un partido,
borrar un equipo entero con todo lo suyo, y que la app abra sin red gracias al
service worker.

Ahí dentro está también lo de corregir sin rehacer: editar un jugador —que tiene
que conservar su id, o perdería todo su historial— y el minuto del descanso de
un partido guardado.

`archivos.js` compara las tres listas paralelas de archivos que hay que mantener
a mano: las etiquetas de `index.html`, el `SHELL` de `sw.js` y el `COPIAR` de
`tools/build-www.js`. Los dos modos de fallo son silenciosos —un archivo fuera
del `SHELL` no rompe nada hasta que alguien abre la app sin cobertura, y uno
fuera de `COPIAR` no rompe nada hasta que se compila el binario—, que es justo
lo que una prueba detecta y una persona no. Cuando se escribió, al `SHELL` le
faltaban dos iconos.

`pista.js` fija las fronteras de `zoneFromPoint()`, que es pura y decide cómo se
agrupan todos los lanzamientos ya registrados, y comprueba que el `aspect-ratio`
de `.court-svg` sigue coincidiendo con el `viewBox` del SVG: si se separan, el
punto que se toca en la pista deja de caer donde toca.

`nativo.js` prueba `js/native.js` con el doble de `capacitor-stub.js`: el
arranque (barra de estado, botón atrás, splash), el login de Google por el
sistema, guardar y compartir un archivo, que una app compilada sin un plugin se
aparte en vez de reventar, y que cancelar la hoja de compartir —que llega como
error— no se tome por un fallo.

`supabase-stub.js` es un doble de `@supabase/supabase-js`: implementa solo lo
que usa `js/db.js` contra un servidor en memoria, y permite simular caídas de
red y mirar qué llegó a "la base". Las pruebas no tocan ningún Supabase real.

`rutas.js` es quien se encarga de que eso siga siendo verdad: sirve un
`js/config.js` de mentira, y no el del repositorio, que es donde viven la URL y
la clave del proyecto de verdad. Va en su propio archivo y no copiado en cada
suite para que una prueba nueva no se pueda olvidar. La prueba del service
worker lo aplica sobre el contexto y no sobre la página, porque las peticiones
que hace el propio service worker al guardarse el shell no pasan por
`page.route()`.

`google-stub.js` hace lo propio con Google Identity Services: dibuja un botón
que devuelve un id_token de mentira, y guarda el nonce que recibió para que el
doble de Supabase pueda rechazar el login si se le manda el mismo a los dos.

`capacitor-stub.js` hace lo mismo con el puente de Capacitor: deja un
`window.capacitorExports` que apunta todo lo que se le llama y que se comporta
según `window.__NATIVO_CONF__` (qué plugins no están instalados, qué devuelve
Google, qué error lanza la hoja de compartir).

Lo que **no** cubren, y hay que comprobar a mano contra el proyecto de verdad:
el login con Google contra Google (aquí solo se prueba nuestro lado del flujo),
que RLS aísla de verdad una cuenta de otra, y que la Edge Function de borrar la
cuenta borra lo que dice. Los tres están explicados en `docs/supabase.md`.

Y lo que queda sin cubrir dentro de la app: la paginación de `pull()` (haría
falta generar más de mil filas para que el bucle dé la segunda vuelta) y la
imagen resumen de un partido, que es la hermana del CSV, que sí está probado.
