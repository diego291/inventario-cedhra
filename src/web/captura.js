
(() => {
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase().replace(/\s+/g,' ').trim();
const LS = { get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}}, set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}} };
const today = () => { const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); };
const money = v => v==null||v==='' ? '' : '$'+Number(v).toLocaleString('es-SV',{minimumFractionDigits:2,maximumFractionDigits:2});
const rawRun = (fn, ...a) => new Promise((res, rej) => {
  if(!(window.google && google.script && google.script.run)) return rej({message:'Sin conexión con Google'});
  let done=false; const to=setTimeout(()=>{ if(!done){ done=true; rej({message:'El servidor no respondió en 60 s ('+fn+'). Si tiene varias cuentas de Google abiertas, use una ventana de incógnito con una sola.'}); } }, 60000);
  google.script.run.withSuccessHandler(v=>{ if(done) return; done=true; clearTimeout(to); res(v); }).withFailureHandler(e=>{ if(done) return; done=true; clearTimeout(to); rej(e); }).rpc(fn, a);
});
const errMsg = e => (e && e.message) ? e.message.replace(/^(Exception|Error):\s*/,'').replace(/^.*(AUTH|VAL)\|/,'') : 'Error de conexión';
/* ---------- sesión ---------- */
let TOKEN = LS.get('tok',''), ME = null, MINEDEL = [], ADM = null;
const DEV = (()=>{ let d=LS.get('dev',''); if(!/^[A-Za-z0-9]{20,}$/.test(d)){ const a='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'; d=''; const r=new Uint8Array(24); (window.crypto||{}).getRandomValues ? crypto.getRandomValues(r) : r.forEach((_,i)=>r[i]=Math.random()*255); r.forEach(x=>d+=a[x%a.length]); LS.set('dev',d); } return d; })();
const DEVNAME = (()=>{ const u=navigator.userAgent||''; const os=/iPad/.test(u)?'iPad':/iPhone/.test(u)?'iPhone':/Android/.test(u)?(/Mobile/.test(u)?'Celular Android':'Tablet Android'):/Windows/.test(u)?'Computadora Windows':/Mac OS/.test(u)?'Mac':/Linux/.test(u)?'Linux':'Dispositivo'; const br=/Edg\//.test(u)?'Edge':/Firefox\//.test(u)?'Firefox':/Chrome\//.test(u)?'Chrome':/Safari\//.test(u)?'Safari':'Navegador'; return os+' · '+br; })();
const isAuthErr = e => !!(e && e.message && /AUTH\|/.test(e.message));
const run = (fn, ...a) => {
  const args = (fn.indexOf('api_')===0 && fn!=='api_login') ? [TOKEN, ...a] : a;
  return rawRun(fn, ...args).catch(e=>{ if(isAuthErr(e)) onAuthFail(errMsg(e)); throw e; });
};
let toastT;
function toast(m, actLabel, act){
  $('#toastTxt').textContent=m; const b=$('#toastBtn');
  if(actLabel){ b.textContent=actLabel; b.hidden=false; b.onclick=()=>{ $('#toast').hidden=true; act(); }; } else b.hidden=true;
  $('#toast').hidden=false; clearTimeout(toastT); toastT=setTimeout(()=>$('#toast').hidden=true, actLabel?7000:2600);
}

let REF=null; const CAT=new Map(), CATL=[], INV=new Map(), SER=new Map(), INVBYUB=new Map(), INVBLK=new Map();
let LOCS=[], STATE={}, VER=null, online=navigator.onLine!==false, busy=0, REVS=[];
const ROWS=new Map(); let SINCE=0, FULLVER=null, LOCVER=null, syncing=false, OUTBOX=[], REJ=[];
let editingId=null, chosen=null, formFotos=[], uploads=0;
const PREV={}; // id -> dataURL local (vista previa inmediata)

const slug = u => 'u-' + norm(u).replace(/[^A-Z0-9]+/g,'-').replace(/^-|-$/g,'');
const rowsOf = s => { const o=(STATE[s]&&STATE[s].items)||{}; return Object.values(o); };
const allRows = () => { const out=[]; Object.keys(STATE).forEach(s=>rowsOf(s).forEach(r=>out.push({...r,slug:s}))); return out; };
const curUbic = () => { const v=$('#selUbic').value; return v==='__new'?'':v; };
const qty = r => (+r.b||0)+(+r.r||0)+(+r.m||0);
const bienDesc = r => r.blk ? ((CAT.get(r.blk)||{}).d || '(bloque '+r.blk+' fuera de catálogo)') : (r.desc||'');
function setSync(state, txt){ $('#dot').className='dot '+state; $('#syncTxt').textContent=txt; }

/* ---------- imágenes de Drive (miniatura directa; si no carga, la pide al script) ---------- */
const IMGCACHE={};
const driveSrc = (id, w) => PREV[id] || IMGCACHE[id] || (String(id).startsWith('local:') ? 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' : `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w${w||600}`);
const imgTag = (id, cls, w, alt) => `<img class="${cls||''}" data-fid="${esc(id)}" src="${esc(driveSrc(id,w))}" alt="${esc(alt||'')}" loading="lazy">`;
document.addEventListener('error', e => {
  const im=e.target; if(!(im instanceof HTMLImageElement) || !im.dataset.fid || im.dataset.fb) return;
  const id=im.dataset.fid; if(String(id).startsWith('local:')) return;
  im.dataset.fb='1';
  if(IMGCACHE[id]){ im.src=IMGCACHE[id]; return; }
  run('api_getImage', id).then(u=>{ IMGCACHE[id]=u; $$(`img[data-fid="${CSS.escape(id)}"]`).forEach(x=>x.src=u); }).catch(()=>{ im.alt='Sin imagen'; im.style.opacity=.3; });
}, true);

/* ---------- ubicaciones ---------- */
function allUbic(){
  const list=LOCS.map(l=>({...l}));
  const seen=new Set(list.map(u=>norm(u.n)));
  Object.values(STATE).forEach(d=>{ if(!seen.has(norm(d.ubic))){ seen.add(norm(d.ubic)); list.push({n:d.ubic,t:'',z:'',a:true,huerfana:true,i:9000}); } });
  return list;
}
function fillUbicSelect(){
  const sel=$('#selUbic'), cur=sel.value&&sel.value!=='__new'?sel.value:LS.get('ubic','');
  const groups={}, gname=u=>u.huerfana?'Con registros pero sin fila en UBICACIONES':u.nueva?'Agregadas durante el conteo':u.a?(u.t||'Otras'):'No marcadas como activas';
  allUbic().forEach(u=>{ const g=gname(u); (groups[g]=groups[g]||[]).push(u); });
  const rank=g=>g.startsWith('Agregadas')?1:g.startsWith('No marcadas')?2:g.startsWith('Con registros')?3:0;
  const order=Object.keys(groups).sort((a,b)=>rank(a)-rank(b));
  sel.innerHTML='<option value="">— Elija ubicación —</option>'+order.map(g=>`<optgroup label="${esc(g)}">${groups[g].map(u=>`<option value="${esc(u.n)}">${esc(u.n)}${u.z?' · '+esc(u.z):''}</option>`).join('')}</optgroup>`).join('')+'<option value="__new">＋ Ubicación no contemplada…</option>';
  if([...sel.options].some(o=>o.value===cur)) sel.value=cur;
}
async function addLoc(){
  const n=$('#nlNombre').value.trim().toUpperCase(), msg=$('#nlMsg');
  if(n.length<2){ msg.textContent='Escriba el nombre.'; return; }
  const ex=allUbic().find(u=>norm(u.n)===norm(n));
  if(ex){ $('#selUbic').value=ex.n; LS.set('ubic',ex.n); $('#newLoc').hidden=true; renderAll(); toast('Esa ubicación ya existía; quedó seleccionada'); return; }
  const o={n,t:$('#nlTipo').value,z:$('#nlZona').value.trim(),nota:$('#nlNota').value.trim()};
  LOCS.push({n, t:o.t, z:o.z, r:'', a:true, nueva:true, motivo:o.nota, por:ME.nombre, nota:'', cerrada:false, fotos:[], i:LOCS.length});
  enqueue('api_addLoc',[o],'','Ubicación '+n);
  saveCache(); rebuild(); fillUbicSelect();
  $('#selUbic').value=n; LS.set('ubic',n);
  ['#nlNombre','#nlZona','#nlNota'].forEach(x=>$(x).value=''); $('#newLoc').hidden=true; msg.textContent='';
  renderAll(); toast('Ubicación agregada');
}

/* ---------- datos ---------- */
function loadRef(R){
  REF=R; CAT.clear(); CATL.length=0; INV.clear(); SER.clear(); INVBYUB.clear(); INVBYUB.clear(); INVBLK.clear();
  $('#catGrid').innerHTML='';
  REF.cat.forEach(([c,d,r,img,def,ras,noc,reg,med,pre,ale])=>{ const x={c,d,r,img,def,ras,noc,reg,med,pre,ale}; CAT.set(c,x); CATL.push({...x,k:norm(c+' '+d+' '+r)}); });
  const serCount=new Map();
  REF.inv.forEach(([code,desc,marca,modelo,serie,fecha,ub,valor])=>{
    const rec={code,desc,marca,modelo,serie,fecha,ub,valor,blk:(code.split('-')[1]||'')};
    INV.set(norm(code),rec);
    INVBLK.set(rec.blk,(INVBLK.get(rec.blk)||0)+1);
    if(serie){ const k=norm(serie); serCount.set(k,(serCount.get(k)||0)+1); SER.set(k,rec); }
    const u=norm(ub); if(!INVBYUB.has(u)) INVBYUB.set(u,[]); INVBYUB.get(u).push(rec);
  });
  serCount.forEach((n,k)=>{ if(n>1) SER.set(k,'DUP'); });
  $('#hdrInst').textContent = (REF.periodo||'Conteo físico') + ' · ' + (REF.nombre||'');
  if(R.me) setMe(R.me);
  $('#selInst').innerHTML = REF.insts.map((c,i)=>`<option value="${i?esc(c):''}">${esc(c)}${i?'':' (principal)'}</option>`).join('');
  $('#nlTipo').innerHTML = (REF.tipos.length?REF.tipos:['Aula','Oficina / Administrativo','Bodega']).map(t=>`<option>${esc(t)}</option>`).join('');
  $('#inFecha').value = today();
}
/* ================= MOTOR DE DATOS: caché local + cola de envío ================= */
const isValErr = e => !!(e && e.message && /VAL\|/.test(e.message));
const cacheKey = () => 'cache:'+(ME?ME.id:'');
function rebuild(){
  const n={};
  LOCS.forEach(l=>{ n[slug(l.n)]={ubic:l.n, cerrada:l.cerrada, enRev:!!l.enRev, rev:l.rev||null, nota:l.nota, nueva:l.nueva, fotos:l.fotos||[], items:{}}; });
  MINEDEL=[];
  ROWS.forEach(r=>{
    if(r.del){ if(!r.gone) MINEDEL.push({id:r.id, ubic:r.ubic, blk:r.blk, desc:r.desc, cant:qty(r), del:r.del, cont:r.cont, creado:r.creado, uid:r.uid}); return; }
    const s=slug(r.ubic); if(!n[s]) n[s]={ubic:r.ubic,items:{},fotos:[]}; n[s].items[r.id]=r;
  });
  STATE=n;
}
function refreshUI(){ rebuild(); fillUbicSelect(); renderAll(); updEtq(); updSerie(); updFotoNext(); updSyncUI(); revNotices(); }
let saveCacheT=null;
function saveCache(){
  clearTimeout(saveCacheT);
  saveCacheT=setTimeout(()=>{ try{ localStorage.setItem(cacheKey(), JSON.stringify({since:SINCE, ver:VER, fullVer:FULLVER, locVer:LOCVER, locs:LOCS, rows:[...ROWS.values()]})); }catch(e){} }, 400);
}
function loadCache(){
  try{ const c=JSON.parse(localStorage.getItem(cacheKey())||'null'); if(!c) return false;
    ROWS.clear(); (c.rows||[]).forEach(r=>ROWS.set(r.id,r)); LOCS=c.locs||[]; SINCE=c.since||0; VER=c.ver||null; FULLVER=c.fullVer||null; LOCVER=c.locVer||null; return true;
  }catch(e){ return false; }
}
const pendingIds = () => new Set(OUTBOX.map(o=>o.rid).filter(Boolean));
function applyDelta(st){
  if(!st) return;
  if(st.me) setMe(st.me);
  if(st.same){ return; }
  const pend=pendingIds();
  if(st.full){ [...ROWS.keys()].forEach(id=>{ if(!pend.has(id)) ROWS.delete(id); }); }
  (st.rows||[]).forEach(r=>{ if(pend.has(r.id)) return; if(r.gone){ ROWS.delete(r.id); return; } ROWS.set(r.id, r); });
  if(st.locs) LOCS=st.locs;
  VER=st.ver; FULLVER=st.fullVer; LOCVER=st.locVer; SINCE=Math.max(0,(st.now||Date.now())-15000);
  saveCache(); refreshUI();
}
/* ---- cola de envío (se guarda en el teléfono) ---- */
function loadOutbox(){ OUTBOX=LS.get('outbox',[]); REJ=LS.get('rejected',[]); }
function saveOutbox(){ LS.set('outbox',OUTBOX); LS.set('rejected',REJ.slice(-20)); updSyncUI(); }
function enqueue(fn, args, rid, label){
  OUTBOX.push({q:Date.now().toString(36)+Math.random().toString(36).slice(2,6), fn, args, rid:rid||'', uid:ME?ME.id:'', label:label||'', t:Date.now()});
  saveOutbox(); setTimeout(sync, 50);
}
/* ---- fotos guardadas en el teléfono hasta poder subirlas ---- */
let IDB=null;
function idb(){ if(IDB) return IDB; IDB=new Promise((res)=>{ try{ const rq=indexedDB.open('conteo',1); rq.onupgradeneeded=()=>rq.result.createObjectStore('fotos'); rq.onsuccess=()=>res(rq.result); rq.onerror=()=>res(null); }catch(e){ res(null); } }); return IDB; }
const MEMFOTO={};
async function fotoPut(k,v){ MEMFOTO[k]=v; const d=await idb(); if(!d) return; await new Promise(r=>{ const t=d.transaction('fotos','readwrite'); t.objectStore('fotos').put(v,k); t.oncomplete=r; t.onerror=r; }); }
async function fotoGet(k){ if(MEMFOTO[k]) return MEMFOTO[k]; const d=await idb(); if(!d) return null; return new Promise(r=>{ const q=d.transaction('fotos').objectStore('fotos').get(k); q.onsuccess=()=>r(q.result||null); q.onerror=()=>r(null); }); }
async function fotoDel(k){ delete MEMFOTO[k]; const d=await idb(); if(!d) return; d.transaction('fotos','readwrite').objectStore('fotos').delete(k); }
async function loadLocalPreviews(){ for(const o of OUTBOX){ if(o.fn==='api_uploadPhoto'){ const v=await fotoGet(o.args[0]); if(v) PREV['local:'+o.args[0]]=v; } } }
const PHOTOMAP = LS.get('photomap',{});
function mapFoto(f){ const m=/^local:(.+)$/.exec(String(f.id)); if(!m||!PHOTOMAP[m[1]]) return f; return {...f, id:PHOTOMAP[m[1]].id, n:PHOTOMAP[m[1]].n}; }
function resolveArgs(op){
  const a=JSON.parse(JSON.stringify(op.args));
  if(op.fn==='api_saveRow') a[0].fotos=(a[0].fotos||[]).map(mapFoto);
  if(op.fn==='api_setLoc' && a[1] && a[1].fotoAdd) a[1].fotoAdd=mapFoto(a[1].fotoAdd);
  return a;
}
function replaceLocalFoto(lid, real){
  ROWS.forEach(r=>{ if((r.fotos||[]).some(f=>f.id==='local:'+lid)){ r.fotos=r.fotos.map(f=>f.id==='local:'+lid?{...f,id:real.id,n:real.n}:f); } });
  formFotos=formFotos.map(f=>f.id==='local:'+lid?{...f,id:real.id,n:real.n}:f);
  LOCS.forEach(l=>{ l.fotos=(l.fotos||[]).map(f=>f.id==='local:'+lid?{...f,id:real.id,n:real.n}:f); });
}
const rawRunT = (ms, fn, ...a) => Promise.race([rawRun(fn, ...a), new Promise((_,rej)=>setTimeout(()=>rej({message:'Sin respuesta (señal débil)'}), ms))]);
async function flush(){
  while(true){
    const op=OUTBOX.find(o=>!o.uid || (ME && o.uid===ME.id));
    if(!op) return;
    try{
      if(op.fn==='api_uploadPhoto'){
        const lid=op.args[0], data=await fotoGet(lid);
        if(!data){ OUTBOX=OUTBOX.filter(o=>o!==op); saveOutbox(); continue; }
        const r=await rawRunT(90000, 'api_uploadPhoto', TOKEN, data.split(',')[1], op.args[1]);
        PHOTOMAP[lid]={id:r.id,n:r.n}; LS.set('photomap',PHOTOMAP); PREV[r.id]=data; replaceLocalFoto(lid, r); fotoDel(lid);
      } else {
        await rawRunT(30000, op.fn, TOKEN, ...resolveArgs(op));
      }
      OUTBOX=OUTBOX.filter(o=>o!==op); saveOutbox();
      if(op.rid){ const r=ROWS.get(op.rid); if(r && !pendingIds().has(op.rid)){ delete r._p; } }
    }catch(e){
      if(isAuthErr(e)){ onAuthFail(errMsg(e)); throw e; }
      if(isValErr(e)){
        OUTBOX=OUTBOX.filter(o=>o!==op); REJ.push({t:Date.now(), label:op.label||op.fn, msg:errMsg(e)}); saveOutbox();
        FULLVER=null; showRejected(); continue;
      }
      throw e; // sin señal o error temporal: se reintenta después
    }
  }
}
function showRejected(){
  const b=$('#rejBanner'); if(!REJ.length){ b.hidden=true; return; }
  const last=REJ.slice(-3).reverse();
  b.hidden=false; b.innerHTML=`<b>No se pudo guardar:</b> ${last.map(r=>esc(r.label)+' — '+esc(r.msg)).join('<br>')}<br><button type="button" class="btn sm" id="rejOk">Entendido</button>`;
  $('#rejOk').onclick=()=>{ REJ=[]; saveOutbox(); b.hidden=true; };
}
function updSyncUI(){
  const mine=OUTBOX.filter(o=>!o.uid||(ME&&o.uid===ME.id)).length, others=OUTBOX.length-mine;
  const qb=$('#qBadge'); qb.hidden=!mine; qb.textContent=mine;
  if(!online) setSync('off','Sin señal');
  else if(syncing||mine) setSync('busy', mine?'Enviando…':'Actualizando…');
  else setSync('on','Al día '+new Date().toLocaleTimeString('es-SV',{hour:'2-digit',minute:'2-digit'}));
  const ob=$('#offBanner');
  if(!online && mine){ ob.hidden=false; ob.innerHTML=`<b>Sin señal.</b> ${mine} cambio${mine===1?'':'s'} guardado${mine===1?'':'s'} en este teléfono. Se enviarán solos al volver la conexión. <b>No cierre ni recargue esta página.</b>`; }
  else if(others){ ob.hidden=false; ob.textContent=`Hay ${others} registro(s) de otra persona pendientes en este teléfono: que esa persona entre con su código para enviarlos.`; }
  else ob.hidden=true;
}
async function sync(){
  if(syncing||!TOKEN||!ME) return;
  syncing=true; updSyncUI();
  try{
    await flush();
    const st=await rawRunT(30000, 'api_getState', TOKEN, {since:SINCE, ver:VER, fullVer:FULLVER, locVer:LOCVER});
    online=true; applyDelta(st);
    if(ME&&ME.lvl>=3&&!$('#tab-equipo').hidden) loadAdmin();
  }catch(e){
    if(isAuthErr(e)){ onAuthFail(errMsg(e)); }
    else online=false;
  }finally{ syncing=false; updSyncUI(); }
}
const waitsRev = () => !!ME && ((ME.lvl||1)>=2 || LOCS.some(l=>l.enRev && l.rev && l.rev.sol && l.rev.sol.uid===ME.id));
async function poll(){ if(document.hidden && !OUTBOX.length && !waitsRev()) return; return sync(); }
/* compatibilidad con llamadas antiguas */
async function call(fn, ...a){ enqueue(fn, a); }
function restoreLocal(id){
  const row=ROWS.get(id); if(row){ row.del=''; row._p=1; delete row.gone; }
  enqueue('api_restoreRow',[id], id, 'Restaurar registro');
  saveCache(); refreshUI(); toast('Registro restaurado');
}
function localSaveRow(p){
  const old=ROWS.get(p.id);
  const ref = old && old.ref && (ME.lvl||1)>=2 ? old.ref : null;
  ROWS.set(p.id, {...(old||{}), ...p, ref, uid: old?old.uid:ME.id, cont: old?old.cont:ME.nombre, creado: old?old.creado:p.creado, editadoPor: old&&old.uid!==ME.id?ME.nombre:(old?old.editadoPor:''), del:'', _p:1, ts:Date.now()});
  saveCache(); refreshUI();
}

/* ---------- nombre de fotos: UBICACION_BLOQUE_AAAAMMDD_NN(-TIPO).jpg ---------- */
const fileSafe = s => String(s||'').trim().replace(/\s+/g,'-').replace(/[\/\\:*?"<>|#%]+/g,'-').replace(/-+/g,'-');
function nextPhotoName(ubic, blk, fecha, tipo){
  const pre=`${fileSafe(ubic)}_${blk||'SINCAT'}_${(fecha||today()).replace(/-/g,'')}_`; let max=0;
  const take=n=>{ if(n&&n.startsWith(pre)){ const k=parseInt(n.slice(pre.length),10); if(k>max) max=k; } };
  allRows().forEach(r=>(r.fotos||[]).forEach(f=>take(f.n)));
  formFotos.forEach(f=>take(f.n));
  return pre+String(max+1).padStart(2,'0')+(tipo?'-'+tipo:'')+'.jpg';
}
function locPhotoName(ubic, fecha){
  const pre=`${fileSafe(ubic)}_GENERAL_${(fecha||today()).replace(/-/g,'')}_`; let max=0;
  ((STATE[slug(ubic)]||{}).fotos||[]).forEach(f=>{ if(f.n&&f.n.startsWith(pre)){ const k=parseInt(f.n.slice(pre.length),10); if(k>max) max=k; } });
  return pre+String(max+1).padStart(2,'0')+'.jpg';
}
function updFotoNext(){
  const u=curUbic();
  $('#fotoNext').textContent = (u && chosen) ? 'La próxima foto se llamará: '+nextPhotoName(u, chosen.c, $('#inFecha').value, $('#fotoTipo').value) : 'Elija ubicación y bien para ver el nombre que recibirá la foto.';
}
async function toJpegDataUrl(file){
  try{
    const bmp=await createImageBitmap(file);
    const s=Math.min(1,1600/Math.max(bmp.width,bmp.height));
    const c=document.createElement('canvas'); c.width=Math.round(bmp.width*s); c.height=Math.round(bmp.height*s);
    c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);
    return c.toDataURL('image/jpeg',.82);
  }catch(e){
    return await new Promise((res,rej)=>{ const fr=new FileReader(); fr.onload=()=>res(fr.result); fr.onerror=rej; fr.readAsDataURL(file); });
  }
}
function renderFormFotos(){
  const TL={'':'Bien',ETIQUETA:'Etiqueta',SERIE:'Placa/serie',DANO:'Daño'};
  $('#frmFotos').innerHTML=formFotos.map((f,i)=>`<div class="ph">${imgTag(f.id,'',400,f.n)}<small>${esc(TL[f.t||'']||f.t)}${String(f.id).startsWith('local:')?' · ⏳':''} · ${esc(f.n)}</small><button type="button" data-rm="${i}">Quitar</button></div>`).join('');
  updFotoNext(); if(typeof updReq==='function') updReq();
}

/* ---------- catálogo / fichas ---------- */
function openFicha(code){
  const x=CAT.get(code); if(!x) return;
  const linkify=t=>esc(t).replace(/\b(\d{4})\b/g,(m,c)=>CAT.has(c)?`<button type="button" class="lnk" data-ficha="${c}">${c}</button>`:m);
  const rows=[['Definición',x.def],['Rasgo que decide',x.ras],['No confundir con',x.noc],['Registrar',x.reg],['Medidas típicas',x.med],['Precio de referencia',x.pre],['Alerta',x.ale]].filter(r=>r[1]);
  $('#modalBody').innerHTML=`<div class="sec-h"><h2><span class="mono" style="color:var(--warn)">${x.c}</span> ${esc(x.d)}</h2><span class="spacer"></span><button type="button" class="btn ghost sm" data-close>Cerrar</button></div>
    <span class="hint">${esc(x.r)}</span>
    ${x.img?imgTag(x.img,'fimg',1400,x.d):'<div class="empty">Este bloque no tiene dibujo en el catálogo.</div>'}
    ${rows.length?`<dl class="fdl">${rows.map(([k,v])=>`<dt>${k}</dt><dd>${linkify(v)}</dd>`).join('')}</dl>`:''}
    <div class="row"><button type="button" class="btn primary" data-use="${x.c}" style="flex:1">Usar este bien</button></div>`;
  $('#modal').hidden=false; $('#modalBody').scrollTop=0;
}
function closeModal(){ $('#modal').hidden=true; }
function renderCat(){
  const q=norm($('#catQ').value), solo=$('#catSoloImg').checked;
  let L=CATL.filter(x=>(!solo||x.img||x.def));
  if(q){ const ws=q.split(' '); L=L.filter(x=>ws.every(w=>x.k.includes(w))); }
  $('#catMeta').textContent=`${L.length} bienes`;
  $('#catGrid').innerHTML=L.slice(0,200).map(x=>`<button type="button" class="ccard" data-ficha="${x.c}">${x.img?imgTag(x.img,'',500,x.d):'<span class="noimg">Sin dibujo</span>'}<div><span class="mono">${x.c}</span>${esc(x.d)}</div></button>`).join('')||'<div class="empty">Nada coincide.</div>';
}

/* ---------- búsqueda del bien ---------- */
function searchCat(q){
  const n=norm(q); if(!n) return [];
  let out=[];
  if(/^\d{5}-\d{4}/.test(n)){ const r=INV.get(n); const c=CAT.get(n.split('-')[1]); if(c) out=[{...c,why:r?('etiqueta vieja de '+r.desc+(r.ub?' · antes en '+r.ub:'')):'bloque del código'}]; }
  else if(/^\d+$/.test(n)) out=CATL.filter(x=>x.c.startsWith(n)).slice(0,30);
  else {
    const s=SER.get(n); if(s&&s!=='DUP'){ const c=CAT.get(s.blk); if(c) out.push({...c,why:'serie de '+s.code}); }
    const ws=n.split(' ');
    const m=CATL.filter(x=>ws.every(w=>x.k.includes(w)));
    m.sort((a,b)=>((norm(a.d).startsWith(ws[0])?0:1)-(norm(b.d).startsWith(ws[0])?0:1))||((INVBLK.get(b.c)||0)-(INVBLK.get(a.c)||0)));
    out=out.concat(m.slice(0,30));
  }
  if(n.length>=3 && !/^\d{5}-/.test(n)){
    const ws=n.split(' '), prev=new Map();
    allRows().forEach(r=>{ if(r.blk||!r.desc) return; const k=norm(r.desc); if(!ws.every(w=>k.includes(w))) return; const x=prev.get(k)||{d:r.desc.toUpperCase(),n:0,f:0}; x.n++; x.f+=(r.fotos||[]).length; prev.set(k,x); });
    [...prev.values()].sort((a,b)=>b.n-a.n).slice(0,5).forEach(x=>out.push({free:true,d:x.d,prev:x}));
    if(!prev.has(n)) out.push({free:true,d:q.trim().toUpperCase()});
  }
  return out;
}
let sIdx=-1, sList=[];
function renderSugg(){
  const ul=$('#lsBien');
  if(!sList.length){ ul.hidden=true; return; }
  ul.innerHTML=sList.map((x,i)=> x.free
    ? (x.prev ? `<li role="option" class="free" data-i="${i}" aria-selected="${i===sIdx}"><span class="mono">¿?</span><span>Ya registrado fuera de catálogo: “${esc(x.d)}”<small>${x.prev.n} registro${x.prev.n===1?'':'s'}${x.prev.f?' · '+x.prev.f+' foto'+(x.prev.f===1?'':'s')+' en Referencias':''} · use el mismo nombre</small></span></li>`
      : `<li role="option" class="free" data-i="${i}" aria-selected="${i===sIdx}"><span class="mono">¿?</span><span>No está en el catálogo: registrar “${esc(x.d)}”<small>Queda marcado para revisión del encargado</small></span></li>`)
    : `<li role="option" data-i="${i}" aria-selected="${i===sIdx}"><span class="mono">${x.c}</span><span>${esc(x.d)}${x.img?' 🖼':''}<small>${esc(x.why||x.r)}</small></span></li>`).join('');
  ul.hidden=false;
}
function choose(x){
  chosen = x ? (x.free ? {c:'',d:x.d,free:true} : {...CAT.get(x.c)||x}) : null;
  $('#inBien').value=''; sList=[]; renderSugg();
  $('#bienWrap').hidden=!!chosen;
  const ch=$('#bienChosen');
  if(chosen){
    const u=curUbic(), antHere=(INVBYUB.get(norm(u))||[]).filter(r=>r.blk===chosen.c).length;
    const cont=allRows().filter(r=>r.blk&&r.blk===chosen.c).reduce((a,r)=>a+qty(r),0), hereCont=rowsOf(slug(u)).filter(r=>r.blk===chosen.c&&r.id!==editingId).reduce((a,r)=>a+qty(r),0);
    const ctx = chosen.free ? 'Fuera del catálogo: el Excel lo mostrará con ⚠ hasta que el encargado le asigne bloque.'
      : `Inventario anterior: ${antHere} aquí · ${INVBLK.get(chosen.c)||0} en total. Contados: ${hereCont} aquí · ${cont} en toda la institución.`;
    ch.hidden=false;
    const rf=refsFor(chosen), rfv=rf.filter(r=>r.ref).length;
    const refBtn = rf.length ? `<button type="button" class="btn sm" data-refgo="1">📷 ${rf.length} referencia${rf.length===1?'':'s'}${rfv?' · '+rfv+' ✓':''}</button>` : '';
    ch.innerHTML=`${chosen.img?imgTag(chosen.img,'thumb',400,chosen.d).replace('<img','<img data-ficha="'+chosen.c+'"'):''}<span class="mono">${chosen.free?'¿?':chosen.c}</span><span style="flex:1;min-width:0"><b>${esc(chosen.d)}</b>${chosen.r?`<br><small style="color:var(--muted)">${esc(chosen.r)}</small>`:''}</span>${(chosen.img||chosen.def)?`<button type="button" class="btn ghost sm" data-ficha="${chosen.c}">Ver ficha</button>`:''}${refBtn}<button type="button" class="btn ghost sm" id="chgBien">Cambiar</button><span class="ctx">${esc(ctx)}${chosen.med?' · Medidas típicas: '+esc(chosen.med):''}</span>`;
    $('#chgBien').onclick=()=>{ choose(null); $('#inBien').focus(); };
    if(chosen.free){ $('#chkRev').checked=true; $('#revWrap').hidden=false; if(!$('#inRev').value) $('#inRev').value='Bien fuera del catálogo'; }
  } else ch.hidden=true;
  updEtq(); updQty(); updFotoNext();
}

/* ---------- etiqueta y serie ---------- */
function lookupEtq(e){
  const n=norm(e); if(!n) return null;
  const r=INV.get(n); if(r) return {rec:r,by:'código'};
  const s=SER.get(n); if(s==='DUP') return {dup:true}; if(s) return {rec:s,by:'serie'};
  return {none:true, looksCode:/^\d{5}-\d{4}-\d{1,4}$/.test(n)};
}
function etqVerdict(e, blk){
  const L=lookupEtq(e); if(!L) return null;
  if(L.dup) return {cls:'warn',chip:'Serie repetida',txt:'Esa serie aparece en varios bienes del inventario anterior. Escriba el código completo de la etiqueta.'};
  if(L.none) return L.looksCode
    ? {cls:'bad',chip:'No existe',txt:'Ese código no está en el inventario anterior. Revise que esté bien escrito; si es correcto, el bien recibe código nuevo.'}
    : {cls:'bad',chip:'Desconocida',txt:'No coincide con ningún código ni número de serie del inventario anterior.'};
  const r=L.rec, fam=CAT.get(r.blk), base={rec:r,by:L.by};
  if(!blk) return {...base,cls:'info',chip:'Encontrada',txt:'Etiqueta encontrada. Elija el bien según catálogo para validar la familia.'};
  const corr=(REF.corrFam||[]).find(([a,b])=>a===r.blk&&b===blk);
  if(corr) return {...base,cls:'info',chip:'Corrección de familia',txt:`La familia ${r.blk} se corrige a ${blk}: el código viejo va a descargo y el bien se carga en ${blk} con su fecha y valor originales.`};
  if(r.blk===blk) return {...base,cls:'ok',chip:'Conserva',txt:'🔒 Conserva su código.'};
  return {...base,cls:'warn',chip:'Reetiquetar',one:true,txt:`↺ La etiqueta es de otra familia (${r.blk} ${fam?fam.d:''}). Se reetiqueta como ${blk}; el código viejo queda como evidencia y va a descargo.`};
}
function oldRecHtml(r, u){
  const moved = r.ub && u && norm(r.ub)!==norm(u);
  return `<dl class="oldrec"><dt>Código</dt><dd class="mono">${esc(r.code)}</dd><dt>Bien</dt><dd>${esc(r.desc)}</dd>${(r.marca||r.modelo)?`<dt>Marca</dt><dd>${esc([r.marca,r.modelo].filter(Boolean).join(' · '))}</dd>`:''}${r.serie?`<dt>Serie</dt><dd class="mono">${esc(r.serie)}</dd>`:''}${r.fecha?`<dt>Adquirido</dt><dd>${esc(r.fecha)}</dd>`:''}${r.valor!=null?`<dt>Valor</dt><dd>${money(r.valor)}</dd>`:''}${r.ub?`<dt>Ubicación ant.</dt><dd>${esc(r.ub)}${moved?' · <b>estaba en otra ubicación</b>':''}</dd>`:''}</dl>`;
}
function dupEtq(e, exceptId){ const n=norm(e); if(!n) return []; return [...new Set(allRows().filter(r=>r.id!==exceptId&&norm(r.etq)===n).map(r=>r.ubic))]; }
function updEtq(){
  const e=$('#inEtq').value, box=$('#etqStatus');
  const v=etqVerdict(e, chosen&&chosen.c);
  if(!v){ box.hidden=true; updQty(); return; }
  const d=dupEtq(e, editingId);
  box.className='status '+v.cls; box.hidden=false;
  box.innerHTML=`<span>${esc(v.txt)}</span>${v.rec?oldRecHtml(v.rec,curUbic())+'<div><button type="button" class="btn sm" id="copyOld">Copiar marca, modelo y serie</button></div>':''}${d.length?`<b>⚠ Esta etiqueta ya se registró en: ${esc(d.join(', '))}.</b>`:''}`;
  if(v.rec) $('#copyOld').onclick=()=>{ $('#inMarca').value=v.rec.marca||''; $('#inModelo').value=v.rec.modelo||''; $('#inSerie').value=v.rec.serie||''; $('#more').open=true; updSerie(); toast('Datos copiados del inventario anterior'); };
  updQty();
}
function updSerie(){
  const s=$('#inSerie').value, box=$('#serieStatus'), n=norm(s);
  if(!n){ box.hidden=true; return; }
  const parts=[], r=SER.get(n);
  if(r==='DUP') parts.push({c:'warn',h:'Esa serie aparece en varios bienes del inventario anterior.'});
  else if(r){
    if(norm($('#inEtq').value)===norm(r.code)||norm($('#inEtq').value)===n) parts.push({c:'ok',h:`Coincide con ${esc(r.code)}.`});
    else parts.push({c:'info',h:`Esta serie es de <span class="mono">${esc(r.code)}</span> (${esc(r.desc)}) en el inventario anterior. <button type="button" class="btn sm" id="useSer">Usar como etiqueta</button>`});
  }
  const d=[...new Set(allRows().filter(x=>x.id!==editingId&&norm(x.serie)===n).map(x=>x.ubic))];
  if(d.length) parts.push({c:'bad',h:`⚠ Esa serie ya se registró en: ${esc(d.join(', '))}.`});
  if(!parts.length){ box.hidden=true; return; }
  box.className='status '+parts[parts.length-1].c; box.hidden=false; box.innerHTML=parts.map(p=>`<span>${p.h}</span>`).join('');
  const b=$('#useSer'); if(b) b.onclick=()=>{ $('#inEtq').value=r.code; updEtq(); updSerie(); $('#inEtq').scrollIntoView({block:'center',behavior:'smooth'}); };
}
function getQ(){ return {b:Math.max(0,parseInt($('#qb').value)||0), r:Math.max(0,parseInt($('#qr').value)||0), m:Math.max(0,parseInt($('#qm').value)||0)}; }
function updQty(){
  const q=getQ(), t=q.b+q.r+q.m;
  $('#qTot').textContent=t;
  const e=$('#inEtq').value.trim();
  $('#rangeHint').textContent = (e && t>1) ? `Rango: ${t} códigos seguidos desde ${e}` : '';
  const v=e?etqVerdict(e, chosen&&chosen.c):null, w=$('#qWarn');
  if(v&&v.one&&t!==1){ w.hidden=false; w.textContent='Una etiqueta de otra familia corresponde a un solo bien: registre cantidad 1 por cada etiqueta.'; }
  else if(v&&v.by==='serie'&&t>1){ w.hidden=false; w.textContent='Un número de serie identifica un solo bien: la cantidad debería ser 1.'; }
  else if(t>500){ w.hidden=false; w.textContent='Cantidad muy alta: revise que esté bien escrita.'; }
  else w.hidden=true;
  updReq();
}

/* ---------- reglas obligatorias ---------- */
function requisitos(){
  const out=[]; if(!chosen) return out;
  const q=getQ(), t=q.b+q.r+q.m, e=$('#inEtq').value.trim(), v=e?etqVerdict(e, chosen.c):null, hasT=x=>formFotos.some(f=>f.t===x);
  if(t<=0) out.push('cantidad mayor que cero');
  if(v&&v.one){ if(t!==1) out.push('cantidad 1 (una etiqueta = un bien)'); if(!hasT('ETIQUETA')) out.push('foto de la etiqueta (tipo "Etiqueta")'); }
  if(v&&v.by==='serie'&&t!==1) out.push('cantidad 1 (un número de serie = un bien)');
  if(q.m>0 && !formFotos.length) out.push('una foto (hay bienes en mal estado)');
  if(chosen.free && !formFotos.length) out.push('una foto (bien fuera de catálogo)');
  if(e && dupEtq(e, editingId).length && $('#inJust').value.trim().length<5) out.push('justificación de la etiqueta repetida');
  return out;
}
function updReq(){
  const r=requisitos(), box=$('#reqLine');
  $('#justWrap').hidden = !($('#inEtq').value.trim() && dupEtq($('#inEtq').value, editingId).length);
  if(!r.length){ box.hidden=true; return; }
  box.hidden=false; box.innerHTML='<b>Para guardar falta:</b> '+r.map(esc).join(' · ');
}

/* ---------- formulario ---------- */
function resetForm(){
  editingId=null; formFotos=[];
  $('#frmTitle').textContent='Nuevo registro'; $('#btnCancel').textContent='Limpiar'; $('#btnSave').textContent='Guardar registro';
  choose(null);
  ['#inEtq','#inMarca','#inModelo','#inSerie','#inObs','#inRev','#inJust'].forEach(s=>$(s).value='');
  ['#qb','#qr','#qm'].forEach(s=>$(s).value='0');
  $('#chkRev').checked=false; $('#revWrap').hidden=true; $('#fotoTipo').value='';
  $('#selInst').value=''; $('#frmErr').hidden=true; $('#more').open=false; $('#serieStatus').hidden=true; $('#fotoMsg').textContent='';
  renderFormFotos(); updEtq(); updQty(); renderItems();
}
function loadRow(r, asCopy){
  editingId = asCopy ? null : r.id;
  $('#frmTitle').textContent = asCopy ? 'Nuevo registro (copia)' : 'Editando registro';
  $('#btnCancel').textContent = asCopy ? 'Limpiar' : 'Cancelar edición'; $('#btnSave').textContent = asCopy ? 'Guardar registro' : 'Guardar cambios';
  choose(r.blk ? (CAT.get(r.blk)||{c:r.blk,d:'(fuera de catálogo)'}) : {free:true,d:r.desc||''});
  $('#inEtq').value = asCopy ? '' : (r.etq||'');
  $('#qb').value = asCopy ? 0 : (r.b||0); $('#qr').value = asCopy ? 0 : (r.r||0); $('#qm').value = asCopy ? 0 : (r.m||0);
  $('#inMarca').value=r.marca||''; $('#inModelo').value=r.modelo||''; $('#inSerie').value = asCopy ? '' : (r.serie||'');
  $('#inObs').value = asCopy ? '' : (r.obs||''); $('#chkRev').checked=!!r.revisar && !asCopy; $('#revWrap').hidden=!$('#chkRev').checked; $('#inRev').value = asCopy ? '' : (r.motivo||'');
  if(chosen&&chosen.free){ $('#chkRev').checked=true; $('#revWrap').hidden=false; if(!$('#inRev').value) $('#inRev').value='Bien fuera del catálogo'; }
  $('#selInst').value=r.inst||'';
  formFotos = asCopy ? [] : (r.fotos||[]).map(f=>({...f}));
  $('#more').open=!!(r.marca||r.modelo||r.serie||r.obs||r.revisar||r.inst);
  if(r.fecha && !asCopy) $('#inFecha').value=r.fecha;
  renderFormFotos(); updEtq(); updSerie(); updQty(); renderItems();
  $('#frm').scrollIntoView({behavior:'smooth',block:'start'});
  if(asCopy) setTimeout(()=>$('#qb').focus(),300);
}
function rowPayload(id, u){
  const q=getQ(), s=slug(u);
  const prev=editingId && STATE[s] && STATE[s].items[editingId];
  const etq=$('#inEtq').value.trim().toUpperCase(), v=etq?etqVerdict(etq, chosen.c):null;
  return {id, ubic:u, fecha:$('#inFecha').value||today(), blk:chosen.c||'', desc:chosen.free?chosen.d:'',
    bien: chosen.free ? chosen.d : (chosen.c+' - '+chosen.d), etq, val: v?v.chip:'', ...q,
    marca:$('#inMarca').value.trim(), modelo:$('#inModelo').value.trim(), serie:$('#inSerie').value.trim().toUpperCase(), obs:$('#inObs').value.trim(),
    revisar:$('#chkRev').checked, motivo:$('#chkRev').checked?$('#inRev').value.trim():'',
    fotos:formFotos.map(f=>({id:f.id,n:f.n,t:f.t||'',p:f.p||'',d:f.d||0})), inst:$('#selInst').value||'',
    cont:prev?prev.cont:$('#selCont').value, creado:prev&&prev.creado?prev.creado:Date.now(), editadoPor: prev ? ($('#selCont').value!==prev.cont ? $('#selCont').value : (prev.editadoPor||'')) : ''};
}
async function save(ev){
  ev.preventDefault();
  const err=m=>{ const b=$('#frmErr'); b.textContent=m; b.hidden=false; b.scrollIntoView({block:'center',behavior:'smooth'}); };
  $('#frmErr').hidden=true;
  const u=curUbic(); if(!u) return err('Elija la ubicación.');
  if(locked(u)) return err('Esta ubicación está cerrada: no se pueden agregar ni cambiar registros. Pida a un supervisor que la reabra.');
  if(!$('#selCont').value) return err('Elija quién está contando.');
  if(!chosen) return err('Elija el bien según el catálogo (o regístrelo como fuera de catálogo).');
  if(uploads>0) return err('Espere un momento: se están preparando las fotos.');
  if($('#chkRev').checked && !$('#inRev').value.trim()) return err('Escriba el motivo de la revisión.');
  const req=requisitos(); if(req.length) return err('Falta: '+req.join(' · '));
  const id=editingId||('R'+Date.now().toString(36).toUpperCase()+Math.random().toString(36).slice(2,5).toUpperCase());
  const wasEdit=!!editingId, p=rowPayload(id,u);
  if(dupEtq(p.etq, editingId).length) p.just=$('#inJust').value.trim();
  localSaveRow(p);
  enqueue('api_saveRow',[p], id, (p.blk||'')+' '+(chosen?chosen.d:'')+' · '+u);
  toast(wasEdit?'Cambios guardados':(online?'Registro guardado':'Guardado en el teléfono: se enviará al volver la señal'));
  resetForm(); $('#inBien').focus();
}

/* ---------- ubicación: info, nota, foto general ---------- */
function renderLocInfo(){
  const u=curUbic(), box=$('#locInfo');
  $('#locMore').hidden=!u;
  if(!u){ box.innerHTML=''; return; }
  const x=allUbic().find(v=>v.n===u)||{}, d=STATE[slug(u)]||{};
  const ant=(INVBYUB.get(norm(u))||[]).length, bits=[];
  if(x.t) bits.push(`<span class="chip mut">${esc(x.t)}</span>`);
  if(x.z) bits.push(`<span class="chip mut">${esc(x.z)}</span>`);
  if(x.r) bits.push(`<span class="chip mut">Responsable: ${esc(x.r)}</span>`);
  if(x.nueva) bits.push('<span class="chip warn">Nueva: agregar a CONFIG del Excel</span>');
  bits.push(`<span class="chip info">${ant} bienes en inventario anterior</span>`);
  if(d.cerrada) bits.push('<span class="chip ok">✓ Cerrada</span>');
  else if(d.enRev) bits.push('<span class="chip info">🔔 Esperando revisión</span>');
  if(d.nota) bits.push(`<span>📝 ${esc(d.nota)}</span>`);
  box.innerHTML=bits.join('');
  if(document.activeElement!==$('#locNota')) $('#locNota').value=d.nota||'';
  const fg=d.fotos||[];
  $('#locFotos').innerHTML = fg.length ? fg.map(f=>`<div class="ph">${imgTag(f.id,'',400,f.n)}<small>${esc(f.n)}</small><button type="button" data-rmg="${esc(f.id)}">Quitar</button></div>`).join('') : '<span class="hint">Sin foto general todavía.</span>';
}

/* ---------- lista de registros ---------- */
function renderItems(){
  const u=curUbic(), s=slug(u);
  $('#hdrLoc').textContent = u || 'Captura de Conteo';
  let list=u?rowsOf(s).sort((a,b)=>(a.creado||0)-(b.creado||0)):[];
  const st=STATE[s]; const cerr=!!(st&&st.cerrada);
  $('#listTitle').textContent = u ? 'Registros en '+u : 'Registros de la ubicación';
  const sup=(ME&&ME.lvl||1)>=2, lk=locked(u);
  renderRevBox(u);
  $('#lockLine').hidden=!lk; $('#btnSave').disabled=lk;
  const tot=list.reduce((a,r)=>({b:a.b+(+r.b||0),r:a.r+(+r.r||0),m:a.m+(+r.m||0)}),{b:0,r:0,m:0});
  const nRev=list.filter(r=>r.revisar).length, nFot=list.reduce((a,r)=>a+(r.fotos||[]).length,0);
  $('#listMeta').textContent = u ? (list.length+' registros'+(cerr?' · cerrada':(st&&st.enRev?' · esperando revisión':''))) : '';
  $('#kpis').innerHTML = u ? `<div class="kpi"><b>${tot.b+tot.r+tot.m}</b>bienes</div><div class="kpi b"><b>${tot.b}</b>buenos</div><div class="kpi r"><b>${tot.r}</b>regulares</div><div class="kpi m"><b>${tot.m}</b>malos</div><div class="kpi"><b>${nFot}</b>fotos</div>${nRev?`<div class="kpi"><b style="color:var(--warn)">${nRev}</b>por revisar</div>`:''}` : '';
  const al=[], byBlk={};
  list.forEach(r=>{ if(!r.etq&&r.blk) (byBlk[r.blk]=byBlk[r.blk]||[]).push(r); });
  Object.entries(byBlk).forEach(([k,l])=>{ if(l.length>1){ const c=CAT.get(k); al.push(`<div class="status warn">⚠ ${k} ${esc(c?c.d:'')} está registrado ${l.length} veces sin etiqueta. Si es el mismo bien, súmelos en un solo registro.</div>`); }});
  $('#locAlerts').innerHTML=al.join('');
  $('#inFiltro').hidden = list.length<6;
  const f=norm($('#inFiltro').value);
  if(f) list=list.filter(r=>norm([r.blk,bienDesc(r),r.etq,r.serie,r.marca,r.modelo,r.obs,r.motivo].join(' ')).includes(f));
  const dels=u?MINEDEL.filter(d=>d.ubic===u && canEdit(d)):[];
  $('#locAlerts').insertAdjacentHTML('beforeend', dels.length?`<details class="more"><summary>Eliminados en esta ubicación que puede restaurar (${dels.length})</summary><div style="display:flex;flex-direction:column;gap:6px">${dels.map(d=>`<div class="delrow"><span class="mono">${esc(d.blk||'¿?')}</span><span style="flex:1;min-width:0">${esc(d.blk?((CAT.get(d.blk)||{}).d||''):d.desc)} · ${d.cant} u.<br><span class="hint">${esc(d.del)}</span></span><button type="button" class="btn sm" data-restore="${esc(d.id)}">Restaurar</button></div>`).join('')}</div></details>`:'');
  if(!u){ $('#items').innerHTML='<div class="empty">Elija una ubicación para empezar.</div>'; return; }
  if(!list.length){ $('#items').innerHTML=`<div class="empty">${f?'Nada coincide con el filtro.':'Aún no hay registros aquí. Busque el primer bien arriba.'}</div>`; return; }
  $('#items').innerHTML=list.map(r=>{
    const v=r.etq?etqVerdict(r.etq,r.blk):null, d=r.etq?dupEtq(r.etq,r.id):[], chips=[];
    if(r.etq) chips.push(`<span class="chip ${v?v.cls:'mut'} mono">${esc(r.etq)}</span>`, v?`<span class="chip ${v.cls}">${esc(v.chip)}</span>`:'');
    else chips.push('<span class="chip mut">Sin etiqueta · código lo asigna el Excel</span>');
    if(d.length) chips.push(`<span class="chip bad">Etiqueta repetida: ${esc(d.join(', '))}</span>`);
    if(r.revisar) chips.push(`<span class="chip warn">Revisar: ${esc(r.motivo||'')}</span>`);
    if(r.inst) chips.push(`<span class="chip info">Inst. ${esc(r.inst)}</span>`);
    if(r.ref) chips.push(`<span class="chip ok">✓ Referencia validada</span>`);
    const mm=[r.marca,r.modelo].filter(Boolean).join(' · ')+(r.serie?' · S/N '+r.serie:'');
    if(r._p) chips.unshift('<span class="chip warn">⏳ Por enviar</span>');
    return `<div class="item${r.id===editingId?' editing':''}${r.revisar?' rev':''}${r._p?' pend':''}">
      <div class="t"><span class="mono">${esc(r.blk||'¿?')}</span><span class="d">${esc(bienDesc(r))}</span>${mm?`<div class="hint">${esc(mm)}</div>`:''}${r.obs?`<div class="hint">“${esc(r.obs)}”</div>`:''}</div>
      <div class="q"><span class="qb">${r.b||0}</span><span class="qr">${r.r||0}</span><span class="qm">${r.m||0}</span><span class="qt">${qty(r)}</span></div>
      ${(r.fotos||[]).length?`<div class="thumbs" style="grid-column:1/-1" data-refid="${esc(r.id)}" title="Ver en Referencias">${r.fotos.map(f=>imgTag(f.id,'',200,f.n)).join('')}</div>`:''}
      <div class="sub">${chips.join('')}<span>· ${esc((r.cont||'').split(' ')[0])}${r.editadoPor?' (editó '+esc(r.editadoPor.split(' ')[0])+')':''} · ${esc(r.fecha||'')}</span></div>
      <div class="acts" data-id="${esc(r.id)}"><button class="btn sm" data-a="copy" type="button">Duplicar</button>${canEdit(r)?'<button class="btn sm" data-a="edit" type="button">Editar</button><button class="btn sm danger" data-a="del" type="button">Eliminar</button>':`<span class="hint">${lk?'🔒 Ubicación cerrada: solo un supervisor puede reabrirla':'🔒 Solo quien lo registró (el mismo día) o un supervisor puede cambiarlo'}</span>`}</div>
    </div>`;
  }).join('');
}
async function onItemAct(e){
  const b=e.target.closest('button[data-a]'); if(!b) return;
  const id=b.parentElement.dataset.id, u=curUbic(), s=slug(u), r=(STATE[s]&&STATE[s].items[id]); if(!r) return;
  if((b.dataset.a==='edit'||b.dataset.a==='del') && !canEdit(r)){ toast('No puede cambiar este registro'); return; }
  if(b.dataset.a==='edit') return loadRow(r,false);
  if(b.dataset.a==='copy') return loadRow(r,true);
  if(b.dataset.a==='del'){
    if(b.dataset.armed!=='1'){ b.dataset.armed='1'; b.textContent='¿Seguro? Toque otra vez'; setTimeout(()=>{ if(b.isConnected){ b.dataset.armed=''; b.textContent='Eliminar'; } },3500); return; }
    const row=ROWS.get(id); if(row){ row.del='Eliminado · '+ME.nombre; row._p=1; }
    enqueue('api_deleteRow',[id], id, 'Eliminar '+(r.blk||'')+' '+bienDesc(r));
    if(editingId===id) resetForm();
    saveCache(); refreshUI();
    toast('Registro eliminado','Deshacer',()=>restoreLocal(id));
  }
}

/* ---------- ficha ---------- */
function seenSet(){
  const S=new Set();
  allRows().forEach(r=>{
    if(r.etq){ const L=lookupEtq(r.etq); if(L&&L.rec){ const t=qty(r);
      if(t>1 && L.by==='código'){ const [i,bk,c]=L.rec.code.split('-'); const w=c.length; for(let k=0;k< t;k++) S.add(norm(`${i}-${bk}-${String(+c+k).padStart(w,'0')}`)); }
      else S.add(norm(L.rec.code)); } }
    if(r.serie){ const x=SER.get(norm(r.serie)); if(x&&x!=='DUP') S.add(norm(x.code)); }
  });
  return S;
}
function renderFicha(){
  const u=curUbic(); $('#fichaTitle').textContent = u ? 'Ficha de '+u : 'Ficha — elija una ubicación';
  const ant={}, cnt={}, antL=INVBYUB.get(norm(u))||[];
  antL.forEach(r=>ant[r.blk]=(ant[r.blk]||0)+1);
  rowsOf(slug(u)).forEach(r=>{ const k=r.blk||'¿?'; cnt[k]=(cnt[k]||0)+qty(r); });
  const ks=[...new Set([...Object.keys(ant),...Object.keys(cnt)])].sort();
  const tC=Object.values(cnt).reduce((a,b)=>a+b,0);
  $('#fichaKpis').innerHTML = u ? `<div class="kpi"><b>${antL.length}</b>en inventario anterior</div><div class="kpi"><b>${tC}</b>contados</div><div class="kpi"><b>${ks.filter(k=>(cnt[k]||0)!==(ant[k]||0)).length}</b>bloques con diferencia</div>` : '';
  $('#fichaBody').innerHTML = !u ? '<tr><td colspan="5">Elija una ubicación en Capturar.</td></tr>' : (ks.length ? ks.map(k=>{ const a=ant[k]||0, c=cnt[k]||0, d=c-a, x=CAT.get(k);
    return `<tr class="${d>0?'diff-pos':d<0?'diff-neg':''}"><td class="mono">${k}</td><td>${esc(x?x.d:k==='¿?'?'Fuera de catálogo':'')}</td><td class="n">${a}</td><td class="n">${c}</td><td class="n dv">${d>0?'+':''}${d||'—'}</td></tr>`; }).join('') : '<tr><td colspan="5">Sin datos todavía.</td></tr>');
  const S=seenSet(), f=norm($('#antFiltro').value);
  let L=antL.slice().sort((a,b)=>a.code.localeCompare(b.code));
  $('#antMeta').textContent = u ? `${L.filter(r=>S.has(norm(r.code))).length} de ${L.length} vistos` : '';
  if(f) L=L.filter(r=>norm([r.code,r.desc,r.marca,r.modelo,r.serie].join(' ')).includes(f));
  $('#antBody').innerHTML = !u ? '' : (L.length ? L.slice(0,400).map(r=>`<tr><td class="mono">${esc(r.code)}</td><td>${esc(r.desc)}</td><td>${esc([r.marca,r.modelo].filter(Boolean).join(' '))}${r.serie?`<br><span class="mono hint">${esc(r.serie)}</span>`:''}</td><td>${esc((r.fecha||'').slice(0,10))}</td><td>${S.has(norm(r.code))?'<span class="chip ok">Sí</span>':'<span class="chip mut">No</span>'}</td></tr>`).join('') : '<tr><td colspan="5">Sin códigos anteriores en esta ubicación.</td></tr>');
}

/* ---------- avance ---------- */
function renderAvance(){
  const solo=$('#chkSoloAct').checked, U=allUbic(), L=U.filter(u=>!solo||u.a||u.nueva||u.huerfana), act=U.filter(u=>u.a||u.nueva);
  const st=s=>STATE[s]||{};
  const closed=act.filter(u=>st(slug(u.n)).cerrada).length, withData=act.filter(u=>rowsOf(slug(u.n)).length).length;
  const R=allRows(), nB=R.reduce((a,r)=>a+qty(r),0), nRev=R.filter(r=>r.revisar).length, nNew=U.filter(u=>u.nueva).length;
  const enRev=act.filter(u=>st(slug(u.n)).enRev).length;
  $('#avMeta').textContent=`${closed} de ${act.length} ubicaciones cerradas`;
  $('#avBar').style.width=(act.length?Math.round(100*closed/act.length):0)+'%';
  $('#avKpis').innerHTML=`<div class="kpi"><b>${closed}</b>cerradas</div><div class="kpi"><b style="color:var(--info)">${enRev}</b>esperando revisión</div><div class="kpi"><b>${Math.max(0,withData-closed-enRev)}</b>en proceso</div><div class="kpi"><b>${R.length}</b>registros</div><div class="kpi"><b>${nB}</b>bienes</div><div class="kpi"><b>${nRev}</b>por revisar</div>${nNew?`<div class="kpi"><b>${nNew}</b>ubicaciones nuevas</div>`:''}`;
  const P={}; R.forEach(r=>{ const k=r.cont||'(sin nombre)'; P[k]=P[k]||{n:0,b:0,f:0,v:0}; P[k].n++; P[k].b+=qty(r); P[k].f+=(r.fotos||[]).length; P[k].v+=r.revisar?1:0; });
  $('#avPers').innerHTML=Object.entries(P).sort((a,b)=>b[1].b-a[1].b).map(([k,p])=>`<tr><td>${esc(k)}</td><td class="n">${p.n}</td><td class="n">${p.b}</td><td class="n">${p.f}</td><td class="n">${p.v}</td></tr>`).join('')||'<tr><td colspan="5">Sin registros todavía.</td></tr>';
  $('#locList').innerHTML=L.map(u=>{ const s=slug(u.n), l=rowsOf(s), q=l.reduce((a,r)=>a+qty(r),0);
    const chip= st(s).cerrada?'<span class="chip ok">✓ Cerrada</span>': st(s).enRev?'<span class="chip info">🔔 Esperando revisión</span>': l.length?'<span class="chip warn">En proceso</span>':'<span class="chip mut">Pendiente</span>';
    return `<div class="locrow"><div class="nm">${esc(u.n)}${u.nueva?' <span class="chip warn">Nueva</span>':''}<small>${esc([u.t,u.z].filter(Boolean).join(' · '))} · ${l.length} reg. · ${q} bienes</small></div>${chip}<button class="btn sm" type="button" data-go="${esc(u.n)}">Abrir</button></div>`; }).join('');
}
async function doExport(){
  const msg=$('#expMsg'); msg.textContent='Generando…'; $('#btnExport').disabled=true;
  try{
    const r=await run('api_export');
    msg.textContent=`Hoja PEGAR_EN_CONTEO lista con ${r.n} registros.`+(r.nuevas.length?` Ubicaciones nuevas: ${r.nuevas.join(', ')}.`:'');
    $('#expLinks').innerHTML=`<a href="${esc(r.xlsx)}" target="_blank" rel="noopener">⬇ Descargar la hoja completa en Excel (.xlsx)</a><a href="https://docs.google.com/spreadsheets/d/${esc(REF.ssId)}/edit" target="_blank" rel="noopener">Abrir la hoja de Google</a><a href="${esc(REF.fotosUrl)}" target="_blank" rel="noopener">Abrir la carpeta de fotos</a>`;
  }catch(e){ msg.textContent='No se pudo generar: '+errMsg(e); }
  finally{ $('#btnExport').disabled=false; }
}

/* ---------- referencias: lo ya registrado como guía para todos ---------- */
const REFF={f:'all', blk:'', lim:40}; let refSig='';
const TIPOF={'':'Bien',ETIQUETA:'Etiqueta',SERIE:'Placa / serie',DANO:'Daño'};
function refsFor(c){ if(!c) return []; return allRows().filter(r=>r.id!==editingId && (r.fotos||[]).length && (c.free ? (!r.blk && norm(r.desc)===norm(c.d)) : r.blk===c.c)); }
const mainFoto = r => (r.fotos||[]).find(f=>!f.t) || (r.fotos||[])[0];
function refList(){
  const q=norm($('#refQ').value), solo=$('#refSoloFoto').checked;
  let L=allRows();
  if(solo) L=L.filter(r=>(r.fotos||[]).length);
  if(REFF.blk) L=L.filter(r=>REFF.blk==='¿?' ? !r.blk : r.blk===REFF.blk);
  const f=REFF.f;
  if(f==='val') L=L.filter(r=>r.ref);
  if(f==='rev') L=L.filter(r=>r.revisar);
  if(f==='sincat') L=L.filter(r=>!r.blk);
  if(f==='dano') L=L.filter(r=>(+r.m||0)>0 || (r.fotos||[]).some(x=>x.t==='DANO'));
  if(f==='reet') L=L.filter(r=>{ const v=r.etq?etqVerdict(r.etq,r.blk):null; return v&&v.one; });
  if(q){ const ws=q.split(' '); L=L.filter(r=>{ const c=CAT.get(r.blk)||{}; const k=norm([r.blk,c.d,c.r,r.desc,r.etq,r.marca,r.modelo,r.serie,r.obs,r.motivo,r.ubic,r.cont,r.ref&&r.ref.nota].join(' ')); return ws.every(w=>k.includes(w)); }); }
  return L.sort((a,b)=>(!!b.ref-!!a.ref) || ((b.ref&&b.ref.t||0)-(a.ref&&a.ref.t||0)) || ((b.creado||0)-(a.creado||0)));
}
function renderRefs(force){
  const L=refList();
  const sig=[L.length, L.slice(0,REFF.lim).map(r=>r.id+(r.ts||0)+(r.ref?1:0)+(r._p?1:0)+(r.fotos||[]).map(f=>f.id).join()).join('|'), REFF.lim].join('#');
  const all=allRows(), nF=all.filter(r=>(r.fotos||[]).length).length, nV=all.filter(r=>r.ref).length;
  $('#refMeta').textContent=`${nF} ${nF===1?'bien':'bienes'} con foto · ${nV} ${nV===1?'validado':'validados'}`;
  $$('#refFil .rf').forEach(b=>b.setAttribute('aria-pressed', b.dataset.rf===REFF.f));
  const bn=$('#refBlkNote');
  if(REFF.blk){ const c=CAT.get(REFF.blk); bn.hidden=false; bn.innerHTML=`<span>Mostrando solo <b>${esc(REFF.blk==='¿?'?'fuera de catálogo':REFF.blk+' '+(c?c.d:''))}</b> · ${L.length} resultado${L.length===1?'':'s'} <button type="button" class="btn sm ghost" id="refBlkX">Quitar filtro</button></span>`; $('#refBlkX').onclick=()=>{ REFF.blk=''; renderRefs(true); }; }
  else bn.hidden=true;
  if(!force && sig===refSig) return; refSig=sig;
  const V=L.slice(0,REFF.lim);
  $('#refGrid').innerHTML = V.length ? V.map(r=>{
    const c=CAT.get(r.blk)||{}, mf=mainFoto(r), n=(r.fotos||[]).length, v=r.etq?etqVerdict(r.etq,r.blk):null, ch=[];
    if(!r.blk) ch.push('<span class="chip warn">Fuera de catálogo</span>');
    if(v) ch.push(`<span class="chip ${v.cls}">${esc(v.chip)}</span>`);
    if(+r.m>0) ch.push(`<span class="chip bad">${r.m} malo${+r.m===1?'':'s'}</span>`);
    if(r.revisar) ch.push('<span class="chip warn">Por revisar</span>');
    if(r._p) ch.push('<span class="chip warn">⏳</span>');
    return `<button type="button" class="rcard${r.ref?' val':''}" data-refid="${esc(r.id)}">
      <div class="rimg">${mf?imgTag(mf.id,'',600,mf.n):'<span class="noimg">Sin foto</span>'}${r.ref?'<span class="vb">✓ Validada</span>':''}${n>1?`<span class="nf">${n} fotos</span>`:''}</div>
      <div class="rb"><div class="t"><span class="mono">${esc(r.blk||'¿?')}</span>${esc(bienDesc(r))}</div>
      ${ch.length?`<div class="chips">${ch.join('')}</div>`:''}
      <small>${esc(r.ubic)} · ${esc((r.cont||'').split(' ').slice(0,2).join(' '))} · ${esc(r.fecha||'')}${[r.marca,r.modelo].filter(Boolean).length?'<br>'+esc([r.marca,r.modelo].filter(Boolean).join(' · ')):''}</small></div></button>`;
  }).join('') : `<div class="empty" style="grid-column:1/-1">${all.length?'Nada coincide con la búsqueda o el filtro.':'Todavía no hay registros. A medida que el equipo registre bienes con foto, aparecerán aquí.'}</div>`;
  $('#refMore').hidden = L.length<=REFF.lim; $('#refMore').textContent=`Ver más (${L.length-REFF.lim} restantes)`;
}
function goRefs(blk, q){ REFF.blk=blk||''; REFF.f='all'; REFF.lim=40; $('#refQ').value=q||''; closeModal(); showTab('refs'); renderRefs(true); window.scrollTo({top:0}); }
let RV={id:null,i:0};
function openRef(id, i){
  const r=allRows().find(x=>x.id===id); if(!r){ toast('Ese registro ya no está disponible'); return; }
  RV={id, i:i||0};
  const F=r.fotos||[], f=F[RV.i], c=CAT.get(r.blk), v=r.etq?etqVerdict(r.etq,r.blk):null;
  const linkify=t=>esc(t).replace(/\b(\d{4})\b/g,(m,k)=>CAT.has(k)?`<button type="button" class="lnk" data-ficha="${k}">${k}</button>`:m);
  const crit = c ? [['Definición',c.def],['Rasgo que decide',c.ras],['No confundir con',c.noc],['Registrar',c.reg],['Medidas típicas',c.med]].filter(x=>x[1]) : [];
  const same = r.blk ? allRows().filter(x=>x.blk===r.blk && (x.fotos||[]).length).length : allRows().filter(x=>!x.blk && norm(x.desc)===norm(r.desc) && (x.fotos||[]).length).length;
  const datos=[['Ubicación',esc(r.ubic)],['Fecha',esc(r.fecha||'')],['Contado por',esc(r.cont||'')],r.editadoPor?['Editado por',esc(r.editadoPor)]:null,
    ['Etiqueta', r.etq?`<span class="mono">${esc(r.etq)}</span>${v?` <span class="chip ${v.cls}">${esc(v.chip)}</span>`:''}`:'Sin etiqueta (código lo asigna el Excel)'],
    ['Cantidades',`<span style="color:var(--b)">${r.b||0} buenos</span> · <span style="color:var(--r)">${r.r||0} regulares</span> · <span style="color:var(--m)">${r.m||0} malos</span>`],
    (r.marca||r.modelo||r.serie)?['Marca / modelo / serie',esc([r.marca,r.modelo].filter(Boolean).join(' · ')+(r.serie?' · S/N '+r.serie:''))]:null,
    r.inst?['Institución',esc(r.inst)]:null, r.obs?['Observaciones',esc(r.obs)]:null, r.revisar?['Revisión',`<span class="chip warn">${esc(r.motivo||'Por revisar')}</span>`]:null].filter(Boolean);
  const sup=ME&&(ME.lvl||1)>=2;
  const valHtml = r.ref
    ? `<div class="status ok"><b>✓ Referencia validada</b><span>Por ${esc(r.ref.por)} · ${fdt(r.ref.t)}</span>${r.ref.nota?`<span><b>Criterio:</b> ${esc(r.ref.nota)}</span>`:''}</div>${sup?'<div class="row"><button type="button" class="btn sm ghost" id="refUnval">Quitar validación</button></div>':''}`
    : (sup ? `<label class="f"><span>Criterio usado (opcional, lo verán todos)</span><textarea id="refNota" placeholder="Ej.: es 1154 y no 1153 porque la paleta es fija; medir el asiento"></textarea></label><div class="row"><button type="button" class="btn primary" id="refVal" style="flex:1">✓ Validar como referencia</button></div>`
           : '<span class="hint">Aún no está validada por un supervisor: úsela como guía con cuidado.</span>');
  $('#modalBody').innerHTML=`<div class="sec-h"><h2><span class="mono" style="color:var(--warn)">${esc(r.blk||'¿?')}</span> ${esc(bienDesc(r))}</h2><span class="spacer"></span><button type="button" class="btn ghost sm" data-close>Cerrar</button></div>
    ${F.length?`<div class="rview">${imgTag(f.id,'',1600,f.n)}${F.length>1?'<button type="button" class="nav p" data-rv="-1" aria-label="Foto anterior">‹</button><button type="button" class="nav n" data-rv="1" aria-label="Foto siguiente">›</button>':''}</div>
    <div class="rcap"><span><b>${esc(TIPOF[f.t||'']||f.t)}</b> · foto ${RV.i+1} de ${F.length} · tomada por <b>${esc(f.p||r.cont||'')}</b>${f.d?' · '+fdt(f.d):(r.fecha?' · '+esc(r.fecha):'')}${String(f.id).startsWith('local:')?' · ⏳ sin subir':''}</span><span class="mono">${esc(f.n)}</span></div>
    ${F.length>1?`<div class="rstrip">${F.map((x,k)=>`<button type="button" data-rvi="${k}" aria-current="${k===RV.i}">${imgTag(x.id,'',200,x.n)}</button>`).join('')}</div>`:''}`:'<div class="empty">Este registro no tiene fotos.</div>'}
    <div class="rsec"><h3>Validación</h3>${valHtml}</div>
    <div class="rsec"><h3>Criterio del catálogo</h3>${c?`<div class="rcrit">${c.img?imgTag(c.img,'',600,c.d).replace('<img','<img data-ficha="'+c.c+'" title="Abrir ficha"'):''}<div style="min-width:0"><b><span class="mono" style="color:var(--warn)">${esc(c.c)}</span> ${esc(c.d)}</b><br><span class="hint">${esc(c.r||'')}</span>${crit.length?`<dl class="fdl" style="margin-top:8px">${crit.map(([k,x])=>`<dt>${k}</dt><dd>${linkify(x)}</dd>`).join('')}</dl>`:''}</div></div>`
      : '<div class="status warn">Fuera del catálogo: se registró con descripción libre y queda para que el encargado le asigne bloque.</div>'}</div>
    <div class="rsec"><h3>Datos del registro</h3><dl class="fdl">${datos.map(([k,x])=>`<dt>${k}</dt><dd>${x}</dd>`).join('')}</dl></div>
    <div class="row"><button type="button" class="btn primary" id="refUse" style="flex:1 1 200px">Registrar uno igual</button>${same>1?`<button type="button" class="btn" id="refSame" style="flex:1 1 200px">Ver las ${same} referencias de este bien</button>`:''}<button type="button" class="btn ghost" id="refLoc" style="flex:1 1 200px">Ir a ${esc(r.ubic)}</button></div>`;
  $('#modal').hidden=false; $('#modalBody').scrollTop=0;
  const mb=$('#modalBody');
  mb.querySelectorAll('[data-rv]').forEach(b=>b.onclick=()=>{ const k=(RV.i+(+b.dataset.rv)+F.length)%F.length; openRef(id,k); });
  mb.querySelectorAll('[data-rvi]').forEach(b=>b.onclick=()=>openRef(id,+b.dataset.rvi));
  const bv=$('#refVal'); if(bv) bv.onclick=()=>{ setRef(id,true,$('#refNota').value.trim()); openRef(id,RV.i); toast('Referencia validada: todos la verán con ✓'); };
  const bu=$('#refUnval'); if(bu) bu.onclick=()=>{ if(bu.dataset.armed!=='1'){ bu.dataset.armed='1'; bu.textContent='¿Quitar la validación? Toque otra vez'; setTimeout(()=>{ if(bu.isConnected){ bu.dataset.armed=''; bu.textContent='Quitar validación'; } },3500); return; } setRef(id,false,''); openRef(id,RV.i); toast('Validación quitada'); };
  $('#refUse').onclick=()=>{ closeModal(); showTab('cap'); if(editingId) resetForm(); choose(r.blk?(CAT.get(r.blk)||{c:r.blk,d:r.desc}):{free:true,d:r.desc}); $('#frm').scrollIntoView({behavior:'smooth'}); setTimeout(()=>$('#inEtq').focus(),300); toast('Bien elegido igual que la referencia'); };
  const bs=$('#refSame'); if(bs) bs.onclick=()=>r.blk?goRefs(r.blk,''):goRefs('¿?',r.desc);
  $('#refLoc').onclick=()=>{ closeModal(); $('#selUbic').value=r.ubic; LS.set('ubic',r.ubic); showTab('cap'); window.scrollTo({top:0}); };
}
function setRef(id,on,nota){
  const row=ROWS.get(id); if(row){ row.ref = on?{por:ME.nombre,t:Date.now(),nota}:null; row._p=1; }
  enqueue('api_setRef',[id,on,nota], id, (on?'Validar referencia ':'Quitar validación ')+(row?(row.blk||'')+' '+bienDesc(row):''));
  saveCache(); refreshUI(); renderRefs(true);
}
function wireRefs(){
  let qT; $('#refQ').oninput=()=>{ clearTimeout(qT); qT=setTimeout(()=>{ REFF.lim=40; renderRefs(true); },150); };
  $('#refSoloFoto').onchange=()=>renderRefs(true);
  $('#refFil').onclick=e=>{ const b=e.target.closest('[data-rf]'); if(!b) return; REFF.f=b.dataset.rf; REFF.lim=40; renderRefs(true); };
  $('#refMore').onclick=()=>{ REFF.lim+=40; renderRefs(true); };
  document.addEventListener('click',e=>{
    const g=e.target.closest('[data-refgo]'); if(g&&chosen){ e.preventDefault(); chosen.free?goRefs('¿?',chosen.d):goRefs(chosen.c,''); return; }
    const c=e.target.closest('[data-refid]'); if(c && !e.target.closest('#modal')){ e.preventDefault(); openRef(c.dataset.refid,0); }
  });
}

/* ---------- revisión de ubicaciones: el contador la pide, el supervisor la atiende y la cierra ---------- */
const ago = t => { if(!t) return ''; const m=Math.round((Date.now()-t)/60000); return m<1?'hace un momento':m<60?`hace ${m} min`:m<1440?`hace ${Math.floor(m/60)} h ${m%60} min`:fdt(t); };
const first2 = n => String(n||'').split(' ').slice(0,2).join(' ');
function locRev(u, accion, nota){
  let l=LOCS.find(x=>x.n===u); if(!l){ l={n:u,t:'',z:'',a:true,nueva:true,fotos:[],i:LOCS.length}; LOCS.push(l); }
  const now=Date.now(), me={por:ME.nombre,t:now};
  if(accion==='solicitar'){ l.enRev=true; l.rev={sol:{...me,uid:ME.id,nota}}; }
  if(accion==='cancelar'){ l.enRev=false; l.rev={...(l.rev||{}),res:{tipo:'cancelada',...me,nota}}; }
  if(accion==='atender'){ l.rev={...(l.rev||{}),ate:me}; }
  if(accion==='devolver'){ l.enRev=false; l.cerrada=false; l.rev={...(l.rev||{}),res:{tipo:'devuelta',...me,nota}}; }
  if(accion==='cerrar'){ const r0=l.rev&&l.rev.sol&&!l.rev.res?l.rev:{sol:null}; l.enRev=false; l.cerrada=true; l.rev={...r0,res:{tipo:'cerrada',...me,nota}}; }
  if(accion==='reabrir'){ l.cerrada=false; l.rev={...(l.rev||{}),res:{tipo:'reabierta',...me,nota}}; }
  const lbl={solicitar:'Solicitar revisión',cancelar:'Cancelar solicitud',atender:'Voy para allá',devolver:'Devolver',cerrar:'Cerrar',reabrir:'Reabrir'}[accion]||accion;
  enqueue('api_revision',[u,accion,nota||''],'',lbl+' · '+u);
  markSeen(revKeys(l)); saveCache(); refreshUI();
}
function renderRevBox(u){
  const box=$('#revBox'); if(!u||!ME){ box.hidden=true; return; }
  const st=STATE[slug(u)]||{}, rv=st.rev||{}, sup=(ME.lvl||1)>=2, mine=!!(rv.sol&&rv.sol.uid===ME.id);
  const mode=box.dataset.mode||'', h=[];
  if(st.cerrada){
    const r=rv.res||{};
    h.push(`<div class="status ok"><b>✓ Ubicación cerrada</b><span>${r.por?'Revisada y cerrada por '+esc(r.por)+' · '+esc(ago(r.t)):'Cerrada'}${rv.sol?' · revisión pedida por '+esc(first2(rv.sol.por)):''}</span>${r.nota?`<span>“${esc(r.nota)}”</span>`:''}</div>`);
    if(sup) h.push(`<div class="row"><button type="button" class="btn sm" data-rva="reabrir">Reabrir ubicación</button></div>`);
  } else if(st.enRev){
    const s0=rv.sol||{};
    h.push(`<div class="status info"><b>🔔 Esperando revisión</b><span>Pedida por ${esc(s0.por||'')} · ${esc(ago(s0.t))}</span>${s0.nota?`<span>“${esc(s0.nota)}”</span>`:''}<span>${rv.ate?`🚶 <b>${esc(rv.ate.por)}</b> va en camino (${esc(ago(rv.ate.t))})`:'Todavía nadie la atiende.'}</span></div>`);
    if(sup) h.push(`<div class="row">${rv.ate&&rv.ate.por===ME.nombre?'':'<button type="button" class="btn sm" data-rva="atender">🚶 Voy para allá</button>'}<button type="button" class="btn sm primary" data-rva="cerrar">✓ Cerrar (revisada)</button><button type="button" class="btn sm" data-rva="devolver-open">↩ Devolver con observaciones</button></div>`);
    else if(mine) h.push(`<div class="row"><button type="button" class="btn sm ghost" data-rva="cancelar">Cancelar solicitud</button></div><span class="hint">Mientras espera puede seguir corrigiendo. Cuando el supervisor la cierre, ya no se podrá cambiar.</span>`);
  } else {
    const r=rv.res;
    if(r && r.tipo==='devuelta') h.push(`<div class="status warn"><b>↩ Devuelta por ${esc(r.por)}</b><span>${esc(ago(r.t))}</span><span>Corregir: “${esc(r.nota)}”</span></div>`);
    if(r && r.tipo==='reabierta') h.push(`<div class="status info"><span>Reabierta por ${esc(r.por)} · ${esc(ago(r.t))}${r.nota?' · “'+esc(r.nota)+'”':''}</span></div>`);
    if(sup) h.push(`<div class="row"><button type="button" class="btn sm primary" data-rva="cerrar">✓ Cerrar ubicación (revisada)</button></div>`);
    else h.push(`<div class="row"><button type="button" class="btn sm primary" data-rva="solicitar-open">🔔 Solicitar revisión</button></div><span class="hint">Cuando termine de contar aquí, pida la revisión: le llega al supervisor y él la cierra.</span>`);
  }
  if(mode){
    const t={solicitar:['Nota para el supervisor (opcional)','Ej.: falta abrir el armario con llave; 3 bienes fuera de catálogo','Enviar solicitud'],devolver:['Qué hay que corregir (obligatorio)','Ej.: faltan las sillas del fondo; revisar etiqueta del proyector','Devolver al contador']}[mode];
    if(t) h.push(`<div class="panel"><label class="f"><span>${t[0]}</span><textarea id="revNota" placeholder="${esc(t[1])}"></textarea></label><div class="row"><button type="button" class="btn sm primary" data-rva="send">${t[2]}</button><button type="button" class="btn sm ghost" data-rva="close">Cancelar</button></div></div>`);
  }
  const html=h.join(''); if(box.__h!==html+mode){ const keep=$('#revNota')?$('#revNota').value:''; box.innerHTML=html; box.__h=html+mode; if($('#revNota')){ $('#revNota').value=keep; } }
  box.hidden=false;
}
function wireRev(){
  $('#revBox').addEventListener('click',e=>{
    const b=e.target.closest('[data-rva]'); if(!b) return; const u=curUbic(); if(!u) return; const a=b.dataset.rva, box=$('#revBox');
    if(a==='solicitar-open'){ box.dataset.mode='solicitar'; renderRevBox(u); setTimeout(()=>$('#revNota')&&$('#revNota').focus(),50); return; }
    if(a==='devolver-open'){ box.dataset.mode='devolver'; renderRevBox(u); setTimeout(()=>$('#revNota')&&$('#revNota').focus(),50); return; }
    if(a==='close'){ box.dataset.mode=''; renderRevBox(u); return; }
    if(a==='send'){ const n=($('#revNota').value||'').trim(), m=box.dataset.mode;
      if(m==='devolver' && n.length<3){ toast('Escriba qué hay que corregir'); return; }
      box.dataset.mode=''; locRev(u, m, n); toast(m==='solicitar'?'Revisión solicitada: se avisó a los supervisores':'Ubicación devuelta al contador'); return; }
    if((a==='cerrar'||a==='reabrir'||a==='cancelar') && b.dataset.armed!=='1'){ const t=b.textContent; b.dataset.armed='1'; b.textContent=a==='cerrar'?'¿Cerrar? Los contadores ya no podrán cambiarla. Toque otra vez':a==='reabrir'?'¿Reabrir? Toque otra vez':'¿Cancelar la solicitud? Toque otra vez'; setTimeout(()=>{ if(b.isConnected&&b.dataset.armed==='1'){ b.dataset.armed=''; b.textContent=t; } },4000); return; }
    locRev(u, a, ''); toast({cerrar:'Ubicación cerrada',reabrir:'Ubicación reabierta',cancelar:'Solicitud cancelada',atender:'Se avisó que va en camino'}[a]||'Listo');
  });
  $('#btnBell').onclick=openBell;
  $('#revAlert').addEventListener('click',e=>{
    const b=e.target.closest('[data-ra]'); if(!b) return; const k=b.dataset.k, u=b.dataset.u, a=b.dataset.ra;
    markSeen([k]);
    if(a==='go'){ locRev(u,'atender',''); goLoc(u); toast('Se avisó que va en camino'); }
    if(a==='ver') goLoc(u);
    revNotices();
  });
  const unlock=()=>{ try{ const C=window.__ac||(window.__ac=new (window.AudioContext||window.webkitAudioContext)()); if(C.state==='suspended') C.resume(); }catch(e){} };
  document.addEventListener('pointerdown',unlock,{once:true});
}
function goLoc(u){ closeModal(); $('#selUbic').value=u; LS.set('ubic',u); showTab('cap'); setTimeout(()=>{ const b=$('#revBox'); if(b&&!b.hidden) b.scrollIntoView({behavior:'smooth',block:'center'}); },150); }
const pendingRevs = () => LOCS.filter(l=>l.enRev && !l.cerrada && l.rev && l.rev.sol).sort((a,b)=>a.rev.sol.t-b.rev.sol.t);
function openBell(){
  const P=pendingRevs();
  $('#modalBody').innerHTML=`<div class="sec-h"><h2>🔔 Solicitudes de revisión</h2><span class="spacer"></span><button type="button" class="btn ghost sm" data-close>Cerrar</button></div>
    ${P.length?P.map(l=>{ const r=l.rev; return `<div class="rqi"><div class="row"><b style="font-size:16px">${esc(l.n)}</b><span class="hint">${esc(ago(r.sol.t))}</span></div>
      <span>Pedida por <b>${esc(r.sol.por)}</b>${r.sol.nota?' · “'+esc(r.sol.nota)+'”':''}</span>
      <span class="hint">${r.ate?'🚶 '+esc(r.ate.por)+' va en camino ('+esc(ago(r.ate.t))+')':'Nadie la atiende todavía'}</span>
      <div class="row">${r.ate&&r.ate.por===ME.nombre?'':`<button type="button" class="btn sm primary" data-bl="go" data-u="${esc(l.n)}">🚶 Voy para allá</button>`}<button type="button" class="btn sm" data-bl="ver" data-u="${esc(l.n)}">Abrir ${esc(l.n)}</button></div></div>`; }).join('')
      :'<div class="empty">No hay ubicaciones esperando revisión.</div>'}`;
  $('#modal').hidden=false;
  $('#modalBody').querySelectorAll('[data-bl]').forEach(b=>b.onclick=()=>{ const u=b.dataset.u; const l=LOCS.find(x=>x.n===u); markSeen(l?revKeys(l):[]); if(b.dataset.bl==='go'){ locRev(u,'atender',''); toast('Se avisó que va en camino'); } goLoc(u); });
}
/* avisos: el supervisor ve solicitudes nuevas; el contador ve cuando lo atienden, lo devuelven o lo cierran */
const seenKey = () => 'revSeen:'+(ME?ME.id:'');
function seenSet2(){ return new Set(LS.get(seenKey(),[])); }
function markSeen(keys){ if(!keys||!keys.length) return; const S=seenSet2(); keys.forEach(k=>S.add(k)); LS.set(seenKey(),[...S].slice(-300)); }
function revKeys(l){ const r=l.rev||{}, k=[]; if(r.sol) k.push(l.n+'|s|'+r.sol.t); if(r.ate) k.push(l.n+'|a|'+r.ate.t); if(r.res) k.push(l.n+'|r|'+r.res.t); return k; }
const RANG=new Set(); let revInit=false;
function revNotices(){
  if(!ME||!LOCS.length) return;
  const sup=(ME.lvl||1)>=2, S=seenSet2(), items=[];
  if(!LS.get(seenKey(),null) && !revInit){ // primera vez en este dispositivo: no avisar lo viejo del contador
    const old=[]; LOCS.forEach(l=>revKeys(l).forEach(k=>{ if(!(sup && l.enRev && k.includes('|s|'))) old.push(k); })); LS.set(seenKey(),old);
  }
  revInit=true;
  const P=pendingRevs();
  if(sup){
    const bd=$('#bellBadge'); bd.hidden=!P.length; bd.textContent=P.length;
    P.forEach(l=>{ const r=l.rev, k=l.n+'|s|'+r.sol.t; if(!S.has(k) && r.sol.uid!==ME.id) items.push({k,u:l.n,cls:'',h:`🔔 ${esc(l.n)} solicita revisión`,b:`${esc(r.sol.por)} · ${esc(ago(r.sol.t))}${r.sol.nota?' · “'+esc(r.sol.nota)+'”':''}${r.ate?'<br>🚶 '+esc(r.ate.por)+' ya va en camino':''}`,go:!r.ate}); });
  }
  LOCS.forEach(l=>{ const r=l.rev; if(!r||!r.sol||r.sol.uid!==ME.id) return;
    if(r.ate && l.enRev){ const k=l.n+'|a|'+r.ate.t; if(!S.has(k) && r.ate.por!==ME.nombre) items.push({k,u:l.n,cls:'ok',h:`🚶 ${esc(r.ate.por)} va en camino a ${esc(l.n)}`,b:esc(ago(r.ate.t))}); }
    if(r.res && (r.res.tipo==='devuelta'||r.res.tipo==='cerrada') && r.res.por!==ME.nombre){ const k=l.n+'|r|'+r.res.t; if(!S.has(k)) items.push({k,u:l.n,cls:r.res.tipo==='devuelta'?'warn':'ok',h:r.res.tipo==='devuelta'?`↩ ${esc(l.n)} fue devuelta por ${esc(r.res.por)}`:`✓ ${esc(l.n)} fue revisada y cerrada por ${esc(r.res.por)}`,b:(r.res.nota?'“'+esc(r.res.nota)+'” · ':'')+esc(ago(r.res.t))}); }
  });
  const box=$('#revAlert');
  if(!items.length){ box.hidden=true; box.innerHTML=''; return; }
  box.innerHTML=items.map(x=>`<div class="ra ${x.cls}"><b class="h">${x.h}</b><span>${x.b}</span><div class="row">${x.go?`<button type="button" class="btn sm primary" data-ra="go" data-k="${esc(x.k)}" data-u="${esc(x.u)}">🚶 Voy para allá</button>`:''}<button type="button" class="btn sm" data-ra="ver" data-k="${esc(x.k)}" data-u="${esc(x.u)}">Ver ${esc(x.u)}</button><button type="button" class="btn sm ghost" data-ra="ok" data-k="${esc(x.k)}" data-u="${esc(x.u)}">Entendido</button></div></div>`).join('');
  box.hidden=false;
  const fresh=items.filter(x=>!RANG.has(x.k)); fresh.forEach(x=>RANG.add(x.k));
  if(fresh.length) ping();
}
function ping(){
  try{ navigator.vibrate && navigator.vibrate([250,120,250,120,250]); }catch(e){}
  try{ const C=window.__ac||(window.__ac=new (window.AudioContext||window.webkitAudioContext)()); if(C.state==='suspended') C.resume();
    [0,.28].forEach(d=>{ const o=C.createOscillator(), g=C.createGain(); o.type='sine'; o.frequency.value=d?1175:880; const t0=C.currentTime+d; g.gain.setValueAtTime(.0001,t0); g.gain.exponentialRampToValueAtTime(.35,t0+.02); g.gain.exponentialRampToValueAtTime(.0001,t0+.25); o.connect(g); g.connect(C.destination); o.start(t0); o.stop(t0+.27); }); }catch(e){}
  const b=$('#btnBell'); if(b&&!b.hidden){ b.classList.remove('ring'); void b.offsetWidth; b.classList.add('ring'); }
}

/* ---------- pestañas y eventos ---------- */
function showTab(t){
  $$('nav.tabs button').forEach(b=>b.setAttribute('aria-selected',b.dataset.tab===t));
  ['cap','cat','refs','ficha','equipo','avance'].forEach(x=>$('#tab-'+x).hidden=x!==t);
  LS.set('tab',t); renderAll();
  if(t==='equipo') loadAdmin();
}
function renderAll(){
  if(!REF) return;
  renderLocInfo(); renderItems();
  if(!$('#tab-cat').hidden && !$('#catGrid').childElementCount) renderCat();
  if(!$('#tab-ficha').hidden) renderFicha();
  if(!$('#tab-refs').hidden) renderRefs();
  if(!$('#tab-avance').hidden) renderAvance();
  if(!$('#tab-equipo').hidden) renderEquipo();
}
async function onPhotoInput(input, forLoc){
  const files=[...input.files]; input.value=''; if(!files.length) return;
  const msgEl = forLoc ? $('#locFotoMsg') : $('#fotoMsg');
  const u=curUbic(); if(!u){ msgEl.textContent='Elija primero la ubicación.'; return; }
  if(locked(u)){ msgEl.textContent='Ubicación cerrada: pida a un supervisor que la reabra.'; return; }
  if(!forLoc && !chosen){ msgEl.textContent='Elija primero el bien: el nombre de la foto lleva su bloque.'; return; }
  for(const f of files){
    uploads++; msgEl.textContent='Preparando foto…';
    try{
      const dataUrl=await toJpegDataUrl(f);
      const want = forLoc ? locPhotoName(u,$('#inFecha').value) : nextPhotoName(u, chosen.c, $('#inFecha').value, $('#fotoTipo').value);
      const lid=Date.now().toString(36)+Math.random().toString(36).slice(2,8);
      await fotoPut(lid, dataUrl); PREV['local:'+lid]=dataUrl;
      enqueue('api_uploadPhoto',[lid, want],'', 'Foto '+want);
      const ref={id:'local:'+lid, n:want};
      if(forLoc){ window.__locPatch(u,{fotoAdd:ref},'Foto general de '+u); msgEl.textContent='Foto guardada: '+want; }
      else { formFotos.push({...ref, t:$('#fotoTipo').value, p:ME?ME.nombre:'', d:Date.now()}); renderFormFotos(); msgEl.textContent='Lista: '+want+(online?'':' · se subirá al volver la señal'); }
    }catch(err){ msgEl.textContent='No se pudo preparar la foto: '+errMsg(err); }
    finally{ uploads--; }
  }
}
function wire(){
  $$('nav.tabs button').forEach(b=>b.onclick=()=>showTab(b.dataset.tab));
  $('#selUbic').onchange=()=>{
    if($('#selUbic').value==='__new'){ $('#newLoc').hidden=false; $('#nlNombre').focus(); return; }
    $('#newLoc').hidden=true; LS.set('ubic',curUbic()); if(editingId) resetForm(); else choose(chosen&&chosen.free?chosen:chosen); renderAll();
  };
  $('#nlOk').onclick=addLoc;
  $('#nlCancel').onclick=()=>{ $('#newLoc').hidden=true; $('#selUbic').value=LS.get('ubic',''); renderAll(); };
  $('#inFecha').onchange=updFotoNext; $('#fotoTipo').onchange=updFotoNext;
  const ib=$('#inBien');
  const pick=x=>{ const raw=ib.value; choose(x); if(/^\d{5}-\d{4}-\d+/.test(norm(raw))&&!$('#inEtq').value){ $('#inEtq').value=raw.trim().toUpperCase(); updEtq(); } $('#inEtq').focus(); };
  ib.oninput=()=>{ sList=searchCat(ib.value); sIdx=sList.length?0:-1; renderSugg(); };
  ib.onkeydown=e=>{
    if(e.key==='ArrowDown'){ sIdx=Math.min(sIdx+1,sList.length-1); renderSugg(); e.preventDefault(); }
    else if(e.key==='ArrowUp'){ sIdx=Math.max(sIdx-1,0); renderSugg(); e.preventDefault(); }
    else if(e.key==='Enter'){ e.preventDefault(); if(sList[sIdx]) pick(sList[sIdx]); }
    else if(e.key==='Escape'){ sList=[]; renderSugg(); }
  };
  ib.onblur=()=>setTimeout(()=>{ sList=[]; renderSugg(); },180);
  $('#lsBien').onmousedown=e=>{ const li=e.target.closest('li'); if(!li) return; e.preventDefault(); pick(sList[+li.dataset.i]); };
  $('#goCat').onclick=()=>showTab('cat');
  $('#inEtq').oninput=updEtq; $('#inSerie').oninput=updSerie;
  $$('.pm button').forEach(b=>b.onclick=()=>{ const i=$('#q'+b.dataset.k); i.value=Math.max(0,(parseInt(i.value)||0)+(+b.dataset.d)); updQty(); });
  ['#qb','#qr','#qm'].forEach(s=>{ const i=$(s); i.oninput=updQty; i.onfocus=()=>setTimeout(()=>i.select(),0); i.onblur=()=>{ i.value=Math.max(0,parseInt(i.value)||0); updQty(); }; });
  $('#chkRev').onchange=()=>{ $('#revWrap').hidden=!$('#chkRev').checked; if($('#chkRev').checked) $('#inRev').focus(); };
  $('#frm').onsubmit=save;
  $('#btnCancel').onclick=()=>resetForm();
  $('#items').onclick=onItemAct;
  $('#inFiltro').oninput=renderItems; $('#antFiltro').oninput=renderFicha;
  $('#catQ').oninput=renderCat; $('#catSoloImg').onchange=renderCat;
  $$('input[data-frmfoto]').forEach(i=>i.onchange=()=>onPhotoInput(i,false));
  $$('input[data-locfoto]').forEach(i=>i.onchange=()=>onPhotoInput(i,true));
  $('#frmFotos').onclick=e=>{ const b=e.target.closest('button[data-rm]'); if(!b) return; formFotos.splice(+b.dataset.rm,1); renderFormFotos(); };
  const locPatch=(u,patch,label)=>{ let l=LOCS.find(x=>x.n===u); if(!l){ l={n:u,t:'',z:'',a:true,nueva:true,fotos:[],i:LOCS.length}; LOCS.push(l); }
    if('nota' in patch) l.nota=patch.nota; if('cerrada' in patch) l.cerrada=patch.cerrada;
    if(patch.fotoAdd) l.fotos=[...(l.fotos||[]), patch.fotoAdd]; if(patch.fotoDel) l.fotos=(l.fotos||[]).filter(f=>f.id!==patch.fotoDel);
    enqueue('api_setLoc',[u,patch],'',label); saveCache(); refreshUI(); };
  $('#locFotos').onclick=e=>{ const b=e.target.closest('button[data-rmg]'); if(!b) return; if(locked(curUbic())){ toast('Ubicación cerrada: pida a un supervisor que la reabra'); return; } locPatch(curUbic(),{fotoDel:b.dataset.rmg},'Quitar foto general'); };
  $('#locNotaSave').onclick=()=>{ const u=curUbic(); if(!u) return; if(locked(u)){ toast('Ubicación cerrada: pida a un supervisor que la reabra'); return; } locPatch(u,{nota:$('#locNota').value.trim()},'Nota de '+u); $('#locNotaMsg').textContent='Nota guardada'; setTimeout(()=>$('#locNotaMsg').textContent='',2500); };
  wireRev();
  window.__locPatch=locPatch;
  $('#chkSoloAct').onchange=renderAvance;
  $('#locList').onclick=e=>{ const b=e.target.closest('button[data-go]'); if(!b) return; $('#selUbic').value=b.dataset.go; LS.set('ubic',b.dataset.go); showTab('cap'); window.scrollTo({top:0}); };
  $('#btnExport').onclick=doExport;
  wireEquipo(); wireRefs();
  $('#btnSync').onclick=()=>{ if(!OUTBOX.length){ sync(); toast('Actualizando…'); return; } sync(); toast(online?'Enviando cambios pendientes…':'Sin señal: se enviarán al volver la conexión'); };
  $('#inJust').oninput=updReq;
  document.addEventListener('click',e=>{
    const f=e.target.closest('[data-ficha]'); if(f){ e.preventDefault(); openFicha(f.dataset.ficha); return; }
    const use=e.target.closest('[data-use]'); if(use){ closeModal(); showTab('cap'); choose(CAT.get(use.dataset.use)); $('#frm').scrollIntoView({behavior:'smooth'}); setTimeout(()=>$('#inEtq').focus(),300); return; }
    if(e.target.closest('[data-close]') || e.target===$('#modal')) closeModal();
  });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape' && !$('#modal').hidden) closeModal(); });
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden) poll(); });
}

function setMe(me){
  const changed = !ME || ME.id!==me.id || ME.rol!==me.rol || ME.nombre!==me.nombre || ME.vence!==me.vence;
  ME=me;
  if(!changed) return;
  $('#selCont').innerHTML=`<option>${esc(me.nombre)}</option>`; $('#selCont').value=me.nombre;
  $('#btnUser').hidden=false; $('#uName').textContent=me.nombre.split(' ').slice(0,2).join(' ');
  $('#uRole').textContent=me.rol+(me.vence?' · hasta '+new Date(me.vence).toLocaleTimeString('es-SV',{hour:'2-digit',minute:'2-digit'}):'');
  $('#tabEquipo').hidden = (me.lvl||1)<3;
  $('#btnBell').hidden = (me.lvl||1)<2;
  $('#cardExport').hidden = (me.lvl||1)<2;
  $('#cardGestion').hidden = (me.lvl||1)<2;
  { const u=(window.APP_URL&&!/^<\?/.test(window.APP_URL))?window.APP_URL:''; $('#lnkGestion').href=u+'?gestion'; }
  if((me.lvl||1)<3 && !$('#tab-equipo').hidden) showTab('cap');
}
const dayOf = ms => { const d=new Date(ms); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); };
const locked = u => !!ME && (ME.lvl||1)<2 && !!u && !!(STATE[slug(u)]&&STATE[slug(u)].cerrada);
function canEdit(r){ return !!ME && !locked(r.ubic) && ((ME.lvl||1)>=2 || (r.uid && r.uid===ME.id && dayOf(r.creado)===today())); }

