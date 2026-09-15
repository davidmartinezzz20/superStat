# La ficha de Google Play

Todo lo que pide Play Console que no es el binario: los textos, los gráficos,
las respuestas de los formularios y la cuenta para el revisor. Compilar y firmar
el AAB está en [`movil.md`](movil.md), y el recorrido completo en orden de
ejecución, en [`publicar-android.md`](publicar-android.md).

Lo que ya está hecho y sale del repo:

| Qué | Dónde |
|---|---|
| Política de privacidad | `privacidad.html` y sus tres traducciones (se sirven con la web) |
| Icono de la tienda, 512×512 | `play/icono-512.png` |
| Gráfico de cabecera, 1024×500 | `play/grafico-1024x500.png` |
| Ocho capturas de 1080×1920 | `play/capturas/` |
| Textos y respuestas | este archivo |

Los gráficos y las capturas se regeneran con:

```bash
node tools/make-play-assets.js            # icono y cabecera
node tools/make-screenshots.js            # las ocho capturas, en castellano
IDIOMA=en node tools/make-screenshots.js  # y en inglés, francés y alemán
IDIOMA=fr node tools/make-screenshots.js
IDIOMA=de node tools/make-screenshots.js
```

> Cada idioma va a su carpeta: `play/capturas/`, `play/capturas-en/`,
> `play/capturas-fr/` y `play/capturas-de/`. **La ficha castellana lleva las de
> `play/capturas/` y ninguna otra.** Si das de alta la ficha en otro idioma
> (sección 2), sube las de su carpeta; y las inglesas sirven además para la
> cuenta de Instagram en inglés (ver [`instagram.md`](instagram.md)).

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

La misma política está traducida, una página por idioma, y cada una enlaza a
las otras tres con una fila de enlaces bajo el título:

```
https://super-stat.vercel.app/privacidad-en.html    ← inglés
https://super-stat.vercel.app/privacidad-fr.html    ← francés
https://super-stat.vercel.app/privacidad-de.html    ← alemán
```

El ancla `#borrar` es la misma en las cuatro —en castellano y sin traducir, a
propósito—, así que la URL de eliminación de la cuenta de cualquier ficha se
monta igual. Si das de alta la ficha de Play en otro idioma, pon en ella la
política de ese idioma; la castellana no se toca.

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

Un equipo gratis, con todo lo de arriba incluido. Con SuperStat Pro, todos los
que quieras: una categoría por equipo, cada uno con su plantilla y su temporada.
Sin anuncios y sin compras dentro de la app.
```

> **Ojo con este párrafo.** Describe qué entra en cada plan y **no dice dónde se
> contrata Pro**, y así tiene que quedarse. Las reglas de Apple y Google sobre
> llevar a comprar fuera alcanzan también a los textos de la ficha: un enlace o
> una dirección aquí es lo mismo que un botón dentro de la app. El porqué está
> en `suscripcion.md`.

### La ficha en otros idiomas

La app está en castellano, inglés, francés y alemán, así que la ficha puede
estarlo también: en Play Console, *Ficha de Play principal → Gestionar
traducciones → Añadir un idioma*. El idioma predeterminado sigue siendo español
(España) y no se cambia; lo demás son traducciones que se añaden encima.

Cada una lleva **sus** capturas (`play/capturas-en/`, `-fr`, `-de`) y **su**
política de privacidad (`privacidad-en.html`, `-fr`, `-de`). El icono y el
gráfico de cabecera son los mismos: no llevan texto.

Los tres párrafos del plan dicen lo mismo que el castellano y **tampoco dicen
dónde se contrata Pro**. La regla de Apple y Google no cambia de idioma.

<details>
<summary><strong>English</strong></summary>

Nombre (30) · descripción corta (80) · descripción completa (4000):

```
SuperStat · Handball
```

```
Live handball stats: shots, saves and a shot map of the court.
```

```
SuperStat is your handball team's stats notebook. You record the match while it
is being played, phone in hand, and by the final whistle the report is already
done.

DURING THE MATCH
• Both goals drawn, yours and the opponent's, split into nine zones. One tap on
  a zone is a goal, two taps is a save, and there are separate buttons for wide
  and for the post.
• Mark with a finger the exact point on the court the shot came from, on a
  half-court drawn to scale. If you would rather go faster, turn it off.
• Match clock with pause and a button so you decide when the first half ends:
  every record keeps its minute and its half, without assuming halves last
  thirty minutes.
