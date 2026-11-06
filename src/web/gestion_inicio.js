/* ===================== INICIO · calendario, agenda, bloc de notas y buscador global ===================== */
const ymdL = d => { const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
const HOY = () => ymdL(new Date());
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'], MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const CAL = { y: new Date().getFullYear(), m: new Date().getMonth(), sel: HOY() };
const semanaISO = d => { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const dn = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - dn); const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - y0) / 86400000 + 1) / 7); };
const diaAnio = d => Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
function horaTxt(d) { let h = d.getHours(), m = String(d.getMinutes()).padStart(2, '0'); const ap = h >= 12 ? 'p. m.' : 'a. m.'; h = h % 12 || 12; return [h + ':' + m, ap]; }
/** Eventos del sistema que no escribe nadie: actas sin firmar, revisiones, etiquetas que cambiaron. */
function autoEventos() {
  const out = [], now = Date.now(), dias = ms => Math.floor((now - ms) / 86400000);
  const fol = {}; D.actas.forEach(a => { (fol[a.folio] = fol[a.folio] || []).push(a); });
  Object.values(fol).forEach(js => {
    const pend = js.filter(a => !a.firm); if (!pend.length) return;
    const ent = pend.filter(a => a.ent), base = ent.length ? Math.max(...ent.map(a => a.ent)) : js[0].gen, d = dias(base);
    if (d >= 3) out.push({ t: `${js[0].u}: ${ent.length ? 'acta entregada' : 'acta impresa'} hace ${d} días sin firmar`, s: pend.map(a => a.juego === 'Original' ? 'original' : shortName(a.dest)).join(', '), go: 'ubic', u: js[0].u, tipo: 'acta' });
  });
  D.locs.filter(l => l.enRev).forEach(l => out.push({ t: `${l.n} espera revisión`, s: l.rev && l.rev.sol ? 'pidió ' + l.rev.sol.por + ' · ' + dt(l.rev.sol.t).slice(-5) : '', go: 'ubic', u: l.n, tipo: 'rev' }));
  if (X.etqChanges.length) out.push({ t: `${X.etqChanges.length} código(s) etiquetado(s) cambiaron`, s: [...new Set(X.etqChanges.map(x => x.u))].join(', ') + ' · revisar antes de seguir', go: 'codigos', tipo: 'etq' });
  if (X.alerts.length) out.push({ t: `${X.alerts.length} alerta(s) en el conteo`, s: 'registros sin código o con datos por corregir', go: 'conteo', tipo: 'alert' });
  const sinR = D.locs.filter(l => l.cerrada && !respOf(l.n).length); if (sinR.length) out.push({ t: `${sinR.length} ubicación(es) cerradas sin responsable`, s: sinR.slice(0, 6).map(l => l.n).join(', '), go: 'ubic', u: sinR[0].n, tipo: 'resp' });
  return out;
}
function actividades() { return (D.notas || []).filter(n => n.tipo === 'actividad'); }
function marcasDia() {
  const m = {}, add = (d, k) => { if (!d) return; (m[d] = m[d] || new Set()).add(k); };
  D.regs.forEach(r => add(String(r.fecha).slice(0, 10), 'conteo'));
  D.locs.forEach(l => { if (l.rev && l.rev.res && l.rev.res.tipo === 'cerrada') add(ymdL(new Date(l.rev.res.t)), 'cierre'); });
  D.actas.forEach(a => { add(ymdL(new Date(a.gen)), 'actas'); if (a.firm) add(ymdL(new Date(a.firm)), 'actas'); });
  const hoy = HOY(); actividades().forEach(n => add(n.fecha, !n.hecho && n.fecha < hoy ? 'vence' : 'act'));
  return m;
}
/* ---------- v9.0: panel combinado (avance + siguiente paso + pasos + atención agrupada) ---------- */
const AL_CAT = [[/Serie repetida/i, 'serie repetida'], [/otra ubicación/i, 'otra ubicación'], [/no exist/i, 'etiqueta que no existe'], [/otra familia/i, 'etiqueta de otra familia'],
  [/ya registrad|ya está registrada/i, 'etiqueta ya usada'], [/Bloque repetido/i, 'bloque repetido'], [/no se reconoce|Indique qué bien/i, 'bien sin identificar'], [/otro bloque|cantidad debe|Sin cantidades/i, 'cantidad'], [/Falta/i, 'faltan datos']];
