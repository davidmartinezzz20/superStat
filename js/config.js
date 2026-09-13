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
//
// GOOGLE_CLIENT_ID es el ID de cliente de OAuth de Google Cloud, el mismo que
// se pega en Supabase → Authentication → Providers → Google. Aquí hace falta
// además porque el botón de Google lo dibuja esta página, no el callback de
// Supabase: así Google anuncia el dominio de la app y no el del proyecto. El
// secreto de cliente NO va aquí, solo en Supabase.

window.SUPERSTAT_CONFIG = {
  SUPABASE_URL: 'https://cqjpexlgjqyzdjkcdwpw.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxanBleGxnanF5emRqa2Nkd3B3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyNzYwMTIsImV4cCI6MjEwNDg1MjAxMn0.pmgU4Z3PpEjfEe7aEUxW8AFLsarru_R98CcG0dXZ0cY',
  GOOGLE_CLIENT_ID: ''  // 1234567890-xxxxxxxx.apps.googleusercontent.com
};
