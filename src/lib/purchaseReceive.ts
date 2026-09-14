import type { Product, PurchaseOrder, PurchaseOrderItem, StockMovement } from '@/types/v1';
import { getDefaultMainCategory, getDefaultUnit } from '@/lib/businessProfiles';
import type { BusinessType } from '@/types/v1';

export interface ApplyPoToProductsResult {
  products: Product[];
  movements: StockMovement[];
  newProductsCount: number;
  updatedProductsCount: number;
}

function matchPoItemToProduct(products: Product[], item: PurchaseOrderItem): number {
  return products.findIndex(
    p =>
      (item.productId && p.id === item.productId) ||
      (item.sku && p.sku.toLowerCase() === item.sku.toLowerCase()) ||
      p.name.toLowerCase() === item.productName.toLowerCase(),
  );
}

function weightedCost(prevStock: number, prevCost: number, qty: number, unitCost: number): number {
  const newStock = prevStock + qty;
  if (newStock <= 0) return unitCost > 0 ? unitCost : prevCost;
  return Math.round((prevStock * prevCost + qty * unitCost) / newStock);
}

/** Apply received PO lines to inventory — respects explicit sellingPrice from the PO. */
export function applyPurchaseOrderToProducts(
  products: Product[],
  po: PurchaseOrder,
  options: {
    businessType: BusinessType;
    language: 'en' | 'sw';
    operatorName?: string;
    nowIso?: string;
    defaultMarkup?: number;
  },
): ApplyPoToProductsResult {
  const nowStr = options.nowIso ?? new Date().toISOString().replace('T', ' ').substring(0, 16);
  const markup = options.defaultMarkup ?? 1.35;
  const updatedProducts = [...products];
  const movements: StockMovement[] = [];
  let newProductsCount = 0;
  let updatedProductsCount = 0;
  const poRef = po.poNumber || po.orderNumber || po.id;
  const lang = options.language;

  for (const item of po.items) {
    const itemQty = Number(item.quantity);
    const itemCost = Number(item.costPrice ?? item.unitCost ?? 0);
    const itemTotal = Number(item.total ?? item.totalCost ?? itemQty * itemCost);
    const targetSell =
      item.sellingPrice != null && item.sellingPrice > 0 ? item.sellingPrice : undefined;

    const existingIndex = matchPoItemToProduct(updatedProducts, item);

    if (existingIndex >= 0) {
      const prod = updatedProducts[existingIndex];
      const prevStock = prod.stock;
      const newStock = prevStock + itemQty;
      const updatedCost = weightedCost(prevStock, prod.cost, itemQty, itemCost);

      updatedProducts[existingIndex] = {
        ...prod,
        stock: newStock,
        cost: updatedCost > 0 ? updatedCost : prod.cost,
        price: targetSell ?? prod.price,
        batchNumber: item.batchNumber || prod.batchNumber,
        expiryDate: item.expiryDate || prod.expiryDate,
      };
      updatedProductsCount++;

      movements.push({
        id: `sm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        date: nowStr,
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku,
        type: 'in_purchase',
        quantity: itemQty,
        previousStock: prevStock,
        newStock,
        unitCost: itemCost,
        totalValuation: itemTotal,
        batchNumber: item.batchNumber || prod.batchNumber,
        expiryDate: item.expiryDate || prod.expiryDate,
        referenceId: poRef,
        referenceType: 'PURCHASE_ORDER',
        operatorName: options.operatorName || 'Manager',
        notes: `Received PO ${poRef} from ${po.supplierName}`,
      });
    } else {
      const newProdId = item.productId || `prod-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const defaultPrice = Math.round(itemCost * markup);

      movements.push({
        id: `sm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        date: nowStr,
        productId: newProdId,
        productName: item.productName,
        sku: item.sku || `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
        type: 'in_purchase',
        quantity: itemQty,
        previousStock: 0,
        newStock: itemQty,
        unitCost: itemCost,
        totalValuation: itemTotal,
        batchNumber: item.batchNumber,
        expiryDate: item.expiryDate,
        referenceId: poRef,
        referenceType: 'PURCHASE_ORDER',
        operatorName: options.operatorName || 'Manager',
        notes: `New item from PO ${poRef}`,
      });

      const meta = (item.metadata ?? {}) as Record<string, unknown>;
      const imageUrl =
        (typeof meta.image_url === 'string' && meta.image_url) ||
        (typeof meta.imageUrl === 'string' && meta.imageUrl) ||
        undefined;
      const vatType =
        (typeof meta.vat_type === 'string' && meta.vat_type) ||
        (typeof meta.vatType === 'string' && meta.vatType) ||
        'standard';

      updatedProducts.unshift({
        id: newProdId,
        name: item.productName,
        category: item.category || getDefaultMainCategory(options.businessType, lang),
        sku: item.sku || `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
        price: targetSell ?? defaultPrice,
        cost: itemCost,
        stock: itemQty,
        reorderPoint: Math.max(10, Math.round(itemQty * 0.2)),
        unit: item.unit || getDefaultUnit(options.businessType),
        supplier: po.supplierName,
        batchNumber: item.batchNumber,
        expiryDate: item.expiryDate,
        vatType,
        imageUrl,
        businessType: options.businessType,
        description: `From received PO ${poRef}`,
        location: 'Warehouse Receiving Bay A',
        isDrug: options.businessType === 'pharmacy',
      });
      newProductsCount++;
    }
  }

  return { products: updatedProducts, movements, newProductsCount, updatedProductsCount };
}

/** After API sync, re-apply PO selling prices so backend markup overrides are corrected. */
export function mergePoSellingPricesIntoProducts(
  products: Product[],
  po: PurchaseOrder,
): Product[] {
  if (!po.items.some(i => i.sellingPrice != null && i.sellingPrice > 0)) {
    return products;
  }
  return products.map(prod => {
    const item = po.items.find(
      i =>
        (i.productId && i.productId === prod.id) ||
        (i.sku && i.sku.toLowerCase() === prod.sku.toLowerCase()) ||
        i.productName.toLowerCase() === prod.name.toLowerCase(),
    );
    if (item?.sellingPrice != null && item.sellingPrice > 0) {
      return { ...prod, price: item.sellingPrice };
    }
    return prod;
  });
}

export function poReceiveItemPayload(po: PurchaseOrder) {
  return po.items.map(item => ({
    product_id: item.productId ?? null,
    product_name: item.productName,
    sku: item.sku,
    unit_cost: item.costPrice,
    selling_price: item.sellingPrice && item.sellingPrice > 0 ? item.sellingPrice : undefined,
    quantity: item.quantity,
  }));
}
