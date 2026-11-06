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
MODS.inicio = {
  html() {
    const now = new Date(), [h, ap] = horaTxt(now), ev = actividades().filter(n => n.fecha === HOY()), hechas = ev.filter(n => n.hecho).length;
    const atras = actividades().filter(n => !n.hecho && n.fecha < HOY()).length, st = { cerrada: 0, revision: 0, proceso: 0, pendiente: 0 }; X.act.forEach(l => st[X.estado(l)]++);
    const sinFirma = D.actas.filter(a => !a.firm).length, sal = now.getHours() < 12 ? '☀ Buenos días' : now.getHours() < 19 ? '🌤 Buenas tardes' : '🌙 Buenas noches';
    return `<div class="search-big" data-act="search" role="button">🔎 <span>Buscar bien, código, serie, ubicación o persona…</span><kbd>Ctrl + K</kbd></div>
    <div class="igrid">
      <div class="istack"><div class="clock"><small>Semana ${semanaISO(now)} · Día ${diaAnio(now)} del año</small><div class="t" id="clk">${h} <span>${ap}</span></div><div>${DIAS[now.getDay()].replace(/^./, c => c.toUpperCase())}, ${now.getDate()} de ${MESES[now.getMonth()]} de ${now.getFullYear()}</div><small>${sal} · ${esc(BASE.cfg.periodo || 'Conteo físico')}</small>
        <div class="row" style="margin-top:10px;gap:20px"><div><b>${ev.length}</b><br><small>hoy</small></div><div><b>${hechas}</b><br><small>hechas</small></div><div><b>${atras}</b><br><small>atrasadas</small></div></div></div>
        <div class="card"><div class="kgrid">
          <div class="kpi" data-act="go" data-m="ubic" role="button"><span>Cerradas</span><b style="color:var(--ok)">${X.cerradas}<small style="display:inline;font-size:13px"> de ${X.act.length}</small></b></div>
          <div class="kpi" data-act="go" data-m="ubic" role="button"><span>En revisión</span><b style="color:var(--in)">${st.revision}</b></div>
          <div class="kpi" data-act="go" data-m="codigos" role="button"><span>Bienes contados</span><b>${fmtN(R.cons.bienes)}</b><small>${fmtN(R.cod.length)} códigos</small></div>
          <div class="kpi" data-act="go" data-m="ubic" role="button"><span>Actas sin firmar</span><b style="color:var(--wa)">${sinFirma}</b></div>
          <div class="kpi" data-act="go" data-m="conteo" role="button"><span>Alertas</span><b style="color:${X.alerts.length ? 'var(--bad)' : 'var(--ok)'}">${X.alerts.length}</b></div>
          <div class="kpi" data-act="go" data-m="reportes" role="button"><span>A descargar</span><b>${fmtN(R.descargos.tot.codigos)}</b><small>${money(R.descargos.tot.valor)}</small></div></div></div></div>
      <div class="card" id="calCard">${this.cal()}</div>
      <div class="card" id="agCard">${this.agenda()}</div>
    </div>`;
  },
  cal() {
    const y = CAL.y, m = CAL.m, first = new Date(y, m, 1), start = new Date(y, m, 1 - ((first.getDay() + 6) % 7)), marks = marcasDia(), hoy = HOY();
    let cells = ''; for (let i = 0; i < 42; i++) { const d = new Date(start); d.setDate(start.getDate() + i); const k = ymdL(d), mk = marks[k];
      cells += `<button type="button" class="cd${d.getMonth() !== m ? ' o' : ''}${k === hoy ? ' t' : ''}${k === CAL.sel ? ' s' : ''}" data-act="calDay" data-d="${k}">${d.getDate()}${mk ? `<i>${[...mk].slice(0, 4).map(x => `<u class="${x}"></u>`).join('')}</i>` : ''}</button>`; }
    const prox = []; for (let i = 1; i <= 7; i++) { const d = new Date(); d.setDate(d.getDate() + i); const k = ymdL(d); actividades().filter(n => n.fecha === k && !n.hecho).forEach(n => prox.push(`<div class="ev sm" data-act="calDay" data-d="${k}"><span class="h">${DIAS[d.getDay()].slice(0, 3).toUpperCase()} ${d.getDate()}</span><div><b>${esc(n.texto)}</b>${n.hora ? `<small>${esc(n.hora)}</small>` : ''}</div></div>`)); }
    return `<div class="row"><button class="btn sm ghost" data-act="calMv" data-d="-1" type="button">◀</button><b style="font-size:15px">${MESES[m].replace(/^./, c => c.toUpperCase())} ${y}</b><button class="btn sm ghost" data-act="calMv" data-d="1" type="button">▶</button><span style="flex:1"></span><button class="btn sm" data-act="calHoy" type="button">Hoy</button></div>
      <div class="cal">${['LU', 'MA', 'MI', 'JU', 'VI', 'SÁ', 'DO'].map(d => `<b>${d}</b>`).join('')}${cells}</div>
      <div class="legend"><span><i style="background:var(--ac)"></i>conteo</span><span><i style="background:var(--ok)"></i>cierre</span><span><i style="background:var(--in)"></i>actas</span><span><i style="background:#7A4FB5"></i>actividad</span><span><i style="background:var(--bad)"></i>vencida</span></div>
      <h2 style="margin-top:6px">Próximos 7 días</h2>${prox.join('') || '<div class="hint">Nada programado para los próximos días.</div>'}`;
  },
  agenda() {
    const d = CAL.sel, esHoy = d === HOY(), dd = new Date(d + 'T12:00:00'), L = actividades().filter(n => n.fecha === d).sort((a, b) => (a.hora || '99') < (b.hora || '99') ? -1 : 1);
    const auto = esHoy ? autoEventos() : [], atr = esHoy ? actividades().filter(n => !n.hecho && n.fecha < d) : [];
    const avisos = [[-1, 'Sin aviso'], [0, 'A la hora'], [5, '5 min antes'], [15, '15 min antes'], [30, '30 min antes'], [60, '1 hora antes'], [1440, '1 día antes']];
    const item = n => `<div class="ev${n.hecho ? ' done' : ''}"><input type="checkbox" data-ch="agDone" data-id="${esc(n.id)}"${n.hecho ? ' checked' : ''}><span class="h">${esc(n.hora || '—')}</span><div style="flex:1;min-width:0"><b>${esc(n.texto)}</b><small>${n.comp ? '👥 compartida · ' : ''}${esc(n.por)}${n.vinc ? ' · 🔗 ' + esc(n.vinc) : ''}${n.fecha !== d ? ' · <span style="color:var(--bad)">era para el ' + esc(dmy(n.fecha)) + '</span>' : ''}</small>
      <div class="row" style="gap:6px;margin-top:4px"><select data-ch="agAviso" data-id="${esc(n.id)}" title="Recordatorio">${avisos.map(([v, t]) => `<option value="${v}"${(n.aviso ?? -1) == v ? ' selected' : ''}>🔔 ${t}</option>`).join('')}</select><button class="btn sm ghost bad" data-act="agDel" data-id="${esc(n.id)}" type="button" title="Borrar">✕ Borrar</button></div></div></div>`;
    return `<div class="row"><h2 style="margin:0">${esHoy ? 'Agenda de hoy' : 'Agenda del ' + DIAS[dd.getDay()] + ' ' + dmy(d)}</h2><span class="meta">${L.filter(n => !n.hecho).length} pendiente(s)</span></div>
      <div class="row" style="flex-wrap:nowrap"><input type="text" id="agIn" placeholder="Escriba: “jueves 9am contar bodega 1”, “mañana 10:30 entregar actas A10”…" style="flex:1;min-width:0"><label class="row hint" style="gap:4px;flex-wrap:nowrap" title="La ven todos los supervisores"><input type="checkbox" id="agComp" checked> 👥</label><button class="btn sm pri" data-act="agAdd" type="button">+</button></div>
      <div class="hint" id="agPrev"></div>
      <div class="evs">${atr.map(item).join('')}${L.map(item).join('')}${auto.map(a => `<div class="ev auto" data-act="agGo" data-go="${a.go}" data-u="${esc(a.u || '')}" role="button"><span class="h">⚙</span><div style="flex:1;min-width:0"><b>${esc(a.t)}</b><small>Automático · ${esc(a.s)}</small></div><span class="hint">→</span></div>`).join('')}
      ${!L.length && !auto.length && !atr.length ? '<div class="hint">Sin actividades para este día. Escriba arriba para agregar una.</div>' : ''}</div>`;
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
const SR = { q: '', items: [], i: 0 };
function openSearch() { $('#srch').hidden = false; const i = $('#srQ'); i.value = SR.q; i.focus(); i.select(); srRun(); }
function closeSearch() { $('#srch').hidden = true; }
function srRun() {
  const q = norm($('#srQ').value); SR.q = $('#srQ').value; const out = [];
  if (q.length >= 2) {
    const has = (...v) => v.some(x => norm(x).includes(q));
    R.cod.forEach((c, i) => { if (out.length < 400 && has(c.B, c.X, c.C, c.H, c.E)) out.push({ g: 'Bienes con código', key: fkeyCod(i), t: c.B, d: `${c.C.replace(/^🔒 /, '')}`, s: `${c.E} · ${c.R === 'NUEVO' ? '✚ Nuevo' : c.R === 'Reciclado' ? '↺ Reciclado' : '🔒 Conservado'} · ${c.F}${c.H ? ' · ' + c.H : ''}` }); });
    R.inv.forEach(o => { if (o.R === 'Sin asignar' && has(o.code, o.serie, o.desc, o.marca, o.modelo, o.asig)) out.push({ g: 'Inventario anterior (a descargo)', key: fkeyInv(o.code), t: o.code, d: o.desc + (o.marca ? ' ' + o.marca : ''), s: `${o.M} · ⬇ descargo · ${money(o.valor)}${o.serie ? ' · S/N ' + o.serie : ''}` }); });
    D.locs.forEach(l => { if (has(l.n, l.t, l.z) || respOf(l.n).some(p => has(p.n))) out.push({ g: 'Ubicaciones', ubic: l.n, t: l.n, d: [l.t, l.z].filter(Boolean).join(' · '), s: `${X.estado(l)} · ${sumL(X.byU[norm(l.n)] || [])} bienes · ${respOf(l.n).map(p => shortName(p.n)).join(', ') || 'sin responsable'}` }); });
    (D.personas || []).forEach(p => { if (has(p.n, p.dui, p.nip, p.cargo)) out.push({ g: 'Personas', per: p.id, t: p.n, d: p.cargo, s: `${p.dui ? 'DUI ' + p.dui : 'sin DUI'}${p.nip ? ' · NIP ' + p.nip : ''} · ${(X.perUb[p.id] || []).map(x => x.u).join(', ') || 'sin ubicación'}` }); });
    R.cat.forEach(c => { if (!c.blank && has(c.A, c.F)) out.push({ g: 'Catálogo', blk: c.A, t: c.A + ' · ' + c.F, d: c.C, s: `${c.I} contados · ${c.M} en sistema` }); });
    (D.notas || []).forEach(n => { if (n.tipo !== 'borrador' && has(n.texto, n.vinc)) out.push({ g: 'Notas y agenda', nota: n, t: n.texto.slice(0, 80), d: n.tipo === 'actividad' ? dmy(n.fecha) + ' ' + (n.hora || '') : n.tipo, s: n.por }); });
  }
  const lim = {}, items = out.filter(x => { lim[x.g] = (lim[x.g] || 0) + 1; return lim[x.g] <= 8; });
  SR.items = items; SR.i = 0; SR.tot = out.length;
  let g = '';
  $('#srL').innerHTML = q.length < 2 ? '<div class="hint" style="padding:14px">Escriba al menos 2 letras. Use ↑ ↓ y Enter para elegir · Esc para cerrar.</div>' : items.map((x, i) => { const h = x.g !== g ? `<div class="g">${esc(x.g)} (${out.filter(y => y.g === x.g).length})</div>` : ''; g = x.g; return h + `<div class="it${i === 0 ? ' on' : ''}" data-act="srPick" data-i="${i}"><div style="flex:1;min-width:0"><b class="${x.key ? 'mono' : ''}">${esc(x.t)}</b>${x.d ? ' · ' + esc(x.d) : ''}<small>${esc(x.s)}</small></div>${i === 0 ? '<span class="hint">Enter ↵</span>' : ''}</div>`; }).join('') || '<div class="hint" style="padding:14px">Sin resultados.</div>';
  srPreview();
}
function srPreview() { const x = SR.items[SR.i], p = $('#srP'); if (!x || !x.key) { p.innerHTML = '<div class="hint">La ficha del bien aparece aquí.</div>'; return; } const f = fichaData(x.key); if (f) { p.innerHTML = fichaCompact(f).replace(/<button class="btn sm ghost" data-act="fclose"[^>]*>✕<\/button>/, ''); cargarFotos(p); } }
function srMove(d) { const its = $$('#srL .it'); if (!its.length) return; SR.i = Math.max(0, Math.min(its.length - 1, SR.i + d)); its.forEach((e, i) => e.classList.toggle('on', i === SR.i)); its[SR.i].scrollIntoView({ block: 'nearest' }); srPreview(); }
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
$('#srQ').addEventListener('input', debounce(srRun, 120));
$('#srch').addEventListener('mousedown', e => { if (e.target.id === 'srch') closeSearch(); });
