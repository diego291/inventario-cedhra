/* ===================== GESTIÓN DE INVENTARIO · navegador ===================== */

const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LS = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
const U = s => String(s ?? '').toUpperCase();
const N0 = x => Number(x) || 0;
const fmtN = n => (Number(n) || 0).toLocaleString('es-SV');
const money = v => '$' + Motor.util.money(v);
const dmy = d => Motor.util.fmtDMY(d);
const pct = x => (Math.round((Number(x) || 0) * 1000) / 10) + '%';
const dt = ms => { if (!ms) return ''; const d = new Date(ms), p = n => String(n).padStart(2, '0'); return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`; };
const today = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`; };
const BASEURL = (window.APP_URL && !/^<\?/.test(window.APP_URL)) ? window.APP_URL : '';
const CAP_URL = BASEURL || '?', GES_URL = (BASEURL || '') + '?gestion';
const RECICLAR = 'Reciclar códigos anteriores';

/* ---------- llamadas al servidor ---------- */
function run(fn, ...a) {
  return new Promise((res, rej) => {
    if (!(window.google && google.script && google.script.run)) return rej({ message: 'Sin conexión con Google' });
    let done = false; const to = setTimeout(() => { if (!done) { done = true; rej({ message: 'El servidor tardó demasiado. Intente de nuevo.' }); } }, 330000);
    google.script.run.withSuccessHandler(v => { if (done) return; done = true; clearTimeout(to); res(v); })
      .withFailureHandler(e => { if (done) return; done = true; clearTimeout(to); rej(e); }).rpc(fn, a);
  });
}
function errMsg(e) { const m = String((e && e.message) || e || 'Error'); return m.replace(/^Error:\s*/, '').replace(/^(VAL|AUTH)\|/, ''); }
const isAuth = e => /^(Error:\s*)?AUTH\|/.test(String((e && e.message) || e));
async function api(fn, ...a) {
  try { return await run(fn, TOKEN, ...a); }
  catch (e) { if (isAuth(e)) { showLogin(errMsg(e)); } throw e; }
}
function toast(msg, bad) { const t = $('#toast'); t.textContent = msg; t.className = 'toast' + (bad ? ' bad' : ''); t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, bad ? 6000 : 3200); }
function modal(html) { $('#modalBox').innerHTML = html; $('#modal').hidden = false; }
function closeModal() { $('#modal').hidden = true; $('#modalBox').innerHTML = ''; }
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal' || e.target.closest('[data-close]')) closeModal(); });
function loadScript(url) { return new Promise((res, rej) => { if ($$('script').some(s => s.src === url)) return res(); const s = document.createElement('script'); s.src = url; s.onload = res; s.onerror = () => rej(new Error('No se pudo cargar ' + url)); document.head.appendChild(s); }); }

