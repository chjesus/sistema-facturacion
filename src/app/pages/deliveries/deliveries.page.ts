import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LocalSalesCycleStore } from '../../entities/sales/api/local-sales-cycle-store.service';
import { Delivery, DeliveryId, DocumentLine, SalesOrder } from '../../entities/sales/model/sales.models';

const pageStyles = `
  .page-header { max-width: 620px; } .eyebrow { color: var(--accent); font-size: .75rem; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; } h1 { font-size: clamp(2.2rem, 6vw, 4rem); letter-spacing: -.06em; line-height: 1; margin: .5rem 0 1rem; } .page-header > p:last-child, .empty p, .detail-note, .stock { color: var(--muted); line-height: 1.6; } .workspace { display: grid; gap: 1.25rem; grid-template-columns: minmax(260px, .85fr) minmax(0, 1.15fr); margin-top: 2.5rem; } .deliveries, .detail { display: grid; gap: .75rem; } .delivery, .detail-card, .empty { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 1.25rem; } .delivery { cursor: pointer; text-align: left; width: 100%; } .delivery.selected { border-color: var(--accent); box-shadow: 0 0 0 3px #eef2ff; } .delivery-top, .delivery-meta, .detail-header, .line, .actions { align-items: center; display: flex; gap: .7rem; justify-content: space-between; } .delivery-meta { color: var(--muted); font-size: .85rem; margin-top: .75rem; } .reference { font-size: .8rem; font-weight: 800; letter-spacing: .06em; } h2, h3 { letter-spacing: -.03em; margin: 0; } .status { border-radius: 999px; font-size: .75rem; font-weight: 800; padding: .35rem .65rem; text-transform: capitalize; } .pending { background: #fff7e6; color: #9a6700; } .validated { background: #e8f5ed; color: #1a7f37; } .cancelled { background: #fef3f2; color: #b42318; } .source { background: var(--surface-muted); border-radius: 10px; margin: 1.25rem 0; padding: 1rem; } .source strong { display: block; margin-bottom: .3rem; } .line-list { border-top: 1px solid var(--border); display: grid; margin-top: 1rem; } .line { border-bottom: 1px solid var(--border); padding: .9rem 0; } .quantity { color: var(--muted); font-size: .9rem; } .stock { font-size: .8rem; } .shipment { display: grid; gap: .35rem; justify-items: end; } label { color: var(--muted); font-size: .8rem; font-weight: 700; } input, select { background: #fff; border: 1px solid var(--border); border-radius: 8px; color: var(--ink); font: inherit; padding: .55rem .65rem; } input { max-width: 5rem; } select { margin-top: .35rem; width: 100%; } .actions { justify-content: flex-start; margin-top: 1.25rem; } button { background: var(--accent); border: 0; border-radius: 8px; color: #fff; cursor: pointer; font: inherit; font-weight: 750; padding: .7rem .9rem; } button.secondary { background: var(--surface-muted); color: var(--ink); } button.danger { color: #b42318; } button:disabled { cursor: not-allowed; opacity: .45; } @media (max-width: 760px) { .workspace { grid-template-columns: 1fr; } .line { align-items: start; flex-direction: column; } .shipment { justify-items: start; } }
`;

