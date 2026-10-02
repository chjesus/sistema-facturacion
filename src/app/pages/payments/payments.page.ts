import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { PageHeadingComponent } from '../../shared/ui/page-heading.component';
import { PaymentWorkspaceComponent } from '../../widgets/payment-workspace/payment-workspace.component';

@Component({
  selector: 'app-payments-page',
  imports: [PageHeadingComponent, PaymentWorkspaceComponent],
  template: `
    <app-page-heading eyebrow="Settlement workspace" title="Register payment" description="Record a dated payment against the invoice that opened this workspace." />
    <app-payment-workspace [invoiceId]="invoiceId" />
  `,
})
export class PaymentsPage {
  private readonly route = inject(ActivatedRoute);
  protected readonly invoiceId = this.route.snapshot.queryParamMap.get('invoiceId');
}
