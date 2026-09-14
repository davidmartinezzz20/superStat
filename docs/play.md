# La ficha de Google Play

Todo lo que pide Play Console que no es el binario: los textos, los gráficos,
las respuestas de los formularios y la cuenta para el revisor. Compilar y firmar
el AAB está en [`movil.md`](movil.md), y el recorrido completo en orden de
ejecución, en [`publicar-android.md`](publicar-android.md).

Lo que ya está hecho y sale del repo:

| Qué | Dónde |
|---|---|
| Política de privacidad | `privacidad.html` (se sirve con la web) |
| Icono de la tienda, 512×512 | `play/icono-512.png` |
| Gráfico de cabecera, 1024×500 | `play/grafico-1024x500.png` |
| Ocho capturas de 1080×1920 | `play/capturas/` |
| Textos y respuestas | este archivo |

Los gráficos y las capturas se regeneran con:

```bash
node tools/make-play-assets.js     # icono y cabecera
node tools/make-screenshots.js     # las ocho capturas
```

> Ojo con `play/capturas-en/`: son las mismas ocho pantallas pero con la app en
> inglés, y **no van a esta ficha**. Son para la cuenta de Instagram en inglés
> (ver [`instagram.md`](instagram.md)). La ficha de Play es castellana, así que
> sube las de `play/capturas/`.

Las capturas salen de la app de verdad, servida desde este repo y con los dobles
de `test/` detrás: no tocan Supabase y el partido que enseñan es inventado, así
que no hay forma de publicar datos de nadie. El guion tiene semilla fija, o sea
que volver a ejecutarlo da exactamente las mismas imágenes.

---

## 1. Antes de nada: publica la web

La política de privacidad tiene que estar en una **URL pública** que se pueda
abrir sin instalar la app ni entrar con una cuenta. La web está en Vercel, así
que son estas dos direcciones, y van en dos sitios distintos de Play Console:

```
https://super-stat.vercel.app/privacidad.html           ← política de privacidad
https://super-stat.vercel.app/privacidad.html#borrar    ← eliminación de la cuenta
```

La primera va en *Política de privacidad*, dentro de la ficha de la tienda. La
segunda, en *Contenido de la aplicación → Eliminación de la cuenta*: es la misma
página, pero el ancla `#borrar` la abre justo en el apartado que explica cómo
pedir el borrado.

> Antes de pegarlas, comprueba que la primera se abre en una ventana de
> incógnito. Si da 404, es que lo que Vercel está sirviendo en producción
> todavía no lleva `privacidad.html` dentro. Play rechaza la ficha si esa URL no
> responde, y es de los rechazos más tontos de arreglar tarde.

Si algún día cambias de dominio, este archivo es el único que hay que tocar
(más los ajustes de consola de [`supabase.md`](supabase.md)): la política no se
nombra a sí misma en ningún sitio, así que `privacidad.html` se queda igual.

---

## 2. Ficha de la tienda (*Store listing*)

### Nombre de la app — máximo 30 caracteres

```
SuperStat · Balonmano
```

El identificador del paquete es `com.superstat.sports` y no menciona el
balonmano a propósito (ver `movil.md`), pero el nombre de la tienda sí debe
decir lo que la app hace **hoy**: es lo que la gente busca. El nombre se puede
cambiar cuando quieras; el identificador, nunca.

### Descripción corta — máximo 80 caracteres

```
Estadísticas de balonmano en directo: tiros, paradas y mapa de la pista.
```

### Descripción completa — máximo 4000 caracteres

```
SuperStat es la libreta de estadísticas de tu equipo de balonmano. Anotas el
partido mientras se juega, con el móvil en la mano, y al pitido final la ficha
ya está hecha.

DURANTE EL PARTIDO
• Las dos porterías dibujadas, la tuya y la del rival, divididas en nueve zonas.
  Un toque en una zona es gol, dos toques son parada, y hay botón aparte para
  fuera y para palo.
• Marca con un dedo el punto exacto de la pista desde el que se ha lanzado,
  sobre una media pista a escala. Si prefieres ir más rápido, se apaga.
• Reloj de partido con pausa y un botón para decidir tú cuándo acaba la primera
  parte: cada anotación se queda con su minuto y su parte, sin dar por hecho que
  las partes duren treinta minutos.
• Portero en pista: se pregunta una sola vez y se queda puesto, así que los
  goles encajados también tienen dueño y el porcentaje de paradas significa algo.
• Registro rápido de lo que no es un tiro: pérdida, robo, dos minutos y tarjetas.
• Quién está en pista, para el más/menos de cada jugador.
• Deshacer, por si se te va el dedo.

DESPUÉS DEL PARTIDO
• Resultado, efectividad y goles por zona de portería.
• Evolución del marcador con la mejor racha.
• Goleadores, paradas por portero y más/menos por jugador.
• Mapa de tiros sobre la pista, con filtro por jugador y por parte, y mapa de
  calor.
• Desde dónde se lanza contra a qué parte de la portería va el balón: el dato
  que de verdad sirve para preparar a un portero.
• Exportar el partido a CSV o compartirlo como imagen.

LA TEMPORADA
Balance de victorias y derrotas, goleadores, porteros, desde dónde lanzáis mejor
y más/menos acumulado, sumando todos los partidos del equipo.

FUNCIONA SIN COBERTURA
Los pabellones no tienen cobertura, así que la app no la necesita: se abre y se
anota igual, y lo que quede pendiente se sube solo cuando vuelve la red. Si el
móvil cierra la app a mitad de partido, al volver a entrar te ofrece seguir
donde lo dejaste.

TUS DATOS SON TUYOS
Una cuenta, con Google o con correo y contraseña, y los mismos datos en el móvil
y en el ordenador. Sin publicidad, sin analítica y sin seguimiento: cada cuenta
solo puede ver lo suyo. Puedes exportar cualquier partido o borrar lo que
quieras cuando quieras.

Varios equipos, cada uno con su plantilla. Gratis y sin compras dentro.
```

