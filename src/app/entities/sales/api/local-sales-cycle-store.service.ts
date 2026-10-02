import { Injectable, computed, signal } from '@angular/core';
import { ExchangeRate } from '../../exchange-rate/model/exchange-rate.models';
import { InventoryItem, Warehouse } from '../../inventory/model/inventory.models';
import {
  CurrencyCode,
  Delivery,
  DeliveryId,
  DocumentLine,
  Invoice,
  InvoiceId,
  InvoiceLine,
  InvoiceStatus,
  MonetaryTotals,
  OrderLineQuantities,
  Payment,
  PaymentMethod,
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
  warehouses: Warehouse[];
  exchangeRates: ExchangeRate[];
}

export interface PaymentPreview {
  rate: ExchangeRate;
  invoiceRate: ExchangeRate;
  rateSource: 'history' | 'adjusted';
  convertedAmount: number;
}

const STORAGE_KEY = 'sales-cycle-state-v1';
const DEFAULT_WAREHOUSE_ID = 'warehouse-main';
const FIXTURE_PRICES = new Map<string, { sku: string; name: string; suggestedUnitPrice: number }>([
  ['desk-lamp', { sku: 'LGT-001', name: 'Arc Desk Lamp', suggestedUnitPrice: 49.95 }],
  ['notebook', { sku: 'OFF-014', name: 'Hardcover Notebook', suggestedUnitPrice: 12.5 }],
  ['chair', { sku: 'FUR-020', name: 'Ergonomic Chair', suggestedUnitPrice: 275 }],
]);

@Injectable({ providedIn: 'root' })
export class LocalSalesCycleStore {
  private readonly state = signal<SalesCycleState>(this.readState());

  readonly salesOrders = computed(() => this.state().salesOrders);
  readonly deliveries = computed(() => this.state().deliveries);
  readonly invoices = computed(() => this.state().invoices);
  readonly payments = computed(() => this.state().payments);
  readonly inventory = computed(() => this.inventoryForState(this.state()));
  readonly warehouses = computed(() => this.state().warehouses);
  readonly exchangeRates = computed(() => this.state().exchangeRates);

  latestRate(currency: CurrencyCode): ExchangeRate | undefined {
    return this.exchangeRates()
      .filter((rate) => rate.currency === currency)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
  }

  invoiceTotal(invoice: Invoice): number {
    return this.invoiceTotals(invoice).total;
  }

  invoiceTotals(invoice: Invoice): MonetaryTotals {
    const subtotal = this.roundAmount(invoice.lines.reduce((total, line) => total + line.subtotal, 0));
    const vat = this.roundAmount(invoice.lines.reduce((total, line) => total + line.vat, 0));
    return { subtotal, vat, total: this.roundAmount(invoice.lines.reduce((total, line) => total + line.total, 0)) };
  }

  lineTotals(line: DocumentLine): MonetaryTotals {
    const subtotal = this.roundAmount(line.quantity * line.unitPrice);
    const vat = this.roundAmount(subtotal * 0.16);
    return { subtotal, vat, total: this.roundAmount(subtotal + vat) };
  }

  salesOrderTotals(order: SalesOrder): MonetaryTotals {
    const subtotal = this.roundAmount(order.lines.reduce((total, line) => total + this.lineTotals(line).subtotal, 0));
    const vat = this.roundAmount(order.lines.reduce((total, line) => total + this.lineTotals(line).vat, 0));
    return { subtotal, vat, total: this.roundAmount(subtotal + vat) };
  }

  suggestedUnitPrice(productId: ProductId): number {
    return this.roundAmount(this.inventoryForState(this.state()).find((item) => item.id === productId)?.suggestedUnitPrice ?? 0);
  }

  warehouseStock(warehouseId: string, productId: ProductId): number {
    return this.state().warehouses.find((warehouse) => warehouse.id === warehouseId)
      ?.stock.find((item) => item.productId === productId)?.availableQuantity ?? 0;
  }

