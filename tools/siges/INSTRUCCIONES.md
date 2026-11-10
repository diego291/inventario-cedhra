# Corrección SIGES · script local

Corrige en SIGES el "Asignado a" de los bienes Conservados y, en los Reasignados, también Descripción, Calidad, Marca, Modelo y Serie. **Nunca** toca datos financieros ni Tipo de Bien.

## Instalar (una sola vez, en Windows)
Doble clic en **INSTALAR.bat**. Si no tienes Python, lo instala; ciérralo y ábrelo otra vez para terminar (instala Playwright y Chromium).

## Usar
1. En inventario-cedhra › **Corrección SIGES** › **⬇ Exportar**. Descarga el Excel, ponlo en esta carpeta y nómbralo `Correccion.xlsx`.
2. **Diagnóstico** (no guarda nada, usa el 1.er bien):  **DIAGNOSTICO.bat**
3. **Prueba corta** (5 bienes, sí guarda):  **PRUEBA_5.bat**
4. **Corrida completa**:  **CORRER_TODO.bat**
   - Se abre Chrome con un perfil propio (`perfil_siges`): inicia sesión, entra a Cargo de Bienes y pulsa ENTER en la terminal.
   - Teclas: **P** pausar · **C** continuar · **Q** detener seguro. Si SIGES cierra la sesión, suena una alerta: vuelve a entrar y pulsa C.
   - Si se corta, vuelve a ejecutar el mismo comando: retoma donde quedó (usa `Correccion_diario.csv`).
5. Al terminar, el Excel trae Estado/Detalle por bien y la hoja **Resumen**. Cárgalo en inventario-cedhra › Corrección SIGES › **⬆ Cargar resultado**.

## Estados
- **EXITOSO**: guardado y verificado. **SIN CAMBIO**: ya estaba correcto.
- **REVISAR**: SIGES no tenía lo esperado (alguien lo cambió, o el ID no corresponde). No se tocó.
- **FALLIDO**: SIGES rechazó el guardado o faltó un campo. **NO ENCONTRADO**: la búsqueda no dio exactamente 1 resultado.

`--mapear` solo consigue los ID de SIGES (sin editar); las corridas siguientes van directo a cada bien.
No subas a GitHub el Excel, el diario ni la carpeta `perfil_siges` (contienen datos y tu sesión).
