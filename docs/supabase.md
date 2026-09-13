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
3. Al final verás una tabla de resultados con cuatro filas. **Comprueba que las
   cuatro tienen `rls_activo = true` y `politicas = 1`.**

Si alguna sale en `false`, esa tabla está abierta a cualquiera que abra la web.
No sigas hasta que las cuatro estén bien.

---

## 2. Conectar la app con la base

1. Supabase → **Project Settings → API**.
2. Copia **Project URL** y la clave **anon / publishable**.
3. Pégalas en `js/config.js`:

```js
window.SUPERSTAT_CONFIG = {
  SUPABASE_URL: 'https://TUREFERENCIA.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOi...'
};
```

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

### 3.2 El ID de cliente

1. **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth**.
2. Tipo: **Aplicación web**.
3. **Orígenes autorizados de JavaScript** — añade los sitios desde los que se
   abre la app:
   - `https://TU-APP.vercel.app`
   - `http://localhost:5173` (para probar en tu ordenador)
4. **URI de redirección autorizados** — aquí va **Supabase**, no tu app. Esta es
   la que más gente pone mal:

   ```
   https://TUREFERENCIA.supabase.co/auth/v1/callback
   ```

5. Guarda y copia el **ID de cliente** y el **secreto de cliente**.

---

## 4. Activar Google y las URLs en Supabase

1. Supabase → **Authentication → Providers → Google**: actívalo y pega el ID de
   cliente y el secreto del paso anterior. Guarda.
2. Supabase → **Authentication → URL Configuration**:
   - **Site URL**: `https://TU-APP.vercel.app`
   - **Redirect URLs**: añade una línea por cada sitio desde el que se entra.
     Los previews de Vercel cambian de URL en cada rama, así que va con comodín:

     ```
     https://TU-APP.vercel.app/**
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
| Google vuelve a la app y sigue sin sesión | La URL no está en *Redirect URLs* (paso 4.2) |
| `redirect_uri_mismatch` de Google | Falta el `/auth/v1/callback` de Supabase (paso 3.2.4) |
| Entra pero no aparece nada y no guarda | RLS mal, o falta ejecutar `schema.sql` |
| "Falta configurar Supabase" en pantalla | `js/config.js` está vacío |
| Acceso denegado al entrar con Google | Tu correo no está en *Usuarios de prueba* (paso 3.1.4) |
