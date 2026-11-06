/* ===================== DOCUMENTOS: fichas, actas, reportes, etiquetas ===================== */
const DOC_CSS = `
.doc,.doc *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
.doc{font-family:Arial,Helvetica,sans-serif;color:#111;font-size:10pt;line-height:1.35;position:relative;page-break-after:always;break-after:page}
.doc:last-child{page-break-after:auto;break-after:auto}
.doc h1{font-size:14pt;color:#1F3864;text-align:center;margin:4pt 0 2pt}
.doc .sub{text-align:center;font-style:italic;color:#555;font-size:9.5pt;margin-bottom:8pt}
.doc .etq{text-align:right;color:#C00000;font-weight:bold;font-size:9.5pt}
.doc table{border-collapse:collapse;width:100%}
.doc .hd td{padding:2pt 4pt;font-size:9.5pt;vertical-align:top;width:50%}
.doc .res{background:#E9EDF4;text-align:center;font-weight:bold;padding:5pt;margin:6pt 0;font-size:10pt}
.doc .det th{background:#1F3864;color:#fff;font-size:8pt;text-transform:uppercase;padding:3pt;text-align:left}
.doc .det td{border-bottom:0.5pt solid #ccc;padding:2.5pt 3pt;font-size:8.5pt;vertical-align:top}
.doc .det td.n,.doc .det th.n{text-align:right}
.doc .det thead{display:table-header-group}
.doc .det tr{page-break-inside:avoid}
.doc .mono{font-family:'Courier New',monospace;font-size:8.5pt;white-space:nowrap}
.doc .fo td{vertical-align:top;padding:0}
.doc .foto{width:100%;height:150pt;object-fit:cover;border:0.5pt solid #999;display:block}
.doc .nofoto{height:150pt;border:0.5pt dashed #999;color:#777;text-align:center;font-size:9pt;padding-top:65pt}
.doc .obs{border:0.5pt solid #999;padding:6pt;height:150pt;font-size:9pt}
.doc .f3{margin-top:28pt}.doc .f3 td{text-align:center;font-size:8.5pt;padding:0 8pt;vertical-align:top}
.doc .f3 .ln{border-top:0.5pt solid #333;padding-top:2pt}
.doc .box{background:#EEF0F4;text-align:center;font-weight:bold;padding:6pt;margin:4pt 0 10pt;font-size:10pt}
.doc .para{border:1.2pt solid #C00000;color:#C00000;font-weight:bold;text-align:center;padding:4pt;margin:0 0 8pt;font-size:9.5pt}
.doc ol.p{margin:0 0 10pt;padding-left:16pt}.doc ol.p li{margin-bottom:4pt;text-align:justify;font-size:9.5pt}
.doc .fir{margin-top:6pt}.doc .fir td.c{padding:3pt;vertical-align:top}
.doc .fir table.s{border:0.8pt solid #1F3864}
.doc .fir table.s th{background:#1F3864;color:#fff;font-size:8pt;padding:3pt;text-transform:uppercase}
.doc .fir table.s td{border-top:0.5pt solid #aaa;font-size:8pt;padding:3pt;height:14pt}
.doc .fir table.s td.f{height:30pt}
.doc .grp{font-size:8.5pt;font-weight:bold;color:#1F3864;text-transform:uppercase;letter-spacing:.06em;margin:8pt 0 2pt;border-bottom:1.2pt solid #1F3864;padding-bottom:1pt}
.doc .fir table.s{page-break-inside:avoid}
.doc .pie{margin-top:14pt;font-size:7.5pt;color:#666;font-style:italic}
.doc .wm{position:absolute;top:38%;left:0;right:0;text-align:center;font-size:58pt;font-weight:bold;color:rgba(200,0,0,.10);transform:rotate(-28deg);pointer-events:none;letter-spacing:6pt}
.doc .portada{border:2pt solid #1F3864;padding:30pt;margin-top:60pt;text-align:center}
.doc .portada .j{font-size:12pt;color:#C00000;font-weight:bold;letter-spacing:2pt}
.doc .portada .d{font-size:22pt;font-weight:bold;color:#1F3864;margin:14pt 0}
.doc .portada td{text-align:left;padding:3pt 6pt;font-size:10.5pt}
.doc .tot td{font-weight:bold;background:#E9EDF4}
.doc h3{font-size:10pt;color:#1F3864;margin:10pt 0 4pt}
.lbls{font-family:Arial,Helvetica,sans-serif}
.lbls table{border-collapse:separate;border-spacing:4pt;width:100%;table-layout:fixed}
.lbls td{border:0.6pt dashed #999;padding:4pt;text-align:center;height:62pt;vertical-align:middle;overflow:hidden;page-break-inside:avoid}
.lbls .i{font-size:6.5pt;color:#444;text-transform:uppercase}
.lbls .c{font-family:'Courier New',monospace;font-weight:bold;font-size:11pt}
.lbls .d{font-size:6.5pt;color:#333;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lbls svg{width:100%;height:22pt}
`;
const T = k => (D.textos && D.textos[k] != null) ? D.textos[k] : '';
function fillT(t, c) { return String(t || '').replace(/\{([A-Z_]+)\}/g, (m, k) => c[k] != null ? c[k] : m); }
const boldPunto = t => { const i = t.indexOf(':'); return i > 0 && i < 90 ? `<b>${esc(t.slice(0, i + 1))}</b>${esc(t.slice(i + 1))}` : esc(t); };
function nombreUbic(u) { const l = X.loc[norm(u)] || {}; let n = (String(u).length <= 4 && l.t ? l.t + ' ' : '') + u; if (l.z) n += ', ' + l.z; return n.toUpperCase(); }
function fechaConteo(f) { const a = f.head.fechaMin, b = f.head.fechaMax; if (!a) return ''; return a === b ? dmy(a) : dmy(a) + ' al ' + dmy(b); }
const shortName = n => String(n || '').replace(/^((PROFA?|LICDA?|ING|SRA?|DRA?|MSC|LIC)\.?\s+)+/i, '').split(/\s+/).slice(0, 2).join(' ');
function respOf(u) { return X.resp[norm(u)] || []; }
function firmaTitulo(p) { return p.rol === 'Corresponsable' ? T('FIRMA_CO') : p.rol === 'Testigo' ? T('FIRMA_T') : p.rol === 'Otro' ? (p.cargo || 'FIRMA').toUpperCase() : T('FIRMA_1'); }
function ctxUbic(u, f, extra) {
  const rs = respOf(u).filter(p => p.rol === 'Responsable' || p.rol === 'Corresponsable'), names = rs.map(p => p.n);
  const lista = names.length <= 1 ? (names[0] || '______________________') : names.slice(0, -1).join(', ') + ' y ' + names[names.length - 1];
  return Object.assign({ UBICACION: u, NOMBRE_UBIC: nombreUbic(u), TIPO: (X.loc[norm(u)] || {}).t || '', EDIFICIO: (X.loc[norm(u)] || {}).z || '', FECHA_CONTEO: fechaConteo(f),
    TOTAL_BIENES: f.resumen.total, INSTITUCION: BASE.cfg.nombre || '', PERIODO: BASE.cfg.periodo || '', RESPONSABLE: names[0] || '', CORRESPONSABLE: names[1] || '',
    RESPONSABLES: lista, N_RESP: names.length, ES_SON: names.length > 1 ? 'son' : 'es', ENCARGADO: BASE.cfg.encargado || '', DIRECTOR: BASE.cfg.director || '', HOY: today() }, extra || {});
}
/* ---------- ficha ---------- */
function fichaHTML(u, o) {
  const f = R.ficha(u), l = X.loc[norm(u)] || {}, c = ctxUbic(u, f, o.ctx), rs = respOf(u);
  const conts = [...new Set(f.filas.map(r => r.U).filter(Boolean))];
  const est = l.cerrada ? 'CERRADA' + (l.rev && l.rev.res && l.rev.res.tipo === 'cerrada' ? ` (revisada por ${l.rev.res.por} el ${dt(l.rev.res.t).slice(0, 10)})` : '') : 'NO CERRADA';
  let det;
  if (o.det === 'codigo') {
    const cs = X.codU[norm(u)] || [];
    det = `<h3>DETALLE CÓDIGO POR CÓDIGO (${cs.length})</h3><table class="det"><thead><tr><th>#</th><th>Código</th><th>Descripción</th><th>Estado</th><th>Origen</th><th>Marca / serie</th></tr></thead><tbody>${cs.map((x, i) => `<tr><td>${i + 1}</td><td class="mono">${esc(x.B)}</td><td>${esc(x.C.replace(/^🔒 /, ''))}</td><td>${esc(x.F)}</td><td>${x.R === 'NUEVO' ? 'Nuevo' : esc(x.R)}</td><td>${esc(x.H)}</td></tr>`).join('')}</tbody></table>`;
  } else {
    det = `<h3>${esc(fillT(T('DETALLE'), c))}</h3><table class="det"><thead><tr><th>#</th><th>Bloque</th><th>Descripción</th><th class="n">B</th><th class="n">R</th><th class="n">M</th><th class="n">Total</th><th>Código desde</th><th>Código hasta</th><th class="n">Inv. ant.</th></tr></thead><tbody>
      ${f.det.map(d => { const rr = d.rows.filter(r => r.M); return `<tr><td>${d.A}</td><td>${esc(d.B)}</td><td>${esc(d.C)}</td><td class="n">${d.D}</td><td class="n">${d.E}</td><td class="n">${d.F}</td><td class="n"><b>${d.G}</b></td><td class="mono">${rr.map(r => esc(r.M)).join('<br>')}</td><td class="mono">${rr.map(r => esc(r.N)).join('<br>')}</td><td class="n">${d.J}</td></tr>`; }).join('')}
      <tr class="tot"><td colspan="3">TOTAL</td><td class="n">${f.resumen.bueno}</td><td class="n">${f.resumen.regular}</td><td class="n">${f.resumen.malo}</td><td class="n">${f.resumen.total}</td><td colspan="2"></td><td class="n">${f.resumen.invAnterior}</td></tr></tbody></table>`;
  }
  const foto = o.foto ? `<img class="foto" src="${o.foto.src}" alt=""><div style="font-size:7pt;color:#666">FOTO GENERAL · ${esc(o.foto.n)}</div>` : `<div class="nofoto">Sin foto general de la ubicación</div>`;
  return `<section class="doc">${o.wm ? `<div class="wm">${o.wm}</div>` : ''}<div class="etq">${esc(o.etq)}</div><h1>${esc(BASE.cfg.nombre || '')}</h1><div class="sub">FICHA DE CONTEO FÍSICO POR UBICACIÓN — ${esc(BASE.cfg.periodo || '')}</div>
    <table class="hd"><tr><td><b>Ubicación:</b> ${esc(c.NOMBRE_UBIC)}</td><td><b>Fecha del conteo:</b> ${esc(c.FECHA_CONTEO)}</td></tr>
    <tr><td><b>Responsable(s):</b> ${esc(rs.map(p => p.n).join(' · ') || '—')}</td><td><b>Estado:</b> ${esc(est)}</td></tr>
    <tr><td><b>Contado por:</b> ${esc(conts.join(', '))}</td><td><b>Folio:</b> ${esc(o.folio || '')}</td></tr></table>
    <div class="res">BUENO ${f.resumen.bueno} · REGULAR ${f.resumen.regular} · MALO ${f.resumen.malo} · TOTAL ${f.resumen.total} · ${f.resumen.tipos} tipos de bien · Inv. anterior ${f.resumen.invAnterior}</div>
    ${det}
    <table class="fo" style="margin-top:10pt;page-break-inside:avoid"><tr><td style="width:58%;padding-right:8pt">${foto}</td><td><div class="obs"><b>OBSERVACIONES GENERALES</b><br>${esc(fillT(T('NOTA_FICHA'), c))}</div></td></tr></table>
    <table class="f3" style="page-break-inside:avoid"><tr><td><div class="ln">Contado por</div></td><td><div class="ln">Responsable(s) de la ubicación</div></td><td><div class="ln">Encargado de inventario / Dirección</div></td></tr></table>
  </section>`;
}
/* ---------- lista código por código (anexo) ---------- */
function listaHTML(u, o) {
  const cs = X.codU[norm(u)] || [];
  return `<section class="doc">${o.wm ? `<div class="wm">${o.wm}</div>` : ''}<div class="etq">${esc(o.etq)}</div><h1>LISTA DE CÓDIGOS · ${esc(nombreUbic(u))}</h1><div class="sub">${esc(BASE.cfg.nombre || '')} — ${esc(BASE.cfg.periodo || '')} · Folio ${esc(o.folio || '')}</div>
    <table class="det"><thead><tr><th>#</th><th>Código</th><th>Descripción</th><th>Estado</th><th>Marca / modelo / serie</th><th>Origen</th><th>✓</th></tr></thead><tbody>${cs.map((x, i) => `<tr><td>${i + 1}</td><td class="mono">${esc(x.B)}</td><td>${esc(x.C.replace(/^🔒 /, ''))}</td><td>${esc(x.F)}</td><td>${esc(x.H)}</td><td>${x.R === 'NUEVO' ? 'Nuevo' : esc(x.R)}</td><td>☐</td></tr>`).join('') || '<tr><td colspan="7">Sin códigos asignados.</td></tr>'}</tbody></table></section>`;
}
/* ---------- acta ---------- */
/* ---------- acta (formato A: recuadros agrupados, N firmas) ---------- */
function personaDe(p) { return (p && p.pid && X.per[p.pid]) || null; }
function personaPorNombre(n) { const k = norm(n); return k ? (D.personas || []).find(p => norm(p.n) === k && p.estado !== 'Baja') || null : null; }
function cajaFirma(titulo, nombre, per, rotFirma) {
  const dui = per && per.dui ? per.dui : '', nip = per && per.nip ? per.nip : '';
  return `<table class="s"><tr><th>${esc(titulo)}</th></tr><tr><td>Nombre: ${esc(nombre)}</td></tr><tr><td>DUI: ${dui ? esc(dui) : '__________'} &nbsp;·&nbsp; NIP: ${nip ? esc(nip) : '________'}</td></tr><tr><td class="f">${esc(rotFirma || 'Firma:')}</td></tr><tr><td>Fecha:</td></tr></table>`;
}
function gridFirmas(cajas, k) {
  const rows = []; for (let i = 0; i < cajas.length; i += k) rows.push(cajas.slice(i, i + k));
  return `<table class="fir">${rows.map(r => `<tr>${r.map(c => `<td class="c" style="width:${100 / k}%">${c}</td>`).join('')}${'<td class="c"></td>'.repeat(k - r.length)}</tr>`).join('')}</table>`;
}
function actaHTML(u, o) {
  const f = R.ficha(u), c = ctxUbic(u, f, o.ctx), rs = respOf(u);
  const nResp = rs.filter(p => p.rol === 'Responsable' || p.rol === 'Corresponsable').length;
  const pts = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'].concat(nResp >= 2 ? ['P7'] : []).map(k => fillT(T(k), c)).filter(t => t.trim());
  const k = Math.max(2, Math.min(3, o.firmas || 3));
  const reciben = rs.filter(p => p.rol !== 'Testigo').map(p => cajaFirma(firmaTitulo(p), p.n, personaDe(p)));
  if (!reciben.length) reciben.push(cajaFirma(T('FIRMA_1'), '', null));
  const otros = rs.filter(p => p.rol === 'Testigo').map(p => cajaFirma(firmaTitulo(p), p.n, personaDe(p)))
    .concat([cajaFirma(T('FIRMA_2'), BASE.cfg.encargado || '', personaPorNombre(BASE.cfg.encargado)), cajaFirma(T('FIRMA_3'), BASE.cfg.director || '', personaPorNombre(BASE.cfg.director), 'Firma y sello:')]);
  const hayT = rs.some(p => p.rol === 'Testigo');
  return `<section class="doc">${o.wm ? `<div class="wm">${o.wm}</div>` : ''}<div class="etq">${esc(o.etq)}</div><h1>${esc(fillT(T('TITULO'), c))}</h1><div class="sub">${esc(c.INSTITUCION)} - ${esc(c.PERIODO)}${o.folio ? ' · Folio ' + esc(o.folio) : ''}</div>
    <div class="box">Ubicación: ${esc(c.NOMBRE_UBIC)}<br>Fecha del conteo: ${esc(c.FECHA_CONTEO)} · Total de bienes: ${c.TOTAL_BIENES}</div>
    ${o.para ? `<div class="para">${esc(o.para)}</div>` : ''}
    <ol class="p">${pts.map(t => `<li>${boldPunto(t)}</li>`).join('')}</ol>
    <div class="grp">Reciben y quedan responsables</div>${gridFirmas(reciben, k)}
    <div class="grp">${hayT ? 'Testigo · ' : ''}Entrega · Visto bueno</div>${gridFirmas(otros, k)}
    <div class="pie">${esc(fillT(T('PIE'), c))}</div></section>`;
}
function portadaHTML(u, o) {
  return `<section class="doc"><div class="portada"><div class="j">${esc(o.juegoTxt)}</div><div class="d">${esc(o.dest)}</div>
    <table style="width:auto;margin:0 auto"><tr><td><b>Ubicación</b></td><td>${esc(nombreUbic(u))}</td></tr><tr><td><b>Folio</b></td><td>${esc(o.folio || '')}</td></tr><tr><td><b>Contenido</b></td><td>${esc(o.cont)}</td></tr><tr><td><b>Fecha</b></td><td>${today()}</td></tr></table>
    <p style="margin-top:20pt;font-size:10pt">Entregar en mano. Devolver firmada el acta ${o.orig ? 'ORIGINAL al archivo de inventario' : 'según se indique'}.</p></div></section>`;
}