/* ---------- estado ---------- */
let TOKEN = LS.get('tok', ''), ME = null, D = null, BASE = null, R = null, X = null, MOD = LS.get('gmod', 'inicio');
const DEV = (() => { let d = LS.get('dev', ''); if (!/^[A-Za-z0-9]{20,}$/.test(d)) { const a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'; d = ''; const r = new Uint8Array(24); crypto.getRandomValues(r); r.forEach(x => d += a[x % a.length]); LS.set('dev', d); } return d; })();
const isAdmin = () => ME && ME.lvl >= 3;
const UI = { conteo: { u: '', f: '', q: '', sel: null, lim: 300 }, codigos: { u: '', o: '', q: '', lim: 400 }, conservar: { f: 'pend', q: '' }, inv: { r: '', y: '', q: '', u: '', lim: 300 },
  cat: { q: '', solo: false }, rep: 'cargos', cfg: 'importar', bus: '', ubic: { sel: '', q: '', f: '', tab: 'resp' }, per: { q: '', f: 'act' }, actas: { sel: {}, solo: true, oO: { ficha: true, acta: true, lista: false, copias: 1 }, oR: { ficha: true, acta: true, lista: false }, otros: [], det: 'bloque', firmas: 3, papel: 'Carta', portada: true, preview: false } };

function setSync(st, txt) { const s = $('#sync'); if (!s) return; s.className = 'sync' + (st === 'busy' ? ' busy' : st === 'err' ? ' err' : ''); s.textContent = txt; }

/* ---------- inicio de sesión ---------- */
function showLogin(msg) { $('#loading').hidden = true; $('#app').hidden = true; $('#login').hidden = false; $('#loginMsg').textContent = msg || ''; TOKEN = ''; LS.set('tok', ''); }
$('#btnLogin').onclick = async () => {
  const code = $('#inCode').value.trim(); if (!code) return;
  $('#btnLogin').disabled = true; $('#loginMsg').textContent = 'Verificando…';
  try {
    const r = await run('api_login', code, DEV, (navigator.platform || 'PC') + ' · Gestión');
    if (r.pending) { $('#loginMsg').textContent = r.msg; return; }
    TOKEN = r.token; LS.set('tok', TOKEN); $('#inCode').value = '';
    if ((r.me.lvl || 1) < 2) { $('#loginMsg').textContent = 'Este módulo es solo para supervisores y el administrador. Use la app de captura.'; return; }
    $('#login').hidden = true; start();
  } catch (e) { $('#loginMsg').textContent = errMsg(e); }
  finally { $('#btnLogin').disabled = false; }
};
$('#inCode').addEventListener('keydown', e => { if (e.key === 'Enter') $('#btnLogin').click(); });
$('#btnLogout').onclick = async () => { try { await run('api_logout', TOKEN); } catch (e) {} showLogin('Sesión cerrada.'); };
$('#lnkCap').href = CAP_URL; $('#lnkCapLogin').href = CAP_URL;

/* ---------- carga y cálculo ---------- */
async function load(quiet) {
  setSync('busy', 'Actualizando…');
  const cached = LS.get('gbase', null);
  const r = await api('api_g_data', cached && cached.base ? cached.gver : '');
  if (r.base) { BASE = r.base; try { localStorage.setItem('gbase', JSON.stringify({ gver: r.gver, base: r.base })); } catch (e) { try { localStorage.removeItem('gbase'); } catch (e2) {} } }
  else BASE = cached.base;
  D = r; ME = r.me;
  recompute();
  D.loadedAt = Date.now();
  setSync('ok', 'Sincronizado con la app de captura · ' + dt(D.now).slice(-5));
}
function recompute() {
  const t0 = performance.now();
  R = Motor.compute(Motor.fromApp(BASE, D.regs, D.locs));
  derive();
  R.ms = Math.round(performance.now() - t0);
}
/** Datos derivados que usan varios módulos. */
function derive() {
  X = {};
  X.hasBase = !!(BASE && BASE.inv && BASE.inv.length);
  X.loc = {}; D.locs.forEach(l => X.loc[norm(l.n)] = l);
  X.resp = {}; D.resp.forEach(p => (X.resp[norm(p.u)] = X.resp[norm(p.u)] || []).push(p)); Object.values(X.resp).forEach(a => a.sort((x, y) => x.orden - y.orden));
  X.rows = R.logical; X.byU = {}; X.logical = R.logical;
  R.logical.forEach(r => (X.byU[norm(r.C)] = X.byU[norm(r.C)] || []).push(r));
  X.codU = {}; R.cod.forEach(c => (X.codU[norm(c.E)] = X.codU[norm(c.E)] || []).push(c));
  X.alerts = R.logical.filter(r => r.V && r.V.charAt(0) !== 'ℹ');
  X.infos = R.logical.filter(r => r.V && r.V.charAt(0) === 'ℹ');
  X.z1 = {}; R.inv.forEach(o => { if (o.Z === 1) X.z1[U(o.N)] = (X.z1[U(o.N)] || 0) + 1; });
  X.nInv = {}; R.inv.forEach(o => X.nInv[U(o.N)] = (X.nInv[U(o.N)] || 0) + 1);
  X.reg = {}; D.regs.forEach(g => X.reg[g.id] = g);
  X.per = {}; (D.personas || []).forEach(p => X.per[p.id] = p);
  X.perUb = {}; D.resp.forEach(p => { if (p.pid) (X.perUb[p.pid] = X.perUb[p.pid] || []).push(p); });
  X.tras = {}; (D.traslados || []).forEach(t => (X.tras[U(t.code)] = X.tras[U(t.code)] || []).push(t));
  X.actU = {}; D.actas.forEach(a => (X.actU[norm(a.u)] = X.actU[norm(a.u)] || []).push(a));
  X.codBy = {}; R.cod.forEach((c, i) => X.codBy[U(c.B)] = i);
  X.invBy = {}; R.inv.forEach((o, i) => X.invBy[U(o.code)] = i);
  X.notaVinc = {}; (D.notas || []).forEach(n => { if (n.vinc) (X.notaVinc[U(n.vinc)] = X.notaVinc[U(n.vinc)] || []).push(n); });
  X.act = D.locs.filter(l => l.a || l.nueva);
  X.estado = l => l.cerrada ? 'cerrada' : l.enRev ? 'revision' : (X.byU[norm(l.n)] || []).length ? 'proceso' : 'pendiente';
  X.cerradas = X.act.filter(l => l.cerrada).length;
  X.preliminar = X.act.length > 0 && X.cerradas < X.act.length;
  X.byOrigen = { Conservado: 0, Reciclado: 0, NUEVO: 0 }; R.cod.forEach(c => X.byOrigen[c.R] = (X.byOrigen[c.R] || 0) + 1);
  // códigos ya etiquetados que cambiaron
  X.etq = {}; X.etqChanges = [];
  const key = {}; R.cod.forEach(c => { if (c.row && c.row.id) key[c.row.id + '|' + c.K] = c; });
  D.etq.forEach(s => {
    X.etq[norm(s.u)] = s;
    s.codes.forEach(([id, k, code]) => { const c = key[id + '|' + k]; if (!c || c.B !== code) X.etqChanges.push({ u: s.u, id, k, antes: code, ahora: c ? c.B : '(registro eliminado)', c }); });
    const now = (X.codU[norm(s.u)] || []).filter(c => !s.codes.some(x => x[0] === (c.row && c.row.id) && x[1] === c.K));
    now.forEach(c => X.etqChanges.push({ u: s.u, id: c.row && c.row.id, k: c.K, antes: '(no estaba)', ahora: c.B, c, nuevo: true }));
  });
  $('#nConteo').textContent = X.alerts.length || ''; $('#nConteo').className = 'n' + (X.alerts.length ? ' bad' : '');
  $('#nCod').textContent = R.cod.length ? fmtN(R.cod.length) : '';
  const pend = (D.notas || []).filter(n => n.tipo === 'pendiente' && !n.hecho && n.uid === ME.id).length; X.pend = pend;
  if (window.blocBadge) blocBadge();
}

/* ---------- navegación ---------- */
const MODS = {};
const TITLES = { inicio: ['Panel principal', 'Agenda, calendario y lo que requiere atención'], tablero: ['Panel principal', ''], buscador: ['Buscador', 'Un código, una serie o un bien: dónde está y qué código le toca'],
  ubic: ['Ubicaciones y actas', 'Todo de una ubicación en un solo lugar: datos, responsables, documentos e historial'], personas: ['Personas (responsables)', 'Una sola base de datos de quienes firman: se reutiliza en todas las ubicaciones y actas'],
  conteo: ['Conteo', 'Cada registro de la app con el código que le asigna la lógica del Excel'], codigos: ['Códigos asignados', 'Un código por bien, en el orden en que se etiquetan'],
  conservar: ['Conservar códigos', 'Códigos reservados del inventario anterior: bienes recientes, con serie o de bloques completos'],
  actas: ['Fichas y actas', 'Ficha consolidada + acta de entrega y resguardo, por ubicación'], reportes: ['Reportes', 'Cargos, descargos, etiquetas, reclasificación y consolidado'],
  catalogo: ['Catálogo', 'Bloques del catálogo con lo contado y lo que había'], inventario: ['Inventario anterior', 'Qué pasa con cada código del sistema'], config: ['Configuración', 'Datos base, reglas de códigos, responsables y textos del acta'] };
function go(m) { if (m === 'buscador') { openSearch(); return; } if (m === 'tablero' || m === 'actas') m = m === 'actas' ? 'ubic' : 'inicio'; MOD = MODS[m] ? m : 'inicio'; closeFicha(); LS.set('gmod', MOD); render(); window.scrollTo({ top: 0 }); }
$('#nav').addEventListener('click', e => { const b = e.target.closest('button[data-m]'); if (b) go(b.dataset.m); });
function header(extra) {
  const [t, s] = TITLES[MOD];
  return `<div class="top"><div><h1>${t}</h1><div class="sub">${s}</div></div><div class="right">${extra || ''}<button class="btn sm" data-act="search" type="button" title="Buscar (Ctrl+K)">🔎 Buscar <span class="kbd">Ctrl K</span></button><button class="btn sm blocbtn" data-act="bloc" type="button" title="Bloc de notas (Ctrl+Shift+N)">✏ Bloc<em id="blocN"${X.pend ? '' : ' hidden'}>${X.pend || ''}</em></button><span class="sync" id="sync">Sincronizado · ${D && D.now ? dt(D.now).slice(-5) : ''}</span><button class="btn sm" data-act="refresh" type="button">↻</button></div></div>`
    + (!X.hasBase && MOD !== 'config' ? `<div class="banner wa"><b>Faltan los datos base.</b> Importe una vez el Excel v10 (inventario anterior, catálogo y reglas) para que se calculen los códigos.<button class="btn sm dark" data-act="go" data-m="config" type="button">Ir a Configuración → Importar</button></div>` : '')
    + (X.etqChanges.length && ['inicio', 'codigos', 'ubic'].includes(MOD) ? `<div class="banner bad"><b>⚠ ${X.etqChanges.length} código(s) de ubicaciones ya etiquetadas cambiaron</b> por registros agregados o editados después. Revise antes de seguir etiquetando.<button class="btn sm" data-act="etqChanges" type="button">Ver cuáles</button></div>` : '');
}
function render() {
  $$('#nav button').forEach(b => b.classList.toggle('on', b.dataset.m === MOD));
  document.body.className = document.body.className.replace(/\bmod-\S+/g, '').trim() + ' mod-' + MOD;
  $('#main').innerHTML = header(MODS[MOD].extra ? MODS[MOD].extra() : '') + MODS[MOD].html();
  if (MODS[MOD].after) MODS[MOD].after();
}
const ACT = {
  refresh: async () => { try { await load(); render(); toast('Datos actualizados'); } catch (e) { setSync('err', 'Sin actualizar'); toast(errMsg(e), true); } },
  search: () => openSearch(), bloc: () => toggleBloc(),
  go: b => { if (b.dataset.u != null && b.dataset.m === 'conteo') { UI.conteo.u = b.dataset.u; UI.conteo.sel = b.dataset.row ? +b.dataset.row : null; } if (b.dataset.m === 'codigos' && b.dataset.u != null) UI.codigos.u = b.dataset.u; go(b.dataset.m); },
  etqChanges: () => modal(`<h2>Códigos que cambiaron después de etiquetar</h2><p class="hint">La numeración depende del orden de conteo (ubicación y bloque). Un registro nuevo en una ubicación anterior corre los números de las siguientes. Corrija el registro o vuelva a imprimir las etiquetas de esa ubicación y márquela de nuevo.</p>
    <div class="tw" style="max-height:60vh"><table class="t"><thead><tr><th>Ubicación</th><th>Bien</th><th>Etiquetado</th><th>Ahora</th></tr></thead><tbody>${X.etqChanges.slice(0, 500).map(x => `<tr><td>${esc(x.u)}</td><td>${esc(x.c ? x.c.C : '')}</td><td class="code">${esc(x.antes)}</td><td class="code"><b>${esc(x.ahora)}</b></td></tr>`).join('')}</tbody></table></div><div class="acts"><button class="btn" data-close type="button">Cerrar</button></div>`)
};
const skipClick = (e, b) => { const f = e.target.closest('select,input,textarea,a,label'); return f && f !== b && b.contains(f) && !f.hasAttribute('data-act'); };
$('#main').addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (!b || b.disabled || skipClick(e, b) || e.target.closest('.ovl')) return; const f = ACT[b.dataset.act]; if (f) { e.preventDefault(); f(b, e); } });
$('#modal').addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (!b || b.disabled) return; const f = ACT[b.dataset.act]; if (f) { e.preventDefault(); f(b, e); } });
const INP = {};
$('#main').addEventListener('input', e => { if (e.target.closest('.ovl')) return; const el = e.target.closest('[data-in]'); if (el && INP[el.dataset.in]) INP[el.dataset.in](el, e); });
$('#main').addEventListener('change', e => { if (e.target.closest('.ovl')) return; const el = e.target.closest('[data-ch]'); if (el && INP[el.dataset.ch]) INP[el.dataset.ch](el, e); });
$('#modal').addEventListener('change', e => { const el = e.target.closest('[data-ch]'); if (el && INP[el.dataset.ch]) INP[el.dataset.ch](el, e); });
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
const ubicOpts = (sel, todas = 'Todas las ubicaciones') => `<option value="">${todas}</option>` + D.locs.map(l => `<option value="${esc(l.n)}"${norm(sel) === norm(l.n) ? ' selected' : ''}>${esc(l.n)}${l.t ? ' · ' + esc(l.t) : ''}</option>`).join('')
  + R.logical.filter(r => r.C && !X.loc[norm(r.C)]).map(r => r.C).filter((v, i, a) => a.indexOf(v) === i).map(n => `<option value="${esc(n)}"${norm(sel) === norm(n) ? ' selected' : ''}>${esc(n)} (no está en la lista)</option>`).join('');
