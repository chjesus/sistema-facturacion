import { Component, computed, inject, input } from '@angular/core';
import { RegisterPaymentComponent } from '../../features/register-payment/register-payment.component';
import { LocalSalesCycleStore } from '../../entities/sales/api/local-sales-cycle-store.service';
import { Invoice } from '../../entities/sales/model/sales.models';
import { PanelComponent } from '../../shared/ui/panel.component';
import { PaymentHistoryComponent } from '../payment-history/payment-history.component';

@Component({
  selector: 'app-payment-workspace',
  imports: [PanelComponent, PaymentHistoryComponent, RegisterPaymentComponent],
  templateUrl: './payment-workspace.component.html',
})
export class PaymentWorkspaceComponent {
  readonly invoiceId = input<string | null>(null);
  protected readonly store = inject(LocalSalesCycleStore);
  protected readonly selectedInvoice = computed(() => {
    const invoice = this.store
      .invoices()
      .find((candidate) => candidate.id === this.invoiceId());
    return invoice &&
      (invoice.status === 'published' || invoice.status === 'partial') &&
      this.store.invoiceBalance(invoice) > 0
      ? invoice
      : undefined;
  });

  protected money(amount: number, currency: Invoice['currency']): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  }
}
