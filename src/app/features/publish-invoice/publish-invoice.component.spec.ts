import { TestBed } from '@angular/core/testing';
import { LocalSalesCycleStore } from '../../entities/sales/api/local-sales-cycle-store.service';
import { PublishInvoiceComponent } from './publish-invoice.component';

describe('PublishInvoiceComponent', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [PublishInvoiceComponent],
    }).compileComponents();
  });

  it('publishes the invoice passed to its focused control', () => {
    const store = TestBed.inject(LocalSalesCycleStore);
    const invoice = createEligibleInvoice(store);
    const fixture = TestBed.createComponent(PublishInvoiceComponent);
    fixture.componentRef.setInput('invoiceId', invoice.id);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector(
      'button',
    ) as HTMLButtonElement | null;
    expect(button).not.toBeNull();
    button?.click();

    expect(store.invoices()[0]).toMatchObject({
      status: 'published',
      issuedCurrency: 'USD',
    });
    expect(store.invoices()[0].number).toMatch(/^INV-\d{4}-\d{6}$/);
    expect(store.invoices()[0].vesFxRate).toBeGreaterThan(0);
  });
});

function createEligibleInvoice(store: LocalSalesCycleStore) {
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
  store.validateDelivery(store.deliveries()[0].id, store.deliveries()[0].lines);
  return store.createInvoiceFromOrder(order.id)!;
}
