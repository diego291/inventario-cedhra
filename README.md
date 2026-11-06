# Inventario CEHRA · Conteo físico + Gestión de inventario

Sistema en Google Apps Script vinculado a la hoja del conteo. **Los datos viven en Google Drive** (la hoja y sus carpetas); este repositorio solo tiene el **código**.

## Cómo se actualiza solo
```
Claude edita src/ → build.py arma dist/ → push a GitHub
        ↓ (máx. 5 min)
Apps Script (cargador Code.gs) lee dist/version.json, descarga nucleo.js + index.html + gestion.html,
verifica las huellas MD5, guarda copia en Drive ("Código del sistema") y los usa.
```
- El link de la aplicación **no cambia** y no hay que volver a implementar.
- Si GitHub no responde, el sistema sigue con la copia de Drive.
- Una versión solo se adopta si los 3 archivos llegan completos y verificados (no mezcla versiones).

## Ramas
| Rama | Hoja | Uso |
|---|---|---|
| `prueba` | CONTEO – PRUEBA (copia) | cada cambio entra aquí primero |
| `main` | hoja oficial | cuando Diego aprueba |

## Estructura
- `apps-script/Code.gs` – **cargador** (se pega una sola vez). `apps-script/appsscript.json` – permisos.
- `src/servidor/` – Code.gs (conteo) y GestionServidor.gs (gestión). `src/motor.js` – réplica del Excel v10.
- `src/web/` – pantallas (captura y gestión).
- `dist/` – **generado** por `python3 build.py <versión>`; es lo que descarga el cargador.
- `tests/` – simulador de Apps Script y pruebas del cargador. Los datos de prueba reales van en `tests/privado/` (no se suben).
- `tools/verificar.py` – lo corre GitHub en cada push.

## Volver atrás
- Propiedades del script › `GH_REF` = etiqueta (p. ej. `v8.0.0`) o commit. Borrarla regresa a la rama.
- O en GitHub: revertir el commit.

Instalación: ver [INSTALAR.md](INSTALAR.md).
