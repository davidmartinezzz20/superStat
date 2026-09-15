# El plan Pro: cobro con Stripe y avisos por correo

SuperStat tiene dos planes:

| | Gratis | Pro |
|---|---|---|
| Equipos | 1 | sin límite |
| Todo lo demás | igual | igual |

El tope está **solo en crear**. Quien termine la prueba con tres equipos se
queda con los tres y los sigue usando: solo no puede añadir un cuarto. Quitarle
datos a alguien por dejar de pagar sería otra cosa muy distinta de lo que se
vende aquí.

El número está en una constante de `js/app.js`:

```js
const FREE_TEAMS = 1;
```

---

## Lo primero: por qué se cobra fuera de las tiendas, y qué implica

Apple y Google se llevan entre el 15 y el 30 % de lo que se cobra con su sistema
de compras, y a cambio **exigen usarlo** para lo que se consume dentro de la
app. SuperStat cobra en la web con Stripe, así que no hay comisión. La
contrapartida no es negociable y conviene entenderla antes de tocar nada:

> **Las apps de Android e iPhone no pueden llevar a comprar.** Ni un botón, ni un
> enlace, ni un precio, ni un texto que diga dónde se contrata. La guía 3.1.1 de
> Apple prohíbe "botones, enlaces externos u **otras llamadas a la acción**", y
> la política de pagos de Google va en la misma dirección. Un cartel que diga
> "entra en superstat.online" es una llamada a la acción aunque no se pueda
> pulsar, y un revisor lo ve en dos segundos.

En la tienda de EE.UU. esto se ha abierto desde 2025 por las órdenes judiciales
de los casos de Epic, y Apple tiene permisos que se solicitan para enlazar
fuera. Fuera de ahí, sigue siendo motivo de rechazo. **Si algún día quieres el
enlace dentro de la app, pídelo por el cauce formal; no lo escribas y ya está.**

Cómo está resuelto en el código:

- `puedeComprar()` en `js/app.js` es el único sitio que decide. Devuelve `false`
  dentro de la app, y de ahí cuelgan el paywall, el precio y los botones.
- `render()` manda al panel si alguien llega a la pantalla de Pro en móvil, por
  si quedara una ruta olvidada.
- La sección 7 de `test/nativo.js` comprueba que en la app no aparezca un botón
  de comprar, ni un precio, ni una dirección, ni la palabra Stripe. **Si algún
  día esa prueba falla, no la arregles cambiándola**: está ahí para evitar que
  tumben la app en una actualización.

**Quien convierte es el correo**, no la app. Escribirle a tus propios usuarios
fuera de la app sí está permitido —es lo que hace Netflix— y es el único camino
que le queda a quien usa solo el móvil para enterarse de que existe Pro. De ahí
la segunda mitad de este documento.

### Y el IVA, que ahora es tuyo

Con compras in-app, Apple y Google son el vendedor de cara al cliente y liquidan
el IVA de cada país. **Con Stripe el vendedor eres tú.** Vender suscripciones
digitales a consumidores de la UE obliga a repercutir el IVA del país del
comprador y a declararlo (ventanilla única, OSS, desde España). Stripe Tax lo
calcula y lo cobra por ti, pero el alta y las declaraciones no las hace nadie en
tu lugar.

Si eso pesa más que la comisión, la alternativa es un vendedor intermediario
(*merchant of record*) tipo Paddle o Lemon Squeezy, que factura él y se queda el
problema fiscal a cambio de un ~5 %. Todo lo de este repositorio vale igual:
solo cambiaría quién emite el enlace de pago y qué webhook se escucha.

---

## 1. La base de datos

Ya está en `supabase/schema.sql`, así que si has seguido
[`supabase.md`](supabase.md) no hay nada que hacer. Son dos tablas:

- **`subscriptions`** — quién tiene Pro y hasta cuándo. Su política RLS es de
  **solo lectura**: el usuario la lee y no la escribe. La escribe únicamente el
  webhook, con la clave de servicio. Esa es toda la seguridad del asunto: la
  clave anon la tiene cualquiera que abra la web.
