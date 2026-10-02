import { TestBed } from '@angular/core/testing';
import { LocalSalesCycleStore } from '../../entities/sales/api/local-sales-cycle-store.service';
import { ConfirmPaymentComponent } from './confirm-payment.component';

describe('ConfirmPaymentComponent', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [ConfirmPaymentComponent],
    }).compileComponents();
  });

  it('confirms the supplied payment id without changing its origin', () => {
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
    const payment = store.createPayment({
      invoiceId: invoice.id,
      currency: 'USD',
      amount: 5,
      paymentDate: '2026-10-02',
      method: 'cash',
      reference: 'RCPT-1',
    })!;
    const fixture = TestBed.createComponent(ConfirmPaymentComponent);
    fixture.componentRef.setInput('paymentId', payment.id);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('button').click();

    expect(
      store.payments().find((candidate) => candidate.id === payment.id)?.status,
    ).toBe('confirmed');
  });
});
