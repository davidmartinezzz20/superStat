# Las dos cuentas de Instagram

Todo lo que hay que pegar en Instagram para abrir las dos cuentas de SuperStat,
la castellana y la inglesa: nombre, biografía, y las tres primeras
publicaciones de cada una con su pie y sus etiquetas. Las imágenes las genera
`tools/make-instagram-assets.js` y están en `instagram/`.

Es el hermano de [`play.md`](play.md): aquél tiene los textos de la ficha de la
tienda, éste los de las redes. Ninguno de los dos entra en el producto.

De X aquí solo está el nombre de la cuenta, en §1, porque es el que enlazan la
app y las portadas y tiene que estar escrito en algún sitio. Los textos que se
publican en X no están todavía en este archivo.

Aquí está **qué** se pega. **En qué orden** se hace todo —abrir las cuentas,
pasarlas a profesional, la biografía y las tres publicaciones— está en
[`publicar-instagram.md`](publicar-instagram.md).

Lo que sale del repositorio:

| Qué | Dónde |
|---|---|
| Foto de perfil, 1080×1080 | `instagram/perfil-1080.png` |
| Publicaciones en castellano | `instagram/es/` |
| Publicaciones en inglés | `instagram/en/` |
| Biografías, pies y etiquetas | este archivo |

Y se regenera con:

```bash
node tools/make-screenshots.js            # las ocho capturas en castellano
IDIOMA=en node tools/make-screenshots.js  # las mismas en inglés
node tools/make-instagram-assets.js       # el perfil y las publicaciones
```

Las capturas salen de la app de verdad con un partido inventado de semilla fija
(CB Sabadell contra CE Granollers) y sin tocar Supabase: **no hay forma de que
acabe publicándose el equipo de nadie**. Es lo mismo que se sube a Play.

---

## 1. Antes de abrir las cuentas: tres cosas que decidir

**La cuenta en inglés ya se puede abrir.** Lo que antes lo frenaba era que la
app estuviera en dos idiomas y todo lo demás en uno: quien hacía clic desde una
cuenta en inglés caía en una web en español. Eso ya no pasa. La app habla
castellano, inglés, francés y alemán; la web es la misma app, así que se abre en
el idioma del aparato (y `?lang=en` la fuerza); la política de privacidad tiene
su versión en cada idioma (`privacidad-en.html` y compañía); y la ficha de Play
tiene sus textos traducidos en [`play.md`](play.md), aunque darla de alta en
Play Console es un paso aparte.

Lo único que sigue siendo de un solo idioma es esta guía y los pies de las
publicaciones, que están más abajo en castellano y en inglés. Si algún día se
abren cuentas en francés o alemán, es aquí donde hay que escribir sus textos.

**Los nombres de usuario, que ya están cogidos por nosotros.** Estos tres son
los de las cuentas abiertas, no una lista de candidatos: cambiar uno obliga a
cambiarlo también donde se enlaza, que son los sitios de la tabla de abajo.

| Cuenta | Nombre de usuario |
|---|---|
| Instagram, castellano | `superstat.es` |
| Instagram, inglés | `superstat.en` |
| X | `superstatapp` |

**En X hay una sola cuenta** para todos los idiomas, y en Instagram dos. Del
francés y el alemán se encarga la inglesa: mientras no haya cuenta en esos
idiomas, todo lo que apunta al francés o al alemán apunta a `superstat.en`.

Dónde están escritas esas URL, que se mantienen a mano:

| Dónde | Qué |
|---|---|
| `SOCIAL` en `js/app.js` | los enlaces de la app, en Cuenta y en la entrada |
| El pie de las cuatro portadas (repositorio `webSuperStat`) | la cuenta del idioma de cada página |
| El `sameAs` del `application/ld+json` de esas cuatro | las tres cuentas, iguales en las cuatro |

El **nombre de perfil** (el que se puede cambiar cuando quieras, y que es lo que
busca la gente) sí es fijo: `SuperStat · Balonmano` y `SuperStat · Handball`.
Lleva la palabra del deporte a propósito, por lo mismo que el nombre en Play:
«SuperStat» solo no lo busca nadie.

**Cuenta profesional**, no personal: es lo que da las estadísticas de alcance y
el botón de contacto. Categoría *Aplicación móvil* (o *Deportes*) y correo de
contacto el mismo de la ficha de Play, `opt1a.david.martinez@gmail.com`.

---

## 2. La biografía

Instagram da **150 caracteres** y un solo enlace. Los saltos de línea se
escriben en el campo tal cual.

### Castellano

```
Estadísticas de balonmano, tiro a tiro.
Anota el partido desde la banda, sin cobertura.
Empieza gratis · Próximamente en Google Play
```

*(133 caracteres, saltos incluidos.)*

*«Empieza gratis» y no «Gratis» a secas: la app se usa gratis con un equipo y
cinco partidos guardados, y pasar de ahí es de pago. Aquí, que es una red social y no la ficha de la tienda ni
la app, sí se puede contar el plan Pro y enlazar al pago sin ningún problema —de
hecho es el sitio natural para hacerlo.*

### Inglés

