import { Component, Input, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LocalSalesCycleStore } from '../../entities/sales/api/local-sales-cycle-store.service';
import { CurrencyCode, Invoice, PaymentMethod } from '../../entities/sales/model/sales.models';
import { ButtonComponent } from '../../shared/ui/button.component';
import { FormFieldComponent } from '../../shared/ui/form-field.component';
import { PanelComponent } from '../../shared/ui/panel.component';

@Component({
  selector: 'app-register-payment',
  imports: [ButtonComponent, FormFieldComponent, FormsModule, PanelComponent],
  template: `
    <app-panel label="Payment details">
      <form class="grid gap-[.85rem]" (ngSubmit)="createPayment()">
        <h2 class="text-xl font-bold tracking-[-.03em] text-ink">Payment details</h2>
        <app-form-field label="Date" forId="payment-date"><input id="payment-date" class="w-full rounded-lg border border-border bg-surface p-[.7rem] text-ink" name="paymentDate" type="date" required [(ngModel)]="paymentDate"></app-form-field>
        <app-form-field label="Currency" forId="payment-currency"><select id="payment-currency" class="w-full rounded-lg border border-border bg-surface p-[.7rem] text-ink" name="currency" required [(ngModel)]="currency"><option value="USD">USD</option><option value="VES">VES</option><option value="EUR">EUR</option></select></app-form-field>
        <app-form-field label="Amount" forId="payment-amount"><input id="payment-amount" class="w-full rounded-lg border border-border bg-surface p-[.7rem] text-ink" name="amount" type="number" min="0.01" step="0.01" required [(ngModel)]="amount"></app-form-field>
        <app-form-field label="Method" forId="payment-method"><select id="payment-method" class="w-full rounded-lg border border-border bg-surface p-[.7rem] text-ink" name="method" required [(ngModel)]="method"><option value="cash">Cash</option><option value="bank transfer">Bank transfer</option><option value="mobile payment">Mobile payment</option><option value="zelle">Zelle</option></select></app-form-field>
        <app-form-field label="Reference" forId="payment-reference"><input id="payment-reference" class="w-full rounded-lg border border-border bg-surface p-[.7rem] text-ink" name="reference" required [(ngModel)]="reference" placeholder="Bank or receipt reference"></app-form-field>
        <app-form-field label="Rate adjustment (optional)" forId="payment-rate"><input id="payment-rate" class="w-full rounded-lg border border-border bg-surface p-[.7rem] text-ink" name="adjustedRate" type="number" min="0.0001" step="0.0001" [(ngModel)]="adjustedRate" placeholder="Use historical rate"></app-form-field>
        @if (preview(); as conversion) {
          <div class="grid gap-1 rounded-lg bg-surface-muted p-4"><strong>{{ money(amount, currency) }} → {{ money(conversion.convertedAmount, invoice.currency) }}</strong><span class="text-sm text-muted">Payment rate {{ conversion.rate.rateToUsd }} ({{ conversion.rateSource }}, {{ conversion.rate.date }})</span><span class="text-sm text-muted">Invoice rate {{ conversion.invoiceRate.rateToUsd }} ({{ conversion.invoiceRate.date }})</span></div>
        } @else {
          <p class="text-[#b42318]">Enter valid values and choose a date with rates available for both currencies.</p>
        }
        <app-button type="submit" class="block [&>button]:min-h-[2.7rem] [&>button]:w-full" [disabled]="!canCreate()">Create draft</app-button>
      </form>
    </app-panel>
  `,
})
export class RegisterPaymentComponent {
  @Input({ required: true }) invoice!: Invoice;
  protected readonly store = inject(LocalSalesCycleStore);
  protected paymentDate = new Date().toISOString().slice(0, 10);
  protected currency: CurrencyCode = 'USD';
  protected amount = 0;
  protected method: PaymentMethod = 'bank transfer';
  protected reference = '';
  protected adjustedRate: number | null = null;

  protected preview() { return this.store.paymentPreview(this.invoice, this.currency, Number(this.amount), this.paymentDate, this.adjustedRate ?? undefined); }
  protected canCreate(): boolean { return !!this.preview() && this.reference.trim().length > 0 && !!this.method; }
  protected createPayment(): void {
    const payment = this.store.createPayment({ invoiceId: this.invoice.id, currency: this.currency, amount: Number(this.amount), paymentDate: this.paymentDate, method: this.method, reference: this.reference, adjustedRate: this.adjustedRate ?? undefined });
    if (payment) this.reference = '';
  }
  protected money(amount: number, currency: CurrencyCode): string { return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount); }
}
