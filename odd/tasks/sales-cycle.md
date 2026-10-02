# Sales Cycle Frontend

## Objective
Build a modern, minimal Angular frontend that models the complete sales cycle: sales order, warehouse delivery, invoice, and multi-currency payment.

## Problem and Why
The base project is an uncustomized Angular starter. Users need four connected views where every downstream document originates from its predecessor and each transition is visible and enforceable.

## Authorized Scope
- Replace the Angular starter UI.
- Add only the four requested views: sales orders, deliveries, invoices, and payments.
- Use simulated data persisted locally in the browser.
- Support USD, VES, and EUR using a seeded seven-day exchange-rate history.
- Freeze the selected conversion rate when a payment is confirmed.
- Do not create backend, authentication, inventory-management, customer-management, tax, or reporting screens.

## Architecture and Constraints
- Use pragmatic FSD folders with Angular standalone components and lazy page routes.
- Keep document state and transitions in typed entity services; avoid a global store unless needed.
- Every delivery, invoice, and payment must retain its origin reference.
- TDD mode: off (no explicit project/session configuration). Run ordinary functional checks using `npm test` and `npm run build`.
- Delivery strategy: ask-on-risk. Target one coherent work-unit commit per task.

## Acceptance Criteria
- Sales orders are created in draft, confirmed, completed, or cancelled; confirmation creates a pending delivery.
- Deliveries originate from an order, can be validated or cancelled, and validation reduces warehouse stock.
- Invoices originate from an order only for delivered, uninvoiced quantities and can become draft, published, partial, paid, or voided.
- Payments originate from an invoice, support USD/VES/EUR, and are confirmed or voided.
- Confirmed payments use and persist the latest seeded rate from the last seven days; paid value updates the invoice status.
- The four views are responsive, modern, minimal, and linked through their document references.
- Sales orders collect customer, order date, currency, products, quantities, suggested/editable unit prices, and calculate subtotal, 16% VAT, and total.
- Confirmed sales orders are immutable; their line-level ordered, delivered, and invoiced quantities are visible.
- Sales-order cancellation is denied after a validated delivery or a published invoice; its Create Invoice action is enabled only for uninvoiced delivered quantities.
- Deliveries show their source order, customer, outgoing warehouse, warehouse-scoped product stock, and support partial fulfillment with a linked pending backorder.

