# Abrir las dos cuentas de Instagram, de principio a fin

[`instagram.md`](instagram.md) está ordenado por tema: dice **qué** se pega —los
nombres, las biografías, los pies y las etiquetas—. Éste va por orden de
ejecución: **cuándo** se pega cada cosa, qué depende de un paso anterior y qué no
se puede hacer todavía.

Es la misma pareja que forman [`play.md`](play.md) y
[`publicar-android.md`](publicar-android.md), y por el mismo motivo: un documento
donde buscar un texto no sirve para ir haciendo, y una lista de pasos que además
repita los textos acaba teniendo dos versiones de cada uno. Aquí no hay ni una
biografía ni un pie escrito; lo que hay es en qué momento ir a buscarlos.

**Lo que ya está resuelto en el repositorio** y no hay que preparar: la foto de
perfil, las tres portadas y las capturas enmarcadas de las dos cuentas
(`instagram/`, 17 imágenes), y todos los textos (`instagram.md`). Todo lo que
queda es de fuera del repositorio: un segundo correo, Instagram y un rato.

Esta guía abre **las dos cuentas a la vez**, la castellana y la inglesa.
`instagram.md` §1 aconseja abrir primero la castellana y dejar la inglesa para
cuando la web tenga su versión —una cuenta en inglés que lleva a una web en
español pierde a quien haga clic—, y ese aviso sigue siendo verdad. Si al final
prefieres hacerlo así, esta guía vale igual: haz los bloques 1 a 6 con la
columna castellana y vuelve a ellos con la inglesa el día que toque.

---

## 0. El mapa, para saber dónde estás

| Bloque | Dónde se hace | Cuánto lleva |
|---|---|---|
| 1. Lo que hay que tener antes | tu correo y tu ordenador | minutos, pero hay algo que decidir |
| 2. Abrir las dos cuentas | `instagram.com` | minutos, si el usuario está libre |
| 3. Pasarlas a profesional | la app del móvil | minutos |
| 4. Foto, biografía y enlace | `instagram.com` | minutos |
| 5. Las tres publicaciones | `instagram.com` | **tres días**, una al día |
| 6. La comprobación final | las dos cuentas | minutos |
| 7. Cuando la app se publique en Play | `instagram.com` | minutos, pero es más adelante |

El bloque 5 es el único que no se puede acelerar, y no por Instagram sino por
prudencia: está explicado allí.

---

## 1. Lo que hay que tener antes de tocar Instagram

### Dos correos distintos

Cada cuenta de Instagram necesita **su propio correo o su propio teléfono** para
entrar. Las dos no pueden abrirse con `opt1a.david.martinez@gmail.com`: la
segunda rebota en el registro, y enterarse a mitad es el momento más incómodo
para tener que ir a crear un correo.

Decide el segundo antes de empezar. Vale cualquier dirección que puedas abrir,
porque Instagram manda un código de confirmación.

Que quede claro qué es cada cosa, porque se parecen y no son lo mismo:

| Correo | Cuál es | ¿Puede repetirse? |
|---|---|---|
| El de acceso | con el que entras en la cuenta | **No.** Uno por cuenta |
| El de contacto del perfil | el del botón *Correo electrónico* del perfil profesional | Sí. El mismo en las dos, el de la ficha de Play (`instagram.md` §1) |

### El enlace de la biografía tiene que abrir

La biografía lleva un enlace, y es el mismo en las dos cuentas:

```
https://super-stat.vercel.app
```

**Ábrelo en una ventana de incógnito antes de pegarlo.** Depende del bloque 2 de
[`publicar-android.md`](publicar-android.md), el de la web publicada en Vercel; si
eso todavía no está desplegado, este bloque no se puede terminar. Una cuenta
recién abierta cuyo único enlace da 404 es peor que una cuenta sin enlace.

### Se publica desde el ordenador, no desde el móvil

