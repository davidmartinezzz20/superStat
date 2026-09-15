# Seguridad

## Informar de un fallo

Si encuentras un fallo de seguridad en SuperStat, **no abras una incidencia
pública**: escribe a **superstat.hello@gmail.com** y cuenta qué has visto y
cómo reproducirlo. Se contesta en un plazo de 72 horas.

Mientras no esté arreglado, agradezco que no se publique. Lo que se arregle se
cuenta después aquí mismo.

Está bien hacer pruebas contra tu propia cuenta. Lo que no: usar la cuenta de
otra persona, descargar datos que no son tuyos, ataques de denegación de
servicio, ingeniería social y automatizar nada contra el proyecto de producción.

## Cómo está montado esto

Conviene saberlo antes de informar de algo, porque hay dos cosas que parecen un
fallo y no lo son.

### La clave anon y la URL de Supabase son públicas

Están en [`js/config.js`](js/config.js), dentro del JavaScript que descarga
cualquiera que abra la web. Es así por diseño y no hay forma de que sea de otra
manera en una app que corre en el navegador.

**Lo único que separa los datos de un usuario de los de otro son las políticas
RLS** de [`supabase/schema.sql`](supabase/schema.sql): `user_id = auth.uid()` en
las cinco tablas de datos, y solo lectura en las dos del plan. Un fallo en esas
políticas **sí** es un fallo de seguridad grave, y de los que más interesan.

La clave `service_role` nunca sale del servidor. Vive en las variables de las
Edge Functions y no está en el repositorio, ni en el historial, ni en el binario
de la app. `test/seguridad.js` comprueba en cada ejecución que no se ha colado en
nada de lo que se descarga.

### El tope del plan gratis se comprueba en el cliente

`FREE_TEAMS` y `FREE_MATCHES` viven en `js/app.js`, y la base no los comprueba.
Es a propósito, y está explicado en `CLAUDE.md`: si Postgres rechazara un alta,
la cola de sincronización se quedaría atascada con los partidos sin subir dentro.
Saltárselo desde la consola del navegador no da acceso a nada de nadie: solo
guarda más filas en la cuenta de quien lo hace.

Lo que sí está protegido de verdad es **quién tiene Pro**: la tabla
`subscriptions` es de solo lectura para el usuario y la escribe únicamente el
webhook de Stripe, con la clave de servicio y tras comprobar la firma. Si
encuentras la forma de escribir ahí desde el navegador, eso sí es un fallo.

## Qué hay puesto

| | Dónde |
|---|---|
| Aislamiento entre cuentas | RLS en las siete tablas (`supabase/schema.sql`) |
| Permisos por columna | `baja_token` y `stripe_customer_id` no salen al navegador |
| Content-Security-Policy | `index.html` (y `vercel.json` en cabecera) |
| HSTS, nosniff, frame-ancestors, Referrer-Policy, Permissions-Policy | `vercel.json` |
| Escapado de todo texto de usuario | `esc()` en `js/app.js` |
| CSV sin fórmulas ejecutables | `csvCell()` en `js/app.js` |
| Firma de los webhooks de Stripe | `supabase/functions/stripe-webhook` |
| De quién es la cuenta lo dice el token, nunca el cuerpo | las tres funciones que llama la app |
| Dependencias copiadas en `vendor/` y con versión fijada | `vendor/`, imports de las funciones |
| Borrado definitivo a los 90 días | `purgar_borrados()` con `pg_cron` |

Casi todo eso lo vigila `test/seguridad.js`, que corre con `npm test`. Si esa
prueba falla, algo que estaba protegido ha dejado de estarlo: **no la cambies
para que pase**.

## Lo que hay que comprobar a mano

Dos cosas no se pueden probar desde el repositorio y hay que mirarlas contra el
proyecto de verdad antes de publicar. Están detalladas en
[`docs/supabase.md`](docs/supabase.md):

1. **Que RLS aísla de verdad.** Se prueba con dos cuentas de usar y tirar,
   intentando leer los datos de una desde la otra. La consulta de comprobación
   está al final de `supabase/schema.sql`.
2. **Que la purga está programada.** Sin `pg_cron` activado, lo borrado se queda
   en la base para siempre, que es justo lo contrario de lo que promete
   `privacidad.html`.

## Versiones

Se mantiene la última versión publicada. No hay ramas de soporte.
