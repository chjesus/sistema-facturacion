import { Component } from '@angular/core';
import { PageHeadingComponent } from '../../shared/ui/page-heading.component';
import { DeliveryWorkspaceComponent } from '../../widgets/delivery-workspace/delivery-workspace.component';

@Component({
  selector: 'app-deliveries-page',
  imports: [DeliveryWorkspaceComponent, PageHeadingComponent],
  templateUrl: './deliveries.page.html',
})
export class DeliveriesPage {}
