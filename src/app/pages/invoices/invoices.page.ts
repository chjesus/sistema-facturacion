import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LocalSalesCycleStore } from '../../entities/sales/api/local-sales-cycle-store.service';
import { Invoice, InvoiceId, SalesOrderId } from '../../entities/sales/model/sales.models';

const pageStyles = `
  .page-header { max-width: 620px; } .eyebrow { color: var(--accent); font-size: .75rem; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; } h1 { font-size: clamp(2.2rem, 6vw, 4rem); letter-spacing: -.06em; line-height: 1; margin: .5rem 0 1rem; } p, .note, .meta { color: var(--muted); line-height: 1.6; } .workspace { display: grid; gap: 1.25rem; grid-template-columns: minmax(260px, .85fr) minmax(0, 1.15fr); margin-top: 2.5rem; } .invoices, .detail { display: grid; gap: .75rem; } .invoice, .detail-card, .empty, .eligible { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 1.25rem; } .invoice { cursor: pointer; text-align: left; width: 100%; } .invoice.selected { border-color: var(--accent); box-shadow: 0 0 0 3px #eef2ff; } .top, .meta-row, .line, .actions, .total { align-items: center; display: flex; gap: .7rem; justify-content: space-between; } .meta-row { color: var(--muted); font-size: .85rem; margin-top: .75rem; } .reference { font-size: .8rem; font-weight: 800; letter-spacing: .06em; } h2, h3 { letter-spacing: -.03em; margin: 0; } .status { border-radius: 999px; font-size: .75rem; font-weight: 800; padding: .35rem .65rem; text-transform: capitalize; } .draft { background: #fff7e6; color: #9a6700; } .published, .partial { background: #eef2ff; color: #4338ca; } .paid { background: #e8f5ed; color: #1a7f37; } .voided { background: #fef3f2; color: #b42318; } .source, .financials { background: var(--surface-muted); border-radius: 10px; margin: 1.25rem 0; padding: 1rem; } .source strong, .financials strong { display: block; margin-bottom: .35rem; } .line-list { border-top: 1px solid var(--border); display: grid; margin-top: 1rem; } .line { align-items: start; border-bottom: 1px solid var(--border); padding: .9rem 0; } .line small { color: var(--muted); display: block; margin-top: .2rem; } .total { font-size: 1rem; margin-top: .6rem; } .grand { border-top: 1px solid var(--border); font-size: 1.1rem; font-weight: 800; padding-top: .7rem; } .actions { flex-wrap: wrap; margin-top: 1.25rem; } .danger { color: #b42318; } @media (max-width: 760px) { .workspace { grid-template-columns: 1fr; } .line { display: grid; grid-template-columns: 1fr auto; } }
`;

