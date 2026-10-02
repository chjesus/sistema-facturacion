import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-panel',
  template: `
    <section class="border border-border bg-surface p-5 rounded-panel" [attr.aria-label]="label || null">
      <ng-content />
    </section>
  `,
})
export class PanelComponent {
  @Input() label = '';
}
