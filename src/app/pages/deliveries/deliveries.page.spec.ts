import { TestBed } from '@angular/core/testing';
import { DeliveriesPage } from './deliveries.page';

describe('DeliveriesPage', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [DeliveriesPage] }).compileComponents();
  });

  it('composes the delivery workspace', () => {
    const fixture = TestBed.createComponent(DeliveriesPage);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-delivery-workspace')).not.toBeNull();
  });
});