@Component({
  selector: 'app-deliveries-page',
  imports: [FormsModule],
  template: `
    <section class="page-header"><p class="eyebrow">Warehouse workspace</p><h1>Deliveries</h1><p>Ship available goods, preserve their order source, and create backorders only for outstanding quantities.</p></section>
    <section class="workspace">
      <section class="deliveries" aria-label="Delivery list">
        @for (delivery of store.deliveries(); track delivery.id) {
          <button type="button" class="delivery" [class.selected]="delivery.id === selectedDeliveryId()" (click)="selectDelivery(delivery)">
            <span class="delivery-top"><span><span class="reference">{{ delivery.reference }}</span><h3>{{ delivery.orderReference }}</h3></span><span class="status" [class]="delivery.status">{{ delivery.status }}</span></span>
            <span class="delivery-meta"><span>{{ delivery.warehouseName }}</span><span>{{ delivery.parentDeliveryId ? 'Backorder' : 'Original shipment' }}</span></span>
          </button>
        } @empty { <div class="empty"><h2>No deliveries yet</h2><p>Confirm a sales order to create a pending delivery.</p></div> }
      </section>
      @if (selectedDelivery(); as delivery) {
        <section class="detail-card" aria-label="Delivery detail"><div class="detail-header"><div><div class="reference">{{ delivery.reference }}</div><h2>Delivery detail</h2></div><span class="status" [class]="delivery.status">{{ delivery.status }}</span></div>
          <div class="source"><strong>Source sales order · {{ delivery.orderReference }}</strong><span>{{ delivery.customerName }}</span>@if (delivery.parentDeliveryId) { <span class="stock">Backorder of {{ delivery.parentDeliveryId }}</span> }</div>
          @if (delivery.status === 'pending') { <label>Outgoing warehouse<select [ngModel]="delivery.warehouseId" (ngModelChange)="selectWarehouse(delivery.id, $event)">@for (warehouse of store.warehouses(); track warehouse.id) { <option [value]="warehouse.id">{{ warehouse.name }} · {{ warehouse.code }}</option> }</select></label> }
          <div class="line-list">@for (line of delivery.lines; track line.productId) { <div class="line"><span><strong>{{ line.description }}</strong><span class="stock">{{ availableStock(delivery, line) }} available in {{ delivery.warehouseName }}</span></span>@if (delivery.status === 'pending') { <span class="shipment"><label [for]="'shipment-' + line.productId">To ship</label><input [id]="'shipment-' + line.productId" [name]="'shipment-' + line.productId" type="number" min="1" [max]="maxShipment(delivery, line)" step="1" [ngModel]="shipmentQuantity(line)" (ngModelChange)="setShipmentQuantity(line, $event)" /></span> } @else { <span class="quantity">{{ line.quantity }} validated</span> }</div> }</div>
          @if (delivery.status === 'pending') { <div class="actions"><button type="button" [disabled]="!canValidate(delivery)" (click)="validateDelivery(delivery)">Validate delivery</button><button type="button" class="secondary danger" (click)="cancelDelivery(delivery.id)">Cancel delivery</button></div> }
        </section>
      } @else { <section class="empty"><h2>Select a delivery</h2><p>Choose a shipment to review its source order and quantities.</p></section> }
    </section>
  `,
  styles: [pageStyles],
})
export class DeliveriesPage {
  protected readonly store = inject(LocalSalesCycleStore);
  protected readonly selectedDeliveryId = signal<DeliveryId | undefined>(this.store.deliveries()[0]?.id);
  protected readonly selectedDelivery = computed(() => this.store.deliveries().find((delivery) => delivery.id === this.selectedDeliveryId()));
  protected shipmentQuantities: Record<string, number> = this.quantitiesFor(this.store.deliveries()[0]);

  protected selectDelivery(delivery: Delivery): void {
    this.selectedDeliveryId.set(delivery.id);
    this.shipmentQuantities = this.quantitiesFor(delivery);
  }

  protected selectWarehouse(deliveryId: DeliveryId, warehouseId: string): void { this.store.updateDeliveryWarehouse(deliveryId, warehouseId); }
  protected shipmentQuantity(line: DocumentLine): number { return this.shipmentQuantities[line.productId] ?? line.quantity; }
  protected setShipmentQuantity(line: DocumentLine, quantity: number): void { this.shipmentQuantities = { ...this.shipmentQuantities, [line.productId]: Number(quantity) }; }
  protected availableStock(delivery: Delivery, line: DocumentLine): number { return this.store.warehouseStock(delivery.warehouseId, line.productId); }
  protected maxShipment(delivery: Delivery, line: DocumentLine): number { return Math.min(line.quantity, this.availableStock(delivery, line)); }
  protected canValidate(delivery: Delivery): boolean { return delivery.lines.every((line) => { const quantity = this.shipmentQuantity(line); return Number.isInteger(quantity) && quantity > 0 && quantity <= this.maxShipment(delivery, line); }); }
  protected validateDelivery(delivery: Delivery): void { if (!this.canValidate(delivery)) return; this.store.validateDelivery(delivery.id, delivery.lines.map((line) => ({ ...line, quantity: this.shipmentQuantity(line) }))); }
  protected cancelDelivery(deliveryId: DeliveryId): void { this.store.cancelDelivery(deliveryId); }
  protected sourceOrder(delivery: Delivery): SalesOrder | undefined { return this.store.salesOrders().find((order) => order.id === delivery.orderId); }
  private quantitiesFor(delivery: Delivery | undefined): Record<string, number> { return Object.fromEntries(delivery?.lines.map((line) => [line.productId, line.quantity]) ?? []); }
}
