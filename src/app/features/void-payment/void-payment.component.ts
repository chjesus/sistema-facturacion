import { Component, Input, inject } from '@angular/core';
import { LocalSalesCycleStore } from '../../entities/sales/api/local-sales-cycle-store.service';
import { ButtonComponent } from '../../shared/ui/button.component';

@Component({
  selector: 'app-void-payment',
  imports: [ButtonComponent],
  templateUrl: './void-payment.component.html',
})
export class VoidPaymentComponent {
  @Input({ required: true }) paymentId!: string;
  private readonly store = inject(LocalSalesCycleStore);

  protected voidPayment(): void {
    this.store.voidPayment(this.paymentId);
  }
}
