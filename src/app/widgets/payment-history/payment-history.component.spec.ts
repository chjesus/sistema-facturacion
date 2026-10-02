import { TestBed } from '@angular/core/testing';
import { LocalSalesCycleStore } from '../../entities/sales/api/local-sales-cycle-store.service';
import { PaymentHistoryComponent } from './payment-history.component';

describe('PaymentHistoryComponent', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [PaymentHistoryComponent],
    }).compileComponents();
  });

  it('composes draft confirmation and void controls for the invoice history', () => {
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
    store.publishInvoice(invoice.id);
    store.createPayment({
      invoiceId: invoice.id,
      currency: 'USD',
      amount: 5,
      paymentDate: '2026-10-02',
      method: 'cash',
      reference: 'RCPT-1',
    });
    const fixture = TestBed.createComponent(PaymentHistoryComponent);
    fixture.componentRef.setInput('invoiceId', invoice.id);
    fixture.componentRef.setInput('currency', invoice.currency);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('app-confirm-payment'),
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('app-void-payment'),
    ).not.toBeNull();
  });
});
