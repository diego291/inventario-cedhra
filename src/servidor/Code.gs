/**
 * CONTEO FÍSICO 2026 · App de captura en Google Sheets + Drive (versión con control de acceso y referencias)
 * Pegue este archivo como Code.gs en Extensiones > Apps Script. El archivo HTML se llama Index.
 */
/* ▼▼▼ PEGUE AQUÍ EL ID DE SU HOJA DE GOOGLE ▼▼▼
   Es la parte del enlace entre /d/ y /edit:
   https://docs.google.com/spreadsheets/d/ESTE-ES-EL-ID/edit            */
var SS_ID = '';
/* ▲▲▲ ▲▲▲ ▲▲▲ */

var SH = { REG:'REGISTROS', UB:'UBICACIONES', CAT:'CATALOGO', INV:'INVENTARIO_ANTERIOR', CFG:'CONFIG', PEG:'PEGAR_EN_CONTEO', USR:'USUARIOS', LOG:'BITACORA' };
var NREG = 28, NUB = 13, NUSR = 11, NLOG = 7;
var USR_HEAD = ['ID', 'Nombre', 'Rol', 'Estado', 'Vence', 'Máx. dispositivos', 'Dispositivos (no editar)', 'Solicitudes (no editar)', 'Código cifrado (no editar)', 'Versión', 'Último acceso'];
var LOG_HEAD = ['Fecha', 'Usuario', 'Rol', 'Acción', 'Registro', 'Detalle', 'Dispositivo'];
var ROLES = { 'Contador': 1, 'Supervisor': 2, 'Administrador': 3 };
var FOTOS_DIR = 'Fotos conteo', IMG_DIR = 'Imagenes catalogo', BACKUP_DIR = 'Respaldos', BACKUP_KEEP = 30;
var MAX_BORRADOS_HORA = 10;

/* ================= MENÚ Y WEB APP ================= */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Conteo')
    .addItem('1. Configurar (una sola vez)', 'configurar')
    .addItem('Nuevo código de administrador', 'menuCodigoAdmin')
    .addSeparator()
    .addItem('Generar hoja para el Excel', 'menuGenerar')
    .addItem('Vincular imágenes del catálogo', 'menuImagenes')
    .addItem('Hacer respaldo ahora', 'respaldo')
    .addItem('Probar módulo de gestión', 'probarGestion')
    .addToUi();
}
function aviso_(msg) { Logger.log(msg); try { SpreadsheetApp.getUi().alert(msg); } catch (e) {} }
function onEdit(e) {
  try {
    var n = e && e.range ? e.range.getSheet().getName() : '';
    if ([SH.CAT, SH.INV, SH.CFG].indexOf(n) >= 0) bumpKey_('refver');
    if (n === SH.UB) bumpKey_('locver');
    if (n === SH.REG || n === SH.UB) bumpKey_('fullver');
    if (/^G_/.test(n) && n !== 'G_TEXTOS' && n !== 'G_ETIQUETADO') bumpKey_('gver');
    bump_();
  } catch (err) {}
}
function bumpKey_(k) { PropertiesService.getScriptProperties().setProperty(k, String(Date.now())); }
function getKey_(k) { var p = PropertiesService.getScriptProperties(), v = p.getProperty(k); if (!v) { v = String(Date.now()); p.setProperty(k, v); } return v; }
function valErr_(msg) { return new Error('VAL|' + msg); }

