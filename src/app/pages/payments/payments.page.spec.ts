import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { LocalSalesCycleStore } from '../../entities/sales/api/local-sales-cycle-store.service';
import { PaymentsPage } from './payments.page';

describe('PaymentsPage', () => {
  beforeEach(() => localStorage.clear());

  it('uses the invoice route context as a read-only payment origin', async () => {
    TestBed.configureTestingModule({});
    const store = TestBed.inject(LocalSalesCycleStore);
    const product = store.inventory()[0];
    const order = store.createSalesOrder({ customerName: 'Acme', currency: 'USD', lines: [{ productId: product.id, description: product.name, quantity: 1, unitPrice: 100 }] });
    store.confirmSalesOrder(order.id);
    store.validateDelivery(store.deliveries()[0].id);
    const invoice = store.createInvoiceFromOrder(order.id)!;
    store.publishInvoice(invoice.id);

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [PaymentsPage],
      providers: [{ provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({ invoiceId: invoice.id }) } } }],
    }).compileComponents();
    const fixture = TestBed.createComponent(PaymentsPage);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(store.invoices().find((candidate) => candidate.id === invoice.id)?.number);
    expect(fixture.nativeElement.querySelector('select[name="invoice"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('input[name="paymentDate"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('input[name="reference"]')).not.toBeNull();
  });
});
