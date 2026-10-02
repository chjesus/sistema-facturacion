import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LocalSalesCycleStore } from '../../entities/sales/api/local-sales-cycle-store.service';
import { CurrencyCode, Invoice, InvoiceId, Payment } from '../../entities/sales/model/sales.models';

const pageStyles = `
  .page-header { max-width: 620px; } .eyebrow { color: var(--accent); font-size: .75rem; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; } h1 { font-size: clamp(2.2rem, 6vw, 4rem); letter-spacing: -.06em; line-height: 1; margin: .5rem 0 1rem; } p, .meta { color: var(--muted); line-height: 1.6; } .workspace { display: grid; gap: 1.25rem; grid-template-columns: minmax(270px, .85fr) minmax(0, 1.15fr); margin-top: 2.5rem; } .panel, .payment, .empty { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 1.25rem; } .form, .payment-list { display: grid; gap: .85rem; } label { color: var(--muted); display: grid; font-size: .8rem; font-weight: 700; gap: .35rem; } select, input { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; color: inherit; font: inherit; padding: .7rem; } .payment { cursor: pointer; text-align: left; width: 100%; } .payment.selected { border-color: var(--accent); box-shadow: 0 0 0 3px #eef2ff; } .top, .actions, .row { align-items: center; display: flex; gap: .7rem; justify-content: space-between; } .reference { font-size: .8rem; font-weight: 800; letter-spacing: .06em; } .status { border-radius: 999px; font-size: .75rem; font-weight: 800; padding: .35rem .65rem; text-transform: capitalize; } .draft { background: #fff7e6; color: #9a6700; } .confirmed { background: #e8f5ed; color: #1a7f37; } .voided { background: #fef3f2; color: #b42318; } .detail { display: grid; gap: .9rem; } .fact { background: var(--surface-muted); border-radius: 10px; padding: .85rem 1rem; } .fact strong { display: block; margin-bottom: .25rem; } .danger { color: #b42318; } @media (max-width: 760px) { .workspace { grid-template-columns: 1fr; } }
`;

