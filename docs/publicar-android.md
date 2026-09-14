# Publicar en Google Play, de principio a fin

Los otros documentos están ordenados por tema: [`movil.md`](movil.md) explica
cómo se compila, [`play.md`](play.md) qué se escribe en la ficha y
[`supabase.md`](supabase.md) cómo se configura la cuenta. Este va por orden de
ejecución: lo que hay que hacer, en qué orden y qué no se puede hacer todavía
porque depende de un paso anterior.

No repite lo que ya está en los otros —los textos de la ficha siguen viviendo
solo en `play.md`— pero sí dice en qué momento toca ir a buscarlos.

**Lo que ya está resuelto en el repositorio** y no hay que preparar: el icono de
la tienda, el gráfico de cabecera, las ocho capturas (`play/`), los textos y las
respuestas de todos los formularios (`play.md`) y la política de privacidad
(`privacidad.html`). Todo lo que queda es de fuera del repositorio: tu máquina,
Google Cloud, Supabase y Play Console.

---

## 0. El mapa, para saber dónde estás

| Bloque | Dónde se hace | Cuánto lleva |
|---|---|---|
| 1. La prueba cerrada | Play Console | **14 días de calendario** |
| 2. La web publicada | Vercel | minutos |
| 3. El proyecto Android | tu ordenador | una tarde la primera vez |
| 4. El almacén de claves | tu ordenador | minutos, pero es para siempre |
| 5. Google Cloud | consola de Google | minutos |
| 6. La versión del binario | tu ordenador | minutos |
| 7. El AAB firmado | Android Studio | minutos |
| 8. La ficha y los formularios | Play Console | una tarde |
| 9. La cuenta del revisor | la app + Play Console | minutos |
| 10. De prueba cerrada a producción | Play Console | días de revisión |

El bloque 1 es el único que no se puede acelerar, así que se empieza por él
aunque el binario no esté listo del todo.

---

## 1. Antes que nada: averigua si te piden 14 días de pruebas

Google exige, a las **cuentas de desarrollador personales creadas después del
13 de noviembre de 2023**, una prueba cerrada con un mínimo de probadores
durante **14 días seguidos** antes de dejar publicar en producción. A las
cuentas de empresa (organización) y a las personales anteriores a esa fecha no
se lo pide.

