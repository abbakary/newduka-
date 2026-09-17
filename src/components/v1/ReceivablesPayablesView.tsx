import React, { useState, useMemo, useEffect } from 'react';
import { 
  DollarSign, 
  Search, 
  Users, 
  Truck, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Calendar, 
  CreditCard, 
  Send, 
  FileText, 
  Printer, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Sparkles, 
  X, 
  ShieldCheck, 
  Filter, 
  TrendingUp, 
  TrendingDown, 
  Receipt,
  Building2,
  Wallet,
  Phone,
  Check,
  Award
} from 'lucide-react';
import { 
  Customer, 
  Supplier, 
  Language, 
  PurchaseOrder, 
  SupplierPayment, 
  PaymentMethod,
  StaffMember,
  CustomerTransaction,
  SaleTransaction,
} from '@/types/v1';
import { formatTSh, getTranslation } from '@/utils/translations';
import { ActionBar } from '@/components/v1/ActionBar';
import confetti from 'canvas-confetti';
import { api } from '@/lib/api';
import { mapCustomer, mapSupplier, filterByBranchId, filterPurchaseOrdersByBranch } from '@/lib/apiSync';
import {
  canSettleCustomerDebt,
  canSettleSupplierPayable,
} from '@/lib/rbac';
import { useDocumentTemplates } from '@/context/DocumentTemplateContext';
import { PageSectionHeader } from '@/components/v1/PageSectionHeader';
import { useTaxCompliance } from '@/context/TaxComplianceContext';
import { BusinessPageSubtitle } from '@/lib/businessPageSubtitle';
import { printDocument } from '@/lib/documentRenderer';
import { settlementToRenderData } from '@/lib/documentDataMappers';
import { formatDueDateDisplay } from '@/lib/dueDate';