function iniDatos() {
  const st = { cerrada: 0, revision: 0, proceso: 0, pendiente: 0 }; X.act.forEach(l => st[X.estado(l)]++);
  const tot = X.act.length || 1, now = Date.now(), dias = ms => Math.floor((now - ms) / 86400000);
  const pend = D.actas.filter(a => !a.firm), porU = new Map();
  pend.forEach(a => { const base = a.ent || a.gen, x = porU.get(a.u) || { u: a.u, n: 0, d: 0 }; x.n++; x.d = Math.max(x.d, dias(base)); porU.set(a.u, x); });
  const actasU = [...porU.values()].sort((a, b) => b.d - a.d || b.n - a.n);
  const cats = new Map(); X.alerts.forEach(r => { const c = (AL_CAT.find(x => x[0].test(r.V)) || [0, 'otras'])[1]; cats.set(c, (cats.get(c) || 0) + 1); });
  const enRev = D.locs.filter(l => l.enRev), sinR = D.locs.filter(l => l.cerrada && !respOf(l.n).length);
  let cg = null; try { if (typeof cgAll === 'function' && X.hasBase) { const A = cgAll(); if (A.n) cg = A; } } catch (e) {}
  return { st, tot, actasU, nActas: pend.length, cats, enRev, sinR, cg };
}
/** Qué toca hacer ahora, en orden de prioridad. */
function iniPasos(I) {
  const L = [];
  if (X.etqChanges.length) L.push({ s: 'rev', t: `Revisar ${fmtN(X.etqChanges.length)} código(s) ya etiquetados que cambiaron`, act: 'etqChanges', b: 'Ver cuáles' });
  if (I.enRev.length) L.push({ s: 'rev', t: `Revisar y cerrar ${I.enRev.length} ubicación(es) en revisión: ${I.enRev.slice(0, 3).map(l => l.n).join(', ')}`, go: 'ubic', u: I.enRev[0].n, b: 'Revisar' });
  if (X.alerts.length) L.push({ s: 'corr', t: `Corregir las ${fmtN(X.alerts.length)} alertas del conteo`, go: 'conteo', b: 'Ir al conteo' });
  const viejas = I.actasU.filter(x => x.d >= 7);
  if (viejas.length) L.push({ s: 'actas', t: `Recoger firmas: ${viejas.slice(0, 3).map(x => `${x.u} (${x.d} días)`).join(', ')}${viejas.length > 3 ? ` y ${viejas.length - 3} más` : ''}`, go: 'ubic', u: viejas[0].u, b: 'Ver actas' });
  if (I.st.proceso + I.st.pendiente) L.push({ s: 'contar', t: `Terminar de contar: ${I.st.proceso + I.st.pendiente} ubicación(es) sin cerrar`, go: 'ubic', b: 'Ver ubicaciones' });
  if (I.nActas && !viejas.length) L.push({ s: 'actas', t: `Recoger firmas de ${fmtN(I.nActas)} acta(s)`, go: 'ubic', u: I.actasU[0].u, b: 'Ver actas' });
  if (I.cg && I.cg.n - I.cg.carg) L.push({ s: 'rep', t: `Cargo masivo SIGES: ${fmtN(I.cg.ok)} de ${fmtN(I.cg.n - I.cg.carg)} bienes nuevos listos`, go: 'cargo', b: 'Abrir' });
  if (!L.length) L.push({ s: 'rep', t: 'Todo al día: generar reportes finales', go: 'reportes', b: 'Reportes' });
  return L;
}
const iniBtn = (x, cls) => x.act ? `<button class="btn ${cls || ''}" type="button" data-act="${x.act}">${esc(x.b)} →</button>` : `<button class="btn ${cls || ''}" type="button" data-act="iniGo" data-go="${x.go}" data-u="${esc(x.u || '')}">${esc(x.b)} →</button>`;
MODS.inicio = {
  html() {
    const now = new Date(), [h, ap] = horaTxt(now), I = iniDatos(), P = iniPasos(I), st = I.st, tot = I.tot;
    const sal = now.getHours() < 12 ? '☀ Buenos días' : now.getHours() < 19 ? '🌤 Buenas tardes' : '🌙 Buenas noches', w = n => (n / tot * 100).toFixed(1) + '%';
    const pc = Math.round(st.cerrada / tot * 100), cur = P[0].s, A = this.atn(I);
    const step = (k, n, lbl, big, sub, pct, color, go) => `<button type="button" class="ist${cur === k ? ' now' : ''}" data-act="iniGo" data-go="${go}" style="--c:${color}"><span class="n">${n} · ${lbl}</span><b>${big}</b><small>${sub}</small><i><u style="width:${Math.max(0, Math.min(100, pct))}%"></u></i></button>`;
    const contados = tot - st.pendiente, nAct = D.actas.length;
    return `<div class="ihero"><div class="iclk"><small>${sal}, ${esc(shortName(ME.nombre || ''))}</small><div class="t" id="clk">${h} <span>${ap}</span></div><div>${DIAS[now.getDay()].replace(/^./, c => c.toUpperCase())}, ${now.getDate()} de ${MESES[now.getMonth()]}</div><small>Semana ${semanaISO(now)} · ${esc(BASE.cfg.periodo || 'Conteo físico')}</small></div>
      <div class="iprog"><div class="row"><span>Avance del conteo</span><span style="flex:1"></span><b>${st.cerrada}</b>&nbsp;de ${X.act.length} ubicaciones cerradas · <b>&nbsp;${pc}%</b></div>
        <div class="ibar"><u style="width:${w(st.cerrada)};background:#5BC08A"></u><u style="width:${w(st.revision)};background:#6FA3E0"></u><u style="width:${w(st.proceso)};background:#F0B05A"></u></div>
        <div class="ileg"><span style="--c:#5BC08A">Cerradas ${st.cerrada}</span><span style="--c:#6FA3E0">En revisión ${st.revision}</span><span style="--c:#F0B05A">Contando ${st.proceso}</span><span style="--c:rgba(255,255,255,.3)">Sin empezar ${st.pendiente}</span></div></div>
      <div class="inext"><small>👉 Siguiente paso</small><b>${esc(P[0].t)}</b>${P[1] ? `<small>Después: ${esc(P[1].t)}</small>` : ''}${iniBtn(P[0], 'pri sm')}</div></div>
    <div class="isteps">${step('contar', 1, 'Contar', `${contados}<small> / ${X.act.length}</small>`, `${fmtN(R.cons.bienes)} bienes contados`, contados / tot * 100, 'var(--ac)', 'conteo')}
      ${step('corr', 2, 'Corregir', `<em style="color:${X.alerts.length ? 'var(--bad)' : 'var(--ok)'}">${fmtN(X.alerts.length)}</em>`, X.alerts.length ? 'alertas por resolver' : 'sin alertas', R.logical.length ? (1 - X.alerts.length / R.logical.length) * 100 : 100, 'var(--bad)', 'conteo')}
      ${step('rev', 3, 'Revisar', `${st.revision + X.etqChanges.length}`, st.revision ? 'ubicación(es) en revisión' : X.etqChanges.length ? 'códigos que cambiaron' : 'nada pendiente', st.revision || X.etqChanges.length ? 30 : 100, 'var(--in)', 'ubic')}
      ${step('cerrar', 4, 'Cerrar', `${st.cerrada}<small> / ${X.act.length}</small>`, 'ubicaciones cerradas', pc, 'var(--ok)', 'ubic')}
      ${step('actas', 5, 'Actas', `<em style="color:${I.nActas ? 'var(--wa)' : 'var(--ok)'}">${fmtN(I.nActas)}</em>`, I.nActas ? 'sin firmar' : 'todas firmadas', nAct ? (1 - I.nActas / nAct) * 100 : 0, '#7A4FB5', 'ubic')}
      ${step('rep', 6, 'Reportes', fmtN(R.descargos.tot.codigos), `a descargo · ${money(R.descargos.tot.valor)}`, I.cg ? I.cg.ok / Math.max(1, I.cg.n) * 100 : 0, 'var(--navy2, #5B7BB0)', 'reportes')}</div>
    <div class="igrid2"><div class="card icol"><div class="ich"><h2>Requiere atención</h2><span class="chip ${A.length ? 'bad' : 'ok'}">${A.length ? A.length + ' grupo' + (A.length > 1 ? 's' : '') : '✔'}</span></div><div class="iscroll">${A.join('') || '<div class="hint">Nada pendiente. 🎉</div>'}</div></div>
      <div class="card icol" id="agCard">${this.agenda()}</div>
      <div class="card icol" id="calCard">${this.cal()}</div></div>`;
  },
  atn(I) {
    const it = (ic, cls, t, sub, x) => `<div class="iat"><span class="ic ${cls}">${ic}</span><div><b>${t}</b><small>${sub}</small></div>${iniBtn(x, 'sm ghost')}</div>`, o = [];
    if (X.etqChanges.length) o.push(it('⚠', 'r', `${fmtN(X.etqChanges.length)} código(s) etiquetados cambiaron`, [...new Set(X.etqChanges.map(x => x.u))].slice(0, 6).join(', ') + ' · revisar antes de seguir', { act: 'etqChanges', b: 'Ver' }));
    if (X.alerts.length) o.push(it('⚠', 'r', `${fmtN(X.alerts.length)} alertas en el conteo`, [...I.cats].sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} ${n}`).join(' · '), { go: 'conteo', b: 'Corregir' }));
    if (I.enRev.length) o.push(it('🔔', 'b', `${I.enRev.length} ubicación(es) esperan revisión`, I.enRev.map(l => l.n + (l.rev && l.rev.sol ? ` (pidió ${l.rev.sol.por})` : '')).join(', '), { go: 'ubic', u: I.enRev[0].n, b: 'Revisar' }));
    if (I.nActas) o.push(it('✍', 'y', `${fmtN(I.nActas)} acta(s) sin firmar`, I.actasU.slice(0, 4).map(x => `${x.u} · ${x.d} día${x.d === 1 ? '' : 's'}${x.n > 1 ? ` (${x.n} juegos)` : ''}`).join(' · ') + (I.actasU.length > 4 ? ` · y ${I.actasU.length - 4} ubicaciones más` : ''), { go: 'ubic', u: I.actasU[0].u, b: 'Ver actas' }));
    if (I.sinR.length) o.push(it('👤', 'y', `${I.sinR.length} ubicación(es) cerradas sin responsable`, I.sinR.slice(0, 8).map(l => l.n).join(', '), { go: 'ubic', u: I.sinR[0].n, b: 'Asignar' }));
    if (I.st.proceso + I.st.pendiente) o.push(it('📍', 'b', `${I.st.proceso + I.st.pendiente} ubicación(es) sin cerrar`, `${I.st.proceso} contando · ${I.st.pendiente} sin empezar`, { go: 'ubic', b: 'Ver' }));
    if (I.cg && I.cg.n - I.cg.carg) o.push(it('📤', I.cg.err ? 'y' : 'g', `Cargo SIGES: ${fmtN(I.cg.ok)} de ${fmtN(I.cg.n - I.cg.carg)} listos`, I.cg.err ? `${fmtN(I.cg.err)} bienes nuevos con datos pendientes` : 'listos para descargar el Excel', { go: 'cargo', b: 'Abrir' }));
    return o;
  },
  cal() {
    const y = CAL.y, m = CAL.m, first = new Date(y, m, 1), start = new Date(y, m, 1 - ((first.getDay() + 6) % 7)), marks = marcasDia(), hoy = HOY();
    let cells = ''; for (let i = 0; i < 42; i++) { const d = new Date(start); d.setDate(start.getDate() + i); const k = ymdL(d), mk = marks[k];
      cells += `<button type="button" class="cd${d.getMonth() !== m ? ' o' : ''}${k === hoy ? ' t' : ''}${k === CAL.sel ? ' s' : ''}" data-act="calDay" data-d="${k}">${d.getDate()}${mk ? `<i>${[...mk].slice(0, 4).map(x => `<u class="${x}"></u>`).join('')}</i>` : ''}</button>`; }
    return `<div class="row"><button class="btn sm ghost" data-act="calMv" data-d="-1" type="button">◀</button><b style="font-size:15px">${MESES[m].replace(/^./, c => c.toUpperCase())} ${y}</b><button class="btn sm ghost" data-act="calMv" data-d="1" type="button">▶</button><span style="flex:1"></span><button class="btn sm" data-act="calHoy" type="button">Hoy</button></div>
      <div class="cal">${['LU', 'MA', 'MI', 'JU', 'VI', 'SÁ', 'DO'].map(d => `<b>${d}</b>`).join('')}${cells}</div>
      <div class="legend"><span><i style="background:var(--ac)"></i>conteo</span><span><i style="background:var(--ok)"></i>cierre</span><span><i style="background:var(--in)"></i>actas</span><span><i style="background:#7A4FB5"></i>actividad</span><span><i style="background:var(--bad)"></i>vencida</span></div>
`;
  },
  agenda() {
    const d = CAL.sel, esHoy = d === HOY(), dd = new Date(d + 'T12:00:00'), L = actividades().filter(n => n.fecha === d).sort((a, b) => (a.hora || '99') < (b.hora || '99') ? -1 : 1);
    const auto = [], atr = esHoy ? actividades().filter(n => !n.hecho && n.fecha < d) : [];
    const avisos = [[-1, 'Sin aviso'], [0, 'A la hora'], [5, '5 min antes'], [15, '15 min antes'], [30, '30 min antes'], [60, '1 hora antes'], [1440, '1 día antes']];
    const item = n => `<div class="ev${n.hecho ? ' done' : ''}"><input type="checkbox" data-ch="agDone" data-id="${esc(n.id)}"${n.hecho ? ' checked' : ''}><span class="h">${esc(n.hora || '—')}</span><div style="flex:1;min-width:0"><b>${esc(n.texto)}</b><small>${n.comp ? '👥 compartida · ' : ''}${esc(n.por)}${n.vinc ? ' · 🔗 ' + esc(n.vinc) : ''}${n.fecha !== d ? ' · <span style="color:var(--bad)">era para el ' + esc(dmy(n.fecha)) + '</span>' : ''}</small>
      <div class="row" style="gap:6px;margin-top:4px"><select data-ch="agAviso" data-id="${esc(n.id)}" title="Recordatorio">${avisos.map(([v, t]) => `<option value="${v}"${(n.aviso ?? -1) == v ? ' selected' : ''}>🔔 ${t}</option>`).join('')}</select><button class="btn sm ghost bad" data-act="agDel" data-id="${esc(n.id)}" type="button" title="Borrar">✕ Borrar</button></div></div></div>`;
    const prox = []; for (let i = 1; i <= 7; i++) { const d = new Date(); d.setDate(d.getDate() + i); const k = ymdL(d); actividades().filter(n => n.fecha === k && !n.hecho).forEach(n => prox.push(`<div class="ev sm" data-act="calDay" data-d="${k}"><span class="h">${DIAS[d.getDay()].slice(0, 3).toUpperCase()} ${d.getDate()}</span><div><b>${esc(n.texto)}</b>${n.hora ? `<small>${esc(n.hora)}</small>` : ''}</div></div>`)); }
    return `<div class="ich"><h2 style="margin:0">${esHoy ? 'Agenda de hoy' : 'Agenda del ' + DIAS[dd.getDay()] + ' ' + dmy(d)}</h2><span class="meta">${L.filter(n => !n.hecho).length} pendiente(s)</span></div>
      <div class="row" style="flex-wrap:nowrap"><input type="text" id="agIn" placeholder="Escriba: “jueves 9am contar bodega 1”, “mañana 10:30 entregar actas A10”…" style="flex:1;min-width:0"><label class="row hint" style="gap:4px;flex-wrap:nowrap" title="La ven todos los supervisores"><input type="checkbox" id="agComp" checked> 👥</label><button class="btn sm pri" data-act="agAdd" type="button">+</button></div>
      <div class="hint" id="agPrev"></div>
      <div class="evs iscroll">${atr.map(item).join('')}${L.map(item).join('')}${auto.map(a => `<div class="ev auto" data-act="agGo" data-go="${a.go}" data-u="${esc(a.u || '')}" role="button"><span class="h">⚙</span><div style="flex:1;min-width:0"><b>${esc(a.t)}</b><small>Automático · ${esc(a.s)}</small></div><span class="hint">→</span></div>`).join('')}
      ${!L.length && !auto.length && !atr.length ? '<div class="hint">Sin actividades para este día. Escriba arriba para agregar una.</div>' : ''}
      ${esHoy ? `<h3 class="iph">Próximos 7 días</h3>${prox.join('') || '<div class="hint">Nada programado para los próximos días.</div>'}` : ''}</div>`;
  },
  after() { const i = $('#agIn'); if (i) i.addEventListener('input', () => { const p = parseActividad(i.value); $('#agPrev').textContent = i.value.trim() ? `→ ${p.fecha ? DIAS[new Date(p.fecha + 'T12:00:00').getDay()] + ' ' + dmy(p.fecha) : ''}${p.hora ? ' a las ' + p.hora : ''} · “${p.texto}”` : ''; });
    if (i) i.addEventListener('keydown', e => { if (e.key === 'Enter') ACT.agAdd(); }); }
};
MODS.tablero = MODS.inicio;
/** “jueves 9am contar bodega 1” → {fecha, hora, texto} */
function parseActividad(s) {
  let t = ' ' + String(s || '').trim() + ' ', fecha = '', hora = '';
  const base = new Date(); base.setHours(12, 0, 0, 0);
  const sel = new Date(CAL.sel + 'T12:00:00');
  const take = re => { const m = t.match(re); if (m) t = t.replace(m[0], ' '); return m; };
  let m;
  if ((m = take(/\s(pasado\s+mañana)\s/i))) { const d = new Date(base); d.setDate(d.getDate() + 2); fecha = ymdL(d); }
  else if ((m = take(/\s(mañana)\s/i))) { const d = new Date(base); d.setDate(d.getDate() + 1); fecha = ymdL(d); }
  else if ((m = take(/\s(hoy)\s/i))) fecha = ymdL(base);
  else if ((m = take(/\s(?:el\s+)?(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)(?:\s+pr[oó]ximo)?\s/i))) {
    const idx = DIAS.findIndex(d => norm(d) === norm(m[1])), d = new Date(base); let add = (idx - d.getDay() + 7) % 7; if (add === 0) add = 7; d.setDate(d.getDate() + add); fecha = ymdL(d);
  } else if ((m = take(/\s(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\s/))) {
    let y = m[3] ? +m[3] : base.getFullYear(); if (y < 100) y += 2000; const d = new Date(y, +m[2] - 1, +m[1], 12); if (!m[3] && d < base) d.setFullYear(y + 1); fecha = ymdL(d);
  } else if ((m = take(/\s(?:el\s+)(\d{1,2})\s/i))) { const d = new Date(base); d.setDate(+m[1]); if (d < base) d.setMonth(d.getMonth() + 1); fecha = ymdL(d); }
  if ((m = take(/\s(?:a\s+las\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|a\.\s?m\.|pm|p\.\s?m\.)\s/i))) { let h = +m[1] % 12; if (/p/i.test(m[3])) h += 12; hora = String(h).padStart(2, '0') + ':' + (m[2] || '00'); }
  else if ((m = take(/\s(?:a\s+las\s+)?(\d{1,2}):(\d{2})\s/i))) hora = String(+m[1]).padStart(2, '0') + ':' + m[2];
  else if ((m = take(/\s(?:a\s+las\s+)(\d{1,2})\s/i))) { let h = +m[1]; if (h < 7) h += 12; hora = String(h).padStart(2, '0') + ':00'; }
  return { fecha: fecha || ymdL(sel), hora, texto: t.replace(/\s+/g, ' ').trim() };
}
Object.assign(ACT, {
  calMv: b => { CAL.m += +b.dataset.d; if (CAL.m < 0) { CAL.m = 11; CAL.y--; } if (CAL.m > 11) { CAL.m = 0; CAL.y++; } $('#calCard').innerHTML = MODS.inicio.cal(); },
  calHoy: () => { const d = new Date(); CAL.y = d.getFullYear(); CAL.m = d.getMonth(); CAL.sel = HOY(); $('#calCard').innerHTML = MODS.inicio.cal(); $('#agCard').innerHTML = MODS.inicio.agenda(); MODS.inicio.after(); },
  calDay: b => { CAL.sel = b.dataset.d; const d = new Date(CAL.sel + 'T12:00:00'); CAL.y = d.getFullYear(); CAL.m = d.getMonth(); $('#calCard').innerHTML = MODS.inicio.cal(); $('#agCard').innerHTML = MODS.inicio.agenda(); MODS.inicio.after(); },
  agAdd: async () => {
    const i = $('#agIn'); if (!i || !i.value.trim()) return; const p = parseActividad(i.value);
    if (!p.texto) { toast('Escriba qué actividad es.', true); return; }
    i.disabled = true;
    try { const r = await api('api_g_nota', { tipo: 'actividad', texto: p.texto, fecha: p.fecha, hora: p.hora, aviso: p.hora ? 15 : -1, comp: $('#agComp').checked }); D.notas = r.notas; derive(); render(); toast(`Agendado: ${dmy(p.fecha)}${p.hora ? ' ' + p.hora : ''}`); }
    catch (e) { toast(errMsg(e), true); i.disabled = false; }
  },
  agDel: b => confirmModal('¿Borrar esta actividad?', 'Borrar', async () => { const r = await api('api_g_notaDel', b.dataset.id); D.notas = r.notas; derive(); render(); }),
  iniGo: b => { const g = b.dataset.go, u = b.dataset.u; if (g === 'conteo') { UI.conteo.f = X.alerts.length ? 'alerta' : ''; UI.conteo.u = ''; } if (g === 'ubic' && u) { UI.ubic.sel = u; UI.ubic.tab = 'docs'; } go(g); },
  agGo: b => { if (b.dataset.u) UI.ubic.sel = b.dataset.u; if (b.dataset.go === 'ubic') UI.ubic.tab = 'docs'; if (b.dataset.go === 'conteo') { UI.conteo.f = 'alerta'; UI.conteo.u = ''; } go(b.dataset.go); }
});
async function notaPatch(id, patch) { const n = (D.notas || []).find(x => x.id === id); if (!n) return; const r = await api('api_g_nota', Object.assign({}, n, patch)); D.notas = r.notas; derive(); }
INP.agDone = async el => { try { await notaPatch(el.dataset.id, { hecho: el.checked }); if (MOD === 'inicio') render(); } catch (e) { toast(errMsg(e), true); } };
INP.agAviso = async el => { try { await notaPatch(el.dataset.id, { aviso: +el.value }); toast('Recordatorio actualizado'); } catch (e) { toast(errMsg(e), true); } };
/* recordatorios mientras la página está abierta */
setInterval(() => {
  if (!D || !$('#clk')) {} else { const [h, ap] = horaTxt(new Date()); $('#clk').innerHTML = `${h} <span>${ap}</span>`; }
  if (!D) return;
  const now = Date.now(), seen = new Set(LS.get('avisados', []));
  actividades().forEach(n => {
    if (n.hecho || !n.hora || n.aviso == null || n.aviso < 0) return;
    const t = new Date(n.fecha + 'T' + n.hora + ':00').getTime(), k = n.id + '|' + n.fecha + n.hora + '|' + n.aviso;
    if (now >= t - n.aviso * 60000 && now < t + 3600000 && !seen.has(k)) {
      seen.add(k); LS.set('avisados', [...seen].slice(-200));
      toast(`🔔 ${n.hora} · ${n.texto}`);
      try { if (window.Notification && Notification.permission === 'granted') new Notification('Recordatorio · ' + n.hora, { body: n.texto }); } catch (e) {}
    }
  });
}, 20000);

/* ---------- BLOC (borrador · pendientes · notas) ---------- */
const BLOC = { tab: 'borrador', pre: null };
function blocBadge() { const e = $('#blocN'); if (e) { e.textContent = X.pend || ''; e.hidden = !X.pend; } }
function toggleBloc() { if (!$('#bloc').hidden) { $('#bloc').hidden = true; return; } openBloc(BLOC.tab); }
function openBloc(tab, pre) { BLOC.tab = tab || BLOC.tab; BLOC.pre = pre || null; renderBloc(); $('#bloc').hidden = false; const f = $('#bloc textarea, #bloc input[type=text]'); if (f) f.focus(); }
function misNotas(t) { return (D.notas || []).filter(n => n.tipo === t && (n.uid === ME.id || n.comp)); }
function renderBloc() {
  const t = BLOC.tab, bor = (D.notas || []).find(n => n.tipo === 'borrador' && n.uid === ME.id), pend = misNotas('pendiente'), notas = misNotas('nota').sort((a, b) => (b.fijada - a.fijada) || (b.mod - a.mod));
  const colores = ['', '#FFF4C2', '#DDF0E3', '#E2EBF5', '#FCE1E1', '#EEE2F7'];
  let body = '';
  if (t === 'borrador') body = `<textarea id="blBor" class="paperish" placeholder="Escriba aquí lo que sea: se guarda solo. Ctrl+Shift+N abre y cierra el bloc.">${esc(bor ? bor.texto : '')}</textarea><div class="hint" id="blSt">${bor ? 'Guardado ' + dt(bor.mod).slice(-5) : ''}</div>`;
  if (t === 'pendientes') body = `<div class="row" style="flex-wrap:nowrap"><input type="text" id="blPin" placeholder="Nuevo pendiente…" style="flex:1;min-width:0" value="${esc(BLOC.pre && BLOC.tab === 'pendientes' ? BLOC.pre.texto : '')}"><button class="btn sm pri" data-act="blPAdd" type="button">+</button></div>
    ${pend.sort((a, b) => a.hecho - b.hecho).map(n => `<div class="tk${n.hecho ? ' done' : ''}"><input type="checkbox" data-ch="blPDone" data-id="${esc(n.id)}"${n.hecho ? ' checked' : ''}><span style="flex:1">${esc(n.texto)}${n.vinc ? ` <button type="button" class="chip" data-act="blGo" data-v="${esc(n.vinc)}" style="border:0;cursor:pointer">🔗 ${esc(n.vinc)}</button>` : ''}</span><button class="btn sm ghost" data-act="blToAg" data-id="${esc(n.id)}" type="button" title="Pasar a la agenda">📅</button><button class="btn sm ghost bad" data-act="blDel" data-id="${esc(n.id)}" type="button">✕</button></div>`).join('') || '<div class="hint">Sin pendientes.</div>'}`;
  if (t === 'notas') body = `<div class="nform"><textarea id="blNin" rows="3" placeholder="Nueva nota…">${esc(BLOC.pre ? BLOC.pre.texto : '')}</textarea><div class="row"><input type="text" id="blNv" placeholder="🔗 Vincular a código o ubicación (opcional)" value="${esc(BLOC.pre ? BLOC.pre.vinc : '')}" style="flex:1;min-width:0"><label class="hint row" style="gap:4px"><input type="checkbox" id="blNc"> 👥 compartida</label><button class="btn sm pri" data-act="blNAdd" type="button">Guardar nota</button></div></div>
    ${notas.map(n => `<div class="nota" style="background:${n.color || 'var(--sf)'}"><div style="white-space:pre-wrap">${esc(n.texto)}</div><div class="row hint" style="gap:6px;margin-top:6px">${n.fijada ? '📌 ' : ''}${esc(n.por)} · ${esc(dt(n.mod))}${n.vinc ? ` · <button type="button" class="chip" data-act="blGo" data-v="${esc(n.vinc)}" style="border:0;cursor:pointer">🔗 ${esc(n.vinc)}</button>` : ''}${n.comp ? ' · 👥' : ''}<span style="flex:1"></span>
      ${colores.map(c => `<button type="button" class="dot" style="background:${c || '#fff'}" data-act="blColor" data-id="${esc(n.id)}" data-c="${c}" title="Color"></button>`).join('')}<button class="btn sm ghost" data-act="blPin" data-id="${esc(n.id)}" type="button">${n.fijada ? 'Desfijar' : '📌 Fijar'}</button><button class="btn sm ghost" data-act="blToAg" data-id="${esc(n.id)}" type="button">📅 Agenda</button><button class="btn sm ghost bad" data-act="blDel" data-id="${esc(n.id)}" type="button">✕</button></div></div>`).join('') || '<div class="hint">Sin notas.</div>'}`;
  $('#bloc').innerHTML = `<div class="row"><b>✏ Bloc</b><span class="hint">Ctrl+Shift+N</span><span style="flex:1"></span><button class="btn sm ghost" data-act="blClose" type="button">✕</button></div>
    <div class="tabs">${[['borrador', '✏ Borrador'], ['pendientes', `☐ Pendientes (${pend.filter(n => !n.hecho).length})`], ['notas', `📄 Notas (${notas.length})`]].map(([k, x]) => `<button type="button" data-act="blTab" data-k="${k}" class="${t === k ? 'on' : ''}">${x}</button>`).join('')}</div><div class="blbody">${body}</div>`;
  const ta = $('#blBor'); if (ta) ta.addEventListener('input', blAuto);
  const pi = $('#blPin'); if (pi) pi.addEventListener('keydown', e => { if (e.key === 'Enter') ACT.blPAdd(); });
  BLOC.pre = null;
}
const blAuto = debounce(async () => { const ta = $('#blBor'); if (!ta) return; $('#blSt').textContent = 'Guardando…'; try { const r = await api('api_g_nota', { tipo: 'borrador', texto: ta.value }); D.notas = r.notas; $('#blSt').textContent = 'Guardado ' + horaTxt(new Date()).join(' '); } catch (e) { $('#blSt').textContent = errMsg(e); } }, 900);
async function blSave(o) { const r = await api('api_g_nota', o); D.notas = r.notas; derive(); renderBloc(); blocBadge(); if (MOD === 'inicio') { $('#agCard').innerHTML = MODS.inicio.agenda(); MODS.inicio.after(); $('#calCard').innerHTML = MODS.inicio.cal(); } }
Object.assign(ACT, {
  blClose: () => { $('#bloc').hidden = true; }, blTab: b => { BLOC.tab = b.dataset.k; renderBloc(); },
  blPAdd: async () => { const v = $('#blPin').value.trim(); if (!v) return; const m = v.match(/\b(\d{5}-\d{4}-\d{4}|[A-Z]\d{1,2})\b/); try { await blSave({ tipo: 'pendiente', texto: v, vinc: m ? m[1] : '' }); } catch (e) { toast(errMsg(e), true); } },
  blNAdd: async () => { const v = $('#blNin').value.trim(); if (!v) return; try { await blSave({ tipo: 'nota', texto: v, vinc: $('#blNv').value.trim(), comp: $('#blNc').checked }); toast('Nota guardada'); } catch (e) { toast(errMsg(e), true); } },
  blDel: async b => { try { const r = await api('api_g_notaDel', b.dataset.id); D.notas = r.notas; derive(); renderBloc(); blocBadge(); } catch (e) { toast(errMsg(e), true); } },
  blPin: async b => { const n = D.notas.find(x => x.id === b.dataset.id); try { await blSave(Object.assign({}, n, { fijada: !n.fijada })); } catch (e) { toast(errMsg(e), true); } },
  blColor: async b => { const n = D.notas.find(x => x.id === b.dataset.id); try { await blSave(Object.assign({}, n, { color: b.dataset.c })); } catch (e) { toast(errMsg(e), true); } },
  blToAg: b => { const n = D.notas.find(x => x.id === b.dataset.id); $('#bloc').hidden = true; CAL.sel = HOY(); go('inicio'); setTimeout(() => { const i = $('#agIn'); i.value = 'mañana 8:00 ' + n.texto.slice(0, 200); i.dispatchEvent(new Event('input')); i.focus(); }, 50); },
  blGo: b => { const v = b.dataset.v; $('#bloc').hidden = true; if (/^\d{5}-\d{4}-\d{4}$/.test(v)) { const ci = X.codBy[U(v)]; openFicha(ci != null ? fkeyCod(ci) : fkeyInv(v)); } else if (X.loc[norm(v)]) { UI.ubic.sel = v; go('ubic'); } }
});
INP.blPDone = async el => { const n = D.notas.find(x => x.id === el.dataset.id); try { await blSave(Object.assign({}, n, { hecho: el.checked })); } catch (e) { toast(errMsg(e), true); } };

/* ---------- BUSCADOR GLOBAL (Ctrl+K) ---------- */
const SR = { q: '', items: [], i: 0, all: {} };
function openSearch() { $('#srch').hidden = false; const i = $('#srQ'); i.value = SR.q; i.focus(); i.select(); srRun(); }
function closeSearch() { $('#srch').hidden = true; }
/* Búsqueda por palabras: todas deben aparecer (en cualquier orden). Los códigos se comparan también sin guiones. */
function srTokens(q) { return norm(q).split(' ').filter(Boolean); }
function srScore(toks, campos) {
  const txt = campos.map(norm).join(' | '), dig = campos.map(x => String(x ?? '').replace(/\D/g, '')).join('|');
  let sc = 0;
  for (const t of toks) {
    const td = t.replace(/\D/g, ''), esNum = td.length >= 3 && td.length === t.replace(/[-\s]/g, '').length;
    let ok = txt.includes(t) || (esNum && dig.includes(td));
    if (!ok) return 0;
    const n0 = norm(campos[0]);
    if (n0 === t || (esNum && String(campos[0] ?? '').replace(/\D/g, '') === td)) sc += 100;
    else if (n0.startsWith(t) || (' ' + n0).includes(' ' + t)) sc += 20;
    else if (n0.includes(t) || (esNum && String(campos[0] ?? '').replace(/\D/g, '').endsWith(td))) sc += 10;
    else sc += 3;
  }
  return sc;
}
function srMark(s, toks) {
  let h = esc(s); if (!toks.length) return h;
  const raw = String(s ?? ''), base = raw.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  const marks = new Array(raw.length).fill(false);
  toks.forEach(t => { let i = base.indexOf(t); while (t && i >= 0) { for (let k = i; k < i + t.length; k++) marks[k] = true; i = base.indexOf(t, i + 1); } });
  if (base.length !== raw.length || !marks.some(Boolean)) return h;
  let out = '', on = false;
  for (let k = 0; k < raw.length; k++) { if (marks[k] !== on) { out += marks[k] ? '<mark>' : '</mark>'; on = marks[k]; } out += esc(raw[k]); }
  return out + (on ? '</mark>' : '');
}
const SR_ORDEN = ['Bienes con código', 'Inventario anterior (a descargo)', 'Ubicaciones', 'Personas', 'Catálogo', 'Notas y agenda'];
function srRun() {
  SR.q = $('#srQ').value; const toks = srTokens(SR.q), out = [];
  const qlen = toks.join('').length;
  if (qlen >= 2) {
    const add = (sc, x) => { if (sc) { x.sc = sc; out.push(x); } };
    R.cod.forEach((c, i) => add(srScore(toks, [c.B, c.X, c.C, c.H, c.E, c.F]), { g: SR_ORDEN[0], key: fkeyCod(i), t: c.B, d: c.C.replace(/^🔒 /, ''), s: `${c.E} · ${c.R === 'NUEVO' ? '✚ Nuevo' : c.R === 'Reciclado' ? '↺ Reciclado' : '🔒 Conservado'} · ${c.F}${c.H ? ' · ' + c.H : ''}` }));
    R.inv.forEach(o => { if (o.R === 'Sin asignar') add(srScore(toks, [o.code, o.desc, o.serie, o.marca, o.modelo, o.asig, o.M]), { g: SR_ORDEN[1], key: fkeyInv(o.code), t: o.code, d: o.desc + (o.marca ? ' ' + o.marca : ''), s: `${o.M} · ⬇ descargo · ${money(o.valor)}${o.serie ? ' · S/N ' + o.serie : ''}` }); });
    D.locs.forEach(l => add(srScore(toks, [l.n, l.t, l.z, respOf(l.n).map(p => p.n).join(' ')]), { g: SR_ORDEN[2], ubic: l.n, t: l.n, d: [l.t, l.z].filter(Boolean).join(' · '), s: `${X.estado(l)} · ${sumL(X.byU[norm(l.n)] || [])} bienes · ${respOf(l.n).map(p => shortName(p.n)).join(', ') || 'sin responsable'}` }));
    (D.personas || []).forEach(p => add(srScore(toks, [p.n, p.cargo, p.dui, p.nip]), { g: SR_ORDEN[3], per: p.id, t: p.n, d: p.cargo, s: `${p.dui ? 'DUI ' + p.dui : 'sin DUI'}${p.nip ? ' · NIP ' + p.nip : ''} · ${(X.perUb[p.id] || []).map(x => x.u).join(', ') || 'sin ubicación'}` }));
    R.cat.forEach(c => { if (!c.blank) add(srScore(toks, [c.A, c.F, c.C]), { g: SR_ORDEN[4], blk: c.A, t: c.A + ' · ' + c.F, d: c.C, s: `${c.I} contados · ${c.M} en sistema` }); });
    (D.notas || []).forEach(n => { if (n.tipo !== 'borrador') add(srScore(toks, [n.texto, n.vinc]), { g: SR_ORDEN[5], nota: n, t: n.texto.slice(0, 80), d: n.tipo === 'actividad' ? dmy(n.fecha) + ' ' + (n.hora || '') : n.tipo, s: n.por }); });
  }
  // Grupos ordenados por su mejor coincidencia; dentro, por puntaje y luego por código/nombre.
  const grupos = {}; out.forEach(x => (grupos[x.g] = grupos[x.g] || []).push(x));
  Object.values(grupos).forEach(a => a.sort((x, y) => y.sc - x.sc || String(x.t).localeCompare(String(y.t), 'es', { numeric: true })));
  const orden = Object.keys(grupos).sort((a, b) => grupos[b][0].sc - grupos[a][0].sc || SR_ORDEN.indexOf(a) - SR_ORDEN.indexOf(b));
  const items = []; let html = '';
  orden.forEach(g => {
    const a = grupos[g], lim = SR.all[g] ? 200 : 6, vis = a.slice(0, lim);
    html += `<div class="g"><span>${esc(g)}</span><em>${a.length}</em></div>`;
    vis.forEach(x => { const i = items.length; items.push(x); html += `<div class="it" data-act="srPick" data-i="${i}"><div class="tx"><b class="${x.key ? 'mono' : ''}">${srMark(x.t, toks)}</b>${x.d ? `<span class="d">${srMark(x.d, toks)}</span>` : ''}<small>${srMark(x.s, toks)}</small></div><span class="ent">↵</span></div>`; });
    if (a.length > lim) html += `<button class="more" type="button" data-act="srMas" data-g="${esc(g)}">Ver los ${a.length} de ${esc(g.toLowerCase())} ▾</button>`;
    else if (SR.all[g] && a.length > 6) html += `<button class="more" type="button" data-act="srMas" data-g="${esc(g)}">Ver menos ▴</button>`;
  });
  SR.items = items; SR.i = Math.min(SR.i, Math.max(0, items.length - 1)); SR.tot = out.length;
  const L = $('#srL');
  L.innerHTML = qlen < 2 ? '<div class="srvacio">Escriba al menos 2 letras o números.<br><small>Puede combinar palabras: <b>mesa biblioteca</b>, <b>1121 15</b>, <b>silla A1</b>.</small></div>'
    : html || `<div class="srvacio">Sin resultados para “${esc(SR.q)}”.<br><small>Pruebe con menos palabras o solo una parte del código.</small></div>`;
  $('#srN').textContent = qlen < 2 ? '' : out.length + (out.length === 1 ? ' resultado' : ' resultados');
  srSel(SR.i, false);
}
function srSel(i, ver) {
  const its = $$('#srL .it'); SR.i = i;
  its.forEach((e, k) => e.classList.toggle('on', k === i));
  const el = its[i], L = $('#srL');
  if (el && ver) { const t = el.offsetTop, b = t + el.offsetHeight; if (t < L.scrollTop + 30) L.scrollTop = Math.max(0, t - 30); else if (b > L.scrollTop + L.clientHeight) L.scrollTop = b - L.clientHeight + 6; }
  srPreview();
}
function srPreview() {
  const x = SR.items[SR.i], p = $('#srP'); p.scrollTop = 0;
  if (!x) { p.innerHTML = '<div class="srvacio"><small>La ficha del resultado aparece aquí.</small></div>'; return; }
  if (x.key) { const f = fichaData(x.key); if (f) { p.innerHTML = fichaCompact(f).replace(/<button class="btn sm ghost" data-act="fclose"[^>]*>✕<\/button>/, ''); cargarFotos(p); } return; }
  const que = x.ubic ? 'Abrir la ubicación' : x.per ? 'Ver a la persona' : x.blk ? 'Ver en el catálogo' : 'Abrir';
  p.innerHTML = `<div class="srcard"><span class="lbl">${esc(x.g)}</span><h3>${esc(x.t)}</h3>${x.d ? `<p>${esc(x.d)}</p>` : ''}<p class="hint">${esc(x.s || '')}</p><button class="btn sm pri" type="button" data-act="srPick" data-i="${SR.i}">${que} →</button></div>`;
}
function srMove(d) { if (!SR.items.length) return; srSel(Math.max(0, Math.min(SR.items.length - 1, SR.i + d)), true); }
ACT.srMas = b => { const g = b.dataset.g; SR.all[g] = !SR.all[g]; srRun(); };
function srOpen(x) {
  closeSearch(); if (!x) return;
  if (x.key) { openFicha(x.key, SR.items.filter(y => y.key).map(y => y.key)); }
  else if (x.ubic) { UI.ubic.sel = x.ubic; go('ubic'); }
  else if (x.per) { go('personas'); setTimeout(() => personaModal((D.personas || []).find(p => p.id === x.per)), 50); }
  else if (x.blk) { UI.cat.q = x.blk; go('catalogo'); }
  else if (x.nota) { if (x.nota.tipo === 'actividad') { CAL.sel = x.nota.fecha; go('inicio'); } else openBloc(x.nota.tipo === 'pendiente' ? 'pendientes' : 'notas'); }
}
ACT.srPick = b => srOpen(SR.items[+b.dataset.i]);
ACT.srClose = () => closeSearch();
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { if (D && !$('#app').hidden) { e.preventDefault(); openSearch(); } }
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'n') { if (D && !$('#app').hidden) { e.preventDefault(); toggleBloc(); } }
  if (!$('#srch').hidden) { if (e.key === 'ArrowDown') { e.preventDefault(); srMove(1); } if (e.key === 'ArrowUp') { e.preventDefault(); srMove(-1); } if (e.key === 'Enter') { e.preventDefault(); srOpen(SR.items[SR.i]); } }
});
$('#srQ').addEventListener('input', debounce(() => { SR.i = 0; SR.all = {}; $('#srL').scrollTop = 0; srRun(); }, 120));
$('#srL').addEventListener('mousemove', e => { const it = e.target.closest('.it'); if (!it) return; const i = +it.dataset.i; if (i !== SR.i) srSel(i, false); });
$('#srch').addEventListener('mousedown', e => { if (e.target.id === 'srch') closeSearch(); });
