import { Injectable, computed, signal } from '@angular/core';
import { ExchangeRate } from '../../exchange-rate/model/exchange-rate.models';
import { InventoryItem } from '../../inventory/model/inventory.models';
import {
  CurrencyCode,
  Delivery,
  DeliveryId,
  DocumentLine,
  Invoice,
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
