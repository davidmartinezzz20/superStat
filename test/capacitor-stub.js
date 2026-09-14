// Doble del puente de Capacitor, al estilo de test/supabase-stub.js.
//
// Dentro de la app de Android o iOS, window.capacitorExports es lo que deja
// hablar con los plugins nativos sin bundler (ver js/native.js). En el navegador
// no existe, así que sin esto no hay forma de probar nada de native.js más allá
// de que se aparte.
//
// Aquí se deja uno de mentira que apunta en window.__NATIVO__ todo lo que se le
// llama, y que se comporta según window.__NATIVO_CONF__, que la prueba deja
// puesto antes de cargar la página:
//
//   plataforma     'android' | 'ios'        (por defecto android)
//   sinPlugins     ['Share']                plugins no instalados en esta app
//   idToken        el que devuelve Google   (por defecto uno de mentira)
//   googleSinToken true                     Google responde sin idToken
//   shareError     'User cancelled'         lo que lanza la hoja de compartir
(function(){
  const conf = window.__NATIVO_CONF__ || (window.__NATIVO_CONF__ = {});

  const reg = window.__NATIVO__ = {
    llamadas: [],      // en orden, 'Plugin.metodo'
    args: {},          // último argumento de cada una
    listeners: {},     // los que registra App.addListener
    archivos: []       // lo que se escribió con Filesystem
  };

  function apunta(nombre, arg){
    reg.llamadas.push(nombre);
    reg.args[nombre] = arg === undefined ? null : arg;
  }

  const plugins = {
    StatusBar: {
      async setStyle(o){ apunta('StatusBar.setStyle', o); },
      async setBackgroundColor(o){ apunta('StatusBar.setBackgroundColor', o); }
    },
    App: {
      addListener(evento, cb){
        apunta('App.addListener', evento);
        reg.listeners[evento] = cb;
        return { remove(){} };
      },
      exitApp(){ apunta('App.exitApp'); }
    },
    SplashScreen: {
      async hide(){ apunta('SplashScreen.hide'); }
    },
    SocialLogin: {
      async initialize(o){
        apunta('SocialLogin.initialize', o);
        if(conf.googleInitFalla) throw new Error('no se pudo inicializar');
      },
      async login(o){
        apunta('SocialLogin.login', o);
        if(conf.googleSinToken) return { result: {} };
        return { result: { idToken: conf.idToken || 'id-token-de-mentira' } };
      },
      async logout(o){ apunta('SocialLogin.logout', o); }
    },
    Filesystem: {
      async writeFile(o){
        apunta('Filesystem.writeFile', o);
        reg.archivos.push(o);
        return { uri: 'file:///' + (o.directory || 'SIN') + '/' + o.path };
      }
    },
    Share: {
      async share(o){
        apunta('Share.share', o);
        if(conf.shareError) throw new Error(conf.shareError);
      }
    }
  };

  window.capacitorExports = {
    Capacitor: {
      isNativePlatform(){ return conf.web !== true; },
      getPlatform(){ return conf.web === true ? 'web' : (conf.plataforma || 'android'); },
      // Un plugin solo está si se instaló en el proyecto nativo; el puente de
      // verdad responde lo mismo.
      isPluginAvailable(nombre){ return (conf.sinPlugins || []).indexOf(nombre) === -1; }
    },
    registerPlugin(nombre){
      apunta('registerPlugin:' + nombre);
      return plugins[nombre] || {};
    }
  };
})();
