import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LocalSalesCycleStore } from '../../entities/sales/api/local-sales-cycle-store.service';
import {
  CurrencyCode,
  DocumentLine,
  ProductId,
} from '../../entities/sales/model/sales.models';
import { ButtonComponent } from '../../shared/ui/button.component';
import { FormFieldComponent } from '../../shared/ui/form-field.component';
import { PanelComponent } from '../../shared/ui/panel.component';

@Component({
  selector: 'app-create-sales-order',
  imports: [ButtonComponent, FormFieldComponent, FormsModule, PanelComponent],
  templateUrl: './create-sales-order.component.html',
})
export class CreateSalesOrderComponent {
  protected readonly store = inject(LocalSalesCycleStore);
  protected customerName = '';
  protected currency: CurrencyCode = 'USD';
  protected orderDate = new Date().toISOString().slice(0, 10);
  protected selectedProductId =
    this.store.inventory()[0]?.id ?? ('' as ProductId);
  protected quantity = 1;
  protected readonly draftLines = signal<DocumentLine[]>([]);

  protected canCreate(): boolean {
    return (
      this.customerName.trim().length > 0 &&
      this.orderDate.length > 0 &&
      this.draftLines().length > 0
    );
  }
  protected addLine(): void {
    const product = this.store
      .inventory()
      .find((item) => item.id === this.selectedProductId);
    if (
      !product ||
      !Number.isInteger(Number(this.quantity)) ||
      Number(this.quantity) < 1
    )
      return;
    this.draftLines.update((lines) => {
      const existing = lines.find((line) => line.productId === product.id);
      return existing
        ? lines.map((line) =>
            line.productId === product.id
              ? { ...line, quantity: line.quantity + Number(this.quantity) }
              : line,
          )
        : [
            ...lines,
            {
              productId: product.id,
              description: product.name,
              quantity: Number(this.quantity),
              unitPrice: this.store.suggestedUnitPrice(product.id),
            },
          ];
    });
    this.quantity = 1;
  }
  protected updateLinePrice(productId: ProductId, value: number): void {
    if (Number.isFinite(Number(value)) && Number(value) >= 0)
      this.draftLines.update((lines) =>
        lines.map((line) =>
          line.productId === productId
            ? { ...line, unitPrice: Number(value) }
            : line,
        ),
      );
  }
  protected removeLine(productId: ProductId): void {
    this.draftLines.update((lines) =>
      lines.filter((line) => line.productId !== productId),
    );
  }
  protected async createOrder(): Promise<void> {
    if (!this.canCreate()) return;
    await this.store.createSalesOrder({
      customerName: this.customerName,
      currency: this.currency,
      orderDate: this.orderDate,
      lines: this.draftLines(),
    });
    this.customerName = '';
    this.currency = 'USD';
    this.orderDate = new Date().toISOString().slice(0, 10);
    this.draftLines.set([]);
  }
  protected money(amount: number, currency: CurrencyCode): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  }
}