const estChip = l => { if (!l) return '<span class="chip bad">No está en la lista</span>'; const e = X.estado(l); return e === 'cerrada' ? '<span class="chip ok">✓ Cerrada</span>' : e === 'revision' ? '<span class="chip in">🔔 En revisión</span>' : e === 'proceso' ? '<span class="chip wa">En proceso</span>' : '<span class="chip">Pendiente</span>'; };
const origenChip = o => o === 'Conservado' ? '<span class="chip ok">🔒 Conservado</span>' : o === 'Reciclado' ? '<span class="chip in">↺ Reciclado</span>' : '<span class="chip new">✚ Nuevo</span>';
const alertHtml = v => !v ? '' : `<span class="alert${/^ℹ/.test(v) ? ' info' : /no existe|Serie repetida|Esa etiqueta ya|otra familia|no se reconoce|Falta|cantidad debe|otro bloque|ya registrad/i.test(v) ? ' bad' : ''}">${esc(v)}</span>`;
const sumL = rows => rows.reduce((a, r) => a + N0(r.L), 0);

const invChip = o => o.R === 'Conservado' ? '<span class="chip ok">🔒 Conservado</span>' : o.R === 'Reasignado' ? '<span class="chip in">↺ Reasignado</span>' : '<span class="chip bad">⬇ Descargo</span>';
const rango = r => !r.M ? '<span class="hint">—</span>' : (r.M === r.N ? esc(r.M) : esc(r.M) + '<br>' + esc(r.N));

