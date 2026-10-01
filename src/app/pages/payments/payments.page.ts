import { Component, inject } from '@angular/core';
import { LocalSalesCycleStore } from '../../entities/sales/api/local-sales-cycle-store.service';

@Component({
  selector: 'app-payments-page',
  template: `<section><p>Sales workspace</p><h1>Payments</h1><div><span>Foundation ready</span><h2>No payments yet</h2><p>Seven days of USD, VES, and EUR rates are seeded locally for the future payment flow.</p><small>{{ store.exchangeRates().length }} rate entries available.</small></div></section>`,
  styles: [`p { color: var(--muted); } h1 { font-size: clamp(2.2rem, 6vw, 4rem); letter-spacing: -.06em; margin: .5rem 0 3rem; } div { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 2rem; } span { color: var(--accent); font-size: .75rem; font-weight: 800; text-transform: uppercase; } h2 { margin-bottom: .5rem; } div p { line-height: 1.6; } small { color: var(--muted); display: block; margin-top: 1.5rem; }`],
})
export class PaymentsPage {
  protected readonly store = inject(LocalSalesCycleStore);
}