let started=false, pollT=null;
function showLogin(msg){
  window.__ready=true;
  $('#login').hidden=false; $('#devInfo').textContent='Este dispositivo: '+DEVNAME;
  const m=$('#loginMsg'); if(msg){ m.hidden=false; m.textContent=msg; } else m.hidden=true;
  setTimeout(()=>$('#inCode').focus(),100);
}
function onAuthFail(msg){
  TOKEN=''; LS.set('tok',''); ME=null; ADM=null; ROWS.clear(); STATE={};
  if(pollT){ clearInterval(pollT); pollT=null; }
  $('#btnUser').hidden=true; $('#btnBell').hidden=true; $('#revAlert').hidden=true;
  showLogin(msg);
}
async function doLogin(ev){
  ev.preventDefault();
  const code=$('#inCode').value.trim(), m=$('#loginMsg'), b=$('#btnLogin');
  if(code.replace(/[^A-Za-z0-9]/g,'').length<6){ m.hidden=false; m.className='status warn'; m.textContent='Escriba los 6 caracteres de su código.'; return; }
  b.disabled=true; m.hidden=false; m.className='status info'; m.textContent='Verificando…';
  try{
    const r=await rawRun('api_login', code, DEV, DEVNAME);
    if(r.pending){ m.className='status warn'; m.textContent=r.msg; return; }
    TOKEN=r.token; LS.set('tok',TOKEN); $('#inCode').value=''; m.hidden=true;
    $('#login').hidden=true; setMe(r.me); startApp();
  }catch(e){ m.className='status bad'; m.textContent=errMsg(e); }
  finally{ b.disabled=false; }
}
async function startApp(){
  loadOutbox(); await loadLocalPreviews();
  const cachedRef=LS.get('ref',null);
  if(cachedRef && cachedRef.cat && !REF){ loadRef(cachedRef); }
  if(ME && loadCache()){ window.__ready=true; if(!started){ resetForm(); showTab(LS.get('tab','cap')); started=true; } refreshUI(); }
  setSync('busy', REF?'Actualizando…':'Cargando catálogo…');
  try{
    const R=await rawRunT(60000, 'api_getRef', TOKEN, cachedRef?cachedRef.refVer:null);
    if(R.me) setMe(R.me);
    if(!R.same){ if(!R.cat) throw {message:'El servidor devolvió datos vacíos. En Apps Script ejecute la función probar.'}; try{ const c={...R}; delete c.me; localStorage.setItem('ref', JSON.stringify(c)); }catch(e){} loadRef(R); }
    online=true;
  }catch(e){
    if(isAuthErr(e)){ onAuthFail(errMsg(e)); return; }
    if(!REF){ window.__ready=true; setSync('off','Sin conexión'); window.__bootShow('<b>No se pudieron cargar los datos:</b> '+esc(errMsg(e))+'<br>La primera vez necesita conexión.'); return; }
    online=false;
  }
  if(ME && !ROWS.size) loadCache();
  if(!started){ resetForm(); showTab(LS.get('tab','cap')); started=true; }
  window.__ready=true;
  refreshUI(); showRejected();
  await sync();
  if(ME && ME.lvl>=3) loadAdmin();
  if(!pollT) pollT=setInterval(poll, 12000);
}
window.addEventListener('online', ()=>{ online=true; sync(); });
window.addEventListener('offline', ()=>{ online=false; updSyncUI(); });