/* ===================== CONTEO ===================== */
MODS.conteo = {
  list() {
    const s = UI.conteo, q = norm(s.q);
    return R.logical.filter(r => (!s.u || norm(r.C) === norm(s.u)) && (!q || [r.E, r.F, r.G, r.P, r.Q, r.U, r.M, r.N].some(x => norm(x).includes(q)))
      && (!s.f || (s.f === 'alerta' ? r.V && r.V.charAt(0) !== 'ℹ' : s.f === 'sin' ? !r.M : s.f === 'cons' ? r.AJ >= 0 && r.AF > 0 : s.f === 'reet' ? r.AR : true)));
  },
  html() {
    const s = UI.conteo, L = this.list(), sel = s.sel != null ? R.logical.find(r => r.ROW === s.sel) : null;
    const loc = s.u ? X.loc[norm(s.u)] : null;
    return `<div class="card"><div class="row">
      <div class="field"><span class="lbl">Ubicación</span><select data-ch="cU">${ubicOpts(s.u)}</select></div>
      <div class="field"><span class="lbl">Mostrar</span><select data-ch="cF">${[['', 'Todos'], ['alerta', 'Con alerta'], ['sin', 'Sin código'], ['cons', 'Conservan su código'], ['reet', 'Reetiquetar (otra familia)']].map(([v, t]) => `<option value="${v}"${s.f === v ? ' selected' : ''}>${t}</option>`).join('')}</select></div>
      <div class="field" style="flex:1;min-width:200px"><span class="lbl">Buscar</span><input type="search" data-in="cQ" value="${esc(s.q)}" placeholder="Bien, etiqueta, serie, código…"></div>
      <div class="hint" style="align-self:flex-end">${L.length} registros · ${fmtN(sumL(L))} bienes${loc ? ' · ' + estChip(loc) : ''}</div></div></div>
    <div class="grid g-main"><div id="cTable">${this.table(L)}</div><div class="card det" id="cDet">${sel ? this.detail(sel) : '<div class="hint">Toque un registro para ver por qué recibe esos códigos.</div>'}</div></div>`;
  },
  table(L) {
    const s = UI.conteo;
    if (!L.length) return '<div class="card empty">Sin registros con ese filtro.</div>';
    return `<div class="tw tall"><table class="t"><thead><tr><th class="n">#</th><th>Ubic.</th><th>Bien</th><th>Etiqueta</th><th class="n">B</th><th class="n">R</th><th class="n">M</th><th class="n">Total</th><th>Código desde – hasta</th><th>Alerta</th></tr></thead><tbody>
      ${L.slice(0, s.lim).map(r => `<tr class="click${r.ROW === s.sel ? ' sel' : ''}" data-act="cSel" data-row="${r.ROW}"><td class="n">${r.A}</td><td>${esc(r.C)}</td><td>${esc(r.G)}</td><td class="code">${esc(r.E)}</td><td class="n">${r.I || ''}</td><td class="n">${r.J || ''}</td><td class="n">${r.K || ''}</td><td class="n"><b>${r.L}</b></td><td class="code">${rango(r)}</td><td>${alertHtml(r.V)}</td></tr>`).join('')}
    </tbody></table>${L.length > s.lim ? `<div class="more"><button class="btn sm" data-act="cMore" type="button">Mostrar ${Math.min(300, L.length - s.lim)} más (de ${L.length})</button></div>` : ''}</div>`;
  },
  detail(r) {
    const g = X.reg[r.id] || {}, cs = R.cod.filter(c => c.row === r), n = r.W + '-' + r.X;
    const why = explain(r, cs);
    const fotos = (g.fotos || []).map(f => `<a href="https://drive.google.com/file/d/${esc(f.id)}/view" target="_blank" rel="noopener">${esc(f.t || 'Foto')}</a>`).join(' · ');
    return `<h2>${esc(r.G)} <span class="meta">fila ${r.A}</span></h2>
      <dl><dt>Ubicación</dt><dd>${esc(r.C)} ${estChip(X.loc[norm(r.C)])}</dd><dt>Escrito en la app</dt><dd>${esc(r.F)}</dd>${r.E ? `<dt>Etiqueta que tiene</dt><dd class="code">${esc(r.E)}</dd>` : ''}
      <dt>Cantidad</dt><dd>${r.L} (B ${r.I} · R ${r.J} · M ${r.K})</dd><dt>Institución-bloque</dt><dd class="code">${esc(n)}</dd>${r.P ? `<dt>Marca/serie</dt><dd>${esc(r.P)}</dd>` : ''}${r.Q ? `<dt>Observación</dt><dd>${esc(r.Q)}</dd>` : ''}
      <dt>Contado por</dt><dd>${esc(r.U)} · ${esc(dmy(r.fecha))}</dd>${fotos ? `<dt>Fotos</dt><dd>${fotos}</dd>` : ''}</dl>
      ${r.V ? `<div class="banner ${/^ℹ/.test(r.V) ? 'in' : 'wa'}" style="margin-bottom:10px">${esc(r.V)}</div>` : ''}
      <div class="why"><b>Por qué estos códigos</b><ol>${why.map(w => `<li>${w}</li>`).join('')}</ol></div>
      ${cs.length ? `<div class="codes">${cs.map(c => `<span class="${c.R === 'Conservado' ? 'c' : c.R === 'Reciclado' ? 'r' : 'nw'}" title="${esc(c.R + ' · ' + c.F)} · clic: ficha" data-act="fcod" data-i="${c.n - 1}" style="cursor:pointer">${esc(c.B)}</span>`).join('')}</div><div class="legend" style="margin-top:8px"><span><i style="background:var(--okb)"></i>conservado</span><span><i style="background:var(--inb)"></i>reciclado</span><span><i style="background:#FCE7CF"></i>nuevo</span></div>` : ''}
      <div class="row" style="margin-top:12px"><a class="btn sm" href="${esc(CAP_URL)}" target="_top">📱 Corregir en la app de captura</a></div>`;
  }
};
function explain(r, cs) {
  const out = [], L = N0(r.L), n = r.W + '-' + r.X, inv = R.inv, desc = c => R.catDesc(c) || c;
  const reciclar = (BASE.cfg.modo || RECICLAR) === RECICLAR;
  if (r.E) {
    if (r.AO < 0) out.push(`La etiqueta <b class="mono">${esc(r.E)}</b> no está en el inventario anterior${Motor.util.isCode(r.E) ? '' : ' (ni como serie única)'}: el bien se trata como <b>sin etiqueta</b>.`);
    else if (r.AR) out.push(`La etiqueta <b class="mono">${esc(inv[r.AO].code)}</b> es del bloque <b>${esc(r.AN)} ${esc(desc(r.AN))}</b>, pero el bien es <b>${esc(r.X)} ${esc(desc(r.X))}</b>: se <b>reetiqueta</b> y el código viejo pasa a descargo como etiqueta mal asignada.`);
    else out.push(`La etiqueta ${Motor.util.isCode(r.E) ? '' : '(número de serie) '}<b class="mono">${esc(r.E)}</b> corresponde al código <b class="mono">${esc(inv[r.AO].code)}</b> del mismo bloque.`);
  } else if (r.AO >= 0 && !r.AR) out.push(`Lo escrito en el bien (<span class="mono">${esc(r.F)}</span>) corresponde al código <b class="mono">${esc(inv[r.AO].code)}</b> del inventario anterior.`);
  if (r.AJ >= 0) {
    if (r.AF > 0) { out.push(L > 1 ? `Se <b>conservan</b> los ${L} códigos consecutivos desde <b class="mono">${esc(r.M)}</b> hasta <b class="mono">${esc(r.N)}</b>: todos son del mismo bloque.` : `Se <b>conserva</b> su código: mantiene su etiqueta.`); return out; }
    out.push(!r.AL ? (Motor.util.isCode(r.AP) ? `El rango de ${L} códigos desde esa etiqueta pasa a otro bloque: <b>no se asigna nada</b> hasta corregir la cantidad.` : 'Por número de serie la cantidad debe ser 1: <b>no se asigna nada</b> hasta corregirla.') : 'Sin cantidades: no se asigna código.');
    return out;
  }
  if (r.AR && L !== 1) { out.push('Con etiqueta de otra familia la cantidad debe ser 1: <b>no se asigna nada</b>.'); return out; }
  if (r.G.charAt(0) === '⚠') { out.push('El bien no se reconoce en el catálogo: <b>no recibe código</b> hasta escribirlo como “bloque - descripción”.'); return out; }
  if (!L) { out.push('Sin cantidades: no se asigna código.'); return out; }
  const tot = X.nInv[U(n)] || 0, oc = X.z1[U(n)] || 0, libres = tot - oc;
  out.push(`Bloque <b class="mono">${esc(n)}</b> (${esc(desc(r.X))}): en el inventario anterior hay <b>${tot}</b> código(s)${oc ? `, de los cuales <b>${oc}</b> están ocupados (conservados, reservados, mal asignados o en corrección de familia)` : ''}. Quedan <b>${Math.max(0, libres)}</b> libres para reciclar.`);
  out.push(`Los bienes de este bloque se numeran en el orden del conteo (orden de ubicaciones de la lista y, dentro de cada una, en el orden registrado). Este registro ocupa las posiciones <b>${r.Z}</b> a <b>${r.Z + L - 1}</b>.`);
  if (reciclar) {
    const rec = cs.filter(c => c.R === 'Reciclado').length, nu = cs.length - rec;
    if (rec) out.push(`${rec} bien(es) caen dentro de los ${libres} códigos libres: se <b>reciclan</b> códigos anteriores, empezando por los más recientes.`);
    if (nu) out.push(`${nu} bien(es) quedan después de los libres: reciben códigos <b>nuevos</b> a partir del último correlativo del bloque (<span class="mono">${Motor.util.pad4(r.AC)}</span>).`);
  } else out.push(`Modo sin reciclar: se numera después del último correlativo del bloque (<span class="mono">${Motor.util.pad4(r.AC)}</span>).`);
  return out;
}
ACT.cSel = b => { UI.conteo.sel = +b.dataset.row; $$('#cTable tr.sel').forEach(t => t.classList.remove('sel')); b.classList.add('sel'); const r = R.logical.find(x => x.ROW === UI.conteo.sel); $('#cDet').innerHTML = MODS.conteo.detail(r); if (innerWidth < 1100) $('#cDet').scrollIntoView({ behavior: 'smooth' }); };
ACT.cMore = () => { UI.conteo.lim += 300; $('#cTable').innerHTML = MODS.conteo.table(MODS.conteo.list()); };
INP.cU = el => { UI.conteo.u = el.value; UI.conteo.sel = null; UI.conteo.lim = 300; render(); };
INP.cF = el => { UI.conteo.f = el.value; UI.conteo.lim = 300; render(); };
INP.cQ = debounce(el => { UI.conteo.q = el.value; UI.conteo.lim = 300; $('#cTable').innerHTML = MODS.conteo.table(MODS.conteo.list()); }, 220);
MODS.conteo.after = () => { if (UI.conteo.sel != null) { const tr = $(`#cTable tr[data-row="${UI.conteo.sel}"]`); if (tr) tr.scrollIntoView({ block: 'center' }); } };

