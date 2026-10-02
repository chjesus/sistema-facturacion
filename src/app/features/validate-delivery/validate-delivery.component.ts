import {
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LocalSalesCycleStore } from '../../entities/sales/api/local-sales-cycle-store.service';
import {
  Delivery,
  DocumentLine,
} from '../../entities/sales/model/sales.models';
import { ButtonComponent } from '../../shared/ui/button.component';
import { FormFieldComponent } from '../../shared/ui/form-field.component';

@Component({
  selector: 'app-validate-delivery',
  imports: [ButtonComponent, FormFieldComponent, FormsModule],
  templateUrl: './validate-delivery.component.html',
})
export class ValidateDeliveryComponent implements OnChanges {
  @Input({ required: true }) delivery!: Delivery;

  protected readonly store = inject(LocalSalesCycleStore);
  protected shipmentQuantities: Record<string, number> = {};

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['delivery']) {
      this.shipmentQuantities = this.quantitiesFor(this.delivery);
    }
  }

  protected selectWarehouse(warehouseId: string): void {
    this.store.updateDeliveryWarehouse(this.delivery.id, warehouseId);
  }

  protected shipmentQuantity(line: DocumentLine): number {
    return this.shipmentQuantities[line.productId] ?? line.quantity;
  }

  protected setShipmentQuantity(line: DocumentLine, quantity: number): void {
    this.shipmentQuantities = {
      ...this.shipmentQuantities,
      [line.productId]: Number(quantity),
    };
  }

  protected availableStock(line: DocumentLine): number {
    return this.store.warehouseStock(this.delivery.warehouseId, line.productId);
  }

  protected maxShipment(line: DocumentLine): number {
    return Math.min(line.quantity, this.availableStock(line));
  }

  protected canValidate(): boolean {
    return this.delivery.lines.every((line) => {
      const quantity = this.shipmentQuantity(line);

      return (
        Number.isInteger(quantity) &&
        quantity > 0 &&
        quantity <= this.maxShipment(line)
      );
    });
  }
  protected validateDelivery(): void {
    if (!this.canValidate()) return;
    this.store.validateDelivery(
      this.delivery.id,
      this.delivery.lines.map((line) => ({
        ...line,
        quantity: this.shipmentQuantity(line),
      })),
    );
  }

  private quantitiesFor(delivery: Delivery): Record<string, number> {
    return Object.fromEntries(
      delivery.lines.map((line) => [line.productId, line.quantity]),
    );
  }
}
