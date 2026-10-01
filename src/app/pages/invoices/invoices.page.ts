import { Component } from '@angular/core';

@Component({
  selector: 'app-invoices-page',
  template: `<section><p>Sales workspace</p><h1>Invoices</h1><div><span>Foundation ready</span><h2>No invoices yet</h2><p>Invoices will be created from delivered quantities in a later step.</p></div></section>`,
  styles: [`p { color: var(--muted); } h1 { font-size: clamp(2.2rem, 6vw, 4rem); letter-spacing: -.06em; margin: .5rem 0 3rem; } div { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 2rem; } span { color: var(--accent); font-size: .75rem; font-weight: 800; text-transform: uppercase; } h2 { margin-bottom: .5rem; } div p { line-height: 1.6; }`],
})
export class InvoicesPage {}
