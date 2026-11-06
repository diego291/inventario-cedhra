#!/usr/bin/env python3
"""Comprueba que dist/ esté completo y que las huellas de version.json coincidan (lo mismo que exige el cargador)."""
import base64, hashlib, json, os, re, subprocess, sys
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
v = json.load(open(os.path.join(R, 'dist/version.json'), encoding='utf-8'))
err = []
for k, f in {'nucleo': 'nucleo.js', 'index': 'index.html', 'gestion': 'gestion.html'}.items():
    s = open(os.path.join(R, 'dist', f), encoding='utf-8', newline='').read()
    h = base64.b64encode(hashlib.md5(s.encode('utf-8')).digest()).decode()
    if h != v['md5'][k]: err.append(f + ': la huella no coincide con version.json (¿falta correr build.py?)')
n = open(os.path.join(R, 'dist/nucleo.js'), encoding='utf-8').read()
if "var NUCLEO_VERSION = '" + v['v'] + "'" not in n: err.append('nucleo.js no tiene NUCLEO_VERSION = ' + v['v'])
if not re.search(r'function api_login\(', n) or len(n) < 50000: err.append('nucleo.js no es válido para el cargador')
for f in ['dist/nucleo.js', 'apps-script/Code.gs']:
    p = subprocess.run(['node', '-e', "new Function(require('fs').readFileSync(process.argv[1],'utf8'))", os.path.join(R, f)], capture_output=True, text=True)
    if p.returncode: err.append(f + ': error de sintaxis\n' + p.stderr[-400:])
print('\n'.join(err) if err else 'dist OK · versión ' + v['v'])
sys.exit(1 if err else 0)
