# Sales Cycle Frontend

A modern Angular application that models an end-to-end commercial cycle:
**Sales Order → Delivery → Invoice → Payment**.

It is a frontend-only technical project with local persistence, warehouse-aware
inventory, multi-currency payments, and business safeguards inspired by an
ERP workflow.

## Highlights

- **Angular 22** with standalone components and lazy routes.
- **Pragmatic Feature-Sliced Design (FSD)** for application, shared, feature,
  widget, page, and entity boundaries.
- **Tailwind CSS v4** shared design tokens and reusable UI primitives.
- **Local transactional safeguards** for the browser demo.
- **USD, VES, and EUR** payment support with dated exchange-rate snapshots.
- **Prettier and Angular ESLint** checks for readable templates and code.

> [!NOTE]
> Data is persisted in the browser through `localStorage`. Browser locks protect
> same-origin tabs only. A future Supabase backend should own cross-device
> transactions and audit guarantees.

## Quick Start

### Prerequisites

- Node.js compatible with Angular 22.
- npm 11 or later.

### Install and Run

```bash
git clone <repository-url>
cd sistema-facturacion
npm install
npm start
```

Open [http://localhost:4200](http://localhost:4200) in your browser.

## Commands

| Command                     | Purpose                                           |
| --------------------------- | ------------------------------------------------- |
| `npm start`                 | Start the Angular development server.             |
| `npm run build`             | Create a production build in `dist/`.             |
| `npm test -- --watch=false` | Run the unit test suite once.                     |
| `npm run lint`              | Run Angular ESLint checks.                        |
| `npm run format`            | Apply Prettier to Angular HTML templates.         |
| `npm run format:check`      | Check template formatting without changing files. |

## Code Quality Workflow

The repository uses Prettier with an Angular HTML parser and an 80-character
readability target. Angular ESLint enforces the project's linting rules.

Before committing, run:

```bash
npm run format
npm run format:check
npm run lint
npm test -- --watch=false
npm run build
```

Prettier's `printWidth` guides line wrapping. ESLint catches remaining
readability and correctness issues. Long Tailwind class values are treated as
intentional template data and remain readable through multiline markup.

## The Four Deliverables

| View             | Main outcome                                                                               | Important safeguards                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| **Sales Orders** | Create customer orders with products, prices, date, currency, VAT, and totals.             | Confirmed orders are immutable; cancellation is blocked after validated delivery or committed invoice. |
| **Deliveries**   | Ship order lines from a selected warehouse and create backorders for unshipped quantities. | Warehouse stock cannot go negative; validated quantities cannot exceed their source order line.        |
| **Invoices**     | Invoice validated, uninvoiced delivery lines and publish a numbered fiscal snapshot.       | VAT totals, delivery provenance, VES equivalent, and publication data are immutable.                   |
| **Payments**     | Register dated, mixed-currency payments from a payable invoice.                            | Rate snapshots, overpayment protection, payment history, and reversal-aware balances.                  |

## Business Flow

1. **Create a Sales Order** with a customer, date, currency, products,
   quantities, and editable unit prices.
2. **Confirm the order** to create its initial pending delivery.
3. **Validate a Delivery** from an outgoing warehouse. A partial shipment
   creates a linked pending backorder for the remaining quantities.
4. **Create an Invoice** only from validated delivery quantities that have not
   been invoiced.
5. **Publish the Invoice** to assign its sequential number, issue snapshot, and
   VES equivalent.
6. **Register Payments** from the published or partially paid invoice. Payments
   may use USD, VES, or EUR.
7. **Complete the order** only after every line is delivered, invoiced, and all
   related invoices are paid.

## Core Business Rules

- A delivery cannot exceed its pending order quantity or selected warehouse
  stock.
- Invoice quantities cannot exceed validated delivery quantities.
- Confirmed payments, converted to the invoice currency, cannot exceed the
  invoice total by more than `0.01`.
- Payment conversion is rounded to two decimals:

  ```text
  invoice amount = paid amount × invoice-currency rate ÷ payment-currency rate
  ```

- Confirmed, validated, and published document content is immutable. Financial
  reversals use cancellation or void transitions instead of destructive edits.
- Sequential `SO`, `DES`, `FAC`, and `PAG` references are allocated from durable
  local counters.

## Project Structure

```text
src/app/
├── app/        # Bootstrap, routing, and application shell
├── entities/   # Transactional sales, inventory, and exchange-rate models
├── features/   # Focused user actions (create, confirm, publish, void)
├── pages/      # Route composition layers
├── shared/     # Tailwind tokens, UI primitives, and utilities
└── widgets/    # View-specific workspaces and compositions
```

`LocalSalesCycleStore` is the current transactional boundary. It uses revisioned
state, durable counters, line provenance, `navigator.locks` where available,
and cross-tab refresh notifications. This is intentionally a local demo seam
for a later Supabase implementation.

## Verification Status

The project currently verifies:

- Prettier template formatting.
- Angular ESLint rules.
- Unit tests for sales, delivery, invoice, payment, FX, and invariant behavior.
- Production build generation.

## Scope

Included: the four commercial views and their connected workflow.

Not included: authentication, backend APIs, tax administration, reporting,
customer management, warehouse management screens, or cross-device concurrency.
