/* ---------- Avisar cuando hay una versión nueva del sistema ----------
   Al abrir, al volver a la pestaña y cada 3 minutos le pide al servidor que revise GitHub en ese momento.
   Si la versión instalada ya no es la de esta pantalla, muestra un aviso para recargar. */
(function () {
  const mia = window.SISTEMA_VERSION || '';
  let ultima = 0, avisada = '';
  function aviso(v) {
    if (avisada === v) return; avisada = v;
    let d = document.getElementById('updBar');
    if (!d) {
      d = document.createElement('div'); d.id = 'updBar';
      d.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:9999;background:#14213D;color:#fff;border-radius:14px;padding:10px 12px 10px 16px;display:flex;gap:12px;align-items:center;box-shadow:0 14px 40px rgba(20,33,61,.35);font:600 14px/1.3 system-ui,sans-serif;max-width:calc(100vw - 32px)';
      document.body.appendChild(d);
    }
    d.innerHTML = '<span>✨ Hay una versión nueva del sistema (' + v + ')</span><button type="button" style="border:0;border-radius:10px;padding:8px 14px;background:#E08A2E;color:#14213D;font:700 13px system-ui,sans-serif;cursor:pointer">Recargar</button><button type="button" title="Más tarde" style="border:0;background:none;color:#C9D3E3;font-size:16px;cursor:pointer">✕</button>';
    d.children[1].onclick = () => location.reload();
    d.children[2].onclick = () => d.remove();
  }
  function revisar() {
    if (!mia || !(window.google && google.script && google.script.run) || Date.now() - ultima < 60000) return;
    ultima = Date.now();
    google.script.run.withSuccessHandler(r => { if (r && r.version && r.version !== mia) aviso(r.version); }).withFailureHandler(() => {}).rpc('api_sys_revisar', []);
  }
  setTimeout(revisar, 4000);
  setInterval(revisar, 180000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') revisar(); });
})();
