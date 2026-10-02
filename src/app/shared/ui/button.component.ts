import { Component, Input } from '@angular/core';

export type ButtonVariant = 'primary' | 'secondary' | 'danger';

@Component({
  selector: 'app-button',
  template: `
    <button [type]="type" [disabled]="disabled" class="cursor-pointer rounded-lg px-4 py-[.7rem] font-[750] disabled:cursor-not-allowed disabled:opacity-45" [class]="variantClass">
      <ng-content />
    </button>
  `,
})
export class ButtonComponent {
  @Input() disabled = false;
  @Input() type: 'button' | 'submit' = 'button';
  @Input() variant: ButtonVariant = 'primary';

  protected get variantClass(): string {
    return this.variant === 'primary'
      ? 'bg-accent text-white shadow-[0_1px_2px_rgb(79_70_229_/_0.25)] hover:not-disabled:bg-[#4338ca]'
      : this.variant === 'danger'
        ? 'bg-surface-muted text-[#b42318]'
        : 'border border-border bg-surface text-ink';
  }
}
