import { Component, Input, inject } from '@angular/core';
import { LocalSalesCycleStore } from '../../entities/sales/api/local-sales-cycle-store.service';
import { DeliveryId } from '../../entities/sales/model/sales.models';
import { ButtonComponent } from '../../shared/ui/button.component';

@Component({
  selector: 'app-cancel-delivery',
  imports: [ButtonComponent],
  templateUrl: './cancel-delivery.component.html',
})
export class CancelDeliveryComponent {
  @Input({ required: true }) deliveryId!: DeliveryId;
  private readonly store = inject(LocalSalesCycleStore);

  protected cancel(): void {
    this.store.cancelDelivery(this.deliveryId);
  }
}