function doGet(e) {
  var p = (e && e.parameter) || {};
  if ('gestion' in p) {
    return HtmlService.createTemplateFromFile('Gestion').evaluate()
      .setTitle('Gestión de Inventario')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
  }
  return HtmlService.createTemplateFromFile('Index').evaluate()
    .setTitle('Captura de Conteo')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

function configurar() {
  var ss = hojaInicial_();
  var props = PropertiesService.getScriptProperties();
  props.setProperty('ssId', ss.getId());
  salt_();
  var f = fotosFolder_();
  var n = vincularImagenes_();
  regSheet_(); ubSheet_(); usrSheet_(); logSheet_();
  ss.getSheetByName(SH.REG).getRange('A:AB').setNumberFormat('@');
  ss.getSheetByName(SH.REG).getRange('B2:B').setNumberFormat('dd/mm/yyyy');
  ss.getSheetByName(SH.REG).getRange('H2:K').setNumberFormat('0');
  ss.getSheetByName(SH.REG).getRange('W2:X').setNumberFormat('dd/mm/yyyy hh:mm');
  instalarRespaldo_();
  bumpKey_('refver'); bumpKey_('fullver'); bumpKey_('locver');
  var msgAdmin = '';
  if (!users_().some(function (u) { return u.rol === 'Administrador' && u.estado === 'Activo'; })) {
    var code = crearUsuario_({ nombre: 'ADMINISTRADOR', rol: 'Administrador', max: 3 }, null).code;
    msgAdmin = '\n\n★ SU CÓDIGO DE ADMINISTRADOR: ' + code + '\nAnótelo. Con él entra a la app y al panel Equipo. Si lo pierde: menú Conteo > Nuevo código de administrador.';
  }
  bump_();
  aviso_('Listo.\n\n• Carpeta de fotos: ' + f.getName() + '\n• Imágenes del catálogo vinculadas: ' + n +
    '\n• Respaldo diario activado (carpeta "' + BACKUP_DIR + '").' + msgAdmin);
}
/** Recuperación: solo quien abre la hoja (el dueño) puede usarlo. Crea un nuevo código para el primer administrador. */
function menuCodigoAdmin() {
  var us = users_(), adm = us.filter(function (u) { return u.rol === 'Administrador' && u.estado !== 'Baja'; })[0];
  var code;
  if (!adm) code = crearUsuario_({ nombre: 'ADMINISTRADOR', rol: 'Administrador', max: 3 }, null).code;
  else {
    code = genCode_();
    var sh = usrSheet_();
    sh.getRange(adm.row, 4).setValue('Activo');
    sh.getRange(adm.row, 7, 1, 4).setValues([['[]', '[]', hash_(code), String((adm.ver || 0) + 1)]]);
    log_(null, 'Nuevo código de administrador (desde la hoja)', '', adm.nombre, '');
  }
  aviso_('Nuevo código de administrador: ' + code + '\n\nLos dispositivos anteriores de ese administrador quedaron desconectados.');
}
function menuGenerar() {
  var r = generarPegar_();
  aviso_('Hoja PEGAR_EN_CONTEO lista con ' + r.n + ' registros.\n\nArchivo > Descargar > Microsoft Excel (.xlsx), ábralo y copie B6:U' + (5 + r.n) + ' al Excel de conteo con Pegado especial > Valores + Saltar blancos.');
}
function menuImagenes() {
  var n = vincularImagenes_();
  aviso_('Imágenes vinculadas: ' + n + '.\nLos archivos deben llamarse con el bloque, por ejemplo 1103.jpg, dentro de la carpeta "' + IMG_DIR + '".');
}
/** Diagnóstico desde el editor. */
function probar() {
  var t = Date.now(), ref = refData_();
  Logger.log('Catálogo: ' + ref.cat.length + ' bloques · imágenes: ' + ref.cat.filter(function (c) { return c[3]; }).length + ' · inventario anterior: ' + ref.inv.length + ' · ' + (Date.now() - t) + ' ms');
  var us = users_();
  Logger.log('Usuarios: ' + us.length + ' (' + us.filter(function (u) { return u.estado === 'Activo'; }).length + ' activos)');
  Logger.log('Registros: ' + rows_(SH.REG, NREG).length);
  t = Date.now(); invIndex_(); Logger.log('Índice de validación: ' + (Date.now() - t) + ' ms');
  Logger.log('TODO BIEN si llegó hasta aquí.');
}

/* ================= UTILIDADES ================= */
function hojaInicial_() {
  var ss = null;
  try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) {}
  var id = String(SS_ID || '').trim();
  var m = id.match(/\/d\/([a-zA-Z0-9_-]+)/); if (m) id = m[1];
  if (!ss && id) {
    try { ss = SpreadsheetApp.openById(id); }
    catch (e) { throw new Error('No pude abrir la hoja con el ID "' + id + '". Revise que sea una Hoja de cálculo de Google (no un .xlsx) y que copió bien el ID.'); }
  }
  if (!ss) throw new Error('Este proyecto no está vinculado a la hoja. Pegue el ID de su hoja en la línea var SS_ID = \'\'; al inicio de este archivo, guarde y vuelva a ejecutar configurar.');
  if (!ss.getSheetByName('REGISTROS') || !ss.getSheetByName('CATALOGO')) throw new Error('La hoja "' + ss.getName() + '" no tiene las pestañas REGISTROS y CATALOGO.');
  return ss;
}
function ss_() {
  var id = PropertiesService.getScriptProperties().getProperty('ssId');
  return id ? SpreadsheetApp.openById(id) : hojaInicial_();
}
function sh_(n) { return ss_().getSheetByName(n); }
function tz_() { return ss_().getSpreadsheetTimeZone() || Session.getScriptTimeZone(); }
function bump_() { PropertiesService.getScriptProperties().setProperty('ver', String(Date.now())); }
function ver_() { return PropertiesService.getScriptProperties().getProperty('ver') || '0'; }
function norm_(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim(); }
function str_(v) {
  if (v === null || v === undefined) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') return Utilities.formatDate(v, tz_(), 'yyyy-MM-dd');
  return String(v);
}
function blk_(v) { var s = str_(v).trim(); return /^\d{1,4}$/.test(s) ? ('0000' + s).slice(-4) : s; }
function ms_(v) { return Object.prototype.toString.call(v) === '[object Date]' ? v.getTime() : (Number(v) || 0); }
function day_(ms) { return Utilities.formatDate(new Date(ms), tz_(), 'yyyy-MM-dd'); }
function fmt_(d) { return Utilities.formatDate(d, tz_(), 'dd/MM/yyyy HH:mm'); }
function rows_(name, ncol) {
  var sh = sheetFor_(name), last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, ncol).getValues();
}
function sheetFor_(name) {
  if (name === SH.USR) return usrSheet_();
  if (name === SH.LOG) return logSheet_();
  if (name === SH.REG) return regSheet_();
  if (name === SH.UB) return ubSheet_();
  return sh_(name);
}
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try { return fn(); } finally { lock.releaseLock(); }
}
function json_(s, d) { try { return s ? JSON.parse(s) : d; } catch (e) { return d; } }
function parentFolder_() {
  var it = DriveApp.getFileById(ss_().getId()).getParents();
  return it.hasNext() ? it.next() : DriveApp.getRootFolder();
}
function folderByName_(name, create) {
  var p = parentFolder_(), it = p.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  return create ? p.createFolder(name) : null;
}
function fotosFolder_() {
  var props = PropertiesService.getScriptProperties(), id = props.getProperty('fotosFolder');
  if (id) { try { var f = DriveApp.getFolderById(id); if (!f.isTrashed()) return f; } catch (e) {} }
  var f2 = folderByName_(FOTOS_DIR, true);
  props.setProperty('fotosFolder', f2.getId());
  return f2;
}
function newSheet_(name, head, color) {
  var ss = ss_(), sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold').setBackground(color).setFontColor('#FFFFFF');
    sh.setFrozenRows(1);
    sh.getRange(1, 1, sh.getMaxRows(), head.length).setNumberFormat('@');
  }
  return sh;
}
function usrSheet_() { return newSheet_(SH.USR, USR_HEAD, '#7A1F1F'); }
function logSheet_() { return newSheet_(SH.LOG, LOG_HEAD, '#3D3D3D'); }
function ubSheet_() {
  var sh = sh_(SH.UB), mc = sh.getMaxColumns();
  if (mc < NUB) sh.insertColumnsAfter(mc, NUB - mc);
  if (!str_(sh.getRange(1, 13).getValue())) sh.getRange(1, 13).setValue('Revisión (no editar)');
  return sh;
}
function regSheet_() {
  var sh = sh_(SH.REG), mc = sh.getMaxColumns();
  if (mc < NREG) sh.insertColumnsAfter(mc, NREG - mc);
  var h = sh.getRange(1, 26, 1, 3).getValues()[0];
  if (!h[0] || !h[1] || !h[2]) sh.getRange(1, 26, 1, 3).setValues([['Usuario ID', 'Eliminado', 'Referencia validada']]);
  return sh;
}

/* ================= SEGURIDAD: códigos, sesiones y permisos ================= */
var ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function salt_() {
  var p = PropertiesService.getScriptProperties(), s = p.getProperty('salt');
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); p.setProperty('salt', s); }
  return s;
}
function genCode_() { var c = ''; for (var i = 0; i < 6; i++) c += ALFABETO.charAt(Math.floor(Math.random() * ALFABETO.length)); return c.slice(0, 3) + '-' + c.slice(3); }
function normCode_(c) { return String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
function hash_(code) {
  var b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt_() + '|' + normCode_(code), Utilities.Charset.UTF_8);
  return Utilities.base64Encode(b);
}
function sign_(s) { return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(s, salt_())).replace(/=+$/, ''); }
function authErr_(msg) { return new Error('AUTH|' + msg); }

function users_() {
  return rows_(SH.USR, NUSR).map(function (r, i) {
    return { row: i + 2, id: str_(r[0]), nombre: str_(r[1]), rol: str_(r[2]) || 'Contador', estado: str_(r[3]) || 'Activo',
      vence: ms_(r[4]) || (str_(r[4]) ? Date.parse(str_(r[4])) || 0 : 0), max: Math.max(1, Number(r[5]) || 1),
      devs: json_(str_(r[6]), []), reqs: json_(str_(r[7]), []), hash: str_(r[8]), ver: Number(r[9]) || 0, ultimo: ms_(r[10]) };
  }).filter(function (u) { return u.id; });
}
function userPublic_(u) { return { id: u.id, nombre: u.nombre, rol: u.rol, lvl: ROLES[u.rol] || 1, vence: u.vence }; }

/** Valida el token en cada llamada. Lee la hoja USUARIOS: desactivar a alguien surte efecto en su siguiente acción. */
function auth_(tok, minRol) {
  var p = String(tok || '').split('.');
  if (p.length !== 4 || sign_(p[0] + '.' + p[1] + '.' + p[2]) !== p[3]) throw authErr_('Ingrese su código para continuar.');
  var u = users_().filter(function (x) { return x.id === p[0]; })[0];
  if (!u) throw authErr_('Su usuario ya no existe.');
  if (u.estado === 'Baja') throw authErr_('Su acceso fue dado de baja.');
  if (u.estado !== 'Activo') throw authErr_('Su acceso está desactivado. Pida al administrador que lo active.');
  if (u.vence && Date.now() > u.vence) throw authErr_('Su acceso venció (' + fmt_(new Date(u.vence)) + '). Pida al administrador que lo renueve.');
  if (String(u.ver) !== p[2]) throw authErr_('Su código cambió. Ingrese el código nuevo.');
  if (!u.devs.some(function (d) { return d.id === p[1]; })) throw authErr_('Este dispositivo ya no está autorizado.');
  if ((ROLES[u.rol] || 1) < (ROLES[minRol || 'Contador'] || 1)) throw valErr_('No tiene permiso para esta acción.');
  u.dev = p[1]; u.lvl = ROLES[u.rol] || 1;
  return u;
}
function cache_() { return CacheService.getScriptCache(); }
function bumpCount_(key, ttl) { var c = cache_(), n = (Number(c.get(key)) || 0) + 1; c.put(key, String(n), ttl); return n; }

