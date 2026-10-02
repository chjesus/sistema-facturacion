import { TestBed } from '@angular/core/testing';
import { LocalSalesCycleStore } from '../../entities/sales/api/local-sales-cycle-store.service';
import { ValidateDeliveryComponent } from './validate-delivery.component';

describe('ValidateDeliveryComponent', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [ValidateDeliveryComponent] }).compileComponents();
  });

  it('owns editable quantities and validates an atomic partial shipment', () => {
    const store = TestBed.inject(LocalSalesCycleStore);
    const product = store.inventory()[0];
    const order = store.createSalesOrder({ customerName: 'Acme', currency: 'USD', orderDate: '2026-10-02', lines: [{ productId: product.id, description: product.name, quantity: 2, unitPrice: 20 }] });
    store.confirmSalesOrder(order.id);
    const deliveryId = store.deliveries()[0].id;
    const fixture = TestBed.createComponent(ValidateDeliveryComponent);
    fixture.componentRef.setInput('delivery', store.deliveries()[0]);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;

    component.setShipmentQuantity(store.deliveries()[0].lines[0], 1);
    expect(component.canValidate()).toBe(true);
    component.validateDelivery();

    const validated = store.deliveries().find((delivery) => delivery.id === deliveryId);
    const backorder = store.deliveries().find((delivery) => delivery.parentDeliveryId === validated?.id);
    expect(validated).toMatchObject({ status: 'validated', lines: [{ quantity: 1 }] });
    expect(backorder).toMatchObject({ status: 'pending', parentDeliveryId: validated?.id, lines: [{ quantity: 1 }] });
  });
});
