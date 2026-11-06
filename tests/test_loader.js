// Pruebas del CARGADOR: descarga, verificación, caché, copia en Drive, versión nueva, GitHub caído, CDN desactualizado, GH_REF.
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..') + '/';
const ok = (c, m) => { console.log((c ? '✔' : '✘') + ' ' + m); if (!c) process.exitCode = 1; };
const bad = (f, re, m) => { try { f(); ok(false, m + ' (no falló)'); } catch (e) { ok(re.test(e.message), m + ' → ' + String(e.message).slice(0, 110)); } };
// copia de dist en una carpeta temporal para poder "publicar" versiones nuevas
const D = fs.mkdtempSync(path.join(os.tmpdir(), 'dist-')) + '/';
for (const f of fs.readdirSync(ROOT + 'dist')) fs.copyFileSync(ROOT + 'dist/' + f, D + f);
const VA = JSON.parse(fs.readFileSync(ROOT + 'dist/version.json', 'utf8')).v;   // versión actual de dist/
const md5 = s => crypto.createHash('md5').update(s, 'utf8').digest('base64');
function publicar(v, cambiar) {
  const vj = JSON.parse(fs.readFileSync(D + 'version.json', 'utf8'));
  let n = fs.readFileSync(D + 'nucleo.js', 'utf8').replace(/var NUCLEO_VERSION = '[^']*';/, "var NUCLEO_VERSION = '" + v + "';");
  if (cambiar) n = cambiar(n);
  fs.writeFileSync(D + 'nucleo.js', n); vj.v = v; vj.md5.nucleo = md5(n); fs.writeFileSync(D + 'version.json', JSON.stringify(vj));
  return n;
}
const srv = require('./server_loader.js')({ dist: D });
const L = srv.__loader, P = () => srv.PropertiesService.getScriptProperties();
const nuevaEjecucion = () => { srv.N_cache_ = null; };
const pasan5min = () => { srv.CacheService.getScriptCache().remove('INV1_chk'); nuevaEjecucion(); };

// 1. activarTodo
L.activarTodo();
const dir = srv.__files && Object.values(srv.__files).filter(f => f.parent && f.parent.name === 'Código del sistema').map(f => f.n).sort();
ok(JSON.stringify(dir) === JSON.stringify(['gestion.html', 'index.html', 'nucleo.js', 'version.json']), 'activarTodo: copia en Drive "Código del sistema": ' + dir);
let st = JSON.parse(srv.call('api_sys_estado', '[]'));
ok(st.version === VA && st.ref === 'main' && st.respaldo === 'Código del sistema', 'estado: ' + JSON.stringify(st));

// 2. páginas
const hi = L.doGet({ parameter: {} }), hg = L.doGet({ parameter: { gestion: '' } });
ok(hi.title === 'Captura de Conteo' && /PRUEBA\/exec/.test(hi.getContent()) && !/%%APP_URL%%/.test(hi.getContent()), 'doGet: app de conteo con su URL');
ok(hg.title === 'Gestión de Inventario' && new RegExp('sistema-version" content="' + VA).test(hg.getContent()), 'doGet ?gestion: módulo de gestión v' + VA);

// 3. puerta rpc
bad(() => L.rpc('configurar', []), /no permitida/, 'rpc no deja llamar funciones que no son api_*');
bad(() => L.rpc('api_noExiste', []), /no tiene la función/, 'rpc con función inexistente');
let admin = null; srv.aviso_ = m => { const k = String(m).match(/ADMINISTRADOR: ([A-Z0-9-]+)/); if (k) admin = k[1]; }; srv.configurar();
const lg = JSON.parse(srv.call('api_login', JSON.stringify([admin, 'DEVTEST123456', 'node'])));
ok(lg && lg.token, 'api_login por rpc (código de administrador)');
const tok = lg.token;
const viaRpc = srv.call('api_getState', JSON.stringify([tok, '']));
const directo = JSON.stringify(srv.api_getState(tok, ''));
const sinT = s => s.replace(/"(t|now|srv|ts)":\d+/g, '');
ok(sinT(viaRpc) === sinT(directo), 'api_getState: misma respuesta por rpc que directo (' + viaRpc.length + ' caracteres)');
bad(() => srv.call('api_g_catSave', JSON.stringify(['x', {}])), /código|Ingrese/, 'los errores AUTH llegan igual al cliente');

// 4. onEdit (activador simple, dentro del cargador)
const r0 = P().getProperty('refver'); L.onEdit({ range: { getSheet: () => ({ getName: () => 'CATALOGO' }) } });
ok(P().getProperty('refver') !== r0 || r0 === null, 'onEdit marca refver al editar CATALOGO');

// 5. rendimiento: cada ejecución nueva arma el núcleo desde la caché
let t = Date.now(); for (let i = 0; i < 5; i++) { nuevaEjecucion(); srv.call('api_sys_estado', '[]'); srv.call('api_ping' in srv ? 'api_ping' : 'api_sys_estado', '[]'); }
nuevaEjecucion(); t = Date.now(); srv.call('api_getState', JSON.stringify([tok, ''])); const tCall = Date.now() - t;
srv.N_cache_ = null; t = Date.now(); srv.nucleo_(); const tParse = Date.now() - t; ok(srv.N_cache_ !== null, 'el núcleo se volvió a armar');
ok(tParse < 400, 'armar el núcleo en una ejecución nueva: ' + tParse + ' ms (llamada completa api_getState: ' + tCall + ' ms)');

