import { Component, computed, inject, signal } from '@angular/core';
import { LocalSalesCycleStore } from '../../entities/sales/api/local-sales-cycle-store.service';
import {
  Invoice,
  InvoiceId,
  InvoiceStatus,
  SalesOrderId,
} from '../../entities/sales/model/sales.models';
import { CreateInvoiceComponent } from '../../features/create-invoice/create-invoice.component';
import { PublishInvoiceComponent } from '../../features/publish-invoice/publish-invoice.component';
import { RegisterInvoicePaymentComponent } from '../../features/register-invoice-payment/register-invoice-payment.component';
import { VoidInvoiceComponent } from '../../features/void-invoice/void-invoice.component';
import { PanelComponent } from '../../shared/ui/panel.component';
import {
  StatusBadgeComponent,
  StatusTone,
} from '../../shared/ui/status-badge.component';

const statusTones: Record<InvoiceStatus, StatusTone> = {
  draft: 'warning',
  published: 'info',
  partial: 'info',
  paid: 'success',
  voided: 'danger',
};

@Component({
  selector: 'app-invoice-workspace',
  imports: [
    CreateInvoiceComponent,
    PanelComponent,
    PublishInvoiceComponent,
    RegisterInvoicePaymentComponent,
    StatusBadgeComponent,
    VoidInvoiceComponent,
  ],
  templateUrl: './invoice-workspace.component.html',
})
export class InvoiceWorkspaceComponent {
  protected readonly store = inject(LocalSalesCycleStore);
  protected readonly selectedInvoiceId = signal<InvoiceId | undefined>(
    this.store.invoices()[0]?.id,
  );
  protected readonly selectedInvoice = computed(() =>
    this.store
      .invoices()
      .find((invoice) => invoice.id === this.selectedInvoiceId()),
  );
  protected readonly invoiceableOrders = computed(() =>
    this.store
      .salesOrders()
      .filter((order) => this.store.invoiceEligibility(order.id) !== undefined),
  );

  protected selectInvoice(invoiceId: InvoiceId): void {
    this.selectedInvoiceId.set(invoiceId);
  }
  protected pendingQuantity(orderId: SalesOrderId): number {
    return (
      this.store
        .invoiceEligibility(orderId)
        ?.lines.reduce((total, line) => total + line.quantity, 0) ?? 0
    );
  }
  protected totals(invoice: Invoice) {
    return this.store.invoiceTotals(invoice);
  }
  protected statusTone(status: InvoiceStatus): StatusTone {
    return statusTones[status];
  }
  protected money(amount: number, currency: Invoice['currency']): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  }
}
