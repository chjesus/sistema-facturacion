import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SalesOrdersPage } from './sales-orders.page';

describe('SalesOrdersPage', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [SalesOrdersPage], providers: [provideRouter([])] }).compileComponents();
  });

  it('composes the draft feature and order workspace', () => {
    const fixture = TestBed.createComponent(SalesOrdersPage);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-create-sales-order')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-sales-order-workspace')).not.toBeNull();
  });
});