@Component({
  selector: 'app-invoices-page',
  template: `
    <section class="page-header"><p class="eyebrow">Billing workspace</p><h1>Invoices</h1><p>Invoice validated delivery quantities with immutable publication and tax snapshots.</p></section>
    <section class="workspace">
      <section class="invoices" aria-label="Invoice list">
        @for (order of invoiceableOrders(); track order.id) { <article class="eligible"><strong>{{ order.reference }}</strong><p class="note">{{ order.customerName }} · {{ pendingQuantity(order.id) }} units ready to invoice</p><button type="button" (click)="createInvoice(order.id)">Create invoice</button></article> }
        @for (invoice of store.invoices(); track invoice.id) { <button type="button" class="invoice" [class.selected]="invoice.id === selectedInvoiceId()" (click)="selectInvoice(invoice.id)"><span class="top"><span><span class="reference">{{ invoice.number ?? invoice.reference }}</span><h3>{{ invoice.orderReference }}</h3></span><span class="status" [class]="invoice.status">{{ invoice.status }}</span></span><span class="meta-row"><span>{{ money(totals(invoice).total, invoice.currency) }}</span><span>{{ invoice.deliveryReferences.length }} delivery source{{ invoice.deliveryReferences.length === 1 ? '' : 's' }}</span></span></button> } @empty { <div class="empty"><h2>No invoices yet</h2><p>Validate a delivery to make its sales order ready for invoicing.</p></div> }
      </section>
      @if (selectedInvoice(); as invoice) { <section class="detail-card" aria-label="Invoice detail"><div class="top"><div><div class="reference">{{ invoice.number ?? invoice.reference }}</div><h2>Invoice detail</h2></div><span class="status" [class]="invoice.status">{{ invoice.status }}</span></div><div class="source"><strong>Source sales order · {{ invoice.orderReference }}</strong><span class="meta">Deliveries · {{ invoice.deliveryReferences.join(', ') }}</span></div><div class="line-list">@for (line of invoice.lines; track line.deliveryId + '-' + line.deliveryLineIndex) { <div class="line"><span><strong>{{ line.description }}</strong><small>{{ line.deliveryReference }} · {{ line.quantity }} × {{ money(line.unitPrice, invoice.currency) }} · VAT {{ line.vatRate * 100 }}%</small></span><span>{{ money(line.subtotal, invoice.currency) }}</span></div> }</div><div class="total"><span>Subtotal</span><span>{{ money(totals(invoice).subtotal, invoice.currency) }}</span></div><div class="total"><span>VAT (16%)</span><span>{{ money(totals(invoice).vat, invoice.currency) }}</span></div><div class="total grand"><span>Total</span><span>{{ money(totals(invoice).total, invoice.currency) }}</span></div><div class="financials">@if (invoice.issueDate) { <strong>Issued {{ invoice.issueDate }} · {{ invoice.issuedCurrency }}</strong><span class="meta">VES FX {{ invoice.vesFxRate }} on {{ invoice.vesFxDate }} · VES equivalent {{ money(invoice.vesEquivalentTotal ?? 0, 'VES') }}</span> } @else { <span class="meta">Publication assigns the invoice number, issue date, and frozen VES FX snapshot.</span> }<br /><span class="meta">Paid {{ money(store.invoiceSettledTotal(invoice.id), invoice.currency) }} · Pending {{ money(store.invoiceBalance(invoice), invoice.currency) }}</span></div>@if (invoice.status === 'draft') { <div class="actions"><button type="button" (click)="publishInvoice(invoice.id)">Publish invoice</button><button type="button" class="secondary danger" (click)="voidInvoice(invoice.id)">Void invoice</button></div> } @else if (invoice.status === 'published') { <div class="actions"><button type="button" (click)="registerPayment(invoice)" [disabled]="store.invoiceBalance(invoice) <= 0">Register payment</button><button type="button" class="secondary danger" (click)="voidInvoice(invoice.id)">Void invoice</button></div> } @else if (invoice.status === 'partial' && store.invoiceBalance(invoice) > 0) { <div class="actions"><button type="button" (click)="registerPayment(invoice)">Register payment</button><button type="button" class="secondary danger" (click)="voidInvoice(invoice.id)">Void invoice</button></div> }</section> } @else { <section class="empty"><h2>Select an invoice</h2><p>Create or select an invoice to review its sources and total.</p></section> }
    </section>
  `,
  styles: [pageStyles, `
    .eligible > button, .actions > button { background: var(--accent); border: 0; border-radius: 8px; box-shadow: 0 1px 2px rgb(79 70 229 / .25); color: #fff; cursor: pointer; font: inherit; font-weight: 750; padding: .72rem 1rem; }
    .actions > button.secondary { background: var(--surface); border: 1px solid var(--border); box-shadow: none; color: var(--ink); }
    .actions > button.danger { color: #b42318; }
    .eligible > button:hover, .actions > button:first-child:hover { background: #4338ca; }
    .actions { align-items: stretch; flex-wrap: wrap; }
    .actions > button:first-child { flex: 1 1 12rem; min-height: 2.8rem; }
    .actions > button:last-child { flex: 0 1 auto; }
  `],
})
export class InvoicesPage {
  protected readonly store = inject(LocalSalesCycleStore);
  private readonly router = inject(Router);
  protected readonly selectedInvoiceId = signal<InvoiceId | undefined>(this.store.invoices()[0]?.id);
  protected readonly selectedInvoice = computed(() => this.store.invoices().find((invoice) => invoice.id === this.selectedInvoiceId()));
  protected readonly invoiceableOrders = computed(() => this.store.salesOrders().filter((order) => this.store.invoiceEligibility(order.id) !== undefined));

  protected selectInvoice(invoiceId: InvoiceId): void { this.selectedInvoiceId.set(invoiceId); }
  protected createInvoice(orderId: SalesOrderId): void { const invoice = this.store.createInvoiceFromOrder(orderId); if (invoice) this.selectedInvoiceId.set(invoice.id); }
  protected publishInvoice(invoiceId: InvoiceId): void { this.store.publishInvoice(invoiceId); }
  protected voidInvoice(invoiceId: InvoiceId): void { this.store.voidInvoice(invoiceId); }
  protected registerPayment(invoice: Invoice): void { void this.router.navigate(['/payments'], { queryParams: { invoiceId: invoice.id } }); }
  protected pendingQuantity(orderId: SalesOrderId): number { return this.store.invoiceEligibility(orderId)?.lines.reduce((total, line) => total + line.quantity, 0) ?? 0; }
  protected totals(invoice: Invoice) { return this.store.invoiceTotals(invoice); }
  protected money(amount: number, currency: Invoice['currency']): string { return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount); }
}