function api_login(code, dev, devName) {
  dev = String(dev || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
  if (dev.length < 8) throw new Error('Dispositivo no válido. Recargue la página.');
  var c = cache_();
  if ((Number(c.get('f:' + dev)) || 0) >= 5) throw new Error('Demasiados intentos con códigos incorrectos. Espere 15 minutos.');
  if ((Number(c.get('f:all')) || 0) >= 30) throw new Error('Ingreso bloqueado unos minutos por muchos intentos fallidos. Avise al administrador.');
  var h = hash_(code);
  return withLock_(function () {
    var u = users_().filter(function (x) { return x.hash && x.hash === h; })[0];
    if (!u) {
      bumpCount_('f:' + dev, 900); bumpCount_('f:all', 600);
      log_(null, 'Intento fallido de ingreso', '', 'Código: ' + normCode_(code).replace(/^(..).*/, '$1****'), dev + ' · ' + devName);
      throw new Error('Código incorrecto.');
    }
    if (u.estado === 'Baja') throw new Error('Este código fue dado de baja.');
    if (u.estado !== 'Activo') throw new Error('Su acceso está desactivado. Pida al administrador que lo active.');
    if (u.vence && Date.now() > u.vence) throw new Error('Su acceso venció. Pida al administrador que lo renueve.');
    var sh = usrSheet_(), name = String(devName || 'Dispositivo').slice(0, 60);
    if (!u.devs.some(function (d) { return d.id === dev; })) {
      if (u.devs.length >= u.max) {
        if (!u.reqs.some(function (d) { return d.id === dev; })) {
          u.reqs.push({ id: dev, n: name, t: Date.now() });
          sh.getRange(u.row, 8).setValue(JSON.stringify(u.reqs));
          log_(u, 'Solicitud de dispositivo nuevo', '', name, dev);
          bump_();
        }
        return { pending: true, msg: 'Su código ya está en uso en otro dispositivo. Se envió la solicitud al administrador: cuando la apruebe, vuelva a entrar.' };
      }
      u.devs.push({ id: dev, n: name, t: Date.now() });
      sh.getRange(u.row, 7).setValue(JSON.stringify(u.devs));
      log_(u, 'Dispositivo registrado', '', name, dev);
    }
    sh.getRange(u.row, 11).setValue(new Date());
    log_(u, 'Ingreso', '', '', dev);
    var t = u.id + '.' + dev + '.' + u.ver;
    return { token: t + '.' + sign_(t), me: userPublic_(u) };
  });
}
function api_logout(tok) { try { var u = auth_(tok); log_(u, 'Salida', '', '', u.dev); } catch (e) {} return true; }

/* ================= BITÁCORA ================= */
function log_(u, accion, reg, detalle, dev) {
  try {
    var sh = logSheet_(), r = sh.getLastRow() + 1;
    sh.getRange(r, 1, 1, NLOG).setValues([[fmt_(new Date()), u ? u.nombre : '—', u ? u.rol : '', accion, String(reg || ''), String(detalle || '').slice(0, 45000), String(dev || '')]]);
  } catch (e) {}
}
function diff_(a, b) {
  var keys = ['fecha', 'ubic', 'blk', 'desc', 'etq', 'b', 'r', 'm', 'marca', 'modelo', 'serie', 'obs', 'revisar', 'motivo', 'inst'], out = [];
  keys.forEach(function (k) { var x = a ? a[k] : '', y = b ? b[k] : ''; if (String(x == null ? '' : x) !== String(y == null ? '' : y)) out.push(k + ': ' + (x === '' || x == null ? '∅' : x) + ' → ' + (y === '' || y == null ? '∅' : y)); });
  var fa = (a && a.fotos || []).length, fb = (b && b.fotos || []).length; if (fa !== fb) out.push('fotos: ' + fa + ' → ' + fb);
  return out.join(' | ');
}

/* ================= DATOS DE REFERENCIA ================= */
function api_getRef(tok, knownRef) {
  var u = auth_(tok), rv = getKey_('refver');
  if (knownRef && knownRef === rv) return { same: true, refVer: rv, me: userPublic_(u) };
  var r = refData_(); r.me = userPublic_(u); r.refVer = rv; return r;
}
function refData_() {
  var cfg = sh_(SH.CFG).getRange(1, 1, 40, 6).getValues();
  var get = function (label) { for (var i = 0; i < 8; i++) if (norm_(cfg[i][0]) === norm_(label)) return str_(cfg[i][1]); return ''; };
  var col = function (c) { var out = []; for (var i = 9; i < 40; i++) { var v = str_(cfg[i][c]).trim(); if (v) out.push(v); } return out; };
  var corr = []; for (var i = 9; i < 40; i++) { var a = blk_(cfg[i][4]), b = blk_(cfg[i][5]); if (a && b) corr.push([a, b]); }
  var inst = get('Código de institución principal');
  var otros = get('Otros códigos de institución').split(/[,;\s]+/).filter(String);
  var cat = rows_(SH.CAT, 11).filter(function (r) { return str_(r[0]); }).map(function (r) {
    return [blk_(r[0]), str_(r[1]), str_(r[2]), str_(r[3]), str_(r[4]), str_(r[5]), str_(r[6]), str_(r[7]), str_(r[8]), str_(r[9]), str_(r[10])];
  });
  var inv = rows_(SH.INV, 8).filter(function (r) { return str_(r[0]); }).map(function (r) {
    return [str_(r[0]).trim(), str_(r[1]), str_(r[2]), str_(r[3]), str_(r[4]).trim(), str_(r[5]), str_(r[6]), isFinite(parseFloat(r[7])) ? Number(r[7]) : null];
  });
  // códigos registrados después del corte (Gestión › Configuración › Reglas de códigos)
  var catN = {}; cat.forEach(function (c) { catN[c[0]] = c[1]; });
  extraRows_().forEach(function (x) { inv.push([x.code, (catN[x.code.split('-')[1]] || '') + ' · agregado después del corte', '', '', x.serie, x.fecha, x.ubic, x.valor || null, 1]); });
  return { nombre: get('Institución'), inst: inst, insts: [inst].concat(otros), periodo: get('Período'),
    contadores: [], tipos: col(2), corrFam: corr, cat: cat, inv: inv, ssId: ss_().getId(), fotosUrl: fotosFolder_().getUrl(), appUrl: (function () { try { return ScriptApp.getService().getUrl() || ''; } catch (e) { return ''; } })() };
}

/* ================= VALIDACIONES OBLIGATORIAS ================= */
function cachePutBig_(key, obj) {
  var s = JSON.stringify(obj), c = cache_(), n = Math.ceil(s.length / 90000), map = {};
  for (var i = 0; i < n; i++) map[key + ':' + i] = s.slice(i * 90000, (i + 1) * 90000);
  map[key + ':n'] = String(n);
  try { c.putAll(map, 21600); } catch (e) {}
}
function cacheGetBig_(key) {
  var c = cache_(), n = Number(c.get(key + ':n')); if (!n) return null;
  var keys = []; for (var i = 0; i < n; i++) keys.push(key + ':' + i);
  var parts = c.getAll(keys), s = '';
  for (var j = 0; j < n; j++) { if (parts[keys[j]] == null) return null; s += parts[keys[j]]; }
  try { return JSON.parse(s); } catch (e) { return null; }
}
/** Códigos agregados después del corte (hoja G_CODIGOS_AGREGADOS); no crea la hoja si no existe. */
function extraRows_() {
  var sh = ss_().getSheetByName('G_CODIGOS_AGREGADOS'); if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues().filter(function (r) { return str_(r[0]).trim(); }).map(function (r) {
    var f = r[2] instanceof Date ? Utilities.formatDate(r[2], tz_(), 'yyyy-MM-dd') : str_(r[2]).trim();
    return { code: str_(r[0]).trim().toUpperCase(), ubic: str_(r[1]).trim(), fecha: f, valor: Number(r[3]) || 0, serie: str_(r[4]).trim() };
  });
}
function invIndex_() {
  var key = 'inv' + getKey_('refver'), ix = cacheGetBig_(key);
  if (ix) return ix;
  ix = { c: {}, s: {}, corr: [] };
  rows_(SH.INV, 5).forEach(function (r) {
    var code = norm_(r[0]); if (!code) return; ix.c[code] = 1;
    var se = norm_(r[4]); if (se) ix.s[se] = ix.s[se] ? 'DUP' : code;
  });
  extraRows_().forEach(function (x) { var code = norm_(x.code); ix.c[code] = 1; var se = norm_(x.serie); if (se) ix.s[se] = ix.s[se] ? 'DUP' : code; });
  var cfg = sh_(SH.CFG).getRange(10, 5, 30, 2).getValues();
  cfg.forEach(function (r) { var a = blk_(r[0]), b = blk_(r[1]); if (a && b) ix.corr.push([a, b]); });
  cachePutBig_(key, ix);
  return ix;
}
/** Reglas que no se pueden saltar. Devuelve el objeto (con la justificación incorporada) o lanza VAL|mensaje. */
function validate_(o, sh) {
  var b = Math.max(0, Number(o.b) || 0), r = Math.max(0, Number(o.r) || 0), m = Math.max(0, Number(o.m) || 0), q = b + r + m;
  var fotos = o.fotos || [], hasTipo = function (t) { return fotos.some(function (f) { return f.t === t; }); };
  if (q <= 0) throw valErr_('La cantidad total debe ser mayor que cero.');
  if (q > 5000) throw valErr_('Cantidad demasiado alta. Revise lo escrito.');
  var etq = norm_(o.etq);
  if (etq) {
    var ix = invIndex_(), code = ix.c[etq] ? etq : '', bySerie = false;
    if (!code && ix.s[etq] && ix.s[etq] !== 'DUP') { code = ix.s[etq]; bySerie = true; }
    if (code && o.blk) {
      var blk = code.split('-')[1];
      var corr = ix.corr.some(function (c) { return c[0] === blk && c[1] === o.blk; });
      if (blk !== o.blk && !corr) {
        if (q !== 1) throw valErr_('La etiqueta es de otra familia: registre 1 bien por cada etiqueta.');
        if (!hasTipo('ETIQUETA')) throw valErr_('Para reetiquetar falta la foto de la etiqueta (tipo "Etiqueta").');
      }
    }
    if (bySerie && q !== 1) throw valErr_('Un número de serie corresponde a un solo bien: la cantidad debe ser 1.');
    var last = sh.getLastRow();
    if (last >= 2) {
      var ids = sh.getRange(2, 1, last - 1, 1).getValues(), et = sh.getRange(2, 6, last - 1, 1).getValues(), dl = sh.getRange(2, 27, last - 1, 1).getValues();
      var dupAt = '';
      for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) !== String(o.id) && !str_(dl[i][0]) && norm_(et[i][0]) === etq) { dupAt = 'fila ' + (i + 2); break; }
      if (dupAt) {
        var just = String(o.just || '').trim();
        if (just.length < 5) throw valErr_('Esa etiqueta ya está registrada en otro bien. Escriba la justificación para guardarlo.');
        if (String(o.obs || '').indexOf('[ETIQUETA REPETIDA') < 0) o.obs = (String(o.obs || '') + ' [ETIQUETA REPETIDA: ' + just + ']').trim();
        o.revisar = true; if (!o.motivo) o.motivo = 'Etiqueta repetida';
      }
    }
  }
  if (m > 0 && !fotos.length) throw valErr_('Hay bienes en mal estado: tome al menos una foto.');
  if (!o.blk) {
    if (!fotos.length) throw valErr_('Bien fuera de catálogo: tome al menos una foto.');
    o.revisar = true; if (!o.motivo) o.motivo = 'Bien fuera del catálogo';
  }
  return o;
}

