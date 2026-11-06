// Simulación mínima de Apps Script para pruebas en navegador
(function(){
const DATA = window.__SHEETS;
function Sheet(name, rows){ this.name=name; this.rows=rows.map(r=>r.slice()); this.fmt={}; }
Sheet.prototype.getLastRow=function(){ let n=this.rows.length; while(n>0 && this.rows[n-1].every(v=>v===null||v===''||v===undefined)) n--; return n; };
Sheet.prototype.getLastColumn=function(){ let m=0; this.rows.forEach(r=>{ for(let i=r.length;i>0;i--) if(r[i-1]!==null&&r[i-1]!==""&&r[i-1]!==undefined){ m=Math.max(m,i); break; } }); return m; };
Sheet.prototype._cell=function(r,c){ while(this.rows.length<r) this.rows.push([]); const row=this.rows[r-1]; while(row.length<c) row.push(''); return row; };
Sheet.prototype.getRange=function(r,c,nr,nc){
  const sh=this;
  if(typeof r==='string'){ return {setNumberFormat(){return this}}; }
  nr=nr||1; nc=nc||1;
  if((sh.name==='REGISTROS'||sh.name==='UBICACIONES') && c+nc-1>sh.getMaxColumns()) throw new Error('Rango fuera de la hoja: columna '+(c+nc-1));
  return {
    getValues(){ const out=[]; for(let i=0;i<nr;i++){ const row=sh.rows[r-1+i]||[]; const o=[]; for(let j=0;j<nc;j++){ const v=row[c-1+j]; o.push(v===null||v===undefined?'':v); } out.push(o);} return out; },
    getValue(){ return this.getValues()[0][0]; },
    setValues(v){ if(v.length!==nr||v[0].length!==nc) throw new Error('setValues size mismatch '+v.length+'x'+v[0].length+' vs '+nr+'x'+nc); v.forEach((row,i)=>row.forEach((x,j)=>{ sh._cell(r+i,c+j)[c-1+j]=x; })); return this; },
    setValue(x){ sh._cell(r,c)[c-1]=x; return this; },
    setNumberFormat(){ return this; }, setNumberFormats(){ return this; }, setFontWeight(){ return this; }, setBackground(){ return this; }, setFontColor(){ return this; }
  };
};
Sheet.prototype.deleteRow=function(i){ this.rows.splice(i-1,1); };
Sheet.prototype.clear=function(){ this.rows=[]; };
Sheet.prototype.setFrozenRows=function(){};
Sheet.prototype.getMaxRows=function(){ return 1000; };
Sheet.prototype.getMaxColumns=function(){ return this._maxc||(this.name==='UBICACIONES'?12:27); };
Sheet.prototype.insertColumnsAfter=function(a,n){ this._maxc=this.getMaxColumns()+n; };
const sheets={}; Object.keys(DATA).forEach(k=>sheets[k]=new Sheet(k,DATA[k]));
const SS={ getName:()=>'Base', getId:()=>'SSID123', getSheetByName:n=>sheets[n]||null, getSpreadsheetTimeZone:()=>'America/El_Salvador', insertSheet:n=>(sheets[n]=new Sheet(n,[])) };
window.__SS=sheets;
window.SpreadsheetApp={ openById:()=>SS, getActiveSpreadsheet:()=>SS, getUi:()=>({alert:m=>console.log('ALERT',m)}) };
const props={}; window.PropertiesService={ getScriptProperties:()=>({getProperty:k=>props[k]??null,setProperty:(k,v)=>{props[k]=v;}}) };
window.LockService={ getScriptLock:()=>({waitLock(){},releaseLock(){}}) };
let fid=0; const files={};
function Folder(name,id){ this.name=name; this.id=id; this.files=[]; this.sub=[]; }
Folder.prototype.getId=function(){return this.id}; Folder.prototype.getName=function(){return this.name}; Folder.prototype.getUrl=function(){return 'https://drive.google.com/drive/folders/'+this.id};
Folder.prototype.isTrashed=()=>false;
const it=a=>{ let i=0; return {hasNext:()=>i<a.length,next:()=>a[i++]}; };
Folder.prototype.getFoldersByName=function(n){ return it(this.sub.filter(f=>f.name===n)); };
Folder.prototype.createFolder=function(n){ const f=new Folder(n,'FOLDER'+(++fid)); this.sub.push(f); folders[f.id]=f; return f; };
Folder.prototype.getFilesByName=function(n){ return it(this.files.filter(f=>f.n===n)); };
Folder.prototype.getFiles=function(){ return it(this.files.map(f=>mkFile(f))); };
Folder.prototype.createFile=function(blob){ const id='FILE'+(++fid); const f={id,n:blob.name,bytes:blob.bytes,type:blob.type,parent:this}; files[id]=f; this.files.push(f); return mkFile(f); };
function mkFile(f){ return {getDateCreated:()=>new Date(), setTrashed:()=>{}, getId:()=>f.id,getName:()=>f.n,getParents:()=>it([f.parent]),getBlob:()=>({getContentType:()=>f.type,getBytes:()=>f.bytes})}; }
const root=new Folder('Mi unidad','ROOT'), folders={ROOT:root};
const parent=root.createFolder('Inventario');
const imgDir=parent.createFolder('Imagenes catalogo');
imgDir.files.push({id:'IMG1103',n:'1103.jpg',bytes:[255,216,255],type:'image/jpeg',parent:imgDir}); files.IMG1103=imgDir.files[0];
imgDir.files.push({id:'IMG1154',n:'1154.jpg',bytes:[255,216,255],type:'image/jpeg',parent:imgDir}); files.IMG1154=imgDir.files[1];
window.DriveApp={ getFileById:id=>{ if(id==='SSID123') return {getParents:()=>it([parent]), makeCopy:(n,f)=>{ const c=f.createFile({name:n,bytes:[1],type:'x'}); return {getName:()=>n}; }}; const f=files[id]; if(!f) throw new Error('no file'); return mkFile(f); }, getFolderById:id=>{ if(!folders[id]) throw new Error('nf'); return folders[id]; }, getRootFolder:()=>root };
window.__files=files;
window.Utilities={ formatDate:(d,tz,f)=>{ const p=n=>String(n).padStart(2,'0'); return f==='yyyy-MM-dd'?`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`:`${p(d.getDate())}/${p(d.getMonth()+1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`; },
  base64Decode:s=>Array.from(atob(s),c=>c.charCodeAt(0)), base64Encode:b=>btoa(String.fromCharCode(...b.slice(0,50000))), newBlob:(bytes,type,name)=>({bytes,type,name}) };
window.Session={ getScriptTimeZone:()=>'America/El_Salvador' };
function fnv(str){ let h1=0x811c9dc5, out=[]; for(let k=0;k<32;k++){ let h=h1^k; for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619)>>>0; } out.push(h&255); h1=h; } return out; }
Utilities.DigestAlgorithm={SHA_256:'sha256'}; Utilities.Charset={UTF_8:'utf8'};
Utilities.computeDigest=(alg,str)=>fnv('D'+str);
Utilities.computeHmacSha256Signature=(v,k)=>fnv('H'+k+'|'+v);
Utilities.base64EncodeWebSafe=b=>btoa(String.fromCharCode(...b)).replace(/\+/g,'-').replace(/\//g,'_');
Utilities.getUuid=()=>Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2);
const _cache={}; window.CacheService={ getScriptCache:()=>({ get:k=>{ const c=_cache[k]; return c&&c.exp>Date.now()?c.v:null; }, put:(k,v,t)=>{ _cache[k]={v:String(v),exp:Date.now()+t*1000}; }, putAll:(m,t)=>{ Object.keys(m).forEach(k=>_cache[k]={v:String(m[k]),exp:Date.now()+t*1000}); }, getAll:ks=>{ const o={}; ks.forEach(k=>{ const c=_cache[k]; if(c&&c.exp>Date.now()) o[k]=c.v; }); return o; } }) };
window.__cache=_cache;
const _trig=[]; window.ScriptApp={ getProjectTriggers:()=>_trig.map(t=>({getHandlerFunction:()=>t})), newTrigger:fn=>({timeBased:()=>({everyDays:()=>({atHour:()=>({create:()=>_trig.push(fn)})})})}) };
window.Logger={log:m=>{ (window.__logs=window.__logs||[]).push(String(m)); }};
// google.script.run con las reglas de serialización (Date prohibido)
function hasDate(o){ if(o instanceof Date) return true; if(o&&typeof o==='object') return Object.values(o).some(hasDate); return false; }
window.__calls=[];
function runner(ok,fail){ return new Proxy({}, { get(_,k){
  if(k==='withSuccessHandler') return f=>runner(f,fail);
  if(k==='withFailureHandler') return f=>runner(ok,f);
  return (...args)=>setTimeout(()=>{ window.__calls.push(k);
    try{ const a=JSON.parse(JSON.stringify(args)); const res=window[k](...a);
      if(hasDate(res)) throw new Error('Date en respuesta de '+k);
      ok&&ok(res===undefined?null:JSON.parse(JSON.stringify(res))); }
    catch(e){ console.error('SERVER',k,e.message); fail&&fail({message:e.message}); } }, 30);
}}); }
window.google={script:{run:runner(null,null)}};
})();
