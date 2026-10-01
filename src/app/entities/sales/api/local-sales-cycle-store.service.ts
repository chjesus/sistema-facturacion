import { Injectable, computed, signal } from '@angular/core';
import { ExchangeRate } from '../../exchange-rate/model/exchange-rate.models';
import { InventoryItem } from '../../inventory/model/inventory.models';
import {
  CurrencyCode,
  Delivery,
  DeliveryId,
  DocumentLine,
  Invoice,
  InvoiceId,
  InvoiceStatus,
  Payment,
  ProductId,
  SalesOrder,
  SalesOrderId,
} from '../model/sales.models';

interface SalesCycleState {
  salesOrders: SalesOrder[];
  deliveries: Delivery[];
  invoices: Invoice[];
  payments: Payment[];
  inventory: InventoryItem[];
  exchangeRates: ExchangeRate[];
}

const STORAGE_KEY = 'sales-cycle-state-v1';

@Injectable({ providedIn: 'root' })
export class LocalSalesCycleStore {
  private readonly state = signal<SalesCycleState>(this.readState());

  readonly salesOrders = computed(() => this.state().salesOrders);
  readonly deliveries = computed(() => this.state().deliveries);
  readonly invoices = computed(() => this.state().invoices);
  readonly payments = computed(() => this.state().payments);
  readonly inventory = computed(() => this.state().inventory);
  readonly exchangeRates = computed(() => this.state().exchangeRates);

  latestRate(currency: CurrencyCode): ExchangeRate | undefined {
    return this.exchangeRates()
      .filter((rate) => rate.currency === currency)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
  }

  invoiceEligibility(orderId: SalesOrderId): { lines: DocumentLine[]; deliveryIds: DeliveryId[]; deliveryReferences: string[] } | undefined {
    return this.invoiceEligibilityForState(this.state(), orderId);
  }

  createSalesOrder(input: { customerName: string; currency: CurrencyCode; lines: DocumentLine[] }): SalesOrder {
    const order: SalesOrder = {
      id: this.salesOrderId(),
      reference: this.reference('SO'),
      customerName: input.customerName.trim(),
      status: 'draft',
      currency: input.currency,
      lines: input.lines.map((line) => ({ ...line })),
      createdAt: new Date().toISOString(),
    };

    this.updateState((state) => ({ ...state, salesOrders: [order, ...state.salesOrders] }));
    return order;
  }

  confirmSalesOrder(orderId: SalesOrderId): void {
    this.updateState((state) => {
      const order = state.salesOrders.find((candidate) => candidate.id === orderId);
      if (!order || order.status !== 'draft') return state;

      const delivery: Delivery = {
        id: this.deliveryId(),
        reference: this.reference('OUT'),
        orderId: order.id,
        orderReference: order.reference,
        status: 'pending',
        lines: order.lines.map((line) => ({ ...line })),
        createdAt: new Date().toISOString(),
      };

      return {
        ...state,
        salesOrders: state.salesOrders.map((candidate) =>
          candidate.id === orderId ? { ...candidate, status: 'confirmed' } : candidate,
        ),
        deliveries: [delivery, ...state.deliveries],
      };
    });
  }

  cancelSalesOrder(orderId: SalesOrderId): void {
    this.updateState((state) => ({
      ...state,
      salesOrders: state.salesOrders.map((order) =>
        order.id === orderId && (order.status === 'draft' || order.status === 'confirmed')
          ? { ...order, status: 'cancelled' }
          : order,
      ),
    }));
  }