```
Handball stats, shot by shot.
Log the match from the bench, no signal needed.
Start free · Coming soon to Google Play
```

*(117 caracteres.)*

### El enlace

```
https://super-stat.vercel.app
```

En las dos. Cuando la app esté publicada, aquí va el enlace de Google Play y de
«Próximamente» se quita la línea entera, no solo la palabra.

### La foto de perfil

`instagram/perfil-1080.png`. Es el cuadro rojo de la marca con las tres barras,
sin el wordmark: a tamaño de avatar el nombre no se lee, y el cuadro sí se
reconoce. Instagram lo recorta en círculo y las barras están encogidas para que
el recorte no las roce.

---

## 3. Las publicaciones

Tres por cuenta, pensadas para que las tres primeras que ve alguien que entra
cuenten la app entera: **qué es**, **qué tiene que no tienen otras** y **por qué
funciona donde se usa**.

Cada una es un carrusel: la primera imagen es la portada con el titular y las
siguientes son capturas. Se suben en el orden del nombre del archivo.

El **texto alternativo** de cada imagen va en los dos idiomas, el de cada
cuenta en el suyo. Instagram da **100 caracteres** por imagen y corta lo que
pase, así que los de aquí están todos dentro de ese tope: al retocarlos, hay que
seguir contando.

El titular va **dibujado dentro de la imagen** y sale de
`tools/make-instagram-assets.js`; si se cambia ahí, hay que cambiarlo aquí
también.

---

### Publicación 1 — cómo se anota

**Imágenes**: `instagram/es/1-un-toque/` · `instagram/en/1-one-tap/`

**Titular de la portada**

- ES: *Un toque, gol. Dos toques, parada.*
- EN: *One tap, goal. Two taps, save.*

**Pie, en castellano**

```
Anotar un partido de balonmano no puede costar más atención que mirarlo.

En SuperStat la portería está dibujada en nueve zonas: un toque en la zona es
gol, dos toques son parada, y hay botón aparte para fuera y para palo. Las dos
porterías a la vez, la tuya y la del rival.

El reloj corre en la misma pantalla y lo paras tú. Y el descanso lo marcas
cuando de verdad acaba la primera parte, que no siempre es en el minuto 30.

¿Qué es lo primero que anotarías tú?

#balonmano #handball #entrenadordebalonmano #balonmanoespañol #deportedeequipo
#estadisticas #handballtraining #cantera #balonmanobase
```

**Pie, en inglés**

```
Logging a handball match should not take more attention than watching it.

In SuperStat the goal is drawn in nine zones: one tap on a zone is a goal, two
taps is a save, and there are separate buttons for wide and for the post. Both
goals at once, yours and the rival's.

The clock runs on the same screen and you stop it yourself. And you mark half
time when the first half actually ends, which is not always minute 30.

What would be the first thing you'd log?

#handball #handballcoach #teamsport #sportsanalytics #handballtraining
#coachingtools #matchstats #grassrootssport
```

**Texto alternativo, en castellano**

- Portada: «Fondo negro con el logo de SuperStat y el texto "Un toque, gol. Dos
  toques, parada."»
- Captura: «Partido en curso: marcador 15-12, reloj en 25:58 y las dos porterías
  divididas en nueve zonas.»

**Texto alternativo, en inglés**

- Portada: «Black background with the SuperStat logo and the text "One tap,
  goal. Two taps, save."»
- Captura: «Match in progress: score 15-12, clock at 25:58 and both goals split
  into nine zones.»

---

### Publicación 2 — lo que no tienen las demás

**Imágenes**: `instagram/es/2-desde-donde/` · `instagram/en/2-where-from/`

**Titular de la portada**

- ES: *¿Desde dónde marcáis de verdad?*
- EN: *Where do you really score from?*

**Pie, en castellano**

```
«Desde el extremo no entra ninguna» es una sensación. Esto es un dato.

Cada vez que anotas un tiro, SuperStat te enseña media pista dibujada a escala
—área de 6, línea de 9, los 7 metros— y marcas con el dedo el punto exacto
desde el que se lanzó. Un toque más, y solo si quieres: el interruptor se apaga.

Al acabar el partido eso se convierte en el mapa de calor, en el acierto por
puesto (extremo izquierdo 12/14, 86%) y en el cruce que de verdad sirve para
preparar a un portero: desde dónde se lanza contra a qué parte de la portería
va el balón.

Guárdalo para el próximo partido.

#balonmano #handball #entrenadordebalonmano #porterodebalonmano #tactica
#estadisticas #handballgoalkeeper #analisisdeportivo #balonmanobase
```

**Pie, en inglés**

```
"We never score from the wing" is a feeling. This is data.

Every time you log a shot, SuperStat shows you a half-court drawn to scale —6 m
area, 9 m line, the 7 m spot— and you mark the exact point the shot came from
with your finger. One extra tap, and only if you want it: the toggle turns off.

At full time that becomes the heat map, the accuracy by position (left wing
12/14, 86%) and the cross that actually helps you prepare a keeper: where the
shot is taken from against which part of the goal the ball goes to.

Save this one for your next match.

#handball #handballcoach #handballgoalkeeper #sportsanalytics #tactics
#matchstats #coachingtools #grassrootssport
```

