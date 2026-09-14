// Borra la cuenta entera: las cinco tablas y la fila de auth.users.
//
// Por qué esto no lo hace la app: con la clave anon y RLS se pueden marcar las
// filas propias como borradas, pero no se puede tocar auth.users. Mientras esa
// fila siga viva, la cuenta existe —se puede volver a entrar con ella— y lo que
// promete privacidad.html no es cierto. Hace falta la clave de servicio, y esa
// no puede vivir en el navegador, así que vive aquí.
//
// Dos decisiones que conviene no deshacer:
//
//   1. **De quién es la cuenta lo dice el token, nunca el cuerpo de la
//      petición.** La clave anon la tiene cualquiera que abra la web; si el id
//      del usuario llegara como parámetro, cualquiera podría borrar la cuenta de
//      otro. Aquí se resuelve con auth.getUser(token) y se ignora todo lo demás.
//   2. **El borrado es físico, no lógico.** En la app los borrados son lógicos
//      (deleted_at) porque hay que distinguir "lo borré" de "aún no lo he
//      subido" al sincronizar varios dispositivos. Aquí no queda ningún
//      dispositivo con el que reconciliar: la cuenta desaparece.
//
// Se despliega aparte del esquema (ver docs/supabase.md):
//
//   supabase functions deploy borrar-cuenta
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// El orden importa: los hijos antes que los padres. Las claves ajenas de
// schema.sql tienen "on delete cascade", pero borrar en orden no depende de eso
// y deja claro qué se va.
const TABLAS = ['events', 'shots', 'matches', 'players', 'teams'];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' }
  });

Deno.serve(async (req) => {
  // El navegador pregunta antes de llamar desde otro origen.
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);

  const auth = req.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return json({ error: 'sin-sesion' }, 401);

  // SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY las pone Supabase en el entorno de
  // la función: no hay que declararlas ni subirlas a ninguna parte.
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: quien, error: errorSesion } = await admin.auth.getUser(token);
  if (errorSesion || !quien?.user) return json({ error: 'sesion-no-valida' }, 401);
  const uid = quien.user.id;

  const borradas: Record<string, number> = {};
  for (const tabla of TABLAS) {
    const { error, count } = await admin
      .from(tabla)
      .delete({ count: 'exact' })
      .eq('user_id', uid);
    if (error) return json({ error: 'no-se-pudo-borrar', tabla, detalle: error.message }, 500);
    borradas[tabla] = count ?? 0;
  }

  // Lo último: mientras la fila de auth.users viva, la cuenta existe. Si esto
  // falla, los datos ya no están y se puede reintentar sin estropear nada, que
  // es mejor reparto que quedarse con los datos y sin cuenta.
  const { error: errorUsuario } = await admin.auth.admin.deleteUser(uid);
  if (errorUsuario) return json({ error: 'no-se-pudo-borrar-el-usuario', detalle: errorUsuario.message }, 500);

  return json({ ok: true, borradas });
});