/* ===================== CÓDIGOS ASIGNADOS ===================== */
MODS.codigos = {
  list() { const s = UI.codigos, q = norm(s.q); return R.cod.filter(c => (!s.u || norm(c.E) === norm(s.u)) && (!s.o || c.R === s.o) && (!q || [c.B, c.C, c.D, c.X, c.H].some(x => norm(x).includes(q)))); },
  html() {
    const s = UI.codigos, L = this.list(), snap = s.u ? X.etq[norm(s.u)] : null, ch = s.u ? X.etqChanges.filter(x => norm(x.u) === norm(s.u)) : [];
    const loc = s.u ? X.loc[norm(s.u)] : null;
    return `<div class="card"><div class="row">
      <div class="field"><span class="lbl">Ubicación</span><select data-ch="kU">${ubicOpts(s.u)}</select></div>
      <div class="field"><span class="lbl">Origen</span><select data-ch="kO">${[['', 'Todos'], ['Conservado', '🔒 Conservados'], ['Reciclado', '↺ Reciclados'], ['NUEVO', '✚ Nuevos']].map(([v, t]) => `<option value="${v}"${s.o === v ? ' selected' : ''}>${t}</option>`).join('')}</select></div>
      <div class="field" style="flex:1;min-width:200px"><span class="lbl">Buscar</span><input type="search" data-in="kQ" value="${esc(s.q)}" placeholder="Código, bien, bloque, etiqueta vieja…"></div>
      <div class="row" style="align-self:flex-end"><button class="btn" data-act="kLabels" type="button"${L.length ? '' : ' disabled'}>🏷 Imprimir etiquetas (${L.length})</button></div></div>
      ${s.u ? `<div class="row" style="margin-top:12px;padding-top:12px;border-top:1px solid var(--sf2)">${estChip(loc)} ${snap ? `<span class="chip ${ch.length ? 'bad' : 'ok'}">${ch.length ? '⚠ Etiquetada, con cambios' : '🏷 Etiquetada'} · ${esc(dt(snap.t))} · ${esc(snap.por)}</span>` : '<span class="chip">Sin etiquetar</span>'}
        <span class="hint" style="flex:1">${snap ? 'Si se agregan o corrigen registros, aquí se avisa qué códigos cambiaron.' : 'Cuando pegue las etiquetas, márquela: así el sistema avisa si un código cambia después.'}</span>
        ${snap ? `<button class="btn sm" data-act="kEtq" data-on="1" type="button">Volver a marcar con los códigos actuales</button><button class="btn sm bad" data-act="kEtq" data-on="0" type="button">Quitar marca</button>` : `<button class="btn sm dark" data-act="kEtq" data-on="1" type="button"${(X.codU[norm(s.u)] || []).length ? '' : ' disabled'}>Marcar como etiquetada</button>`}</div>` : ''}
    </div>
    <div class="grid g4"><div class="kpi"><span>Códigos en la vista</span><b>${fmtN(L.length)}</b></div><div class="kpi"><span>🔒 Conservados</span><b>${fmtN(L.filter(c => c.R === 'Conservado').length)}</b></div><div class="kpi"><span>↺ Reciclados</span><b>${fmtN(L.filter(c => c.R === 'Reciclado').length)}</b></div><div class="kpi"><span>✚ Nuevos</span><b>${fmtN(L.filter(c => c.R === 'NUEVO').length)}</b></div></div>
    <div id="kTable">${this.table(L)}</div>`;
  },
  table(L) {
    const s = UI.codigos; if (!L.length) return '<div class="card empty">Sin códigos con ese filtro.</div>';
    const chg = new Set(X.etqChanges.map(x => x.ahora));
    return `<div class="tw tall"><table class="t"><thead><tr><th class="n">#</th><th>Código</th><th>Bien</th><th>Ubicación</th><th>Estado</th><th>Origen</th><th>Etiqueta que tenía</th><th>Qué hacer</th></tr></thead><tbody>
      ${L.slice(0, s.lim).map(c => `<tr class="click" data-act="fcod" data-i="${c.n - 1}"><td class="n">${c.n}</td><td class="code"><b>${esc(c.B)}</b>${chg.has(c.B) ? ' <span class="chip bad">cambió</span>' : ''}</td><td>${esc(c.C)}</td><td>${esc(c.E)}</td><td>${esc(c.F)}</td><td>${origenChip(c.R)}</td><td class="code">${esc(c.X)}</td><td class="hint">${esc(c.U)}</td></tr>`).join('')}
    </tbody></table>${L.length > s.lim ? `<div class="more"><button class="btn sm" data-act="kMore" type="button">Mostrar más (de ${fmtN(L.length)})</button></div>` : ''}</div>`;
  }
};
INP.kU = el => { UI.codigos.u = el.value; UI.codigos.lim = 400; render(); };
INP.kO = el => { UI.codigos.o = el.value; UI.codigos.lim = 400; render(); };
INP.kQ = debounce(el => { UI.codigos.q = el.value; UI.codigos.lim = 400; $('#kTable').innerHTML = MODS.codigos.table(MODS.codigos.list()); }, 220);
ACT.kMore = () => { UI.codigos.lim += 400; $('#kTable').innerHTML = MODS.codigos.table(MODS.codigos.list()); };
ACT.kEtq = async b => {
  const u = UI.codigos.u, on = b.dataset.on === '1';
  const codes = on ? (X.codU[norm(u)] || []).map(c => [c.row.id, c.K, c.B]) : [];
  b.disabled = true;
  try { const r = await api('api_g_etiquetar', u, codes); D.etq = r.etq; derive(); render(); toast(on ? `${u}: ${codes.length} códigos marcados como etiquetados` : `${u}: marca quitada`); }
  catch (e) { toast(errMsg(e), true); b.disabled = false; }
};
ACT.kLabels = () => printLabels(MODS.codigos.list());