/* ================= ESTADO (registros + ubicaciones) ================= */
/**
 * Sincronización incremental: el celular envía desde cuándo tiene datos y solo recibe lo que cambió.
 * q = {since, ver, fullVer, locVer}. Si nada cambió responde {same:true} sin leer la hoja.
 */
function api_getState(tok, q) {
  var u = auth_(tok);
  q = (q && typeof q === 'object') ? q : {};
  var v = ver_(), fv = getKey_('fullver'), lv = getKey_('locver'), now = Date.now();
  if (q.ver && q.ver === v && q.fullVer === fv) return { same: true, me: userPublic_(u) };
  var full = !q.since || q.fullVer !== fv;
  var out = { now: now, ver: v, fullVer: fv, locVer: lv, full: full, me: userPublic_(u), today: day_(now) };
  out.rows = changedRows_(full ? 0 : Number(q.since) || 0).map(function (r) {
    if (!r.del) return r;
    if (u.lvl >= 2 || r.uid === u.id) return r;
    return { id: r.id, del: 'x', gone: true };
  });
  if (full || q.locVer !== lv) out.locs = locsOut_();
  return out;
}
function locsOut_() {
  return rows_(SH.UB, NUB).filter(function (r) { return str_(r[0]).trim(); }).map(function (r, i) {
    return { n: str_(r[0]).trim(), t: str_(r[1]), z: str_(r[2]), r: str_(r[3]), a: norm_(r[4]) !== 'NO', nueva: norm_(r[5]) === 'SI',
      motivo: str_(r[6]), por: str_(r[7]), nota: str_(r[8]), cerrada: norm_(r[9]) === 'SI', enRev: norm_(r[9]) === 'REVISION', rev: json_(str_(r[12]), null), fotos: json_(str_(r[11]), []), i: i };
  });
}
/** Lee solo la columna "Modificado" y luego únicamente las filas que cambiaron. */
function changedRows_(since) {
  var sh = regSheet_(), last = sh.getLastRow();
  if (last < 2) return [];
  if (!since) return sh.getRange(2, 1, last - 1, NREG).getValues().filter(function (r) { return str_(r[0]); }).map(regOut_);
  var ts = sh.getRange(2, 24, last - 1, 1).getValues(), idx = [];
  for (var i = 0; i < ts.length; i++) if (ms_(ts[i][0]) >= since) idx.push(i);
  if (!idx.length) return [];
  var blocks = [], s = idx[0], p = idx[0];
  for (var k = 1; k < idx.length; k++) { if (idx[k] === p + 1) { p = idx[k]; continue; } blocks.push([s, p]); s = p = idx[k]; }
  blocks.push([s, p]);
  if (blocks.length > 25) return sh.getRange(2, 1, last - 1, NREG).getValues().filter(function (r, i2) { return str_(r[0]) && ms_(r[23]) >= since; }).map(regOut_);
  var out = [];
  blocks.forEach(function (b) { sh.getRange(b[0] + 2, 1, b[1] - b[0] + 1, NREG).getValues().forEach(function (r) { if (str_(r[0])) out.push(regOut_(r)); }); });
  return out;
}
/** Estado completo (solo para usos internos). */
function state_(u) { return { ok: true }; }
function regOut_(r) {
  return { id: str_(r[0]), fecha: str_(r[1]), ubic: str_(r[2]).trim(), blk: blk_(r[3]), desc: blk_(r[3]) ? '' : str_(r[4]),
    etq: str_(r[5]).trim(), b: Number(r[7]) || 0, r: Number(r[8]) || 0, m: Number(r[9]) || 0,
    marca: str_(r[11]), modelo: str_(r[12]), serie: str_(r[13]), obs: str_(r[14]), revisar: norm_(r[15]) === 'SI', motivo: str_(r[16]),
    inst: str_(r[19]), cont: str_(r[20]), editadoPor: str_(r[21]), creado: ms_(r[22]), ts: ms_(r[23]), fotos: json_(str_(r[24]), []),
    uid: str_(r[25]), del: str_(r[26]), ref: json_(str_(r[27]), null) };
}
function regIn_(o) {
  var p = String(o.fecha || '').split('-');
  var fecha = p.length === 3 ? new Date(+p[0], +p[1] - 1, +p[2], 12) : new Date();
  var fotos = (o.fotos || []).slice(0, 12).map(function (f) { var x = { id: String(f.id), n: String(f.n), t: String(f.t || '') }; if (f.p) x.p = String(f.p).slice(0, 80); if (f.d) x.d = Number(f.d) || 0; return x; });
  var q = function (x) { return Math.max(0, Math.min(100000, Math.floor(Number(x) || 0))); };
  var b = q(o.b), r = q(o.r), m = q(o.m);
  var s = function (x, n) { return String(x == null ? '' : x).slice(0, n || 500); };
  return [s(o.id, 40), fecha, s(o.ubic, 120), s(o.blk, 10), s(o.bien || o.desc, 200), s(o.etq, 60), s(o.val, 40),
    b, r, m, b + r + m, s(o.marca, 80), s(o.modelo, 80), s(o.serie, 80), s(o.obs, 1000),
    o.revisar ? 'Sí' : '', s(o.motivo, 300), fotos.map(function (f) { return f.n; }).join(', '),
    fotos.map(function (f) { return 'https://drive.google.com/file/d/' + f.id + '/view'; }).join('\n'),
    s(o.inst, 20), s(o.cont, 120), s(o.editadoPor, 120), new Date(Number(o.creado) || Date.now()), new Date(), JSON.stringify(fotos),
    s(o.uid, 40), s(o.del, 200), o.ref ? JSON.stringify(o.ref) : ''];
}
function findRow_(sheet, id) {
  var last = sheet.getLastRow(); if (last < 2) return -1;
  var ids = sheet.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return -1;
}
function writeReg_(sheet, rowIdx, vals) {
  var fm = []; for (var c = 1; c <= NREG; c++) fm.push(c === 2 ? 'dd/mm/yyyy' : (c >= 8 && c <= 11) ? '0' : (c === 23 || c === 24) ? 'dd/mm/yyyy hh:mm' : '@');
  var rg = sheet.getRange(rowIdx, 1, 1, NREG);
  rg.setNumberFormats([fm]);
  rg.setValues([vals]);
}
/** Contador: solo lo suyo y del mismo día. Supervisor y Administrador: todo. */
/** Ubicación terminada: los contadores ya no pueden cambiar nada en ella; solo un supervisor o el administrador la reabre. */
function locCerrada_(name) {
  var sh = ubSheet_(), r = findLoc_(sh, name);
  return r > 0 && norm_(sh.getRange(r, 10).getValue()) === 'SI';
}
function checkLoc_(u, name) {
  if (u.lvl < 2 && name && locCerrada_(name)) throw valErr_('La ubicación ' + name + ' está cerrada. Pida a un supervisor que la reabra.');
}
function canEdit_(u, r) { return u.lvl >= 2 || (r.uid && r.uid === u.id && day_(r.creado) === day_(Date.now())); }
/** Quién tomó cada foto: las que ya tenía el registro conservan su autor; las nuevas quedan a nombre de quien guarda. */
function fotosAutor_(o, old, u) {
  var prev = {}; ((old && old.fotos) || []).forEach(function (f) { prev[f.id] = f; });
  o.fotos = (o.fotos || []).map(function (f) {
    var p = prev[f.id];
    if (p) return { id: f.id, n: f.n, t: f.t || '', p: p.p || (old && old.cont) || '', d: p.d || (old && old.creado) || 0 };
    var d = Number(f.d) || Date.now(); if (Math.abs(Date.now() - d) > 3 * 86400000) d = Date.now();
    return { id: f.id, n: f.n, t: f.t || '', p: u.nombre, d: d };
  });
}
/** Referencias: un supervisor o el administrador marca un registro como ejemplo validado (o lo quita). */
function api_setRef(tok, id, on, nota) {
  var u = auth_(tok, 'Supervisor');
  return withLock_(function () {
    var sh = regSheet_(), idx = findRow_(sh, id);
    if (idx < 0) throw valErr_('No se encontró el registro.');
    var old = regOut_(sh.getRange(idx, 1, 1, NREG).getValues()[0]);
    if (old.del) throw valErr_('Ese registro fue eliminado.');
    nota = String(nota || '').trim().slice(0, 300);
    var val = on ? JSON.stringify({ por: u.nombre, t: Date.now(), nota: nota }) : '';
    sh.getRange(idx, 28).setValue(val);
    sh.getRange(idx, 24).setValue(new Date());
    log_(u, on ? 'Validar referencia' : 'Quitar validación', id, old.ubic + ' · ' + (old.blk || old.desc) + (nota ? ' · ' + nota : ''), u.dev);
    bump_();
    return { ok: true, id: id };
  });
}

