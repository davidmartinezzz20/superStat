# vendor/

Librerías de terceros copiadas al repo tal cual, sin tocar.

## `supabase-js-2.116.0.js`

El cliente de Supabase, la compilación UMD del paquete `@supabase/supabase-js`
en esa versión exacta. Antes venía de jsdelivr y ahora está aquí por dos
motivos:

- **La app de móvil.** Dentro de Capacitor la página se sirve desde el propio
  aparato; depender de un CDN significaría que la app no arranca la primera vez
  que se abre sin cobertura, que es justo el caso para el que está hecha.
- **La web.** El service worker ya la guardaba, pero solo después de la primera
  visita con red. Sirviéndola desde el mismo origen, entra en la caché del
  shell con todo lo demás.

El nombre lleva la versión dentro a propósito: así actualizar es añadir el
archivo nuevo y cambiar la etiqueta `<script>`, y ningún navegador puede quedarse
sirviendo una mezcla de dos versiones desde la caché.

### Cómo actualizarla

```bash
npm pack @supabase/supabase-js@<versión>
tar xzf supabase-supabase-js-<versión>.tgz
cp package/dist/umd/supabase.js vendor/supabase-js-<versión>.js
```

Después hay que cambiar cuatro sitios: la etiqueta `<script>` de `index.html`,
la lista `SHELL` de `sw.js` (y subir su `VERSION`), la lista `COPIAR` de
`tools/build-www.js`, y borrar el archivo viejo.

## `capacitor-core-8.5.2.js`

La compilación global de `@capacitor/core`, la que el paquete publica como
`dist/capacitor.js`. Es lo que deja hablar con los plugins nativos **sin
bundler**, que es la condición de todo este proyecto.

Hace falta porque los paquetes de los plugins (`@capacitor/share` y compañía)
son módulos ESM que no se pueden cargar con una etiqueta `<script>`, y porque el
puente que inyecta el sistema operativo dentro de la app no trae
`registerPlugin()`: solo deja las piezas de bajo nivel en `window.Capacitor`.
Este archivo sí, y deja en `window.capacitorExports` tanto la API de Capacitor
como `registerPlugin()`. Quien lo usa es `js/native.js`.

En el navegador no estorba: se carga, dice que la plataforma es `web` y la app
sigue por el camino de siempre.

Tiene que ir en la **misma versión** que `@capacitor/core` en `package.json`, o
el JavaScript y el puente nativo pueden no entenderse.

```bash
npm install
cp node_modules/@capacitor/core/dist/capacitor.js vendor/capacitor-core-<versión>.js
```

Y luego los mismos cuatro sitios de arriba.
