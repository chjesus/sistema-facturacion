import { Component, Input, inject } from '@angular/core';
import { RegisterPaymentComponent } from '../../features/register-payment/register-payment.component';
import { LocalSalesCycleStore } from '../../entities/sales/api/local-sales-cycle-store.service';
import { Invoice } from '../../entities/sales/model/sales.models';
import { PanelComponent } from '../../shared/ui/panel.component';
import { PaymentHistoryComponent } from '../payment-history/payment-history.component';

@Component({
  selector: 'app-payment-workspace',
  imports: [PanelComponent, PaymentHistoryComponent, RegisterPaymentComponent],
  template: `
    @if (invoice) {
      <app-panel class="mt-10 block" label="Selected invoice"><span class="text-xs font-extrabold tracking-[.12em] text-accent uppercase">Selected invoice</span><h2 class="mt-2 text-xl font-bold tracking-[-.03em] text-ink">{{ invoice.number ?? invoice.reference }}</h2><p class="mt-2 leading-relaxed text-muted">{{ invoice.orderReference }} · {{ money(store.invoiceBalance(invoice), invoice.currency) }} remaining</p></app-panel>
      <section class="mt-5 grid gap-5 min-[761px]:grid-cols-2"><app-register-payment [invoice]="invoice" /><app-payment-history [invoiceId]="invoice.id" [currency]="invoice.currency" /></section>
    } @else {
      <app-panel class="mt-10 block"><h2 class="mb-4 text-xl font-bold tracking-[-.03em] text-ink">Invoice required</h2><p class="leading-relaxed text-muted">Open Register Payment from a published or partial invoice with a positive balance.</p></app-panel>
    }
  `,
})
export class PaymentWorkspaceComponent {
  @Input() invoice: Invoice | undefined;
  protected readonly store = inject(LocalSalesCycleStore);

  protected money(amount: number, currency: Invoice['currency']): string { return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount); }
}
