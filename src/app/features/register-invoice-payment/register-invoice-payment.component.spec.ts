import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { vi } from 'vitest';
import { LocalSalesCycleStore } from '../../entities/sales/api/local-sales-cycle-store.service';
import { RegisterInvoicePaymentComponent } from './register-invoice-payment.component';

describe('RegisterInvoicePaymentComponent', () => {
  const navigate = vi.fn();

  beforeEach(async () => {
    navigate.mockReset();
    await TestBed.configureTestingModule({
      imports: [RegisterInvoicePaymentComponent],
      providers: [{ provide: Router, useValue: { navigate } }],
    }).compileComponents();
  });

  it('navigates to payments with the selected invoice origin', () => {
    const store = TestBed.inject(LocalSalesCycleStore);
    const product = store.inventory()[0];
    const order = store.createSalesOrder({ customerName: 'Acme', currency: 'USD', orderDate: '2026-10-02', lines: [{ productId: product.id, description: product.name, quantity: 1, unitPrice: 20 }] });
    store.confirmSalesOrder(order.id);
    store.validateDelivery(store.deliveries()[0].id, store.deliveries()[0].lines);
    const invoice = store.createInvoiceFromOrder(order.id)!;
    store.publishInvoice(invoice.id);
    const fixture = TestBed.createComponent(RegisterInvoicePaymentComponent);
    fixture.componentRef.setInput('invoice', store.invoices()[0]);
    fixture.detectChanges();

    (fixture.componentInstance as any).registerPayment();

    expect(navigate).toHaveBeenCalledWith(['/payments'], { queryParams: { invoiceId: invoice.id } });
  });
});
