export type CurrencyCode = 'USD' | 'VES' | 'EUR';

export type SalesOrderStatus = 'draft' | 'confirmed' | 'completed' | 'cancelled';
export type DeliveryStatus = 'pending' | 'validated' | 'cancelled';
export type InvoiceStatus = 'draft' | 'published' | 'partial' | 'paid' | 'voided';
export type PaymentStatus = 'confirmed' | 'voided';

export interface DocumentLine {
  productId: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface SalesOrder {
  id: string;
  reference: string;
  customerName: string;
  status: SalesOrderStatus;
  currency: CurrencyCode;
  lines: DocumentLine[];
  createdAt: string;
}

export interface Delivery {
  id: string;
  reference: string;
  orderId: string;
  orderReference: string;
  status: DeliveryStatus;
  lines: DocumentLine[];
  createdAt: string;
}

export interface Invoice {
  id: string;
  reference: string;
  orderId: string;
  orderReference: string;
  status: InvoiceStatus;
  currency: CurrencyCode;
  lines: DocumentLine[];
  createdAt: string;
}

export interface Payment {
  id: string;
  reference: string;
  invoiceId: string;
  invoiceReference: string;
  status: PaymentStatus;
  currency: CurrencyCode;
  amount: number;
  frozenRate: number;
  confirmedAt?: string;
}
