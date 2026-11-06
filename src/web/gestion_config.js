/* ===================== CONFIGURACIÓN ===================== */
const CFG_TABS = { importar: 'Importar del Excel v10', general: 'General', reglas: 'Reglas de códigos', familia: 'Corrección de familia', eq: 'Equivalencias', textos: 'Textos del acta', sistema: 'Sistema' };
let SYS = null;
let IMP = null, EQED = null, RCED = null, EXF = { code: '', ubic: '', fecha: '', valor: '', serie: '', obs: '' };
MODS.config = {
  html() {
    const k = UI.cfg, ro = !isAdmin();
    return `<div class="tabs">${Object.entries(CFG_TABS).map(([x, t]) => `<button data-act="cfgTab" data-k="${x}" class="${x === k ? 'on' : ''}" type="button">${t}</button>`).join('')}</div>
      ${ro ? '<div class="banner in">Solo el administrador puede cambiar la configuración. Los supervisores pueden editar los responsables de cada ubicación.</div>' : ''}
      <div class="${ro && k !== 'ubic' ? 'ro' : ''}">${this[k]()}</div>`;
  },
  sistema() {
    if (!SYS) { api('api_sys_estado').then(r => { SYS = r; if (MOD === 'config' && UI.cfg === 'sistema') render(); }).catch(e => { SYS = { error: errMsg(e) }; if (MOD === 'config' && UI.cfg === 'sistema') render(); }); }
    const s = SYS || {};
    return `<div class="grid g-main"><div class="card cfgsec"><h2>Versión del sistema</h2>
      ${!SYS ? '<div class="hint">Consultando…</div>' : s.error ? `<div class="banner bad">${esc(s.error)}</div>` : `<div class="pack" style="color:var(--fg)">
        <div class="row"><span style="flex:1">Versión instalada</span><b class="mono">${esc(s.version || '—')}</b></div>
        <div class="row"><span style="flex:1">Publicada</span><b>${esc(s.fecha || '—')}</b></div>
        <div class="row"><span style="flex:1">Origen</span><b class="mono">${esc(s.repo || '')} · ${esc(s.ref || '')}</b></div>
        <div class="row"><span style="flex:1">Cargador de Apps Script</span><b class="mono">v${esc(s.cargador || 1)}${(s.cargador || 1) < 2 ? ' · pegar el nuevo' : ''}</b></div>
        ${window.CARGA ? `<div class="row"><span style="flex:1">Última carga de datos</span><b>${(CARGA.total / 1000).toFixed(1)} s</b></div>
        <div class="row hint"><span style="flex:1">servidor (leer hojas) · red · cálculo de códigos</span><span>${(CARGA.servidor / 1000).toFixed(1)} · ${(CARGA.red / 1000).toFixed(1)} · ${(CARGA.calculo / 1000).toFixed(1)} s${CARGA.base ? ' · con datos base' : ''}</span></div>` : ''}
        <div class="row"><span style="flex:1">Copia de respaldo en Drive</span><b>${s.respaldo ? '✔ ' + esc(s.respaldo) : '—'}</b></div></div>`}
      <p class="hint" style="margin:0">Las mejoras llegan solas desde GitHub: el sistema revisa cada 5 minutos si hay una versión nueva. Si GitHub no responde, sigue funcionando con la copia guardada en su Drive.</p>
      <div class="row"><button class="btn pri" data-act="sysUpd" type="button"${isAdmin() ? '' : ' disabled'}>⟳ Buscar actualización ahora</button><button class="btn" data-act="sysRef" type="button">Volver a consultar</button></div></div></div>`;
  },
  importar() {
    const c = BASE.cfg || {};
    return `<div class="grid g-main"><div class="card cfgsec"><h2>Datos base desde el Excel v10</h2>
      <p style="margin:0">Se toma del archivo <b>Conteo_Fisico_Inventario v10</b>: inventario anterior (con fecha, valor, calidad y reservas manuales), catálogo, rubros, equivalencias de ubicación, bloques a conservar, correcciones de familia y la configuración general. <b>El conteo NO se toma del Excel</b>: sale de la app de captura.</p>
      <p class="hint" style="margin:0">El archivo se lee en este navegador; solo se envían los datos. Al importar se reemplazan los datos base anteriores. Puede repetirlo cuando actualice el Excel.</p>
      <div class="row"><input type="file" id="impFile" accept=".xlsx,.xlsm" data-ch="impFile"${isAdmin() ? '' : ' disabled'}></div>
      <div id="impOut">${IMP ? this.impSummary() : ''}</div></div>
      <div class="card"><h2>Estado actual</h2><div class="pack" style="color:var(--fg)">
        <div class="row"><span style="flex:1">Códigos del inventario anterior</span><b>${fmtN((BASE.inv || []).length)}</b></div>
        <div class="row"><span style="flex:1">Bloques del catálogo</span><b>${fmtN((BASE.cat || []).filter(x => x.c).length)}</b></div>
        <div class="row"><span style="flex:1">Equivalencias</span><b>${fmtN((BASE.eq || []).length)}</b></div>
        <div class="row"><span style="flex:1">Bloques a conservar</span><b>${(BASE.consBlq || []).length}</b></div>
        <div class="row"><span style="flex:1">Correcciones de familia</span><b>${(BASE.rc || []).length}</b></div>
        <div class="row"><span style="flex:1">Institución</span><b>${esc(c.inst || '—')}</b></div>
        <div class="row"><span style="flex:1">Modo</span><b>${esc(c.modo || '—')}</b></div></div></div></div>`;
  },
  impSummary() {
    const d = IMP.d, ord = IMP.ord;
    return `<div class="banner ${ord.ok ? 'in' : 'wa'}" style="margin-top:6px">${ord.ok ? '✓ El orden de las ubicaciones de la app coincide con el Excel: la numeración será la misma.' : `<div><b>El orden de las ubicaciones no es igual al del Excel.</b> Los códigos se numeran en el orden de la lista de ubicaciones de la app (hoja UBICACIONES). Para obtener exactamente los mismos códigos que el Excel, ordene la hoja UBICACIONES igual que CONFIG del Excel.<br><span class="hint">Primera diferencia: posición ${ord.at + 1} · Excel “${esc(ord.x)}” · App “${esc(ord.a)}”${ord.faltan.length ? ' · No están en la app: ' + esc(ord.faltan.slice(0, 8).join(', ')) : ''}</span></div>`}</div>
      <table class="t" style="margin-top:8px"><tbody>
        <tr><td>Institución</td><td><b>${esc(d.cfg.nombre)}</b> (${esc(d.cfg.inst)}${d.cfg.otrasInst.filter(Boolean).length ? ' · ' + esc(d.cfg.otrasInst.filter(Boolean).join(', ')) : ''})</td></tr>
        <tr><td>Período</td><td>${esc(d.cfg.periodo)} · corte ${esc(dmy(d.cfg.corte || ''))}</td></tr>
        <tr><td>Modo</td><td>${esc(d.cfg.modo)} · conservar desde ${esc(dmy(d.cfg.consDesde || '') || '—')} · con serie: ${esc(d.cfg.consSerie || 'No')}</td></tr>
        <tr><td>Inventario anterior</td><td><b>${fmtN(d.inv.length)}</b> códigos · ${d.inv.filter(x => x.manual).length} con reserva manual</td></tr>
        <tr><td>Catálogo</td><td><b>${fmtN(d.cat.filter(x => x.c).length)}</b> bloques · ${d.rubros.length} rubros</td></tr>
        <tr><td>Reglas</td><td>${d.consBlq.filter(Boolean).length} bloques a conservar · ${d.rc.filter(p => p[0]).length} correcciones de familia · ${d.eq.filter(e => e[0]).length} equivalencias</td></tr>
        <tr><td>Responsables</td><td>${d.ubic.filter(u => u.n && u.resp).length} ubicaciones traen responsable (se cargan solo si RESPONSABLES está vacía)</td></tr>
      </tbody></table>
      <div class="row" style="margin-top:10px"><button class="btn pri" data-act="impGo" type="button">Importar estos datos</button><button class="btn ghost" data-act="impCancel" type="button">Cancelar</button></div>`;
  },
  general() {
    const c = BASE.cfg || {}, f = (k, t, w) => `<div class="field"${w ? ` style="grid-column:span ${w}"` : ''}><span class="lbl">${t}</span><input type="text" data-cfg="${k}" value="${esc(k === 'otrasInst' ? (c.otrasInst || []).join(', ') : c[k] || '')}"></div>`;
    return `<div class="card cfgsec"><h2>Datos generales</h2><div class="grid g3">${f('nombre', 'Nombre de la institución', 2)}${f('inst', 'Código de institución principal')}${f('otrasInst', 'Otros códigos de institución (máx. 2)')}${f('periodo', 'Período / nombre del conteo')}${f('corte', 'Fecha de corte (aaaa-mm-dd)')}
      ${f('director', 'Director(a)')}${f('encargado', 'Encargado de inventario')}<div></div>${f('e1', 'Estado 1')}${f('e2', 'Estado 2')}${f('e3', 'Estado 3')}</div>
      <div><button class="btn pri" data-act="cfgSave" data-keys="nombre,inst,otrasInst,periodo,corte,director,encargado,e1,e2,e3" type="button">Guardar</button></div></div>`;
  },
  reglas() {
    const c = BASE.cfg || {};
    return `<div class="grid g2"><div class="card cfgsec"><h2>Numeración</h2>
      <div class="field"><span class="lbl">Modo</span><select data-cfg="modo">${[RECICLAR, 'Sin reciclar: numerar después del último código'].map(m => `<option${c.modo === m ? ' selected' : ''}>${esc(m)}</option>`).join('')}</select></div>
      <p class="hint" style="margin:0"><b>Reciclar:</b> los códigos anteriores que no se encontraron se reutilizan (primero los más recientes) antes de crear nuevos. <b>Sin reciclar:</b> todo bien sin etiqueta válida recibe un número nuevo después del último correlativo.</p>
      <h2 style="margin-top:8px">Códigos reservados (no se reciclan)</h2>
      <div class="grid g2"><div class="field"><span class="lbl">Adquiridos desde</span><input type="date" data-cfg="consDesde" value="${esc(c.consDesde || '')}"></div>
      <div class="field"><span class="lbl">Con número de serie</span><select data-cfg="consSerie"><option${c.consSerie === 'Sí' ? ' selected' : ''}>Sí</option><option${c.consSerie !== 'Sí' ? ' selected' : ''}>No</option></select></div></div>
      <div><button class="btn pri" data-act="cfgSave" data-keys="modo,consDesde,consSerie" type="button">Guardar</button></div></div>
      <div class="card cfgsec"><h2>Bloques a conservar completos</h2><p class="hint" style="margin:0">Uno por línea: <span class="mono">5404</span> (el bloque en todas las instituciones) o <span class="mono">11674-1133</span> (solo esa institución).</p>
      <textarea id="consBlqTxt" rows="8" class="mono">${esc((BASE.consBlq || []).join('\n'))}</textarea>
      <div><button class="btn pri" data-act="reglasSave" data-which="cons" type="button">Guardar bloques</button></div></div></div>
      ${this.extra()}
      <div class="banner wa">Cambiar estas reglas cambia los códigos asignados. Hágalo antes de etiquetar; si ya hay ubicaciones etiquetadas, el sistema avisará qué códigos cambiaron.</div>`;
  },
  extra() {
    const L = BASE.extra || [], f = EXF, ro = !isAdmin();
    const chk = extraCheck(f.code), locs = D.locs.map(l => `<option value="${esc(l.n)}"${norm(f.ubic) === norm(l.n) ? ' selected' : ''}>${esc(l.n)}${l.t ? ' · ' + esc(l.t) : ''}</option>`).join('');
    return `<div class="card cfgsec" style="margin-top:16px"><h2>Códigos registrados después del corte <span class="meta">${L.length} agregado(s)</span></h2>
      <p class="hint" style="margin:0">Códigos que <b>sí están en SIGES</b> pero no venían en el inventario anterior porque se registraron después de la fecha en que se imprimió. Se <b>conservan</b> solo si cumplen las reglas (institución, bloque del catálogo) y el bien se cuenta <b>con esa etiqueta en la ubicación indicada</b>. Mientras no aparezca, el código queda reservado (nadie más lo recibe).</p>
      ${ro ? '' : `<div class="exform">
        <div class="field"><span class="lbl">Código</span><input type="text" class="mono" data-in="exCode" value="${esc(f.code)}" placeholder="11674-1103-0016" maxlength="15" autocomplete="off"><span class="hint" id="exChk">${chk.html}</span></div>
        <div class="field"><span class="lbl">Ubicación donde está</span><select data-ch="exUbic"><option value="">— elegir —</option>${locs}</select></div>
        <div class="field"><span class="lbl">Fecha de adquisición</span><input type="date" data-ch="exFecha" value="${esc(f.fecha)}"></div>
        <div class="field"><span class="lbl">Valor ($)</span><input type="number" step="0.01" min="0" data-ch="exValor" value="${esc(f.valor)}" placeholder="0.00"></div>
        <div class="field"><span class="lbl">Serie (opcional)</span><input type="text" data-ch="exSerie" value="${esc(f.serie)}"></div>
        <div class="field" style="grid-column:span 2"><span class="lbl">Observación (opcional)</span><input type="text" data-ch="exObs" value="${esc(f.obs)}" placeholder="Ej.: registrado en SIGES el 20/10/2026"></div>
        <div class="field" style="align-self:end"><button class="btn pri" data-act="exAdd" type="button">+ Agregar código</button></div></div>`}
      ${L.length ? `<div class="tw"><table class="t"><thead><tr><th>Código</th><th>Bien</th><th>Ubicación donde está</th><th>Adquisición</th><th class="n">Valor</th><th>Qué pasa en el conteo</th><th></th></tr></thead><tbody>
        ${L.map((x, i) => { const e = extraEstado(x); return `<tr><td class="code">${esc(x.code)}</td><td>${esc(R.catDesc(x.code.slice(6, 10)) || x.code.slice(6, 10))}${x.serie ? `<div class="hint">S/N ${esc(x.serie)}</div>` : ''}${x.obs ? `<div class="hint">${esc(x.obs)}</div>` : ''}</td><td>${esc(x.ubic)}</td><td>${x.fecha ? esc(dmy(x.fecha)) : '<span class="hint">—</span>'}</td><td class="n">${x.valor ? money(x.valor) : ''}</td><td>${e}</td>
          <td>${ro ? '' : `<button class="btn sm ghost" data-act="exDel" data-i="${i}" type="button" title="Quitar de la lista">🗑</button>`}</td></tr>`; }).join('')}</tbody></table></div>` : '<div class="hint">Todavía no hay códigos agregados.</div>'}</div>`;
  },
  familia() {
    if (!RCED) RCED = (BASE.rc || []).map(p => [p[0], p[1], '']);
    return `<div class="card cfgsec"><h2>Corrección de familia</h2><p class="hint" style="margin:0">Bienes registrados en el sistema en una familia equivocada (ej.: UPS registrados como 6118 Regulador). <b>Todos</b> los códigos de la familia equivocada se descargan, y los bienes encontrados se cargan en la familia correcta con la misma fecha, valor, marca y serie, en orden cronológico.</p>
      <div class="pairs">${RCED.map((p, i) => `<div><input type="text" class="mono" data-rc="0" data-i="${i}" value="${esc(p[0])}" placeholder="Bloque equivocado" style="width:150px">→<input type="text" class="mono" data-rc="1" data-i="${i}" value="${esc(p[1])}" placeholder="Bloque correcto" style="width:150px"><span class="hint">${esc(R.catDesc(p[0]) || '')} → ${esc(R.catDesc(p[1]) || '')}</span><button class="btn sm ghost bad" data-act="rcDel" data-i="${i}" type="button">✕</button></div>`).join('')}</div>
      <div class="row"><button class="btn sm" data-act="rcAdd" type="button">+ Agregar corrección</button><button class="btn pri" data-act="reglasSave" data-which="rc" type="button">Guardar</button></div></div>`;
  },
  ubic() {
    return `<div class="card"><h2>Ubicaciones y responsables <span class="meta">el orden de esta lista es el orden de numeración (las nuevas van al final)</span></h2>
      <div class="tw tall"><table class="t"><thead><tr><th>#</th><th>Ubicación</th><th>Tipo</th><th>Edificio / zona</th><th>Activa</th><th>Estado</th><th>Responsables (firman el acta)</th><th></th></tr></thead><tbody>
      ${D.locs.filter(l => !l.nueva).concat(D.locs.filter(l => l.nueva)).map((l, i) => { const rs = respOf(l.n); return `<tr><td class="n">${i + 1}</td><td><b>${esc(l.n)}</b>${l.nueva ? ' <span class="chip new">Nueva</span>' : ''}</td>
        <td>${isAdmin() ? `<input type="text" data-loc="t" data-u="${esc(l.n)}" value="${esc(l.t)}" style="width:150px">` : esc(l.t)}</td><td>${isAdmin() ? `<input type="text" data-loc="z" data-u="${esc(l.n)}" value="${esc(l.z)}" style="width:130px">` : esc(l.z)}</td>
        <td>${isAdmin() ? `<select data-loc="a" data-u="${esc(l.n)}"><option${l.a ? ' selected' : ''}>Sí</option><option${!l.a ? ' selected' : ''}>No</option></select>` : (l.a ? 'Sí' : 'No')}</td><td>${estChip(l)}</td>
        <td>${rs.map(p => `${esc(p.n)} <span class="hint">(${esc(p.rol.toLowerCase())}${p.copias !== 1 ? ' · ' + p.copias + ' copias' : ''})</span>`).join('<br>') || '<span class="chip wa">Sin responsable</span>'}</td>
        <td><button class="btn sm" data-act="aResp" data-u="${esc(l.n)}" type="button">Editar</button></td></tr>`; }).join('')}
      </tbody></table></div><p class="hint">Para cambiar el orden o agregar ubicaciones, edite la hoja UBICACIONES (o agréguelas desde la app de captura).</p></div>`;
  },
  eq() {
    if (!EQED) EQED = (BASE.eq || []).map(e => [e[0], e[1]]);
    const ubs = D.locs.map(l => l.n);
    return `<div class="card cfgsec"><h2>Equivalencias de ubicación</h2><p class="hint" style="margin:0">Cómo se llama en el inventario anterior (“Asignado a”) → a qué ubicación estándar corresponde. Sirve para la columna “Inv. anterior” de la ficha y para los descargos por ubicación. Lo que no tenga equivalencia sale como “POR DEFINIR (REVISAR)”.</p>
      <datalist id="dlUb">${ubs.map(u => `<option value="${esc(u)}">`).join('')}</datalist>
      <div class="tw" style="max-height:60vh"><table class="t"><thead><tr><th>Texto en el inventario</th><th>Ubicación estándar</th><th class="n">Códigos</th><th></th></tr></thead><tbody>
      ${EQED.map((e, i) => `<tr><td><input type="text" data-eq="0" data-i="${i}" value="${esc(e[0])}" style="width:100%"></td><td><input type="text" data-eq="1" data-i="${i}" value="${esc(e[1])}" list="dlUb"></td><td class="n">${R.inv.filter(o => U(o.asig) === U(e[0])).length}</td><td><button class="btn sm ghost bad" data-act="eqDel" data-i="${i}" type="button">✕</button></td></tr>`).join('')}
      </tbody></table></div>
      <div class="row"><button class="btn sm" data-act="eqAdd" type="button">+ Agregar</button><button class="btn sm ghost" data-act="eqFaltan" type="button">Agregar los textos sin equivalencia (${[...new Set(R.inv.filter(o => o.M === 'POR DEFINIR (REVISAR)').map(o => o.asig))].length})</button><button class="btn pri" data-act="eqSave" type="button">Guardar</button></div></div>`;
  },
  textos() {
    const keys = Object.keys(D.textos);
    return `<div class="card cfgsec"><h2>Textos del acta y la ficha</h2><p class="hint" style="margin:0">Marcadores: {UBICACION} {NOMBRE_UBIC} {TIPO} {EDIFICIO} {FECHA_CONTEO} {TOTAL_BIENES} {INSTITUCION} {PERIODO} {RESPONSABLE} {CORRESPONSABLE} {RESPONSABLES} {N_RESP} {ES_SON} {ENCARGADO} {DIRECTOR} {DESTINATARIO} {FOLIO} {HOY}. En cada punto, lo que va antes de los dos puntos sale en negrita. El punto 7 solo sale cuando hay 2 o más responsables.</p>
      ${keys.map(k => `<div class="field"><span class="lbl">${esc(k)}</span><textarea data-txt="${esc(k)}" rows="${D.textos[k].length > 120 ? 3 : 1}">${esc(D.textos[k])}</textarea></div>`).join('')}
      <div><button class="btn pri" data-act="txtSave" type="button">Guardar textos</button></div></div>`;
  }
};
ACT.cfgTab = b => { UI.cfg = b.dataset.k; render(); };
ACT.cfgSave = async b => {
  const patch = {}; b.dataset.keys.split(',').forEach(k => { const el = $(`[data-cfg="${k}"]`); if (el) patch[k] = el.value.trim(); });
  b.disabled = true; try { await api('api_g_setCfg', patch); await load(); render(); toast('Configuración guardada y códigos recalculados'); } catch (e) { toast(errMsg(e), true); b.disabled = false; }
};
ACT.reglasSave = async b => {
  const cons = b.dataset.which === 'cons' ? $('#consBlqTxt').value.split(/\n|,/).map(s => s.trim()).filter(Boolean) : BASE.consBlq;
  const rc = b.dataset.which === 'rc' ? RCED.filter(p => p[0] || p[1]) : BASE.rc;
  b.disabled = true; try { await api('api_g_setReglas', { consBlq: cons, rc }); RCED = null; await load(); render(); toast('Reglas guardadas y códigos recalculados'); } catch (e) { toast(errMsg(e), true); b.disabled = false; }
};
ACT.rcAdd = () => { RCED.push(['', '', '']); render(); };
ACT.rcDel = b => { RCED.splice(+b.dataset.i, 1); render(); };
ACT.eqAdd = () => { EQED.push(['', '']); render(); };
ACT.eqDel = b => { EQED.splice(+b.dataset.i, 1); render(); };
ACT.eqFaltan = () => { const have = new Set(EQED.map(e => U(e[0]))); [...new Set(R.inv.filter(o => o.M === 'POR DEFINIR (REVISAR)').map(o => o.asig))].forEach(a => { if (!have.has(U(a))) EQED.push([a, '']); }); render(); };
ACT.eqSave = async b => { b.disabled = true; try { await api('api_g_setEq', EQED.filter(e => String(e[0]).trim())); EQED = null; await load(); render(); toast('Equivalencias guardadas'); } catch (e) { toast(errMsg(e), true); b.disabled = false; } };
ACT.txtSave = async b => { const m = {}; $$('[data-txt]').forEach(t => m[t.dataset.txt] = t.value); b.disabled = true; try { const r = await api('api_g_setTextos', m); D.textos = r.textos; toast('Textos guardados'); } catch (e) { toast(errMsg(e), true); } b.disabled = false; };
$('#main').addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.rc != null) RCED[+t.dataset.i][+t.dataset.rc] = t.value.trim();
  if (t.dataset.eq != null) EQED[+t.dataset.i][+t.dataset.eq] = t.value;
});
$('#main').addEventListener('change', async e => {
  const t = e.target; if (t.dataset.loc == null) return;
  const v = t.dataset.loc === 'a' ? t.value === 'Sí' : t.value;
  try { const r = await api('api_g_setLoc', t.dataset.u, { [t.dataset.loc]: v }); D.locs = r.locs; recompute(); toast('Ubicación actualizada'); } catch (er) { toast(errMsg(er), true); }
});

