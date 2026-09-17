import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  ShoppingBag, 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  CreditCard, 
  CheckCircle2, 
  Receipt, 
  ShieldCheck, 
  Sparkles, 
  Printer, 
  X,
  QrCode,
  DollarSign,
  User,
  UserPlus,
  AlertTriangle,
  Camera,
  AlertCircle,
  Phone,
  MapPin,
  Clock,
  ArrowRight,
  Send,
  Info,
  Lock,
  Unlock,
} from 'lucide-react';
import { CartItem, Customer, Language, PaymentMethod, Product, SaleTransaction, BusinessType, AuthUser } from '@/types/v1';
import { formatTSh, getTranslation } from '@/utils/translations';
import { getWorkplace } from '@/lib/businessProfiles';
import { productMatchesSearch } from '@/lib/productMetaDisplay';
import { ProductMetaBadges } from '@/components/v1/ProductMetaBadges';
import { ProductImageThumb } from '@/components/v1/ProductImage';
import { POSQRScannerModal } from '@/components/v1/POSQRScannerModal';
import { useEffectiveTaxCompliance } from '@/context/TaxComplianceContext';
import { useTraReceipts } from '@/context/TraReceiptContext';
import type { TraReceipt } from '@/types/traReceipt';
import { useDocumentTemplates } from '@/context/DocumentTemplateContext';
import { printDocument } from '@/lib/documentRenderer';
import { saleReceiptRenderData } from '@/lib/documentDataMappers';
import {
  calculateSaleTotals,
  formatVatLabel,
  generateReceiptNumber,
  generateTraSignature,
  computeDiscountedSubtotal,
  capDiscountPercent,
  effectiveUnitPrice,
  isVatActive,
  getComplianceStatusLabel,
} from '@/lib/taxComplianceSettings';
import { PageSectionHeader } from '@/components/v1/PageSectionHeader';
import { computeSaleDiscountAmount, saleGrossSubtotal } from '@/lib/saleDiscountUtils';
import { resolvePosPricingAccess, getDashboardPersona } from '@/lib/rbac';
import { api } from '@/lib/api';
import { mapCustomer, customerToApiPayload, filterByBranchId } from '@/lib/apiSync';
import {
  buildSaleFromCart,
  draftFromPosState,
  upsertOpenTransaction,
  removeOpenTransaction,
  generateClientTransactionId,
} from '@/lib/transactionEngine';
import confetti from 'canvas-confetti';
import {
  todayIsoDate,
  defaultCreditDueDate,
  validatePaymentDueDate,
  formatDueDateDisplay,
} from '@/lib/dueDate';
import {
  closeCashierShift,
  getOpenCashierShift,
  openCashierShift,
  type CashierShiftSession,
} from '@/lib/cashierShiftStore';

interface POSViewProps {
  language: Language;
  products: Product[];
  customers: Customer[];
  setCustomers?: React.Dispatch<React.SetStateAction<Customer[]>>;
  onCompleteSale: (sale: SaleTransaction) => void;
  onSavePending?: (sale: SaleTransaction) => void | Promise<void>;
  onFinalizeResume?: (saleId: string, sale: SaleTransaction) => Promise<void>;
  onOpenPending?: () => void;
  tenantId?: string;
  pendingCount?: number;
  cashierName?: string;
  onCustomersChanged?: () => void | Promise<void>;
  onOpenAIChatWithPrompt?: (prompt: string) => void;
  onNavigateToReceivables?: () => void;
  businessType?: BusinessType;
  initialCart?: CartItem[];
  initialCustomerId?: string;
  initialCustomerName?: string;
  initialDraftId?: string;
  resumeSaleId?: string;
  onResumeConsumed?: () => void;
  tableContextLabel?: string;
  currentUser?: AuthUser | null;
  activeBranchId?: string | null;
  branchVatRegistered?: boolean | null;
}