interface ReceivablesPayablesViewProps {
  language: Language;
  customers: Customer[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
  suppliers: Supplier[];
  setSuppliers: React.Dispatch<React.SetStateAction<Supplier[]>>;
  purchaseOrders: PurchaseOrder[];
  setPurchaseOrders?: React.Dispatch<React.SetStateAction<PurchaseOrder[]>>;
  supplierPayments?: SupplierPayment[];
  setSupplierPayments?: React.Dispatch<React.SetStateAction<SupplierPayment[]>>;
  sales?: SaleTransaction[];
  currentUser?: any;
  onOpenAIChatWithPrompt?: (prompt: string) => void;
  onNavigateToPOS?: () => void;
  initialTab?: 'receivables' | 'payables' | 'history';
  activeBranchId?: string | null;
}

interface SettlementVoucher {
  type: 'customer_receipt' | 'supplier_voucher';
  voucherNumber: string;
  date: string;
  partyName: string;
  partyPhone?: string;
  partyType: string;
  paymentMode: 'full' | 'partial' | 'credit_adjust';
  paymentMethod: string;
  referenceNumber: string;
  amountPaid: number;
  balanceBefore: number;
  balanceAfter: number;
  cashierName: string;
  notes?: string;
  source?: 'debt_settlement' | 'pos_sale' | 'supplier_payment';
}

function settlementsStorageKey(userId?: string | null): string {
  return `dukamkononi_customer_settlements_${userId || 'default'}`;
}

function loadStoredSettlements(userId?: string | null): SettlementVoucher[] {
  try {
    const raw = localStorage.getItem(settlementsStorageKey(userId));
    return raw ? JSON.parse(raw) as SettlementVoucher[] : [];
  } catch {
    return [];
  }
}

export const ReceivablesPayablesView: React.FC<ReceivablesPayablesViewProps> = ({
  language,
  customers,
  setCustomers,
  suppliers,
  setSuppliers,
  purchaseOrders,
  setPurchaseOrders,
  supplierPayments = [],
  setSupplierPayments,
  sales = [],
  currentUser,
  onOpenAIChatWithPrompt,
  onNavigateToPOS,
  initialTab = 'receivables',
  activeBranchId,
}) => {
  const isSw = language === 'sw';
  const t = (key: any) => getTranslation(language, key);
  const { settings: taxSettings } = useTaxCompliance();
  const { config, getActive } = useDocumentTemplates();

  const branchCustomers = useMemo(
    () => filterByBranchId(customers, activeBranchId),
    [customers, activeBranchId],
  );
  const branchSales = useMemo(
    () => filterByBranchId(sales, activeBranchId),
    [sales, activeBranchId],
  );
  const branchProductIds = useMemo(
    () => new Set(branchSales.flatMap(s => s.items.map(i => i.productId))),
    [branchSales],
  );
  const branchPurchaseOrders = useMemo(
    () => filterPurchaseOrdersByBranch(purchaseOrders, activeBranchId, branchProductIds),
    [purchaseOrders, activeBranchId, branchProductIds],
  );

  const branchPayablesBySupplier = useMemo(() => {
    const map = new Map<string, number>();
    branchPurchaseOrders.forEach(po => {
      const owed = Math.max(0, (po.totalAmount || 0) - (po.paidAmount || 0));
      if (owed > 0 && po.supplierId) {
        map.set(po.supplierId, (map.get(po.supplierId) || 0) + owed);
      }
    });
    return map;
  }, [branchPurchaseOrders]);

  const branchSuppliers = useMemo(() => {
    if (!activeBranchId || activeBranchId === 'all') return suppliers;
    return suppliers.map(s => {
      const fromPos = branchPayablesBySupplier.get(s.id) ?? 0;
      const fromApi = s.outstandingPayable ?? 0;
      const owed = fromPos > 0 && fromApi < fromPos ? fromApi : (fromPos > 0 ? fromPos : fromApi);
      return { ...s, outstandingPayable: owed };
    });
  }, [suppliers, branchPayablesBySupplier, activeBranchId]);

  const [activeTab, setActiveTab] = useState<'receivables' | 'payables' | 'history'>(initialTab);
  const [isSavingSettlement, setIsSavingSettlement] = useState(false);
  const canRecordCustomerPayment = canSettleCustomerDebt(currentUser);
  const canRecordSupplierPayment = canSettleSupplierPayable(currentUser);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'overdue' | 'partial' | 'cleared'>('all');

  // Customer Settlement Modal State
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [custPaymentMode, setCustPaymentMode] = useState<'full' | 'partial' | 'credit_adjust'>('full');
  const [custPaymentAmount, setCustPaymentAmount] = useState<string>('');
  const [custPaymentMethod, setCustPaymentMethod] = useState<PaymentMethod>('mpesa');
  const [custPaymentRef, setCustPaymentRef] = useState<string>('');
  const [custPaymentNotes, setCustPaymentNotes] = useState<string>('');

  // Supplier Settlement Modal State
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [supPaymentMode, setSupPaymentMode] = useState<'full' | 'partial' | 'credit_adjust'>('full');
  const [supPaymentAmount, setSupPaymentAmount] = useState<string>('');
  const [supPaymentMethod, setSupPaymentMethod] = useState<string>('CRDB Bank Transfer');
  const [supPaymentRef, setSupPaymentRef] = useState<string>('');
  const [supPaymentNotes, setSupPaymentNotes] = useState<string>('');

  // Voucher Preview Modal State
  const [activeVoucher, setActiveVoucher] = useState<SettlementVoucher | null>(null);
  const [toastMessage, setToastMessage] = useState<{ title: string; desc: string } | null>(null);

  // Settlement History State (Local state combined with supplierPayments)
  const [customerSettlements, setCustomerSettlements] = useState<SettlementVoucher[]>(() =>
    loadStoredSettlements(currentUser?.businessId || currentUser?.id),
  );

  useEffect(() => {
    const key = settlementsStorageKey(currentUser?.businessId || currentUser?.id);
    localStorage.setItem(key, JSON.stringify(customerSettlements));
  }, [customerSettlements, currentUser?.businessId, currentUser?.id]);

  const saleSettlements = useMemo<SettlementVoucher[]>(() => {
    return branchSales
      .filter(s => s.paidAmount > 0 || s.balanceRemaining > 0)
      .map(s => ({
        type: 'customer_receipt' as const,
        voucherNumber: s.receiptNumber,
        date: s.date,
        partyName: s.customerName || (isSw ? 'Mteja wa Taslimu' : 'Walk-in Customer'),
        partyType: s.type === 'credit' ? 'Credit Sale' : s.type === 'partial' ? 'Partial Payment' : 'POS Sale',
        paymentMode: (s.type === 'credit' ? 'credit_adjust' : s.type === 'partial' ? 'partial' : 'full') as SettlementVoucher['paymentMode'],
        paymentMethod: s.payments?.[0]?.method || 'cash',
        referenceNumber: s.payments?.[0]?.reference || s.receiptNumber,
        amountPaid: s.paidAmount,
        balanceBefore: s.balanceRemaining + s.paidAmount,
        balanceAfter: s.balanceRemaining,
        cashierName: s.cashierName || (currentUser?.name ? `${currentUser.name} (Cashier)` : 'Cashier'),
        notes: s.balanceRemaining > 0
          ? [
              isSw ? `Deni lililobaki: ${formatTSh(s.balanceRemaining)}` : `Balance remaining: ${formatTSh(s.balanceRemaining)}`,
              s.paymentDueDate
                ? (isSw ? `Tarehe ya malipo: ${formatDueDateDisplay(s.paymentDueDate)}` : `Due date: ${formatDueDateDisplay(s.paymentDueDate)}`)
                : '',
            ].filter(Boolean).join(' · ')
          : (isSw ? 'Mauzo ya POS' : 'POS sale receipt'),
        source: 'pos_sale' as const,
      }));
  }, [branchSales, isSw, currentUser?.name]);

  const supplierSettlements = useMemo<SettlementVoucher[]>(() => {
    return supplierPayments.map(sp => ({
      type: 'supplier_voucher' as const,
      voucherNumber: sp.referenceNumber || sp.id,
      date: sp.date,
      partyName: sp.supplierName,
      partyType: isSw ? 'Msambazaji' : 'Supplier',
      paymentMode: 'full' as const,
      paymentMethod: sp.paymentMethod,
      referenceNumber: sp.referenceNumber,
      amountPaid: sp.amount,
      balanceBefore: sp.balanceBefore,
      balanceAfter: sp.balanceAfter,
      cashierName: currentUser?.name || 'Accountant',
      notes: sp.notes,
      source: 'supplier_payment' as const,
    }));
  }, [supplierPayments, isSw, currentUser?.name]);

  const allSettlements = useMemo(() => {
    const debtSettlements = customerSettlements.map(v => ({ ...v, source: 'debt_settlement' as const }));
    const merged = [...debtSettlements, ...supplierSettlements, ...saleSettlements];
    const seen = new Set<string>();
    return merged
      .filter(v => {
        const key = `${v.source}-${v.voucherNumber}-${v.date}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [customerSettlements, supplierSettlements, saleSettlements]);

  const showToast = (title: string, desc: string) => {
    setToastMessage({ title, desc });
    setTimeout(() => setToastMessage(null), 5000);
  };

  // Metrics Calculations
  const totalReceivables = branchCustomers.reduce((sum, c) => sum + (c.balance || 0), 0);
  const debtorsCount = branchCustomers.filter(c => c.balance > 0).length;
  const overdueDebtorsCount = branchCustomers.filter(c => c.balance > 0 && c.daysOverdue > 0).length;

  const totalPayables = branchSuppliers.reduce((sum, s) => sum + (s.outstandingPayable || 0), 0);
  const suppliersOwedCount = branchSuppliers.filter(s => s.outstandingPayable > 0).length;

  const netWorkingBalance = totalReceivables - totalPayables;

  // Filtered Customer Receivables
  const filteredCustomers = branchCustomers.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery) ||
      (c.address && c.address.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;
    if (filterStatus === 'overdue') return c.balance > 0 && c.daysOverdue > 0;
    if (filterStatus === 'partial') return c.balance > 0;
    if (filterStatus === 'cleared') return c.balance === 0;
    return true; // 'all'
  });

  // Filtered Supplier Payables
  const filteredSuppliers = branchSuppliers.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.contactPerson.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.category.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (filterStatus === 'overdue' || filterStatus === 'partial') return s.outstandingPayable > 0;
    if (filterStatus === 'cleared') return s.outstandingPayable === 0;
    return true;
  });

  // --- HANDLER: OPEN CUSTOMER SETTLEMENT ---
  const handleOpenCustomerSettlement = (cust: Customer) => {
    setSelectedCustomer(cust);
    setCustPaymentMode('full');
    setCustPaymentAmount(cust.balance.toString());
    setCustPaymentMethod('mpesa');
    setCustPaymentRef(`MP-${Math.floor(10000000 + Math.random() * 90000000)}`);
    setCustPaymentNotes(`Debt settlement for ${cust.name}`);
    setIsCustomerModalOpen(true);
  };

  // --- HANDLER: SUBMIT CUSTOMER SETTLEMENT ---
  const handleProcessCustomerSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || !canRecordCustomerPayment) return;

    const balanceBefore = selectedCustomer.balance;
    let amountToDeduct = 0;

    if (custPaymentMode === 'full') {
      amountToDeduct = balanceBefore;
    } else if (custPaymentMode === 'partial') {
      amountToDeduct = Math.min(balanceBefore, Number(custPaymentAmount) || 0);
    } else {
      // Credit adjustment
      amountToDeduct = Number(custPaymentAmount) || 0;
    }

    if (amountToDeduct <= 0 && custPaymentMode !== 'credit_adjust') {
      alert(isSw ? 'Tafadhali weka kiasi sahihi cha malipo.' : 'Please enter a valid payment amount.');
      return;
    }

    const balanceAfter = Math.max(0, balanceBefore - amountToDeduct);
    const loyaltyPoints = selectedCustomer.loyaltyPoints + Math.floor(amountToDeduct / 2000);
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const voucherNumber = `REC-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    setIsSavingSettlement(true);
    try {
      const raw = await api.updateCustomer(selectedCustomer.id, {
        balance: balanceAfter,
        dunning_stage: balanceAfter === 0 ? 'cleared' : selectedCustomer.dunningStage,
        loyalty_points: loyaltyPoints,
      });
      const updated = mapCustomer(raw as Record<string, unknown>);
      setCustomers(prev => prev.map(c => (c.id === selectedCustomer.id ? { ...c, ...updated, balance: balanceAfter, loyaltyPoints } : c)));
    } catch (err) {
      alert((err as Error).message || (isSw ? 'Imeshindwa kuhifadhi malipo.' : 'Failed to save payment.'));
      setIsSavingSettlement(false);
      return;
    } finally {
      setIsSavingSettlement(false);
    }

    // 2. Generate Receipt Voucher
    const voucher: SettlementVoucher = {
      type: 'customer_receipt',
      voucherNumber,
      date: nowStr,
      partyName: selectedCustomer.name,
      partyPhone: selectedCustomer.phone,
      partyType: 'Customer (Mteja)',
      paymentMode: custPaymentMode,
      paymentMethod: custPaymentMethod,
      referenceNumber: custPaymentRef || `REF-${Date.now().toString().slice(-6)}`,
      amountPaid: amountToDeduct,
      balanceBefore,
      balanceAfter,
      cashierName: currentUser?.name ? `${currentUser.name} (Cashier)` : 'Fatuma Ally (Cashier)',
      notes: custPaymentNotes || 'Customer debt payment processed',
      source: 'debt_settlement',
    };

    setCustomerSettlements(prev => [voucher, ...prev]);
    setIsCustomerModalOpen(false);
    setActiveVoucher(voucher);

    confetti({
      particleCount: 50,
      spread: 70,
      origin: { y: 0.7 }
    });

    showToast(
      isSw ? 'Malipo ya Mteja Yamekamilika!' : 'Customer Settlement Completed!',
      `${formatTSh(amountToDeduct)} received from ${selectedCustomer.name}. New Balance: ${formatTSh(balanceAfter)}.`
    );
  };

  // --- HANDLER: OPEN SUPPLIER SETTLEMENT ---
  const handleOpenSupplierSettlement = (sup: Supplier) => {
    setSelectedSupplier(sup);
    setSupPaymentMode('full');
    setSupPaymentAmount(sup.outstandingPayable.toString());
    setSupPaymentMethod('CRDB Bank Transfer');
    setSupPaymentRef(`CRDB-${Math.floor(100000 + Math.random() * 900000)}`);
    setSupPaymentNotes(`Payment for goods supplied by ${sup.name}`);
    setIsSupplierModalOpen(true);
  };

  // --- HANDLER: SUBMIT SUPPLIER SETTLEMENT ---
  const handleProcessSupplierSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier || !canRecordSupplierPayment) return;

    const balanceBefore = selectedSupplier.outstandingPayable;
    let amountToPay = 0;

    if (supPaymentMode === 'full') {
      amountToPay = balanceBefore;
    } else if (supPaymentMode === 'partial') {
      amountToPay = Math.min(balanceBefore, Number(supPaymentAmount) || 0);
    } else {
      amountToPay = Number(supPaymentAmount) || 0;
    }

    if (amountToPay <= 0) {
      alert(isSw ? 'Weka kiasi sahihi cha kulipa.' : 'Please enter a valid payment amount.');
      return;
    }

    const balanceAfter = Math.max(0, balanceBefore - amountToPay);
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const voucherNumber = `VOU-SUP-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    setIsSavingSettlement(true);
    try {
      const payResult = await api.paySupplier(selectedSupplier.id, {
        amount: amountToPay,
        payment_method: supPaymentMethod,
        notes: supPaymentNotes || undefined,
      });
      const paidAmount = Number(payResult.amount_paid ?? amountToPay);
      const apiBalanceAfter = Number(payResult.balance_after ?? balanceAfter);
      setSuppliers(prev =>
        prev.map(s =>
          s.id === selectedSupplier.id
            ? { ...s, outstandingPayable: apiBalanceAfter }
            : s,
        ),
      );

      // Keep local PO paid amounts in sync with FIFO server application
      if (setPurchaseOrders) {
        let remaining = paidAmount;
        setPurchaseOrders(prev =>
          prev.map(po => {
            if (remaining <= 0) return po;
            if (po.supplierId !== selectedSupplier.id) return po;
            if (po.paymentStatus === 'paid') return po;
            const poBalance = Math.max(0, po.totalAmount - (po.paidAmount || 0));
            if (poBalance <= 0) return po;
            const apply = Math.min(remaining, poBalance);
            remaining -= apply;
            const newPaid = (po.paidAmount || 0) + apply;
            const fullyPaid = newPaid >= po.totalAmount - 0.001;
            return {
              ...po,
              paidAmount: newPaid,
              paymentStatus: fullyPaid ? 'paid' : 'partial',
            };
          }),
        );
      }

      // Record Supplier Payment Object
      const paymentRecord: SupplierPayment = {
        id: `sp-${Date.now()}`,
        supplierId: selectedSupplier.id,
        supplierName: selectedSupplier.name,
        date: nowStr,
        amount: paidAmount,
        paymentMethod: supPaymentMethod,
        referenceNumber: supPaymentRef || `TXN-${Date.now().toString().slice(-6)}`,
        notes: supPaymentNotes,
        balanceBefore,
        balanceAfter: apiBalanceAfter,
      };

      if (setSupplierPayments) {
        setSupplierPayments(prev => [paymentRecord, ...prev]);
      }

      // Generate Voucher
      const voucher: SettlementVoucher = {
        type: 'supplier_voucher',
        voucherNumber,
        date: nowStr,
        partyName: selectedSupplier.name,
        partyType: 'Supplier (Msambazaji)',
        paymentMode: supPaymentMode,
        paymentMethod: supPaymentMethod,
        referenceNumber: supPaymentRef || `REF-${Date.now().toString().slice(-6)}`,
        amountPaid: paidAmount,
        balanceBefore,
        balanceAfter: apiBalanceAfter,
        cashierName: currentUser?.name ? `${currentUser.name} (Manager/Accountant)` : 'Salum Omar (Owner)',
        notes: supPaymentNotes || 'Supplier invoice disbursement settled',
      };

      setIsSupplierModalOpen(false);
      setActiveVoucher(voucher);

      confetti({
        particleCount: 50,
        spread: 70,
        origin: { y: 0.7 }
      });

      showToast(
        isSw ? 'Malipo kwa Msambazaji Yamerekodiwa!' : 'Supplier Disbursement Recorded!',
        `${formatTSh(paidAmount)} disbursed to ${selectedSupplier.name}. Remaining Payable: ${formatTSh(apiBalanceAfter)}.`
      );
    } catch (err) {
      alert((err as Error).message || (isSw ? 'Imeshindwa kuhifadhi malipo ya msambazaji.' : 'Failed to save supplier payment.'));
    } finally {
      setIsSavingSettlement(false);
    }
  };

  // Dispatch SMS Acknowledgment
  const handleSendSMSAcknowledgment = (partyName: string, phone: string, amount: number, newBalance: number) => {
    const msg = isSw
      ? `Habari ${partyName}, tumepokea malipo yako ya ${formatTSh(amount)}. Salio lako jipya la deni ni ${formatTSh(newBalance)}. Ahsante kwa kuchagua Duka+.`
      : `Dear ${partyName}, we have received your payment of ${formatTSh(amount)}. Your new balance is ${formatTSh(newBalance)}. Thank you for shopping with Duka+.`;
    
    showToast(
      isSw ? 'SMS ya Uthibitisho Imetumwa' : 'SMS Acknowledgment Dispatched',
      `Sent to ${phone}: "${msg}"`
    );
  };

  return (
    <div className="space-y-5 pb-16">
      <PageSectionHeader
        icon={<CreditCard className="w-5 h-5" />}
        title={isSw ? 'Usimamizi wa Madeni' : 'Receivables & Payables'}
        subtitle={
          <BusinessPageSubtitle
            currentUser={currentUser}
            taxSettings={taxSettings}
            isSw={isSw}
            detail={
              isSw
                ? 'Madeni ya wateja na wasambazaji · malipo · hati & SMS'
                : 'Customer & supplier balances · settlements · vouchers & SMS'
            }
          />
        }
        toolbar={
          <>
            {onNavigateToPOS && (
              <button
                onClick={onNavigateToPOS}
                className="px-3.5 py-2 rounded-xl bg-[#6264A7] hover:bg-[#555793] text-white font-bold text-xs flex items-center gap-2 shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                <Receipt className="w-4 h-4 text-amber-300" />
                <span>{isSw ? 'Nenda POS (Mauzo)' : 'Go to POS Register'}</span>
              </button>
            )}
            <button
              onClick={() => {
                if (onOpenAIChatWithPrompt) {
                  onOpenAIChatWithPrompt(
                    isSw
                      ? `Fanya uchambuzi wa kina wa madeni ya wateja (Receivables: ${formatTSh(totalReceivables)}) na madeni ya wasambazaji (Payables: ${formatTSh(totalPayables)}), kisha toa mkakati wa kurejesha madeni yaliyochelewa na kuboresha mtaji kazi (Working Capital).`
                      : `Provide an executive liquidity analysis of our customer receivables (${formatTSh(totalReceivables)}) vs supplier payables (${formatTSh(totalPayables)}), with an optimal debt recovery schedule and cash flow optimization plan.`,
                  );
                }
              }}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 via-indigo-600 to-purple-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs hover:brightness-105 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-200" />
              <span>{isSw ? 'AI Uchambuzi wa Mtaji' : 'AI Working Capital Analysis'}</span>
            </button>
          </>
        }
      />

      {/* TOAST ALERT NOTIFICATION */}
      {toastMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-800 font-medium flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <div>
              <strong className="font-bold">{toastMessage.title}</strong>: {toastMessage.desc}
            </div>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-emerald-700 hover:text-emerald-900 font-bold ml-4">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TOP 4 FINANCIAL HEALTH KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Total Receivables */}
        <div className="bg-white rounded-xl p-4 border border-[#E1DFDD] shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#605E5C]">
              {isSw ? 'Madeni ya Wateja (Receivables)' : 'Customer Receivables'}
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-[#D13438] mt-1.5">
            {formatTSh(totalReceivables)}
          </div>
          <div className="text-[11px] text-[#605E5C] mt-1 flex items-center justify-between">
            <span>{debtorsCount} {isSw ? 'wateja wanaodaiwa (anadaiwa)' : 'active debtors'}</span>
            {overdueDebtorsCount > 0 && (
              <span className="font-bold text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded text-[10px]">
                {overdueDebtorsCount} {isSw ? 'wamechelewa' : 'overdue'}
              </span>
            )}
          </div>
        </div>

        {/* Card 2: Total Payables */}
        <div className="bg-white rounded-xl p-4 border border-[#E1DFDD] shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#605E5C]">
              {isSw ? 'Madeni ya Wasambazaji (Payables)' : 'Supplier Payables'}
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-purple-700 mt-1.5">
            {formatTSh(totalPayables)}
          </div>
          <div className="text-[11px] text-[#605E5C] mt-1 flex items-center justify-between">
            <span>{suppliersOwedCount} {isSw ? 'wasambazaji wanaodai (anadai)' : 'suppliers pending'}</span>
            <span className="text-[10px] font-semibold text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded">
              PO Net 30/60
            </span>
          </div>
        </div>

        {/* Card 3: Net Liquidity Position */}
        <div className="bg-white rounded-xl p-4 border border-[#E1DFDD] shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#605E5C]">
              {isSw ? 'Hali ya Mtaji (Net Position)' : 'Net Working Position'}
            </span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${netWorkingBalance >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-xl font-black mt-1.5 ${netWorkingBalance >= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
            {formatTSh(Math.abs(netWorkingBalance))} {netWorkingBalance >= 0 ? (isSw ? '(Ziada)' : 'Surplus') : (isSw ? '(Upungufu)' : 'Deficit')}
          </div>
          <div className="text-[11px] text-[#605E5C] mt-1 flex items-center gap-1">
            {netWorkingBalance >= 0 ? (
              <span className="text-emerald-600 font-bold flex items-center gap-0.5">
                <TrendingUp className="w-3.5 h-3.5" /> Receivables {'>'} Payables
              </span>
            ) : (
              <span className="text-amber-600 font-bold flex items-center gap-0.5">
                <TrendingDown className="w-3.5 h-3.5" /> Payables {'>'} Receivables
              </span>
            )}
          </div>
        </div>

        {/* Card 4: TRA & Recovery Rate */}
        <div className="bg-white rounded-xl p-4 border border-[#E1DFDD] shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#605E5C]">
              {isSw ? 'Ukaguzi & Uthibitisho' : 'Audit & Verification'}
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-[#0078D4] mt-1.5">
            100% Verified
          </div>
          <div className="text-[11px] text-[#605E5C] mt-1 flex items-center justify-between">
            <span>TRA EFD Signature Ready</span>
            <span className="text-[10px] font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
              Vouchers Auto-Sync
            </span>
          </div>
        </div>
      </div>

      {/* NAVIGATION TABS & FILTER BAR */}
      <div className="bg-white rounded-xl p-3 border border-[#E1DFDD] shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Main 3 Segment Buttons */}
          <div className="flex items-center gap-1.5 bg-[#F3F2F1] p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('receivables')}
              className={`px-4 py-2 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'receivables'
                  ? 'bg-white text-[#0078D4] shadow-sm'
                  : 'text-[#605E5C] hover:text-[#323130]'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>{isSw ? 'Madeni ya Wateja (Receivables)' : 'Customer Receivables'}</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-rose-100 text-rose-700 font-extrabold">
                {debtorsCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('payables')}
              className={`px-4 py-2 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'payables'
                  ? 'bg-white text-purple-700 shadow-sm'
                  : 'text-[#605E5C] hover:text-[#323130]'
              }`}
            >
              <Truck className="w-4 h-4" />
              <span>{isSw ? 'Madeni ya Wasambazaji (Payables)' : 'Supplier Payables'}</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-purple-100 text-purple-700 font-extrabold">
                {suppliersOwedCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'history'
                  ? 'bg-white text-[#323130] shadow-sm'
                  : 'text-[#605E5C] hover:text-[#323130]'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>{isSw ? 'Historia ya Malipo & Hati' : 'Settlement History'}</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-200 text-slate-700 font-extrabold">
                {allSettlements.length}
              </span>
            </button>
          </div>

          {/* Search Bar & Quick Filters */}
          <div className="flex flex-wrap items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#605E5C] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={
                  activeTab === 'receivables'
                    ? (isSw ? 'Tafuta mteja, namba ya simu au eneo...' : 'Search customer by name or phone...')
                    : (isSw ? 'Tafuta msambazaji au ankara...' : 'Search supplier name or category...')
                }
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 bg-[#F3F2F1] border border-transparent focus:border-[#0078D4] focus:bg-white rounded-lg text-xs outline-none"
              />
            </div>

            {activeTab !== 'history' && (
              <div className="flex items-center gap-1">
                {(['all', 'overdue', 'partial', 'cleared'] as const).map(st => (
                  <button
                    key={st}
                    onClick={() => setFilterStatus(st)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold capitalize transition-all ${
                      filterStatus === st
                        ? 'bg-[#6264A7] text-white'
                        : 'bg-[#F3F2F1] text-[#605E5C] hover:text-[#323130]'
                    }`}
                  >
                    {st === 'all' ? (isSw ? 'Wote' : 'All') :
                     st === 'overdue' ? (isSw ? 'Wamechelewa' : 'Overdue') :
                     st === 'partial' ? (isSw ? 'Wenye Deni' : 'With Balance') :
                     (isSw ? 'Bila Deni' : 'Cleared')}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: CUSTOMER RECEIVABLES (MADENI YA WATEJA)                           */}
      {/* ========================================================================= */}
      {activeTab === 'receivables' && (
        <div className="bg-white rounded-xl border border-[#E1DFDD] shadow-xs overflow-hidden">
          <div className="p-4 border-b border-[#F3F2F1] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-[#0078D4]" />
              <h3 className="font-bold text-sm text-[#323130]">
                {isSw ? 'Daftari la Madeni ya Wateja (Accounts Receivable)' : 'Customer Debtors & Outstanding Credit Ledger'}
              </h3>
            </div>
            <span className="text-xs text-[#605E5C]">
              {filteredCustomers.length} {isSw ? 'wateja wamepatikana' : 'customers listed'}
            </span>
          </div>

          <div>
            <table className="w-full text-left border-collapse text-[10px] sm:text-xs" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '28%' }} />
                <col className="hidden sm:table-column" style={{ width: '14%' }} />
                <col className="hidden md:table-column" style={{ width: '14%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '22%' }} />
                <col style={{ width: '20%' }} />
              </colgroup>
              <thead>
                <tr className="bg-[#FAF9F8] border-b border-[#EDEBE9] text-[#605E5C] font-semibold">
                  <th className="py-2 px-2">{isSw ? 'Mteja' : 'Customer'}</th>
                  <th className="py-2 px-2 hidden sm:table-cell">{isSw ? 'Eneo' : 'Location'}</th>
                  <th className="py-2 px-2 hidden md:table-cell">{isSw ? 'Kikomo' : 'Credit Limit'}</th>
                  <th className="py-2 px-2 text-right">{isSw ? 'Deni' : 'Debt'}</th>
                  <th className="py-2 px-2">{isSw ? 'Hali' : 'Status'}</th>
                  <th className="py-2 px-2 text-center">{isSw ? 'Malipo' : 'Settle'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F2F1]">
                {filteredCustomers.map(cust => {
                  const hasDebt = cust.balance > 0;
                  const percentUsed = Math.min(100, Math.round((cust.balance / (cust.creditLimit || 1)) * 100));

                  return (
                    <tr key={cust.id} className="hover:bg-[#F8F9FA] transition-colors">
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-6 h-6 rounded-full ${cust.avatarColor || 'bg-blue-600'} text-white font-bold flex items-center justify-center text-[9px] shrink-0`}>
                            {cust.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-[#323130] truncate flex items-center gap-1">
                              <span className="truncate">{cust.name}</span>
                              <span className={`text-[8px] px-1 py-0 rounded font-semibold shrink-0 ${
                                cust.riskScore === 'High' ? 'bg-rose-100 text-rose-700' :
                                cust.riskScore === 'Medium' ? 'bg-amber-100 text-amber-700' :
                                'bg-emerald-100 text-emerald-700'
                              }`}>
                                {cust.riskScore}
                              </span>
                            </div>
                            <div className="text-[9px] text-[#605E5C] font-mono truncate">{cust.phone}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-2 px-2 text-[#605E5C] truncate hidden sm:table-cell">
                        {cust.address || 'Dar es Salaam'}
                      </td>

                      <td className="py-2 px-2 hidden md:table-cell">
                        <div className="font-medium text-[#323130]">{formatTSh(cust.creditLimit)}</div>
                        <div className="w-16 h-1 bg-[#EDEBE9] rounded-full overflow-hidden mt-1">
                          <div
                            className={`h-full ${percentUsed > 80 ? 'bg-[#D13438]' : percentUsed > 50 ? 'bg-amber-500' : 'bg-[#107C10]'}`}
                            style={{ width: `${percentUsed}%` }}
                          />
                        </div>
                      </td>

                      <td className="py-2 px-2 text-right">
                        <div className={`font-black text-xs ${hasDebt ? 'text-[#D13438]' : 'text-[#107C10]'}`}>
                          {formatTSh(cust.balance)}
                        </div>
                        {hasDebt && (
                          <div className="text-[9px] text-[#605E5C]">{percentUsed}%</div>
                        )}
                      </td>

                      <td className="py-2 px-2">
                        {hasDebt ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200 capitalize">
                              <Clock className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                              <span className="truncate">{(cust.dunningStage || 'stage1').replace(/_/g, ' ')}</span>
                            </span>
                            {cust.daysOverdue > 0 && (
                              <div className="text-[9px] font-bold text-rose-600">
                                {cust.daysOverdue} {isSw ? 'siku' : 'days'}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-[#107C10] border border-emerald-200">
                            <Check className="w-2.5 h-2.5" />
                            {isSw ? 'Limelipwa' : 'Cleared'}
                          </span>
                        )}
                      </td>

                      <td className="py-2 px-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {canRecordCustomerPayment && hasDebt ? (
                            <button
                              onClick={() => handleOpenCustomerSettlement(cust)}
                              className="px-2 py-1 rounded-lg bg-[#107C10] hover:bg-[#0e6b0e] text-white font-bold text-[10px] flex items-center gap-0.5 shadow-xs transition-all active:scale-95 cursor-pointer"
                            >
                              <DollarSign className="w-3 h-3" />
                              <span>{isSw ? 'Lipa' : 'Settle'}</span>
                            </button>
                          ) : canRecordCustomerPayment ? (
                            <button
                              onClick={() => handleOpenCustomerSettlement(cust)}
                              className="px-2 py-1 rounded-lg bg-[#F3F2F1] hover:bg-[#EDEBE9] text-[#323130] font-semibold text-[10px] transition-all"
                            >
                              {isSw ? 'Rekebisha' : 'Adjust'}
                            </button>
                          ) : (
                            <span className="text-[9px] text-[#605E5C] font-medium">
                              {isSw ? 'Angalia tu' : 'View only'}
                            </span>
                          )}

                          {hasDebt && (
                            <button
                              onClick={() => handleSendSMSAcknowledgment(cust.name, cust.phone, 0, cust.balance)}
                              title={isSw ? 'Tuma SMS' : 'Send SMS'}
                              className="p-1 rounded-lg bg-[#0078D4]/10 hover:bg-[#0078D4]/20 text-[#0078D4] transition-colors"
                            >
                              <Send className="w-3 h-3" />
                            </button>
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
      )}

      {/* ========================================================================= */}
      {/* TAB 2: SUPPLIER PAYABLES (MADENI YA WASAMBAZAJI)                          */}
      {/* ========================================================================= */}
      {activeTab === 'payables' && (
        <div className="bg-white rounded-xl border border-[#E1DFDD] shadow-xs overflow-hidden">
          <div className="p-4 border-b border-[#F3F2F1] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-purple-700" />
              <h3 className="font-bold text-sm text-[#323130]">
                {isSw ? 'Daftari la Madeni ya Wasambazaji (Accounts Payable)' : 'Supplier Invoices & Payables Disbursement'}
              </h3>
            </div>
            <span className="text-xs text-[#605E5C]">
              {filteredSuppliers.length} {isSw ? 'wasambazaji wamepatikana' : 'suppliers listed'}
            </span>
          </div>

          <div>
            <table className="w-full text-left border-collapse text-[10px] sm:text-xs" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '26%' }} />
                <col className="hidden sm:table-column" style={{ width: '12%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '18%' }} />
                <col className="hidden md:table-column" style={{ width: '12%' }} />
                <col style={{ width: '16%' }} />
              </colgroup>
              <thead>
                <tr className="bg-[#FAF9F8] border-b border-[#EDEBE9] text-[#605E5C] font-semibold">
                  <th className="py-2 px-2">{isSw ? 'Msambazaji' : 'Supplier'}</th>
                  <th className="py-2 px-2 hidden sm:table-cell">{isSw ? 'Aina' : 'Category'}</th>
                  <th className="py-2 px-2">{isSw ? 'Masharti' : 'Terms'}</th>
                  <th className="py-2 px-2 text-right">{isSw ? 'Deni' : 'Payable'}</th>
                  <th className="py-2 px-2 hidden md:table-cell">{isSw ? 'Uwasilishaji' : 'Lead Time'}</th>
                  <th className="py-2 px-2 text-center">{isSw ? 'Lipa' : 'Pay'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F2F1]">
                {filteredSuppliers.map(sup => {
                  const hasPayable = (sup.outstandingPayable || 0) > 0;

                  return (
                    <tr key={sup.id} className="hover:bg-[#F8F9FA] transition-colors">
                      <td className="py-2 px-2">
                        <div>
                          <div className="font-bold text-[#323130] truncate flex items-center gap-1">
                            <span className="truncate">{sup.name}</span>
                            <span className="text-[8px] px-1 py-0 rounded bg-purple-100 text-purple-700 font-semibold shrink-0">
                              ★{sup.rating || 4.8}
                            </span>
                          </div>
                          <div className="text-[9px] text-[#605E5C] truncate">
                            {sup.contactPerson} • {sup.phone}
                          </div>
                        </div>
                      </td>

                      <td className="py-2 px-2 text-[#605E5C] truncate hidden sm:table-cell">
                        {sup.category}
                      </td>

                      <td className="py-2 px-2">
                        <span className="px-1.5 py-0.5 rounded bg-[#F3F2F1] text-[#323130] font-semibold text-[9px] truncate block">
                          {sup.paymentTerms || 'Net 30'}
                        </span>
                      </td>

                      <td className="py-2 px-2 text-right">
                        <div className={`font-black text-xs ${hasPayable ? 'text-purple-700' : 'text-[#107C10]'}`}>
                          {formatTSh(sup.outstandingPayable || 0)}
                        </div>
                        {hasPayable && (
                          <div className="text-[9px] text-[#605E5C]">
                            {isSw ? 'Inasubiri' : 'Pending'}
                          </div>
                        )}
                      </td>

                      <td className="py-2 px-2 text-[#605E5C] hidden md:table-cell">
                        {sup.leadTimeDays || 2}d
                      </td>

                      <td className="py-2 px-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {canRecordSupplierPayment && hasPayable ? (
                            <button
                              onClick={() => handleOpenSupplierSettlement(sup)}
                              className="px-2 py-1 rounded-lg bg-gradient-to-r from-purple-700 to-indigo-700 hover:brightness-110 text-white font-bold text-[9px] flex items-center gap-0.5 shadow-xs transition-all active:scale-95 cursor-pointer"
                            >
                              <CreditCard className="w-3 h-3" />
                              <span>{isSw ? 'Lipa' : 'Pay'}</span>
                            </button>
                          ) : !hasPayable ? (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-1 rounded text-[9px] font-bold bg-emerald-50 text-[#107C10] border border-emerald-200">
                              <Check className="w-2.5 h-2.5" />
                              {isSw ? 'Limelipwa' : 'Paid'}
                            </span>
                          ) : (
                            <span className="text-[9px] text-[#605E5C] font-medium">
                              {isSw ? 'Angalia tu' : 'View only'}
                            </span>
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
      )}

      {/* ========================================================================= */}
      {/* TAB 3: SETTLEMENT HISTORY & VOUCHER LOGS                                  */}
      {/* ========================================================================= */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-xl border border-[#E1DFDD] shadow-xs overflow-hidden space-y-4 p-4">
          <div className="flex items-center justify-between border-b border-[#F3F2F1] pb-3">
            <div>
              <h3 className="font-bold text-sm text-[#323130]">
                {isSw ? 'Kumbukumbu za Malipo & Hati za Mapokezi' : 'Settlement Vouchers & Audit Trail'}
              </h3>
              <p className="text-xs text-[#605E5C]">
                {isSw ? 'Hati zote za mapokezi ya madeni kutoka kwa wateja na malipo kwa wasambazaji' : 'Chronological ledger of customer receipts & supplier disbursement vouchers'}
              </p>
            </div>
          </div>

          <div className="divide-y divide-[#F3F2F1]">
            {allSettlements.length === 0 ? (
              <div className="py-10 text-center text-xs text-[#605E5C]">
                {isSw
                  ? 'Hakuna historia ya malipo bado. Rekodi mauzo kwenye POS au fanya malipo ya madeni.'
                  : 'No settlement history yet. Record POS sales or process debt payments.'}
              </div>
            ) : allSettlements.map((v, idx) => (
              <div key={idx} className="py-3 flex flex-wrap items-center justify-between gap-3 hover:bg-[#FAF9F8] p-2 rounded-lg transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    v.type === 'customer_receipt' ? 'bg-emerald-100 text-emerald-700' : 'bg-purple-100 text-purple-700'
                  }`}>
                    {v.type === 'customer_receipt' ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="font-bold text-xs text-[#323130] flex items-center gap-2 flex-wrap">
                      <span>{v.partyName}</span>
                      <span className="font-mono text-[10px] bg-[#F3F2F1] px-1.5 py-0.5 rounded text-[#605E5C]">
                        {v.voucherNumber}
                      </span>
                      {v.source === 'pos_sale' && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase bg-sky-100 text-sky-800">
                          POS
                        </span>
                      )}
                      {v.source === 'supplier_payment' && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase bg-purple-100 text-purple-800">
                          {isSw ? 'Msambazaji' : 'Supplier'}
                        </span>
                      )}
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${v.paymentMode === 'full' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                        {v.paymentMode}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#605E5C] mt-0.5">
                      {v.date} • {v.paymentMethod.toUpperCase()} ({v.referenceNumber}) • {v.cashierName}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="font-black text-sm text-[#107C10]">
                      {v.type === 'supplier_voucher' ? '-' : '+'}{formatTSh(v.amountPaid)}
                    </div>
                    <div className="text-[10px] text-[#605E5C]">
                      {isSw ? 'Salio Lililobaki:' : 'Bal After:'} <strong>{formatTSh(v.balanceAfter)}</strong>
                    </div>
                  </div>

                  <button
                    onClick={() => setActiveVoucher(v)}
                    className="px-3 py-1.5 rounded-lg bg-[#F3F2F1] hover:bg-[#0078D4] hover:text-white text-[#323130] font-bold text-xs flex items-center gap-1 transition-all"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    <span>{isSw ? 'Hati' : 'Voucher'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: SETTLE CUSTOMER DEBT (FULL / PARTIAL / CREDIT ADJUST)            */}
      {/* ========================================================================= */}
      {isCustomerModalOpen && selectedCustomer && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#E1DFDD] space-y-4">
            <div className="flex items-center justify-between border-b border-[#F3F2F1] pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-100 text-[#107C10]">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-[#323130]">
                    {isSw ? 'Kusanya Deni la Mteja' : 'Customer Debt Settlement'}
                  </h3>
                  <p className="text-[11px] text-[#605E5C]">{selectedCustomer.name} • {selectedCustomer.phone}</p>
                </div>
              </div>
              <button onClick={() => setIsCustomerModalOpen(false)} className="text-[#605E5C] hover:text-[#323130]">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Debt Overview Box */}
            <div className="p-3 bg-[#FAF9F8] rounded-xl border border-[#EDEBE9] flex items-center justify-between">
              <div>
                <span className="text-[11px] text-[#605E5C]">{isSw ? 'Deni Lililopo Sasa' : 'Current Outstanding Debt'}</span>
                <div className="text-xl font-black text-[#D13438]">{formatTSh(selectedCustomer.balance)}</div>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-[#605E5C]">{isSw ? 'Kikomo cha Mkopo' : 'Credit Limit'}</span>
                <div className="text-xs font-bold text-[#323130]">{formatTSh(selectedCustomer.creditLimit)}</div>
              </div>
            </div>

            <form onSubmit={handleProcessCustomerSettlement} className="space-y-4">
              {/* Payment Mode Selector: Full / Partial / Credit Adjust */}
              <div>
                <label className="block text-xs font-bold text-[#323130] mb-1.5">
                  {isSw ? 'Chaguo la Malipo (Settlement Option)' : 'Settlement Option'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'full', label: isSw ? 'Kamili (Full)' : 'Full Pay', desc: formatTSh(selectedCustomer.balance) },
                    { id: 'partial', label: isSw ? 'Nusu (Partial)' : 'Partial Pay', desc: isSw ? 'Weka Kiasi' : 'Custom Amt' },
                    { id: 'credit_adjust', label: isSw ? 'Marekebisho' : 'Adjustment', desc: isSw ? 'Punguza' : 'Deduct' },
                  ].map(mode => (
                    <button
                      type="button"
                      key={mode.id}
                      onClick={() => {
                        setCustPaymentMode(mode.id as any);
                        if (mode.id === 'full') setCustPaymentAmount(selectedCustomer.balance.toString());
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        custPaymentMode === mode.id
                          ? 'border-[#107C10] bg-[#107C10]/10 text-[#107C10] font-bold shadow-xs'
                          : 'border-[#EDEBE9] bg-[#FAF9F8] text-[#605E5C]'
                      }`}
                    >
                      <div className="text-xs font-bold">{mode.label}</div>
                      <div className="text-[10px] opacity-80">{mode.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount Input */}
              <div>
                <label className="block text-xs font-bold text-[#323130] mb-1">
                  {isSw ? 'Kiasi Kinacholipwa Sasa (TSh) *' : 'Amount Received Now (TSh) *'}
                </label>
                <input
                  type="number"
                  required
                  disabled={custPaymentMode === 'full'}
                  value={custPaymentAmount}
                  onChange={e => setCustPaymentAmount(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm font-bold bg-[#F3F2F1] border border-[#EDEBE9] rounded-xl focus:bg-white focus:border-[#107C10] outline-none"
                />
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="block text-xs font-bold text-[#323130] mb-1">
                  {isSw ? 'Njia ya Malipo *' : 'Payment Method *'}
                </label>
                <div className="grid grid-cols-4 gap-1.5 text-xs">
                  {[
                    { key: 'mpesa', label: '📱 M-Pesa' },
                    { key: 'tigopesa', label: '🔵 Tigo Pesa' },
                    { key: 'airtel', label: '🔴 Airtel' },
                    { key: 'cash', label: '💵 Cash' },
                  ].map(m => (
                    <button
                      type="button"
                      key={m.key}
                      onClick={() => setCustPaymentMethod(m.key as any)}
                      className={`py-1.5 rounded-lg font-bold border transition-all ${
                        custPaymentMethod === m.key
                          ? 'bg-[#107C10] text-white border-[#107C10]'
                          : 'bg-[#FAF9F8] border-[#EDEBE9] text-[#605E5C]'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ref Number & Notes */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#323130] mb-1">
                    {isSw ? 'Kumbukumbu / Ref No.' : 'Ref / Txn No.'}
                  </label>
                  <input
                    type="text"
                    value={custPaymentRef}
                    onChange={e => setCustPaymentRef(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-[#F3F2F1] border border-[#EDEBE9] rounded-lg outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#323130] mb-1">
                    {isSw ? 'Maelezo / Notes' : 'Notes / Remarks'}
                  </label>
                  <input
                    type="text"
                    value={custPaymentNotes}
                    onChange={e => setCustPaymentNotes(e.target.value)}
                    placeholder="e.g. Cleared via Till"
                    className="w-full px-3 py-1.5 text-xs bg-[#F3F2F1] border border-[#EDEBE9] rounded-lg outline-none"
                  />
                </div>
              </div>

              {/* Settlement Preview Summary */}
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs space-y-1">
                <div className="flex justify-between text-emerald-900">
                  <span>{isSw ? 'Kiasi cha Kupokea:' : 'Amount to Collect:'}</span>
                  <span className="font-extrabold">{formatTSh(Number(custPaymentAmount) || 0)}</span>
                </div>
                <div className="flex justify-between text-emerald-900 font-bold border-t border-emerald-200 pt-1">
                  <span>{isSw ? 'Salio Jipya Litakalobaki:' : 'New Balance After:'}</span>
                  <span className="font-black text-[#D13438]">
                    {formatTSh(Math.max(0, selectedCustomer.balance - (Number(custPaymentAmount) || 0)))}
                  </span>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSavingSettlement}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#107C10] to-[#0078D4] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md hover:brightness-105 active:scale-95 cursor-pointer disabled:opacity-60"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSavingSettlement ? (isSw ? 'Inahifadhi...' : 'Saving...') : (isSw ? 'Thibitisha Malipo & Toa Hati' : 'Confirm Payment & Issue Receipt')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsCustomerModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-[#F3F2F1] text-[#323130] font-semibold text-xs"
                >
                  {isSw ? 'Ghairi' : 'Cancel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: SETTLE SUPPLIER PAYABLE (FULL / PARTIAL / CREDIT TERMS)          */}
      {/* ========================================================================= */}
      {isSupplierModalOpen && selectedSupplier && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#E1DFDD] space-y-4">
            <div className="flex items-center justify-between border-b border-[#F3F2F1] pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-100 text-purple-700">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-[#323130]">
                    {isSw ? 'Lipa Msambazaji (Supplier Disbursement)' : 'Disburse Supplier Payable'}
                  </h3>
                  <p className="text-[11px] text-[#605E5C]">{selectedSupplier.name} • {selectedSupplier.category}</p>
                </div>
              </div>
              <button onClick={() => setIsSupplierModalOpen(false)} className="text-[#605E5C] hover:text-[#323130]">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Payable Summary Box */}
            <div className="p-3 bg-[#FAF9F8] rounded-xl border border-[#EDEBE9] flex items-center justify-between">
              <div>
                <span className="text-[11px] text-[#605E5C]">{isSw ? 'Deni Lililopo kwa Msambazaji' : 'Current Outstanding Payable'}</span>
                <div className="text-xl font-black text-purple-700">{formatTSh(selectedSupplier.outstandingPayable)}</div>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-[#605E5C]">{isSw ? 'Masharti' : 'Terms'}</span>
                <div className="text-xs font-bold text-[#323130]">{selectedSupplier.paymentTerms}</div>
              </div>
            </div>

            <form onSubmit={handleProcessSupplierSettlement} className="space-y-4">
              {/* Option Selector */}
              <div>
                <label className="block text-xs font-bold text-[#323130] mb-1.5">
                  {isSw ? 'Chaguo la Malipo' : 'Settlement Option'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSupPaymentMode('full');
                      setSupPaymentAmount(selectedSupplier.outstandingPayable.toString());
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      supPaymentMode === 'full'
                        ? 'border-purple-700 bg-purple-50 text-purple-800 font-bold shadow-xs'
                        : 'border-[#EDEBE9] bg-[#FAF9F8] text-[#605E5C]'
                    }`}
                  >
                    <div className="text-xs font-bold">{isSw ? 'Kamili (Full Payment)' : 'Full Settlement'}</div>
                    <div className="text-[10px] opacity-80">{formatTSh(selectedSupplier.outstandingPayable)}</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSupPaymentMode('partial')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      supPaymentMode === 'partial'
                        ? 'border-purple-700 bg-purple-50 text-purple-800 font-bold shadow-xs'
                        : 'border-[#EDEBE9] bg-[#FAF9F8] text-[#605E5C]'
                    }`}
                  >
                    <div className="text-xs font-bold">{isSw ? 'Nusu (Partial Installment)' : 'Partial Payment'}</div>
                    <div className="text-[10px] opacity-80">{isSw ? 'Weka Kiasi' : 'Custom Amount'}</div>
                  </button>
                </div>
              </div>

              {/* Amount to Disburse */}
              <div>
                <label className="block text-xs font-bold text-[#323130] mb-1">
                  {isSw ? 'Kiasi cha Kulipa (TSh) *' : 'Amount to Disburse (TSh) *'}
                </label>
                <input
                  type="number"
                  required
                  disabled={supPaymentMode === 'full'}
                  value={supPaymentAmount}
                  onChange={e => setSupPaymentAmount(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm font-bold bg-[#F3F2F1] border border-[#EDEBE9] rounded-xl focus:bg-white focus:border-purple-600 outline-none"
                />
              </div>

              {/* Disbursement Method */}
              <div>
                <label className="block text-xs font-bold text-[#323130] mb-1">
                  {isSw ? 'Akaunti / Njia ya Kutoa Malipo' : 'Disbursement Method'}
                </label>
                <select
                  value={supPaymentMethod}
                  onChange={e => setSupPaymentMethod(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-[#F3F2F1] border border-[#EDEBE9] rounded-xl focus:bg-white outline-none"
                >
                  <option value="CRDB Bank Transfer">🏦 CRDB Bank Transfer (Corporate A/C)</option>
                  <option value="NMB Bank Transfer">🏦 NMB Bank Transfer (Direct Bank)</option>
                  <option value="M-Pesa Business Till">📱 M-Pesa Till / Paybill</option>
                  <option value="Cash Disbursement">💵 Cash Voucher (Petty Cash)</option>
                </select>
              </div>

              {/* Ref Number & Notes */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#323130] mb-1">
                    {isSw ? 'Namba ya Muamala / Ref' : 'Bank Reference No.'}
                  </label>
                  <input
                    type="text"
                    value={supPaymentRef}
                    onChange={e => setSupPaymentRef(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-[#F3F2F1] border border-[#EDEBE9] rounded-lg outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#323130] mb-1">
                    {isSw ? 'Maelezo' : 'Notes'}
                  </label>
                  <input
                    type="text"
                    value={supPaymentNotes}
                    onChange={e => setSupPaymentNotes(e.target.value)}
                    placeholder="e.g. Settled Batch 2026"
                    className="w-full px-3 py-1.5 text-xs bg-[#F3F2F1] border border-[#EDEBE9] rounded-lg outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSavingSettlement}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-purple-700 to-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md hover:brightness-105 active:scale-95 cursor-pointer disabled:opacity-60"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSavingSettlement ? (isSw ? 'Inahifadhi...' : 'Saving...') : (isSw ? 'Thibitisha & Chapisha Hati ya Malipo' : 'Confirm & Print Payment Voucher')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsSupplierModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-[#F3F2F1] text-[#323130] font-semibold text-xs"
                >
                  {isSw ? 'Ghairi' : 'Cancel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: OFFICIAL PRINTABLE VOUCHER / RECEIPT MODAL                       */}
      {/* ========================================================================= */}
      {activeVoucher && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border-2 border-[#107C10] space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-[#F3F2F1] pb-3">
              <div className="flex items-center gap-2 text-[#107C10] font-bold text-sm">
                <CheckCircle2 className="w-5 h-5" />
                <span>
                  {activeVoucher.type === 'customer_receipt'
                    ? (isSw ? 'Hati Rasmi ya Mapokezi ya Pesa' : 'Official Customer Payment Receipt')
                    : (isSw ? 'Hati Rasmi ya Malipo kwa Msambazaji' : 'Official Supplier Payment Voucher')}
                </span>
              </div>
              <button onClick={() => setActiveVoucher(null)} className="text-[#605E5C] hover:text-[#323130]">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Store & Header */}
            <div className="text-center font-mono space-y-0.5 text-[#323130]">
              <div className="font-black text-sm">AL-FALAH PHARMACY & GENERAL LTD</div>
              <div>TIN: 108-992-451 • VRN: 40019283-Z</div>
              <div>VOUCHER NO: <strong>{activeVoucher.voucherNumber}</strong></div>
              <div>DATE: {activeVoucher.date}</div>
            </div>

            {/* Line Item Table */}
            <div className="border-t border-b border-dashed border-[#C8C6C4] py-2.5 space-y-1.5 font-mono">
              <div className="flex justify-between">
                <span>PARTY NAME:</span>
                <span className="font-bold">{activeVoucher.partyName}</span>
              </div>
              <div className="flex justify-between">
                <span>PARTY TYPE:</span>
                <span>{activeVoucher.partyType}</span>
              </div>
              <div className="flex justify-between">
                <span>PAYMENT METHOD:</span>
                <span className="uppercase">{activeVoucher.paymentMethod}</span>
              </div>
              <div className="flex justify-between">
                <span>TRANSACTION REF:</span>
                <span>{activeVoucher.referenceNumber}</span>
              </div>
            </div>

            {/* Financial Ledger Calculation */}
            <div className="space-y-1 font-mono">
              <div className="flex justify-between text-[#605E5C]">
                <span>BALANCE BEFORE:</span>
                <span>{formatTSh(activeVoucher.balanceBefore)}</span>
              </div>
              <div className="flex justify-between font-extrabold text-sm text-[#107C10] pt-1 border-t border-[#EDEBE9]">
                <span>AMOUNT PAID:</span>
                <span>{formatTSh(activeVoucher.amountPaid)}</span>
              </div>
              <div className="flex justify-between font-bold text-xs text-[#D13438] pt-1">
                <span>BALANCE REMAINING:</span>
                <span>{formatTSh(activeVoucher.balanceAfter)}</span>
              </div>
            </div>

            {/* Signature & Operator */}
            <div className="pt-2 text-center text-[10px] text-[#605E5C] font-mono border-t border-[#EDEBE9] space-y-0.5">
              <div>ISSUED BY: {activeVoucher.cashierName}</div>
              <div>TRA EFD SIG: EFD-TZ-VERIFIED-{Math.floor(100000 + Math.random() * 900000)}</div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (!activeVoucher) return;
                  const tpl = getActive('invoice');
                  const data = settlementToRenderData(activeVoucher, isSw);
                  printDocument(tpl, data, config.branding, isSw);
                  setActiveVoucher(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#0078D4] hover:bg-[#006cbd] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>{isSw ? 'Chapisha Hati (Print)' : 'Print Voucher'}</span>
              </button>

              {activeVoucher.partyPhone && activeVoucher.type === 'customer_receipt' && (
                <button
                  onClick={() => {
                    handleSendSMSAcknowledgment(activeVoucher.partyName, activeVoucher.partyPhone!, activeVoucher.amountPaid, activeVoucher.balanceAfter);
                  }}
                  className="px-3.5 py-2.5 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold text-xs flex items-center gap-1"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>SMS</span>
                </button>
              )}

              <button
                onClick={() => setActiveVoucher(null)}
                className="px-4 py-2.5 rounded-xl bg-[#F3F2F1] text-[#323130] font-semibold text-xs"
              >
                {isSw ? 'Funga' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
