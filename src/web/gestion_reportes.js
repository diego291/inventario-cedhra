/* ===================== REPORTES (agrupar + constructor con plantillas, vista previa en vivo) ===================== */
const RP_TIPOS = { cargos: 'Cargos', descargos: 'Descargos', reciclados: 'Reciclados', etiquetas: 'Etiquetas', reclasif: 'Reclasif.', conservar: 'Conservar', consolidado: 'Consolidado' };
const RP_GRUPOS = { blq: 'Bloque', ubic: 'Ubicación', edif: 'Edificio', resp: 'Responsable', estado: 'Estado', rubro: 'Rubro', anio: 'Año de compra', '': 'Ninguno' };
const RP_COLS = { cant: 'Cant.', desc: 'Descripción', ubic: 'Ubicación', resp: 'Responsable', estado: 'Estado', fecha: 'Fecha', valor: 'Valor', marca: 'Marca/serie', etq: 'Etiqueta vieja', motivo: 'Motivo', justif: 'Justificación', obs: 'Observación' };
const RP_DEF = { tipo: 'cargos', g1: 'blq', g2: 'ubic', ord: 'codigo', det: 'rangos', cols: { cant: 1, ubic: 1, resp: 1, estado: 1, fecha: 1 }, sub: 1, hoja: 0, firmas: 1, fBlq: '', fUbic: '', solo: 0 };
const RP_PRESETS = [
  ['★ Cargos para SIGES', { tipo: 'cargos', g1: 'blq', g2: 'ubic', ord: 'codigo', det: 'rangos', cols: { cant: 1, ubic: 1, resp: 1, estado: 1, fecha: 1 } }],
  ['Cargos por aula (etiquetar)', { tipo: 'cargos', g1: 'ubic', g2: 'blq', ord: 'codigo', det: 'rangos', cols: { cant: 1, desc: 1, estado: 1 } }],
  ['Reciclados por aula (re-etiquetar)', { tipo: 'reciclados', g1: 'ubic', g2: '', ord: 'codigo', det: 'codigo', cols: { desc: 1, etq: 1, estado: 1 } }],
  ['Descargos por ubicación', { tipo: 'descargos', g1: 'ubic', g2: '', ord: 'codigo', det: 'codigo', cols: { desc: 1, estado: 1, fecha: 1, valor: 1, justif: 1 } }],
  ['Descargos por bloque', { tipo: 'descargos', g1: 'blq', g2: '', ord: 'fecha', det: 'rangos', cols: { cant: 1, ubic: 1, fecha: 1, valor: 1 } }],
  ['Descargos por año de compra', { tipo: 'descargos', g1: 'anio', g2: 'blq', ord: 'fecha', det: 'codigo', cols: { desc: 1, ubic: 1, fecha: 1, valor: 1, motivo: 1 } }]
];
UI.rp = Object.assign(JSON.parse(JSON.stringify(RP_DEF)), LS.get('rp', {}));
const parseCode = c => { const m = String(c || '').match(/^(\d{5})-(\d{4})-(\d+)$/); return m ? { ib: m[1] + '-' + m[2], n: +m[3] } : { ib: '', n: NaN }; };
function locIdx(u) { const L = ordenLista(); const i = L.findIndex(l => norm(l.n) === norm(u)); return i < 0 ? 9999 : i; }
/** Bienes del reporte, ya normalizados. */
function rpItems(t) {
  const respN = u => respOf(u).filter(p => p.rol !== 'Testigo').map(p => p.n).join(', ');
  const edif = u => (X.loc[norm(u)] || {}).z || '';
  const rub = b => (R.cat.find(x => x.A === b) || {}).C || '';
  let L = [];
  if (t === 'cargos' || t === 'reciclados') {
    L = R.cod.filter(c => t === 'cargos' ? c.R === 'NUEVO' : c.R === 'Reciclado').map(c => ({ code: c.B, blk: c.D, desc: c.C.replace(/^🔒 /, ''), ubic: c.E, edif: edif(c.E), resp: respN(c.E), estado: c.F, fecha: c.AD, valor: c.AE === '' ? '' : Number(c.AE) || 0,
      marca: c.AF || c.H, etq: c.X, motivo: c.V || c.U, justif: '', obs: c.row.Q, rubro: rub(c.D), anio: String(c.AD || '').slice(0, 4), key: fkeyCod(c.n - 1) }));
  } else if (t === 'descargos') {
    L = R.descargos.det.map(d => ({ code: d.B, blk: d.D, desc: d.C, ubic: d.E, edif: edif(d.E), resp: respN(d.E), estado: d.F, fecha: d.H, valor: Number(d.I) || 0, marca: d.G, etq: '', motivo: d.J, justif: ((D.justif || {})[d.B] || {}).t || '', obs: '', rubro: rub(d.D), anio: String(d.H || '').slice(0, 4), key: fkeyInv(d.B) }));
  }
  const s = UI.rp;
  if (s.fBlq) { const bs = s.fBlq.split(/[,\s]+/).filter(Boolean); L = L.filter(x => bs.some(b => x.blk === Motor.util.pad4(+b) || x.code.startsWith(b))); }
  if (s.fUbic) L = L.filter(x => norm(x.ubic) === norm(s.fUbic));
  if (s.solo) L = L.filter(x => (X.loc[norm(x.ubic)] || {}).cerrada);
  return L;
}
function rpGroupKey(x, g) {
  if (g === 'blq') { const p = parseCode(x.code); return { k: (p.ib || x.blk), l: (p.ib || x.blk) + ' · ' + (R.catDesc(x.blk) || x.desc), o: p.ib || x.blk }; }
  if (g === 'ubic') return { k: norm(x.ubic), l: (nombreUbic(x.ubic) || x.ubic || '(sin ubicación)'), o: String(locIdx(x.ubic)).padStart(5, '0') + norm(x.ubic) };
  if (g === 'edif') return { k: x.edif || '—', l: x.edif || '(sin edificio)', o: x.edif || '~' };
  if (g === 'resp') return { k: x.resp || '—', l: x.resp || '(sin responsable)', o: x.resp || '~' };
  if (g === 'estado') return { k: x.estado || '—', l: x.estado || '—', o: x.estado };
  if (g === 'rubro') return { k: x.rubro || '—', l: x.rubro || '(sin rubro)', o: x.rubro || '~' };
  if (g === 'anio') return { k: x.anio || '—', l: x.anio ? 'Adquiridos en ' + x.anio : 'Sin fecha', o: x.anio || '0000' };
  return { k: '', l: '', o: '' };
}
function rpSort(L) {
  const o = UI.rp.ord, cmpCode = (a, b) => { const p = parseCode(a.code), q = parseCode(b.code); return p.ib < q.ib ? -1 : p.ib > q.ib ? 1 : p.n - q.n; };
  return L.slice().sort((a, b) => o === 'ubic' ? (locIdx(a.ubic) - locIdx(b.ubic)) || cmpCode(a, b) : o === 'fecha' ? (String(a.fecha) < String(b.fecha) ? -1 : String(a.fecha) > String(b.fecha) ? 1 : cmpCode(a, b)) : o === 'valor' ? ((Number(b.valor) || 0) - (Number(a.valor) || 0)) || cmpCode(a, b) : cmpCode(a, b));
}
function rpGroups(L, g) {
  if (!g) return [{ k: '', l: '', o: '', items: L }];
  const m = {}; L.forEach(x => { const G = rpGroupKey(x, g); (m[G.k] = m[G.k] || { k: G.k, l: G.l, o: G.o, items: [] }).items.push(x); });
  return Object.values(m).sort((a, b) => a.o < b.o ? -1 : a.o > b.o ? 1 : 0);
}
/** Junta códigos consecutivos (misma institución-bloque, correlativo +1) con las mismas columnas visibles. */
function rpRanges(items, cols) {
  const keys = Object.keys(cols).filter(k => cols[k] && k !== 'cant' && k !== 'valor'), out = [];
  items.forEach(x => {
    const p = parseCode(x.code), last = out[out.length - 1];
    if (last && last.ib === p.ib && p.n === last.n2 + 1 && keys.every(k => String(last.x[k] ?? '') === String(x[k] ?? ''))) { last.hasta = x.code; last.n2 = p.n; last.cant++; last.valor += Number(x.valor) || 0; }
    else out.push({ desde: x.code, hasta: x.code, ib: p.ib, n2: p.n, cant: 1, valor: Number(x.valor) || 0, x });
  });
  return out;
}
/* ---------- Diseño A (institucional) compartido por todos los reportes ---------- */
const RP_W = { 'Desde': '15%', 'Hasta': '15%', 'Código': '15%', 'Cant.': '6%', 'Fecha': '10%', 'Valor': '10%', 'Estado': '10%', 'Etiqueta vieja': '14%', 'Marca/serie': '14%' };
const rpColg = head => `<colgroup>${head.map(h => `<col${RP_W[h] ? ` style="width:${RP_W[h]}"` : ''}>`).join('')}</colgroup>`;
const rpSt = v => { const t = String(v ?? '').trim(); return /^(BUENO|REGULAR|MALO)$/i.test(t) ? `<i class="st ${t.toLowerCase()}">${esc(t.toUpperCase())}</i>` : esc(v); };
const rpMeta = (n, rango, val) => `<span class="mt"><em>${fmtN(n)} cód.</em>${rango ? `<em class="rg">${esc(rango)}</em>` : ''}${val != null ? `<em>${money(val)}</em>` : ''}</span>`;
/** Encabezado del reporte: institución, título, agrupación, período, fecha, marca PRELIMINAR y cuadros de totales. */
function rpHead(titulo, por, kpis) {
  const pre = X.preliminar ? `<div class="pre"><b>PRELIMINAR</b><span>${X.act.length - X.cerradas} ubicaciones sin cerrar</span></div>` : '';
  return `${X.preliminar ? '<div class="wm">PRELIMINAR</div>' : ''}<div class="rh"><div class="rh1"><div class="inst">${esc(BASE.cfg.nombre || '')}</div><div class="tt">${esc(titulo)}</div>${por ? `<div class="by">Agrupado por ${esc(por.toLowerCase())}</div>` : ''}</div>
    <div class="rh2"><div><span>Período</span><b>${esc(BASE.cfg.periodo || '')}</b></div><div><span>Fecha</span><b>${today()}</b></div>${pre}</div></div>
    <div class="kp" style="grid-template-columns:repeat(${kpis.length},1fr)">${kpis.map(([t, v]) => `<div><span>${esc(t)}</span><b>${esc(typeof v === 'number' ? fmtN(v) : v)}</b></div>`).join('')}</div>`;
}
const rpFirmas = () => `<table class="f3" style="margin-top:36pt;page-break-inside:avoid"><tr><td><div class="ln">Elaborado por<br>${esc(BASE.cfg.encargado || '')}</div></td><td><div class="ln">Revisado por</div></td><td><div class="ln">Vo. Bo. Dirección<br>${esc(BASE.cfg.director || '')}</div></td></tr></table>`;
function rpBuild(forPrint) {
  const s = UI.rp, cols = s.cols, L = rpSort(rpItems(s.tipo)), g2 = s.g2 && s.g2 !== s.g1 ? s.g2 : '';
  const grp = new Set([s.g1, g2]);
  // la columna que ya es título de grupo no se repite en cada fila
  const vis = Object.keys(RP_COLS).filter(k => cols[k] && !(s.det !== 'rangos' && k === 'cant') && !(k === 'ubic' && grp.has('ubic')) && !(k === 'resp' && (grp.has('resp') || grp.has('ubic'))) && !(k === 'estado' && grp.has('estado')));
  const head = (s.det === 'rangos' ? ['Desde', 'Hasta'] : s.det === 'codigo' ? ['Código'] : []).concat(vis.map(k => RP_COLS[k]));
  const nCol = head.length, num = k => k === 'cant' || k === 'valor';
  const cell = (k, x, rg) => k === 'cant' ? (rg ? rg.cant : 1) : k === 'valor' ? (rg ? money(rg.valor) : (x.valor === '' ? '' : money(x.valor))) : k === 'fecha' ? dmy(x.fecha || '') : (x[k] ?? '');
  const flat = [];
  const sumV = items => items.reduce((a, x) => a + (Number(x.valor) || 0), 0), withV = cols.valor || s.tipo === 'descargos';
  const rangoTxt = items => { if (s.ord !== 'codigo' || !items.length) return ''; const a = items[0].code, b = items[items.length - 1].code; return a === b ? a : a + ' a ' + b; };
  const extraUb = (g, l) => g === 'ubic' && l.items.length ? (() => { const rs = respOf(l.items[0].ubic).filter(p => p.rol !== 'Testigo'); return rs.length ? ' · ' + rs.map(p => p.n).join(', ') : ''; })() : '';
  const rowsOf = (items, labels) => {
    const rr = s.det === 'rangos' ? rpRanges(items, cols).map(r => ({ h: `<td class="mono">${esc(r.desde)}</td><td class="mono">${r.hasta === r.desde ? '' : esc(r.hasta)}</td>`, v: vis.map(k => cell(k, r.x, r)), f: [r.desde, r.hasta === r.desde ? '' : r.hasta].concat(vis.map(k => cell(k, r.x, r))) }))
      : items.map(x => ({ h: `<td class="mono">${esc(x.code)}</td>`, v: vis.map(k => cell(k, x)), f: [x.code].concat(vis.map(k => cell(k, x))) }));
    rr.forEach(r => flat.push(labels.concat(r.f)));
    return rr.map(r => `<tr>${r.h}${r.v.map((v, i) => `<td${num(vis[i]) ? ' class="n"' : ''}>${vis[i] === 'estado' ? rpSt(v) : esc(v)}</td>`).join('')}</tr>`).join('');
  };
  let html = '', gi = 0;
  const thead = rpColg(head) + `<thead><tr>${head.map((h, i) => `<th${h === 'Cant.' || h === 'Valor' ? ' class="n"' : ''}>${esc(h)}</th>`).join('')}</tr></thead>`;
  rpGroups(L, s.g1).forEach(G => {
    const brk = s.hoja && gi++ > 0 ? ' style="page-break-before:always;break-before:page"' : '';
    if (s.g1) html += `<div class="bh"${brk}><span>${esc(G.l)}${esc(extraUb(s.g1, G))}</span>${rpMeta(G.items.length, rangoTxt(G.items), withV ? sumV(G.items) : null)}</div>`;
    if (s.det === 'totales') {
      if (g2) html += `<table class="det tot2"><tbody>${rpGroups(G.items, g2).map(H => `<tr><td>${esc(H.l)}${esc(extraUb(g2, H))}</td><td class="mono">${esc(rangoTxt(H.items))}</td><td class="n">${fmtN(H.items.length)}</td>${withV ? `<td class="n">${money(sumV(H.items))}</td>` : ''}</tr>`).join('')}</tbody></table>`;
      rpGroups(G.items, g2).forEach(H => flat.push([G.l, H.l, rangoTxt(H.items), H.items.length].concat(withV ? [money(sumV(H.items))] : [])));
    } else {
      let body = '';
      rpGroups(G.items, g2).forEach(H => {
        if (H.l) body += `<tr class="g2"><td colspan="${nCol}"><span>${esc(H.l)}${esc(extraUb(g2, H))}</span>${rpMeta(H.items.length, rangoTxt(H.items), withV ? sumV(H.items) : null)}</td></tr>`;
        body += rowsOf(H.items, [G.l, H.l].filter((x, i) => [s.g1, g2][i]));
      });
      html += `<table class="det">${thead}<tbody>${body}</tbody></table>`;
    }
    if (s.g1 && s.sub) html += `<div class="sub2"><span>Subtotal ${esc(G.l.split(' · ')[0])}</span>${rpMeta(G.items.length, '', withV ? sumV(G.items) : null)}</div>`;
  });
  const titulo = { cargos: 'REPORTE DE CARGOS (CÓDIGOS NUEVOS)', descargos: 'REPORTE DE DESCARGOS', reciclados: 'CÓDIGOS RECICLADOS (RE-ETIQUETAR)' }[s.tipo];
  const por = [s.g1 && RP_GRUPOS[s.g1], g2 && RP_GRUPOS[g2]].filter(Boolean).join(' ▸ ');
  const res = `${L.length} código(s)${withV ? ' · ' + money(sumV(L)) : ''} · ${new Set(L.map(x => parseCode(x.code).ib || x.blk)).size} bloque(s) · ${new Set(L.map(x => norm(x.ubic))).size} ubicación(es)`;
  const kpis = [['Códigos', L.length]].concat(withV ? [['Valor total', money(sumV(L))]] : []).concat([['Bloques', new Set(L.map(x => parseCode(x.code).ib || x.blk)).size], ['Ubicaciones', new Set(L.map(x => norm(x.ubic))).size]]);
  const doc = `<section class="doc rep">${rpHead(titulo, por, kpis)}${html || '<p>Sin datos con ese filtro.</p>'}
    <div class="gt"><span>TOTAL GENERAL</span><span>${fmtN(L.length)} códigos${withV ? ' · ' + money(sumV(L)) : ''}</span></div>${s.firmas ? rpFirmas() : ''}</section>`;
  const xhead = (s.det === 'totales' ? [RP_GRUPOS[s.g1] || 'Grupo', RP_GRUPOS[g2] || '', 'Rango', 'Cantidad'].concat(withV ? ['Valor'] : []) : [s.g1 && RP_GRUPOS[s.g1], g2 && RP_GRUPOS[g2]].filter(Boolean).concat(head));
  return { doc, head: xhead, flat, n: L.length, titulo };
}
const REP_CSS = `.doc.rep .rh{display:flex;justify-content:space-between;align-items:flex-end;gap:14pt;border-bottom:2pt solid #1F3864;padding-bottom:6pt}
.doc.rep .rh1{flex:1;min-width:0}.doc.rep .inst{font-size:8pt;letter-spacing:.12em;color:#1F3864;font-weight:bold;text-transform:uppercase}.doc.rep .tt{font-size:16pt;font-weight:bold;color:#1F3864;margin-top:1pt;line-height:1.15}.doc.rep .by{font-size:8.5pt;color:#666}
.doc.rep .rh2{display:flex;gap:12pt;align-items:flex-end;flex:none}.doc.rep .rh2>div{display:flex;flex-direction:column;font-size:8.5pt}.doc.rep .rh2 span{font-size:6.5pt;color:#777;text-transform:uppercase;letter-spacing:.08em}
.doc.rep .rh2 .pre{border:1pt solid #C00000;color:#C00000;padding:2pt 6pt;border-radius:3pt}.doc.rep .rh2 .pre span{color:#C00000;text-transform:none;letter-spacing:0;font-size:6.5pt}
.doc.rep .kp{display:grid;margin:8pt 0 10pt;border:0.8pt solid #C9D2E3;border-radius:4pt;page-break-inside:avoid}.doc.rep .kp div{display:flex;flex-direction:column;padding:5pt 8pt;border-left:0.8pt solid #C9D2E3}.doc.rep .kp div:first-child{border-left:0}
.doc.rep .kp span{font-size:7pt;text-transform:uppercase;letter-spacing:.06em;color:#5B6578}.doc.rep .kp b{font-size:13pt;color:#1F3864;font-variant-numeric:tabular-nums}
.doc .bh{background:#1F3864;color:#fff;font-weight:bold;padding:5pt 7pt;margin-top:12pt;display:flex;justify-content:space-between;align-items:center;gap:10pt;font-size:9pt;letter-spacing:.02em;border-radius:3pt 3pt 0 0;page-break-after:avoid;break-after:avoid}
.doc .mt{display:flex;gap:10pt;white-space:nowrap}.doc .mt em{font-style:normal}.doc .mt em.rg{font-weight:normal;font-size:8pt;opacity:.85}
.doc.rep .det{table-layout:fixed;margin-top:0}.doc.rep .det th{background:#fff;color:#1F3864;border-bottom:1pt solid #1F3864;font-size:7pt;letter-spacing:.06em;padding:4pt 3pt 3pt}
.doc.rep .det td{border-bottom:0.4pt solid #E1E5EC;overflow-wrap:anywhere}.doc.rep .det td.n{font-variant-numeric:tabular-nums}
.doc.rep .det tbody tr:not(.g2):nth-child(even) td{background:#F7F9FC}
.doc tr.g2 td{background:#E9EDF4;color:#1F3864;font-weight:bold;padding:3pt 5pt;font-size:8.5pt;border-top:0.8pt solid #C9D2E3}.doc tr.g2 td>span:first-child{float:left}.doc tr.g2 td .mt{float:right}
.doc tr.g2{page-break-after:avoid;break-after:avoid}
.doc .sub2{display:flex;justify-content:space-between;font-weight:bold;color:#1F3864;padding:4pt 7pt;font-size:8.5pt;border-top:1pt solid #1F3864;page-break-before:avoid}
.doc.rep .gt{display:flex;justify-content:space-between;font-weight:bold;margin-top:12pt;padding:6pt 8pt;font-size:10pt;background:#1F3864;color:#fff;border-radius:3pt;page-break-inside:avoid}
.doc.rep h3{font-size:9pt;color:#1F3864;letter-spacing:.06em;margin:12pt 0 0;padding:5pt 7pt;background:#1F3864;color:#fff;border-radius:3pt 3pt 0 0}
.doc.rep .det.fx{table-layout:auto}.doc.rep .det.fx td{overflow-wrap:normal;font-size:8pt}.doc.rep .f3{table-layout:fixed}.doc.rep .tot2 td{padding:3pt 5pt}.doc.rep .tot2 tr:nth-child(even) td{background:#F7F9FC}
.doc i.st{font-style:normal;font-size:7pt;font-weight:bold;padding:0.5pt 4pt;border-radius:6pt;white-space:nowrap}.doc i.st.bueno{background:#E3F2E8;color:#1E7B45}.doc i.st.regular{background:#FFF1D6;color:#9A6200}.doc i.st.malo{background:#FBE3E3;color:#B42318}`;
MODS.reportes = {
  html() {
    const s = UI.rp, fixed = !['cargos', 'descargos', 'reciclados'].includes(s.tipo);
    const seg = (k, opts) => `<div class="seg">${Object.entries(opts).map(([v, t]) => `<button type="button" class="${String(s[k]) === v ? 'on' : ''}" data-act="rpSet" data-k="${k}" data-v="${esc(v)}">${esc(t)}</button>`).join('')}</div>`;
    const tabs = `<div class="tabs">${Object.entries(RP_TIPOS).map(([k, t]) => `<button type="button" data-act="rpSet" data-k="tipo" data-v="${k}" class="${s.tipo === k ? 'on' : ''}">${t}</button>`).join('')}</div>`;
    if (fixed) return tabs + this.fixedHtml(s.tipo);
    const pl = RP_PRESETS.filter(p => p[1].tipo === s.tipo || true).map(([n], i) => `<button type="button" class="chip in" style="border:0;cursor:pointer;padding:5px 11px" data-act="rpPreset" data-i="${i}">${esc(n)}</button>`).join('') + (D.plantillas || []).map(p => `<span class="chip" style="padding:5px 4px 5px 11px"><button type="button" style="border:0;background:none;cursor:pointer;font:inherit;color:inherit;padding:0" data-act="rpLoad" data-n="${esc(p.n)}">☆ ${esc(p.n)}</button><button type="button" style="border:0;background:none;cursor:pointer;color:var(--bad)" data-act="rpDelPl" data-n="${esc(p.n)}" title="Borrar plantilla">✕</button></span>`).join('');
    const B = rpBuild();
    return tabs + `${X.preliminar ? `<div class="banner wa">Faltan ${X.act.length - X.cerradas} ubicaciones por cerrar: los reportes salen con marca <b>PRELIMINAR</b>.</div>` : ''}
    <div class="rgrid"><div class="card rcfg"><span class="lbl">Plantillas (1 clic)</span><div class="row" style="gap:6px">${pl}</div>
      <div class="lvls"><i>Agrupar</i>${seg('g1', RP_GRUPOS)}<i>Luego por</i>${seg('g2', RP_GRUPOS)}<i>Ordenar</i>${seg('ord', { codigo: 'Código ↑', ubic: 'Ubicación', fecha: 'Fecha ↑', valor: 'Valor ↓' })}<i>Detalle</i>${seg('det', { rangos: 'Rangos desde–hasta', codigo: 'Código por código', totales: 'Solo totales' })}</div>
      <span class="lbl">Columnas</span><div class="row" style="gap:6px">${Object.entries(RP_COLS).filter(([k]) => !(k === 'justif' && s.tipo !== 'descargos') && !(k === 'etq' && s.tipo === 'descargos')).map(([k, t]) => `<button type="button" class="chip ${s.cols[k] ? 'in' : ''}" style="border:0;cursor:pointer;padding:4px 10px" data-act="rpCol" data-k="${k}">${s.cols[k] ? '✓ ' : '+ '}${esc(t)}</button>`).join('')}</div>
      <div class="row" style="gap:14px">${[['sub', 'Subtotales'], ['hoja', 'Cada grupo en hoja nueva'], ['firmas', 'Firmas al final'], ['solo', 'Solo ubicaciones cerradas']].map(([k, t]) => `<label class="row hint" style="gap:6px"><input type="checkbox" data-ch="rpChk" data-k="${k}"${s[k] ? ' checked' : ''}> ${t}</label>`).join('')}</div>
      <div class="row"><div class="field"><span class="lbl">Bloques</span><input type="text" data-in="rpFB" value="${esc(s.fBlq)}" placeholder="todos · ej. 1103, 1142" style="width:170px"></div><div class="field"><span class="lbl">Ubicación</span><select data-ch="rpFU">${ubicOpts(s.fUbic, 'Todas')}</select></div><div class="field"><span class="lbl">Papel</span><select data-ch="aPap">${['Carta', 'Oficio', 'A4'].map(p => `<option${UI.actas.papel === p ? ' selected' : ''}>${p}</option>`).join('')}</select></div></div>
      <div class="row"><button class="btn pri" data-act="rpPrint" type="button">🖨 PDF / Imprimir</button><button class="btn" data-act="rpXls" type="button">⬇ Excel</button><button class="btn ghost" data-act="rpSave" type="button">★ Guardar plantilla</button></div>
      <div class="hint">Los códigos consecutivos de la misma ubicación se juntan en un rango; si se cortan, se abre otra línea. Para PDF elija “Guardar como PDF” en la ventana de impresión.</div>
      <div class="card" style="box-shadow:none;margin-top:4px"><h2 style="font-size:14px">Exportar todo</h2><div class="row"><button class="btn sm dark" data-act="rExport" type="button">⬇ Archivo de resultados completo</button><span class="hint" id="rExpMsg">Conteo, códigos, inventario anterior y todos los reportes.</span></div></div></div>
    <div class="rpv"><div class="hint" style="color:#fff">Vista previa en vivo · ${fmtN(B.n)} códigos</div><div class="paper" id="rpPaper"><style>${DOC_CSS}${REP_CSS}</style>${B.doc}</div></div></div>`;
  },
  fixedHtml(k) {
    const r = REPS[k], res = r.res ? r.res() : null, [h, rows] = r.det();
    return `${X.preliminar ? `<div class="banner wa">Faltan ${X.act.length - X.cerradas} ubicaciones por cerrar: sale con marca <b>PRELIMINAR</b>.</div>` : ''}
    <div class="row"><h2 style="margin:0;font-size:18px;flex:1">${esc(r.t)}</h2><button class="btn pri" data-act="rPrint" type="button">🖨 Imprimir con firmas</button><button class="btn" data-act="rFixXls" type="button">⬇ Excel</button></div>
    <div class="grid g4">${r.tot().map(([t, v]) => `<div class="kpi"><span>${esc(t)}</span><b>${typeof v === 'number' ? fmtN(v) : esc(v)}</b></div>`).join('')}</div>
    ${res ? `<div class="card"><h2>${esc(res[0])}</h2>${tblHTML(res[1], res[2])}</div>` : ''}<div class="card"><h2>Detalle <span class="meta">${fmtN(rows.length)} filas</span></h2>${tblHTML(h, rows.slice(0, 1500))}</div>`;
  }
};
const REPS = {
  etiquetas: { t: 'Reporte de etiquetas verificadas', tot: () => [['Verificadas', R.etiquetas.tot.verificadas], ['Correctas', R.etiquetas.tot.correctas], ['Incorrectas', R.etiquetas.tot.incorrectas], ['En otra ubicación', R.etiquetas.tot.otraUbic]],
    det: () => [['#', 'Etiqueta', 'Descripción (sistema)', 'Ubicación (sistema)', 'Ubicación contada', 'Fecha', 'Resultado', 'Bien contado', 'Código asignado', 'Acción'], R.etiquetas.det.map(d => [d.A, d.B, d.C, d.D, d.E, dmy(d.F), d.G, d.H, d.I, d.J])] },
  reclasif: { t: 'Reporte de reclasificación (familia equivocada)', tot: () => [['Códigos a descargar', R.reclasif.tot.descargar], ['Bienes encontrados', R.reclasif.tot.encontrados], ['Sin bien encontrado', R.reclasif.tot.sinBien]],
    det: () => [['#', 'Código a descargar', 'Descripción', 'Fecha', 'Valor', 'Ubicación', 'Familia correcta', 'Nuevo código', 'Ubicación contada', 'Acción'], R.reclasif.det.map(d => [d.A, d.B, d.C, dmy(d.D), money(d.E), d.F, d.G, d.H, d.I, d.J])] },
  conservar: { t: 'Códigos reservados (conservar)', tot: () => [['Reservados', R.conservar.tot.reservados], ['Conservados', R.conservar.tot.conservados], ['Pendientes', R.conservar.tot.pendientes], ['Conservados sin reserva', R.conservar.tot.fuera]],
    det: () => [['#', 'Código', 'Descripción', 'Marca', 'Modelo', 'Serie', 'Fecha', 'Ubicación', 'Estado', 'Encontrado en'], R.conservar.det.map(d => [d.A, d.B, d.C, d.D, d.E, d.F, dmy(d.G), d.H, d.I, d.J])] },
  consolidado: { t: 'Consolidado por ubicación', tot: () => [['Ubicaciones activas', R.cons.activas], ['Contadas', R.cons.contadas], ['Bienes', R.cons.bienes], ['Malos', R.cons.malos + ' (' + pct(R.cons.pctMalo) + ')']],
    res: () => ['Por rubro', ['Rubro', 'Nombre', 'Contados', 'Malos', 'En sistema'], R.consRub.filter(r => r.R || r.T).map(r => [r.P, r.Q, r.R, r.S, r.T])],
    det: () => [['Ubicación', 'Tipo', 'Edificio', 'Bueno', 'Regular', 'Malo', 'Total', '% malo', 'Filas', 'Desde', 'Hasta', 'Estado', 'Inv. anterior', 'Diferencia'], R.consUb.filter(Boolean).map(x => [x.A, x.B, x.C, x.D, x.E, x.F, x.G, x.H === '' ? '' : pct(x.H), x.I, dmy(x.J), dmy(x.K), x.L, x.M, x.N])] }
};
function tblHTML(h, rows) { return rows.length ? `<div class="tw" style="max-height:520px"><table class="t"><thead><tr>${h.map(x => `<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(v => `<td${typeof v === 'number' ? ' class="n"' : /^\d{5}-\d{4}/.test(String(v)) ? ' class="code"' : ''}>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '<div class="hint">Sin filas.</div>'; }
function rpSaveState() { LS.set('rp', UI.rp); }
function rpRefresh() { rpSaveState(); const st = window.scrollY; render(); window.scrollTo(0, st); }
Object.assign(ACT, {
  rpSet: b => { const k = b.dataset.k; UI.rp[k] = b.dataset.v; if (k === 'tipo' && UI.rp.tipo === 'descargos') { UI.rp.cols.etq = 0; } rpRefresh(); },
  rpCol: b => { UI.rp.cols[b.dataset.k] = UI.rp.cols[b.dataset.k] ? 0 : 1; rpRefresh(); },
  rpPreset: b => { const p = RP_PRESETS[+b.dataset.i][1]; UI.rp = Object.assign(JSON.parse(JSON.stringify(RP_DEF)), JSON.parse(JSON.stringify(p))); rpRefresh(); toast('Plantilla aplicada: ' + RP_PRESETS[+b.dataset.i][0].replace('★ ', '')); },
  rpLoad: b => { const p = (D.plantillas || []).find(x => x.n === b.dataset.n); if (p) { UI.rp = Object.assign(JSON.parse(JSON.stringify(RP_DEF)), p.cfg); rpRefresh(); toast('Plantilla: ' + p.n); } },
  rpDelPl: b => confirmModal(`¿Borrar la plantilla <b>${esc(b.dataset.n)}</b>?`, 'Borrar', async () => { const r = await api('api_g_plantilla', b.dataset.n, '', null, true); D.plantillas = r.plantillas; render(); }),
  rpSave: () => { modal(`<h2>Guardar plantilla</h2><p class="hint" style="margin:0">Guarda la configuración actual (tipo, agrupación, orden, detalle, columnas y filtros) para usarla con un clic. La ven todos los supervisores.</p><input type="text" id="plN" placeholder="Ej.: Cargos para SIGES con valor"><div class="acts"><button class="btn" data-close type="button">Cancelar</button><button class="btn pri" id="plOk" type="button">Guardar</button></div>`);
    $('#plOk').onclick = async () => { $('#plOk').disabled = true; try { const r = await api('api_g_plantilla', $('#plN').value, UI.rp.tipo, UI.rp, false); D.plantillas = r.plantillas; closeModal(); render(); toast('Plantilla guardada'); } catch (e) { toast(errMsg(e), true); $('#plOk').disabled = false; } }; },
  rpPrint: () => { const B = rpBuild(true); printHTML(`<style>${REP_CSS}</style>` + B.doc); },
  rpXls: async b => { b.disabled = true; try { const B = rpBuild(); descarga(await api('api_g_tablas', B.titulo, [{ t: B.titulo.slice(0, 90), head: B.head, rows: B.flat }])); } catch (e) { toast(errMsg(e), true); } b.disabled = false; },
  rFixXls: async b => { b.disabled = true; try { const r = REPS[UI.rp.tipo], [h, rows] = r.det(); descarga(await api('api_g_tablas', r.t, [{ t: r.t.slice(0, 90), head: h, rows }])); } catch (e) { toast(errMsg(e), true); } b.disabled = false; },
  rPrint: () => {
    const r = REPS[UI.rp.tipo], res = r.res ? r.res() : null, [h, rows] = r.det();
    const t = (hh, rr) => `<table class="det fx"><thead><tr>${hh.map(x => `<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>${rr.map(x => `<tr>${x.map(v => `<td${typeof v === 'number' ? ' class="n"' : /^\d{5}-\d{4}/.test(String(v)) ? ' class="mono"' : ''}>${rpSt(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    const pap = UI.actas.papel, hz = pap === 'Oficio' ? '13in 8.5in' : pap === 'A4' ? 'A4 landscape' : 'letter landscape';
    printHTML(`<style>${REP_CSS}@page{size:${hz};margin:10mm}</style><section class="doc rep">${rpHead(r.t.toUpperCase(), '', r.tot())}${res ? `<h3>${esc(res[0].toUpperCase())}</h3>${t(res[1], res[2])}` : ''}<h3>DETALLE · ${fmtN(rows.length)} FILAS</h3>${t(h, rows)}${rpFirmas()}</section>`);
  },
  rExport: async b => {
    b.disabled = true; $('#rExpMsg').textContent = 'Calculando y escribiendo el archivo… (puede tardar un minuto)';
    try { const r = await api('api_g_exportar'); $('#rExpMsg').innerHTML = `Listo: <b>${esc(r.name)}</b> · <a href="${esc(r.url)}" target="_blank" rel="noopener">Abrir</a> · <a href="${esc(r.xlsx)}" target="_blank" rel="noopener">⬇ Excel</a>`; }
    catch (e) { $('#rExpMsg').textContent = errMsg(e); } finally { b.disabled = false; }
  }
});
INP.rpChk = el => { UI.rp[el.dataset.k] = el.checked ? 1 : 0; rpRefresh(); };
INP.rpFU = el => { UI.rp.fUbic = el.value; rpRefresh(); };
INP.rpFB = debounce(el => { UI.rp.fBlq = el.value; rpSaveState(); const B = rpBuild(); $('#rpPaper').innerHTML = `<style>${DOC_CSS}${REP_CSS}</style>` + B.doc; }, 400);
INP.aPap = el => { UI.actas.papel = el.value; };
