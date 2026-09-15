// Los avisos por correo: a quién se le puede escribir, qué se le dice y cómo se
// manda. Lo usan dos funciones (aviso-tope y stripe-webhook), y por eso vive
// aquí en vez de estar escrito dos veces.
//
// POR QUÉ HAY CORREOS.
//
// Dentro de la app de Android o iPhone no se puede vender ni decir dónde se
// compra: Apple y Google lo prohíben cuando el cobro no pasa por su sistema
// (ver puedeComprar() en js/app.js). Lo que sí está permitido es escribirle a
// tus propios usuarios fuera de la app, y eso es exactamente lo que es esto.
// Sin estos correos, quien use solo el móvil no se enteraría nunca de que
// existe un plan de pago.
//
// LOS TEXTOS NO SALEN DE js/i18n.js, y no es un despiste: aquel archivo es del
// navegador y aquí no llega. Es duplicación asumida —cuatro idiomas, dos
// avisos— y por eso están todos juntos en un solo sitio, para que se vean de un
// vistazo cuando haya que tocarlos.
//
// EL IDIOMA sale de avisos.lang, que la app va poniendo al día. El de la
// interfaz es del aparato y no de la cuenta (ver Store.setLang), así que desde
// el servidor no hay otra forma de saberlo. Si nunca se ha escrito, español.

const RESEND = 'https://api.resend.com/emails';

// Los idiomas que la app sabe hablar. La misma lista está en js/i18n.js, en el
// check de avisos.lang de schema.sql y en el filtro de aviso-tope: si se añade
// uno y se olvida cualquiera de las cuatro, el correo sale en español y nada
// falla.
export const IDIOMAS = ['es', 'en', 'fr', 'de'];

export type TipoAviso = 'tope' | 'prueba';

export interface Destinatario {
  email: string;
  lang: string;
  emailOk: boolean;
  bajaToken: string;
}

function web(): string {
  return Deno.env.get('SUPERSTAT_WEB') ?? 'https://super-stat.vercel.app';
}

function remite(): string {
  return Deno.env.get('RESEND_FROM') ?? 'SuperStat <hola@superstat.online>';
}

// La dirección para darse de baja. Va a la Edge Function `baja-avisos`, que es
// pública a propósito: un enlace de baja que exija iniciar sesión no es un
// enlace de baja.
function urlDeBaja(token: string): string {
  return `${Deno.env.get('SUPABASE_URL')}/functions/v1/baja-avisos?t=${token}`;
}

// ---------------------------------------------------------------- los textos

interface Texto { asunto: string; titulo: string; cuerpo: string; boton: string; baja: string; }

