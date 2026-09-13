# Pruebas

Prueban la parte que no se puede comprobar a ojo: que la app funciona sin
conexión, que lo pendiente se sube al volver la red, que un borrado no
reaparece y que los datos llegan a otro dispositivo.

No hay dependencias en `package.json` a propósito. Para ejecutarlas hace falta
Playwright instalado aparte:

```bash
npm install -g playwright && playwright install chromium
python3 -m http.server 5173 &        # servir la app
node test/sync.js
```

`supabase-stub.js` es un doble de `@supabase/supabase-js`: implementa solo lo
que usa `js/db.js` contra un servidor en memoria, y permite simular caídas de
red y mirar qué llegó a "la base". Las pruebas no tocan ningún Supabase real.

Lo que **no** cubren, y hay que comprobar a mano contra el proyecto de verdad:
el login con Google de principio a fin, y que RLS aísla de verdad una cuenta de
otra. Eso último está explicado en `docs/supabase.md`.
