import { TestBed } from '@angular/core/testing';
import { LocalSalesCycleStore } from '../../entities/sales/api/local-sales-cycle-store.service';
import { CreateInvoiceComponent } from './create-invoice.component';

describe('CreateInvoiceComponent', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [CreateInvoiceComponent] }).compileComponents();
  });

  it('creates an invoice only from eligible delivered quantities and emits its selection', () => {
    const store = TestBed.inject(LocalSalesCycleStore);
    const product = store.inventory()[0];
    const order = store.createSalesOrder({ customerName: 'Acme', currency: 'USD', orderDate: '2026-10-02', lines: [{ productId: product.id, description: product.name, quantity: 1, unitPrice: 20 }] });
    store.confirmSalesOrder(order.id);
    store.validateDelivery(store.deliveries()[0].id, store.deliveries()[0].lines);
    const fixture = TestBed.createComponent(CreateInvoiceComponent);
    const created: string[] = [];
    fixture.componentInstance.invoiceCreated.subscribe((id) => created.push(id));
    fixture.componentRef.setInput('orderId', order.id);
    fixture.detectChanges();

    (fixture.componentInstance as any).createInvoice();

    expect(store.invoices()).toHaveLength(1);
    expect(created).toEqual([store.invoices()[0].id]);
  });
});
