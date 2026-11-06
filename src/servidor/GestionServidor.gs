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
