// Doble de Google Identity Services (accounts.google.com/gsi/client).
//
// Implementa solo lo que usa js/db.js: initialize() y renderButton(). El botón
// que dibuja lleva el id `google-btn` para que las pruebas puedan pulsarlo igual
// que pulsaban el que había antes.
//
// Guarda en window.__GOOGLE__ el nonce que recibió (el resumido) para que el
// doble de supabase-js pueda comprobar que el que le llega a signInWithIdToken
// es el original y no el mismo. Esa pareja es lo más fácil de equivocar del
// flujo, así que conviene que una prueba la mire.
(function(){
  window.__GOOGLE__ = { nonce: null, clientId: null, cuenta: {
    email: 'david@gmail.com', name: 'David'
  } };

  function b64url(obj){
    return btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  // Un id_token de mentira, con la forma justa para que se pueda leer el payload.
  function credencial(){
    return b64url({ alg:'RS256' }) + '.' + b64url(window.__GOOGLE__.cuenta) + '.firma';
  }

  let callback = null;

  window.google = {
    accounts: {
      id: {
        initialize(opts){
          callback = opts.callback;
          window.__GOOGLE__.nonce = opts.nonce;
          window.__GOOGLE__.clientId = opts.client_id;
        },
        renderButton(el){
          const b = document.createElement('button');
          b.id = 'google-btn';
          b.textContent = 'Entrar con Google';
          b.addEventListener('click', () => callback({ credential: credencial() }));
          el.appendChild(b);
        },
        prompt(){},
        disableAutoSelect(){}
      }
    }
  };
})();