  orderLineQuantities(orderId: SalesOrderId, productId: ProductId): OrderLineQuantities {
    const order = this.salesOrders().find((candidate) => candidate.id === orderId);
    const ordered = order?.lines.filter((line) => line.productId === productId).reduce((total, line) => total + line.quantity, 0) ?? 0;
    const delivered = this.deliveries().filter((delivery) => delivery.orderId === orderId && delivery.status === 'validated')
      .flatMap((delivery) => delivery.lines).filter((line) => line.productId === productId)
      .reduce((total, line) => total + line.quantity, 0);
    const invoiced = this.invoices().filter((invoice) => invoice.orderId === orderId && invoice.status !== 'voided')
      .flatMap((invoice) => invoice.lines).filter((line) => line.productId === productId)
      .reduce((total, line) => total + line.quantity, 0);
    return { ordered, delivered, invoiced };
  }

  invoiceSettledTotal(invoiceId: InvoiceId): number {
    return this.settledTotalForState(this.state(), invoiceId);
  }

  invoiceBalance(invoice: Invoice): number {
    return this.roundAmount(this.invoiceTotal(invoice) - this.invoiceSettledTotal(invoice.id));
  }

  paymentPreview(invoice: Invoice, currency: CurrencyCode, amount: number, paymentDate: string, adjustedRate?: number): PaymentPreview | undefined {
    return this.paymentPreviewForState(this.state(), invoice, currency, amount, paymentDate, adjustedRate);
  }

  invoiceEligibility(orderId: SalesOrderId): { lines: DocumentLine[]; deliveryIds: DeliveryId[]; deliveryReferences: string[] } | undefined {
    return this.invoiceEligibilityForState(this.state(), orderId);
  }

  createSalesOrder(input: { customerName: string; currency: CurrencyCode; orderDate?: string; lines: DocumentLine[] }): SalesOrder {
    const order: SalesOrder = {
      id: this.salesOrderId(),
      reference: this.reference('SO'),
      customerName: input.customerName.trim(),
      status: 'draft',
      currency: input.currency,
      lines: input.lines.map((line) => ({ ...line, unitPrice: this.roundAmount(line.unitPrice) })),
      orderDate: input.orderDate ?? new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString(),
    };

    this.updateState((state) => ({ ...state, salesOrders: [order, ...state.salesOrders] }));
    return order;
  }

  updateSalesOrder(input: { id: SalesOrderId; customerName: string; currency: CurrencyCode; orderDate: string; lines: DocumentLine[] }): void {
    this.updateState((state) => ({
      ...state,
      salesOrders: state.salesOrders.map((order) => order.id === input.id && order.status === 'draft'
        ? { ...order, customerName: input.customerName.trim(), currency: input.currency, orderDate: input.orderDate, lines: input.lines.map((line) => ({ ...line, unitPrice: this.roundAmount(line.unitPrice) })) }
        : order),
    }));
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
        customerName: order.customerName,
        warehouseId: DEFAULT_WAREHOUSE_ID,
        warehouseName: this.warehouseNameForState(state, DEFAULT_WAREHOUSE_ID),
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
    this.updateState((state) => {
      const order = state.salesOrders.find((candidate) => candidate.id === orderId);
      if (!order || !this.canCancelSalesOrderForState(state, order)) return state;
      return { ...state, salesOrders: state.salesOrders.map((candidate) => candidate.id === orderId ? { ...candidate, status: 'cancelled' } : candidate) };
    });
  }

  canCancelSalesOrder(order: SalesOrder): boolean {
    return this.canCancelSalesOrderForState(this.state(), order);
  }

  updateDeliveryWarehouse(deliveryId: DeliveryId, warehouseId: string): void {
    this.updateState((state) => {
      const delivery = state.deliveries.find((candidate) => candidate.id === deliveryId);
      const warehouse = state.warehouses.find((candidate) => candidate.id === warehouseId);
      if (!delivery || delivery.status !== 'pending' || !warehouse) return state;
      return {
        ...state,
        deliveries: state.deliveries.map((candidate) => candidate.id === deliveryId
          ? { ...candidate, warehouseId: warehouse.id, warehouseName: warehouse.name }
          : candidate),
      };
    });
  }

