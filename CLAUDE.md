# Reglas para trabajar en este repositorio (Claude)

Usuario: Diego (Complejo Educativo Dr. Humberto Romero Alvergue). Quiere cambios directos, de calidad y que lleguen solos.
Antes de construir algo visible, Diego pide **imágenes con 3 opciones**; elige y luego se construye y se publica directo.

## Flujo obligatorio para cada cambio
1. Editar **solo `src/`** (nunca `dist/` a mano).
2. `python3 build.py X.Y.Z` subiendo la versión (VERSION). Siempre versión nueva, aunque sea un arreglo pequeño.
3. Pruebas: `node tests/test_loader.js` y, si hay fixtures en `tests/privado/` (Diego los guarda en su Drive como *pruebas_privadas.zip*), las pruebas completas del motor (6 escenarios = Excel v10, 0 diferencias), servidor y navegador.
4. `python3 tools/verificar.py` debe decir `dist OK`.
5. Commit + push **directo a `main`** (decisión de Diego, 05/11/2026: no usar la rama `prueba` ni pedir aprobación antes de publicar). Llega solo en ≤ 5 min o con "Buscar actualización ahora".
6. Si algo sale mal: revertir el commit o fijar `GH_REF` a un commit anterior.

## Prohibido
- Subir datos reales: nombres, DUI/NIP, códigos de acceso, inventario, respaldos, Excel. El repositorio es **público**.
- Borrar, renombrar o reordenar hojas, columnas o carpetas existentes; cambiar formatos de datos guardados. Solo se agregan pestañas/columnas al final, con funciones idempotentes.
- Cambiar el nombre de funciones `api_*` que ya usa la app, o su formato de respuesta, sin mantener compatibilidad.

## Cosas que obligan a Diego a tocar Apps Script (evitarlas o avisar antes)
- Un **permiso nuevo** de Google no incluido en `apps-script/appsscript.json`.
- Un **activador** nuevo con otro nombre: usar `tareaProgramada` (ya existe en el cargador) y decidir dentro de `tareaProgramada_` en el núcleo.
- Una función nueva del **menú de la hoja** o un cambio al cargador mismo.
Las funciones nuevas `api_*` NO requieren tocar nada: pasan por `rpc`.

## Detalles técnicos
- El cliente llama todo con `google.script.run.rpc(fn, args)`; el cargador solo deja pasar `api_*`.
- `api_sys_estado` / `api_sys_actualizar` los atiende el cargador (pestaña Configuración › Sistema).
- `onEdit` y `onOpen` viven completos en el cargador (activadores simples sin UrlFetch/Drive). Si cambian los nombres de hojas que marcan versiones (refver, locver, fullver, gver), actualizar también el cargador.
- Las plantillas `<?= ?>` no existen: el cargador reemplaza `%%APP_URL%%`.
- Estado del proyecto y decisiones de diseño: documento del proyecto "Sistema_Gestion_Inventario_Estado".
