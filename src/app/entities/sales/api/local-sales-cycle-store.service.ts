import { Injectable, computed, signal } from '@angular/core';
import { ExchangeRate } from '../../exchange-rate/model/exchange-rate.models';
import {
  InventoryItem,
  Warehouse,
} from '../../inventory/model/inventory.models';
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
  /** Local transaction envelope revision; a future remote adapter replaces this seam. */
  revision: number;
  counters: DocumentCounters;
  salesOrders: SalesOrder[];
  deliveries: Delivery[];
  invoices: Invoice[];
  payments: Payment[];
  inventory: InventoryItem[];
  warehouses: Warehouse[];
  exchangeRates: ExchangeRate[];
}

interface DocumentCounters {
  SO: number;
  DES: number;
  FAC: number;
  PAG: number;
}

type DocumentCounter = keyof DocumentCounters;

interface MutationResult<T> {
  state: SalesCycleState;
  result: T;
}

export interface PaymentPreview {
  rate: ExchangeRate;
  invoiceRate: ExchangeRate;
  rateSource: 'history' | 'adjusted';
  convertedAmount: number;
}

const STORAGE_KEY = 'sales-cycle-state-v1';
const LOCK_NAME = 'sales-cycle-state-v1';
const DEFAULT_WAREHOUSE_ID = 'warehouse-main';
const FIXTURE_PRICES = new Map<
  string,
  { sku: string; name: string; suggestedUnitPrice: number }
>([
  [
    'desk-lamp',
    { sku: 'LGT-001', name: 'Arc Desk Lamp', suggestedUnitPrice: 49.95 },
  ],
  [
    'notebook',
    { sku: 'OFF-014', name: 'Hardcover Notebook', suggestedUnitPrice: 12.5 },
  ],
  [
    'chair',
    { sku: 'FUR-020', name: 'Ergonomic Chair', suggestedUnitPrice: 275 },
  ],
]);

@Injectable({ providedIn: 'root' })
export class LocalSalesCycleStore {
  private readonly state = signal<SalesCycleState>(this.readState());
  private readonly channel = this.createChannel();

