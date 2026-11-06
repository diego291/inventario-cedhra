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
        serie: S(r.serie), fecha: S(r.fecha).slice(0, 10), valor: Nn(r.valor), calidad: S(r.calidad), asig: S(r.asig), manual: S(r.manual)
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
      if (r.AR && Nn(r.L) !== 1) r.AF = 0;
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
    return { cfg: base.cfg || {}, ubic: ubic, consBlq: base.consBlq || [], rc: base.rc || [], cat: base.cat || [], rubros: base.rubros || [], eq: base.eq || [], inv: base.inv || [], conteo: conteo };
  }

  return { compute: compute, fromApp: fromApp, util: { isCode: isCode, pad4: pad4, fmtDMY: fmtDMY, money: money, trim: trim } };
})();
if (typeof module !== 'undefined') module.exports = Motor;