### Resto de campos

| Campo | Qué poner |
|---|---|
| Categoría | Deportes |
| Etiquetas | balonmano, estadísticas, entrenador, deportes de equipo |
| Correo de contacto | opt1a.david.martinez@gmail.com |
| Sitio web | `https://super-stat.vercel.app` |
| Teléfono | déjalo vacío, no es obligatorio |
| Anuncios | **No**, la app no contiene anuncios |
| Compras en la aplicación | **No** |

---

## 3. Recursos gráficos

Se suben tal cual desde `play/`:

- **Icono**: `play/icono-512.png`. 512×512, PNG de 32 bits. Play le pone él las
  esquinas redondeadas, por eso el archivo va a cuadro lleno.
- **Gráfico de cabecera**: `play/grafico-1024x500.png`. 1024×500, sin alfa.
- **Capturas de teléfono**: las ocho de `play/capturas/`, en su orden. Play pide
  entre 2 y 8, y las primeras son las que se ven sin desplegar la ficha:

  1. `01-partido-en-vivo` — las dos porterías y el marcador
  2. `02-zona-de-lanzamiento` — marcar el punto sobre la pista
  3. `03-ficha-del-partido` — resultado y evolución del marcador
  4. `04-mapa-de-tiros` — el mapa de calor
  5. `05-goleadores`
  6. `06-temporada`
  7. `07-partidos-anteriores`
  8. `08-plantilla`

No hace falta captura de tablet ni de Android TV mientras la app se publique
solo para teléfono.

---

## 4. Seguridad de los datos (*Data safety*)

Es un cuestionario largo y **es el que más rechazos provoca**, porque Google
compara lo que declaras con lo que hace la app. Estas respuestas son las que
corresponden a lo que hay en `supabase/schema.sql` y en `js/db.js`:

**Preguntas generales**

| Pregunta | Respuesta |
|---|---|
| ¿Tu app recoge o comparte alguno de los tipos de datos exigidos? | **Sí, recoge** (no comparte) |
| ¿Todos los datos se cifran en tránsito? | **Sí** (todo va por HTTPS) |
| ¿Ofreces una forma de solicitar la eliminación de los datos? | **Sí** → pega la URL `#borrar` del punto 1 |
| ¿Se recogen datos de menores? | No dirigida a menores (ver punto 6) |

**Tipos de datos a marcar**

| Tipo | Recogido | Compartido | Obligatorio | Para qué |
|---|---|---|---|---|
| Información personal → **Dirección de correo** | Sí | No | Obligatorio | Gestión de la cuenta |
| Información personal → **Nombre** | Sí | No | Opcional | Gestión de la cuenta |
| Información personal → **Otra información personal** | Sí | No | Opcional | Funciones de la app |

- El **correo** es obligatorio porque sin cuenta no se puede usar la app.
- El **nombre** solo llega si entras con Google (va en el token, junto con la
  URL de la foto de perfil, y lo guarda Supabase con la cuenta). Con correo y
  contraseña no se pide.
- **Otra información personal** es la plantilla: los nombres, dorsales y
  posiciones que escribe el usuario. Son datos de terceros y conviene
  declararlos aunque no sean del propio usuario.

**Lo que NO se marca**, y conviene tenerlo claro por si Google pregunta:
ubicación, contactos, fotos y vídeos, archivos, calendario, mensajes,
rendimiento de la app, historial de búsqueda, identificadores de publicidad e
información financiera. La app no pide ni un permiso de Android para nada de eso.

---

## 5. Clasificación del contenido (cuestionario IARC)

