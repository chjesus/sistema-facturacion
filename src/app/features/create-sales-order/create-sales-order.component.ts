import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LocalSalesCycleStore } from '../../entities/sales/api/local-sales-cycle-store.service';
import { CurrencyCode, DocumentLine, ProductId } from '../../entities/sales/model/sales.models';
import { ButtonComponent } from '../../shared/ui/button.component';
import { FormFieldComponent } from '../../shared/ui/form-field.component';
import { PanelComponent } from '../../shared/ui/panel.component';

@Component({
  selector: 'app-create-sales-order',
  imports: [ButtonComponent, FormFieldComponent, FormsModule, PanelComponent],
  template: `
    <app-panel label="Create draft order" class="block self-start">
      <h2 class="mb-4 text-xl font-bold tracking-[-.03em] text-ink">Create draft order</h2>
      <form class="grid gap-3" (ngSubmit)="createOrder()">
        <app-form-field label="Customer"><input class="rounded-lg border border-border bg-white px-3 py-2.5 text-ink" name="customer" [(ngModel)]="customerName" placeholder="Customer name" required /></app-form-field>
        <div class="grid gap-3 sm:grid-cols-2">
          <app-form-field label="Order date"><input class="rounded-lg border border-border bg-white px-3 py-2.5 text-ink" name="orderDate" [(ngModel)]="orderDate" type="date" required /></app-form-field>
          <app-form-field label="Currency"><select class="rounded-lg border border-border bg-white px-3 py-2.5 text-ink" name="currency" [(ngModel)]="currency"><option value="USD">USD</option><option value="VES">VES</option><option value="EUR">EUR</option></select></app-form-field>
        </div>
        <div class="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,.45fr)_max-content]">
          <app-form-field label="Product" class="min-w-0"><select class="box-border min-w-0 w-full rounded-lg border border-border bg-white px-3 py-2.5 text-ink" name="product" [(ngModel)]="selectedProductId">@for (item of store.inventory(); track item.id) { <option [value]="item.id">{{ item.name }} · {{ item.sku }}</option> }</select></app-form-field>
          <app-form-field label="Quantity" class="min-w-0"><input class="box-border min-w-0 w-full rounded-lg border border-border bg-white px-3 py-2.5 text-ink" name="quantity" [(ngModel)]="quantity" type="number" min="1" /></app-form-field>
          <app-button type="button" variant="secondary" class="whitespace-nowrap" (click)="addLine()">Add line</app-button>
        </div>
        <p class="leading-relaxed text-muted">Suggested price: {{ money(store.suggestedUnitPrice(selectedProductId), currency) }}. You can override it below.</p>
        <div class="grid gap-3">
          @for (line of draftLines(); track line.productId) {
            <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-muted p-3">
              <span>{{ line.description }} × {{ line.quantity }}</span>
              <app-form-field label="Unit price"><input class="max-w-24 rounded-lg border border-border bg-white px-3 py-2.5 text-ink" [name]="'price-' + line.productId" [ngModel]="line.unitPrice" (ngModelChange)="updateLinePrice(line.productId, $event)" type="number" min="0" step="0.01" /></app-form-field>
              <app-button type="button" variant="danger" (click)="removeLine(line.productId)">Remove</app-button>
            </div>
          }
        </div>
        <app-button type="submit" [disabled]="!canCreate()">Create draft order</app-button>
      </form>
    </app-panel>
  `,
})
export class CreateSalesOrderComponent {
  protected readonly store = inject(LocalSalesCycleStore);
  protected customerName = '';
  protected currency: CurrencyCode = 'USD';
  protected orderDate = new Date().toISOString().slice(0, 10);
  protected selectedProductId = this.store.inventory()[0]?.id ?? ('' as ProductId);
  protected quantity = 1;
  protected readonly draftLines = signal<DocumentLine[]>([]);

  protected canCreate(): boolean { return this.customerName.trim().length > 0 && this.orderDate.length > 0 && this.draftLines().length > 0; }
  protected addLine(): void {
    const product = this.store.inventory().find((item) => item.id === this.selectedProductId);
    if (!product || !Number.isInteger(Number(this.quantity)) || Number(this.quantity) < 1) return;
    this.draftLines.update((lines) => {
      const existing = lines.find((line) => line.productId === product.id);
      return existing ? lines.map((line) => line.productId === product.id ? { ...line, quantity: line.quantity + Number(this.quantity) } : line) : [...lines, { productId: product.id, description: product.name, quantity: Number(this.quantity), unitPrice: this.store.suggestedUnitPrice(product.id) }];
    });
    this.quantity = 1;
  }
  protected updateLinePrice(productId: ProductId, value: number): void { if (Number.isFinite(Number(value)) && Number(value) >= 0) this.draftLines.update((lines) => lines.map((line) => line.productId === productId ? { ...line, unitPrice: Number(value) } : line)); }
  protected removeLine(productId: ProductId): void { this.draftLines.update((lines) => lines.filter((line) => line.productId !== productId)); }
  protected createOrder(): void {
    if (!this.canCreate()) return;
    this.store.createSalesOrder({ customerName: this.customerName, currency: this.currency, orderDate: this.orderDate, lines: this.draftLines() });
    this.customerName = '';
    this.currency = 'USD';
    this.orderDate = new Date().toISOString().slice(0, 10);
    this.draftLines.set([]);
  }
  protected money(amount: number, currency: CurrencyCode): string { return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount); }
}
