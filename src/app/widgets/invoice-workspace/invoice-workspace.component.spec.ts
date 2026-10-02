import { TestBed } from '@angular/core/testing';
import { LocalSalesCycleStore } from '../../entities/sales/api/local-sales-cycle-store.service';
import { InvoiceWorkspaceComponent } from './invoice-workspace.component';

describe('InvoiceWorkspaceComponent', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [InvoiceWorkspaceComponent],
    }).compileComponents();
  });

  it('owns invoice selection and composes focused invoice controls', () => {
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
    store.createInvoiceFromOrder(order.id);
    const fixture = TestBed.createComponent(InvoiceWorkspaceComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Invoice detail');
    expect(
      fixture.nativeElement.querySelector('app-publish-invoice'),
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('app-void-invoice'),
    ).not.toBeNull();
  });

  it('keeps voiding and payment navigation available for a published balance', () => {
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
    const fixture = TestBed.createComponent(InvoiceWorkspaceComponent);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('app-register-invoice-payment'),
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('app-void-invoice'),
    ).not.toBeNull();
  });
});