/* ===================== CONSERVAR ===================== */
MODS.conservar = {
  html() {
    const t = R.conservar.tot, s = UI.conservar, q = norm(s.q), cfg = BASE.cfg;
    const L = R.conservar.det.filter(d => (s.f !== 'pend' || d.inv.X === 0) && (s.f !== 'ok' || d.inv.X > 0) && (!q || [d.B, d.C, d.F, d.H, d.D].some(x => norm(x).includes(q))));
    const fuera = R.inv.filter(o => o.Y !== 'Sí' && o.X > 0);
    return `<div class="grid g4"><div class="kpi"><span>Reservados</span><b>${t.reservados}</b></div><div class="kpi"><span>Conservados</span><b style="color:var(--ok)">${t.conservados}</b></div><div class="kpi"><span>Pendientes</span><b style="color:var(--wa)">${t.pendientes}</b><small>registre esos bienes con su etiqueta o serie</small></div><div class="kpi"><span>Conservados sin reserva</span><b>${t.fuera}</b><small>se encontraron por su etiqueta</small></div></div>
    <div class="card"><h2>Reglas activas</h2><div class="row hint">
      <span class="chip">${cfg.consDesde ? 'Adquiridos desde ' + esc(dmy(cfg.consDesde)) : 'Sin fecha de conservación'}</span>
      <span class="chip">${cfg.consSerie === 'Sí' ? 'Con número de serie' : 'Serie: no'}</span>
      ${(BASE.consBlq || []).map(b => `<span class="chip">Bloque completo ${esc(b)}</span>`).join('')}
      ${isAdmin() ? '<button class="btn sm ghost" data-act="go" data-m="config" type="button">Cambiar reglas →</button>' : ''}</div>
      <p class="hint" style="margin:8px 0 0">Un código reservado no se recicla para otro bien. Si el bien se encuentra (por su etiqueta o serie) conserva su código; si no se registra, queda “pendiente” y al final pasa a descargo. ${isAdmin() ? 'Puede forzar un código con “Sí” o “No” en Inventario anterior.' : ''}</p></div>
    <div class="card"><div class="row"><select data-ch="kvF">${[['pend', 'Pendientes'], ['ok', 'Conservados'], ['', 'Todos']].map(([v, t]) => `<option value="${v}"${s.f === v ? ' selected' : ''}>${t}</option>`).join('')}</select>
      <input type="search" data-in="kvQ" value="${esc(s.q)}" placeholder="Código, bien, serie, ubicación…" style="flex:1;min-width:200px"></div></div>
    <div id="kvT">${this.table(L)}</div>`;
  },
  table(L) {
    if (!L.length) return '<div class="card empty">Nada que mostrar.</div>';
    return `<div class="tw tall"><table class="t"><thead><tr><th class="n">#</th><th>Código</th><th>Bien</th><th>Marca / modelo</th><th>Serie</th><th>Fecha</th><th>Ubicación (sistema)</th><th>Estado</th><th>Encontrado en</th>${isAdmin() ? '<th>Forzar</th>' : ''}</tr></thead><tbody>
    ${L.slice(0, 600).map(d => `<tr><td class="n">${d.A}</td><td class="code">${esc(d.B)}</td><td>${esc(d.C)}</td><td>${esc([d.D, d.E].filter(Boolean).join(' '))}</td><td class="code">${esc(d.F)}</td><td>${esc(dmy(d.G))}</td><td>${esc(d.H)}</td><td>${d.inv.X > 0 ? '<span class="chip ok">✔ Conservado</span>' : `<span class="chip wa">Pendiente</span>`}</td><td>${esc(d.J)}</td>${isAdmin() ? `<td>${manualSel(d.inv)}</td>` : ''}</tr>`).join('')}</tbody></table></div>`;
  }
};
INP.kvF = el => { UI.conservar.f = el.value; render(); };
INP.kvQ = debounce(el => { UI.conservar.q = el.value; render(); const i = $('[data-in="kvQ"]'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 300);
const manualSel = o => `<select data-ch="invMan" data-code="${esc(o.code)}" title="Reserva manual">${[['', 'Auto'], ['Sí', 'Sí'], ['No', 'No']].map(([v, t]) => `<option value="${v}"${o.manual === v ? ' selected' : ''}>${t}</option>`).join('')}</select>`;
INP.invMan = async el => {
  const code = el.dataset.code, v = el.value; el.disabled = true;
  try { await api('api_g_setConservar', code, v); const o = BASE.inv.find(x => x.code === code); if (o) o.manual = v; LS.set('gbase', null); recompute(); render(); toast(`${code}: conservar ${v || 'automático'}`); }
  catch (e) { toast(errMsg(e), true); el.disabled = false; }
};

/* ===================== CATÁLOGO ===================== */
// Modo edición: nombres, Usar, bloques nuevos y quitar bloques sin uso. Los cambios se acumulan y se guardan juntos.
const CE = () => UI.cat.ce || (UI.cat.ce = { on: false, chg: {}, add: [], del: {}, sync: true, nid: 0 });
const catBase = c => (BASE && BASE.cat || []).find(x => x.c === c) || {};
const catUsoRegla = () => { const s = new Set(); (BASE.consBlq || []).forEach(b => s.add(b)); (BASE.rc || []).forEach(p => { s.add(p[0]); s.add(p[1]); }); return s; };
const catUso = c => c.I > 0 ? 'Tiene ' + c.I + ' contados en el conteo' : c.M > 0 ? 'Tiene ' + c.M + ' códigos en el inventario anterior' : catUsoRegla().has(c.A) ? 'Está en las reglas de códigos' : (D.regs || []).some(r => r.blk === c.A) ? 'Tiene registros del conteo' : '';
const catRubro = c => { const r = (BASE.rubros || []).find(x => x[0] === String(c).slice(0, 2)); return r ? r[1] : ''; };
function catPend() {
  const e = CE(), upd = [], txt = [];
  Object.keys(e.chg).forEach(c => {
    if (e.del[c]) return; const x = e.chg[c], r = R.cat.find(k => k.A === c); if (!r) return; const o = { c };
    if (x.nombre !== undefined && norm(x.nombre) !== norm(r.F)) { o.nombre = x.nombre; txt.push(c + ' nombre'); }
    if (x.usar !== undefined && x.usar !== (r.G === 'No' ? 'No' : 'Sí')) { o.usar = x.usar; txt.push(c + ' usar ' + x.usar); }
    if (Object.keys(o).length > 1) upd.push(o);
  });
  const add = e.add.filter(a => a.c || a.nombre).map(a => ({ c: a.c, nombre: a.nombre, usar: a.usar })); add.forEach(a => txt.push((a.c || '?') + ' nuevo'));
  const del = Object.keys(e.del).filter(c => e.del[c]); del.forEach(c => txt.push(c + ' quitar'));
  return { upd, add, del, n: upd.length + add.length + del.length, txt };
}
function catBarHTML() {
  const p = catPend();
  return `<b>${p.n ? p.n + (p.n === 1 ? ' cambio sin guardar' : ' cambios sin guardar') : 'Sin cambios'}</b><span class="cbtxt">${esc(p.txt.slice(0, 6).join(' · '))}${p.txt.length > 6 ? ' …' : ''}</span><span style="flex:1"></span>
    <label class="row cbsync" title="Cambia también la lista de bienes que ve el contador en la app de conteo"><input type="checkbox" data-ch="ceSync"${CE().sync ? ' checked' : ''}> También en la app de conteo</label>
    <button class="btn sm" data-act="ceDiff" type="button"${p.n ? '' : ' disabled'}>Ver cambios</button><button class="btn sm" data-act="ceDiscard" type="button"${p.n ? '' : ' disabled'}>Descartar</button><button class="btn sm pri" data-act="ceSave" type="button"${p.n ? '' : ' disabled'}>Guardar todo</button>`;
}
const catBarUpd = () => { const b = $('#catBar'); if (b) b.innerHTML = catBarHTML(); };
const catFilter = () => { const s = UI.cat, q = norm(s.q); return R.cat.filter(c => !c.blank && (!s.solo || c.I > 0 || c.M > 0) && (!q || [c.A, c.F, c.C, (CE().chg[c.A] || {}).nombre || ''].some(x => norm(x).includes(q)))); };
MODS.catalogo = {
  extra() {
    if (!isAdmin()) return '';
    const on = CE().on;
    return `<button class="btn sm" data-act="ceExp" type="button">⬇ Descargar Excel</button><button class="btn sm" data-act="ceImpOpen" type="button">⬆ Cargar Excel</button><button class="btn sm" data-act="ceNew" type="button">+ Bloque</button>
      <button class="btn sm ${on ? 'dark' : 'pri'}" data-act="ceToggle" type="button">${on ? '✔ Terminar edición' : '✏ Editar catálogo'}</button>`;
  },
  html() {
    const s = UI.cat, L = catFilter(), on = CE().on;
    return `<div class="card"><div class="row"><input type="search" data-in="catQ" value="${esc(s.q)}" placeholder="Bloque o descripción…" style="flex:1;min-width:200px"><label class="row hint"><input type="checkbox" data-ch="catSolo"${s.solo ? ' checked' : ''}> Solo con conteo o inventario</label><span class="hint" id="catN">${L.length} bloques</span></div>
      ${on ? '<div class="hint">Modo edición: cambie nombres y “Usar”, agregue bloques con <b>+ Bloque</b> o quite los que no se usan con 🗑. Nada se guarda hasta tocar <b>Guardar todo</b>. El nombre del Manual de Códigos queda registrado en la columna “Antes”.</div>' : ''}</div>
    <div id="catT">${this.table(L)}</div>${on ? `<div class="catbar" id="catBar">${catBarHTML()}</div>` : ''}`;
  },
  table(L) {
    const e = CE();
    if (!e.on) {
      if (!L.length) return '<div class="card empty">Nada que mostrar.</div>';
      return `<div class="tw tall"><table class="t"><thead><tr><th>Bloque</th><th>Descripción</th><th>Rubro</th><th class="n">Contados</th><th class="n">B / R / M</th><th class="n">En sistema</th><th class="n">Último correl.</th><th class="n">Reutilizados</th><th class="n">Nuevos</th><th class="n">Sin usar</th><th class="n">Valor sistema</th><th class="n">Valor a descargar</th><th>Usar</th></tr></thead><tbody>
      ${L.slice(0, 700).map(c => { const b = catBase(c.A); return `<tr><td class="code">${esc(c.A)}</td><td>${esc(c.F)}${b.inst && b.manual ? ' <span class="chip in" title="Nombre del manual: ' + esc(b.manual || '—') + '">nombre propio</span>' : ''}${/^Agregado/.test(b.origen || '') ? ' <span class="chip new">agregado</span>' : ''}</td><td class="hint">${esc(c.C)}</td><td class="n"><b>${c.I || ''}</b></td><td class="n hint">${c.I ? `${c.J} / ${c.K} / ${c.L}` : ''}</td><td class="n">${c.M || ''}</td><td class="n">${c.N === '' ? '' : Motor.util.pad4(c.N)}</td><td class="n">${c.O || ''}</td><td class="n">${c.P || ''}</td><td class="n">${c.Q || ''}</td><td class="n">${c.R ? money(c.R) : ''}</td><td class="n">${c.X ? money(c.X) : ''}</td>
        <td>${esc(c.G || 'Sí')}</td></tr>`; }).join('')}</tbody></table></div>`;
    }
    const nuevos = e.add.map((a, i) => `<tr class="cenew"><td><input class="ce cod${a.c ? ' chg' : ''}" data-in="ceAc" data-i="${i}" value="${esc(a.c)}" placeholder="0000" maxlength="4" inputmode="numeric" style="width:76px"></td>
      <td><input class="ce chg" data-in="ceAn" data-i="${i}" value="${esc(a.nombre)}" placeholder="Nombre del bien"></td><td class="hint" id="ceR${i}">${esc(catRubro(a.c) || (a.c.length >= 2 ? '⚠ rubro ' + a.c.slice(0, 2) + ' no existe' : ''))}</td><td></td><td></td>
      <td><select data-ch="ceAu" data-i="${i}"><option${a.usar !== 'No' ? ' selected' : ''}>Sí</option><option${a.usar === 'No' ? ' selected' : ''}>No</option></select></td><td class="hint">bloque nuevo</td><td><button class="btn sm ghost" data-act="ceAddX" data-i="${i}" type="button" title="Quitar esta fila">✕</button></td></tr>`).join('');
    const rows = L.slice(0, 700).map(c => {
      const x = e.chg[c.A] || {}, b = catBase(c.A), d = !!e.del[c.A], nom = x.nombre !== undefined ? x.nombre : c.F, us = x.usar !== undefined ? x.usar : (c.G === 'No' ? 'No' : 'Sí');
      const cn = norm(nom) !== norm(c.F), cu = us !== (c.G === 'No' ? 'No' : 'Sí'), uso = catUso(c);
      const antes = cn ? c.F : (b.inst ? 'Manual: ' + (b.manual || '—') : '');
      return `<tr class="${d ? 'cedel' : ''}"><td class="code">${esc(c.A)}</td><td><input class="ce${cn ? ' chg' : ''}" data-in="ceN" data-c="${esc(c.A)}" value="${esc(nom)}"${d ? ' disabled' : ''}></td><td class="hint">${esc(c.C)}</td><td class="n"><b>${c.I || ''}</b></td><td class="n">${c.M || ''}</td>
        <td><select class="${cu ? 'chg' : ''}" data-ch="ceU" data-c="${esc(c.A)}"${d ? ' disabled' : ''}><option${us === 'Sí' ? ' selected' : ''}>Sí</option><option${us === 'No' ? ' selected' : ''}>No</option></select></td>
        <td class="hint">${d ? '<b style="color:var(--bad)">Se quitará</b>' : esc(antes)}${b.inst && !cn && !d ? ` <a href="#" data-act="ceRest" data-c="${esc(c.A)}">restaurar</a>` : ''}</td>
        <td>${d ? `<button class="btn sm" data-act="ceUndo" data-c="${esc(c.A)}" type="button">Deshacer</button>` : `<button class="btn sm ghost" data-act="ceDel" data-c="${esc(c.A)}" type="button" title="${uso ? esc(uso) + ': no se puede quitar. Use Usar = No.' : 'Quitar del catálogo'}"${uso ? ' disabled' : ''}>🗑</button>`}</td></tr>`;
    }).join('');
    return `<div class="tw tall"><table class="t ced"><thead><tr><th>Bloque</th><th style="min-width:280px">Nombre</th><th>Rubro</th><th class="n">Contados</th><th class="n">En sistema</th><th>Usar</th><th>Antes</th><th></th></tr></thead><tbody>${nuevos}${rows || (nuevos ? '' : '<tr><td colspan="8" class="empty">Nada que mostrar.</td></tr>')}</tbody></table></div>`;
  }
};
INP.catQ = debounce(el => { UI.cat.q = el.value; const L = catFilter(); $('#catT').innerHTML = MODS.catalogo.table(L); if ($('#catN')) $('#catN').textContent = L.length + ' bloques'; }, 220);
INP.catSolo = el => { UI.cat.solo = el.checked; render(); };
INP.ceN = el => { const e = CE(), c = el.dataset.c; (e.chg[c] = e.chg[c] || {}).nombre = el.value; const r = R.cat.find(k => k.A === c); el.classList.toggle('chg', !!r && norm(el.value) !== norm(r.F)); catBarUpd(); };
INP.ceU = el => { const e = CE(), c = el.dataset.c; (e.chg[c] = e.chg[c] || {}).usar = el.value; const r = R.cat.find(k => k.A === c); el.classList.toggle('chg', !!r && el.value !== (r.G === 'No' ? 'No' : 'Sí')); catBarUpd(); };
INP.ceAc = el => { const a = CE().add[+el.dataset.i]; a.c = el.value.replace(/\D/g, '').slice(0, 4); if (el.value !== a.c) el.value = a.c; const t = $('#ceR' + el.dataset.i); if (t) t.textContent = catRubro(a.c) || (a.c.length >= 2 ? '⚠ rubro ' + a.c.slice(0, 2) + ' no existe' : ''); catBarUpd(); };
INP.ceAn = el => { CE().add[+el.dataset.i].nombre = el.value; catBarUpd(); };
INP.ceAu = el => { CE().add[+el.dataset.i].usar = el.value; catBarUpd(); };
INP.ceSync = el => { CE().sync = el.checked; };
Object.assign(ACT, {
  ceToggle: () => { const e = CE(); if (e.on && catPend().n) { confirmModal('Tiene cambios sin guardar en el catálogo. ¿Salir del modo edición y descartarlos?', 'Descartar y salir', () => { UI.cat.ce = null; render(); }); return; } e.on = !e.on; render(); },
  ceNew: () => { const e = CE(); e.on = true; e.add.unshift({ c: '', nombre: '', usar: 'Sí' }); render(); const i = $('[data-in="ceAc"]'); if (i) i.focus(); },
  ceAddX: b => { CE().add.splice(+b.dataset.i, 1); $('#catT').innerHTML = MODS.catalogo.table(catFilter()); catBarUpd(); },
  ceDel: b => { CE().del[b.dataset.c] = true; $('#catT').innerHTML = MODS.catalogo.table(catFilter()); catBarUpd(); },
  ceUndo: b => { delete CE().del[b.dataset.c]; $('#catT').innerHTML = MODS.catalogo.table(catFilter()); catBarUpd(); },
  ceRest: b => { const c = b.dataset.c, m = catBase(c).manual; if (!m) { toast('Este bloque no tiene nombre en el manual.', true); return; } (CE().chg[c] = CE().chg[c] || {}).nombre = m; $('#catT').innerHTML = MODS.catalogo.table(catFilter()); catBarUpd(); },
  ceDiscard: () => confirmModal('¿Descartar todos los cambios sin guardar del catálogo?', 'Descartar', () => { const on = CE().on; UI.cat.ce = null; CE().on = on; render(); }),
  ceDiff: () => {
    const p = catPend(), nm = c => (R.cat.find(k => k.A === c) || {}).F || '';
    modal(`<h2>Cambios en el catálogo</h2><div class="tw" style="max-height:55vh"><table class="t"><thead><tr><th>Bloque</th><th>Cambio</th><th>Antes</th><th>Después</th></tr></thead><tbody>
      ${p.upd.map(x => (x.nombre !== undefined ? `<tr><td class="code">${esc(x.c)}</td><td>Nombre</td><td>${esc(nm(x.c))}</td><td><b>${esc(String(x.nombre).toUpperCase().trim() || catBase(x.c).manual)}</b></td></tr>` : '') + (x.usar !== undefined ? `<tr><td class="code">${esc(x.c)}</td><td>Usar</td><td>${x.usar === 'No' ? 'Sí' : 'No'}</td><td><b>${esc(x.usar)}</b></td></tr>` : '')).join('')}
      ${p.add.map(a => `<tr><td class="code">${esc(a.c)}</td><td><span class="chip new">Nuevo</span></td><td></td><td><b>${esc(String(a.nombre).toUpperCase())}</b> · ${esc(catRubro(a.c))} · Usar ${esc(a.usar)}</td></tr>`).join('')}
      ${p.del.map(c => `<tr><td class="code">${esc(c)}</td><td><span class="chip bad">Quitar</span></td><td>${esc(nm(c))}</td><td></td></tr>`).join('')}</tbody></table></div>
      <p class="hint">Al guardar, los nombres nuevos aparecen en el conteo, las actas y etiquetas que imprima (también si reimprime un folio anterior), los reportes y descargos. Los PDF ya guardados en Drive y los códigos del inventario anterior (descripción de SIGES) no cambian.</p>
      <div class="acts"><button class="btn" data-close type="button">Cerrar</button><button class="btn pri" data-act="ceSave" type="button">Guardar todo</button></div>`);
  },
  ceSave: async b => {
    const p = catPend(); if (!p.n) return;
    const bad = p.add.find(a => !/^\d{4}$/.test(a.c) || !String(a.nombre).trim()); if (bad) { toast('Bloque nuevo incompleto: escriba los 4 dígitos y el nombre.', true); return; }
    b.disabled = true;
    try {
      const r = await api('api_g_catSave', { upd: p.upd, add: p.add, del: p.del }, CE().sync);
      BASE.cat = r.cat; LS.set('gbase', null); UI.cat.ce = null; CE().on = true;
      recompute(); closeModal(); render(); toast(`Catálogo guardado: ${r.cambios} cambio(s)${r.app ? ' · app de conteo actualizada' : ''}`);
    } catch (e) { toast(errMsg(e), true); b.disabled = false; }
  },
  ceExp: async b => {
    b.disabled = true;
    try {
      const rows = R.cat.filter(c => !c.blank).map(c => { const x = catBase(c.A); return [c.A, c.F, x.manual || '', c.C, c.G === 'No' ? 'No' : 'Sí', c.I || 0, c.M || 0, '']; });
      const r = await api('api_g_tablas', 'Catalogo', [{ t: 'CATALOGO', head: ['Bloque', 'Nombre', 'Nombre en el manual', 'Rubro', 'Usar', 'Contados', 'En sistema', 'Quitar (Sí)'], rows }]); descarga(r);
    } catch (e) { toast(errMsg(e), true); } b.disabled = false;
  },
  ceImpOpen: () => modal(`<h2>Cargar catálogo desde Excel</h2><p class="hint" style="margin:0">Use el archivo de <b>⬇ Descargar Excel</b>. Se leen las columnas <b>Bloque</b>, <b>Nombre</b>, Usar y Quitar (Sí). Los bloques que no están en el catálogo se agregan; los que faltan en el archivo <b>no</b> se quitan (para quitar, escriba Sí en “Quitar”). Los cambios quedan pendientes en el modo edición para que los revise antes de guardar.</p><input type="file" accept=".xlsx,.xls,.csv" data-ch="ceImpFile"><div id="ceImpOut"></div><div class="acts"><button class="btn" data-close type="button">Cerrar</button></div>`)
});
INP.ceImpFile = async el => {
  const f = el.files[0]; if (!f) return; const out = $('#ceImpOut'); out.innerHTML = '<div class="hint">Leyendo…</div>';
  try {
    const rows = await leerTabla(f, { c: ['bloque', 'codigo', 'código'], n: ['nombre', 'descripcion', 'descripción'], u: ['usar', 'usar (si/no)'], q: ['quitar (si)', 'quitar'] });
    const e = CE(); let nu = 0, cam = 0, qu = 0; const av = [];
    rows.forEach(x => {
      const c = /^\d{1,4}$/.test(x.c) ? x.c.padStart(4, '0') : x.c; if (!c) return;
      const r = R.cat.find(k => k.A === c), u = /^n/i.test(x.u) ? 'No' : x.u ? 'Sí' : '';
      if (!r) { if (!/^\d{4}$/.test(c)) { av.push(c + ': bloque no válido'); return; } if (!x.n) { av.push(c + ': sin nombre'); return; } if (!e.add.some(a => a.c === c)) { e.add.push({ c, nombre: x.n, usar: u || 'Sí' }); nu++; } return; }
      if (/^s/i.test(x.q)) { const uso = catUso(r); if (uso) av.push(c + ': ' + uso + ', no se quita'); else { e.del[c] = true; qu++; } return; }
      let ch = false;
      if (x.n && norm(x.n) !== norm(r.F)) { (e.chg[c] = e.chg[c] || {}).nombre = x.n; ch = true; }
      if (u && u !== (r.G === 'No' ? 'No' : 'Sí')) { (e.chg[c] = e.chg[c] || {}).usar = u; ch = true; }
      if (ch) cam++;
    });
    e.on = true; closeModal(); render();
    toast(`Excel leído: ${nu} nuevo(s), ${cam} con cambios, ${qu} a quitar${av.length ? '. Avisos: ' + av.slice(0, 3).join(' · ') + (av.length > 3 ? ' (+' + (av.length - 3) + ')' : '') : ''}. Revise y toque Guardar todo.`, av.length > 0);
  } catch (e) { out.innerHTML = `<div class="banner bad">${esc(errMsg(e))}</div>`; }
};

/* ===================== INVENTARIO ANTERIOR ===================== */
MODS.inventario = {
  list() { const s = UI.inv, q = norm(s.q); return R.inv.filter(o => (!s.r || o.R === s.r) && (!s.y || (s.y === 'res' ? o.Y === 'Sí' : s.y === 'mal' ? o.AE > 0 : s.y === 'fam' ? o.AF !== '' : true)) && (!s.u || norm(o.M) === norm(s.u)) && (!q || [o.code, o.desc, o.serie, o.marca, o.modelo, o.asig].some(x => norm(x).includes(q)))); },
  html() {
    const s = UI.inv, L = this.list(), t = { Conservado: 0, Reasignado: 0, 'Sin asignar': 0 }; R.inv.forEach(o => t[o.R]++);
    const ubs = [...new Set(R.inv.map(o => o.M))].sort();
    return `<div class="grid g4"><div class="kpi"><span>Códigos en el sistema</span><b>${fmtN(R.inv.length)}</b></div><div class="kpi"><span>🔒 Conservados</span><b>${fmtN(t.Conservado)}</b></div><div class="kpi"><span>↺ Reasignados (reciclados)</span><b>${fmtN(t.Reasignado)}</b></div><div class="kpi"><span>⬇ A descargar</span><b>${fmtN(t['Sin asignar'])}</b></div></div>
    <div class="card"><div class="row">
      <div class="field"><span class="lbl">Qué pasa</span><select data-ch="ivR">${[['', 'Todos'], ['Conservado', 'Conservados'], ['Reasignado', 'Reasignados'], ['Sin asignar', 'A descargar']].map(([v, x]) => `<option value="${v}"${s.r === v ? ' selected' : ''}>${x}</option>`).join('')}</select></div>
      <div class="field"><span class="lbl">Marca</span><select data-ch="ivY">${[['', 'Todos'], ['res', 'Reservados'], ['mal', 'Etiqueta mal asignada'], ['fam', 'Familia equivocada']].map(([v, x]) => `<option value="${v}"${s.y === v ? ' selected' : ''}>${x}</option>`).join('')}</select></div>
      <div class="field"><span class="lbl">Ubicación estándar</span><select data-ch="ivU"><option value="">Todas</option>${ubs.map(u => `<option${s.u === u ? ' selected' : ''}>${esc(u)}</option>`).join('')}</select></div>
      <div class="field" style="flex:1;min-width:200px"><span class="lbl">Buscar</span><input type="search" data-in="ivQ" value="${esc(s.q)}" placeholder="Código, descripción, serie, asignado a…"></div>
      <span class="hint" style="align-self:flex-end">${fmtN(L.length)} códigos</span></div></div>
    <div id="ivT">${this.table(L)}</div>`;
  },
  table(L) {
    const s = UI.inv; if (!L.length) return '<div class="card empty">Sin códigos con ese filtro.</div>';
    return `<div class="tw tall"><table class="t"><thead><tr><th>Código</th><th>Descripción</th><th>Serie</th><th>Fecha</th><th class="n">Valor</th><th>Calidad</th><th>Ubicación estándar</th><th>Reservado</th><th>Qué pasa</th><th>Se encontró en</th><th>Motivo / detalle</th></tr></thead><tbody>
    ${L.slice(0, s.lim).map(o => `<tr class="click" data-act="finv" data-code="${esc(o.code)}"><td class="code">${esc(o.code)}</td><td>${esc(o.desc)}<br><span class="hint">${esc([o.marca, o.modelo].filter(Boolean).join(' '))}</span></td><td class="code">${esc(o.serie)}</td><td>${esc(dmy(o.fecha))}</td><td class="n">${money(o.valor)}</td><td>${esc(o.calidad)}</td><td>${esc(o.M)}<br><span class="hint">${esc(o.asig)}</span></td>
      <td>${o.Y === 'Sí' ? '<span class="chip in">Sí</span>' : ''}${isAdmin() ? '<br>' + manualSel(o) : ''}</td><td>${invChip(o)}${o.AE ? ' <span class="chip bad">mal asignada</span>' : ''}${o.AF ? ` <span class="chip wa">familia → ${esc(o.AF)}</span>` : ''}</td><td>${esc(o.T)}</td><td class="hint">${esc(o.V)}${o.AI ? `<br>Se carga como <b class="mono">${esc(o.AI)}</b>` : ''}${o.AK ? `<br><span class="alert bad">${esc(o.AK)}</span>` : ''}</td></tr>`).join('')}
    </tbody></table>${L.length > s.lim ? `<div class="more"><button class="btn sm" data-act="ivMore" type="button">Mostrar más (de ${fmtN(L.length)})</button></div>` : ''}</div>`;
  }
};
INP.ivR = el => { UI.inv.r = el.value; UI.inv.lim = 300; render(); };
INP.ivY = el => { UI.inv.y = el.value; UI.inv.lim = 300; render(); };
INP.ivU = el => { UI.inv.u = el.value; UI.inv.lim = 300; render(); };
INP.ivQ = debounce(el => { UI.inv.q = el.value; UI.inv.lim = 300; $('#ivT').innerHTML = MODS.inventario.table(MODS.inventario.list()); }, 250);
ACT.ivMore = () => { UI.inv.lim += 300; $('#ivT').innerHTML = MODS.inventario.table(MODS.inventario.list()); };