const TEXTOS: Record<TipoAviso, Record<string, Texto>> = {
  // Alguien ha chocado con un tope del plan gratis: el de equipos o el de
  // partidos guardados. El correo es el mismo para los dos a propósito —lo que
  // hay que contar es que existe Pro, no cuál de las dos puertas se ha cerrado—
  // y así es un texto por idioma y no dos, que con cuatro idiomas ya se nota.
  tope: {
    es: {
      asunto: 'Tu plan de SuperStat llega hasta aquí',
      titulo: 'Has llegado al límite del plan Gratis',
      cuerpo: 'El plan Gratis lleva un equipo y cinco partidos guardados, y acabas de ' +
              'llegar al tope. Con SuperStat Pro no hay límite ni de equipos ni de ' +
              'partidos, cada uno con su plantilla, su mapa de tiros y sus estadísticas. ' +
              'Los 7 primeros días son gratis y puedes cancelar cuando quieras.',
      boton: 'Ver SuperStat Pro',
      baja: 'Si no quieres recibir estos avisos, date de baja aquí.'
    },
    en: {
      asunto: 'Your SuperStat plan stops here',
      titulo: 'You have reached the Free plan limit',
      cuerpo: 'The Free plan covers one team and five saved matches, and you have just ' +
              'reached the limit. With SuperStat Pro there is no cap on teams or matches, ' +
              'each with its own roster, shot map and stats. The first 7 days are free and ' +
              'you can cancel any time.',
      boton: 'See SuperStat Pro',
      baja: 'If you would rather not get these emails, unsubscribe here.'
    },
    fr: {
      asunto: 'Ta formule SuperStat s’arrête ici',
      titulo: 'Tu as atteint la limite de la formule Gratuite',
      cuerpo: 'La formule Gratuite comprend une équipe et cinq matchs enregistrés, et tu ' +
              'viens d’atteindre la limite. Avec SuperStat Pro, il n’y a de limite ni sur ' +
              'les équipes ni sur les matchs, chacun avec son effectif, sa carte de tirs et ' +
              'ses statistiques. Les 7 premiers jours sont gratuits et tu peux annuler quand ' +
              'tu veux.',
      boton: 'Voir SuperStat Pro',
      baja: 'Si tu ne veux plus recevoir ces messages, désabonne-toi ici.'
    },
    de: {
      asunto: 'Dein SuperStat-Tarif reicht bis hierher',
      titulo: 'Du hast die Grenze des Gratis-Tarifs erreicht',
      cuerpo: 'Der Gratis-Tarif umfasst ein Team und fünf gespeicherte Spiele, und die ' +
              'Grenze hast du gerade erreicht. Mit SuperStat Pro gibt es weder bei Teams ' +
              'noch bei Spielen ein Limit, jedes mit eigenem Kader, eigener Wurfkarte und ' +
              'eigenen Statistiken. Die ersten 7 Tage sind gratis, und du kannst jederzeit ' +
              'kündigen.',
      boton: 'SuperStat Pro ansehen',
      baja: 'Wenn du diese Hinweise nicht mehr bekommen willst, melde dich hier ab.'
    }
  },
  // Stripe avisa tres días antes de que se acabe la prueba.
  prueba: {
    es: {
      asunto: 'Tu prueba de SuperStat Pro acaba pronto',
      titulo: 'Quedan unos días de prueba',
      cuerpo: 'Tu prueba de SuperStat Pro está a punto de terminar. Si no haces nada, ' +
              'la suscripción sigue y se cobra el primer recibo. Si prefieres no seguir, ' +
              'puedes cancelarla desde tu cuenta y no se te cobrará nada.',
      boton: 'Gestionar mi plan',
      baja: 'Si no quieres recibir estos avisos, date de baja aquí.'
    },
    en: {
      asunto: 'Your SuperStat Pro trial ends soon',
      titulo: 'A few days of trial left',
      cuerpo: 'Your SuperStat Pro trial is about to end. If you do nothing, the ' +
              'subscription continues and the first payment is taken. If you would rather ' +
              'not carry on, you can cancel from your account and nothing will be charged.',
      boton: 'Manage my plan',
      baja: 'If you would rather not get these emails, unsubscribe here.'
    },
    fr: {
      asunto: 'Ton essai de SuperStat Pro se termine bientôt',
      titulo: 'Il reste quelques jours d’essai',
      cuerpo: 'Ton essai de SuperStat Pro est sur le point de se terminer. Si tu ne fais ' +
              'rien, l’abonnement continue et la première échéance est prélevée. Si tu ' +
              'préfères ne pas continuer, tu peux l’annuler depuis ton compte et rien ne ' +
              'te sera facturé.',
      boton: 'Gérer ma formule',
      baja: 'Si tu ne veux plus recevoir ces messages, désabonne-toi ici.'
    },
    de: {
      asunto: 'Deine Testphase von SuperStat Pro endet bald',
      titulo: 'Es sind noch ein paar Testtage übrig',
      cuerpo: 'Deine Testphase von SuperStat Pro endet demnächst. Wenn du nichts tust, ' +
              'läuft das Abo weiter und die erste Rate wird abgebucht. Wenn du lieber ' +
              'nicht weitermachen möchtest, kannst du es in deinem Konto kündigen, und es ' +
              'wird dir nichts berechnet.',
      boton: 'Meinen Tarif verwalten',
      baja: 'Wenn du diese Hinweise nicht mehr bekommen willst, melde dich hier ab.'
    }
  }
};

function escapar(s: string): string {
  return s.replace(/[&<>"]/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string
  ));
}

