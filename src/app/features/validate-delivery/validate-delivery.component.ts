import { Component, Input, OnChanges, SimpleChanges, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LocalSalesCycleStore } from '../../entities/sales/api/local-sales-cycle-store.service';
import { Delivery, DocumentLine } from '../../entities/sales/model/sales.models';
import { ButtonComponent } from '../../shared/ui/button.component';
import { FormFieldComponent } from '../../shared/ui/form-field.component';

@Component({
  selector: 'app-validate-delivery',
  imports: [ButtonComponent, FormFieldComponent, FormsModule],
  template: `
    <app-form-field label="Outgoing warehouse"><select class="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-ink" [ngModel]="delivery.warehouseId" (ngModelChange)="selectWarehouse($event)">@for (warehouse of store.warehouses(); track warehouse.id) { <option [value]="warehouse.id">{{ warehouse.name }} · {{ warehouse.code }}</option> }</select></app-form-field>
    <div class="mt-4 grid border-t border-border">@for (line of delivery.lines; track line.productId) { <div class="flex flex-wrap items-center justify-between gap-3 border-b border-border py-3"><span><strong>{{ line.description }}</strong><span class="block text-sm text-muted">{{ availableStock(line) }} available in {{ delivery.warehouseName }}</span></span><app-form-field label="To ship" class="justify-items-end"><input class="w-24 rounded-lg border border-border bg-white px-3 py-2.5 text-ink" [name]="'shipment-' + line.productId" type="number" min="1" [max]="maxShipment(line)" step="1" [ngModel]="shipmentQuantity(line)" (ngModelChange)="setShipmentQuantity(line, $event)" /></app-form-field></div> }</div>
    <div class="mt-4"><app-button [disabled]="!canValidate()" (click)="validateDelivery()">Validate delivery</app-button></div>
  `,
})
export class ValidateDeliveryComponent implements OnChanges {
  @Input({ required: true }) delivery!: Delivery;

  protected readonly store = inject(LocalSalesCycleStore);
  protected shipmentQuantities: Record<string, number> = {};

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['delivery']) this.shipmentQuantities = this.quantitiesFor(this.delivery);
  }

  protected selectWarehouse(warehouseId: string): void { this.store.updateDeliveryWarehouse(this.delivery.id, warehouseId); }
  protected shipmentQuantity(line: DocumentLine): number { return this.shipmentQuantities[line.productId] ?? line.quantity; }
  protected setShipmentQuantity(line: DocumentLine, quantity: number): void { this.shipmentQuantities = { ...this.shipmentQuantities, [line.productId]: Number(quantity) }; }
  protected availableStock(line: DocumentLine): number { return this.store.warehouseStock(this.delivery.warehouseId, line.productId); }
  protected maxShipment(line: DocumentLine): number { return Math.min(line.quantity, this.availableStock(line)); }
  protected canValidate(): boolean { return this.delivery.lines.every((line) => { const quantity = this.shipmentQuantity(line); return Number.isInteger(quantity) && quantity > 0 && quantity <= this.maxShipment(line); }); }
  protected validateDelivery(): void {
    if (!this.canValidate()) return;
    this.store.validateDelivery(this.delivery.id, this.delivery.lines.map((line) => ({ ...line, quantity: this.shipmentQuantity(line) })));
  }

  private quantitiesFor(delivery: Delivery): Record<string, number> { return Object.fromEntries(delivery.lines.map((line) => [line.productId, line.quantity])); }
}
