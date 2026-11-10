"""
Corrección SIGES · script local (Playwright)  v1.0
--------------------------------------------------
Lee el Excel que exporta inventario-cedhra (página "Corrección SIGES") y, bien por bien:
  1. Abre la edición en SIGES (directo por ID si ya lo tiene; si no, lo busca por código y guarda el ID).
  2. Comprueba que el código en pantalla y el "Asignado a" actual coincidan con el Excel (si no → REVISAR).
  3. Cambia "Asignado a" y, en los Reasignados, Descripción, Calidad, Marca, Modelo y Serie.
  4. Guarda, espera el mensaje verde y vuelve a leer el valor guardado.
Nunca toca datos financieros ni Tipo de Bien.

Uso:
  python correccion_siges.py Correccion.xlsx               corrida normal (retoma donde quedó)
  python correccion_siges.py Correccion.xlsx --diagnostico  prueba con el 1.er bien SIN guardar
  python correccion_siges.py Correccion.xlsx --mapear       solo consigue los ID, sin editar
  python correccion_siges.py Correccion.xlsx --limite 5     solo los primeros 5 pendientes

Teclas mientras corre (Windows): P pausar · C continuar · Q detener seguro.
"""
import argparse, csv, os, re, sys, time, unicodedata
from datetime import datetime
from openpyxl import load_workbook
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

EDIT_URL = 'https://activofijo.siges.sv/af/pp/cargo?id={id}&edit=true'
INICIO_URL = 'https://escritorio.siges.sv/pp/inicio'
MSG_OK = 'se guardó correctamente'
PAUSA_ENTRE = 0.4          # segundos entre bienes
T_ESPERA = 20000           # ms para cargas y guardado
FINALES = {'EXITOSO', 'SIN CAMBIO'}

try:
    import msvcrt, winsound
    def tecla():
        return msvcrt.getwch().upper() if msvcrt.kbhit() else ''
    def beep():
        for _ in range(3): winsound.Beep(1000, 300)
except ImportError:
    def tecla(): return ''
    def beep(): print('\a', end='', flush=True)

os.system('')  # habilita colores ANSI en la consola de Windows
def norm(s):
    s = unicodedata.normalize('NFD', str(s or '')); s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.sub(r'\s+', ' ', s).strip().upper()

