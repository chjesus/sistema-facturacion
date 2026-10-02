import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LocalSalesCycleStore } from '../../entities/sales/api/local-sales-cycle-store.service';
import { CurrencyCode, InvoiceId, Payment, PaymentMethod } from '../../entities/sales/model/sales.models';

@Component({
  selector: 'app-payments-page',
  imports: [FormsModule],
  template: `
    <section class="page-header"><p class="eyebrow">Settlement workspace</p><h1>Register payment</h1><p>Record a dated payment against the invoice that opened this workspace.</p></section>
    @if (selectedInvoice(); as invoice) {
      <section class="invoice-card"><span class="eyebrow">Selected invoice</span><h2>{{ invoice.number ?? invoice.reference }}</h2><p>{{ invoice.orderReference }} · {{ money(store.invoiceBalance(invoice), invoice.currency) }} remaining</p></section>
      <section class="workspace">
        <form class="panel form" (ngSubmit)="createPayment()">
          <h2>Payment details</h2>
          <label>Date<input name="paymentDate" type="date" required [(ngModel)]="paymentDate"></label>
          <label>Currency<select name="currency" required [(ngModel)]="currency"><option value="USD">USD</option><option value="VES">VES</option><option value="EUR">EUR</option></select></label>
          <label>Amount<input name="amount" type="number" min="0.01" step="0.01" required [(ngModel)]="amount"></label>
          <label>Method<select name="method" required [(ngModel)]="method"><option value="cash">Cash</option><option value="bank transfer">Bank transfer</option><option value="mobile payment">Mobile payment</option><option value="zelle">Zelle</option></select></label>
          <label>Reference<input name="reference" required [(ngModel)]="reference" placeholder="Bank or receipt reference"></label>
          <label>Rate adjustment (optional)<input name="adjustedRate" type="number" min="0.0001" step="0.0001" [(ngModel)]="adjustedRate" placeholder="Use historical rate"></label>
          @if (preview(); as conversion) { <div class="preview"><strong>{{ money(amount, currency) }} → {{ money(conversion.convertedAmount, invoice.currency) }}</strong><span>Payment rate {{ conversion.rate.rateToUsd }} ({{ conversion.rateSource }}, {{ conversion.rate.date }})</span><span>Invoice rate {{ conversion.invoiceRate.rateToUsd }} ({{ conversion.invoiceRate.date }})</span></div> } @else { <p class="error">Enter valid values and choose a date with rates available for both currencies.</p> }
          <button type="submit" [disabled]="!canCreate()">Create draft</button>
        </form>
        <section class="panel"><h2>Payment history</h2><div class="history">@for (payment of invoicePayments(); track payment.id) { <article><div><strong>{{ payment.reference }}</strong><span class="status">{{ payment.status }}</span></div><p>{{ money(payment.amount, payment.currency) }} · {{ payment.paymentDate }} · {{ payment.method }}</p><p>Frozen {{ payment.chosenRate }} ({{ payment.rateSource }}, {{ payment.rateDate }}) → {{ money(payment.convertedAmount, invoice.currency) }}</p>@if (payment.status === 'draft') { <button type="button" (click)="confirmPayment(payment.id)">Confirm</button> } @if (payment.status !== 'voided') { <button type="button" class="secondary" (click)="voidPayment(payment.id)">Void</button> }</article> } @empty { <p>No payments recorded for this invoice.</p> }</div></section>
      </section>
    } @else { <section class="panel"><h2>Invoice required</h2><p>Open Register Payment from a published or partial invoice with a positive balance.</p></section> }
  `,
  styles: [`
    button { background: var(--accent); border: 0; border-radius: 8px; box-shadow: 0 1px 2px rgb(79 70 229 / .25); color: #fff; cursor: pointer; font: inherit; font-weight: 750; min-height: 2.7rem; padding: .7rem 1rem; }
    button:hover:not(:disabled) { background: #4338ca; }
    button:disabled { cursor: not-allowed; opacity: .45; }
    button.secondary { background: var(--surface); border: 1px solid var(--border); box-shadow: none; color: #b42318; }
  `, `
    .page-header,.invoice-card,.workspace { max-width: 960px; margin-inline: auto; } .eyebrow { color: var(--accent); font-size:.75rem; font-weight:800; letter-spacing:.12em; text-transform:uppercase; } h1 { font-size:clamp(2.2rem,6vw,4rem); letter-spacing:-.06em; margin:.5rem 0 1rem; } h2 { margin:0 0 1rem; } p { color:var(--muted); } .invoice-card,.panel { background:var(--surface); border:1px solid var(--border); border-radius:16px; padding:1.25rem; } .invoice-card { margin-top:2rem; } .workspace { display:grid; gap:1.25rem; grid-template-columns:repeat(2,minmax(0,1fr)); margin-top:1.25rem; } .form,.history { display:grid; gap:.85rem; } label { color:var(--muted); display:grid; font-size:.8rem; font-weight:700; gap:.35rem; } input,select { background:var(--surface); border:1px solid var(--border); border-radius:8px; color:inherit; font:inherit; padding:.7rem; } .preview { background:var(--surface-muted); border-radius:10px; display:grid; gap:.3rem; padding:1rem; } .preview span { color:var(--muted); font-size:.85rem; } .history article { border-top:1px solid var(--border); padding:.9rem 0; } .history article div { display:flex; justify-content:space-between; } .history p { font-size:.85rem; margin:.35rem 0; } .status { text-transform:capitalize; } .error { color:#b42318; } .secondary { margin-left:.5rem; } @media(max-width:760px){.workspace{grid-template-columns:1fr}}`],
})
export class PaymentsPage {
  protected readonly store = inject(LocalSalesCycleStore);
  private readonly route = inject(ActivatedRoute);
  protected readonly invoiceId = this.route.snapshot.queryParamMap.get('invoiceId') as InvoiceId | null;
  protected readonly selectedInvoice = computed(() => {
    const invoice = this.store.invoices().find((candidate) => candidate.id === this.invoiceId);
    return invoice && (invoice.status === 'published' || invoice.status === 'partial') && this.store.invoiceBalance(invoice) > 0 ? invoice : undefined;
  });
  protected readonly invoicePayments = computed(() => this.store.payments().filter((payment) => payment.invoiceId === this.invoiceId));
  protected paymentDate = new Date().toISOString().slice(0, 10);
  protected currency: CurrencyCode = 'USD';
  protected amount = 0;
  protected method: PaymentMethod = 'bank transfer';
  protected reference = '';
  protected adjustedRate: number | null = null;

  protected preview() {
    const invoice = this.selectedInvoice();
    return invoice ? this.store.paymentPreview(invoice, this.currency, Number(this.amount), this.paymentDate, this.adjustedRate ?? undefined) : undefined;
  }
  protected canCreate(): boolean { return !!this.preview() && this.reference.trim().length > 0 && !!this.method; }
  protected createPayment(): void {
    if (!this.invoiceId) return;
    const payment = this.store.createPayment({ invoiceId: this.invoiceId, currency: this.currency, amount: Number(this.amount), paymentDate: this.paymentDate, method: this.method, reference: this.reference, adjustedRate: this.adjustedRate ?? undefined });
    if (payment) this.reference = '';
  }
  protected confirmPayment(paymentId: string): void { this.store.confirmPayment(paymentId); }
  protected voidPayment(paymentId: string): void { this.store.voidPayment(paymentId); }
  protected money(amount: number, currency: CurrencyCode): string { return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount); }
}