/* ---------- panel Equipo (administrador) ---------- */
const fdt = ms => ms ? new Date(ms).toLocaleString('es-SV',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : '';
const toLocalInput = ms => { if(!ms) return ''; const d=new Date(ms), p=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
async function loadAdmin(){ if(!ME||ME.lvl<3) return; try{ ADM=await run('api_admin_list'); renderEquipo(); }catch(e){} }
async function adm(fn, ...a){
  try{ ADM=await run(fn, ...a); renderEquipo(); if(ADM.code) showCode(ADM.codeFor, ADM.code, ADM.self); return ADM; }
  catch(e){ if(!isAuthErr(e)) toast(errMsg(e)); return null; }
}
function showCode(nombre, code, self){
  $('#modalBody').innerHTML=`<div class="sec-h"><h2>Código de ${esc(nombre)}</h2><span class="spacer"></span><button type="button" class="btn ghost sm" data-close>Cerrar</button></div>
    <div class="codebox" id="codeTxt">${esc(code)}</div>
    <div class="status warn">Anótelo o cópielo ahora y entrégueselo en persona: <b>no se vuelve a mostrar</b>. Si se pierde, genere uno nuevo.</div>
    ${self?'<div class="status info">Cambió su propio código: tendrá que volver a entrar con el código nuevo.</div>':''}
    <div class="row"><button type="button" class="btn primary" id="copyCode" style="flex:1">Copiar código</button></div>`;
  $('#modal').hidden=false;
  $('#copyCode').onclick=()=>{ const t=code; (navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(()=>toast('Código copiado')).catch(()=>{ const r=document.createRange(); r.selectNodeContents($('#codeTxt')); const s=getSelection(); s.removeAllRanges(); s.addRange(r); toast('Seleccionado: cópielo con Copiar'); }); };
}
function renderEquipo(){
  if(!ADM){ $('#eqUsers').innerHTML='<div class="empty">Cargando…</div>'; return; }
  const U=ADM.users||[], reqs=[]; U.forEach(u=>(u.reqs||[]).forEach(d=>reqs.push({u,d})));
  const bd=$('#eqBadge'); bd.hidden=!reqs.length; bd.textContent=reqs.length;
  $('#eqReqCard').hidden=!reqs.length;
  $('#eqReqs').innerHTML=reqs.map(({u,d})=>`<div class="dev"><b>${esc(u.nombre)}</b><span>${esc(d.n)} · ${fdt(d.t)}</span><span class="spacer"></span><button type="button" class="btn sm primary" data-dev="aprobar" data-id="${esc(u.id)}" data-d="${esc(d.id)}">Aprobar</button><button type="button" class="btn sm danger" data-dev="rechazar" data-id="${esc(u.id)}" data-d="${esc(d.id)}">Rechazar</button></div>`).join('');
  const cont=U.filter(u=>u.rol==='Contador'&&u.estado!=='Baja'), act=cont.filter(u=>u.estado==='Activo').length;
  $('#eqJorMeta').textContent=`${act} de ${cont.length} contadores activos`;
  const showB=$('#eqBajas').checked, L=U.filter(u=>showB||u.estado!=='Baja').sort((a,b)=>(a.estado==='Baja')-(b.estado==='Baja')||(ROLEORD[b.rol]-ROLEORD[a.rol])||a.nombre.localeCompare(b.nombre));
  $('#eqMeta').textContent=`${U.filter(u=>u.estado==='Activo').length} activas · ${U.filter(u=>u.estado==='Inactivo').length} inactivas`;
  $('#eqUsers').innerHTML=L.map(u=>{
    const vencido=u.vence&&Date.now()>u.vence, me=ME&&u.id===ME.id;
    const st=u.estado==='Baja'?'<span class="chip mut">Dada de baja</span>':u.estado!=='Activo'?'<span class="chip bad">Inactivo</span>':vencido?'<span class="chip warn">Acceso vencido</span>':'<span class="chip ok">Activo</span>';
    if(u.estado==='Baja') return `<div class="ucard off"><div class="top"><b>${esc(u.nombre)}</b><span class="chip mut">${esc(u.rol)}</span>${st}</div></div>`;
    return `<div class="ucard${u.estado!=='Activo'?' off':''}" data-uid="${esc(u.id)}">
      <div class="top"><b>${esc(u.nombre)}</b>${me?'<span class="chip info">Usted</span>':''}${st}<span class="spacer"></span><span class="hint">Último ingreso: ${u.ultimo?fdt(u.ultimo):'nunca'}</span></div>
      <div class="grid3">
        <label class="f"><span>Rol</span><select data-f="rol" ${me?'disabled':''}>${['Contador','Supervisor','Administrador'].map(r=>`<option${r===u.rol?' selected':''}>${r}</option>`).join('')}</select></label>
        <label class="f"><span>Dispositivos permitidos</span><input type="number" min="1" max="10" data-f="max" value="${u.max}"></label>
        <label class="f"><span>Acceso hasta</span><input type="datetime-local" data-f="vence" value="${toLocalInput(u.vence)}"></label>
      </div>
      <div class="devs">${(u.devs||[]).length?(u.devs||[]).map(d=>`<div class="dev">📱 ${esc(d.n)} <span class="hint">desde ${fdt(d.t)}</span><span class="spacer"></span><button type="button" class="btn sm ghost" data-dev="quitar" data-id="${esc(u.id)}" data-d="${esc(d.id)}">Quitar</button></div>`).join(''):'<span class="hint">Aún no ha entrado desde ningún dispositivo.</span>'}</div>
      <div class="row">
        <button type="button" class="btn sm" data-u="guardar">Guardar cambios</button>
        ${me?'':`<button type="button" class="btn sm ${u.estado==='Activo'?'danger':'primary'}" data-u="${u.estado==='Activo'?'desactivar':'activar'}">${u.estado==='Activo'?'Desactivar':'Activar'}</button>`}
        <button type="button" class="btn sm" data-u="codigo">Nuevo código</button>
        <span class="spacer"></span>
        ${me?'':'<button type="button" class="btn sm ghost" data-u="baja" style="color:var(--bad)">Dar de baja</button>'}
      </div>
    </div>`; }).join('')||'<div class="empty">No hay personas.</div>';
  const D=MINEDEL;
  const allDel=$('#eqDel').dataset.all==='1', DV=allDel?D:D.slice(0,8);
  $('#eqDel').innerHTML=D.length?DV.map(d=>`<div class="delrow"><span class="mono">${esc(d.blk||'¿?')}</span><span style="flex:1;min-width:0"><b>${esc(d.ubic)}</b> · ${esc(d.blk?((CAT.get(d.blk)||{}).d||''):d.desc)} · ${d.cant} u. · registró ${esc((d.cont||'').split(' ')[0])}<br><span class="hint">Eliminado: ${esc(d.del)}</span></span><button type="button" class="btn sm" data-restore="${esc(d.id)}">Restaurar</button></div>`).join('')+(D.length>8?`<button type="button" class="btn sm ghost" id="eqDelMore">${allDel?'Ver menos':'Ver los '+D.length+' eliminados'}</button>`:''):'<div class="empty">No hay registros eliminados.</div>';
  const q=norm($('#eqLogQ').value);
  const lg=(ADM.log||[]).filter(r=>!q||norm(r.join(' ')).includes(q));
  $('#eqLog').innerHTML=lg.map(r=>`<div class="logi${/BLOQUEO|fallido/i.test(r[3])?' alert':''}"><div class="h"><b class="a">${esc(r[3])}</b><span>${esc(r[1])}</span><span class="hint">${esc(r[0])}</span></div>${r[5]||r[4]?`<div class="d">${esc(r[5])}${r[4]?' · <span class="mono">'+esc(r[4])+'</span>':''}</div>`:''}</div>`).join('')||'<div class="empty">Sin acciones.</div>';
}
const ROLEORD={Contador:1,Supervisor:2,Administrador:3};
function wireEquipo(){
  $('#eqBajas').onchange=renderEquipo; $('#eqLogQ').oninput=renderEquipo;
  $('#tab-equipo').addEventListener('click', async e=>{
    if(e.target.id==='eqDelMore'){ const el=$('#eqDel'); el.dataset.all=el.dataset.all==='1'?'':'1'; renderEquipo(); return; }
    const dv=e.target.closest('[data-dev]'); if(dv){ dv.disabled=true; await adm('api_admin_device', dv.dataset.id, dv.dataset.d, dv.dataset.dev); return; }
    const ub=e.target.closest('[data-u]'); if(!ub) return;
    const card=ub.closest('[data-uid]'), id=card.dataset.uid, a=ub.dataset.u;
    if(a==='guardar'){
      const v=card.querySelector('[data-f="vence"]').value;
      await adm('api_admin_update', id, {rol:card.querySelector('[data-f="rol"]').value, max:+card.querySelector('[data-f="max"]').value||1, vence: v?new Date(v).getTime():null});
      toast('Cambios guardados'); return;
    }
    if(a==='activar'||a==='desactivar'){ await adm('api_admin_update', id, {estado:a==='activar'?'Activo':'Inactivo'}); toast(a==='activar'?'Persona activada':'Persona desactivada: ya no puede registrar'); return; }
    if(a==='codigo'||a==='baja'){
      if(ub.dataset.armed!=='1'){ ub.dataset.armed='1'; const t=ub.textContent; ub.textContent=a==='baja'?'¿Dar de baja para siempre? Toque otra vez':'¿Generar otro? Desconecta sus dispositivos'; setTimeout(()=>{ if(ub.isConnected){ ub.dataset.armed=''; ub.textContent=t; } },4000); return; }
      if(a==='codigo') await adm('api_admin_newCode', id); else { await adm('api_admin_update', id, {estado:'Baja'}); toast('Persona dada de baja'); }
    }
  });
  $('#btnFin').onclick=async e=>{ const b=e.currentTarget; if(b.dataset.armed!=='1'){ b.dataset.armed='1'; b.textContent='¿Desactivar a todos los contadores? Toque otra vez'; setTimeout(()=>{ b.dataset.armed=''; b.textContent='Terminar jornada'; },4000); return; } b.dataset.armed=''; b.textContent='Terminar jornada'; const r=await adm('api_admin_jornada','terminar',null); if(r) toast(`Jornada terminada: ${r.n} contadores desactivados`); };
  $('#btnIni').onclick=async()=>{ const h=$('#inHasta').value; let v=null; if(h){ const [hh,mm]=h.split(':').map(Number); const d=new Date(); d.setHours(hh,mm,0,0); if(d.getTime()<Date.now()) d.setDate(d.getDate()+1); v=d.getTime(); } const r=await adm('api_admin_jornada','iniciar',v); if(r) toast(`Jornada iniciada: ${r.n} contadores activos`+(v?' hasta '+h:'')); };
  $('#btnNu').onclick=async()=>{ const n=$('#nuNombre').value.trim(); if(n.length<3){ $('#nuMsg').textContent='Escriba el nombre completo.'; return; } const v=$('#nuVence').value; $('#nuMsg').textContent='';
    const r=await adm('api_admin_addUser',{nombre:n,rol:$('#nuRol').value,max:+$('#nuMax').value||1,vence:v?new Date(v).getTime():null}); if(r){ $('#nuNombre').value=''; $('#nuVence').value=''; $('#eqAdd').open=false; } };
  document.addEventListener('click', e=>{ const b=e.target.closest('[data-restore]'); if(!b) return; restoreLocal(b.dataset.restore); });
  $('#btnUser').onclick=()=>{
    $('#modalBody').innerHTML=`<div class="sec-h"><h2>${esc(ME.nombre)}</h2><span class="spacer"></span><button type="button" class="btn ghost sm" data-close>Cerrar</button></div>
      <dl class="fdl"><dt>Rol</dt><dd>${esc(ME.rol)}</dd><dt>Acceso</dt><dd>${ME.vence?'hasta '+fdt(ME.vence):'sin vencimiento'}</dd><dt>Dispositivo</dt><dd>${esc(DEVNAME)}</dd></dl>
      <div class="status info">Todo lo que registre en este dispositivo queda a su nombre. Si alguien más lo usa, cierre sesión.</div>
      <div class="row"><button type="button" class="btn danger" id="btnLogout" style="flex:1">Cerrar sesión</button></div>`;
    $('#modal').hidden=false;
    $('#btnLogout').onclick=async()=>{ try{ await run('api_logout'); }catch(e){} closeModal(); onAuthFail('Sesión cerrada. Ingrese su código para volver.'); };
  };
  $('#loginForm').onsubmit=doLogin;
  $('#inCode').oninput=e=>{ let v=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6); if(v.length>3) v=v.slice(0,3)+'-'+v.slice(3); e.target.value=v; };
}

function init(){
  wire();
  if(TOKEN) startApp(); else showLogin();
}
init();
})();