1. Entra en [Play Console](https://play.google.com/console/) y comprueba que la
   cuenta está **verificada**: te habrán pedido documento de identidad y
   dirección, y hasta que eso esté aprobado no se puede publicar nada. Si acabas
   de pagar los 25 $, esto puede tardar unos días por sí solo.
2. **Crear aplicación**:
   - Nombre: `SuperStat · Balonmano`
   - Idioma predeterminado: Español (España)
   - Aplicación o juego: **Aplicación**
   - Gratuita o de pago: **Gratuita** (ojo: de gratuita a de pago no se puede
     cambiar después)
   - Marca las dos declaraciones de las políticas.
3. Mira en el panel izquierdo, en **Prueba → Prueba cerrada**. Si tu cuenta está
   sujeta al requisito, la consola te lo dice ahí con todas las letras y te
   enseña el contador de días y de probadores.

> El número exacto de probadores lo ha cambiado Google más de una vez (empezó en
> 20 y bajó a 12). **Haz caso a lo que diga tu consola**, no a este documento ni
> a un tutorial de hace un año.

Si te lo piden, lo importante es entender cómo cuenta: son 14 días **seguidos**
con los probadores dados de alta y con la app instalada, y el contador se
reinicia si bajas de la cifra. Así que conviene reunir unos cuantos más de los
mínimos, y ser gente que de verdad vaya a dejarlo instalado —el equipo, el
cuerpo técnico, familia— y no direcciones de correo sueltas.

Los probadores se dan de alta en **Prueba cerrada → Probadores**, con una lista
de correos de Gmail o un grupo de Google. Cada uno tiene que abrir el enlace de
invitación que genera la consola y aceptar; hasta que no aceptan, no cuentan.

No puedes subir nada a esa prueba sin un AAB firmado, así que en cuanto tengas
claro que te lo piden, sigue con los bloques 3 a 7 y vuelve aquí.

---

## 2. La web publicada, con la política de privacidad accesible

Play te va a pedir dos URL y las comprueba de verdad. Las dos salen de la misma
página:

```
https://super-stat.vercel.app/privacidad.html           ← política de privacidad
https://super-stat.vercel.app/privacidad.html#borrar    ← eliminación de la cuenta
```

**Ábrelas en una ventana de incógnito antes de pegarlas en ningún sitio.** Si la
primera da 404, es que lo que Vercel sirve en producción todavía no lleva
`privacidad.html`: haz un despliegue del `main` actual y vuelve a mirar. Es de
los rechazos más tontos que hay, porque llega después de una semana de espera.

Recuerda que `privacidad.html` **no entra** en `tools/build-www.js` a propósito:
lo que pide Play es un enlace público en la ficha, no una pantalla más dentro de
la app.

Y lo que esa segunda URL promete tiene que ser verdad antes de enseñársela a
Google: el borrado de cuenta desde la app lo hace una Edge Function de Supabase
que **hay que desplegar aparte** (§5 de [`supabase.md`](supabase.md)). Es un
comando y se hace en cualquier momento antes del bloque 8.3, pero si se olvida,
el botón está en la app y da error.

---

## 3. Montar el proyecto de Android en tu máquina

Hace falta un ordenador con Windows, macOS o Linux —Android sí se puede compilar
desde cualquiera de los tres, al contrario que iOS— y:

- **Android Studio** ([descarga](https://developer.android.com/studio)). Trae su
  propio JDK, así que no hace falta instalar Java aparte.
- Al abrirlo la primera vez, deja que instale el SDK que te proponga y acepta
  las licencias.
- **Node.js**, para los scripts del repositorio.

Con eso:

```bash
git clone <el repositorio>
cd superStat
npm install
npx cap add android     # crea android/
npm run assets          # genera iconos y splash a partir de assets/
npm run android         # arma www/, sincroniza y abre Android Studio
```

`android/` no está en el repositorio a propósito: lo genera Capacitor a partir
de `capacitor.config.json` y de los plugins de `package.json`. Ten presente
—porque vuelve a aparecer en el bloque 6— que **todo lo que edites a mano dentro
de `android/` se pierde si algún día lo borras y lo vuelves a generar**.

### Pruébalo en tu móvil antes de firmar nada

Activa en el móvil las *Opciones de desarrollador* y la *Depuración por USB*,
conéctalo, y en Android Studio dale a **Run**. O por línea de comandos:

```bash
cd android && ./gradlew assembleDebug
# el APK queda en android/app/build/outputs/apk/debug/
```

Comprueba en el aparato, antes de seguir: que abre, que puedes entrar con correo
y contraseña, que se anota un partido y que **funciona en modo avión**. El login
con Google todavía no va a funcionar; eso es el bloque 5.

### Comprueba el target de la API

Play exige que las apps nuevas apunten a una versión de Android reciente (a día
de hoy, API 35 o superior; Google la sube cada agosto). Capacitor 8 ya genera el
proyecto por encima de ese mínimo, pero si la consola te lo rechaza, el valor
está en `android/variables.gradle`, en `targetSdkVersion`.

---

## 4. El almacén de claves: el paso irreversible

Esta es la única parte de todo el proceso que no tiene arreglo si sale mal. La
clave con la que firmas identifica a la app para siempre; si la pierdes, no
puedes volver a subir una actualización de esa app **nunca**, y hay que publicar
una app nueva desde cero, con otro identificador y perdiendo las descargas y las
valoraciones.

```bash
keytool -genkey -v -keystore superstat.keystore \
  -alias superstat -keyalg RSA -keysize 2048 -validity 10000
```

Te va a pedir una contraseña para el almacén, otra para la clave (puede ser la
misma) y unos datos de identificación que puedes rellenar con tu nombre y tu
ciudad; no salen publicados en ningún sitio.

Guarda **cuatro cosas** juntas, fuera del repositorio y con copia en un sitio
distinto del ordenador —un gestor de contraseñas sirve para las tres últimas, y
para el archivo, un disco aparte o un almacenamiento cifrado en la nube—:

| Qué | Ejemplo |
|---|---|
| El archivo `superstat.keystore` | (el archivo en sí) |
| La contraseña del almacén | |
| El alias | `superstat` |
| La contraseña de la clave | |

> Que el archivo esté en tu ordenador no es una copia de seguridad. Un disco que
> muere se lleva la app por delante.

**Firma de apps de Play.** Cuando subas el primer AAB, Google se queda con una
clave propia y es esa con la que firma lo que se descargan los usuarios; la tuya
pasa a ser la "clave de subida", la que demuestra que el AAB lo mandas tú. Eso
te da un colchón —si pierdes la de subida, se puede pedir un cambio— pero el
trámite es lento y no es un plan, es un rescate. Trátala como si no existiera.

Esa diferencia entre las dos claves es, además, la causa del problema de login
del bloque 5.3.

---

## 5. Google Cloud: que el login con Google funcione en la app

Google **bloquea su flujo de login web dentro de un WebView**, así que en la app
el token lo pide el sistema operativo, y para eso Google Cloud tiene que
reconocer a la app. Quien valida el token sigue siendo el cliente **web** que ya
está en `js/config.js`; los clientes de plataforma solo sirven para que el
sistema sepa quién pregunta.

### 5.1 El cliente de Android (con tu firma de depuración)

1. Saca la huella de la clave de depuración:
   ```bash
   keytool -list -v -keystore ~/.android/debug.keystore \
     -alias androiddebugkey -storepass android -keypass android | grep SHA1
   ```
2. Google Cloud → *APIs y servicios* → *Credenciales* → *Crear credenciales* →
   *ID de cliente de OAuth* → **Android**.
   - Nombre del paquete: `com.superstat.sports`
   - Huella SHA-1: la de arriba.
3. **Ese ID no se copia a ningún archivo.** Android reconoce la app por la
   firma. En `js/config.js` se queda el cliente web tal cual.

Reinstala el APK de depuración y prueba a entrar con Google. Si sale *"La app no
está dada de alta en Google con esta firma"*, es el error 10 de Android: la
SHA-1 no coincide.

### 5.2 Pasar la pantalla de consentimiento a Producción

Mientras la pantalla de consentimiento de OAuth esté en modo **Prueba**, solo
pueden entrar con Google los correos que estén en la lista de *Usuarios de
prueba*. Eso vale mientras la app la usáis cuatro personas, pero **no vale para
una app publicada**: cualquiera que se la baje —y el propio revisor de Google—
se encontrará con un acceso denegado.

Google Cloud → *Google Auth Platform* (antes *Pantalla de consentimiento de
OAuth*) → **Publicar aplicación** / *Cambiar a producción*.

La app solo pide los permisos `email` y `profile`, que Google no considera
sensibles, así que publicar **no dispara ningún proceso de revisión**: el cambio
es inmediato. Lo que sí queda pendiente para siempre es que Google enseñe el
dominio en vez de "SuperStat" en su pantalla, y eso es otra cosa —hace falta un
dominio propio y verificar la marca— explicada al final de
[`supabase.md`](supabase.md).

### 5.3 La SHA-1 de Play (esto es después de subir el primer AAB)

Play firma con **su** clave, no con la tuya, así que la app publicada tiene una
huella distinta de la que registraste en 5.1. Si no añades también esa, el login
con Google te funcionará en tus pruebas y fallará en la versión de la tienda.
Es la causa número uno de "me iba y al publicar dejó de ir".

1. Sube el AAB (bloque 7) a cualquier canal, aunque sea la prueba cerrada.
2. Play Console → *Configuración* → **Integridad de la aplicación** → *Firma de
   apps*. Ahí verás dos certificados: el **de firma de apps** (el de Google) y
   el **de subida** (el tuyo). Copia la SHA-1 del **de firma de apps**.
3. Google Cloud → crea **otro** ID de cliente de OAuth de tipo Android, mismo
   paquete, con esa huella. No sustituye al de 5.1: conviven, para que te siga
   funcionando el APK de depuración.

Anota este paso como pendiente ahora mismo, porque el orden obliga a dejarlo a
medias: no puedes hacerlo hasta haber subido algo.

---

## 6. La versión del binario, y la trampa de `android/`

Play identifica cada subida por el **`versionCode`**, un entero que tiene que
subir en cada AAB que mandes. El `versionName` (`1.0.0`) es solo el texto que ve
la gente.

Los dos están en `android/app/build.gradle`:

```gradle
versionCode 1
versionName "1.0"
```

El problema es que `android/` no está en el repositorio y se regenera con
`npx cap add android`, y al regenerarse **vuelve a `versionCode 1`**. Para la
primera subida da igual. A partir de la segunda, si has regenerado el proyecto
—o compilas desde otro ordenador— Play te rechazará el AAB por versión repetida,
y el mensaje no dice que el problema sea ese.

Así que, cada vez que vayas a compilar para la tienda: **abre ese archivo y
comprueba que el `versionCode` es mayor que el de la última subida**. El número
de la última lo tienes en Play Console, en la lista de versiones de cualquier
canal. Y déjalo apuntado también en `package.json` (`version`) al publicar, para
tener el registro dentro del repositorio.

---

## 7. Generar el AAB firmado

En Android Studio (con el proyecto abierto por `npm run android`, para que
`www/` esté al día):

1. **Build → Generate Signed Bundle / APK**.
2. Elige **Android App Bundle** (no APK: Play quiere el AAB).
3. *Choose existing* → selecciona `superstat.keystore`, y pon la contraseña del
   almacén, el alias y la contraseña de la clave.
4. Marca *Remember passwords* si quieres, pero **no** guardes las contraseñas en
   un archivo dentro del repositorio.
5. Variante: **release**.
6. Al terminar, el archivo queda en `android/app/release/app-release.aab`.

Antes de subirlo, una última comprobación que ahorra un ciclo entero: en Play
Console, la **prueba interna** (un canal distinto de la prueba cerrada, sin
requisito de días ni de número de probadores) te deja subir el AAB y
descargártelo en tu móvil desde la propia Play Store en minutos. Es la única
forma de ver la app **exactamente como le va a llegar a la gente**, firmada por
Google. Aprovecha para comprobar ahí el login con Google después del paso 5.3.

---

## 8. Rellenar Play Console

Todo esto se puede ir haciendo en paralelo a los 14 días de la prueba cerrada.
Los textos y las respuestas están en [`play.md`](play.md); aquí va solo el
recorrido por la consola y lo que la consola pide y `play.md` no cubre.

### 8.1 Ficha de Play Store (*Ficha principal de la tienda*)

Nombre, descripción corta y descripción completa: `play.md` §2.
Gráficos: `play/icono-512.png`, `play/grafico-1024x500.png` y las ocho capturas
de `play/capturas/` en su orden (`play.md` §3).

### 8.2 Configuración de la tienda

Categoría **Deportes**, etiquetas, correo de contacto y sitio web: `play.md` §2,
tabla final.

### 8.3 Contenido de la aplicación

Es una lista de formularios y hay que dejarlos **todos** en verde; la consola no
te deja publicar con uno pendiente. Van en este orden:

| Formulario | Qué contestar |
|---|---|
| Política de privacidad | La primera URL del bloque 2 |
| Acceso a la aplicación | Restringido + cuenta de demostración (`play.md` §7, y bloque 9 de aquí) |
| Anuncios | **No** contiene anuncios |
| Clasificación del contenido | Cuestionario IARC (`play.md` §5) |
| Público objetivo y contenido | **18 años o más**, no atrae a niños (`play.md` §6) |
| Aplicaciones de noticias | **No** |
| Seguridad de los datos | El cuestionario largo (`play.md` §4) |
| Funciones financieras | **No** hay ninguna |
| Salud | **No** aplica |
| Aplicaciones gubernamentales | **No** |
| ID de publicidad | **No** se usa — la app no incluye ninguna librería de anuncios ni de analítica |
| Eliminación de la cuenta | La segunda URL del bloque 2, la del `#borrar` |

Dos avisos sobre estos formularios:

- **Seguridad de los datos es el que más rechazos provoca**, porque Google
  compara lo que declaras con lo que hace el binario. Las respuestas de
  `play.md` §4 salen de leer `supabase/schema.sql` y `js/db.js`, así que son las
  que tocan; si algún día la app empieza a recoger otra cosa, hay que volver
  aquí.
- **Eliminación de la cuenta** es un formulario aparte de la política de
  privacidad, aunque apunten a la misma página. Se puede borrar desde dentro de
  la app (*Cuenta → Borrar la cuenta*), que es lo que Google prefiere, y la
  política ofrece además la vía por correo. Eso sí: el borrado desde la app lo
  hace una Edge Function de Supabase y **no funciona hasta desplegarla**
  (§5 de [`supabase.md`](supabase.md)); hazlo antes de rellenar este formulario.

---

## 9. La cuenta del revisor

Google no puede revisar lo que no puede abrir, y la app pide cuenta desde la
primera pantalla. Sin credenciales, el rechazo es automático.

1. **Comprueba antes el ajuste de confirmación de correo.** Supabase →
   *Authentication → Providers → Email → Confirm email*. Si está activado y usas
   una dirección cuyo buzón no controlas, la cuenta se crea pero se queda sin
   confirmar y el revisor no puede entrar. Lo más simple es usar una dirección
   tuya con `+revisor` (`tucorreo+revisor@gmail.com`), que sí recibes.
2. **Crea la cuenta** desde la app, como un usuario más, con correo y contraseña
   (una larga, y apúntala).
3. **Déjale algo que mirar**: un equipo con cuatro o cinco jugadores y un
   partido entero guardado, con sus tiros. Una cuenta vacía enseña una pantalla
   vacía, y eso también da mala impresión en la revisión.
4. Pega usuario, contraseña e instrucciones en *Contenido de la aplicación →
   Acceso a la aplicación*. Las instrucciones están escritas en `play.md` §7.
5. **Pruébala tú desde cero**, en el móvil, cerrando sesión antes: es un minuto
   y evita una semana de espera.

> Esa cuenta tiene que seguir existiendo mientras la app esté publicada. Google
> la usa también en cada actualización. No la borres.

---

## 10. De la prueba cerrada a producción

1. **Prueba cerrada**: crea la versión, sube el AAB, escribe unas notas de
   versión y publícala. Manda el enlace de invitación a los probadores.
2. Deja pasar los **14 días** con los probadores dentro. Aprovecha para arreglar
   lo que salga: cada AAB nuevo necesita un `versionCode` mayor (bloque 6).
3. Cuando el contador esté completo, la consola habilita **solicitar acceso a
   producción**. Es un formulario corto sobre cómo has probado la app y qué has
   aprendido de los probadores; contéstalo con lo que de verdad haya pasado.
4. Google revisa la solicitud. Si la aprueba, ya puedes crear una versión en
   **Producción** con el mismo AAB.
5. La primera revisión de una app nueva tarda: cuenta con **varios días**, y a
   veces más de una semana. Las actualizaciones posteriores suelen ser cuestión
   de horas.
6. Al publicar, puedes hacer un **lanzamiento por fases** (empezar por un 20 %
   de los usuarios). Con una app de este tamaño no aporta gran cosa; publica al
   100 % y quédate tranquilo.

---

## 11. Nada más publicar

- [ ] Bájate la app **desde la Play Store**, en un móvil donde no la tuvieras, y
      **entra con Google**. Es la comprobación del paso 5.3 y solo se puede
      hacer aquí.
- [ ] Comprueba que la ficha enseña las capturas en el orden que querías.
- [ ] Guarda en sitio seguro, si no lo has hecho ya, el almacén de claves y sus
      contraseñas.

Para cada actualización a partir de ahora: cambia lo que sea en la web, sube
`VERSION` en `sw.js` si has tocado el shell, sube el `versionCode`, `npm run
android`, genera el AAB firmado con el **mismo** almacén y súbelo.

---

## Si Play te rechaza

| Lo que dice el rechazo | Casi siempre es |
|---|---|
| No se puede acceder a la política de privacidad | La URL da 404 en producción (bloque 2) |
| No hemos podido acceder a la app / faltan credenciales | La cuenta del revisor no entra: contraseña mal, o correo sin confirmar (bloque 9) |
| La declaración de seguridad de los datos no coincide | Falta marcar un tipo de dato en el cuestionario (`play.md` §4) |
| Versión ya utilizada | El `versionCode` no ha subido (bloque 6) |
| El nivel de API objetivo no cumple | `targetSdkVersion` en `android/variables.gradle` (bloque 3) |
| Falta la declaración de eliminación de la cuenta | Es un formulario aparte de la política (bloque 8.3) |

Y de los fallos que no son de Play sino de la app publicada, el único frecuente:
**el login con Google va en pruebas y falla en la tienda** → falta la SHA-1 de
*Firma de apps* en Google Cloud (bloque 5.3).
