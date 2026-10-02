import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-application-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="min-h-dvh">
      <header class="sticky top-0 z-10 flex items-center justify-between gap-8 border-b border-border bg-white/88 px-[max(1.25rem,calc((100%-1120px)/2))] py-4 backdrop-blur-[14px] max-sm:flex-col max-sm:items-start max-sm:gap-3">
        <a class="inline-flex items-center gap-[.65rem] whitespace-nowrap text-base font-[750] tracking-[-.03em] text-ink no-underline" routerLink="/sales-orders" aria-label="Sales cycle home">
          <span class="inline-flex h-7 w-7 items-center justify-center rounded-[9px] bg-ink text-[.8rem] text-white">S</span>
          <span>Sales Cycle</span>
        </a>
        <nav class="flex gap-1 overflow-x-auto" aria-label="Sales cycle navigation">
          @for (item of navigation; track item.path) {
            <a class="whitespace-nowrap rounded-lg px-3 py-[.55rem] text-sm font-[650] text-muted no-underline hover:bg-surface-muted hover:text-ink" routerLinkActive="bg-surface-muted text-ink" [routerLink]="item.path">{{ item.label }}</a>
          }
        </nav>
      </header>
      <main class="mx-auto max-w-[1120px] px-5 py-14 max-sm:pt-8">
        <router-outlet />
      </main>
    </div>
  `,
})
export class ApplicationShellComponent {
  protected readonly navigation = [
    { label: 'Sales Orders', path: '/sales-orders' },
    { label: 'Deliveries', path: '/deliveries' },
    { label: 'Invoices', path: '/invoices' },
    { label: 'Payments', path: '/payments' },
  ];
}
