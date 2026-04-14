# Proyecto: WMS Celmedik
Sistema de gestión de bodega (WMS) para almacenamiento de
medicamentos a temperatura ambiente.

## Stack tecnológico
- HTML + JavaScript + Firebase (Firestore + Hosting + Auth)
- Desplegado en: celmedik-inventario.web.app
- Repositorio GitHub: github.com/jbasoal/Celmedik-WMS

## Módulos implementados
- Productos Maestro
- Stock Actual (con estados: Aprobado, Cuarentena, Rechazado,
  Falsificado, Vencido)
- Bodegas
- Movimientos (Entrada, Salida, Ajuste, Devolución) con
  múltiples productos por documento/factura
- Cuarentena y liberación de productos
- Retiro de Mercado
- Trazabilidad por Lote
- Dashboard Comercial con gráficos Chart.js
- Auditoría inmutable

## Normativa aplicable
- ISP Chile: NT 147 (BPA), NT 208, DS 3/2010
- FEFO obligatorio en salidas
- Registro sanitario ISP en todos los productos
- Trazabilidad completa por lote

## Reglas importantes
- Productos en Cuarentena: no pueden salir
- Productos Rechazados o Vencidos: solo salen por destrucción
  con acta en PDF
- Productos Falsificados: bloqueados para cualquier salida
- Cada movimiento genera PDF descargable
- Los cambios siempre terminan con:
  git add . && git commit -m "descripción" && git push && firebase deploy --only hosting
