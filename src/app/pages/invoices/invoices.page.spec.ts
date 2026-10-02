import { TestBed } from '@angular/core/testing';
import { InvoicesPage } from './invoices.page';

describe('InvoicesPage', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [InvoicesPage] }).compileComponents();
  });

  it('composes the invoice workspace', () => {
    const fixture = TestBed.createComponent(InvoicesPage);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-invoice-workspace')).not.toBeNull();
  });
});