  validateDelivery(deliveryId: DeliveryId): void {
    this.updateState((state) => {
      const delivery = state.deliveries.find((candidate) => candidate.id === deliveryId);
      if (!delivery || delivery.status !== 'pending') return state;

      const deliveredQuantities = this.quantitiesByProduct(delivery.lines);
      const canFulfillDelivery = [...deliveredQuantities].every(([productId, quantity]) => {
        const item = state.inventory.find((candidate) => candidate.id === productId);
        return item !== undefined && item.availableQuantity >= quantity;
      });
      if (!canFulfillDelivery) return state;

      return {
        ...state,
        salesOrders: state.salesOrders.map((order) =>
          order.id === delivery.orderId ? { ...order, status: 'completed' } : order,
        ),
        deliveries: state.deliveries.map((candidate) =>
          candidate.id === deliveryId ? { ...candidate, status: 'validated' } : candidate,
        ),
        inventory: state.inventory.map((item) => ({
          ...item,
          availableQuantity: item.availableQuantity - (deliveredQuantities.get(item.id) ?? 0),
        })),
      };
    });
  }

  cancelDelivery(deliveryId: DeliveryId): void {
    this.updateState((state) => {
      const delivery = state.deliveries.find((candidate) => candidate.id === deliveryId);
      if (!delivery || delivery.status !== 'pending') return state;

      return {
        ...state,
        deliveries: state.deliveries.map((candidate) =>
          candidate.id === deliveryId ? { ...candidate, status: 'cancelled' } : candidate,
        ),
      };
    });
  }

  createInvoiceFromOrder(orderId: SalesOrderId): Invoice | undefined {
    let createdInvoice: Invoice | undefined;
    this.updateState((state) => {
      const order = state.salesOrders.find((candidate) => candidate.id === orderId);
      const eligibility = this.invoiceEligibilityForState(state, orderId);
      if (!order || !eligibility) return state;

      createdInvoice = {
        id: this.invoiceId(),
        reference: this.reference('INV'),
        orderId: order.id,
        orderReference: order.reference,
        deliveryIds: eligibility.deliveryIds,
        deliveryReferences: eligibility.deliveryReferences,
        status: 'draft',
        currency: order.currency,
        lines: eligibility.lines,
        createdAt: new Date().toISOString(),
      };
      return { ...state, invoices: [createdInvoice, ...state.invoices] };
    });
    return createdInvoice;
  }

  publishInvoice(invoiceId: InvoiceId): void {
    this.transitionInvoice(invoiceId, 'published');
  }

  voidInvoice(invoiceId: InvoiceId): void {
    this.transitionInvoice(invoiceId, 'voided');
  }

  setInvoicePaymentStatus(invoiceId: InvoiceId, status: Extract<InvoiceStatus, 'partial' | 'paid'>): void {
    this.transitionInvoice(invoiceId, status);
  }

  private updateState(update: (state: SalesCycleState) => SalesCycleState): void {
    const nextState = update(this.state());
    if (nextState === this.state()) return;
    this.state.set(nextState);
    this.persist(nextState);
  }

  private salesOrderId(): SalesOrderId {
    return `so-${this.identifier()}` as SalesOrderId;
  }

  private deliveryId(): DeliveryId {
    return `delivery-${this.identifier()}` as DeliveryId;
  }

  private invoiceId(): InvoiceId {
    return `invoice-${this.identifier()}` as InvoiceId;
  }

  private transitionInvoice(invoiceId: InvoiceId, targetStatus: InvoiceStatus): void {
    this.updateState((state) => {
      const invoice = state.invoices.find((candidate) => candidate.id === invoiceId);
      if (!invoice || !this.canTransitionInvoice(invoice.status, targetStatus)) return state;
      return {
        ...state,
        invoices: state.invoices.map((candidate) =>
          candidate.id === invoiceId ? { ...candidate, status: targetStatus } : candidate,
        ),
      };
    });
  }

  private canTransitionInvoice(currentStatus: InvoiceStatus, targetStatus: InvoiceStatus): boolean {
    if (currentStatus === 'draft') return targetStatus === 'published' || targetStatus === 'voided';
    if (currentStatus === 'published') return targetStatus === 'partial' || targetStatus === 'paid' || targetStatus === 'voided';
    if (currentStatus === 'partial') return targetStatus === 'paid' || targetStatus === 'voided';
    return false;
  }

