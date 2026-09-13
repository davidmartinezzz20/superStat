# Puesta a punto de Supabase y Google

Hay que hacer esto una vez. Son cuatro bloques y el orden importa: Google
necesita saber la URL de Supabase, y Supabase necesita las credenciales de
Google.

Ten a mano la **referencia de tu proyecto** de Supabase (el trozo de la URL:
`https://TUREFERENCIA.supabase.co`).

---

## 1. Crear las tablas

1. Supabase → **SQL Editor** → *New query*.
2. Pega entero el contenido de `supabase/schema.sql` y pulsa **Run**.
3. Al final verás una tabla de resultados con cinco filas. **Comprueba que las
   cinco tienen `rls_activo = true` y `politicas = 1`.**

Si alguna sale en `false`, esa tabla está abierta a cualquiera que abra la web.
No sigas hasta que las cinco estén bien.

### Si ya tenías la base de una versión anterior

Vuelve a pegar y ejecutar el archivo entero, igual que la primera vez. Todo es
`if exists` / `if not exists`, así que no toca lo que ya hay: crea la tabla
`events` y añade a `shots` el minuto, la parte, el portero y el borrado lógico.
Los partidos que ya tengas guardados siguen leyéndose; lo que no se puede es
inventarles el tiempo, así que salen sin minuto.

---

## 2. Conectar la app con la base

1. Supabase → **Project Settings → API**.
2. Copia **Project URL** y la clave **anon / publishable**.
3. Pégalas en `js/config.js`:

```js
window.SUPERSTAT_CONFIG = {
  SUPABASE_URL: 'https://TUREFERENCIA.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOi...',
  GOOGLE_CLIENT_ID: '...apps.googleusercontent.com'   // sale del paso 3.2
};
```

La **URL va sin ruta**: `https://TUREFERENCIA.supabase.co`, no el endpoint REST
`.../rest/v1/` que enseña la consola en algunos sitios. `supabase-js` le añade
él solo `/rest/v1` para los datos y `/auth/v1` para la sesión; con la ruta
puesta, las peticiones acaban en `/rest/v1/rest/v1/...` y no encuentran nada.

Esas dos claves se publican en el repositorio a propósito: viajan dentro del
JavaScript que descarga cualquiera, así que no son un secreto. Lo que protege
los datos son las políticas RLS del paso 1.

> **La clave `service_role` no se toca.** Se salta RLS entera. No va en el
> repositorio, ni en el navegador, ni en un mensaje.

---

## 3. Credenciales de Google

### 3.1 Pantalla de consentimiento

