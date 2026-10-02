import { TestBed } from '@angular/core/testing';
import { ButtonComponent } from './button.component';
import { FormFieldComponent } from './form-field.component';
import { PageHeadingComponent } from './page-heading.component';
import { PanelComponent } from './panel.component';
import { StatusBadgeComponent } from './status-badge.component';

describe('shared UI primitives', () => {
  it('renders a page heading from its public inputs', () => {
    const fixture = TestBed.createComponent(PageHeadingComponent);
    fixture.componentRef.setInput('eyebrow', 'Sales workspace');
    fixture.componentRef.setInput('title', 'Sales Orders');
    fixture.componentRef.setInput('description', 'Manage commitments.');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Sales workspace');
    expect(fixture.nativeElement.querySelector('h1')?.textContent).toContain('Sales Orders');
  });

  it('applies a status tone through its public API', () => {
    const fixture = TestBed.createComponent(StatusBadgeComponent);
    fixture.componentRef.setInput('label', 'Validated');
    fixture.componentRef.setInput('tone', 'success');
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('span') as HTMLElement;
    expect(badge.textContent).toContain('Validated');
    expect(badge.className).toContain('text-[#1a7f37]');
  });

  it('keeps panel, button, and form field APIs native and accessible', () => {
    const panel = TestBed.createComponent(PanelComponent);
    panel.componentRef.setInput('label', 'Payment details');
    panel.detectChanges();
    expect(panel.nativeElement.querySelector('section')?.getAttribute('aria-label')).toBe('Payment details');

    const button = TestBed.createComponent(ButtonComponent);
    button.componentRef.setInput('type', 'submit');
    button.componentRef.setInput('disabled', true);
    button.detectChanges();
    const nativeButton = button.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(nativeButton.type).toBe('submit');
    expect(nativeButton.disabled).toBe(true);

    const field = TestBed.createComponent(FormFieldComponent);
    field.componentRef.setInput('label', 'Reference');
    field.componentRef.setInput('forId', 'payment-reference');
    field.detectChanges();
    expect(field.nativeElement.querySelector('label')?.getAttribute('for')).toBe('payment-reference');
  });
});
