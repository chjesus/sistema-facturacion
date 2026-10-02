import { Component, computed, inject, signal } from '@angular/core';
import { LocalSalesCycleStore } from '../../entities/sales/api/local-sales-cycle-store.service';
import {
  Delivery,
  DeliveryId,
  DeliveryStatus,
} from '../../entities/sales/model/sales.models';
import { CancelDeliveryComponent } from '../../features/cancel-delivery/cancel-delivery.component';
import { ValidateDeliveryComponent } from '../../features/validate-delivery/validate-delivery.component';
import { PanelComponent } from '../../shared/ui/panel.component';
import {
  StatusBadgeComponent,
  StatusTone,
} from '../../shared/ui/status-badge.component';

const statusTones: Record<DeliveryStatus, StatusTone> = {
  pending: 'warning',
  validated: 'success',
  cancelled: 'danger',
};

@Component({
  selector: 'app-delivery-workspace',
  imports: [
    CancelDeliveryComponent,
    PanelComponent,
    StatusBadgeComponent,
    ValidateDeliveryComponent,
  ],
  templateUrl: './delivery-workspace.component.html',
})
export class DeliveryWorkspaceComponent {
  protected readonly store = inject(LocalSalesCycleStore);
  protected readonly selectedDeliveryId = signal<DeliveryId | undefined>(
    this.store.deliveries()[0]?.id,
  );
  protected readonly selectedDelivery = computed(() =>
    this.store
      .deliveries()
      .find((delivery) => delivery.id === this.selectedDeliveryId()),
  );

  protected selectDelivery(delivery: Delivery): void {
    this.selectedDeliveryId.set(delivery.id);
  }

  protected statusTone(status: DeliveryStatus): StatusTone {
    return statusTones[status];
  }
}
