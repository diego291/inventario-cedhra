/* ===================== CORRECCIÓN SIGES (v9.2) =====================
 * Bienes que YA existen en SIGES (Conservados y Reciclados) → Excel para el script local
 * (Playwright) que corrige "Asignado a" y, en los reciclados, Descripción, Calidad, Marca,
 * Modelo y Serie. Nunca toca datos financieros ni Tipo de Bien.
 * El resultado del script se carga de vuelta y queda guardado en la hoja del cargo
 * (tipo 'bien', clave 'i:sc:<código>').
 */
const SC_ST = { EXITOSO: ['ok', '✔ Corregido'], REVISAR: ['wa', '⚠ Revisar'], FALLIDO: ['bad', '✕ Fallido'], 'NO ENCONTRADO': ['bad', '? No encontrado'], 'SIN CAMBIO': ['ok', '= Sin cambio'] };
const SC_HEAD = ['Codigo', 'Tipo', 'Ubicacion', 'Asignado_actual', 'Asignado_nuevo', 'Desc_actual', 'Desc_nueva', 'Calidad_nueva', 'Marca_nueva', 'Modelo_nueva', 'Serie_nueva', 'ID_SIGES', 'Asignado_anterior', 'Estado', 'Detalle', 'Fecha_hora'];
UI.scorr = UI.scorr || { t: '', st: 'pend', q: '', lim: 300 };
TITLES.scorr = ['Corrección SIGES', 'Bienes que ya existen en SIGES: ubicación (“Asignado a”) y, en los reciclados, datos descriptivos'];

const scMark = code => (cgD().bien['i:sc:' + code] || {}).sc || null;
/** Lista de bienes a corregir, uno por código. Se recalcula cuando cambia el motor. */
function scAll() {
  if (scAll.R === R && scAll.D === D.cargo) return scAll.v;
  const regs = new Map((D.regs || []).map(r => [String(r.id), r])), cfg = cgCfg(), out = [], seen = new Set();
  R.cod.forEach(c => {
    if ((c.R !== 'Conservado' && c.R !== 'Reciclado') || c.inv == null || c.inv < 0 || !R.inv[c.inv]) return;
    const code = String(c.B); if (seen.has(U(code))) return; seen.add(U(code));
    const o = R.inv[c.inv], rec = c.R === 'Reciclado', rid = c.row.id != null && c.row.id !== '' ? String(c.row.id) : 'x' + c.row.ROW;
    const reg = regs.get(rid) || {}, ld = cgD().lote['r:' + rid] || {};
    const asig = cfg.asig === 'dui' ? cgDui(c.E) : c.E;
    let cal = norm(c.F); if (cal === 'REGULAR' && cfg.regular) cal = cfg.regular;
    const x = { code, tipo: rec ? 'Reasignado' : 'Conservado', ubic: c.E, asigAct: String(o.asig || ''), asig: String(asig || ''), descAct: String(o.desc || '') };
    if (rec) Object.assign(x, { desc: String(ld.desc || cgDescCat(c) || '').trim(), cal, marca: String(ld.marca || reg.marca || ''), modelo: String(ld.modelo || reg.modelo || ''), serie: N0(c.row.AF) === 1 ? String(reg.serie || '') : '' });
    x.sinCambio = !rec && norm(x.asigAct) === norm(x.asig);
    x.falta = !x.asig ? 'Sin “Asignado a” nuevo (ubicación sin nombre o responsable sin DUI)' : '';
    x.m = scMark(code); out.push(x);
  });
  out.sort((a, b) => a.code.localeCompare(b.code));
  scAll.R = R; scAll.D = D.cargo; scAll.v = out; return out;
}
const scEst = x => x.m ? x.m.st : x.sinCambio ? 'SIN CAMBIO' : '';
function scChip(x) { const s = scEst(x); if (!s) return x.falta ? '<span class="chip bad">Falta dato</span>' : '<span class="chip">· Pendiente</span>'; const k = SC_ST[s] || ['', s]; return `<span class="chip ${k[0]}">${k[1]}</span>`; }
function scFiltra(L) {
  const s = UI.scorr, q = norm(s.q);
  return L.filter(x => (!s.t || x.tipo === s.t) && (!s.st || (s.st === 'pend' ? !scEst(x) : s.st === 'prob' ? ['REVISAR', 'FALLIDO', 'NO ENCONTRADO'].includes(scEst(x)) : scEst(x) === s.st))
    && (!q || [x.code, x.ubic, x.asigAct, x.asig, x.descAct, x.desc].some(v => norm(v).includes(q))));
}
const scPorHacer = L => L.filter(x => !x.sinCambio && !x.falta && (!x.m || x.m.st !== 'EXITOSO'));

