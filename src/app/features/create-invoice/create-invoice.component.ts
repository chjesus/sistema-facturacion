import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { LocalSalesCycleStore } from '../../entities/sales/api/local-sales-cycle-store.service';
import {
  InvoiceId,
  SalesOrderId,
} from '../../entities/sales/model/sales.models';
import { ButtonComponent } from '../../shared/ui/button.component';

@Component({
  selector: 'app-create-invoice',
  imports: [ButtonComponent],
  templateUrl: './create-invoice.component.html',
})
export class CreateInvoiceComponent {
  @Input({ required: true }) orderId!: SalesOrderId;
  @Output() readonly invoiceCreated = new EventEmitter<InvoiceId>();

  private readonly store = inject(LocalSalesCycleStore);

  protected createInvoice(): void {
    const invoice = this.store.createInvoiceFromOrder(this.orderId);
    if (invoice instanceof Promise) {
      void invoice.then((created) => {
        if (created) this.invoiceCreated.emit(created.id);
      });
    } else if (invoice) {
      this.invoiceCreated.emit(invoice.id);
    }
  }
}
