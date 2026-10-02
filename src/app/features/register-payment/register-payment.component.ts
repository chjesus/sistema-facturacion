import { Component, Input, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LocalSalesCycleStore } from '../../entities/sales/api/local-sales-cycle-store.service';
import {
  CurrencyCode,
  Invoice,
  PaymentMethod,
} from '../../entities/sales/model/sales.models';
import { ButtonComponent } from '../../shared/ui/button.component';
import { FormFieldComponent } from '../../shared/ui/form-field.component';
import { PanelComponent } from '../../shared/ui/panel.component';

@Component({
  selector: 'app-register-payment',
  imports: [ButtonComponent, FormFieldComponent, FormsModule, PanelComponent],
  templateUrl: './register-payment.component.html',
})
export class RegisterPaymentComponent {
  @Input({ required: true }) invoice!: Invoice;
  protected readonly store = inject(LocalSalesCycleStore);
  protected paymentDate = new Date().toISOString().slice(0, 10);
  protected currency: CurrencyCode = 'USD';
  protected amount = 0;
  protected method: PaymentMethod = 'bank transfer';
  protected reference = '';
  protected adjustedRate: number | null = null;

  protected preview() {
    return this.store.paymentPreview(
      this.invoice,
      this.currency,
      Number(this.amount),
      this.paymentDate,
      this.adjustedRate ?? undefined,
    );
  }
  protected canCreate(): boolean {
    return (
      !!this.preview() && this.reference.trim().length > 0 && !!this.method
    );
  }
  protected async createPayment(): Promise<void> {
    const payment = await this.store.createPayment({
      invoiceId: this.invoice.id,
      currency: this.currency,
      amount: Number(this.amount),
      paymentDate: this.paymentDate,
      method: this.method,
      reference: this.reference,
      adjustedRate: this.adjustedRate ?? undefined,
    });
    if (payment) this.reference = '';
  }
  protected money(amount: number, currency: CurrencyCode): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  }
}
