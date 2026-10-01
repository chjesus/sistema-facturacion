import { Component, computed, inject, signal } from '@angular/core';
import { LocalSalesCycleStore } from '../../entities/sales/api/local-sales-cycle-store.service';
import { Delivery, DeliveryId, SalesOrder } from '../../entities/sales/model/sales.models';

const pageStyles = `
  .page-header { max-width: 620px; } .eyebrow { color: var(--accent); font-size: .75rem; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; } h1 { font-size: clamp(2.2rem, 6vw, 4rem); letter-spacing: -.06em; line-height: 1; margin: .5rem 0 1rem; } .page-header > p:last-child, .empty p, .detail-note { color: var(--muted); line-height: 1.6; } .workspace { display: grid; gap: 1.25rem; grid-template-columns: minmax(260px, .85fr) minmax(0, 1.15fr); margin-top: 2.5rem; } .deliveries, .detail { display: grid; gap: .75rem; } .delivery, .detail-card, .empty { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 1.25rem; } .delivery { cursor: pointer; text-align: left; width: 100%; } .delivery.selected { border-color: var(--accent); box-shadow: 0 0 0 3px #eef2ff; } .delivery-top, .delivery-meta, .detail-header, .line, .actions { align-items: center; display: flex; gap: .7rem; justify-content: space-between; } .delivery-meta { color: var(--muted); font-size: .85rem; margin-top: .75rem; } .reference { font-size: .8rem; font-weight: 800; letter-spacing: .06em; } h2, h3 { letter-spacing: -.03em; margin: 0; } .status { border-radius: 999px; font-size: .75rem; font-weight: 800; padding: .35rem .65rem; text-transform: capitalize; } .pending { background: #fff7e6; color: #9a6700; } .validated { background: #e8f5ed; color: #1a7f37; } .cancelled { background: #fef3f2; color: #b42318; } .source { background: var(--surface-muted); border-radius: 10px; margin: 1.25rem 0; padding: 1rem; } .source strong { display: block; margin-bottom: .3rem; } .line-list { border-top: 1px solid var(--border); display: grid; margin-top: 1rem; } .line { border-bottom: 1px solid var(--border); padding: .9rem 0; } .quantity { color: var(--muted); font-size: .9rem; } .actions { justify-content: flex-start; margin-top: 1.25rem; } button { background: var(--accent); border: 0; border-radius: 8px; color: #fff; cursor: pointer; font: inherit; font-weight: 750; padding: .7rem .9rem; } button.secondary { background: var(--surface-muted); color: var(--ink); } button.danger { color: #b42318; } @media (max-width: 760px) { .workspace { grid-template-columns: 1fr; } }
`;

@Component({
  selector: 'app-deliveries-page',
  template: `
    <section class="page-header"><p class="eyebrow">Warehouse workspace</p><h1>Deliveries</h1><p>Validate outgoing goods and keep each shipment connected to its source order.</p></section>
    <section class="workspace">
      <section class="deliveries" aria-label="Delivery list">
        @for (delivery of store.deliveries(); track delivery.id) {
          <button type="button" class="delivery" [class.selected]="delivery.id === selectedDeliveryId()" (click)="selectDelivery(delivery.id)">
            <span class="delivery-top"><span><span class="reference">{{ delivery.reference }}</span><h3>{{ delivery.orderReference }}</h3></span><span class="status" [class]="delivery.status">{{ delivery.status }}</span></span>
            <span class="delivery-meta"><span>{{ delivery.lines.length }} line{{ delivery.lines.length === 1 ? '' : 's' }}</span><span>{{ pendingQuantity(delivery) }} pending</span></span>
          </button>
        } @empty { <div class="empty"><h2>No deliveries yet</h2><p>Confirm a sales order to create a pending delivery.</p></div> }
      </section>
      @if (selectedDelivery(); as delivery) {
        <section class="detail-card" aria-label="Delivery detail"><div class="detail-header"><div><div class="reference">{{ delivery.reference }}</div><h2>Delivery detail</h2></div><span class="status" [class]="delivery.status">{{ delivery.status }}</span></div>
          <div class="source"><strong>Source sales order · {{ delivery.orderReference }}</strong><span>{{ sourceOrder(delivery)?.customerName ?? 'Customer unavailable' }}</span></div>
          <p class="detail-note">Pending quantity: {{ pendingQuantity(delivery) }} units</p>
          <div class="line-list">@for (line of delivery.lines; track line.productId) { <div class="line"><span>{{ line.description }}</span><span class="quantity">{{ line.quantity }} to deliver · {{ delivery.status === 'pending' ? line.quantity : 0 }} pending</span></div> }</div>
          @if (delivery.status === 'pending') { <div class="actions"><button type="button" (click)="validateDelivery(delivery.id)">Validate delivery</button><button type="button" class="secondary danger" (click)="cancelDelivery(delivery.id)">Cancel delivery</button></div> }
        </section>
      } @else { <section class="empty"><h2>Select a delivery</h2><p>Choose a shipment to review its source order and quantities.</p></section> }
    </section>
  `,
  styles: [pageStyles],
})
export class DeliveriesPage {
  protected readonly store = inject(LocalSalesCycleStore);
  protected readonly selectedDeliveryId = signal<DeliveryId | undefined>(this.store.deliveries()[0]?.id);
  protected readonly selectedDelivery = computed(() =>
    this.store.deliveries().find((delivery) => delivery.id === this.selectedDeliveryId()),
  );

  protected selectDelivery(deliveryId: DeliveryId): void {
    this.selectedDeliveryId.set(deliveryId);
  }

  protected validateDelivery(deliveryId: DeliveryId): void {
    this.store.validateDelivery(deliveryId);
  }

  protected cancelDelivery(deliveryId: DeliveryId): void {
    this.store.cancelDelivery(deliveryId);
  }

  protected pendingQuantity(delivery: Delivery): number {
    return delivery.status === 'pending' ? delivery.lines.reduce((total, line) => total + line.quantity, 0) : 0;
  }

  protected sourceOrder(delivery: Delivery): SalesOrder | undefined {
    return this.store.salesOrders().find((order) => order.id === delivery.orderId);
  }
}