| Pregunta | Respuesta |
|---|---|
| Categoría | Utilidades, productividad, comunicación u otros |
| Violencia, sexo, lenguaje soez, drogas, juego | **No** a todas |
| ¿Los usuarios pueden interactuar o comunicarse entre ellos? | **No** |
| ¿Se comparte la ubicación con otros usuarios? | **No** |
| ¿Permite comprar artículos digitales? | **No** |
| ¿Contenido generado por usuarios visible para otros? | **No** — cada cuenta solo ve lo suyo |

Sale PEGI 3 / *Todos los públicos*. Si algún día se comparte un equipo con el
cuerpo técnico (la idea pendiente de `CLAUDE.md`), **hay que rehacer este
cuestionario**: eso sí es interacción entre usuarios.

---

## 6. Público objetivo y contenido

- **Grupo de edad**: marca únicamente **18 años o más**.
- **¿Tu app atrae a niños?**: No.

Es la respuesta honesta —la app la usa el cuerpo técnico, no los jugadores— y
además evita el programa *Families*, que traería un montón de requisitos extra
que aquí no pintan nada. Que en las plantillas haya nombres de menores no
convierte a la app en una app para menores; de eso se habla en la política de
privacidad.

---

## 7. Acceso a la app: la cuenta para el revisor

Google no puede revisar lo que no puede abrir, y esta app pide cuenta desde la
primera pantalla. Sin credenciales, el rechazo es automático.

**1. Crea la cuenta** en la app publicada (web o APK), como un usuario más:

```
Correo:     revisor@superstat.app        (o uno tuyo con +revisor)
Contraseña: una larga, y apúntala
```

Ese buzón depende de un dominio propio, así que antes de crear la cuenta
asegúrate de una de las dos cosas: o **puedes recibir correo en
`revisor@superstat.app`**, o tienes **desactivado *Confirm email*** en Supabase
(Authentication → Providers → Email). Con la confirmación activada y sin
acceso al buzón, la cuenta se crea pero se queda sin confirmar, y el revisor se
encuentra con que las credenciales que le diste no entran.

**2. Deja dentro algo que mirar.** Una cuenta vacía enseña una pantalla vacía:
crea un equipo con cuatro o cinco jugadores y guarda un partido entero, con sus
tiros. Con eso el revisor ve la app funcionando.

**3. En Play Console** → *Contenido de la aplicación* → *Acceso a la aplicación*
→ **«Todas o algunas funciones están restringidas»**, y añade una entrada:

- *Nombre de las instrucciones*: `Cuenta de demostración`
- *Usuario* y *Contraseña*: los de arriba
- *Instrucciones*:

```
La app necesita una cuenta para funcionar. En la primera pantalla, elige
"Entrar con correo", escribe el usuario y la contraseña de arriba y pulsa
Entrar (no hace falta "Entrar con Google", que es solo otra forma de acceder).

La cuenta ya tiene un equipo con su plantilla y un partido guardado:
- Equipos → CB Sabadell → Ver estadísticas de partidos anteriores → toca el
  partido para ver la ficha completa.
- Equipos → CB Sabadell → Nuevo partido para probar a anotar en directo.

La app funciona sin conexión: los datos se guardan en el dispositivo y se
sincronizan al recuperar la red.
```

> La cuenta tiene que seguir existiendo mientras la app esté publicada: Google
> la usa en cada revisión, también en las actualizaciones. No la borres.

---

## 8. Antes de darle a publicar

- [ ] La web está publicada y `privacidad.html` se abre desde fuera.
- [ ] Las dos URL del punto 1 están pegadas en Play Console.
- [ ] Icono, cabecera y las ocho capturas subidas.
- [ ] Los tres textos del punto 2, sin pasarse de caracteres.
- [ ] Seguridad de los datos, clasificación y público objetivo contestados.
- [ ] Cuenta de revisor creada, con datos dentro, y probada entrando desde cero.
- [ ] La SHA-1 de *Firma de apps* de Play añadida en Google Cloud
      (§3.1 de [`movil.md`](movil.md)) — si falta, el login con Google va en
      pruebas y falla en producción.
- [ ] Cuenta de Play Console verificada. Si es una cuenta personal creada
      después de noviembre de 2023, Google exige además **12 probadores durante
      14 días** en una prueba cerrada antes de dejar pasar a producción: eso se
      empieza pronto, porque son dos semanas de calendario.

## 9. Lo que no da esta ficha, y conviene saber

**La cuenta se borra desde dentro de la app**, en *Cuenta → Borrar la cuenta*,
que es lo que Google prefiere; la política ofrece además la vía por correo, que
Play también acepta. Lo hace una Edge Function de Supabase, así que **hay que
desplegarla antes de publicar** (§5 de [`supabase.md`](supabase.md)): sin eso el
botón está y da error, que es peor que no tenerlo.
