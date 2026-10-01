import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LocalSalesCycleStore } from '../../entities/sales/api/local-sales-cycle-store.service';
import { CurrencyCode, DocumentLine, ProductId, SalesOrder } from '../../entities/sales/model/sales.models';

const pageStyles = `
  .page-header { max-width: 620px; } .eyebrow { color: var(--accent); font-size: .75rem; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; } h1 { font-size: clamp(2.2rem, 6vw, 4rem); letter-spacing: -.06em; line-height: 1; margin: .5rem 0 1rem; } .page-header > p:last-child, .panel p, .empty p { color: var(--muted); line-height: 1.6; } .workspace { display: grid; gap: 1.25rem; grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr); margin-top: 2.5rem; } .panel, .empty, .order { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 1.5rem; } h2, h3 { letter-spacing: -.03em; margin: 0 0 1rem; } form, .line-form { display: grid; gap: .85rem; } label { color: var(--muted); display: grid; font-size: .8rem; font-weight: 700; gap: .35rem; } input, select { background: #fff; border: 1px solid var(--border); border-radius: 8px; color: var(--ink); font: inherit; padding: .65rem .7rem; } .line-form { align-items: end; grid-template-columns: minmax(0, 1fr) 7rem auto; } button { background: var(--accent); border: 0; border-radius: 8px; color: #fff; cursor: pointer; font: inherit; font-weight: 750; padding: .7rem .9rem; } button.secondary { background: var(--surface-muted); color: var(--ink); } button.danger { color: #b42318; } button:disabled { cursor: not-allowed; opacity: .45; } .draft-lines, .orders { display: grid; gap: .75rem; } .line, .order-top, .order-meta, .actions { align-items: center; display: flex; gap: .7rem; justify-content: space-between; } .line { background: var(--surface-muted); border-radius: 8px; padding: .7rem; } .line button { padding: .25rem .5rem; } .order { display: grid; gap: 1rem; } .order-top { align-items: start; } .reference { font-size: .8rem; font-weight: 800; letter-spacing: .06em; } .status { border-radius: 999px; font-size: .75rem; font-weight: 800; padding: .35rem .65rem; text-transform: capitalize; } .draft { background: #fff7e6; color: #9a6700; } .confirmed { background: #e8f5ed; color: #16794c; } .cancelled { background: #fceaea; color: #b42318; } .order-meta { color: var(--muted); font-size: .85rem; flex-wrap: wrap; justify-content: start; } .actions { justify-content: start; } .empty { text-align: center; } @media (max-width: 800px) { .workspace { grid-template-columns: 1fr; } .line-form { grid-template-columns: 1fr; } }`;

@Component({
  selector: 'app-sales-orders-page',
  imports: [FormsModule],
  template: `
    <section class="page-header"><p class="eyebrow">Sales workspace</p><h1>Sales Orders</h1><p>Start and track customer commitments from one clear workspace.</p></section>
    <section class="workspace">
      <section class="panel"><h2>Create draft order</h2>
        <form (ngSubmit)="createOrder()">
          <label>Customer <input name="customer" [(ngModel)]="customerName" placeholder="Customer name" required /></label>
          <label>Currency <select name="currency" [(ngModel)]="currency"><option value="USD">USD</option><option value="VES">VES</option><option value="EUR">EUR</option></select></label>
          <div class="line-form"><label>Product <select name="product" [(ngModel)]="selectedProductId">@for (item of store.inventory(); track item.id) { <option [value]="item.id">{{ item.name }} · {{ item.sku }}</option> }</select></label><label>Quantity <input name="quantity" [(ngModel)]="quantity" type="number" min="1" /></label><button type="button" class="secondary" (click)="addLine()">Add line</button></div>
          <div class="draft-lines">@for (line of draftLines(); track line.productId) { <div class="line"><span>{{ line.description }} × {{ line.quantity }}</span><button type="button" class="secondary danger" (click)="removeLine(line.productId)">Remove</button></div> }</div>
          <button type="submit" [disabled]="!canCreate()">Create draft order</button>
        </form>
      </section>
      <section class="orders"><h2>Orders</h2>
        @for (order of store.salesOrders(); track order.id) { <article class="order"><div class="order-top"><div><div class="reference">{{ order.reference }}</div><h3>{{ order.customerName }}</h3></div><span class="status" [class]="order.status">{{ order.status }}</span></div><div class="order-meta"><span>{{ order.currency }}</span><span>{{ order.lines.length }} line{{ order.lines.length === 1 ? '' : 's' }}</span><span>{{ deliveryReference(order) }}</span></div><div class="actions">@if (order.status === 'draft') { <button type="button" (click)="confirmOrder(order)">Confirm order</button> } @if (order.status === 'draft' || order.status === 'confirmed') { <button type="button" class="secondary danger" (click)="cancelOrder(order)">Cancel order</button> }</div></article> } @empty { <div class="empty"><h3>No sales orders yet</h3><p>Create a draft order to begin the sales cycle.</p></div> }
      </section>
    </section>
  `,
  styles: [pageStyles],
})
export class SalesOrdersPage {
  protected readonly store = inject(LocalSalesCycleStore);
  protected customerName = '';
  protected currency: CurrencyCode = 'USD';
  protected selectedProductId = this.store.inventory()[0]?.id ?? ('' as ProductId);
  protected quantity = 1;
  protected readonly draftLines = signal<DocumentLine[]>([]);
  protected canCreate(): boolean {
    return this.customerName.trim().length > 0 && this.draftLines().length > 0;
  }

  protected addLine(): void {
    const product = this.store.inventory().find((item) => item.id === this.selectedProductId);
    if (!product || !Number.isInteger(Number(this.quantity)) || Number(this.quantity) < 1) return;
    this.draftLines.update((lines) => {
      const existing = lines.find((line) => line.productId === product.id);
      return existing
        ? lines.map((line) => line.productId === product.id ? { ...line, quantity: line.quantity + Number(this.quantity) } : line)
        : [...lines, { productId: product.id, description: product.name, quantity: Number(this.quantity), unitPrice: 0 }];
    });
    this.quantity = 1;
  }

  protected removeLine(productId: ProductId): void {
    this.draftLines.update((lines) => lines.filter((line) => line.productId !== productId));
  }

  protected createOrder(): void {
    if (!this.canCreate()) return;
    this.store.createSalesOrder({ customerName: this.customerName, currency: this.currency, lines: this.draftLines() });
    this.customerName = '';
    this.currency = 'USD';
    this.draftLines.set([]);
  }

  protected confirmOrder(order: SalesOrder): void {
    this.store.confirmSalesOrder(order.id);
  }

  protected cancelOrder(order: SalesOrder): void {
    this.store.cancelSalesOrder(order.id);
  }

  protected deliveryReference(order: SalesOrder): string {
    const delivery = this.store.deliveries().find((candidate) => candidate.orderId === order.id);
    return delivery ? `Delivery ${delivery.reference} · ${delivery.status}` : 'No delivery created';
  }
}
