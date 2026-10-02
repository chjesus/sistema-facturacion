import { Component } from '@angular/core';
import { PageHeadingComponent } from '../../shared/ui/page-heading.component';
import { DeliveryWorkspaceComponent } from '../../widgets/delivery-workspace/delivery-workspace.component';

@Component({
  selector: 'app-deliveries-page',
  imports: [DeliveryWorkspaceComponent, PageHeadingComponent],
  template: `
    <app-page-heading eyebrow="Warehouse workspace" title="Deliveries" description="Ship available goods, preserve their order source, and create backorders only for outstanding quantities." />
    <app-delivery-workspace />
  `,
})
export class DeliveriesPage {}