// 6. GitHub caído y caché vacía → copia de Drive
srv.gh.modo = 'caido'; srv.__wipeCache(); nuevaEjecucion();
ok(JSON.parse(srv.call('api_sys_estado', '[]')).version === VA && /Captura/.test(L.doGet({ parameter: {} }).title), 'GitHub caído + caché vacía: funciona con la copia de Drive');
srv.gh.modo = 'ok';

// 7. versión nueva publicada → se adopta al pasar 5 min
publicar('99.0.1', n => n + '\nfunction api_nueva9901(){ return "hola 99.0.1"; }\n');
nuevaEjecucion(); ok(JSON.parse(srv.call('api_sys_estado', '[]')).version === VA, 'antes de 5 min sigue ' + VA + ' (no consulta GitHub en cada llamada)');
pasan5min(); ok(JSON.parse(srv.call('api_sys_estado', '[]')).version === '99.0.1' && JSON.parse(srv.call('api_nueva9901', '[]')) === 'hola 99.0.1', 'pasados 5 min adopta 99.0.1 y la función nueva responde');
const bk = Object.values(srv.__files).find(f => f.parent && f.parent.name === 'Código del sistema' && f.n === 'version.json');
ok(JSON.parse(bk.text).v === '99.0.1', 'la copia de Drive quedó en 99.0.1');

// 8. CDN desactualizado: version.json nuevo pero nucleo.js todavía viejo → no cambia hasta que llegue completo
const n9901 = fs.readFileSync(D + 'nucleo.js', 'utf8');
publicar('99.0.2'); srv.gh.modo = 'viejo'; srv.gh.viejo = { 'nucleo.js': n9901 };
pasan5min(); ok(JSON.parse(srv.call('api_sys_estado', '[]')).version === '99.0.1', 'CDN con archivo viejo: se queda en 99.0.1 (no mezcla versiones)');
srv.gh.modo = 'ok'; pasan5min(); ok(JSON.parse(srv.call('api_sys_estado', '[]')).version === '99.0.2', 'cuando GitHub ya tiene todo: adopta 99.0.2');

// 9. núcleo inválido (huella correcta pero sin las funciones) → se rechaza
publicar('99.0.3', n => n.replace('function api_login(', 'function api_loginX('));
pasan5min(); ok(JSON.parse(srv.call('api_sys_estado', '[]')).version === '99.0.2', 'núcleo inválido 99.0.3: se rechaza y sigue 99.0.2');
publicar('99.0.4', n => n.replace('function api_loginX(', 'function api_login('));

// 10. actualizar ahora desde Gestión (solo administrador)
const up = JSON.parse(srv.call('api_sys_actualizar', JSON.stringify([tok])));
ok(up.version === '99.0.4', 'Gestión › Sistema › "Buscar actualización ahora" instala 99.0.4 sin esperar');
bad(() => srv.call('api_sys_actualizar', JSON.stringify(['x'])), /código|Ingrese/, 'actualizar ahora exige administrador');

// 10b. revisión forzada desde las pantallas: adopta al instante (sin esperar 5 min), como mucho 1 cada 30 s
publicar('99.0.5'); nuevaEjecucion();
ok(JSON.parse(srv.call('api_sys_revisar', '[]')).version === '99.0.5', 'api_sys_revisar: la versión nueva se adopta al abrir la pantalla, sin esperar');
publicar('99.0.6'); nuevaEjecucion();
ok(JSON.parse(srv.call('api_sys_revisar', '[]')).version === '99.0.5', 'dos revisiones forzadas seguidas: la segunda espera 30 s (no satura GitHub)');
srv.CacheService.getScriptCache().remove('INV1_frc'); nuevaEjecucion();
ok(JSON.parse(srv.call('api_sys_revisar', '[]')).version === '99.0.6', 'pasados 30 s vuelve a revisar');
publicar('99.0.4', n => n);

// 11. GH_REF: fijar una versión anterior
const V0 = fs.mkdtempSync(path.join(os.tmpdir(), 'vieja-')) + '/'; for (const f of fs.readdirSync(ROOT + 'dist')) fs.copyFileSync(ROOT + 'dist/' + f, V0 + f);
srv.gh.refs = { 'vieja': V0 }; P().setProperty('GH_REF', 'vieja'); pasan5min();
st = JSON.parse(srv.call('api_sys_estado', '[]')); ok(st.version === VA && st.ref === 'vieja', 'GH_REF=vieja vuelve a la versión anterior sin tocar código');
P().deleteProperty ? P().deleteProperty('GH_REF') : P().setProperty('GH_REF', ''); pasan5min();
ok(JSON.parse(srv.call('api_sys_estado', '[]')).version === '99.0.4', 'quitar GH_REF regresa a la rama (99.0.4)');
console.log(process.exitCode ? 'HAY FALLOS' : 'TODO OK');
