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

  it('migrates global inventory into the default warehouse without losing stock or delivery sources', () => {
    localStorage.setItem('sales-cycle-state-v1', JSON.stringify({
      salesOrders: [{ id: 'so-legacy', reference: 'SO-LEGACY', customerName: 'Legacy Customer', status: 'confirmed', currency: 'USD', lines: [], orderDate: '2026-10-01', createdAt: '2026-10-01T00:00:00.000Z' }],
      deliveries: [{ id: 'delivery-legacy', reference: 'OUT-LEGACY', orderId: 'so-legacy', orderReference: 'SO-LEGACY', status: 'pending', lines: [], createdAt: '2026-10-01T00:00:00.000Z' }],
      invoices: [], payments: [], exchangeRates: [],
      inventory: [{ id: 'desk-lamp', sku: 'LGT-001', name: 'Arc Desk Lamp', availableQuantity: 24, unit: 'units', suggestedUnitPrice: 49.95 }],
    }));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const legacyStore = TestBed.inject(LocalSalesCycleStore);

    expect(legacyStore.warehouses()).toHaveLength(2);
    expect(legacyStore.warehouses()[0]).toMatchObject({ id: 'warehouse-main', stock: [{ productId: 'desk-lamp', availableQuantity: 24 }] });
    expect(legacyStore.deliveries()[0]).toMatchObject({ customerName: 'Legacy Customer', warehouseId: 'warehouse-main', warehouseName: 'Main Warehouse' });
    expect(JSON.parse(localStorage.getItem('sales-cycle-state-v1') ?? '{}').warehouses).toHaveLength(2);
  });

  it('validates a partial shipment atomically, deducts only its warehouse, and creates one linked backorder', () => {
    const product = store.inventory()[0];
    const order = store.createSalesOrder({
      customerName: 'Acme',
      currency: 'USD',
      lines: [{ productId: product.id, description: product.name, quantity: 3, unitPrice: 50 }],
    });
    store.confirmSalesOrder(order.id);
    const delivery = store.deliveries()[0];
    const mainStock = store.warehouseStock('warehouse-main', product.id);
    const westStock = store.warehouseStock('warehouse-west', product.id);
    store.updateDeliveryWarehouse(delivery.id, 'warehouse-west');

    store.validateDelivery(delivery.id, [{ ...delivery.lines[0], quantity: 1 }]);
    store.validateDelivery(delivery.id, [{ ...delivery.lines[0], quantity: 1 }]);

    const validated = store.deliveries().find((candidate) => candidate.id === delivery.id)!;
    const backorder = store.deliveries().find((candidate) => candidate.parentDeliveryId === delivery.id)!;
    expect(validated).toMatchObject({ status: 'validated', customerName: 'Acme', warehouseId: 'warehouse-west', lines: [{ quantity: 1 }] });
    expect(backorder).toMatchObject({ status: 'pending', orderId: order.id, parentDeliveryId: delivery.id, warehouseId: 'warehouse-west', lines: [{ quantity: 2 }] });
    expect(store.deliveries()).toHaveLength(2);
    expect(store.warehouseStock('warehouse-main', product.id)).toBe(mainStock);
    expect(store.warehouseStock('warehouse-west', product.id)).toBe(westStock - 1);
    expect(store.salesOrders().find((candidate) => candidate.id === order.id)?.status).toBe('confirmed');
    expect(store.orderLineQuantities(order.id, product.id)).toEqual({ ordered: 3, delivered: 1, invoiced: 0 });
    expect(store.invoiceEligibility(order.id)).toMatchObject({ deliveryIds: [delivery.id], lines: [{ quantity: 1 }] });

    store.validateDelivery(backorder.id);
    expect(store.salesOrders().find((candidate) => candidate.id === order.id)?.status).toBe('completed');
    expect(store.deliveries().filter((candidate) => candidate.parentDeliveryId === backorder.id)).toHaveLength(0);
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
    expect(store.invoiceBalance(store.invoices()[0])).toBe(76);

    const finalPayment = store.createPayment({ invoiceId: invoice.id, currency: 'USD', amount: 76 })!;
    store.confirmPayment(finalPayment.id);
    expect(store.invoices()[0].status).toBe('paid');
    expect(store.invoiceBalance(store.invoices()[0])).toBe(0);
  });

  it('converts a payment into the invoice currency using the latest local rate', () => {
    const invoice = publishedInvoice('USD', 100);

    const payment = store.createPayment({ invoiceId: invoice.id, currency: 'VES', amount: 38.5 })!;
    store.confirmPayment(payment.id);

    expect(store.payments()[0]).toMatchObject({ currency: 'VES', convertedAmount: 1, frozenRate: 38.5 });
    expect(store.invoiceBalance(store.invoices()[0])).toBe(115);
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

    expect(store.createPayment({ invoiceId: invoice.id, currency: 'USD', amount: 117 })).toBeUndefined();
    expect(store.payments()).toHaveLength(0);
  });

  it('voids a confirmed payment, restores the invoice balance, and retains its frozen rate', () => {
    const invoice = publishedInvoice('USD', 100);
    const payment = store.createPayment({ invoiceId: invoice.id, currency: 'USD', amount: 116 })!;
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
    expect(store.invoiceBalance(store.invoices()[0])).toBe(116);
  });

  it('snapshots delivery provenance and VAT-inclusive amounts without invoicing a backorder twice', () => {
    const product = store.inventory()[0];
    const order = store.createSalesOrder({
      customerName: 'Acme', currency: 'USD',
      lines: [{ productId: product.id, description: product.name, quantity: 3, unitPrice: 100 }],
    });
    store.confirmSalesOrder(order.id);
    const original = store.deliveries()[0];
    store.validateDelivery(original.id, [{ ...original.lines[0], quantity: 1 }]);
    const firstInvoice = store.createInvoiceFromOrder(order.id)!;
    const backorder = store.deliveries().find((delivery) => delivery.parentDeliveryId === original.id)!;
    store.validateDelivery(backorder.id);
    const secondInvoice = store.createInvoiceFromOrder(order.id)!;

    expect(firstInvoice.lines[0]).toMatchObject({ deliveryId: original.id, deliveryLineIndex: 0, quantity: 1, subtotal: 100, vatRate: 0.16, vat: 16, total: 116 });
    expect(secondInvoice.lines[0]).toMatchObject({ deliveryId: backorder.id, deliveryLineIndex: 0, quantity: 2, subtotal: 200, vat: 32, total: 232 });
    expect(store.invoiceEligibility(order.id)).toBeUndefined();
  });

  it('publishes an immutable sequential number and VES snapshot that voiding does not reuse', () => {
    const first = publishedInvoice('USD', 100);
    const firstNumber = store.invoices().find((invoice) => invoice.id === first.id)!.number!;
    store.voidInvoice(first.id);
    const voided = store.invoices().find((invoice) => invoice.id === first.id)!;

    const second = publishedInvoice('USD', 100);
    const republished = store.invoices().find((invoice) => invoice.id === second.id)!;

    expect(voided.status).toBe('voided');
    expect(voided.number).toBe(firstNumber);
    expect(voided.issueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(voided.issuedCurrency).toBe('USD');
    expect(voided.vesFxRate).toBeGreaterThan(0);
    expect(voided.vesFxDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(voided.vesEquivalentTotal).toBeGreaterThan(0);
    expect(firstNumber).toMatch(/^INV-\d{4}-000001$/);
    expect(republished.number).toMatch(/^INV-\d{4}-000002$/);
    expect(store.invoiceTotals(republished)).toEqual({ subtotal: 100, vat: 16, total: 116 });
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
