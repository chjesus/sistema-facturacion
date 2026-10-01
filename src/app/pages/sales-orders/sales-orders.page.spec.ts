import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LocalSalesCycleStore } from '../../entities/sales/api/local-sales-cycle-store.service';
import { SalesOrdersPage } from './sales-orders.page';

describe('SalesOrdersPage', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [SalesOrdersPage], providers: [provideRouter([])] }).compileComponents();
  });

  it('enables the invoice CTA only for the store eligibility and displays quantity projections', () => {
    const store = TestBed.inject(LocalSalesCycleStore);
    const product = store.inventory()[0];
    const order = store.createSalesOrder({ customerName: 'Acme', currency: 'USD', orderDate: '2026-10-01', lines: [{ productId: product.id, description: product.name, quantity: 2, unitPrice: 20 }] });
    store.confirmSalesOrder(order.id);
    const fixture = TestBed.createComponent(SalesOrdersPage);
    fixture.detectChanges();

    const invoiceButton = [...fixture.nativeElement.querySelectorAll('button')].find((button: HTMLButtonElement) => button.textContent?.trim() === 'Create invoice') as HTMLButtonElement;
    expect(invoiceButton.disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Ordered 2 · Delivered 0 · Invoiced 0');

    store.validateDelivery(store.deliveries()[0].id);
    fixture.detectChanges();
    expect(invoiceButton.disabled).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Ordered 2 · Delivered 2 · Invoiced 0');
  });
});
