import React, { useState, useMemo } from 'react';
import { 
  Truck, 
  Search, 
  Plus, 
  Phone, 
  Mail, 
  FileText, 
  CheckCircle2, 
  Clock, 
  Star, 
  Sparkles, 
  ArrowRight,
  PackagePlus,
  ArrowDownLeft,
  ArrowUpRight,
  Boxes,
  DollarSign,
  AlertCircle,
  Calendar,
  X,
  CreditCard,
  Printer,
  ChevronRight,
  ShieldCheck,
  Tag,
  Building2,
  Trash2
} from 'lucide-react';
import { 
  Language, 
  Supplier, 
  PurchaseOrder, 
  PurchaseOrderItem, 
  Product, 
  StockMovement, 
  SupplierPayment, 
  CalendarEvent,
  BusinessType,
  AuthUser,
} from '@/types/v1';
import { formatTSh, getTranslation } from '@/utils/translations';
import { ActionBar } from '@/components/v1/ActionBar';
import { CategoryTaxonomyPicker, type CategorySelection } from '@/components/v1/CategoryTaxonomyPicker';
import { ProductMetaBadges } from '@/components/v1/ProductMetaBadges';
import { DynamicProductForm, type DynamicProductFormValues } from '@/components/v1/DynamicProductForm';
import { UnitPicker } from '@/components/v1/UnitPicker';
import { useDocumentTemplates } from '@/context/DocumentTemplateContext';
import { printDocument } from '@/lib/documentRenderer';
import { poToGrnRenderData } from '@/lib/documentDataMappers';
import { getWorkplace } from '@/lib/businessProfiles';
import {
  getDefaultMainCategory,
  getDefaultUnit,
  getProductNamePlaceholder,
  getSupplierIndustryCategory,
  hasFeature,
} from '@/lib/businessEngine';
import confetti from 'canvas-confetti';
import { api } from '@/lib/api';
import { mapSupplier, mapPurchaseOrder, mapEvent, optionalApiDate, supplierToApiPayload, eventToApiPayload, filterByBranchId, filterPurchaseOrdersByBranch } from '@/lib/apiSync';
import { exportProcurementReport } from '@/utils/reportGenerator';
import {
  PURCHASE_TAX_OPTIONS,
  applyPurchaseVatScopeToItems,
  computePurchaseOrderTotals,
  normalizePurchaseOrderItem,
  purchaseTaxRate,
  purchaseVatScopeLabel,
  resolveLineTaxIdForScope,
  type PurchaseTaxId,
  type PurchaseVatScope,
} from '@/lib/purchaseTax';
import { useTaxCompliance } from '@/context/TaxComplianceContext';
import { isVatActive } from '@/lib/taxComplianceSettings';
import { ProductImageThumb, ProductImageUploader } from '@/components/v1/ProductImage';

interface SuppliersViewProps {
  language: Language;
  suppliers: Supplier[];
  setSuppliers: React.Dispatch<React.SetStateAction<Supplier[]>>;
  purchaseOrders: PurchaseOrder[];
  setPurchaseOrders: React.Dispatch<React.SetStateAction<PurchaseOrder[]>>;
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  stockMovements: StockMovement[];
  setStockMovements: React.Dispatch<React.SetStateAction<StockMovement[]>>;
  supplierPayments?: SupplierPayment[];
  setSupplierPayments?: React.Dispatch<React.SetStateAction<SupplierPayment[]>>;
  events?: CalendarEvent[];
  setEvents?: React.Dispatch<React.SetStateAction<CalendarEvent[]>>;
  onOpenAIChatWithPrompt?: (prompt: string) => void;
  onReceivePO?: (poId: string) => void;
  businessType?: BusinessType;
  currentUser?: AuthUser | null;
  activeBranchId?: string | null;
}

function buildCustomItemDefaults(businessType: BusinessType, lang: 'sw' | 'en') {
  const showBatch = hasFeature(businessType, 'batch_tracking');
  const showExpiry = hasFeature(businessType, 'expiry_alerts');
  return {
    productName: '',
    category: getDefaultMainCategory(businessType, lang),
    sku: `SKU-${Date.now().toString().slice(-4)}`,
    quantity: 10,
    costPrice: 5000,
    sellingPrice: 8000,
    unit: getDefaultUnit(businessType),
    batchNumber: showBatch ? `BT-${new Date().getFullYear()}-N1` : '',
    expiryDate: showExpiry ? '2028-12-31' : '',
    vatType: 'standard' as 'standard' | 'exempt' | 'zero',
    imageUrl: '' as string,
  };
}

