import { Component, Input, inject } from '@angular/core';
import { LocalSalesCycleStore } from '../../entities/sales/api/local-sales-cycle-store.service';
import { ButtonComponent } from '../../shared/ui/button.component';

@Component({
  selector: 'app-confirm-payment',
  imports: [ButtonComponent],
  templateUrl: './confirm-payment.component.html',
})
export class ConfirmPaymentComponent {
  @Input({ required: true }) paymentId!: string;
  private readonly store = inject(LocalSalesCycleStore);

  protected confirmPayment(): void {
    this.store.confirmPayment(this.paymentId);
  }
}