  validateDelivery(deliveryId: DeliveryId, shippedLines?: DocumentLine[]): void {
    this.updateState((state) => {
      const delivery = state.deliveries.find((candidate) => candidate.id === deliveryId);
      if (!delivery || delivery.status !== 'pending') return state;

      const warehouse = state.warehouses.find((candidate) => candidate.id === delivery.warehouseId);
      const shippedByProduct = this.quantitiesByProduct(shippedLines ?? delivery.lines);
      const pendingByProduct = this.quantitiesByProduct(delivery.lines);
      const hasValidQuantities = delivery.lines.every((line) => {
        const shippedQuantity = shippedByProduct.get(line.productId) ?? 0;
        const availableQuantity = warehouse?.stock.find((item) => item.productId === line.productId)?.availableQuantity ?? 0;
        return Number.isInteger(shippedQuantity) && shippedQuantity > 0 && shippedQuantity <= line.quantity && shippedQuantity <= availableQuantity;
      });
      if (!warehouse || !hasValidQuantities || shippedByProduct.size !== pendingByProduct.size) return state;

      const validatedLines = delivery.lines.map((line) => ({ ...line, quantity: shippedByProduct.get(line.productId)! }));
      const backorderLines = delivery.lines.flatMap((line) => {
        const pendingQuantity = line.quantity - (shippedByProduct.get(line.productId) ?? 0);
        return pendingQuantity > 0 ? [{ ...line, quantity: pendingQuantity }] : [];
      });
      const nextDeliveries = state.deliveries.map((candidate) => candidate.id === deliveryId
        ? { ...candidate, status: 'validated' as const, lines: validatedLines }
        : candidate);
      const backorder: Delivery | undefined = backorderLines.length > 0 ? {
        id: this.deliveryId(),
        reference: this.reference('OUT'),
        orderId: delivery.orderId,
        orderReference: delivery.orderReference,
        customerName: delivery.customerName,
        warehouseId: delivery.warehouseId,
        warehouseName: delivery.warehouseName,
        parentDeliveryId: delivery.id,
        status: 'pending',
        lines: backorderLines,
        createdAt: new Date().toISOString(),
      } : undefined;
      const deliveries = backorder ? [backorder, ...nextDeliveries] : nextDeliveries;
      const deliveredByProduct = this.quantitiesByProduct(
        deliveries.filter((candidate) => candidate.orderId === delivery.orderId && candidate.status === 'validated').flatMap((candidate) => candidate.lines),
      );
      const order = state.salesOrders.find((candidate) => candidate.id === delivery.orderId);
      const isCompleted = order?.lines.every((line) => (deliveredByProduct.get(line.productId) ?? 0) >= line.quantity) ?? false;

      return {
        ...state,
        salesOrders: state.salesOrders.map((order) =>
          order.id === delivery.orderId ? { ...order, status: isCompleted ? 'completed' : 'confirmed' } : order,
        ),
        deliveries,
        warehouses: state.warehouses.map((candidate) => candidate.id !== warehouse.id ? candidate : {
          ...candidate,
          stock: candidate.stock.map((item) => ({
            ...item,
            availableQuantity: item.availableQuantity - (shippedByProduct.get(item.productId) ?? 0),
          })),
        }),
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

  createPayment(input: { invoiceId: InvoiceId; currency: CurrencyCode; amount: number; paymentDate: string; method: PaymentMethod; reference: string; adjustedRate?: number }): Payment | undefined {
    let payment: Payment | undefined;
    this.updateState((state) => {
      const invoice = state.invoices.find((candidate) => candidate.id === input.invoiceId);
      const preview = invoice ? this.paymentPreviewForState(state, invoice, input.currency, input.amount, input.paymentDate, input.adjustedRate) : undefined;
      if (!invoice || !this.isPayableInvoice(invoice) || this.invoiceBalanceForState(state, invoice) <= 0 || !this.isValidPaymentInput(input) || !preview || preview.convertedAmount > this.invoiceBalanceForState(state, invoice)) {
        return state;
      }

      payment = {
        id: `payment-${this.identifier()}`,
        reference: input.reference.trim(),
        invoiceId: invoice.id,
        invoiceReference: invoice.number ?? invoice.reference,
        status: 'draft',
        currency: input.currency,
        amount: this.roundAmount(input.amount),
        paymentDate: input.paymentDate,
        method: input.method,
        rateSource: preview.rateSource,
        chosenRate: preview.rate.rateToUsd,
        rateDate: preview.rate.date,
        invoiceRate: preview.invoiceRate.rateToUsd,
        invoiceRateDate: preview.invoiceRate.date,
        convertedAmount: preview.convertedAmount,
        frozenRate: preview.rate.rateToUsd,
        frozenRateDate: preview.rate.date,
      };
      return { ...state, payments: [payment, ...state.payments] };
    });
    return payment;
  }

  confirmPayment(paymentId: string): void {
    this.updateState((state) => {
      const payment = state.payments.find((candidate) => candidate.id === paymentId);
      const invoice = payment ? state.invoices.find((candidate) => candidate.id === payment.invoiceId) : undefined;
      if (!payment || !invoice || payment.status !== 'draft' || !this.isPayableInvoice(invoice) || payment.convertedAmount > this.invoiceBalanceForState(state, invoice)) {
        return state;
      }

      const confirmedPayment: Payment = {
        ...payment,
        status: 'confirmed',
        confirmedAt: new Date().toISOString(),
      };
      return this.withSettlementStatus({
        ...state,
        payments: state.payments.map((candidate) => candidate.id === paymentId ? confirmedPayment : candidate),
      }, invoice.id);
    });
  }

  voidPayment(paymentId: string): void {
    this.updateState((state) => {
      const payment = state.payments.find((candidate) => candidate.id === paymentId);
      if (!payment || (payment.status !== 'draft' && payment.status !== 'confirmed')) return state;
      return this.withSettlementStatus({
        ...state,
        payments: state.payments.map((candidate) =>
          candidate.id === paymentId ? { ...candidate, status: 'voided' } : candidate,
        ),
      }, payment.invoiceId);
    });
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
        invoices: state.invoices.map((candidate) => {
          if (candidate.id !== invoiceId) return candidate;
          if (targetStatus !== 'published') return { ...candidate, status: targetStatus };
          return { ...candidate, ...this.publicationSnapshot(state, candidate), status: targetStatus };
        }),
      };
    });
  }

  private canTransitionInvoice(currentStatus: InvoiceStatus, targetStatus: InvoiceStatus): boolean {
    if (currentStatus === 'draft') return targetStatus === 'published' || targetStatus === 'voided';
    if (currentStatus === 'published') return targetStatus === 'partial' || targetStatus === 'paid' || targetStatus === 'voided';
    if (currentStatus === 'partial') return targetStatus === 'paid' || targetStatus === 'voided';
    return false;
  }

  private isPayableInvoice(invoice: Invoice): boolean {
    return invoice.status === 'published' || invoice.status === 'partial';
  }

  private isValidPaymentInput(input: { currency: CurrencyCode; amount: number; paymentDate: string; method: PaymentMethod; reference: string; adjustedRate?: number }): boolean {
    return ['USD', 'VES', 'EUR'].includes(input.currency)
      && Number.isFinite(input.amount) && input.amount > 0
      && /^\d{4}-\d{2}-\d{2}$/.test(input.paymentDate)
      && ['cash', 'bank transfer', 'mobile payment', 'zelle'].includes(input.method)
      && input.reference.trim().length > 0
      && (input.adjustedRate === undefined || (Number.isFinite(input.adjustedRate) && input.adjustedRate > 0));
  }

  private canCancelSalesOrderForState(state: SalesCycleState, order: SalesOrder): boolean {
    if (order.status !== 'draft' && order.status !== 'confirmed') return false;
    const hasValidatedDelivery = state.deliveries.some((delivery) => delivery.orderId === order.id && delivery.status === 'validated');
    const hasCommittedInvoice = state.invoices.some((invoice) =>
      invoice.orderId === order.id && (invoice.status === 'published' || invoice.status === 'partial' || invoice.status === 'paid'),
    );
    return !hasValidatedDelivery && !hasCommittedInvoice;
  }

  private paymentPreviewForState(
    state: SalesCycleState,
    invoice: Invoice,
    currency: CurrencyCode,
    amount: number,
    paymentDate: string,
    adjustedRate?: number,
  ): PaymentPreview | undefined {
    const historyRate = this.latestRateOnOrBefore(state, currency, paymentDate);
    const invoiceRate = this.latestRateOnOrBefore(state, invoice.currency, paymentDate);
    if (!historyRate || !invoiceRate || !Number.isFinite(amount) || amount <= 0 || (adjustedRate !== undefined && (!Number.isFinite(adjustedRate) || adjustedRate <= 0))) return undefined;
    const rate = adjustedRate === undefined ? historyRate : { ...historyRate, rateToUsd: adjustedRate };
    return {
      rate,
      invoiceRate,
      rateSource: adjustedRate === undefined ? 'history' : 'adjusted',
      convertedAmount: this.roundAmount((amount / rate.rateToUsd) * invoiceRate.rateToUsd),
    };
  }

  private settledTotalForState(state: SalesCycleState, invoiceId: InvoiceId): number {
    return this.roundAmount(state.payments
      .filter((payment) => payment.invoiceId === invoiceId && payment.status === 'confirmed')
      .reduce((total, payment) => total + (payment.convertedAmount ?? 0), 0));
  }

  private invoiceBalanceForState(state: SalesCycleState, invoice: Invoice): number {
    return this.roundAmount(this.invoiceTotal(invoice) - this.settledTotalForState(state, invoice.id));
  }

  private withSettlementStatus(state: SalesCycleState, invoiceId: InvoiceId): SalesCycleState {
    const invoice = state.invoices.find((candidate) => candidate.id === invoiceId);
    if (!invoice || invoice.status === 'draft' || invoice.status === 'voided') return state;
    const balance = this.invoiceBalanceForState(state, invoice);
    const status: InvoiceStatus = balance <= 0 ? 'paid' : balance < this.invoiceTotal(invoice) ? 'partial' : 'published';
    return {
      ...state,
      invoices: state.invoices.map((candidate) => candidate.id === invoiceId ? { ...candidate, status } : candidate),
    };
  }

  private invoiceLineSnapshot(line: DocumentLine, quantity: number, delivery: Delivery, deliveryLineIndex: number): InvoiceLine {
    const totals = this.lineTotals({ ...line, quantity });
    return {
      ...line,
      quantity,
      deliveryId: delivery.id,
      deliveryReference: delivery.reference,
      deliveryLineIndex,
      vatRate: 0.16,
      ...totals,
    };
  }

  private deliveryLineKey(deliveryId: DeliveryId, deliveryLineIndex: number): string {
    return `${deliveryId}:${deliveryLineIndex}`;
  }

  private publicationSnapshot(state: SalesCycleState, invoice: Invoice, issueDate = new Date().toISOString().slice(0, 10)): Pick<Invoice, 'number' | 'issueDate' | 'issuedCurrency' | 'vesFxRate' | 'vesFxDate' | 'vesEquivalentTotal'> {
    const vesRate = this.latestRateOnOrBefore(state, 'VES', issueDate);
    const invoiceRate = this.latestRateOnOrBefore(state, invoice.currency, issueDate);
    const vesEquivalentTotal = vesRate && invoiceRate
      ? this.roundAmount((this.invoiceTotal(invoice) / invoiceRate.rateToUsd) * vesRate.rateToUsd)
      : undefined;
    return {
      number: this.nextInvoiceNumber(state, issueDate),
      issueDate,
      issuedCurrency: invoice.currency,
      vesFxRate: vesRate?.rateToUsd,
      vesFxDate: vesRate?.date,
      vesEquivalentTotal,
    };
  }

  private latestRateOnOrBefore(state: SalesCycleState, currency: CurrencyCode, date: string): ExchangeRate | undefined {
    return state.exchangeRates
      .filter((rate) => rate.currency === currency && rate.date <= date)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
  }

  private nextInvoiceNumber(state: SalesCycleState, issueDate: string): string {
    const year = issueDate.slice(0, 4);
    const sequence = state.invoices.reduce((maximum, invoice) => {
      const match = invoice.number?.match(new RegExp(`^INV-${year}-(\\d{6})$`));
      return Math.max(maximum, match ? Number(match[1]) : 0);
    }, 0) + 1;
    return `INV-${year}-${sequence.toString().padStart(6, '0')}`;
  }

  private roundAmount(amount: number): number {
    return Math.round((amount + Number.EPSILON) * 100) / 100;
  }

  private invoiceEligibilityForState(
    state: SalesCycleState,
    orderId: SalesOrderId,
  ): { lines: InvoiceLine[]; deliveryIds: DeliveryId[]; deliveryReferences: string[] } | undefined {
    const order = state.salesOrders.find((candidate) => candidate.id === orderId);
    if (!order) return undefined;

    const validatedDeliveries = state.deliveries.filter(
      (delivery) => delivery.orderId === orderId && delivery.status === 'validated',
    );
    const invoicedByDeliveryLine = new Map<string, number>();
    state.invoices
      .filter((invoice) => invoice.orderId === orderId && invoice.status !== 'voided')
      .flatMap((invoice) => invoice.lines)
      .forEach((line) => {
        const key = this.deliveryLineKey(line.deliveryId, line.deliveryLineIndex);
        invoicedByDeliveryLine.set(key, (invoicedByDeliveryLine.get(key) ?? 0) + line.quantity);
      });
    const lines = validatedDeliveries.flatMap((delivery) => delivery.lines.flatMap((line, deliveryLineIndex) => {
      const pendingQuantity = Math.max(0, line.quantity - (invoicedByDeliveryLine.get(this.deliveryLineKey(delivery.id, deliveryLineIndex)) ?? 0));
      return pendingQuantity > 0 ? [this.invoiceLineSnapshot(line, pendingQuantity, delivery, deliveryLineIndex)] : [];
    }));
    if (lines.length === 0) return undefined;

    const sourceDeliveryIds = new Set(lines.map((line) => line.deliveryId));
    const sourceDeliveries = validatedDeliveries.filter((delivery) => sourceDeliveryIds.has(delivery.id));
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
      const state = JSON.parse(stored) as Partial<SalesCycleState>;
      const inventory = (state.inventory ?? []).map((item) => this.migrateFixturePrice(item));
      const warehouses = this.withSecondaryWarehouse(state.warehouses?.length ? state.warehouses : [this.defaultWarehouse(inventory)], inventory);
      const deliveries: Delivery[] = (state.deliveries ?? []).map((delivery) => {
        const order = state.salesOrders?.find((candidate) => candidate.id === delivery.orderId);
        const warehouse = warehouses.find((candidate) => candidate.id === delivery.warehouseId) ?? warehouses[0];
        return {
          ...delivery,
          customerName: delivery.customerName ?? order?.customerName ?? 'Customer unavailable',
          warehouseId: warehouse.id,
          warehouseName: warehouse.name,
        };
      });
      const migratedState = {
        ...state,
        inventory,
        warehouses,
        salesOrders: (state.salesOrders ?? []).map((order) => ({ ...order, orderDate: order.orderDate ?? order.createdAt.slice(0, 10) })),
        deliveries,
        invoices: this.migrateInvoices(state.invoices ?? [], deliveries, state.exchangeRates ?? []),
        payments: this.migratePayments(state.payments ?? [], state.invoices ?? [], state.exchangeRates ?? []),
        exchangeRates: state.exchangeRates ?? [],
      } as SalesCycleState;
      this.persist(migratedState);
      return migratedState;
    } catch {
      return this.seedState();
    }
  }