/* ===================== PAQUETE DE IMPRESIÓN (fichas y actas) ===================== */
function juegosDe(u) {
  const A = UI.actas, rs = respOf(u).filter(p => p.copias > 0), out = [];
  if (A.oO.ficha || A.oO.acta || A.oO.lista) for (let i = 0; i < (Number(A.oO.copias) || 0); i++) out.push({ tipo: 'Original', dest: 'ARCHIVO DE INVENTARIO', rol: 'Archivo', o: A.oO });
  if (A.oR.ficha || A.oR.acta || A.oR.lista) rs.forEach(p => { for (let i = 0; i < p.copias; i++) out.push({ tipo: 'Copia', dest: p.n, rol: p.rol, o: A.oR }); });
  A.otros.filter(x => x.trim()).forEach(n => out.push({ tipo: 'Copia', dest: n.trim().toUpperCase(), rol: 'Otro destinatario', o: A.oR }));
  return out;
}
function hojasDe(u, j) {
  const f = R.ficha(u), nc = (X.codU[norm(u)] || []).length, nd = UI.actas.det === 'codigo' ? nc : f.det.length, nf = respOf(u).length + 2;
  let h = 0; if (j.o.ficha) h += nd <= 20 ? 1 : 1 + Math.ceil((nd - 20) / 40); if (j.o.acta) h += 1 + (nf > 9 ? 1 : 0); if (j.o.lista) h += Math.max(1, Math.ceil(nc / 42)); if (UI.actas.portada) h += 1; return h;
}
function resumenPaquete(us) { const pk = us.map(u => { const js = juegosDe(u); return { u, js, h: js.reduce((a, j) => a + hojasDe(u, j), 0) }; }); return { pk, hojas: pk.reduce((a, p) => a + p.h, 0), juegos: pk.reduce((a, p) => a + p.js.length, 0) }; }
const FOTO = {};
async function fotoGeneral(u) {
  const l = X.loc[norm(u)]; if (!l || !(l.fotos || []).length) return null;
  const w = norm(T('PALABRA_FOTO') || 'GENERAL'), fs = l.fotos.slice(), f = fs.reverse().find(x => norm(x.n).includes(w)) || fs[0];
  if (FOTO[f.id] === undefined) { try { FOTO[f.id] = await api('api_g_foto', f.id); } catch (e) { FOTO[f.id] = null; } }
  return FOTO[f.id] ? { src: FOTO[f.id], n: f.n } : null;
}
async function buildPaquete(us, folios) {
  const A = UI.actas, out = [];
  for (const u of us) {
    const js = juegosDe(u), l = X.loc[norm(u)], wm = l && l.cerrada ? '' : 'BORRADOR', folio = folios ? folios[u] : '(vista previa)';
    const foto = await fotoGeneral(u);
    js.forEach((j, i) => {
      const orig = j.tipo === 'Original', etq = orig ? T('ETQ_ORIGINAL') : fillT(T('ETQ_COPIA'), { DESTINATARIO: j.dest, ROL: j.rol });
      const o = { etq, wm, folio, foto, det: A.det, firmas: A.firmas, ctx: { FOLIO: folio, DESTINATARIO: j.dest } };
      if (A.portada) out.push(portadaHTML(u, { juegoTxt: `JUEGO ${i + 1} DE ${js.length} · ${orig ? 'ORIGINAL' : 'COPIA'}`, dest: j.dest, folio, orig, cont: [j.o.ficha && 'Ficha', j.o.acta && (orig ? 'Acta original' : 'Acta copia'), j.o.lista && 'Lista de códigos'].filter(Boolean).join(' + ') }));
      if (j.o.ficha) out.push(fichaHTML(u, o));
      if (j.o.acta) out.push(actaHTML(u, Object.assign({}, o, { para: orig ? '' : `Ejemplar para: ${j.dest} · ${j.rol} · Juego ${i + 1} de ${js.length}` })));
      if (j.o.lista) out.push(listaHTML(u, o));
    });
  }
  return out.join('');
}
function pageCss(papel) { papel = papel || UI.actas.papel; const p = papel === 'Oficio' ? '8.5in 13in' : papel === 'A4' ? 'A4' : 'letter'; return `@page{size:${p};margin:12mm}`; }
function printHTML(html, papel) {
  $('#pageStyle').textContent = pageCss(papel);
  $('#print').innerHTML = `<style>${DOC_CSS}</style>` + html;
  setTimeout(() => { window.print(); }, 350);
}
function fullDoc(html, papel) { return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${pageCss(papel)}${DOC_CSS}</style></head><body>${html}</body></html>`; }
async function registrarJuegos(us) {
  const entries = [];
  us.forEach(u => juegosDe(u).forEach(j => entries.push({ u, juego: j.tipo, dest: j.dest, rol: j.rol, copias: 1 })));
  const r = await api('api_g_actasGen', entries); D.actas = r.actas; return r.folios;
}
function previewModal(html, actBtn) {
  modal(`<h2>Vista previa</h2><p class="hint" style="margin:0">Así saldrá cada hoja. El folio real se asigna al registrar.</p><div style="max-height:70vh;overflow:auto;background:#5B6578;padding:14px;border-radius:10px"><div class="pv" style="background:#fff;max-width:816px;margin:0 auto;padding:30px"><style>${DOC_CSS}.pv .doc{border-bottom:6px solid #5B6578;padding-bottom:30px;margin-bottom:30px}</style>${html}</div></div><div class="acts"><button class="btn" data-close type="button">Cerrar</button>${actBtn || ''}</div>`);
}
async function imprimirJuegos(us, b, modo) {
  const t = b.textContent; b.disabled = true; b.textContent = modo === 'prev' ? 'Armando…' : modo === 'pdf' ? 'Generando PDF…' : 'Registrando…';
  try {
    if (modo === 'prev') { previewModal(await buildPaquete(us, null), `<button class="btn pri" data-act="pkPrint" data-us="${esc(JSON.stringify(us))}" type="button">🖨 Registrar e imprimir</button>`); return; }
    const folios = await registrarJuegos(us), html = await buildPaquete(us, folios);
    if (modo === 'pdf') {
      const r = await api('api_g_pdf', fullDoc(html), (us.length === 1 ? us[0] : us.length + ' ubicaciones') + '_FICHA_Y_ACTA_' + Object.values(folios)[0], Object.values(folios));
      D.actas = r.actas; derive(); render();
      modal(`<h2>PDF guardado en Drive</h2><p><b>${esc(r.name)}</b></p><div class="row"><a class="btn pri" href="${esc(r.url)}" target="_blank" rel="noopener">Abrir el PDF</a><a class="btn" href="${esc(r.folder)}" target="_blank" rel="noopener">Abrir la carpeta “Actas PDF”</a></div><p class="hint">Si el diseño del PDF de Drive no le convence, use “Imprimir” y elija “Guardar como PDF”.</p><div class="acts"><button class="btn" data-close type="button">Cerrar</button></div>`);
    } else { closeModal(); derive(); render(); printHTML(html); toast('Juegos registrados: ' + Object.values(folios).join(', ')); }
  } catch (e) { toast(errMsg(e), true); } finally { b.disabled = false; b.textContent = t; }
}
ACT.pkPrint = b => imprimirJuegos(JSON.parse(b.dataset.us), b, 'print');

/* ---------- etiquetas para pegar ---------- */
async function printLabels(L) {
  if (!L.length) return;
  let bc = false; try { await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jsbarcode/3.11.6/JsBarcode.all.min.js'); bc = !!window.JsBarcode; } catch (e) {}
  const cell = c => { let svg = ''; if (bc) { try { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); JsBarcode(s, c.B, { format: 'CODE128', displayValue: false, height: 34, margin: 0, width: 1.3 }); s.setAttribute('preserveAspectRatio', 'none'); svg = s.outerHTML; } catch (e) {} }
    return `<td><div class="i">${esc(BASE.cfg.nombre || '')}</div>${svg}<div class="c">${esc(c.B)}</div><div class="d">${esc(c.C.replace(/^🔒 /, ''))} · ${esc(c.E)}</div></td>`; };
  const rows = []; for (let i = 0; i < L.length; i += 3) rows.push('<tr>' + L.slice(i, i + 3).map(cell).join('') + '<td style="border:0"></td>'.repeat(3 - Math.min(3, L.length - i)) + '</tr>');
  printHTML(`<div class="lbls"><table>${rows.join('')}</table></div>`);
}
