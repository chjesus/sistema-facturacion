import { Component, Input, inject } from '@angular/core';
import { LocalSalesCycleStore } from '../../entities/sales/api/local-sales-cycle-store.service';
import { InvoiceId } from '../../entities/sales/model/sales.models';
import { ButtonComponent } from '../../shared/ui/button.component';

@Component({
  selector: 'app-publish-invoice',
  imports: [ButtonComponent],
  template: `<app-button class="block [&>button]:min-h-[2.8rem] [&>button]:w-full" (click)="publishInvoice()">Publish invoice</app-button>`,
})
export class PublishInvoiceComponent {
  @Input({ required: true }) invoiceId!: InvoiceId;
  private readonly store = inject(LocalSalesCycleStore);

  protected publishInvoice(): void { this.store.publishInvoice(this.invoiceId); }
}