  private migrateFixturePrice(item: InventoryItem): InventoryItem {
    const fixture = FIXTURE_PRICES.get(item.id);
    const isKnownFixture = fixture?.sku === item.sku && fixture.name === item.name;
    const existingPrice = item.suggestedUnitPrice;
    const suggestedUnitPrice = isKnownFixture && (existingPrice === undefined || !Number.isFinite(existingPrice) || existingPrice <= 0)
      ? fixture.suggestedUnitPrice
      : existingPrice ?? 0;
    return { ...item, suggestedUnitPrice: this.roundAmount(suggestedUnitPrice) };
  }

  private migrateInvoices(invoices: unknown[], deliveries: Delivery[], exchangeRates: ExchangeRate[]): Invoice[] {
    const typedInvoices = invoices as Invoice[];
    const claimedQuantities = new Map<string, number>();
    const migratedById = new Map<InvoiceId, Invoice>();
    const chronological = [...typedInvoices].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    chronological.forEach((invoice) => {
      const lines = ((invoice.lines ?? []) as Array<DocumentLine | InvoiceLine>).flatMap((line) => {
        if (this.isInvoiceLine(line)) return [line];
        let remaining = line.quantity;
        const allocated: InvoiceLine[] = [];
        const sources = deliveries.filter((delivery) => (invoice.deliveryIds ?? []).includes(delivery.id) && delivery.status === 'validated');
        for (const delivery of sources) {
          for (const [deliveryLineIndex, deliveryLine] of delivery.lines.entries()) {
            if (deliveryLine.productId !== line.productId || remaining <= 0) continue;
            const key = this.deliveryLineKey(delivery.id, deliveryLineIndex);
            const available = Math.max(0, deliveryLine.quantity - (claimedQuantities.get(key) ?? 0));
            const quantity = Math.min(remaining, available);
            if (quantity <= 0) continue;
            allocated.push(this.invoiceLineSnapshot({ ...line, unitPrice: line.unitPrice ?? deliveryLine.unitPrice }, quantity, delivery, deliveryLineIndex));
            remaining -= quantity;
          }
        }
        return allocated.length > 0 ? allocated : [];
      });
      const migrated: Invoice = { ...invoice, lines };
      if (migrated.status !== 'draft' && !migrated.number) {
        const issueDate = migrated.createdAt.slice(0, 10);
        Object.assign(migrated, this.publicationSnapshot({
          salesOrders: [], deliveries, invoices: [...typedInvoices, ...migratedById.values()], payments: [], inventory: [], warehouses: [], exchangeRates,
        }, migrated, issueDate));
      }
      if (migrated.status !== 'voided') {
        migrated.lines.forEach((line) => {
          const key = this.deliveryLineKey(line.deliveryId, line.deliveryLineIndex);
          claimedQuantities.set(key, (claimedQuantities.get(key) ?? 0) + line.quantity);
        });
      }
      migratedById.set(migrated.id, migrated);
    });
    return typedInvoices.map((invoice) => migratedById.get(invoice.id)!);
  }

