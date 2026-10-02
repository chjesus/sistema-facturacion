import { Component, computed, inject, signal } from '@angular/core';
import { LocalSalesCycleStore } from '../../entities/sales/api/local-sales-cycle-store.service';
import { Invoice, InvoiceId, InvoiceStatus, SalesOrderId } from '../../entities/sales/model/sales.models';
import { CreateInvoiceComponent } from '../../features/create-invoice/create-invoice.component';
import { PublishInvoiceComponent } from '../../features/publish-invoice/publish-invoice.component';
import { RegisterInvoicePaymentComponent } from '../../features/register-invoice-payment/register-invoice-payment.component';
import { VoidInvoiceComponent } from '../../features/void-invoice/void-invoice.component';
import { PanelComponent } from '../../shared/ui/panel.component';
import { StatusBadgeComponent, StatusTone } from '../../shared/ui/status-badge.component';

const statusTones: Record<InvoiceStatus, StatusTone> = {
  draft: 'warning',
  published: 'info',
  partial: 'info',
  paid: 'success',
  voided: 'danger',
};

@Component({
  selector: 'app-invoice-workspace',
  imports: [CreateInvoiceComponent, PanelComponent, PublishInvoiceComponent, RegisterInvoicePaymentComponent, StatusBadgeComponent, VoidInvoiceComponent],
  template: `
    <section class="mt-10 grid gap-5 min-[761px]:grid-cols-[minmax(260px,.85fr)_minmax(0,1.15fr)]">
      <section class="grid gap-3" aria-label="Invoice list">
        @for (order of invoiceableOrders(); track order.id) {
          <app-panel>
            <strong>{{ order.reference }}</strong>
            <p class="mt-2 leading-relaxed text-muted">{{ order.customerName }} · {{ pendingQuantity(order.id) }} units ready to invoice</p>
            <div class="mt-4"><app-create-invoice [orderId]="order.id" (invoiceCreated)="selectInvoice($event)" /></div>
          </app-panel>
        }
        @for (invoice of store.invoices(); track invoice.id) {
          <button type="button" class="w-full cursor-pointer rounded-panel border border-border bg-surface p-5 text-left" [class.border-accent]="invoice.id === selectedInvoiceId()" [class.shadow-[0_0_0_3px_#eef2ff]]="invoice.id === selectedInvoiceId()" (click)="selectInvoice(invoice.id)">
            <span class="flex items-center justify-between gap-3"><span><span class="text-xs font-extrabold tracking-[.06em] text-ink">{{ invoice.number ?? invoice.reference }}</span><span class="mt-1 block text-lg font-bold tracking-[-.03em] text-ink">{{ invoice.orderReference }}</span></span><app-status-badge [label]="invoice.status" [tone]="statusTone(invoice.status)" /></span>
            <span class="mt-3 flex justify-between gap-3 text-sm text-muted"><span>{{ money(totals(invoice).total, invoice.currency) }}</span><span>{{ invoice.deliveryReferences.length }} delivery source{{ invoice.deliveryReferences.length === 1 ? '' : 's' }}</span></span>
          </button>
        } @empty {
          <app-panel><h2 class="mb-4 text-xl font-bold tracking-[-.03em] text-ink">No invoices yet</h2><p class="leading-relaxed text-muted">Validate a delivery to make its sales order ready for invoicing.</p></app-panel>
        }
      </section>
      @if (selectedInvoice(); as invoice) {
        <app-panel label="Invoice detail">
          <div class="flex items-center justify-between gap-3"><div><div class="text-xs font-extrabold tracking-[.06em] text-ink">{{ invoice.number ?? invoice.reference }}</div><h2 class="mt-1 text-xl font-bold tracking-[-.03em] text-ink">Invoice detail</h2></div><app-status-badge [label]="invoice.status" [tone]="statusTone(invoice.status)" /></div>
          <div class="my-5 rounded-lg bg-surface-muted p-4"><strong class="mb-1 block">Source sales order · {{ invoice.orderReference }}</strong><span class="text-muted">Deliveries · {{ invoice.deliveryReferences.join(', ') }}</span></div>
          <div class="grid border-t border-border">@for (line of invoice.lines; track line.deliveryId + '-' + line.deliveryLineIndex) { <div class="flex items-start justify-between gap-3 border-b border-border py-3"><span><strong>{{ line.description }}</strong><small class="mt-1 block text-muted">{{ line.deliveryReference }} · {{ line.quantity }} × {{ money(line.unitPrice, invoice.currency) }} · VAT {{ line.vatRate * 100 }}%</small></span><span>{{ money(line.subtotal, invoice.currency) }}</span></div> }</div>
          <div class="mt-3 flex items-center justify-between gap-3"><span>Subtotal</span><span>{{ money(totals(invoice).subtotal, invoice.currency) }}</span></div>
          <div class="mt-3 flex items-center justify-between gap-3"><span>VAT (16%)</span><span>{{ money(totals(invoice).vat, invoice.currency) }}</span></div>
          <div class="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3 text-[1.1rem] font-bold"><span>Total</span><span>{{ money(totals(invoice).total, invoice.currency) }}</span></div>
          <div class="my-5 rounded-lg bg-surface-muted p-4">@if (invoice.issueDate) { <strong class="mb-1 block">Issued {{ invoice.issueDate }} · {{ invoice.issuedCurrency }}</strong><span class="text-muted">VES FX {{ invoice.vesFxRate }} on {{ invoice.vesFxDate }} · VES equivalent {{ money(invoice.vesEquivalentTotal ?? 0, 'VES') }}</span> } @else { <span class="text-muted">Publication assigns the invoice number, issue date, and frozen VES FX snapshot.</span> }<br /><span class="text-muted">Paid {{ money(store.invoiceSettledTotal(invoice.id), invoice.currency) }} · Pending {{ money(store.invoiceBalance(invoice), invoice.currency) }}</span></div>
          @if (invoice.status === 'draft') {
            <div class="flex flex-wrap items-stretch gap-3"><app-publish-invoice class="flex-1 basis-48" [invoiceId]="invoice.id" /><app-void-invoice [invoiceId]="invoice.id" /></div>
          } @else if (invoice.status === 'published') {
            <div class="flex flex-wrap items-stretch gap-3"><app-register-invoice-payment class="flex-1 basis-48" [invoice]="invoice" /><app-void-invoice [invoiceId]="invoice.id" /></div>
          } @else if (invoice.status === 'partial' && store.invoiceBalance(invoice) > 0) {
            <div class="flex flex-wrap items-stretch gap-3"><app-register-invoice-payment class="flex-1 basis-48" [invoice]="invoice" /><app-void-invoice [invoiceId]="invoice.id" /></div>
          }
        </app-panel>
      } @else {
        <app-panel><h2 class="mb-4 text-xl font-bold tracking-[-.03em] text-ink">Select an invoice</h2><p class="leading-relaxed text-muted">Create or select an invoice to review its sources and total.</p></app-panel>
      }
    </section>
  `,
})
export class InvoiceWorkspaceComponent {
  protected readonly store = inject(LocalSalesCycleStore);
  protected readonly selectedInvoiceId = signal<InvoiceId | undefined>(this.store.invoices()[0]?.id);
  protected readonly selectedInvoice = computed(() => this.store.invoices().find((invoice) => invoice.id === this.selectedInvoiceId()));
  protected readonly invoiceableOrders = computed(() => this.store.salesOrders().filter((order) => this.store.invoiceEligibility(order.id) !== undefined));

  protected selectInvoice(invoiceId: InvoiceId): void { this.selectedInvoiceId.set(invoiceId); }
  protected pendingQuantity(orderId: SalesOrderId): number { return this.store.invoiceEligibility(orderId)?.lines.reduce((total, line) => total + line.quantity, 0) ?? 0; }
  protected totals(invoice: Invoice) { return this.store.invoiceTotals(invoice); }
  protected statusTone(status: InvoiceStatus): StatusTone { return statusTones[status]; }
  protected money(amount: number, currency: Invoice['currency']): string { return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount); }
}
