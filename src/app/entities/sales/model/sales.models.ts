export type CurrencyCode = 'USD' | 'VES' | 'EUR';

declare const salesOrderIdBrand: unique symbol;
declare const deliveryIdBrand: unique symbol;
declare const invoiceIdBrand: unique symbol;
declare const productIdBrand: unique symbol;

export type SalesOrderId = string & { readonly [salesOrderIdBrand]: 'SalesOrderId' };
export type DeliveryId = string & { readonly [deliveryIdBrand]: 'DeliveryId' };
export type InvoiceId = string & { readonly [invoiceIdBrand]: 'InvoiceId' };
export type ProductId = string & { readonly [productIdBrand]: 'ProductId' };

export type SalesOrderStatus = 'draft' | 'confirmed' | 'completed' | 'cancelled';
export type DeliveryStatus = 'pending' | 'validated' | 'cancelled';
export type InvoiceStatus = 'draft' | 'published' | 'partial' | 'paid' | 'voided';
export type PaymentStatus = 'draft' | 'confirmed' | 'voided';

export interface DocumentLine {
  productId: ProductId;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface SalesOrder {
  id: SalesOrderId;
  reference: string;
  customerName: string;
  status: SalesOrderStatus;
  currency: CurrencyCode;
  lines: DocumentLine[];
  orderDate: string;
  createdAt: string;
}

export interface MonetaryTotals {
  subtotal: number;
  vat: number;
  total: number;
}

export interface OrderLineQuantities {
  ordered: number;
  delivered: number;
  invoiced: number;
}

export interface Delivery {
  id: DeliveryId;
  reference: string;
  orderId: SalesOrderId;
  orderReference: string;
  customerName: string;
  warehouseId: string;
  warehouseName: string;
  parentDeliveryId?: DeliveryId;
  status: DeliveryStatus;
  lines: DocumentLine[];
  createdAt: string;
}

export interface Invoice {
  id: InvoiceId;
  reference: string;
  orderId: SalesOrderId;
  orderReference: string;
  deliveryIds: DeliveryId[];
  deliveryReferences: string[];
  status: InvoiceStatus;
  currency: CurrencyCode;
  lines: InvoiceLine[];
  number?: string;
  issueDate?: string;
  issuedCurrency?: CurrencyCode;
  vesFxRate?: number;
  vesFxDate?: string;
  vesEquivalentTotal?: number;
  createdAt: string;
}

export interface InvoiceLine extends DocumentLine {
  deliveryId: DeliveryId;
  deliveryReference: string;
  deliveryLineIndex: number;
  vatRate: number;
  subtotal: number;
  vat: number;
  total: number;
}

export interface Payment {
  id: string;
  reference: string;
  invoiceId: InvoiceId;
  invoiceReference: string;
  status: PaymentStatus;
  currency: CurrencyCode;
  amount: number;
  convertedAmount?: number;
  frozenRate?: number;
  frozenRateDate?: string;
  confirmedAt?: string;
}
