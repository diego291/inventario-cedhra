/* ===================== UBICACIONES Y ACTAS (centro de ubicaciones) ===================== */
const initials = n => shortName(n).split(/\s+/).map(w => w.charAt(0)).join('').slice(0, 2).toUpperCase() || '·';
const ROLES = ['Responsable', 'Corresponsable', 'Testigo', 'Otro'];
const rolChip = r => `<span class="chip ${r === 'Responsable' ? 'ok' : r === 'Corresponsable' ? 'in' : ''}">${esc(r)}</span>`;
function lastFolio(u) { const a = (X.actU[norm(u)] || []).slice().sort((x, y) => y.gen - x.gen)[0]; return a ? a.folio : ''; }
function ubicFiltro(l) {
  const f = UI.ubic.f, rs = respOf(l.n);
  if (f === 'cerr') return l.cerrada; if (f === 'sinr') return !rs.length && l.a; if (f === 'sina') return l.cerrada && !(X.actU[norm(l.n)] || []).length;
  if (f === 'inac') return !l.a && !l.nueva; return true;
}
function ordenLista() { return D.locs.filter(l => !l.nueva).concat(D.locs.filter(l => l.nueva)); }
MODS.ubic = {
  extra() {
    const v = UI.ubic.vista, adm = isAdmin();
    return `<div class="seg useg"><button type="button" data-act="uVista" data-v="tabla" class="${v === 'tabla' ? 'on' : ''}">▦ Tabla de control</button><button type="button" data-act="uVista" data-v="det" class="${v === 'det' ? 'on' : ''}">☰ Por ubicación</button></div>
      <button class="btn sm pri" data-act="uNew" type="button">+ Nueva ubicación</button>
      <details class="umas"><summary class="btn sm">⋯ Más</summary><div class="umenu">${adm ? '<button class="btn sm" data-act="uExp" type="button">⬇ Descargar Excel</button><button class="btn sm" data-act="uImpOpen" type="button">⬆ Cargar Excel</button><button class="btn sm" data-act="uOrder" type="button">⇅ Orden de numeración</button>' : ''}<button class="btn sm" data-act="uBatch" type="button">🖨 Imprimir varias (lista)</button></div></details>`;
  },
  html() { return UI.ubic.vista === 'det' ? this.htmlDet() : this.tabla(); },
  htmlDet() {
    const s = UI.ubic, q = norm(s.q), all = ordenLista();
    if (!s.sel || !X.loc[norm(s.sel)]) s.sel = (all.find(l => l.cerrada) || all[0] || {}).n || '';
    const L = all.filter(l => ubicFiltro(l) && (!q || norm(l.n).includes(q) || norm(l.t + ' ' + l.z).includes(q) || respOf(l.n).some(p => norm(p.n).includes(q))));
    const cnt = k => all.filter(l => { const o = UI.ubic.f; UI.ubic.f = k; const r = ubicFiltro(l); UI.ubic.f = o; return r; }).length;
    const chips = [['', 'Todas'], ['cerr', 'Cerradas'], ['sinr', 'Sin responsable'], ['sina', 'Sin acta'], ['inac', 'Inactivas']];
    return `<div class="ugrid"><div class="card ulist"><button class="btn sm" data-act="uVista" data-v="tabla" type="button" style="align-self:flex-start">← Tabla de control</button><input type="search" data-in="uQ" value="${esc(s.q)}" placeholder="🔎 Buscar ubicación o responsable…">
      <div class="row" style="gap:6px">${chips.map(([k, t]) => `<button type="button" class="chip ${s.f === k ? 'in' : ''}" data-act="uF" data-k="${k}" style="border:0;cursor:pointer">${t} ${cnt(k)}</button>`).join('')}</div>
      <div id="uL">${this.list(L)}</div></div>
      <div class="card udet" id="uDet">${this.detail(s.sel)}</div></div>`;
  },
  /* ---------- Tabla de control (vista C): una fila por ubicación, una columna por paso, acciones en lote ---------- */
  tabla() {
    const s = UI.ubic, A = X.act, P = A.map(pasosDe);
    const n = i => P.filter(p => p.ok[i]).length, porF = P.filter(p => p.ok[2] && !p.ok[3]).length, listas = P.filter(p => p.sig === 5).length;
    const kp = (k, t, b, sm, col) => `<div class="kpi ukpi${s.tp === k ? ' on' : ''}" data-act="uTF" data-k="${k}" title="Filtrar"><span>${t}</span><b${col ? ` style="color:${col}"` : ''}>${b}</b><small>${sm}</small></div>`;
    const opt = (v, t, cur) => `<option value="${v}"${cur === v ? ' selected' : ''}>${t}</option>`;
    const nInac = D.locs.filter(l => !l.a && !l.nueva).length;
    return `<div class="grid g4">${kp('0', 'Conteo cerrado', `${n(0)} / ${A.length}`, `${A.length - n(0)} sin cerrar`)}${kp('1', 'Con responsable', n(1), `${A.length - n(1)} sin responsable`)}${kp('3', 'Actas', `${n(2)} / ${porF}`, 'generadas / por firmar')}${kp('5', 'Listas (etiquetadas)', listas, `de ${A.length} activas`, 'var(--ok)')}</div>
      <div class="row" style="gap:10px"><input type="search" data-in="uTQ" value="${esc(s.tq || '')}" placeholder="🔎 Buscar ubicación, edificio o responsable…" style="width:320px;max-width:100%">
        <select data-ch="uTP">${opt('', 'Siguiente paso: todos', s.tp)}${UPASO_SIG.map((t, i) => opt(String(i), t, s.tp)).join('')}</select>
        <select data-ch="uTG">${opt('g', 'Agrupar: edificio / tipo', s.tg)}${opt('p', 'Agrupar: siguiente paso', s.tg)}${opt('n', 'Sin agrupar', s.tg)}</select>
        <span style="flex:1"></span><label class="row hint" style="gap:6px"><input type="checkbox" data-ch="uTI"${s.ti ? ' checked' : ''}> Mostrar inactivas (${nInac})</label></div>
      <div id="uTW">${this.tablaBody()}</div>`;
  },
  tablaFiltrada() {
    const s = UI.ubic, q = norm(s.tq || '');
    return ordenLista().filter(l => (s.ti || l.a || l.nueva) && (s.tp === '' || String(pasosDe(l).sig) === s.tp)
      && (!q || norm(l.n + ' ' + l.t + ' ' + l.z).includes(q) || respOf(l.n).some(p => norm(p.n).includes(q))));
  },
  tablaBody() {
    const s = UI.ubic, L = this.tablaFiltrada(), sel = s.ts;
    Object.keys(sel).forEach(k => { if (!X.loc[k]) delete sel[k]; });
    const us = ordenLista().filter(l => sel[norm(l.n)]), nb = us.reduce((a, l) => a + sumL(X.byU[norm(l.n)] || []), 0);
    const bar = us.length ? `<div class="uselbar"><input type="checkbox" checked data-ch="uTClr" title="Quitar selección"><b>${us.length} seleccionada${us.length === 1 ? '' : 's'}</b><span class="o">· ${fmtN(nb)} bienes · ${us.filter(l => !l.cerrada).length ? `<b style="color:#F0C58F">${us.filter(l => !l.cerrada).length} sin cerrar</b>` : 'todas cerradas'}</span><span style="flex:1"></span>
        <button class="btn sm" data-act="uTActas" data-m="prev" type="button">👁 Vista previa</button><button class="btn sm pri" data-act="uTActas" data-m="print" type="button">🖨 Registrar e imprimir actas</button><button class="btn sm" data-act="uTActas" data-m="pdf" type="button">☁ PDF en Drive</button>
        <button class="btn sm" data-act="uTLbl" type="button">🏷 Etiquetas (${us.reduce((a, l) => a + etqPend(l.n).length, 0)})</button><button class="btn sm" data-act="uTEtq" type="button">✓ Marcar etiquetado</button><button class="btn sm" data-act="uTClr" type="button" title="Quitar selección">✕</button></div>`
      : '<div class="hint" style="padding:2px 2px 0">Marque una o varias ubicaciones para generar actas, imprimir etiquetas o marcar etiquetado en lote. Toque el nombre para ver el detalle.</div>';
    if (!L.length) return bar + '<div class="empty">Nada con ese filtro.</div>';
    const G = new Map(), gk = l => s.tg === 'p' ? 'p' + pasosDe(l).sig : s.tg === 'n' ? '' : cGrupoDe(l.n);
    L.forEach(l => { const k = gk(l); if (!G.has(k)) G.set(k, []); G.get(k).push(l); });
    const gName = (k, ls) => s.tg === 'p' ? UPASO_GRP[+k.slice(1)] : k[0] === 'z' ? String(ls[0].z).trim() : k.slice(2);
    const ord = k => s.tg === 'p' ? +k.slice(1) : k[0] === 'z' ? 0 : /Otras$/.test(k) ? 2 : 1;
    const gs = [...G.entries()].sort((a, b) => ord(a[0]) - ord(b[0]) || (s.tg === 'g' && ord(a[0]) === 0 ? gName(a[0], a[1]).localeCompare(gName(b[0], b[1]), 'es') : 0));
    const allOn = L.every(l => sel[norm(l.n)]);
    const rows = gs.map(([k, ls]) => {
      const on = ls.every(l => sel[norm(l.n)]), bn = ls.reduce((a, l) => a + sumL(X.byU[norm(l.n)] || []), 0), li = ls.filter(l => pasosDe(l).sig === 5).length;
      return (s.tg === 'n' ? '' : `<tr class="ugr"><td class="cc"><input type="checkbox" data-ch="uTGrp" data-g="${esc(k)}"${on ? ' checked' : ''}></td><td colspan="9">${esc(gName(k, ls))} <span>· ${ls.length} ubicaci${ls.length === 1 ? 'ón' : 'ones'} · ${fmtN(bn)} bienes${li ? ` · ${li} lista${li === 1 ? '' : 's'}` : ''}</span></td></tr>`) + ls.map(l => this.tRow(l)).join('');
    }).join('');
    return `${bar}<div class="tw utab"><table class="t"><thead><tr><th class="cc" style="width:34px"><input type="checkbox" data-ch="uTAll"${allOn ? ' checked' : ''} title="Marcar todas las visibles"></th><th>Ubicación</th><th class="n">Bienes</th>${UPASOS.map(t => `<th class="cc">${t}</th>`).join('')}<th>Siguiente paso</th><th>Último cambio</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  },
  tRow(l) {
    const k = norm(l.n), p = pasosDe(l), on = !!UI.ubic.ts[k], rs = respOf(l.n), f = lastFolio(l.n), off = !l.a && !l.nueva;
    const st = p.ok.map((ok, i) => `<td class="cc"><span class="ust ${ok ? 'ok' : i === p.sig ? 'p' : 'no'}" title="${UPASO_SIG[i]}: ${ok ? 'listo' : i === p.sig ? 'siguiente' : 'pendiente'}">${ok ? '✓' : i === p.sig ? '!' : '·'}</span></td>`).join('');
    const sub = [l.t, rs.length ? shortName(rs[0].n) + (rs.length > 1 ? ' +' + (rs.length - 1) : '') : '', f ? 'Folio ' + f : ''].filter(Boolean).join(' · ');
    return `<tr class="${on ? 'usel' : ''}${off ? ' uoff' : ''}"><td class="cc"><input type="checkbox" data-ch="uTS" data-u="${esc(l.n)}"${on ? ' checked' : ''}></td>
      <td><a href="#" class="uname" data-act="uTOpen" data-u="${esc(l.n)}">${esc(l.n)}</a>${l.nueva ? ' <span class="chip new">Nueva</span>' : ''}${off ? ' <span class="chip">Inactiva</span>' : ''}<span class="mini">${esc(sub || '—')}</span></td>
      <td class="n">${fmtN(sumL(X.byU[k] || []))}</td>${st}<td>${sigChip(l, p)}</td><td class="hint" style="white-space:nowrap">${esc(ultimoCambio(l))}</td></tr>`;
  },
  list(L) {
    if (!L.length) return '<div class="empty">Nada con ese filtro.</div>';
    const s = UI.ubic, q = !!norm(s.q), selG = s.sel ? cGrupoDe(s.sel) : '';
    if (!s.open) s.open = {};
    const gs = new Map();
    L.forEach(l => { const k = cGrupoDe(l.n), n = k[0] === 'z' ? String(l.z).trim() : k.slice(2); if (!gs.has(k)) gs.set(k, { k, n, ls: [] }); gs.get(k).ls.push(l); });
    const orden = k => k[0] === 'z' ? 0 : /Otras$/.test(k) ? 2 : 1;
    const G = [...gs.values()].sort((a, b) => orden(a.k) - orden(b.k) || (orden(a.k) === 0 ? a.n.localeCompare(b.n, 'es') : 0));
    return G.map(g => {
      const abierto = q || (g.k in s.open ? s.open[g.k] : g.k === selG), nb = g.ls.reduce((a, l) => a + sumL(X.byU[norm(l.n)] || []), 0);
      const cerr = g.ls.filter(l => l.cerrada).length;
      return `<div class="uacc${abierto ? ' open' : ''}"><button type="button" class="uah" data-act="uGrp" data-g="${esc(g.k)}"><span class="car">${abierto ? '▾' : '▸'}</span><b>${esc(g.n)}</b><small>${g.ls.length} · ${fmtN(nb)} bienes${cerr ? ` · ✓${cerr}` : ''}</small></button>
        ${abierto ? g.ls.map(l => this.row(l)).join('') : ''}</div>`;
    }).join('');
  },
  row(l) {
    const k = norm(l.n), rs = respOf(l.n), nb = sumL(X.byU[k] || []), e = X.estado(l), ac = X.actU[k] || [], firm = ac.some(a => a.firmada || a.firm);
    const dot = !l.a && !l.nueva ? 'off' : e;
    const tag = l.cerrada ? (firm ? '<span class="chip ok" title="Acta firmada">✓ ✍</span>' : ac.length ? '<span class="chip in" title="Acta generada">✓ 📄</span>' : '<span class="chip ok">✓</span>') : e === 'revision' ? '<span class="chip in">🔔</span>' : '';
    return `<div class="lrow${norm(UI.ubic.sel) === k ? ' on' : ''}" data-act="uSel" data-u="${esc(l.n)}"><span class="udot d-${dot}" title="${esc(dot)}"></span><div style="flex:1;min-width:0"><b>${esc(l.n)}</b>${l.nueva ? ' <span class="chip new">Nueva</span>' : ''}${!l.a && !l.nueva ? ' <span class="chip">Inactiva</span>' : ''}<small>${nb} bienes · ${rs.length ? rs.length + ' firma(s)' : '<span style="color:var(--wa)">sin responsable</span>'}</small></div>${tag}</div>`;
  },
  detail(u) {
    const l = X.loc[norm(u)]; if (!l) return '<div class="empty">Elija una ubicación de la lista.</div>';
    const k = norm(u), rows = X.byU[k] || [], nb = sumL(rows), cs = X.codU[k] || [], rs = respOf(u), tab = UI.ubic.tab;
    const conts = [...new Set(rows.map(r => r.U).filter(Boolean))], f1 = rows.map(r => r.fecha).filter(Boolean).sort();
    const rev = l.rev && l.rev.res && l.rev.res.tipo === 'cerrada' ? ` por ${esc(l.rev.res.por)} · ${esc(dt(l.rev.res.t).slice(0, 5))}` : '';
    const folio = lastFolio(u), falt = R.inv.filter(o => norm(o.M) === k && o.R === 'Sin asignar');
    const tabs = [['res', 'Resumen'], ['resp', `Responsables (${rs.length})`], ['docs', 'Documentos'], ['bienes', `Bienes (${cs.length})`], ['hist', 'Historial']];
    return `<div class="row"><div style="flex:1;min-width:0"><div class="row" style="gap:8px"><h2 style="font-size:22px;margin:0">${esc(nombreUbic(u))}</h2>${l.cerrada ? `<span class="chip ok">✓ Cerrada${rev}</span>` : estChip(l)}${folio ? `<span class="chip in">Folio ${esc(folio)}</span>` : ''}</div>
      <div class="hint">${esc([l.t, l.z].filter(Boolean).join(' · ') || 'Sin tipo ni edificio')} · ${nb} bienes · ${rows.length} registros${conts.length ? ' · contado por ' + esc(conts.join(', ')) : ''}${f1.length ? ' · ' + esc(dmy(f1[0])) + (f1[0] !== f1[f1.length - 1] ? ' al ' + esc(dmy(f1[f1.length - 1])) : '') : ''}</div></div>
      <button class="btn sm" data-act="uEdit" type="button">✎ Editar datos</button>${l.a ? `<button class="btn sm bad" data-act="uAct" data-on="0" type="button">Desactivar</button>` : `<button class="btn sm" data-act="uAct" data-on="1" type="button">Activar</button>`}${isAdmin() && !rows.length && !(X.actU[k] || []).length ? '<button class="btn sm bad" data-act="uDel" type="button">🗑 Eliminar</button>' : ''}</div>
      ${this.pasos(u, l, rs)}
      <div class="tabs">${tabs.map(([t, x]) => `<button type="button" data-act="uTab" data-k="${t}" class="${tab === t ? 'on' : ''}">${x}</button>`).join('')}<span style="flex:1"></span>${this.nav(u)}</div>
      <div id="uTabBody">${this['t_' + tab](u, l, { rows, cs, rs, falt })}</div>`;
  },
  pasos(u, l, rs) {
    const k = norm(u), ac = X.actU[k] || [], firm = ac.some(a => a.firmada || a.firm), etq = (D.etq || []).some(x => norm(x.u) === k);
    const P = [['Conteo cerrado', l.cerrada], ['Responsables', rs.length > 0], ['Acta generada', ac.length > 0], ['Acta firmada', firm], ['Etiquetado', etq]];
    const sig = P.findIndex(p => !p[1]);
    return `<div class="upasos">${P.map(([t, ok], i) => `<span class="upaso ${ok ? 'ok' : i === sig ? 'sig' : ''}">${i + 1} · ${t}${ok ? ' ✓' : i === sig ? ' — pendiente' : ''}</span>`).join('')}</div>`;
  },
  nav(u) {
    const all = ordenLista(), i = all.findIndex(l => norm(l.n) === norm(u)), a = all[i - 1], b = all[i + 1];
    return `<div class="row" style="gap:6px;align-self:center">${a ? `<button class="btn sm" data-act="uSel" data-u="${esc(a.n)}" type="button" title="Anterior">◀ ${esc(a.n)}</button>` : ''}${b ? `<button class="btn sm" data-act="uSel" data-u="${esc(b.n)}" type="button" title="Siguiente">${esc(b.n)} ▶</button>` : ''}</div>`;
  },
  t_res(u, l, d) {
    const by = { Conservado: 0, Reciclado: 0, NUEVO: 0 }; d.cs.forEach(c => by[c.R]++);
    const B = d.rows.reduce((a, r) => a + r.I, 0), Rr = d.rows.reduce((a, r) => a + r.J, 0), M = d.rows.reduce((a, r) => a + r.K, 0), inv = R.inv.filter(o => norm(o.M) === norm(u)).length;
    const al = d.rows.filter(r => r.V && r.V.charAt(0) !== 'ℹ'), notas = X.notaVinc[U(u)] || [];
    return `<div class="grid g4"><div class="kpi"><span>Bienes contados</span><b>${B + Rr + M}</b><small>B ${B} · R ${Rr} · M ${M}</small></div><div class="kpi"><span>Códigos</span><b>${d.cs.length}</b><small>🔒 ${by.Conservado} · ↺ ${by.Reciclado} · ✚ ${by.NUEVO}</small></div>
      <div class="kpi"><span>Había en el sistema</span><b>${inv}</b><small>según “Asignado a”</small></div><div class="kpi"><span>No aparecieron</span><b style="color:${d.falt.length ? 'var(--bad)' : 'var(--ok)'}">${d.falt.length}</b><small>pasan a descargo</small></div></div>
      ${al.length || d.falt.length ? `<div class="uatn">${al.length ? `<div><b>⚠ ${al.length} alerta(s) en el conteo</b><button class="btn sm" data-act="go" data-m="conteo" data-u="${esc(u)}" type="button">Ver en Conteo</button></div>` : '<div><span class="hint">Sin alertas en el conteo</span></div>'}
        ${d.falt.length ? `<div><b>${d.falt.length} no aparecieron</b>${(() => { const sj = d.falt.filter(o => !(D.justif || {})[o.code]).length; return sj ? `<span class="hint">${sj} sin justificar</span>` : '<span class="chip ok">todas justificadas</span>'; })()}<button class="btn sm" data-act="uJus" type="button">Justificar ↓</button></div>` : ''}</div>` : ''}
      <div class="card" style="box-shadow:none" id="uFalt"><h2>Lo que había aquí y no apareció <span class="meta">justifique antes de mandarlo a descargo</span></h2>
      ${d.falt.length ? `<div class="tw" style="max-height:340px"><table class="t"><thead><tr><th>Código</th><th>Bien</th><th>Fecha</th><th class="n">Valor</th><th>Justificación</th></tr></thead><tbody>${d.falt.map(o => { const j = (D.justif || {})[o.code]; return `<tr class="click" data-act="finv" data-code="${esc(o.code)}"><td class="code">${esc(o.code)}</td><td>${esc(o.desc)}<br><span class="hint">${esc([o.marca, o.modelo, o.serie].filter(Boolean).join(' '))}</span></td><td>${esc(dmy(o.fecha))}</td><td class="n">${money(o.valor)}</td><td>${j && j.t ? esc(j.t) : '<span class="chip wa">Sin justificar</span>'} <button class="btn sm ghost" data-act="fjust" data-key="i:${esc(o.code)}" type="button">✎</button></td></tr>`; }).join('')}</tbody></table></div>` : '<div class="hint">Todo lo que el sistema tenía en esta ubicación apareció en el conteo (o no tiene equivalencia de ubicación).</div>'}</div>
      ${notas.length ? `<div class="card" style="box-shadow:none"><h2>Notas</h2>${notas.map(n => `<div class="note-s">${esc(n.texto)} <span class="hint">· ${esc(n.por)}</span></div>`).join('')}</div>` : ''}
      <div><button class="btn sm" data-act="unota" type="button">📝 Nota para esta ubicación</button></div>`;
  },
  t_resp(u, l, d) {
    return `<div class="g-resp"><div style="display:flex;flex-direction:column;gap:10px;min-width:0">
      <div class="row" style="position:relative"><input type="search" id="rpQ" data-in="rpQ" placeholder="+ Agregar responsable: escriba nombre, DUI o NIP…" style="flex:1;min-width:220px" autocomplete="off"><button class="btn" data-act="pNew" data-u="${esc(u)}" type="button">Nueva persona</button><div class="dd" id="rpDD" hidden></div></div>
      ${d.rs.map((p, i) => { const per = X.per[p.pid] || {}; return `<div class="pc"><div class="ordb"><button class="btn sm ghost" data-act="rpMove" data-i="${i}" data-d="-1" type="button"${i ? '' : ' disabled'}>↑</button><button class="btn sm ghost" data-act="rpMove" data-i="${i}" data-d="1" type="button"${i < d.rs.length - 1 ? '' : ' disabled'}>↓</button></div>
        <div style="min-width:0"><div class="row" style="gap:8px"><span class="av">${esc(initials(p.n))}</span><b>${esc(p.n)}</b><select data-ch="rpRol" data-i="${i}">${ROLES.map(r => `<option${p.rol === r ? ' selected' : ''}>${r}</option>`).join('')}</select></div>
        <div class="k"><span>DUI</span><b class="mono">${esc(per.dui || '—')}</b><span>NIP</span><b class="mono">${esc(per.nip || '—')}</b><span>Cargo</span><b>${esc(per.cargo || p.cargo || '—')}</b><span>Copias</span><b><select data-ch="rpCop" data-i="${i}">${[0, 1, 2, 3, 4].map(n => `<option${+p.copias === n ? ' selected' : ''}>${n}</option>`).join('')}</select></b></div>
        ${!per.dui ? `<div class="hint" style="color:var(--wa)">Falta el DUI: <a href="#" data-act="pEdit" data-id="${esc(p.pid)}">completar</a></div>` : ''}</div>
        <div class="row" style="gap:4px"><button class="btn sm ghost" data-act="pEdit" data-id="${esc(p.pid)}" type="button" title="Editar datos de la persona">✎</button><button class="btn sm ghost bad" data-act="rpDel" data-i="${i}" type="button" title="Quitar de esta ubicación">✕</button></div></div>`; }).join('') || '<div class="empty">Sin responsables. Busque arriba en el directorio o cree una persona nueva.</div>'}
      <div class="hint">El orden de esta lista es el orden de las firmas en el acta. Copias = juegos impresos a nombre de esa persona (0 = solo firma). Los testigos firman abajo, junto al encargado y Dirección.</div></div>
      <div class="callout"><b>Acta de ${esc(u)}:</b> ${d.rs.filter(p => p.rol !== 'Testigo').length || 1} recuadro(s) “reciben” + ${d.rs.filter(p => p.rol === 'Testigo').length} testigo(s) + encargado + Dirección = <b>${Math.max(1, d.rs.filter(p => p.rol !== 'Testigo').length) + d.rs.filter(p => p.rol === 'Testigo').length + 2} firmas</b>.<br><br>Los datos de cada persona (DUI, NIP, cargo) se editan una sola vez en <a href="#" data-act="go" data-m="personas">Personas</a> y se actualizan en todas sus actas.</div></div>`;
  },
  t_docs(u, l, d) {
    const A = UI.actas, rp = resumenPaquete([u]), ch = (o, k, lbl) => `<label><input type="checkbox" data-ch="aOpt" data-o="${o}" data-k="${k}"${A[o][k] ? ' checked' : ''}> ${lbl}</label>`;
    const ac = (X.actU[norm(u)] || []).slice().sort((a, b) => b.gen - a.gen), fol = [...new Set(ac.map(a => a.folio))];
    return `<div class="g-resp"><div style="display:flex;flex-direction:column;gap:12px;min-width:0">
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(190px,1fr))"><div class="juego"><h3>Juego ORIGINAL</h3>${ch('oO', 'ficha', 'Ficha de bienes')}${ch('oO', 'acta', 'Acta original')}${ch('oO', 'lista', 'Lista código por código')}<span class="lbl" style="margin-top:4px">Copias</span><select data-ch="aCopO" style="width:70px">${[0, 1, 2, 3].map(n => `<option${+A.oO.copias === n ? ' selected' : ''}>${n}</option>`).join('')}</select></div>
        <div class="juego resp"><h3>Por RESPONSABLE</h3>${ch('oR', 'ficha', 'Ficha de bienes')}${ch('oR', 'acta', 'Acta COPIA a su nombre')}${ch('oR', 'lista', 'Lista código por código')}<span class="hint">Copias por persona: pestaña Responsables.</span></div>
        <div class="juego otros"><h3>Otras copias</h3>${A.otros.map((n, i) => `<div class="dest"><input type="text" data-in="aOtro" data-i="${i}" value="${esc(n)}" placeholder="Dirección…"><button class="btn sm ghost bad" data-act="aOtroDel" data-i="${i}" type="button">✕</button></div>`).join('')}<button class="btn sm ghost" data-act="aOtroAdd" type="button" style="align-self:flex-start">+ destinatario</button></div></div>
      <div class="row" style="align-items:flex-end"><div class="field"><span class="lbl">Detalle</span><select data-ch="aDet"><option value="bloque"${A.det === 'bloque' ? ' selected' : ''}>Por bloque con rangos</option><option value="codigo"${A.det === 'codigo' ? ' selected' : ''}>Código por código</option></select></div>
        <div class="field"><span class="lbl">Firmas por fila</span><select data-ch="aFir"><option${A.firmas == 2 ? ' selected' : ''}>2</option><option${A.firmas == 3 ? ' selected' : ''}>3</option></select></div>
        <div class="field"><span class="lbl">Papel</span><select data-ch="aPap">${['Carta', 'Oficio', 'A4'].map(p => `<option${A.papel === p ? ' selected' : ''}>${p}</option>`).join('')}</select></div><label class="row hint"><input type="checkbox" data-ch="aPort"${A.portada ? ' checked' : ''}> Portada por juego</label></div>
      <div class="card" style="box-shadow:none"><h2>Control de entrega <span class="meta">${ac.filter(a => !a.firm).length} pendiente(s) de firma</span></h2>
      ${fol.length ? fol.map(f => { const js = ac.filter(a => a.folio === f), firm = js.find(a => a.firmada); return `<div class="folio"><div class="row"><b class="mono">${esc(f)}</b><span class="hint">${esc(dt(js[0].gen))} · ${esc(js[0].por)}</span><span style="flex:1"></span>${js[0].pdf ? `<a href="${esc(js[0].pdf)}" target="_blank" rel="noopener">PDF</a>` : ''}${firm ? `<a class="chip ok" href="${esc(firm.firmada)}" target="_blank" rel="noopener">📎 Acta firmada</a>` : ''}<label class="btn sm">📷 Subir acta firmada<input type="file" accept="image/*,application/pdf" data-ch="uFirm" data-f="${esc(f)}" hidden></label></div>
        <table class="t"><tbody>${js.map(a => `<tr><td>${esc(a.juego)}${a.juego !== 'Original' ? ' · ' + esc(a.dest) : ''}</td><td>${a.ent ? '✓ entregado ' + esc(dt(a.ent).slice(0, 5)) : `<button class="btn sm" data-act="aEnt" data-id="${esc(a.id)}" data-k="ent" type="button">Entregado</button>`}</td><td>${a.firm ? '✓ firmado ' + esc(dt(a.firm).slice(0, 5)) : `<button class="btn sm" data-act="aEnt" data-id="${esc(a.id)}" data-k="firm" type="button">Firmado</button>`}</td></tr>`).join('')}</tbody></table></div>`; }).join('') : '<div class="hint">Todavía no se imprimen juegos de esta ubicación.</div>'}</div></div>
      <div style="display:flex;flex-direction:column;gap:10px"><div class="callout"><b>Imprimir ${esc(u)}</b><br>${Math.max(1, d.rs.filter(p => p.rol !== 'Testigo').length) + d.rs.filter(p => p.rol === 'Testigo').length + 2} firmas · ${rp.juegos} juego(s) · ${rp.hojas} hojas${l.cerrada ? '' : '<br><span style="color:var(--bad)">No está cerrada: sale con marca BORRADOR.</span>'}${d.rs.length ? '' : '<br><span style="color:var(--bad)">Sin responsables: firma en blanco.</span>'}</div>
        <div class="thumbs"><div>FICHA<i></i><i></i><i></i><i></i><em>ORIGINAL</em></div><div>ACTA<i></i><i></i><i></i><em>ORIGINAL</em></div>${d.rs.filter(p => p.copias > 0).slice(0, 2).map(p => `<div>ACTA<i></i><i></i><i></i><em>COPIA · ${esc(shortName(p.n).split(' ').pop())}</em></div>`).join('')}</div>
        <button class="btn pri" data-act="uPrint" data-m="print" type="button">🖨 Imprimir juegos de ${esc(u)}</button><button class="btn" data-act="uPrint" data-m="prev" type="button">👁 Vista previa</button><button class="btn" data-act="uPrint" data-m="pdf" type="button">☁ Guardar PDF en Drive</button></div></div>`;
  },
  t_bienes(u, l, d) {
    const tr = (D.traslados || []).filter(t => norm(t.de) === norm(u) || norm(t.a) === norm(u));
    return `${d.cs.length ? `<div class="tw" style="max-height:520px"><table class="t"><thead><tr><th class="n">#</th><th>Código</th><th>Bien</th><th>Estado</th><th>Origen</th><th>Marca / serie</th></tr></thead><tbody>${d.cs.map(c => `<tr class="click" data-act="fcod" data-i="${c.n - 1}"><td class="n">${c.n}</td><td class="code"><b>${esc(c.B)}</b></td><td>${esc(c.C.replace(/^🔒 /, ''))}</td><td>${esc(c.F)}</td><td>${ochip(c.R)}</td><td class="hint">${esc(c.H)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Sin bienes con código en esta ubicación.</div>'}
      ${tr.length ? `<div class="card" style="box-shadow:none;margin-top:12px"><h2>Traslados</h2><table class="t"><tbody>${tr.map(t => `<tr><td>${esc(dt(t.t).slice(0, 10))}</td><td class="code">${esc(t.code)}</td><td>${esc(t.bien)}</td><td>${esc(t.de)} → <b>${esc(t.a)}</b></td><td class="hint">${esc(t.motivo)} · ${esc(t.autorizo)}</td></tr>`).join('')}</tbody></table></div>` : ''}`;
  },
  t_hist(u) { setTimeout(() => cargarHist(u), 0); return '<div id="uHist" class="hint">Cargando historial…</div>'; }
};
const UPASOS = ['Conteo', 'Resp.', 'Acta', 'Firma', 'Etiq.'];
const UPASO_SIG = ['Cerrar conteo', 'Asignar responsable', 'Generar acta', 'Subir acta firmada', 'Etiquetar', 'Lista'];
const UPASO_GRP = ['Contando (sin cerrar)', 'Sin responsable', 'Sin acta', 'Por firmar', 'Por etiquetar', 'Listas'];
/** Estado de los 5 pasos de una ubicación y el primero que falta (5 = lista). */
function pasosDe(l) {
  const k = norm(l.n), ac = X.actU[k] || [];
  const ok = [!!l.cerrada, respOf(l.n).length > 0, ac.length > 0, ac.some(a => a.firmada || a.firm), !!X.etq[k]];
  const i = ok.indexOf(false); return { ok, sig: i < 0 ? 5 : i };
}
/** Códigos que necesitan etiqueta nueva (todo lo que no conserva su etiqueta). */
const etqPend = u => (X.codU[norm(u)] || []).filter(c => c.R !== 'Conservado');
function sigChip(l, p) {
  const u = esc(l.n);
  if (p.sig === 0) return l.enRev ? `<button type="button" class="chip in" data-act="go" data-m="conteo" data-u="${u}">🔔 Revisar conteo</button>` : `<button type="button" class="chip" data-act="go" data-m="conteo" data-u="${u}">Cerrar conteo</button>`;
  if (p.sig === 1) return `<button type="button" class="chip wa" data-act="uTOpen" data-u="${u}" data-k="resp">Asignar responsable</button>`;
  if (p.sig === 2) return `<button type="button" class="chip in" data-act="uTOpen" data-u="${u}" data-k="docs">Generar acta</button>`;
  if (p.sig === 3) return `<button type="button" class="chip re" data-act="uTOpen" data-u="${u}" data-k="docs">Subir acta firmada</button>`;
  if (p.sig === 4) { const n = etqPend(l.n).length; return n ? `<button type="button" class="chip new" data-act="uTLbl" data-u="${u}">🏷 Imprimir ${n} etiqueta${n === 1 ? '' : 's'}</button>` : `<button type="button" class="chip new" data-act="uTEtq" data-u="${u}">Marcar etiquetado</button>`; }
  return '<span class="chip ok">✓ Lista</span>';
}
function ultimoCambio(l) {
  const k = norm(l.n), e = X.etq[k], ac = X.actU[k] || [], d = x => dt(x).slice(0, 5);
  if (e) return 'etiquetada ' + d(e.t);
  if (ac.some(a => a.firmada || a.firm)) return 'acta firmada';
  if (ac.length) return 'acta ' + d(Math.max(...ac.map(a => +a.gen || 0)));
  if (l.cerrada) return 'cerrada' + (l.rev && l.rev.res && l.rev.res.t ? ' ' + d(l.rev.res.t) : '');
  const f = (X.byU[k] || []).map(r => r.fecha).filter(Boolean).sort().pop();
  return f ? 'contando · ' + dmy(f) : 'sin registros';
}
function uTRef() { const w = $('#uTW'); if (w) w.innerHTML = MODS.ubic.tablaBody(); else render(); }
INP.uTQ = debounce(el => { UI.ubic.tq = el.value; uTRef(); }, 200);
INP.uTP = el => { UI.ubic.tp = el.value; render(); };
INP.uTG = el => { UI.ubic.tg = el.value; LS.set('utg', el.value); uTRef(); };
INP.uTI = el => { UI.ubic.ti = el.checked; uTRef(); };
INP.uTS = el => { const k = norm(el.dataset.u); if (el.checked) UI.ubic.ts[k] = 1; else delete UI.ubic.ts[k]; uTRef(); };
INP.uTAll = el => { MODS.ubic.tablaFiltrada().forEach(l => { const k = norm(l.n); if (el.checked) UI.ubic.ts[k] = 1; else delete UI.ubic.ts[k]; }); uTRef(); };
INP.uTGrp = el => { const g = el.dataset.g, s = UI.ubic; MODS.ubic.tablaFiltrada().filter(l => (s.tg === 'p' ? 'p' + pasosDe(l).sig : s.tg === 'n' ? '' : cGrupoDe(l.n)) === g).forEach(l => { const k = norm(l.n); if (el.checked) s.ts[k] = 1; else delete s.ts[k]; }); uTRef(); };
INP.uTClr = () => { UI.ubic.ts = {}; uTRef(); };
const uTSel = () => ordenLista().filter(l => UI.ubic.ts[norm(l.n)]).map(l => l.n);
Object.assign(ACT, {
  uVista: b => { UI.ubic.vista = b.dataset.v; LS.set('uvista', b.dataset.v); render(); },
  uTF: b => { UI.ubic.tp = UI.ubic.tp === b.dataset.k ? '' : b.dataset.k; render(); },
  uTOpen: b => { UI.ubic.vista = 'det'; UI.ubic.sel = b.dataset.u; if (b.dataset.k) UI.ubic.tab = b.dataset.k; render(); scrollTo(0, 0); },
  uTClr: () => { UI.ubic.ts = {}; uTRef(); },
  uTActas: b => { const us = uTSel(); if (us.length) imprimirJuegos(us, b, b.dataset.m); },
  uTLbl: b => { const us = b.dataset.u ? [b.dataset.u] : uTSel(), L = us.flatMap(etqPend); if (!L.length) { toast('Esas ubicaciones no tienen etiquetas nuevas por imprimir (todas conservan la suya).'); return; } printLabels(L); },
  uTEtq: b => {
    const us = (b.dataset.u ? [b.dataset.u] : uTSel()).filter(u => (X.codU[norm(u)] || []).length);
    if (!us.length) { toast('Ninguna de esas ubicaciones tiene códigos asignados.', true); return; }
    confirmModal(`¿Marcar como <b>etiquetadas</b> ${us.length} ubicación(es): ${esc(us.join(', '))}? Queda guardado qué código tenía cada bien al etiquetar, para avisar si luego cambia.`, 'Marcar etiquetado', async () => {
      for (const u of us) { const r = await api('api_g_etiquetar', u, (X.codU[norm(u)] || []).map(c => [c.row.id, c.K, c.B])); D.etq = r.etq; }
      derive(); UI.ubic.ts = {}; render(); toast(`${us.length} ubicación(es) marcadas como etiquetadas`);
    });
  }
});
async function cargarHist(u) {
  const box = $('#uHist'); if (!box) return;
  try {
    const h = await api('api_g_hist', u), loc = [];
    (X.actU[norm(u)] || []).forEach(a => { if (a.firmada) loc.push({ f: '', a: 'Acta firmada escaneada', d: a.folio }); });
    box.outerHTML = `<div class="tl" id="uHist">${h.map(x => `<div><b>${esc(x.a.replace(/^Gestión: /, ''))}</b> · ${esc(x.f)} · ${esc(x.u)}<small>${esc(x.d)}</small></div>`).join('') || '<div class="hint">Sin movimientos en la bitácora.</div>'}</div>`;
  } catch (e) { box.textContent = errMsg(e); }
}
INP.uQ = debounce(el => { UI.ubic.q = el.value; const q = norm(el.value); $('#uL').innerHTML = MODS.ubic.list(ordenLista().filter(l => ubicFiltro(l) && (!q || norm(l.n).includes(q) || norm(l.t + ' ' + l.z).includes(q) || respOf(l.n).some(p => norm(p.n).includes(q))))); }, 200);
Object.assign(ACT, {
  uF: b => { UI.ubic.f = b.dataset.k; render(); },
  uGrp: b => { const s = UI.ubic, k = b.dataset.g, selG = s.sel ? cGrupoDe(s.sel) : ''; s.open = s.open || {}; const cur = k in s.open ? s.open[k] : k === selG; s.open[k] = !cur; const q = norm(s.q); $('#uL').innerHTML = MODS.ubic.list(ordenLista().filter(l => ubicFiltro(l) && (!q || norm(l.n).includes(q) || norm(l.t + ' ' + l.z).includes(q) || respOf(l.n).some(p => norm(p.n).includes(q))))); },
  uJus: () => { const t = $('#uFalt'); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); },
  uSel: b => { UI.ubic.sel = b.dataset.u; const g = cGrupoDe(b.dataset.u); UI.ubic.open = UI.ubic.open || {}; if (UI.ubic.open[g] === false) delete UI.ubic.open[g];
    const q = norm(UI.ubic.q); $('#uL').innerHTML = MODS.ubic.list(ordenLista().filter(l => ubicFiltro(l) && (!q || norm(l.n).includes(q) || norm(l.t + ' ' + l.z).includes(q) || respOf(l.n).some(p => norm(p.n).includes(q)))));
    $('#uDet').innerHTML = MODS.ubic.detail(b.dataset.u); const on = $('#uL .lrow.on'); if (on) on.scrollIntoView({ block: 'nearest' }); if (innerWidth < 1100) $('#uDet').scrollIntoView({ behavior: 'smooth' }); else $('#uDet').scrollIntoView({ block: 'nearest' }); },
  uTab: b => { UI.ubic.tab = b.dataset.k; $('#uDet').innerHTML = MODS.ubic.detail(UI.ubic.sel); },
  uNew: () => locModal(null), uEdit: () => locModal(X.loc[norm(UI.ubic.sel)]),
  uAct: async b => { b.disabled = true; try { const r = await api('api_g_locSave', { orig: UI.ubic.sel, n: UI.ubic.sel, a: b.dataset.on === '1' }); D.locs = r.locs; recompute(); render(); toast(b.dataset.on === '1' ? 'Ubicación activada' : 'Ubicación desactivada: ya no cuenta para el avance'); } catch (e) { toast(errMsg(e), true); b.disabled = false; } },
  uDel: b => confirmModal(`¿Eliminar la ubicación <b>${esc(UI.ubic.sel)}</b>? No tiene registros ni actas. Esta acción no se puede deshacer.`, 'Eliminar', async () => { const r = await api('api_g_locDelete', UI.ubic.sel); D.locs = r.locs; D.resp = r.resp; UI.ubic.sel = ''; recompute(); render(); toast('Ubicación eliminada'); }),
  uPrint: b => imprimirJuegos([UI.ubic.sel], b, b.dataset.m),
  unota: () => openBloc('notas', { vinc: UI.ubic.sel, texto: UI.ubic.sel + ': ' }),
  aEnt: async b => { b.disabled = true; try { const r = await api('api_g_actaSet', b.dataset.id, { [b.dataset.k]: true }); D.actas = r.actas; derive(); $('#uDet') ? $('#uDet').innerHTML = MODS.ubic.detail(UI.ubic.sel) : render(); } catch (e) { toast(errMsg(e), true); b.disabled = false; } },
  aOtroAdd: () => { UI.actas.otros.push(''); refreshUDet(); }, aOtroDel: b => { UI.actas.otros.splice(+b.dataset.i, 1); refreshUDet(); },
  uBatch: () => batchModal(),
  uExp: async b => { b.disabled = true; try { const rows = ordenLista().map((l, i) => [i + 1, l.n, l.t, l.z, l.a ? 'Sí' : 'No', respOf(l.n).map(p => p.n + ' (' + p.rol + ')').join('; '), X.estado(l)]);
    const r = await api('api_g_tablas', 'Ubicaciones', [{ t: 'UBICACIONES', head: ['Orden', 'Ubicación', 'Tipo', 'Edificio / zona', 'Activa', 'Responsables', 'Estado'], rows }]); descarga(r); } catch (e) { toast(errMsg(e), true); } b.disabled = false; },
  uImpOpen: () => modal(`<h2>Cargar ubicaciones desde Excel</h2><p class="hint" style="margin:0">Columnas: <b>Ubicación</b>, Tipo, Edificio / zona, Activa (Sí/No). Use el archivo que descarga con “⬇ Excel” como plantilla. Las ubicaciones nuevas se agregan al final; las existentes se actualizan. Antes de guardar se muestra qué va a cambiar.</p><input type="file" accept=".xlsx,.xls,.csv" data-ch="uImpFile"><div id="uImpOut"></div><div class="acts"><button class="btn" data-close type="button">Cerrar</button></div>`),
  uOrder: () => orderModal(),
  rpMove: b => { const L = respOf(UI.ubic.sel).slice(), i = +b.dataset.i, j = i + +b.dataset.d; [L[i], L[j]] = [L[j], L[i]]; saveResp(L); },
  rpDel: b => { const L = respOf(UI.ubic.sel).slice(); const p = L.splice(+b.dataset.i, 1)[0]; confirmModal(`¿Quitar a <b>${esc(p.n)}</b> de ${esc(UI.ubic.sel)}? La persona sigue en el directorio.`, 'Quitar', () => saveResp(L)); },
  rpAdd: b => { const L = respOf(UI.ubic.sel).slice(); L.push({ pid: b.dataset.id, rol: L.some(p => p.rol === 'Responsable') ? 'Corresponsable' : 'Responsable', copias: 1 }); saveResp(L); }
});
function refreshUDet() { if ($('#uDet')) $('#uDet').innerHTML = MODS.ubic.detail(UI.ubic.sel); if ($('#uL')) { const q = norm(UI.ubic.q); $('#uL').innerHTML = MODS.ubic.list(ordenLista().filter(l => ubicFiltro(l) && (!q || norm(l.n).includes(q) || norm(l.t + ' ' + l.z).includes(q) || respOf(l.n).some(p => norm(p.n).includes(q))))); } }
INP.rpRol = el => { const L = respOf(UI.ubic.sel).map(p => ({ ...p })); L[+el.dataset.i].rol = el.value; saveResp(L); };
INP.rpCop = el => { const L = respOf(UI.ubic.sel).map(p => ({ ...p })); L[+el.dataset.i].copias = +el.value; saveResp(L); };
INP.rpQ = debounce(el => {
  const q = norm(el.value), dd = $('#rpDD'); if (q.length < 2) { dd.hidden = true; return; }
  const ya = new Set(respOf(UI.ubic.sel).map(p => p.pid));
  const L = (D.personas || []).filter(p => p.estado !== 'Baja' && (norm(p.n).includes(q) || p.dui.replace('-', '').includes(q.replace('-', '')) || p.nip.includes(q))).slice(0, 8);
  dd.innerHTML = L.map(p => `<div class="it" data-act="rpAdd" data-id="${esc(p.id)}"${ya.has(p.id) ? ' style="opacity:.45;pointer-events:none"' : ''}><span class="av">${esc(initials(p.n))}</span><div style="flex:1;min-width:0"><b>${esc(p.n)}</b><small>${p.dui ? 'DUI ' + esc(p.dui) : 'sin DUI'}${p.nip ? ' · NIP ' + esc(p.nip) : ''} · ${esc(p.cargo || '')}${(X.perUb[p.id] || []).length ? ' · firma en ' + esc(X.perUb[p.id].map(x => x.u).join(', ')) : ''}</small></div>${ya.has(p.id) ? '<span class="hint">ya está</span>' : ''}</div>`).join('') + `<div class="it" data-act="pNew" data-u="${esc(UI.ubic.sel)}" data-n="${esc(el.value)}"><b>+ Crear “${esc(el.value.toUpperCase())}”</b></div>`;
  dd.hidden = false;
}, 150);
async function saveResp(L) {
  try { const r = await api('api_g_setResp', UI.ubic.sel, L.map(p => ({ pid: p.pid, n: p.pid ? '' : p.n, rol: p.rol, copias: p.copias, nota: p.nota }))); D.resp = r.resp; D.personas = r.personas; derive(); refreshUDet(); toast('Responsables guardados'); }
  catch (e) { toast(errMsg(e), true); refreshUDet(); }
}
function descarga(r) { modal(`<h2>Archivo listo</h2><p><b>${esc(r.name)}</b></p><div class="row"><a class="btn pri" href="${esc(r.xlsx)}" target="_blank" rel="noopener">⬇ Descargar Excel</a><a class="btn" href="${esc(r.url)}" target="_blank" rel="noopener">Abrir en Google Sheets</a></div><p class="hint">Queda guardado en la carpeta “Resultados gestión” de Drive.</p><div class="acts"><button class="btn" data-close type="button">Cerrar</button></div>`); }
function confirmModal(msg, okTxt, fn) {
  modal(`<h2>Confirmar</h2><p style="margin:0">${msg}</p><div class="acts"><button class="btn" data-close type="button">Cancelar</button><button class="btn pri" id="cfOk" type="button">${esc(okTxt || 'Aceptar')}</button></div>`);
  $('#cfOk').onclick = async () => { $('#cfOk').disabled = true; try { await fn(); closeModal(); } catch (e) { toast(errMsg(e), true); $('#cfOk').disabled = false; } };
}
function locModal(l) {
  const tipos = [...new Set(D.locs.map(x => x.t).filter(Boolean))], eds = [...new Set(D.locs.map(x => x.z).filter(Boolean))];
  modal(`<h2>${l ? 'Editar ' + esc(l.n) : 'Nueva ubicación'}</h2>
    <datalist id="dlT">${tipos.map(t => `<option value="${esc(t)}">`).join('')}</datalist><datalist id="dlZ">${eds.map(t => `<option value="${esc(t)}">`).join('')}</datalist>
    <div class="grid g2"><div class="field"><span class="lbl">Nombre</span><input type="text" id="lN" value="${esc(l ? l.n : '')}" placeholder="A14, LAB. CÓMPUTO, BODEGA 2…" style="text-transform:uppercase"></div><div class="field"><span class="lbl">Tipo</span><input type="text" id="lT" list="dlT" value="${esc(l ? l.t : '')}"></div>
    <div class="field"><span class="lbl">Edificio / zona</span><input type="text" id="lZ" list="dlZ" value="${esc(l ? l.z : '')}"></div><div class="field"><span class="lbl">Activa</span><select id="lA"><option${!l || l.a ? ' selected' : ''}>Sí</option><option${l && !l.a ? ' selected' : ''}>No</option></select></div></div>
    ${l ? '<p class="hint" style="margin:0">Solo se puede cambiar el nombre si la ubicación todavía no tiene registros del conteo ni actas.</p>' : '<p class="hint" style="margin:0">Las ubicaciones nuevas quedan al final de la lista (orden de numeración). El administrador puede moverlas con “⇅ Orden”. También aparecen en la app de captura.</p>'}
    <div class="acts"><button class="btn" data-close type="button">Cancelar</button><button class="btn pri" id="lSave" type="button">Guardar</button></div>`);
  $('#lSave').onclick = async () => {
    $('#lSave').disabled = true;
    try { const r = await api('api_g_locSave', { orig: l ? l.n : '', n: $('#lN').value, t: $('#lT').value, z: $('#lZ').value, a: $('#lA').value === 'Sí' });
      D.locs = r.locs; D.resp = r.resp; UI.ubic.sel = r.n; recompute(); closeModal(); render(); toast(l ? 'Ubicación actualizada' : 'Ubicación creada'); }
    catch (e) { toast(errMsg(e), true); $('#lSave').disabled = false; }
  };
}
let ORD = null;
function orderModal() {
  if (!ORD) ORD = ordenLista().map(l => l.n);
  modal(`<h2>Orden de las ubicaciones</h2><div class="banner wa" style="margin:0">⚠ Este orden decide la numeración de los códigos nuevos y reciclados (igual que la lista de CONFIG del Excel). Cambiarlo después de etiquetar cambia códigos.</div>
    <div class="tw" style="max-height:55vh"><table class="t"><tbody>${ORD.map((n, i) => `<tr><td class="n">${i + 1}</td><td><b>${esc(n)}</b> <span class="hint">${esc((X.loc[norm(n)] || {}).t || '')}</span></td><td style="white-space:nowrap"><button class="btn sm ghost" data-act="oMv" data-i="${i}" data-d="-1" type="button"${i ? '' : ' disabled'}>↑</button><button class="btn sm ghost" data-act="oMv" data-i="${i}" data-d="1" type="button"${i < ORD.length - 1 ? '' : ' disabled'}>↓</button><input type="number" min="1" max="${ORD.length}" value="${i + 1}" data-ch="oPos" data-i="${i}" style="width:62px" title="Mover a la posición"></td></tr>`).join('')}</tbody></table></div>
    <div class="acts"><button class="btn" data-act="oCancel" type="button">Cancelar</button><button class="btn pri" data-act="oSave" type="button">Guardar orden</button></div>`);
}
Object.assign(ACT, {
  oMv: b => { const i = +b.dataset.i, j = i + +b.dataset.d; [ORD[i], ORD[j]] = [ORD[j], ORD[i]]; const st = $('#modalBox .tw').scrollTop; orderModal(); $('#modalBox .tw').scrollTop = st; },
  oCancel: () => { ORD = null; closeModal(); },
  oSave: async b => { b.disabled = true; try { const r = await api('api_g_locOrder', ORD); ORD = null; D.locs = r.locs; recompute(); closeModal(); render(); toast('Orden guardado: los códigos se recalcularon'); } catch (e) { toast(errMsg(e), true); b.disabled = false; } }
});
INP.oPos = el => { const i = +el.dataset.i, j = Math.max(0, Math.min(ORD.length - 1, (+el.value || 1) - 1)); const [x] = ORD.splice(i, 1); ORD.splice(j, 0, x); orderModal(); };
INP.uImpFile = async el => {
  const f = el.files[0]; if (!f) return; const out = $('#uImpOut'); out.innerHTML = '<div class="hint">Leyendo…</div>';
  try {
    const rows = await leerTabla(f, { n: ['ubicacion', 'ubicación', 'nombre'], t: ['tipo'], z: ['edificio', 'edificio / zona', 'zona'], a: ['activa'] });
    const res = await api('api_g_locImport', rows, false); UI._locImp = rows;
    out.innerHTML = `<div class="banner in" style="margin-top:8px">${res.nuevas.length} nueva(s) · ${res.cambios.length} con cambios · ${res.errores.length} aviso(s)</div>
      <div class="tw" style="max-height:40vh"><table class="t"><tbody>${res.nuevas.map(x => `<tr><td><span class="chip new">Nueva</span></td><td><b>${esc(x.n)}</b></td><td>${esc(x.t)} · ${esc(x.z)} · ${x.a ? 'Activa' : 'Inactiva'}</td></tr>`).join('')}${res.cambios.map(x => `<tr><td><span class="chip in">Cambia</span></td><td><b>${esc(x.n)}</b></td><td>${esc(x.antes)} → ${esc(x.t)} · ${esc(x.z)} · ${x.a ? 'Sí' : 'No'}</td></tr>`).join('')}${res.errores.map(x => `<tr><td><span class="chip bad">Fila ${x.fila}</span></td><td colspan="2">${esc(x.msg)}</td></tr>`).join('')}</tbody></table></div>
      ${res.nuevas.length + res.cambios.length ? '<div class="acts"><button class="btn pri" data-act="uImpGo" type="button">Aplicar cambios</button></div>' : '<div class="hint">No hay nada que cambiar.</div>'}`;
  } catch (e) { out.innerHTML = `<div class="banner bad">${esc(errMsg(e))}</div>`; }
};
ACT.uImpGo = async b => { b.disabled = true; try { const r = await api('api_g_locImport', UI._locImp, true); D.locs = r.locs; recompute(); closeModal(); render(); toast(`${r.nuevas.length} nuevas · ${r.cambios.length} actualizadas`); } catch (e) { toast(errMsg(e), true); b.disabled = false; } };
/** Lee la primera hoja de un Excel/CSV y devuelve filas con las claves de map (busca encabezados por nombre). */
async function leerTabla(file, map) {
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]], A = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
  const hi = A.findIndex(r => r.some(c => Object.values(map).some(alts => alts.includes(norm(c).toLowerCase()))));
  if (hi < 0) throw new Error('No encontré los encabezados. La primera fila debe tener: ' + Object.values(map).map(a => a[0]).join(', '));
  const H = A[hi].map(c => norm(c).toLowerCase()), col = {};
  Object.keys(map).forEach(k => { col[k] = H.findIndex(h => map[k].includes(h)); });
  return A.slice(hi + 1).filter(r => r.some(c => String(c).trim())).map(r => { const o = {}; Object.keys(map).forEach(k => o[k] = col[k] >= 0 ? String(r[col[k]] ?? '').trim() : ''); return o; });
}
/* ---------- imprimir varias ubicaciones ---------- */
function batchModal() {
  const A = UI.actas, L = ordenLista().filter(l => (l.a || l.nueva) && (!A.solo || l.cerrada || A.sel[norm(l.n)])), us = selUbics(), rp = resumenPaquete(us);
  modal(`<h2>Imprimir varias ubicaciones</h2><div class="row"><label class="row hint"><input type="checkbox" data-ch="bSolo"${A.solo ? ' checked' : ''}> Solo cerradas</label><button class="btn sm" data-act="bAll" type="button">Marcar todas las cerradas</button><button class="btn sm ghost" data-act="bNone" type="button">Quitar selección</button></div>
    <div class="tw" style="max-height:45vh"><table class="t"><tbody>${L.map(l => { const k = norm(l.n), rs = respOf(l.n); return `<tr><td><input type="checkbox" data-ch="bSel" data-u="${esc(l.n)}"${A.sel[k] ? ' checked' : ''}></td><td><b>${esc(l.n)}</b></td><td>${estChip(l)}</td><td>${rs.length ? rs.length + ' firma(s)' : '<span class="chip wa">Sin responsable</span>'}</td><td>${(l.fotos || []).length ? '<span class="chip ok">foto ✓</span>' : '<span class="chip bad">sin foto</span>'}</td></tr>`; }).join('') || '<tr><td class="empty">No hay ubicaciones cerradas.</td></tr>'}</tbody></table></div>
    <div class="callout"><b>${us.length} ubicación(es)</b> · ${rp.juegos} juegos · ${rp.hojas} hojas. Se usan las opciones de impresión de la pestaña Documentos.</div>
    <div class="acts"><button class="btn" data-close type="button">Cerrar</button><button class="btn" data-act="bGo" data-m="prev" type="button"${us.length ? '' : ' disabled'}>👁 Vista previa</button><button class="btn" data-act="bGo" data-m="pdf" type="button"${us.length ? '' : ' disabled'}>☁ PDF en Drive</button><button class="btn pri" data-act="bGo" data-m="print" type="button"${us.length ? '' : ' disabled'}>🖨 Registrar e imprimir</button></div>`);
}
const selUbics = () => ordenLista().filter(l => UI.actas.sel[norm(l.n)]).map(l => l.n);
INP.bSel = el => { const k = norm(el.dataset.u); if (el.checked) UI.actas.sel[k] = 1; else delete UI.actas.sel[k]; batchModal(); };
INP.bSolo = el => { UI.actas.solo = el.checked; batchModal(); };
ACT.bAll = () => { D.locs.forEach(l => { if (l.cerrada) UI.actas.sel[norm(l.n)] = 1; }); batchModal(); };
ACT.bNone = () => { UI.actas.sel = {}; batchModal(); };
ACT.bGo = b => imprimirJuegos(selUbics(), b, b.dataset.m);
INP.aOpt = el => { UI.actas[el.dataset.o][el.dataset.k] = el.checked; refreshUDet(); };
INP.aCopO = el => { UI.actas.oO.copias = +el.value; refreshUDet(); };
INP.aDet = el => { UI.actas.det = el.value; refreshUDet(); };
INP.aFir = el => { UI.actas.firmas = +el.value; };
INP.aPap = el => { UI.actas.papel = el.value; };
INP.aPort = el => { UI.actas.portada = el.checked; refreshUDet(); };
INP.aOtro = debounce(el => { UI.actas.otros[+el.dataset.i] = el.value; }, 250);
INP.uFirm = async el => {
  const f = el.files[0]; if (!f) return;
  if (f.size > 10 * 1024 * 1024) { toast('Máximo 10 MB.', true); return; }
  toast('Subiendo acta firmada…');
  try {
    const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(f); });
    const r = await api('api_g_actaFirmada', el.dataset.f, b64, f.type || 'application/pdf', f.name); D.actas = r.actas; derive(); refreshUDet(); toast('Acta firmada guardada en Drive y juegos marcados como firmados');
  } catch (e) { toast(errMsg(e), true); }
};

/* ===================== PERSONAS (directorio de responsables) ===================== */
function duiCheck(s) { const m = String(s || '').replace(/\s/g, '').match(/^(\d{8})-?(\d)$/); if (!m) return s ? 'formato' : 'vacio'; let t = 0; for (let i = 0; i < 8; i++) t += +m[1][i] * (9 - i); return (10 - t % 10) % 10 === +m[2] ? 'ok' : 'verificador'; }
MODS.personas = {
  extra() { return `<button class="btn sm" data-act="pTpl" type="button">📄 Plantilla</button><button class="btn sm" data-act="pExp" type="button">⬇ Descargar todo</button>${isAdmin() ? '<button class="btn sm" data-act="pImpOpen" type="button">⬆ Cargar Excel</button>' : ''}<button class="btn sm pri" data-act="pNew" type="button">+ Nueva persona</button>`; },
  html() {
    const P = D.personas || [], s = UI.per, q = norm(s.q);
    const sinU = p => !(X.perUb[p.id] || []).length;
    const f = { act: p => p.estado !== 'Baja', sindui: p => p.estado !== 'Baja' && !p.dui, sinu: p => p.estado !== 'Baja' && sinU(p), baja: p => p.estado === 'Baja' };
    const L = P.filter(p => f[s.f](p) && (!q || [p.n, p.dui, p.nip, p.cargo, p.correo, p.tel, (X.perUb[p.id] || []).map(x => x.u).join(' ')].some(x => norm(x).includes(q))));
    const ch = [['act', 'Activos'], ['sindui', 'Sin DUI'], ['sinu', 'Sin ubicación'], ['baja', 'Dados de baja']];
    return `<div class="row"><input type="search" data-in="pQ" value="${esc(s.q)}" placeholder="🔎 Nombre, DUI, NIP, cargo o ubicación…" style="width:380px;max-width:100%">${ch.map(([k, t]) => `<button type="button" class="chip ${s.f === k ? 'in' : ''}" data-act="pF" data-k="${k}" style="border:0;cursor:pointer">${t} ${P.filter(f[k]).length}</button>`).join('')}</div>
      <div class="tw tall" id="pT">${this.table(L)}</div>
      <div class="grid g3"><div class="callout"><b>Carga masiva:</b> descargue la plantilla, llénela en Excel (nombre, DUI, NIP, cargo, teléfono, correo, ubicación, rol, copias) y súbala. Antes de guardar se muestra qué es nuevo, qué se actualiza y qué tiene errores.</div>
      <div class="callout"><b>Validaciones:</b> DUI con formato 00000000-0 y dígito verificador; no se repite DUI ni NIP; nombres en mayúsculas.</div>
      <div class="callout"><b>Si una persona cambia de aula:</b> quítela de una ubicación y agréguela en la otra; las actas ya impresas conservan el nombre con que se firmaron.</div></div>`;
  },
  table(L) {
    if (!L.length) return '<div class="empty">Nadie con ese filtro. Use “+ Nueva persona” o “⬆ Cargar Excel”.</div>';
    return `<table class="t"><thead><tr><th>Nombre</th><th>DUI</th><th>NIP</th><th>Cargo</th><th>Teléfono</th><th>Correo</th><th>Firma en</th><th>Estado</th><th></th></tr></thead><tbody>${L.map(p => { const ub = X.perUb[p.id] || [], dk = duiCheck(p.dui); return `<tr class="click" data-act="pEdit" data-id="${esc(p.id)}"><td><div class="row" style="gap:8px;flex-wrap:nowrap"><span class="av">${esc(initials(p.n))}</span><b>${esc(p.n)}</b></div></td>
      <td class="code">${esc(p.dui) || '<span class="chip wa">falta</span>'}${dk === 'verificador' ? ' <span class="chip bad" title="El dígito verificador no coincide">¿?</span>' : ''}</td><td class="code">${esc(p.nip) || '—'}</td><td>${esc(p.cargo)}</td><td class="code">${esc(p.tel)}</td><td class="hint">${esc(p.correo)}</td>
      <td>${ub.map(x => `<span class="chip" style="margin:1px">${esc(x.u)} · ${esc(x.rol.toLowerCase())}</span>`).join('') || '<span class="hint">—</span>'}</td><td>${p.estado === 'Baja' ? '<span class="chip">Baja</span>' : '<span class="chip ok">Activo</span>'}</td><td>✎</td></tr>`; }).join('')}</tbody></table>`;
  }
};
INP.pQ = debounce(el => { UI.per.q = el.value; const P = D.personas || [], q = norm(el.value); render(); const i = $('[data-in="pQ"]'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250);
Object.assign(ACT, {
  pF: b => { UI.per.f = b.dataset.k; render(); },
  pNew: b => personaModal(null, b.dataset.u, b.dataset.n),
  pEdit: b => personaModal((D.personas || []).find(p => p.id === b.dataset.id)),
  pTpl: async b => { b.disabled = true; try { descarga(await api('api_g_tablas', 'Plantilla personas', [{ t: 'PERSONAS', head: PER_HEAD, rows: [['PROFA. NOMBRE APELLIDO APELLIDO', '00000000-0', '1234567', 'Docente turno mañana', '7000-0000', 'correo@ejemplo.com', 'A8', 'Responsable', '1', 'Activo']] }])); } catch (e) { toast(errMsg(e), true); } b.disabled = false; },
  pExp: async b => { b.disabled = true; try { const P = D.personas || []; descarga(await api('api_g_tablas', 'Personas', [{ t: 'PERSONAS', head: PER_HEAD, rows: P.flatMap(p => { const ub = X.perUb[p.id] || []; return (ub.length ? ub : [null]).map(x => [p.n, p.dui, p.nip, p.cargo, p.tel, p.correo, x ? x.u : '', x ? x.rol : '', x ? String(x.copias) : '', p.estado]); }) }])); } catch (e) { toast(errMsg(e), true); } b.disabled = false; },
  pImpOpen: () => modal(`<h2>Cargar personas desde Excel</h2><p class="hint" style="margin:0">Columnas: <b>Nombre</b>, DUI, NIP, Cargo, Teléfono, Correo, Ubicación, Rol, Copias, Estado. Una fila por persona y ubicación (si firma en dos aulas, dos filas). Se reconoce a cada persona por DUI, luego NIP y luego nombre.</p><input type="file" accept=".xlsx,.xls,.csv" data-ch="pImpFile"><div id="pImpOut"></div><div class="acts"><button class="btn" data-close type="button">Cerrar</button></div>`)
});
const PER_HEAD = ['Nombre', 'DUI', 'NIP', 'Cargo', 'Teléfono', 'Correo', 'Ubicación', 'Rol', 'Copias', 'Estado'];
INP.pImpFile = async el => {
  const f = el.files[0]; if (!f) return; const out = $('#pImpOut'); out.innerHTML = '<div class="hint">Leyendo…</div>';
  try {
    const rows = await leerTabla(f, { n: ['nombre', 'nombre completo'], dui: ['dui'], nip: ['nip'], cargo: ['cargo'], tel: ['telefono', 'teléfono'], correo: ['correo', 'email', 'correo electronico'], ubic: ['ubicacion', 'ubicación', 'aula'], rol: ['rol', 'rol en el acta'], copias: ['copias'], estado: ['estado'] });
    const res = await api('api_g_personasImport', rows, false); UI._perImp = rows;
    out.innerHTML = `<div class="banner in" style="margin-top:8px">${res.nuevas.length} nueva(s) · ${res.cambios.length} actualizada(s) · ${res.asign.length} asignación(es) a ubicaciones · ${res.errores.length} con error o aviso</div>
      <div class="tw" style="max-height:40vh"><table class="t"><tbody>${res.errores.map(x => `<tr><td><span class="chip ${/^Aviso/.test(x.msg) ? 'wa' : 'bad'}">Fila ${x.fila}</span></td><td>${esc(x.n)}</td><td>${esc(x.msg)}</td></tr>`).join('')}${res.nuevas.map(x => `<tr><td><span class="chip new">Nueva</span></td><td><b>${esc(x.n)}</b></td><td class="mono">${esc(x.c.dui)} ${esc(x.c.nip)}</td></tr>`).join('')}${res.cambios.map(x => `<tr><td><span class="chip in">Actualiza</span></td><td><b>${esc(x.n)}</b></td><td class="mono">${esc(x.c.dui)} ${esc(x.c.nip)}</td></tr>`).join('')}${res.asign.map(x => `<tr><td><span class="chip ok">Firma en</span></td><td>${esc(x.n)}</td><td>${esc(x.u)} · ${esc(x.rol)}</td></tr>`).join('')}</tbody></table></div>
      ${res.nuevas.length + res.cambios.length ? `<div class="acts"><button class="btn pri" data-act="pImpGo" type="button">Guardar ${res.nuevas.length + res.cambios.length} persona(s)${res.errores.length ? ' (las filas con error en rojo se omiten)' : ''}</button></div>` : ''}`;
  } catch (e) { out.innerHTML = `<div class="banner bad">${esc(errMsg(e))}</div>`; }
};
ACT.pImpGo = async b => { b.disabled = true; try { const r = await api('api_g_personasImport', UI._perImp, true); D.personas = r.personas; D.resp = r.resp; derive(); closeModal(); render(); toast(`${r.nuevas.length} nuevas · ${r.cambios.length} actualizadas · ${r.asign.length} asignaciones`); } catch (e) { toast(errMsg(e), true); b.disabled = false; } };
function personaModal(p, addTo, nombre) {
  const v = p || { n: (nombre || '').toUpperCase(), dui: '', nip: '', cargo: '', tel: '', correo: '', estado: 'Activo', nota: '' };
  modal(`<h2>${p ? 'Editar persona' : 'Nueva persona'}${addTo ? ' <span class="hint">· se agrega a ' + esc(addTo) + '</span>' : ''}</h2>
    <div class="grid g2"><div class="field" style="grid-column:1/-1"><span class="lbl">Nombre completo (con título)</span><input type="text" id="peN" value="${esc(v.n)}" placeholder="PROFA. ANA MARÍA LÓPEZ" style="text-transform:uppercase"></div>
    <div class="field"><span class="lbl">DUI</span><input type="text" id="peD" value="${esc(v.dui)}" placeholder="00000000-0" class="mono" data-in="peDui"><span class="hint" id="peDm"></span></div><div class="field"><span class="lbl">NIP</span><input type="text" id="peI" value="${esc(v.nip)}" placeholder="Solo números" class="mono"></div>
    <div class="field"><span class="lbl">Cargo</span><input type="text" id="peC" value="${esc(v.cargo)}" placeholder="Docente turno mañana"></div><div class="field"><span class="lbl">Teléfono</span><input type="text" id="peT" value="${esc(v.tel)}"></div>
    <div class="field"><span class="lbl">Correo</span><input type="text" id="peE" value="${esc(v.correo)}"></div><div class="field"><span class="lbl">Estado</span><select id="peS"><option${v.estado !== 'Baja' ? ' selected' : ''}>Activo</option><option${v.estado === 'Baja' ? ' selected' : ''}>Baja</option></select></div>
    <div class="field" style="grid-column:1/-1"><span class="lbl">Nota</span><input type="text" id="peO" value="${esc(v.nota)}"></div></div>
    ${p && (X.perUb[p.id] || []).length ? `<p class="hint" style="margin:0">Firma en: ${esc(X.perUb[p.id].map(x => x.u + ' (' + x.rol + ')').join(', '))}</p>` : ''}
    <div class="acts"><button class="btn" data-close type="button">Cancelar</button><button class="btn pri" id="peSave" type="button">Guardar</button></div>`);
  const chk = () => { const r = duiCheck($('#peD').value), m = $('#peDm'); m.textContent = r === 'ok' ? '✓ DUI válido' : r === 'verificador' ? '⚠ El dígito verificador no coincide' : r === 'formato' ? 'Formato: 00000000-0' : ''; m.style.color = r === 'ok' ? 'var(--ok)' : 'var(--wa)'; };
  $('#peD').addEventListener('input', chk); chk();
  const save = async force => {
    $('#peSave').disabled = true;
    try {
      const r = await api('api_g_persona', { id: p ? p.id : '', n: $('#peN').value, dui: $('#peD').value, nip: $('#peI').value, cargo: $('#peC').value, tel: $('#peT').value, correo: $('#peE').value, estado: $('#peS').value, nota: $('#peO').value, force });
      D.personas = r.personas; D.resp = r.resp; derive();
      if (addTo) { UI.ubic.sel = addTo; const L = respOf(addTo).slice(); L.push({ pid: r.id, rol: L.some(x => x.rol === 'Responsable') ? 'Corresponsable' : 'Responsable', copias: 1 }); await saveResp(L); }
      closeModal(); if (MOD === 'personas') render(); else refreshUDet(); toast(p ? 'Persona actualizada' : 'Persona creada');
    } catch (e) {
      const m = String((e && e.message) || e);
      if (/DUIVERIF\||NOMBRE\|/.test(m)) { const txt = m.replace(/^.*?(DUIVERIF|NOMBRE)\|/, ''); const box = document.createElement('div'); box.className = 'banner wa'; box.innerHTML = `${esc(txt)} <button class="btn sm" type="button">Guardar de todos modos</button>`; $('#modalBox .acts').before(box); box.querySelector('button').onclick = () => { box.remove(); save(true); }; $('#peSave').disabled = false; }
      else { toast(errMsg(e), true); $('#peSave').disabled = false; }
    }
  };
  $('#peSave').onclick = () => save(false);
}