## Work Plan
- [x] SC-01 — Create the FSD shell, navigation, typed domain models, local persistence, seeded inventory, and FX history. Route: delegated; trigger: preparation and multi-file implementation. Checks: `npm test` passed (1 file, 2 tests); `npm run build` passed (initial bundle: 230.53 kB; four lazy page chunks). Files: `src/app/app.{ts,html,css}`, `src/app/app.routes.ts`, `src/app/app.spec.ts`, `src/styles.css`, `src/app/entities/**`, `src/app/pages/**`. Commit: `43cde69f40b61dbad856db8ce0931e541c6cafbe`.
- [x] SC-02 — Implemented the sales-orders view and confirmation flow that creates one pending linked delivery. Checks: `npm test` passed (2 files, 4 tests); `npm run build` passed (initial bundle: 252.52 kB; sales-orders lazy chunk: 50.03 kB). Files: `src/app/pages/sales-orders/sales-orders.page.ts`, `src/app/entities/sales/api/local-sales-cycle-store.service.ts`, `src/app/entities/sales/api/local-sales-cycle-store.service.spec.ts`, `src/app/entities/sales/model/sales.models.ts`, `src/app/entities/inventory/model/inventory.models.ts`. Commit: `feat(sales-cycle): implement sales orders`.
- [x] SC-03 — Implemented the deliveries list/detail view, source-order links, pending quantities, validation/cancellation transitions, and idempotent warehouse stock deduction. Checks: `npm test` passed (2 files, 6 tests); `npm run build` passed (initial bundle: 252.65 kB; deliveries lazy chunk: 6.72 kB). Files: `src/app/pages/deliveries/deliveries.page.ts`, `src/app/entities/sales/api/local-sales-cycle-store.service.ts`, `src/app/entities/sales/api/local-sales-cycle-store.service.spec.ts`. Commit: `feat(sales-cycle): implement deliveries`.
- [x] SC-04 — Implemented invoice eligibility from validated, uninvoiced delivery quantities; preserved order and delivery references; prevented duplicate invoices; and added Draft → Published → Partial/Paid and Void transitions. The settlement state is now updated by SC-05 payments. Checks: `npm test` passed (2 files, 10 tests); `npm run build` passed (initial bundle: 252.65 kB; invoices lazy chunk: 8.36 kB). Files: `src/app/pages/invoices/invoices.page.ts`, `src/app/entities/sales/api/local-sales-cycle-store.service.ts`, `src/app/entities/sales/api/local-sales-cycle-store.service.spec.ts`, `src/app/entities/sales/model/sales.models.ts`. Commit: `feat(sales-cycle): implement invoices`.
- [x] SC-05 — Implemented locally persisted multi-currency payment drafts for published/partial invoices, USD/VES/EUR conversion from the latest seven-day local rate, immutable rate/date snapshots at confirmation, overpayment prevention, and confirmed-payment reversal on void. The payments workspace exposes source invoice, currencies, conversion, rate, rate date, and remaining balance. Added service coverage for partial/full settlement, conversion, frozen rates, overpayment, and voiding. Checks: `npm test` passed (2 files, 15 tests); `npm run build` passed (initial bundle: 252.85 kB; payments lazy chunk: 9.18 kB). Files: `src/app/pages/payments/payments.page.ts`, `src/app/entities/sales/api/local-sales-cycle-store.service.ts`, `src/app/entities/sales/api/local-sales-cycle-store.service.spec.ts`, `src/app/entities/sales/model/sales.models.ts`. Commit: `feat(sales-cycle): implement payments`.
- [x] SC-06 — Enhanced sales orders with editable order date, safe suggested-price fallback and overrides, rounded 16% VAT totals, immutable confirmation, line quantity projections, invoice CTA eligibility, and protected cancellation. Checks: `npm test -- --watch=false` passed (3 files, 21 tests); `npm run build` passed (initial bundle: 250.85 kB; sales-orders lazy chunk: 12.68 kB). Files: `src/app/entities/inventory/model/inventory.models.ts`, `src/app/entities/sales/model/sales.models.ts`, `src/app/entities/sales/api/local-sales-cycle-store.service.ts`, `src/app/entities/sales/api/local-sales-cycle-store.service.spec.ts`, `src/app/pages/sales-orders/sales-orders.page.ts`, `src/app/pages/sales-orders/sales-orders.page.spec.ts`, `odd/tasks/sales-cycle.md`. Commit: `feat(sales-cycle): enhance sales orders`.
- [x] SC-07 — Restored canonical suggested prices for known persisted fixtures only, persisted the migration, and made Create draft order line entry responsive with stable desktop columns and a mobile stack. Checks: `npm test -- --watch=false` passed (3 files, 22 tests); `npm run build` passed (initial bundle: 250.90 kB; sales-orders lazy chunk: 13.11 kB). Files: `src/app/entities/sales/api/local-sales-cycle-store.service.ts`, `src/app/entities/sales/api/local-sales-cycle-store.service.spec.ts`, `src/app/pages/sales-orders/sales-orders.page.ts`, `src/app/pages/sales-orders/sales-orders.page.spec.ts`, `odd/tasks/sales-cycle.md`. Commit: `fix(sales-cycle): restore fixture prices and draft layout`.
- [x] SC-08 — Added two simulated warehouses with warehouse-scoped stock, safe legacy global-stock migration, editable pending shipment quantities, atomic partial validation, linked pending backorders, and validated-delivery-only invoice eligibility. Checks: `npm test -- --watch=false` passed (3 files, 24 tests); `npm run build` passed (initial bundle: 250.90 kB; deliveries lazy chunk: 9.78 kB). Files: `src/app/entities/inventory/model/inventory.models.ts`, `src/app/entities/sales/model/sales.models.ts`, `src/app/entities/sales/api/local-sales-cycle-store.service.ts`, `src/app/entities/sales/api/local-sales-cycle-store.service.spec.ts`, `src/app/pages/deliveries/deliveries.page.ts`, `odd/tasks/sales-cycle.md`. Commit: `feat(sales-cycle): add warehouse-scoped delivery backorders`.

## Progress and Next Step
SC-01 through SC-08 are completed on branch `feature/delivery-backorders`. Deliveries now use warehouse-scoped stock and generate linked pending backorders for remaining quantities. Sales-order monetary values use a fixed 16% VAT rate. Engram mirror remains pending because multiple active runtime sessions prevent an unambiguous write. Receipt-driven development is disabled for this clone by user authorization after the native review flow rejected its negotiated continuation; delivery remains unmanaged under ordinary repository policy.
