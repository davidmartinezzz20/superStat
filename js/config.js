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
//
// GOOGLE_CLIENT_ID_IOS solo lo usa la app de iPhone: allí el sistema pide el
// token con el cliente "iOS" de Google Cloud, creado con el bundle id de la
// app, aunque quien valida el token siga siendo el cliente web de arriba. En
// Android no hace falta ninguno más aquí: su cliente se reconoce por la huella
// SHA-1 con la que se firma el APK, no por nada escrito en el código. Déjalo
// vacío mientras no publiques en iOS; está explicado en docs/movil.md.

// PRO_PRICE es lo que se enseña en la pantalla de Pro, y solo eso: quien cobra
// de verdad es Stripe, así que **tiene que coincidir con el Price que tengas
// dado de alta allí** (docs/suscripcion.md). Está aquí y no en js/i18n.js
// porque es un número, es el mismo en los dos idiomas y cambia sin que haya que
// tocar ni un texto. Déjalo vacío y la pantalla no enseña precio: el que salga
// en la página de pago de Stripe seguirá siendo el bueno.

window.SUPERSTAT_CONFIG = {
  SUPABASE_URL: 'https://cqjpexlgjqyzdjkcdwpw.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxanBleGxnanF5emRqa2Nkd3B3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyNzYwMTIsImV4cCI6MjEwNDg1MjAxMn0.pmgU4Z3PpEjfEe7aEUxW8AFLsarru_R98CcG0dXZ0cY',
  GOOGLE_CLIENT_ID: '749407066281-h4trcuskeo8a60ljl7dg1579pm7aq81k.apps.googleusercontent.com',
  GOOGLE_CLIENT_ID_IOS: '',
  PRO_PRICE: '3,49 €'
};
