import { TestBed } from '@angular/core/testing';
import { LocalSalesCycleStore } from './local-sales-cycle-store.service';

describe('LocalSalesCycleStore', () => {
  let store: LocalSalesCycleStore;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    store = TestBed.inject(LocalSalesCycleStore);
  });

  it('creates one pending linked delivery when a draft order is confirmed', () => {
    const product = store.inventory()[0];
    const order = store.createSalesOrder({
      customerName: 'Northstar Studio',
      currency: 'EUR',
      lines: [{ productId: product.id, description: product.name, quantity: 2, unitPrice: 0 }],
    });

    store.confirmSalesOrder(order.id);
    store.confirmSalesOrder(order.id);

    expect(store.salesOrders()[0].status).toBe('confirmed');
    expect(store.deliveries()).toHaveLength(1);
    expect(store.deliveries()[0]).toMatchObject({ orderId: order.id, orderReference: order.reference, status: 'pending' });
    expect(JSON.parse(localStorage.getItem('sales-cycle-state-v1') ?? '{}').deliveries).toHaveLength(1);
  });

  it('cancels a draft order without creating a delivery', () => {
    const order = store.createSalesOrder({ customerName: 'Acme', currency: 'USD', lines: [] });

    store.cancelSalesOrder(order.id);

    expect(store.salesOrders()[0].status).toBe('cancelled');
    expect(store.deliveries()).toHaveLength(0);
  });

  it('uses suggested prices, preserves overrides and rounds line and order VAT totals consistently', () => {
    const product = store.inventory()[0];
    const order = store.createSalesOrder({
      customerName: 'Northstar Studio',
      currency: 'USD',
      orderDate: '2026-10-01',
      lines: [{ productId: product.id, description: product.name, quantity: 3, unitPrice: 10.005 }],
    });

    expect(store.suggestedUnitPrice(product.id)).toBe(49.95);
    expect(order).toMatchObject({ orderDate: '2026-10-01', lines: [{ unitPrice: 10.01 }] });
    expect(store.lineTotals(order.lines[0])).toEqual({ subtotal: 30.03, vat: 4.8, total: 34.83 });
    expect(store.salesOrderTotals(order)).toEqual({ subtotal: 30.03, vat: 4.8, total: 34.83 });
  });

  it('migrates missing and zero prices for known persisted fixtures without changing custom products', () => {
    localStorage.setItem('sales-cycle-state-v1', JSON.stringify({
      salesOrders: [], deliveries: [], invoices: [], payments: [], exchangeRates: [],
      inventory: [
        { id: 'desk-lamp', sku: 'LGT-001', name: 'Arc Desk Lamp', availableQuantity: 24, unit: 'units' },
        { id: 'notebook', sku: 'OFF-014', name: 'Hardcover Notebook', availableQuantity: 80, unit: 'units', suggestedUnitPrice: 0 },
        { id: 'chair', sku: 'FUR-020', name: 'Ergonomic Chair', availableQuantity: 12, unit: 'units', suggestedUnitPrice: 275 },
        { id: 'legacy-product', sku: 'LEG-001', name: 'Legacy Product', availableQuantity: 1, unit: 'units' },
        { id: 'custom-product', sku: 'CUS-001', name: 'Custom Product', availableQuantity: 1, unit: 'units', suggestedUnitPrice: 19.99 },
      ],
    }));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const legacyStore = TestBed.inject(LocalSalesCycleStore);

    expect(legacyStore.inventory().map((item) => item.suggestedUnitPrice)).toEqual([49.95, 12.5, 275, 0, 19.99]);
    expect(JSON.parse(localStorage.getItem('sales-cycle-state-v1') ?? '{}').inventory.map((item: { suggestedUnitPrice: number }) => item.suggestedUnitPrice)).toEqual([49.95, 12.5, 275, 0, 19.99]);
  });

  it('keeps confirmed orders immutable while creating exactly one pending delivery', () => {
    const product = store.inventory()[0];
    const order = store.createSalesOrder({ customerName: 'Acme', currency: 'USD', orderDate: '2026-10-01', lines: [{ productId: product.id, description: product.name, quantity: 1, unitPrice: 20 }] });
    store.confirmSalesOrder(order.id);
    store.updateSalesOrder({ id: order.id, customerName: 'Changed', currency: 'EUR', orderDate: '2026-10-02', lines: [] });
    store.confirmSalesOrder(order.id);

    expect(store.salesOrders()[0]).toMatchObject({ customerName: 'Acme', currency: 'USD', orderDate: '2026-10-01', status: 'confirmed' });
    expect(store.deliveries()).toHaveLength(1);
  });

  it('projects ordered, delivered, and invoiced quantities from linked documents', () => {
    const product = store.inventory()[0];
    const order = store.createSalesOrder({ customerName: 'Acme', currency: 'USD', lines: [{ productId: product.id, description: product.name, quantity: 2, unitPrice: 50 }] });
    store.confirmSalesOrder(order.id);
    store.validateDelivery(store.deliveries()[0].id);
    store.createInvoiceFromOrder(order.id);

    expect(store.orderLineQuantities(order.id, product.id)).toEqual({ ordered: 2, delivered: 2, invoiced: 2 });
    expect(store.invoiceEligibility(order.id)).toBeUndefined();
  });

  it('blocks cancellation after a validated delivery and keeps cancellation available otherwise', () => {
    const product = store.inventory()[0];
    const draft = store.createSalesOrder({ customerName: 'Draft', currency: 'USD', lines: [{ productId: product.id, description: product.name, quantity: 1, unitPrice: 10 }] });
    expect(store.canCancelSalesOrder(draft)).toBe(true);
    store.cancelSalesOrder(draft.id);
    expect(store.salesOrders()[0].status).toBe('cancelled');

    const confirmed = store.createSalesOrder({ customerName: 'Confirmed', currency: 'USD', lines: [{ productId: product.id, description: product.name, quantity: 1, unitPrice: 10 }] });
    store.confirmSalesOrder(confirmed.id);
    store.validateDelivery(store.deliveries()[0].id);
    expect(store.canCancelSalesOrder(store.salesOrders().find((order) => order.id === confirmed.id)!)).toBe(false);
    store.cancelSalesOrder(confirmed.id);
    expect(store.salesOrders().find((order) => order.id === confirmed.id)?.status).toBe('completed');
  });

  it('validates a pending delivery once and deducts its exact quantities from inventory', () => {
    const product = store.inventory()[0];
    const initialStock = product.availableQuantity;
    const order = store.createSalesOrder({
      customerName: 'Acme',
      currency: 'USD',
      lines: [{ productId: product.id, description: product.name, quantity: 3, unitPrice: 0 }],
    });
    store.confirmSalesOrder(order.id);
    const delivery = store.deliveries()[0];

    store.validateDelivery(delivery.id);
    store.validateDelivery(delivery.id);

    expect(store.deliveries()[0].status).toBe('validated');
    expect(store.salesOrders()[0].status).toBe('completed');
    expect(store.inventory().find((item) => item.id === product.id)?.availableQuantity).toBe(initialStock - 3);
  });

  it('cancels a pending delivery without deducting inventory', () => {
    const product = store.inventory()[0];
    const initialStock = product.availableQuantity;
    const order = store.createSalesOrder({
      customerName: 'Acme',
      currency: 'USD',
      lines: [{ productId: product.id, description: product.name, quantity: 2, unitPrice: 0 }],
    });
    store.confirmSalesOrder(order.id);
    const delivery = store.deliveries()[0];

    store.cancelDelivery(delivery.id);
    store.cancelDelivery(delivery.id);

    expect(store.deliveries()[0].status).toBe('cancelled');
    expect(store.inventory().find((item) => item.id === product.id)?.availableQuantity).toBe(initialStock);
  });

  it('only exposes validated and uninvoiced quantities for invoicing', () => {
    const product = store.inventory()[0];
    const order = store.createSalesOrder({
      customerName: 'Acme',
      currency: 'EUR',
      lines: [{ productId: product.id, description: product.name, quantity: 2, unitPrice: 125 }],
    });
    store.confirmSalesOrder(order.id);

    expect(store.invoiceEligibility(order.id)).toBeUndefined();

    const delivery = store.deliveries()[0];
    store.validateDelivery(delivery.id);

    expect(store.invoiceEligibility(order.id)).toMatchObject({
      deliveryIds: [delivery.id],
      deliveryReferences: [delivery.reference],
      lines: [{ productId: product.id, quantity: 2, unitPrice: 125 }],
    });
  });

  it('creates one invoice for pending quantities and prevents duplicate invoicing', () => {
    const product = store.inventory()[0];
    const order = store.createSalesOrder({
      customerName: 'Acme',
      currency: 'USD',
      lines: [{ productId: product.id, description: product.name, quantity: 2, unitPrice: 75 }],
    });
    store.confirmSalesOrder(order.id);
    store.validateDelivery(store.deliveries()[0].id);

    const invoice = store.createInvoiceFromOrder(order.id);

    expect(invoice).toMatchObject({ orderId: order.id, status: 'draft', currency: 'USD' });
    expect(invoice?.lines).toMatchObject([{ productId: product.id, quantity: 2, unitPrice: 75 }]);
    expect(store.createInvoiceFromOrder(order.id)).toBeUndefined();
    expect(store.invoices()).toHaveLength(1);
  });

  it('enforces invoice transitions before payments settle an invoice', () => {
    const product = store.inventory()[0];
    const order = store.createSalesOrder({
      customerName: 'Acme',
      currency: 'VES',
      lines: [{ productId: product.id, description: product.name, quantity: 1, unitPrice: 200 }],
    });
    store.confirmSalesOrder(order.id);
    store.validateDelivery(store.deliveries()[0].id);
    const invoice = store.createInvoiceFromOrder(order.id)!;

    store.publishInvoice(invoice.id);
    store.voidInvoice(invoice.id);

    expect(store.invoices()[0].status).toBe('voided');
  });

  it('voids a draft invoice and makes its quantities eligible again', () => {
    const product = store.inventory()[0];
    const order = store.createSalesOrder({
      customerName: 'Acme',
      currency: 'USD',
      lines: [{ productId: product.id, description: product.name, quantity: 1, unitPrice: 50 }],
    });
    store.confirmSalesOrder(order.id);
    store.validateDelivery(store.deliveries()[0].id);
    const invoice = store.createInvoiceFromOrder(order.id)!;

    store.voidInvoice(invoice.id);

    expect(store.invoices()[0].status).toBe('voided');
    expect(store.invoiceEligibility(order.id)?.lines[0].quantity).toBe(1);
  });

  it('settles an invoice partially and then in full', () => {
    const invoice = publishedInvoice('USD', 100);

    const firstPayment = store.createPayment({ invoiceId: invoice.id, currency: 'USD', amount: 40 })!;
    store.confirmPayment(firstPayment.id);
    expect(store.invoices()[0].status).toBe('partial');
    expect(store.invoiceSettledTotal(invoice.id)).toBe(40);
    expect(store.invoiceBalance(store.invoices()[0])).toBe(60);

    const finalPayment = store.createPayment({ invoiceId: invoice.id, currency: 'USD', amount: 60 })!;
    store.confirmPayment(finalPayment.id);
    expect(store.invoices()[0].status).toBe('paid');
    expect(store.invoiceBalance(store.invoices()[0])).toBe(0);
  });

  it('converts a payment into the invoice currency using the latest local rate', () => {
    const invoice = publishedInvoice('USD', 100);

    const payment = store.createPayment({ invoiceId: invoice.id, currency: 'VES', amount: 38.5 })!;
    store.confirmPayment(payment.id);

    expect(store.payments()[0]).toMatchObject({ currency: 'VES', convertedAmount: 1, frozenRate: 38.5 });
    expect(store.invoiceBalance(store.invoices()[0])).toBe(99);
  });

  it('freezes the rate and its date when a payment is confirmed', () => {
    const invoice = publishedInvoice('USD', 100);
    const payment = store.createPayment({ invoiceId: invoice.id, currency: 'EUR', amount: 10 })!;
    const expectedRate = store.latestRate('EUR')!;

    store.confirmPayment(payment.id);

    expect(store.payments()[0]).toMatchObject({
      frozenRate: expectedRate.rateToUsd,
      frozenRateDate: expectedRate.date,
      convertedAmount: 10.87,
    });
  });

  it('rejects a payment that exceeds the remaining invoice balance', () => {
    const invoice = publishedInvoice('USD', 100);

    expect(store.createPayment({ invoiceId: invoice.id, currency: 'USD', amount: 101 })).toBeUndefined();
    expect(store.payments()).toHaveLength(0);
  });

  it('voids a confirmed payment, restores the invoice balance, and retains its frozen rate', () => {
    const invoice = publishedInvoice('USD', 100);
    const payment = store.createPayment({ invoiceId: invoice.id, currency: 'USD', amount: 100 })!;
    store.confirmPayment(payment.id);
    const confirmedPayment = store.payments()[0];

    store.voidPayment(payment.id);

    expect(store.payments()[0]).toMatchObject({
      status: 'voided',
      frozenRate: confirmedPayment.frozenRate,
      frozenRateDate: confirmedPayment.frozenRateDate,
      convertedAmount: confirmedPayment.convertedAmount,
    });
    expect(store.invoices()[0].status).toBe('published');
    expect(store.invoiceBalance(store.invoices()[0])).toBe(100);
  });

  function publishedInvoice(currency: 'USD' | 'VES' | 'EUR', unitPrice: number) {
    const product = store.inventory()[0];
    const order = store.createSalesOrder({
      customerName: 'Acme',
      currency,
      lines: [{ productId: product.id, description: product.name, quantity: 1, unitPrice }],
    });
    store.confirmSalesOrder(order.id);
    store.validateDelivery(store.deliveries()[0].id);
    const invoice = store.createInvoiceFromOrder(order.id)!;
    store.publishInvoice(invoice.id);
    return invoice;
  }
});