• Keeper on court: asked once and then kept, so conceded goals have an owner too
  and the save percentage actually means something.
• Quick log for what is not a shot: turnovers, steals, two minutes and cards.
• Who is on court, for each player's plus/minus.
• Undo, in case your finger slips.

AFTER THE MATCH
• Result, efficiency and goals by goal zone.
• How the scoreline moved, with the best run.
• Scorers, saves per keeper and plus/minus per player.
• Shot map over the court, filtered by player and by half, plus a heat map.
• Where the shot came from against which part of the goal it went: the number
  that really helps you prepare a keeper.
• Export the match to CSV or share it as an image.

THE SEASON
Wins and losses, scorers, keepers, where you shoot best and cumulative
plus/minus, adding up every match the team has played.

IT WORKS WITH NO SIGNAL
Sports halls have no signal, so the app does not need one: it opens and records
just the same, and anything pending is uploaded on its own when the network
comes back. If your phone closes the app mid-match, it offers to pick up where
you left off.

YOUR DATA IS YOURS
One account, with Google or with email and password, and the same data on the
phone and on the computer. No ads, no analytics and no tracking: each account
can only see its own. You can export any match or delete whatever you want
whenever you want.

One team free, with everything above included. With SuperStat Pro, as many as
you like: one age group per team, each with its own roster and season. No ads
and no in-app purchases.
```

</details>

<details>
<summary><strong>Français</strong></summary>

Nom (30) · description courte (80) · description complète (4000) :

```
SuperStat · Handball
```

```
Stats de handball en direct : tirs, arrêts et carte des tirs sur le terrain.
```

```
SuperStat est le carnet de statistiques de ton équipe de handball. Tu notes le
match pendant qu'il se joue, le téléphone à la main, et au coup de sifflet final
la fiche est déjà faite.

PENDANT LE MATCH
• Les deux buts dessinés, le tien et celui de l'adversaire, divisés en neuf
  zones. Un appui sur une zone, c'est un but ; deux appuis, un arrêt ; et il y a
  un bouton à part pour le hors cadre et pour le poteau.
• Marque du doigt le point exact du terrain d'où le tir est parti, sur un
  demi-terrain à l'échelle. Si tu préfères aller plus vite, ça se désactive.
• Chrono de match avec pause et un bouton pour décider toi-même quand se termine
  la première mi-temps : chaque annotation garde sa minute et sa mi-temps, sans
  supposer que les périodes durent trente minutes.
• Gardien sur le terrain : on te le demande une seule fois et il reste en place,
  donc les buts encaissés ont eux aussi un responsable et le pourcentage
  d'arrêts veut dire quelque chose.
• Saisie rapide de ce qui n'est pas un tir : pertes de balle, interceptions,
  deux minutes et cartons.
• Qui est sur le terrain, pour le plus/moins de chaque joueur.
• Annuler, au cas où le doigt dérape.

APRÈS LE MATCH
• Résultat, efficacité et buts par zone du but.
• Évolution du score avec la meilleure série.
• Buteurs, arrêts par gardien et plus/moins par joueur.
• Carte des tirs sur le terrain, avec filtre par joueur et par mi-temps, et
  carte de chaleur.
• D'où l'on tire face à quelle partie du but le ballon part : la donnée qui sert
  vraiment à préparer un gardien.
• Exporter le match en CSV ou le partager en image.

LA SAISON
Bilan des victoires et des défaites, buteurs, gardiens, d'où vous tirez le mieux
et plus/moins cumulé, en additionnant tous les matchs de l'équipe.

ÇA MARCHE SANS RÉSEAU
Les gymnases n'ont pas de réseau, donc l'application n'en a pas besoin : elle
s'ouvre et enregistre pareil, et ce qui reste en attente est envoyé tout seul au
retour de la connexion. Si le téléphone ferme l'application en plein match, elle
te propose de reprendre là où tu t'étais arrêté.

TES DONNÉES SONT À TOI
Un compte, avec Google ou avec e-mail et mot de passe, et les mêmes données sur
le téléphone et sur l'ordinateur. Sans publicité, sans outil de mesure et sans
traçage : chaque compte ne voit que ce qui lui appartient. Tu peux exporter
n'importe quel match ou supprimer ce que tu veux quand tu veux.