  private migratePayments(payments: unknown[], invoices: Invoice[], exchangeRates: ExchangeRate[]): Payment[] {
    return (payments as Partial<Payment>[]).flatMap((payment) => {
      const invoice = invoices.find((candidate) => candidate.id === payment.invoiceId);
      const paymentDate = payment.paymentDate ?? payment.confirmedAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
      const currency = payment.currency;
      if (!invoice || !currency || !['USD', 'VES', 'EUR'].includes(currency) || !Number.isFinite(payment.amount) || (payment.amount ?? 0) <= 0) return [];
      const paymentRate = this.latestRateOnOrBefore({ exchangeRates } as SalesCycleState, currency, paymentDate);
      const invoiceRate = this.latestRateOnOrBefore({ exchangeRates } as SalesCycleState, invoice.currency, paymentDate);
      const chosenRate = payment.chosenRate ?? payment.frozenRate ?? paymentRate?.rateToUsd ?? 1;
      const normalizedMethod: PaymentMethod = ['cash', 'bank transfer', 'mobile payment', 'zelle'].includes(payment.method ?? '')
        ? payment.method as PaymentMethod
        : 'bank transfer';
      return [{
        ...payment,
        reference: payment.reference?.trim() || `Legacy ${payment.id ?? 'payment'}`,
        paymentDate,
        method: normalizedMethod,
        rateSource: payment.rateSource ?? 'history',
        chosenRate,
        rateDate: payment.rateDate ?? payment.frozenRateDate ?? paymentRate?.date ?? paymentDate,
        invoiceRate: payment.invoiceRate ?? invoiceRate?.rateToUsd ?? 1,
        invoiceRateDate: payment.invoiceRateDate ?? invoiceRate?.date ?? paymentDate,
        convertedAmount: payment.convertedAmount ?? this.roundAmount(((payment.amount ?? 0) / chosenRate) * (invoiceRate?.rateToUsd ?? 1)),
        frozenRate: payment.frozenRate ?? chosenRate,
        frozenRateDate: payment.frozenRateDate ?? payment.rateDate ?? paymentRate?.date,
      } as Payment];
    });
  }