Las 17 imágenes están en `instagram/`, en la máquina donde tienes el repositorio,
y `instagram.com` deja subir carruseles desde el navegador. Así que **no hay que
pasarse nada al teléfono**: ni las tres portadas, ni las capturas, ni la foto de
perfil.

Abrir las cuentas también se puede desde el navegador. Del móvil solo hace falta
el bloque 3.

---

## 2. Abrir las dos cuentas

Los **nombres de usuario** van por orden de preferencia y el **nombre de perfil**
es fijo: están los dos en `instagram.md` §1 y no se repiten aquí.

El nombre de usuario se prueba en el propio registro: si está cogido, Instagram
lo dice ahí mismo. Baja por la lista de alternativas hasta que uno esté libre y
apunta cuál ha quedado, porque a partir del bloque 4 aparece en sitios.

El nombre de perfil no tiene ese problema: no es único, se puede cambiar cuando
quieras y es lo que busca la gente. Ése se pone tal cual está escrito.

Cuando tengas las dos, en la app del móvil se añaden las dos a la vez con
*Añadir cuenta* y se cambia de una a otra tocando la foto de perfil. No hay que
cerrar sesión cada vez.

---

## 3. Pasarlas a profesional

*Configuración* → *Tipo de cuenta y herramientas* → *Cambiar a cuenta
profesional*. Está en la app del móvil, que es donde no falla.

Profesional y no personal porque es lo que da las estadísticas de alcance y el
botón de contacto del perfil. La categoría y el correo de contacto, en
`instagram.md` §1.

Instagram ofrecerá enlazar una Página de Facebook. **No hace falta**: la cuenta
profesional funciona sin ella, y la Página sólo sirve si algún día se hace
publicidad de pago.

---

## 4. Foto, biografía y enlace

Desde `instagram.com`, *Editar perfil*.

- **Foto**: `instagram/perfil-1080.png`. Es la misma en las dos cuentas. Es el
  cuadro rojo de la marca sin el wordmark, porque a tamaño de avatar el nombre no
  se lee; Instagram lo recorta en círculo y las barras ya están encogidas para
  que el recorte no las roce.
- **Biografía**: `instagram.md` §2, la castellana en una cuenta y la inglesa en
  la otra. **Pégala desde el navegador, no desde la app del móvil**: lleva tres
  renglones y es en la app donde los saltos de línea se pierden y todo queda
  seguido.
- **Enlace**: el del bloque 1, el mismo en las dos.

---

## 5. Las tres publicaciones

Cada publicación es un **carrusel**: la primera imagen es la portada con el
titular y las demás son capturas de la app enmarcadas. Se suben en el orden del
nombre del archivo, que para eso van numeradas.

| # | Imágenes en castellano | Imágenes en inglés | Pie, etiquetas y texto alternativo |
|---|---|---|---|
| 1 | `instagram/es/1-un-toque/` | `instagram/en/1-one-tap/` | `instagram.md` §3, publicación 1 |
| 2 | `instagram/es/2-desde-donde/` | `instagram/en/2-where-from/` | `instagram.md` §3, publicación 2 |
| 3 | `instagram/es/3-sin-cobertura/` | `instagram/en/3-offline/` | `instagram.md` §3, publicación 3 |

El pie se pega entero, **con las etiquetas dentro**: van al final del texto y no
en un comentario aparte, por lo que explica `instagram.md` §4.

El **texto alternativo** se pone al publicar, en *Configuración avanzada* →
*Escribir texto alternativo*, y hay uno por imagen. Instagram da **100
caracteres** y corta lo que pase; los de `instagram.md` §3 ya están dentro del
límite, en los dos idiomas.

### No las subas las tres seguidas

Una cuenta abierta hace diez minutos que publica tres carruseles del tirón es,
vista desde fuera, exactamente una cuenta de spam. **Una publicación al día**, o
al menos unas horas entre una y otra.

