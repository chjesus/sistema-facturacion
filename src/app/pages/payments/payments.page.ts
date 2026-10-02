import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { LocalSalesCycleStore } from '../../entities/sales/api/local-sales-cycle-store.service';
import { InvoiceId } from '../../entities/sales/model/sales.models';
import { PageHeadingComponent } from '../../shared/ui/page-heading.component';
import { PaymentWorkspaceComponent } from '../../widgets/payment-workspace/payment-workspace.component';

@Component({
  selector: 'app-payments-page',
  imports: [PageHeadingComponent, PaymentWorkspaceComponent],
  template: `
    <app-page-heading eyebrow="Settlement workspace" title="Register payment" description="Record a dated payment against the invoice that opened this workspace." />
    <app-payment-workspace [invoice]="selectedInvoice()" />
  `,
})
export class PaymentsPage {
  private readonly store = inject(LocalSalesCycleStore);
  private readonly route = inject(ActivatedRoute);
  protected readonly invoiceId = this.route.snapshot.queryParamMap.get('invoiceId') as InvoiceId | null;
  protected readonly selectedInvoice = computed(() => {
    const invoice = this.store.invoices().find((candidate) => candidate.id === this.invoiceId);
    return invoice && (invoice.status === 'published' || invoice.status === 'partial') && this.store.invoiceBalance(invoice) > 0 ? invoice : undefined;
  });
}