function api_saveRow(tok, o) {
  var u = auth_(tok);
  if (!o || !o.id || !o.ubic) throw valErr_('Registro incompleto');
  if (!/^[A-Za-z0-9_-]{4,40}$/.test(String(o.id))) throw valErr_('Identificador no válido');
  if ((o.fotos || []).some(function (f) { return /^local:/.test(String(f.id)); })) throw new Error('Fotos pendientes de subir');
  return withLock_(function () {
    var sh = regSheet_(), idx = findRow_(sh, o.id);
    if (idx > 0) {
      var old = regOut_(sh.getRange(idx, 1, 1, NREG).getValues()[0]);
      if (old.del) throw valErr_('Ese registro fue eliminado.');
      if (!canEdit_(u, old)) throw valErr_('Solo puede editar sus propios registros del día. Pida el cambio a un supervisor.');
      checkLoc_(u, old.ubic); if (norm_(o.ubic) !== norm_(old.ubic)) checkLoc_(u, o.ubic);
      validate_(o, sh);
      fotosAutor_(o, old, u);
      o.ref = (old.ref && u.lvl >= 2) ? old.ref : null;
      if (old.ref && !o.ref) log_(u, 'Validación retirada por edición', o.id, 'La editó un contador; un supervisor debe validarla de nuevo', u.dev);
      o.cont = old.cont; o.uid = old.uid; o.creado = old.creado;
      o.editadoPor = (u.id === old.uid) ? old.editadoPor : u.nombre;
      o.del = '';
      writeReg_(sh, idx, regIn_(o));
      log_(u, 'Editar', o.id, old.ubic + ' · ' + diff_(old, o), u.dev);
    } else {
      checkLoc_(u, o.ubic);
      validate_(o, sh);
      fotosAutor_(o, null, u); o.ref = null;
      o.cont = u.nombre; o.uid = u.id; o.creado = Number(o.creado) && Math.abs(Date.now() - Number(o.creado)) < 3 * 86400000 ? Number(o.creado) : Date.now(); o.editadoPor = ''; o.del = '';
      writeReg_(sh, sh.getLastRow() + 1, regIn_(o));
      log_(u, 'Crear', o.id, o.ubic + ' · ' + (o.blk || o.desc) + ' · ' + ((+o.b || 0) + (+o.r || 0) + (+o.m || 0)) + ' u.', u.dev);
    }
    bump_();
    return { ok: true, id: o.id };
  });
}
function api_deleteRow(tok, id) {
  var u = auth_(tok);
  return withLock_(function () {
    var sh = regSheet_(), idx = findRow_(sh, id);
    if (idx < 0) return { ok: true, id: id };
    var old = regOut_(sh.getRange(idx, 1, 1, NREG).getValues()[0]);
    if (old.del) return { ok: true, id: id };
    if (!canEdit_(u, old)) throw valErr_('Solo puede eliminar sus propios registros del día.');
    checkLoc_(u, old.ubic);
    if (u.lvl < 3 && bumpCount_('d:' + u.id, 3600) > MAX_BORRADOS_HORA) {
      usrSheet_().getRange(u.row, 4).setValue('Inactivo');
      log_(u, 'BLOQUEO AUTOMÁTICO', id, 'Intentó eliminar más de ' + MAX_BORRADOS_HORA + ' registros en una hora', u.dev);
      bump_();
      throw authErr_('Por seguridad se bloqueó su acceso: eliminó demasiados registros seguidos. Hable con el administrador.');
    }
    sh.getRange(idx, 27).setValue(fmt_(new Date()) + ' · ' + u.nombre);
    sh.getRange(idx, 24).setValue(new Date());
    log_(u, 'Eliminar', id, JSON.stringify({ ubic: old.ubic, blk: old.blk || old.desc, etq: old.etq, b: old.b, r: old.r, m: old.m, cont: old.cont }), u.dev);
    bump_();
    return { ok: true, id: id };
  });
}
function api_restoreRow(tok, id) {
  var u = auth_(tok);
  return withLock_(function () {
    var sh = regSheet_(), idx = findRow_(sh, id);
    if (idx < 0) throw valErr_('No se encontró el registro.');
    var old = regOut_(sh.getRange(idx, 1, 1, NREG).getValues()[0]);
    if (!old.del) return { ok: true, id: id };
    if (!canEdit_(u, old)) throw valErr_('Solo un supervisor puede restaurar este registro.');
    checkLoc_(u, old.ubic);
    sh.getRange(idx, 27).setValue('');
    sh.getRange(idx, 24).setValue(new Date());
    log_(u, 'Restaurar', id, old.ubic + ' · ' + (old.blk || old.desc), u.dev);
    bump_();
    return { ok: true, id: id };
  });
}

