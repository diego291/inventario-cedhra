// Simulador de Apps Script con el CARGADOR: el código se "descarga" de dist/ como si fuera GitHub.
// Uso: const srv = require('./server_loader.js')({ dist, sheets });  srv.call('api_x', JSON.stringify([...]))
// srv.gh.modo = 'ok' | 'caido' | 'viejo'  (simula GitHub disponible, sin respuesta, o CDN con archivos desactualizados)
const fs = require('fs'), vm = require('vm'), path = require('path'), crypto = require('crypto');
const T = __dirname + '/', ROOT = path.join(__dirname, '..') + '/';
module.exports = function (o) {
  o = o || {};
  const dist = o.dist || ROOT + 'dist/';
  const ctx = { console, atob, btoa, Date, Math, JSON, Proxy, setTimeout, Uint8Array, Array, Object, String, Number, RegExp, Error, isFinite, parseFloat, parseInt, Response: undefined };
  ctx.window = ctx; vm.createContext(ctx);
  ctx.__SHEETS = JSON.parse(fs.readFileSync(o.sheets || T + 'privado/_sheets.json', 'utf8'));
  vm.runInContext(fs.readFileSync(T + 'fakegas.js', 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(T + 'fakegas2.js', 'utf8'), ctx);
  // --- extras que usa el cargador
  ctx.__md5 = s => Array.from(crypto.createHash('md5').update(String(s), 'utf8').digest()).map(b => b > 127 ? b - 256 : b);
  const gh = { modo: 'ok', pedidos: [], viejo: {} };
  ctx.__gh = (url) => {
    gh.pedidos.push(url);
    if (gh.modo === 'caido') throw new Error('Address unavailable');
    const m = url.match(/raw\.githubusercontent\.com\/([^/]+\/[^/]+)\/(.+?)\/dist\/([^?]+)/);
    const ref = m[2], f = m[3];
    let file = (gh.refs && gh.refs[ref]) ? gh.refs[ref] + f : dist + f;
    if (gh.modo === 'viejo' && gh.viejo[f] != null) return { code: 200, text: gh.viejo[f] };
    if (!fs.existsSync(file)) return { code: 404, text: '404: Not Found' };
    return { code: 200, text: fs.readFileSync(file, 'utf8') };
  };
  vm.runInContext(`
    Utilities.DigestAlgorithm.MD5 = 'md5';
    (function(){ const old = Utilities.computeDigest; Utilities.computeDigest = (a, s, c) => a === 'md5' ? __md5(s) : old(a, s, c); })();
    Utilities.base64Encode = b => { let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.slice(i, i + 0x8000).map(x => x < 0 ? x + 256 : x)); return btoa(s); };
    window.MimeType = { PLAIN_TEXT: 'text/plain' };
    window.UrlFetchApp = { fetch: (url, opt) => { const r = __gh(url); return { getResponseCode: () => r.code, getContentText: () => r.text }; } };
    (function(){
      const FP = Object.getPrototypeOf(DriveApp.getRootFolder()); let n = 0;
      const wrap = f => ({ getId: () => f.id, getName: () => f.n, isTrashed: () => false, setContent: t => { f.text = String(t); }, getBlob: () => ({ getDataAsString: () => f.text || '', getBytes: () => f.bytes }), getParents: () => ({ i: 0, hasNext() { return this.i < 1; }, next() { this.i++; return f.parent; } }) });
      const oc = FP.createFile;
      FP.createFile = function (a, b, c) { if (typeof a !== 'string') { const r = oc.call(this, a); if (r && !r.getUrl) r.getUrl = () => 'https://drive.google.com/file/d/' + r.getId() + '/view'; return r; } const id = 'TXT' + (++n); const f = { id, n: a, bytes: [], type: c, text: String(b), parent: this }; __files[id] = f; this.files.push(f); return wrap(f); };
      FP.getFilesByName = function (nm) { const L = this.files.filter(f => f.n === nm).map(wrap); let i = 0; return { hasNext: () => i < L.length, next: () => L[i++] }; };
      FP.getName = function () { return this.name; };
      FP.getId = FP.getId || function () { return this.id; };
    })();
    (function(){ const C = {}; const live = k => { const c = C[k]; return c && c.exp > Date.now() ? c.v : null; };
      const sc = { get: live, put: (k, v, t) => { if (String(v).length > 100000) throw new Error('valor > 100KB'); C[k] = { v: String(v), exp: Date.now() + (t || 600) * 1000 }; },
        putAll: (m, t) => Object.keys(m).forEach(k => sc.put(k, m[k], t)), getAll: ks => { const o = {}; ks.forEach(k => { const v = live(k); if (v != null) o[k] = v; }); return o; }, remove: k => { delete C[k]; } };
      CacheService.getScriptCache = () => sc; window.__wipeCache = () => Object.keys(C).forEach(k => delete C[k]); })();
    window.HtmlService.XFrameOptionsMode = { DEFAULT: 'DEFAULT' };
    (function(){ const oh = HtmlService.createHtmlOutput; HtmlService.createHtmlOutput = h => { const x = oh(h); const ch = { getContent: () => String(h), setTitle: t => { ch.title = t; return ch; }, addMetaTag: () => ch, setXFrameOptionsMode: () => ch, getBlob: x.getBlob }; return ch; }; })();
    window.ScriptApp.getService = () => ({ getUrl: () => 'https://script.google.com/macros/s/PRUEBA/exec' });
    PropertiesService.getScriptProperties().setProperty('ssId', 'SSID123');
  `, ctx);
  // --- funciones directas solo para preparar datos en las pruebas (regIn_, configurar con aviso_ interceptable)
  const nuc = fs.readFileSync(dist + 'nucleo.js', 'utf8');
  vm.runInContext(nuc, ctx);
  const direct = { configurar: ctx.configurar, aviso_: ctx.aviso_ };
  // --- el cargador real (lo que se pega en Apps Script)
  vm.runInContext(fs.readFileSync(o.loader || ROOT + 'apps-script/Code.gs', 'utf8'), ctx);
  ctx.__loader = { doGet: ctx.doGet, rpc: ctx.rpc, onEdit: ctx.onEdit, activarTodo: ctx.activarTodo, actualizarAhora: ctx.actualizarAhora, estadoSistema: ctx.estadoSistema, configurarL: ctx.configurar, respaldo: ctx.respaldo };
  ctx.configurar = direct.configurar;   // las pruebas interceptan aviso_ para leer el código de administrador
  const hasDate = x => { if (x instanceof ctx.Date || Object.prototype.toString.call(x) === '[object Date]') return true; if (x && typeof x === 'object') return Object.values(x).some(hasDate); return false; };
  ctx.call = (fn, args) => { let a = JSON.parse(args); if (fn === 'rpc') { fn = a[0]; a = a[1] || []; } const r = ctx.__loader.rpc(fn, a); if (hasDate(r)) throw new Error('Date en respuesta de ' + fn); return JSON.stringify(r === undefined ? null : r); };
  ctx.gh = gh;
  return ctx;
};