**Texto alternativo, en castellano**

- Portada: «Fondo negro con el texto "¿Desde dónde marcáis de verdad?"»
- Captura 1: «La app pregunta "¿Desde dónde ha lanzado?" sobre un dibujo a
  escala de media pista de balonmano.»
- Captura 2: «Mapa de calor de los lanzamientos sobre la media pista, con el
  acierto por puesto debajo.»

**Texto alternativo, en inglés**

- Portada: «Black background with the text "Where do you really score from?"»
- Captura 1: «The app asks "Where was the shot taken from?" over a half-court
  drawn to scale.»
- Captura 2: «Heat map of the shots over the half-court, with the accuracy by
  position below.»

---

### Publicación 3 — por qué funciona donde se usa

**Imágenes**: `instagram/es/3-sin-cobertura/` · `instagram/en/3-offline/`

**Titular de la portada**

- ES: *El pabellón no tiene cobertura. La app no la necesita.*
- EN: *The sports hall has no signal. The app does not need one.*

**Pie, en castellano**

```
Un pabellón municipal, en la banda, con el móvil en la mano y sin una raya de
cobertura. Ese es el sitio donde esta app tiene que funcionar, y por eso no
necesita red para nada.

Se abre sin conexión, anotas el partido entero y lo pendiente se sube solo
cuando vuelves a tener señal. Si el móvil cierra la app a mitad de partido, al
volver a entrar te ofrece seguir donde lo dejaste.

Al pitido final la ficha ya está hecha: resultado, efectividad, goleadores,
paradas por portero y más/menos. Y la temporada se va sumando sola, partido a
partido.

Sin publicidad, sin seguimiento, y cada cuenta solo ve lo suyo.

#balonmano #handball #entrenadordebalonmano #pabellon #deportedeequipo
#estadisticas #appdeportiva #balonmanobase #cantera
```

**Pie, en inglés**

```
A municipal sports hall, on the bench, phone in hand and not one bar of signal.
That is where this app has to work, which is why it needs no network at all.

It opens offline, you log the whole match, and whatever is pending uploads
itself once you are back in range. If your phone drops the app mid-match, it
offers to pick up where you left off.

At full time the report is already done: result, efficiency, scorers, saves per
keeper and plus/minus. And the season adds itself up, match after match.

No ads, no tracking, and every account only sees its own data.

#handball #handballcoach #offlinefirst #teamsport #sportsapp #matchstats
#coachingtools #grassrootssport
```

**Texto alternativo, en castellano**

- Portada: «Fondo negro con el texto "El pabellón no tiene cobertura. La app no
  la necesita."»
- Captura 1: «Ficha de un partido terminado: 29-25, con la evolución del
  marcador y la mejor racha.»
- Captura 2: «Acumulado de la temporada: 2 victorias, 0 empates, 1 derrota, con
  los goles a favor y en contra.»

**Texto alternativo, en inglés**

- Portada: «Black background with the text "The sports hall has no signal. The
  app does not need one."»
- Captura 1: «Report of a finished match: 29-25, with the score evolution and
  the best run.»
- Captura 2: «Season totals: 2 wins, 0 draws, 1 loss, with the goals for and
  against.»

---

## 4. Sobre las etiquetas

Van al final del pie y no en un comentario aparte: Instagram las cuenta igual y
así no hay un comentario que borrar si se editan. Son entre ocho y diez, no
treinta: mezclar el nicho (`#entrenadordebalonmano`, `#handballgoalkeeper`) con
lo genérico (`#deportedeequipo`) llega más lejos que llenar de etiquetas
grandes donde la publicación se pierde en un minuto.

Las de cada cuenta están en su idioma. `#balonmano` y `#handball` son mundos
distintos en Instagram, y mezclarlas no suma: aparece en las dos y no encaja en
ninguna.

---

## 5. Lo que estos textos prometen, y conviene que siga siendo verdad

- **Empieza gratis**: la app se usa gratis con un equipo y cinco partidos
  guardados, y el plan Pro quita los dos límites. Aquí sí se puede hablar del precio y enlazar al pago: las reglas de
  Apple y Google sobre llevar a comprar fuera valen dentro de la app y en la
  ficha de la tienda, no en tus redes ni en tu web. Es más: como la app **no
  puede** decir que existe Pro, Instagram y el correo son por donde se entera la
  gente (ver `suscripcion.md`).
- **Sin publicidad ni seguimiento**: lo dice `privacidad.html` y lo respalda que
  la app no pida ni un permiso de Android para nada de eso.
- **Cada cuenta solo ve lo suyo**: hoy es cierto porque RLS es
  `user_id = auth.uid()` en las cinco tablas. Si algún día se comparte un equipo
  con el cuerpo técnico —la idea pendiente de `CLAUDE.md`— esta frase hay que
  cambiarla en los tres pies, y también en la ficha de Play.
- **Próximamente en Google Play**: mientras no esté publicada. Una cuenta que
  lleva meses diciendo «próximamente» hace más daño que no decir nada.