/* ================= UBICACIONES ================= */
function findLoc_(sh, name) {
  var last = sh.getLastRow(); if (last < 2) return -1;
  var v = sh.getRange(2, 1, last - 1, 1).getValues(), n = norm_(name);
  for (var i = 0; i < v.length; i++) if (norm_(v[i][0]) === n) return i + 2;
  return -1;
}
function api_addLoc(tok, o) {
  var u = auth_(tok);
  var name = String(o.n || '').trim().toUpperCase().slice(0, 120);
  if (name.length < 2) throw valErr_('Nombre de ubicación vacío');
  return withLock_(function () {
    var sh = ubSheet_();
    if (findLoc_(sh, name) < 0) {
      var r = sh.getLastRow() + 1;
      sh.getRange(r, 1).setNumberFormat('@');
      sh.getRange(r, 1, 1, NUB).setValues([[name, String(o.t || '').slice(0, 60), String(o.z || '').slice(0, 60), '', 'Sí', 'Sí', String(o.nota || '').slice(0, 300), u.nombre, '', '', '', '[]', '']]);
      log_(u, 'Agregar ubicación', '', name, u.dev);
    }
    bumpKey_('locver'); bump_();
    return { ok: true };
  });
}
function api_setLoc(tok, name, patch) {
  var u = auth_(tok);
  return withLock_(function () {
    var sh = ubSheet_(), r = findLoc_(sh, name);
    var cerr = r > 0 && norm_(sh.getRange(r, 10).getValue()) === 'SI';
    if ('cerrada' in patch && u.lvl < 2) throw valErr_(patch.cerrada ? 'Solo un supervisor o el administrador puede cerrar una ubicación. Use "Solicitar revisión".' : 'Solo un supervisor o el administrador puede reabrir una ubicación cerrada.');
    if (cerr && u.lvl < 2) throw valErr_('La ubicación ' + name + ' está cerrada. Pida a un supervisor que la reabra.');
    if (r < 0) { r = sh.getLastRow() + 1; sh.getRange(r, 1, 1, NUB).setValues([[String(name).slice(0, 120), '', '', '', 'Sí', 'Sí', 'Creada al guardar datos', u.nombre, '', '', '', '[]', '']]); }
    if ('nota' in patch) sh.getRange(r, 9).setValue(String(patch.nota || '').slice(0, 1000));
    if ('cerrada' in patch) { revisionSet_(sh, r, u, name, patch.cerrada ? 'cerrar' : 'reabrir', ''); }
    if (patch.fotoAdd || patch.fotoDel) {
      var fotos = json_(str_(sh.getRange(r, 12).getValue()), []);
      if (patch.fotoAdd) fotos.push({ id: String(patch.fotoAdd.id), n: String(patch.fotoAdd.n) });
      if (patch.fotoDel) fotos = fotos.filter(function (f) { return f.id !== patch.fotoDel; });
      sh.getRange(r, 11).setValue(fotos.map(function (f) { return f.n; }).join(', '));
      sh.getRange(r, 12).setValue(JSON.stringify(fotos));
    }
    bumpKey_('locver'); bump_();
    return { ok: true };
  });
}

/* ================= REVISIÓN DE UBICACIONES =================
 * Estados (columna Terminada): vacío = en proceso · "Revisión" = el contador pidió revisión · "Sí" = cerrada por un supervisor.
 * Columna 13 guarda el último ciclo: {sol:{por,uid,t,nota}, ate:{por,t}, res:{tipo,por,t,nota}}. */
function api_revision(tok, name, accion, nota) {
  var u = auth_(tok);
  return withLock_(function () {
    var sh = ubSheet_(), r = findLoc_(sh, name);
    if (r < 0) throw valErr_('No existe la ubicación ' + name + '.');
    revisionSet_(sh, r, u, name, String(accion || ''), String(nota || '').trim().slice(0, 300));
    return { ok: true };
  });
}
function revisionSet_(sh, r, u, name, accion, nota) {
  var est = norm_(sh.getRange(r, 10).getValue()), rev = json_(str_(sh.getRange(r, 13).getValue()), null) || {}, now = Date.now();
  var sup = u.lvl >= 2, put = function (e, label) {
    sh.getRange(r, 10).setValue(e); sh.getRange(r, 13).setValue(JSON.stringify(rev));
    log_(u, label, '', name + (nota ? ' · ' + nota : ''), u.dev); bumpKey_('locver'); bump_();
  };
  if (accion === 'solicitar') {
    if (est === 'SI') throw valErr_('La ubicación ' + name + ' ya está cerrada.');
    if (est === 'REVISION') return;
    rev = { sol: { por: u.nombre, uid: u.id, t: now, nota: nota } }; put('Revisión', 'Solicitar revisión'); return;
  }
  if (accion === 'cancelar') {
    if (est !== 'REVISION') return;
    if (!sup && !(rev.sol && rev.sol.uid === u.id)) throw valErr_('Solo quien pidió la revisión o un supervisor puede cancelarla.');
    rev.res = { tipo: 'cancelada', por: u.nombre, t: now, nota: nota }; put('', 'Cancelar solicitud de revisión'); return;
  }
  if (!sup) throw valErr_('Solo un supervisor o el administrador puede revisar, cerrar o reabrir ubicaciones.');
  if (accion === 'atender') {
    if (est !== 'REVISION') throw valErr_('Esa ubicación ya no está esperando revisión.');
    rev.ate = { por: u.nombre, t: now }; put('Revisión', 'Atender revisión'); return;
  }
  if (accion === 'devolver') {
    if (nota.length < 3) throw valErr_('Escriba qué hay que corregir.');
    if (est === 'SI') throw valErr_('La ubicación está cerrada: use Reabrir.');
    rev.res = { tipo: 'devuelta', por: u.nombre, t: now, nota: nota }; put('', 'Devolver ubicación'); return;
  }
  if (accion === 'cerrar') {
    if (est === 'SI') return;
    if (!rev.sol || rev.res) rev = { sol: null };
    rev.res = { tipo: 'cerrada', por: u.nombre, t: now, nota: nota }; put('Sí', 'Cerrar ubicación (revisada)'); return;
  }
  if (accion === 'reabrir') {
    if (est !== 'SI') return;
    rev.res = { tipo: 'reabierta', por: u.nombre, t: now, nota: nota }; put('', 'Reabrir ubicación'); return;
  }
  throw valErr_('Acción no válida.');
}

