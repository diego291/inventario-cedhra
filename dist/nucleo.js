/* NÚCLEO DEL SISTEMA DE INVENTARIO · generado por build.py — no editar aquí, editar src/ */
var NUCLEO_VERSION = '8.7.2';
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

/**
 * MOTOR DE CODIFICACIÓN — réplica exacta de la lógica del Excel "Conteo_Fisico_Inventario v10".
 * Cada bloque indica la hoja y columna del Excel que reproduce. No tiene dependencias:
 * corre igual en Apps Script (servidor), en el navegador y en Node (pruebas).
 *
 * Entrada (in):
 *   cfg      {nombre, inst, otrasInst[], periodo, corte, director, encargado, e1,e2,e3, modo, consDesde, consSerie}
 *   ubic     [{n, tipo, edif, resp, activa}]  -> CONFIG D6:H205 en su orden (puede traer huecos con n vacío)
 *   consBlq  ['5404','11674-1133',...]         -> CONFIG "Bloques a conservar completos"
 *   rc       [['6118','0124'],...]             -> CONFIG "Corregir familia"
 *   cat      [{c, manual, inst, usar}]         -> CATALOGO A,D,E,G en su orden
 *   rubros   [['01','MAQUINARIA…'],...]        -> nombres de rubro (CALC K:L)
 *   eq       [['texto original','UBICACIÓN'],...] -> EQUIVALENCIAS A,C
 *   inv      [{code, inst, blk, correl, desc, marca, modelo, serie, fecha, valor, calidad, asig, manual}]
 *   conteo   [{fecha, ubic, etq, bien, b, r, m, mms, obs, foto, cont, instSel, id?}] en el orden de las filas
 */
