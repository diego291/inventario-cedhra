// Extensiones del simulador para el módulo de gestión
(function(){
const SP=SpreadsheetApp.openById();
const proto=Object.getPrototypeOf(SP.getSheetByName('REGISTROS'));
const oldGR=proto.getRange;
proto.getRange=function(r,c,nr,nc){
  if(typeof r==='string') return {setNumberFormat(){return this}};
  const rg=oldGR.call(this,r,c,nr,nc), sh=this;
  rg.clearContent=function(){ for(let i=0;i<(nr||1);i++){ const row=sh.rows[r-1+i]; if(row) for(let j=0;j<(nc||1);j++) row[c-1+j]=''; } return rg; };
  return rg;
};
proto.insertRowsAfter=function(){};
proto.setName=function(n){ this.name=n; return this; };
const fmt=Utilities.formatDate;
Utilities.formatDate=(d,tz,f)=>{ const p=n=>String(n).padStart(2,'0'); if(f==='yyyy') return String(d.getFullYear()); if(f==='yyyy-MM-dd HHmm') return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}${p(d.getMinutes())}`; return fmt(d,tz,f); };
window.__pdfs=[]; window.__created=[];
window.HtmlService={ createHtmlOutput:h=>({ getBlob:()=>({ getAs:t=>({ name:'', setName(n){ this.name=n; this.html=h; return this; } }) }) }) };
const parentFolder=DriveApp.getFileById('SSID123').getParents().next();
const oldCreate=Object.getPrototypeOf(parentFolder).createFile;
Object.getPrototypeOf(parentFolder).createFile=function(blob){ if(blob.html!=null){ window.__pdfs.push({name:blob.name,size:blob.html.length,html:blob.html}); return {getUrl:()=>'https://drive.google.com/file/d/PDF'+window.__pdfs.length+'/view',getId:()=>'PDF'+window.__pdfs.length}; } return oldCreate.call(this,blob); };
SpreadsheetApp.create=function(name){ const sheets=[]; const mk=n=>{ const s={name:n,data:[],setName(x){this.name=x;return this},getRange(r,c,nr,nc){ const s2=this; return {setNumberFormat(){return this}, setValues(v){ s2.data=v; return this; }, setFontWeight(){return this}, setBackground(){return this}, setFontColor(){return this}}; }, setFrozenRows(){} }; sheets.push(s); return s; };
  mk('Hoja 1'); const ss={getSheets:()=>sheets, insertSheet:n=>mk(n), getId:()=>'RES'+window.__created.length, getUrl:()=>'https://docs.google.com/spreadsheets/d/RES/edit', name}; window.__created.push(ss); return ss; };
const oldGF=DriveApp.getFileById; DriveApp.getFileById=id=>{ if(String(id).startsWith('RES')) return {moveTo(){}}; return oldGF(id); };
window.ScriptApp.getService=()=>({getUrl:()=>'https://script.google.com/macros/s/TEST/exec'});
})();
