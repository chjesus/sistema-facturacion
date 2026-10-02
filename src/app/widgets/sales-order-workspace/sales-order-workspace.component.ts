import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { LocalSalesCycleStore } from '../../entities/sales/api/local-sales-cycle-store.service';
import {
  CurrencyCode,
  DocumentLine,
  SalesOrder,
  SalesOrderStatus,
} from '../../entities/sales/model/sales.models';
import { ButtonComponent } from '../../shared/ui/button.component';
import { PanelComponent } from '../../shared/ui/panel.component';
import {
  StatusBadgeComponent,
  StatusTone,
} from '../../shared/ui/status-badge.component';

const statusTones: Record<SalesOrderStatus, StatusTone> = {
  draft: 'warning',
  confirmed: 'success',
  completed: 'success',
  cancelled: 'danger',
};

@Component({
  selector: 'app-sales-order-workspace',
  imports: [ButtonComponent, PanelComponent, StatusBadgeComponent],
  templateUrl: './sales-order-workspace.component.html',
})
export class SalesOrderWorkspaceComponent {
  protected readonly store = inject(LocalSalesCycleStore);
  private readonly router = inject(Router);

  protected confirmOrder(order: SalesOrder): void {
    this.store.confirmSalesOrder(order.id);
  }
  protected cancelOrder(order: SalesOrder): void {
    this.store.cancelSalesOrder(order.id);
  }
  protected createInvoice(order: SalesOrder): void {
    if (this.store.createInvoiceFromOrder(order.id))
      void this.router.navigate(['/invoices']);
  }
  protected invoiceEligible(order: SalesOrder): boolean {
    return this.store.invoiceEligibility(order.id) !== undefined;
  }
  protected canCancel(order: SalesOrder): boolean {
    return this.store.canCancelSalesOrder(order);
  }
  protected quantities(order: SalesOrder, line: DocumentLine) {
    return this.store.orderLineQuantities(order.id, line.productId);
  }
  protected lineTotals(line: DocumentLine) {
    return this.store.lineTotals(line);
  }
  protected totals(order: SalesOrder) {
    return this.store.salesOrderTotals(order);
  }
  protected money(amount: number, currency: CurrencyCode): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  }
  protected deliveryReference(order: SalesOrder): string {
    const delivery = this.store
      .deliveries()
      .find((candidate) => candidate.orderId === order.id);
    return delivery
      ? `Delivery ${delivery.reference} · ${delivery.status}`
      : 'No delivery created';
  }
  protected statusTone(status: SalesOrderStatus): StatusTone {
    return statusTones[status];
  }
}
