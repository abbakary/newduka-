import React, { useState, useEffect, useRef } from 'react';
import { 
  Boxes, 
  Search, 
  Plus, 
  AlertTriangle, 
  CheckCircle2, 
  Sparkles, 
  Download, 
  Filter, 
  Clock, 
  Tag, 
  X,
  PackageCheck,
  ArrowDownLeft,
  ArrowUpRight,
  History,
  FileText,
  DollarSign,
  AlertOctagon,
  Layers,
  RotateCcw,
  Calendar,
  QrCode,
  Printer
} from 'lucide-react';
import { 
  Language, 
  Product, 
  StockMovement, 
  PurchaseOrder, 
  Supplier, 
  CalendarEvent,
  BusinessType,
} from '@/types/v1';
import { formatTSh, getTranslation } from '@/utils/translations';
import { exportInventoryReport } from '@/utils/reportGenerator';
import { productMatchesSearch } from '@/lib/productMetaDisplay';
import { getWorkplace, getProductNamePlaceholder, getDefaultMainCategory, getDefaultUnit } from '@/lib/businessProfiles';
import { getBusinessProfile } from '@/lib/businessEngine';
import { CategoryTaxonomyPicker, type CategorySelection } from '@/components/v1/CategoryTaxonomyPicker';
import { DynamicProductForm, type DynamicProductFormValues } from '@/components/v1/DynamicProductForm';
import { UnitPicker } from '@/components/v1/UnitPicker';
import { ProductMetaBadges } from '@/components/v1/ProductMetaBadges';
import { ProductImageThumb, ProductImageUploader } from '@/components/v1/ProductImage';
import { ActionBar } from '@/components/v1/ActionBar';
import { useTaxCompliance } from '@/context/TaxComplianceContext';
import { isVatActive } from '@/lib/taxComplianceSettings';
import { computePurchaseLineAmounts, type PurchaseVatScope } from '@/lib/purchaseTax';
import { QRCodeModal } from '@/components/v1/QRCodeModal';
import { rememberProductImage } from '@/lib/productImageCache';
import { compressProductImage, readFileAsDataUrl } from '@/lib/imageCompress';
import confetti from 'canvas-confetti';
import { api } from '@/lib/api';
import { fetchProductsFromApi, mapProduct, mapStockMovement, mapSupplier, optionalApiDate, productToApiPayload, supplierToApiPayload } from '@/lib/apiSync';
import { runWithOfflineQueue } from '@/lib/offlineMutations';
import { useOfflineStore } from '@/stores';
import type { SyncQueueItem } from '@/lib/transactionEngine';
import { resolveUserPermissions } from '@/lib/rbac';