1. [Google Cloud Console](https://console.cloud.google.com/) → crea un proyecto
   (o usa uno que tengas).
2. **APIs y servicios → Pantalla de consentimiento de OAuth**.
3. Tipo de usuario: **Externo**. Rellena nombre de la app (`SuperStat`), tu
   correo de asistencia y el de contacto. El resto puede quedarse vacío.
4. Mientras la app esté en modo *Prueba*, solo entran los correos que añadas en
   **Usuarios de prueba**. Añade el tuyo. Si la vais a usar varias personas,
   publica la app o añádelos a todos ahí.

> **Antes de publicar en una tienda hay que pasarla a *Producción***, o quien se
> baje la app no podrá entrar con Google: la lista de usuarios de prueba no
> incluye ni a los usuarios ni al revisor de Google. La app solo pide `email` y
> `profile`, que no son permisos sensibles, así que publicarla no dispara
> ninguna revisión y el cambio es inmediato. Está en el bloque 5.2 de
> [`publicar-android.md`](publicar-android.md).

### 3.2 El ID de cliente

1. **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth**.
2. Tipo: **Aplicación web**.
3. **Orígenes autorizados de JavaScript** — los sitios desde los que se abre la
   app. Esto es lo que de verdad tiene que estar bien, porque el botón de Google
   se dibuja en la propia página y es ella quien pide el token:
   - `https://super-stat.vercel.app`
   - `http://localhost:5173` (para probar en tu ordenador)

   Van sin barra final y sin ruta: el origen, nada más.
4. **URI de redirección autorizados** — añade igualmente el callback de Supabase:

   ```
   https://TUREFERENCIA.supabase.co/auth/v1/callback
   ```

   La app ya no pasa por ahí para entrar con Google, pero Google lo pide para
   dar por completa la configuración y no estorba tenerlo.
5. Guarda y copia el **ID de cliente** y el **secreto de cliente**. El ID va en
   dos sitios: en `js/config.js` (paso 2) y en Supabase (paso 4).

---

## 4. Activar Google y las URLs en Supabase

1. Supabase → **Authentication → Providers → Google**: actívalo y pega el ID de
   cliente y el secreto del paso anterior. Guarda.

   El **ID de cliente** tiene que estar registrado aquí sí o sí: es contra esta
   lista contra la que Supabase valida el token que le manda la app. El secreto
   no hace falta para este flujo —el token lo da Google en el navegador—, pero
   tampoco molesta dejarlo puesto.
2. Supabase → **Authentication → URL Configuration**:
   - **Site URL**: `https://super-stat.vercel.app`
   - **Redirect URLs**: añade una línea por cada sitio desde el que se entra.
     Los previews de Vercel cambian de URL en cada rama, así que va con comodín:

     ```
     https://super-stat.vercel.app/**
     https://super-stat-git-*.vercel.app/**
     http://localhost:5173/**
     ```

   Si una URL no está en esta lista, el login se completa pero te devuelve a
   otro sitio y parece que "no hace nada".
3. Supabase → **Authentication → Providers → Email**: déjalo activado. Ahí
   decides si exiges confirmar el correo (*Confirm email*). Con ella activada,
   al crear una cuenta hay que abrir el correo antes de poder entrar; la app ya
   avisa de eso en pantalla.

---

## Comprobar que funciona

1. Abre la app, pulsa **Entrar con Google** y completa el login.
2. Crea un equipo y un jugador.
3. Supabase → **Table Editor → teams**: tu equipo tiene que estar ahí.
4. **La prueba que de verdad importa**: entra con una segunda cuenta distinta y
   comprueba que no ve nada de la primera. Si viera algo, RLS no está bien y hay
   que volver al paso 1.

## Si algo falla

| Síntoma | Causa casi siempre |
|---|---|
| No sale el botón de Google, sale un aviso | Falta `GOOGLE_CLIENT_ID` en `js/config.js` (paso 2) |
| El botón sale pero no hace nada, y la consola habla del origen | El sitio no está en *Orígenes autorizados* (paso 3.2.3) |
| `Passed nonce and nonce in id_token...` | El ID de cliente no está registrado en Supabase (paso 4.1) |
| Google pone el dominio y no "SuperStat" | La marca no está verificada — ver más abajo |
| Entra pero no aparece nada y no guarda | RLS mal, o falta ejecutar `schema.sql` |
| "Falta configurar Supabase" en pantalla | `js/config.js` está vacío |
| Acceso denegado al entrar con Google | Tu correo no está en *Usuarios de prueba* (paso 3.1.4) |

---

## Lo que Google escribe en su pantalla

Al entrar con Google sale un "Ir a ..." que no controlamos nosotros: lo pinta
Google a partir del cliente de OAuth. Y **mientras la marca no esté verificada,
Google enseña el dominio en vez del nombre de la app**. Es su comportamiento por
defecto, no un fallo de configuración: rellenar el nombre `SuperStat` en la
pantalla de consentimiento (paso 3.1.3) no basta por sí solo.

Antes ponía `TUREFERENCIA.supabase.co`, porque quien pedía el token era el
callback de Supabase. Ahora el botón lo dibuja Google Identity Services dentro de
la propia página y el token se pide desde el origen de la app, así que lo que
sale es **tu dominio**. Eso ya no se puede mejorar sin verificar la marca.

Para llegar al "Ir a SuperStat" hacen falta dos cosas, y la primera es la que
atasca:

1. **Un dominio tuyo.** Google solo verifica marcas sobre dominios cuya
   propiedad puedas demostrar en Search Console. Un subdominio de `vercel.app`
   no suele valer, porque es un sufijo público y no es tuyo.
2. **Verificar la marca** en Google Cloud → *Google Auth Platform → Branding*:
   nombre, logo, página de inicio, política de privacidad y términos, todo en ese
   dominio, y la app publicada en *Producción*. Google lo revisa y puede tardar
   varios días.

Mientras tanto la pantalla dirá el dominio de la app, que es lo esperable y
además es lo que le permite a la gente comprobar que no la están engañando.
