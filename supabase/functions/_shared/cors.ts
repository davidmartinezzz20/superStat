// Quién puede llamar a las funciones desde un navegador.
//
// Las tres funciones que llama la app (`borrar-cuenta`, `pago` y `aviso-tope`)
// respondían con `Access-Control-Allow-Origin: *`. No era un agujero —las tres
// exigen el Bearer de la sesión, y el navegador no lo manda solo a nadie—, pero
// tampoco hacía falta: quien tiene que poder llamarlas es la web de SuperStat y
// la app, y nadie más. Con la lista puesta, una página cualquiera que consiga
// un token no puede además usarlo desde el navegador de su víctima.
//
// QUIÉN ENTRA, POR ORDEN:
//   - `SUPERSTAT_WEB`, la dirección de la web. Es la misma variable que ya usan
//     los correos y las vueltas de Stripe, así que no hay una segunda verdad.
//   - Los orígenes de la app de móvil. Dentro de Capacitor la página se sirve
//     desde el propio aparato: `capacitor://localhost` en iPhone y
//     `https://localhost` en Android (las versiones viejas, `http://localhost`).
//   - `http://localhost:5173`, que es con lo que se sirve el repo en local
//     (`npm start`).
//   - Lo que se añada a mano en `SUPERSTAT_ORIGENES`, separado por comas. Es por
//     donde entran los previews de Vercel, que cambian de dirección en cada
//     rama. Sin esto, un preview no podría abrir el pago ni borrar la cuenta.
//
// SI UN ORIGEN NO ESTÁ, la respuesta va **sin** cabecera de CORS: el navegador
// la descarta y a la app le llega "Failed to send a request to the Edge
// Function", que es el mismo error que si la función no estuviera desplegada.
// Para que eso no cueste una tarde, se deja dicho en el registro qué origen se
// ha rechazado.
//
// Una petición **sin** cabecera Origin (curl, un servidor, la propia consola de
// Supabase) no lleva CORS y no la necesita: CORS es cosa de navegadores. Lo que
// de verdad decide si se hace algo o no sigue siendo el token.

function web(): string {
  return Deno.env.get('SUPERSTAT_WEB') ?? 'https://super-stat.vercel.app';
}

function permitidos(): string[] {
  const extra = (Deno.env.get('SUPERSTAT_ORIGENES') ?? '')
    .split(',').map((s) => s.trim()).filter(Boolean);
  return [
    web().replace(/\/+$/, ''),
    'capacitor://localhost',
    'https://localhost',
    'http://localhost',
    'http://localhost:5173',
    ...extra
  ];
}

// Las cabeceras de CORS para esta petición. `Vary: Origin` es obligatorio en
// cuanto la respuesta depende del origen: sin él, una caché por medio podría
// servirle a un origen la respuesta que se calculó para otro.
export function cors(req: Request): Record<string, string> {
  const base: Record<string, string> = {
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '3600'
  };
  const origen = req.headers.get('Origin');
  if (!origen) return base;                 // no es un navegador: no hace falta
  if (permitidos().includes(origen)) {
    return { ...base, 'Access-Control-Allow-Origin': origen };
  }
  console.warn('origen no permitido: ' + origen +
               ' (añádelo a SUPERSTAT_ORIGENES si es tuyo)');
  return base;
}

// La respuesta JSON de siempre, con CORS y sin caché. `no-store` porque todo lo
// que devuelven estas funciones es de una persona concreta: una dirección de
// pago, lo que se ha borrado de su cuenta. Nada de eso puede quedarse guardado
// en un intermediario.
export function json(req: Request, cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: {
      ...cors(req),
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
}

// La respuesta al preflight. Va sin cuerpo (204) porque no lo lleva nadie.
export function preflight(req: Request): Response {
  return new Response(null, { status: 204, headers: cors(req) });
}
