/* ===================== FICHA DEL BIEN (panel · tarjeta · fila) ===================== */
// Las capas flotantes (ficha, bloc, buscador) viven fuera de #main: comparten un mismo manejador de clics.
document.addEventListener('click', e => {
  const b = e.target.closest('.ovl [data-act]'); if (!b || b.disabled) return;
  const f = ACT[b.dataset.act]; if (f) { e.preventDefault(); e.stopPropagation(); f(b, e); }
});
document.addEventListener('change', e => { const el = e.target.closest('.ovl [data-ch]'); if (el && INP[el.dataset.ch]) INP[el.dataset.ch](el, e); });
document.addEventListener('input', e => { const el = e.target.closest('.ovl [data-in]'); if (el && INP[el.dataset.in]) INP[el.dataset.in](el, e); });

const FX = { mode: LS.get('fmode', 'panel'), list: [], idx: -1, anchor: null };
const FMODES = [['panel', '▥ Panel'], ['tarjeta', '◳ Tarjeta'], ['fila', '▾ Fila']];
/** key = 'c:<índice en R.cod>' o 'i:<código del inventario anterior>' */
function fkeyCod(i) { return 'c:' + i; }
function fkeyInv(code) { return 'i:' + code; }
function fichaData(key) {
  const out = { key };
  if (key.startsWith('c:')) {
    const c = R.cod[+key.slice(2)]; if (!c) return null;
    const r = c.row, g = X.reg[r.id] || {}, o = c.inv != null && c.inv >= 0 ? R.inv[c.inv] : (X.invBy[U(c.B)] != null ? R.inv[X.invBy[U(c.B)]] : null);
    Object.assign(out, { c, r, g, o, code: c.B, desc: c.C.replace(/^🔒 /, ''), blk: c.D, ubic: c.E, estado: c.F, origen: c.R,
      marca: [g.marca, g.modelo].filter(Boolean).join(' ') || (o ? [o.marca, o.modelo].filter(Boolean).join(' ') : ''), serie: g.serie || (o ? o.serie : ''),
      fecha: o ? o.fecha : (c.AB || ''), valor: o ? o.valor : (c.AC || ''), etqVieja: c.X, etqOk: c.Z, contado: dmy(r.fecha) + ' · ' + (r.U || ''), fotos: g.fotos || [] });
  } else {
    const code = key.slice(2), ii = X.invBy[U(code)], o = ii == null ? null : R.inv[ii]; if (!o) return null;
    const ci = X.codBy[U(o.code)], c = ci == null ? null : R.cod[ci];
    if (c) return fichaData(fkeyCod(ci));
    Object.assign(out, { o, code: o.code, desc: o.desc, blk: o.blk, ubic: o.M, estado: o.calidad, origen: o.R === 'Sin asignar' ? 'Descargo' : o.R, marca: [o.marca, o.modelo].filter(Boolean).join(' '), serie: o.serie,
      fecha: o.fecha, valor: o.valor, fotos: [], inv: true });
  }
  out.resp = respOf(out.ubic);
  out.rubro = (R.cat.find(x => x.A === out.blk) || {}).C || '';
  return out;
}
function fichaWhy(f) {
  if (f.inv) {
    const o = f.o;
    if (o.R === 'Sin asignar') return '⬇ No se encontró en el conteo: ' + (o.V || 'pasa a descargo') + '.';
    return o.R === 'Reasignado' ? '↺ Su código se recicla para otro bien contado del mismo bloque.' : '🔒 Conservado.';
  }
  const w = explain(f.r, R.cod.filter(x => x.row === f.r));
  const tag = f.origen === 'Conservado' ? '🔒 ' : f.origen === 'Reciclado' ? '↺ ' : '✚ ';
  return tag + w.map(x => x.replace(/<[^>]+>/g, '')).join(' ');
}
function fichaHist(f) {
  const h = [], o = f.o, l = X.loc[norm(f.ubic)];
  if (o && o.fecha) h.push({ t: o.fecha, h: `<b>Alta en SIGES</b> · ${esc(dmy(o.fecha))} · ${money(o.valor)}`, s: `Asignado a ${esc(o.asig || o.M)} · calidad ${esc(o.calidad || '—')}` });
  if (f.r) h.push({ t: f.r.fecha, h: `<b>Contado</b> · ${esc(dmy(f.r.fecha))} · ${esc(f.r.C)}`, s: `${esc(f.r.U)}${f.r.E ? ' · etiqueta leída: ' + esc(f.r.E) : ''} · ${(f.fotos || []).length} foto(s)` });
  if (l && l.cerrada && l.rev && l.rev.res) h.push({ t: new Date(l.rev.res.t).toISOString().slice(0, 10), h: `<b>Ubicación cerrada</b> · ${esc(dt(l.rev.res.t).slice(0, 10))}`, s: `Revisada por ${esc(l.rev.res.por)}` });
  const snap = X.etq[norm(f.ubic)]; if (snap && snap.codes.some(x => x[2] === f.code)) h.push({ t: new Date(snap.t).toISOString().slice(0, 10), h: `<b>Etiquetado</b> · ${esc(dt(snap.t).slice(0, 10))}`, s: esc(snap.por) });
  const ac = (X.actU[norm(f.ubic)] || []).filter(a => a.juego === 'Original').sort((a, b) => b.gen - a.gen)[0];
  if (ac) h.push({ t: new Date(ac.gen).toISOString().slice(0, 10), h: `<b>Acta ${esc(ac.folio)}</b> · ${ac.firm ? 'firmada ' + esc(dt(ac.firm).slice(0, 5)) : ac.ent ? 'entregada ' + esc(dt(ac.ent).slice(0, 5)) : 'impresa ' + esc(dt(ac.gen).slice(0, 5))}`, s: esc(f.resp.map(p => p.n).join(', ')) });
  (X.tras[U(f.code)] || []).forEach(t => h.push({ t: new Date(t.t).toISOString().slice(0, 10), h: `<b>Traslado</b> · ${esc(dt(t.t).slice(0, 10))} · ${esc(t.de)} → ${esc(t.a)}`, s: `${esc(t.motivo)} · autorizó ${esc(t.autorizo)}` }));
  const j = (D.justif || {})[f.code]; if (j && j.t) h.push({ t: new Date(j.f || 0).toISOString().slice(0, 10), h: `<b>Justificación de faltante</b>`, s: `${esc(j.t)} · ${esc(j.por)}` });
  (X.notaVinc[U(f.code)] || []).forEach(n => h.push({ t: new Date(n.creado).toISOString().slice(0, 10), h: `<b>Nota</b> · ${esc(n.por)}`, s: esc(n.texto.slice(0, 160)) }));
  return h.sort((a, b) => a.t < b.t ? -1 : a.t > b.t ? 1 : 0);
}
const ochip = o => o === 'Conservado' ? '<span class="chip ok">🔒 Conservado</span>' : o === 'Reciclado' ? '<span class="chip in">↺ Reciclado</span>' : o === 'NUEVO' ? '<span class="chip new">✚ Nuevo</span>' : o === 'Reasignado' ? '<span class="chip in">↺ Reasignado</span>' : '<span class="chip bad">⬇ Descargo</span>';
function fichaToggle() { return `<span class="tgl" title="Cómo mostrar la ficha">${FMODES.map(([m, t]) => `<button type="button" data-act="fmode" data-m="${m}" class="${FX.mode === m ? 'on' : ''}">${t}</button>`).join('')}</span>`; }
function fichaFotos(f, big) {
  const fs = f.fotos || [];
  if (!fs.length) return `<div class="fph empty">${f.inv ? '📦 Bien del inventario anterior (sin foto del conteo)' : '📷 Sin fotos del conteo'}</div>`;
  return `<div class="fph${big ? ' big' : ''}" data-fotos="${esc(JSON.stringify(fs.map(x => ({ id: x.id, n: x.n, t: x.t }))))}">${fs.slice(0, 1).map(x => `<img data-fid="${esc(x.id)}" alt="${esc(x.n)}">`).join('')}${fs.length > 1 ? `<span class="more">+${fs.length - 1}</span>` : ''}</div>`;
}
function fichaActs(f, compact) {
  const b = (act, t, extra) => `<button class="btn sm" type="button" data-act="${act}" data-key="${esc(f.key)}"${extra || ''}>${t}</button>`;
  return `<div class="row facts">${compact ? `<button class="btn sm pri" type="button" data-act="fopenPanel" data-key="${esc(f.key)}">Ver ficha completa →</button>` : ''}${f.r ? b('fgoReg', '📍 Registro') : ''}${f.c ? b('flabel', '🏷 Etiqueta') : ''}${b('ftras', '↔ Traslado')}${b('fnota', '📝 Nota')}${(f.fotos || []).length && !compact ? b('ffotos', `📷 Fotos (${f.fotos.length})`) : ''}${f.inv && f.o.R === 'Sin asignar' && !compact ? b('fjust', '✎ Justificar faltante') : ''}</div>`;
}
function fichaFull(f) {
  const resp = f.resp.length ? esc(f.resp[0].n) + (f.resp.length > 1 ? ` (+${f.resp.length - 1})` : '') : '—';
  const kv = [['Ubicación', esc(nombreUbic(f.ubic) || f.ubic)], ['Responsable', resp], ['Marca / modelo', esc(f.marca || '—')], ['Serie', f.serie ? `<span class="mono">${esc(f.serie)}</span>` : '—'],
    ['Adquisición', f.fecha ? esc(dmy(f.fecha)) + (f.valor !== '' && f.valor != null ? ' · ' + money(f.valor) : '') : 'Alta nueva (fecha actual)'], ['Estado', esc(f.estado || '—')]];
  if (f.etqVieja) kv.push(['Etiqueta que tenía', `<span class="mono">${esc(f.etqVieja)}</span> ${f.etqOk === 'Correcta' ? '✓ correcta' : '✗ se cambia'}`]);
  if (f.contado) kv.push(['Contado', esc(f.contado)]);
  const just = (D.justif || {})[f.code];
  return `<div class="fx-h"><b class="lbl" style="margin:0">Ficha del bien</b><span style="flex:1"></span>${fichaToggle()}</div>
    ${fichaFotos(f, true)}
    <div class="row" style="gap:8px"><span class="mono fcode">${esc(f.code)}</span>${ochip(f.origen)}${f.estado ? `<span class="chip ${/MALO/i.test(f.estado) ? 'bad' : /REGULAR/i.test(f.estado) ? 'wa' : 'ok'}">${esc(f.estado)}</span>` : ''}</div>
    <div class="fdesc">${esc(f.desc)} <span class="hint">· ${esc(f.blk)}${f.rubro ? ' · ' + esc(f.rubro.toLowerCase()) : ''}</span></div>
    <dl class="fkv">${kv.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
    <div class="why" style="padding:10px 12px">${esc(fichaWhy(f))}</div>
    ${just && just.t ? `<div class="banner in" style="padding:8px 10px">✎ ${esc(just.t)} <span class="hint">· ${esc(just.por)}</span></div>` : ''}
    <b style="font-size:13px">Historial</b><div class="tl">${fichaHist(f).map(x => `<div>${x.h}<small>${x.s}</small></div>`).join('') || '<div class="hint">Sin movimientos.</div>'}</div>
    ${fichaActs(f)}`;
}
function fichaCompact(f) {
  const resp = f.resp.length ? esc(f.resp[0].n) + (f.resp.length > 1 ? ` (+${f.resp.length - 1})` : '') : '—';
  return `<div class="fx-h"><span class="mono fcode" style="font-size:15px">${esc(f.code)}</span><span style="flex:1"></span>${fichaToggle()}<button class="btn sm ghost" data-act="fclose" type="button">✕</button></div>
    <div class="row" style="gap:12px;align-items:flex-start;flex-wrap:nowrap">${fichaFotos(f)}<div style="min-width:0"><b>${esc(f.desc)}${f.marca ? ' · ' + esc(f.marca) : ''}</b><div class="hint">${f.serie ? 'S/N ' + esc(f.serie) + ' · ' : ''}${f.valor !== '' && f.valor != null && f.fecha ? money(f.valor) + ' · ' + esc(dmy(f.fecha)) : ''}</div>
    <div class="row" style="gap:6px;margin-top:6px">${ochip(f.origen)}${f.estado ? `<span class="chip ok">${esc(f.estado)}</span>` : ''}<span class="chip in">${esc(f.ubic)}</span></div></div></div>
    <dl class="fkv"><dt>Responsable</dt><dd>${resp}</dd>${f.contado ? `<dt>Contado</dt><dd>${esc(f.contado)}</dd>` : ''}</dl>
    <div class="why" style="padding:8px 10px">${esc(fichaWhy(f).slice(0, 180))}</div>${fichaActs(f, true)}`;
}
async function cargarFotos(root) {
  for (const img of $$('img[data-fid]', root)) {
    const id = img.dataset.fid;
    if (FOTO[id] === undefined) { try { FOTO[id] = await api('api_g_foto', id); } catch (e) { FOTO[id] = null; } }
    if (FOTO[id]) img.src = FOTO[id]; else img.replaceWith(Object.assign(document.createElement('span'), { className: 'hint', textContent: '📷 ' + (img.alt || 'foto') }));
  }
}
function closeFicha() {
  $('#fpanel').hidden = true; $('#fpop').hidden = true; $$('tr.fx-row').forEach(t => t.remove()); $$('tr.fsel').forEach(t => t.classList.remove('fsel'));
  document.body.classList.remove('with-panel'); FX.idx = -1;
}
/** Abre la ficha. list = claves de la tabla actual (para ← →), el = fila o elemento tocado. */
function openFicha(key, list, el) {
  FX.list = list || [key]; FX.idx = FX.list.indexOf(key); FX.anchor = el || null;
  const f = fichaData(key); if (!f) { toast('No se encontró el bien.', true); return; }
  $('#fpanel').hidden = true; $('#fpop').hidden = true; $$('tr.fx-row').forEach(t => t.remove()); $$('tr.fsel').forEach(t => t.classList.remove('fsel')); document.body.classList.remove('with-panel');
  const tr = el && el.closest && el.closest('tr'); if (tr) tr.classList.add('fsel');
  let mode = FX.mode; if (mode === 'fila' && !tr) mode = 'panel'; if (mode === 'tarjeta' && !el) mode = 'panel';
  if (mode === 'panel') {
    const p = $('#fpanel');
    p.innerHTML = `<div class="row fnav"><button class="btn sm ghost" data-act="fprev" type="button"${FX.idx > 0 ? '' : ' disabled'}>←</button><button class="btn sm ghost" data-act="fnext" type="button"${FX.idx >= 0 && FX.idx < FX.list.length - 1 ? '' : ' disabled'}>→</button><span class="hint">${FX.idx >= 0 ? (FX.idx + 1) + ' de ' + FX.list.length : ''}</span><span style="flex:1"></span><button class="btn sm ghost" data-act="fclose" type="button">✕ Cerrar</button></div>` + fichaFull(f);
    p.hidden = false; p.scrollTop = 0; document.body.classList.add('with-panel'); cargarFotos(p);
  } else if (mode === 'tarjeta') {
    const p = $('#fpop'); p.innerHTML = fichaCompact(f); p.hidden = false;
    const r = (tr || el).getBoundingClientRect(), w = Math.min(500, innerWidth - 24);
    let left = Math.min(innerWidth - w - 12, Math.max(12, r.left + Math.min(r.width * 0.45, 420))), top = r.bottom + 6;
    p.style.width = w + 'px'; p.style.left = left + 'px'; p.style.top = Math.max(8, Math.min(top, innerHeight - 20)) + 'px';
    requestAnimationFrame(() => { const h = p.offsetHeight; if (top + h > innerHeight - 8) p.style.top = Math.max(8, r.top - h - 6) + 'px'; });
    cargarFotos(p);
  } else {
    const n = tr.children.length, row = document.createElement('tr'); row.className = 'fx-row';
    row.innerHTML = `<td colspan="${n}"><div class="fx-inline ovl">${fichaFull(f)}</div></td>`; tr.after(row); cargarFotos(row);
  }
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (!$('#srch').hidden) closeSearch(); else if (!$('#modal').hidden) closeModal(); else closeFicha(); }
  if (!$('#fpanel').hidden && !/INPUT|TEXTAREA|SELECT/.test((e.target.tagName || ''))) { if (e.key === 'ArrowLeft') ACT.fprev(); if (e.key === 'ArrowRight') ACT.fnext(); }
});
document.addEventListener('click', e => { const p = $('#fpop'); if (!p.hidden && !p.contains(e.target) && !e.target.closest('[data-act^="f"]')) p.hidden = true; });
Object.assign(ACT, {
  fcod: b => { const tbl = b.closest('table'), list = tbl ? $$('[data-act="fcod"]', tbl).map(x => fkeyCod(+x.dataset.i)) : null; openFicha(fkeyCod(+b.dataset.i), list, b); },
  finv: b => { const tbl = b.closest('table'), list = tbl ? $$('[data-act="finv"]', tbl).map(x => fkeyInv(x.dataset.code)) : null; openFicha(fkeyInv(b.dataset.code), list, b); },
  fclose: () => closeFicha(),
  fprev: () => { if (FX.idx > 0) { FX.idx--; openFicha(FX.list[FX.idx], FX.list, null); } },
  fnext: () => { if (FX.idx >= 0 && FX.idx < FX.list.length - 1) { FX.idx++; openFicha(FX.list[FX.idx], FX.list, null); } },
  fmode: b => { FX.mode = b.dataset.m; LS.set('fmode', FX.mode); const cur = FX.list[FX.idx]; if (cur) { const anc = FX.anchor && document.contains(FX.anchor) ? FX.anchor : $('tr.fsel'); openFicha(cur, FX.list, anc || null); } toast('La ficha se mostrará como ' + ({ panel: 'panel lateral', tarjeta: 'tarjeta flotante', fila: 'fila desplegable' })[FX.mode]); },
  fopenPanel: b => { const m = FX.mode; FX.mode = 'panel'; openFicha(b.dataset.key, FX.list, null); FX.mode = m; },
  fgoReg: b => { const f = fichaData(b.dataset.key); closeFicha(); UI.conteo.u = f.r.C; UI.conteo.sel = f.r.ROW; go('conteo'); },
  flabel: b => { const f = fichaData(b.dataset.key); printLabels([f.c]); },
  ffotos: async b => { const f = fichaData(b.dataset.key); modal(`<h2>Fotos · ${esc(f.code)}</h2><div class="gal">${f.fotos.map(x => `<figure><img data-fid="${esc(x.id)}" alt="${esc(x.n)}"><figcaption>${esc(x.t || 'Bien')} · ${esc(x.n)}${x.p ? ' · ' + esc(x.p) : ''}</figcaption></figure>`).join('')}</div><div class="acts"><button class="btn" data-close type="button">Cerrar</button></div>`); cargarFotos($('#modalBox')); },
  ftras: b => trasladoModal(fichaData(b.dataset.key)),
  fnota: b => { const f = fichaData(b.dataset.key); openBloc('notas', { vinc: f.code, texto: f.code + ' · ' + f.desc + ': ' }); },
  fjust: b => justifModal(b.dataset.key.slice(2))
});
function trasladoModal(f) {
  const ubs = D.locs.map(l => l.n);
  modal(`<h2>Registrar traslado · <span class="mono">${esc(f.code)}</span></h2><p class="hint" style="margin:0">${esc(f.desc)}. El traslado queda en el historial del bien y de ambas ubicaciones; no cambia el conteo ni los códigos.</p>
    <datalist id="dlUb2">${ubs.map(u => `<option value="${esc(u)}">`).join('')}</datalist>
    <div class="grid g2"><div class="field"><span class="lbl">De</span><input type="text" id="trDe" value="${esc(f.ubic)}" list="dlUb2"></div><div class="field"><span class="lbl">A (destino)</span><input type="text" id="trA" list="dlUb2" placeholder="Ubicación, persona o taller"></div>
    <div class="field"><span class="lbl">Fecha</span><input type="date" id="trF" value="${new Date().toISOString().slice(0, 10)}"></div><div class="field"><span class="lbl">Autorizó</span><input type="text" id="trAu" value="${esc(BASE.cfg.director || '')}"></div></div>
    <div class="field"><span class="lbl">Motivo</span><input type="text" id="trM" placeholder="Préstamo para evento, reparación, reasignación…"></div><div class="field"><span class="lbl">Nota</span><input type="text" id="trN"></div>
    <div class="acts"><button class="btn" data-close type="button">Cancelar</button><button class="btn pri" data-act="trSave" data-code="${esc(f.code)}" data-bien="${esc(f.desc)}" type="button">Guardar traslado</button></div>`);
}
ACT.trSave = async b => {
  b.disabled = true;
  try { const r = await api('api_g_traslado', { code: b.dataset.code, bien: b.dataset.bien, de: $('#trDe').value, a: $('#trA').value, fecha: $('#trF').value, autorizo: $('#trAu').value, motivo: $('#trM').value, nota: $('#trN').value });
    D.traslados = r.traslados; derive(); closeModal(); toast('Traslado registrado'); if (!$('#fpanel').hidden) openFicha(FX.list[FX.idx], FX.list, null); }
  catch (e) { toast(errMsg(e), true); b.disabled = false; }
};
function justifModal(code) {
  const j = (D.justif || {})[code] || {}, o = R.inv[X.invBy[U(code)]] || {};
  modal(`<h2>Justificar faltante · <span class="mono">${esc(code)}</span></h2><p class="hint" style="margin:0">${esc(o.desc || '')} · ${esc(o.M || '')} · ${esc(dmy(o.fecha || ''))} · ${money(o.valor || 0)}. La justificación sale en el reporte de descargos.</p>
    <textarea id="jTxt" rows="4" placeholder="Ej.: dado de baja en 2021 por daño (acta 12/2021); trasladado a otra sede…">${esc(j.t || '')}</textarea>
    <div class="acts"><button class="btn" data-close type="button">Cancelar</button><button class="btn pri" data-act="jSave" data-code="${esc(code)}" type="button">Guardar</button></div>`);
}
ACT.jSave = async b => { b.disabled = true; try { const r = await api('api_g_justif', b.dataset.code, $('#jTxt').value); D.justif = r.justif; closeModal(); toast('Justificación guardada'); if (MOD === 'ubic') render(); } catch (e) { toast(errMsg(e), true); b.disabled = false; } };
