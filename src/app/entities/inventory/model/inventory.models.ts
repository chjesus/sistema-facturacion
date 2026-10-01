import { ProductId } from '../../sales/model/sales.models';

export interface InventoryItem {
  id: ProductId;
  sku: string;
  name: string;
  availableQuantity: number;
  unit: string;
}
