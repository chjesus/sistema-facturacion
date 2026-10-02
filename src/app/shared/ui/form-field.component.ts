import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-form-field',
  template: `
    <label class="grid gap-[.35rem] text-[.8rem] font-bold text-muted" [attr.for]="forId || null">
      {{ label }}
      <ng-content />
    </label>
  `,
})
export class FormFieldComponent {
  @Input({ required: true }) label = '';
  @Input() forId = '';
}
