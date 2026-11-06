#!/usr/bin/env python3
"""Arma dist/ (lo que descarga el cargador de Apps Script).

  python3 build.py 8.0.1      → versión nueva (súbala en cada cambio)
  python3 build.py            → usa la versión de VERSION

dist/nucleo.js     Code.gs + Motor.gs + GestionServidor.gs (servidor)
dist/index.html    app de conteo
dist/gestion.html  módulo de gestión
dist/version.json  versión + huellas MD5 (el cargador solo adopta archivos que coinciden)
"""
import base64, hashlib, json, os, sys, datetime
R = os.path.dirname(os.path.abspath(__file__))
rd = lambda p: open(os.path.join(R, p), encoding='utf-8').read()
def wr(p, s):
    os.makedirs(os.path.dirname(os.path.join(R, p)), exist_ok=True)
    open(os.path.join(R, p), 'w', encoding='utf-8', newline='\n').write(s)

ver = sys.argv[1] if len(sys.argv) > 1 else rd('VERSION').strip()
wr('VERSION', ver + '\n')
fecha = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=6)
fecha = fecha.strftime('%d/%m/%Y %H:%M')

def pack(shell, js):
    s = rd(shell)
    js = js.replace('[\u0300-\u036f]', r'[\u0300-\u036f]')
    b = base64.b64encode(js.encode('utf-8')).decode('ascii')
    loader = ("<script>\n(function(){\n  var b='" + b + "';\n"
              "  var bin=atob(b), u=new Uint8Array(bin.length); for(var i=0; i < bin.length; i++) u[i]=bin.charCodeAt(i);\n"
              "  var src=new TextDecoder('utf-8').decode(u);\n"
              "  (0,eval)(src+'\\n//# sourceURL=app.js');\n})();\n</script>")
    assert s.count('<!--APPJS-->') == 1, shell
    s = s.replace('<!--APPJS-->', loader)
    s = s.replace("<?= ScriptApp.getService().getUrl() ?>", '%%APP_URL%%')
    assert '<?' not in s, 'quedó una etiqueta de plantilla en ' + shell
    return s.replace('</head>', '<meta name="sistema-version" content="' + ver + '">\n<script>window.SISTEMA_VERSION = ' + json.dumps(ver) + ';</script>\n</head>', 1)

motor = rd('src/motor.js')
web = ['gestion_core.js', 'gestion_docs.js', 'gestion_ficha.js', 'gestion_ubic.js', 'gestion_reportes.js', 'gestion_inicio.js', 'gestion_config.js']
out = {
    'nucleo': "/* NÚCLEO DEL SISTEMA DE INVENTARIO · generado por build.py — no editar aquí, editar src/ */\nvar NUCLEO_VERSION = '" + ver + "';\n"
              + rd('src/servidor/Code.gs') + '\n' + motor + '\n' + rd('src/servidor/GestionServidor.gs') + '\n',
    'index': pack('src/web/captura_shell.html', rd('src/web/captura.js') + '\n' + rd('src/web/actualizar.js')),
    'gestion': pack('src/web/gestion_shell.html', motor + '\n' + '\n'.join(rd('src/web/' + f) for f in web) + '\n' + rd('src/web/actualizar.js')),
}
names = {'nucleo': 'nucleo.js', 'index': 'index.html', 'gestion': 'gestion.html'}
md5 = {}
for k, s in out.items():
    wr('dist/' + names[k], s)
    md5[k] = base64.b64encode(hashlib.md5(s.encode('utf-8')).digest()).decode('ascii')
    print('dist/' + names[k], len(s))
wr('dist/version.json', json.dumps({'v': ver, 'fecha': fecha, 'md5': md5}, ensure_ascii=False, indent=1) + '\n')
print('versión', ver, fecha)
