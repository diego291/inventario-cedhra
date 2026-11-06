/**
 * INVENTARIO · CARGADOR (Conteo físico + Gestión de inventario)
 *
 * Pegue este archivo UNA sola vez como Code.gs. Todo lo demás (servidor y pantallas)
 * se descarga solo desde GitHub y se guarda una copia en su Drive.
 *
 * En el editor (menú de funciones, arriba):
 *   activarTodo      → la primera vez: autoriza y descarga el sistema.
 *   actualizarAhora  → trae la última versión sin esperar los 5 minutos.
 *   estadoSistema    → muestra la versión instalada.
 *
 * Volver a una versión anterior sin tocar código:
 *   Configuración del proyecto › Propiedades del script › GH_REF = (etiqueta o commit). Borrarla vuelve a la rama.
 */
var GH_REPO = 'diego291/inventario-cedhra';
var GH_RAMA = 'main';            // En la hoja de PRUEBA cambie a 'prueba'.
var PAGINA_OK = /^https:\/\/diego291\.github\.io\/[A-Za-z0-9._\/-]*$/;   // dirección de GitHub Pages que puede mostrar la app
var CARGADOR_VERSION = 2;

var REVISAR_CADA = 300;          // segundos entre revisiones de versión nueva
var PARTE = 45000;               // tamaño de cada trozo en la caché
var ARCH = { nucleo: 'nucleo.js', index: 'index.html', gestion: 'gestion.html' };
var CK = 'INV1_';