/* ---------- importar el Excel v10 (se lee en el navegador) ---------- */
const ymd = d => { const x = new Date(d.getTime() + 12 * 3600e3), p = n => String(n).padStart(2, '0'); return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`; };
async function parseV10(file) {
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true, cellFormula: true });
  const sh = n => { const w = wb.Sheets[n]; if (!w) throw new Error('El archivo no tiene la hoja ' + n + '. ¿Es el Excel de conteo v10?'); return w; };
  const js = v => v instanceof Date ? ymd(v) : (v === undefined ? null : v);
  const val = (n, a) => { const c = sh(n)[a]; return c ? js(c.v) : null; };
  const inp = (n, a) => { const c = sh(n)[a]; if (!c || c.f) return null; return js(c.v); };
  const s = v => v == null ? '' : String(v);
  const cfg = {}; [['nombre', 'B5'], ['inst', 'B6'], ['periodo', 'B9'], ['corte', 'B10'], ['director', 'B12'], ['encargado', 'B13'], ['e1', 'B15'], ['e2', 'B16'], ['e3', 'B17'], ['modo', 'B19'], ['consDesde', 'B20'], ['consSerie', 'B21']].forEach(([k, a]) => cfg[k] = s(val('CONFIG', a)));
  cfg.otrasInst = [s(val('CONFIG', 'B7')), s(val('CONFIG', 'B8'))];
  const ubic = []; for (let r = 6; r <= 205; r++) ubic.push({ n: s(inp('CONFIG', 'D' + r)).trim(), resp: s(inp('CONFIG', 'G' + r)) });
  const consBlq = []; for (let r = 63; r <= 82; r++) { const v = s(inp('CONFIG', 'A' + r)).trim(); if (v) consBlq.push(v); }
  const rc = []; for (let r = 88; r <= 102; r++) { const a = s(inp('CONFIG', 'A' + r)).trim(), b = s(inp('CONFIG', 'B' + r)).trim(); if (a || b) rc.push([a, b]); }
  const cat = []; for (let r = 5; r <= 638; r++) cat.push({ c: s(inp('CATALOGO', 'A' + r)).trim(), manual: s(inp('CATALOGO', 'D' + r)), inst: s(inp('CATALOGO', 'E' + r)), usar: s(inp('CATALOGO', 'G' + r)), origen: s(inp('CATALOGO', 'S' + r)), descInv: s(inp('CATALOGO', 'T' + r)) });
  while (cat.length && !cat[cat.length - 1].c) cat.pop();
  const rubros = []; for (let r = 2; r <= 60; r++) { const k = s(val('CALC', 'K' + r)).trim(); if (k) rubros.push([k.length === 1 ? '0' + k : k, s(val('CALC', 'L' + r))]); }
  const eq = []; for (let r = 5; r <= 203; r++) { const a = inp('EQUIVALENCIAS', 'A' + r); if (a != null && s(a) !== '') eq.push([s(a), s(inp('EQUIVALENCIAS', 'C' + r))]); }
  const inv = []; const cols = ['code', 'inst', 'blk', 'correl', 'desc', 'marca', 'modelo', 'serie', 'fecha', 'valor', 'calidad', 'asig'];
  for (let r = 5; r <= 3303; r++) { const code = s(inp('INVENTARIO_ANTERIOR', 'A' + r)).trim(); if (!code) continue; const o = {}; cols.forEach((k, i) => o[k] = inp('INVENTARIO_ANTERIOR', 'ABCDEFGHIJKL'[i] + r)); o.code = code; o.manual = s(inp('INVENTARIO_ANTERIOR', 'AD' + r)); inv.push(o); }
  if (!inv.length) throw new Error('INVENTARIO_ANTERIOR está vacío.');
  // ¿mismo orden de ubicaciones?
  const xl = ubic.map(u => u.n).filter(Boolean), app = D.locs.filter(l => !l.nueva).map(l => l.n);
  let at = -1; for (let i = 0; i < Math.max(xl.length, app.length); i++) if (norm(xl[i]) !== norm(app[i])) { at = i; break; }
  const appSet = new Set(D.locs.map(l => norm(l.n)));
  return { d: { cfg, ubic, consBlq, rc, cat, rubros, eq, inv }, ord: { ok: at < 0, at, x: xl[at] || '(fin de la lista)', a: app[at] || '(fin de la lista)', faltan: xl.filter(n => !appSet.has(norm(n))) } };
}
INP.impFile = async el => {
  const f = el.files[0]; if (!f) return;
  $('#impOut').innerHTML = '<div class="row hint"><div class="spin" style="width:18px;height:18px"></div> Leyendo el archivo…</div>';
  try { IMP = await parseV10(f); $('#impOut').innerHTML = MODS.config.impSummary(); }
  catch (e) { IMP = null; $('#impOut').innerHTML = `<div class="banner bad">${esc(errMsg(e))}</div>`; }
};
ACT.impCancel = () => { IMP = null; render(); };
ACT.impGo = async b => {
  b.disabled = true; b.textContent = 'Importando…';
  try { const r = await api('api_g_import', IMP.d); IMP = null; LS.set('gbase', null); await load(); render(); toast(`Importado: ${fmtN(r.inv)} códigos, ${fmtN(r.cat)} bloques, ${r.reglas} reglas${r.resp ? ', ' + r.resp + ' responsables' : ''}`); }
  catch (e) { toast(errMsg(e), true); b.disabled = false; b.textContent = 'Importar estos datos'; }
};

/* ===================== ARRANQUE ===================== */
async function start() {
  window.CARGA0 = window.CARGA0 || performance.now();
  $('#loading').hidden = false; $('#login').hidden = true;
  // Apertura instantánea: muestra lo último que se vio en este equipo y actualiza desde Drive en segundo plano.
  const snap = LS.get('gsnap', null), gb = LS.get('gbase', null);
  if (snap && snap.d && gb && gb.base && gb.gver === snap.d.gver && Date.now() - snap.t < 7 * 864e5) {
    try {
      D = snap.d; BASE = gb.base; ME = D.me; recompute(); D.loadedAt = 0;
      mostrarApp(); setSync('busy', 'Mostrando datos guardados · actualizando…');
      load().then(() => { if (editando()) { setSync('ok', 'Hay datos nuevos · toque ↻'); return; } const y = scrollY; render(); scrollTo(0, y); })
        .catch(e => { if (isAuth(e)) return; setSync('err', 'Sin conexión · mostrando datos guardados'); });
      return;
    } catch (e) { D = null; BASE = null; }
  }
  try { await load(); }
  catch (e) { if (isAuth(e)) return; if (/permiso/i.test(errMsg(e))) { showLogin('Este módulo es solo para supervisores y el administrador.'); return; } $('#loadingMsg').innerHTML = esc(errMsg(e)) + '<br><button class="btn" onclick="start()" type="button">Reintentar</button>'; return; }
  mostrarApp();
}
function mostrarApp() {
  $('#meName').textContent = ME.nombre; $('#meRol').textContent = ME.rol + (BASE.cfg.nombre ? ' · ' + BASE.cfg.nombre : '');
  $('#brandPer').textContent = BASE.cfg.periodo || 'Conteo físico';
  $('#loading').hidden = true; $('#app').hidden = false; render();
  window.__ready = true;
}
/** Hay algo a medio editar (no se debe redibujar la pantalla). */
function editando() {
  if (!$('#modal').hidden) return true;
  const a = document.activeElement; if (a && a.closest && a.closest('#main') && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.type !== 'search') return true;
  return (UI.cat && UI.cat.ce && UI.cat.ce.on) || !!(EQED || RCED);
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && D && Date.now() - (D.loadedAt || 0) > 120000 && !$('#app').hidden) ACT.refresh(); });
window.start = start;
if (TOKEN) start(); else showLogin();

ACT.sysRef = () => { SYS = null; render(); };
ACT.sysUpd = async b => {
  b.disabled = true;
  try { const antes = SYS && SYS.version; SYS = await api('api_sys_actualizar'); render(); toast(SYS.version !== antes ? 'Versión nueva instalada: ' + SYS.version + '. Recargue la página para ver los cambios.' : 'Ya tiene la versión más reciente (' + SYS.version + ').'); }
  catch (e) { toast(errMsg(e), true); b.disabled = false; }
};

/* ---- códigos registrados después del corte ---- */
function extraCheck(code) {
  const c = String(code || '').trim().toUpperCase();
  if (!c) return { ok: false, html: 'Formato: institución-bloque-correlativo' };
  if (!/^\d{5}-\d{4}-\d{4}$/.test(c)) return { ok: false, html: '<span style="color:var(--bad)">Debe ser como 11674-1103-0016</span>' };
  const cfg = BASE.cfg || {}, insts = [String(cfg.inst || '11674')].concat(cfg.otrasInst || []);
  if (!insts.includes(c.slice(0, 5))) return { ok: false, html: `<span style="color:var(--bad)">La institución ${c.slice(0, 5)} no está en Configuración › General</span>` };
  const d = R.catDesc(c.slice(6, 10)); if (!d) return { ok: false, html: `<span style="color:var(--bad)">El bloque ${c.slice(6, 10)} no está en el catálogo</span>` };
  if ((BASE.inv || []).some(o => o.code.toUpperCase() === c)) return { ok: false, html: '<span style="color:var(--wa)">Ya está en el inventario anterior: no hace falta agregarlo</span>' };
  if ((BASE.extra || []).some(o => o.code === c)) return { ok: false, html: '<span style="color:var(--wa)">Ya está en esta lista</span>' };
  const rc = (BASE.rc || []).find(p => p[0] === c.slice(6, 10));
  return { ok: true, html: `<span style="color:var(--ok)">✓ ${esc(d)}</span>${rc ? ` <span style="color:var(--wa)">· ojo: el bloque ${rc[0]} está en corrección de familia → ${rc[1]}</span>` : ''}` };
}
function extraEstado(x) {
  const r = R.logical.find(y => y.AO >= 0 && R.inv[y.AO] && String(R.inv[y.AO].code).toUpperCase() === x.code);
  if (!r) return '<span class="chip">⏳ Aún no se cuenta con esa etiqueta</span>';
  if (r.locMis) return `<span class="chip bad">⚠ Contado en ${esc(r.C)}</span> <a href="#" data-act="go" data-m="conteo" data-u="${esc(r.C)}" data-row="${r.ROW}">ver</a>`;
  if (r.AR) return `<span class="chip re">⇄ Puesto en un bien de otra familia</span>`;
  if (r.AF > 0) return `<span class="chip ok">🔒 Se conserva · ${esc(r.C)}</span>`;
  return `<span class="chip wa">${esc(r.V || 'Revisar')}</span>`;
}
async function extraGuardar(list, msg) {
  const r = await api('api_g_extraSave', list.map(x => ({ code: x.code, ubic: x.ubic, fecha: x.fecha, valor: x.valor, serie: x.serie, obs: x.obs })));
  BASE.extra = r.extra; LS.set('gbase', null); recompute(); render(); toast(msg);
}
INP.exCode = el => { EXF.code = el.value.toUpperCase(); const t = $('#exChk'); if (t) t.innerHTML = extraCheck(EXF.code).html; };
INP.exUbic = el => { EXF.ubic = el.value; }; INP.exFecha = el => { EXF.fecha = el.value; }; INP.exValor = el => { EXF.valor = el.value; };
INP.exSerie = el => { EXF.serie = el.value; }; INP.exObs = el => { EXF.obs = el.value; };
ACT.exAdd = async b => {
  const ck = extraCheck(EXF.code); if (!ck.ok) { toast(ck.html.replace(/<[^>]+>/g, ''), true); return; }
  if (!EXF.ubic) { toast('Elija la ubicación donde está el bien', true); return; }
  b.disabled = true;
  try { const c = EXF.code.trim().toUpperCase(); await extraGuardar((BASE.extra || []).concat([Object.assign({}, EXF, { code: c })]), c + ' agregado: se conserva si se cuenta con su etiqueta en ' + EXF.ubic); EXF = { code: '', ubic: '', fecha: '', valor: '', serie: '', obs: '' }; render(); }
  catch (e) { toast(errMsg(e), true); b.disabled = false; }
};
ACT.exDel = b => { const x = (BASE.extra || [])[+b.dataset.i]; if (!x) return;
  confirmModal(`¿Quitar ${x.code} de la lista? Si el bien se contó con esa etiqueta, dejará de conservarse y recibirá otro código.`, 'Quitar', async () => {
    try { await extraGuardar(BASE.extra.filter((y, i) => i !== +b.dataset.i), x.code + ' quitado de la lista'); } catch (e) { toast(errMsg(e), true); } }); };
