/* ===================== CARGO MASIVO SIGES (v8.9) =====================
 * Bienes con código NUEVO del conteo → plantilla de carga masiva de SIGES llena.
 * Los datos se guardan por REGISTRO del conteo (lote) y por posición dentro del registro (bien),
 * nunca por código: si el conteo cambia y los códigos se corren, los datos siguen con su bien.
 */
const CG_COLS = ['Tipo de Unidad', 'Unidad administrativa', 'Sede', 'Clasificación', 'Categoria', 'Tipo de Bien', 'Correlativo', 'Codigo correlativo', 'Codigo de Inventario', 'Calidad',
  'Asignado a DUI', 'Descripción', 'Marca', 'Modelo', 'Serie', 'Placa', 'Motor', 'Chasis', 'Vin', 'Color Carroceria', 'Vida Util', 'Forma de Adquisición', 'Fuente de Financiamiento', 'Proyecto',
  'Documento Adquisición', 'Fecha Adquisición(27/01/2026)', 'Valor Adquisición', 'Valor estimado(Si,No)', 'Proveedor', 'Numero de partida'];
const CG_L = {   // listas por defecto (se reemplazan por las de la plantilla al subirla)
  tipo: ['Centro Escolar', 'Unidad Administrativa'],
  clasif: ['BIENES MUEBLES', 'BIENES INMUEBLES', 'ESTUDIOS DE PRE-INVERSIÓN', 'INFRAESRUCTURAS', 'INTANGIBLES', 'SEMOVIVIENTES'],
  cats: ['MAQUINARIAS Y EQUIPOS', 'EQUIPOS MÉDICOS Y DE LABORATORIO', 'EQUIPOS INFORMÁTICOS', 'HERRAMIENTAS Y REPUESTOS PRINCIPALES', 'BIENES MUEBLES DIVERSOS', 'EDIFICIOS', 'VEHICULOS DE TRANSPORTE', 'MOBILIARIOS', 'MAQUINARIA Y EQUIPO DE PRODUCCION PARA APOYO INSTITUCIONAL', 'MAQUINARIA Y EQUIPOS DE PRODUCCION', 'INMUEBLE'],
  est: ['SI', 'NO'], calidad: ['BUENO', 'MALO', 'REGULAR'],
  formas: ['COMP. ACT. ESCUELA', 'DONADO', 'ENTREGA DEL MINED', 'FONDOS GOES', 'PRESUPUESTO ESCOLAR'],
  fuentes: ['SIN FUENTE', 'FONDO GENERAL', 'FONDOS PROPIOS', 'PROYECTOS VIGENTES', 'DONACIONES', 'ADMINISTRACIÓN DE TERCEROS', 'UNION EUROPEA (NG)'], sedes: []
};
const CG_FUENTE_FORM = ['SIN FUENTE', 'FONDOS PROPIOS', 'PROYECTOS VIGENTES', 'DONACIONES'];   // las que muestra el formulario de SIGES
const CG_PROY = ['20N', '5657 POTENCIANDO ESCUELA INCLUSIVA', '5657 PROYECTO', '7239 EQUIPAMIENTO Y CAPACITACION DOCENTE EN TECNOLOGIA E INNOVACION', '7240 MEJORAMIENTO DE AMBIENTES EDUCATIVOS PARA LA FORMACION INTEGRAL Y APRENDIZAJES',
  '7495 CRECER Y APRENDER JUNTOS: DESARROLLO INTEGRAL DE LA PRIMERA INFANCIA EN EL SALVADOR', '7521 MEJORA DE LA CALIDAD Y COBERTURA EDUCATIVA: NACER, CRECER, APRENDER',
  '7729 - IMPLEMENTACION DEL PLAN MULTIMODAL EN EDUCACION BASICA, MEDIA Y MEDIA TECNICA EN EL MARCO DE RECUPERACION DE LA EMERGENCIA COVID-19', '7731 PROGRAMA DE REDUCCION DE BRECHA DIGITAL EN CENTROS ESCOLARES DE EL SALVADOR',
  '7733 MEJORAMIENTO Y EQUIPAMIENTO DE EDUCACION ESPECIAL, A NIVEL NACIONAL', '7800 PROGRAMA MI NUEVA ESCUELA BCIE', '8431-FORTALECIMIENTO DE LOS BACHILLERATOS AGROPECUARIOS A TRAVES DE LAS GRANJAS DIDACTICAS',
  '8639 PROGRAMA PILOTO DE EDUCACION INCLUSIVA PARA FORTALECER LAS COMPETENCIAS LABORALES CON EL ENFOQUE STEAM EN CENTROS EDUCATIVOS', '8800 - PROYECTO DE MODERNIZACION DEL SISTEMA EDUCATIVO DE EL SALVADOR',
  '91102 PLAN CUSCATLAN-APOYO AL PLAN NACIONAL DE EDUCACION (UNICEF)', '91187 - INSTALACIÓN Y CONFIGURACIÓN DE INFRAESTRUCTURA DE REDES INTERNAS WIFI A NIVEL NACIONAL SETEFE / ARABIA',
  'BECAS PARA OPORTUNIDADES EDUCATIVAS', 'FOMILENIO II', 'FONDO SOCIOS ESTRATEGICOS', 'SIN PROYECTO'];
// Categoría SIGES por rubro (2 primeros dígitos del bloque) y excepciones por bloque. Editable en Ajustes.
const CG_CAT_RUB = { '01': 'MAQUINARIAS Y EQUIPOS', '03': 'MAQUINARIAS Y EQUIPOS', '04': 'MAQUINARIAS Y EQUIPOS', '07': 'MAQUINARIAS Y EQUIPOS', '11': 'MOBILIARIOS', '12': 'BIENES MUEBLES DIVERSOS', '13': 'BIENES MUEBLES DIVERSOS',
  '14': 'BIENES MUEBLES DIVERSOS', '15': 'BIENES MUEBLES DIVERSOS', '21': 'EQUIPOS MÉDICOS Y DE LABORATORIO', '31': 'EQUIPOS MÉDICOS Y DE LABORATORIO', '32': 'EQUIPOS MÉDICOS Y DE LABORATORIO', '33': 'MAQUINARIAS Y EQUIPOS',
  '41': 'MAQUINARIAS Y EQUIPOS', '44': 'MAQUINARIAS Y EQUIPOS', '53': 'MAQUINARIAS Y EQUIPOS', '54': 'MAQUINARIAS Y EQUIPOS', '55': 'MAQUINARIAS Y EQUIPOS', '56': 'MAQUINARIAS Y EQUIPOS', '57': 'MAQUINARIAS Y EQUIPOS',
  '61': 'MAQUINARIAS Y EQUIPOS', '62': 'MAQUINARIAS Y EQUIPOS', '65': 'VEHICULOS DE TRANSPORTE', '68': 'HERRAMIENTAS Y REPUESTOS PRINCIPALES', '71': 'BIENES MUEBLES DIVERSOS' };