- **`avisos`** — si quiere correos, en qué idioma, cuándo se le escribió por
  última vez y su token de baja.

Ninguna de las dos se sincroniza, y eso **no se puede cambiar**: si se añadieran
a `DB.TABLES` (`js/db.js`), `push()` intentaría subirlas, RLS rechazaría la
escritura y el error dejaría la cola de sincronización atascada para siempre,
con los partidos sin subir dentro.

`pro_until` es una fecha y no un sí/no a propósito: un móvil que pase semanas
sin cobertura caduca la suscripción él solo cuando toca, y la prueba gratuita no
necesita nada aparte.

---

## 2. Stripe

1. Crea la cuenta en [stripe.com](https://stripe.com) y **quédate en modo de
   prueba** hasta el final.
2. **Producto**: *Product catalog → Add product*. Nombre `SuperStat Pro`,
   precio **recurrente mensual**, en euros. Apunta el **ID del precio**
   (`price_...`), que no es el del producto (`prod_...`).
3. **Stripe Tax**: *Settings → Tax*. Actívalo y da de alta tus registros
   fiscales. Sin esto cobras sin IVA y el problema aparece en la declaración.
4. **Portal de cliente**: *Settings → Billing → Customer portal*. Actívalo y
   deja marcado que se pueda cancelar la suscripción. Es lo que abre el botón
   *Gestionar la suscripción* de la pantalla de Cuenta.
5. **Clave secreta**: *Developers → API keys → Secret key* (`sk_test_...`). Esta
   **no va nunca en el repositorio**: solo como secreto de las funciones.

La prueba de 7 días no se configura en Stripe: la pide la función `pago` en cada
compra (`trial_period_days: 7`). Para cambiarla, esa línea.

### El precio que se enseña

En `js/config.js`:

```js
PRO_PRICE: '4,99 €'
```

Es **solo el cartel** de la pantalla de Pro: quien cobra de verdad es Stripe.
Tiene que coincidir con el precio que hayas dado de alta. Si lo dejas vacío, la
pantalla no enseña precio y el bueno sigue siendo el que salga en la página de
pago.

---

## 3. Resend, para los correos

Los dos avisos (el del tope y el de "tu prueba acaba pronto") salen por
[Resend](https://resend.com).

1. Crea la cuenta y **da de alta tu dominio** en *Domains*.
2. Añade en tu DNS los registros que te dé (SPF y DKIM). **Este paso no es
   opcional**: sin dominio verificado los correos llegan a spam, y un aviso en
   spam no convierte a nadie. Tarda unos minutos en propagarse.
3. *API Keys → Create*. Apunta la clave (`re_...`).

---

## 4. Los secretos de las funciones

Son seis valores y hay dos maneras de ponerlos. Basta con una.

Y son **claves vivas** (`sk_...`, `re_...`, `whsec_...`): se escriben en tu
ordenador o en el panel, nunca en el repositorio ni en una máquina prestada.

### Desde el panel, sin clonar nada

Supabase → **Edge Functions → Secrets** → *Add new secret*, uno por cada fila de
la tabla de abajo. El valor se pega tal cual: las comillas de `RESEND_FROM` que
se ven en el bloque de la CLI solo están para que el espacio del nombre no parta
el argumento en la consola, y aquí sobran.

### Con la CLI, desde la raíz del repositorio

Hace falta tener el repositorio en tu ordenador y la sesión iniciada:

```bash
git clone https://github.com/davidmartinezzz20/superStat
cd superStat
npx supabase login
npx supabase link --project-ref cqjpexlgjqyzdjkcdwpw   # la referencia, en supabase/config.toml

npx supabase secrets set \
  STRIPE_SECRET_KEY=sk_test_... \
  STRIPE_PRICE_ID=price_... \
  STRIPE_WEBHOOK_SECRET=whsec_... \
  RESEND_API_KEY=re_... \
  RESEND_FROM='SuperStat <hola@tudominio>' \
  SUPERSTAT_WEB=https://super-stat.vercel.app
```

`secrets set` acepta también `--project-ref <referencia>`, y con eso no necesita
ni el repositorio ni el `link`: se puede lanzar desde cualquier carpeta. Clonar
hace falta igualmente para el paso 5, que es el que sube el código.

(`STRIPE_WEBHOOK_SECRET` sale del paso siguiente; puedes volver a ejecutar esto
luego solo con esa.)

| Secreto | Para qué | Si falta |
|---|---|---|
| `STRIPE_SECRET_KEY` | cobrar, y cancelar al borrar la cuenta | la pantalla de pago da error |
| `STRIPE_PRICE_ID` | qué se vende | la pantalla de pago da error |
| `STRIPE_WEBHOOK_SECRET` | comprobar que el webhook es de Stripe | nadie pasa a Pro nunca |
| `RESEND_API_KEY` | mandar los avisos | no se manda ninguno, y nada más falla |
| `RESEND_FROM` | el remitente | se usa uno por defecto que seguramente no es tuyo |
| `SUPERSTAT_WEB` | a dónde se vuelve tras pagar | se usa la dirección de Vercel |

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` las pone Supabase sola.

---

## 5. Desplegar las funciones

Aquí el repositorio **no es opcional**: lo que se sube es el código de
`supabase/functions/<nombre>/index.ts`. Desde su raíz, con el `login` y el
`link` del paso anterior ya hechos:

```bash
npx supabase functions deploy pago
npx supabase functions deploy stripe-webhook
npx supabase functions deploy aviso-tope
npx supabase functions deploy baja-avisos
npx supabase functions deploy borrar-cuenta   # cambió: ahora cancela en Stripe
```

Las cuatro llevan `verify_jwt = false` en `supabase/config.toml`, **y no es lo
mismo en todas**:

- `pago` y `aviso-tope`: porque el preflight de CORS va sin `Authorization` y la
  puerta de enlace lo tumbaría. Las dos exigen el Bearer por su cuenta y
  resuelven al usuario con `auth.getUser(token)`.
- `stripe-webhook`: porque quien llama es Stripe, y lo que trae no es una sesión
  de Supabase sino su firma. La comprueba la función.
- `baja-avisos`: porque un enlace de baja que exija iniciar sesión no es un
  enlace de baja. Lo que sustituye a la sesión es el token del correo.

Ninguna afloja nada: la comprobación que importa está dentro.

El camino del panel que vale para `borrar-cuenta` (*Deploy a new function → Via
Editor*, en [`supabase.md`](supabase.md)) aquí se queda corto: `aviso-tope` y
`stripe-webhook` importan `../_shared/correo.ts`, así que habría que recrear a
mano ese archivo y el árbol de carpetas. Con la CLI van los cinco de una vez.

---

## 6. El webhook

*Developers → Webhooks → Add endpoint*:

- **URL**: `https://<referencia>.supabase.co/functions/v1/stripe-webhook`
- **Eventos**:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `customer.subscription.trial_will_end`

Copia el *Signing secret* (`whsec_...`) y guárdalo como `STRIPE_WEBHOOK_SECRET`.

Qué hace con cada uno:

| Evento | Qué provoca |
|---|---|
| `checkout.session.completed` | enlaza la cuenta con el cliente de Stripe |
| `subscription.created/updated` | escribe `pro_until` y el estado |
| `subscription.deleted` | corta el Pro cuando Stripe diga |
| `trial_will_end` | manda el correo de "la prueba acaba pronto" |

Dos detalles que cuestan de encontrar si fallan:

- **El id de usuario viaja en los metadatos de la suscripción**, no solo en el
  `client_reference_id`. `subscription.created` puede llegar *antes* que el del
  checkout, y sin el metadato ese primer evento no se sabría de quién es.
- **Los webhooks se reintentan y llegan desordenados.** Por eso se guarda
  `event_at` y se descarta lo más viejo: sin eso, un `trialing` reintentado
  pisaría al `active` posterior y dejaría a alguien que paga con la fecha de la
  prueba.

---

## 7. Probarlo

### El límite, sin Stripe ni nada

```bash
npm test          # test/planes.js hace los nueve casos
```

Cubre lo que no se ve mirando la pantalla: que el tope solo esté en crear, que
el Pro sobreviva a quedarse sin cobertura, que una fecha pasada no desbloquee
aunque siga en la caché y que al salir de la cuenta no se le quede al siguiente.

### El cobro entero, en modo de prueba

```bash
npx stripe login
npx stripe listen --forward-to https://<referencia>.supabase.co/functions/v1/stripe-webhook
```

Entra en la web, crea un segundo equipo, pulsa en la pantalla de Pro y paga con
la tarjeta de prueba `4242 4242 4242 4242`, cualquier fecha futura y cualquier
CVC. Al volver, el tope tiene que haber desaparecido solo, sin recargar.

Comprueba también:

- Que en la pantalla de Cuenta pone **prueba** y no *Pro* a secas.
- Que en `subscriptions` hay una fila con `status = 'trialing'`.
- Que **el mismo usuario en el móvil** también ve el tope levantado: es la misma
  cuenta, aunque haya pagado en otro sitio.
- Que cancelar desde *Gestionar la suscripción* **no** quita el Pro al momento:
  está pagado hasta el final del periodo y así tiene que quedarse.

### El aislamiento, a mano y contra el proyecto de verdad

Esto no lo puede comprobar ninguna prueba automática, porque RLS solo existe en
el proyecto real. Desde la consola del navegador, con sesión iniciada:

```js
// Tiene que fallar: la política de subscriptions es de solo lectura.
await DB.init().from('subscriptions').upsert({ user_id:'<tu uid>', pro_until:'2099-01-01' });

// Tiene que devolver 0 filas: la de otro no se ve.
await DB.init().from('subscriptions').select('*');

// Tiene que fallar: de avisos solo se pueden cambiar email_ok y lang.
await DB.init().from('avisos').update({ tope_avisado_at:null }).eq('user_id','<tu uid>');
```

### Los correos

Con `RESEND_API_KEY` puesta, llega al tope con una cuenta de prueba y mira que
el correo llegue **en el idioma en el que tengas la app**, y que el enlace de
baja del pie funcione sin iniciar sesión. Después, el interruptor de *Avisos por
correo* de la pantalla de Cuenta tiene que salir apagado.

El aviso del tope se manda **como mucho una vez cada 30 días** por persona, y lo
decide la función, no el navegador (`DIAS_ENTRE_AVISOS` en
`supabase/functions/aviso-tope/index.ts`). Para volver a probarlo, pon a `null`
el `tope_avisado_at` de esa fila.

---

## 8. Pasar a producción

1. En Stripe, sal del modo de prueba y repite el producto, el precio y el
   webhook: **son distintos en vivo**, incluido el *signing secret*.
2. Vuelve a poner los secretos con las claves de verdad (`sk_live_...`).
3. Comprueba que `PRO_PRICE` en `js/config.js` dice lo que cobras.
4. Ten hecha el alta fiscal antes de la primera venta, no después.

---

## Si algo falla

| Síntoma | Casi seguro es |
|---|---|
| La pantalla de Pro da error al pulsar | falta `STRIPE_SECRET_KEY` o `STRIPE_PRICE_ID`, o la función `pago` no está desplegada |
| Se paga y nunca llega el Pro | el webhook no está dado de alta, o `STRIPE_WEBHOOK_SECRET` no es el de este endpoint |
| En los registros del webhook, "firma que no cuadra" | el secreto es el del otro modo (prueba/producción) |
| Vuelve del pago y sigue en Gratis un rato | normal unos segundos; la app reintenta 20 s y luego se activa sola |
| No llega ningún correo | falta `RESEND_API_KEY`, o el dominio no está verificado (mira también spam) |
| El botón de gestionar no hace nada | el portal de cliente no está activado en Stripe |
| En la app de móvil no se ve el precio | **es lo correcto**, no es un fallo. Ver el primer apartado |
