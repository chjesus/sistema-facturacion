import { ProductId } from '../../sales/model/sales.models';

export interface InventoryItem {
  id: ProductId;
  sku: string;
  name: string;
  availableQuantity: number;
  unit: string;
  suggestedUnitPrice?: number;
}

export interface WarehouseStockItem {
  productId: ProductId;
  availableQuantity: number;
}

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  stock: WarehouseStockItem[];
}