const CG_CAT_BLK = { '0108': 'EQUIPOS INFORMÁTICOS', '0109': 'EQUIPOS INFORMÁTICOS', '0113': 'EQUIPOS INFORMÁTICOS', '0114': 'EQUIPOS INFORMÁTICOS', '0115': 'EQUIPOS INFORMÁTICOS', '0116': 'EQUIPOS INFORMÁTICOS',
  '0118': 'EQUIPOS INFORMÁTICOS', '0119': 'EQUIPOS INFORMÁTICOS', '0124': 'EQUIPOS INFORMÁTICOS', '0131': 'EQUIPOS INFORMÁTICOS', '5417': 'EQUIPOS INFORMÁTICOS',
  '6503': 'BIENES MUEBLES DIVERSOS', '6506': 'BIENES MUEBLES DIVERSOS', '6507': 'BIENES MUEBLES DIVERSOS', '6515': 'BIENES MUEBLES DIVERSOS' };
const CG_COMPRA = ['fecha', 'valor', 'forma', 'fuente', 'proy', 'est', 'doc', 'prov'];
const CG_ERR = { cod: 'Código inválido o sin calcular', dup: 'Código repetido', ant: 'El código ya existe en el inventario anterior', carg: 'El código cambió después de cargarse en SIGES',
  sede: 'La sede del código no es de esta institución', fecha: 'Falta la fecha de adquisición o no es válida', valor: 'Falta el valor de adquisición', forma: 'Falta la forma de adquisición',
  fuente: 'Falta la fuente de financiamiento', proy: 'Falta el proyecto (la fuente es PROYECTOS VIGENTES)', est: 'Falta indicar si el valor es estimado', cat: 'Sin categoría SIGES',
  asig: 'Sin "Asignado a" (DUI del responsable)', veh: 'Faltan datos del vehículo (placa, motor, chasis, VIN, color)', desc: 'Descripción de más de 500 caracteres', cal: 'Calidad no reconocida' };
const CG_WARN = { mms: 'Equipo sin marca, modelo o serie (SIGES lo pide salvo mobiliario y vehículos)', ffor: 'Esa fuente no aparece en el formulario de SIGES: confírmela', exp: 'El código cambió desde la última descarga', sem: 'Animales: revise clasificación y categoría' };
UI.cargo = { tab: 'lotes', f: 'todos', e: '', q: '', open: {}, lim: 40, inclCarg: false };

const cgD = () => D.cargo || (D.cargo = { cfg: {}, lote: {}, bien: {} });
const cgCfg = () => cgD().cfg || {};
const cgList = k => { const L = (cgCfg().listas || {})[k]; return Array.isArray(L) && L.length ? L : CG_L[k]; };
const cgDMY = iso => { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; };
const cgInsts = () => [String(BASE.cfg.inst || '').trim()].concat(BASE.cfg.otrasInst || []).filter(Boolean);
function cgCat(blk) { const c = cgCfg().cat || {}; return c[blk] || CG_CAT_BLK[blk] || CG_CAT_RUB[String(blk).slice(0, 2)] || ''; }
function cgDui(u) {
  const ps = respOf(u).filter(p => p.rol !== 'Testigo');
  for (const p of ps) { const per = (D.personas || []).find(x => (p.pid && x.id === p.pid) || norm(x.n) === norm(p.n)); if (per && String(per.dui || '').trim()) return String(per.dui).trim(); }
  return '';
}

/** Descripción del catálogo del bloque (sin marcas del conteo como ↺ o 🔒). */
function cgDescCat(c) { const x = R.cat.find(y => y.A === c.D && !y.blank); const d = x && String(x.F || '').trim(); return d && !/^⚠/.test(d) ? d : String(c.C || '').replace(/^(🔒|↺)\s*/, '').replace(/\s*·\s*tenía etiqueta.*$/, '').trim(); }
/** Lotes (un registro del conteo) con sus bienes de código NUEVO. Se recalcula cuando cambia el motor. */
function cgLotes() {
  if (cgLotes.R === R) return cgLotes.v;
  const regs = new Map((D.regs || []).map(r => [String(r.id), r])), lotes = [], by = new Map();
  R.cod.forEach(c => {
    if (c.R !== 'NUEVO') return;
    const rid = c.row.id != null && c.row.id !== '' ? String(c.row.id) : 'x' + c.row.ROW;
    let L = by.get(rid);
    if (!L) { L = { key: 'r:' + rid, rid, row: c.row, reg: regs.get(rid) || {}, blk: c.D, ubic: c.E, descCat: cgDescCat(c), items: [] }; by.set(rid, L); lotes.push(L); }
    L.items.push({ c, key: 'i:' + rid + '#' + c.K, code: c.B, k: c.K });
  });
  cgLotes.R = R; cgLotes.v = lotes; return lotes;
}
/** Valores finales de un bien tal como irán a la plantilla. */
function cgVals(L, it) {
  const cfg = cgCfg(), ld = cgD().lote[L.key] || {}, bd = cgD().bien[it.key] || {}, reg = L.reg || {};
  const pick = (f, dflt) => bd[f] != null && bd[f] !== '' ? bd[f] : ld[f] != null && ld[f] !== '' ? ld[f] : dflt;
  let cal = norm(it.c.F); if (cal === 'REGULAR' && cfg.regular) cal = cfg.regular;
  const m = String(it.code).match(/^(\d{5})-(\d{4})-(\d{4})$/), cat = cgCat(L.blk);
  return {
    sede: m ? m[1] : '', tipoBien: m ? m[2] : '', correl: m ? Number(m[3]) : 0, correlTxt: m ? m[3] : '', code: it.code, cat, clasif: /^71/.test(L.blk) ? 'SEMOVIVIENTES' : 'BIENES MUEBLES',
    cal, asig: bd.asig || (cfg.asig === 'dui' ? cgDui(L.ubic) : L.ubic), desc: String(ld.desc || L.descCat || '').trim(),
    marca: pick('marca', reg.marca || ''), modelo: pick('modelo', reg.modelo || ''), serie: bd.serie != null && bd.serie !== '' ? bd.serie : (L.items.length === 1 ? reg.serie || '' : ''),
    placa: bd.placa || '', motor: bd.motor || '', chasis: bd.chasis || '', vin: bd.vin || '', color: bd.color || '',
    vida: cat === 'VEHICULOS DE TRANSPORTE' ? 10 : 5, forma: ld.forma || '', fuente: ld.fuente || '', proy: ld.fuente === 'PROYECTOS VIGENTES' ? ld.proy || '' : '',
    doc: ld.doc || '', fecha: ld.fecha || '', valor: ld.valor === '' || ld.valor == null ? null : Number(ld.valor), est: ld.est || cfg.est || '', prov: ld.prov || '', part: ld.part || '',
    exp: bd.exp || '', carg: bd.carg || ''
  };
}
/** Revisión de un bien contra las reglas de la plantilla. */
function cgCheck(L, it, ctx) {
  const v = cgVals(L, it), e = [], w = [], hoy = ymdL(new Date());
  if (!/^\d{5}-\d{4}-\d{4}$/.test(v.code) || !v.correl) e.push('cod');
  else {
    if (ctx.dup.has(v.code)) e.push('dup');
    if (ctx.ant.has(v.code)) e.push('ant');
    if (!ctx.insts.includes(v.sede)) e.push('sede');
  }
  if (v.carg && v.carg.code !== v.code) e.push('carg');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.fecha) || v.fecha > hoy || v.fecha < '1950-01-01') e.push('fecha');
  if (v.valor == null || !(v.valor > 0) || !isFinite(v.valor)) e.push('valor');
  if (!cgList('formas').includes(v.forma)) e.push('forma');
  if (!cgList('fuentes').includes(v.fuente)) e.push('fuente');
  else if (!CG_FUENTE_FORM.includes(v.fuente)) w.push('ffor');
  if (v.fuente === 'PROYECTOS VIGENTES' && !CG_PROY.includes(v.proy)) e.push('proy');
  if (!cgList('est').includes(v.est)) e.push('est');
  if (!cgList('cats').includes(v.cat)) e.push('cat');
  if (!String(v.asig).trim()) e.push('asig');
  if (v.cat === 'VEHICULOS DE TRANSPORTE' && ![v.placa, v.motor, v.chasis, v.vin, v.color].every(x => String(x).trim())) e.push('veh');
  if (!v.desc || v.desc.length > 500) e.push('desc');
  if (!cgList('calidad').includes(v.cal)) e.push('cal');
  if (!['MOBILIARIOS', 'VEHICULOS DE TRANSPORTE'].includes(v.cat) && ![v.marca, v.modelo, v.serie].every(x => String(x).trim())) w.push('mms');
  if (v.exp && v.exp !== v.code && !v.carg) w.push('exp');
  if (v.clasif === 'SEMOVIVIENTES') w.push('sem');
  return { v, e, w };
}
function cgAll() {
  const lotes = cgLotes(), seen = new Map();
  lotes.forEach(L => L.items.forEach(it => seen.set(it.code, (seen.get(it.code) || 0) + 1)));
  const ctx = { dup: new Set([...seen].filter(([, n]) => n > 1).map(([c]) => c)), ant: new Set(R.inv.map(o => U(o.code))), insts: cgInsts() };
  let n = 0, ok = 0, err = 0, carg = 0, sin = 0, valor = 0;
  lotes.forEach(L => {
    L.chk = L.items.map(it => cgCheck(L, it, ctx));
    L.nErr = L.chk.filter(x => x.e.length).length; L.nWarn = L.chk.filter(x => x.w.length).length; L.nCarg = L.chk.filter(x => x.v.carg).length;
    L.sinCompra = !CG_COMPRA.some(f => String((cgD().lote[L.key] || {})[f] || '').trim());
    L.st = L.nCarg === L.items.length && !L.nErr ? 'carg' : L.nErr ? (L.sinCompra ? 'sin' : 'err') : 'ok';
    n += L.items.length; carg += L.nCarg; err += L.nErr; ok += L.chk.filter(x => !x.e.length && !x.v.carg).length;
    if (L.sinCompra) sin += L.items.length;
    L.chk.forEach(x => { if (!x.e.length && x.v.valor > 0) valor += x.v.valor; });
  });
  return { lotes, n, ok, err, carg, sin, valor };
}

