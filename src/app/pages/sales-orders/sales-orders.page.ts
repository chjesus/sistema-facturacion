import { Component } from '@angular/core';
import { CreateSalesOrderComponent } from '../../features/create-sales-order/create-sales-order.component';
import { SalesOrderWorkspaceComponent } from '../../widgets/sales-order-workspace/sales-order-workspace.component';
import { PageHeadingComponent } from '../../shared/ui/page-heading.component';

@Component({
  selector: 'app-sales-orders-page',
  imports: [CreateSalesOrderComponent, PageHeadingComponent, SalesOrderWorkspaceComponent],
  template: `
    <app-page-heading eyebrow="Sales workspace" title="Sales Orders" description="Start and track customer commitments from one clear workspace." />
    <section class="mt-10 grid gap-5 min-[761px]:grid-cols-[minmax(280px,.85fr)_minmax(0,1.15fr)]">
      <app-create-sales-order />
      <app-sales-order-workspace />
    </section>
  `,
})
export class SalesOrdersPage {}
