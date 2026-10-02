import { TestBed } from '@angular/core/testing';
import { LocalSalesCycleStore } from '../../entities/sales/api/local-sales-cycle-store.service';
import { CancelDeliveryComponent } from './cancel-delivery.component';

describe('CancelDeliveryComponent', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [CancelDeliveryComponent] }).compileComponents();
  });

  it('cancels the delivery passed to its focused control', () => {
    const store = TestBed.inject(LocalSalesCycleStore);
    const product = store.inventory()[0];
    const order = store.createSalesOrder({ customerName: 'Acme', currency: 'USD', orderDate: '2026-10-02', lines: [{ productId: product.id, description: product.name, quantity: 1, unitPrice: 20 }] });
    store.confirmSalesOrder(order.id);
    const fixture = TestBed.createComponent(CancelDeliveryComponent);
    fixture.componentRef.setInput('deliveryId', store.deliveries()[0].id);
    fixture.detectChanges();

    (fixture.componentInstance as any).cancel();

    expect(store.deliveries()[0].status).toBe('cancelled');
  });
});
