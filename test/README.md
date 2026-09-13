# Pruebas

Prueban la parte que no se puede comprobar a ojo: que la app funciona sin
conexión, que lo pendiente se sube al volver la red, que un borrado no
reaparece y que los datos llegan a otro dispositivo.

No hay dependencias en `package.json` a propósito. Para ejecutarlas hace falta
Playwright instalado aparte:

```bash
npm install -g playwright && playwright install chromium
python3 -m http.server 5173 &        # servir la app
node test/sync.js                    # cuentas, sincronización y migración
node test/live.js                    # el partido, las estadísticas y la PWA
```

Si ya tienes un Chromium por tu cuenta y no quieres que Playwright se baje otro:
`CHROMIUM_PATH=/ruta/al/chromium node test/live.js`.

`live.js` cubre lo que pasa durante un partido y después: el reloj y el corte de
la primera parte, que el portero en pista quede en todos los tiros recibidos,
fuera y palo, los eventos y la alineación, que un partido a medias sobreviva a
que se cierre la pestaña, lo que sale en la ficha (porteros, más/menos, filtros
del mapa, mapa de calor, cruce con la portería), el CSV, el acumulado de
temporada, editar y borrar un partido, y que la app abra sin red gracias al
service worker.

`supabase-stub.js` es un doble de `@supabase/supabase-js`: implementa solo lo
que usa `js/db.js` contra un servidor en memoria, y permite simular caídas de
red y mirar qué llegó a "la base". Las pruebas no tocan ningún Supabase real.

`google-stub.js` hace lo propio con Google Identity Services: dibuja un botón
que devuelve un id_token de mentira, y guarda el nonce que recibió para que el
doble de Supabase pueda rechazar el login si se le manda el mismo a los dos.

Lo que **no** cubren, y hay que comprobar a mano contra el proyecto de verdad:
el login con Google contra Google (aquí solo se prueba nuestro lado del flujo),
y que RLS aísla de verdad una cuenta de otra. Eso último está explicado en
`docs/supabase.md`.