  constructor() {
    this.channel?.addEventListener('message', () => this.refreshFromStorage());
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event) => {
        if (event.key === STORAGE_KEY) this.refreshFromStorage();
      });
    }
  }

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
    const subtotal = this.roundAmount(
      invoice.lines.reduce((total, line) => total + line.subtotal, 0),
    );
    const vat = this.roundAmount(
      invoice.lines.reduce((total, line) => total + line.vat, 0),
    );
    return {
      subtotal,
      vat,
      total: this.roundAmount(
        invoice.lines.reduce((total, line) => total + line.total, 0),
      ),
    };
  }

  lineTotals(line: DocumentLine): MonetaryTotals {
    const subtotal = this.roundAmount(line.quantity * line.unitPrice);
    const vat = this.roundAmount(subtotal * 0.16);
    return { subtotal, vat, total: this.roundAmount(subtotal + vat) };
  }

  salesOrderTotals(order: SalesOrder): MonetaryTotals {
    const subtotal = this.roundAmount(
      order.lines.reduce(
        (total, line) => total + this.lineTotals(line).subtotal,
        0,
      ),
    );
    const vat = this.roundAmount(
      order.lines.reduce((total, line) => total + this.lineTotals(line).vat, 0),
    );
    return { subtotal, vat, total: this.roundAmount(subtotal + vat) };
  }

  suggestedUnitPrice(productId: ProductId): number {
    return this.roundAmount(
      this.inventoryForState(this.state()).find((item) => item.id === productId)
        ?.suggestedUnitPrice ?? 0,
    );
  }

  warehouseStock(warehouseId: string, productId: ProductId): number {
    return (
      this.state()
        .warehouses.find((warehouse) => warehouse.id === warehouseId)
        ?.stock.find((item) => item.productId === productId)
        ?.availableQuantity ?? 0
    );
  }

  orderLineQuantities(
    orderId: SalesOrderId,
    productId: ProductId,
  ): OrderLineQuantities {
    const order = this.salesOrders().find(
      (candidate) => candidate.id === orderId,
    );
    const ordered =
      order?.lines
        .filter((line) => line.productId === productId)
        .reduce((total, line) => total + line.quantity, 0) ?? 0;
    const delivered = this.deliveries()
      .filter(
        (delivery) =>
          delivery.orderId === orderId && delivery.status === 'validated',
      )
      .flatMap((delivery) => delivery.lines)
      .filter((line) => line.productId === productId)
      .reduce((total, line) => total + line.quantity, 0);
    const invoiced = this.invoices()
      .filter(
        (invoice) => invoice.orderId === orderId && invoice.status !== 'voided',
      )
      .flatMap((invoice) => invoice.lines)
      .filter((line) => line.productId === productId)
      .reduce((total, line) => total + line.quantity, 0);
    return { ordered, delivered, invoiced };
  }

  invoiceSettledTotal(invoiceId: InvoiceId): number {
    return this.settledTotalForState(this.state(), invoiceId);
  }

  invoiceBalance(invoice: Invoice): number {
    return this.roundAmount(
      this.invoiceTotal(invoice) - this.invoiceSettledTotal(invoice.id),
    );
  }

  paymentPreview(
    invoice: Invoice,
    currency: CurrencyCode,
    amount: number,
    paymentDate: string,
    adjustedRate?: number,
  ): PaymentPreview | undefined {
    return this.paymentPreviewForState(
      this.state(),
      invoice,
      currency,
      amount,
      paymentDate,
      adjustedRate,
    );
  }

  invoiceEligibility(orderId: SalesOrderId):
    | {
        lines: DocumentLine[];
        deliveryIds: DeliveryId[];
        deliveryReferences: string[];
      }
    | undefined {
    return this.invoiceEligibilityForState(this.state(), orderId);
  }

  createSalesOrder(input: {
    customerName: string;
    currency: CurrencyCode;
    orderDate?: string;
    lines: DocumentLine[];
  }): SalesOrder {
    return this.mutate((state) => {
      if (!this.isValidSalesOrderInput(input)) {
        return { state, result: undefined as unknown as SalesOrder };
      }
      const allocated = this.allocateReference(state, 'SO');
      const order: SalesOrder = {
        id: this.salesOrderId(),
        reference: allocated.reference,
        customerName: input.customerName.trim(),
        status: 'draft',
        currency: input.currency,
        lines: input.lines.map((line, index) => ({
          ...line,
          sourceLineId:
            line.sourceLineId ?? `order:${allocated.reference}:${index}`,
          unitPrice: this.roundAmount(line.unitPrice),
        })),
        orderDate: input.orderDate ?? new Date().toISOString().slice(0, 10),
        createdAt: new Date().toISOString(),
      };
      return {
        state: {
          ...state,
          counters: allocated.counters,
          salesOrders: [order, ...state.salesOrders],
        },
        result: order,
      };
    }) as SalesOrder;
  }

  updateSalesOrder(input: {
    id: SalesOrderId;
    customerName: string;
    currency: CurrencyCode;
    orderDate: string;
    lines: DocumentLine[];
  }): void {
    this.updateState((state) => ({
      ...state,
      salesOrders: !this.isValidSalesOrderInput(input)
        ? state.salesOrders
        : state.salesOrders.map((order) =>
            order.id === input.id && order.status === 'draft'
              ? {
                  ...order,
                  customerName: input.customerName.trim(),
                  currency: input.currency,
                  orderDate: input.orderDate,
                  lines: input.lines.map((line) => ({
                    ...line,
                    unitPrice: this.roundAmount(line.unitPrice),
                  })),
                }
              : order,
          ),
    }));
  }

  confirmSalesOrder(orderId: SalesOrderId): void {
    this.updateState((state) => {
      const order = state.salesOrders.find(
        (candidate) => candidate.id === orderId,
      );
      if (!order || order.status !== 'draft') return state;

      const allocated = this.allocateReference(state, 'DES');
      const delivery: Delivery = {
        id: this.deliveryId(),
        reference: allocated.reference,
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
        counters: allocated.counters,
        salesOrders: state.salesOrders.map((candidate) =>
          candidate.id === orderId
            ? { ...candidate, status: 'confirmed' }
            : candidate,
        ),
        deliveries: [delivery, ...state.deliveries],
      };
    });
  }

  cancelSalesOrder(orderId: SalesOrderId): void {
    this.updateState((state) => {
      const order = state.salesOrders.find(
        (candidate) => candidate.id === orderId,
      );
      if (!order || !this.canCancelSalesOrderForState(state, order))
        return state;
      return {
        ...state,
        salesOrders: state.salesOrders.map((candidate) =>
          candidate.id === orderId
            ? { ...candidate, status: 'cancelled' }
            : candidate,
        ),
      };
    });
  }

  canCancelSalesOrder(order: SalesOrder): boolean {
    return this.canCancelSalesOrderForState(this.state(), order);
  }

  updateDeliveryWarehouse(deliveryId: DeliveryId, warehouseId: string): void {
    this.updateState((state) => {
      const delivery = state.deliveries.find(
        (candidate) => candidate.id === deliveryId,
      );
      const warehouse = state.warehouses.find(
        (candidate) => candidate.id === warehouseId,
      );
      if (!delivery || delivery.status !== 'pending' || !warehouse)
        return state;
      return {
        ...state,
        deliveries: state.deliveries.map((candidate) =>
          candidate.id === deliveryId
            ? {
                ...candidate,
                warehouseId: warehouse.id,
                warehouseName: warehouse.name,
              }
            : candidate,
        ),
      };
    });
  }

  validateDelivery(
    deliveryId: DeliveryId,
    shippedLines?: DocumentLine[],
  ): void {
    this.updateState((state) => {
      const delivery = state.deliveries.find(
        (candidate) => candidate.id === deliveryId,
      );
      if (!delivery || delivery.status !== 'pending') return state;

      const warehouse = state.warehouses.find(
        (candidate) => candidate.id === delivery.warehouseId,
      );
      const shipment = shippedLines ?? delivery.lines;
      const shippedBySource = this.shippedQuantitiesBySource(
        delivery,
        shipment,
      );
      if (!warehouse || !shippedBySource) return state;
      const shippedByProduct = this.quantitiesByProduct(shipment);
      const deliveredBySource = this.quantitiesBySource(
        state.deliveries
          .filter(
            (candidate) =>
              candidate.id !== delivery.id && candidate.status === 'validated',
          )
          .flatMap((candidate) => candidate.lines),
      );
      const order = state.salesOrders.find(
        (candidate) => candidate.id === delivery.orderId,
      );
      const hasAvailableStock = [...shippedByProduct].every(
        ([productId, quantity]) =>
          quantity <=
          (warehouse.stock.find((item) => item.productId === productId)
            ?.availableQuantity ?? 0),
      );
      const respectsOrderSources = delivery.lines.every((line) => {
        const sourceLine = order?.lines.find(
          (candidate) => candidate.sourceLineId === line.sourceLineId,
        );
        const shippedQuantity = shippedBySource.get(line.sourceLineId!) ?? 0;
        return (
          sourceLine?.productId === line.productId &&
          (deliveredBySource.get(line.sourceLineId!) ?? 0) + shippedQuantity <=
            sourceLine.quantity
        );
      });
      if (!hasAvailableStock || !respectsOrderSources) return state;

      const validatedLines = delivery.lines.map((line) => ({
        ...line,
        quantity: shippedBySource.get(line.sourceLineId!)!,
      }));
      const backorderLines = delivery.lines.flatMap((line) => {
        const pendingQuantity =
          line.quantity - (shippedBySource.get(line.sourceLineId!) ?? 0);
        return pendingQuantity > 0
          ? [{ ...line, quantity: pendingQuantity }]
          : [];
      });
      const nextDeliveries = state.deliveries.map((candidate) =>
        candidate.id === deliveryId
          ? {
              ...candidate,
              status: 'validated' as const,
              lines: validatedLines,
            }
          : candidate,
      );
      const backorderAllocation =
        backorderLines.length > 0
          ? this.allocateReference(state, 'DES')
          : undefined;
      const backorder: Delivery | undefined = backorderAllocation
        ? {
            id: this.deliveryId(),
            reference: backorderAllocation.reference,
            orderId: delivery.orderId,
            orderReference: delivery.orderReference,
            customerName: delivery.customerName,
            warehouseId: delivery.warehouseId,
            warehouseName: delivery.warehouseName,
            parentDeliveryId: delivery.id,
            status: 'pending',
            lines: backorderLines,
            createdAt: new Date().toISOString(),
          }
        : undefined;
      const deliveries = backorder
        ? [backorder, ...nextDeliveries]
        : nextDeliveries;
      return this.recomputeSalesOrderCompletion(
        {
          ...state,
          counters: backorderAllocation?.counters ?? state.counters,
          deliveries,
          warehouses: state.warehouses.map((candidate) =>
            candidate.id !== warehouse.id
              ? candidate
              : {
                  ...candidate,
                  stock: candidate.stock.map((item) => ({
                    ...item,
                    availableQuantity:
                      item.availableQuantity -
                      (shippedByProduct.get(item.productId) ?? 0),
                  })),
                },
          ),
        },
        delivery.orderId,
      );
    });
  }

  cancelDelivery(deliveryId: DeliveryId): void {
    this.updateState((state) => {
      const delivery = state.deliveries.find(
        (candidate) => candidate.id === deliveryId,
      );
      if (!delivery || delivery.status !== 'pending') return state;

      return {
        ...state,
        deliveries: state.deliveries.map((candidate) =>
          candidate.id === deliveryId
            ? { ...candidate, status: 'cancelled' }
            : candidate,
        ),
      };
    });
  }

  createInvoiceFromOrder(orderId: SalesOrderId): Invoice | undefined {
    return this.mutate((state) => {
      const order = state.salesOrders.find(
        (candidate) => candidate.id === orderId,
      );
      const eligibility = this.invoiceEligibilityForState(state, orderId);
      if (!order || !eligibility) return { state, result: undefined };

      const createdInvoice: Invoice = {
        id: this.invoiceId(),
        reference: `draft-${this.identifier()}`,
        orderId: order.id,
        orderReference: order.reference,
        deliveryIds: eligibility.deliveryIds,
        deliveryReferences: eligibility.deliveryReferences,
        status: 'draft',
        currency: order.currency,
        lines: eligibility.lines,
        createdAt: new Date().toISOString(),
      };
      return {
        state: this.recomputeSalesOrderCompletion(
          { ...state, invoices: [createdInvoice, ...state.invoices] },
          orderId,
        ),
        result: createdInvoice,
      };
    }) as Invoice | undefined;
  }

  publishInvoice(invoiceId: InvoiceId): void {
    this.transitionInvoice(invoiceId, 'published');
  }

  voidInvoice(invoiceId: InvoiceId): void {
    this.transitionInvoice(invoiceId, 'voided');
  }

  createPayment(input: {
    invoiceId: InvoiceId;
    currency: CurrencyCode;
    amount: number;
    paymentDate: string;
    method: PaymentMethod;
    reference: string;
    adjustedRate?: number;
  }): Payment | undefined {
    return this.mutate((state) => {
      const invoice = state.invoices.find(
        (candidate) => candidate.id === input.invoiceId,
      );
      const preview = invoice
        ? this.paymentPreviewForState(
            state,
            invoice,
            input.currency,
            this.roundAmount(input.amount),
            input.paymentDate,
            input.adjustedRate,
          )
        : undefined;
      if (
        !invoice ||
        !this.isPayableInvoice(invoice) ||
        this.invoiceBalanceForState(state, invoice) <= 0 ||
        !this.isValidPaymentInput(input) ||
        !preview ||
        preview.convertedAmount > this.invoiceTotal(invoice) + 0.01
      ) {
        return { state, result: undefined };
      }

      const payment: Payment = {
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
      return {
        state: { ...state, payments: [payment, ...state.payments] },
        result: payment,
      };
    }) as Payment | undefined;
  }

  confirmPayment(paymentId: string): void {
    this.updateState((state) => {
      const payment = state.payments.find(
        (candidate) => candidate.id === paymentId,
      );
      const invoice = payment
        ? state.invoices.find((candidate) => candidate.id === payment.invoiceId)
        : undefined;
      if (
        !payment ||
        !invoice ||
        payment.status !== 'draft' ||
        !this.isPayableInvoice(invoice) ||
        this.settledTotalForState(state, invoice.id) + payment.convertedAmount >
          this.invoiceTotal(invoice) + 0.01
      ) {
        return state;
      }

      const allocated = this.allocateReference(state, 'PAG');
      const confirmedPayment: Payment = {
        ...payment,
        status: 'confirmed',
        confirmedAt: new Date().toISOString(),
        documentReference: allocated.reference,
      };
      return this.recomputeSalesOrderCompletion(
        this.withSettlementStatus(
          {
            ...state,
            counters: allocated.counters,
            payments: state.payments.map((candidate) =>
              candidate.id === paymentId ? confirmedPayment : candidate,
            ),
          },
          invoice.id,
        ),
        invoice.orderId,
      );
    });
  }

  voidPayment(paymentId: string): void {
    this.updateState((state) => {
      const payment = state.payments.find(
        (candidate) => candidate.id === paymentId,
      );
      if (
        !payment ||
        (payment.status !== 'draft' && payment.status !== 'confirmed')
      )
        return state;
      const nextState = this.withSettlementStatus(
        {
          ...state,
          payments: state.payments.map((candidate) =>
            candidate.id === paymentId
              ? { ...candidate, status: 'voided' }
              : candidate,
          ),
        },
        payment.invoiceId,
      );
      const invoice = nextState.invoices.find(
        (candidate) => candidate.id === payment.invoiceId,
      );
      return invoice
        ? this.recomputeSalesOrderCompletion(nextState, invoice.orderId)
        : nextState;
    });
  }

  private updateState(
    update: (state: SalesCycleState) => SalesCycleState,
  ): void {
    void this.mutate((state) => ({ state: update(state), result: undefined }));
  }

  /**
   * Serializes same-origin browser writes with the Web Locks API. This local
   * browser store has no cross-device or server-authoritative guarantee.
   * Environments without `navigator.locks` execute synchronously, but do not
   * receive a cross-tab serialization guarantee. A future Supabase repository
   * will replace this explicit local-only seam.
   */
  private mutate<T>(
    mutation: (state: SalesCycleState) => MutationResult<T>,
  ): T | Promise<T> {
    const commit = (): T => {
      const current = this.readState();
      const mutationResult = mutation(current);
      if (mutationResult.state === current) {
        this.state.set(current);
        return mutationResult.result;
      }
      const next = {
        ...mutationResult.state,
        revision: current.revision + 1,
      };
      this.state.set(next);
      this.persist(next);
      this.channel?.postMessage({ revision: next.revision });
      return mutationResult.result;
    };
    const locks = this.locks();
    return locks
      ? locks.request(LOCK_NAME, { mode: 'exclusive' }, commit)
      : commit();
  }

  private allocateReference(
    state: SalesCycleState,
    counter: DocumentCounter,
  ): { reference: string; counters: DocumentCounters } {
    const value = state.counters[counter] + 1;
    return {
      reference: `${counter}-${value.toString().padStart(6, '0')}`,
      counters: { ...state.counters, [counter]: value },
    };
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

  private transitionInvoice(
    invoiceId: InvoiceId,
    targetStatus: InvoiceStatus,
  ): void {
    this.updateState((state) => {
      const invoice = state.invoices.find(
        (candidate) => candidate.id === invoiceId,
      );
      if (!invoice || !this.canTransitionInvoice(invoice.status, targetStatus))
        return state;
      const allocated =
        targetStatus === 'published'
          ? this.allocateReference(state, 'FAC')
          : undefined;
      return {
        ...this.recomputeSalesOrderCompletion(
          {
            ...state,
            counters: allocated?.counters ?? state.counters,
            invoices: state.invoices.map((candidate) => {
              if (candidate.id !== invoiceId) return candidate;
              if (targetStatus !== 'published')
                return { ...candidate, status: targetStatus };
              return {
                ...candidate,
                ...this.publicationSnapshot(
                  state,
                  candidate,
                  undefined,
                  allocated?.reference,
                ),
                reference: allocated?.reference ?? candidate.reference,
                status: targetStatus,
              };
            }),
          },
          invoice.orderId,
        ),
      };
    });
  }

  private canTransitionInvoice(
    currentStatus: InvoiceStatus,
    targetStatus: InvoiceStatus,
  ): boolean {
    if (currentStatus === 'draft')
      return targetStatus === 'published' || targetStatus === 'voided';
    if (currentStatus === 'published')
      return (
        targetStatus === 'partial' ||
        targetStatus === 'paid' ||
        targetStatus === 'voided'
      );
    if (currentStatus === 'partial')
      return targetStatus === 'paid' || targetStatus === 'voided';
    return false;
  }

  private isPayableInvoice(invoice: Invoice): boolean {
    return invoice.status === 'published' || invoice.status === 'partial';
  }

  private isValidPaymentInput(input: {
    currency: CurrencyCode;
    amount: number;
    paymentDate: string;
    method: PaymentMethod;
    reference: string;
    adjustedRate?: number;
  }): boolean {
    return (
      ['USD', 'VES', 'EUR'].includes(input.currency) &&
      Number.isFinite(input.amount) &&
      input.amount > 0 &&
      this.isValidDate(input.paymentDate) &&
      ['cash', 'bank transfer', 'mobile payment', 'zelle'].includes(
        input.method,
      ) &&
      input.reference.trim().length > 0 &&
      (input.adjustedRate === undefined ||
        (Number.isFinite(input.adjustedRate) && input.adjustedRate > 0))
    );
  }

  private isValidSalesOrderInput(input: {
    customerName: string;
    currency: CurrencyCode;
    orderDate?: string;
    lines: DocumentLine[];
  }): boolean {
    return (
      typeof input.customerName === 'string' &&
      input.customerName.trim().length > 0 &&
      ['USD', 'VES', 'EUR'].includes(input.currency) &&
      (input.orderDate === undefined || this.isValidDate(input.orderDate)) &&
      Array.isArray(input.lines) &&
      input.lines.every(
        (line) =>
          typeof line.productId === 'string' &&
          typeof line.description === 'string' &&
          line.description.trim().length > 0 &&
          Number.isInteger(line.quantity) &&
          line.quantity > 0 &&
          Number.isFinite(line.unitPrice) &&
          line.unitPrice >= 0,
      )
    );
  }

  private isValidDate(date: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    const parsed = new Date(`${date}T00:00:00.000Z`);
    return (
      !Number.isNaN(parsed.valueOf()) &&
      parsed.toISOString().slice(0, 10) === date
    );
  }

  private shippedQuantitiesBySource(
    delivery: Delivery,
    shipment: DocumentLine[],
  ): Map<string, number> | undefined {
    if (shipment.length !== delivery.lines.length) return undefined;
    const expected = new Map(
      delivery.lines.map((line) => [line.sourceLineId, line]),
    );
    const shipped = new Map<string, number>();
    for (const line of shipment) {
      const expectedLine = expected.get(line.sourceLineId);
      if (
        !line.sourceLineId ||
        !expectedLine ||
        shipped.has(line.sourceLineId) ||
        line.productId !== expectedLine.productId ||
        !Number.isInteger(line.quantity) ||
        line.quantity <= 0 ||
        line.quantity > expectedLine.quantity
      )
        return undefined;
      shipped.set(line.sourceLineId, line.quantity);
    }
    return shipped.size === expected.size ? shipped : undefined;
  }

  private quantitiesBySource(lines: DocumentLine[]): Map<string, number> {
    return lines.reduce((quantities, line) => {
      if (!line.sourceLineId) return quantities;
      quantities.set(
        line.sourceLineId,
        (quantities.get(line.sourceLineId) ?? 0) + line.quantity,
      );
      return quantities;
    }, new Map<string, number>());
  }

  private recomputeSalesOrderCompletion(
    state: SalesCycleState,
    orderId: SalesOrderId,
  ): SalesCycleState {
    const order = state.salesOrders.find(
      (candidate) => candidate.id === orderId,
    );
    if (!order || order.status === 'draft' || order.status === 'cancelled')
      return state;
    const deliveredBySource = this.quantitiesBySource(
      state.deliveries
        .filter(
          (delivery) =>
            delivery.orderId === orderId && delivery.status === 'validated',
        )
        .flatMap((delivery) => delivery.lines),
    );
    const invoicedBySource = this.quantitiesBySource(
      state.invoices
        .filter(
          (invoice) =>
            invoice.orderId === orderId && invoice.status !== 'voided',
        )
        .flatMap((invoice) => invoice.lines),
    );
    const nonVoidedInvoices = state.invoices.filter(
      (invoice) => invoice.orderId === orderId && invoice.status !== 'voided',
    );
    const completed =
      order.lines.length > 0 &&
      order.lines.every(
        (line) =>
          (deliveredBySource.get(line.sourceLineId ?? '') ?? 0) ===
            line.quantity &&
          (invoicedBySource.get(line.sourceLineId ?? '') ?? 0) ===
            line.quantity,
      ) &&
      nonVoidedInvoices.length > 0 &&
      nonVoidedInvoices.every((invoice) => invoice.status === 'paid');
    return {
      ...state,
      salesOrders: state.salesOrders.map((candidate) =>
        candidate.id === orderId
          ? { ...candidate, status: completed ? 'completed' : 'confirmed' }
          : candidate,
      ),
    };
  }

  private canCancelSalesOrderForState(
    state: SalesCycleState,
    order: SalesOrder,
  ): boolean {
    if (order.status !== 'draft' && order.status !== 'confirmed') return false;
    const hasValidatedDelivery = state.deliveries.some(
      (delivery) =>
        delivery.orderId === order.id && delivery.status === 'validated',
    );
    const hasCommittedInvoice = state.invoices.some(
      (invoice) =>
        invoice.orderId === order.id &&
        (invoice.status === 'published' ||
          invoice.status === 'partial' ||
          invoice.status === 'paid'),
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
    const invoiceRate = this.latestRateOnOrBefore(
      state,
      invoice.currency,
      paymentDate,
    );
    if (
      !historyRate ||
      !invoiceRate ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      (adjustedRate !== undefined &&
        (!Number.isFinite(adjustedRate) || adjustedRate <= 0))
    )
      return undefined;
    const rate =
      adjustedRate === undefined
        ? historyRate
        : { ...historyRate, rateToUsd: adjustedRate };
    return {
      rate,
      invoiceRate,
      rateSource: adjustedRate === undefined ? 'history' : 'adjusted',
      convertedAmount: this.roundAmount(
        (amount / rate.rateToUsd) * invoiceRate.rateToUsd,
      ),
    };
  }

  private settledTotalForState(
    state: SalesCycleState,
    invoiceId: InvoiceId,
  ): number {
    return this.roundAmount(
      state.payments
        .filter(
          (payment) =>
            payment.invoiceId === invoiceId && payment.status === 'confirmed',
        )
        .reduce((total, payment) => total + (payment.convertedAmount ?? 0), 0),
    );
  }

  private invoiceBalanceForState(
    state: SalesCycleState,
    invoice: Invoice,
  ): number {
    return this.roundAmount(
      this.invoiceTotal(invoice) - this.settledTotalForState(state, invoice.id),
    );
  }

  private withSettlementStatus(
    state: SalesCycleState,
    invoiceId: InvoiceId,
  ): SalesCycleState {
    const invoice = state.invoices.find(
      (candidate) => candidate.id === invoiceId,
    );
    if (!invoice || invoice.status === 'draft' || invoice.status === 'voided')
      return state;
    const balance = this.invoiceBalanceForState(state, invoice);
    const status: InvoiceStatus =
      balance <= 0.01
        ? 'paid'
        : balance < this.invoiceTotal(invoice)
          ? 'partial'
          : 'published';
    return {
      ...state,
      invoices: state.invoices.map((candidate) =>
        candidate.id === invoiceId ? { ...candidate, status } : candidate,
      ),
    };
  }

  private invoiceLineSnapshot(
    line: DocumentLine,
    quantity: number,
    delivery: Delivery,
    deliveryLineIndex: number,
  ): InvoiceLine {
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

  private deliveryLineKey(
    deliveryId: DeliveryId,
    deliveryLineIndex: number,
  ): string {
    return `${deliveryId}:${deliveryLineIndex}`;
  }

  private publicationSnapshot(
    state: SalesCycleState,
    invoice: Invoice,
    issueDate = new Date().toISOString().slice(0, 10),
    documentNumber?: string,
  ): Pick<
    Invoice,
    | 'number'
    | 'issueDate'
    | 'issuedCurrency'
    | 'vesFxRate'
    | 'vesFxDate'
    | 'vesEquivalentTotal'
  > {
    const vesRate = this.latestRateOnOrBefore(state, 'VES', issueDate);
    const invoiceRate = this.latestRateOnOrBefore(
      state,
      invoice.currency,
      issueDate,
    );
    const vesEquivalentTotal =
      vesRate && invoiceRate
        ? this.roundAmount(
            (this.invoiceTotal(invoice) / invoiceRate.rateToUsd) *
              vesRate.rateToUsd,
          )
        : undefined;
    return {
      number: documentNumber ?? this.nextInvoiceNumber(state, issueDate),
      issueDate,
      issuedCurrency: invoice.currency,
      vesFxRate: vesRate?.rateToUsd,
      vesFxDate: vesRate?.date,
      vesEquivalentTotal,
    };
  }

  private latestRateOnOrBefore(
    state: SalesCycleState,
    currency: CurrencyCode,
    date: string,
  ): ExchangeRate | undefined {
    return state.exchangeRates
      .filter((rate) => rate.currency === currency && rate.date <= date)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
  }

  private nextInvoiceNumber(state: SalesCycleState, issueDate: string): string {
    const year = issueDate.slice(0, 4);
    const sequence =
      state.invoices.reduce((maximum, invoice) => {
        const match = invoice.number?.match(
          new RegExp(`^INV-${year}-(\\d{6})$`),
        );
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
  ):
    | {
        lines: InvoiceLine[];
        deliveryIds: DeliveryId[];
        deliveryReferences: string[];
      }
    | undefined {
    const order = state.salesOrders.find(
      (candidate) => candidate.id === orderId,
    );
    if (!order) return undefined;

    const validatedDeliveries = state.deliveries.filter(
      (delivery) =>
        delivery.orderId === orderId && delivery.status === 'validated',
    );
    const invoicedByDeliveryLine = new Map<string, number>();
    state.invoices
      .filter(
        (invoice) => invoice.orderId === orderId && invoice.status !== 'voided',
      )
      .flatMap((invoice) => invoice.lines)
      .forEach((line) => {
        const key = this.deliveryLineKey(
          line.deliveryId,
          line.deliveryLineIndex,
        );
        invoicedByDeliveryLine.set(
          key,
          (invoicedByDeliveryLine.get(key) ?? 0) + line.quantity,
        );
      });
    const lines = validatedDeliveries.flatMap((delivery) =>
      delivery.lines.flatMap((line, deliveryLineIndex) => {
        const pendingQuantity = Math.max(
          0,
          line.quantity -
            (invoicedByDeliveryLine.get(
              this.deliveryLineKey(delivery.id, deliveryLineIndex),
            ) ?? 0),
        );
        return pendingQuantity > 0
          ? [
              this.invoiceLineSnapshot(
                line,
                pendingQuantity,
                delivery,
                deliveryLineIndex,
              ),
            ]
          : [];
      }),
    );
    if (lines.length === 0) return undefined;

    const sourceDeliveryIds = new Set(lines.map((line) => line.deliveryId));
    const sourceDeliveries = validatedDeliveries.filter((delivery) =>
      sourceDeliveryIds.has(delivery.id),
    );
    return {
      lines,
      deliveryIds: sourceDeliveries.map((delivery) => delivery.id),
      deliveryReferences: sourceDeliveries.map(
        (delivery) => delivery.reference,
      ),
    };
  }

  private quantitiesByProduct(lines: DocumentLine[]): Map<ProductId, number> {
    return lines.reduce((quantities, line) => {
      quantities.set(
        line.productId,
        (quantities.get(line.productId) ?? 0) + line.quantity,
      );
      return quantities;
    }, new Map<ProductId, number>());
  }

  private identifier(): string {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  }

  private readState(): SalesCycleState {
    const stored = this.storage()?.getItem(STORAGE_KEY);
    if (!stored) return this.seedState();

    try {
      const state = JSON.parse(stored) as Partial<SalesCycleState>;
      const inventory = (state.inventory ?? []).map((item) =>
        this.migrateFixturePrice(item),
      );
      const warehouses = this.withSecondaryWarehouse(
        state.warehouses?.length
          ? state.warehouses
          : [this.defaultWarehouse(inventory)],
        inventory,
      );
      const salesOrders = (state.salesOrders ?? []).map((order) => ({
        ...order,
        orderDate: order.orderDate ?? order.createdAt.slice(0, 10),
        lines: (order.lines ?? []).map((line, index) => ({
          ...line,
          sourceLineId:
            line.sourceLineId ?? `legacy:order:${order.id}:line:${index}`,
        })),
      }));
      const deliveries: Delivery[] = (state.deliveries ?? []).map(
        (delivery) => {
          const order = salesOrders.find(
            (candidate) => candidate.id === delivery.orderId,
          );
          const warehouse =
            warehouses.find(
              (candidate) => candidate.id === delivery.warehouseId,
            ) ?? warehouses[0];
          return {
            ...delivery,
            customerName:
              delivery.customerName ??
              order?.customerName ??
              'Customer unavailable',
            warehouseId: warehouse.id,
            warehouseName: warehouse.name,
            reference:
              delivery.reference?.trim() || `legacy:delivery:${delivery.id}`,
            lines: (delivery.lines ?? []).map((line, index) => ({
              ...line,
              sourceLineId:
                line.sourceLineId ??
                order?.lines.find(
                  (orderLine) => orderLine.productId === line.productId,
                )?.sourceLineId ??
                `legacy:delivery:${delivery.id}:line:${index}`,
            })),
          };
        },
      );
      const invoices = this.migrateInvoices(
        state.invoices ?? [],
        deliveries,
        state.exchangeRates ?? [],
      );
      const migratedState = {
        ...state,
        revision:
          Number.isSafeInteger(state.revision) && (state.revision ?? -1) >= 0
            ? state.revision
            : 0,
        counters: this.migrateCounters(state, invoices),
        inventory,
        warehouses,
        salesOrders,
        deliveries,
        invoices,
        payments: this.migratePayments(
          state.payments ?? [],
          invoices,
          state.exchangeRates ?? [],
        ),
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
    const isKnownFixture =
      fixture?.sku === item.sku && fixture.name === item.name;
    const existingPrice = item.suggestedUnitPrice;
    const suggestedUnitPrice =
      isKnownFixture &&
      (existingPrice === undefined ||
        !Number.isFinite(existingPrice) ||
        existingPrice <= 0)
        ? fixture.suggestedUnitPrice
        : (existingPrice ?? 0);
    return {
      ...item,
      suggestedUnitPrice: this.roundAmount(suggestedUnitPrice),
    };
  }

  private migrateInvoices(
    invoices: unknown[],
    deliveries: Delivery[],
    exchangeRates: ExchangeRate[],
  ): Invoice[] {
    const typedInvoices = invoices as Invoice[];
    const claimedQuantities = new Map<string, number>();
    const migratedById = new Map<InvoiceId, Invoice>();
    const chronological = [...typedInvoices].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );

    chronological.forEach((invoice) => {
      const lines = (
        (invoice.lines ?? []) as Array<DocumentLine | InvoiceLine>
      ).flatMap((line) => {
        if (this.isInvoiceLine(line)) {
          const delivery = deliveries.find(
            (candidate) => candidate.id === line.deliveryId,
          );
          return [
            {
              ...line,
              sourceLineId:
                line.sourceLineId ??
                delivery?.lines[line.deliveryLineIndex]?.sourceLineId ??
                `legacy:invoice:${invoice.id}:line:${line.deliveryLineIndex}`,
            },
          ];
        }
        let remaining = line.quantity;
        const allocated: InvoiceLine[] = [];
        const sources = deliveries.filter(
          (delivery) =>
            (invoice.deliveryIds ?? []).includes(delivery.id) &&
            delivery.status === 'validated',
        );
        for (const delivery of sources) {
          for (const [
            deliveryLineIndex,
            deliveryLine,
          ] of delivery.lines.entries()) {
            if (deliveryLine.productId !== line.productId || remaining <= 0)
              continue;
            const key = this.deliveryLineKey(delivery.id, deliveryLineIndex);
            const available = Math.max(
              0,
              deliveryLine.quantity - (claimedQuantities.get(key) ?? 0),
            );
            const quantity = Math.min(remaining, available);
            if (quantity <= 0) continue;
            allocated.push(
              this.invoiceLineSnapshot(
                {
                  ...line,
                  unitPrice: line.unitPrice ?? deliveryLine.unitPrice,
                },
                quantity,
                delivery,
                deliveryLineIndex,
              ),
            );
            remaining -= quantity;
          }
        }
        return allocated.length > 0 ? allocated : [];
      });
      const migrated: Invoice = { ...invoice, lines };
      if (migrated.status !== 'draft' && !migrated.number) {
        const issueDate = migrated.createdAt.slice(0, 10);
        Object.assign(
          migrated,
          this.publicationSnapshot(
            {
              revision: 0,
              counters: { SO: 0, DES: 0, FAC: 0, PAG: 0 },
              salesOrders: [],
              deliveries,
              invoices: [...typedInvoices, ...migratedById.values()],
              payments: [],
              inventory: [],
              warehouses: [],
              exchangeRates,
            },
            migrated,
            issueDate,
          ),
        );
      }
      if (migrated.status !== 'voided') {
        migrated.lines.forEach((line) => {
          const key = this.deliveryLineKey(
            line.deliveryId,
            line.deliveryLineIndex,
          );
          claimedQuantities.set(
            key,
            (claimedQuantities.get(key) ?? 0) + line.quantity,
          );
        });
      }
      migratedById.set(migrated.id, migrated);
    });
    return typedInvoices.map((invoice) => migratedById.get(invoice.id)!);
  }

  private migratePayments(
    payments: unknown[],
    invoices: Invoice[],
    exchangeRates: ExchangeRate[],
  ): Payment[] {
    return (payments as Partial<Payment>[]).flatMap((payment) => {
      const invoice = invoices.find(
        (candidate) => candidate.id === payment.invoiceId,
      );
      const paymentDate =
        payment.paymentDate ??
        payment.confirmedAt?.slice(0, 10) ??
        new Date().toISOString().slice(0, 10);
      const currency = payment.currency;
      if (
        !invoice ||
        !currency ||
        !['USD', 'VES', 'EUR'].includes(currency) ||
        !Number.isFinite(payment.amount) ||
        (payment.amount ?? 0) <= 0
      )
        return [];
      const paymentRate = this.latestRateOnOrBefore(
        { exchangeRates } as SalesCycleState,
        currency,
        paymentDate,
      );
      const invoiceRate = this.latestRateOnOrBefore(
        { exchangeRates } as SalesCycleState,
        invoice.currency,
        paymentDate,
      );
      const chosenRate =
        payment.chosenRate ?? payment.frozenRate ?? paymentRate?.rateToUsd ?? 1;
      const normalizedMethod: PaymentMethod = [
        'cash',
        'bank transfer',
        'mobile payment',
        'zelle',
      ].includes(payment.method ?? '')
        ? (payment.method as PaymentMethod)
        : 'bank transfer';
      return [
        {
          ...payment,
          reference:
            payment.reference?.trim() || `Legacy ${payment.id ?? 'payment'}`,
          paymentDate,
          method: normalizedMethod,
          rateSource: payment.rateSource ?? 'history',
          chosenRate,
          rateDate:
            payment.rateDate ??
            payment.frozenRateDate ??
            paymentRate?.date ??
            paymentDate,
          invoiceRate: payment.invoiceRate ?? invoiceRate?.rateToUsd ?? 1,
          invoiceRateDate:
            payment.invoiceRateDate ?? invoiceRate?.date ?? paymentDate,
          convertedAmount:
            payment.convertedAmount ??
            this.roundAmount(
              ((payment.amount ?? 0) / chosenRate) *
                (invoiceRate?.rateToUsd ?? 1),
            ),
          frozenRate: payment.frozenRate ?? chosenRate,
          frozenRateDate:
            payment.frozenRateDate ?? payment.rateDate ?? paymentRate?.date,
        } as Payment,
      ];
    });
  }

  private isInvoiceLine(line: DocumentLine | InvoiceLine): line is InvoiceLine {
    return (
      'deliveryId' in line &&
      'subtotal' in line &&
      'vat' in line &&
      'total' in line
    );
  }

  private migrateCounters(
    state: Partial<SalesCycleState>,
    invoices: Invoice[],
  ): DocumentCounters {
    const legacyCounters = state.counters ?? { SO: 0, DES: 0, FAC: 0, PAG: 0 };
    const references = [
      ...(state.salesOrders ?? []).map((order) => order.reference),
      ...(state.deliveries ?? []).map((delivery) => delivery.reference),
      ...invoices.flatMap((invoice) => [invoice.reference, invoice.number]),
      ...(state.payments ?? []).map((payment) => payment.documentReference),
    ];
    return (['SO', 'DES', 'FAC', 'PAG'] as const).reduce(
      (counters, counter) => ({
        ...counters,
        [counter]: Math.max(
          legacyCounters[counter] ?? 0,
          ...references.map((reference) =>
            this.referenceSequence(reference, counter),
          ),
        ),
      }),
      { SO: 0, DES: 0, FAC: 0, PAG: 0 },
    );
  }

  private referenceSequence(
    reference: string | undefined,
    counter: DocumentCounter,
  ): number {
    const match = reference?.match(new RegExp(`^${counter}-(\\d{6})$`));
    return match ? Number(match[1]) : 0;
  }

  private seedState(): SalesCycleState {
    const inventory: InventoryItem[] = [
      {
        id: 'desk-lamp' as ProductId,
        sku: 'LGT-001',
        name: 'Arc Desk Lamp',
        availableQuantity: 24,
        unit: 'units',
        suggestedUnitPrice: 49.95,
      },
      {
        id: 'notebook' as ProductId,
        sku: 'OFF-014',
        name: 'Hardcover Notebook',
        availableQuantity: 80,
        unit: 'units',
        suggestedUnitPrice: 12.5,
      },
      {
        id: 'chair' as ProductId,
        sku: 'FUR-020',
        name: 'Ergonomic Chair',
        availableQuantity: 12,
        unit: 'units',
        suggestedUnitPrice: 275,
      },
    ];
    const state: SalesCycleState = {
      revision: 0,
      counters: { SO: 0, DES: 0, FAC: 0, PAG: 0 },
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
          stock: inventory.map((item) => ({
            productId: item.id,
            availableQuantity: Math.ceil(item.availableQuantity * 0.7),
          })),
        },
        {
          id: 'warehouse-west',
          name: 'West Warehouse',
          code: 'WEST',
          stock: inventory.map((item) => ({
            productId: item.id,
            availableQuantity:
              item.availableQuantity - Math.ceil(item.availableQuantity * 0.7),
          })),
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
        {
          date: isoDate,
          currency: 'VES' as const,
          rateToUsd: 38.5 + offset * 0.12,
        },
        {
          date: isoDate,
          currency: 'EUR' as const,
          rateToUsd: 0.92 + offset * 0.002,
        },
      ];
    });
  }

  private persist(state: SalesCycleState): void {
    this.storage()?.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  private refreshFromStorage(): void {
    this.state.set(this.readState());
  }

  private createChannel(): BroadcastChannel | undefined {
    if (typeof BroadcastChannel === 'undefined') return undefined;
    return new BroadcastChannel(STORAGE_KEY);
  }

  private locks(): LockManager | undefined {
    return typeof navigator === 'undefined' ? undefined : navigator.locks;
  }

  private storage(): Storage | undefined {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  }

  private inventoryForState(state: SalesCycleState): InventoryItem[] {
    return state.inventory.map((item) => ({
      ...item,
      availableQuantity: state.warehouses.reduce(
        (total, warehouse) =>
          total +
          (warehouse.stock.find((stock) => stock.productId === item.id)
            ?.availableQuantity ?? 0),
        0,
      ),
    }));
  }

  private defaultWarehouse(inventory: InventoryItem[]): Warehouse {
    return {
      id: DEFAULT_WAREHOUSE_ID,
      name: 'Main Warehouse',
      code: 'MAIN',
      stock: inventory.map((item) => ({
        productId: item.id,
        availableQuantity: item.availableQuantity,
      })),
    };
  }

  private withSecondaryWarehouse(
    warehouses: Warehouse[],
    inventory: InventoryItem[],
  ): Warehouse[] {
    if (warehouses.some((warehouse) => warehouse.id === 'warehouse-west'))
      return warehouses;
    return [
      ...warehouses,
      {
        id: 'warehouse-west',
        name: 'West Warehouse',
        code: 'WEST',
        stock: inventory.map((item) => ({
          productId: item.id,
          availableQuantity: 0,
        })),
      },
    ];
  }

  private warehouseNameForState(
    state: SalesCycleState,
    warehouseId: string,
  ): string {
    return (
      state.warehouses.find((warehouse) => warehouse.id === warehouseId)
        ?.name ?? 'Warehouse unavailable'
    );
  }
}