MODS.scorr = {
  html() {
    if (!X.hasBase) return '<div class="card"><p>Primero importe los datos base en Configuración.</p></div>';
    const A = scAll(), s = UI.scorr, n = st => A.filter(x => scEst(x) === st).length;
    const tot = A.filter(x => !x.sinCambio).length, ok = n('EXITOSO'), prob = n('REVISAR') + n('FALLIDO') + n('NO ENCONTRADO'), pct = tot ? Math.round(ok / tot * 100) : 0;
    const nC = A.filter(x => x.tipo === 'Conservado' && !x.sinCambio).length, nR = A.filter(x => x.tipo === 'Reasignado').length, ph = scPorHacer(A).length, L = scFiltra(A);
    return `<div class="card"><div class="row" style="align-items:center"><div style="flex:1;min-width:240px"><span class="lbl">Avance</span>
      <div style="height:10px;background:var(--ln);border-radius:6px;overflow:hidden;margin:6px 0"><div style="height:100%;width:${pct}%;background:var(--ok,#2E7D32)"></div></div>
      <b>${fmtN(ok)} / ${fmtN(tot)}</b> corregidos (${pct}%) · <span class="hint">🔒 ${fmtN(nC)} conservados · ↺ ${fmtN(nR)} reasignados · ${fmtN(n('SIN CAMBIO'))} ya estaban bien${prob ? ` · <b style="color:var(--bad,#C62828)">${fmtN(prob)} con problema</b>` : ''}</span></div>
      <button class="btn pri" type="button" data-act="scExp"${ph ? '' : ' disabled'}>⬇ Exportar (${fmtN(ph)})</button>
      <label class="btn">⬆ Cargar resultado<input type="file" accept=".xlsx,.xls,.csv" data-ch="scImp" hidden></label></div>
      <p class="hint" style="margin:8px 0 0">El Excel es para el script local de Playwright. En los reasignados también cambia Descripción, Calidad, Marca, Modelo y Serie; <b>nunca</b> toca datos financieros ni Tipo de Bien. Después de correr el script, cargue aquí el mismo Excel con la columna Estado llena.</p></div>
    <div class="card"><div class="row">
      <div class="field"><span class="lbl">Tipo</span><select data-ch="scT">${[['', 'Todos'], ['Conservado', '🔒 Conservados'], ['Reasignado', '↺ Reasignados']].map(([v, t]) => `<option value="${v}"${s.t === v ? ' selected' : ''}>${t}</option>`).join('')}</select></div>
      <div class="field"><span class="lbl">Estado</span><select data-ch="scS">${[['', 'Todos'], ['pend', 'Pendientes'], ['prob', 'Con problema'], ['EXITOSO', 'Corregidos'], ['REVISAR', 'Revisar'], ['FALLIDO', 'Fallidos'], ['NO ENCONTRADO', 'No encontrados'], ['SIN CAMBIO', 'Sin cambio']].map(([v, t]) => `<option value="${v}"${s.st === v ? ' selected' : ''}>${t}</option>`).join('')}</select></div>
      <div class="field" style="flex:1;min-width:200px"><span class="lbl">Buscar</span><input type="search" data-in="scQ" value="${esc(s.q)}" placeholder="Código, ubicación, asignado a, descripción…"></div>
      <span class="hint" style="align-self:flex-end">${fmtN(L.length)} bienes</span></div></div>
    <div id="scT">${this.table(L)}</div>`;
  },
  table(L) {
    const s = UI.scorr; if (!L.length) return '<div class="card empty">Sin bienes con ese filtro.</div>';
    return `<div class="tw tall"><table class="t"><thead><tr><th>Código</th><th>Tipo</th><th>Asignado actual → nuevo</th><th>Cambios descriptivos</th><th>Estado</th><th>Detalle</th></tr></thead><tbody>
    ${L.slice(0, s.lim).map(x => `<tr class="click" data-act="finv" data-code="${esc(x.code)}"><td class="code">${esc(x.code)}</td><td>${x.tipo === 'Conservado' ? '<span class="chip ok">🔒 Conserv.</span>' : '<span class="chip in">↺ Reasig.</span>'}</td>
      <td>${esc(x.asigAct || '—')} → <b>${esc(x.asig || '—')}</b></td>
      <td class="hint">${x.tipo === 'Reasignado' ? `${esc(x.descAct)} → <b>${esc(x.desc)}</b><br>${esc([x.cal, x.marca, x.modelo, x.serie].filter(Boolean).join(' · '))}` : ''}</td>
      <td>${scChip(x)}</td><td class="hint">${esc((x.m && x.m.det) || x.falta || '')}${x.m && x.m.f ? `<br>${esc(x.m.f)}` : ''}</td></tr>`).join('')}
    </tbody></table>${L.length > s.lim ? `<div class="more"><button class="btn sm" data-act="scMore" type="button">Mostrar más (de ${fmtN(L.length)})</button></div>` : ''}</div>`;
  }
};
INP.scT = el => { UI.scorr.t = el.value; UI.scorr.lim = 300; render(); };
INP.scS = el => { UI.scorr.st = el.value; UI.scorr.lim = 300; render(); };
INP.scQ = debounce(el => { UI.scorr.q = el.value; UI.scorr.lim = 300; $('#scT').innerHTML = MODS.scorr.table(scFiltra(scAll())); }, 250);
ACT.scMore = () => { UI.scorr.lim += 300; $('#scT').innerHTML = MODS.scorr.table(scFiltra(scAll())); };
ACT.scExp = async b => {
  const L = scPorHacer(scAll()); if (!L.length) return; b.disabled = true;
  try {
    const rows = L.map(x => { const r = x.tipo === 'Reasignado'; return [x.code, x.tipo, x.ubic, x.asigAct, x.asig, x.descAct, r ? x.desc : '', r ? x.cal : '', r ? x.marca : '', r ? x.modelo : '', r ? x.serie : '', (x.m && x.m.id) || '', '', '', '', '']; });
    const r = await api('api_g_tablas', 'Correccion SIGES', [{ t: 'CORRECCION', head: SC_HEAD, rows }]); descarga(r);
  } catch (e) { toast(errMsg(e), true); } b.disabled = false;
};
INP.scImp = async el => {
  const f = el.files[0]; el.value = ''; if (!f) return;
  try {
    const rows = await leerTabla(f, { c: ['codigo'], st: ['estado'], det: ['detalle'], id: ['id_siges'], fh: ['fecha_hora'] });
    const by = new Map(scAll().map(x => [U(x.code), x])); let n = 0, ok = 0, ign = 0;
    rows.forEach(r => {
      const st = U(r.st).trim(); if (!r.c || !st) return; if (!by.has(U(r.c)) || !SC_ST[st]) { ign++; return; }
      const prev = scMark(by.get(U(r.c)).code); if (prev && prev.st === 'EXITOSO' && st !== 'EXITOSO') { ign++; return; }
      const d = Object.assign({}, cgD().bien['i:sc:' + by.get(U(r.c)).code] || {});
      d.sc = { st, det: String(r.det || '').slice(0, 300), id: String(r.id || ''), f: String(r.fh || ''), t: Date.now() };
      cgPut('bien', 'i:sc:' + by.get(U(r.c)).code, d); n++; if (st === 'EXITOSO') ok++;
    });
    if (!n) { toast('El archivo no trae estados nuevos' + (ign ? ` (${ign} filas ignoradas)` : ''), true); return; }
    scAll.R = null; render(); toast(`Resultado cargado: ${fmtN(n)} bienes (${fmtN(ok)} corregidos)${ign ? ` · ${ign} filas ignoradas` : ''}`);
  } catch (e) { toast(errMsg(e), true); }
};