var Motor = (function () {
  'use strict';
  var RECICLAR = 'Reciclar códigos anteriores';

  function S(x) { return x === null || x === undefined ? '' : String(x); }
  function U(x) { return S(x).toUpperCase(); }                  // Excel compara texto sin distinguir mayúsculas
  function Nn(x) { var v = Number(x); return (x === '' || x === null || x === undefined || isNaN(v)) ? 0 : v; }  // N()
  function pad4(n) { n = Math.round(Number(n)); var s = String(Math.abs(n)); while (s.length < 4) s = '0' + s; return (n < 0 ? '-' : '') + s; }  // TEXT(n,"0000")
  function isCode(s) { s = S(s); return s.length >= 15 && s.charAt(5) === '-' && s.charAt(10) === '-'; }
  function hasDash(s) { return S(s).indexOf(' - ') >= 0; }
  function serCand(s) { s = S(s); return !hasDash(s) && !isCode(s) && s.length > 4; }
  function isNumText(s) { return /^\s*[+-]?(\d+(\.\d*)?|\.\d+)\s*$/.test(S(s)); }   // ISNUMBER(-F)
  function trim(s) { return S(s).replace(/\s+/g, ' ').trim(); }                  // TRIM de Excel
  function fmtDMY(d) { d = S(d).slice(0, 10); var p = d.split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : d; }
  function money(v) { var n = Number(v) || 0; var s = n.toFixed(2).split('.'); return s[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + s[1]; }

  function compute(input) {
    var cfg = input.cfg || {};
    var reciclar = S(cfg.modo) === RECICLAR;
    var E1 = S(cfg.e1) || 'BUENO', E2 = S(cfg.e2) || 'REGULAR', E3 = S(cfg.e3) || 'MALO';

    /* ---------- CONFIG: ubicaciones (LST_UBIC = D6:D205 con sus huecos) ---------- */
    var ubic = (input.ubic || []).map(function (u) { return { n: S(u.n), tipo: S(u.tipo), edif: S(u.edif), resp: S(u.resp), activa: S(u.activa) }; });
    var locIdx = {};   // MATCH(C, LST_UBIC, 0) -> posición 1..n (primera coincidencia)
    ubic.forEach(function (u, i) { if (u.n !== '' && !(U(u.n) in locIdx)) locIdx[U(u.n)] = i + 1; });
    function locOf(n) { var i = locIdx[U(n)]; return i ? ubic[i - 1] : null; }

    /* ---------- CATALOGO ---------- */
    var cat = (input.cat || []).map(function (c) {
      var code = S(c.c), desc = code === '' ? '' : (S(c.inst) !== '' ? S(c.inst) : S(c.manual));
      return { c: code, manual: S(c.manual), inst: S(c.inst), usar: S(c.usar), desc: desc };
    });
    var rubroName = {}; (input.rubros || []).forEach(function (r) { rubroName[S(r[0])] = S(r[1]); });
    var catByCode = {};  // MATCH(X, CAT_COD, 0) -> primera fila
    cat.forEach(function (c, i) { if (c.c !== '' && !(U(c.c) in catByCode)) catByCode[U(c.c)] = i; });
    function catDesc(code) { var i = catByCode[U(code)]; return i === undefined ? null : cat[i].desc; }
    function catRubro(code) { var i = catByCode[U(code)]; if (i === undefined) return null; var c = cat[i].c; return c === '' ? '' : (rubroName[c.slice(0, 2)] || ''); }
    var descIdx = {}; cat.forEach(function (c, i) { if (!(U(c.desc) in descIdx)) descIdx[U(c.desc)] = i; });

    /* ---------- EQUIVALENCIAS ---------- */
    var eq = {}; (input.eq || []).forEach(function (e) { if (S(e[0]) !== '' && !(U(e[0]) in eq)) eq[U(e[0])] = S(e[1]); });

    /* ---------- INVENTARIO_ANTERIOR (ordenado por código, como la hoja) ---------- */
    var inv = (input.inv || []).filter(function (r) { return S(r.code) !== ''; }).map(function (r) {
      var o = {
        code: S(r.code), inst: S(r.inst), blk: S(r.blk), correl: Nn(r.correl), desc: S(r.desc), marca: S(r.marca), modelo: S(r.modelo),
        serie: S(r.serie), fecha: S(r.fecha).slice(0, 10), valor: Nn(r.valor), calidad: S(r.calidad), asig: S(r.asig), manual: S(r.manual),
        reqU: S(r.reqU), extra: !!r.extra   // (extensión de la app) código agregado después del corte: solo se conserva en su ubicación
      };
      if (o.inst === '') o.inst = o.code.slice(0, 5);
      if (o.blk === '') o.blk = o.code.slice(6, 10);
      o.N = o.inst + '-' + o.blk;                                   // N  Clave inst-bloque
      var m = eq[U(o.asig)]; o.M = (m === undefined) ? 'POR DEFINIR (REVISAR)' : m;   // M  Ubicación estándar
      return o;
    });
    inv.sort(function (a, b) { return a.code < b.code ? -1 : a.code > b.code ? 1 : 0; });
    var byN = {}, codeIdx = {}, serieCount = {}, serieIdx = {};
    inv.forEach(function (o, i) {
      o.i = i;
      (byN[U(o.N)] = byN[U(o.N)] || []).push(o);
      if (!(U(o.code) in codeIdx)) codeIdx[U(o.code)] = i;
      if (o.serie !== '') { var k = U(o.serie); serieCount[k] = (serieCount[k] || 0) + 1; if (!(k in serieIdx)) serieIdx[k] = i; }
    });
    // P (orden reciclaje: 1 = más nuevo), AG (orden fecha: 1 = más antiguo), W (en sistema por bloque)
    Object.keys(byN).forEach(function (k) {
      var g = byN[k];
      var d = g.slice().sort(function (a, b) { return a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : b.correl - a.correl; });
      d.forEach(function (o, j) { o.P = j + 1; });
      var a = g.slice().sort(function (x, y) { return x.fecha < y.fecha ? -1 : x.fecha > y.fecha ? 1 : x.correl - y.correl; });
      a.forEach(function (o, j) { o.AG = j + 1; });
      g.forEach(function (o) { o.W = g.length; });
    });
    function nGroup(n) { return byN[U(n)] || []; }
    function maxCorrel(n) { var g = nGroup(n), m = 0; g.forEach(function (o) { if (o.correl > m) m = o.correl; }); return g.length ? m : 0; }
    var consSet = {}; (input.consBlq || []).forEach(function (b) { if (S(b) !== '') consSet[U(b)] = 1; });
    var rcMap = {}; (input.rc || []).forEach(function (p) { if (S(p[0]) !== '' && !(U(p[0]) in rcMap)) rcMap[U(p[0])] = S(p[1]); });
    var consDesde = S(cfg.consDesde).slice(0, 10), consSerie = S(cfg.consSerie) === 'Sí';
    inv.forEach(function (o) {
      // Y ¿RESERVADO?
      if (o.manual === 'No') o.Y = '';
      else o.Y = (o.manual === 'Sí' || (consDesde !== '' && /^\d{4}-\d\d-\d\d$/.test(consDesde) && o.fecha >= consDesde) ||
        (consSerie && o.serie.length > 0) || consSet[U(o.blk)] || consSet[U(o.N)]) ? 'Sí' : '';
      // AF Familia correcta (corrección de familia)
      o.AF = (U(o.blk) in rcMap) ? rcMap[U(o.blk)] : '';
    });

    /* ---------- CONTEO (fila por fila) ---------- */
    var rows = (input.conteo || []).map(function (c, j) {
      var r = {
        j: j, ROW: j + 6, id: c.id === undefined ? null : c.id, fecha: S(c.fecha).slice(0, 10), fechaFull: S(c.fecha), C: S(c.ubic), E: S(c.etq), F: S(c.bien),
        I: Nn(c.b), J: Nn(c.r), K: Nn(c.m), P: S(c.mms), Q: S(c.obs), R: S(c.foto), U: S(c.cont), AM: S(c.instSel), src: c
      };
      r.blank = r.F === '';
      return r;
    });
    rows.forEach(function (r) {
      var F = r.F;
      r.L = r.blank ? '' : r.I + r.J + r.K;
      r.AP = r.E !== '' ? r.E : F;
      // AO fila de la etiqueta en INVENTARIO_ANTERIOR (-1 = no)
      r.AO = -1;
      if (!r.blank) {
        if (isCode(r.AP)) { var ci = codeIdx[U(r.AP.slice(0, 15))]; r.AO = ci === undefined ? -1 : ci; }
        else if (serCand(r.AP)) { var k = U(r.AP); if (serieCount[k] === 1) r.AO = serieIdx[k]; }
      }
      // AQ bloque del bien
      if (r.blank) r.AQ = '';
      else if (hasDash(F)) r.AQ = F.slice(0, 4);
      else if (isCode(F)) r.AQ = F.slice(6, 10);
      else if (serCand(F) && serieCount[U(F)] === 1) r.AQ = inv[serieIdx[U(F)]].blk;
      else if (isNumText(F)) r.AQ = pad4(Number(F));
      else {
        var di = descIdx[U(F)];
        if (di !== undefined && cat[di].c !== '') r.AQ = cat[di].c;
        else {
          r.AQ = '?'; var uf = U(F);
          for (var q = 0; q < cat.length; q++) { if (U(cat[q].desc).indexOf(uf) >= 0) { r.AQ = cat[q].c; break; } }
          if (r.AQ === '' ) r.AQ = '';
        }
      }
      r.AN = r.AO >= 0 ? inv[r.AO].blk : '';
      r.AR = r.AO >= 0 && r.AN !== '' && r.AQ !== '?' && U(r.AQ) !== U(r.AN);
      r.AJ = (r.AO < 0 || r.AR) ? -1 : r.AO;
      if (r.AJ >= 0 && inv[r.AJ].reqU !== '' && U(trim(inv[r.AJ].reqU)) !== U(trim(r.C))) { r.locMis = inv[r.AJ].reqU; r.AJ = -1; }   // (extensión de la app)
      if (r.AJ < 0) r.AL = false;
      else {
        var last = r.AJ + Math.max(1, Nn(r.L)) - 1;
        r.AL = (isCode(r.AP) || Nn(r.L) <= 1) && last < inv.length && U(inv[last].N) === U(inv[r.AJ].N);
      }
      r.AK = (r.AL && Nn(r.L) > 0) ? r.AJ + Nn(r.L) - 1 : -2;
      r.AH = r.AJ >= 0 ? inv[r.AJ].code : '';
      r.X = r.AQ;
      if (r.blank) r.W = '';
      else if (r.AH !== '') r.W = r.AH.slice(0, 5);
      else if (r.AR) r.W = inv[r.AO].inst;
      else if (isCode(F)) r.W = F.slice(0, 5);
      else if (r.AM !== '') r.W = r.AM;
      else r.W = S(cfg.inst);
      if (r.locMis) r.AF = 0;
      else if (r.AR && Nn(r.L) !== 1) r.AF = 0;
      else if (r.AJ >= 0) r.AF = r.AL ? Nn(r.L) : 0;
      else if (r.blank || Nn(r.L) === 0 || r.X === '?' || catByCode[U(r.X)] === undefined) r.AF = 0;
      else r.AF = Nn(r.L);
      r.AI = r.AJ >= 0 ? 0 : r.AF;
      if (r.blank) r.AG = null;
      else {
        var li = locIdx[U(r.C)] || 9999, xv = /^\s*\d+(\.\d+)?\s*$/.test(r.X) ? Number(r.X) : 9999;
        r.AG = li * 100000000 + xv * 10000 + r.ROW;
      }
      r.Y = r.blank ? '' : r.C + '|' + r.X;
      var loc = locOf(r.C); r.D = r.C === '' ? '' : (loc ? loc.tipo : '');
    });
    var live = rows.filter(function (r) { return r.AG !== null; });
    var logical = live.slice().sort(function (a, b) { return a.AG - b.AG; });
    logical.forEach(function (r, k) { r.A = k + 1; });
    // AD Antes (CALC W) y Z Ord.ini (pool por inst-bloque en orden lógico)
    var acc = 0, pool = {};
    logical.forEach(function (r) {
      r.AD = acc; acc += r.AF;
      var key = U(r.W) + '|' + U(r.X);
      if (r.AI !== 0) { r.Z = (pool[key] || 0) + 1; } else r.Z = '';
      pool[key] = (pool[key] || 0) + r.AI;
    });
    rows.forEach(function (r) { if (r.blank) { r.A = ''; r.Z = ''; r.AD = ''; } });
    var TOT_COD = acc;

    // INVENTARIO_ANTERIOR: X (conservado), AE (mal asignada), Z, AA, AB, Q, R…
    inv.forEach(function (o) { o.X = 0; o.AE = 0; });
    rows.forEach(function (r) {
      if (r.AJ >= 0 && r.AK >= 0) for (var i = r.AJ; i <= r.AK; i++) inv[i].X++;
      if (r.AO >= 0 && r.AR && r.AF > 0) inv[r.AO].AE++;
    });
    inv.forEach(function (o) { o.Z = (o.X > 0 || o.Y === 'Sí' || o.AE > 0 || o.AF !== '') ? 1 : 0; });
    var abIdx = {}, freeCount = {};
    Object.keys(byN).forEach(function (k) {
      var g = byN[k];
      var free = g.filter(function (o) { return o.Z === 0; });
      g.forEach(function (o) {
        if (o.Z === 1) { o.AA = ''; return; }
        var c = 0; free.forEach(function (f) { if (f.P <= o.P) c++; }); o.AA = c;
        abIdx[U(o.N) + '|' + c] = abIdx[U(o.N) + '|' + c] === undefined ? o.i : abIdx[U(o.N) + '|' + c];
      });
      freeCount[k] = free.length;
    });
    function poolSum(w, x) { return pool[U(w) + '|' + U(x)] || 0; }   // SUMIFS(CONTEO!AI, W=w, X=x)
    function afSum(w, x) { var s = 0; rows.forEach(function (r) { if (!r.blank && U(r.W) === U(w) && U(r.X) === U(x)) s += r.AF; }); return s; }
    function countN(n) { return nGroup(n).length; }
    function countNz1(n) { return nGroup(n).filter(function (o) { return o.Z === 1; }).length; }

    // CONTEO: AA, AC, M, N, G, H, O, T
    rows.forEach(function (r) {
      if (r.blank) { r.G = ''; r.H = ''; r.M = ''; r.N = ''; r.O = ''; r.AA = ''; r.AC = ''; r.T = ''; return; }
      var n = r.W + '-' + r.X;
      r.AA = r.Z === '' ? '' : countN(n) - countNz1(n);
      r.AC = r.Z === '' ? '' : maxCorrel(n);
      // G descripción
      if (r.AR) { var dx = catDesc(r.X), da = catDesc(r.AN); r.G = '↺ ' + (dx === null ? '?' : dx) + ' · tenía etiqueta de ' + (da === null ? r.AN : da) + ': reetiquetar'; }
      else if (r.AH !== '') r.G = '🔒 ' + inv[r.AJ].desc;
      else { var d = catDesc(r.X); r.G = d === null ? '⚠ NO ESTÁ EN CATÁLOGO' : d; }
      var rb = catRubro(r.X); r.H = rb === null ? '' : rb;
      // M / N código desde-hasta
      function codeAt(pos) {
        if (reciclar && pos <= r.AA) { var ix = abIdx[U(n) + '|' + pos]; return ix === undefined ? '#N/A' : inv[ix].code; }
        return r.W + '-' + r.X + '-' + pad4(r.AC + pos - (reciclar ? r.AA : 0));
      }
      if (r.AJ >= 0 && r.AF > 0) { r.M = r.AH; r.N = inv[r.AK].code; }
      else if (r.Z === '' || r.G.charAt(0) === '⚠') { r.M = ''; r.N = ''; }
      else { r.M = codeAt(r.Z); r.N = codeAt(r.Z + Nn(r.L) - 1); }
      r.O = (r.C === '' ) ? '' : nGroup(n).filter(function (o) { return U(o.M) === U(r.C); }).length;
      r.T = (r.C === '' || r.fecha === '') ? '' : r.C.replace(/ /g, '-').replace(/\//g, '-') + '_' + r.X + '_' + r.fecha.replace(/-/g, '') + '.jpg';
    });

    /* ---------- CODIGOS_ASIGNADOS (uno por bien, en orden lógico) ---------- */
    var cod = [];
    logical.forEach(function (r) {
      for (var k = 1; k <= r.AF; k++) {
        var c = { n: cod.length + 1, row: r, K: k, D: r.X, E: r.C, C: r.G, G: r.fecha, Gfull: r.fechaFull, H: r.P, L: r.W, M: Nn(r.AA), O: Nn(r.AC), Wc: r.AJ >= 0 };
        c.F = k <= r.I ? E1 : (k <= r.I + r.J ? E2 : E3);
        c.P = c.Wc ? '' : r.Z + k - 1;
        if (c.Wc) { c.B = inv[r.AJ + k - 1].code; c.R = 'Conservado'; c.inv = r.AJ + k - 1; }
        else if (reciclar && c.P <= c.M) { var ix = abIdx[U(c.L + '-' + c.D) + '|' + c.P]; c.B = ix === undefined ? '#N/A' : inv[ix].code; c.R = 'Reciclado'; c.inv = ix; }
        else { c.B = c.L + '-' + c.D + '-' + pad4(c.O + c.P - (reciclar ? c.M : 0)); c.R = 'NUEVO'; c.inv = null; }
        cod.push(c);
      }
    });
    var codByCode = {}; cod.forEach(function (c, i) { if (!(U(c.B) in codByCode)) codByCode[U(c.B)] = i; });

    /* ---------- INVENTARIO_ANTERIOR: estado del código ---------- */
    var invByAI = {};
    inv.forEach(function (o) {
      o.Q = poolSum(o.inst, o.blk);
      if (o.X > 0) o.R = 'Conservado';
      else if (o.AF !== '') o.R = 'Sin asignar';
      else if (reciclar && o.AA !== '' && o.AA <= o.Q) o.R = 'Reasignado';
      else o.R = 'Sin asignar';
      // AH / AI corrección de familia
      if (o.AF === '') { o.AH = ''; o.AI = ''; }
      else {
        var cn = o.inst + '-' + o.AF;
        o.AH = Math.min(o.W, Math.max(0, poolSum(o.inst, o.AF) - (countN(cn) - countNz1(cn))));
        o.AI = (o.AG <= o.W - Nn(o.AH)) ? '' : o.inst + '-' + o.AF + '-' + pad4(maxCorrel(cn) + o.AG - (o.W - o.AH));
        if (o.AI !== '' && !(U(o.AI) in invByAI)) invByAI[U(o.AI)] = o.i;
      }
    });
    var sIdx = 0, acIdx = 0, ajIdx = 0;
    var sinCount = {}; inv.forEach(function (o) { if (o.R === 'Sin asignar') sinCount[U(o.N)] = (sinCount[U(o.N)] || 0) + 1; });
    inv.forEach(function (o) {
      o.S = o.R === 'Sin asignar' ? ++sIdx : '';
      o.T = o.R !== 'Sin asignar' ? (U(o.code) in codByCode ? cod[codByCode[U(o.code)]].E : '') : '';
      o.U = o.N + '|' + o.R;
      o.AC = o.Y === 'Sí' ? ++acIdx : '';
      o.AJ = o.AF !== '' ? ++ajIdx : '';
      if (o.AI !== '') {
        var mx = ''; nGroup(o.inst + '-' + o.AF).forEach(function (x) { if (x.fecha > mx) mx = x.fecha; });
        o.AK = (mx !== '' && mx > o.fecha) ? '⚠ El bloque ' + o.AF + ' ya tiene bienes con fecha posterior: el orden cronológico se rompe, consultar al encargado' : '';
      } else o.AK = '';
      if (o.R !== 'Sin asignar') o.V = '';
      else if (o.AF !== '') o.V = 'FAMILIA EQUIVOCADA: registrado como ' + o.blk + ', el bien es ' + o.AF + '. Se descarga este código' + (o.AI !== '' ? ' y el bien se carga como ' + o.AI + ' con su misma fecha y valor' : ' (bien no encontrado)');
      else if (o.AE > 0) o.V = 'Etiqueta MAL ASIGNADA: se encontró puesta en un bien de otra familia (ver REPORTE_ETIQUETAS)';
      else if (o.extra) o.V = 'Código AGREGADO después del corte que no se registró con su etiqueta en ' + o.reqU;
      else if (o.Y === 'Sí') o.V = 'Código RESERVADO (bien reciente o con serie) que no se registró por su código o serie en el conteo';
      else o.V = 'Bloque ' + o.blk + ': en sistema había ' + o.W + ', se contaron ' + afSum(o.inst, o.blk) + ' → sobran ' + (sinCount[U(o.N)] || 0) + ' (se descargan los más antiguos)';
    });

    /* CODIGOS_ASIGNADOS: columnas que dependen del inventario */
    var yIdx = 0, nIdx = 0;
    cod.forEach(function (c) {
      var r = c.row;
      c.S = c.R === 'NUEVO' ? ++nIdx : '';
      c.T = c.L + '-' + c.D + '|' + c.R;
      if (r.AO < 0) { c.X = ''; c.Z = ''; c.Y = ''; } else { c.X = c.Wc ? c.B : inv[r.AO].code; c.Y = ++yIdx; c.Z = c.Wc ? 'Correcta' : 'Incorrecta'; }
      var ai = c.R === 'NUEVO' ? invByAI[U(c.B)] : undefined;
      c.AA = ai === undefined ? '' : inv[ai].code;
      c.AB = ai === undefined ? '' : inv[ai].fecha;
      c.AC = ai === undefined ? '' : inv[ai].valor;
      c.AD = c.AA !== '' ? c.AB : c.G;
      c.AE = c.AA !== '' ? c.AC : '';
      c.AF = c.AA !== '' ? trim(inv[ai].marca + ' ' + inv[ai].modelo + ' ' + inv[ai].serie) : c.H;
      if (c.R === 'NUEVO') c.U = c.AA !== '' ? 'CARGAR a SIGES con los datos del ' + c.AA + ' (fecha ' + fmtDMY(c.AB) + ', valor $' + money(c.AC) + ') · familia corregida' : 'CARGAR a SIGES (código nuevo, fecha de alta actual)';
      else c.U = c.R === 'Conservado' ? 'Conservado: mantiene su código y etiqueta (verificar ubicación en SIGES)' : 'Ya existe en SIGES: re-etiquetar y actualizar ubicación';
      if (c.R !== 'NUEVO') c.V = '';
      else if (c.AA !== '') c.V = 'Familia corregida: viene del ' + c.AA + ' (se descarga). Se carga con su fecha de adquisición y valor originales';
      else { var ps = poolSum(c.L, c.D); c.V = 'Bloque ' + c.D + ': códigos libres para reciclar ' + c.M + ', bienes contados por bloque ' + ps + ' → ' + (ps - c.M) + ' nuevos · alta con fecha actual'; }
    });

    /* ---------- CONTEO: alerta (columna V) ---------- */
    var cntAOAR = {}, cntYrep = {};
    rows.forEach(function (r) {
      if (r.blank) return;
      if (r.AR) cntAOAR[r.AO] = (cntAOAR[r.AO] || 0) + 1;
      if (r.AJ < 0 && !r.AR) cntYrep[U(r.Y)] = (cntYrep[U(r.Y)] || 0) + 1;
    });
    function reservedPending(n) { return nGroup(n).filter(function (o) { return o.Y === 'Sí' && o.X === 0; }).length; }
    rows.forEach(function (r) {
      var F = r.F, AP = r.AP, L = Nn(r.L);
      if (r.blank) { r.V = r.E !== '' ? 'Indique qué bien es según el catálogo' : ''; return; }
      if (r.C === '') { r.V = 'Falta ubicación'; return; }
      if (r.fecha === '') { r.V = 'Falta fecha'; return; }
      if (r.E !== '' && r.AO < 0) {
        r.V = (serCand(AP) && (serieCount[U(AP)] || 0) > 1) ? 'Serie repetida en el inventario: escriba el código de la etiqueta' : 'La etiqueta no existe en el inventario anterior: se contó como bien sin etiqueta'; return;
      }
      if (r.locMis) { r.V = 'Código agregado: está registrado en ' + r.locMis + ', pero se contó en otra ubicación (' + r.C + '). Revise la ubicación'; return; }
      if (r.AR) { r.V = L !== 1 ? 'Etiqueta de otra familia: la cantidad debe ser 1' : ((cntAOAR[r.AO] || 0) > 1 ? 'Esa etiqueta ya está registrada en otra fila' : ''); return; }
      if (isCode(F) && r.AO < 0) { r.V = 'El código no existe en el inventario anterior: se contó como bloque'; return; }
      if (r.AJ >= 0) {
        if (L === 0) { r.V = 'Sin cantidades'; return; }
        if (!r.AL) { r.V = isCode(AP) ? 'El rango pasa a otro bloque: revise la cantidad' : 'Por N° de serie la cantidad debe ser 1'; return; }
        var ov = 0; rows.forEach(function (o) { if (!o.blank && o.AJ <= r.AK && o.AK >= r.AJ && o.AJ >= 0 && o.AK >= 0) ov++; });
        r.V = ov > 1 ? 'Código ya registrado en otra fila' : ''; return;
      }
      if (serCand(F) && (serieCount[U(F)] || 0) > 1) { r.V = 'Serie repetida en el inventario: escriba el código'; return; }
      if (r.G.charAt(0) === '⚠') { r.V = 'Revise el bien: no se reconoce en el catálogo'; return; }
      if (L === 0) { r.V = 'Sin cantidades'; return; }
      if ((cntYrep[U(r.Y)] || 0) > 1) { r.V = 'Bloque repetido en esta ubicación'; return; }
      var rp = reservedPending(r.W + '-' + r.X);
      r.V = rp > 0 ? 'ℹ Este bloque tiene ' + rp + ' códigos reservados sin registrar: registre esos bienes con su etiqueta o serie' : '';
    });

    /* ---------- CATALOGO: columnas calculadas ---------- */
    var invByBlk = {}; inv.forEach(function (o) { (invByBlk[U(o.blk)] = invByBlk[U(o.blk)] || []).push(o); });
    var cntByX = {}; rows.forEach(function (r) { if (r.blank) return; var k = U(r.X); var t = cntByX[k] = cntByX[k] || { I: 0, J: 0, K: 0, L: 0 }; t.I += r.I; t.J += r.J; t.K += r.K; t.L += Nn(r.L); });
    var catOut = cat.map(function (c) {
      if (c.c === '') return { A: '', blank: true };
      var g = invByBlk[U(c.c)] || [], t = cntByX[U(c.c)] || { I: 0, J: 0, K: 0, L: 0 };
      var M = g.length, N = M ? Math.max.apply(null, g.map(function (o) { return o.correl; })) : '';
      var O = g.filter(function (o) { return o.R === 'Reasignado' || o.R === 'Conservado'; }).length;
      return {
        A: c.c, B: c.c.slice(0, 2), C: rubroName[c.c.slice(0, 2)] || '', F: c.desc, G: c.usar, H: (c.usar === 'No') ? '' : c.c + ' - ' + c.desc,
        I: t.L, J: t.I, K: t.J, L: t.K, M: M, N: N, O: O, P: t.L - O, Q: Math.max(0, M - O),
        R: g.reduce(function (s, o) { return s + o.valor; }, 0),
        X: g.filter(function (o) { return o.R === 'Sin asignar'; }).reduce(function (s, o) { return s + o.valor; }, 0)
      };
    });

    /* ---------- CONSOLIDADO ---------- */
    var byLoc = {}; rows.forEach(function (r) { if (r.blank && r.C === '') return; var k = U(r.C); var t = byLoc[k] = byLoc[k] || { I: 0, J: 0, K: 0, n: 0, min: '', max: '' }; t.I += r.I; t.J += r.J; t.K += r.K; t.n++; if (r.fecha !== '') { if (t.min === '' || r.fecha < t.min) t.min = r.fecha; if (t.max === '' || r.fecha > t.max) t.max = r.fecha; } });
    var invByM = {}; inv.forEach(function (o) { (invByM[U(o.M)] = invByM[U(o.M)] || []).push(o); });
    var consUb = ubic.map(function (u) {
      if (u.n === '') return null;
      var t = byLoc[U(u.n)] || { I: 0, J: 0, K: 0, n: 0, min: '', max: '' }, G = t.I + t.J + t.K, M = (invByM[U(u.n)] || []).length;
      return { A: u.n, B: u.tipo, C: u.edif, D: t.I, E: t.J, F: t.K, G: G, H: G ? t.K / G : '', I: t.n, J: t.n ? t.min : '', K: t.n ? t.max : '', L: u.activa === 'No' ? 'Inactiva' : (t.n === 0 ? 'Pendiente' : 'Contada'), M: M, N: t.n ? G - M : '' };
    });
    var activas = ubic.filter(function (u) { return u.activa === 'Sí'; }).length;
    var contadas = consUb.filter(function (x) { return x && x.L === 'Contada'; }).length;
    var sumL = 0, sumK = 0; rows.forEach(function (r) { sumL += Nn(r.L); sumK += r.K; });
    var cons = {
      activas: activas, contadas: contadas, avance: activas ? contadas / activas : 0, bienes: sumL, malos: sumK, pctMalo: sumL ? sumK / sumL : 0,
      reutilizados: catOut.reduce(function (s, c) { return s + (c.O || 0); }, 0), nuevos: catOut.reduce(function (s, c) { return s + (c.P || 0); }, 0), sinUsar: catOut.reduce(function (s, c) { return s + (c.Q || 0); }, 0)
    };
    var consRub = (input.rubros || []).map(function (rb) {
      var p = S(rb[0]), R = 0, Sx = 0;
      rows.forEach(function (r) { if (!r.blank && S(r.X).indexOf(p) === 0) { R += Nn(r.L); Sx += r.K; } });
      return { P: p, Q: S(rb[1]), R: R, S: Sx, T: inv.filter(function (o) { return o.blk.indexOf(p) === 0; }).length };
    });

    /* ---------- REPORTES ---------- */
    var nuevos = cod.filter(function (c) { return c.R === 'NUEVO'; });
    var cargosBlq = [];
    var seenZ = {};
    // CALC Z/AA/AB: 3 tramos (inst principal, B7, B8) × catálogo en su orden; solo bloques con códigos NUEVO
    [cfg.inst].concat(cfg.otrasInst || []).slice(0, 3).forEach(function (inst) {
      if (S(inst) === '') return;
      cat.forEach(function (c) {   // (el Excel usa las 634 filas del catálogo; aquí todas, por si se agregan bloques)
        if (c.c === '') return;
        var z = S(inst) + '-' + c.c; seenZ[U(z)] = 1;
        var lst = nuevos.filter(function (x) { return U(x.L + '-' + x.D) === U(z); });
        if (!lst.length) return;
        var O = countN(z);
        cargosBlq.push({ M: z, N: catDesc(c.c) || '', O: O, P: afSum(S(inst), c.c), Q: lst.length, R: lst[0].B, S: lst[lst.length - 1].B, T: O === 0 ? '(no había)' : pad4(maxCorrel(z)) });
      });
    });
    // códigos nuevos de una institución que no está en CONFIG (el Excel no los resume; aquí se agregan al final, marcados)
    var extra = {};
    nuevos.forEach(function (x) { var z = x.L + '-' + x.D; if (!seenZ[U(z)]) (extra[z] = extra[z] || []).push(x); });
    Object.keys(extra).forEach(function (z) { var lst = extra[z], O = countN(z); cargosBlq.push({ M: z, N: catDesc(z.slice(6)) || '', O: O, P: afSum(z.slice(0, 5), z.slice(6)), Q: lst.length, R: lst[0].B, S: lst[lst.length - 1].B, T: O === 0 ? '(no había)' : pad4(maxCorrel(z)), otraInst: true }); });
    var cargosUbi = []; ubic.forEach(function (u) { if (u.n === '') return; var n = nuevos.filter(function (x) { return U(x.E) === U(u.n); }).length; if (n > 0) cargosUbi.push({ V: u.n, W: n }); });
    var cargos = {
      tot: { nuevos: nuevos.length, bloques: cargosBlq.filter(function (b) { return !b.otraInst; }).length, ubicaciones: cargosUbi.length, reciclados: cod.filter(function (c) { return c.R === 'Reciclado'; }).length },
      det: nuevos.map(function (c) { return { A: c.S, B: c.B, C: c.C, D: c.D, E: c.E, F: c.F, G: c.AF, H: c.AD, I: c.AE, J: c.V, row: c.row }; }),
      blq: cargosBlq, ubi: cargosUbi
    };
    var sin = inv.filter(function (o) { return o.R === 'Sin asignar'; });
    var descBlq = [], seenN = {};
    inv.forEach(function (o) { if (seenN[U(o.N)]) return; seenN[U(o.N)] = 1; var g = nGroup(o.N).filter(function (x) { return x.R === 'Sin asignar'; }); if (!g.length) return;
      var mn = g[0].fecha, mx = g[0].fecha, v = 0; g.forEach(function (x) { if (x.fecha < mn) mn = x.fecha; if (x.fecha > mx) mx = x.fecha; v += x.valor; });
      descBlq.push({ M: o.N, N: catDesc(o.blk) || '', O: countN(o.N), P: afSum(o.inst, o.blk), Q: g.length, R: mn, S: mx, T: v }); });
    var descUbi = []; ubic.forEach(function (u) { if (u.n === '') return; var g = sin.filter(function (o) { return U(o.M) === U(u.n); }); if (g.length) descUbi.push({ V: u.n, W: g.length, X: g.reduce(function (s, o) { return s + o.valor; }, 0) }); });
    var descargos = {
      tot: { codigos: sin.length, valor: sin.reduce(function (s, o) { return s + o.valor; }, 0), bloques: descBlq.length, malos: sin.filter(function (o) { return U(o.calidad) === 'MALO'; }).length },
      det: sin.map(function (o) { return { A: o.S, B: o.code, C: o.desc, D: o.blk, E: o.M, F: o.calidad, G: trim(o.marca + ' ' + o.modelo + ' ' + o.serie), H: o.fecha, I: o.valor, J: o.V, inv: o }; }),
      blq: descBlq, ubi: descUbi
    };
    var etqDet = cod.filter(function (c) { return c.X !== ''; }).map(function (c) {
      var ii = codeIdx[U(c.X)], o = ii === undefined ? null : inv[ii];
      var D = o ? o.M : '';
      return { A: c.Y, B: c.X, C: o ? o.desc : '', D: D, E: c.E, F: c.G, G: c.Z, H: catDesc(c.D) || '', I: c.B, J: c.Z === 'Incorrecta' ? 'Retirar etiqueta vieja y poner el código asignado; el código viejo pasa a descargo' : (U(D) === U(c.E) ? 'Se conserva la etiqueta' : 'Se conserva; actualizar ubicación en SIGES') };
    });
    var etiquetas = { tot: { verificadas: etqDet.length, correctas: etqDet.filter(function (x) { return x.G === 'Correcta'; }).length, incorrectas: etqDet.filter(function (x) { return x.G === 'Incorrecta'; }).length, otraUbic: etqDet.filter(function (x) { return /ubicación/.test(x.J); }).length }, det: etqDet };
    var reclDet = inv.filter(function (o) { return o.AF !== ''; }).map(function (o) {
      var H = o.AI, I = H !== '' && (U(H) in codByCode) ? cod[codByCode[U(H)]].E : '';
      var dG = catDesc(o.AF);
      return { A: o.AJ, B: o.code, C: o.desc, D: o.fecha, E: o.valor, F: o.M, G: dG === null ? o.AF : dG, H: H, I: I, J: H !== '' ? 'Descargar este código y cargar el bien como ' + H + ' con la misma fecha y valor; reetiquetar' + (o.AK !== '' ? ' · ' + o.AK : '') : 'Descargar este código (no se encontró el bien)' };
    });
    var reclasif = { tot: { descargar: reclDet.length, encontrados: reclDet.filter(function (x) { return x.H !== ''; }).length, sinBien: reclDet.filter(function (x) { return x.H === ''; }).length }, det: reclDet };
    var consvDet = inv.filter(function (o) { return o.Y === 'Sí'; }).map(function (o) {
      return { A: o.AC, B: o.code, C: o.desc, D: o.marca, E: o.modelo, F: o.serie, G: o.fecha, H: o.M, I: o.X > 0 ? '✔ Conservado' : 'Pendiente: en CONTEO escriba este código' + (o.serie !== '' ? ' o su serie' : ''), J: o.T, inv: o };
    });
    var conservar = { tot: { reservados: consvDet.length, conservados: inv.filter(function (o) { return o.Y === 'Sí' && o.X > 0; }).length, pendientes: 0, fuera: inv.filter(function (o) { return o.Y !== 'Sí' && o.X > 0; }).length }, det: consvDet };
    conservar.tot.pendientes = conservar.tot.reservados - conservar.tot.conservados;

    /* ---------- FICHA_UBICACION ---------- */
    function ficha(u) {
      var loc = locOf(u) || { tipo: '', edif: '', resp: '' };
      var rs = rows.filter(function (r) { return U(r.C) === U(u); });            // orden de filas de la hoja
      var nonblank = rs.filter(function (r) { return true; });
      var head = {
        ubic: u, tipo: loc.tipo, edif: loc.edif, resp: loc.resp,
        fechaMin: '', fechaMax: '', contadoPor: rs.length ? rs[0].U : '', estado: rs.length ? 'CONTADA (' + rs.length + ' filas)' : 'PENDIENTE DE CONTAR'
      };
      rs.forEach(function (r) { if (r.fecha !== '') { if (head.fechaMin === '' || r.fechaFull < head.fechaMinFull) { head.fechaMin = r.fecha; head.fechaMinFull = r.fechaFull; } if (head.fechaMax === '' || r.fechaFull > head.fechaMaxFull) { head.fechaMax = r.fecha; head.fechaMaxFull = r.fechaFull; } } });
      var det = [], tipos = 0;
      var seen = {};
      cat.forEach(function (c) {
        if (c.c === '' || seen[U(c.c)]) return;
        var B = (invByBlk[U(c.c)] || []).filter(function (o) { return U(o.M) === U(u); }).length;
        var Cn = rs.filter(function (r) { return !r.blank && U(r.X) === U(c.c); });
        if (Cn.length > 0) tipos++;
        if (B + Cn.length === 0) return;
        seen[U(c.c)] = 1;
        var d = { A: det.length + 1, B: c.c, C: catDesc(c.c) || '', D: 0, E: 0, F: 0 };
        Cn.forEach(function (r) { d.D += r.I; d.E += r.J; d.F += r.K; });
        d.G = d.D + d.E + d.F;
        var first = Cn[0];
        d.H = first ? S(first.M) : '';
        d.I = first ? S(first.N) + (Cn.length > 1 ? ' (+ otras filas)' : '') : '';
        d.J = B; d.K = first ? first.Q : '';
        d.rows = Cn;
        det.push(d);
      });
      var sum = { C: 0, D: 0, E: 0 }; rs.forEach(function (r) { sum.C += r.I; sum.D += r.J; sum.E += r.K; });
      var F = sum.C + sum.D + sum.E;
      return { head: head, resumen: { bueno: sum.C, regular: sum.D, malo: sum.E, total: F, pctMalo: F ? sum.E / F : 0, tipos: tipos, invAnterior: (invByM[U(u)] || []).length }, det: det, filas: rs };
    }

    return {
      cfg: cfg, ubic: ubic, cat: catOut, inv: inv, rows: rows, logical: logical, cod: cod, TOT_COD: TOT_COD,
      cons: cons, consUb: consUb, consRub: consRub,
      cargos: cargos, descargos: descargos, etiquetas: etiquetas, reclasif: reclasif, conservar: conservar,
      ficha: ficha, catDesc: catDesc, locOf: locOf
    };
  }

  /**
   * Adaptador: arma la entrada del motor con los datos del sistema (lo mismo que hacía PEGAR_EN_CONTEO).
   * base = {cfg, consBlq, rc, cat, rubros, eq, inv} (hojas G_), locs = hoja UBICACIONES en su orden,
   * regs = REGISTROS de la app de captura (sin eliminados).
   * Orden de filas: ubicaciones de la lista (las nuevas al final) y dentro de cada una por hora de creación.
   */
  function fromApp(base, regs, locs) {
    locs = locs || [];
    var lista = locs.filter(function (l) { return !l.nueva; }).concat(locs.filter(function (l) { return l.nueva; }));
    var ord = {}; lista.forEach(function (l, i) { var k = U(trim(l.n)); if (!(k in ord)) ord[k] = i; });
    var catD = {}; (base.cat || []).forEach(function (c) { var k = S(c.c); if (k !== '' && !(k in catD)) catD[k] = S(c.inst) !== '' ? S(c.inst) : S(c.manual); });
    var rs = (regs || []).filter(function (r) { return !r.del; }).slice().sort(function (a, b) {
      var oa = U(trim(a.ubic)) in ord ? ord[U(trim(a.ubic))] : 99999, ob = U(trim(b.ubic)) in ord ? ord[U(trim(b.ubic))] : 99999;
      return (oa - ob) || ((Number(a.creado) || 0) - (Number(b.creado) || 0)) || (S(a.id) < S(b.id) ? -1 : S(a.id) > S(b.id) ? 1 : 0);
    });
    var conteo = rs.map(function (r) {
      var mm = [r.marca, r.modelo].filter(function (x) { return S(x) !== ''; }).join(' ');
      var fotos = r.fotos || [], main = fotos.filter(function (f) { return !f.t; })[0] || fotos[0];
      return {
        id: r.id, fecha: S(r.fecha).slice(0, 10), ubic: trim(r.ubic), etq: trim(r.etq),
        bien: r.blk ? (r.blk + ' - ' + (catD[r.blk] || '')) : S(r.desc),
        b: Nn(r.b) || null, r: Nn(r.r) || null, m: Nn(r.m) || null,
        mms: mm + (S(r.serie) !== '' ? (mm ? ' · ' : '') + 'S/N ' + r.serie : ''),
        obs: [r.revisar ? '[REVISAR: ' + S(r.motivo) + ']' : '', S(r.obs)].filter(function (x) { return x !== ''; }).join(' '),
        foto: main ? 'https://drive.google.com/file/d/' + main.id + '/view' : '', cont: S(r.cont), instSel: S(r.inst)
      };
    });
    var ubic = lista.map(function (l) { return { n: trim(l.n), tipo: S(l.t), edif: S(l.z), resp: S(l.r), activa: (l.a === false || l.a === 'No') ? 'No' : 'Sí' }; });
    return { cfg: base.cfg || {}, ubic: ubic, consBlq: base.consBlq || [], rc: base.rc || [], cat: base.cat || [], rubros: base.rubros || [], eq: base.eq || [], inv: (base.inv || []).concat((base.extra || []).map(function (x) {
      var c = S(x.code).toUpperCase();
      return { code: c, inst: c.slice(0, 5), blk: c.slice(6, 10), correl: Nn(c.slice(11)), desc: catD[c.slice(6, 10)] || '', marca: '', modelo: '', serie: S(x.serie),
        fecha: S(x.fecha).slice(0, 10), valor: Nn(x.valor), calidad: '', asig: S(x.ubic), manual: 'Sí', reqU: S(x.ubic), extra: true };
    })), conteo: conteo };
  }

  return { compute: compute, fromApp: fromApp, util: { isCode: isCode, pad4: pad4, fmtDMY: fmtDMY, money: money, trim: trim } };
})();
if (typeof module !== 'undefined') module.exports = Motor;

/**
 * GESTIÓN DE INVENTARIO · servidor (archivo Gestion.gs del mismo proyecto de Apps Script)
 * Usa la misma hoja, el mismo inicio de sesión y los mismos REGISTROS de la app de captura.
 * Solo Supervisor y Administrador. La lógica de códigos está en Motor.gs (réplica exacta del Excel v10).
 *
 * Hojas que agrega (se crean solas la primera vez):
 *   G_CONFIG, G_REGLAS, G_CATALOGO, G_RUBROS, G_EQUIVALENCIAS, G_INVENTARIO  → datos base del Excel v10 (se importan una vez)
 *   RESPONSABLES  → personas que firman por ubicación (sin límite)
 *   ACTAS         → control de entrega de cada juego impreso
 *   G_TEXTOS      → redacción del acta
 *   G_ETIQUETADO  → códigos ya etiquetados por ubicación (para avisar si algo cambia)
 */
var GS = { CFG: 'G_CONFIG', REG: 'G_REGLAS', CAT: 'G_CATALOGO', RUB: 'G_RUBROS', EQ: 'G_EQUIVALENCIAS', INV: 'G_INVENTARIO', RESP: 'RESPONSABLES', ACT: 'ACTAS', TXT: 'G_TEXTOS', ETQ: 'G_ETIQUETADO',
  PER: 'PERSONAS', TRA: 'TRASLADOS', NOT: 'G_NOTAS', PLA: 'G_PLANTILLAS', JUS: 'G_JUSTIFICACIONES', EXT: 'G_CODIGOS_AGREGADOS' };
var G_HEAD = {
  G_CONFIG: ['Clave', 'Valor', 'Qué es'],
  G_REGLAS: ['Tipo', 'Valor 1', 'Valor 2', 'Nota'],
  G_CATALOGO: ['Bloque', 'Descripción manual', 'Descripción institucional', 'Usar (Sí/No)', 'Origen', 'Descripción en inventario'],
  G_RUBROS: ['Rubro', 'Nombre'],
  G_EQUIVALENCIAS: ['Texto en el inventario', 'Ubicación estándar'],
  G_INVENTARIO: ['Código', 'Institución', 'Bloque', 'Correlativo', 'Descripción', 'Marca', 'Modelo', 'Serie', 'Fecha adquisición', 'Valor', 'Calidad', 'Asignado a', 'Conservar (Sí/No)'],
  RESPONSABLES: ['Ubicación', 'Nombre', 'Cargo', 'Rol en el acta', 'Copias', 'Orden', 'Nota', 'Persona ID (no editar)'],
  ACTAS: ['ID', 'Folio', 'Ubicación', 'Juego', 'Destinatario', 'Rol', 'Copias', 'Generado', 'Generado por', 'Entregado', 'Firmado', 'Recibido por', 'Nota', 'PDF', 'Acta firmada (archivo)'],
  PERSONAS: ['ID', 'Nombre', 'DUI', 'NIP', 'Cargo', 'Teléfono', 'Correo', 'Estado', 'Nota', 'Creado'],
  TRASLADOS: ['ID', 'Fecha', 'Código', 'Bien', 'De', 'A', 'Motivo', 'Autorizó', 'Registrado por', 'Nota'],
  G_NOTAS: ['ID', 'Tipo', 'Texto', 'Fecha', 'Hora', 'Aviso (min)', 'Hecho', 'Fijada', 'Vínculo', 'Color', 'Compartida', 'Usuario ID', 'Usuario', 'Creado', 'Modificado'],
  G_PLANTILLAS: ['Nombre', 'Reporte', 'Configuración (no editar)', 'Creada por', 'Fecha'],
  G_JUSTIFICACIONES: ['Código', 'Justificación', 'Por', 'Fecha'],
  G_CODIGOS_AGREGADOS: ['Código', 'Ubicación donde está', 'Fecha adquisición', 'Valor', 'Serie', 'Observación', 'Agregado por', 'Fecha de registro'],
  G_TEXTOS: ['Clave', 'Texto', 'Para qué sirve'],
  G_ETIQUETADO: ['Ubicación', 'Fecha', 'Por', 'Códigos (no editar)']
};
var G_CFG_KEYS = [
  ['nombre', 'Nombre de la institución'], ['inst', 'Código de institución principal'], ['otrasInst', 'Otros códigos de institución (separados por coma, máximo 2 como en el Excel)'],
  ['periodo', 'Período / nombre del conteo'], ['corte', 'Fecha de corte del inventario anterior'], ['director', 'Director(a)'], ['encargado', 'Encargado de inventario'],
  ['e1', 'Estado 1'], ['e2', 'Estado 2'], ['e3', 'Estado 3'],
  ['modo', 'Modo de numeración: Reciclar códigos anteriores / Sin reciclar: numerar después del último código'],
  ['consDesde', 'Conservar códigos de bienes adquiridos desde (aaaa-mm-dd)'], ['consSerie', 'Conservar códigos de bienes con número de serie (Sí/No)'],
  ['papel', 'Papel de impresión (Carta / Oficio / A4)'], ['firmasFila', 'Firmas por fila en el acta'], ['copiasOriginal', 'Copias del juego original'], ['copiasResp', 'Copias por responsable'], ['detalle', 'Detalle de bienes en la ficha (bloque / codigo)']
];
var G_TEXTOS_DEF = [
  ['TITULO', 'ACTA DE ENTREGA Y RESGUARDO DE BIENES - {NOMBRE_UBIC}', 'Título del acta'],
  ['DETALLE', 'DETALLE POR BLOQUE. Bienes contados y verificados en la ubicación.', 'Título del detalle en la ficha'],
  ['NOTA_FICHA', 'Códigos provisionales del conteo del {FECHA_CONTEO}. Ubicación contada y verificada: prohibido sacar, mover o prestar los bienes sin autorización escrita. Ver acta de entrega y resguardo adjunta.', 'Observaciones generales de la ficha'],
  ['P1', 'CÓDIGOS PROVISIONALES: Los códigos de la ficha adjunta corresponden al conteo del {FECHA_CONTEO} y son provisionales. Los códigos definitivos se asignarán al finalizar el conteo general de la institución.', 'Punto 1'],
  ['P2', 'UBICACIÓN CONTADA Y VERIFICADA: Los {TOTAL_BIENES} bienes detallados en la ficha adjunta fueron contados y verificados en {NOMBRE_UBIC}. Se tomó fotografía de lo que queda en la ubicación al cerrar el conteo; dicha fotografía forma parte de esta acta.', 'Punto 2'],
  ['P3', 'RESPONSABILIDAD: A partir de la firma de esta acta, {RESPONSABLES} {ES_SON} responsable(s) del resguardo, cuidado y permanencia de los bienes detallados, como bienes de la ubicación asignada.', 'Punto 3'],
  ['P4', 'PROHIBIDO SACAR, MOVER O PRESTAR los bienes sin autorización escrita de Dirección o del encargado de inventario. Todo traslado autorizado debe quedar registrado con fecha, bien y destino.', 'Punto 4'],
  ['P5', 'CODIFICACIÓN FÍSICA: Al colocar los códigos definitivos, todos los bienes de esta acta deberán estar en la ubicación y en el estado registrado. Si falta un bien o tiene un daño no reportado, el responsable deberá justificarlo por escrito y se procederá conforme a la normativa institucional.', 'Punto 5'],
  ['P6', 'REPORTE INMEDIATO: Cualquier daño, pérdida o robo debe reportarse por escrito a Dirección el mismo día en que se detecte.', 'Punto 6'],
  ['P7', 'UBICACIÓN COMPARTIDA: Esta ubicación es utilizada por {N_RESP} responsables ({RESPONSABLES}). Todos firman como responsables de los bienes en su respectivo turno. Al cambio de turno, cualquier faltante o daño debe anotarse en la bitácora; lo no anotado se considera ocurrido en el turno que lo detecte.', 'Punto 7: solo sale si hay 2 o más responsables'],
  ['FIRMA_1', 'DOCENTE RESPONSABLE', 'Título de firma: rol Responsable'],
  ['FIRMA_CO', 'DOCENTE CORRESPONSABLE', 'Título de firma: rol Corresponsable'],
  ['FIRMA_T', 'TESTIGO', 'Título de firma: rol Testigo'],
  ['FIRMA_2', 'ENCARGADO DE INVENTARIO', 'Firma del encargado'],
  ['FIRMA_3', 'VO. BO. DIRECCIÓN', 'Firma de Dirección'],
  ['ETQ_ORIGINAL', 'ORIGINAL - ARCHIVO DE INVENTARIO', 'Etiqueta del juego original'],
  ['ETQ_COPIA', 'COPIA - {DESTINATARIO}', 'Etiqueta de cada copia'],
  ['PIE', 'Original: archivo de inventario. Copias: un ejemplar para cada responsable. Documento generado el {HOY} a partir del conteo físico · Folio {FOLIO}', 'Nota al pie del acta'],
  ['PALABRA_FOTO', 'GENERAL', 'Palabra que identifica la foto general (si no hay fotos guardadas en la ubicación)']
];
var ACTAS_DIR = 'Actas PDF', RESULT_DIR = 'Resultados gestión';

/* ================= HOJAS ================= */
function gSheet_(name) {
  var ss = ss_(), sh = ss.getSheetByName(name);
  if (!sh) {
    var head = G_HEAD[name];
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold').setBackground('#14213D').setFontColor('#FFFFFF');
    sh.setFrozenRows(1);
    if (name === GS.CFG) {
      sh.getRange(2, 1, G_CFG_KEYS.length, 3).setValues(G_CFG_KEYS.map(function (k) { return [k[0], '', k[1]]; }));
      sh.getRange(1, 1, sh.getMaxRows(), 3).setNumberFormat('@');
    }
    if (name === GS.TXT) sh.getRange(2, 1, G_TEXTOS_DEF.length, 3).setValues(G_TEXTOS_DEF);
    if (name === GS.INV) sh.getRange('A:H').setNumberFormat('@');
    if ([GS.CAT, GS.RUB, GS.REG, GS.RESP, GS.EQ, GS.PER, GS.PLA, GS.EXT].indexOf(name) >= 0) sh.getRange(1, 1, sh.getMaxRows(), head.length).setNumberFormat('@');
  } else if (name === GS.RESP || name === GS.ACT) {   // hojas creadas por la versión 5: agrega la columna nueva
    var hd = G_HEAD[name], n = hd.length;
    if (sh.getMaxColumns() < n) sh.insertColumnsAfter(sh.getMaxColumns(), n - sh.getMaxColumns());
    if (!str_(sh.getRange(1, n).getValue())) sh.getRange(1, n).setValue(hd[n - 1]).setFontWeight('bold').setBackground('#14213D').setFontColor('#FFFFFF');
  }
  return sh;
}
function gRows_(name) {
  var sh = gSheet_(name), last = sh.getLastRow(), n = G_HEAD[name].length;
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, n).getValues();
}
/** Reemplaza todo el contenido (debajo del encabezado) de una hoja G_. */
function gWrite_(name, data, fmts) {
  var sh = gSheet_(name), n = G_HEAD[name].length, last = sh.getLastRow();
  if (last >= 2) sh.getRange(2, 1, last - 1, n).clearContent();
  if (!data.length) return;
  var need = data.length + 1 - sh.getMaxRows();
  if (need > 0) sh.insertRowsAfter(sh.getMaxRows(), need);
  var rg = sh.getRange(2, 1, data.length, n);
  if (fmts) rg.setNumberFormats(data.map(function () { return fmts; }));
  rg.setValues(data);
}
function gBump_() { bumpKey_('gver'); bump_(); }
function d10_(v) { var s = str_(v).trim(); return /^\d{4}-\d\d-\d\d/.test(s) ? s.slice(0, 10) : s; }

/* ================= DATOS BASE PARA EL MOTOR ================= */
function gBase_() {
  var key = 'gbase' + getKey_('gver'), b = cacheGetBig_(key);
  if (b) return b;
  var cfg = {};
  gRows_(GS.CFG).forEach(function (r) { var k = str_(r[0]).trim(); if (k) cfg[k] = d10_(r[1]); });
  cfg.otrasInst = String(cfg.otrasInst || '').split(/[,;\s]+/).filter(String);
  var consBlq = [], rc = [];
  gRows_(GS.REG).forEach(function (r) {
    var t = norm_(r[0]);
    if (t === 'CONSERVAR BLOQUE' && str_(r[1]).trim()) consBlq.push(blkOrKey_(r[1]));
    if (t === 'CORREGIR FAMILIA' && str_(r[1]).trim() && str_(r[2]).trim()) rc.push([blk_(r[1]), blk_(r[2])]);
  });
  var cat = gRows_(GS.CAT).map(function (r) { return { c: blk_(r[0]), manual: str_(r[1]), inst: str_(r[2]), usar: str_(r[3]), origen: str_(r[4]), descInv: str_(r[5]) }; });
  while (cat.length && !cat[cat.length - 1].c) cat.pop();
  var rubros = gRows_(GS.RUB).filter(function (r) { return str_(r[0]).trim(); }).map(function (r) { var k = str_(r[0]).trim(); return [/^\d$/.test(k) ? '0' + k : k, str_(r[1])]; });
  var eq = gRows_(GS.EQ).filter(function (r) { return str_(r[0]) !== ''; }).map(function (r) { return [str_(r[0]), str_(r[1])]; });
  var inv = gRows_(GS.INV).filter(function (r) { return str_(r[0]).trim(); }).map(function (r) {
    return { code: str_(r[0]).trim(), inst: str_(r[1]).trim(), blk: blk_(r[2]), correl: Number(r[3]) || 0, desc: str_(r[4]), marca: str_(r[5]), modelo: str_(r[6]), serie: str_(r[7]),
      fecha: d10_(r[8]), valor: Number(r[9]) || 0, calidad: str_(r[10]), asig: str_(r[11]), manual: str_(r[12]).trim() };
  });
  var extra = gRows_(GS.EXT).filter(function (r) { return str_(r[0]).trim(); }).map(function (r) {
    return { code: str_(r[0]).trim().toUpperCase(), ubic: str_(r[1]).trim(), fecha: d10_(r[2]), valor: Number(r[3]) || 0, serie: str_(r[4]).trim(), obs: str_(r[5]), por: str_(r[6]), t: d10_(r[7]) };
  });
  b = { cfg: cfg, consBlq: consBlq, rc: rc, cat: cat, rubros: rubros, eq: eq, inv: inv, extra: extra };
  cachePutBig_(key, b);
  return b;
}
function blkOrKey_(v) { var s = str_(v).trim(); return /^\d{1,4}$/.test(s) ? blk_(s) : s; }
function gRegs_() {
  return rows_(SH.REG, NREG).filter(function (r) { return str_(r[0]); }).map(regOut_).filter(function (r) { return !r.del; }).map(function (r) {
    return { id: r.id, fecha: r.fecha, ubic: r.ubic, blk: r.blk, desc: r.desc, etq: r.etq, b: r.b, r: r.r, m: r.m, marca: r.marca, modelo: r.modelo, serie: r.serie,
      obs: r.obs, revisar: r.revisar, motivo: r.motivo, inst: r.inst, cont: r.cont, creado: r.creado, ts: r.ts, fotos: r.fotos };
  });
}
function gResp_() {
  return gRows_(GS.RESP).filter(function (r) { return str_(r[0]).trim() && str_(r[1]).trim(); }).map(function (r, i) {
    return { u: str_(r[0]).trim(), n: str_(r[1]).trim(), cargo: str_(r[2]), rol: str_(r[3]) || 'Responsable', copias: str_(r[4]).trim() === '' ? 1 : Math.max(0, Number(r[4]) || 0), orden: Number(r[5]) || (i + 1), nota: str_(r[6]), pid: str_(r[7]) };
  });
}
function gActas_() {
  return gRows_(GS.ACT).filter(function (r) { return str_(r[0]); }).map(function (r, i) {
    return { row: i + 2, id: str_(r[0]), folio: str_(r[1]), u: str_(r[2]), juego: str_(r[3]), dest: str_(r[4]), rol: str_(r[5]), copias: Number(r[6]) || 1,
      gen: ms_(r[7]), por: str_(r[8]), ent: ms_(r[9]), firm: ms_(r[10]), recibe: str_(r[11]), nota: str_(r[12]), pdf: str_(r[13]), firmada: str_(r[14]) };
  });
}
function gTextos_() { var o = {}; G_TEXTOS_DEF.forEach(function (t) { o[t[0]] = t[1]; }); gRows_(GS.TXT).forEach(function (r) { var k = str_(r[0]).trim(); if (k) o[k] = str_(r[1]); }); return o; }
function gEtq_() {
  return gRows_(GS.ETQ).filter(function (r) { return str_(r[0]).trim(); }).map(function (r) { return { u: str_(r[0]).trim(), t: ms_(r[1]), por: str_(r[2]), codes: json_(str_(r[3]), []) }; });
}
function appUrl_() { try { return ScriptApp.getService().getUrl() || ''; } catch (e) { return ''; } }

/* ================= API ================= */
/** Todo lo que necesita el módulo. Los datos base (inventario, catálogo…) solo viajan si cambiaron. */
function api_g_data(tok, knownG) {
  var t0 = Date.now(), u = auth_(tok, 'Supervisor'), gv = getKey_('gver');
  var out = { me: userPublic_(u), gver: gv, regs: gRegs_(), locs: locsOut_(), resp: gResp_(), actas: gActas_(), textos: gTextos_(), etq: gEtq_(),
    personas: gPersonas_(), traslados: gTraslados_(), notas: gNotas_(u), plantillas: gPlantillas_(), justif: gJustif_(),
    url: appUrl_(), ssId: ss_().getId(), now: Date.now() };
  if (knownG !== gv) out.base = gBase_();
  out.ms = Date.now() - t0;
  return out;
}
/** Importa los datos base desde el Excel v10 (el navegador lee el archivo y envía solo los datos). */
function api_g_import(tok, d) {
  var u = auth_(tok, 'Administrador');
  if (!d || !d.inv || !d.inv.length) throw valErr_('El archivo no trae INVENTARIO_ANTERIOR.');
  if (!d.cat || !d.cat.length) throw valErr_('El archivo no trae CATALOGO.');
  return withLock_(function () {
    var cfgSh = gSheet_(GS.CFG), cur = {};
    gRows_(GS.CFG).forEach(function (r, i) { cur[str_(r[0]).trim()] = i + 2; });
    var c = d.cfg || {};
    G_CFG_KEYS.forEach(function (k) {
      if (!(k[0] in c)) return;
      var v = k[0] === 'otrasInst' ? (c.otrasInst || []).filter(String).join(', ') : str_(c[k[0]]);
      var r = cur[k[0]]; if (!r) { r = cfgSh.getLastRow() + 1; cfgSh.getRange(r, 1, 1, 3).setValues([[k[0], '', k[1]]]); }
      cfgSh.getRange(r, 2).setNumberFormat('@').setValue(v);
    });
    var reglas = [];
    (d.consBlq || []).forEach(function (b) { if (str_(b).trim()) reglas.push(['Conservar bloque', str_(b).trim(), '', 'Importado del Excel']); });
    (d.rc || []).forEach(function (p) { if (str_(p[0]).trim() && str_(p[1]).trim()) reglas.push(['Corregir familia', blk_(p[0]), blk_(p[1]), 'Importado del Excel']); });
    gWrite_(GS.REG, reglas);
    var T = ['@', '@', '@', '@', '@', '@'];
    gWrite_(GS.CAT, d.cat.map(function (x) { return [str_(x.c), str_(x.manual), str_(x.inst), str_(x.usar), str_(x.origen), str_(x.descInv)]; }), T);
    gWrite_(GS.RUB, (d.rubros || []).map(function (x) { return [str_(x[0]), str_(x[1])]; }), ['@', '@']);
    gWrite_(GS.EQ, (d.eq || []).filter(function (x) { return str_(x[0]) !== ''; }).map(function (x) { return [str_(x[0]), str_(x[1])]; }), ['@', '@']);
    gWrite_(GS.INV, d.inv.filter(function (x) { return str_(x.code).trim(); }).map(function (x) {
      return [str_(x.code), str_(x.inst), str_(x.blk), Number(x.correl) || 0, str_(x.desc), str_(x.marca), str_(x.modelo), str_(x.serie), d10_(x.fecha), Number(x.valor) || 0, str_(x.calidad), str_(x.asig), str_(x.manual)];
    }), ['@', '@', '@', '0', '@', '@', '@', '@', '@', '0.00', '@', '@', '@']);
    gSheet_(GS.RESP); gSheet_(GS.ACT); gSheet_(GS.TXT); gSheet_(GS.ETQ);
    var resp = 0;
    if (d.ubic && d.ubic.length && !gResp_().length) {   // responsable que traía el Excel (una persona por ubicación)
      var rr = []; d.ubic.forEach(function (x) { if (str_(x.n).trim() && str_(x.resp).trim()) rr.push([str_(x.n).trim(), str_(x.resp).trim(), '', 'Responsable', '1', '1', 'Importado del Excel']); });
      if (rr.length) { gWrite_(GS.RESP, rr); resp = rr.length; }
    }
    log_(u, 'Gestión: importar Excel v10', '', d.inv.length + ' códigos · ' + d.cat.length + ' bloques · ' + reglas.length + ' reglas', u.dev);
    gBump_();
    return { inv: d.inv.length, cat: d.cat.length, reglas: reglas.length, eq: (d.eq || []).length, resp: resp };
  });
}
function api_g_setCfg(tok, patch) {
  var u = auth_(tok, 'Administrador');
  return withLock_(function () {
    var sh = gSheet_(GS.CFG), rows = gRows_(GS.CFG), at = {}, ch = [];
    rows.forEach(function (r, i) { at[str_(r[0]).trim()] = i + 2; });
    Object.keys(patch || {}).forEach(function (k) {
      var def = G_CFG_KEYS.filter(function (x) { return x[0] === k; })[0]; if (!def) return;
      var v = k === 'otrasInst' ? String(patch[k] || '').split(/[,;\s]+/).filter(String).slice(0, 2).join(', ') : String(patch[k] == null ? '' : patch[k]).slice(0, 300);
      if (k === 'modo' && ['Reciclar códigos anteriores', 'Sin reciclar: numerar después del último código'].indexOf(v) < 0) throw valErr_('Modo no válido.');
      if (k === 'consDesde' && v && !/^\d{4}-\d\d-\d\d$/.test(v)) throw valErr_('La fecha debe tener el formato aaaa-mm-dd.');
      var r = at[k]; if (!r) { r = sh.getLastRow() + 1; sh.getRange(r, 1, 1, 3).setValues([[k, '', def[1]]]); at[k] = r; }
      sh.getRange(r, 2).setNumberFormat('@').setValue(v); ch.push(k + ' → ' + (v || '∅'));
    });
    log_(u, 'Gestión: configuración', '', ch.join(' | '), u.dev);
    gBump_();
    return { ok: true };
  });
}
function api_g_setReglas(tok, o) {
  var u = auth_(tok, 'Administrador');
  return withLock_(function () {
    var out = [];
    (o.consBlq || []).forEach(function (b) { var s = String(b || '').trim(); if (!s) return; if (!/^(\d{4}|\d{5}-\d{4})$/.test(blkOrKey_(s))) throw valErr_('Bloque a conservar no válido: ' + s + ' (use 1103 o 11674-1103).'); out.push(['Conservar bloque', blkOrKey_(s), '', '']); });
    (o.rc || []).forEach(function (p) { var a = blk_(p[0]), b = blk_(p[1]); if (!a && !b) return; if (!/^\d{4}$/.test(a) || !/^\d{4}$/.test(b)) throw valErr_('Corrección de familia no válida: ' + a + ' → ' + b); if (a === b) throw valErr_('La familia equivocada y la correcta no pueden ser iguales (' + a + ').'); out.push(['Corregir familia', a, b, String(p[2] || '')]); });
    gWrite_(GS.REG, out);
    log_(u, 'Gestión: reglas de códigos', '', out.map(function (r) { return r[0] + ' ' + r[1] + (r[2] ? '→' + r[2] : ''); }).join(' | '), u.dev);
    gBump_();
    return { ok: true };
  });
}
/** Columna "Conservar" del inventario anterior: Sí / No / vacío (automático). */
function api_g_setConservar(tok, code, val) {
  var u = auth_(tok, 'Administrador');
  val = ['Sí', 'No'].indexOf(val) >= 0 ? val : '';
  return withLock_(function () {
    var sh = gSheet_(GS.INV), last = sh.getLastRow(); if (last < 2) throw valErr_('No hay inventario importado.');
    var codes = sh.getRange(2, 1, last - 1, 1).getValues(), n = norm_(code);
    for (var i = 0; i < codes.length; i++) if (norm_(codes[i][0]) === n) {
      sh.getRange(i + 2, 13).setValue(val);
      log_(u, 'Gestión: conservar código', code, val || 'automático', u.dev); gBump_(); return { ok: true };
    }
    throw valErr_('No existe el código ' + code + '.');
  });
}
function api_g_setCatUsar(tok, code, val) {
  var u = auth_(tok, 'Administrador');
  return withLock_(function () {
    var sh = gSheet_(GS.CAT), last = sh.getLastRow(), codes = sh.getRange(2, 1, Math.max(1, last - 1), 1).getValues();
    for (var i = 0; i < codes.length; i++) if (blk_(codes[i][0]) === blk_(code)) { sh.getRange(i + 2, 4).setValue(val === 'No' ? 'No' : 'Sí'); log_(u, 'Gestión: catálogo usar', code, val, u.dev); gBump_(); return { ok: true }; }
    throw valErr_('No existe el bloque ' + code + '.');
  });
}
function api_g_setEq(tok, list) {
  var u = auth_(tok, 'Administrador');
  return withLock_(function () {
    var out = (list || []).filter(function (x) { return String(x[0] || '').trim(); }).map(function (x) { return [String(x[0]).slice(0, 200), String(x[1] || '').trim().slice(0, 120)]; });
    gWrite_(GS.EQ, out, ['@', '@']); log_(u, 'Gestión: equivalencias', '', out.length + ' filas', u.dev); gBump_();
    return { ok: true };
  });
}
/** Datos de la ubicación (tipo, edificio) en la hoja UBICACIONES de la app. */
function api_g_setLoc(tok, name, o) {
  var u = auth_(tok, 'Administrador');
  return withLock_(function () {
    var sh = ubSheet_(), r = findLoc_(sh, name); if (r < 0) throw valErr_('No existe la ubicación ' + name + '.');
    if ('t' in o) sh.getRange(r, 2).setValue(String(o.t || '').slice(0, 60));
    if ('z' in o) sh.getRange(r, 3).setValue(String(o.z || '').slice(0, 60));
    if ('a' in o) sh.getRange(r, 5).setValue(o.a ? 'Sí' : 'No');
    log_(u, 'Gestión: datos de ubicación', '', name + ' · ' + JSON.stringify(o), u.dev); bumpKey_('locver'); bump_();
    return { ok: true, locs: locsOut_() };
  });
}
function api_g_setTextos(tok, map) {
  var u = auth_(tok, 'Administrador');
  return withLock_(function () {
    var cur = gTextos_(), desc = {}; G_TEXTOS_DEF.forEach(function (t) { desc[t[0]] = t[2]; });
    Object.keys(map || {}).forEach(function (k) { if (k in cur) cur[k] = String(map[k] || '').slice(0, 3000); });
    gWrite_(GS.TXT, Object.keys(cur).map(function (k) { return [k, cur[k], desc[k] || '']; }));
    log_(u, 'Gestión: textos del acta', '', Object.keys(map || {}).join(', '), u.dev);
    return { ok: true, textos: gTextos_() };
  });
}
/** Registra los juegos que se imprimieron (control de entrega). entries = [{u, juego, dest, rol, copias}] */
function api_g_actasGen(tok, entries) {
  var u = auth_(tok, 'Supervisor');
  return withLock_(function () {
    var sh = gSheet_(GS.ACT), prev = gActas_(), anio = Utilities.formatDate(new Date(), tz_(), 'yyyy'), out = [], folios = {};
    (entries || []).slice(0, 500).forEach(function (e) {
      var ub = String(e.u || '').trim(); if (!ub) return;
      if (!folios[ub]) {
        var n = 0; prev.forEach(function (a) { if (norm_(a.u) === norm_(ub)) { var m = a.folio.match(/-(\d+)$/); if (m) n = Math.max(n, +m[1]); } });
        folios[ub] = ub.replace(/\s+/g, '') + '-' + anio + '-' + ('00' + (n + 1)).slice(-3);
      }
      var id = folios[ub] + '-' + (e.juego === 'Original' ? 'O' : e.juego === 'Copia' ? 'C' + (out.filter(function (x) { return x[1] === folios[ub] && x[3] === 'Copia'; }).length + 1) : 'X' + (out.filter(function (x) { return x[1] === folios[ub] && x[3] !== 'Copia' && x[3] !== 'Original'; }).length + 1));
      out.push([id, folios[ub], ub, String(e.juego || ''), String(e.dest || '').slice(0, 120), String(e.rol || '').slice(0, 60), String(Number(e.copias) || 1), new Date(), u.nombre, '', '', '', '', '']);
    });
    if (out.length) {
      var r = sh.getLastRow() + 1;
      sh.getRange(r, 1, out.length, 14).setNumberFormats(out.map(function () { return ['@', '@', '@', '@', '@', '@', '@', 'dd/mm/yyyy hh:mm', '@', 'dd/mm/yyyy hh:mm', 'dd/mm/yyyy hh:mm', '@', '@', '@']; }));
      sh.getRange(r, 1, out.length, 14).setValues(out);
      log_(u, 'Gestión: imprimir actas', '', Object.keys(folios).map(function (k) { return folios[k]; }).join(', '), u.dev);
    }
    return { ok: true, folios: folios, actas: gActas_() };
  });
}
function api_g_actaSet(tok, id, patch) {
  var u = auth_(tok, 'Supervisor');
  return withLock_(function () {
    var a = gActas_().filter(function (x) { return x.id === id; })[0]; if (!a) throw valErr_('No existe el juego ' + id + '.');
    var sh = gSheet_(GS.ACT);
    if ('ent' in patch) sh.getRange(a.row, 10).setValue(patch.ent ? new Date() : '');
    if ('firm' in patch) { sh.getRange(a.row, 11).setValue(patch.firm ? new Date() : ''); if (patch.firm && !a.ent) sh.getRange(a.row, 10).setValue(new Date()); }
    if ('recibe' in patch) sh.getRange(a.row, 12).setValue(String(patch.recibe || '').slice(0, 120));
    if ('nota' in patch) sh.getRange(a.row, 13).setValue(String(patch.nota || '').slice(0, 300));
    log_(u, 'Gestión: control de entrega', id, JSON.stringify(patch), u.dev);
    return { ok: true, actas: gActas_() };
  });
}
/** Guarda en Drive (carpeta "Actas PDF") el PDF del paquete que armó el navegador. */
function api_g_pdf(tok, html, name, folios) {
  var u = auth_(tok, 'Supervisor');
  if (String(html || '').length > 30000000) throw valErr_('El paquete es demasiado grande para un solo PDF: genere menos ubicaciones a la vez.');
  var folder = folderByName_(ACTAS_DIR, true);
  var clean = String(name || 'Actas').replace(/[\/\\:*?"<>|#%]+/g, '-').slice(0, 120) + '.pdf';
  var blob = HtmlService.createHtmlOutput(String(html)).getBlob().getAs('application/pdf').setName(clean);
  var file = folder.createFile(blob);
  var url = file.getUrl();
  if (folios && folios.length) withLock_(function () {
    var sh = gSheet_(GS.ACT); gActas_().forEach(function (a) { if (folios.indexOf(a.folio) >= 0) sh.getRange(a.row, 14).setValue(url); });
  });
  log_(u, 'Gestión: PDF en Drive', '', clean, u.dev);
  return { url: url, name: clean, folder: folder.getUrl(), actas: gActas_() };
}
/** Marca una ubicación como etiquetada: guarda los códigos tal como están ahora. */
function api_g_etiquetar(tok, ubic, codes) {
  var u = auth_(tok, 'Supervisor');
  ubic = String(ubic || '').trim(); if (!ubic) throw valErr_('Falta la ubicación.');
  var list = (codes || []).slice(0, 5000).map(function (c) { return [String(c[0]).slice(0, 40), Number(c[1]) || 1, String(c[2]).slice(0, 30)]; });
  return withLock_(function () {
    var keep = gRows_(GS.ETQ).filter(function (r) { return str_(r[0]).trim() && norm_(r[0]) !== norm_(ubic); }).map(function (r) { return [str_(r[0]), r[1], str_(r[2]), str_(r[3])]; });
    if (list.length) keep.push([ubic, new Date(), u.nombre, JSON.stringify(list)]);
    gWrite_(GS.ETQ, keep, ['@', 'dd/mm/yyyy hh:mm', '@', '@']);
    log_(u, list.length ? 'Gestión: ubicación etiquetada' : 'Gestión: quitar etiquetado', '', ubic + ' · ' + list.length + ' códigos', u.dev);
    return { ok: true, etq: gEtq_() };
  });
}
/** Foto general de la ubicación (o cualquier foto del conteo) para la ficha. */
function api_g_foto(tok, id) { auth_(tok, 'Supervisor'); return api_getImage(tok, id); }

/** Exporta los resultados del motor a un archivo nuevo de Google Sheets (descargable en Excel). */
function api_g_exportar(tok) {
  var u = auth_(tok, 'Supervisor');
  var base = gBase_(); if (!base.inv.length) throw valErr_('Primero importe los datos base del Excel v10 (Configuración → Importar).');
  var R = Motor.compute(Motor.fromApp(base, gRegs_(), locsOut_()));
  var U = Motor.util, name = 'Resultados ' + (base.cfg.periodo || 'conteo') + ' · ' + Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd HHmm');
  var out = SpreadsheetApp.create(name);
  var put = function (title, head, rows, first) {
    var sh = first ? out.getSheets()[0].setName(title) : out.insertSheet(title);
    var data = [head].concat(rows.map(function (r) { return r.map(function (v) { return v == null ? '' : v; }); }));
    sh.getRange(1, 1, data.length, head.length).setValues(data);
    sh.getRange(1, 1, 1, head.length).setFontWeight('bold').setBackground('#14213D').setFontColor('#FFFFFF');
    sh.setFrozenRows(1);
  };
  put('CONTEO', ['#', 'Fecha', 'Ubicación', 'Tipo', 'Etiqueta que tiene', 'Bien', 'Descripción', 'Rubro', 'Bueno', 'Regular', 'Malo', 'Total', 'Código desde', 'Código hasta', 'Inv. anterior en ubic.', 'Marca/modelo/serie', 'Observaciones', 'Foto', 'Contado por', 'Alerta', 'Inst.', 'Bloque'],
    R.logical.map(function (r) { return [r.A, r.fecha, r.C, r.D, r.E, r.F, r.G, r.H, r.I, r.J, r.K, r.L, r.M, r.N, r.O, r.P, r.Q, r.R, r.U, r.V, r.W, r.X]; }), true);
  put('CODIGOS_ASIGNADOS', ['#', 'Código', 'Descripción', 'Bloque', 'Ubicación', 'Estado', 'Fecha', 'Marca/modelo/serie', 'Origen', 'Acción', 'Detalle', 'Etiqueta que tenía', 'Etiqueta', 'Viene del código', 'Fecha alta', 'Valor'],
    R.cod.map(function (c) { return [c.n, c.B, c.C, c.D, c.E, c.F, c.G, c.H, c.R, c.U, c.V, c.X, c.Z, c.AA, c.AD, c.AE]; }));
  put('INVENTARIO_ANTERIOR', ['Código', 'Descripción', 'Bloque', 'Fecha', 'Valor', 'Calidad', 'Ubicación estándar', 'Reservado', 'Estado del código', 'Ubicación donde se encontró', 'Motivo'],
    R.inv.map(function (o) { return [o.code, o.desc, o.blk, o.fecha, o.valor, o.calidad, o.M, o.Y, o.R, o.T, o.V]; }));
  put('REPORTE_CARGOS', ['#', 'Código nuevo', 'Descripción', 'Bloque', 'Ubicación', 'Estado', 'Marca/modelo/serie', 'Fecha alta', 'Valor', 'Detalle'],
    R.cargos.det.map(function (d) { return [d.A, d.B, d.C, d.D, d.E, d.F, d.G, d.H, d.I, d.J]; }));
  put('REPORTE_DESCARGOS', ['#', 'Código', 'Descripción', 'Bloque', 'Ubicación', 'Calidad', 'Marca/modelo/serie', 'Fecha', 'Valor', 'Motivo'],
    R.descargos.det.map(function (d) { return [d.A, d.B, d.C, d.D, d.E, d.F, d.G, d.H, d.I, d.J]; }));
  put('REPORTE_ETIQUETAS', ['#', 'Etiqueta', 'Descripción en inventario', 'Ubicación en inventario', 'Ubicación contada', 'Fecha', 'Resultado', 'Bien contado', 'Código asignado', 'Acción'],
    R.etiquetas.det.map(function (d) { return [d.A, d.B, d.C, d.D, d.E, d.F, d.G, d.H, d.I, d.J]; }));
  put('REPORTE_RECLASIFICACION', ['#', 'Código a descargar', 'Descripción', 'Fecha', 'Valor', 'Ubicación', 'Familia correcta', 'Nuevo código', 'Ubicación contada', 'Acción'],
    R.reclasif.det.map(function (d) { return [d.A, d.B, d.C, d.D, d.E, d.F, d.G, d.H, d.I, d.J]; }));
  put('CONSERVAR_CODIGOS', ['#', 'Código', 'Descripción', 'Marca', 'Modelo', 'Serie', 'Fecha', 'Ubicación', 'Estado', 'Encontrado en'],
    R.conservar.det.map(function (d) { return [d.A, d.B, d.C, d.D, d.E, d.F, d.G, d.H, d.I, d.J]; }));
  put('CONSOLIDADO', ['Ubicación', 'Tipo', 'Edificio', 'Bueno', 'Regular', 'Malo', 'Total', '% malo', 'Filas', 'Desde', 'Hasta', 'Estado', 'Inv. anterior', 'Diferencia'],
    R.consUb.filter(Boolean).map(function (x) { return [x.A, x.B, x.C, x.D, x.E, x.F, x.G, x.H, x.I, x.J, x.K, x.L, x.M, x.N]; }));
  try { DriveApp.getFileById(out.getId()).moveTo(folderByName_(RESULT_DIR, true)); } catch (e) {}
  log_(u, 'Gestión: exportar resultados', '', name + ' · ' + R.cod.length + ' códigos', u.dev);
  return { name: name, url: out.getUrl(), xlsx: 'https://docs.google.com/spreadsheets/d/' + out.getId() + '/export?format=xlsx', codigos: R.cod.length };
}
/** Diagnóstico desde el editor: calcula todo con los datos actuales. */
function probarGestion() {
  var t = Date.now(), base = gBase_(), regs = gRegs_();
  var R = Motor.compute(Motor.fromApp(base, regs, locsOut_()));
  Logger.log('Inventario: ' + base.inv.length + ' · catálogo: ' + base.cat.length + ' · registros: ' + regs.length + ' · códigos asignados: ' + R.cod.length + ' · ' + (Date.now() - t) + ' ms');
}

/* ======================================================================
 * VERSIÓN 6 · personas (DUI/NIP), ubicaciones, traslados, notas y agenda,
 * plantillas de reportes, justificación de faltantes, acta firmada escaneada
 * ====================================================================== */
var FIRMADAS_DIR = 'Actas firmadas';
function gid_(p) { return p + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 1296).toString(36).toUpperCase(); }
/** DUI de El Salvador: 8 dígitos, guion y dígito verificador (pesos 9..2, módulo 10). */
function duiCheck_(s) {
  s = String(s || '').trim(); if (!s) return 'vacio';
  var m = s.replace(/\s/g, '').match(/^(\d{8})-?(\d)$/); if (!m) return 'formato';
  var sum = 0; for (var i = 0; i < 8; i++) sum += Number(m[1].charAt(i)) * (9 - i);
  var dv = (10 - (sum % 10)) % 10;
  return dv === Number(m[2]) ? 'ok' : 'verificador';
}
function duiFmt_(s) { var m = String(s || '').replace(/\s/g, '').match(/^(\d{8})-?(\d)$/); return m ? m[1] + '-' + m[2] : String(s || '').trim(); }
function gPersonas_() {
  return gRows_(GS.PER).filter(function (r) { return str_(r[0]).trim() && str_(r[1]).trim(); }).map(function (r, i) {
    return { row: i + 2, id: str_(r[0]).trim(), n: str_(r[1]).trim(), dui: str_(r[2]).trim(), nip: str_(r[3]).trim(), cargo: str_(r[4]), tel: str_(r[5]), correo: str_(r[6]), estado: str_(r[7]) || 'Activo', nota: str_(r[8]) };
  });
}
/** Valida y deja lista una persona; lanza VAL| con el problema. warn: 'verificador' si el dígito no cuadra y no se forzó. */
function personaLimpia_(o, todas, selfId) {
  var n = String(o.n || '').trim().toUpperCase().replace(/\s+/g, ' ').slice(0, 100);
  if (n.length < 5) throw valErr_('Escriba el nombre completo.');
  var dui = String(o.dui || '').trim(), nip = String(o.nip || '').trim().replace(/\s/g, '');
  if (dui) {
    var ck = duiCheck_(dui);
    if (ck === 'formato') throw valErr_('DUI con formato incorrecto (' + dui + '). Debe ser 00000000-0.');
    if (ck === 'verificador' && !o.force) throw valErr_('DUIVERIF|El dígito verificador del DUI ' + duiFmt_(dui) + ' no coincide. Revíselo; si está bien escrito, guarde de todos modos.');
    dui = duiFmt_(dui);
  }
  if (nip && !/^\d{4,12}$/.test(nip)) throw valErr_('El NIP debe tener solo números (' + nip + ').');
  (todas || []).forEach(function (p) {
    if (p.id === selfId || p.estado === 'Baja') return;
    if (dui && p.dui === dui) throw valErr_('El DUI ' + dui + ' ya es de ' + p.n + '.');
    if (nip && p.nip === nip) throw valErr_('El NIP ' + nip + ' ya es de ' + p.n + '.');
    if (!o.force && norm_(p.n) === norm_(n) && !selfId) throw valErr_('NOMBRE|Ya existe ' + p.n + '. ¿Es otra persona con el mismo nombre?');
  });
  var correo = String(o.correo || '').trim().slice(0, 120);
  if (correo && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) throw valErr_('Correo no válido: ' + correo);
  return { n: n, dui: dui, nip: nip, cargo: String(o.cargo || '').trim().slice(0, 80), tel: String(o.tel || '').trim().slice(0, 30), correo: correo,
    estado: ['Activo', 'Baja'].indexOf(o.estado) >= 0 ? o.estado : 'Activo', nota: String(o.nota || '').slice(0, 300) };
}
function api_g_persona(tok, o) {
  var u = auth_(tok, 'Supervisor');
  return withLock_(function () {
    var todas = gPersonas_(), cur = o.id ? todas.filter(function (p) { return p.id === o.id; })[0] : null;
    if (o.id && !cur) throw valErr_('Esa persona ya no existe.');
    var p = personaLimpia_(o, todas, cur ? cur.id : null), sh = gSheet_(GS.PER);
    var row = [cur ? cur.id : gid_('P'), p.n, p.dui, p.nip, p.cargo, p.tel, p.correo, p.estado, p.nota, cur ? '' : new Date()];
    if (cur) { sh.getRange(cur.row, 1, 1, 9).setNumberFormat('@').setValues([row.slice(0, 9)]); }
    else { var r = sh.getLastRow() + 1; sh.getRange(r, 1, 1, 9).setNumberFormat('@'); sh.getRange(r, 1, 1, 10).setValues([row]); }
    // el nombre y cargo también se copian en RESPONSABLES para que la hoja se lea sola
    if (cur) { var rs = gSheet_(GS.RESP), rr = gRows_(GS.RESP); rr.forEach(function (x, i) { if (str_(x[7]) === cur.id) rs.getRange(i + 2, 2, 1, 2).setValues([[p.n, p.cargo]]); }); }
    log_(u, cur ? 'Gestión: modificar persona' : 'Gestión: nueva persona', row[0], p.n + (p.dui ? ' · DUI ' + p.dui : '') + (p.estado === 'Baja' ? ' · BAJA' : ''), u.dev);
    return { ok: true, id: row[0], personas: gPersonas_(), resp: gResp_() };
  });
}
/** Responsables de una ubicación: lista completa en orden de firma. list = [{pid, rol, copias}] */
function api_g_setResp(tok, ubic, list) {
  var u = auth_(tok, 'Supervisor');
  ubic = String(ubic || '').trim(); if (!ubic) throw valErr_('Falta la ubicación.');
  var ROL = ['Responsable', 'Corresponsable', 'Testigo', 'Otro'];
  if ((list || []).length > 30) throw valErr_('Máximo 30 personas por ubicación.');
  return withLock_(function () {
    var per = gPersonas_(), byId = {}; per.forEach(function (p) { byId[p.id] = p; });
    var shP = gSheet_(GS.PER), seen = {};
    var nue = (list || []).map(function (x, i) {
      var p = x.pid ? byId[x.pid] : null;
      if (!p && x.n) {   // compatibilidad: persona escrita a mano → se busca por nombre o se crea
        p = per.filter(function (q) { return norm_(q.n) === norm_(x.n); })[0];
        if (!p) { var c = personaLimpia_({ n: x.n, cargo: x.cargo, force: true }, per, null); p = { id: gid_('P'), n: c.n, cargo: c.cargo }; var r = shP.getLastRow() + 1; shP.getRange(r, 1, 1, 9).setNumberFormat('@'); shP.getRange(r, 1, 1, 10).setValues([[p.id, p.n, '', '', p.cargo, '', '', 'Activo', 'Creada desde responsables', new Date()]]); per.push(p); byId[p.id] = p; }
      }
      if (!p) throw valErr_('Persona no encontrada en el directorio.');
      if (seen[p.id]) throw valErr_(p.n + ' está repetido en la lista.'); seen[p.id] = 1;
      var cop = Number(x.copias); cop = isFinite(cop) ? Math.max(0, Math.min(10, Math.floor(cop))) : 1;
      return [ubic, p.n, p.cargo || '', ROL.indexOf(x.rol) >= 0 ? x.rol : 'Responsable', String(cop), String(i + 1), String(x.nota || '').slice(0, 200), p.id];
    });
    var keep = gRows_(GS.RESP).filter(function (r) { return str_(r[0]).trim() && norm_(r[0]) !== norm_(ubic); }).map(function (r) { return r.map(str_); });
    gWrite_(GS.RESP, keep.concat(nue), ['@', '@', '@', '@', '@', '@', '@', '@']);
    log_(u, 'Gestión: responsables', '', ubic + ' · ' + nue.map(function (r) { return r[1] + ' (' + r[3] + ')'; }).join(', '), u.dev); bump_();
    return { ok: true, resp: gResp_(), personas: gPersonas_() };
  });
}
/** Carga masiva de personas (y opcionalmente su asignación a ubicaciones). apply=false solo revisa. */
function api_g_personasImport(tok, rows, apply) {
  var u = auth_(tok, 'Administrador');
  return withLock_(function () {
    var per = gPersonas_(), locs = locsOut_(), res = { nuevas: [], cambios: [], errores: [], asign: [] }, tmp = per.slice();
    (rows || []).slice(0, 2000).forEach(function (x, i) {
      var fila = i + 2;
      try {
        var dui = duiFmt_(x.dui), cur = null;
        if (dui) cur = tmp.filter(function (p) { return p.dui === dui; })[0];
        if (!cur && x.nip) cur = tmp.filter(function (p) { return p.nip === String(x.nip).trim(); })[0];
        if (!cur) cur = tmp.filter(function (p) { return norm_(p.n) === norm_(x.n); })[0];
        var po = { n: x.n, dui: x.dui || (cur && cur.dui) || '', nip: x.nip || (cur && cur.nip) || '', cargo: x.cargo || (cur && cur.cargo) || '', tel: x.tel || (cur && cur.tel) || '', correo: x.correo || (cur && cur.correo) || '', estado: x.estado || (cur && cur.estado) || 'Activo', nota: (cur && cur.nota) || '', force: !!x.force }, c;
        try { c = personaLimpia_(po, tmp, cur ? cur.id : null); }
        catch (e1) { if (!/DUIVERIF/.test(e1.message)) throw e1; po.force = true; c = personaLimpia_(po, tmp, cur ? cur.id : null); res.errores.push({ fila: fila, n: c.n, msg: 'Aviso: el dígito verificador del DUI ' + c.dui + ' no coincide (se guarda igual; revíselo).' }); }
        if (cur) { res.cambios.push({ fila: fila, n: c.n, id: cur.id, c: c }); Object.assign(cur, c); }
        else { var np = Object.assign({ id: gid_('P') }, c); tmp.push(np); res.nuevas.push({ fila: fila, n: c.n, id: np.id, c: c }); }
        var ub = String(x.ubic || '').trim();
        if (ub) {
          var lo = locs.filter(function (l) { return norm_(l.n) === norm_(ub); })[0];
          if (!lo) res.errores.push({ fila: fila, n: c.n, msg: 'La ubicación ' + ub + ' no existe: la persona se guarda sin asignar.' });
          else res.asign.push({ u: lo.n, id: (cur || tmp[tmp.length - 1]).id, n: c.n, rol: x.rol || 'Responsable', copias: x.copias === '' || x.copias == null ? 1 : x.copias });
        }
      } catch (e) { res.errores.push({ fila: fila, n: String(x.n || ''), msg: String(e.message).replace(/^(VAL\|)?(DUIVERIF\||NOMBRE\|)?/, '') }); }
    });
    if (!apply) return res;
    var sh = gSheet_(GS.PER);
    res.cambios.forEach(function (x) { var p = per.filter(function (q) { return q.id === x.id; })[0]; if (p) sh.getRange(p.row, 2, 1, 7).setValues([[x.c.n, x.c.dui, x.c.nip, x.c.cargo, x.c.tel, x.c.correo, x.c.estado]]); });
    if (res.nuevas.length) { var r0 = sh.getLastRow() + 1, data = res.nuevas.map(function (x) { return [x.id, x.c.n, x.c.dui, x.c.nip, x.c.cargo, x.c.tel, x.c.correo, x.c.estado, 'Carga masiva', new Date()]; }); sh.getRange(r0, 1, data.length, 9).setNumberFormat('@'); sh.getRange(r0, 1, data.length, 10).setValues(data); }
    if (res.asign.length) {
      var rr = gRows_(GS.RESP).filter(function (r) { return str_(r[0]).trim(); }).map(function (r) { return r.map(str_); });
      res.asign.forEach(function (a) {
        if (rr.some(function (r) { return norm_(r[0]) === norm_(a.u) && r[7] === a.id; })) return;
        var ord = rr.filter(function (r) { return norm_(r[0]) === norm_(a.u); }).length + 1;
        rr.push([a.u, a.n, '', ['Responsable', 'Corresponsable', 'Testigo', 'Otro'].indexOf(a.rol) >= 0 ? a.rol : 'Responsable', String(Math.max(0, Math.min(10, Number(a.copias) || 0))), String(ord), 'Carga masiva', a.id]);
      });
      gWrite_(GS.RESP, rr, ['@', '@', '@', '@', '@', '@', '@', '@']);
    }
    log_(u, 'Gestión: carga masiva de personas', '', res.nuevas.length + ' nuevas · ' + res.cambios.length + ' actualizadas · ' + res.asign.length + ' asignaciones · ' + res.errores.length + ' avisos', u.dev);
    res.personas = gPersonas_(); res.resp = gResp_();
    return res;
  });
}

/* ---------- ubicaciones ---------- */
function regCountBy_(name) { var n = norm_(name), c = 0; rows_(SH.REG, NREG).forEach(function (r) { if (str_(r[0]) && !str_(r[26]) && norm_(r[2]) === n) c++; }); return c; }
/** Crear o modificar una ubicación. o = {orig?, n, t, z, a} */
function api_g_locSave(tok, o) {
  var u = auth_(tok, 'Supervisor');
  var name = String(o.n || '').trim().toUpperCase().replace(/\s+/g, ' ').slice(0, 120);
  if (name.length < 2) throw valErr_('Escriba el nombre de la ubicación.');
  return withLock_(function () {
    var sh = ubSheet_(), orig = String(o.orig || '').trim(), r = orig ? findLoc_(sh, orig) : -1;
    var other = findLoc_(sh, name);
    if (other > 0 && other !== r) throw valErr_('Ya existe la ubicación ' + name + '.');
    if (orig && r < 0) throw valErr_('No existe la ubicación ' + orig + '.');
    if (!orig) {
      r = sh.getLastRow() + 1; sh.getRange(r, 1).setNumberFormat('@');
      sh.getRange(r, 1, 1, NUB).setValues([[name, String(o.t || '').slice(0, 60), String(o.z || '').slice(0, 60), '', o.a === false ? 'No' : 'Sí', 'Sí', String(o.nota || 'Agregada desde Gestión').slice(0, 300), u.nombre, '', '', '', '[]', '']]);
      log_(u, 'Gestión: nueva ubicación', '', name, u.dev);
    } else {
      if (norm_(orig) !== norm_(name)) {
        if (regCountBy_(orig) > 0) throw valErr_('No se puede renombrar ' + orig + ': ya tiene registros del conteo. Cree una ubicación nueva o corrija los registros en la app.');
        if (gActas_().some(function (a) { return norm_(a.u) === norm_(orig); })) throw valErr_('No se puede renombrar ' + orig + ': ya tiene actas registradas.');
        sh.getRange(r, 1).setValue(name);
        var rs = gSheet_(GS.RESP), rr = gRows_(GS.RESP); rr.forEach(function (x, i) { if (norm_(x[0]) === norm_(orig)) rs.getRange(i + 2, 1).setValue(name); });
      }
      if ('t' in o) sh.getRange(r, 2).setValue(String(o.t || '').slice(0, 60));
      if ('z' in o) sh.getRange(r, 3).setValue(String(o.z || '').slice(0, 60));
      if ('a' in o) sh.getRange(r, 5).setValue(o.a ? 'Sí' : 'No');
      log_(u, 'Gestión: modificar ubicación', '', orig + (norm_(orig) !== norm_(name) ? ' → ' + name : '') + ' · ' + JSON.stringify({ t: o.t, z: o.z, a: o.a }), u.dev);
    }
    bumpKey_('locver'); bump_();
    return { ok: true, n: name, locs: locsOut_(), resp: gResp_() };
  });
}
/** Eliminar una ubicación (solo si nunca se usó); si ya tiene registros, se desactiva. */
function api_g_locDelete(tok, name) {
  var u = auth_(tok, 'Administrador');
  return withLock_(function () {
    var sh = ubSheet_(), r = findLoc_(sh, name); if (r < 0) throw valErr_('No existe la ubicación ' + name + '.');
    var n = regCountBy_(name);
    if (n > 0) throw valErr_(name + ' tiene ' + n + ' registro(s) del conteo: no se puede eliminar. Desactívela.');
    if (gActas_().some(function (a) { return norm_(a.u) === norm_(name); })) throw valErr_(name + ' tiene actas registradas: no se puede eliminar. Desactívela.');
    sh.deleteRow(r);
    var keep = gRows_(GS.RESP).filter(function (x) { return str_(x[0]).trim() && norm_(x[0]) !== norm_(name); }).map(function (x) { return x.map(str_); });
    gWrite_(GS.RESP, keep, ['@', '@', '@', '@', '@', '@', '@', '@']);
    log_(u, 'Gestión: eliminar ubicación', '', name, u.dev); bumpKey_('locver'); bump_();
    return { ok: true, locs: locsOut_(), resp: gResp_() };
  });
}
/** Cambia el orden de la lista (es el orden de numeración de los códigos). names = todas las ubicaciones en el orden nuevo. */
function api_g_locOrder(tok, names) {
  var u = auth_(tok, 'Administrador');
  return withLock_(function () {
    var sh = ubSheet_(), last = sh.getLastRow(); if (last < 2) return { ok: true, locs: [] };
    var data = sh.getRange(2, 1, last - 1, NUB).getValues().filter(function (r) { return str_(r[0]).trim(); });
    var pos = {}; (names || []).forEach(function (n, i) { pos[norm_(n)] = i; });
    if (data.length !== (names || []).length || data.some(function (r) { return !(norm_(r[0]) in pos); })) throw valErr_('La lista cambió mientras ordenaba. Actualice e intente de nuevo.');
    data.sort(function (a, b) { return pos[norm_(a[0])] - pos[norm_(b[0])]; });
    data.forEach(function (r) { r[5] = ''; });   // al ordenar a mano deja de ser "nueva": queda donde la puso
    sh.getRange(2, 1, last - 1, NUB).clearContent();
    sh.getRange(2, 1, data.length, 1).setNumberFormat('@');
    sh.getRange(2, 1, data.length, NUB).setValues(data);
    log_(u, 'Gestión: orden de ubicaciones', '', data.map(function (r) { return str_(r[0]); }).join(', ').slice(0, 2000), u.dev);
    bumpKey_('locver'); bumpKey_('fullver'); bump_();
    return { ok: true, locs: locsOut_() };
  });
}
/** Carga de ubicaciones desde Excel: crea las que faltan y actualiza tipo, edificio y activa. */
function api_g_locImport(tok, rows, apply) {
  var u = auth_(tok, 'Administrador');
  return withLock_(function () {
    var sh = ubSheet_(), res = { nuevas: [], cambios: [], errores: [] };
    var cur = locsOut_(), byN = {}; cur.forEach(function (l) { byN[norm_(l.n)] = l; });
    (rows || []).slice(0, 1000).forEach(function (x, i) {
      var n = String(x.n || '').trim().toUpperCase().replace(/\s+/g, ' ');
      if (n.length < 2) { if (x.t || x.z) res.errores.push({ fila: i + 2, msg: 'Fila sin nombre de ubicación' }); return; }
      var a = /^(no|inactiva|0)$/i.test(String(x.a || '').trim()) ? false : true, l = byN[norm_(n)];
      if (!l) res.nuevas.push({ n: n, t: String(x.t || ''), z: String(x.z || ''), a: a });
      else if (String(x.t || '') !== l.t || String(x.z || '') !== l.z || a !== l.a) res.cambios.push({ n: l.n, t: String(x.t || ''), z: String(x.z || ''), a: a, antes: [l.t, l.z, l.a ? 'Sí' : 'No'].join(' · ') });
    });
    if (!apply) return res;
    res.cambios.forEach(function (c) { var r = findLoc_(sh, c.n); if (r > 0) sh.getRange(r, 2, 1, 4).setValues([[c.t, c.z, sh.getRange(r, 4).getValue(), c.a ? 'Sí' : 'No']]); });
    if (res.nuevas.length) { var r0 = sh.getLastRow() + 1; sh.getRange(r0, 1, res.nuevas.length, 1).setNumberFormat('@'); sh.getRange(r0, 1, res.nuevas.length, NUB).setValues(res.nuevas.map(function (c) { return [c.n, c.t, c.z, '', c.a ? 'Sí' : 'No', 'Sí', 'Carga desde Excel', u.nombre, '', '', '', '[]', '']; })); }
    log_(u, 'Gestión: carga de ubicaciones', '', res.nuevas.length + ' nuevas · ' + res.cambios.length + ' modificadas', u.dev); bumpKey_('locver'); bump_();
    res.locs = locsOut_(); return res;
  });
}
/** Historial de una ubicación o de un código, desde la BITÁCORA. */
function api_g_hist(tok, term) {
  auth_(tok, 'Supervisor');
  var t = norm_(term); if (t.length < 2) return [];
  var sh = logSheet_(), last = sh.getLastRow(); if (last < 2) return [];
  var from = Math.max(2, last - 4999), rows = sh.getRange(from, 1, last - from + 1, NLOG).getValues(), out = [];
  var re = new RegExp('(^|[^A-Z0-9])' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^A-Z0-9]|$)');
  for (var i = rows.length - 1; i >= 0 && out.length < 120; i--) {
    var r = rows[i], txt = norm_(r[4]) + ' ' + norm_(r[5]);
    if (re.test(txt) && !/^(Ingreso|Salida|Foto)$/.test(str_(r[3]))) out.push({ f: str_(r[0]), u: str_(r[1]), a: str_(r[3]), r: str_(r[4]), d: str_(r[5]).slice(0, 300) });
  }
  return out;
}

/* ---------- traslados, justificaciones y acta firmada ---------- */
function gTraslados_() {
  return gRows_(GS.TRA).filter(function (r) { return str_(r[0]); }).map(function (r) {
    return { id: str_(r[0]), t: ms_(r[1]), code: str_(r[2]), bien: str_(r[3]), de: str_(r[4]), a: str_(r[5]), motivo: str_(r[6]), autorizo: str_(r[7]), por: str_(r[8]), nota: str_(r[9]) };
  });
}
function api_g_traslado(tok, o) {
  var u = auth_(tok, 'Supervisor');
  var code = String(o.code || '').trim(), a = String(o.a || '').trim();
  if (!code) throw valErr_('Falta el código del bien.');
  if (!a) throw valErr_('Indique a dónde se traslada.');
  if (String(o.motivo || '').trim().length < 3) throw valErr_('Escriba el motivo del traslado.');
  if (!String(o.autorizo || '').trim()) throw valErr_('Indique quién autorizó el traslado.');
  return withLock_(function () {
    var sh = gSheet_(GS.TRA), r = sh.getLastRow() + 1, id = gid_('T');
    sh.getRange(r, 1, 1, 10).setNumberFormats([['@', 'dd/mm/yyyy hh:mm', '@', '@', '@', '@', '@', '@', '@', '@']]);
    sh.getRange(r, 1, 1, 10).setValues([[id, o.fecha ? new Date(String(o.fecha) + 'T12:00:00') : new Date(), code, String(o.bien || '').slice(0, 150), String(o.de || '').slice(0, 120), a.slice(0, 120), String(o.motivo).slice(0, 300), String(o.autorizo).slice(0, 120), u.nombre, String(o.nota || '').slice(0, 300)]]);
    log_(u, 'Gestión: traslado', code, (o.de || '') + ' → ' + a + ' · ' + o.motivo, u.dev);
    return { ok: true, traslados: gTraslados_() };
  });
}
function gJustif_() { var o = {}; gRows_(GS.JUS).forEach(function (r) { var k = str_(r[0]).trim(); if (k) o[k] = { t: str_(r[1]), por: str_(r[2]), f: ms_(r[3]) }; }); return o; }
function api_g_justif(tok, code, text) {
  var u = auth_(tok, 'Supervisor');
  code = String(code || '').trim(); if (!code) throw valErr_('Falta el código.');
  return withLock_(function () {
    var sh = gSheet_(GS.JUS), rows = gRows_(GS.JUS), at = -1;
    rows.forEach(function (r, i) { if (str_(r[0]).trim() === code) at = i + 2; });
    var t = String(text || '').trim().slice(0, 500);
    if (at < 0 && t) { at = sh.getLastRow() + 1; sh.getRange(at, 1).setNumberFormat('@'); }
    if (at > 0) sh.getRange(at, 1, 1, 4).setValues([[code, t, t ? u.nombre : '', t ? new Date() : '']]);
    log_(u, 'Gestión: justificación de faltante', code, t || '(borrada)', u.dev);
    return { ok: true, justif: gJustif_() };
  });
}
/** Sube la foto o PDF del acta firmada y la vincula a todos los juegos de ese folio. */
function api_g_actaFirmada(tok, folio, b64, mime, name) {
  var u = auth_(tok, 'Supervisor');
  if (String(b64 || '').length > 14000000) throw valErr_('El archivo es demasiado grande (máximo 10 MB).');
  if (!/^(image\/(jpeg|png|webp)|application\/pdf)$/.test(String(mime))) throw valErr_('Solo se aceptan fotos (JPG/PNG) o PDF.');
  var folder = folderByName_(FIRMADAS_DIR, true);
  var ext = mime === 'application/pdf' ? '.pdf' : mime === 'image/png' ? '.png' : '.jpg';
  var file = folder.createFile(Utilities.newBlob(Utilities.base64Decode(b64), mime, String(folio).replace(/[^A-Za-z0-9_-]/g, '_') + '_FIRMADA_' + Utilities.formatDate(new Date(), tz_(), 'yyyyMMdd_HHmm') + ext));
  var url = file.getUrl ? file.getUrl() : 'https://drive.google.com/file/d/' + file.getId() + '/view';
  return withLock_(function () {
    var sh = gSheet_(GS.ACT), n = 0;
    gActas_().forEach(function (a) { if (a.folio === folio) { sh.getRange(a.row, 15).setValue(url); if (!a.firm) sh.getRange(a.row, 11).setValue(new Date()); if (!a.ent) sh.getRange(a.row, 10).setValue(new Date()); n++; } });
    if (!n) throw valErr_('No existe el folio ' + folio + '.');
    log_(u, 'Gestión: acta firmada escaneada', folio, String(name || '') + ' · ' + n + ' juegos', u.dev);
    return { ok: true, url: url, actas: gActas_() };
  });
}

/* ---------- bloc de notas, pendientes y agenda ---------- */
function gNotas_(u) {
  return gRows_(GS.NOT).filter(function (r) { return str_(r[0]) && (str_(r[11]) === u.id || norm_(r[10]) === 'SI'); }).map(function (r) {
    return { id: str_(r[0]), tipo: str_(r[1]), texto: str_(r[2]), fecha: d10_(r[3]), hora: str_(r[4]).slice(0, 5), aviso: str_(r[5]) === '' ? -1 : Number(r[5]), hecho: norm_(r[6]) === 'SI',
      fijada: norm_(r[7]) === 'SI', vinc: str_(r[8]), color: str_(r[9]), comp: norm_(r[10]) === 'SI', uid: str_(r[11]), por: str_(r[12]), creado: ms_(r[13]), mod: ms_(r[14]) };
  });
}
/** Crear o modificar una nota / pendiente / actividad / borrador. */
function api_g_nota(tok, o) {
  var u = auth_(tok, 'Supervisor');
  var tipo = ['borrador', 'pendiente', 'nota', 'actividad'].indexOf(o.tipo) >= 0 ? o.tipo : 'nota';
  var fecha = String(o.fecha || '').trim(); if (fecha && !/^\d{4}-\d\d-\d\d$/.test(fecha)) throw valErr_('Fecha no válida.');
  var hora = String(o.hora || '').trim(); if (hora && !/^\d{2}:\d{2}$/.test(hora)) throw valErr_('Hora no válida.');
  if (tipo === 'actividad' && !fecha) throw valErr_('La actividad necesita una fecha.');
  if (tipo !== 'borrador' && !String(o.texto || '').trim()) throw valErr_('Escriba el texto.');
  return withLock_(function () {
    var sh = gSheet_(GS.NOT), rows = gRows_(GS.NOT), at = -1, prev = null;
    rows.forEach(function (r, i) { if (o.id ? str_(r[0]) === o.id : (tipo === 'borrador' && str_(r[1]) === 'borrador' && str_(r[11]) === u.id)) { at = i + 2; prev = r; } });
    if (prev && str_(prev[11]) !== u.id && !(u.lvl >= 3)) throw valErr_('Solo quien la creó puede modificarla.');
    var row = [prev ? str_(prev[0]) : gid_('N'), tipo, String(o.texto || '').slice(0, 5000), fecha, hora, o.aviso == null || o.aviso < 0 ? '' : String(Number(o.aviso) || 0), o.hecho ? 'Sí' : '', o.fijada ? 'Sí' : '',
      String(o.vinc || '').slice(0, 60), String(o.color || '').slice(0, 12), o.comp ? 'Sí' : '', prev ? str_(prev[11]) : u.id, prev ? str_(prev[12]) : u.nombre, prev ? prev[13] : new Date(), new Date()];
    if (at < 0) at = sh.getLastRow() + 1;
    sh.getRange(at, 1, 1, 13).setNumberFormat('@');
    sh.getRange(at, 1, 1, 15).setValues([row]);
    return { ok: true, id: row[0], notas: gNotas_(u) };
  });
}
function api_g_notaDel(tok, id) {
  var u = auth_(tok, 'Supervisor');
  return withLock_(function () {
    var sh = gSheet_(GS.NOT), rows = gRows_(GS.NOT);
    for (var i = 0; i < rows.length; i++) if (str_(rows[i][0]) === id) {
      if (str_(rows[i][11]) !== u.id && u.lvl < 3) throw valErr_('Solo quien la creó puede borrarla.');
      sh.deleteRow(i + 2); break;
    }
    return { ok: true, notas: gNotas_(u) };
  });
}

/* ---------- plantillas de reportes y tablas descargables ---------- */
function gPlantillas_() { return gRows_(GS.PLA).filter(function (r) { return str_(r[0]).trim(); }).map(function (r) { return { n: str_(r[0]).trim(), rep: str_(r[1]), cfg: json_(str_(r[2]), {}), por: str_(r[3]) }; }); }
function api_g_plantilla(tok, nombre, rep, cfg, borrar) {
  var u = auth_(tok, 'Supervisor');
  nombre = String(nombre || '').trim().slice(0, 60); if (nombre.length < 3) throw valErr_('Escriba un nombre para la plantilla.');
  return withLock_(function () {
    var keep = gRows_(GS.PLA).filter(function (r) { return str_(r[0]).trim() && norm_(r[0]) !== norm_(nombre); }).map(function (r) { return [str_(r[0]), str_(r[1]), str_(r[2]), str_(r[3]), r[4]]; });
    if (!borrar) keep.push([nombre, String(rep || ''), JSON.stringify(cfg || {}).slice(0, 40000), u.nombre, new Date()]);
    gWrite_(GS.PLA, keep, ['@', '@', '@', '@', 'dd/mm/yyyy hh:mm']);
    log_(u, borrar ? 'Gestión: borrar plantilla' : 'Gestión: guardar plantilla', '', nombre, u.dev);
    return { ok: true, plantillas: gPlantillas_() };
  });
}
/** Crea un archivo de Google Sheets con una o varias tablas y devuelve el enlace de descarga en Excel. tablas = [{t, head, rows}] */
function api_g_tablas(tok, nombre, tablas) {
  var u = auth_(tok, 'Supervisor');
  var name = String(nombre || 'Tabla').slice(0, 80) + ' · ' + Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd HHmm');
  var out = SpreadsheetApp.create(name);
  (tablas || []).slice(0, 20).forEach(function (tb, i) {
    var sh = i === 0 ? out.getSheets()[0].setName(String(tb.t || 'Hoja').slice(0, 90)) : out.insertSheet(String(tb.t || 'Hoja ' + (i + 1)).slice(0, 90));
    var head = (tb.head || []).map(String), rows = (tb.rows || []).slice(0, 20000).map(function (r) { var a = []; for (var j = 0; j < head.length; j++) a.push(r[j] == null ? '' : r[j]); return a; });
    if (!head.length) return;
    sh.getRange(1, 1, rows.length + 1, head.length).setNumberFormat('@');
    sh.getRange(1, 1, rows.length + 1, head.length).setValues([head].concat(rows));
    sh.getRange(1, 1, 1, head.length).setFontWeight('bold').setBackground('#14213D').setFontColor('#FFFFFF');
    sh.setFrozenRows(1);
  });
  try { DriveApp.getFileById(out.getId()).moveTo(folderByName_(RESULT_DIR, true)); } catch (e) {}
  log_(u, 'Gestión: descargar tabla', '', name, u.dev);
  return { name: name, url: out.getUrl(), xlsx: 'https://docs.google.com/spreadsheets/d/' + out.getId() + '/export?format=xlsx' };
}

/* ================= CATÁLOGO: editar nombres, agregar y quitar bloques ================= */
/**
 * ch = { upd:[{c, nombre, usar}], add:[{c, nombre, usar}], del:[c] }.
 * El nombre editado se guarda como "Descripción institucional" (el nombre del manual no se toca).
 * Si sync, también se actualiza la hoja CATALOGO de la app de conteo (lo que ve el contador).
 */
function api_g_catSave(tok, ch, sync) {
  var u = auth_(tok, 'Administrador');
  ch = ch || {};
  var upd = ch.upd || [], add = ch.add || [], del = (ch.del || []).map(blk_);
  if (!upd.length && !add.length && !del.length) throw valErr_('No hay cambios para guardar.');
  return withLock_(function () {
    var cat = gRows_(GS.CAT).map(function (r) { return [blk_(r[0]), str_(r[1]), str_(r[2]), str_(r[3]), str_(r[4]), str_(r[5])]; });
    while (cat.length && !cat[cat.length - 1][0]) cat.pop();
    var idx = function (c) { for (var i = 0; i < cat.length; i++) if (cat[i][0] === c) return i; return -1; };
    var rub = {}; gRows_(GS.RUB).forEach(function (r) { var k = str_(r[0]).trim(); if (k) rub[/^\d$/.test(k) ? '0' + k : k] = str_(r[1]); });
    var nom = function (s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toUpperCase().slice(0, 120); };
    var errs = [], log = [];
    // --- quitar: solo bloques sin uso
    if (del.length) {
      var usados = {};
      rows_(SH.REG, NREG).forEach(function (r) { var o = regOut_(r); if (o.id && !o.del && o.blk) usados[o.blk] = (usados[o.blk] || '') || 'tiene registros del conteo'; });
      gRows_(GS.INV).forEach(function (r) { var b = blk_(r[2]); if (str_(r[0]).trim() && b && !usados[b]) usados[b] = 'tiene códigos en el inventario anterior'; });
      gRows_(GS.REG).forEach(function (r) { var t = norm_(r[0]); [r[1], r[2]].forEach(function (v) { var b = blk_(v); if (b && (t === 'CONSERVAR BLOQUE' || t === 'CORREGIR FAMILIA') && !usados[b]) usados[b] = 'está en las reglas de códigos'; }); });
      del.forEach(function (c) {
        if (idx(c) < 0) errs.push(c + ': no existe');
        else if (usados[c]) errs.push(c + ': ' + usados[c] + '. Póngalo en Usar = No en vez de quitarlo');
      });
    }
    // --- editar
    upd.forEach(function (x) {
      var c = blk_(x.c), i = idx(c); if (i < 0) { errs.push(c + ': no existe'); return; }
      if (del.indexOf(c) >= 0) return;
      if (x.nombre !== undefined) {
        var n = nom(x.nombre), manual = cat[i][1];
        if (!n && !manual) { errs.push(c + ': el nombre no puede quedar vacío'); return; }
        var inst = (!n || n === nom(manual)) ? '' : n;
        if (inst !== cat[i][2]) { log.push(c + ' nombre: ' + (cat[i][2] || manual) + ' → ' + (inst || manual)); cat[i][2] = inst; }
      }
      if (x.usar !== undefined) { var v = x.usar === 'No' ? 'No' : 'Sí'; if (v !== (cat[i][3] === 'No' ? 'No' : 'Sí')) { log.push(c + ' usar: ' + v); cat[i][3] = v; } }
    });
    // --- agregar
    add.forEach(function (x) {
      var c = blk_(x.c), n = nom(x.nombre);
      if (!/^\d{4}$/.test(c)) { errs.push((x.c || '(vacío)') + ': el bloque debe tener 4 dígitos'); return; }
      if (idx(c) >= 0) { errs.push(c + ': ya existe en el catálogo'); return; }
      if (!rub[c.slice(0, 2)]) { errs.push(c + ': no existe el rubro ' + c.slice(0, 2)); return; }
      if (!n) { errs.push(c + ': escriba el nombre'); return; }
      var row = [c, '', n, x.usar === 'No' ? 'No' : 'Sí', 'Agregado ' + fmt_(new Date()).slice(0, 10), ''];
      var at = cat.length; for (var i = 0; i < cat.length; i++) if (cat[i][0] && cat[i][0] > c) { at = i; break; }
      cat.splice(at, 0, row); log.push(c + ' agregado: ' + n);
    });
    if (errs.length) throw valErr_('No se guardó nada. Revise: ' + errs.join(' · '));
    del.forEach(function (c) { var i = idx(c); log.push(c + ' quitado: ' + (cat[i][2] || cat[i][1])); cat.splice(i, 1); });
    gWrite_(GS.CAT, cat, ['@', '@', '@', '@', '@', '@']);
    // --- app de conteo (hoja CATALOGO: Bloque, Descripción, Rubro, Imagen, guía…)
    var app = 0;
    if (sync) {
      var sh = sh_(SH.CAT);
      if (sh) {
        var last = sh.getLastRow(), nc = Math.max(4, sh.getLastColumn());
        var A = last >= 2 ? sh.getRange(2, 1, last - 1, nc).getValues() : [];
        var effName = {}; cat.forEach(function (r) { if (r[0]) effName[r[0]] = r[2] || r[1]; });
        var pos = function (c) { for (var i = 0; i < A.length; i++) if (blk_(A[i][0]) === c) return i; return -1; };
        upd.forEach(function (x) { var c = blk_(x.c), i = pos(c); if (i >= 0 && effName[c] && str_(A[i][1]) !== effName[c]) { A[i][1] = effName[c]; app++; } });
        add.forEach(function (x) {
          var c = blk_(x.c); if (pos(c) >= 0) return;
          var row = []; for (var k = 0; k < nc; k++) row.push(''); row[0] = c; row[1] = effName[c]; row[2] = rub[c.slice(0, 2)] || '';
          var at = A.length; for (var i = 0; i < A.length; i++) if (blk_(A[i][0]) > c) { at = i; break; }
          A.splice(at, 0, row); app++;
        });
        del.forEach(function (c) { var i = pos(c); if (i >= 0) { A.splice(i, 1); app++; } });
        if (app) {
          if (last >= 2) sh.getRange(2, 1, last - 1, nc).clearContent();
          if (A.length) {
            var need = A.length + 1 - sh.getMaxRows(); if (need > 0) sh.insertRowsAfter(sh.getMaxRows(), need);
            sh.getRange(2, 1, A.length, 1).setNumberFormat('@');
            sh.getRange(2, 1, A.length, nc).setValues(A.map(function (r) { r[0] = str_(r[0]); return r; }));
          }
          bumpKey_('refver');
        }
      }
    }
    log_(u, 'Gestión: catálogo', '', log.join(' | ').slice(0, 1500) + (sync ? ' (app de conteo: ' + app + ')' : ''), u.dev);
    gBump_();
    return { ok: true, cambios: log.length, app: app, cat: cat.map(function (r) { return { c: r[0], manual: r[1], inst: r[2], usar: r[3], origen: r[4], descInv: r[5] }; }) };
  });
}

/* ================= CÓDIGOS REGISTRADOS DESPUÉS DEL CORTE ================= */
/**
 * Códigos que sí existen en SIGES pero no venían en el inventario anterior impreso (se registraron después del corte).
 * Se agregan al inventario como RESERVADOS: se conservan solo si su bien se cuenta con esa etiqueta en la ubicación indicada.
 * list = [{code, ubic, fecha, valor, serie, obs}] reemplaza toda la lista (todo o nada).
 */
function api_g_extraSave(tok, list) {
  var u = auth_(tok, 'Administrador');
  list = Array.isArray(list) ? list : [];
  return withLock_(function () {
    var b = gBase_(), cfg = b.cfg || {}, insts = [str_(cfg.inst || '11674')].concat(cfg.otrasInst || []).map(function (x) { return str_(x).trim(); }).filter(String);
    var cat = {}; (b.cat || []).forEach(function (c) { if (c.c) cat[c.c] = c; });
    var inv = {}; (b.inv || []).forEach(function (o) { inv[o.code.toUpperCase()] = 1; });
    var locs = {}; locsOut_().forEach(function (l) { locs[norm_(l.n)] = l.n; });
    var prev = {}; gRows_(GS.EXT).forEach(function (r) { var c = str_(r[0]).trim().toUpperCase(); if (c) prev[c] = r; });
    var seen = {}, errs = [], out = [], hoy = fmt_(new Date()).slice(0, 10);
    list.forEach(function (x, i) {
      var c = str_(x.code).trim().toUpperCase().replace(/\s+/g, ''), n = 'Fila ' + (i + 1) + (c ? ' (' + c + ')' : '');
      if (!/^\d{5}-\d{4}-\d{4}$/.test(c)) { errs.push(n + ': el código debe ser como 11674-1103-0016'); return; }
      if (insts.indexOf(c.slice(0, 5)) < 0) errs.push(n + ': la institución ' + c.slice(0, 5) + ' no está en Configuración › General');
      if (!cat[c.slice(6, 10)]) errs.push(n + ': el bloque ' + c.slice(6, 10) + ' no está en el catálogo');
      if (inv[c]) errs.push(n + ': ya está en el inventario anterior (no hace falta agregarlo)');
      if (seen[c]) errs.push(n + ': está repetido en la lista');
      seen[c] = 1;
      var ub = locs[norm_(x.ubic)];
      if (!ub) errs.push(n + ': elija la ubicación donde está el bien');
      var f = str_(x.fecha).trim(); if (f && !/^\d{4}-\d\d-\d\d$/.test(f)) errs.push(n + ': fecha no válida');
      var v = x.valor === '' || x.valor == null ? '' : Number(x.valor); if (v !== '' && (!isFinite(v) || v < 0)) errs.push(n + ': valor no válido');
      var p = prev[c];
      out.push([c, ub || '', f, v, str_(x.serie).trim(), str_(x.obs).trim(), p ? str_(p[6]) : u.nombre, p ? str_(p[7]) : hoy]);
    });
    if (errs.length) throw valErr_('No se guardó nada. Revise: ' + errs.slice(0, 8).join(' · ') + (errs.length > 8 ? ' (+' + (errs.length - 8) + ')' : ''));
    gWrite_(GS.EXT, out, ['@', '@', '@', '0.00', '@', '@', '@', '@']);
    bumpKey_('refver');   // la app de conteo reconoce los códigos agregados
    log_(u, 'Gestión: códigos agregados', '', out.map(function (r) { return r[0] + ' @ ' + r[1]; }).join(' | ').slice(0, 1500), u.dev);
    gBump_();
    return { ok: true, n: out.length, extra: out.map(function (r) { return { code: r[0], ubic: r[1], fecha: r[2], valor: Number(r[3]) || 0, serie: r[4], obs: r[5], por: r[6], t: r[7] }; }) };
  });
}

/* ================= ACTUALIZACIÓN INMEDIATA ================= */
/**
 * Las pantallas lo llaman al abrir, al volver a la pestaña y cada 3 min: obliga al cargador a revisar GitHub ahora
 * (en vez de esperar sus 5 min). Como mucho una revisión forzada cada 30 s para todo el sistema. No necesita sesión.
 */
function api_sys_revisar() {
  var c = CacheService.getScriptCache();
  try { if (!c.get('INV1_frc')) { c.put('INV1_frc', '1', 30); c.remove('INV1_chk'); } } catch (e) {}
  var v = null; try { v = typeof version_ === 'function' ? version_() : null; } catch (e) {}
  return { version: v ? v.v : NUCLEO_VERSION, fecha: v ? v.fecha : '' };
}

