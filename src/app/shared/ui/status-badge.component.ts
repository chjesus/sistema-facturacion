import { Component, Input } from '@angular/core';

export type StatusTone = 'neutral' | 'warning' | 'info' | 'success' | 'danger';

@Component({
  selector: 'app-status-badge',
  template: `<span class="inline-flex rounded-full px-2.5 py-1 text-xs font-extrabold capitalize" [class]="toneClass">{{ label }}</span>`,
})
export class StatusBadgeComponent {
  @Input({ required: true }) label = '';
  @Input() tone: StatusTone = 'neutral';

  protected get toneClass(): string {
    return {
      neutral: 'bg-surface-muted text-ink',
      warning: 'bg-[#fff7e6] text-[#9a6700]',
      info: 'bg-[#eef2ff] text-[#4338ca]',
      success: 'bg-[#e8f5ed] text-[#1a7f37]',
      danger: 'bg-[#fef3f2] text-[#b42318]',
    }[this.tone];
  }
}