// Sin imágenes ni fuentes de fuera: un correo que depende de que se descarguen
// cosas se ve roto en la mitad de los clientes, y además así no hay forma de
// saber quién lo ha abierto, que es lo que promete privacidad.html.
function html(t: Texto, baja: string): string {
  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#F5F5F7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#141619;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:18px;padding:28px;">
    <div style="font-size:13px;font-weight:700;letter-spacing:0.08em;color:#D9182B;">SUPERSTAT</div>
    <h1 style="font-size:21px;line-height:1.3;margin:14px 0 12px;">${escapar(t.titulo)}</h1>
    <p style="font-size:15px;line-height:1.6;margin:0 0 22px;color:#3C4149;">${escapar(t.cuerpo)}</p>
    <a href="${escapar(web())}" style="display:inline-block;background:#D9182B;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 22px;border-radius:12px;">${escapar(t.boton)}</a>
    <p style="font-size:12px;line-height:1.5;margin:26px 0 0;color:#8A8F98;">
      ${escapar(t.baja)} <a href="${escapar(baja)}" style="color:#8A8F98;">${escapar(baja)}</a>
    </p>
  </div>
</body></html>`;
}

function texto(t: Texto, baja: string): string {
  return `${t.titulo}\n\n${t.cuerpo}\n\n${t.boton}: ${web()}\n\n${t.baja}\n${baja}\n`;
}

// ------------------------------------------------------------- destinatario

// Quién es y si quiere que se le escriba. Devuelve null cuando no hay a quién
// escribir o cuando ha dicho que no: los dos casos se tratan igual arriba,
// porque en los dos la respuesta es no mandar nada.
export async function destinatario(
  admin: { auth: { admin: { getUserById: (id: string) => Promise<{ data: { user: { email?: string } | null } | null }> } }, from: (t: string) => any },
  uid: string
): Promise<Destinatario | null> {
  const { data: fila } = await admin
    .from('avisos')
    .select('email_ok,lang,baja_token')
    .eq('user_id', uid)
    .maybeSingle();

  // Sin fila no se escribe. La crea el trigger de schema.sql al dar de alta la
  // cuenta, así que no tenerla es una cuenta rarísima, no un caso normal.
  if (!fila || fila.email_ok === false) return null;

  const { data } = await admin.auth.admin.getUserById(uid);
  const email = data?.user?.email;
  if (!email) return null;

  return {
    email,
    // Un idioma que no conozcamos (una fila vieja, o uno que se quitó) cae al
    // español, que es el respaldo de todo el archivo.
    lang: IDIOMAS.includes(fila.lang) ? fila.lang : 'es',
    emailOk: true,
    bajaToken: fila.baja_token
  };
}

// ------------------------------------------------------------------ enviar

// Manda el aviso. No lanza nunca: que un correo no salga no puede tumbar ni el
// webhook de Stripe ni la pantalla de quien está usando la app. Devuelve si se
// mandó, para que quien llama decida si sellar la fecha.
export async function enviarAviso(
  admin: any,
  uid: string,
  tipo: TipoAviso
): Promise<boolean> {
  const clave = Deno.env.get('RESEND_API_KEY');
  if (!clave) {
    console.warn('sin RESEND_API_KEY: no se manda el aviso', tipo);
    return false;
  }
  try {
    const quien = await destinatario(admin, uid);
    if (!quien) return false;

    const t = TEXTOS[tipo][quien.lang] ?? TEXTOS[tipo].es;
    const baja = urlDeBaja(quien.bajaToken);

    const res = await fetch(RESEND, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${clave}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: remite(),
        to: [quien.email],
        subject: t.asunto,
        html: html(t, baja),
        text: texto(t, baja),
        // Para que el cliente de correo enseñe su propio botón de baja, que es
        // donde la gente lo busca de verdad.
        headers: {
          'List-Unsubscribe': `<${baja}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
        }
      })
    });
    if (!res.ok) {
      console.warn('Resend respondió ' + res.status, await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.warn('no se pudo mandar el aviso ' + tipo, e);
    return false;
  }
}
