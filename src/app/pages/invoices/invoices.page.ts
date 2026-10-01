import { Component, computed, inject, signal } from '@angular/core';
import { LocalSalesCycleStore } from '../../entities/sales/api/local-sales-cycle-store.service';
import { Invoice, InvoiceId, SalesOrderId } from '../../entities/sales/model/sales.models';

const pageStyles = `
  .page-header { max-width: 620px; } .eyebrow { color: var(--accent); font-size: .75rem; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; } h1 { font-size: clamp(2.2rem, 6vw, 4rem); letter-spacing: -.06em; line-height: 1; margin: .5rem 0 1rem; } .page-header > p:last-child, .empty p, .note { color: var(--muted); line-height: 1.6; } .workspace { display: grid; gap: 1.25rem; grid-template-columns: minmax(260px, .85fr) minmax(0, 1.15fr); margin-top: 2.5rem; } .invoices, .detail { display: grid; gap: .75rem; } .invoice, .detail-card, .empty { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 1.25rem; } .invoice { cursor: pointer; text-align: left; width: 100%; } .invoice.selected { border-color: var(--accent); box-shadow: 0 0 0 3px #eef2ff; } .invoice-top, .invoice-meta, .detail-header, .line, .actions, .total { align-items: center; display: flex; gap: .7rem; justify-content: space-between; } .invoice-meta { color: var(--muted); font-size: .85rem; margin-top: .75rem; } .reference { font-size: .8rem; font-weight: 800; letter-spacing: .06em; } h2, h3 { letter-spacing: -.03em; margin: 0; } .status { border-radius: 999px; font-size: .75rem; font-weight: 800; padding: .35rem .65rem; text-transform: capitalize; } .draft { background: #fff7e6; color: #9a6700; } .published, .partial { background: #eef2ff; color: #4338ca; } .paid { background: #e8f5ed; color: #1a7f37; } .voided { background: #fef3f2; color: #b42318; } .source { background: var(--surface-muted); border-radius: 10px; margin: 1.25rem 0; padding: 1rem; } .source strong { display: block; margin-bottom: .35rem; } .links { color: var(--accent); font-size: .9rem; font-weight: 700; margin: .25rem 0 0; } .line-list { border-top: 1px solid var(--border); display: grid; margin-top: 1rem; } .line { border-bottom: 1px solid var(--border); padding: .9rem 0; } .quantity { color: var(--muted); font-size: .9rem; } .total { font-size: 1.05rem; font-weight: 800; margin-top: 1rem; } .actions { justify-content: flex-start; margin-top: 1.25rem; } button { background: var(--accent); border: 0; border-radius: 8px; color: #fff; cursor: pointer; font: inherit; font-weight: 750; padding: .7rem .9rem; } button.secondary { background: var(--surface-muted); color: var(--ink); } button.danger { color: #b42318; } .eligible { background: var(--surface); border: 1px dashed var(--border); border-radius: 12px; padding: 1rem; } .eligible + .eligible { margin-top: .75rem; } @media (max-width: 760px) { .workspace { grid-template-columns: 1fr; } }
`;

@Component({
  selector: 'app-invoices-page',
  template: `
    <section class="page-header"><p class="eyebrow">Billing workspace</p><h1>Invoices</h1><p>Invoice only validated deliveries and preserve every source reference.</p></section>
    <section class="workspace">
      <section class="invoices" aria-label="Invoice list">
        @for (order of invoiceableOrders(); track order.id) { <article class="eligible"><strong>{{ order.reference }}</strong><p class="note">{{ order.customerName }} · {{ pendingQuantity(order.id) }} units ready to invoice</p><button type="button" (click)="createInvoice(order.id)">Create invoice</button></article> }
        @for (invoice of store.invoices(); track invoice.id) { <button type="button" class="invoice" [class.selected]="invoice.id === selectedInvoiceId()" (click)="selectInvoice(invoice.id)"><span class="invoice-top"><span><span class="reference">{{ invoice.reference }}</span><h3>{{ invoice.orderReference }}</h3></span><span class="status" [class]="invoice.status">{{ invoice.status }}</span></span><span class="invoice-meta"><span>{{ invoice.currency }} {{ total(invoice) }}</span><span>{{ invoice.deliveryReferences.length }} delivery source{{ invoice.deliveryReferences.length === 1 ? '' : 's' }}</span></span></button> } @empty { <div class="empty"><h2>No invoices yet</h2><p>Validate a delivery to make its sales order ready for invoicing.</p></div> }
      </section>
      @if (selectedInvoice(); as invoice) { <section class="detail-card" aria-label="Invoice detail"><div class="detail-header"><div><div class="reference">{{ invoice.reference }}</div><h2>Invoice detail</h2></div><span class="status" [class]="invoice.status">{{ invoice.status }}</span></div><div class="source"><strong>Source sales order · {{ invoice.orderReference }}</strong><p class="links">Deliveries · {{ invoice.deliveryReferences.join(', ') }}</p></div><div class="line-list">@for (line of invoice.lines; track line.productId) { <div class="line"><span>{{ line.description }}</span><span class="quantity">{{ line.quantity }} × {{ money(line.unitPrice, invoice.currency) }}</span></div> }</div><div class="total"><span>Total</span><span>{{ money(total(invoice), invoice.currency) }}</span></div>@if (invoice.status === 'draft') { <div class="actions"><button type="button" (click)="publishInvoice(invoice.id)">Publish invoice</button><button type="button" class="secondary danger" (click)="voidInvoice(invoice.id)">Void invoice</button></div> } @else if (invoice.status === 'published') { <div class="actions"><button type="button" class="secondary danger" (click)="voidInvoice(invoice.id)">Void invoice</button></div> } @if (invoice.status === 'published' || invoice.status === 'partial') { <p class="note">Payment settlement will update this invoice to Partial or Paid.</p> }</section> } @else { <section class="empty"><h2>Select an invoice</h2><p>Create or select an invoice to review its sources and total.</p></section> }
    </section>
  `,
  styles: [pageStyles],
})
export class InvoicesPage {
  protected readonly store = inject(LocalSalesCycleStore);
  protected readonly selectedInvoiceId = signal<InvoiceId | undefined>(this.store.invoices()[0]?.id);
  protected readonly selectedInvoice = computed(() => this.store.invoices().find((invoice) => invoice.id === this.selectedInvoiceId()));
  protected readonly invoiceableOrders = computed(() =>
    this.store.salesOrders().filter((order) => this.store.invoiceEligibility(order.id) !== undefined),
  );

  protected selectInvoice(invoiceId: InvoiceId): void { this.selectedInvoiceId.set(invoiceId); }
  protected createInvoice(orderId: SalesOrderId): void { const invoice = this.store.createInvoiceFromOrder(orderId); if (invoice) this.selectedInvoiceId.set(invoice.id); }
  protected publishInvoice(invoiceId: InvoiceId): void { this.store.publishInvoice(invoiceId); }
  protected voidInvoice(invoiceId: InvoiceId): void { this.store.voidInvoice(invoiceId); }
  protected pendingQuantity(orderId: SalesOrderId): number { return this.store.invoiceEligibility(orderId)?.lines.reduce((total, line) => total + line.quantity, 0) ?? 0; }
  protected total(invoice: Invoice): number { return invoice.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0); }
  protected money(amount: number, currency: Invoice['currency']): string { return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount); }
}