@Component({
  selector: 'app-payments-page',
  imports: [FormsModule],
  template: `
    <section class="page-header"><p class="eyebrow">Settlement workspace</p><h1>Payments</h1><p>Settle published invoices with locally recorded USD, VES, or EUR rates.</p></section>
    <section class="workspace"><section class="panel"><h2>New payment</h2><form class="form" (ngSubmit)="createPayment()"><label>Invoice<select name="invoice" [(ngModel)]="invoiceId"><option value="">Select a published invoice</option>@for (invoice of payableInvoices(); track invoice.id) { <option [value]="invoice.id">{{ invoice.reference }} · {{ money(store.invoiceBalance(invoice), invoice.currency) }} remaining</option> }</select></label><label>Payment currency<select name="currency" [(ngModel)]="currency"><option value="USD">USD</option><option value="VES">VES</option><option value="EUR">EUR</option></select></label><label>Amount<input name="amount" type="number" min="0.01" step="0.01" [(ngModel)]="amount"></label>@if (preview(); as conversion) { <div class="fact"><strong>{{ money(amount, currency) }} → {{ money(conversion.convertedAmount, selectedInvoice()?.currency ?? 'USD') }}</strong><span class="meta">Latest rate: {{ conversion.rate.rateToUsd }} {{ currency }}/USD · {{ conversion.rate.date }}</span></div> }<button type="submit" [disabled]="!preview()">Create draft</button></form></section><section class="payment-list" aria-label="Payment list">@for (payment of store.payments(); track payment.id) { <button type="button" class="payment" [class.selected]="payment.id === selectedPaymentId()" (click)="selectPayment(payment.id)"><span class="top"><span class="reference">{{ payment.reference }}</span><span class="status" [class]="payment.status">{{ payment.status }}</span></span><span class="meta">{{ payment.invoiceReference }} · {{ money(payment.amount, payment.currency) }}</span></button> } @empty { <div class="empty"><h2>No payments yet</h2><p>Publish an invoice before creating its payment.</p></div> }</section><section class="panel detail">@if (selectedPayment(); as payment) { <div class="top"><div><span class="reference">{{ payment.reference }}</span><h2>Payment detail</h2></div><span class="status" [class]="payment.status">{{ payment.status }}</span></div><div class="fact"><strong>Source invoice · {{ payment.invoiceReference }}</strong><span class="meta">Invoice currency · {{ invoiceFor(payment)?.currency }} · Remaining · {{ money(invoiceFor(payment) ? store.invoiceBalance(invoiceFor(payment)!) : 0, invoiceFor(payment)?.currency ?? 'USD') }}</span></div><div class="row"><span>Payment</span><strong>{{ money(payment.amount, payment.currency) }}</strong></div><div class="row"><span>Conversion</span><strong>{{ payment.convertedAmount !== undefined ? money(payment.convertedAmount, invoiceFor(payment)?.currency ?? 'USD') : previewFor(payment)?.convertedAmount ? money(previewFor(payment)!.convertedAmount, invoiceFor(payment)?.currency ?? 'USD') : 'Unavailable' }}</strong></div><div class="fact"><strong>Rate · {{ payment.frozenRate ?? previewFor(payment)?.rate?.rateToUsd ?? 'Unavailable' }} {{ payment.currency }}/USD</strong><span class="meta">Rate date · {{ payment.frozenRateDate ?? previewFor(payment)?.rate?.date ?? 'Unavailable' }}{{ payment.frozenRate ? ' · Frozen on confirmation' : ' · Latest local history' }}</span></div>@if (payment.status === 'draft') { <div class="actions"><button type="button" (click)="confirmPayment(payment.id)">Confirm payment</button><button type="button" class="secondary danger" (click)="voidPayment(payment.id)">Void payment</button></div> } @else if (payment.status === 'confirmed') { <button type="button" class="secondary danger" (click)="voidPayment(payment.id)">Void payment</button> } } @else { <div class="empty"><h2>Select a payment</h2><p>Draft payments show the latest local rate until confirmation freezes it.</p></div> }</section></section>
  `,
  styles: [pageStyles],
})
export class PaymentsPage {
  protected readonly store = inject(LocalSalesCycleStore);
  protected readonly selectedPaymentId = signal<string | undefined>(this.store.payments()[0]?.id);
  protected readonly selectedPayment = computed(() => this.store.payments().find((payment) => payment.id === this.selectedPaymentId()));
  protected readonly payableInvoices = computed(() => this.store.invoices().filter((invoice) => invoice.status === 'published' || invoice.status === 'partial'));
  protected invoiceId = '';
  protected currency: CurrencyCode = 'USD';
  protected amount = 0;

  protected readonly selectedInvoice = computed(() => this.store.invoices().find((invoice) => invoice.id === this.invoiceId));
  protected readonly preview = computed(() => {
    const invoice = this.selectedInvoice();
    return invoice ? this.store.paymentPreview(invoice, this.currency, Number(this.amount)) : undefined;
  });

  protected createPayment(): void {
    const payment = this.store.createPayment({ invoiceId: this.invoiceId as InvoiceId, currency: this.currency, amount: Number(this.amount) });
    if (payment) this.selectedPaymentId.set(payment.id);
  }
  protected selectPayment(paymentId: string): void { this.selectedPaymentId.set(paymentId); }
  protected confirmPayment(paymentId: string): void { this.store.confirmPayment(paymentId); }
  protected voidPayment(paymentId: string): void { this.store.voidPayment(paymentId); }
  protected invoiceFor(payment: Payment): Invoice | undefined { return this.store.invoices().find((invoice) => invoice.id === payment.invoiceId); }
  protected previewFor(payment: Payment) { const invoice = this.invoiceFor(payment); return invoice ? this.store.paymentPreview(invoice, payment.currency, payment.amount) : undefined; }
  protected money(amount: number, currency: CurrencyCode): string { return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount); }
}
