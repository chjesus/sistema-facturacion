import { TestBed } from '@angular/core/testing';
import { LocalSalesCycleStore } from '../../entities/sales/api/local-sales-cycle-store.service';
import { VoidInvoiceComponent } from './void-invoice.component';

describe('VoidInvoiceComponent', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [VoidInvoiceComponent],
    }).compileComponents();
  });

  it('voids the invoice passed to its focused control', () => {
    const store = TestBed.inject(LocalSalesCycleStore);
    const product = store.inventory()[0];
    const order = store.createSalesOrder({
      customerName: 'Acme',
      currency: 'USD',
      orderDate: '2026-10-02',
      lines: [
        {
          productId: product.id,
          description: product.name,
          quantity: 1,
          unitPrice: 20,
        },
      ],
    });
    store.confirmSalesOrder(order.id);
    store.validateDelivery(
      store.deliveries()[0].id,
      store.deliveries()[0].lines,
    );
    const invoice = store.createInvoiceFromOrder(order.id)!;
    const fixture = TestBed.createComponent(VoidInvoiceComponent);
    fixture.componentRef.setInput('invoiceId', invoice.id);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector(
      'button',
    ) as HTMLButtonElement | null;
    expect(button).not.toBeNull();
    button?.click();

    expect(store.invoices()[0].status).toBe('voided');
  });
});
