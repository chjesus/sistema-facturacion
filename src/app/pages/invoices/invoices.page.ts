import { Component } from '@angular/core';
import { PageHeadingComponent } from '../../shared/ui/page-heading.component';
import { InvoiceWorkspaceComponent } from '../../widgets/invoice-workspace/invoice-workspace.component';

@Component({
  selector: 'app-invoices-page',
  imports: [InvoiceWorkspaceComponent, PageHeadingComponent],
  templateUrl: './invoices.page.html',
})
export class InvoicesPage {}
