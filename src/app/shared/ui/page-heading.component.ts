import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-page-heading',
  template: `
    <header class="max-w-[620px]">
      @if (eyebrow) { <p class="text-xs font-extrabold tracking-[.12em] text-accent uppercase">{{ eyebrow }}</p> }
      <h1 class="my-2 text-[clamp(2.2rem,6vw,4rem)] leading-none font-bold tracking-[-.06em] text-ink">{{ title }}</h1>
      @if (description) { <p class="mt-4 leading-relaxed text-muted">{{ description }}</p> }
    </header>
  `,
})
export class PageHeadingComponent {
  @Input() eyebrow = '';
  @Input({ required: true }) title = '';
  @Input() description = '';
}
