@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist Correccion.xlsx (echo Falta Correccion.xlsx en esta carpeta & pause & exit /b)
python correccion_siges.py Correccion.xlsx --limite
pause