Une équipe gratuite, avec tout ce qui précède. Avec SuperStat Pro, autant que tu
veux : une catégorie par équipe, chacune avec son effectif et sa saison. Sans
publicité et sans achat intégré.
```

</details>

<details>
<summary><strong>Deutsch</strong></summary>

Name (30) · Kurzbeschreibung (80) · vollständige Beschreibung (4000):

```
SuperStat · Handball
```

```
Handball-Statistik live: Würfe, Paraden und Wurfkarte des Spielfelds.
```

```
SuperStat ist das Statistikheft deiner Handballmannschaft. Du erfasst das Spiel,
während es läuft, mit dem Handy in der Hand, und beim Schlusspfiff ist die
Auswertung schon fertig.

WÄHREND DES SPIELS
• Beide Tore gezeichnet, deins und das des Gegners, in neun Zonen geteilt. Ein
  Tippen auf eine Zone ist ein Tor, zweimal Tippen eine Parade, und für daneben
  und für den Pfosten gibt es eigene Schaltflächen.
• Markiere mit dem Finger den genauen Punkt auf dem Feld, von dem geworfen
  wurde, auf einer maßstabsgetreuen Spielfeldhälfte. Wenn du schneller sein
  willst, lässt es sich abschalten.
• Spieluhr mit Pause und eine Schaltfläche, damit du selbst entscheidest, wann
  die erste Halbzeit endet: Jeder Eintrag behält seine Minute und seine
  Halbzeit, ohne vorauszusetzen, dass Halbzeiten dreißig Minuten dauern.
• Torwart auf dem Feld: wird einmal gefragt und bleibt dann stehen, damit auch
  die Gegentore einen Zuständigen haben und die Parade-Quote etwas bedeutet.
• Schnellerfassung für alles, was kein Wurf ist: Ballverluste, Ballgewinne,
  Zeitstrafen und Karten.
• Wer auf dem Feld steht, für das Plus/Minus jedes Spielers.
• Rückgängig, falls der Finger verrutscht.

NACH DEM SPIEL
• Ergebnis, Wurfquote und Tore nach Torzone.
• Verlauf des Spielstands mit der besten Serie.
• Torschützen, Paraden je Torwart und Plus/Minus je Spieler.
• Wurfkarte über dem Spielfeld, mit Filter nach Spieler und Halbzeit, dazu eine
  Heatmap.
• Von wo geworfen wird gegen in welchen Teil des Tors der Ball geht: die Zahl,
  mit der sich ein Torwart wirklich vorbereiten lässt.
• Das Spiel als CSV exportieren oder als Bild teilen.

DIE SAISON
Bilanz aus Siegen und Niederlagen, Torschützen, Torhüter, aus welchen Zonen ihr
am besten werft und das Plus/Minus insgesamt, über alle Spiele des Teams
zusammengezählt.

ES FUNKTIONIERT OHNE NETZ
Sporthallen haben kein Netz, also braucht die App auch keins: Sie öffnet und
erfasst genauso, und was offen bleibt, wird von allein hochgeladen, sobald das
Netz zurück ist. Schließt das Handy die App mitten im Spiel, bietet sie dir beim
nächsten Start an, da weiterzumachen, wo du aufgehört hast.

DEINE DATEN GEHÖREN DIR
Ein Konto, mit Google oder mit E-Mail und Passwort, und dieselben Daten auf dem
Handy und am Rechner. Ohne Werbung, ohne Analyse und ohne Tracking: Jedes Konto
sieht nur das Eigene. Du kannst jedes Spiel exportieren oder löschen, was du
willst, wann du willst.

Ein Team gratis, mit allem oben Genannten. Mit SuperStat Pro so viele, wie du
willst: eine Altersklasse pro Team, jedes mit eigenem Kader und eigener Saison.
Ohne Werbung und ohne In-App-Käufe.
```

</details>

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

**Sí, sigue siendo "No" aunque exista el plan Pro**, y no es una trampa: la
pregunta es si se compra *dentro de la aplicación*, y aquí no se compra nada
dentro. El cobro está en la web con Stripe, la app no lleva hasta él y no usa el
sistema de facturación de Play. Por eso tampoco hay que dar de alta ningún
producto en la consola. Si algún día se añadieran compras in-app, esta fila y el
cuestionario IARC habría que rehacerlos.

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
| ¿Permite comprar artículos digitales? | **No** — no se compra nada dentro de la app (ver arriba) |
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