export const POSView: React.FC<POSViewProps> = ({
  language,
  products,
  customers,
  setCustomers,
  onCompleteSale,
  onSavePending,
  onFinalizeResume,
  onOpenPending,
  tenantId,
  pendingCount = 0,
  cashierName = 'Cashier',
  onCustomersChanged,
  onOpenAIChatWithPrompt,
  onNavigateToReceivables,
  businessType = 'retail',
  initialCart,
  initialCustomerId,
  initialCustomerName,
  initialDraftId,
  resumeSaleId,
  onResumeConsumed,
  tableContextLabel,
  currentUser,
  activeBranchId,
  branchVatRegistered,
}) => {
  const isSw = language === 'sw';
  const t = (key: any) => getTranslation(language, key);
  const workplace = getWorkplace(businessType, isSw ? 'sw' : 'en');
  const taxSettings = useEffectiveTaxCompliance(activeBranchId, branchVatRegistered);
  const vatActive = isVatActive(taxSettings);
  const { issueFromSale } = useTraReceipts();
  const { config, getActive } = useDocumentTemplates();
  const pricing = useMemo(
    () => resolvePosPricingAccess(currentUser, taxSettings),
    [currentUser, taxSettings],
  );

  const tenantKey = tenantId || currentUser?.businessId || currentUser?.id || 'local';
  const staffKey = currentUser?.staffId || currentUser?.id || currentUser?.email || 'anon';
  const requiresOpenShift = getDashboardPersona(currentUser ?? null) === 'cashier';
  const [openShift, setOpenShift] = useState<CashierShiftSession | null>(() =>
    typeof window !== 'undefined' ? getOpenCashierShift(tenantKey, staffKey) : null,
  );
  const [openingFloat, setOpeningFloat] = useState('0');

  useEffect(() => {
    setOpenShift(getOpenCashierShift(tenantKey, staffKey));
  }, [tenantKey, staffKey]);

  const branchCustomers = useMemo(
    () => filterByBranchId(customers, activeBranchId),
    [customers, activeBranchId],
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [cart, setCart] = useState<CartItem[]>(initialCart ?? []);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(initialCustomerId ?? '');
  const openDraftIdRef = React.useRef<string | null>(initialDraftId ?? null);
  const savingPendingRef = React.useRef(false);
  const resumeSaleIdRef = React.useRef<string | null>(resumeSaleId ?? null);
  const resumeCustomerPinRef = useRef<{ id?: string; name?: string } | null>(
    initialCustomerId || initialCustomerName
      ? { id: initialCustomerId, name: initialCustomerName }
      : null,
  );

  React.useEffect(() => {
    if (initialCart?.length) {
      setCart(initialCart);
    }
  }, [initialCart]);

  React.useEffect(() => {
    if (!initialCustomerId && !initialCustomerName) return;
    resumeCustomerPinRef.current = {
      id: initialCustomerId,
      name: initialCustomerName,
    };
    if (initialCustomerId) {
      setSelectedCustomerId(initialCustomerId);
      return;
    }
    if (!initialCustomerName) return;

    const resumeId = `resume-${initialCustomerName.toLowerCase().replace(/\s+/g, '-')}`;
    if (!customers.length) {
      setSelectedCustomerId(resumeId);
      return;
    }

    const match = branchCustomers.find(
      c => c.name.toLowerCase() === initialCustomerName.toLowerCase(),
    );
    setSelectedCustomerId(match?.id ?? initialCustomerId ?? resumeId);
  }, [initialCustomerId, initialCustomerName, customers, branchCustomers]);

  React.useEffect(() => {
    if (!activeBranchId || !selectedCustomerId) return;
    if (selectedCustomerId.startsWith('resume-')) return;
    if (!branchCustomers.some(c => c.id === selectedCustomerId)) {
      setSelectedCustomerId('');
    }
  }, [activeBranchId, branchCustomers, selectedCustomerId]);

  React.useEffect(() => {
    if (initialDraftId) openDraftIdRef.current = initialDraftId;
  }, [initialDraftId]);

  React.useEffect(() => {
    resumeSaleIdRef.current = resumeSaleId ?? null;
  }, [resumeSaleId]);

  // Payment Options — must be declared before effects that reference paymentMode
  const [paymentMode, setPaymentMode] = useState<'full' | 'partial' | 'credit'>('full');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>('cash');
  const [amountPaidInput, setAmountPaidInput] = useState<string>('');
  const [cartDiscountPercent, setCartDiscountPercent] = useState<number>(0);
  const [paymentDueDate, setPaymentDueDate] = useState<string>('');
  /** Per-sale VAT: default follows shop settings; cashier can flip for this cart. */
  const [applyVatThisSale, setApplyVatThisSale] = useState<boolean>(vatActive);

  useEffect(() => {
    setApplyVatThisSale(vatActive);
  }, [vatActive, activeBranchId]);

  const saleTaxSettings = useMemo(() => {
    if (!taxSettings.vatRegistered || taxSettings.mode === 'non_vat') {
      return taxSettings;
    }
    if (applyVatThisSale) {
      return { ...taxSettings, vatEnabled: true };
    }
    return {
      ...taxSettings,
      mode: 'manual' as const,
      vatEnabled: false,
      showVatOnReceipt: false,
    };
  }, [taxSettings, applyVatThisSale]);

  const canToggleSaleVat =
    taxSettings.vatRegistered && taxSettings.mode !== 'non_vat';

  React.useEffect(() => {
    if (!pricing.canUsePartialPayment && paymentMode !== 'full') {
      setPaymentMode('full');
    }
  }, [pricing.canUsePartialPayment, paymentMode]);
  
  const [lastCompletedSale, setLastCompletedSale] = useState<SaleTransaction | null>(null);
  const [lastTraReceipt, setLastTraReceipt] = useState<TraReceipt | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // New Customer On-The-Fly Modal State
  const [isNewCustomerModalOpen, setIsNewCustomerModalOpen] = useState(false);
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({
    name: '',
    phone: '+255 ',
    email: '',
    address: 'Kariakoo, Dar es Salaam',
    creditLimit: '300000',
    notes: 'Registered at POS Register',
  });

  // Stock Warning & Validation Banner State
  const [stockWarningMessage, setStockWarningMessage] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const categories = ['all', ...Array.from(new Set(products.map(p => p.category)))];

  const filteredProducts = products.filter(p => {
    const matchesSearch = productMatchesSearch(p, businessType, searchQuery)
      || p.sku.toLowerCase().includes(searchQuery.toLowerCase())
      || (p.batchNumber && p.batchNumber.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCat = selectedCategory === 'all' || p.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const selectedCustomer = useMemo(() => {
    const found = branchCustomers.find(c => c.id === selectedCustomerId);
    if (found) return found;

    const pin = resumeCustomerPinRef.current;
    if (!pin?.name) return undefined;

    const byName = branchCustomers.find(
      c => c.name.toLowerCase() === pin.name!.toLowerCase(),
    );
    if (byName) return byName;

    if (pin.id === selectedCustomerId || pin.name) {
      return {
        id: pin.id ?? selectedCustomerId,
        name: pin.name,
        phone: '',
        email: '',
        address: '',
        creditLimit: 300_000,
        balance: 0,
        joinedDate: '',
        loyaltyTier: 'Bronze' as const,
        loyaltyPoints: 0,
        riskScore: 'Low' as const,
        dunningStage: 'cleared' as const,
        daysOverdue: 0,
        lastPurchaseDate: '',
        totalPurchases: 0,
        avatarColor: '#6264A7',
      } satisfies Customer;
    }
    return undefined;
  }, [branchCustomers, selectedCustomerId]);

  // Autosave open cart to local storage (recovery after crash/refresh)
  useEffect(() => {
    if (!tenantId || cart.length === 0) return;
    if (resumeSaleIdRef.current) return;
    if (savingPendingRef.current) return;
    if (!openDraftIdRef.current) {
      openDraftIdRef.current = generateClientTransactionId();
    }
    const draft = draftFromPosState(cart, {
      id: openDraftIdRef.current,
      customerId: selectedCustomer?.id || selectedCustomerId || undefined,
      customerName: selectedCustomer?.name || resumeCustomerPinRef.current?.name,
      paymentMode,
      selectedPaymentMethod,
      amountPaidInput,
      status: 'open',
    });
    draft.clientTransactionId = openDraftIdRef.current;
    upsertOpenTransaction(tenantId, draft);
  }, [tenantId, cart, selectedCustomer, selectedCustomerId, paymentMode, selectedPaymentMethod, amountPaidInput]);

  // Flash warning helper
  const triggerStockWarning = (msg: string) => {
    setStockWarningMessage(msg);
    setTimeout(() => {
      setStockWarningMessage(null);
    }, 4500);
  };

  // Cart operations with strict stock checking
  const handleAddToCart = (product: Product) => {
    // 1. Check if product is physically out of stock
    if (product.stock <= 0) {
      triggerStockWarning(
        isSw 
          ? `⚠️ HAKUNA STOO! Bidhaa "${product.name}" haina idadi iliyobaki stoo (0 ${product.unit}). Tafadhali agiza kutoka kwa msambazaji.`
          : `⚠️ OUT OF STOCK! "${product.name}" has 0 ${product.unit} available in inventory.`
      );
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        // Check if adding +1 exceeds available physical stock
        if (existing.quantity + 1 > product.stock) {
          triggerStockWarning(
            isSw
              ? `⚠️ HIFADHI HAITOSHI! Bidhaa "${product.name}" ina ${product.stock} ${product.unit} tu stoo. Hauwezi kuongeza zaidi ya kiasi kilichopo.`
              : `⚠️ INSUFFICIENT STOCK! "${product.name}" only has ${product.stock} ${product.unit} available. Cannot exceed physical stock.`
          );
          return prev;
        }
        return prev.map(item => 
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }

      // If brand new in cart, check stock >= 1
      return [...prev, { product, quantity: 1, discountPercent: 0 }];
    });
  };

  const handleUpdateQty = (productId: string, delta: number) => {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;

    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const nextQty = item.quantity + delta;
        if (nextQty <= 0) return item; // Handled by delete or minimum 1

        if (nextQty > prod.stock) {
          triggerStockWarning(
            isSw
              ? `⚠️ HIFADHI HAITOSHI! Idadi uliyoomba (${nextQty} ${prod.unit}) inazidi kiasi kilichopo stoo (${prod.stock} ${prod.unit}) kwa "${prod.name}".`
              : `⚠️ INSUFFICIENT STOCK! Requested quantity (${nextQty}) exceeds available stock (${prod.stock}) for "${prod.name}".`
          );
          return { ...item, quantity: prod.stock };
        }

        return { ...item, quantity: nextQty };
      }
      return item;
    }));
  };

  const handleDirectQtyInput = (productId: string, val: string) => {
    const parsed = parseInt(val, 10);
    const prod = products.find(p => p.id === productId);
    if (!prod) return;

    if (isNaN(parsed) || parsed <= 0) {
      setCart(prev => prev.map(item => item.product.id === productId ? { ...item, quantity: 1 } : item));
      return;
    }

    if (parsed > prod.stock) {
      triggerStockWarning(
        isSw
          ? `⚠️ HIFADHI HAITOSHI! Idadi uliyoweka (${parsed}) inazidi stoo iliyopo (${prod.stock} ${prod.unit}) kwa "${prod.name}". Mfumo umeweka kiwango cha juu cha ${prod.stock}.`
          : `⚠️ INSUFFICIENT STOCK! Entered quantity (${parsed}) exceeds available stock (${prod.stock}). Capped at ${prod.stock}.`
      );
      setCart(prev => prev.map(item => item.product.id === productId ? { ...item, quantity: prod.stock } : item));
      return;
    }

    setCart(prev => prev.map(item => item.product.id === productId ? { ...item, quantity: parsed } : item));
  };

  const handleRemoveFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const handleUpdateDiscount = (productId: string, raw: string) => {
    const parsed = parseFloat(raw);
    let pct = isNaN(parsed) ? 0 : parsed;
    if (!pricing.canApplyDiscount) {
      pct = 0;
    } else if (pct > taxSettings.maxDiscountPercent && !pricing.canApproveHighDiscount) {
      pct = taxSettings.maxDiscountPercent;
    } else {
      pct = Math.min(Math.max(pct, 0), 100);
    }
    setCart(prev =>
      prev.map(item =>
        item.product.id === productId ? { ...item, discountPercent: pct } : item,
      ),
    );
  };

  const handleUpdateUnitPrice = (productId: string, raw: string) => {
    if (!pricing.canOverridePrice) return;
    const parsed = parseFloat(raw.replace(/,/g, ''));
    setCart(prev =>
      prev.map(item => {
        if (item.product.id !== productId) return item;
        if (!raw.trim() || isNaN(parsed) || parsed <= 0) {
          return { ...item, unitPriceOverride: undefined };
        }
        return { ...item, unitPriceOverride: parsed };
      }),
    );
  };

  // Financial Calculations (per-line discounts when enabled)
  const { subtotal, discountAmount, grossSubtotal } = computeDiscountedSubtotal(
    cart.map(item => ({
      unitPrice: effectiveUnitPrice(item.product.price, item.unitPriceOverride),
      quantity: item.quantity,
      discountPercent: pricing.canApplyDiscount ? item.discountPercent : 0,
    })),
    saleTaxSettings,
  );
  const effectiveCartDiscount =
    saleTaxSettings.cartDiscountEnabled && pricing.canApplyDiscount ? cartDiscountPercent : 0;
  const saleTotals = calculateSaleTotals({ subtotal, discountPercent: effectiveCartDiscount }, saleTaxSettings);
  const vatAmount = saleTotals.vatAmount;
  const total = saleTotals.total;
  const saleVatActive = isVatActive(saleTaxSettings);

  const actualPaidAmount = paymentMode === 'full' 
    ? total 
    : paymentMode === 'credit' 
      ? 0 
      : Number(amountPaidInput) || 0;

  const balanceRemaining = Math.max(0, total - actualPaidAmount);

  // Check if credit / partial requires customer selection
  const isCreditOrPartial = paymentMode === 'credit' || (paymentMode === 'partial' && balanceRemaining > 0);
  const needsDueDate =
    pricing.canUsePartialPayment &&
    (paymentMode === 'credit' || (paymentMode === 'partial' && balanceRemaining > 0));
  const isCustomerMissingForCredit = isCreditOrPartial && !selectedCustomer;

  React.useEffect(() => {
    if (needsDueDate && !paymentDueDate) {
      setPaymentDueDate(defaultCreditDueDate(30));
    } else if (!needsDueDate) {
      setPaymentDueDate('');
    }
  }, [needsDueDate, paymentDueDate]);

  const buildCurrentSale = useCallback(
    (finalize: boolean, clientTransactionId?: string) =>
      buildSaleFromCart({
        cart,
        customer: selectedCustomer,
        paymentMode,
        paymentMethod: selectedPaymentMethod,
        amountPaid: Number(amountPaidInput) || 0,
        taxSettings: saleTaxSettings,
        cashierName,
        clientTransactionId: clientTransactionId ?? openDraftIdRef.current ?? undefined,
        finalize,
        isSw,
        branchId: activeBranchId ?? undefined,
        cartDiscountPercent: pricing.canApplyDiscount ? cartDiscountPercent : 0,
        paymentDueDate: needsDueDate ? paymentDueDate : undefined,
        receiptNumber: finalize ? generateReceiptNumber(taxSettings) : undefined,
      }),
    [cart, selectedCustomer, paymentMode, selectedPaymentMethod, amountPaidInput, saleTaxSettings, cashierName, isSw, activeBranchId, cartDiscountPercent, pricing.canApplyDiscount, needsDueDate, paymentDueDate],
  );

  const handleSaveAndNext = async () => {
    setValidationError(null);
    if (cart.length === 0) {
      setValidationError(isSw ? 'Kikapu hakina bidhaa.' : 'Cart is empty.');
      return;
    }
    if (balanceRemaining > 0) {
      const dueErr = validatePaymentDueDate(paymentDueDate, isSw);
      if (dueErr) {
        setValidationError(dueErr);
        return;
      }
    }
    if (!openDraftIdRef.current) {
      openDraftIdRef.current = generateClientTransactionId();
    }
    const draftId = openDraftIdRef.current;
    savingPendingRef.current = true;
    openDraftIdRef.current = null;
    if (tenantId) {
      removeOpenTransaction(tenantId, draftId);
    }
    const sale = buildCurrentSale(false, draftId);
    sale.traEfdSignature = undefined;
    try {
      if (onSavePending) {
        await onSavePending(sale);
      } else {
        onCompleteSale(sale);
      }
      setCart([]);
      setAmountPaidInput('');
      setSelectedCustomerId('');
      resumeCustomerPinRef.current = null;
      setValidationError(null);
    } finally {
      savingPendingRef.current = false;
    }
  };

  const clearPosSession = () => {
    setCart([]);
    setAmountPaidInput('');
    setPaymentDueDate('');
    setSelectedCustomerId('');
    openDraftIdRef.current = null;
    resumeSaleIdRef.current = null;
    onResumeConsumed?.();
  };

  // Execute Sale & Generate TRA EFD Receipt with Strict Validation
  const handleExecuteSale = async () => {
    setValidationError(null);

    if (cart.length === 0) {
      setValidationError(isSw ? 'Kikapu hakina bidhaa.' : 'Cart is empty.');
      return;
    }

    // 1. Strict Requirement: If customer needs credit or partial payment, NO SALE CAN BE DONE until customer is selected or created!
    if (isCreditOrPartial) {
      if (!selectedCustomer) {
        setValidationError(
          isSw 
            ? '⚠️ MTEJA ANAHITAJIKA: Haiwezekani kufanya mauzo ya mkopo (Credit) au malipo ya awamu (Partial) bila kumchagua au kumsajili mteja ili kufuatilia madeni!'
            : '⚠️ CUSTOMER REQUIRED: Credit and partial sales cannot be completed without selecting or creating a customer to track receivables!'
        );
        setIsNewCustomerModalOpen(true);
        return;
      }

      // Check credit limit
      if (selectedCustomer.balance + balanceRemaining > selectedCustomer.creditLimit) {
        const proceed = confirm(
          isSw
            ? `⚠️ Mteja huyu (${selectedCustomer.name}) atazidi kikomo cha mkopo (${formatTSh(selectedCustomer.creditLimit)}). Salio jipya litakuwa ${formatTSh(selectedCustomer.balance + balanceRemaining)}. Je, unathibitisha kutoa mkopo wa ziada?`
            : `⚠️ Customer credit limit (${formatTSh(selectedCustomer.creditLimit)}) will be exceeded. New balance will be ${formatTSh(selectedCustomer.balance + balanceRemaining)}. Confirm supervisor override?`
        );
        if (!proceed) return;
      }
    }

    if (balanceRemaining > 0) {
      const dueErr = validatePaymentDueDate(paymentDueDate, isSw);
      if (dueErr) {
        setValidationError(dueErr);
        return;
      }
    }

    // 2. Double check stock constraints before committing
    for (const item of cart) {
      const liveProd = products.find(p => p.id === item.product.id);
      if (liveProd && item.quantity > liveProd.stock) {
        setValidationError(
          isSw
            ? `⚠️ Hifadhi haitoshi kwa "${liveProd.name}". Umeomba ${item.quantity}, lakini kuna ${liveProd.stock} tu stoo.`
            : `⚠️ Insufficient stock for "${liveProd.name}". Requested ${item.quantity}, but only ${liveProd.stock} available.`
        );
        return;
      }
    }

    const receiptNumber = generateReceiptNumber(taxSettings);
    const sale = buildCurrentSale(true);
    sale.receiptNumber = receiptNumber;
    sale.traEfdSignature = generateTraSignature(taxSettings, receiptNumber);
    if (selectedPaymentMethod === 'mpesa' && !sale.payments[0]?.reference) {
      sale.payments[0].reference = `MP-${Math.random().toString(36).substring(7).toUpperCase()}`;
    }

    const finishSale = async () => {
      let traReceipt: TraReceipt | null = null;
      if (saleVatActive && taxSettings.mode === 'tra_efd') {
        traReceipt = await issueFromSale(
          sale,
          taxSettings.receiptBusinessName || currentUser?.businessName || 'Shop',
          { customerMobile: selectedCustomer?.phone },
        );
      }
      setLastTraReceipt(traReceipt);
      setLastCompletedSale(sale);
      clearPosSession();
      confetti({ particleCount: 70, spread: 80, origin: { y: 0.6 } });
    };

    if (resumeSaleIdRef.current && onFinalizeResume) {
      try {
        if (tenantId) {
          const draftId = openDraftIdRef.current ?? resumeSaleIdRef.current;
          removeOpenTransaction(tenantId, draftId);
          removeOpenTransaction(tenantId, resumeSaleIdRef.current);
        }
        await onFinalizeResume(resumeSaleIdRef.current, sale);
        await finishSale();
      } catch {
        setValidationError(isSw ? 'Imeshindikana kukamilisha mauzo.' : 'Failed to finalize pending sale.');
      }
      return;
    }

    if (tenantId) {
      const draftId = openDraftIdRef.current ?? sale.id;
      removeOpenTransaction(tenantId, draftId);
      removeOpenTransaction(tenantId, sale.id);
    }

    onCompleteSale(sale);
    await finishSale();
  };

  // Handler: Quick Create Customer from POS and Auto-Select
  const handleQuickCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerForm.name || !newCustomerForm.phone || isCreatingCustomer) return;

    setIsCreatingCustomer(true);
    const colors = ['bg-blue-600', 'bg-emerald-600', 'bg-purple-600', 'bg-amber-600', 'bg-indigo-600', 'bg-teal-600'];
    const payload = customerToApiPayload({
      name: newCustomerForm.name,
      phone: newCustomerForm.phone,
      email: newCustomerForm.email || `${newCustomerForm.name.toLowerCase().replace(/\s+/g, '')}@duka.tz`,
      address: newCustomerForm.address || 'Dar es Salaam, Tanzania',
      creditLimit: Number(newCustomerForm.creditLimit) || 300000,
      balance: 0,
      notes: newCustomerForm.notes || 'Registered at POS Register',
    }, activeBranchId);

    let created: Customer;
    try {
      const raw = await api.createCustomer(payload);
      created = {
        ...mapCustomer(raw as Record<string, unknown>),
        branchId: (raw as { branch_id?: string }).branch_id ?? activeBranchId ?? undefined,
        avatarColor: colors[Math.floor(Math.random() * colors.length)],
        notes: newCustomerForm.notes || 'Registered at POS Register',
        riskScore: 'Low',
        dunningStage: 'cleared',
        daysOverdue: 0,
        lastPurchaseDate: '',
        totalPurchases: 0,
        loyaltyPoints: 50,
      };
      await onCustomersChanged?.();
    } catch (err) {
      setIsCreatingCustomer(false);
      setValidationError(
        isSw
          ? `Imeshindwa kuhifadhi mteja kwenye seva: ${(err as Error).message}. Hakikisha umeingia na mtandao unafanya kazi.`
          : `Could not save customer to server: ${(err as Error).message}. Check you are logged in and online.`,
      );
      return;
    }

    if (setCustomers) {
      setCustomers(prev => {
        const scoped = filterByBranchId(prev, activeBranchId);
        return [created, ...scoped.filter(c => c.phone !== created.phone)];
      });
    }

    setSelectedCustomerId(created.id);
    setIsNewCustomerModalOpen(false);
    setValidationError(null);
    setIsCreatingCustomer(false);
    setNewCustomerForm({
      name: '',
      phone: '+255 ',
      email: '',
      address: 'Kariakoo, Dar es Salaam',
      creditLimit: '300000',
      notes: 'Registered at POS Register',
    });

    confetti({
      particleCount: 40,
      spread: 60,
      origin: { y: 0.7 },
    });
  };

  if (requiresOpenShift && !openShift) {
    return (
      <div className="max-w-lg mx-auto mt-10 rounded-2xl border border-rose-200 bg-rose-50 p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-rose-100 text-rose-700">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-[#323130]">
              {isSw ? 'Fungua zamu kabla ya POS' : 'Open your shift before POS'}
            </h2>
            <p className="text-xs text-[#605E5C] mt-1">
              {isSw
                ? 'Mauzo yanahitaji zamu iliyofunguliwa. Weka float ya kuanza kisha fungua.'
                : 'Sales require an open shift. Enter opening float, then open your shift.'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="number"
            min={0}
            value={openingFloat}
            onChange={e => setOpeningFloat(e.target.value)}
            placeholder={isSw ? 'Float ya kuanza' : 'Opening float'}
            className="w-36 px-3 py-2 rounded-xl border border-[#E1DFDD] text-sm bg-white"
          />
          <button
            type="button"
            onClick={() => {
              const session = openCashierShift({
                tenantId: tenantKey,
                staffId: staffKey,
                cashierName: cashierName || currentUser?.name || 'Cashier',
                openingFloat: Number(openingFloat) || 0,
              });
              setOpenShift(session);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0F2347] text-white text-sm font-bold cursor-pointer"
          >
            <Unlock className="w-4 h-4" />
            {isSw ? 'Fungua Zamu' : 'Open Shift'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-12">
      {requiresOpenShift && openShift && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-emerald-900 inline-flex items-center gap-1.5">
            <Unlock className="w-3.5 h-3.5" />
            {isSw ? 'Zamu wazi' : 'Shift open'} · {new Date(openShift.openedAt).toLocaleTimeString()}
          </span>
          <button
            type="button"
            onClick={() => {
              closeCashierShift({ tenantId: tenantKey, staffId: staffKey });
              setOpenShift(null);
            }}
            className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-bold cursor-pointer"
          >
            {isSw ? 'Funga Zamu' : 'Close Shift'}
          </button>
        </div>
      )}
      <PageSectionHeader
        title={`${workplace.icon} ${isSw ? workplace.pos_title_sw : workplace.pos_title_en}`}
        subtitle={
          <>
            {currentUser?.businessName || (isSw ? 'Biashara Yako' : 'Your Business')} • {getComplianceStatusLabel(taxSettings, isSw)}
            {tableContextLabel && (
              <span className="block mt-1 text-teal-800 font-bold">
                🍽️ {isSw ? 'Meza' : 'Table'}: {tableContextLabel}
              </span>
            )}
          </>
        }
        toolbar={
          <>
            {onNavigateToReceivables && (
              <button
                type="button"
                onClick={onNavigateToReceivables}
                className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-[#D13438] border border-rose-200 text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>{isSw ? 'Madeni' : 'Receivables'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsQRScannerOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-[#6264A7] hover:bg-[#555793] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>{isSw ? 'Skani' : 'Scan'}</span>
            </button>
            <span className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full bg-[#107C10]/10 text-[#107C10] border border-[#107C10]/30">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{getComplianceStatusLabel(taxSettings, isSw)}</span>
            </span>
          </>
        }
      />

      {/* STOCK WARNING BANNER IF EXCEEDED */}
      {stockWarningMessage && (
        <div className="p-3.5 bg-amber-50 border-2 border-amber-400 rounded-xl text-xs text-amber-900 font-bold flex items-center justify-between shadow-md animate-in slide-in-from-top duration-200">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <span>{stockWarningMessage}</span>
          </div>
          <button onClick={() => setStockWarningMessage(null)} className="text-amber-800 hover:text-black">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* GENERAL VALIDATION ERROR BANNER */}
      {validationError && (
        <div className="p-3.5 bg-rose-50 border-2 border-rose-400 rounded-xl text-xs text-rose-900 font-bold flex items-center justify-between shadow-md animate-in slide-in-from-top duration-200">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{validationError}</span>
          </div>
          <button onClick={() => setValidationError(null)} className="text-rose-800 hover:text-black">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* POS TWO COLUMN LAYOUT: Products Grid (Left 7 cols) & Live Cart Register (Right 5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT PRODUCT CATALOG (7 COLS) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Search & Category Filter Pills */}
          <div className="bg-white rounded-xl p-3 border border-[#E1DFDD] shadow-xs space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#605E5C] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder={t('searchProducts')}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-[#F3F2F1] border border-transparent focus:border-[#0078D4] focus:bg-white rounded-lg text-xs outline-none"
                />
              </div>

              <button
                onClick={() => setIsScannerOpen(true)}
                className="px-3.5 py-2 rounded-lg bg-[#6264A7] hover:bg-[#555793] text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                title="Scan QR or Barcode with Camera"
              >
                <Camera className="w-4 h-4 text-emerald-300" />
                <span className="hidden sm:inline">Scan QR</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-lg capitalize whitespace-nowrap text-xs font-medium transition-all ${
                    selectedCategory === cat
                      ? 'bg-[#6264A7] text-white font-bold shadow-xs'
                      : 'bg-[#F3F2F1] text-[#605E5C] hover:text-[#323130]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Product Cards Grid with Automatic Available Stock Display */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[580px] overflow-y-auto pr-1">
            {filteredProducts.map(prod => {
              const isOutOfStock = prod.stock <= 0;
              const isLowStock = prod.stock > 0 && prod.stock <= prod.reorderPoint;
              const cartItem = cart.find(c => c.product.id === prod.id);
              const remainingAfterCart = prod.stock - (cartItem?.quantity || 0);

              return (
                <div
                  key={prod.id}
                  onClick={() => !isOutOfStock && handleAddToCart(prod)}
                  className={`bg-white rounded-xl p-3.5 border shadow-xs transition-all flex flex-col justify-between group select-none ${
                    isOutOfStock 
                      ? 'border-rose-200 bg-rose-50/40 opacity-70 cursor-not-allowed'
                      : 'border-[#E1DFDD] hover:border-[#6264A7] hover:shadow-md cursor-pointer active:scale-[0.98]'
                  }`}
                >
                  <div>
                    <div className="mb-2 -mx-0.5 rounded-lg overflow-hidden border border-[#EDEBE9] bg-[#F3F2F1]">
                      <ProductImageThumb src={prod.imageUrl} name={prod.name} size="card" />
                    </div>
                    <div className="flex items-start justify-between gap-1 mb-1">
                      <span className="text-[10px] font-mono text-[#605E5C] bg-[#F3F2F1] px-1.5 py-0.5 rounded">
                        {prod.sku}
                      </span>
                      {isOutOfStock ? (
                        <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-rose-600 text-white shadow-xs">
                          {isSw ? 'HAKUNA STOO' : 'OUT OF STOCK'}
                        </span>
                      ) : businessType === 'pharmacy' && prod.requiresPrescription ? (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200">
                          Rx Required
                        </span>
                      ) : null}
                    </div>

                    <h4 className="text-xs font-bold text-[#323130] line-clamp-2 group-hover:text-[#6264A7] transition-colors">
                      {prod.name}
                    </h4>

                    <ProductMetaBadges
                      product={prod}
                      businessType={businessType}
                      language={language}
                      variant="line"
                      max={2}
                      className="mt-0.5"
                    />

                    {/* Prominent Available Stock Label */}
                    <div className="mt-1 flex items-center justify-between text-[11px]">
                      <span className="text-[#605E5C]">{isSw ? 'Hifadhi Iliyopo:' : 'Available Stock:'}</span>
                      <strong className={`font-black ${isOutOfStock ? 'text-rose-600' : isLowStock ? 'text-amber-600' : 'text-[#107C10]'}`}>
                        {prod.stock} {prod.unit}
                      </strong>
                    </div>

                    {cartItem && (
                      <div className="text-[10px] font-semibold text-[#0078D4] mt-0.5">
                        {isSw ? 'Kwenye Kikapu:' : 'In Cart:'} {cartItem.quantity} (Stoo Inabaki: {remainingAfterCart})
                      </div>
                    )}
                  </div>

                  <div className="mt-3 pt-2 border-t border-[#F3F2F1] flex items-center justify-between">
                    <div className="text-xs font-extrabold text-[#0078D4]">
                      {formatTSh(prod.price)}
                    </div>
                    <button 
                      disabled={isOutOfStock}
                      className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${
                        isOutOfStock 
                          ? 'bg-rose-100 text-rose-400 cursor-not-allowed' 
                          : 'bg-[#F3F2F1] group-hover:bg-[#6264A7] group-hover:text-white text-[#323130]'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT CART & PAYMENT REGISTER (5 COLS) */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-[#E1DFDD] shadow-xs p-4 flex flex-col justify-between space-y-4">
          <div>
            {/* Customer Selection & On-The-Fly Creation Header */}
            <div className="border-b border-[#F3F2F1] pb-3 mb-3 space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-[#323130]">
                  {isSw ? 'Mteja wa Mauzo (Customer)' : 'Sales Customer'}
                  {isCreditOrPartial && <span className="text-[#D13438] ml-1">* Lazima kwa Mkopo</span>}
                </label>
                
                {/* On-the-fly Customer Creation Trigger */}
                <button
                  type="button"
                  id="btn-pos-add-customer"
                  onClick={() => setIsNewCustomerModalOpen(true)}
                  className="text-[11px] font-bold text-[#0078D4] hover:text-[#005a9e] flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{isSw ? '➕ Sajili Mteja Mpya' : '➕ New Customer'}</span>
                </button>
              </div>

              {/* Customer Selector Dropdown */}
              <select
                id="select-pos-customer"
                value={selectedCustomerId}
                onChange={e => {
                  setSelectedCustomerId(e.target.value);
                  setValidationError(null);
                }}
                className={`w-full px-3 py-2 text-xs rounded-lg outline-none transition-all ${
                  isCustomerMissingForCredit 
                    ? 'bg-rose-50 border-2 border-rose-400 text-rose-900 font-bold animate-pulse'
                    : 'bg-[#F3F2F1] border border-[#EDEBE9] focus:bg-white focus:border-[#0078D4]'
                }`}
              >
                <option value="">👤 {isSw ? 'Mteja wa Taslimu (Walk-in Customer)' : 'Walk-in Customer (Cash Only)'}</option>
                {selectedCustomer && !branchCustomers.some(c => c.id === selectedCustomer.id) && (
                  <option value={selectedCustomer.id}>
                    {selectedCustomer.name} ({isSw ? 'imeendelezwa' : 'resumed'})
                  </option>
                )}
                {branchCustomers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phone}) • Deni: {formatTSh(c.balance)} • Kikomo: {formatTSh(c.creditLimit)}
                  </option>
                ))}
              </select>

              {/* Selected Customer Details & Credit Rating Pill */}
              {selectedCustomer ? (
                <div className="p-2.5 bg-[#F0F2FA] rounded-xl text-[11px] text-[#323130] space-y-1 border border-[#D0D5EE]">
                  <div className="flex items-center justify-between font-semibold">
                    <span className="font-bold text-[#0078D4] flex items-center gap-1">
                      <User className="w-3 h-3" /> {selectedCustomer.name}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      selectedCustomer.riskScore === 'High' ? 'bg-rose-100 text-rose-700' :
                      selectedCustomer.riskScore === 'Medium' ? 'bg-amber-100 text-amber-700' :
                      'bg-emerald-100 text-emerald-700'
                    }`}>
                      {selectedCustomer.riskScore} Risk
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-[#605E5C]">
                    <span>{isSw ? 'Deni Lililopo:' : 'Current Debt:'} <strong className="text-[#D13438]">{formatTSh(selectedCustomer.balance)}</strong></span>
                    <span>{isSw ? 'Mkopo Uliobaki:' : 'Available Credit:'} <strong className="text-[#107C10]">{formatTSh(Math.max(0, selectedCustomer.creditLimit - selectedCustomer.balance))}</strong></span>
                  </div>
                </div>
              ) : isCreditOrPartial ? (
                <div className="p-2.5 bg-rose-50 border border-rose-300 rounded-xl text-[11px] text-rose-800 font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>
                    {isSw 
                      ? '⚠️ Unahitaji kuchagua au kusajili mteja ili kutoa mkopo au malipo ya awamu!' 
                      : '⚠️ Customer is required before completing credit or partial installment sales!'}
                  </span>
                </div>
              ) : null}
            </div>

            {/* Cart Items List with Physical Inventory Indicators */}
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {cart.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#605E5C]">
                  <ShoppingBag className="w-8 h-8 text-[#C8C6C4] mx-auto mb-2" />
                  {t('cartEmpty')}
                </div>
              ) : (
                cart.map(item => {
                  const availableStock = item.product.stock;
                  const isExceeding = item.quantity > availableStock;

                  return (
                    <div 
                      key={item.product.id} 
                      className={`p-2.5 rounded-lg border text-xs transition-colors ${
                        isExceeding 
                          ? 'bg-rose-50 border-rose-300' 
                          : 'bg-[#FAF9F8] border-[#EDEBE9]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1 pr-2 min-w-0">
                          <ProductImageThumb src={item.product.imageUrl} name={item.product.name} size="sm" />
                          <div className="min-w-0 flex-1">
                          <div className="font-bold text-[#323130] truncate">{item.product.name}</div>
                          <ProductMetaBadges
                            product={item.product}
                            businessType={businessType}
                            language={language}
                            variant="line"
                            max={1}
                          />
                          <div className="text-[10px] text-[#605E5C] flex items-center gap-2 mt-0.5">
                            <span>{formatTSh(item.product.price)} / {item.product.unit}</span>
                            <span className="font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded">
                              Stoo: {availableStock}
                            </span>
                          </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleUpdateQty(item.product.id, -1)}
                            className="w-5 h-5 rounded bg-white border border-[#C8C6C4] flex items-center justify-center text-[#323130] hover:bg-slate-50 cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          
                          <input
                            type="number"
                            min="1"
                            max={availableStock}
                            value={item.quantity}
                            onChange={e => handleDirectQtyInput(item.product.id, e.target.value)}
                            className="w-8 text-center font-bold text-xs bg-white border border-[#EDEBE9] rounded py-0.5 outline-none"
                          />

                          <button
                            onClick={() => handleUpdateQty(item.product.id, 1)}
                            className="w-5 h-5 rounded bg-white border border-[#C8C6C4] flex items-center justify-center text-[#323130] hover:bg-slate-50 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleRemoveFromCart(item.product.id)}
                            className="p-1 text-rose-500 hover:bg-rose-50 rounded cursor-pointer ml-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      {pricing.canApplyDiscount && (
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#EDEBE9]/80">
                          <span className="text-[10px] font-semibold text-[#605E5C]">
                            {isSw ? 'Punguzo (%)' : 'Discount (%)'}
                            {!pricing.canApproveHighDiscount && (
                              <span className="text-[9px] text-[#605E5C]"> · max {taxSettings.maxDiscountPercent}%</span>
                            )}
                          </span>
                          <input
                            type="number"
                            min={0}
                            max={pricing.canApproveHighDiscount ? 100 : taxSettings.maxDiscountPercent}
                            value={item.discountPercent || ''}
                            placeholder="0"
                            onChange={e => handleUpdateDiscount(item.product.id, e.target.value)}
                            className="w-14 text-center text-[10px] font-bold bg-white border border-[#EDEBE9] rounded py-0.5 outline-none focus:border-[#6264A7]"
                          />
                        </div>
                      )}
                      {pricing.canOverridePrice && (
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#EDEBE9]/80">
                          <span className="text-[10px] font-semibold text-[#605E5C]">
                            {isSw ? 'Bei (kubadilisha)' : 'Unit price'}
                          </span>
                          <input
                            type="number"
                            min={1}
                            value={item.unitPriceOverride ?? item.product.price}
                            onChange={e => handleUpdateUnitPrice(item.product.id, e.target.value)}
                            className="w-20 text-center text-[10px] font-bold bg-white border border-[#EDEBE9] rounded py-0.5 outline-none focus:border-[#6264A7]"
                          />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Checkout & Settlement Area */}
          <div className="border-t border-[#F3F2F1] pt-3 space-y-3">
            {/* Totals Breakdown */}
            <div className="space-y-1 text-xs text-[#605E5C]">
              {taxSettings.discountEnabled && taxSettings.showDiscountOnReceipts && discountAmount > 0 && (
                <>
                  <div className="flex justify-between">
                    <span>{isSw ? 'Jumla kabla ya punguzo' : 'Gross subtotal'}:</span>
                    <span className="font-semibold text-[#323130]">{formatTSh(grossSubtotal)}</span>
                  </div>
                  <div className="flex justify-between text-amber-700">
                    <span>{isSw ? 'Punguzo' : 'Discount'}:</span>
                    <span className="font-semibold">- {formatTSh(discountAmount)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between">
                <span>{t('subtotal')}:</span>
                <span className="font-semibold text-[#323130]">{formatTSh(subtotal)}</span>
              </div>
              {taxSettings.cartDiscountEnabled && pricing.canApplyDiscount && (
                <div className="flex justify-between items-center gap-2">
                  <span>{isSw ? 'Punguzo la gari (%)' : 'Cart discount (%)'}:</span>
                  <input
                    type="number"
                    min={0}
                    max={taxSettings.maxDiscountPercent}
                    value={cartDiscountPercent}
                    onChange={e => setCartDiscountPercent(capDiscountPercent(Number(e.target.value) || 0, taxSettings))}
                    className="w-16 px-2 py-0.5 border border-[#C8C6C4] rounded text-right font-semibold text-[#323130]"
                  />
                </div>
              )}
              {!canToggleSaleVat && taxSettings.mode !== 'tra_efd' && (
                <p className="text-[10px] text-[#8A8886] leading-snug py-0.5">
                  {isSw
                    ? 'Chaguo la Na VAT / Bila VAT linaonekana tu duka lililosajiliwa VAT (Mipangilio → TRA/VAT). Hakikisha tawi halibatilishi hali ya VAT.'
                    : 'With VAT / No VAT appears only when the shop is VAT-registered (Settings → TRA/VAT). Ensure the branch inherits org VAT status.'}
                </p>
              )}
              {canToggleSaleVat && (
                <div className="flex items-center justify-between gap-2 py-1">
                  <span className="font-semibold text-[#323130]">{isSw ? 'VAT 18% kwenye mauzo' : 'VAT 18% on this sale'}</span>
                  <div className="grid grid-cols-2 gap-1 bg-[#F3F2F1] p-0.5 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setApplyVatThisSale(true)}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-bold cursor-pointer transition-colors ${
                        applyVatThisSale ? 'bg-[#107C10] text-white shadow-sm' : 'text-[#605E5C] hover:text-[#323130]'
                      }`}
                    >
                      {isSw ? 'Na VAT' : 'With VAT'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setApplyVatThisSale(false)}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-bold cursor-pointer transition-colors ${
                        !applyVatThisSale ? 'bg-[#323130] text-white shadow-sm' : 'text-[#605E5C] hover:text-[#323130]'
                      }`}
                    >
                      {isSw ? 'Bila VAT' : 'No VAT'}
                    </button>
                  </div>
                </div>
              )}
              {saleVatActive && saleTaxSettings.showVatOnReceipt && (
                <div className="flex justify-between">
                  <span>{formatVatLabel(saleTaxSettings, isSw)}:</span>
                  <span className="font-semibold text-[#323130]">{formatTSh(vatAmount)}</span>
                </div>
              )}
              {!saleVatActive && canToggleSaleVat && (
                <div className="flex justify-between text-[10px] text-[#8A8886]">
                  <span>{isSw ? 'Mauzo bila VAT' : 'Sale without VAT'}</span>
                  <span>TSh 0</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-extrabold text-[#323130] pt-1 border-t border-[#EDEBE9]">
                <span>{t('totalPayable')}:</span>
                <span className="text-[#0078D4] text-base">{formatTSh(total)}</span>
              </div>
            </div>

            {/* Payment Mode Selector: Full / Partial / Credit */}
            {pricing.canUsePartialPayment && (
            <div>
              <label className="block text-[11px] font-bold text-[#323130] mb-1">{t('paymentType')}</label>
              <div className="grid grid-cols-3 gap-1.5 text-xs">
                {(['full', 'partial', 'credit'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => {
                      setPaymentMode(mode);
                      setValidationError(null);
                    }}
                    className={`py-1.5 rounded-lg font-semibold text-xs transition-all cursor-pointer ${
                      paymentMode === mode
                        ? 'bg-[#6264A7] text-white shadow-xs font-bold'
                        : 'bg-[#F3F2F1] text-[#605E5C] hover:text-[#323130]'
                    }`}
                  >
                    {mode === 'full' ? (isSw ? 'Taslimu (Full)' : 'Full') : 
                     mode === 'partial' ? (isSw ? 'Awamu (Partial)' : 'Partial') : 
                     (isSw ? 'Mkopo (Credit)' : 'Credit Sale')}
                  </button>
                ))}
              </div>
            </div>
            )}

            {/* Payment Method Selector */}
            {paymentMode !== 'credit' && (
              <div>
                <label className="block text-[11px] font-bold text-[#323130] mb-1">
                  {isSw ? 'Njia ya Malipo' : 'Payment Method'}
                </label>
                <div className="grid grid-cols-4 gap-1 text-xs">
                  {[
                    { key: 'cash', label: '💵 Cash' },
                    { key: 'mpesa', label: '📱 M-Pesa' },
                    { key: 'airtel', label: '🔴 Airtel' },
                    { key: 'card', label: '💳 Card' },
                  ].map(m => (
                    <button
                      key={m.key}
                      onClick={() => setSelectedPaymentMethod(m.key as PaymentMethod)}
                      className={`py-1 rounded-md text-[11px] font-medium border transition-all cursor-pointer ${
                        selectedPaymentMethod === m.key
                          ? 'bg-[#0078D4] text-white border-[#0078D4] font-bold'
                          : 'bg-[#FAF9F8] border-[#EDEBE9] text-[#605E5C]'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Amount Paid input if partial */}
            {paymentMode === 'partial' && (
              <div className="p-2 bg-amber-50/60 rounded-lg border border-amber-200">
                <label className="block text-[11px] font-bold text-[#323130] mb-1">
                  {isSw ? 'Kiasi cha Awamu ya Kwanza (Down Payment)' : 'Initial Down Payment (TSh)'}
                </label>
                <input
                  type="number"
                  placeholder="e.g. 50000"
                  value={amountPaidInput}
                  onChange={e => setAmountPaidInput(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-[#EDEBE9] rounded-lg focus:border-[#0078D4] outline-none font-bold"
                />
                {balanceRemaining > 0 && (
                  <div className="text-[10px] text-[#D13438] font-bold mt-1">
                    {isSw 
                      ? `Salio la ${formatTSh(balanceRemaining)} litaandikwa kama deni kwa mteja.`
                      : `Remaining ${formatTSh(balanceRemaining)} will be posted to customer credit balance.`}
                  </div>
                )}
              </div>
            )}

            {needsDueDate && (
              <div className="p-2 bg-orange-50/70 rounded-lg border border-orange-200 space-y-1">
                <label className="block text-[11px] font-bold text-[#323130]">
                  {isSw ? 'Tarehe ya Malipo (Due Date) *' : 'Payment Due Date *'}
                </label>
                <input
                  type="date"
                  required
                  min={todayIsoDate()}
                  value={paymentDueDate}
                  onChange={e => {
                    const next = e.target.value;
                    if (next && validatePaymentDueDate(next, isSw)) {
                      setValidationError(validatePaymentDueDate(next, isSw));
                    } else {
                      setValidationError(null);
                    }
                    setPaymentDueDate(next);
                  }}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-[#EDEBE9] rounded-lg focus:border-[#0078D4] outline-none font-semibold"
                />
                <p className="text-[10px] text-[#605E5C]">
                  {isSw
                    ? 'Haiwezekani kuweka tarehe ya zamani. Inaonekana kwenye risiti, ankara, na ripoti za madeni.'
                    : 'Past dates are not allowed. Shown on receipt, invoice, and receivables.'}
                  {paymentDueDate ? ` · ${formatDueDateDisplay(paymentDueDate)}` : ''}
                </p>
              </div>
            )}

            {/* Park vs complete — two clearly different sale paths */}
            <p className="text-[10px] text-[#605E5C] leading-snug px-0.5">
              {isSw
                ? 'Chagua moja: Lipa & Kamilisha = mauzo ya kawaida yenye malipo sasa. Hifadhi Bila Malipo = weka foleni, malipo baadaye.'
                : 'Choose one: Take Payment & Finish = normal sale with payment now. Park Sale = hold cart for later payment.'}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                id="btn-save-and-next"
                type="button"
                disabled={cart.length === 0}
                onClick={handleSaveAndNext}
                title={isSw ? 'Hifadhi bila malipo — mteja anayefuata' : 'Park sale without payment — serve next customer'}
                className={`py-2.5 rounded-xl font-bold text-xs flex flex-col items-center justify-center gap-0.5 shadow-md transition-all active:scale-[0.98] ${
                  cart.length === 0
                    ? 'bg-[#EDEBE9] text-[#A19F9D] cursor-not-allowed'
                    : 'bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:brightness-105 cursor-pointer'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  {isSw ? 'Hifadhi Bila Malipo' : 'Park Sale (No Payment)'}
                </span>
                <span className={`text-[9px] font-semibold ${cart.length === 0 ? 'opacity-60' : 'opacity-90'}`}>
                  {isSw ? 'Malipo baadaye · mteja mpya' : 'Pay later · next customer'}
                </span>
              </button>
              <button
                id="btn-complete-sale"
                disabled={cart.length === 0}
                onClick={handleExecuteSale}
                title={isSw ? 'Mauzo ya kawaida — chukua malipo sasa' : 'Normal sale — take payment now'}
                className={`py-2.5 rounded-xl font-bold text-xs flex flex-col items-center justify-center gap-0.5 shadow-md transition-all active:scale-[0.98] ${
                  cart.length === 0
                    ? 'bg-[#EDEBE9] text-[#A19F9D] cursor-not-allowed'
                    : isCustomerMissingForCredit
                      ? 'bg-gradient-to-r from-rose-600 to-amber-600 text-white cursor-pointer hover:brightness-105'
                      : 'bg-gradient-to-r from-[#107C10] to-[#0078D4] text-white hover:brightness-105 cursor-pointer'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  {isCustomerMissingForCredit
                    ? (isSw ? '⚠️ Chagua Mteja' : '⚠️ Select Customer')
                    : (isSw ? 'Lipa & Kamilisha' : 'Take Payment & Finish')}
                </span>
                {!isCustomerMissingForCredit && (
                  <span className={`text-[9px] font-semibold ${cart.length === 0 ? 'opacity-60' : 'opacity-90'}`}>
                    {isSw ? 'Mauzo ya kawaida · malipo sasa' : 'Normal sale · payment now'}
                  </span>
                )}
              </button>
            </div>
            {pendingCount > 0 && onOpenPending && (
              <button
                type="button"
                onClick={onOpenPending}
                className="w-full py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold cursor-pointer flex items-center justify-center gap-2"
              >
                <Clock className="w-3.5 h-3.5" />
                {isSw
                  ? `${pendingCount} mauzo yanasubiri malipo — bofya kukamilisha`
                  : `${pendingCount} sale(s) awaiting payment — tap to complete`}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ON-THE-FLY CUSTOMER CREATION MODAL DIRECTLY AT POS REGISTER               */}
      {/* ========================================================================= */}
      {isNewCustomerModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#E1DFDD] space-y-4">
            <div className="flex items-center justify-between border-b border-[#F3F2F1] pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-[#6264A7]/10 text-[#6264A7]">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-[#323130]">
                    {isSw ? 'Sajili Mteja Mpya Papo Hapo' : 'Register Customer at POS'}
                  </h3>
                  <p className="text-[11px] text-[#605E5C]">
                    {isSw ? 'Akaunti itaundwa na kuchaguliwa kiotomatiki kwa ajili ya mauzo haya' : 'Account will be created and auto-selected for this sale'}
                  </p>
                </div>
              </div>
              <button onClick={() => setIsNewCustomerModalOpen(false)} className="text-[#605E5C] hover:text-[#323130]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleQuickCreateCustomer} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-[#323130] mb-1">
                  {isSw ? 'Jina Kamili la Mteja *' : 'Full Customer Name *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dkt. Emanuel Msuya"
                  value={newCustomerForm.name}
                  onChange={e => setNewCustomerForm({ ...newCustomerForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F3F2F1] border border-[#EDEBE9] rounded-xl focus:bg-white focus:border-[#0078D4] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-[#323130] mb-1">
                    {isSw ? 'Namba ya Simu *' : 'Phone Number *'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="+255 7..."
                    value={newCustomerForm.phone}
                    onChange={e => setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F3F2F1] border border-[#EDEBE9] rounded-xl focus:bg-white focus:border-[#0078D4] outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#323130] mb-1">
                    {isSw ? 'Kikomo cha Mkopo (TSh)' : 'Credit Limit (TSh)'}
                  </label>
                  <input
                    type="number"
                    value={newCustomerForm.creditLimit}
                    onChange={e => setNewCustomerForm({ ...newCustomerForm, creditLimit: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F3F2F1] border border-[#EDEBE9] rounded-xl focus:bg-white focus:border-[#0078D4] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#323130] mb-1">
                  {isSw ? 'Eneo / Anwani' : 'Location / Address'}
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sinza Kijiweni, Dar es Salaam"
                  value={newCustomerForm.address}
                  onChange={e => setNewCustomerForm({ ...newCustomerForm, address: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F3F2F1] border border-[#EDEBE9] rounded-xl focus:bg-white focus:border-[#0078D4] outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isCreatingCustomer}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#6264A7] to-[#0078D4] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md hover:brightness-105 active:scale-95 cursor-pointer disabled:opacity-60"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isCreatingCustomer ? (isSw ? 'Inahifadhi...' : 'Saving...') : (isSw ? 'Hifadhi & Chagua Mteja' : 'Save & Select for Sale')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsNewCustomerModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-[#F3F2F1] text-[#323130] font-semibold text-xs"
                >
                  {isSw ? 'Ghairi' : 'Cancel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* COMPLETED SALE RECEIPT PREVIEW (INLINE DIALOG) */}
      {lastCompletedSale && (
        <div className="bg-white rounded-xl p-6 border-2 border-[#107C10] shadow-xl max-w-md mx-auto space-y-4 text-xs">
          <div className="flex items-center justify-between border-b border-[#F3F2F1] pb-3">
            <div className="flex items-center gap-2 text-[#107C10] font-bold">
              <CheckCircle2 className="w-5 h-5" />
              <span>
                {taxSettings.mode === 'tra_efd'
                  ? (isSw ? 'Risiti ya TRA EFD Imetolewa' : 'TRA EFD Receipt Issued')
                  : (isSw ? 'Risiti ya Mauzo Imetolewa' : 'Sales Receipt Issued')}
              </span>
            </div>
            <button onClick={() => setLastCompletedSale(null)} className="text-[#605E5C]">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="text-center font-mono text-[#323130] space-y-1">
            <div className="font-extrabold text-sm">{taxSettings.receiptBusinessName || (isSw ? workplace.label_sw : workplace.label_en)}</div>
            {(taxSettings.tinNumber || taxSettings.vrnNumber) && (
              <div>
                {taxSettings.tinNumber ? `TIN: ${taxSettings.tinNumber}` : ''}
                {taxSettings.tinNumber && taxSettings.vrnNumber ? ' • ' : ''}
                {taxSettings.vrnNumber ? `VRN: ${taxSettings.vrnNumber}` : ''}
              </div>
            )}
            <div>RECEIPT NO: {lastCompletedSale.receiptNumber}</div>
            <div>CUSTOMER: {lastCompletedSale.customerName || 'Walk-in'}</div>
            <div>DATE: {lastCompletedSale.date}</div>
          </div>

          <div className="border-t border-b border-dashed border-[#C8C6C4] py-2 space-y-1">
            {lastCompletedSale.items.map((it, idx) => (
              <div key={idx} className="flex justify-between gap-2">
                <span className="min-w-0">
                  {it.productName} (x{it.quantity})
                  {(it.discountPercent ?? 0) > 0 && taxSettings.discountEnabled && (
                    <span className="text-amber-700"> · -{it.discountPercent}%</span>
                  )}
                </span>
                <span className="font-mono shrink-0">{formatTSh(it.total)}</span>
              </div>
            ))}
          </div>

          <div className="space-y-1 font-mono">
            {taxSettings.discountEnabled &&
              taxSettings.showDiscountOnReceipts &&
              computeSaleDiscountAmount(lastCompletedSale) > 0 && (
                <>
                  <div className="flex justify-between">
                    <span>{isSw ? 'JUMLA KABLA YA PUNGUZO:' : 'GROSS SUBTOTAL:'}</span>
                    <span>{formatTSh(saleGrossSubtotal(lastCompletedSale))}</span>
                  </div>
                  <div className="flex justify-between text-amber-700 font-bold">
                    <span>{isSw ? 'PUNGUZO:' : 'DISCOUNT:'}</span>
                    <span>- {formatTSh(computeSaleDiscountAmount(lastCompletedSale))}</span>
                  </div>
                </>
              )}
            <div className="flex justify-between">
              <span>SUBTOTAL (EXCL VAT):</span>
              <span>{formatTSh(lastCompletedSale.subtotal)}</span>
            </div>
            {vatActive && taxSettings.showVatOnReceipt && (
              <div className="flex justify-between">
                <span>{formatVatLabel(taxSettings, isSw).toUpperCase()}:</span>
                <span>{formatTSh(lastCompletedSale.vatAmount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-sm text-[#323130] pt-1 border-t border-[#EDEBE9]">
              <span>TOTAL INCL VAT:</span>
              <span>{formatTSh(lastCompletedSale.total)}</span>
            </div>
            <div className="flex justify-between text-[#107C10] font-bold">
              <span>PAID ({lastCompletedSale.payments[0]?.method.toUpperCase()}):</span>
              <span>{formatTSh(lastCompletedSale.paidAmount)}</span>
            </div>
            {lastCompletedSale.balanceRemaining > 0 && (
              <>
                <div className="flex justify-between text-[#D13438] font-bold">
                  <span>POSTED TO CREDIT BALANCE:</span>
                  <span>{formatTSh(lastCompletedSale.balanceRemaining)}</span>
                </div>
                {lastCompletedSale.paymentDueDate && (
                  <div className="flex justify-between text-[#E65100] font-bold">
                    <span>{isSw ? 'TAREHE YA MALIPO:' : 'PAYMENT DUE:'}</span>
                    <span>{formatDueDateDisplay(lastCompletedSale.paymentDueDate)}</span>
                  </div>
                )}
              </>
            )}
          </div>

          {lastTraReceipt && taxSettings.mode === 'tra_efd' && (
            <div className="pt-2 text-center text-[10px] text-[#605E5C] border-t border-[#EDEBE9] space-y-1">
              <div className="font-mono">VERIFICATION: {lastTraReceipt.verificationCode}</div>
              {lastTraReceipt.verificationQrDataUrl && (
                <img
                  src={lastTraReceipt.verificationQrDataUrl}
                  alt="TRA QR"
                  className="mx-auto w-20 h-20"
                />
              )}
              {lastTraReceipt.verificationLink && (
                <a
                  href={lastTraReceipt.verificationLink}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#0078D4] underline block truncate"
                >
                  {lastTraReceipt.verificationLink}
                </a>
              )}
            </div>
          )}
          {!lastTraReceipt && lastCompletedSale.traEfdSignature && taxSettings.mode === 'tra_efd' && (
            <div className="pt-2 text-center text-[10px] text-[#605E5C] font-mono border-t border-[#EDEBE9]">
              SIGNATURE: {lastCompletedSale.traEfdSignature}
            </div>
          )}
          {taxSettings.receiptFooterNote && (
            <div className="text-center text-[10px] text-[#605E5C]">{taxSettings.receiptFooterNote}</div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => {
                if (!lastCompletedSale) return;
                const tpl = getActive('invoice');
                const data = saleReceiptRenderData(lastCompletedSale, isSw, {
                  showDiscount: taxSettings.showDiscountOnDocuments && taxSettings.discountEnabled,
                });
                printDocument(tpl, data, config.branding, isSw);
                setLastCompletedSale(null);
              }}
              className="flex-1 py-2 rounded-lg bg-[#0078D4] hover:bg-[#006cbd] text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Thermal Receipt</span>
            </button>
            <button
              onClick={() => setLastCompletedSale(null)}
              className="px-4 py-2 rounded-lg bg-[#F3F2F1] text-[#323130] font-semibold text-xs"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* POS QR Scanner Modal */}
      <POSQRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        products={products}
        onProductScanned={handleAddToCart}
        language={language}
      />
    </div>
  );
};
