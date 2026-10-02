import { Component } from '@angular/core';
import { CreateSalesOrderComponent } from '../../features/create-sales-order/create-sales-order.component';
import { SalesOrderWorkspaceComponent } from '../../widgets/sales-order-workspace/sales-order-workspace.component';
import { PageHeadingComponent } from '../../shared/ui/page-heading.component';

@Component({
  selector: 'app-sales-orders-page',
  imports: [
    CreateSalesOrderComponent,
    PageHeadingComponent,
    SalesOrderWorkspaceComponent,
  ],
  templateUrl: './sales-orders.page.html',
})
export class SalesOrdersPage {}
