import { Component, inject } from '@angular/core';
import { LocalSalesCycleStore } from '../../entities/sales/api/local-sales-cycle-store.service';

const pageStyles = `
  .page-header { max-width: 620px; } .eyebrow { color: var(--accent); font-size: .75rem; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; } h1 { font-size: clamp(2.2rem, 6vw, 4rem); letter-spacing: -.06em; line-height: 1; margin: .5rem 0 1rem; } .page-header > p:last-child, .panel p { color: var(--muted); line-height: 1.6; } .panel { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; margin-top: 3rem; padding: 2rem; } h2 { font-size: 1.25rem; letter-spacing: -.03em; margin: .8rem 0 .5rem; } .status { background: #eef2ff; border-radius: 999px; color: #4338ca; font-size: .75rem; font-weight: 750; padding: .35rem .65rem; } small { color: var(--muted); display: block; margin-top: 1.5rem; }`;

@Component({
  selector: 'app-sales-orders-page',
  template: `
    <section class="page-header"><p class="eyebrow">Sales workspace</p><h1>Sales Orders</h1><p>Start and track customer commitments from one clear workspace.</p></section>
    <section class="panel"><span class="status">Foundation ready</span><h2>No sales orders yet</h2><p>Order creation and confirmation arrive in the next sales-cycle step.</p><small>{{ store.inventory().length }} inventory items are available locally.</small></section>
  `,
  styles: [pageStyles],
})
export class SalesOrdersPage {
  protected readonly store = inject(LocalSalesCycleStore);
}