# ---------------- Excel + diario (para retomar sin perder nada) ----------------
class Datos:
    def __init__(self, ruta):
        self.ruta = ruta; self.wb = load_workbook(ruta); self.ws = self.wb.worksheets[0]
        self.h = {str(c.value).strip(): i for i, c in enumerate(self.ws[1]) if c.value}
        falta = [c for c in ('Codigo', 'Tipo', 'Asignado_actual', 'Asignado_nuevo', 'ID_SIGES', 'Estado', 'Detalle') if c not in self.h]
        if falta: sys.exit(f'El Excel no tiene las columnas: {", ".join(falta)}. Use el que exporta "Corrección SIGES".')
        self.filas = [r for r in self.ws.iter_rows(min_row=2) if r[self.h['Codigo']].value]
        self.diario = os.path.splitext(ruta)[0] + '_diario.csv'
        self.sin_guardar = 0
        if os.path.exists(self.diario):          # aplica lo hecho en corridas anteriores
            by = {norm(self.v(r, 'Codigo')): r for r in self.filas}
            with open(self.diario, encoding='utf-8') as f:
                for d in csv.DictReader(f):
                    r = by.get(norm(d['Codigo']))
                    if r: self._set(r, d)
    def v(self, r, col): return '' if col not in self.h or r[self.h[col]].value is None else str(r[self.h[col]].value).strip()
    def _set(self, r, d):
        for k, val in d.items():
            if k in self.h and val not in (None, ''): r[self.h[k]].value = val
    def anotar(self, r, **d):
        d['Fecha_hora'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S'); d['Codigo'] = self.v(r, 'Codigo')
        self._set(r, d); nuevo = not os.path.exists(self.diario)
        campos = ['Codigo', 'ID_SIGES', 'Asignado_anterior', 'Estado', 'Detalle', 'Fecha_hora']
        with open(self.diario, 'a', newline='', encoding='utf-8') as f:
            w = csv.DictWriter(f, fieldnames=campos, extrasaction='ignore')
            if nuevo: w.writeheader()
            w.writerow(d)
        self.sin_guardar += 1
        if self.sin_guardar >= 25: self.guardar()
    def guardar(self, resumen=None):
        if resumen:
            if 'Resumen' in self.wb.sheetnames: del self.wb['Resumen']
            ws = self.wb.create_sheet('Resumen')
            for fila in resumen: ws.append(fila)
        try: self.wb.save(self.ruta); self.sin_guardar = 0
        except PermissionError: print('\n  (El Excel está abierto: lo guardo al final. El avance queda en el diario.)')

# ---------------- SIGES ----------------
def campo(page, etiqueta, tipo='input'):
    """Control que sigue a la etiqueta visible (los formularios de SIGES son etiqueta | control)."""
    return page.locator(f"xpath=(//label[contains(normalize-space(.), '{etiqueta}')])[1]/following::{tipo}[1]")

def sesion_vencida(page):
    u = page.url.lower()
    return 'login' in u or 'auth' in u or page.locator('input[type=password]').count() > 0

def esperar_sesion(page, panel):
    beep(); panel.aviso = '🔔 Sesión vencida. Entra a SIGES en esa ventana y pulsa C.'; panel.dibujar()
    if 'msvcrt' in sys.modules:
        while tecla() not in ('C', '\r'): time.sleep(0.3)
    else: input()
    panel.aviso = ''

def buscar_id(page, codigo, url_busqueda):
    page.goto(url_busqueda); page.wait_for_load_state('networkidle', timeout=T_ESPERA)
    c = campo(page, 'Código de Inventario'); c.fill(codigo)
    page.get_by_role('button', name=re.compile('Buscar')).click()
    page.get_by_text(re.compile(r'Resultados:')).wait_for(timeout=T_ESPERA)
    filas = page.locator('tr', has_text=codigo)
    n = filas.count()
    if n == 0: return None, 'Sin resultados (¿Estado distinto de EXISTENTE?)'
    if n > 1: return None, f'{n} resultados para el código'
    fila = filas.first
    a = fila.locator('a[href*="id="]')
    if a.count():
        m = re.search(r'[?&]id=(\d+)', a.first.get_attribute('href') or '')
        if m: return m.group(1), ''
    lapiz = fila.locator('[title*="ditar" i], .fa-pencil, .fa-pen, .bi-pencil, .glyphicon-pencil').first
    if not lapiz.count(): lapiz = fila.locator('a, button').nth(1)
    lapiz.click(); page.wait_for_url(re.compile(r'cargo\?id=\d+'), timeout=T_ESPERA)
    m = re.search(r'[?&]id=(\d+)', page.url)
    return (m.group(1), '') if m else (None, 'No se obtuvo el ID desde el lápiz')

def procesar(page, D, r, url_busqueda, modo):
    cod = D.v(r, 'Codigo'); idb = D.v(r, 'ID_SIGES'); rec = D.v(r, 'Tipo') == 'Reasignado'
    if not idb:
        idb, err = buscar_id(page, cod, url_busqueda)
        if not idb: return D.anotar(r, Estado='NO ENCONTRADO', Detalle=err) or 'NO ENCONTRADO'
        D.anotar(r, ID_SIGES=idb, Estado='', Detalle='')
        if modo == 'mapear': return 'ID'
    elif modo == 'mapear': return 'ID'
    page.goto(EDIT_URL.format(id=idb)); page.wait_for_load_state('networkidle', timeout=T_ESPERA)
    if sesion_vencida(page): return 'SESION'
    if page.get_by_text(cod, exact=True).count() == 0:
        return D.anotar(r, Estado='REVISAR', Detalle=f'El ID {idb} no muestra el código {cod}') or 'REVISAR'
    asig = campo(page, 'Asignado a'); actual = asig.input_value()
    nuevo = D.v(r, 'Asignado_nuevo'); esperado = D.v(r, 'Asignado_actual')
    if norm(actual) != norm(esperado) and norm(actual) != norm(nuevo):
        return D.anotar(r, Asignado_anterior=actual, Estado='REVISAR', Detalle=f'En SIGES dice "{actual}", se esperaba "{esperado}"') or 'REVISAR'
    cambios = []
    if norm(actual) != norm(nuevo): cambios.append(('Asignado a', 'input', nuevo))
    if rec:
        desc_act = campo(page, 'Descripción', 'textarea').input_value()
        if D.v(r, 'Desc_actual') and norm(desc_act) not in (norm(D.v(r, 'Desc_actual')), norm(D.v(r, 'Desc_nueva'))):
            return D.anotar(r, Asignado_anterior=actual, Estado='REVISAR', Detalle=f'Descripción en SIGES: "{desc_act[:60]}"') or 'REVISAR'
        for col, et, tipo in (('Desc_nueva', 'Descripción', 'textarea'), ('Calidad_nueva', 'Calidad', 'select'), ('Marca_nueva', 'Marca', 'input'), ('Modelo_nueva', 'Modelo', 'input'), ('Serie_nueva', 'Serie', 'input')):
            val = D.v(r, col)
            if val: cambios.append((et, tipo, val))
    if not cambios:
        return D.anotar(r, Asignado_anterior=actual, Estado='SIN CAMBIO', Detalle='Ya estaba correcto') or 'SIN CAMBIO'
    for et, tipo, val in cambios:
        c = campo(page, et, tipo)
        if not c.count(): return D.anotar(r, Asignado_anterior=actual, Estado='FALLIDO', Detalle=f'No encontré el campo "{et}"') or 'FALLIDO'
        if tipo == 'select': c.select_option(label=val)
        else: c.fill(val)
    if modo == 'diagnostico':
        print('\n  DIAGNÓSTICO (no se guardó):', ', '.join(f'{et} = "{val}"' for et, _, val in cambios))
        input('  Revisa la ventana de SIGES y pulsa ENTER para salir sin guardar…'); return 'DIAG'
    page.get_by_role('button', name=re.compile('Guardar')).click()
    try:
        page.get_by_text(re.compile(MSG_OK, re.I)).wait_for(timeout=T_ESPERA)
    except PWTimeout:
        err = page.locator('.alert-danger, .alert-error, .text-danger, .invalid-feedback, .ui-messages-error').all_inner_texts()
        return D.anotar(r, Asignado_anterior=actual, Estado='FALLIDO', Detalle=('; '.join(t.strip() for t in err if t.strip()) or 'Sin mensaje de guardado')[:250]) or 'FALLIDO'
    final = campo(page, 'Asignado a').input_value()
    if norm(final) != norm(nuevo):
        return D.anotar(r, Asignado_anterior=actual, Estado='REVISAR', Detalle=f'Guardó, pero quedó "{final}"') or 'REVISAR'
    return D.anotar(r, Asignado_anterior=actual, Estado='EXITOSO', Detalle=', '.join(et for et, _, _ in cambios)) or 'EXITOSO'

# ---------------- panel ----------------
class Panel:
    def __init__(self, total): self.total = total; self.n = 0; self.c = {}; self.ult = []; self.t0 = time.time(); self.aviso = ''; self.estado = 'Corriendo'
    def sumar(self, cod, st):
        self.n += 1; self.c[st] = self.c.get(st, 0) + 1
        self.ult = ([f"{cod[-4:]} {'✔' if st in FINALES else '⚠' if st == 'REVISAR' else '✕'}"] + self.ult)[:5]
    def dibujar(self):
        pct = self.n / self.total if self.total else 1; bar = '█' * int(pct * 24) + '░' * (24 - int(pct * 24))
        ritmo = (time.time() - self.t0) / self.n if self.n else 0; falta = ritmo * (self.total - self.n)
        ok = self.c.get('EXITOSO', 0) + self.c.get('SIN CAMBIO', 0) + self.c.get('ID', 0)
        mal = self.c.get('FALLIDO', 0) + self.c.get('NO ENCONTRADO', 0)
        print('\033[H\033[J', end='')
        print(f' CORRECCIÓN SIGES · {self.estado:<10}                {bar} {pct:4.0%}')
        print(f' {self.n:,} / {self.total:,}   ✔ {ok:,}   ⚠ {self.c.get("REVISAR", 0):,}   ✕ {mal:,}     ' + (f'Ritmo {ritmo:.1f} s/bien · faltan ~{int(falta // 3600)} h {int(falta % 3600 // 60)} min' if self.n else ''))
        print(' Últimos: ' + ' · '.join(self.ult))
        print(' ' + '─' * 66)
        print(' [P] Pausar   [C] Continuar   [Q] Detener seguro (termina el bien actual)')
        if self.aviso: print(' ' + self.aviso)

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('excel'); ap.add_argument('--diagnostico', action='store_true')
    ap.add_argument('--mapear', action='store_true'); ap.add_argument('--limite', type=int, default=0)
    a = ap.parse_args(); modo = 'diagnostico' if a.diagnostico else 'mapear' if a.mapear else 'normal'
    D = Datos(a.excel)
    pend = [r for r in D.filas if D.v(r, 'Estado') not in FINALES and not (modo == 'mapear' and D.v(r, 'ID_SIGES'))]
    if modo == 'diagnostico': pend = pend[:1]
    elif a.limite: pend = pend[:a.limite]
    if not pend: print('No hay bienes pendientes en este Excel.'); return
    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'perfil_siges'), headless=False, viewport={'width': 1366, 'height': 850})
        page = ctx.pages[0] if ctx.pages else ctx.new_page(); page.set_default_timeout(T_ESPERA)
        page.goto(INICIO_URL)
        input('\n1) Inicia sesión en SIGES si hace falta.\n2) Entra a Activo Fijo › Cargo de Bienes (pantalla de búsqueda).\n3) Pulsa ENTER aquí… ')
        url_busqueda = page.url
        P = Panel(len(pend)); detener = False
        try:
            for r in pend:
                k = tecla()
                if k == 'Q': detener = True
                if k == 'P':
                    P.estado = 'PAUSADO'; P.dibujar()
                    while tecla() not in ('C', 'Q'): time.sleep(0.3)
                    P.estado = 'Corriendo'
                if detener: break
                cod = D.v(r, 'Codigo')
                for intento in (1, 2):
                    try:
                        st = procesar(page, D, r, url_busqueda, modo)
                        if st == 'SESION': esperar_sesion(page, P); continue
                        break
                    except Exception as e:
                        if sesion_vencida(page): esperar_sesion(page, P); continue
                        if intento == 2: st = 'FALLIDO'; D.anotar(r, Estado='FALLIDO', Detalle=str(e).split('\n')[0][:250])
                if st == 'DIAG': return
                P.sumar(cod, st); P.dibujar(); time.sleep(PAUSA_ENTRE)
        finally:
            dur = int(time.time() - P.t0); todos = [D.v(r, 'Estado') or 'PENDIENTE' for r in D.filas]
            res = [['Corrida', datetime.now().strftime('%d/%m/%Y %H:%M'), 'Duración', f'{dur // 3600} h {dur % 3600 // 60} min'], ['Estado', 'Bienes']]
            res += [[s, todos.count(s)] for s in ('EXITOSO', 'SIN CAMBIO', 'REVISAR', 'FALLIDO', 'NO ENCONTRADO', 'PENDIENTE')]
            errs = {}
            for r in D.filas:
                if D.v(r, 'Estado') in ('FALLIDO', 'REVISAR'): k = D.v(r, 'Detalle')[:60]; errs[k] = errs.get(k, 0) + 1
            res += [[], ['Problemas más comunes', 'Veces']] + [[k, n] for k, n in sorted(errs.items(), key=lambda x: -x[1])[:10]]
            D.guardar(res); ctx.close()
            print(f'\nListo. Resultado guardado en {D.ruta}. Cárgalo en inventario-cedhra › Corrección SIGES › Cargar resultado.')

if __name__ == '__main__':
    main()