Además hay un motivo que no es defensivo: las tres están pensadas para que quien
entra en el perfil vea de un vistazo qué es la app, qué tiene que no tienen otras
y por qué funciona donde se usa. Eso lo hacen igual de bien tres días seguidos, y
mientras tanto la cuenta parece viva.

### Una cosa que aquí sí se puede decir

Dentro de la app de Android o iPhone no puede haber ni botón, ni precio, ni la
palabra Stripe (lo decide `puedeComprar()` y lo vigila `test/nativo.js`). En
Instagram **sí**: las reglas de Apple y Google sobre llevar a comprar fuera valen
dentro de la app y en la ficha de la tienda, no en tus redes. De hecho, como la
app no puede contarlo, Instagram y el correo son por donde se entera la gente de
que existe el plan Pro (`instagram.md` §5 y [`suscripcion.md`](suscripcion.md)).

---

## 6. La comprobación final

En las dos cuentas, mirando el perfil como lo ve alguien de fuera (sin sesión, o
en incógnito):

- [ ] La foto se ve como un círculo rojo con las tres barras dentro, sin nada
      rozando el borde.
- [ ] La biografía sale en tres renglones y no en uno solo.
- [ ] El enlace abre la web, y no da 404.
- [ ] El botón de contacto aparece (si no, la cuenta no llegó a ser profesional:
      bloque 3).
- [ ] Las tres publicaciones están en el orden 1, 2, 3 y cada carrusel empieza
      por su portada.
- [ ] Deslizando un carrusel entero, ninguna captura sale cortada.
- [ ] Las etiquetas de cada pie están en el idioma de su cuenta: `#balonmano` y
      `#handball` son mundos distintos y mezclarlos no suma (`instagram.md` §4).

---

## 7. Cuando la app se publique en Play

Las dos biografías terminan en «Próximamente en Google Play» / «Coming soon to
Google Play». El día que la app esté publicada hay que volver aquí:

- [ ] Quitar esa línea **entera** de las dos biografías, no sólo la palabra
      «próximamente».
- [ ] Cambiar el enlace de las dos por el de la ficha de Google Play.

Una cuenta que lleva meses diciendo «próximamente» hace más daño que no decir
nada. Está apuntado también en la §11 de [`publicar-android.md`](publicar-android.md),
que es el sitio por donde se pasa ese día.

Y si algún día se comparte un equipo con el cuerpo técnico —la idea pendiente de
`CLAUDE.md`—, la frase «cada cuenta solo ve lo suyo» del tercer pie deja de ser
verdad y hay que cambiarla en las dos cuentas y en la ficha de Play
(`instagram.md` §5).

---

## Si algo sale mal

| Lo que pasa | Casi siempre es |
|---|---|
| El nombre de usuario está cogido | Normal: baja por las alternativas de `instagram.md` §1 (bloque 2) |
| El segundo registro rebota | Estás usando el correo de la primera cuenta. Cada una necesita el suyo (bloque 1) |
| La biografía sale en un solo renglón | Se pegó desde la app del móvil. Vuelve a pegarla desde `instagram.com` (bloque 4) |
| El texto alternativo aparece cortado | Se pasa de 100 caracteres. Los de `instagram.md` §3 ya están dentro |
| No hay botón de contacto en el perfil | La cuenta sigue siendo personal (bloque 3) |
| El enlace de la biografía da 404 | Vercel no ha desplegado todavía el `main` actual (bloque 2 de `publicar-android.md`) |
| Las imágenes se ven borrosas | Se subieron desde el móvil después de pasarlas por una app de mensajería, que las recomprime. Súbelas desde `instagram.com`, del repositorio (bloque 1) |

Y si hay que rehacer las imágenes por lo que sea, se regeneran con los tres
comandos que están al principio de [`instagram.md`](instagram.md). Hacen falta
los tres y en ese orden: las capturas salen de la app de verdad, y el generador
de las publicaciones las va a buscar a `play/`.