/* ============ Entradas que Google llama por su nombre (no cambian) ============ */
function doGet(e) {
  var p = (e && e.parameter) || {}, g = 'gestion' in p;
  // Si se abre desde la página de GitHub, los enlaces internos (Conteo ⇄ Gestión) vuelven a esa página.
  var base = (p.shell && PAGINA_OK.test(String(p.shell))) ? String(p.shell) : ScriptApp.getService().getUrl();
  try {
    var html = archivo_(g ? 'gestion' : 'index').replace(/%%APP_URL%%/g, base);
    return HtmlService.createHtmlOutput(html)
      .setTitle(g ? 'Gestión de Inventario' : 'Captura de Conteo')
      .addMetaTag('viewport', g ? 'width=device-width, initial-scale=1' : 'width=device-width, initial-scale=1, viewport-fit=cover')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (err) {
    return HtmlService.createHtmlOutput('<div style="font-family:sans-serif;padding:24px;max-width:560px"><h2>No se pudo abrir el sistema</h2><p>' +
      String(err.message || err).replace(/[<>&]/g, '') + '</p><p>Intente de nuevo en unos minutos. Si sigue igual, avise al administrador.</p></div>').setTitle('Inventario')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
}

/** Puerta única para las pantallas: solo deja pasar funciones api_* del núcleo. */
function rpc(fn, args) {
  fn = String(fn || '');
  if (!/^api_[A-Za-z0-9_]+$/.test(fn)) throw new Error('VAL|Función no permitida.');
  args = Array.isArray(args) ? args : [];
  if (fn === 'api_sys_estado') return estado_();
  if (fn === 'api_sys_actualizar') { llamar_('auth_', [args[0], 'Administrador']); limpiar_(); version_(); N_cache_ = null; return estado_(); }
  return llamar_(fn, args);
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Conteo')
    .addItem('1. Configurar (una sola vez)', 'configurar')
    .addItem('Nuevo código de administrador', 'menuCodigoAdmin')
    .addSeparator()
    .addItem('Generar hoja para el Excel', 'menuGenerar')
    .addItem('Vincular imágenes del catálogo', 'menuImagenes')
    .addItem('Hacer respaldo ahora', 'respaldo')
    .addItem('Probar módulo de gestión', 'probarGestion')
    .addSeparator()
    .addItem('Sistema: buscar actualización ahora', 'actualizarAhora')
    .addItem('Sistema: ver versión', 'estadoSistema')
    .addToUi();
}

/* onEdit es un activador simple: no puede descargar nada, por eso vive aquí completo. */
function onEdit(e) {
  try {
    var n = e && e.range ? e.range.getSheet().getName() : '', p = PropertiesService.getScriptProperties(), t = String(Date.now());
    if (['CATALOGO', 'INVENTARIO_ANTERIOR', 'CONFIG'].indexOf(n) >= 0) p.setProperty('refver', t);
    if (n === 'UBICACIONES') p.setProperty('locver', t);
    if (n === 'REGISTROS' || n === 'UBICACIONES') p.setProperty('fullver', t);
    if (/^G_/.test(n) && n !== 'G_TEXTOS' && n !== 'G_ETIQUETADO') p.setProperty('gver', t);
    p.setProperty('ver', t);
  } catch (err) {}
}

function configurar() { return llamar_('configurar', arguments); }
function menuCodigoAdmin() { return llamar_('menuCodigoAdmin', arguments); }
function menuGenerar() { return llamar_('menuGenerar', arguments); }
function menuImagenes() { return llamar_('menuImagenes', arguments); }
function probar() { return llamar_('probar', arguments); }
function probarGestion() { return llamar_('probarGestion', arguments); }
function respaldo() { return llamar_('respaldo', arguments); }
/** Para activadores futuros: el núcleo decide qué hacer en tareaProgramada_. */
function tareaProgramada() { return llamar_('tareaProgramada_', arguments); }

/* ============ Funciones para ejecutar desde el editor ============ */
function activarTodo() {
  var p = PropertiesService.getScriptProperties();
  if (!p.getProperty('ssId')) { try { p.setProperty('ssId', SpreadsheetApp.getActiveSpreadsheet().getId()); } catch (e) {} }
  limpiar_();
  var v = version_(); N_cache_ = null; nucleo_();
  ScriptApp.getProjectTriggers();
  var s = estado_();
  aviso_('Listo. Sistema ' + s.version + ' (' + s.fecha + ') cargado desde GitHub (' + s.ref + ').\nCopia de respaldo en Drive: carpeta "' + s.respaldo + '".');
  return v;
}
function actualizarAhora() {
  limpiar_(); version_(); N_cache_ = null; nucleo_();
  var s = estado_(); aviso_('Versión instalada: ' + s.version + ' (' + s.fecha + '), desde ' + s.ref + '.');
}
function estadoSistema() {
  var s = estado_(); aviso_('Versión: ' + s.version + '\nPublicada: ' + s.fecha + '\nOrigen: ' + s.repo + ' · ' + s.ref + '\nRespaldo en Drive: ' + s.respaldo);
}

/* ============ Mecanismo (no hace falta tocar) ============ */
var N_cache_ = null;
function llamar_(nombre, args) {
  var f = nucleo_()(nombre);
  if (!f) throw new Error('El sistema no tiene la función ' + nombre + '.');
  return f.apply(null, Array.prototype.slice.call(args || []));
}
function nucleo_() {
  if (N_cache_) return N_cache_;
  var src = archivo_('nucleo');
  N_cache_ = new Function(src + '\n;return function (n) { return /^[A-Za-z_$][\\w$]*$/.test(n) ? eval("typeof " + n + " === \\"function\\" ? " + n + " : null") : null; };')();
  return N_cache_;
}
function aviso_(m) { Logger.log(m); try { SpreadsheetApp.getUi().alert(m); } catch (e) {} }
function props_() { return PropertiesService.getScriptProperties(); }
function ref_() { return String(props_().getProperty('GH_REF') || GH_RAMA).trim(); }
function md5_(s) { return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, s, Utilities.Charset.UTF_8)); }
function valido_(s) { return /function api_login\(/.test(s) && /var NUCLEO_VERSION = '/.test(s) && s.length > 50000; }
function limpiar_() { var c = CacheService.getScriptCache(); c.remove(CK + 'ver'); c.remove(CK + 'chk'); N_cache_ = null; }

function bajar_(nombre) {
  var url = 'https://raw.githubusercontent.com/' + GH_REPO + '/' + ref_() + '/dist/' + nombre + '?t=' + Date.now();
  var opt = { muteHttpExceptions: true, headers: { 'Cache-Control': 'no-cache' } };
  var tk = props_().getProperty('GH_TOKEN'); if (tk) opt.headers.Authorization = 'token ' + tk;
  try {
    var r = UrlFetchApp.fetch(url, opt);
    if (r.getResponseCode() === 200) return r.getContentText('UTF-8');
    Logger.log('GitHub respondió ' + r.getResponseCode() + ' para ' + nombre);
  } catch (e) { Logger.log('No pude leer GitHub (' + nombre + '): ' + e); }
  return null;
}

/** Versión vigente. Revisa GitHub cada REVISAR_CADA s; adopta una nueva solo si los 3 archivos llegan completos y verificados. */
function version_() {
  var c = CacheService.getScriptCache(), cur = null;
  try { cur = JSON.parse(c.get(CK + 'ver') || 'null'); } catch (e) {}
  if (cur && c.get(CK + 'chk')) return cur;
  if (!cur) { try { cur = JSON.parse(leerRespaldo_('version.json') || 'null'); } catch (e) {} }
  var nv = null; try { nv = JSON.parse(bajar_('version.json') || 'null'); } catch (e) {}
  if (nv && nv.md5 && (!cur || !cur.md5 || cur.md5.nucleo !== nv.md5.nucleo || cur.md5.index !== nv.md5.index || cur.md5.gestion !== nv.md5.gestion)) {
    if (adoptar_(nv)) { cur = nv; N_cache_ = null; }
  }
  if (!cur) throw new Error('No pude descargar el sistema desde GitHub y todavía no hay copia en Drive. Revise la conexión y ejecute activarTodo.');
  try { c.put(CK + 'ver', JSON.stringify(cur), 21600); c.put(CK + 'chk', '1', REVISAR_CADA); } catch (e) {}
  return cur;
}
function adoptar_(nv) {
  var t = {}, k;
  for (k in ARCH) {
    var s = bajar_(ARCH[k]);
    if (!s || md5_(s) !== nv.md5[k]) { Logger.log('La versión ' + nv.v + ' todavía no está completa en GitHub (' + k + '); sigo con la anterior.'); return false; }
    t[k] = s;
  }
  if (!valido_(t.nucleo)) { Logger.log('El núcleo de la versión ' + nv.v + ' no es válido; sigo con la anterior.'); return false; }
  for (k in t) guardarCache_(CK + nv.md5[k], t[k]);
  try { for (k in t) respaldar_(ARCH[k], t[k]); respaldar_('version.json', JSON.stringify(nv)); }
  catch (e) { Logger.log('No pude guardar la copia en Drive: ' + e); }
  return true;
}
function archivo_(k) {
  var v = version_(), h = v.md5[k], s = leerCache_(CK + h);
  if (s) return s;
  var b = leerRespaldo_(ARCH[k]);
  if (b && md5_(b) === h) { guardarCache_(CK + h, b); return b; }
  var g = bajar_(ARCH[k]);
  if (g && md5_(g) === h) { guardarCache_(CK + h, g); try { respaldar_(ARCH[k], g); } catch (e) {} return g; }
  if (b) return b;
  throw new Error('No encontré el archivo ' + ARCH[k] + ' ni en GitHub ni en la copia de Drive.');
}
function guardarCache_(key, s) {
  var n = Math.ceil(s.length / PARTE), o = {};
  o[key + 'n'] = String(n);
  for (var i = 0; i < n; i++) o[key + i] = s.substr(i * PARTE, PARTE);
  try { CacheService.getScriptCache().putAll(o, 21600); } catch (e) { Logger.log('Caché llena: ' + e); }
}
function leerCache_(key) {
  var c = CacheService.getScriptCache(), n = Number(c.get(key + 'n') || 0);
  if (!n) return null;
  var ks = []; for (var i = 0; i < n; i++) ks.push(key + i);
  var m = c.getAll(ks), s = '';
  for (i = 0; i < n; i++) { if (m[ks[i]] == null) return null; s += m[ks[i]]; }
  return s;
}

/* Copia en Drive: carpeta "Código del sistema" junto a la hoja (en PRUEBA: "Código del sistema (prueba)"). */
function carpeta_() {
  var p = props_(), id = p.getProperty('INV_DIR');
  if (id) { try { var f0 = DriveApp.getFolderById(id); if (!f0.isTrashed()) return f0; } catch (e) {} }
  var ssid = p.getProperty('ssId') || SpreadsheetApp.getActiveSpreadsheet().getId();
  var it = DriveApp.getFileById(ssid).getParents(), par = it.hasNext() ? it.next() : DriveApp.getRootFolder();
  var nom = 'Código del sistema' + (GH_RAMA === 'main' ? '' : ' (' + GH_RAMA + ')');
  var fi = par.getFoldersByName(nom), f = fi.hasNext() ? fi.next() : par.createFolder(nom);
  p.setProperty('INV_DIR', f.getId());
  return f;
}
function respaldar_(nombre, texto) {
  var d = carpeta_(), it = d.getFilesByName(nombre);
  if (it.hasNext()) it.next().setContent(texto); else d.createFile(nombre, texto, MimeType.PLAIN_TEXT);
}
function leerRespaldo_(nombre) {
  try { var it = carpeta_().getFilesByName(nombre); return it.hasNext() ? it.next().getBlob().getDataAsString('UTF-8') : null; }
  catch (e) { return null; }
}
function estado_() {
  var v = version_(), dir = '';
  try { dir = carpeta_().getName(); } catch (e) {}
  return { version: v.v, fecha: v.fecha, repo: GH_REPO, ref: ref_(), respaldo: dir, cargador: CARGADOR_VERSION };
}