/* ================= FOTOS E IMÁGENES ================= */
function api_uploadPhoto(tok, b64, name) {
  var u = auth_(tok);
  if (String(b64 || '').length > 14000000) throw valErr_('La foto es demasiado grande.');
  var folder = fotosFolder_();
  var clean = String(name || 'foto.jpg').replace(/[\/\\:*?"<>|#%]+/g, '-').slice(0, 120);
  if (!/\.jpe?g$/i.test(clean)) clean += '.jpg';
  return withLock_(function () {
    var n = clean;
    while (folder.getFilesByName(n).hasNext()) n = n.replace(/(\.jpe?g)$/i, '-b$1');
    var file = folder.createFile(Utilities.newBlob(Utilities.base64Decode(b64), 'image/jpeg', n));
    log_(u, 'Foto', '', n, u.dev);
    return { id: file.getId(), n: n };
  });
}
function api_getImage(tok, id) {
  auth_(tok);
  var file = DriveApp.getFileById(id), ok = false;
  var allowed = [fotosFolder_().getId()]; var img = folderByName_(IMG_DIR, false); if (img) allowed.push(img.getId());
  var ps = file.getParents(); while (ps.hasNext()) if (allowed.indexOf(ps.next().getId()) >= 0) ok = true;
  if (!ok) throw new Error('Archivo no permitido');
  var b = file.getBlob();
  return 'data:' + b.getContentType() + ';base64,' + Utilities.base64Encode(b.getBytes());
}
function vincularImagenes_() {
  var folder = folderByName_(IMG_DIR, false); if (!folder) return 0;
  var map = {}, it = folder.getFiles();
  while (it.hasNext()) { var f = it.next(), m = f.getName().match(/^(\d{4})\.(jpe?g|png|webp)$/i); if (m) map[m[1]] = f.getId(); }
  var sh = sh_(SH.CAT), last = sh.getLastRow(); if (last < 2) return 0;
  var codes = sh.getRange(2, 1, last - 1, 1).getValues(), out = [], n = 0;
  for (var i = 0; i < codes.length; i++) { var id = map[blk_(codes[i][0])] || ''; if (id) n++; out.push([id]); }
  sh.getRange(2, 4, out.length, 1).setValues(out);
  bumpKey_('refver'); bump_();
  return n;
}

/* ================= PANEL EQUIPO (solo Administrador) ================= */
function adminData_() {
  var us = users_().map(function (u) {
    return { id: u.id, nombre: u.nombre, rol: u.rol, estado: u.estado, vence: u.vence, max: u.max, devs: u.devs, reqs: u.reqs, ultimo: u.ultimo };
  });
  var lr = logSheet_(), last = lr.getLastRow(), log = [];
  if (last >= 2) { var from = Math.max(2, last - 199); log = lr.getRange(from, 1, last - from + 1, NLOG).getValues().reverse().map(function (r) { return r.map(str_); }); }
  return { users: us, log: log };
}
function api_admin_list(tok) { auth_(tok, 'Administrador'); return adminData_(); }
function crearUsuario_(o, by) {
  var nombre = String(o.nombre || '').trim().toUpperCase().slice(0, 80);
  if (nombre.length < 3) throw new Error('Escriba el nombre completo.');
  var rol = ROLES[o.rol] ? o.rol : 'Contador';
  var us = users_();
  if (us.some(function (u) { return u.estado !== 'Baja' && norm_(u.nombre) === norm_(nombre); })) throw new Error('Ya existe una persona activa con ese nombre.');
  var code, h, tries = 0;
  do { code = genCode_(); h = hash_(code); tries++; } while (us.some(function (u) { return u.hash === h; }) && tries < 20);
  var id = 'U' + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 1296).toString(36).toUpperCase();
  var sh = usrSheet_(), r = sh.getLastRow() + 1;
  sh.getRange(r, 1, 1, NUSR).setNumberFormat('@');
  sh.getRange(r, 1, 1, NUSR).setValues([[id, nombre, rol, 'Activo', o.vence ? new Date(Number(o.vence)) : '', String(Math.max(1, Math.min(10, Number(o.max) || 1))), '[]', '[]', h, '0', '']]);
  if (o.vence) sh.getRange(r, 5).setNumberFormat('dd/mm/yyyy hh:mm');
  log_(by, 'Agregar persona', '', nombre + ' · ' + rol, by ? by.dev : '');
  return { code: code, id: id };
}
function api_admin_addUser(tok, o) {
  var u = auth_(tok, 'Administrador');
  return withLock_(function () { var r = crearUsuario_(o || {}, u); bump_(); var d = adminData_(); d.code = r.code; d.codeFor = String(o.nombre || '').toUpperCase(); return d; });
}
function api_admin_update(tok, id, patch) {
  var u = auth_(tok, 'Administrador');
  return withLock_(function () {
    var t = users_().filter(function (x) { return x.id === id; })[0]; if (!t) throw new Error('No existe esa persona.');
    var sh = usrSheet_(), changes = [];
    if (t.id === u.id && ((patch.estado && patch.estado !== 'Activo') || (patch.rol && patch.rol !== 'Administrador'))) throw new Error('No puede desactivarse ni quitarse el rol de administrador a usted mismo.');
    if (patch.nombre != null) { var nm = String(patch.nombre).trim().toUpperCase().slice(0, 80); if (nm.length < 3) throw new Error('Nombre muy corto.'); sh.getRange(t.row, 2).setValue(nm); changes.push('nombre → ' + nm); }
    if (patch.rol && ROLES[patch.rol]) { sh.getRange(t.row, 3).setValue(patch.rol); changes.push('rol → ' + patch.rol); }
    if (patch.estado && ['Activo', 'Inactivo', 'Baja'].indexOf(patch.estado) >= 0) {
      sh.getRange(t.row, 4).setValue(patch.estado); changes.push('estado → ' + patch.estado);
      if (patch.estado === 'Baja') sh.getRange(t.row, 7, 1, 4).setValues([['[]', '[]', '', String(t.ver + 1)]]);
    }
    if ('vence' in patch) { var c = sh.getRange(t.row, 5); if (patch.vence) { c.setNumberFormat('dd/mm/yyyy hh:mm'); c.setValue(new Date(Number(patch.vence))); changes.push('vence → ' + fmt_(new Date(Number(patch.vence)))); } else { c.setValue(''); changes.push('sin vencimiento'); } }
    if (patch.max != null) { var mx = Math.max(1, Math.min(10, Number(patch.max) || 1)); sh.getRange(t.row, 6).setValue(String(mx)); changes.push('máx. dispositivos → ' + mx); }
    log_(u, 'Modificar persona', '', t.nombre + ' · ' + changes.join(', '), u.dev);
    bump_();
    return adminData_();
  });
}
function api_admin_newCode(tok, id) {
  var u = auth_(tok, 'Administrador');
  return withLock_(function () {
    var us = users_(), t = us.filter(function (x) { return x.id === id; })[0]; if (!t) throw new Error('No existe esa persona.');
    if (t.estado === 'Baja') throw new Error('Esa persona está dada de baja.');
    var code, h; do { code = genCode_(); h = hash_(code); } while (us.some(function (x) { return x.hash === h; }));
    usrSheet_().getRange(t.row, 7, 1, 4).setValues([['[]', '[]', h, String(t.ver + 1)]]);
    log_(u, 'Nuevo código', '', t.nombre + ' (se desconectaron sus dispositivos)', u.dev);
    bump_();
    var d = adminData_(); d.code = code; d.codeFor = t.nombre; d.self = t.id === u.id; return d;
  });
}
function api_admin_device(tok, id, devId, accion) {
  var u = auth_(tok, 'Administrador');
  return withLock_(function () {
    var t = users_().filter(function (x) { return x.id === id; })[0]; if (!t) throw new Error('No existe esa persona.');
    if (t.id === u.id && accion === 'quitar' && devId === u.dev) throw new Error('No puede quitar el dispositivo que está usando ahora.');
    var d = t.reqs.filter(function (x) { return x.id === devId; })[0] || t.devs.filter(function (x) { return x.id === devId; })[0];
    if (accion === 'aprobar' && d) { t.reqs = t.reqs.filter(function (x) { return x.id !== devId; }); if (!t.devs.some(function (x) { return x.id === devId; })) t.devs.push({ id: d.id, n: d.n, t: Date.now() }); t.max = Math.max(t.max, t.devs.length); }
    if (accion === 'rechazar') t.reqs = t.reqs.filter(function (x) { return x.id !== devId; });
    if (accion === 'quitar') t.devs = t.devs.filter(function (x) { return x.id !== devId; });
    usrSheet_().getRange(t.row, 6, 1, 3).setValues([[String(t.max), JSON.stringify(t.devs), JSON.stringify(t.reqs)]]);
    log_(u, 'Dispositivo: ' + accion, '', t.nombre + ' · ' + (d ? d.n : devId), u.dev);
    bump_();
    return adminData_();
  });
}
/** Terminar jornada: desactiva a todos los contadores. Iniciar: los activa con hora de vencimiento opcional. */
function api_admin_jornada(tok, accion, vence) {
  var u = auth_(tok, 'Administrador');
  return withLock_(function () {
    var sh = usrSheet_(), n = 0;
    users_().forEach(function (t) {
      if (t.rol !== 'Contador' || t.estado === 'Baja') return;
      if (accion === 'terminar' && t.estado === 'Activo') { sh.getRange(t.row, 4).setValue('Inactivo'); n++; }
      if (accion === 'iniciar') { sh.getRange(t.row, 4).setValue('Activo'); var c = sh.getRange(t.row, 5); if (vence) { c.setNumberFormat('dd/mm/yyyy hh:mm'); c.setValue(new Date(Number(vence))); } else c.setValue(''); n++; }
    });
    log_(u, accion === 'terminar' ? 'Terminar jornada' : 'Iniciar jornada', '', n + ' contadores' + (accion === 'iniciar' && vence ? ' · hasta ' + fmt_(new Date(Number(vence))) : ''), u.dev);
    bump_();
    var d = adminData_(); d.n = n; return d;
  });
}

/* ================= RESPALDOS ================= */
function respaldo() {
  var ss = ss_(), folder = folderByName_(BACKUP_DIR, true);
  var copy = DriveApp.getFileById(ss.getId()).makeCopy('Respaldo ' + Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd HHmm') + ' · ' + ss.getName(), folder);
  var files = [], it = folder.getFiles(); while (it.hasNext()) files.push(it.next());
  files.sort(function (a, b) { return b.getDateCreated() - a.getDateCreated(); });
  files.slice(BACKUP_KEEP).forEach(function (f) { f.setTrashed(true); });
  log_(null, 'Respaldo automático', '', copy.getName(), '');
  return copy.getName();
}
function instalarRespaldo_() {
  var has = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'respaldo'; });
  if (!has) ScriptApp.newTrigger('respaldo').timeBased().everyDays(1).atHour(22).create();
}