/* ---------- guardar (en lote, sin perder el foco) ---------- */
const CGQ = new Map();
const cgFlush = debounce(async () => {
  if (!CGQ.size) return;
  const list = [...CGQ.values()]; CGQ.clear(); setSync('busy', 'Guardando…');
  try { const r = await api('api_g_cargoSave', list); D.cargo = r.cargo; CGQ.forEach(x => cgLocal(x)); setSync('ok', 'Guardado · ' + dt(Date.now()).slice(-5)); }
  catch (e) { list.forEach(x => CGQ.set(x.k, x)); setSync('err', 'Sin guardar'); toast('No se guardó: ' + errMsg(e), true); }
}, 700);
function cgLocal(x) { const box = x.t === 'cfg' ? null : cgD()[x.t]; if (box) { if (x.d == null) delete box[x.k]; else box[x.k] = x.d; } else cgD().cfg = x.d; }
function cgPut(t, k, d) { const x = { k, t, d }; cgLocal(x); CGQ.set(k, x); cgFlush(); }
const cgSoon = k => setTimeout(() => cgRefresh(k), 0);
function cgSetL(key, f, v) { const d = Object.assign({}, cgD().lote[key] || {}); if (v === '' || v == null) delete d[f]; else d[f] = v; cgPut('lote', key, Object.keys(d).length ? d : null); }
function cgSetB(key, f, v) { const d = Object.assign({}, cgD().bien[key] || {}); if (v === '' || v == null) delete d[f]; else d[f] = v; cgPut('bien', key, Object.keys(d).length ? d : null); }

