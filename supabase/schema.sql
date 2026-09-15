-- SuperStat — esquema de la base de datos
--
-- Pégalo entero en Supabase → SQL Editor → New query → Run.
-- Se puede volver a ejecutar sin romper nada: todo es "if not exists".
--
-- Dos marcas de tiempo por fila, y no son lo mismo:
--   updated_at  la pone el navegador con la hora en que se hizo el cambio.
--               Es la que decide quién gana si el móvil y el ordenador tocan
--               lo mismo. Tiene que ser la del cliente para que un cambio
--               hecho sin conexión conserve el momento real en que ocurrió.
--   server_at   la pone la base de datos en cada escritura. Es por la que se
--               piden los cambios nuevos al sincronizar, para que un reloj
--               desajustado en un móvil no haga que se pierdan filas.

-- ---------------------------------------------------------------- utilidades

create or replace function public.touch_server_at()
returns trigger
language plpgsql
as $$
begin
  new.server_at = now();
  return new;
end;
$$;

-- -------------------------------------------------------------------- tablas

create table if not exists public.teams (
  id          uuid primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null check (length(btrim(name)) between 1 and 80),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  server_at   timestamptz not null default now()
);

create table if not exists public.players (
  id          uuid primary key,
  team_id     uuid not null references public.teams(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null check (length(btrim(name)) between 1 and 80),
  dorsal      smallint not null check (dorsal between 0 and 99),
  position    text not null,
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  server_at   timestamptz not null default now()
);

create table if not exists public.matches (
  id          uuid primary key,
  team_id     uuid not null references public.teams(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  rival       text not null check (length(btrim(rival)) between 1 and 80),
  played_on   date not null,
  out_own     integer not null default 0 check (out_own >= 0),
  out_rival   integer not null default 0 check (out_rival >= 0),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  server_at   timestamptz not null default now()
);

-- Un tiro por fila. side dice a qué portería fue:
--   own   = tiró el rival a nuestra portería (gol = encajado)
--   rival = tiramos nosotros a la suya       (gol = anotado)
-- origin_x / origin_y son el punto de la pista en metros, nulos si no se
-- registró. ordinal mantiene el orden en que se anotaron dentro del partido.
create table if not exists public.shots (
  id          uuid primary key,
  match_id    uuid not null references public.matches(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  side        text not null check (side in ('own','rival')),
  zone        smallint check (zone between 1 and 9),
  result      text not null,
  player_id   uuid references public.players(id) on delete set null,
  origin_x    numeric(5,2) check (origin_x between 0 and 20),
  origin_y    numeric(5,2) check (origin_y between 0 and 15),
  ordinal     integer not null default 0,
  updated_at  timestamptz not null default now(),
  server_at   timestamptz not null default now()
);

-- Todo lo que pasa en un partido y no es un tiro: asistencias, pérdidas,
-- exclusiones, tarjetas y las altas y bajas de la pista. Va en su propia tabla
-- y no como columnas de shots porque son cosas distintas y porque así añadir un
-- tipo nuevo no obliga a tocar nada más.
--
-- 'in' y 'out' son quién entra y quién sale: replicando esa secuencia se sabe
-- quién estaba en pista en cada momento, que es de donde sale el más/menos.
--
-- ordinal es el mismo contador que el de shots dentro de un partido: los dos se
-- reparten una única secuencia, así que ordenando tiros y eventos por ordinal
-- se recupera el partido tal y como se anotó.
create table if not exists public.events (
  id          uuid primary key,
  match_id    uuid not null references public.matches(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  type        text not null,
  player_id   uuid references public.players(id) on delete set null,
  minute      smallint check (minute between 0 and 200),
  period      smallint check (period between 1 and 2),
  ordinal     integer not null default 0,
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  server_at   timestamptz not null default now()
);

-- ------------------------------------------------------------------ el plan
--
-- Las dos tablas de abajo son distintas de las cinco de arriba y conviene tener
-- clara la diferencia: **no se sincronizan**. No llevan server_at, no están en
-- DB.TABLES (js/db.js) y el navegador no las sube nunca. La app las lee y ya.
--
-- El motivo es la cola de sincronización: push() hace upsert de todas las
-- tablas de esa lista, RLS rechazaría la escritura y el error dejaría la cola
-- atascada para siempre, con los partidos sin subir dentro. Si alguna vez
-- alguien las añade a esa lista, eso es lo que pasará.

-- Quién tiene Pro y hasta cuándo. La escribe **solo** la clave de servicio,
-- desde el webhook de Stripe (supabase/functions/stripe-webhook). Esa es toda
-- la seguridad del asunto: la clave anon la tiene cualquiera que abra la web,
-- así que si el usuario pudiera escribir aquí, el Pro sería gratis.
--
-- pro_until es una fecha y no un booleano a propósito. Un móvil que pase
-- semanas sin cobertura caduca la suscripción él solo cuando toca, sin lógica
-- de gracia y sin poder quedarse Pro para siempre. Y la prueba gratuita no
-- necesita nada aparte: una suscripción en periodo de prueba ya trae su fecha
-- de fin a siete días vista, así que es Pro normal y corriente.
create table if not exists public.subscriptions (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  pro_until          timestamptz,   -- null = nunca ha sido Pro
  status             text,          -- trialing | active | past_due | canceled
  stripe_customer_id text unique,
  -- Fecha del evento que se aplicó. Los webhooks se reintentan y llegan
  -- desordenados: sin esto, un 'trialing' reintentado puede pisar al 'active'
  -- que vino después y dejar a un usuario que paga con la fecha de la prueba.
  event_at           timestamptz,
  updated_at         timestamptz not null default now()
);

-- Preferencias de correo. Va en su propia tabla y no como columnas de
-- subscriptions porque quien nunca ha pagado no tiene fila allí, y es justo a
-- quien hay que avisar de que existe el plan Pro.
--
-- lang es una **copia para los correos**, no la preferencia de interfaz. El
-- idioma de la app es del aparato y no de la cuenta (ver Store.setLang), así
-- que el servidor no sabría en qué idioma escribir; esto se lo dice.
create table if not exists public.avisos (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  email_ok        boolean not null default true,
  lang            text not null default 'es' check (lang in ('es','en')),
  tope_avisado_at timestamptz,   -- para no mandar el mismo aviso cada semana
  baja_token      uuid not null default gen_random_uuid(),
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------- migraciones
--
-- Para una base que ya existe de una versión anterior. Todo es "if exists" /
-- "if not exists", así que se puede volver a ejecutar el archivo entero sin
-- romper nada y sin tocar los datos que ya hay.

-- El minuto y la parte de cada tiro. Nulos en los partidos de antes: entonces
-- no se registraba el tiempo y no hay forma de inventárselo.
alter table public.shots add column if not exists minute        smallint;
alter table public.shots add column if not exists period        smallint;
-- El portero nuestro que estaba en pista cuando llegó el tiro (solo side='own').
-- Antes solo se guardaba en player_id y solo en las paradas, así que el
-- porcentaje de paradas por portero no se podía calcular: faltaban los goles.
alter table public.shots add column if not exists goalkeeper_id uuid references public.players(id) on delete set null;
-- Los tiros ya se pueden borrar de uno en uno al corregir un partido guardado.
alter table public.shots add column if not exists deleted_at    timestamptz;

alter table public.shots drop constraint if exists shots_minute_check;
alter table public.shots add  constraint shots_minute_check check (minute between 0 and 200);
alter table public.shots drop constraint if exists shots_period_check;
alter table public.shots add  constraint shots_period_check check (period between 1 and 2);

-- 'out' (fuera) y 'post' (palo) eran un contador en matches y ahora son tiros,
-- para que también lleven minuto, jugador y punto de lanzamiento. Un tiro fuera
-- no tiene zona de portería, así que zone deja de ser obligatoria.
alter table public.shots alter column zone drop not null;
alter table public.shots drop constraint if exists shots_result_check;
alter table public.shots add  constraint shots_result_check check (result in ('goal','save','out','post'));
-- Una zona de portería es obligatoria justo cuando el tiro fue a puerta.
alter table public.shots drop constraint if exists shots_zone_result_check;
alter table public.shots add  constraint shots_zone_result_check
  check ((result in ('goal','save')) = (zone is not null));

-- El minuto en el que el usuario dio por terminada la primera parte. Lo elige
-- él durante el partido, así que no se puede dar por hecho que sean 30 minutos.
alter table public.matches add column if not exists half_time_minute smallint;
alter table public.matches drop constraint if exists matches_half_time_check;
alter table public.matches add  constraint matches_half_time_check
  check (half_time_minute between 0 and 200);

-- La lista es más larga que los botones que enseña la app: el panel de registro
-- rápido es una decisión de pantalla y puede cambiar, pero lo que ya se anotó
-- con un tipo tiene que seguir entrando y leyéndose, también desde un
-- dispositivo con otra versión de la app.
alter table public.events drop constraint if exists events_type_check;
alter table public.events add  constraint events_type_check check (type in (
  'turnover',   -- pérdida
  'steal',      -- robo
  'exclusion',  -- 2 minutos
  'yellow',     -- tarjeta amarilla
  'red',        -- tarjeta roja
  'assist',     -- asistencia
  'block',      -- blocaje
  'foul7m',     -- 7 metros provocado
  'in',         -- entra a pista
  'out'         -- sale de pista
));

-- ------------------------------------------------- purga de lo borrado
--
-- La política de privacidad promete que un registro borrado "se elimina de
-- forma definitiva como máximo a los 90 días". Esto es lo que lo cumple.
--
-- Borrar en la app es marcar deleted_at, nunca quitar la fila: con un borrado
-- físico inmediato, al fusionar no se distingue "lo borré" de "aún no lo he
-- subido" y lo borrado reaparece en el siguiente dispositivo que sincronice.
-- Los 90 días son el plazo tras el cual ya no queda ningún dispositivo que
-- pueda resucitarla, y entonces sí se quita de verdad.
--
-- Sobre el cursor de pull(): los clientes piden los cambios por server_at, y
-- una fila que se esfuma no genera ningún cambio que traer. No hace falta que
-- lo genere: para cuando desaparece, todo dispositivo que la conocía ya la
-- tiene marcada como borrada en su espejo local, y a uno que no la conocía no
-- le falta nada. Lo que sí importa es no adelantar el plazo.

create or replace function public.purgar_borrados(dias integer default 90)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  corte timestamptz := now() - make_interval(days => dias);
  total integer := 0;
  n     integer;
begin
  -- De dentro hacia fuera. Por las claves ajenas daría igual el orden (borrar un
  -- partido se lleva por delante sus tiros con "on delete cascade"), pero así el
  -- recuento que se devuelve cuenta cada fila una sola vez.
  delete from public.shots   where deleted_at < corte;
  get diagnostics n = row_count;  total := total + n;
  delete from public.events  where deleted_at < corte;
  get diagnostics n = row_count;  total := total + n;
  delete from public.matches where deleted_at < corte;
  get diagnostics n = row_count;  total := total + n;
  delete from public.players where deleted_at < corte;
  get diagnostics n = row_count;  total := total + n;
  delete from public.teams   where deleted_at < corte;
  get diagnostics n = row_count;  total := total + n;
  return total;
end;
$$;

-- Es "security definer" para poder correr desde el planificador, que no actúa
-- como ningún usuario de la app. Por eso mismo no se le da a nadie más: si
-- pudiera llamarla un cliente con la clave anon, cualquiera podría forzar el
-- borrado definitivo antes de tiempo.
revoke all on function public.purgar_borrados(integer) from public;
revoke all on function public.purgar_borrados(integer) from anon, authenticated;

-- pg_cron es una extensión de Supabase y puede no estar activada. Si no se deja
-- activar desde aquí, se activa en Supabase → Database → Extensions y se
-- vuelve a ejecutar este archivo; mientras tanto no se rompe nada.
do $$
begin
  create extension if not exists pg_cron;
exception when others then
  raise notice 'pg_cron no se pudo activar (%). Actívalo en Supabase → Database → Extensions y vuelve a ejecutar este archivo.', sqlerrm;
end;
$$;

-- cron.schedule con el mismo nombre actualiza el trabajo en vez de crear otro,
-- así que este archivo se puede volver a ejecutar sin acumular planificaciones.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('superstat-purga-borrados', '30 3 * * *',
                          'select public.purgar_borrados(90)');
  else
    raise notice 'Sin pg_cron no hay purga programada: los borrados se quedan en la base.';
  end if;
end;
$$;

-- ------------------------------------------------------------------- índices

-- (user_id, server_at) es el índice que usa la sincronización para pedir
-- "dame lo que ha cambiado desde la última vez".
create index if not exists teams_sync_idx   on public.teams   (user_id, server_at);
create index if not exists players_sync_idx on public.players (user_id, server_at);
create index if not exists matches_sync_idx on public.matches (user_id, server_at);
create index if not exists shots_sync_idx   on public.shots   (user_id, server_at);
create index if not exists events_sync_idx  on public.events  (user_id, server_at);

create index if not exists players_team_idx on public.players (team_id);
create index if not exists matches_team_idx on public.matches (team_id);
create index if not exists shots_match_idx  on public.shots   (match_id);
create index if not exists events_match_idx on public.events  (match_id);

-- ------------------------------------------------------------------ triggers

drop trigger if exists teams_server_at   on public.teams;
drop trigger if exists players_server_at on public.players;
drop trigger if exists matches_server_at on public.matches;
drop trigger if exists shots_server_at   on public.shots;
drop trigger if exists events_server_at  on public.events;

create trigger teams_server_at   before insert or update on public.teams
  for each row execute function public.touch_server_at();
create trigger players_server_at before insert or update on public.players
  for each row execute function public.touch_server_at();
create trigger matches_server_at before insert or update on public.matches
  for each row execute function public.touch_server_at();
create trigger shots_server_at   before insert or update on public.shots
  for each row execute function public.touch_server_at();
create trigger events_server_at  before insert or update on public.events
  for each row execute function public.touch_server_at();

-- ------------------------------------------------- la fila de avisos, al alta
--
-- Cada usuario tiene su fila de preferencias desde el primer momento. Se crea
-- aquí y no desde la app por una razón concreta: el interruptor de la pantalla
-- de Cuenta solo tiene permiso para **actualizar** dos columnas (ver más
-- abajo), no para insertar, así que sin fila no habría nada que actualizar.
--
-- Va con su propio manejo de errores porque esto corre dentro del alta de
-- usuario: si fallara, no se crearía la fila de avisos *ni la cuenta*. Vale más
-- una cuenta sin preferencias —que se pueden rehacer con el backfill de
-- abajo— que un registro que no se puede completar.
create or replace function public.crear_avisos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.avisos (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
exception when others then
  raise warning 'no se pudo crear la fila de avisos de % (%)', new.id, sqlerrm;
  return new;
end;
$$;

drop trigger if exists crear_avisos_al_alta on auth.users;
create trigger crear_avisos_al_alta after insert on auth.users
  for each row execute function public.crear_avisos();

-- Y las cuentas que ya existían antes de que hubiera planes.
insert into public.avisos (user_id)
select id from auth.users
on conflict (user_id) do nothing;

-- ------------------------------------------------------- seguridad por filas
--
-- ESTO ES LO IMPORTANTE. La clave anónima va dentro del JavaScript que
-- descarga el navegador, así que la tiene cualquiera que abra la web. Lo único
-- que impide que una persona lea los datos de otra son estas políticas.
-- Si desactivas RLS en una tabla, esa tabla queda abierta a todo el mundo.

alter table public.teams   enable row level security;
alter table public.players enable row level security;
alter table public.matches enable row level security;
alter table public.shots   enable row level security;
alter table public.events  enable row level security;

drop policy if exists "solo lo mío" on public.teams;
drop policy if exists "solo lo mío" on public.players;
drop policy if exists "solo lo mío" on public.matches;
drop policy if exists "solo lo mío" on public.shots;
drop policy if exists "solo lo mío" on public.events;

create policy "solo lo mío" on public.teams   for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "solo lo mío" on public.players for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "solo lo mío" on public.matches for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "solo lo mío" on public.shots   for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "solo lo mío" on public.events  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Las dos del plan van distinto, y es el corazón de que esto no se pueda
-- falsificar: se leen, no se escriben. Quien escribe subscriptions es el
-- webhook de Stripe con la clave de servicio, que se salta RLS. Si aquí
-- hubiera un "for all", cualquiera se regalaría el Pro con la clave anon.

alter table public.subscriptions enable row level security;
alter table public.avisos        enable row level security;

drop policy if exists "leer lo mío"       on public.subscriptions;
drop policy if exists "leer lo mío"       on public.avisos;
drop policy if exists "cambiar mis avisos" on public.avisos;

create policy "leer lo mío" on public.subscriptions for select to authenticated
  using (user_id = (select auth.uid()));

create policy "leer lo mío" on public.avisos for select to authenticated
  using (user_id = (select auth.uid()));

-- El interruptor de avisos de la pantalla de Cuenta. La política deja tocar la
-- fila propia, y el permiso por columnas decide **qué** de ella: el sello de
-- frecuencia y el token de baja los escribe solo el servidor, o darse de alta
-- otra vez sería tan fácil como ponerlos a null y recibir el aviso cada día.
create policy "cambiar mis avisos" on public.avisos for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke update on public.avisos from authenticated;
grant  update (email_ok, lang) on public.avisos to authenticated;

-- ---------------------------------------------------------- comprobación RLS
--
-- Ejecuta esto después y mira el resultado: las siete tablas tienen que salir
-- con rls_activo = true. Si alguna sale en false, NO subas la app: esa tabla es
-- pública.
--
-- El número de políticas esperado no es el mismo en todas, y la diferencia es
-- justo lo que hay que mirar:
--   las cinco de datos → 1 política ("solo lo mío", que lee y escribe)
--   subscriptions      → 1 política, y es **de solo lectura**. Si aquí
--                        aparecieran 2, alguien le habría dado permiso de
--                        escritura al usuario y el Pro sería gratis.
--   avisos             → 2 (leer la fila propia y cambiar el interruptor)

select
  c.relname                          as tabla,
  c.relrowsecurity                   as rls_activo,
  (select count(*) from pg_policies p
    where p.schemaname = 'public' and p.tablename = c.relname) as politicas
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('teams','players','matches','shots','events',
                    'subscriptions','avisos')
order by c.relname;

-- ------------------------------------------------------ comprobación purga
--
-- Y esto para la purga. Va como aviso y no como consulta a propósito, por dos
-- razones: el editor de Supabase solo enseña el resultado de la última
-- sentencia, y consultar cron.job sin pg_cron activado no devuelve vacío, falla
-- —y este archivo se tiene que poder ejecutar entero sin romper nada—. El
-- aviso sale en la pestaña de mensajes, debajo de la tabla de RLS.
--
-- Si dice que no está programada, lo borrado no se eliminará nunca, que es justo
-- lo contrario de lo que promete la política de privacidad. Para probarla sin
-- esperar 90 días: pon a mano un deleted_at antiguo en una fila y ejecuta
-- `select public.purgar_borrados(90);`, que devuelve cuántas ha eliminado.

do $$
declare
  trabajo record;
begin
  if to_regclass('cron.job') is null then
    raise notice 'PURGA: pg_cron no está activado. Lo borrado se queda en la base para siempre.';
    return;
  end if;
  select * into trabajo from cron.job where jobname = 'superstat-purga-borrados';
  if not found then
    raise notice 'PURGA: sin programar.';
  else
    raise notice 'PURGA: programada (%), activa = %.', trabajo.schedule, trabajo.active;
  end if;
end;
$$;
