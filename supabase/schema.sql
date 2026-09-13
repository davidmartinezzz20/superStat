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

-- ---------------------------------------------------------- comprobación RLS
--
-- Ejecuta esto después y mira el resultado: las cinco tablas tienen que salir
-- con rls_activo = true y politicas = 1. Si alguna sale en false, NO subas la
-- app: esa tabla es pública.

select
  c.relname                          as tabla,
  c.relrowsecurity                   as rls_activo,
  (select count(*) from pg_policies p
    where p.schemaname = 'public' and p.tablename = c.relname) as politicas
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('teams','players','matches','shots','events')
order by c.relname;
