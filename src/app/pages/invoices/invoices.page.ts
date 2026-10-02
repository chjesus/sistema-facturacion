import { Component } from '@angular/core';
import { PageHeadingComponent } from '../../shared/ui/page-heading.component';
import { InvoiceWorkspaceComponent } from '../../widgets/invoice-workspace/invoice-workspace.component';

@Component({
  selector: 'app-invoices-page',
  imports: [InvoiceWorkspaceComponent, PageHeadingComponent],
  template: `
    <app-page-heading eyebrow="Billing workspace" title="Invoices" description="Invoice validated delivery quantities with immutable publication and tax snapshots." />
    <app-invoice-workspace />
  `,
})
export class InvoicesPage {}