  private isInvoiceLine(line: DocumentLine | InvoiceLine): line is InvoiceLine {
    return 'deliveryId' in line && 'subtotal' in line && 'vat' in line && 'total' in line;
  }

  private seedState(): SalesCycleState {
    const inventory: InventoryItem[] = [
      { id: 'desk-lamp' as ProductId, sku: 'LGT-001', name: 'Arc Desk Lamp', availableQuantity: 24, unit: 'units', suggestedUnitPrice: 49.95 },
      { id: 'notebook' as ProductId, sku: 'OFF-014', name: 'Hardcover Notebook', availableQuantity: 80, unit: 'units', suggestedUnitPrice: 12.5 },
      { id: 'chair' as ProductId, sku: 'FUR-020', name: 'Ergonomic Chair', availableQuantity: 12, unit: 'units', suggestedUnitPrice: 275 },
    ];
    const state: SalesCycleState = {
      salesOrders: [],
      deliveries: [],
      invoices: [],
      payments: [],
      inventory,
      warehouses: [
        {
          id: DEFAULT_WAREHOUSE_ID,
          name: 'Main Warehouse',
          code: 'MAIN',
          stock: inventory.map((item) => ({ productId: item.id, availableQuantity: Math.ceil(item.availableQuantity * 0.7) })),
        },
        {
          id: 'warehouse-west',
          name: 'West Warehouse',
          code: 'WEST',
          stock: inventory.map((item) => ({ productId: item.id, availableQuantity: item.availableQuantity - Math.ceil(item.availableQuantity * 0.7) })),
        },
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

  private inventoryForState(state: SalesCycleState): InventoryItem[] {
    return state.inventory.map((item) => ({
      ...item,
      availableQuantity: state.warehouses.reduce((total, warehouse) =>
        total + (warehouse.stock.find((stock) => stock.productId === item.id)?.availableQuantity ?? 0), 0),
    }));
  }

  private defaultWarehouse(inventory: InventoryItem[]): Warehouse {
    return {
      id: DEFAULT_WAREHOUSE_ID,
      name: 'Main Warehouse',
      code: 'MAIN',
      stock: inventory.map((item) => ({ productId: item.id, availableQuantity: item.availableQuantity })),
    };
  }

  private withSecondaryWarehouse(warehouses: Warehouse[], inventory: InventoryItem[]): Warehouse[] {
    if (warehouses.some((warehouse) => warehouse.id === 'warehouse-west')) return warehouses;
    return [...warehouses, {
      id: 'warehouse-west',
      name: 'West Warehouse',
      code: 'WEST',
      stock: inventory.map((item) => ({ productId: item.id, availableQuantity: 0 })),
    }];
  }

  private warehouseNameForState(state: SalesCycleState, warehouseId: string): string {
    return state.warehouses.find((warehouse) => warehouse.id === warehouseId)?.name ?? 'Warehouse unavailable';
  }
}