export const SuppliersView: React.FC<SuppliersViewProps> = ({
  language,
  suppliers,
  setSuppliers,
  purchaseOrders,
  setPurchaseOrders,
  products,
  setProducts,
  stockMovements,
  setStockMovements,
  supplierPayments = [],
  setSupplierPayments,
  events = [],
  setEvents,
  onOpenAIChatWithPrompt,
  onReceivePO,
  businessType = 'retail',
  currentUser,
  activeBranchId,
}) => {
  const branchProducts = useMemo(
    () => filterByBranchId(products, activeBranchId),
    [products, activeBranchId],
  );
  const branchProductIds = useMemo(
    () => new Set(branchProducts.map(p => p.id)),
    [branchProducts],
  );
  const branchPurchaseOrders = useMemo(
    () => filterPurchaseOrdersByBranch(purchaseOrders, activeBranchId, branchProductIds),
    [purchaseOrders, activeBranchId, branchProductIds],
  );
  const t = (key: any) => getTranslation(language, key);
  const isSw = language === 'sw';
  const lang = isSw ? 'sw' : 'en' as const;
  const { config, getActive } = useDocumentTemplates();
  const { settings: taxSettings } = useTaxCompliance();
  const purchaseVatAvailable = isVatActive(taxSettings) || taxSettings.mode === 'tra_efd';
  const workplace = getWorkplace(businessType);
  const showBatch = workplace.features?.batch_tracking ?? false;
  const showExpiry = workplace.features?.expiry_alerts ?? false;
  const productPlaceholder = getProductNamePlaceholder(businessType, lang);
  const defaultCategory = getDefaultMainCategory(businessType, lang);
  const supplierIndustry = getSupplierIndustryCategory(businessType, lang);

  const handlePrintGRN = (po: PurchaseOrder) => {
    const tpl = getActive('delivery_note');
    const data = poToGrnRenderData(po, isSw);
    printDocument(tpl, data, config.branding, isSw);
  };

  const handleExportProcurement = () => {
    const totalValue = branchPurchaseOrders.reduce((s, po) => s + (po.totalAmount || 0), 0);
    exportProcurementReport({
      provider: {
        businessName: currentUser?.businessName || 'Duka+ Business',
        ownerName:    currentUser?.name          || 'Owner',
        email:        currentUser?.email         || '',
        phone:        currentUser?.phone,
        location:     currentUser?.location,
        tinNumber:    currentUser?.tinNumber,
        branch:       currentUser?.branch,
        businessType: currentUser?.businessType,
      },
      orders: branchPurchaseOrders.map(po => ({
        poNumber:  po.orderNumber || po.id,
        supplier:  po.supplierName,
        date:      po.orderDate,
        status:    po.status.toUpperCase(),
        items:     `${po.items?.length ?? 0}`,
        total:     formatTSh(po.totalAmount || 0),
      })),
      totalValue: formatTSh(totalValue),
      language:   language as 'en' | 'sw',
    });
  };

  // Active view tab: 'suppliers' | 'orders' | 'payments'
  const [activeSubTab, setActiveSubTab] = useState<'suppliers' | 'orders' | 'payments'>('orders');
  const [searchQuery, setSearchQuery] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(suppliers[0]?.id || '');
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);

  // Modals
  const [isCreatingPO, setIsCreatingPO] = useState(false);
  const [isAddingSupplier, setIsAddingSupplier] = useState(false);
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
  const [isViewGRNModalOpen, setIsViewGRNModalOpen] = useState(false);
  const [successToast, setSuccessToast] = useState<{ title: string; desc: string } | null>(null);

  // New Supplier Form
  const [newSupplier, setNewSupplier] = useState({
    name: '',
    contactPerson: '',
    phone: '+255 ',
    email: '',
    category: supplierIndustry,
    paymentTerms: 'Net 30 Days',
    leadTimeDays: 2,
    rating: 4.8,
  });

  // Payment to Supplier Form
  const [paymentForm, setPaymentForm] = useState({
    supplierId: suppliers[0]?.id || '',
    amount: 500000,
    paymentMethod: 'CRDB Bank Transfer',
    referenceNumber: `TXN-${Math.floor(100000 + Math.random() * 900000)}`,
    notes: 'Invoice settlement payment',
  });

  // Dynamic PO Builder Form State
  const [poForm, setPoForm] = useState<{
    supplierId: string;
    vendorReference: string;
    currency: string;
    orderDeadline: string;
    expectedDate: string;
    deliverTo: string;
    askConfirmation: boolean;
    paymentTerms: string;
    paymentMethod: string;
    paymentStatus: 'paid' | 'credit' | 'partial';
    fiscalPosition: string;
    notes: string;
    vatNote: string;
    purchaseVatScope: PurchaseVatScope;
    poTab: 'products' | 'other';
    items: PurchaseOrderItem[];
  }>({
    supplierId: suppliers[0]?.id || '',
    vendorReference: '',
    currency: 'TZS',
    orderDeadline: new Date().toISOString().slice(0, 16),
    expectedDate: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
    deliverTo: isSw ? 'Stoo Kuu' : 'Main Store',
    askConfirmation: false,
    paymentTerms: 'Net 30 Days',
    paymentMethod: 'bank_transfer',
    paymentStatus: 'credit',
    fiscalPosition: 'local',
    notes: '',
    vatNote: '',
    purchaseVatScope: 'none',
    poTab: 'products',
    items: [] as PurchaseOrderItem[],
  });

  React.useEffect(() => {
    if (!purchaseVatAvailable) return;
    const scope = (taxSettings.purchaseVatScope ?? 'none') as PurchaseVatScope;
    setPoForm(prev => ({
      ...prev,
      purchaseVatScope: scope,
      vatNote: prev.vatNote || taxSettings.purchaseVatNote || '',
    }));
  }, [purchaseVatAvailable, taxSettings.purchaseVatScope, taxSettings.purchaseVatNote]);

  const poTotals = useMemo(
    () => computePurchaseOrderTotals(poForm.items),
    [poForm.items],
  );

  const patchPoLine = (index: number, patch: Partial<PurchaseOrderItem>) => {
    setPoForm(prev => {
      const items = [...prev.items];
      items[index] = normalizePurchaseOrderItem({ ...items[index], ...patch });
      return { ...prev, items };
    });
  };

  // Temporary row state for adding to PO Form
  const [selectedExistingProdId, setSelectedExistingProdId] = useState<string>(products[0]?.id || '');
  const [isAddingNewCustomItem, setIsAddingNewCustomItem] = useState<boolean>(false);
  const [poCategorySel, setPoCategorySel] = useState<CategorySelection>({
    main: defaultCategory,
    displayPath: defaultCategory,
  });
  const [poDynamicFields, setPoDynamicFields] = useState<DynamicProductFormValues>({ metadata: {} });
  const [customItemForm, setCustomItemForm] = useState(() => buildCustomItemDefaults(businessType, lang));

  React.useEffect(() => {
    const nextCategory = getDefaultMainCategory(businessType, lang);
    setPoCategorySel({ main: nextCategory, displayPath: nextCategory });
    setCustomItemForm(buildCustomItemDefaults(businessType, lang));
    setNewSupplier(prev => ({ ...prev, category: getSupplierIndustryCategory(businessType, lang) }));
    setPoDynamicFields({ metadata: {} });
  }, [businessType, lang]);

  // Helper trigger toast
  const triggerToast = (title: string, desc: string) => {
    setSuccessToast({ title, desc });
    setTimeout(() => setSuccessToast(null), 6000);
  };

  const handleCancelPO = async (targetPO: PurchaseOrder) => {
    if (targetPO.status === 'received' || targetPO.status === 'cancelled') return;
    const ok = window.confirm(
      isSw
        ? `Kataa agizo ${targetPO.poNumber}? Stoo haitaongezwa.`
        : `Reject order ${targetPO.poNumber}? Stock will NOT be added to inventory.`,
    );
    if (!ok) return;
    try {
      await api.cancelPurchaseOrder(targetPO.id);
      setPurchaseOrders(prev => prev.map(po => po.id === targetPO.id ? { ...po, status: 'cancelled' as const } : po));
      triggerToast(isSw ? 'Agizo limefutwa' : 'Order cancelled', targetPO.supplierName);
    } catch (err) {
      alert((err as Error).message);
    }
  };

  // 1-CLICK RECEIVE & STOCK-IN HANDLER
  // Automatically creates new products, updates existing product stock and cost, logs stock movements,
  // updates supplier accounts payable, updates calendar events, and marks PO as received.
  const handleExecuteReceivePO = (targetPO: PurchaseOrder) => {
    if (targetPO.status === 'received') {
      alert('This Purchase Order has already been received and stocked into inventory.');
      return;
    }

    if (onReceivePO) {
      onReceivePO(targetPO.id);
      return;
    }

    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const todayDate = nowStr.split(' ')[0];
    let newProductsCount = 0;
    let existingProductsUpdated = 0;
    let totalStockAddedValuation = 0;

    const updatedProductList = [...products];
    const newStockMovements: StockMovement[] = [];

    targetPO.items.forEach(item => {
      const itemQty = Number(item.quantity);
      const itemCost = Number(item.costPrice);
      totalStockAddedValuation += itemQty * itemCost;

      // Check if product already exists in current inventory
      const existingIndex = updatedProductList.findIndex(
        p => (item.productId && p.id === item.productId) || (item.sku && p.sku.toLowerCase() === item.sku.toLowerCase()) || p.name.toLowerCase() === item.productName.toLowerCase()
      );

      if (existingIndex >= 0) {
        // Update existing product
        const existing = updatedProductList[existingIndex];
        const prevStock = existing.stock;
        const newStock = prevStock + itemQty;

        // Weighted Average Cost calculation
        const updatedCost = Math.round(((prevStock * existing.cost) + (itemQty * itemCost)) / (newStock || 1));

        updatedProductList[existingIndex] = {
          ...existing,
          stock: newStock,
          cost: updatedCost > 0 ? updatedCost : itemCost,
          price: item.sellingPrice && item.sellingPrice > 0 ? item.sellingPrice : existing.price,
          batchNumber: item.batchNumber || existing.batchNumber,
          expiryDate: item.expiryDate || existing.expiryDate,
        };

        existingProductsUpdated++;

        // Log Stock Movement
        newStockMovements.push({
          id: `sm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          date: nowStr,
          productId: existing.id,
          productName: existing.name,
          sku: existing.sku,
          type: 'in_purchase',
          quantity: itemQty,
          previousStock: prevStock,
          newStock: newStock,
          unitCost: itemCost,
          totalValuation: itemQty * itemCost,
          referenceId: targetPO.poNumber,
          referenceType: 'PO',
          operatorName: 'Store Manager (1-Click Auto Stock)',
          notes: `Stock-In from PO ${targetPO.poNumber} (${targetPO.supplierName})`,
        });
      } else {
        // Brand NEW Product introduced in this PO -> Automatically create and register!
        const newProdId = `prod-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const meta = (item.metadata ?? {}) as Record<string, unknown>;
        const imageUrl =
          (typeof meta.image_url === 'string' && meta.image_url) ||
          (typeof meta.imageUrl === 'string' && meta.imageUrl) ||
          undefined;
        const vatType =
          (typeof meta.vat_type === 'string' && meta.vat_type) ||
          (typeof meta.vatType === 'string' && meta.vatType) ||
          undefined;
        const newProdObj: Product = {
          id: newProdId,
          name: item.productName,
          category: item.category || 'General',
          sku: item.sku || `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
          price: item.sellingPrice || Math.round(itemCost * 1.4),
          cost: itemCost,
          stock: itemQty,
          reorderPoint: Math.max(5, Math.round(itemQty * 0.25)),
          unit: item.unit || getDefaultUnit(businessType),
          batchNumber: showBatch ? (item.batchNumber || `BT-${new Date().getFullYear()}`) : undefined,
          expiryDate: showExpiry ? (item.expiryDate || '2028-12-31') : undefined,
          businessType,
          requiresPrescription: false,
          imageUrl,
          vatType,
        };

        updatedProductList.unshift(newProdObj);
        newProductsCount++;

        // Log Stock Movement
        newStockMovements.push({
          id: `sm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          date: nowStr,
          productId: newProdId,
          productName: newProdObj.name,
          sku: newProdObj.sku,
          type: 'in_purchase',
          quantity: itemQty,
          previousStock: 0,
          newStock: itemQty,
          unitCost: itemCost,
          totalValuation: itemQty * itemCost,
          referenceId: targetPO.poNumber,
          referenceType: 'PO',
          operatorName: 'Store Manager (1-Click Auto Stock)',
          notes: `Initial Stock Creation from PO ${targetPO.poNumber} (${targetPO.supplierName})`,
        });
      }
    });

    // 1. Commit updated product inventory
    setProducts(updatedProductList);

    // 2. Commit stock movements
    setStockMovements(prev => [...newStockMovements, ...prev]);

    // 3. Update Purchase Order Status to 'received'
    setPurchaseOrders(prev => prev.map(po => {
      if (po.id === targetPO.id) {
        return {
          ...po,
          status: 'received',
          receivedDate: nowStr,
          receivedBy: 'Storekeeper / Mwenye Duka',
        };
      }
      return po;
    }));

    // 4. Update Supplier Payable Balance if purchased on credit terms
    if (targetPO.paymentStatus === 'credit' || (targetPO.totalAmount - (targetPO.paidAmount || 0)) > 0) {
      const remainingUnpaid = targetPO.totalAmount - (targetPO.paidAmount || 0);
      setSuppliers(prev => prev.map(s => {
        if (s.id === targetPO.supplierId) {
          return {
            ...s,
            outstandingPayable: s.outstandingPayable + remainingUnpaid,
          };
        }
        return s;
      }));
    }

    // 5. Complete matching calendar delivery event if present
    if (setEvents) {
      setEvents(prev => prev.map(e => {
        if (e.category === 'delivery' && (e.title.includes(targetPO.poNumber) || e.description.includes(targetPO.poNumber))) {
          return { ...e, completed: true };
        }
        return e;
      }));
    }

    // Celebratory Confetti & Toast
    confetti({
      particleCount: 60,
      spread: 70,
      origin: { y: 0.7 },
    });

    triggerToast(
      language === 'sw' ? 'Stoo Imesasishwa Kikamilifu!' : 'Inventory Auto-Stocked Successfully!',
      language === 'sw' 
        ? `Bidhaa ${existingProductsUpdated} zimeongezwa stoo, bidhaa mpya ${newProductsCount} zimeundwa kiotomatiki. Thamani: ${formatTSh(totalStockAddedValuation)}.`
        : `${existingProductsUpdated} existing items restocked, ${newProductsCount} new SKUs created. Total valuation added: ${formatTSh(totalStockAddedValuation)}.`
    );
  };

  // Add Item to Current PO Form
  const handleAddItemToPO = () => {
    if (isAddingNewCustomItem) {
      if (!customItemForm.productName) {
        alert('Please enter a product name');
        return;
      }
      if (!customItemForm.unit?.trim()) {
        alert(isSw ? 'Chagua au andika kipimo' : 'Select or enter a unit');
        return;
      }

      const newItem: PurchaseOrderItem = {
        productName: customItemForm.productName,
        category: poCategorySel.displayPath || customItemForm.category,
        sku: customItemForm.sku,
        quantity: Number(customItemForm.quantity) || 1,
        costPrice: Number(customItemForm.costPrice) || 0,
        sellingPrice: Number(customItemForm.sellingPrice) || 0,
        unit: customItemForm.unit,
        batchNumber: showBatch ? customItemForm.batchNumber : undefined,
        expiryDate: showExpiry ? customItemForm.expiryDate : undefined,
        metadata: {
          ...(poDynamicFields.metadata || {}),
          vat_type: customItemForm.vatType || 'standard',
          ...(customItemForm.imageUrl ? { image_url: customItemForm.imageUrl } : {}),
        },
        taxId: resolveLineTaxIdForScope(poForm.purchaseVatScope, customItemForm.vatType || 'standard'),
        taxRate: 0,
        total: (Number(customItemForm.quantity) || 1) * (Number(customItemForm.costPrice) || 0),
        taxAmount: 0,
        isNewProduct: true,
      };

      setPoForm(prev => ({
        ...prev,
        items: [...prev.items, normalizePurchaseOrderItem(newItem)],
      }));

      setCustomItemForm(buildCustomItemDefaults(businessType, lang));
      setPoCategorySel({ main: defaultCategory, displayPath: defaultCategory });
      setPoDynamicFields({ metadata: {} });
      setIsAddingNewCustomItem(false);
    } else {
      const selectedProd = products.find(p => p.id === selectedExistingProdId);
      if (!selectedProd) return;

      const newItem: PurchaseOrderItem = {
        productId: selectedProd.id,
        productName: selectedProd.name,
        category: selectedProd.category,
        sku: selectedProd.sku,
        quantity: 20,
        costPrice: selectedProd.cost,
        sellingPrice: selectedProd.price,
        unit: selectedProd.unit,
        batchNumber: showBatch ? `BT-${new Date().getFullYear()}-${Math.floor(10 + Math.random() * 90)}` : undefined,
        expiryDate: showExpiry ? (selectedProd.expiryDate || '2028-12-31') : undefined,
        metadata: selectedProd.vatType ? { vat_type: selectedProd.vatType } : undefined,
        taxId: resolveLineTaxIdForScope(poForm.purchaseVatScope, selectedProd.vatType),
        taxRate: 0,
        total: selectedProd.cost * 20,
        taxAmount: 0,
        isNewProduct: false,
      };

      setPoForm(prev => ({
        ...prev,
        items: [...prev.items, normalizePurchaseOrderItem(newItem)],
      }));
    }
  };

  // Remove item from PO form
  const handleRemovePOItem = (index: number) => {
    setPoForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  // Save / Send New Purchase Order
  const handleSavePO = async (asStatus: 'draft' | 'sent') => {
    if (poForm.items.length === 0) {
      alert('Please add at least one line item to the purchase order.');
      return;
    }

    const targetSupplier = suppliers.find(s => s.id === poForm.supplierId) || suppliers[0];
    if (!targetSupplier) return;

    const normalizedItems = poForm.items.map(normalizePurchaseOrderItem);
    const totals = computePurchaseOrderTotals(normalizedItems);

    try {
      const raw = await api.createPurchaseOrder({
        supplier_id: targetSupplier.id,
        vendor_reference: poForm.vendorReference || undefined,
        currency: poForm.currency,
        order_deadline: poForm.orderDeadline,
        deliver_to: poForm.deliverTo,
        ask_confirmation: poForm.askConfirmation,
        fiscal_position: poForm.fiscalPosition,
        payment_terms: poForm.paymentTerms,
        items: normalizedItems.map(item => ({
          product_id: item.productId,
          product_name: item.productName,
          quantity: item.quantity,
          unit_cost: item.costPrice,
          selling_price: item.sellingPrice && item.sellingPrice > 0 ? item.sellingPrice : undefined,
          total: item.total,
          tax_id: item.taxId ?? 'none',
          tax_rate: item.taxRate ?? 0,
          tax_amount: item.taxAmount ?? 0,
          batch_number: item.batchNumber,
          expiry_date: optionalApiDate(item.expiryDate),
        })),
        subtotal: totals.subtotal,
        vat_amount: totals.vatAmount,
        total_amount: totals.totalAmount,
        notes: [poForm.notes, poForm.vatNote ? `VAT: ${poForm.vatNote}` : ''].filter(Boolean).join('\n'),
        purchase_vat_scope: poForm.purchaseVatScope,
        vat_note: poForm.vatNote || undefined,
        expected_date: poForm.expectedDate,
      });
      const newPO: PurchaseOrder = {
        ...mapPurchaseOrder(raw as Record<string, unknown>),
        status: asStatus,
        items: normalizedItems,
        subtotal: totals.subtotal,
        vatAmount: totals.vatAmount,
        purchaseVatScope: poForm.purchaseVatScope,
        vatNote: poForm.vatNote || undefined,
        totalAmount: totals.totalAmount,
        vendorReference: poForm.vendorReference,
        currency: poForm.currency,
        orderDeadline: poForm.orderDeadline,
        deliverTo: poForm.deliverTo,
        askConfirmation: poForm.askConfirmation,
        fiscalPosition: poForm.fiscalPosition,
        paymentTerms: poForm.paymentTerms,
        paymentStatus: poForm.paymentStatus,
        notes: poForm.notes,
        expectedDate: poForm.expectedDate,
      };
      setPurchaseOrders(prev => [newPO, ...prev]);

      if (setEvents && asStatus === 'sent') {
        try {
          const evRaw = await api.createCalendarEvent(eventToApiPayload({
            title: `Supplier Delivery: ${targetSupplier.name} (${newPO.poNumber})`,
            category: 'delivery',
            date: poForm.expectedDate,
            time: '10:30',
            priority: 'high',
            description: `Expected delivery of ${poForm.items.length} items.`,
            assignedTo: 'Storekeeper',
          }));
          setEvents(prev => [mapEvent(evRaw as Record<string, unknown>), ...prev]);
        } catch { /* optional calendar sync */ }
      }

      setIsCreatingPO(false);
      triggerToast(
        language === 'sw' ? 'Agizo la Bidhaa Limeundwa!' : 'Purchase Order Created!',
        `PO ${newPO.poNumber} for ${targetSupplier.name} saved to server.`
      );
    } catch (err) {
      alert((err as Error).message);
    }
  };

  // Add Supplier
  const handleSaveNewSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplier.name) return;

    try {
      const raw = await api.createSupplier(supplierToApiPayload({
        name: newSupplier.name,
        contactPerson: newSupplier.contactPerson || 'Sales Representative',
        phone: newSupplier.phone,
        email: newSupplier.email,
        category: newSupplier.category,
        paymentTerms: newSupplier.paymentTerms,
        leadTimeDays: Number(newSupplier.leadTimeDays) || 2,
        rating: Number(newSupplier.rating) || 4.8,
      }));
      const createdSupplier = mapSupplier(raw as Record<string, unknown>);
      setSuppliers(prev => [createdSupplier, ...prev]);
      setIsAddingSupplier(false);
      setSelectedSupplierId(createdSupplier.id);
      triggerToast(
        language === 'sw' ? 'Msambazaji Amesajiliwa' : 'Supplier Registered',
        `${createdSupplier.name} added to your supplier database.`
      );
    } catch (err) {
      alert((err as Error).message);
    }
  };

  // Record Payment to Supplier
  const handleSavePayment = (e: React.FormEvent) => {
    e.preventDefault();
    const sup = suppliers.find(s => s.id === paymentForm.supplierId);
    if (!sup) return;

    const amt = Number(paymentForm.amount);
    const balanceBefore = sup.outstandingPayable;
    const balanceAfter = Math.max(0, balanceBefore - amt);

    const paymentRecord: SupplierPayment = {
      id: `sp-${Date.now()}`,
      supplierId: sup.id,
      supplierName: sup.name,
      date: new Date().toISOString().replace('T', ' ').substring(0, 16),
      amount: amt,
      paymentMethod: paymentForm.paymentMethod,
      referenceNumber: paymentForm.referenceNumber,
      notes: paymentForm.notes,
      balanceBefore,
      balanceAfter,
    };

    if (setSupplierPayments) {
      setSupplierPayments(prev => [paymentRecord, ...prev]);
    }

    // update supplier payable
    setSuppliers(prev => prev.map(s => {
      if (s.id === sup.id) {
        return { ...s, outstandingPayable: balanceAfter };
      }
      return s;
    }));

    setIsRecordingPayment(false);
    triggerToast(
      language === 'sw' ? 'Malipo Yamerekodiwa' : 'Payment Recorded',
      `${formatTSh(amt)} paid to ${sup.name}. New ledger balance: ${formatTSh(balanceAfter)}.`
    );
  };

  // Filtered lists
  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredPOs = branchPurchaseOrders.filter(po => {
    const matchesSearch = po.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      po.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      po.items.some(i => i.productName.toLowerCase().includes(searchQuery.toLowerCase()));
    
    if (orderStatusFilter === 'all') return matchesSearch;
    return matchesSearch && po.status === orderStatusFilter;
  });

  const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId) || suppliers[0];

  // Total calculations
  const totalPayables = suppliers.reduce((sum, s) => sum + s.outstandingPayable, 0);
  const pendingDeliveryCount = branchPurchaseOrders.filter(po => po.status === 'sent').length;
  const receivedOrdersCount = branchPurchaseOrders.filter(po => po.status === 'received').length;

  return (
    <div className="space-y-6 pb-16">
      {/* Toast Notification */}
      {successToast && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 shadow-sm flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-xs">{successToast.title}</div>
            <div className="text-[11px] text-emerald-700 mt-0.5">{successToast.desc}</div>
          </div>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-[#323130] tracking-tight">{t('suppliers')} & {t('purchaseOrders')}</h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#6264A7]/10 text-[#6264A7] border border-[#6264A7]/20">
              Connected Hub
            </span>
          </div>
          <p className="text-xs text-[#605E5C] mt-0.5">
            1-Click Automated Inward Stocking • Dynamic PO Builder • Live Inventory & Payables Sync
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-create-po-top"
            onClick={() => setIsCreatingPO(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#6264A7] hover:bg-[#555793] text-white text-xs font-semibold shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            <PackagePlus className="w-4 h-4" />
            <span>{isSw ? 'Ombi la Nukuu Bei (RFQ)' : 'Request for Quotation'}</span>
          </button>

          <button
            onClick={() => setIsAddingSupplier(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white hover:bg-[#F3F2F1] text-[#323130] text-xs font-semibold border border-[#E1DFDD] transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#0078D4]" />
            <span>Add Supplier</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-[#E1DFDD] shadow-xs">
          <div className="text-xs font-medium text-[#605E5C]">Total Accounts Payable</div>
          <div className="text-xl font-extrabold text-[#D13438] mt-1">{formatTSh(totalPayables)}</div>
          <div className="text-[11px] text-[#605E5C] mt-1 flex items-center justify-between">
            <span>Across {suppliers.length} suppliers</span>
            <button 
              onClick={() => setIsRecordingPayment(true)}
              className="text-[#0078D4] font-bold hover:underline cursor-pointer"
            >
              Pay Now →
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-[#E1DFDD] shadow-xs">
          <div className="text-xs font-medium text-[#605E5C]">Pending Deliveries</div>
          <div className="text-xl font-extrabold text-amber-600 mt-1">{pendingDeliveryCount} Orders</div>
          <div className="text-[11px] text-[#605E5C] mt-1">Ready for 1-Click Stock-In</div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-[#E1DFDD] shadow-xs">
          <div className="text-xs font-medium text-[#605E5C]">Received & Stocked</div>
          <div className="text-xl font-extrabold text-[#107C10] mt-1">{receivedOrdersCount} Fulfilled</div>
          <div className="text-[11px] text-[#107C10] font-semibold mt-1">✓ Verified in Inventory</div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-[#E1DFDD] shadow-xs">
          <div className="text-xs font-medium text-[#605E5C]">Avg Delivery Lead Time</div>
          <div className="text-xl font-extrabold text-[#6264A7] mt-1">1.8 Days</div>
          <div className="text-[11px] text-[#107C10] font-semibold mt-1">Dar es Salaam region fast-dispatch</div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[#EDEBE9] pb-2">
        <button
          onClick={() => setActiveSubTab('orders')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'orders'
              ? 'bg-[#6264A7] text-white shadow-xs'
              : 'bg-white text-[#605E5C] hover:bg-[#F3F2F1] border border-[#E1DFDD]'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>{t('purchaseOrders')} ({branchPurchaseOrders.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('suppliers')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'suppliers'
              ? 'bg-[#6264A7] text-white shadow-xs'
              : 'bg-white text-[#605E5C] hover:bg-[#F3F2F1] border border-[#E1DFDD]'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Suppliers Directory ({suppliers.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('payments')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'payments'
              ? 'bg-[#6264A7] text-white shadow-xs'
              : 'bg-white text-[#605E5C] hover:bg-[#F3F2F1] border border-[#E1DFDD]'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Supplier Payables & Payments ({supplierPayments.length})</span>
        </button>
      </div>

      {/* ACTION BAR */}
      <ActionBar
        language={language}
        onAdd={() => {
          if (activeSubTab === 'orders') setIsCreatingPO(true);
          else if (activeSubTab === 'suppliers') setIsAddingSupplier(true);
          else setIsRecordingPayment(true);
        }}
        onAISuggest={() => {
          if (onOpenAIChatWithPrompt) {
            onOpenAIChatWithPrompt('Toa uchambuzi wa bei za wasambazaji, muda wa kuagiza bidhaa za dawa, na utengeneze orodha ya agizo jipya la ununuzi kulingana na bidhaa zilizopungua stoo.');
          }
        }}
        onExport={handleExportProcurement}
        customAddLabel={activeSubTab === 'orders' ? '➕ Create PO' : activeSubTab === 'suppliers' ? '➕ Add Supplier' : '➕ Record Payment'}
        selectedCount={selectedPO ? 1 : 0}
        totalCount={activeSubTab === 'orders' ? branchPurchaseOrders.length : suppliers.length}
      />

      {/* ================= TAB 1: PURCHASE ORDERS (CORE WORKFLOW) ================= */}
      {activeSubTab === 'orders' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white rounded-xl p-3 border border-[#E1DFDD] shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[260px] max-w-md">
              <Search className="w-4 h-4 text-[#605E5C] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search PO #, supplier name, or item..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 text-xs bg-[#F3F2F1] border border-transparent focus:border-[#0078D4] focus:bg-white rounded-lg outline-none"
              />
            </div>

            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <button
                onClick={() => setOrderStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  orderStatusFilter === 'all' ? 'bg-[#6264A7] text-white' : 'bg-[#F3F2F1] text-[#605E5C]'
                }`}
              >
                All POs ({branchPurchaseOrders.length})
              </button>
              <button
                onClick={() => setOrderStatusFilter('sent')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  orderStatusFilter === 'sent' ? 'bg-amber-600 text-white' : 'bg-[#F3F2F1] text-[#605E5C]'
                }`}
              >
                ⏳ Pending Delivery ({branchPurchaseOrders.filter(p => p.status === 'sent').length})
              </button>
              <button
                onClick={() => setOrderStatusFilter('received')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  orderStatusFilter === 'received' ? 'bg-[#107C10] text-white' : 'bg-[#F3F2F1] text-[#605E5C]'
                }`}
              >
                ✓ Received & Stocked ({branchPurchaseOrders.filter(p => p.status === 'received').length})
              </button>
              <button
                onClick={() => setOrderStatusFilter('draft')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  orderStatusFilter === 'draft' ? 'bg-[#605E5C] text-white' : 'bg-[#F3F2F1] text-[#605E5C]'
                }`}
              >
                Drafts ({branchPurchaseOrders.filter(p => p.status === 'draft').length})
              </button>
            </div>
          </div>

          {/* Orders Table */}
          <div className="bg-white rounded-xl border border-[#E1DFDD] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8F8F8] border-b border-[#EDEBE9] text-[#605E5C] font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">PO Number & Date</th>
                    <th className="py-3 px-3">Supplier Partner</th>
                    <th className="py-3 px-3">Items Ordered</th>
                    <th className="py-3 px-3">Expected Delivery</th>
                    <th className="py-3 px-3">Total Amount</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F2F1]">
                  {filteredPOs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-xs text-[#605E5C]">
                        No purchase orders found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredPOs.map(po => {
                      const isPending = po.status === 'sent' || po.status === 'draft' || (po.status as string) === 'pending';
                      const isReceived = po.status === 'received' || po.status === 'partially_received';

                      return (
                        <tr 
                          key={po.id}
                          className="hover:bg-[#FAF9F8] transition-colors"
                        >
                          <td className="py-3 px-4">
                            <div className="font-bold text-[#0078D4] font-mono">{po.poNumber}</div>
                            <div className="text-[10px] text-[#605E5C]">{po.dateCreated}</div>
                          </td>

                          <td className="py-3 px-3">
                            <div className="font-bold text-[#323130]">{po.supplierName}</div>
                            <div className="text-[10px] text-[#605E5C]">{po.paymentTerms}</div>
                          </td>

                          <td className="py-3 px-3">
                            <div className="font-semibold text-[#323130]">
                              {po.items.length} line items ({po.items.reduce((s, i) => s + i.quantity, 0)} units)
                            </div>
                            <div className="text-[10px] text-[#605E5C] truncate max-w-[200px]">
                              {po.items.map(i => i.productName).join(', ')}
                            </div>
                          </td>

                          <td className="py-3 px-3 font-mono">
                            <div className="text-[#323130] font-medium">{po.expectedDate}</div>
                            {isReceived && (
                              <div className="text-[10px] text-[#107C10] font-semibold flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-[#107C10]" /> Received on {po.receivedDate?.split(' ')[0]}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-3">
                            <div className="font-extrabold text-[#323130]">{formatTSh(po.totalAmount)}</div>
                            <div className="text-[10px] text-[#605E5C]">
                              {po.paymentStatus === 'paid' ? '✓ Paid in Full' : 'Unsettled Credit'}
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isReceived
                                ? 'bg-[#107C10]/10 text-[#107C10] border border-[#107C10]/30'
                                : isPending
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : 'bg-[#EDEBE9] text-[#605E5C]'
                            }`}>
                              {isReceived ? '✓ Stocked in Inventory' : isPending ? '⏳ Awaiting Delivery' : 'Draft'}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {/* 1-CLICK RECEIVE & STOCK-IN BUTTON */}
                              {isPending && (
                                <>
                                <button
                                  id={`btn-receive-po-${po.id}`}
                                  onClick={() => handleExecuteReceivePO(po)}
                                  className="px-3 py-1.5 rounded-lg bg-[#107C10] hover:bg-[#0E6A0E] text-white font-bold text-xs flex items-center gap-1 shadow-xs transition-all active:scale-95 cursor-pointer"
                                  title="1-Click Automatic Stock-In & Inventory Update"
                                >
                                  <PackagePlus className="w-3.5 h-3.5" />
                                  <span>Receive & Stock In</span>
                                </button>
                                <button
                                  onClick={() => handleCancelPO(po)}
                                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-rose-50 text-rose-700 font-bold text-xs border border-rose-200 transition-all cursor-pointer"
                                  title="Reject order — no stock added"
                                >
                                  Reject
                                </button>
                                </>
                              )}

                              <button
                                onClick={() => {
                                  setSelectedPO(po);
                                  setIsViewGRNModalOpen(true);
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-[#F3F2F1] hover:bg-[#EDEBE9] text-[#323130] font-semibold text-xs transition-colors cursor-pointer"
                                title="View Goods Received Note & Invoice"
                              >
                                <FileText className="w-3.5 h-3.5 text-[#6264A7]" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 2: SUPPLIERS DIRECTORY ================= */}
      {activeSubTab === 'suppliers' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-[#605E5C] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search supplier name or category..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-[#E1DFDD] rounded-xl outline-none"
              />
            </div>

            <div className="space-y-3">
              {filteredSuppliers.map(sup => {
                const isSelected = sup.id === selectedSupplierId;
                return (
                  <div
                    key={sup.id}
                    onClick={() => setSelectedSupplierId(sup.id)}
                    className={`p-4 bg-white rounded-xl border transition-all cursor-pointer ${
                      isSelected ? 'border-[#6264A7] ring-1 ring-[#6264A7] shadow-xs' : 'border-[#E1DFDD] hover:border-[#C8C6C4]'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#6264A7]/10 text-[#6264A7] flex items-center justify-center font-bold">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-[#323130]">{sup.name}</h4>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-0.5">
                              <Star className="w-3 h-3 fill-emerald-600 text-emerald-600" /> {sup.rating}
                            </span>
                          </div>
                          <p className="text-xs text-[#605E5C]">{sup.category} • {sup.contactPerson}</p>
                        </div>
                      </div>

                      <div className="text-right text-xs">
                        <div className="font-semibold text-[#605E5C]">Payable Balance</div>
                        <div className="font-extrabold text-[#D13438]">{formatTSh(sup.outstandingPayable)}</div>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-[#F3F2F1] flex flex-wrap items-center justify-between text-xs text-[#605E5C] gap-2">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5 text-[#0078D4]" /> {sup.phone}</span>
                        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-amber-600" /> {sup.leadTimeDays} days lead time</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold px-2 py-0.5 rounded bg-[#F3F2F1] text-[#323130]">{sup.paymentTerms}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPoForm(prev => ({ ...prev, supplierId: sup.id }));
                            setIsCreatingPO(true);
                          }}
                          className="px-2.5 py-1 rounded bg-[#6264A7] text-white font-bold text-[11px] hover:bg-[#555793] cursor-pointer"
                        >
                          + Order
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Supplier Details Panel */}
          <div>
            {selectedSupplier && (
              <div className="bg-white rounded-xl border border-[#E1DFDD] p-5 shadow-xs space-y-4 sticky top-4">
                <div className="border-b border-[#F3F2F1] pb-3">
                  <span className="text-[10px] uppercase font-bold text-[#6264A7]">Selected Partner Profile</span>
                  <h3 className="text-base font-bold text-[#323130] mt-0.5">{selectedSupplier.name}</h3>
                  <p className="text-xs text-[#605E5C]">{selectedSupplier.contactPerson} • {selectedSupplier.email}</p>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between p-2.5 rounded bg-[#FAF9F8]">
                    <span className="text-[#605E5C]">Payment Terms:</span>
                    <span className="font-bold text-[#323130]">{selectedSupplier.paymentTerms}</span>
                  </div>
                  <div className="flex justify-between p-2.5 rounded bg-[#FAF9F8]">
                    <span className="text-[#605E5C]">Lead Time:</span>
                    <span className="font-bold text-[#323130]">{selectedSupplier.leadTimeDays} Business Days</span>
                  </div>
                  <div className="flex justify-between p-2.5 rounded bg-[#FAF9F8]">
                    <span className="text-[#605E5C]">Total Outstanding Debt:</span>
                    <span className="font-bold text-[#D13438]">{formatTSh(selectedSupplier.outstandingPayable)}</span>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <button
                    onClick={() => {
                      setPoForm(prev => ({ ...prev, supplierId: selectedSupplier.id }));
                      setIsCreatingPO(true);
                    }}
                    className="w-full py-2.5 rounded-xl bg-[#6264A7] hover:bg-[#555793] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                  >
                    <PackagePlus className="w-4 h-4" />
                    <span>Create Purchase Order</span>
                  </button>

                  <button
                    onClick={() => {
                      setPaymentForm(prev => ({ ...prev, supplierId: selectedSupplier.id }));
                      setIsRecordingPayment(true);
                    }}
                    className="w-full py-2.5 rounded-xl bg-white hover:bg-[#F3F2F1] text-[#323130] border border-[#E1DFDD] font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <CreditCard className="w-4 h-4 text-[#0078D4]" />
                    <span>Record Payment Settlement</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= TAB 3: SUPPLIER PAYMENTS & PAYABLES LEDGER ================= */}
      {activeSubTab === 'payments' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-[#E1DFDD] shadow-xs">
            <div>
              <h3 className="font-bold text-sm text-[#323130]">Supplier Settlement History & Outward Payments</h3>
              <p className="text-xs text-[#605E5C]">Tracks Bank Transfers, M-Pesa, and Cash remittances to distributors</p>
            </div>
            <button
              onClick={() => setIsRecordingPayment(true)}
              className="px-4 py-2 rounded-lg bg-[#6264A7] text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Record New Payment</span>
            </button>
          </div>

          <div className="bg-white rounded-xl border border-[#E1DFDD] shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8F8F8] border-b border-[#EDEBE9] text-[#605E5C] font-bold uppercase">
                <tr>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-3">Supplier Name</th>
                  <th className="py-3 px-3">Payment Method</th>
                  <th className="py-3 px-3">Reference / Txn ID</th>
                  <th className="py-3 px-3">Amount Paid</th>
                  <th className="py-3 px-3">Balance After</th>
                  <th className="py-3 px-4">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F2F1]">
                {supplierPayments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-xs text-[#605E5C]">
                      No supplier payments recorded yet.
                    </td>
                  </tr>
                ) : (
                  supplierPayments.map(sp => (
                    <tr key={sp.id} className="hover:bg-[#FAF9F8]">
                      <td className="py-3 px-4 font-mono text-[#605E5C]">{sp.date}</td>
                      <td className="py-3 px-3 font-bold text-[#323130]">{sp.supplierName}</td>
                      <td className="py-3 px-3 font-semibold text-[#0078D4]">{sp.paymentMethod}</td>
                      <td className="py-3 px-3 font-mono text-[#605E5C]">{sp.referenceNumber}</td>
                      <td className="py-3 px-3 font-extrabold text-[#107C10]">{formatTSh(sp.amount)}</td>
                      <td className="py-3 px-3 font-mono text-[#D13438]">{formatTSh(sp.balanceAfter)}</td>
                      <td className="py-3 px-4 text-[#605E5C]">{sp.notes || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= MODAL 1: INTERACTIVE PURCHASE ORDER CREATOR ================= */}
      {isCreatingPO && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full border border-[#E1DFDD] shadow-2xl p-6 space-y-4 my-8">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b border-[#EDEBE9] pb-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-[#E65100]">
                  {isSw ? 'Ombi la Nukuu Bei' : 'Request for Quotation'}
                </div>
                <h3 className="text-lg font-bold text-[#323130]">
                  {isSw ? 'Ombi Jipya la Nunua' : 'New RFQ / Purchase Request'}
                </h3>
                <p className="text-[11px] text-[#605E5C] mt-0.5">
                  {isSw
                    ? 'Bei za kipimo ni bila kodi. Chagua kodi kwa kila mstari ikiwa inahitajika.'
                    : 'Unit prices are untaxed by default. Apply tax per line when needed.'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-1 text-[10px] font-bold">
                  <span className="px-2 py-1 rounded-full bg-[#E65100] text-white">RFQ</span>
                  <ChevronRight className="w-3 h-3 text-[#605E5C]" />
                  <span className="px-2 py-1 rounded-full bg-[#F3F2F1] text-[#605E5C]">{isSw ? 'Imetumwa' : 'RFQ Sent'}</span>
                  <ChevronRight className="w-3 h-3 text-[#605E5C]" />
                  <span className="px-2 py-1 rounded-full bg-[#F3F2F1] text-[#605E5C]">{isSw ? 'Agizo' : 'PO'}</span>
                </div>
                <button onClick={() => setIsCreatingPO(false)} className="text-[#605E5C] hover:text-black p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-[#323130] mb-1">{isSw ? 'Msambazaji *' : 'Vendor *'}</label>
                <select
                  value={poForm.supplierId}
                  onChange={e => setPoForm({ ...poForm, supplierId: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F3F2F1] border border-[#EDEBE9] rounded-lg font-medium outline-none focus:bg-white focus:border-[#0078D4]"
                >
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.paymentTerms})</option>
                  ))}
                </select>
                <p className="text-[10px] text-[#605E5C] mt-1">{isSw ? 'Jina, TIN, barua pepe, au rejea' : 'Name, TIN, email, or reference'}</p>
              </div>
              <div>
                <label className="block font-bold text-[#323130] mb-1">{isSw ? 'Rejea ya Msambazaji' : 'Vendor Reference'}</label>
                <input
                  type="text"
                  value={poForm.vendorReference}
                  onChange={e => setPoForm({ ...poForm, vendorReference: e.target.value })}
                  placeholder={isSw ? 'Nambari ya ankara ya msambazaji' : 'Supplier quote / invoice ref'}
                  className="w-full px-3 py-2 bg-[#F3F2F1] border border-[#EDEBE9] rounded-lg font-medium outline-none focus:bg-white focus:border-[#0078D4]"
                />
              </div>
              <div>
                <label className="block font-bold text-[#323130] mb-1">{isSw ? 'Sarafu' : 'Currency'}</label>
                <select
                  value={poForm.currency}
                  onChange={e => setPoForm({ ...poForm, currency: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F3F2F1] border border-[#EDEBE9] rounded-lg font-medium outline-none focus:bg-white focus:border-[#0078D4]"
                >
                  <option value="TZS">TZS</option>
                  <option value="USD">USD</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-[#323130] mb-1">{isSw ? 'Muda wa Agizo' : 'Order Deadline'}</label>
                <input
                  type="datetime-local"
                  value={poForm.orderDeadline}
                  onChange={e => setPoForm({ ...poForm, orderDeadline: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F3F2F1] border border-[#EDEBE9] rounded-lg font-medium outline-none focus:bg-white focus:border-[#0078D4]"
                />
              </div>
              <div>
                <label className="block font-bold text-[#323130] mb-1">{isSw ? 'Tarehe Inayotarajiwa' : 'Expected Arrival'}</label>
                <input
                  type="date"
                  value={poForm.expectedDate}
                  onChange={e => setPoForm({ ...poForm, expectedDate: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F3F2F1] border border-[#EDEBE9] rounded-lg font-medium outline-none focus:bg-white focus:border-[#0078D4]"
                />
                <label className="flex items-center gap-2 mt-2 text-[11px] font-semibold text-[#323130]">
                  <input
                    type="checkbox"
                    checked={poForm.askConfirmation}
                    onChange={e => setPoForm({ ...poForm, askConfirmation: e.target.checked })}
                  />
                  {isSw ? 'Omba uthibitisho' : 'Ask confirmation'}
                </label>
              </div>
              <div>
                <label className="block font-bold text-[#323130] mb-1">{isSw ? 'Wasilisha Kwa' : 'Deliver To'}</label>
                <input
                  type="text"
                  value={poForm.deliverTo}
                  onChange={e => setPoForm({ ...poForm, deliverTo: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F3F2F1] border border-[#EDEBE9] rounded-lg font-medium outline-none focus:bg-white focus:border-[#0078D4]"
                />
              </div>
            </div>

            <div className="flex gap-2 border-b border-[#EDEBE9]">
              {(['products', 'other'] as const).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setPoForm({ ...poForm, poTab: tab })}
                  className={`px-4 py-2 text-xs font-bold border-b-2 -mb-px ${
                    poForm.poTab === tab
                      ? 'border-[#E65100] text-[#E65100]'
                      : 'border-transparent text-[#605E5C] hover:text-[#323130]'
                  }`}
                >
                  {tab === 'products'
                    ? isSw ? 'Bidhaa' : 'Products'
                    : isSw ? 'Taarifa Nyingine' : 'Other Information'}
                </button>
              ))}
            </div>

            {poForm.poTab === 'other' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs p-4 bg-[#FAF9F8] rounded-xl border border-[#EDEBE9]">
                <div>
                  <label className="block font-bold text-[#323130] mb-1">{isSw ? 'Masharti ya Malipo' : 'Payment Terms'}</label>
                  <select
                    value={poForm.paymentTerms}
                    onChange={e => setPoForm({ ...poForm, paymentTerms: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-[#EDEBE9] rounded-lg"
                  >
                    <option value="Immediate Payment">{isSw ? 'Malipo ya Papo Hapo' : 'Immediate Payment'}</option>
                    <option value="Net 15 Days">Net 15 Days</option>
                    <option value="Net 30 Days">Net 30 Days</option>
                    <option value="Net 60 Days">Net 60 Days</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-[#323130] mb-1">{isSw ? 'Nafasi ya Kodi' : 'Fiscal Position'}</label>
                  <select
                    value={poForm.fiscalPosition}
                    onChange={e => setPoForm({ ...poForm, fiscalPosition: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-[#EDEBE9] rounded-lg"
                  >
                    <option value="local">{isSw ? 'Ndani ya Tanzania (Kodi ya Kawaida)' : 'Domestic (Standard Tax)'}</option>
                    <option value="exempt">{isSw ? 'Msamaha wa Kodi' : 'Tax Exempt'}</option>
                    <option value="import">{isSw ? 'Import / Nje ya Nchi' : 'Import / Foreign'}</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-[#323130] mb-1">{isSw ? 'Hali ya Malipo' : 'Payment Status'}</label>
                  <select
                    value={poForm.paymentStatus}
                    onChange={e => setPoForm({ ...poForm, paymentStatus: e.target.value as 'paid' | 'credit' | 'partial' })}
                    className="w-full px-3 py-2 bg-white border border-[#EDEBE9] rounded-lg"
                  >
                    <option value="credit">{isSw ? 'Mkopo wa Msambazaji' : 'Supplier Credit'}</option>
                    <option value="paid">{isSw ? 'Imelipwa Mapema' : 'Paid Upfront'}</option>
                    <option value="partial">{isSw ? 'Malipo ya Sehemu' : 'Partial Payment'}</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block font-bold text-[#323130] mb-1">{isSw ? 'Masharti & Maelezo' : 'Terms & Conditions'}</label>
                  <textarea
                    value={poForm.notes}
                    onChange={e => setPoForm({ ...poForm, notes: e.target.value })}
                    rows={3}
                    placeholder={isSw ? 'Fafanua masharti yako…' : 'Define your terms and conditions…'}
                    className="w-full px-3 py-2 bg-white border border-[#EDEBE9] rounded-lg resize-none"
                  />
                </div>
              </div>
            )}

            {poForm.poTab === 'products' && (
            <>
            <div className="p-4 rounded-xl border border-[#E65100]/30 bg-orange-50/50 space-y-3">
                <div className="flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#E65100] mt-0.5 shrink-0" />
                  <div>
                    <div className="text-xs font-bold text-[#323130]">
                      {isSw ? 'VAT 18% kwenye ununuzi (TRA)' : 'Purchase VAT 18% (TRA)'}
                    </div>
                    <p className="text-[10px] text-[#605E5C] mt-0.5">
                      {purchaseVatAvailable
                        ? (isSw
                          ? 'Chagua kutumia VAT kwenye mistari yote au bidhaa zilizowekwa VAT tu — kisha unaweza bado kubadilisha kwa mstari.'
                          : 'Apply VAT to all lines or only VAT-class products — you can still override each line.')
                        : (isSw
                          ? 'Washa hali ya VAT au TRA EFD kwenye Usanidi (TRA & EFD) ili kuwezesha chaguo hizi.'
                          : 'Enable VAT or TRA EFD in Setup (TRA & EFD) to activate these options.')}
                    </p>
                  </div>
                </div>
                <div className={`grid grid-cols-1 sm:grid-cols-3 gap-2 ${!purchaseVatAvailable ? 'opacity-50' : ''}`}>
                  {(['none', 'all', 'vat_products'] as PurchaseVatScope[]).map(scope => (
                    <button
                      key={scope}
                      type="button"
                      disabled={!purchaseVatAvailable}
                      onClick={() => {
                        setPoForm(prev => ({
                          ...prev,
                          purchaseVatScope: scope,
                          items: applyPurchaseVatScopeToItems(prev.items, scope, products),
                        }));
                      }}
                      className={`px-3 py-2 rounded-lg text-[11px] font-bold text-left border transition-all cursor-pointer disabled:cursor-not-allowed ${
                        poForm.purchaseVatScope === scope
                          ? 'border-[#E65100] bg-white text-[#E65100] ring-1 ring-[#E65100]/30'
                          : 'border-[#EDEBE9] bg-white text-[#605E5C] hover:border-[#C8C6C4]'
                      }`}
                    >
                      {purchaseVatScopeLabel(scope, isSw)}
                    </button>
                  ))}
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#605E5C] mb-1">
                    {isSw ? 'Kumbuka ya VAT / TRA' : 'VAT / TRA note'}
                  </label>
                  <input
                    type="text"
                    value={poForm.vatNote}
                    onChange={e => setPoForm({ ...poForm, vatNote: e.target.value })}
                    disabled={!purchaseVatAvailable}
                    placeholder={
                      taxSettings.purchaseVatNote ||
                      (isSw ? 'mf. Bei bila VAT; VAT 18% inaongezwa' : 'e.g. Prices excl. VAT; VAT 18% added')
                    }
                    className="w-full px-3 py-2 bg-white border border-[#EDEBE9] rounded-lg text-xs disabled:opacity-50"
                  />
                </div>
              </div>

            {/* Add Line Item Box */}
            <div className="p-4 bg-[#F8F8F8] rounded-xl border border-[#EDEBE9] space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-[#323130]">Add Item to Order</span>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setIsAddingNewCustomItem(false)}
                    className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                      !isAddingNewCustomItem ? 'bg-[#6264A7] text-white shadow-xs' : 'bg-[#EDEBE9] text-[#605E5C]'
                    }`}
                  >
                    Select Existing Product
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddingNewCustomItem(true)}
                    className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                      isAddingNewCustomItem ? 'bg-[#0078D4] text-white shadow-xs' : 'bg-[#EDEBE9] text-[#605E5C]'
                    }`}
                  >
                    ✨ Introduce New Product
                  </button>
                </div>
              </div>

              {!isAddingNewCustomItem ? (
                <div className="flex flex-wrap items-end gap-3 text-xs">
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-[11px] font-semibold text-[#605E5C] mb-1">Product from Inventory</label>
                    <select
                      value={selectedExistingProdId}
                      onChange={e => setSelectedExistingProdId(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-[#C8C6C4] rounded-lg outline-none"
                    >
                      {products.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} (Current Stock: {p.stock} | Cost: {formatTSh(p.cost)})
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddItemToPO}
                    className="px-4 py-1.5 bg-[#6264A7] text-white font-bold rounded-lg hover:bg-[#555793] cursor-pointer"
                  >
                    + Add Line
                  </button>
                </div>
              ) : (
                <div className="space-y-3 text-xs">
                  <div className="p-3 rounded-xl border-2 border-dashed border-[#6264A7]/40 bg-white">
                    <label className="block text-[11px] font-bold text-[#323130] mb-2">
                      {isSw ? 'Picha ya Bidhaa' : 'Product Photo'}
                    </label>
                    <ProductImageUploader
                      value={customItemForm.imageUrl || undefined}
                      onChange={url => setCustomItemForm(prev => ({ ...prev, imageUrl: url || '' }))}
                      isSw={isSw}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#605E5C] mb-1">
                        {isSw ? 'Jina la Bidhaa *' : 'New Product Name *'}
                      </label>
                      <input
                        type="text"
                        placeholder={productPlaceholder}
                        value={customItemForm.productName}
                        onChange={e => setCustomItemForm({ ...customItemForm, productName: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-[#C8C6C4] rounded-lg outline-none"
                      />
                    </div>
                    <div>
                      <CategoryTaxonomyPicker
                        language={language}
                        businessType={businessType}
                        value={poCategorySel}
                        onChange={(sel) => {
                          setPoCategorySel(sel);
                          setCustomItemForm({ ...customItemForm, category: sel.displayPath });
                        }}
                      />
                    </div>
                  </div>

                  <DynamicProductForm
                    language={language}
                    businessType={businessType}
                    values={poDynamicFields}
                    onChange={setPoDynamicFields}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#605E5C] mb-1">SKU / Code</label>
                      <input
                        type="text"
                        value={customItemForm.sku}
                        onChange={e => setCustomItemForm({ ...customItemForm, sku: e.target.value })}
                        className="w-full px-3 py-2.5 bg-white border border-[#C8C6C4] rounded-lg outline-none text-sm font-medium"
                      />
                    </div>
                    <div>
                      <UnitPicker
                        label={isSw ? 'Kipimo' : 'Unit'}
                        units={workplace.default_units}
                        value={customItemForm.unit}
                        onChange={unit => setCustomItemForm({ ...customItemForm, unit })}
                        isSw={isSw}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#605E5C] mb-1">{isSw ? 'Idadi' : 'Quantity'}</label>
                      <input
                        type="number"
                        min="1"
                        value={customItemForm.quantity}
                        onChange={e => setCustomItemForm({ ...customItemForm, quantity: Number(e.target.value) })}
                        className="w-full px-3 py-2.5 bg-white border border-[#C8C6C4] rounded-lg outline-none text-base font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#605E5C] mb-1">{isSw ? 'Bei ya kununua (kwa kipimo)' : 'Buy price (per unit)'}</label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          value={customItemForm.costPrice}
                          onChange={e => setCustomItemForm({ ...customItemForm, costPrice: Number(e.target.value) })}
                          className="w-full px-3 py-2.5 pr-12 bg-white border border-[#C8C6C4] rounded-lg outline-none text-base font-semibold"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-[#605E5C]">TSh</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#605E5C] mb-1">{isSw ? 'Bei ya uuzaji' : 'Selling price'}</label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          value={customItemForm.sellingPrice}
                          onChange={e => setCustomItemForm({ ...customItemForm, sellingPrice: Number(e.target.value) })}
                          className="w-full px-3 py-2.5 pr-12 bg-white border border-[#C8C6C4] rounded-lg outline-none text-base font-semibold"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-[#605E5C]">TSh</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#605E5C] mb-1">
                        {isSw ? 'Aina ya VAT' : 'VAT class'}
                      </label>
                      <select
                        value={customItemForm.vatType}
                        onChange={e => setCustomItemForm({
                          ...customItemForm,
                          vatType: e.target.value as 'standard' | 'exempt' | 'zero',
                        })}
                        className="w-full px-3 py-2.5 bg-white border border-[#C8C6C4] rounded-lg outline-none text-sm font-semibold"
                      >
                        <option value="standard">{isSw ? 'VAT 18% (kawaida)' : 'Standard VAT 18%'}</option>
                        <option value="exempt">{isSw ? 'Msamaha' : 'Exempt'}</option>
                        <option value="zero">{isSw ? 'Kiwango 0%' : 'Zero-rated'}</option>
                      </select>
                    </div>
                    {showBatch && (
                    <div>
                      <label className="block text-[11px] font-semibold text-[#605E5C] mb-1">{isSw ? 'Batch #' : 'Batch #'}</label>
                      <input
                        type="text"
                        value={customItemForm.batchNumber}
                        onChange={e => setCustomItemForm({ ...customItemForm, batchNumber: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-[#C8C6C4] rounded-lg outline-none"
                      />
                    </div>
                    )}
                    {showExpiry && (
                    <div>
                      <label className="block text-[11px] font-semibold text-[#605E5C] mb-1">{isSw ? 'Tarehe ya Mwisho' : 'Expiry Date'}</label>
                      <input
                        type="date"
                        value={customItemForm.expiryDate}
                        onChange={e => setCustomItemForm({ ...customItemForm, expiryDate: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-[#C8C6C4] rounded-lg outline-none"
                      />
                    </div>
                    )}
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={handleAddItemToPO}
                      className="px-4 py-1.5 bg-[#0078D4] text-white font-bold rounded-lg hover:bg-[#106EBE] cursor-pointer"
                    >
                      + Add New Product to PO
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Current PO Line Items Table */}
            <div className="border border-[#E1DFDD] rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8F8F8] text-[#605E5C] font-bold border-b border-[#EDEBE9]">
                  <tr>
                    <th className="py-2.5 px-3">{isSw ? 'Bidhaa' : 'Product'}</th>
                    <th className="py-2.5 px-3">{isSw ? 'Idadi' : 'Quantity'}</th>
                    <th className="py-2.5 px-3">{isSw ? 'Bei ya Kununua' : 'Buy Price'}</th>
                    <th className="py-2.5 px-3">{isSw ? 'Bei ya Kuuza' : 'Sell Price'}</th>
                    <th className="py-2.5 px-3">{isSw ? 'Kodi' : 'Taxes'}</th>
                    <th className="py-2.5 px-3 font-bold text-right">{isSw ? 'Kiasi' : 'Amount'}</th>
                    <th className="py-2.5 px-2 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F2F1]">
                  {poForm.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-[#323130] flex items-center gap-2">
                          <ProductImageThumb
                            src={
                              item.productId
                                ? products.find(p => p.id === item.productId)?.imageUrl
                                : (item.metadata?.image_url as string | undefined) ||
                                  (item.metadata?.imageUrl as string | undefined)
                            }
                            name={item.productName}
                            size="sm"
                          />
                          <span>
                            {item.productName}
                            {item.isNewProduct && (
                              <span className="ml-1.5 text-[9px] px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 font-bold">NEW</span>
                            )}
                          </span>
                        </div>
                        <div className="text-[10px] text-[#605E5C]">
                          SKU: {item.sku || 'N/A'}
                          {showBatch && item.batchNumber ? ` • Batch: ${item.batchNumber}` : ''}
                          {showExpiry && item.expiryDate ? ` • Exp: ${item.expiryDate}` : ''}
                        </div>
                        {item.metadata && Object.keys(item.metadata).length > 0 && (
                          <ProductMetaBadges
                            product={{
                              id: item.productId ?? `po-${idx}`,
                              name: item.productName,
                              category: item.category ?? '',
                              sku: item.sku ?? '',
                              price: item.sellingPrice ?? 0,
                              cost: item.costPrice,
                              stock: 0,
                              reorderPoint: 0,
                              unit: item.unit ?? 'pcs',
                              businessType,
                              ...item.metadata,
                            } as Product}
                            businessType={businessType}
                            language={language}
                            max={4}
                            className="mt-1"
                          />
                        )}
                      </td>

                      <td className="py-2.5 px-3">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={e => patchPoLine(idx, { quantity: Number(e.target.value) || 1 })}
                          className="w-16 px-2 py-1 bg-[#F3F2F1] rounded text-center font-bold"
                        />
                      </td>

                      <td className="py-2.5 px-3">
                        <input
                          type="number"
                          value={item.costPrice}
                          onChange={e => patchPoLine(idx, { costPrice: Number(e.target.value) || 0 })}
                          className="w-24 px-2 py-1 bg-[#F3F2F1] rounded font-bold"
                        />
                      </td>

                      <td className="py-2.5 px-3">
                        <input
                          type="number"
                          min={0}
                          value={item.sellingPrice ?? ''}
                          placeholder={String(Math.round(item.costPrice * 1.35))}
                          onChange={e => patchPoLine(idx, { sellingPrice: Number(e.target.value) || 0 })}
                          className="w-24 px-2 py-1 bg-[#F3F2F1] rounded font-bold text-[#107C10]"
                        />
                      </td>

                      <td className="py-2.5 px-3">
                        <select
                          value={item.taxId ?? 'none'}
                          onChange={e => {
                            const taxId = e.target.value as PurchaseTaxId;
                            patchPoLine(idx, { taxId, taxRate: purchaseTaxRate(taxId) });
                          }}
                          className="w-full min-w-[88px] px-2 py-1 bg-[#F3F2F1] rounded text-[10px] font-semibold"
                        >
                          {PURCHASE_TAX_OPTIONS.map(opt => (
                            <option key={opt.id} value={opt.id}>
                              {isSw ? opt.labelSw : opt.labelEn}
                            </option>
                          ))}
                        </select>
                        {(item.taxAmount ?? 0) > 0 && (
                          <div className="text-[9px] text-[#605E5C] mt-0.5">
                            +{formatTSh(item.taxAmount ?? 0)} VAT
                          </div>
                        )}
                      </td>

                      <td className="py-2.5 px-3 font-extrabold text-[#323130] text-right font-mono">
                        {formatTSh(item.total)}
                      </td>

                      <td className="py-2.5 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemovePOItem(idx)}
                          className="text-[#D13438] hover:bg-rose-50 p-1 rounded cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="p-3 bg-[#FAF9F8] border-t border-[#EDEBE9] flex flex-col sm:flex-row sm:justify-between gap-3 text-xs">
                <span className="font-semibold text-[#605E5C]">
                  {poForm.items.length} {isSw ? 'mistari' : 'lines'} ({poForm.items.reduce((s, i) => s + i.quantity, 0)} {isSw ? 'vipimo' : 'units'})
                </span>
                <div className="text-right space-y-1 min-w-[200px]">
                  <div className="flex justify-between gap-6">
                    <span className="text-[#605E5C]">{isSw ? 'Jumla bila Kodi' : 'Untaxed Amount'}</span>
                    <span className="font-bold font-mono">{formatTSh(poTotals.subtotal)}</span>
                  </div>
                  {poTotals.vatAmount > 0 && (
                    <div className="flex justify-between gap-6">
                      <span className="text-[#605E5C]">VAT</span>
                      <span className="font-bold font-mono">{formatTSh(poTotals.vatAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between gap-6 pt-1 border-t border-[#EDEBE9]">
                    <span className="font-bold text-[#323130]">{isSw ? 'Jumla' : 'Total'}</span>
                    <span className="text-base font-extrabold text-[#323130] font-mono">
                      {formatTSh(poTotals.totalAmount)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            </>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-[#EDEBE9]">
              <button
                type="button"
                onClick={() => setIsCreatingPO(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-[#605E5C] bg-[#F3F2F1] hover:bg-[#EDEBE9] cursor-pointer"
              >
                {t('cancel')}
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSavePO('draft')}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-[#323130] bg-white border border-[#C8C6C4] hover:bg-[#F3F2F1] cursor-pointer"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  onClick={() => handleSavePO('sent')}
                  className="px-5 py-2 rounded-lg text-xs font-bold text-white bg-[#E65100] hover:bg-[#BF360C] shadow-xs cursor-pointer"
                >
                  {isSw ? 'Tuma RFQ / Thibitisha Agizo →' : 'Send RFQ / Confirm Order →'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 2: VIEW GRN / PURCHASE ORDER DETAILS ================= */}
      {isViewGRNModalOpen && selectedPO && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-[#E1DFDD] shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#EDEBE9] pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#6264A7]" />
                <div>
                  <h3 className="font-bold text-base text-[#323130]">{selectedPO.poNumber} — Goods Received Note</h3>
                  <p className="text-[11px] text-[#605E5C]">{selectedPO.supplierName}</p>
                </div>
              </div>
              <button onClick={() => setIsViewGRNModalOpen(false)} className="text-[#605E5C]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs p-3 bg-[#FAF9F8] rounded-xl border border-[#EDEBE9]">
              <div>
                <div className="text-[#605E5C]">Status:</div>
                <div className="font-bold text-[#323130] uppercase">{selectedPO.status}</div>
              </div>
              <div>
                <div className="text-[#605E5C]">Order Date:</div>
                <div className="font-mono text-[#323130]">{selectedPO.dateCreated}</div>
              </div>
              <div>
                <div className="text-[#605E5C]">Payment Terms:</div>
                <div className="font-bold text-[#323130]">{selectedPO.paymentTerms}</div>
              </div>
              <div>
                <div className="text-[#605E5C]">{isSw ? 'Jumla bila Kodi' : 'Untaxed'}:</div>
                <div className="font-bold text-[#323130]">{formatTSh(selectedPO.subtotal || selectedPO.totalAmount)}</div>
              </div>
              {(selectedPO.vatAmount ?? 0) > 0 && (
                <div>
                  <div className="text-[#605E5C]">VAT:</div>
                  <div className="font-bold text-[#323130]">{formatTSh(selectedPO.vatAmount ?? 0)}</div>
                </div>
              )}
              <div>
                <div className="text-[#605E5C]">{isSw ? 'Jumla' : 'Total'}:</div>
                <div className="font-extrabold text-[#107C10]">{formatTSh(selectedPO.totalAmount)}</div>
              </div>
            </div>

            <div className="border border-[#EDEBE9] rounded-xl overflow-hidden max-h-60 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8F8F8] text-[#605E5C] font-bold">
                  <tr>
                    <th className="py-2 px-3">Product</th>
                    <th className="py-2 px-3">Qty</th>
                    <th className="py-2 px-3">Cost Price</th>
                    <th className="py-2 px-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F2F1]">
                  {selectedPO.items.map((it, i) => (
                    <tr key={i}>
                      <td className="py-2 px-3 font-semibold">{it.productName}</td>
                      <td className="py-2 px-3">{it.quantity} {it.unit || 'pcs'}</td>
                      <td className="py-2 px-3 font-mono">{formatTSh(it.costPrice)}</td>
                      <td className="py-2 px-3 font-mono font-bold text-right">{formatTSh(it.costPrice * it.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                onClick={() => handlePrintGRN(selectedPO)}
                className="px-3 py-1.5 rounded-lg border border-[#C8C6C4] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print GRN</span>
              </button>

              {selectedPO.status === 'sent' && (
                <button
                  onClick={() => {
                    handleExecuteReceivePO(selectedPO);
                    setIsViewGRNModalOpen(false);
                  }}
                  className="px-4 py-2 rounded-lg bg-[#107C10] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <PackagePlus className="w-4 h-4" />
                  <span>Receive & Stock In Now</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 3: ADD NEW SUPPLIER ================= */}
      {isAddingSupplier && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleSaveNewSupplier} className="bg-white rounded-2xl max-w-md w-full border border-[#E1DFDD] shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#EDEBE9] pb-3">
              <h3 className="font-bold text-sm text-[#323130]">Register New Supplier</h3>
              <button type="button" onClick={() => setIsAddingSupplier(false)} className="text-[#605E5C]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#323130] mb-1">Company / Supplier Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Zenna Pharma Supply"
                  value={newSupplier.name}
                  onChange={e => setNewSupplier({ ...newSupplier, name: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F3F2F1] rounded-lg border border-[#EDEBE9] focus:bg-white outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#323130] mb-1">Contact Person</label>
                  <input
                    type="text"
                    value={newSupplier.contactPerson}
                    onChange={e => setNewSupplier({ ...newSupplier, contactPerson: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F3F2F1] rounded-lg border border-[#EDEBE9] focus:bg-white outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#323130] mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={newSupplier.phone}
                    onChange={e => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F3F2F1] rounded-lg border border-[#EDEBE9] focus:bg-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#323130] mb-1">Payment Terms</label>
                <select
                  value={newSupplier.paymentTerms}
                  onChange={e => setNewSupplier({ ...newSupplier, paymentTerms: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F3F2F1] rounded-lg border border-[#EDEBE9] focus:bg-white outline-none"
                >
                  <option value="Net 30 Days">Net 30 Days (Credit)</option>
                  <option value="Net 15 Days">Net 15 Days (Credit)</option>
                  <option value="Cash on Delivery">Cash on Delivery</option>
                  <option value="Prepayment">Prepayment Required</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#EDEBE9]">
              <button
                type="button"
                onClick={() => setIsAddingSupplier(false)}
                className="px-4 py-1.5 text-xs font-semibold text-[#605E5C] bg-[#F3F2F1] rounded-lg"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                className="px-5 py-1.5 text-xs font-bold text-white bg-[#6264A7] hover:bg-[#555793] rounded-lg"
              >
                Save Supplier
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ================= MODAL 4: RECORD SUPPLIER PAYMENT ================= */}
      {isRecordingPayment && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleSavePayment} className="bg-white rounded-2xl max-w-md w-full border border-[#E1DFDD] shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#EDEBE9] pb-3">
              <h3 className="font-bold text-sm text-[#323130]">Record Supplier Settlement Payment</h3>
              <button type="button" onClick={() => setIsRecordingPayment(false)} className="text-[#605E5C]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#323130] mb-1">Supplier</label>
                <select
                  value={paymentForm.supplierId}
                  onChange={e => setPaymentForm({ ...paymentForm, supplierId: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F3F2F1] rounded-lg border border-[#EDEBE9] focus:bg-white outline-none"
                >
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} (Debt: {formatTSh(s.outstandingPayable)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#323130] mb-1">Amount to Pay (TSh) *</label>
                <input
                  type="number"
                  required
                  value={paymentForm.amount}
                  onChange={e => setPaymentForm({ ...paymentForm, amount: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-[#F3F2F1] rounded-lg border border-[#EDEBE9] focus:bg-white outline-none font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#323130] mb-1">Payment Method</label>
                <select
                  value={paymentForm.paymentMethod}
                  onChange={e => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F3F2F1] rounded-lg border border-[#EDEBE9] focus:bg-white outline-none"
                >
                  <option value="CRDB Bank Transfer">CRDB Bank Transfer</option>
                  <option value="NMB Bank Transfer">NMB Bank Transfer</option>
                  <option value="M-Pesa Business Lipa">M-Pesa Business Lipa</option>
                  <option value="Cash Settlement">Cash</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#323130] mb-1">Transaction Ref #</label>
                <input
                  type="text"
                  value={paymentForm.referenceNumber}
                  onChange={e => setPaymentForm({ ...paymentForm, referenceNumber: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F3F2F1] rounded-lg border border-[#EDEBE9] focus:bg-white outline-none font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#EDEBE9]">
              <button
                type="button"
                onClick={() => setIsRecordingPayment(false)}
                className="px-4 py-1.5 text-xs font-semibold text-[#605E5C] bg-[#F3F2F1] rounded-lg"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                className="px-5 py-1.5 text-xs font-bold text-white bg-[#107C10] hover:bg-[#0E6A0E] rounded-lg"
              >
                Record Payment
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
