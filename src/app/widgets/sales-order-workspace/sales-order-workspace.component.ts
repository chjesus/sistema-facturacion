import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { LocalSalesCycleStore } from '../../entities/sales/api/local-sales-cycle-store.service';
import { CurrencyCode, DocumentLine, SalesOrder, SalesOrderStatus } from '../../entities/sales/model/sales.models';
import { ButtonComponent } from '../../shared/ui/button.component';
import { PanelComponent } from '../../shared/ui/panel.component';
import { StatusBadgeComponent, StatusTone } from '../../shared/ui/status-badge.component';

const statusTones: Record<SalesOrderStatus, StatusTone> = {
  draft: 'warning',
  confirmed: 'success',
  completed: 'success',
  cancelled: 'danger',
};

@Component({
  selector: 'app-sales-order-workspace',
  imports: [ButtonComponent, PanelComponent, StatusBadgeComponent],
  template: `
    <section class="grid gap-3" aria-label="Sales orders">
      <h2 class="text-xl font-bold tracking-[-.03em] text-ink">Orders</h2>
      @for (order of store.salesOrders(); track order.id) {
        <app-panel>
          <article class="grid gap-4">
            <div class="flex items-start justify-between gap-3"><div><div class="text-xs font-extrabold tracking-[.06em] text-ink">{{ order.reference }}</div><h3 class="mt-1 text-lg font-bold tracking-[-.03em] text-ink">{{ order.customerName }}</h3></div><app-status-badge [label]="order.status" [tone]="statusTone(order.status)" /></div>
            <div class="flex flex-wrap justify-between gap-3 text-sm text-muted"><span>{{ order.orderDate }}</span><span>{{ order.currency }}</span><span>{{ deliveryReference(order) }}</span></div>
            <div class="grid gap-0 border-t border-border">
              @for (line of order.lines; track line.productId) {
                <div class="flex flex-wrap items-center justify-between gap-3 border-b border-border p-3"><span>{{ line.description }} × {{ line.quantity }} · {{ money(line.unitPrice, order.currency) }}</span><span class="text-sm text-muted">Ordered {{ quantities(order, line).ordered }} · Delivered {{ quantities(order, line).delivered }} · Invoiced {{ quantities(order, line).invoiced }}</span><span>{{ money(lineTotals(line).total, order.currency) }}</span></div>
              }
            </div>
            <div class="grid gap-2 text-[.9rem]"><div class="flex justify-between gap-3"><span>Subtotal</span><span>{{ money(totals(order).subtotal, order.currency) }}</span></div><div class="flex justify-between gap-3"><span>VAT (16%)</span><span>{{ money(totals(order).vat, order.currency) }}</span></div><div class="flex justify-between gap-3 border-t border-border pt-2 text-base font-extrabold"><span>Total</span><span>{{ money(totals(order).total, order.currency) }}</span></div></div>
            @if (order.status !== 'draft') { <p class="leading-relaxed text-muted">Confirmed orders are immutable.</p> }
            <div class="flex flex-wrap gap-3">@if (order.status === 'draft') { <app-button (click)="confirmOrder(order)">Confirm order</app-button> }<app-button variant="secondary" [disabled]="!invoiceEligible(order)" (click)="createInvoice(order)">Create invoice</app-button>@if (order.status === 'draft' || order.status === 'confirmed') { <app-button variant="danger" [disabled]="!canCancel(order)" (click)="cancelOrder(order)">Cancel order</app-button> }</div>
            @if (!canCancel(order) && (order.status === 'draft' || order.status === 'confirmed')) { <p class="leading-relaxed text-muted">Cancellation is blocked after a validated delivery or committed invoice.</p> }
          </article>
        </app-panel>
      } @empty { <app-panel><h3 class="mb-4 text-lg font-bold tracking-[-.03em] text-ink">No sales orders yet</h3><p class="leading-relaxed text-muted">Create a draft order to begin the sales cycle.</p></app-panel> }
    </section>
  `,
})
export class SalesOrderWorkspaceComponent {
  protected readonly store = inject(LocalSalesCycleStore);
  private readonly router = inject(Router);

  protected confirmOrder(order: SalesOrder): void { this.store.confirmSalesOrder(order.id); }
  protected cancelOrder(order: SalesOrder): void { this.store.cancelSalesOrder(order.id); }
  protected createInvoice(order: SalesOrder): void { if (this.store.createInvoiceFromOrder(order.id)) void this.router.navigate(['/invoices']); }
  protected invoiceEligible(order: SalesOrder): boolean { return this.store.invoiceEligibility(order.id) !== undefined; }
  protected canCancel(order: SalesOrder): boolean { return this.store.canCancelSalesOrder(order); }
  protected quantities(order: SalesOrder, line: DocumentLine) { return this.store.orderLineQuantities(order.id, line.productId); }
  protected lineTotals(line: DocumentLine) { return this.store.lineTotals(line); }
  protected totals(order: SalesOrder) { return this.store.salesOrderTotals(order); }
  protected money(amount: number, currency: CurrencyCode): string { return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount); }
  protected deliveryReference(order: SalesOrder): string { const delivery = this.store.deliveries().find((candidate) => candidate.orderId === order.id); return delivery ? `Delivery ${delivery.reference} · ${delivery.status}` : 'No delivery created'; }
  protected statusTone(status: SalesOrderStatus): StatusTone { return statusTones[status]; }
}