interface InventoryViewProps {
  language: Language;
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  stockMovements: StockMovement[];
  setStockMovements: React.Dispatch<React.SetStateAction<StockMovement[]>>;
  purchaseOrders?: PurchaseOrder[];
  setPurchaseOrders?: React.Dispatch<React.SetStateAction<PurchaseOrder[]>>;
  suppliers?: Supplier[];
  setSuppliers?: React.Dispatch<React.SetStateAction<Supplier[]>>;
  events?: CalendarEvent[];
  setEvents?: React.Dispatch<React.SetStateAction<CalendarEvent[]>>;
  onOpenAIChatWithPrompt?: (prompt: string) => void;
  onReceivePO?: (poId: string) => void;
  businessType?: BusinessType;
  onProductsChanged?: () => void | Promise<void>;
  currentUser?: import('@/types/v1').AuthUser | null;
  tenantId?: string;
  enqueueSyncItem?: (item: SyncQueueItem) => void;
  onQueueMutation?: (entityType: string) => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  language,
  products,
  setProducts,
  stockMovements,
  setStockMovements,
  purchaseOrders = [],
  setPurchaseOrders,
  suppliers = [],
  setSuppliers,
  events = [],
  setEvents,
  onOpenAIChatWithPrompt,
  onReceivePO,
  businessType = 'retail',
  onProductsChanged,
  currentUser,
  tenantId,
  enqueueSyncItem,
  onQueueMutation,
}) => {
  const t = (key: any) => getTranslation(language, key);
  const isSw = language === 'sw';
  const invPerms = resolveUserPermissions(currentUser);
  const inventoryReadOnly = !invPerms.canModifyInventory;
  const isOnline = useOfflineStore(s => s.isOnline);
  const storageId = tenantId || currentUser?.businessId || currentUser?.id || 'local';
  const enqueue = enqueueSyncItem ?? (() => {});
  const workplace = getWorkplace(businessType);
  const defaultCategory = workplace.default_categories?.[0] ?? getDefaultMainCategory(businessType, isSw ? 'sw' : 'en');
  const defaultUnit = workplace.default_units?.[0] ?? getDefaultUnit(businessType);
  const productNamePlaceholder = getProductNamePlaceholder(businessType, isSw ? 'sw' : 'en');
  const showBatch = workplace.features?.batch_tracking ?? false;
  const showExpiry = workplace.features?.expiry_alerts ?? false;
  const showBarcode = workplace.features?.barcode_scan ?? false;
  const { settings: taxSettings } = useTaxCompliance();
  const purchaseVatAvailable = isVatActive(taxSettings) || taxSettings.mode === 'tra_efd';
  const defaultPurchaseVatScope = (taxSettings.purchaseVatScope ?? 'none') as PurchaseVatScope;

  React.useEffect(() => {
    setManualStockInForm(prev => ({
      ...prev,
      applyVat: purchaseVatAvailable && defaultPurchaseVatScope !== 'none',
      vatNote: prev.vatNote || taxSettings.purchaseVatNote || '',
    }));
  }, [purchaseVatAvailable, defaultPurchaseVatScope, taxSettings.purchaseVatNote]);

  const handleExportInventory = () => {
    const totalValue = products.reduce((s, p) => s + (p.stock * (p.cost || 0)), 0);
    const lowStock = products.filter(p => p.stock <= (p.reorderPoint || 5)).length;
    exportInventoryReport({
      provider: {
        businessName: currentUser?.businessName || 'Duka+ Business',
        ownerName:    currentUser?.name          || 'Owner',
        email:        currentUser?.email         || '',
        phone:        (currentUser as any)?.phone,
        tinNumber:    (currentUser as any)?.tinNumber,
        branch:       (currentUser as any)?.branch,
        businessType: currentUser?.businessType,
      },
      products: products.map(p => ({
        name:     p.name,
        sku:      p.sku,
        category: p.category,
        stock:    `${p.stock} ${p.unit}`,
        cost:     formatTSh(p.cost || 0),
        value:    formatTSh(p.stock * (p.cost || 0)),
      })),
      totalValue:    formatTSh(totalValue),
      lowStockCount: lowStock,
      language:      language as 'en' | 'sw',
    });
  };

  // Sub tabs: 'catalog' | 'stockin' | 'stockout' | 'movements'
  const [activeTab, setActiveTab] = useState<'catalog' | 'stockin' | 'stockout' | 'movements'>('catalog');

  React.useEffect(() => {
    if (inventoryReadOnly && activeTab === 'stockin') setActiveTab('catalog');
  }, [inventoryReadOnly, activeTab]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'low' | 'critical' | 'expiring'>('all');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  // Modals & Drawers
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [isQuickStockInOpen, setIsQuickStockInOpen] = useState(false);
  const [isStockOutOpen, setIsStockOutOpen] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // QR Code Modal State
  const [qrModalProduct, setQrModalProduct] = useState<Product | null>(null);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);

  // Add Product Form State
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [categorySel, setCategorySel] = useState<CategorySelection>({
    main: defaultCategory,
    displayPath: defaultCategory,
  });
  const [dynamicFields, setDynamicFields] = useState<DynamicProductFormValues>({ metadata: {} });

  useEffect(() => {
    const cat = getDefaultMainCategory(businessType, isSw ? 'sw' : 'en');
    const unit = getDefaultUnit(businessType);
    setCategorySel({ main: cat, displayPath: cat });
    setNewProduct(prev => ({
      ...prev,
      category: cat,
      unit,
      batchNumber: showBatch ? `BT-${new Date().getFullYear()}-01` : '',
      expiryDate: showExpiry ? '2028-06-30' : '',
    }));
    setDynamicFields({ metadata: {} });
  }, [businessType, isSw, showBatch, showExpiry]);

  const openAddProductModal = () => {
    const cat = getDefaultMainCategory(businessType, isSw ? 'sw' : 'en');
    setCategorySel({ main: cat, displayPath: cat });
    setDynamicFields({ metadata: {} });
    setNewProduct({
      name: '',
      category: cat,
      sku: `SKU-${Date.now().toString().slice(-4)}`,
      price: 5000,
      cost: 3000,
      stock: 50,
      reorderPoint: 15,
      unit: getDefaultUnit(businessType),
      batchNumber: showBatch ? `BT-${new Date().getFullYear()}-01` : '',
      expiryDate: showExpiry ? '2028-06-30' : '',
      supplierName: suppliers[0]?.name || '',
      supplierId: suppliers[0]?.id || '',
      imageUrl: '',
      vatType: 'standard',
    });
    setIsAddingProduct(true);
  };

  const [newProduct, setNewProduct] = useState({
    name: '',
    category: defaultCategory,
    sku: `SKU-${Date.now().toString().slice(-4)}`,
    price: 5000,
    cost: 3000,
    stock: 50,
    reorderPoint: 15,
    unit: defaultUnit,
    batchNumber: showBatch ? `BT-${new Date().getFullYear()}-01` : '',
    expiryDate: showExpiry ? '2028-06-30' : '',
    supplierName: suppliers[0]?.name || '',
    supplierId: suppliers[0]?.id || '',
    imageUrl: '' as string,
    vatType: 'standard' as 'standard' | 'exempt' | 'zero',
  });

  // Manual Stock In State
  const [manualStockInForm, setManualStockInForm] = useState({
    productId: products[0]?.id || '',
    quantity: 20,
    unitCost: products[0]?.cost || 3000,
    batchNumber: `BT-${new Date().getFullYear()}-R1`,
    expiryDate: '2028-12-31',
    supplierId: suppliers[0]?.id || '',
    supplierName: suppliers[0]?.name || '',
    notes: 'Direct shop stock replenishment',
    applyVat: false,
    vatNote: '',
  });

  // Stock Out / Damage Adjustment State
  const [stockOutForm, setStockOutForm] = useState({
    productId: products[0]?.id || '',
    quantity: 2,
    reason: 'out_damage' as 'out_damage' | 'out_expiry' | 'out_adjustment' | 'out_return',
    notes: 'Packaging damaged during shelf restocking',
    operatorName: 'Store Clerk',
    supplierId: suppliers[0]?.id || '',
    supplierName: suppliers[0]?.name || '',
  });

  const [isQuickAddSupplierOpen, setIsQuickAddSupplierOpen] = useState(false);
  const [quickSupplierTarget, setQuickSupplierTarget] = useState<'stockIn' | 'stockOut'>('stockIn');
  const [quickSupplierForm, setQuickSupplierForm] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    category: 'General',
    paymentTerms: 'Net 30 Days',
    leadTimeDays: 7,
  });

  const triggerToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 5000);
  };

  const openQuickAddSupplier = (target: 'stockIn' | 'stockOut') => {
    setQuickSupplierTarget(target);
    setQuickSupplierForm({
      name: '',
      contactPerson: '',
      phone: '',
      email: '',
      category: 'General',
      paymentTerms: 'Net 30 Days',
      leadTimeDays: 7,
    });
    setIsQuickAddSupplierOpen(true);
  };

  const applySupplierSelection = (id: string, name: string, target: 'stockIn' | 'stockOut') => {
    if (target === 'stockIn') {
      setManualStockInForm(prev => ({ ...prev, supplierId: id, supplierName: name }));
    } else {
      setStockOutForm(prev => ({ ...prev, supplierId: id, supplierName: name }));
    }
  };

  const handleQuickAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickSupplierForm.name.trim()) return;
    try {
      const raw = await api.createSupplier(supplierToApiPayload({
        name: quickSupplierForm.name.trim(),
        contactPerson: quickSupplierForm.contactPerson || 'Sales Representative',
        phone: quickSupplierForm.phone,
        email: quickSupplierForm.email,
        category: quickSupplierForm.category,
        paymentTerms: quickSupplierForm.paymentTerms,
        leadTimeDays: Number(quickSupplierForm.leadTimeDays) || 7,
        rating: 4.8,
      }));
      const created = mapSupplier(raw as Record<string, unknown>);
      setSuppliers?.(prev => [created, ...prev]);
      applySupplierSelection(created.id, created.name, quickSupplierTarget);
      setIsQuickAddSupplierOpen(false);
      triggerToast(isSw ? 'Msambazaji ameongezwa' : 'Supplier added');
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const renderSupplierField = (
    supplierId: string,
    supplierName: string,
    target: 'stockIn' | 'stockOut',
    required = true,
  ) => (
    <div>
      <label className="block font-semibold text-[#323130] mb-1">
        {isSw ? 'Msambazaji *' : 'Supplier *'}
      </label>
      {suppliers.length > 0 ? (
        <div className="flex gap-2">
          <select
            required={required}
            value={supplierId || suppliers[0]?.id || ''}
            onChange={e => {
              const sel = suppliers.find(s => s.id === e.target.value);
              applySupplierSelection(sel?.id || '', sel?.name || '', target);
            }}
            className="flex-1 px-3 py-2 bg-[#F3F2F1] rounded-lg border border-[#EDEBE9] focus:bg-white outline-none"
          >
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>{s.name}{s.category ? ` • ${s.category}` : ''}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => openQuickAddSupplier(target)}
            className="px-3 py-2 rounded-lg border border-[#EDEBE9] bg-white text-[11px] font-bold text-[#6264A7] hover:bg-[#FAF9F8] whitespace-nowrap"
          >
            + {isSw ? 'Mpya' : 'New'}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <input
            type="text"
            required={required}
            placeholder={isSw ? 'Jina la msambazaji' : 'Supplier name'}
            value={supplierName}
            onChange={e => applySupplierSelection('', e.target.value, target)}
            className="w-full px-3 py-2 bg-[#F3F2F1] rounded-lg border border-[#EDEBE9] focus:bg-white outline-none"
          />
          <button
            type="button"
            onClick={() => openQuickAddSupplier(target)}
            className="text-[11px] font-bold text-[#6264A7] hover:underline"
          >
            + {isSw ? 'Sajili msambazaji mpya' : 'Register new supplier'}
          </button>
        </div>
      )}
      {(supplierId || supplierName) && (
        <p className="text-[10px] text-[#605E5C] mt-1">
          {isSw ? 'Chagua msambazaji halisi ili gharama na faida zihesabiwe sahihi.' : 'Select the actual supplier so costs and profit track correctly.'}
        </p>
      )}
    </div>
  );

  // 1-Click Receive PO shortcut right inside Inventory
  const handleQuickReceivePO = (po: PurchaseOrder) => {
    if (onReceivePO) {
      onReceivePO(po.id);
      return;
    }

    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
    let itemsUpdated = 0;
    const updated = [...products];
    const newSm: StockMovement[] = [];

    po.items.forEach(item => {
      const idx = updated.findIndex(p => (item.productId && p.id === item.productId) || p.name.toLowerCase() === item.productName.toLowerCase());
      if (idx >= 0) {
        const prev = updated[idx].stock;
        updated[idx] = {
          ...updated[idx],
          stock: prev + item.quantity,
          cost: item.costPrice > 0 ? item.costPrice : updated[idx].cost,
          price:
            item.sellingPrice != null && item.sellingPrice > 0
              ? item.sellingPrice
              : updated[idx].price,
          batchNumber: item.batchNumber || updated[idx].batchNumber,
          expiryDate: item.expiryDate || updated[idx].expiryDate,
        };
        itemsUpdated++;

        newSm.push({
          id: `sm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          date: nowStr,
          productId: updated[idx].id,
          productName: updated[idx].name,
          sku: updated[idx].sku,
          type: 'in_purchase',
          quantity: item.quantity,
          previousStock: prev,
          newStock: prev + item.quantity,
          unitCost: item.costPrice,
          totalValuation: item.quantity * item.costPrice,
          referenceId: po.poNumber,
          referenceType: 'PO',
          operatorName: 'Store Manager',
          notes: `Quick Stock In from ${po.supplierName}`,
        });
      } else {
        const newId = `prod-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const newProd: Product = {
          id: newId,
          name: item.productName,
          category: item.category || 'General',
          sku: item.sku || `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
          price: item.sellingPrice || Math.round(item.costPrice * 1.4),
          cost: item.costPrice,
          stock: item.quantity,
          reorderPoint: 10,
          unit: item.unit || 'boxes',
          batchNumber: item.batchNumber || `BT-${new Date().getFullYear()}`,
          expiryDate: item.expiryDate || '2028-12-31',
          businessType: businessType,
        };
        updated.unshift(newProd);
        itemsUpdated++;

        newSm.push({
          id: `sm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          date: nowStr,
          productId: newId,
          productName: newProd.name,
          sku: newProd.sku,
          type: 'in_purchase',
          quantity: item.quantity,
          previousStock: 0,
          newStock: item.quantity,
          unitCost: item.costPrice,
          totalValuation: item.quantity * item.costPrice,
          referenceId: po.poNumber,
          referenceType: 'PO',
          operatorName: 'Store Manager',
          notes: `New Item Registered from ${po.supplierName}`,
        });
      }
    });

    setProducts(updated);
    setStockMovements(prev => [...newSm, ...prev]);

    if (setPurchaseOrders) {
      setPurchaseOrders(prev => prev.map(p => p.id === po.id ? { ...p, status: 'received', receivedDate: nowStr } : p));
    }

    confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
    triggerToast(`Order ${po.poNumber} received & ${itemsUpdated} items stocked into inventory!`);
  };

  // Action: Add New Product
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct.name) return;
    if (!newProduct.supplierName?.trim()) {
      triggerToast(isSw ? 'Msambazaji anahitajika' : 'Supplier is required');
      return;
    }
    if (Number(newProduct.cost) <= 0) {
      triggerToast(isSw ? 'Bei ya kununua lazima iwe zaidi ya sifuri' : 'Cost price must be greater than zero');
      return;
    }

    const supplierMeta: Record<string, string> = {
      supplier_name: newProduct.supplierName.trim(),
    };
    if (newProduct.supplierId) supplierMeta.supplier_id = newProduct.supplierId;

    const payload = {
      ...productToApiPayload({
        name: newProduct.name,
        category: categorySel.displayPath || newProduct.category,
        sku: newProduct.sku,
        price: Number(newProduct.price),
        cost: Number(newProduct.cost),
        stock: Number(newProduct.stock),
        reorderPoint: Number(newProduct.reorderPoint),
        unit: newProduct.unit,
        batchNumber: dynamicFields.batch_number ?? newProduct.batchNumber,
        expiryDate: dynamicFields.expiry_date ?? newProduct.expiryDate,
        requiresPrescription: Boolean(dynamicFields.requires_prescription),
        businessType,
        imageUrl: newProduct.imageUrl || undefined,
        vatType: newProduct.vatType,
        metadata_json: {
          ...(dynamicFields.metadata || {}),
          ...supplierMeta,
        },
      }),
      business_type: businessType,
    };
    const tempId = `local-prod-${Date.now()}`;

    try {
      const outcome = await runWithOfflineQueue({
        isOnline,
        tenantId: storageId,
        entity_type: 'product',
        entity_id: tempId,
        action: 'create',
        payload,
        enqueue,
        executeOnline: async () => {
          const createdRaw = await api.createProduct(payload);
          const created = mapProduct(createdRaw as Record<string, unknown>);
          const withImage: Product = {
            ...created,
            imageUrl: created.imageUrl || newProduct.imageUrl || undefined,
            vatType: created.vatType || newProduct.vatType,
          };
          if (withImage.imageUrl) {
            await rememberProductImage(storageId, withImage.id, withImage.imageUrl);
          }
          // Show photo immediately — never wait on a full catalog refresh
          setProducts(prev => [withImage, ...prev.filter(p => p.id !== withImage.id && p.id !== tempId)]);
          // Background refresh; always keep local photos
          void fetchProductsFromApi(undefined, storageId)
            .then(refreshed => {
              setProducts(prev => {
                const priorById = new Map(prev.map(p => [p.id, p]));
                priorById.set(withImage.id, withImage);
                const byId = new Map(
                  refreshed.map(p => {
                    const prior = priorById.get(p.id);
                    return [
                      p.id,
                      {
                        ...p,
                        imageUrl:
                          p.imageUrl ||
                          prior?.imageUrl ||
                          (p.id === withImage.id ? withImage.imageUrl : undefined),
                      },
                    ] as const;
                  }),
                );
                if (!byId.has(withImage.id)) byId.set(withImage.id, withImage);
                return Array.from(byId.values());
              });
            })
            .catch(() => {
              /* already have withImage in state */
            });
        },
        onQueued: () => onQueueMutation?.('product'),
      });

      if (outcome === 'queued') {
        const localProd: Product = {
          id: tempId,
          name: newProduct.name,
          category: categorySel.displayPath || newProduct.category,
          sku: newProduct.sku || `SKU-${Date.now()}`,
          price: Number(newProduct.price),
          cost: Number(newProduct.cost),
          stock: Number(newProduct.stock),
          reorderPoint: Number(newProduct.reorderPoint),
          unit: newProduct.unit || getDefaultUnit(businessType),
          batchNumber: dynamicFields.batch_number ?? newProduct.batchNumber,
          expiryDate: dynamicFields.expiry_date ?? newProduct.expiryDate,
          imageUrl: newProduct.imageUrl || undefined,
          vatType: newProduct.vatType,
          businessType,
        };
        if (localProd.imageUrl) {
          void rememberProductImage(storageId, localProd.id, localProd.imageUrl);
        }
        setProducts(prev => [localProd, ...prev]);
      }

      setIsAddingProduct(false);
      confetti({ particleCount: 40, spread: 50, origin: { y: 0.8 } });
      triggerToast(
        outcome === 'queued'
          ? (isSw ? 'Bidhaa imehifadhiwa — itasawazishwa ukirudi mtandaoni.' : 'Product saved locally — will sync when online.')
          : `Product ${newProduct.name} registered with ${newProduct.stock} units!`,
      );
    } catch (err) {
      alert((err as Error).message);
    }
  };

  // Action: Manual Stock In
  const handleExecuteManualStockIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const prod = products.find(p => p.id === manualStockInForm.productId);
    if (!prod) return;

    const qty = Number(manualStockInForm.quantity);
    const unitCost = Number(manualStockInForm.unitCost);
    const supplierName = manualStockInForm.supplierName.trim();
    if (!manualStockInForm.supplierId && !supplierName) {
      alert(isSw ? 'Msambazaji anahitajika.' : 'Supplier is required.');
      return;
    }
    if (unitCost <= 0) {
      alert(isSw ? 'Bei ya kununua lazima iwe zaidi ya sifuri.' : 'Unit cost must be greater than zero.');
      return;
    }

    const shouldApplyVat =
      purchaseVatAvailable &&
      manualStockInForm.applyVat &&
      (defaultPurchaseVatScope !== 'vat_products' ||
        !prod.vatType ||
        ['standard', 'vat', 'vat_18', 'taxable'].includes(String(prod.vatType).toLowerCase()));

    // When shop default is "all", checking applyVat always taxes; when "vat_products", only VAT-class products.
    const vatApplies = shouldApplyVat;

    const vatLine = vatApplies
      ? computePurchaseLineAmounts({ quantity: qty, costPrice: unitCost, taxId: 'vat_18', taxRate: 0.18 })
      : { untaxed: Math.round(qty * unitCost), taxAmount: 0, lineTotal: Math.round(qty * unitCost) };

    const vatNotePart = manualStockInForm.vatNote.trim() || taxSettings.purchaseVatNote || '';
    const combinedNotes = [
      `Manual Stock In: ${manualStockInForm.notes} (${supplierName})`,
      vatApplies ? `VAT 18%: ${formatTSh(vatLine.taxAmount)}${vatNotePart ? ` — ${vatNotePart}` : ''}` : '',
    ].filter(Boolean).join(' | ');

    const stockPayload = {
      product_id: prod.id,
      quantity: qty,
      movement_type: 'in_adjustment',
      unit_cost: unitCost,
      batch_number: manualStockInForm.batchNumber,
      expiry_date: optionalApiDate(manualStockInForm.expiryDate),
      supplier_id: manualStockInForm.supplierId || undefined,
      supplier_name: supplierName,
      notes: combinedNotes,
      tax_amount: vatLine.taxAmount,
      apply_vat: vatApplies,
    };

    try {
      const outcome = await runWithOfflineQueue({
        isOnline,
        tenantId: storageId,
        entity_type: 'stock',
        entity_id: `stock-in-${prod.id}-${Date.now()}`,
        action: 'adjust',
        payload: stockPayload,
        enqueue,
        executeOnline: async () => {
          const movRaw = await api.adjustStock(stockPayload);
          const updatedRaw = await api.updateProduct(prod.id, {
            cost: unitCost > 0 ? unitCost : prod.cost,
            batch_number: manualStockInForm.batchNumber || prod.batchNumber,
            expiry_date: optionalApiDate(manualStockInForm.expiryDate || prod.expiryDate),
            metadata_json: {
              ...(prod.imageUrl ? { image_url: prod.imageUrl } : {}),
              ...(prod.vatType ? { vat_type: prod.vatType } : {}),
              supplier_id: manualStockInForm.supplierId || undefined,
              supplier_name: supplierName,
            },
            image_url: prod.imageUrl || undefined,
            vat_type: prod.vatType || undefined,
          });
          setProducts(prev => prev.map(p => p.id === prod.id ? mapProduct(updatedRaw as Record<string, unknown>) : p));
          setStockMovements(prev => [mapStockMovement(movRaw as Record<string, unknown>), ...prev]);
        },
        onQueued: () => onQueueMutation?.('stock'),
      });

      if (outcome === 'queued') {
        const newStock = prod.stock + qty;
        setProducts(prev => prev.map(p => p.id === prod.id ? { ...p, stock: newStock, cost: unitCost > 0 ? unitCost : p.cost } : p));
        setStockMovements(prev => [{
          id: `sm-local-${Date.now()}`,
          date: new Date().toISOString().replace('T', ' ').slice(0, 16),
          productId: prod.id,
          productName: prod.name,
          sku: prod.sku,
          type: 'in_adjustment',
          quantity: qty,
          previousStock: prod.stock,
          newStock,
          unitCost: unitCost > 0 ? unitCost : prod.cost,
          totalValuation: qty * (unitCost > 0 ? unitCost : prod.cost),
          operatorName: currentUser?.name || 'Staff',
          notes: manualStockInForm.notes,
        }, ...prev]);
      }

      setIsQuickStockInOpen(false);
      triggerToast(
        outcome === 'queued'
          ? (isSw ? 'Stoo imehifadhiwa — itasawazishwa mtandaoni.' : 'Stock in saved locally — will sync when online.')
          : `Stocked In +${qty} ${prod.unit} of ${prod.name}!`,
      );
    } catch (err) {
      alert((err as Error).message);
    }
  };

  // Action: Manual Stock Out / Write-off
  const handleExecuteStockOut = async (e: React.FormEvent) => {
    e.preventDefault();
    const prod = products.find(p => p.id === stockOutForm.productId);
    if (!prod) return;

    const qty = Number(stockOutForm.quantity);
    if (stockOutForm.reason === 'out_return' && !stockOutForm.supplierId && !stockOutForm.supplierName.trim()) {
      alert(isSw ? 'Chagua msambazaji unayemrudishia bidhaa.' : 'Select the supplier you are returning stock to.');
      return;
    }

    const stockPayload: Record<string, unknown> = {
      product_id: prod.id,
      quantity: -qty,
      movement_type: stockOutForm.reason === 'out_expiry' ? 'out_expired' : 'out_adjustment',
      notes: stockOutForm.notes,
    };
    if (stockOutForm.reason === 'out_return') {
      stockPayload.reason = 'out_return';
      if (stockOutForm.supplierId) stockPayload.supplier_id = stockOutForm.supplierId;
      if (stockOutForm.supplierName.trim()) {
        stockPayload.supplier_name = stockOutForm.supplierName.trim();
        stockPayload.notes = `Return to ${stockOutForm.supplierName.trim()}: ${stockOutForm.notes}`;
      }
    }

    try {
      const outcome = await runWithOfflineQueue({
        isOnline,
        tenantId: storageId,
        entity_type: 'stock',
        entity_id: `stock-out-${prod.id}-${Date.now()}`,
        action: 'adjust',
        payload: stockPayload,
        enqueue,
        executeOnline: async () => {
          const movRaw = await api.adjustStock(stockPayload);
          const updatedRaw = await api.getProducts();
          setProducts((updatedRaw as Array<Record<string, unknown>>).map(mapProduct));
          await onProductsChanged?.();
          setStockMovements(prev => [mapStockMovement(movRaw as Record<string, unknown>), ...prev]);
        },
        onQueued: () => onQueueMutation?.('stock'),
      });

      if (outcome === 'queued') {
        setProducts(prev => prev.map(p => p.id === prod.id ? { ...p, stock: Math.max(0, p.stock - qty) } : p));
        setStockMovements(prev => [{
          id: `sm-local-${Date.now()}`,
          date: new Date().toISOString().replace('T', ' ').slice(0, 16),
          productId: prod.id,
          productName: prod.name,
          sku: prod.sku,
          type: stockOutForm.reason === 'out_expiry' ? 'out_expired' : 'out_adjustment',
          quantity: -qty,
          previousStock: prod.stock,
          newStock: Math.max(0, prod.stock - qty),
          unitCost: prod.cost,
          totalValuation: qty * prod.cost,
          operatorName: currentUser?.name || 'Staff',
          notes: stockOutForm.notes,
        }, ...prev]);
      }

      setIsStockOutOpen(false);
      triggerToast(
        outcome === 'queued'
          ? (isSw ? 'Stock out imehifadhiwa — itasawazishwa mtandaoni.' : 'Stock out saved locally — will sync when online.')
          : `Stock Out -${qty} ${prod.unit} of ${prod.name}`,
      );
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const [photoPickProductId, setPhotoPickProductId] = useState<string | null>(null);
  const photoFileRef = useRef<HTMLInputElement>(null);

  // ── Edit Product modal ──────────────────────────────────────────────────────
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState<{
    name: string; category: string; price: string; cost: string;
    stock: string; reorderPoint: string; unit: string;
    batchNumber: string; expiryDate: string; supplier: string;
    description: string; imageUrl: string | undefined;
  } | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const openEditProduct = (prod: Product) => {
    setEditingProduct(prod);
    setEditForm({
      name: prod.name,
      category: prod.category,
      price: prod.price.toFixed(0),
      cost: prod.cost.toFixed(0),
      stock: prod.stock.toFixed(0),
      reorderPoint: prod.reorderPoint.toFixed(0),
      unit: prod.unit,
      batchNumber: prod.batchNumber || '',
      expiryDate: prod.expiryDate || '',
      supplier: prod.supplier || '',
      description: prod.description || '',
      imageUrl: prod.imageUrl,
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct || !editForm) return;
    setEditSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: editForm.name.trim(),
        category: editForm.category,
        price: Number(editForm.price),
        cost: Number(editForm.cost),
        stock: Number(editForm.stock),
        reorder_point: Number(editForm.reorderPoint),
        unit: editForm.unit,
        batch_number: editForm.batchNumber || undefined,
        expiry_date: editForm.expiryDate || undefined,
        image_url: editForm.imageUrl || undefined,
        description: editForm.description || undefined,
        supplier: editForm.supplier || undefined,
        metadata_json: {
          ...(editForm.imageUrl ? { image_url: editForm.imageUrl } : {}),
          ...(editForm.supplier ? { supplier_name: editForm.supplier } : {}),
          ...(editForm.description ? { description: editForm.description } : {}),
        },
      };
      const updated = await api.updateProduct(editingProduct.id, payload);
      const merged: Product = {
        ...(mapProduct(updated as Record<string, unknown>)),
        imageUrl: (mapProduct(updated as Record<string, unknown>)).imageUrl || editForm.imageUrl,
      };
      if (merged.imageUrl) {
        await rememberProductImage(storageId, merged.id, merged.imageUrl);
      }
      setProducts(prev => prev.map(p => p.id === merged.id ? merged : p));
      setEditingProduct(null);
      setEditForm(null);
      triggerToast(isSw ? 'Bidhaa imesasishwa.' : 'Product updated.');
    } catch (err) {
      alert((err as Error).message || (isSw ? 'Imeshindikana kusasisha.' : 'Could not update product.'));
    } finally {
      setEditSaving(false);
    }
  };

  const handleUpdateProductPhoto = async (productId: string, file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return;
    const prod = products.find(p => p.id === productId);
    if (!prod) return;
    try {
      let dataUrl: string;
      try {
        ({ dataUrl } = await compressProductImage(file));
      } catch {
        dataUrl = await readFileAsDataUrl(file);
      }
      if (!dataUrl.startsWith('data:image/')) throw new Error('Invalid image');
      await rememberProductImage(storageId, productId, dataUrl);
      setProducts(prev => prev.map(p => (p.id === productId ? { ...p, imageUrl: dataUrl } : p)));
      if (isOnline) {
        try {
          await api.updateProduct(productId, { image_url: dataUrl });
        } catch {
          /* keep local photo even if API rejects large payload */
        }
      }
      triggerToast(isSw ? 'Picha imehifadhiwa.' : 'Photo saved.');
    } catch (err) {
      alert((err as Error).message || (isSw ? 'Imeshindikana kupakia picha.' : 'Could not upload photo.'));
    } finally {
      setPhotoPickProductId(null);
      if (photoFileRef.current) photoFileRef.current.value = '';
    }
  };

  // Filter products
  const filteredProducts = products.filter(p => {
    const matchesSearch = productMatchesSearch(p, businessType, searchQuery)
      || p.sku.toLowerCase().includes(searchQuery.toLowerCase())
      || p.category.toLowerCase().includes(searchQuery.toLowerCase());

    if (filterType === 'low') return matchesSearch && p.stock <= p.reorderPoint;
    if (filterType === 'critical') return matchesSearch && p.stock <= 5;
    if (filterType === 'expiring') return matchesSearch && (p.expiryDate && p.expiryDate.startsWith('2027'));
    return matchesSearch;
  });

  // Financial Valuation Metrics
  const totalCostValuation = products.reduce((sum, p) => sum + (p.stock * p.cost), 0);
  const totalRetailValuation = products.reduce((sum, p) => sum + (p.stock * p.price), 0);
  const potentialGrossProfit = totalRetailValuation - totalCostValuation;
  const potentialMarginPercent = totalRetailValuation > 0 ? Math.round((potentialGrossProfit / totalRetailValuation) * 100) : 0;
  const lowStockCount = products.filter(p => p.stock <= p.reorderPoint).length;
  const criticalStockCount = products.filter(p => p.stock <= 5).length;
  const pendingOrders = purchaseOrders.filter(
    po => po.status === 'sent' || po.status === 'draft' || (po.status as string) === 'pending',
  );

  return (
    <div className="space-y-6 pb-16">
      <input
        ref={photoFileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const id = photoPickProductId;
          const file = e.target.files?.[0];
          if (id) void handleUpdateProductPhoto(id, file);
        }}
      />
      {/* Toast Alert */}
      {successToast && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 shadow-sm flex items-center gap-3 animate-in fade-in duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="text-xs font-bold">{successToast}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-[#323130] tracking-tight">
              {workplace.icon} {isSw ? workplace.inventory_title_sw : workplace.inventory_title_en}
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#107C10]/10 text-[#107C10] border border-[#107C10]/20">
              Live Real-Time Sync
            </span>
          </div>
          <p className="text-xs text-[#605E5C] mt-0.5">
            {isSw
              ? `${workplace.label_sw} · Udhibiti wa stoo · Thamani ya mali`
              : `${workplace.label_en} · Stock control · Asset valuation`}
            {showBatch && (isSw ? ' · Ufuatiliaji wa batch' : ' · Batch tracking')}
            {showExpiry && (isSw ? ' · Tarehe ya kuisha' : ' · Expiry alerts')}
            {workplace.features.fractional_units && (isSw ? ' · Vipimo vya sehemu' : ' · Fractional units')}
            {workplace.features.table_management && (isSw ? ' · Meza/KOT' : ' · Table/KOT')}
            {workplace.features.appointments && (isSw ? ' · Miadi' : ' · Appointments')}
            {inventoryReadOnly && (isSw ? ' · Soma tu (hakuna uhariri)' : ' · View only (no edits)')}
          </p>
        </div>

        {!inventoryReadOnly && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsQuickStockInOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#107C10] hover:bg-[#0E6A0E] text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>{t('stockIn')}</span>
          </button>

          <button
            onClick={() => setIsStockOutOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white hover:bg-rose-50 text-[#D13438] font-bold text-xs border border-rose-200 shadow-xs transition-all cursor-pointer"
          >
            <ArrowUpRight className="w-4 h-4 text-[#D13438]" />
            <span>{t('stockOut')}</span>
          </button>
        </div>
        )}
      </div>

      {/* Financial Valuation KPI Matrix */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-[#E1DFDD] shadow-xs">
          <div className="text-xs font-medium text-[#605E5C]">Total Stock Asset Value (Cost)</div>
          <div className="text-xl font-extrabold text-[#323130] mt-1 font-mono">{formatTSh(totalCostValuation)}</div>
          <div className="text-[11px] text-[#605E5C] mt-1">{products.length} Active SKUs in Catalog</div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-[#E1DFDD] shadow-xs">
          <div className="text-xs font-medium text-[#605E5C]">Total Retail Potential Value</div>
          <div className="text-xl font-extrabold text-[#0078D4] mt-1 font-mono">{formatTSh(totalRetailValuation)}</div>
          <div className="text-[11px] text-[#107C10] font-semibold mt-1">Est. Gross Margin: ~{potentialMarginPercent}%</div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-[#E1DFDD] shadow-xs">
          <div className="text-xs font-medium text-[#605E5C]">Reorder Triggers</div>
          <div className="text-xl font-extrabold text-amber-600 mt-1">{lowStockCount} Low Items</div>
          <div className="text-[11px] text-[#D13438] font-semibold mt-1">{criticalStockCount} Critical (&le; 5 units)</div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-[#E1DFDD] shadow-xs">
          <div className="text-xs font-medium text-[#605E5C]">Pending Deliveries from POs</div>
          <div className="text-xl font-extrabold text-[#6264A7] mt-1">{pendingOrders.length} Inbound POs</div>
          <div className="text-[11px] text-[#605E5C] mt-1">Ready for 1-Click Stock-In</div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[#EDEBE9] pb-2">
        <button
          onClick={() => setActiveTab('catalog')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'catalog'
              ? 'bg-[#6264A7] text-white shadow-xs'
              : 'bg-white text-[#605E5C] hover:bg-[#F3F2F1] border border-[#E1DFDD]'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Product Catalog ({products.length})</span>
        </button>

        {!inventoryReadOnly && (
        <button
          onClick={() => setActiveTab('stockin')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'stockin'
              ? 'bg-[#107C10] text-white shadow-xs'
              : 'bg-white text-[#605E5C] hover:bg-[#F3F2F1] border border-[#E1DFDD]'
          }`}
        >
          <ArrowDownLeft className="w-4 h-4" />
          <span>Inbound Goods & PO Receive ({pendingOrders.length})</span>
        </button>
        )}

        <button
          onClick={() => setActiveTab('movements')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'movements'
              ? 'bg-[#6264A7] text-white shadow-xs'
              : 'bg-white text-[#605E5C] hover:bg-[#F3F2F1] border border-[#E1DFDD]'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Stock Movement Audit Trail ({stockMovements.length})</span>
        </button>
      </div>

      {/* ACTION BAR */}
      <ActionBar
        language={language}
        onAISuggest={() => {
          if (onOpenAIChatWithPrompt) {
            onOpenAIChatWithPrompt('Toa ripoti kamili ya uchambuzi wa bidhaa za stoo, utabiri wa mahitaji (Inventory Forecasting), na orodha ya bidhaa za kuagiza kwa wasambazaji.');
          }
        }}
        onExport={handleExportInventory}
        selectedCount={selectedProductId ? 1 : 0}
        totalCount={products.length}
      />

      {/* ================= TAB 1: PRODUCT CATALOG ================= */}
      {activeTab === 'catalog' && (
        <div className="space-y-4">
          {/* SEARCH & FILTERS */}
          <div className="bg-white rounded-xl p-4 border border-[#E1DFDD] shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="relative flex-1 min-w-[260px] max-w-md">
              <Search className="w-4 h-4 text-[#605E5C] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search product name, category, or SKU..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 text-xs bg-[#F3F2F1] border border-transparent focus:border-[#0078D4] focus:bg-white rounded-lg outline-none"
              />
            </div>

            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <button
                onClick={() => {
                  setQrModalProduct(products[0] || null);
                  setIsQRModalOpen(true);
                }}
                className="px-3 py-1.5 rounded-lg bg-[#6264A7] hover:bg-[#555793] text-white shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                title="Generate & Print QR Code Shelf Labels"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>QR Shelf Labels</span>
              </button>
              <button
                onClick={() => setFilterType('all')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  filterType === 'all' ? 'bg-[#323130] text-white shadow-xs' : 'bg-[#F3F2F1] text-[#605E5C]'
                }`}
              >
                All Stock ({products.length})
              </button>
              <button
                onClick={() => setFilterType('low')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  filterType === 'low' ? 'bg-[#D13438] text-white shadow-xs' : 'bg-[#F3F2F1] text-[#605E5C]'
                }`}
              >
                ⚠️ Low Stock ({lowStockCount})
              </button>
              <button
                onClick={() => setFilterType('critical')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  filterType === 'critical' ? 'bg-rose-900 text-white shadow-xs' : 'bg-[#F3F2F1] text-[#605E5C]'
                }`}
              >
                🚨 Critical ({criticalStockCount})
              </button>
            </div>
          </div>

          {/* PRODUCTS DATA TABLE */}
          <div className="bg-white rounded-xl border border-[#E1DFDD] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8F8F8] border-b border-[#EDEBE9] text-[#605E5C] font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">{isSw ? 'Picha & Bidhaa' : 'Photo & Product'}</th>
                    <th className="py-3 px-3">{showBatch ? 'SKU & Batch' : 'SKU'}</th>
                    <th className="py-3 px-3">Selling Price</th>
                    <th className="py-3 px-3">Cost Price</th>
                    <th className="py-3 px-3">Stock Level</th>
                    <th className="py-3 px-3">Asset Value</th>
                    {showExpiry && <th className="py-3 px-3">Expiry Date</th>}
                    <th className="py-3 px-4 text-right">Quick Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F2F1]">
                  {filteredProducts.map(prod => {
                    const isLow = prod.stock <= prod.reorderPoint;
                    const isCritical = prod.stock <= 5;
                    const isSelected = selectedProductId === prod.id;

                    return (
                      <tr 
                        key={prod.id}
                        onClick={() => setSelectedProductId(prod.id)}
                        className={`hover:bg-[#FAF9F8] transition-colors cursor-pointer ${
                          isSelected ? 'bg-[#F0F2FA]' : ''
                        }`}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <button
                              type="button"
                              title={isSw ? 'Badilisha picha' : 'Change photo'}
                              className="relative group/photo shrink-0 cursor-pointer rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6264A7]"
                              onClick={e => {
                                e.stopPropagation();
                                setPhotoPickProductId(prod.id);
                                photoFileRef.current?.click();
                              }}
                            >
                              <ProductImageThumb src={prod.imageUrl} name={prod.name} size="lg" />
                              <span className="pointer-events-none absolute inset-0 rounded-lg bg-black/40 opacity-0 group-hover/photo:opacity-100 flex items-center justify-center text-[9px] font-bold text-white transition-opacity">
                                {isSw ? 'Picha' : 'Photo'}
                              </span>
                            </button>
                            <div>
                              <div className="font-bold text-[#323130]">{prod.name}</div>
                              <div className="text-[10px] text-[#605E5C]">{prod.category}</div>
                              <ProductMetaBadges
                                product={prod}
                                businessType={businessType}
                                language={language}
                                max={3}
                                className="mt-1"
                              />
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3 font-mono">
                          <div className="text-[11px] text-[#323130] font-bold">{prod.sku}</div>
                          {showBatch && (
                            <div className="text-[10px] text-[#605E5C]">{prod.batchNumber || 'N/A'}</div>
                          )}
                        </td>

                        <td className="py-3 px-3 font-bold text-[#0078D4] font-mono">
                          {formatTSh(prod.price)}
                        </td>

                        <td className="py-3 px-3 text-[#605E5C] font-mono">
                          {formatTSh(prod.cost)}
                        </td>

                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5">
                            <span className={`font-extrabold ${isCritical ? 'text-[#D13438]' : isLow ? 'text-amber-600' : 'text-[#107C10]'}`}>
                              {prod.stock} {prod.unit}
                            </span>
                            {isLow && (
                              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                                isCritical ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                              }`}>
                                {isCritical ? 'Critical' : 'Low'}
                              </span>
                            )}
                          </div>
                          <div className="text-[9px] text-[#605E5C]">Min: {prod.reorderPoint}</div>
                        </td>

                        <td className="py-3 px-3 font-mono font-semibold text-[#323130]">
                          {formatTSh(prod.stock * prod.cost)}
                        </td>

                        {showExpiry && (
                          <td className="py-3 px-3 text-[#605E5C] font-mono">
                            {prod.expiryDate || '—'}
                          </td>
                        )}

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => {
                                setQrModalProduct(prod);
                                setIsQRModalOpen(true);
                              }}
                              className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-[#6264A7] rounded-lg border border-indigo-200 font-bold text-[11px] cursor-pointer transition-all"
                              title="Generate QR Code & Print Shelf Label"
                            >
                              <QrCode className="w-3.5 h-3.5" />
                            </button>
                            {!inventoryReadOnly && (
                            <>
                            <button
                              onClick={() => {
                                setStockOutForm(prev => ({ ...prev, productId: prod.id, quantity: 1 }));
                                setIsStockOutOpen(true);
                              }}
                              className="px-2 py-1 bg-[#F3F2F1] hover:bg-rose-100 text-rose-800 rounded-lg font-bold text-[11px] cursor-pointer"
                              title="Stock Out / Damage / Loss"
                            >
                              - Out
                            </button>
                            <button
                              onClick={() => {
                                setManualStockInForm(prev => ({ ...prev, productId: prod.id, unitCost: prod.cost }));
                                setIsQuickStockInOpen(true);
                              }}
                              className="px-2.5 py-1 bg-[#107C10] hover:bg-[#0E6A0E] text-white rounded-lg font-bold text-[11px] shadow-xs cursor-pointer"
                              title="Stock In / Restock"
                            >
                              + In
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); openEditProduct(prod); }}
                              className="px-2 py-1 bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#1D4ED8] rounded-lg font-bold text-[11px] cursor-pointer border border-blue-200"
                              title={isSw ? 'Hariri bidhaa' : 'Edit product'}
                            >
                              ✏️ Edit
                            </button>
                            </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 2: INBOUND GOODS & 1-CLICK PO RECEIVE ================= */}
      {activeTab === 'stockin' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-[#E1DFDD] shadow-xs">
            <div>
              <h3 className="font-bold text-sm text-[#323130]">Inbound Goods & 1-Click Purchase Order Fulfillment</h3>
              <p className="text-xs text-[#605E5C]">Instantly update inventory levels and register new products from supplier deliveries</p>
            </div>
            <button
              onClick={() => setIsQuickStockInOpen(true)}
              className="px-4 py-2 rounded-lg bg-[#107C10] text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Direct Manual Stock In</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingOrders.length === 0 ? (
              <div className="col-span-2 text-center py-12 bg-white rounded-xl border border-[#EDEBE9] text-xs text-[#605E5C] space-y-2">
                <CheckCircle2 className="w-8 h-8 text-[#107C10] mx-auto" />
                <div className="font-bold text-sm text-[#323130]">All Supplier Deliveries Received</div>
                <p>There are no pending purchase orders awaiting stock-in at this time.</p>
              </div>
            ) : (
              pendingOrders.map(po => (
                <div key={po.id} className="bg-white rounded-xl border-2 border-amber-300 p-5 shadow-xs space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                        Inbound Shipment Pending
                      </span>
                      <h4 className="font-bold text-base text-[#323130] mt-1">{po.poNumber} — {po.supplierName}</h4>
                      <p className="text-xs text-[#605E5C]">Expected Date: {po.expectedDate} • Terms: {po.paymentTerms}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-[#605E5C]">Valuation</div>
                      <div className="text-base font-extrabold text-[#323130] font-mono">{formatTSh(po.totalAmount)}</div>
                    </div>
                  </div>

                  <div className="bg-[#FAF9F8] rounded-lg p-3 border border-[#EDEBE9] space-y-1 text-xs">
                    <div className="font-bold text-[#605E5C] text-[10px] uppercase">Manifest Items:</div>
                    {po.items.map((it, idx) => (
                      <div key={idx} className="flex justify-between text-[#323130]">
                        <span className="flex items-center gap-1.5">
                          • {it.productName} 
                          {it.isNewProduct && <span className="text-[9px] font-bold px-1 bg-blue-100 text-blue-800 rounded">NEW</span>}
                        </span>
                        <span className="font-bold font-mono">{it.quantity} {it.unit || 'pcs'} @ {formatTSh(it.costPrice)}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => handleQuickReceivePO(po)}
                    className="w-full py-2.5 rounded-xl bg-[#107C10] hover:bg-[#0E6A0E] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                  >
                    <PackageCheck className="w-4 h-4" />
                    <span>1-Click Receive & Stock Into Inventory</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ================= TAB 3: STOCK MOVEMENT AUDIT TRAIL ================= */}
      {activeTab === 'movements' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-[#E1DFDD] shadow-xs overflow-hidden">
            <div className="p-4 border-b border-[#EDEBE9] flex justify-between items-center">
              <div>
                <h3 className="font-bold text-sm text-[#323130]">Stock Movement & Audit Log</h3>
                <p className="text-xs text-[#605E5C]">Complete immutable ledger of sales, receipts, damages, and manual adjustments</p>
              </div>
              <span className="text-xs font-mono text-[#605E5C]">{stockMovements.length} logged events</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8F8F8] border-b border-[#EDEBE9] text-[#605E5C] font-bold uppercase">
                  <tr>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-3">Product Name & SKU</th>
                    <th className="py-3 px-3">Movement Type</th>
                    <th className="py-3 px-3">Quantity Delta</th>
                    <th className="py-3 px-3">Stock Before / After</th>
                    <th className="py-3 px-3">Valuation Impact</th>
                    <th className="py-3 px-3">Reference / Txn</th>
                    <th className="py-3 px-4">Staff / Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F2F1]">
                  {stockMovements.map(sm => {
                    const isIn = sm.quantity > 0;
                    return (
                      <tr key={sm.id} className="hover:bg-[#FAF9F8]">
                        <td className="py-3 px-4 font-mono text-[#605E5C]">{sm.date}</td>

                        <td className="py-3 px-3">
                          <div className="font-bold text-[#323130]">{sm.productName}</div>
                          <div className="text-[10px] text-[#605E5C] font-mono">{sm.sku}</div>
                        </td>

                        <td className="py-3 px-3">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            sm.type === 'in_purchase' 
                              ? 'bg-emerald-100 text-emerald-800'
                              : sm.type === 'out_sale'
                              ? 'bg-blue-100 text-blue-800'
                              : sm.type === 'out_damage' || sm.type === 'out_expiry'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {isIn ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                            {sm.type.replace('_', ' ').toUpperCase()}
                          </span>
                        </td>

                        <td className="py-3 px-3 font-extrabold font-mono">
                          <span className={isIn ? 'text-[#107C10]' : 'text-[#D13438]'}>
                            {isIn ? `+${sm.quantity}` : sm.quantity}
                          </span>
                        </td>

                        <td className="py-3 px-3 font-mono text-[#605E5C]">
                          {sm.previousStock} &rarr; <span className="font-bold text-[#323130]">{sm.newStock}</span>
                        </td>

                        <td className="py-3 px-3 font-mono text-[#323130]">
                          {formatTSh(sm.totalValuation || 0)}
                        </td>

                        <td className="py-3 px-3 font-mono text-[#0078D4] font-semibold">
                          {sm.referenceId || sm.referenceType || 'MANUAL'}
                        </td>

                        <td className="py-3 px-4">
                          <div className="text-[11px] font-semibold text-[#323130]">{sm.operatorName}</div>
                          <div className="text-[10px] text-[#605E5C]">{sm.notes || '-'}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 1: ADD NEW PRODUCT ================= */}
      {isAddingProduct && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveProduct}
            className="bg-white rounded-2xl max-w-2xl w-full border border-[#E1DFDD] shadow-2xl flex flex-col max-h-[min(92vh,880px)] overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-[#EDEBE9] px-6 py-4 shrink-0">
              <div className="flex items-center gap-2">
                <Boxes className="w-5 h-5 text-[#6264A7]" />
                <h3 className="font-bold text-sm text-[#323130]">
                  {isSw ? 'Sajili Bidhaa Mpya' : 'Register New Product to Catalog'}
                </h3>
              </div>
              <button type="button" onClick={() => setIsAddingProduct(false)} className="text-[#605E5C] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 min-h-0 px-6 py-4 space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-[#323130] mb-1">
                {isSw ? 'Picha ya Bidhaa' : 'Product Photo'}
              </label>
              <ProductImageUploader
                value={newProduct.imageUrl || undefined}
                onChange={url => setNewProduct(prev => ({ ...prev, imageUrl: url || '' }))}
                isSw={isSw}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block font-semibold text-[#323130] mb-1">
                  {isSw ? 'Jina la Bidhaa *' : 'Product Name *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={productNamePlaceholder}
                  value={newProduct.name}
                  onChange={e => setNewProduct(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-[#F3F2F1] rounded-lg border border-[#EDEBE9] focus:bg-white outline-none"
                />
              </div>
              <div>
                <CategoryTaxonomyPicker
                  language={language}
                  businessType={businessType}
                  value={categorySel}
                  onChange={(sel) => {
                    setCategorySel(sel);
                    setNewProduct(prev => ({ ...prev, category: sel.displayPath }));
                  }}
                  customCategories={customCategories}
                  onAddCustom={(path) => setCustomCategories(prev => [...prev, path])}
                />
              </div>
              <div>
                <UnitPicker
                  label={isSw ? 'Kipimo' : 'Unit'}
                  units={workplace.default_units}
                  value={newProduct.unit}
                  onChange={unit => setNewProduct(prev => ({ ...prev, unit }))}
                  isSw={isSw}
                  selectClassName="w-full px-3 py-2 bg-[#F3F2F1] rounded-lg border border-[#EDEBE9] focus:bg-white outline-none"
                  inputClassName="w-full mt-1.5 px-3 py-2 bg-[#F3F2F1] rounded-lg border border-[#EDEBE9] focus:bg-white outline-none"
                />
              </div>
            </div>

            <DynamicProductForm
              language={language}
              businessType={businessType}
              values={dynamicFields}
              onChange={setDynamicFields}
            />

            {purchaseVatAvailable && (
              <div>
                <label className="block font-semibold text-[#323130] mb-1">
                  {isSw ? 'Aina ya VAT' : 'VAT class'}
                </label>
                <select
                  value={newProduct.vatType}
                  onChange={e => setNewProduct(prev => ({
                    ...prev,
                    vatType: e.target.value as 'standard' | 'exempt' | 'zero',
                  }))}
                  className="w-full px-3 py-2 bg-[#F3F2F1] rounded-lg border border-[#EDEBE9] focus:bg-white outline-none"
                >
                  <option value="standard">{isSw ? 'VAT 18% (kawaida)' : 'Standard VAT 18%'}</option>
                  <option value="exempt">{isSw ? 'Msamaha wa VAT' : 'VAT exempt'}</option>
                  <option value="zero">{isSw ? 'Kiwango 0%' : 'Zero-rated'}</option>
                </select>
                <p className="text-[10px] text-[#605E5C] mt-1">
                  {isSw
                    ? 'Hutumika unapotumia “VAT kwa bidhaa za VAT tu” kwenye ununuzi.'
                    : 'Used when purchase VAT scope is “VAT products only”.'}
                </p>
              </div>
            )}

            <div>
              <label className="block font-semibold text-[#323130] mb-1">
                {isSw ? 'Msambazaji *' : 'Supplier *'}
              </label>
              {suppliers.length > 0 ? (
                <select
                  required
                  value={newProduct.supplierId || newProduct.supplierName}
                  onChange={e => {
                    const sel = suppliers.find(s => s.id === e.target.value);
                    setNewProduct(prev => ({
                      ...prev,
                      supplierId: sel?.id || '',
                      supplierName: sel?.name || e.target.value,
                    }));
                  }}
                  className="w-full px-3 py-2 bg-[#F3F2F1] rounded-lg border border-[#EDEBE9] focus:bg-white outline-none"
                >
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  required
                  placeholder={isSw ? 'Jina la msambazaji' : 'Supplier name'}
                  value={newProduct.supplierName}
                  onChange={e => setNewProduct(prev => ({ ...prev, supplierName: e.target.value, supplierId: '' }))}
                  className="w-full px-3 py-2 bg-[#F3F2F1] rounded-lg border border-[#EDEBE9] focus:bg-white outline-none"
                />
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block font-semibold text-[#323130] mb-1">Selling Price (TSh)</label>
                <input
                  type="number"
                  value={newProduct.price}
                  onChange={e => setNewProduct(prev => ({ ...prev, price: Number(e.target.value) }))}
                  className="w-full px-3 py-2 bg-[#F3F2F1] rounded-lg border border-[#EDEBE9] focus:bg-white outline-none font-bold"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#323130] mb-1">Cost Price (TSh)</label>
                <input
                  type="number"
                  value={newProduct.cost}
                  onChange={e => setNewProduct(prev => ({ ...prev, cost: Number(e.target.value) }))}
                  className="w-full px-3 py-2 bg-[#F3F2F1] rounded-lg border border-[#EDEBE9] focus:bg-white outline-none font-bold"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#323130] mb-1">Opening Stock Qty</label>
                <input
                  type="number"
                  value={newProduct.stock}
                  onChange={e => setNewProduct(prev => ({ ...prev, stock: Number(e.target.value) }))}
                  className="w-full px-3 py-2 bg-[#F3F2F1] rounded-lg border border-[#EDEBE9] focus:bg-white outline-none font-bold"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#323130] mb-1">Reorder Point</label>
                <input
                  type="number"
                  value={newProduct.reorderPoint}
                  onChange={e => setNewProduct(prev => ({ ...prev, reorderPoint: Number(e.target.value) }))}
                  className="w-full px-3 py-2 bg-[#F3F2F1] rounded-lg border border-[#EDEBE9] focus:bg-white outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold text-[#323130] mb-1">SKU / Code</label>
                <input
                  type="text"
                  value={newProduct.sku}
                  onChange={e => setNewProduct(prev => ({ ...prev, sku: e.target.value }))}
                  className="w-full px-3 py-2 bg-[#F3F2F1] rounded-lg border border-[#EDEBE9] focus:bg-white outline-none"
                />
              </div>
              {showBatch && (
              <div>
                <label className="block font-semibold text-[#323130] mb-1">Batch / Lot #</label>
                <input
                  type="text"
                  value={newProduct.batchNumber}
                  onChange={e => setNewProduct(prev => ({ ...prev, batchNumber: e.target.value }))}
                  className="w-full px-3 py-2 bg-[#F3F2F1] rounded-lg border border-[#EDEBE9] focus:bg-white outline-none"
                />
              </div>
              )}
              {showExpiry && (
              <div>
                <label className="block font-semibold text-[#323130] mb-1">Expiry Date</label>
                <input
                  type="date"
                  value={newProduct.expiryDate}
                  onChange={e => setNewProduct(prev => ({ ...prev, expiryDate: e.target.value }))}
                  className="w-full px-3 py-2 bg-[#F3F2F1] rounded-lg border border-[#EDEBE9] focus:bg-white outline-none"
                />
              </div>
              )}
            </div>
            </div>

            <div className="flex justify-end gap-2 px-6 py-4 border-t border-[#EDEBE9] bg-[#FAF9F8] rounded-b-2xl shrink-0">
              <button
                type="button"
                onClick={() => setIsAddingProduct(false)}
                className="px-4 py-1.5 text-xs font-semibold text-[#605E5C] bg-[#F3F2F1] rounded-lg"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                className="px-5 py-1.5 text-xs font-bold text-white bg-[#6264A7] hover:bg-[#555793] rounded-lg"
              >
                Save & Open Stock
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ================= MODAL 2: DIRECT MANUAL STOCK IN ================= */}
      {isQuickStockInOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleExecuteManualStockIn} className="bg-white rounded-2xl max-w-md w-full border border-[#E1DFDD] shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#EDEBE9] pb-3">
              <div className="flex items-center gap-2">
                <ArrowDownLeft className="w-5 h-5 text-[#107C10]" />
                <h3 className="font-bold text-sm text-[#323130]">Manual Stock In Replenishment</h3>
              </div>
              <button type="button" onClick={() => setIsQuickStockInOpen(false)} className="text-[#605E5C]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#323130] mb-1">Select Product *</label>
                <select
                  value={manualStockInForm.productId}
                  onChange={e => {
                    const sel = products.find(p => p.id === e.target.value);
                    setManualStockInForm({
                      ...manualStockInForm,
                      productId: e.target.value,
                      unitCost: sel?.cost || 3000,
                    });
                  }}
                  className="w-full px-3 py-2 bg-[#F3F2F1] rounded-lg border border-[#EDEBE9] focus:bg-white outline-none"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} (Current: {p.stock} {p.unit})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#323130] mb-1">Quantity to Inward</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={manualStockInForm.quantity}
                    onChange={e => setManualStockInForm({ ...manualStockInForm, quantity: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-[#F3F2F1] rounded-lg border border-[#EDEBE9] focus:bg-white outline-none font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#323130] mb-1">Unit Cost (TSh)</label>
                  <input
                    type="number"
                    value={manualStockInForm.unitCost}
                    onChange={e => setManualStockInForm({ ...manualStockInForm, unitCost: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-[#F3F2F1] rounded-lg border border-[#EDEBE9] focus:bg-white outline-none font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#323130] mb-1">Batch #</label>
                  <input
                    type="text"
                    value={manualStockInForm.batchNumber}
                    onChange={e => setManualStockInForm({ ...manualStockInForm, batchNumber: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F3F2F1] rounded-lg border border-[#EDEBE9] focus:bg-white outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#323130] mb-1">Expiry Date</label>
                  <input
                    type="date"
                    value={manualStockInForm.expiryDate}
                    onChange={e => setManualStockInForm({ ...manualStockInForm, expiryDate: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F3F2F1] rounded-lg border border-[#EDEBE9] focus:bg-white outline-none"
                  />
                </div>
              </div>

              {renderSupplierField(
                manualStockInForm.supplierId,
                manualStockInForm.supplierName,
                'stockIn',
              )}

              <div>
                <label className="block font-semibold text-[#323130] mb-1">{isSw ? 'Maelezo' : 'Notes'}</label>
                <input
                  type="text"
                  placeholder={isSw ? 'mf. Uwasilishaji wa moja kwa moja' : 'e.g. Direct manufacturer delivery'}
                  value={manualStockInForm.notes}
                  onChange={e => setManualStockInForm({ ...manualStockInForm, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F3F2F1] rounded-lg border border-[#EDEBE9] focus:bg-white outline-none"
                />
              </div>

              {purchaseVatAvailable && (
                <div className="p-3 rounded-xl border border-[#E65100]/25 bg-orange-50/40 space-y-2">
                  <label className="flex items-center gap-2 text-xs font-bold text-[#323130]">
                    <input
                      type="checkbox"
                      checked={manualStockInForm.applyVat}
                      onChange={e => setManualStockInForm({
                        ...manualStockInForm,
                        applyVat: e.target.checked,
                      })}
                      className="rounded text-[#E65100]"
                    />
                    {isSw ? 'Tumia VAT 18% kwenye stock-in hii' : 'Apply VAT 18% on this stock-in'}
                  </label>
                  {defaultPurchaseVatScope === 'vat_products' && (
                    <p className="text-[10px] text-[#605E5C]">
                      {isSw
                        ? 'Duka limeteuliwa “bidhaa za VAT tu” — VAT itatumika iwapo bidhaa ina aina ya VAT ya kawaida.'
                        : 'Shop default is “VAT products only” — VAT applies if this product is standard VAT class.'}
                    </p>
                  )}
                  {manualStockInForm.applyVat && (
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-[#605E5C] mb-1">
                        {isSw ? 'Kumbuka ya VAT' : 'VAT note'}
                      </label>
                      <input
                        type="text"
                        value={manualStockInForm.vatNote}
                        onChange={e => setManualStockInForm({
                          ...manualStockInForm,
                          vatNote: e.target.value,
                        })}
                        placeholder={taxSettings.purchaseVatNote || (isSw ? 'mf. Bei bila VAT' : 'e.g. Cost excl. VAT')}
                        className="w-full px-3 py-2 bg-white rounded-lg border border-[#EDEBE9] outline-none"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#EDEBE9]">
              <button
                type="button"
                onClick={() => setIsQuickStockInOpen(false)}
                className="px-4 py-1.5 text-xs font-semibold text-[#605E5C] bg-[#F3F2F1] rounded-lg"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                className="px-5 py-1.5 text-xs font-bold text-white bg-[#107C10] hover:bg-[#0E6A0E] rounded-lg shadow-xs"
              >
                Execute Stock In
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ================= MODAL 3: STOCK OUT / DAMAGE ADJUSTMENT ================= */}
      {isStockOutOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleExecuteStockOut} className="bg-white rounded-2xl max-w-md w-full border border-[#E1DFDD] shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#EDEBE9] pb-3">
              <div className="flex items-center gap-2">
                <ArrowUpRight className="w-5 h-5 text-[#D13438]" />
                <h3 className="font-bold text-sm text-[#323130]">Stock Out & Damage Deduction</h3>
              </div>
              <button type="button" onClick={() => setIsStockOutOpen(false)} className="text-[#605E5C]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#323130] mb-1">Product *</label>
                <select
                  value={stockOutForm.productId}
                  onChange={e => setStockOutForm({ ...stockOutForm, productId: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F3F2F1] rounded-lg border border-[#EDEBE9] focus:bg-white outline-none"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} (Current Stock: {p.stock})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#323130] mb-1">Quantity to Deduct</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={stockOutForm.quantity}
                    onChange={e => setStockOutForm({ ...stockOutForm, quantity: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-[#F3F2F1] rounded-lg border border-[#EDEBE9] focus:bg-white outline-none font-bold text-[#D13438]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#323130] mb-1">Reason for Deduction</label>
                  <select
                    value={stockOutForm.reason}
                    onChange={e => setStockOutForm({ ...stockOutForm, reason: e.target.value as any })}
                    className="w-full px-3 py-2 bg-[#F3F2F1] rounded-lg border border-[#EDEBE9] focus:bg-white outline-none"
                  >
                    <option value="out_damage">Damaged Packaging / Broken</option>
                    <option value="out_expiry">Expired Stock Write-off</option>
                    <option value="out_adjustment">Inventory Audit Discrepancy</option>
                    <option value="out_return">Return to Supplier</option>
                  </select>
                </div>
              </div>

              {stockOutForm.reason === 'out_return' && renderSupplierField(
                stockOutForm.supplierId,
                stockOutForm.supplierName,
                'stockOut',
              )}

              <div>
                <label className="block font-semibold text-[#323130] mb-1">Detailed Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Broken vial during morning shelf cleaning"
                  value={stockOutForm.notes}
                  onChange={e => setStockOutForm({ ...stockOutForm, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F3F2F1] rounded-lg border border-[#EDEBE9] focus:bg-white outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#EDEBE9]">
              <button
                type="button"
                onClick={() => setIsStockOutOpen(false)}
                className="px-4 py-1.5 text-xs font-semibold text-[#605E5C] bg-[#F3F2F1] rounded-lg"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                className="px-5 py-1.5 text-xs font-bold text-white bg-[#D13438] hover:bg-[#B12A2E] rounded-lg shadow-xs"
              >
                Deduct & Write-Off Stock
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Quick Add Supplier (from stock in/out) */}
      {isQuickAddSupplierOpen && (
        <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleQuickAddSupplier} className="bg-white rounded-2xl max-w-md w-full border border-[#E1DFDD] shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#EDEBE9] pb-3">
              <h3 className="font-bold text-sm text-[#323130]">{isSw ? 'Ongeza Msambazaji' : 'Add Supplier'}</h3>
              <button type="button" onClick={() => setIsQuickAddSupplierOpen(false)} className="text-[#605E5C]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <input
                required
                placeholder={isSw ? 'Jina la kampuni *' : 'Company name *'}
                value={quickSupplierForm.name}
                onChange={e => setQuickSupplierForm({ ...quickSupplierForm, name: e.target.value })}
                className="w-full px-3 py-2 bg-[#F3F2F1] rounded-lg border border-[#EDEBE9] outline-none"
              />
              <input
                placeholder={isSw ? 'Mhusika' : 'Contact person'}
                value={quickSupplierForm.contactPerson}
                onChange={e => setQuickSupplierForm({ ...quickSupplierForm, contactPerson: e.target.value })}
                className="w-full px-3 py-2 bg-[#F3F2F1] rounded-lg border border-[#EDEBE9] outline-none"
              />
              <input
                placeholder={isSw ? 'Simu' : 'Phone'}
                value={quickSupplierForm.phone}
                onChange={e => setQuickSupplierForm({ ...quickSupplierForm, phone: e.target.value })}
                className="w-full px-3 py-2 bg-[#F3F2F1] rounded-lg border border-[#EDEBE9] outline-none"
              />
              <input
                placeholder="Email"
                value={quickSupplierForm.email}
                onChange={e => setQuickSupplierForm({ ...quickSupplierForm, email: e.target.value })}
                className="w-full px-3 py-2 bg-[#F3F2F1] rounded-lg border border-[#EDEBE9] outline-none"
              />
              <select
                value={quickSupplierForm.category}
                onChange={e => setQuickSupplierForm({ ...quickSupplierForm, category: e.target.value })}
                className="w-full px-3 py-2 bg-[#F3F2F1] rounded-lg border border-[#EDEBE9] outline-none"
              >
                {['General', 'Food & Beverages', 'Pharmaceuticals', 'Electronics', 'Hardware & Building', 'Other'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <select
                value={quickSupplierForm.paymentTerms}
                onChange={e => setQuickSupplierForm({ ...quickSupplierForm, paymentTerms: e.target.value })}
                className="w-full px-3 py-2 bg-[#F3F2F1] rounded-lg border border-[#EDEBE9] outline-none"
              >
                <option value="Net 30 Days">Net 30 Days</option>
                <option value="Net 15 Days">Net 15 Days</option>
                <option value="Cash on Delivery">Cash on Delivery</option>
                <option value="Prepayment">Prepayment</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setIsQuickAddSupplierOpen(false)} className="px-4 py-1.5 text-xs font-semibold text-[#605E5C] bg-[#F3F2F1] rounded-lg">
                {t('cancel')}
              </button>
              <button type="submit" className="px-5 py-1.5 text-xs font-bold text-white bg-[#6264A7] hover:bg-[#555793] rounded-lg">
                {isSw ? 'Hifadhi Msambazaji' : 'Save Supplier'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* QR Code & Shelf Label Modal */}
      <QRCodeModal
        isOpen={isQRModalOpen}
        onClose={() => setIsQRModalOpen(false)}
        product={qrModalProduct}
        allProducts={products}
        language={language}
      />

      {/* ================= MODAL: EDIT PRODUCT ================= */}
      {editingProduct && editForm && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveEdit}
            className="bg-white rounded-2xl max-w-2xl w-full border border-[#E1DFDD] shadow-2xl flex flex-col max-h-[min(92vh,860px)] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#EDEBE9] px-6 py-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center">
                  <span className="text-base">✏️</span>
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#323130]">
                    {isSw ? 'Hariri Bidhaa' : 'Edit Product'}
                  </h3>
                  <p className="text-[11px] text-[#605E5C]">{editingProduct.name} · {editingProduct.sku}</p>
                </div>
              </div>
              <button type="button" onClick={() => { setEditingProduct(null); setEditForm(null); }} className="text-[#605E5C] hover:text-[#323130] cursor-pointer">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 min-h-0 px-6 py-5 space-y-4 text-xs">

              {/* Product Photo */}
              <div>
                <label className="block font-semibold text-[#323130] mb-1.5">
                  {isSw ? 'Picha ya Bidhaa' : 'Product Photo'}
                </label>
                <ProductImageUploader
                  value={editForm.imageUrl || undefined}
                  onChange={url => setEditForm(prev => prev ? { ...prev, imageUrl: url ?? undefined } : prev)}
                  isSw={isSw}
                  compact
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Name */}
                <div className="md:col-span-2">
                  <label className="block font-semibold text-[#323130] mb-1">
                    {isSw ? 'Jina la Bidhaa *' : 'Product Name *'}
                  </label>
                  <input
                    required
                    value={editForm.name}
                    onChange={e => setEditForm(prev => prev ? { ...prev, name: e.target.value } : prev)}
                    className="w-full px-3 py-2 bg-[#F3F2F1] rounded-lg border border-[#EDEBE9] focus:bg-white focus:border-[#6264A7] outline-none"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block font-semibold text-[#323130] mb-1">
                    {isSw ? 'Kategoria' : 'Category'}
                  </label>
                  <input
                    value={editForm.category}
                    onChange={e => setEditForm(prev => prev ? { ...prev, category: e.target.value } : prev)}
                    className="w-full px-3 py-2 bg-[#F3F2F1] rounded-lg border border-[#EDEBE9] focus:bg-white focus:border-[#6264A7] outline-none"
                  />
                </div>

                {/* Unit */}
                <div>
                  <label className="block font-semibold text-[#323130] mb-1">
                    {isSw ? 'Kipimo' : 'Unit'}
                  </label>
                  <input
                    value={editForm.unit}
                    onChange={e => setEditForm(prev => prev ? { ...prev, unit: e.target.value } : prev)}
                    className="w-full px-3 py-2 bg-[#F3F2F1] rounded-lg border border-[#EDEBE9] focus:bg-white focus:border-[#6264A7] outline-none"
                  />
                </div>

                {/* Selling price */}
                <div>
                  <label className="block font-semibold text-[#323130] mb-1">
                    {isSw ? 'Bei ya Uuzaji (TSh)' : 'Selling Price (TSh)'}
                  </label>
                  <input
                    type="number" min="0" required
                    value={editForm.price}
                    onChange={e => setEditForm(prev => prev ? { ...prev, price: e.target.value } : prev)}
                    className="w-full px-3 py-2 bg-[#F3F2F1] rounded-lg border border-[#EDEBE9] focus:bg-white focus:border-[#6264A7] outline-none font-mono"
                  />
                </div>

                {/* Cost price */}
                <div>
                  <label className="block font-semibold text-[#323130] mb-1">
                    {isSw ? 'Bei ya Kununulia (TSh)' : 'Cost Price (TSh)'}
                  </label>
                  <input
                    type="number" min="0" required
                    value={editForm.cost}
                    onChange={e => setEditForm(prev => prev ? { ...prev, cost: e.target.value } : prev)}
                    className="w-full px-3 py-2 bg-[#F3F2F1] rounded-lg border border-[#EDEBE9] focus:bg-white focus:border-[#6264A7] outline-none font-mono"
                  />
                </div>

                {/* Stock */}
                <div>
                  <label className="block font-semibold text-[#323130] mb-1">
                    {isSw ? 'Stoo ya Sasa' : 'Current Stock'}
                  </label>
                  <input
                    type="number" min="0"
                    value={editForm.stock}
                    onChange={e => setEditForm(prev => prev ? { ...prev, stock: e.target.value } : prev)}
                    className="w-full px-3 py-2 bg-[#F3F2F1] rounded-lg border border-[#EDEBE9] focus:bg-white focus:border-[#6264A7] outline-none font-mono"
                  />
                </div>

                {/* Reorder point */}
                <div>
                  <label className="block font-semibold text-[#323130] mb-1">
                    {isSw ? 'Kiwango cha Kuagiza' : 'Reorder Point'}
                  </label>
                  <input
                    type="number" min="0"
                    value={editForm.reorderPoint}
                    onChange={e => setEditForm(prev => prev ? { ...prev, reorderPoint: e.target.value } : prev)}
                    className="w-full px-3 py-2 bg-[#F3F2F1] rounded-lg border border-[#EDEBE9] focus:bg-white focus:border-[#6264A7] outline-none font-mono"
                  />
                </div>

                {/* Batch number */}
                <div>
                  <label className="block font-semibold text-[#323130] mb-1">
                    {isSw ? 'Namba ya Bachi' : 'Batch Number'}
                  </label>
                  <input
                    value={editForm.batchNumber}
                    onChange={e => setEditForm(prev => prev ? { ...prev, batchNumber: e.target.value } : prev)}
                    className="w-full px-3 py-2 bg-[#F3F2F1] rounded-lg border border-[#EDEBE9] focus:bg-white focus:border-[#6264A7] outline-none"
                  />
                </div>

                {/* Expiry date */}
                <div>
                  <label className="block font-semibold text-[#323130] mb-1">
                    {isSw ? 'Tarehe ya Kuisha' : 'Expiry Date'}
                  </label>
                  <input
                    type="date"
                    value={editForm.expiryDate}
                    onChange={e => setEditForm(prev => prev ? { ...prev, expiryDate: e.target.value } : prev)}
                    className="w-full px-3 py-2 bg-[#F3F2F1] rounded-lg border border-[#EDEBE9] focus:bg-white focus:border-[#6264A7] outline-none"
                  />
                </div>

                {/* Supplier */}
                <div>
                  <label className="block font-semibold text-[#323130] mb-1">
                    {isSw ? 'Msambazaji' : 'Supplier'}
                  </label>
                  <input
                    value={editForm.supplier}
                    onChange={e => setEditForm(prev => prev ? { ...prev, supplier: e.target.value } : prev)}
                    className="w-full px-3 py-2 bg-[#F3F2F1] rounded-lg border border-[#EDEBE9] focus:bg-white focus:border-[#6264A7] outline-none"
                  />
                </div>

                {/* Description */}
                <div className="md:col-span-2">
                  <label className="block font-semibold text-[#323130] mb-1">
                    {isSw ? 'Maelezo' : 'Description'}
                  </label>
                  <textarea
                    rows={2}
                    value={editForm.description}
                    onChange={e => setEditForm(prev => prev ? { ...prev, description: e.target.value } : prev)}
                    className="w-full px-3 py-2 bg-[#F3F2F1] rounded-lg border border-[#EDEBE9] focus:bg-white focus:border-[#6264A7] outline-none resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-[#EDEBE9] bg-[#FAF9F8] rounded-b-2xl shrink-0">
              <button
                type="button"
                onClick={() => { setEditingProduct(null); setEditForm(null); }}
                className="px-4 py-1.5 text-xs font-semibold text-[#605E5C] bg-[#F3F2F1] hover:bg-[#EDEBE9] rounded-lg cursor-pointer"
              >
                {isSw ? 'Ghairi' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={editSaving}
                className="px-5 py-1.5 text-xs font-bold text-white bg-[#6264A7] hover:bg-[#555793] disabled:opacity-60 rounded-lg cursor-pointer"
              >
                {editSaving
                  ? (isSw ? 'Inahifadhi…' : 'Saving…')
                  : (isSw ? 'Hifadhi Mabadiliko' : 'Save Changes')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
