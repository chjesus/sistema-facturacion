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

  it('enforces invoice transitions and reserves settlement states for payments', () => {
    const product = store.inventory()[0];
    const order = store.createSalesOrder({
      customerName: 'Acme',
      currency: 'VES',
      lines: [{ productId: product.id, description: product.name, quantity: 1, unitPrice: 200 }],
    });
    store.confirmSalesOrder(order.id);
    store.validateDelivery(store.deliveries()[0].id);
    const invoice = store.createInvoiceFromOrder(order.id)!;

    store.setInvoicePaymentStatus(invoice.id, 'paid');
    expect(store.invoices()[0].status).toBe('draft');
    store.publishInvoice(invoice.id);
    store.setInvoicePaymentStatus(invoice.id, 'partial');
    store.setInvoicePaymentStatus(invoice.id, 'paid');
    store.voidInvoice(invoice.id);

    expect(store.invoices()[0].status).toBe('paid');
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
});
