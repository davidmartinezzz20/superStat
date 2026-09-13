# La app de Android y de iOS

La misma web, empaquetada con [Capacitor](https://capacitorjs.com). No hay un
segundo código: Android e iOS abren un WebView con los archivos de este repo
dentro del propio aparato, así que todo lo que se arregla en la web se arregla
en las dos apps a la vez.

Lo que sí cambia son tres cosas que un WebView no sabe hacer solo, y que
resuelve `js/native.js`: entrar con Google, descargar un archivo y compartir.
Están explicadas ahí.

---

## Antes de nada: qué vas a necesitar

|                     | Android                            | iOS                                   |
|---------------------|------------------------------------|---------------------------------------|
| Sistema para compilar | Windows, macOS o Linux           | **Solo macOS**                        |
| Herramienta         | Android Studio                      | Xcode                                 |
| Cuenta de tienda    | Google Play, 25 $ una vez           | Apple Developer, 99 $ al año          |
| Para probar en tu móvil sin tienda | Sí, instalando el APK | Solo 7 días con cuenta gratuita       |

iOS **no se puede compilar desde Windows ni Linux**. No es una limitación de
esta app: Apple solo permite firmar y compilar con Xcode, que solo existe en
macOS. Si no tienes un Mac, las opciones son pedir uno prestado, alquilar uno en
la nube por horas, o usar un servicio de compilación.

Mientras tanto, en iPhone la app ya se puede instalar desde Safari con
**Compartir → Añadir a pantalla de inicio**: es la misma app, con su icono y a
pantalla completa, y funciona sin cobertura. Lo único que no da es estar en la
App Store.

---

## 1. Preparar el proyecto (una vez)

```bash
npm install
npx cap add android     # crea android/
npx cap add ios         # crea ios/  (solo en macOS)
npm run assets          # genera los iconos y el splash de cada plataforma
```

`android/` e `ios/` no están en el repo a propósito: los genera Capacitor a
partir de `capacitor.config.json` y de los plugins instalados, así que se
rehacen igual en cualquier máquina. Lo que **sí** hay que guardar fuera del
repo es el almacén de claves de Android, y de eso se habla más abajo.

### Cambia el identificador de la app antes de publicar

En `capacitor.config.json` está puesto `com.superstat.balonmano`. Ese
identificador es **para siempre**: una vez publicada, no se puede cambiar sin
crear una app nueva y perder las descargas y las valoraciones. Si tienes un
dominio, usa el tuyo del revés (`es.tudominio.superstat`).

Si lo cambias, borra `android/` e `ios/` y vuelve a hacer `npx cap add`.

---

## 2. El ciclo de trabajo

Cada vez que cambies algo de la web:

```bash
npm run android     # copia los archivos y abre Android Studio
npm run ios         # lo mismo con Xcode
```

Por debajo, esos comandos hacen tres cosas: `node tools/build-www.js` junta en
`www/` los archivos que van dentro de la app, `cap sync` los copia al proyecto
nativo y actualiza los plugins, y `cap open` abre el entorno.

`www/` se rehace entero cada vez y no se guarda en el repo. **Si añades un
archivo nuevo a la web, hay que añadirlo a la lista de `tools/build-www.js`**, o
no entrará en la app. Es una lista a mano a propósito: así dentro del binario no
acaban las pruebas, el esquema de la base ni `node_modules`.

---

## 3. Entrar con Google en la app

Esta es la parte que más se atasca, así que va entera.

Google **bloquea su flujo de login web dentro de un WebView embebido**: si se
deja tal cual, responde `disallowed_useragent` y no se puede entrar. En la app,
el token lo pide el sistema operativo, y para eso Google Cloud necesita saber
quién es esa app. El que valida el token sigue siendo el cliente **web**, que es
el que Supabase tiene configurado; los otros solo sirven para que el sistema
reconozca la app.

### 3.1 Android

1. Saca la huella SHA-1 de la firma. Para probar en tu móvil vale la de
   depuración:
   ```bash
   keytool -list -v -keystore ~/.android/debug.keystore \
     -alias androiddebugkey -storepass android -keypass android | grep SHA1
   ```
2. Google Cloud → *APIs y servicios* → *Credenciales* → *Crear credenciales* →
   *ID de cliente de OAuth* → **Android**.
   - Nombre del paquete: el `appId` de `capacitor.config.json`.
   - Huella SHA-1: la de arriba.
3. **No hay que copiar ese ID a ningún sitio del código.** Android reconoce la
   app por la firma. En `js/config.js` se queda el cliente web, que ya está.

> Cuando publiques en Google Play, Play firma el AAB con **su propia clave**, y
> esa huella es distinta de la tuya. Hay que añadir también la SHA-1 que Play
> enseña en *Configuración → Integridad de la aplicación → Firma de apps*, o el
> login con Google funcionará al probarlo y fallará en la versión publicada.
> Es la causa número uno de "me funcionaba y al publicar dejó de ir".

### 3.2 iOS

1. Google Cloud → *Credenciales* → *Crear credenciales* → *ID de cliente de
   OAuth* → **iOS**, con el bundle id de la app (el mismo `appId`).
2. Copia ese ID en `js/config.js`, en `GOOGLE_CLIENT_ID_IOS`.
3. En Xcode, en *Info* → *URL Types*, añade un esquema de URL con el **ID de
   cliente invertido**. Google lo da hecho al crear la credencial; tiene la
   forma `com.googleusercontent.apps.123456-abcdef`.

### 3.3 Comprobar que va

En `js/app.js`, `authErrorText()` traduce los fallos típicos. Si sale *"La app no
está dada de alta en Google con esta firma"*, es el error 10 de Android: la
huella SHA-1 no coincide con ninguna registrada.

---

## 4. Sacar el binario de Android

### Para probarlo en tu móvil

En Android Studio: *Run*, con el móvil conectado y la depuración USB activada.
O por línea de comandos:

```bash
cd android && ./gradlew assembleDebug
# el APK queda en android/app/build/outputs/apk/debug/
```

### Para Google Play

1. **Crea el almacén de claves** (una sola vez en la vida de la app):
   ```bash
   keytool -genkey -v -keystore superstat.keystore \
     -alias superstat -keyalg RSA -keysize 2048 -validity 10000
   ```
   **Guárdalo fuera del repo y haz copia.** Si lo pierdes, Google Play no deja
   volver a subir una actualización de la misma app nunca más: hay que publicar
   una app nueva desde cero.
2. En Android Studio: *Build → Generate Signed Bundle / APK → Android App
   Bundle*, con ese almacén.
3. Sube el `.aab` a Play Console.

La primera publicación tarda: Google revisa las apps nuevas y suele pedir
además una cuenta de prueba para poder entrar (dales un correo y una contraseña
creados en la propia app).

---

## 5. Sacar el binario de iOS

```bash
npm run ios     # abre Xcode
```

En Xcode:

1. *Signing & Capabilities*: elige tu equipo de desarrollo. Xcode se encarga de
   los perfiles.
2. Para probar en tu iPhone: conéctalo, elígelo como destino y dale a *Run*.
   Con cuenta gratuita la app caduca a los 7 días y hay que reinstalarla.
3. Para la App Store: *Product → Archive* y luego *Distribute App*.

Apple pide además, antes de publicar: una política de privacidad accesible por
URL, rellenar el cuestionario de privacidad (esta app guarda correo y datos
deportivos en Supabase) y capturas de pantalla de varios tamaños. La primera
revisión suele tardar entre uno y tres días.

---

## 6. Cosas que conviene saber

**Los datos son los mismos.** La app y la web comparten la cuenta y el proyecto
de Supabase: lo que anotas en el móvil aparece en el ordenador. No hay nada que
configurar para eso.

**El partido a medias no viaja.** El borrador de un partido sin guardar vive en
el aparato donde se está anotando (ver `CLAUDE.md`). Si empiezas un partido en el
móvil, termínalo ahí.

**Sin service worker dentro de la app.** Los archivos ya están en el aparato, así
que no hay nada que cachear; `index.html` no lo registra cuando detecta que está
en nativo. En la web sigue igual que siempre.

**Al actualizar Capacitor** hay que copiar también la versión nueva de
`vendor/capacitor-core-*.js`, o el JavaScript y el puente nativo pueden dejar de
entenderse. Está explicado en `vendor/README.md`.

**El teclado y el área segura.** La app usa `viewport-fit=cover` y las variables
de área segura del CSS, así que la barra inferior se apoya bien en el iPhone.
Si en algún móvil concreto algo queda tapado, se arregla en `css/styles.css` y
vale para las dos plataformas.
