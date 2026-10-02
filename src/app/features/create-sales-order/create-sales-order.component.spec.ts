import { TestBed } from '@angular/core/testing';
import { LocalSalesCycleStore } from '../../entities/sales/api/local-sales-cycle-store.service';
import { CreateSalesOrderComponent } from './create-sales-order.component';

describe('CreateSalesOrderComponent', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [CreateSalesOrderComponent],
    }).compileComponents();
  });

  it('creates a draft with the suggested price, retaining editable price overrides', () => {
    const fixture = TestBed.createComponent(CreateSalesOrderComponent);
    const component = fixture.componentInstance as unknown as {
      customerName: string;
      addLine(): void;
      updateLinePrice(productId: string, value: number): void;
      createOrder(): void;
    };
    const store = TestBed.inject(LocalSalesCycleStore);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Suggested price: $49.95',
    );
    component.customerName = 'Acme';
    component.addLine();
    component.updateLinePrice(store.inventory()[0].id, 80);
    component.createOrder();

    expect(store.salesOrders()).toHaveLength(1);
    expect(store.salesOrders()[0]).toMatchObject({
      customerName: 'Acme',
      status: 'draft',
    });
    expect(store.salesOrders()[0].lines[0].unitPrice).toBe(80);
  });
});
