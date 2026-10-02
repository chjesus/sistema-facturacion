import { Component, Input, computed, inject } from '@angular/core';
import { ConfirmPaymentComponent } from '../../features/confirm-payment/confirm-payment.component';
import { VoidPaymentComponent } from '../../features/void-payment/void-payment.component';
import { LocalSalesCycleStore } from '../../entities/sales/api/local-sales-cycle-store.service';
import {
  CurrencyCode,
  InvoiceId,
} from '../../entities/sales/model/sales.models';
import { PanelComponent } from '../../shared/ui/panel.component';
import {
  StatusBadgeComponent,
  StatusTone,
} from '../../shared/ui/status-badge.component';

const statusTones: Record<'draft' | 'confirmed' | 'voided', StatusTone> = {
  draft: 'warning',
  confirmed: 'success',
  voided: 'danger',
};

@Component({
  selector: 'app-payment-history',
  imports: [
    ConfirmPaymentComponent,
    PanelComponent,
    StatusBadgeComponent,
    VoidPaymentComponent,
  ],
  templateUrl: './payment-history.component.html',
})
export class PaymentHistoryComponent {
  @Input({ required: true }) invoiceId!: InvoiceId;
  @Input({ required: true }) currency!: CurrencyCode;
  private readonly store = inject(LocalSalesCycleStore);
  protected readonly payments = computed(() =>
    this.store
      .payments()
      .filter((payment) => payment.invoiceId === this.invoiceId),
  );

  protected statusTone(status: 'draft' | 'confirmed' | 'voided'): StatusTone {
    return statusTones[status];
  }
  protected money(amount: number, currency: CurrencyCode): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  }
}
