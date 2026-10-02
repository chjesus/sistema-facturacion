import { Component, Input, inject } from '@angular/core';
import { LocalSalesCycleStore } from '../../entities/sales/api/local-sales-cycle-store.service';
import { InvoiceId } from '../../entities/sales/model/sales.models';
import { ButtonComponent } from '../../shared/ui/button.component';

@Component({
  selector: 'app-void-invoice',
  imports: [ButtonComponent],
  template: `<app-button variant="danger" (click)="voidInvoice()">Void invoice</app-button>`,
})
export class VoidInvoiceComponent {
  @Input({ required: true }) invoiceId!: InvoiceId;
  private readonly store = inject(LocalSalesCycleStore);

  protected voidInvoice(): void { this.store.voidInvoice(this.invoiceId); }
}
