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

## Work Plan
- [x] SC-01 — Create the FSD shell, navigation, typed domain models, local persistence, seeded inventory, and FX history. Route: delegated; trigger: preparation and multi-file implementation. Checks: `npm test` passed (1 file, 2 tests); `npm run build` passed (initial bundle: 230.53 kB; four lazy page chunks). Files: `src/app/app.{ts,html,css}`, `src/app/app.routes.ts`, `src/app/app.spec.ts`, `src/styles.css`, `src/app/entities/**`, `src/app/pages/**`. Commit: `43cde69f40b61dbad856db8ce0931e541c6cafbe`.
- [x] SC-02 — Implemented the sales-orders view and confirmation flow that creates one pending linked delivery. Checks: `npm test` passed (2 files, 4 tests); `npm run build` passed (initial bundle: 252.52 kB; sales-orders lazy chunk: 50.03 kB). Files: `src/app/pages/sales-orders/sales-orders.page.ts`, `src/app/entities/sales/api/local-sales-cycle-store.service.ts`, `src/app/entities/sales/api/local-sales-cycle-store.service.spec.ts`, `src/app/entities/sales/model/sales.models.ts`, `src/app/entities/inventory/model/inventory.models.ts`. Commit: `feat(sales-cycle): implement sales orders`.
- [x] SC-03 — Implemented the deliveries list/detail view, source-order links, pending quantities, validation/cancellation transitions, and idempotent warehouse stock deduction. Checks: `npm test` passed (2 files, 6 tests); `npm run build` passed (initial bundle: 252.65 kB; deliveries lazy chunk: 6.72 kB). Files: `src/app/pages/deliveries/deliveries.page.ts`, `src/app/entities/sales/api/local-sales-cycle-store.service.ts`, `src/app/entities/sales/api/local-sales-cycle-store.service.spec.ts`. Commit: `feat(sales-cycle): implement deliveries`.
- [ ] SC-04 — Implement invoices from delivered quantities, document links, and invoice status transitions. Route: delegated; trigger: multi-file implementation. Checks: `npm test`, `npm run build`. Evidence: pending.
- [ ] SC-05 — Implement multi-currency payments, confirmation/voiding, frozen FX rates, and paid/partial settlement. Route: delegated; trigger: multi-file implementation. Checks: `npm test`, `npm run build`. Evidence: pending.

## Progress and Next Step
SC-01 through SC-03 completed on branch `feature/sales-cycle`. Receipt-driven development is disabled for this clone by user authorization after the native review flow rejected its negotiated continuation; delivery remains unmanaged under ordinary repository policy. Next: implement SC-04, invoices from delivered quantities.