/* ---------- pantalla ---------- */
const cgSel = (opts, val, attrs, ph) => `<select ${attrs}><option value="">${ph || 'Elegir…'}</option>${opts.map(o => `<option value="${esc(o)}"${o === val ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
const cgChip = L => L.st === 'carg' ? '<span class="chip in">☁ Cargado en SIGES</span>' : L.st === 'ok' ? `<span class="chip ok">✔ Listo</span>${L.nWarn ? ` <span class="chip wa" title="Avisos: no impiden la descarga">⚠ ${L.nWarn}</span>` : ''}`
  : L.st === 'sin' ? '<span class="chip bad">✕ Faltan datos de compra</span>' : `<span class="chip bad">✕ ${L.nErr} con error</span>`;
function cgRange(L) { const a = L.items[0].code, b = L.items[L.items.length - 1].code; return a === b ? a : a + ' a ' + String(b).slice(-4); }
function cgLoteHtml(L) {
  const ld = cgD().lote[L.key] || {}, open = !!UI.cargo.open[L.key], lock = L.st === 'carg', dis = lock ? ' disabled' : '';
  const errs = [...new Set(L.chk.flatMap(x => x.e))], warns = [...new Set(L.chk.flatMap(x => x.w))];
  const f = (lbl, html, cls) => `<label class="cgf${cls ? ' ' + cls : ''}"><span>${lbl}</span>${html}</label>`;
  const bad = c => errs.includes(c) ? ' bad' : '';
  let h = `<div class="cglot st-${L.st}" id="cg_${esc(L.key.slice(2))}" data-k="${esc(L.key)}">
    <div class="cgh"><div class="cgt">${cgChip(L)}<b>${esc(ld.desc || L.descCat)} · ${L.items.length} bien${L.items.length > 1 ? 'es' : ''}</b><small class="code">${esc(cgRange(L))} · ${esc(L.ubic)}</small></div>
      ${f('Fecha adquisición', `<input type="date" value="${esc(ld.fecha || '')}" max="${ymdL(new Date())}" data-ch="cgL" data-k="${esc(L.key)}" data-f="fecha"${dis}>`, bad('fecha'))}
      ${f('Valor c/u ($)', `<input type="number" min="0" step="0.01" value="${ld.valor ?? ''}" data-ch="cgL" data-k="${esc(L.key)}" data-f="valor" placeholder="0.00"${dis}>`, bad('valor'))}
      ${f('Forma de adquisición', cgSel(cgList('formas'), ld.forma, `data-ch="cgL" data-k="${esc(L.key)}" data-f="forma"${dis}`), bad('forma'))}
      ${f('Fuente de financiamiento', cgSel(cgList('fuentes'), ld.fuente, `data-ch="cgL" data-k="${esc(L.key)}" data-f="fuente"${dis}`), bad('fuente'))}
      ${f('¿Valor estimado?', cgSel(cgList('est'), ld.est || '', `data-ch="cgL" data-k="${esc(L.key)}" data-f="est"${dis}`, cgCfg().est ? 'Por defecto: ' + cgCfg().est : 'Elegir…'), bad('est'))}
      <div class="cgb"><button class="btn sm ghost" type="button" data-act="cgCopy" data-k="${esc(L.key)}" title="Copiar datos de compra">📋</button><button class="btn sm ghost" type="button" data-act="cgPaste" data-k="${esc(L.key)}" title="Pegar datos de compra"${dis}>📥</button>${lock ? `<button class="btn sm ghost" type="button" data-act="cgDescL" data-k="${esc(L.key)}" title="Quitar la marca de cargado">↩</button>` : ''}<button class="btn sm" type="button" data-act="cgOpen" data-k="${esc(L.key)}">${open ? '▴' : '▾'}</button></div></div>
    <div class="cgh2">${ld.fuente === 'PROYECTOS VIGENTES' ? f('Proyecto', cgSel(CG_PROY, ld.proy, `data-ch="cgL" data-k="${esc(L.key)}" data-f="proy"${dis}`), 'w2' + bad('proy')) : ''}
      ${f('N° documento de adquisición', `<input type="text" maxlength="100" value="${esc(ld.doc || '')}" data-ch="cgL" data-k="${esc(L.key)}" data-f="doc" placeholder="Factura, CCF, acta…"${dis}>`)}
      ${f('Proveedor', `<input type="text" maxlength="150" value="${esc(ld.prov || '')}" data-ch="cgL" data-k="${esc(L.key)}" data-f="prov"${dis}>`)}
      ${errs.length || warns.length ? `<div class="cgmsg">${errs.map(c => `<span class="m bad">✕ ${esc(CG_ERR[c])}</span>`).join('')}${warns.map(c => `<span class="m wa">⚠ ${esc(CG_WARN[c])}</span>`).join('')}</div>` : ''}</div>`;
  if (open) {
    const veh = cgCat(L.blk) === 'VEHICULOS DE TRANSPORTE';
    h += `<div class="cgits"><div class="cgh2">${f('Descripción en SIGES', `<input type="text" maxlength="500" value="${esc(ld.desc || '')}" placeholder="${esc(L.descCat)}" data-ch="cgL" data-k="${esc(L.key)}" data-f="desc"${dis}>`, 'w2' + bad('desc'))}
      ${f('Marca (todo el lote)', `<input type="text" maxlength="100" value="${esc(ld.marca || '')}" placeholder="${esc(L.reg.marca || '')}" data-ch="cgL" data-k="${esc(L.key)}" data-f="marca"${dis}>`)}
      ${f('Modelo (todo el lote)', `<input type="text" maxlength="100" value="${esc(ld.modelo || '')}" placeholder="${esc(L.reg.modelo || '')}" data-ch="cgL" data-k="${esc(L.key)}" data-f="modelo"${dis}>`)}
      ${f('N° de partida', `<input type="text" maxlength="60" value="${esc(ld.part || '')}" data-ch="cgL" data-k="${esc(L.key)}" data-f="part"${dis}>`)}
      <div class="hint" style="align-self:end">Categoría: <b>${esc(cgCat(L.blk) || '—')}</b> · Vida útil ${veh ? 10 : 5} años</div></div>
      <div class="tw"><table class="t cgt2"><thead><tr><th>Código</th><th>Calidad</th><th>Marca</th><th>Modelo</th><th>Serie</th><th>Asignado a</th>${veh ? '<th>Placa</th><th>Motor</th><th>Chasis</th><th>VIN</th><th>Color</th>' : ''}<th>Estado</th></tr></thead><tbody>
      ${L.items.map((it, i) => { const x = L.chk[i], bd = cgD().bien[it.key] || {}, lk = x.v.carg ? ' disabled' : '', inp = (fl, ph) => `<input type="text" maxlength="100" value="${esc(bd[fl] || '')}" placeholder="${esc(ph || '')}" data-ch="cgB" data-k="${esc(it.key)}" data-f="${fl}"${lk}>`;
        return `<tr><td class="code">${esc(it.code)}${x.v.carg && x.v.carg.code !== it.code ? `<br><small style="color:var(--bad)">cargado como ${esc(x.v.carg.code)}</small>` : ''}</td><td>${esc(x.v.cal)}</td><td>${inp('marca', x.v.marca)}</td><td>${inp('modelo', x.v.modelo)}</td><td>${inp('serie', x.v.serie)}</td><td>${inp('asig', x.v.asig)}</td>
          ${veh ? ['placa', 'motor', 'chasis', 'vin', 'color'].map(fl => `<td>${inp(fl)}</td>`).join('') : ''}<td>${x.v.carg ? '<span class="chip in">☁ Cargado</span>' : x.e.length ? `<span class="chip bad" title="${esc(x.e.map(c => CG_ERR[c]).join('\n'))}">✕ ${x.e.length}</span>` : x.w.length ? `<span class="chip wa" title="${esc(x.w.map(c => CG_WARN[c]).join('\n'))}">⚠ aviso</span>` : '<span class="chip ok">✔</span>'}</td></tr>`; }).join('')}
      </tbody></table></div></div>`;
  }
  return h + '</div>';
}
function cgFiltra(A) {
  const u = UI.cargo, q = norm(u.q);
  return A.lotes.filter(L => (u.f === 'todos' || (u.f === 'err' ? L.st === 'err' || L.st === 'sin' : L.st === u.f)) && (!u.e || L.chk.some(x => x.e.includes(u.e) || x.w.includes(u.e)))
    && (!q || norm([L.descCat, L.ubic, L.blk, ...L.items.map(i => i.code), (cgD().lote[L.key] || {}).doc].join(' ')).includes(q)));
}
function cgHead(A) {
  const pend = A.n - A.carg, w = x => pend ? (x / pend * 100).toFixed(1) + '%' : '0%', pl = cgCfg().plantilla;
  return `<div class="card cgtop"><div class="cgpg"><span class="lbl">Bienes con código NUEVO para cargar en SIGES</span><div>${!pend && A.n ? `<b>✔ Los ${fmtN(A.n)} bienes ya están cargados en SIGES</b>` : `<b>${fmtN(A.ok)} de ${fmtN(pend)}</b> listos para subir`} · ${fmtN(A.err)} con error${A.sin ? ` (${fmtN(A.sin)} sin datos de compra)` : ''}${A.carg ? ` · ${fmtN(A.carg)} ya cargados` : ''}</div>
      <div class="cgbar"><i style="width:${w(A.ok)};background:var(--ok)"></i><i style="width:${w(A.err - A.sin)};background:var(--ac)"></i><i style="width:${w(A.sin)};background:var(--bad)"></i></div></div>
    <div class="row" style="gap:8px"><span class="chip ${pl ? 'ok' : 'bad'}" title="${pl ? esc(pl.name + ' · ' + dt(pl.t)) : 'Falta subir la plantilla'}">${pl ? '✔ Plantilla SIGES' : '✕ Falta la plantilla'}</span><button class="btn sm" type="button" data-act="cgAjustes">⚙ Ajustes</button></div></div>
    <div class="tabs"><button type="button" data-act="cgTab" data-v="lotes" class="${UI.cargo.tab === 'lotes' ? 'on' : ''}">1 · Llenar por lote</button><button type="button" data-act="cgTab" data-v="rev" class="${UI.cargo.tab === 'rev' ? 'on' : ''}">2 · Revisar y descargar${A.err ? ` <span class="chip bad" style="margin-left:4px">${fmtN(A.err)}</span>` : ''}</button></div>`;
}
MODS.cargo = {
  html() {
    if (!X.hasBase) return '<div class="card"><p>Primero importe los datos base en Configuración.</p></div>';
    const A = cgAll(); this.A = A;
    return cgHead(A) + (UI.cargo.tab === 'rev' ? this.rev(A) : this.lotes(A));
  },
  lotes(A) {
    const u = UI.cargo, L = cgFiltra(A), cnt = f => f === 'todos' ? A.lotes.length : A.lotes.filter(x => f === 'err' ? x.st === 'err' || x.st === 'sin' : x.st === f).length;
    const chips = [['todos', 'Todos'], ['err', 'Con error'], ['sin', 'Sin datos de compra'], ['ok', 'Listos'], ['carg', 'Cargados']].map(([k, t]) => `<button type="button" class="chip ${u.f === k ? 'in' : ''}" style="border:0;cursor:pointer;padding:5px 11px" data-act="cgF" data-v="${k}">${t} ${cnt(k)}</button>`).join('');
    return `<div class="card" style="padding:12px 14px"><div class="row" style="gap:6px">${chips}${u.e ? `<span class="chip wa">Solo: ${esc(CG_ERR[u.e] || CG_WARN[u.e])} <a href="#" data-act="cgE" data-v="">✕</a></span>` : ''}<span style="flex:1"></span>
      <input type="search" placeholder="🔎 Bien, ubicación, código, factura…" value="${esc(u.q)}" data-in="cgQ" style="width:250px">
      ${CG_CLIP.d ? `<button class="btn sm" type="button" data-act="cgPasteAll" title="Solo llena los campos vacíos">📥 Pegar en ${L.filter(x => x.st !== 'carg').length} lotes filtrados</button>` : ''}</div>
      <p class="hint" style="margin:8px 2px 0">Cada lote es un registro del conteo (mismo bien, ubicación y captura). Llene una vez los datos de compra; con ▾ ve cada bien para su serie, marca o a quién se asigna. Se guarda solo.</p></div>
      <div id="cgList">${L.slice(0, u.lim).map(cgLoteHtml).join('') || '<div class="card hint">No hay lotes con ese filtro.</div>'}</div>
      ${L.length > u.lim ? `<div class="row" style="justify-content:center;margin:10px"><button class="btn" type="button" data-act="cgMore">Ver ${Math.min(40, L.length - u.lim)} más (${L.length - u.lim} restantes)</button></div>` : ''}`;
  },
  rev(A) {
    const grp = (map, kind) => Object.keys(map).map(c => {
      const ls = A.lotes.filter(L => L.chk.some(x => (kind === 'e' ? x.e : x.w).includes(c))), n = A.lotes.reduce((a, L) => a + L.chk.filter(x => (kind === 'e' ? x.e : x.w).includes(c) && !(x.v.carg && c !== 'carg')).length, 0);
      if (!n) return '';
      return `<div class="cgerr ${kind === 'e' ? '' : 'w'}"><span class="chip ${kind === 'e' ? 'bad' : 'wa'}">${fmtN(n)}</span><div><b>${esc(map[c])}</b><small>${ls.slice(0, 5).map(L => esc((cgD().lote[L.key] || {}).desc || L.descCat) + ' (' + esc(L.ubic) + ')').join(' · ')}${ls.length > 5 ? ` · y ${ls.length - 5} lotes más` : ''}</small></div><button class="btn sm ghost" type="button" data-act="cgE" data-v="${c}">${kind === 'e' ? 'Corregir' : 'Ver'} →</button></div>`;
    }).join('');
    const errs = grp(CG_ERR, 'e'), warns = grp(CG_WARN, 'w'), pl = cgCfg().plantilla, incl = UI.cargo.inclCarg;
    const listos = A.lotes.reduce((a, L) => a + L.chk.filter(x => !x.e.length && (incl || !x.v.carg)).length, 0), total = A.n - (incl ? 0 : A.carg);
    const sedes = [...new Set(A.lotes.flatMap(L => L.chk.map(x => x.v.sede)))].filter(Boolean);
    return `<div class="cgrev"><div class="card"><div class="row"><span class="lbl">Lo que SIGES rechazaría</span><span style="flex:1"></span>${A.err ? `<span class="chip bad">${fmtN(A.err)} bienes con error</span>` : '<span class="chip ok">Sin errores</span>'}</div>
      ${errs || '<div class="cgerr ok"><span class="chip ok">✔</span><div><b>Todos los bienes pasan las reglas de la plantilla</b><small>Código, sede, tipo de bien, correlativo, listas de SIGES, fechas y valores revisados.</small></div></div>'}
      ${warns ? `<span class="lbl" style="display:block;margin-top:14px">Avisos (no impiden la descarga)</span>${warns}` : ''}</div>
      <div class="card cgres"><span class="lbl">Resumen del cargo</span><div class="kv">
        <span>Sede(s)</span><b>${esc(sedes.join(', ') || '—')}</b><span>Bienes nuevos</span><b>${fmtN(A.n)}</b><span>Lotes</span><b>${fmtN(A.lotes.length)}</b><span>Ya cargados</span><b>${fmtN(A.carg)}</b>
        <span>Listos</span><b>${fmtN(listos)}</b><span>Valor de los listos</span><b>${money(A.valor)}</b><span>Plantilla</span><b>${pl ? esc(pl.name) : '<span style="color:var(--bad)">falta</span>'}</b></div>
        <label class="btn sm" style="margin-top:12px;width:100%;justify-content:center">⬆ ${pl ? 'Cambiar' : 'Subir'} plantilla de SIGES (.xlsx)<input type="file" accept=".xlsx" data-ch="cgPl" hidden></label>
        <label class="row hint" style="gap:6px;margin-top:10px"><input type="checkbox" data-ch="cgIncl"${incl ? ' checked' : ''}> Incluir los ya marcados como cargados</label>
        <button class="btn pri" style="width:100%;margin-top:10px" type="button" data-act="cgExp" data-v="todo"${A.err && listos < total ? ' disabled' : ''}${!pl ? ' disabled' : ''}>⬇ Descargar Excel para SIGES (${fmtN(total)})</button>
        ${listos < total ? `<button class="btn" style="width:100%;margin-top:8px" type="button" data-act="cgExp" data-v="listos"${!pl || !listos ? ' disabled' : ''}>Descargar solo los ${fmtN(listos)} listos</button>` : ''}
        <p class="hint" style="margin-top:10px">El Excel se llena sobre la plantilla original (mismas listas y formatos) y queda una copia en Drive, carpeta “${'Cargo masivo SIGES'}”. Después de subirlo a SIGES, márquelos como cargados.</p>
        ${UI.cargo.last ? `<button class="btn dark" style="width:100%" type="button" data-act="cgCarg">☁ Marcar los ${fmtN(UI.cargo.last.length)} del último Excel como cargados en SIGES</button>` : ''}</div></div>`;
  },
  extra() { return ''; }
};
TITLES.cargo = ['Cargo masivo SIGES', 'Bienes nuevos del conteo listos para la carga masiva de SIGES'];

/* ---------- refresco parcial (no pierde el foco al escribir) ---------- */
function cgRefresh(key) {
  const A = cgAll(); MODS.cargo.A = A;
  const L = A.lotes.find(x => x.key === key), el = L && document.getElementById('cg_' + key.slice(2));
  if (el) {
    const act = document.activeElement, sel = act && act.dataset ? [act.dataset.k, act.dataset.f] : null;
    const tmp = document.createElement('div'); tmp.innerHTML = cgLoteHtml(L); el.replaceWith(tmp.firstElementChild);
    if (sel && sel[0]) { const n = $(`[data-k="${CSS.escape(sel[0])}"][data-f="${sel[1]}"]`); if (n) n.focus(); }
  }
  const top = $('.cgtop'); if (top) { const tmp = document.createElement('div'); tmp.innerHTML = cgHead(A); top.replaceWith(tmp.firstElementChild); const tb = $('#main .tabs'); if (tb && tmp.lastElementChild) tb.replaceWith(tmp.lastElementChild); }
}
const CG_CLIP = { d: null };
INP.cgL = el => {
  let v = el.value; const f = el.dataset.f;
  if (f === 'valor') { v = v === '' ? '' : Math.round(Number(v) * 100) / 100; if (v !== '' && !(v >= 0)) { toast('Valor inválido', true); return; } }
  else if (typeof v === 'string') v = v.trim();
  cgSetL(el.dataset.k, f, v);
  if (f === 'fuente' && v !== 'PROYECTOS VIGENTES') cgSetL(el.dataset.k, 'proy', '');
  cgSoon(el.dataset.k);
};
INP.cgB = el => { cgSetB(el.dataset.k, el.dataset.f, el.value.trim()); const lk = 'r:' + el.dataset.k.slice(2).replace(/#\d+$/, ''); cgSoon(lk); };
INP.cgQ = debounce(el => { UI.cargo.q = el.value; UI.cargo.lim = 40; const A = MODS.cargo.A || cgAll(); $('#cgList').innerHTML = cgFiltra(A).slice(0, UI.cargo.lim).map(cgLoteHtml).join('') || '<div class="card hint">No hay lotes con ese filtro.</div>'; }, 250);
INP.cgIncl = el => { UI.cargo.inclCarg = el.checked; render(); };
INP.cgPl = async el => {
  const file = el.files && el.files[0]; if (!file) return;
  try {
    setSync('busy', 'Revisando plantilla…'); await cgZipLib();
    const buf = await file.arrayBuffer(), T = await cgLeerPlantilla(buf), insts = cgInsts();
    const listas = Object.assign({}, T.listas, { sedes: T.sedes.filter(s => insts.includes(s.slice(0, 5))) });
    const b64 = cgB64(new Uint8Array(buf));
    setSync('busy', 'Subiendo plantilla…');
    const r = await api('api_g_cargoPlantilla', b64, file.name, listas); D.cargo = r.cargo;
    setSync('ok', 'Plantilla guardada'); toast(`Plantilla guardada · ${listas.sedes.length ? 'sede ' + listas.sedes.map(s => s.slice(0, 5)).join(', ') + ' encontrada' : '⚠ su sede no aparece en la lista'}`, !listas.sedes.length); render();
  } catch (e) { setSync('err', 'Plantilla no guardada'); toast(errMsg(e), true); }
};
Object.assign(ACT, {
  cgTab: b => { UI.cargo.tab = b.dataset.v; render(); },
  cgF: b => { UI.cargo.f = b.dataset.v; UI.cargo.lim = 40; render(); },
  cgE: b => { UI.cargo.e = b.dataset.v; UI.cargo.f = 'todos'; UI.cargo.tab = 'lotes'; UI.cargo.lim = 40; render(); window.scrollTo({ top: 0 }); },
  cgMore: () => { UI.cargo.lim += 40; render(); },
  cgOpen: b => { const k = b.dataset.k; UI.cargo.open[k] = !UI.cargo.open[k]; cgRefresh(k); },
  cgCopy: b => { const ld = cgD().lote[b.dataset.k] || {}; CG_CLIP.d = {}; CG_COMPRA.forEach(f => { if (ld[f] != null && ld[f] !== '') CG_CLIP.d[f] = ld[f]; }); if (!Object.keys(CG_CLIP.d).length) { CG_CLIP.d = null; toast('Ese lote no tiene datos de compra para copiar', true); return; } toast('Datos de compra copiados: péguelos con 📥'); render(); },
  cgPaste: b => { if (!CG_CLIP.d) { toast('Primero copie un lote con 📋', true); return; } const k = b.dataset.k, d = Object.assign({}, cgD().lote[k] || {}, CG_CLIP.d); if (d.fuente !== 'PROYECTOS VIGENTES') delete d.proy; cgPut('lote', k, d); cgRefresh(k); toast('Datos pegados'); },
  cgPasteAll: () => {
    if (!CG_CLIP.d) return; const A = MODS.cargo.A || cgAll(), ls = cgFiltra(A).filter(L => L.st !== 'carg'); let n = 0;
    ls.forEach(L => { const cur = cgD().lote[L.key] || {}, d = Object.assign({}, cur); let ch = false; CG_COMPRA.forEach(f => { if ((d[f] == null || d[f] === '') && CG_CLIP.d[f] != null) { d[f] = CG_CLIP.d[f]; ch = true; } }); if (d.fuente !== 'PROYECTOS VIGENTES') delete d.proy; if (ch) { cgPut('lote', L.key, d); n++; } });
    toast(n ? `Datos pegados en ${n} lote(s) (solo campos vacíos)` : 'Esos lotes ya tenían esos datos'); render();
  },
  cgAjustes: () => cgAjustes(),
  cgExp: b => cgExportar(b.dataset.v === 'listos'),
  cgCarg: () => {
    const keys = UI.cargo.last || []; if (!keys.length) return;
    modal(`<h2>¿Ya subió el Excel a SIGES?</h2><p>Se marcarán <b>${fmtN(keys.length)}</b> bienes como <b>cargados en SIGES</b> con su código actual. Quedan bloqueados para editar y, si después el conteo corre algún código, se avisará en rojo.</p>
      <div class="acts"><button class="btn" data-close type="button">Todavía no</button><button class="btn pri" type="button" data-act="cgCargOk">Sí, ya están cargados</button></div>`);
  },
  cgCargOk: () => {
    const A = cgAll(), by = new Map(); A.lotes.forEach(L => L.items.forEach((it, i) => by.set(it.key, L.chk[i].v.code)));
    const t = Date.now(); (UI.cargo.last || []).forEach(k => { if (by.has(k)) cgSetB(k, 'carg', { code: by.get(k), t }); });
    UI.cargo.last = null; closeModal(); toast('Marcados como cargados en SIGES'); render();
  },
  cgDescL: b => modal(`<h2>¿Quitar la marca de cargado?</h2><p>Hágalo solo si SIGES <b>no</b> aceptó estos bienes o los borró. Volverán a salir en el próximo Excel.</p><div class="acts"><button class="btn" data-close type="button">Cancelar</button><button class="btn pri" type="button" data-act="cgDescOk" data-k="${esc(b.dataset.k)}">Quitar marca</button></div>`),
  cgDescOk: b => { const L = cgLotes().find(x => x.key === b.dataset.k); if (L) L.items.forEach(it => cgSetB(it.key, 'carg', '')); closeModal(); render(); }
});

/* ---------- ajustes ---------- */
function cgAjustes() {
  const c = cgCfg(), blks = [...new Set(cgLotes().map(L => L.blk))].sort();
  const name = b => { const x = R.cat.find(y => y.A === b); return x ? x.F : ''; };
  modal(`<h2>Ajustes del cargo masivo</h2>
    <div class="cgaj"><label>“Asignado a” (columna K)<select data-ch="cgCfg" data-f="asig"><option value="ubic"${c.asig !== 'dui' ? ' selected' : ''}>Nombre de la ubicación (como en su inventario actual de SIGES)</option><option value="dui"${c.asig === 'dui' ? ' selected' : ''}>DUI del responsable de la ubicación</option></select></label>
    <label>Bienes contados como REGULAR se envían como<select data-ch="cgCfg" data-f="regular">${['REGULAR', 'BUENO', 'MALO'].map(v => `<option${(c.regular || 'REGULAR') === v ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
    <label>¿Valor estimado? por defecto<select data-ch="cgCfg" data-f="est"><option value="">Sin valor por defecto (elegir en cada lote)</option>${['SI', 'NO'].map(v => `<option${c.est === v ? ' selected' : ''}>${v}</option>`).join('')}</select></label></div>
    <h3 style="margin:14px 0 6px">Categoría SIGES por bloque</h3><p class="hint">Solo los bloques que tienen bienes nuevos. Confírmelas con el contador: deben coincidir con el tipo de bien en SIGES.</p>
    <div class="tw" style="max-height:45vh"><table class="t"><thead><tr><th>Bloque</th><th>Bien</th><th>Categoría</th></tr></thead><tbody>${blks.map(b => `<tr><td class="code">${esc(b)}</td><td>${esc(name(b))}</td><td>${cgSel(cgList('cats'), cgCat(b), `data-ch="cgCat" data-b="${esc(b)}"`)}</td></tr>`).join('')}</tbody></table></div>
    <div class="acts"><button class="btn pri" data-close type="button">Listo</button></div>`);
  $('#modalBox').classList.add('wide');
}
INP.cgCfg = el => { const d = Object.assign({}, cgCfg()); if (el.value) d[el.dataset.f] = el.value; else delete d[el.dataset.f]; cgPut('cfg', 'cfg', d); if (MOD === 'cargo') render(); };
INP.cgCat = el => { const d = Object.assign({}, cgCfg()); d.cat = Object.assign({}, d.cat || {}); if (el.value) d.cat[el.dataset.b] = el.value; else delete d.cat[el.dataset.b]; cgPut('cfg', 'cfg', d); if (MOD === 'cargo') render(); };

/* ---------- plantilla: leer, validar y llenar (sin tocar nada más del archivo) ---------- */
const CG_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
function cgZipLib() { return window.JSZip ? Promise.resolve() : loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'); }
function cgB64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
const cgColN = s => s.split('').reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0);
const cgColL = n => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
async function cgAbrir(buf) {
  const zip = await JSZip.loadAsync(buf), P = new DOMParser();
  const wbx = await (zip.file('xl/workbook.xml') || {}).async?.('string');
  if (!wbx) throw new Error('El archivo no es un Excel válido.');
  const wb = P.parseFromString(wbx, 'application/xml'), sheet = [...wb.getElementsByTagNameNS(CG_NS, 'sheet')].find(s => s.getAttribute('name') === 'carga_masiva');
  if (!sheet) throw new Error('No es la plantilla de SIGES: falta la hoja “carga_masiva”.');
  const rid = sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
  const rels = P.parseFromString(await zip.file('xl/_rels/workbook.xml.rels').async('string'), 'application/xml');
  const rel = [...rels.getElementsByTagName('Relationship')].find(r => r.getAttribute('Id') === rid);
  let path = rel.getAttribute('Target').replace(/^\//, ''); if (!path.startsWith('xl/')) path = 'xl/' + path;
  const sx = P.parseFromString(await zip.file(path).async('string'), 'application/xml');
  if (sx.getElementsByTagName('parsererror').length) throw new Error('No se pudo leer la hoja de la plantilla.');
  const sstF = zip.file('xl/sharedStrings.xml'), sst = [];
  if (sstF) { const d = P.parseFromString(await sstF.async('string'), 'application/xml'); [...d.getElementsByTagNameNS(CG_NS, 'si')].forEach(si => sst.push([...si.getElementsByTagNameNS(CG_NS, 't')].map(t => t.textContent).join(''))); }
  return { zip, path, sx, sst };
}
function cgCellText(c, sst) {
  const t = c.getAttribute('t'), v = c.getElementsByTagNameNS(CG_NS, 'v')[0];
  if (t === 's') return v ? sst[+v.textContent] ?? '' : '';
  if (t === 'inlineStr') return [...c.getElementsByTagNameNS(CG_NS, 't')].map(x => x.textContent).join('');
  return v ? v.textContent : '';
}
/** Lee encabezados y listas; falla si la plantilla no es la que se analizó. */
async function cgLeerPlantilla(buf) {
  const O = await cgAbrir(buf), rows = [...O.sx.getElementsByTagNameNS(CG_NS, 'row')], col = {};
  rows.forEach(r => [...r.getElementsByTagNameNS(CG_NS, 'c')].forEach(c => { const m = /^([A-Z]+)(\d+)$/.exec(c.getAttribute('r') || ''); if (!m) return; (col[m[1]] = col[m[1]] || {})[+m[2]] = cgCellText(c, O.sst); }));
  const h = CG_COLS.map((_, i) => String((col[cgColL(i + 1)] || {})[2] || '').replace(/\s+/g, ' ').trim());
  const bad = CG_COLS.map((x, i) => [x, h[i]]).filter(([a, b]) => norm(a) !== norm(b));
  if (bad.length) throw new Error('La plantilla no coincide con la analizada. Columna(s): ' + bad.slice(0, 4).map(([a, b]) => `“${a}” ≠ “${b}”`).join(', '));
  const lista = L => Object.keys(col[L] || {}).map(Number).filter(n => n >= 2).sort((a, b) => a - b).map(n => String(col[L][n]).trim()).filter(Boolean);
  const listas = { tipo: lista('AQ'), clasif: lista('AU'), cats: lista('AV'), est: lista('AW'), calidad: lista('AX'), formas: lista('AY'), fuentes: lista('AZ') };
  Object.entries(listas).forEach(([k, v]) => { if (!v.length) throw new Error('La plantilla no trae la lista de ' + k + '.'); });
  return Object.assign(O, { listas, sedes: lista('AT') });
}
function cgSetCell(doc, rowEl, ref, val, num) {
  const cells = [...rowEl.getElementsByTagNameNS(CG_NS, 'c')], n = cgColN(ref.replace(/\d+/g, ''));
  let c = cells.find(x => x.getAttribute('r') === ref);
  if (!c) { c = doc.createElementNS(CG_NS, 'c'); c.setAttribute('r', ref); const nx = cells.find(x => cgColN((x.getAttribute('r') || '').replace(/\d+/g, '')) > n); rowEl.insertBefore(c, nx || null); }
  while (c.firstChild) c.removeChild(c.firstChild);
  c.removeAttribute('t');
  if (val === '' || val == null) return;
  if (num) { const v = doc.createElementNS(CG_NS, 'v'); v.textContent = String(val); c.appendChild(v); return; }
  c.setAttribute('t', 'inlineStr');
  const is = doc.createElementNS(CG_NS, 'is'), t = doc.createElementNS(CG_NS, 't');
  t.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
  t.textContent = String(val).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  is.appendChild(t); c.appendChild(is);
}
/** Fila de la plantilla (A..AD) para un bien ya revisado. */
function cgFila(v) {
  return [cgList('tipo').find(x => norm(x) === 'CENTRO ESCOLAR') || 'Centro Escolar', '', v.sede, v.clasif, v.cat, v.tipoBien, v.correl, v.correlTxt, v.code, v.cal, v.asig, v.desc, v.marca, v.modelo, v.serie,
    v.placa, v.motor, v.chasis, v.vin, v.color, v.vida, v.forma, v.fuente, v.proy, v.doc, cgDMY(v.fecha), Math.round(v.valor * 100) / 100, v.est, v.prov, v.part];
}
const CG_NUM = new Set([6, 20, 26]);   // G Correlativo, U Vida útil, AA Valor (numéricos según la plantilla)
async function cgExportar(soloListos) {
  const A = cgAll(), incl = UI.cargo.inclCarg, sel = [];
  A.lotes.forEach(L => L.items.forEach((it, i) => { const x = L.chk[i]; if (!incl && x.v.carg) return; if (x.e.length && !soloListos) sel.push(null); else if (!x.e.length) sel.push({ it, x }); }));
  if (sel.includes(null)) { toast('Hay bienes con error: corríjalos o descargue solo los listos', true); return; }
  if (!sel.length) { toast('No hay bienes listos para descargar', true); return; }
  sel.sort((a, b) => a.x.v.code < b.x.v.code ? -1 : 1);
  setSync('busy', 'Preparando Excel…');
  try {
    await cgZipLib();
    const P = await api('api_g_cargoPlantillaGet'), bin = atob(P.b64), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const T = await cgLeerPlantilla(u8.buffer);
    // 1) cada valor de lista debe existir tal cual en la plantilla
    const chk = [['calidad', 'cal'], ['cats', 'cat'], ['clasif', 'clasif'], ['formas', 'forma'], ['fuentes', 'fuente'], ['est', 'est']], sedes = new Set(T.sedes.map(s => s.slice(0, 5))), mal = [];
    sel.forEach(({ x }) => { chk.forEach(([l, f]) => { if (!T.listas[l].includes(x.v[f])) mal.push(`${x.v.code}: “${x.v[f]}” no está en la lista de la plantilla`); }); if (!sedes.has(x.v.sede)) mal.push(`${x.v.code}: la sede ${x.v.sede} no está en la plantilla`); });
    const codes = new Set(); sel.forEach(({ x }) => { if (codes.has(x.v.code)) mal.push(`${x.v.code}: repetido`); codes.add(x.v.code); });
    if (mal.length) { setSync('err', 'Excel no generado'); modal(`<h2>No se generó el Excel</h2><p>La plantilla de SIGES no acepta estos valores:</p><ul>${mal.slice(0, 30).map(m => `<li>${esc(m)}</li>`).join('')}</ul>${mal.length > 30 ? `<p class="hint">y ${mal.length - 30} más.</p>` : ''}<div class="acts"><button class="btn" data-close type="button">Cerrar</button></div>`); return; }
    // 2) escribir desde la fila 3, respetando las celdas existentes (listas en AQ..AZ)
    const doc = T.sx, sd = doc.getElementsByTagNameNS(CG_NS, 'sheetData')[0], rowsByN = new Map([...sd.getElementsByTagNameNS(CG_NS, 'row')].map(r => [+r.getAttribute('r'), r]));
    // limpia datos viejos en A..AD (por si la plantilla traía filas llenas)
    rowsByN.forEach((r, n) => { if (n < 3) return; [...r.getElementsByTagNameNS(CG_NS, 'c')].forEach(c => { const m = /^([A-Z]+)/.exec(c.getAttribute('r') || ''); if (m && cgColN(m[1]) <= 30 && (c.getElementsByTagNameNS(CG_NS, 'v').length || c.getElementsByTagNameNS(CG_NS, 'is').length)) { while (c.firstChild) c.removeChild(c.firstChild); c.removeAttribute('t'); } }); });
    sel.forEach(({ x }, i) => {
      const n = 3 + i; let r = rowsByN.get(n);
      if (!r) { r = doc.createElementNS(CG_NS, 'row'); r.setAttribute('r', String(n)); const nx = [...rowsByN.keys()].filter(k => k > n).sort((a, b) => a - b)[0]; sd.insertBefore(r, nx ? rowsByN.get(nx) : null); rowsByN.set(n, r); }
      r.removeAttribute('spans');
      cgFila(x.v).forEach((val, ci) => cgSetCell(doc, r, cgColL(ci + 1) + n, val, CG_NUM.has(ci)));
    });
    const last = Math.max(2 + sel.length, ...rowsByN.keys()), dim = doc.getElementsByTagNameNS(CG_NS, 'dimension')[0];
    if (dim) { const m = /^([A-Z]+\d+):([A-Z]+)(\d+)$/.exec(dim.getAttribute('ref') || ''); if (m && +m[3] < last) dim.setAttribute('ref', `${m[1]}:${m[2]}${last}`); }
    T.zip.file(T.path, new XMLSerializer().serializeToString(doc));
    const out = await T.zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    // 3) verificación: se vuelve a leer lo escrito y se compara celda por celda
    const V = await cgAbrir(out.buffer), vr = new Map([...V.sx.getElementsByTagNameNS(CG_NS, 'row')].map(r => [+r.getAttribute('r'), r]));
    sel.forEach(({ x }, i) => {
      const r = vr.get(3 + i), got = {}; [...r.getElementsByTagNameNS(CG_NS, 'c')].forEach(c => { got[c.getAttribute('r')] = cgCellText(c, V.sst); });
      cgFila(x.v).forEach((val, ci) => { const ref = cgColL(ci + 1) + (3 + i), want = val == null ? '' : String(val); if (String(got[ref] ?? '') !== want) throw new Error(`Verificación falló en ${ref} (${x.v.code}): “${got[ref] ?? ''}” ≠ “${want}”`); });
    });
    const name = `CARGO_MASIVO_SIGES_${ymdL(new Date()).replace(/-/g, '')}_${sel.length}bienes.xlsx`;
    try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000); } catch (e) {}
    setSync('busy', 'Guardando copia en Drive…');
    const g = await api('api_g_cargoGuardar', cgB64(out), name, sel.length);
    const t = Date.now(); sel.forEach(({ it, x }) => cgSetB(it.key, 'exp', x.v.code));
    UI.cargo.last = sel.map(s => s.it.key); setSync('ok', 'Excel listo');
    modal(`<h2>✔ Excel para SIGES listo</h2><p><b>${fmtN(sel.length)}</b> bienes · ${money(sel.reduce((a, s) => a + s.x.v.valor, 0))} · verificado celda por celda contra la plantilla.</p>
      <p>Si no se descargó solo: <a href="${esc(g.xlsx)}" target="_blank" rel="noopener">⬇ Descargar desde Drive</a> · <a href="${esc(g.url)}" target="_blank" rel="noopener">Abrir en Drive</a></p>
      <p class="hint">Súbalo en SIGES › Cargo de bienes › Carga masiva. Cuando SIGES lo acepte, vuelva aquí y márquelos como cargados.</p>
      <div class="acts"><button class="btn" data-close type="button">Cerrar</button><button class="btn pri" type="button" data-act="cgCarg">☁ Ya los subí: marcar como cargados</button></div>`);
    if (MOD === 'cargo') render();
  } catch (e) { setSync('err', 'Excel no generado'); toast(errMsg(e), true); }
}
