# Sistema de Facturación

Aplicación Angular moderna que modela un ciclo comercial completo:
**Orden de venta → Despacho → Factura → Pago**.

Es un proyecto técnico frontend con persistencia local, inventario por almacén,
pagos multimoneda y reglas de negocio inspiradas en un flujo ERP.

## Aspectos destacados

- **Angular 22** con componentes standalone y rutas perezosas.
- **Feature-Sliced Design (FSD)** pragmática para las capas de aplicación,
  compartidos, funcionalidades, widgets, páginas y entidades.
- **Tailwind CSS v4** con tokens de diseño compartidos y primitivas de UI.
- Salvaguardas transaccionales locales para la demostración en el navegador.
- Pagos en **USD, VES y EUR** con instantáneas de tasas por fecha.
- Validaciones de **Prettier y Angular ESLint** para templates y código legibles.

> [!NOTE]
> Los datos se persisten en el navegador mediante `localStorage`. Los bloqueos del
> navegador protegen únicamente las pestañas del mismo origen. Un backend futuro
> con Supabase deberá gestionar las transacciones y auditoría entre dispositivos.

## Inicio rápido

### Requisitos previos

- Node.js compatible con Angular 22.
- npm 11 o posterior.

### Instalación y ejecución

```bash
git clone <repository-url>
cd sistema-facturacion
npm install
npm start
```

Abre [http://localhost:4200](http://localhost:4200) en el navegador.

## Comandos

| Comando                     | Propósito                                        |
| --------------------------- | ------------------------------------------------ |
| `npm start`                 | Inicia el servidor de desarrollo de Angular.     |
| `npm run build`             | Genera una compilación de producción en `dist/`. |
| `npm test -- --watch=false` | Ejecuta la suite de pruebas unitarias una vez.   |
| `npm run lint`              | Ejecuta las validaciones de Angular ESLint.      |
| `npm run format`            | Aplica Prettier a los templates HTML de Angular. |
| `npm run format:check`      | Revisa el formato sin modificar archivos.        |

## Flujo de calidad del código

El repositorio usa Prettier con el parser HTML de Angular y una meta de lectura
de 80 caracteres. Angular ESLint aplica las reglas de linting del proyecto.

Antes de hacer un commit, ejecuta:

```bash
npm run format
npm run format:check
npm run lint
npm test -- --watch=false
npm run build
```

`printWidth` de Prettier guía el salto de línea. ESLint detecta los problemas
restantes de lectura y corrección. Los valores largos de clases Tailwind se
mantienen como datos intencionales del template y se muestran en varias líneas.

## Los cuatro entregables

| Vista                | Resultado principal                                                             | Salvaguardas importantes                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Órdenes de venta** | Crea órdenes de clientes con productos, precios, fecha, moneda, IVA y totales.  | Las órdenes confirmadas son inmutables; no se pueden cancelar después de un despacho validado o una factura comprometida. |
| **Despachos**        | Despacha líneas desde un almacén y crea backorders para cantidades pendientes.  | El stock no puede ser negativo; las cantidades validadas no superan la línea de origen.                                   |
| **Facturas**         | Factura líneas de despacho validadas y publica una instantánea fiscal numerada. | Totales con IVA, procedencia del despacho, equivalente en VES y datos de publicación inmutables.                          |
| **Pagos**            | Registra pagos multimoneda y fechados desde una factura cobrable.               | Instantáneas de tasa, protección contra sobrepagos, historial y saldos conscientes de anulaciones.                        |

## Flujo de negocio

1. **Crea una orden de venta** con cliente, fecha, moneda, productos,
   cantidades y precios unitarios editables.
2. **Confirma la orden** para crear su primer despacho pendiente.
3. **Valida un despacho** desde un almacén de salida. Un despacho parcial crea
   un backorder pendiente enlazado con las cantidades restantes.
4. **Crea una factura** solo con cantidades validadas que aún no se hayan
   facturado.
5. **Publica la factura** para asignar su número correlativo, instantánea de
   emisión y equivalente en VES.
6. **Registra pagos** desde la factura publicada o parcialmente pagada. Los
   pagos pueden usar USD, VES o EUR.
7. **Completa la orden** solo después de despachar y facturar todas sus líneas,
   y de pagar todas las facturas relacionadas.

## Reglas de negocio principales

- Un despacho no puede superar la cantidad pendiente ni el stock del almacén
  seleccionado.
- Las cantidades facturadas no pueden superar las cantidades validadas.
- Los pagos confirmados, convertidos a la moneda de la factura, no pueden
  superar el total de la factura por más de `0.01`.
- La conversión de pago se redondea a dos decimales:

  ```text
  monto en moneda de factura = monto pagado × tasa de la moneda de factura ÷ tasa de la moneda del pago
  ```

- El contenido de documentos confirmados, validados y publicados es inmutable.
  Las reversiones financieras usan transiciones de cancelación o anulación, no
  ediciones destructivas.
- Las referencias correlativas `SO`, `DES`, `FAC` y `PAG` provienen de contadores
  locales durables.

## Estructura del proyecto

```text
src/app/
├── app/        # Bootstrap, enrutamiento y shell de la aplicación
├── entities/   # Modelos transaccionales de ventas, inventario y tasas
├── features/   # Acciones de usuario enfocadas (crear, confirmar, publicar, anular)
├── pages/      # Capas de composición de rutas
├── shared/     # Tokens Tailwind, primitivas de UI y utilidades
└── widgets/    # Espacios de trabajo y composiciones por vista
```

`LocalSalesCycleStore` es el límite transaccional actual. Usa estado con
revisión, contadores durables, procedencia de líneas, `navigator.locks` cuando
está disponible y notificaciones de actualización entre pestañas. Es un punto
de integración local pensado para una implementación futura con Supabase.

## Estado de verificación

El proyecto verifica actualmente:

- Formato de templates con Prettier.
- Reglas de Angular ESLint.
- Pruebas unitarias de ventas, despachos, facturas, pagos, tasas e invariantes.
- Generación de la compilación de producción.

## Alcance

Incluye: las cuatro vistas comerciales y su flujo conectado.

No incluye: autenticación, APIs backend, administración de impuestos, reportes,
gestión de clientes, pantallas de gestión de almacenes o concurrencia entre
dispositivos.
