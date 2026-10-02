import { TestBed } from '@angular/core/testing';
import { LocalSalesCycleStore } from '../../entities/sales/api/local-sales-cycle-store.service';
import { DeliveryWorkspaceComponent } from './delivery-workspace.component';

describe('DeliveryWorkspaceComponent', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [DeliveryWorkspaceComponent],
    }).compileComponents();
  });

  it('owns list selection and composes focused pending-delivery controls', () => {
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
    const fixture = TestBed.createComponent(DeliveryWorkspaceComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Delivery detail');
    expect(
      fixture.nativeElement.querySelector('app-validate-delivery'),
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('app-cancel-delivery'),
    ).not.toBeNull();
  });
});
