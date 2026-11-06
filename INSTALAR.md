# Instalación (una sola vez)

> Antes de empezar:
> 1. En Drive cree una carpeta nueva **INVENTARIO PRUEBA**.
> 2. En la hoja del conteo: **Archivo › Hacer una copia**, nombre **CONTEO – PRUEBA**, carpeta **INVENTARIO PRUEBA**.
>    Así la prueba crea sus fotos, actas y respaldos en su propia carpeta y nunca toca los de la hoja oficial.
>    Esa copia es también su respaldo del código actual.

## En la hoja de PRUEBA primero
1. Abra **CONTEO – PRUEBA › Extensiones › Apps Script**.
2. ⚙ **Configuración del proyecto** › marque **"Mostrar el archivo de manifiesto appsscript.json en el editor"**.
3. Vuelva a **Editor** (`< >`):
   - Abra `appsscript.json`, borre todo y pegue el contenido de `apps-script/appsscript.json`. Guarde.
   - Borre los archivos **GestionServidor.gs** y **Motor.gs** (los ⋮ junto al nombre › Eliminar). Los HTML pueden quedarse.
   - Abra **Código.gs** (o Code.gs), borre todo y pegue `apps-script/Code.gs`.
   - **Solo en la hoja de prueba:** cambie `var GH_RAMA = 'main';` por `var GH_RAMA = 'prueba';`. Guarde.
4. Arriba, en el selector de funciones, elija **activarTodo** › **Ejecutar** › **Revisar permisos** › su cuenta › **Configuración avanzada › Ir a … (no seguro)** › **Permitir**.
   Debe decir "Listo. Sistema 8.0.0 … cargado desde GitHub".
5. **Implementar › Nueva implementación › Aplicación web** › Ejecutar como **Yo** · Acceso **Cualquiera** › Implementar. Copie el link: es el link de PRUEBA.
6. En la hoja de prueba: recargue la hoja › menú **Conteo › Nuevo código de administrador** (la copia no trae las claves de la oficial, por eso los códigos viejos no sirven ahí).
7. Abra el link y el link + `?gestion` e ingrese con ese código. En Gestión › Configuración › **Sistema** debe verse la versión.

## Después, en la hoja OFICIAL (cuando la prueba esté bien)
Los mismos pasos 1 a 4 (sin cambiar `GH_RAMA`, se queda en `'main'`). En el paso 5 **no** cree implementación nueva:
**Implementar › Administrar implementaciones › "Conteo – oficial" › ✏️ › Versión: Nueva versión › Implementar.** El link sigue igual.

## Si algo sale mal
- En la hoja oficial: Implementar › Administrar implementaciones › ✏️ › Versión: elija la versión anterior › Implementar (vuelve al código de antes).
- O pegue de nuevo los archivos originales desde la hoja CONTEO – PRUEBA (la copia los tiene).