  private invoiceEligibilityForState(
    state: SalesCycleState,
    orderId: SalesOrderId,
  ): { lines: DocumentLine[]; deliveryIds: DeliveryId[]; deliveryReferences: string[] } | undefined {
    const order = state.salesOrders.find((candidate) => candidate.id === orderId);
    if (!order) return undefined;

    const validatedDeliveries = state.deliveries.filter(
      (delivery) => delivery.orderId === orderId && delivery.status === 'validated',
    );
    const deliveredByProduct = this.quantitiesByProduct(validatedDeliveries.flatMap((delivery) => delivery.lines));
    const invoicedByProduct = this.quantitiesByProduct(
      state.invoices
        .filter((invoice) => invoice.orderId === orderId && invoice.status !== 'voided')
        .flatMap((invoice) => invoice.lines),
    );
    const lines = order.lines.flatMap((line) => {
      const pendingQuantity = Math.max(
        0,
        (deliveredByProduct.get(line.productId) ?? 0) - (invoicedByProduct.get(line.productId) ?? 0),
      );
      return pendingQuantity > 0 ? [{ ...line, quantity: pendingQuantity }] : [];
    });
    if (lines.length === 0) return undefined;

    const pendingProductIds = new Set(lines.map((line) => line.productId));
    const sourceDeliveries = validatedDeliveries.filter((delivery) =>
      delivery.lines.some((line) => pendingProductIds.has(line.productId)),
    );
    return {
      lines,
      deliveryIds: sourceDeliveries.map((delivery) => delivery.id),
      deliveryReferences: sourceDeliveries.map((delivery) => delivery.reference),
    };
  }

  private quantitiesByProduct(lines: DocumentLine[]): Map<ProductId, number> {
    return lines.reduce((quantities, line) => {
      quantities.set(line.productId, (quantities.get(line.productId) ?? 0) + line.quantity);
      return quantities;
    }, new Map<ProductId, number>());
  }

  private reference(prefix: string): string {
    return `${prefix}-${new Date().getFullYear()}-${this.identifier().slice(-6).toUpperCase()}`;
  }

  private identifier(): string {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  }

  private readState(): SalesCycleState {
    const stored = this.storage()?.getItem(STORAGE_KEY);
    if (!stored) return this.seedState();

    try {
      return JSON.parse(stored) as SalesCycleState;
    } catch {
      return this.seedState();
    }
  }

  private seedState(): SalesCycleState {
    const state: SalesCycleState = {
      salesOrders: [],
      deliveries: [],
      invoices: [],
      payments: [],
      inventory: [
        { id: 'desk-lamp' as ProductId, sku: 'LGT-001', name: 'Arc Desk Lamp', availableQuantity: 24, unit: 'units' },
        { id: 'notebook' as ProductId, sku: 'OFF-014', name: 'Hardcover Notebook', availableQuantity: 80, unit: 'units' },
        { id: 'chair' as ProductId, sku: 'FUR-020', name: 'Ergonomic Chair', availableQuantity: 12, unit: 'units' },
      ],
      exchangeRates: this.seedExchangeRates(),
    };
    this.persist(state);
    return state;
  }

  private seedExchangeRates(): ExchangeRate[] {
    const days = [0, 1, 2, 3, 4, 5, 6];
    return days.flatMap((offset) => {
      const date = new Date();
      date.setDate(date.getDate() - offset);
      const isoDate = date.toISOString().slice(0, 10);
      return [
        { date: isoDate, currency: 'USD' as const, rateToUsd: 1 },
        { date: isoDate, currency: 'VES' as const, rateToUsd: 38.5 + offset * 0.12 },
        { date: isoDate, currency: 'EUR' as const, rateToUsd: 0.92 + offset * 0.002 },
      ];
    });
  }

  private persist(state: SalesCycleState): void {
    this.storage()?.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  private storage(): Storage | undefined {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  }
}