/* ================= HOJA PARA EL EXCEL ================= */
function api_export(tok) { auth_(tok, 'Supervisor'); var r = generarPegar_(); return { n: r.n, nuevas: r.nuevas, xlsx: 'https://docs.google.com/spreadsheets/d/' + ss_().getId() + '/export?format=xlsx' }; }
function generarPegar_() {
  var ss = ss_();
  var rowsAll = rows_(SH.REG, NREG).filter(function (r) { return str_(r[0]); }).map(regOut_).filter(function (r) { return !r.del; });
  var locs = rows_(SH.UB, NUB).filter(function (r) { return str_(r[0]).trim(); }).map(function (r, i) { return { n: str_(r[0]).trim(), nueva: norm_(r[5]) === 'SI', i: i }; });
  var ord = {}; locs.forEach(function (l) { ord[norm_(l.n)] = l.nueva ? 5000 + l.i : l.i; });
  var catD = {}; rows_(SH.CAT, 2).forEach(function (r) { catD[blk_(r[0])] = str_(r[1]); });
  var oi = function (u) { var k = norm_(u); return k in ord ? ord[k] : 9999; };
  var rows = rowsAll.sort(function (a, b) { return (oi(a.ubic) - oi(b.ubic)) || (a.creado - b.creado); });
  var sh = ss.getSheetByName(SH.PEG) || ss.insertSheet(SH.PEG);
  sh.clear();
  var W = 39, out = [];
  rows.forEach(function (r) {
    var a = []; for (var i = 0; i < W; i++) a.push('');
    var p = r.fecha.split('-');
    a[1] = new Date(+p[0], +p[1] - 1, +p[2], 12); a[2] = r.ubic; a[4] = r.etq;
    a[5] = r.blk ? (r.blk + ' - ' + (catD[r.blk] || '')) : r.desc;
    a[8] = r.b || ''; a[9] = r.r || ''; a[10] = r.m || '';
    a[15] = [r.marca, r.modelo].filter(String).join(' ') + (r.serie ? ((r.marca || r.modelo) ? ' · ' : '') + 'S/N ' + r.serie : '');
    a[16] = [r.revisar ? '[REVISAR: ' + r.motivo + ']' : '', r.obs].filter(String).join(' ');
    var main = (r.fotos || []).filter(function (f) { return !f.t; })[0] || (r.fotos || [])[0];
    a[17] = main ? 'https://drive.google.com/file/d/' + main.id + '/view' : '';
    a[20] = r.cont; a[38] = r.inst;
    out.push(a);
  });
  var nuevas = locs.filter(function (l) { return l.nueva; }).map(function (l) { return l.n; });
  sh.getRange(1, 1).setValue('PEGAR EN CONTEO · Archivo > Descargar > Excel. Copie B6:U' + (5 + rows.length) + ' → Pegado especial → Valores + Saltar blancos.');
  sh.getRange(2, 1).setValue(nuevas.length ? 'Antes agregue al final de CONFIG estas ubicaciones nuevas: ' + nuevas.join(', ') : 'No hay ubicaciones nuevas.');
  sh.getRange(3, 1).setValue('Generado: ' + fmt_(new Date()) + ' · registros eliminados no se incluyen');
  var H = []; for (var i = 0; i < W; i++) H.push('');
  H[1] = 'Fecha'; H[2] = 'Ubicación'; H[4] = 'ETIQUETA QUE TIENE'; H[5] = 'BIEN SEGÚN CATÁLOGO'; H[8] = 'Bueno'; H[9] = 'Regular'; H[10] = 'Malo';
  H[15] = 'Marca / modelo / serie'; H[16] = 'Observaciones'; H[17] = 'Foto'; H[20] = 'Contado por'; H[38] = 'Inst.';
  sh.getRange(5, 1, 1, W).setValues([H]).setFontWeight('bold');
  if (out.length) {
    sh.getRange(6, 1, out.length, W).setNumberFormat('@');
    sh.getRange(6, 2, out.length, 1).setNumberFormat('dd/mm/yyyy');
    sh.getRange(6, 9, out.length, 3).setNumberFormat('0');
    sh.getRange(6, 1, out.length, W).setValues(out);
  }
  sh.setFrozenRows(5);
  return { n: out.length, nuevas: nuevas };
}
