@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo === Instalando lo necesario para Correccion SIGES ===
python --version >nul 2>&1
if errorlevel 1 (
  echo Python no esta instalado. Instalando con winget...
  winget install -e --id Python.Python.3.12 --scope user --accept-package-agreements --accept-source-agreements
  echo.
  echo Python instalado. CIERRA esta ventana y vuelve a abrir INSTALAR.bat para terminar.
  pause
  exit /b
)
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m playwright install chromium
echo.
echo === Listo. Ahora pon el Excel exportado en esta carpeta con el nombre Correccion.xlsx ===
pause
