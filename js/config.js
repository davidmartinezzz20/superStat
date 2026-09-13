// Configuración de Supabase.
//
// Estas dos claves se pueden publicar: la clave anon viaja dentro del
// JavaScript que descarga cualquiera que abra la web, así que no es un secreto
// y no tiene sentido intentar esconderla. Lo que impide que una persona vea los
// datos de otra son las políticas RLS de supabase/schema.sql, no esta clave.
//
// NUNCA pongas aquí la clave `service_role`: esa se salta RLS entera y daría
// acceso a todos los datos de todos los usuarios.
//
// Las encuentras en Supabase → Project Settings → API.

window.SUPERSTAT_CONFIG = {
  SUPABASE_URL: '',      // https://xxxxxxxxxxxx.supabase.co
  SUPABASE_ANON_KEY: ''  // clave "anon" / "publishable"
};
