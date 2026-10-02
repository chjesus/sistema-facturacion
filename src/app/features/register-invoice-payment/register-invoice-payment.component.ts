import { Component, Input, inject } from '@angular/core';
import { Router } from '@angular/router';
import { LocalSalesCycleStore } from '../../entities/sales/api/local-sales-cycle-store.service';
import { Invoice } from '../../entities/sales/model/sales.models';
import { ButtonComponent } from '../../shared/ui/button.component';

@Component({
  selector: 'app-register-invoice-payment',
  imports: [ButtonComponent],
  templateUrl: './register-invoice-payment.component.html',
})
export class RegisterInvoicePaymentComponent {
  @Input({ required: true }) invoice!: Invoice;
  protected readonly store = inject(LocalSalesCycleStore);
  private readonly router = inject(Router);

  protected registerPayment(): void {
    void this.router.navigate(['/payments'], {
      queryParams: { invoiceId: this.invoice.id },
    });
  }
}
