import { Component } from '@angular/core';

@Component({
  selector: 'app-deliveries-page',
  template: `<section><p>Sales workspace</p><h1>Deliveries</h1><div><span>Foundation ready</span><h2>No deliveries yet</h2><p>Linked delivery validation will be introduced after sales-order confirmation.</p></div></section>`,
  styles: [`p { color: var(--muted); } h1 { font-size: clamp(2.2rem, 6vw, 4rem); letter-spacing: -.06em; margin: .5rem 0 3rem; } div { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 2rem; } span { color: var(--accent); font-size: .75rem; font-weight: 800; text-transform: uppercase; } h2 { margin-bottom: .5rem; } div p { line-height: 1.6; }`],
})
export class DeliveriesPage {}
