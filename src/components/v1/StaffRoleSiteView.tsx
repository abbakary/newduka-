import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  ShoppingBag, 
  Pill, 
  Truck, 
  FileText, 
  ShieldCheck, 
  CreditCard, 
  ArrowRight, 
  Plus, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  DollarSign, 
  BarChart3, 
  RefreshCw, 
  UserCheck, 
  Search, 
  Lock, 
  Unlock, 
  Smartphone, 
  QrCode, 
  Send, 
  Sparkles,
  ArrowUpRight,
  TrendingUp,
  Receipt,
  Boxes,
  Users,
  Building2,
  Calendar,
  Layers,
  ChevronRight,
  ChevronDown,
  Printer,
  Ban,
  Check,
  X,
  Eye,
  Sliders,
  Award,
  Zap,
  Activity,
  History,
  Phone,
  Mail,
  Key,
  Shield,
  HelpCircle,
  Coffee,
  Wallet,
  Coins,
  BadgeCheck
} from 'lucide-react';
import { 
  AuthUser, 
  BusinessType, 
  Customer, 
  Language, 
  Product, 
  PurchaseOrder, 
  SaleTransaction, 
  StaffMember, 
  StaffRole, 
  StockMovement, 
  StoreBranch,
  Supplier 
} from '@/types/v1';
import { formatTSh } from '@/utils/translations';
import { computeTotalRevenue, computeTotalCOGS, computeTodaySalesStats } from '@/lib/analyticsCompute';
import { resolveDefaultBranchId } from '@/lib/apiSync';
import { TodaySalesHeroKpi } from '@/components/v1/TodaySalesHeroKpi';
import confetti from 'canvas-confetti';
import { useDocumentTemplates } from '@/context/DocumentTemplateContext';
import { printDocument } from '@/lib/documentRenderer';
import { payslipToRenderData, saleReceiptRenderData } from '@/lib/documentDataMappers';
import type { SalaryPayrollRecord } from '@/types/v1';
import { api } from '@/lib/api';
import { canClaimOwnDailyStipend, canAccessVendorTab, canManageStaffRBAC, canSwitchStaffWorkstation, resolveUserPermissions } from '@/lib/rbac';
import {
  appendSalaryAdvanceRequest,
  findTodayAllowanceClaim,
  getStaffPayRates,
  loadPayrollStore,
  recordStaffAllowanceClaim,
  savePayrollStore,
  syncAllowancesFromStipendExpenses,
  todayDateStr,
} from '@/lib/payrollStore';
import { mapExpense } from '@/lib/apiSync';
import type { SalaryAdvanceRequest } from '@/types/v1';

interface StaffRoleSiteViewProps {
  language: Language;
  currentUser: AuthUser | null;
  staffMember?: StaffMember;
  staffList?: StaffMember[];
  customers: Customer[];
  products: Product[];
  sales: SaleTransaction[];
  purchaseOrders: PurchaseOrder[];
  stockMovements: StockMovement[];
  suppliers: Supplier[];
  branches?: StoreBranch[];
  onNavigate: (tab: string) => void;
  onOpenAIChatWithPrompt: (prompt: string) => void;
  onQuickSale?: () => void;
  onSwitchStaff?: (staff: StaffMember) => void;
  tenantStorageId?: string;
}

export const StaffRoleSiteView: React.FC<StaffRoleSiteViewProps> = ({
  language,
  currentUser,
  staffMember,
  staffList = [],
  customers,
  products,
  sales,
  purchaseOrders,
  stockMovements,
  suppliers,
  branches = [],
  onNavigate,
  onOpenAIChatWithPrompt,
  onQuickSale,
  onSwitchStaff,
  tenantStorageId,
}) => {
  const isSw = language === 'sw';
  const { config, getActive } = useDocumentTemplates();
  const tenantId = tenantStorageId || currentUser?.businessId || currentUser?.id || 'local';
  const todayStr = todayDateStr();
  const canSelfClaimStipend = canClaimOwnDailyStipend(currentUser);
  const canSwitchStaff = canSwitchStaffWorkstation(currentUser);
  const canManageRBAC = canManageStaffRBAC(currentUser);
  const canSeeReportsTab = canAccessVendorTab(currentUser, 'reports');
  const canSeeSuppliersTab = canAccessVendorTab(currentUser, 'suppliers');
  const canSeeCustomersTab = canAccessVendorTab(currentUser, 'customers');
  const canSeePOSTab = canAccessVendorTab(currentUser, 'pos');

  const effectiveStaff = useMemo(() => {
    if (!canSwitchStaffWorkstation(currentUser)) {
      if (currentUser?.staffId && staffList.length) {
        return staffList.find(s => s.id === currentUser.staffId) ?? null;
      }
      if (currentUser?.role === 'vendor_staff' && staffList.length) {
        return staffList.find(s => s.email === currentUser.email) ?? null;
      }
      return staffMember ?? null;
    }
    if (staffMember) return staffMember;
    if (currentUser?.staffId && staffList.length) {
      return staffList.find(s => s.id === currentUser.staffId) ?? null;
    }
    if (currentUser?.role === 'vendor_staff' && staffList.length) {
      return staffList.find(s => s.email === currentUser.email) ?? null;
    }
    return null;
  }, [staffMember, currentUser, staffList]);

  const role: StaffRole = effectiveStaff?.role || staffMember?.role || currentUser?.staffRole || (currentUser?.role === 'super_admin' ? 'Owner' : currentUser?.role === 'vendor_staff' ? 'Cashier' : 'Owner');
  const staffName = effectiveStaff?.name || staffMember?.name || currentUser?.name || 'Staff Member';
  const hqBranchId = resolveDefaultBranchId(branches);
  const branchName =
    effectiveStaff?.branch ||
    staffMember?.branch ||
    currentUser?.branch ||
    branches.find(b => b.id === effectiveStaff?.branchId)?.name ||
    branches.find(b => b.type === 'main_hq')?.name ||
    branches[0]?.name ||
    (isSw ? 'Tawi Kuu' : 'Main Branch');
  const shiftName = staffMember?.shift || currentUser?.shift || 'Morning (07:30 - 15:30)';
  const permissions = staffMember?.permissions ?? currentUser?.permissions ?? resolveUserPermissions(currentUser);

  const todaySalesStats = useMemo(() => computeTodaySalesStats(sales), [sales]);

  // Interactive Workstation Modals & State
  const [shiftRegisterOpen, setShiftRegisterOpen] = useState<boolean>(true);
  const [cashDrawerTally, setCashDrawerTally] = useState<number>(0);
  const [isCashDrawerModalOpen, setIsCashDrawerModalOpen] = useState<boolean>(false);
  const [isPrescriptionModalOpen, setIsPrescriptionModalOpen] = useState<boolean>(false);
  const [isControlledDrugModalOpen, setIsControlledDrugModalOpen] = useState<boolean>(false);
  const [isStockTakeModalOpen, setIsStockTakeModalOpen] = useState<boolean>(false);
  const [isReceivePOModalOpen, setIsReceivePOModalOpen] = useState<boolean>(false);
  const [isInterBranchTransferModalOpen, setIsInterBranchTransferModalOpen] = useState<boolean>(false);
  const [isTraReconcileModalOpen, setIsTraReconcileModalOpen] = useState<boolean>(false);
  const [isSupplierPaymentModalOpen, setIsSupplierPaymentModalOpen] = useState<boolean>(false);
  const [isCustomerDunningModalOpen, setIsCustomerDunningModalOpen] = useState<boolean>(false);
  const [isManagerApprovalModalOpen, setIsManagerApprovalModalOpen] = useState<boolean>(false);
  const [isRosterModalOpen, setIsRosterModalOpen] = useState<boolean>(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<boolean>(false);
  const [selectedReceipt, setSelectedReceipt] = useState<SaleTransaction | null>(null);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Cash Denominations for Cash Drawer Tally Modal
  const [denominations, setDenominations] = useState({
    n10000: 25,
    n5000: 18,
    n2000: 15,
    n1000: 15,
    c500: 0,
    c200: 0,
    c100: 0,
  });

  const calculatedCashTotal = (denominations.n10000 * 10000) +
    (denominations.n5000 * 5000) +
    (denominations.n2000 * 2000) +
    (denominations.n1000 * 1000) +
    (denominations.c500 * 500) +
    (denominations.c200 * 200) +
    (denominations.c100 * 100);

  // Staff Allowance & Salary State
  const [activeSiteView, setActiveSiteView] = useState<'workstation' | 'my_earnings'>('workstation');
  const [todayAllowanceClaimed, setTodayAllowanceClaimed] = useState<boolean>(false);
  const [allowanceClaimTime, setAllowanceClaimTime] = useState<string>('');
  const [isClaimingAllowance, setIsClaimingAllowance] = useState(false);
  const [payrollStore, setPayrollStore] = useState(() => loadPayrollStore(tenantId));
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState<boolean>(false);
  const [advanceAmountInput, setAdvanceAmountInput] = useState<number | ''>('');
  const [advanceReasonInput, setAdvanceReasonInput] = useState<string>('');
  const [myAdvances, setMyAdvances] = useState<Array<{ id: string; amount: number; reason: string; status: string; date: string }>>([]);
  const [isPayslipModalOpen, setIsPayslipModalOpen] = useState<boolean>(false);

  const totalOutstandingCredit = useMemo(
    () => customers.reduce((sum, c) => sum + c.balance, 0),
    [customers],
  );
  const creditCustomerCount = useMemo(
    () => customers.filter(c => c.balance > 0).length,
    [customers],
  );
  const monthlyRevenue = useMemo(() => {
    const now = new Date();
    return sales
      .filter(s => {
        const d = new Date(s.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((acc, s) => acc + s.total, 0);
  }, [sales]);
  const monthlyVAT = useMemo(() => {
    const now = new Date();
    return sales
      .filter(s => {
        const d = new Date(s.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((acc, s) => acc + s.vatAmount, 0);
  }, [sales]);
  const allTimeRevenue = useMemo(() => computeTotalRevenue(sales), [sales]);
  const businessDisplayName = currentUser?.businessName || (isSw ? 'Biashara Yako' : 'Your Business');

  const monthStart = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }, []);

  const monthSales = useMemo(
    () => sales.filter(s => new Date(s.date) >= monthStart),
    [sales, monthStart],
  );

  const monthlyCOGS = useMemo(
    () => computeTotalCOGS(monthSales, products),
    [monthSales, products],
  );

  const inventoryValuation = useMemo(
    () => products.reduce((sum, p) => sum + p.stock * (p.cost ?? 0), 0),
    [products],
  );

  const estimatedNetProfit = Math.max(0, monthlyRevenue - monthlyCOGS);
  const netMarginPct = monthlyRevenue > 0
    ? Math.round((estimatedNetProfit / monthlyRevenue) * 1000) / 10
    : 0;

  const branchPerformance = useMemo(() => {
    const byBranch = new Map<string, SaleTransaction[]>();
    for (const sale of monthSales) {
      const bid = sale.branchId || hqBranchId || 'unassigned';
      if (!byBranch.has(bid)) byBranch.set(bid, []);
      byBranch.get(bid)!.push(sale);
    }

    const sourceBranches = branches.length
      ? branches
      : [{ id: hqBranchId || 'hq', name: branchName, type: 'main_hq' as const }];

    return sourceBranches
      .map(b => {
        const branchSales = byBranch.get(b.id) || [];
        const revenue = branchSales.reduce((sum, s) => sum + s.total, 0);
        const count = branchSales.length;
        const cogs = computeTotalCOGS(branchSales, products);
        const margin = revenue > 0 ? ((revenue - cogs) / revenue) * 100 : 0;
        return {
          branchId: b.id,
          branchName: b.name,
          revenue,
          transactionCount: count,
          avgBasket: count > 0 ? Math.round(revenue / count) : 0,
          grossMarginPct: Math.round(margin * 10) / 10,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }, [monthSales, products, branches, hqBranchId, branchName]);

  const executiveAiHint = useMemo(() => {
    const active = branchPerformance.filter(b => b.revenue > 0);
    if (active.length >= 2) {
      return isSw
        ? `Kulingana na mauzo ya ${active[0].branchName} na ${active[1].branchName}, ongeza bidhaa zenye faida kubwa na punguza bidhaa zinazosogea polepole ili kuongeza faida ya jumla.`
        : `Based on velocity at ${active[0].branchName} and ${active[1].branchName}, prioritize high-margin SKUs and reduce slow movers to lift gross profit next quarter.`;
    }
    if (active.length === 1) {
      return isSw
        ? `${active[0].branchName} inaongoza na ${formatTSh(active[0].revenue)} mwezi huu. Angalia bidhaa zenye faida chini ya ${active[0].grossMarginPct}% na rekebisha bei au stock.`
        : `${active[0].branchName} leads with ${formatTSh(active[0].revenue)} this month. Review SKUs below ${active[0].grossMarginPct}% margin and adjust pricing or replenishment.`;
    }
    return isSw
      ? 'Anza kurekodi mauzo kupitia POS ili kupata mapendekezo ya AI kulingana na data halisi ya tawi lako.'
      : 'Start recording POS sales to unlock AI strategy recommendations based on your real branch data.';
  }, [branchPerformance, isSw]);

  const stipendRates = useMemo(() => {
    if (!effectiveStaff) return { food: 5000, transport: 3000, total: 8000 };
    return getStaffPayRates(effectiveStaff, payrollStore.staffConfig);
  }, [effectiveStaff, payrollStore.staffConfig]);

  const dailyFood = stipendRates.food;
  const dailyTransport = stipendRates.transport;
  const dailyTotal = stipendRates.total;
  const baseSalary = effectiveStaff?.baseSalary || staffMember?.baseSalary || 450000;

  const handlePrintStaffPayslip = () => {
    const advances = myAdvances.filter(a => a.status === 'approved').reduce((acc, a) => acc + a.amount, 0);
    const bonus = 30000;
    const statutory = Math.round(baseSalary * 0.1);
    const record: SalaryPayrollRecord = {
      id: 'staff-preview',
      monthYear: '2026-07',
      staffId: effectiveStaff?.id || 'staff',
      staffName,
      staffRole: role,
      baseSalary,
      totalDailyAllowancesPaid: 0,
      advancesDeducted: advances,
      statutoryDeductions: statutory,
      performanceBonus: bonus,
      netPayable: Math.round(baseSalary - statutory + bonus - advances),
      status: 'paid',
      paymentDate: '2026-07-30',
      paymentMethod: 'M-Pesa',
      paymentReference: '',
      payslipNumber: 'PAYSLIP-2026-07-001',
    };
    const tpl = getActive('invoice');
    printDocument(tpl, payslipToRenderData(record, isSw), config.branding, isSw);
  };

  const syncClaimStateFromStore = useCallback(() => {
    if (!effectiveStaff?.id) return;
    const store = loadPayrollStore(tenantId);
    setPayrollStore(store);
    const claim = findTodayAllowanceClaim(effectiveStaff.id, todayStr, store.dailyAllowances);
    setTodayAllowanceClaimed(Boolean(claim));
    setAllowanceClaimTime(claim?.claimedAt || claim?.claimedTimestamp?.slice(11, 16) || '');
  }, [effectiveStaff?.id, tenantId, todayStr]);

  useEffect(() => {
    syncClaimStateFromStore();
  }, [syncClaimStateFromStore]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await api.getExpenses();
        const mapped = raw.map(r => mapExpense(r));
        const store = loadPayrollStore(tenantId);
        const synced = syncAllowancesFromStipendExpenses(store, mapped, staffList);
        if (!cancelled) {
          savePayrollStore(tenantId, synced);
          setPayrollStore(synced);
          syncClaimStateFromStore();
        }
      } catch {
        /* offline or unauthorized — local store still applies */
      }
    })();
    return () => { cancelled = true; };
  }, [tenantId, staffList, syncClaimStateFromStore]);

  useEffect(() => {
    if (!effectiveStaff?.id) {
      setMyAdvances([]);
      return;
    }
    const store = loadPayrollStore(tenantId);
    setMyAdvances(
      store.advances
        .filter(a => a.staffId === effectiveStaff.id)
        .map(a => ({
          id: a.id,
          amount: a.requestedAmount,
          reason: a.reason,
          status: a.status,
          date: a.dateRequested,
        })),
    );
  }, [effectiveStaff?.id, tenantId, payrollStore.advances]);

  const handleClaimDailyAllowance = async () => {
    if (!canSelfClaimStipend || !effectiveStaff || todayAllowanceClaimed || isClaimingAllowance) return;

    setIsClaimingAllowance(true);
    try {
      const claimResp = await api.claimDailyStipend({
        food_amount: dailyFood,
        transport_amount: dailyTransport,
      });
      const expenseId = typeof claimResp?.expense_id === 'string' ? claimResp.expense_id : undefined;

      const { store: nextStore, record } = recordStaffAllowanceClaim(
        loadPayrollStore(tenantId),
        { id: effectiveStaff.id, name: effectiveStaff.name, role: effectiveStaff.role },
        { food: dailyFood, transport: dailyTransport },
        todayStr,
        expenseId,
      );
      savePayrollStore(tenantId, nextStore);
      setPayrollStore(nextStore);
      setTodayAllowanceClaimed(true);
      setAllowanceClaimTime(record.claimedAt || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      showToast(
        isSw
          ? `✅ Posho ya leo ya TSh ${dailyTotal.toLocaleString()} (Chakula na Nauli) imesainiwa na kurekodiwa kikamilifu!`
          : `✅ Daily stipend of TSh ${dailyTotal.toLocaleString()} signed and recorded!`,
      );
    } catch (err) {
      const msg = (err as Error).message || '';
      if (msg.toLowerCase().includes('already') || msg.includes('already_claimed')) {
        syncClaimStateFromStore();
        showToast(isSw ? 'Posho ya leo tayari imerekodiwa.' : 'Today\'s stipend was already recorded.');
      } else {
        alert(msg || (isSw ? 'Imeshindwa kuchukua posho.' : 'Failed to claim stipend.'));
      }
    } finally {
      setIsClaimingAllowance(false);
    }
  };

  const handleRequestAdvance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!advanceAmountInput || Number(advanceAmountInput) <= 0 || !advanceReasonInput || !effectiveStaff) return;

    const newAdv: SalaryAdvanceRequest = {
      id: `adv-${Date.now()}`,
      staffId: effectiveStaff.id,
      staffName: effectiveStaff.name,
      staffRole: effectiveStaff.role,
      requestedAmount: Number(advanceAmountInput),
      reason: advanceReasonInput,
      status: 'pending',
      dateRequested: todayStr,
    };

    const nextStore = appendSalaryAdvanceRequest(loadPayrollStore(tenantId), newAdv);
    savePayrollStore(tenantId, nextStore);
    setPayrollStore(nextStore);

    setMyAdvances([{ id: newAdv.id, amount: newAdv.requestedAmount, reason: newAdv.reason, status: 'pending', date: newAdv.dateRequested }, ...myAdvances]);
    setIsAdvanceModalOpen(false);
    setAdvanceAmountInput('');
    setAdvanceReasonInput('');
    showToast(isSw ? 'Maombi ya advance yametumwa kwa Boss kwa uhakiki!' : 'Advance request submitted to Owner for review!');
  };

  // Manager Approval Items State
  const [pendingApprovals, setPendingApprovals] = useState<Array<{
    id: string; type: string; title: string; requester: string; target: string; time: string; notes: string;
  }>>([]);

  const showToast = (msg: string) => {
    setActionSuccessMsg(msg);
    setTimeout(() => setActionSuccessMsg(null), 3500);
    confetti({ particleCount: 30, spread: 50, origin: { y: 0.65 } });
  };

  const safeNavigate = useCallback((tab: string) => {
    if (!canAccessVendorTab(currentUser, tab)) {
      showToast(isSw ? 'Huna ruhusa ya kufungua sehemu hii.' : 'You do not have permission to access this section.');
      return;
    }
    onNavigate(tab);
  }, [currentUser, onNavigate, isSw]);

  const handleApproveItem = (id: string, title: string) => {
    setPendingApprovals(prev => prev.filter(a => a.id !== id));
    showToast(isSw ? `✅ ${title} imeidhinishwa kikamilifu!` : `✅ ${title} approved successfully!`);
  };

  const handleRejectItem = (id: string, title: string) => {
    setPendingApprovals(prev => prev.filter(a => a.id !== id));
    showToast(isSw ? `❌ ${title} imekataliwa.` : `❌ ${title} rejected.`);
  };

  // =========================================================================
  // 1. CASHIER WORKSTATION SITE (KESHIA WA MAUZO)
  // =========================================================================
  const renderCashierSite = () => {
    const today = new Date().toISOString().split('T')[0];
    const todaySales = sales.filter(s => s.date.startsWith(today));
    const totalTodayRevenue = todaySales.reduce((acc, s) => acc + s.total, 0);
    const mobileMoneyTotal = todaySales.reduce((sum, sale) => {
      return sum + (sale.payments?.filter(p => p.method === 'mpesa' || p.method === 'tigopesa' || p.method === 'airtel')
        .reduce((s, p) => s + p.amount, 0) ?? 0);
    }, 0);
    const mobileMoneyCount = todaySales.filter(s =>
      s.payments?.some(p => p.method === 'mpesa' || p.method === 'tigopesa' || p.method === 'airtel')
    ).length;
    const recentSales = todaySales.slice(0, 6);

    return (
      <div className="space-y-6 animate-fade-in font-sans">
        {/* Top row: welcome banner + live today sales hero */}
        <div className="flex flex-col xl:flex-row gap-4 xl:items-stretch">
          <div className="flex-1 order-2 xl:order-1">
        {/* Cashier Welcome Banner */}
        <div className="bg-gradient-to-r from-[#24284A] via-[#30355D] to-[#1E213D] text-white p-5 rounded-2xl shadow-md border border-[#323762] flex flex-wrap items-center justify-between gap-4 h-full">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center justify-center text-2xl font-bold shadow-inner">
              💳
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white tracking-tight">{staffName}</h3>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-extrabold uppercase tracking-wide">
                  {isSw ? 'Keshia Mwenye Zamu' : 'Cashier on Duty'}
                </span>
              </div>
              <p className="text-xs text-slate-300 flex items-center gap-2 mt-1">
                <span>📍 {branchName}</span>
                <span>•</span>
                <span>⏰ {shiftName}</span>
                <span>•</span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  {isSw ? 'Droo ya Fedha Imefunguliwa' : 'Register Open'}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {permissions.canSellPOS ? (
              <button
                onClick={() => safeNavigate('pos')}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-2 cursor-pointer transition-all hover:scale-105 active:scale-95"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>{isSw ? 'Fungua POS & Uza Sasa' : 'Launch POS Register'}</span>
              </button>
            ) : (
              <div className="px-3 py-2 bg-slate-800 text-slate-400 rounded-xl text-xs flex items-center gap-1.5 border border-slate-700">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>POS Access Disabled in RBAC</span>
              </div>
            )}

            <button
              onClick={() => setIsCashDrawerModalOpen(true)}
              className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white rounded-xl text-xs font-semibold border border-white/15 flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <DollarSign className="w-4 h-4 text-amber-300" />
              <span>{isSw ? 'Hesabu ya Droo (Tally)' : 'Drawer Tally'}</span>
            </button>
          </div>
        </div>
          </div>
          <TodaySalesHeroKpi
            stats={todaySalesStats}
            isSw={isSw}
            variant="staff"
            staffName={staffName}
            onClick={() => safeNavigate('pos')}
            className="w-full xl:w-[360px] shrink-0 order-1 xl:order-2"
          />
        </div>

        {/* Quick Shift Summary Metrics — horizontal row below hero */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-[#E1DFDD] shadow-xs">
            <div className="text-xs text-[#605E5C] font-semibold flex items-center justify-between">
              <span>{isSw ? 'Mauzo Yangu Leo' : 'My Total Sales Today'}</span>
              <span className="text-base">💰</span>
            </div>
            <div className="text-xl font-extrabold text-[#323130] mt-1 font-mono">
              {formatTSh(staffMember?.todayRevenueTzs ?? totalTodayRevenue)}
            </div>
            <div className="text-[11px] text-emerald-700 font-semibold mt-1 flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3" />
              <span>{staffMember?.todaySalesCount ?? todaySales.length} {isSw ? 'Risiti zimetolewa' : 'receipts issued'}</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-[#E1DFDD] shadow-xs">
            <div className="text-xs text-[#605E5C] font-semibold flex items-center justify-between">
              <span>{isSw ? 'M-Pesa / Tigo Pesa QR' : 'Mobile Money QR'}</span>
              <span className="text-base">📱</span>
            </div>
            <div className="text-xl font-extrabold text-[#0078D4] mt-1 font-mono">
              {formatTSh(mobileMoneyTotal)}
            </div>
            <div className="text-[11px] text-[#605E5C] mt-1">
              {mobileMoneyCount} {isSw ? 'Malipo yamehakikiwa papo hapo' : 'instant QR settlements'}
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-[#E1DFDD] shadow-xs">
            <div className="text-xs text-[#605E5C] font-semibold flex items-center justify-between">
              <span>{isSw ? 'Fedha Taslimu Drooni (Float)' : 'Cash in Drawer (Float)'}</span>
              <span className="text-base">💵</span>
            </div>
            <div className="text-xl font-extrabold text-amber-700 mt-1 font-mono">
              {formatTSh(cashDrawerTally)}
            </div>
            <div className="text-[11px] text-emerald-700 font-bold mt-1">
              ✓ {isSw ? 'Bila hitilafu (Balanced)' : '0 discrepancy'}
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-[#E1DFDD] shadow-xs">
            <div className="text-xs text-[#605E5C] font-semibold flex items-center justify-between">
              <span>{isSw ? 'TRA EFD Risiti za Kodi' : 'TRA EFD Signatures'}</span>
              <span className="text-base">🧾</span>
            </div>
            <div className="text-xl font-extrabold text-emerald-700 mt-1 font-mono">
              100% Synced
            </div>
            <div className="text-[11px] text-emerald-700 font-semibold mt-1">
              TZ-EFD-2026-8819 Active
            </div>
          </div>
        </div>

        {/* Fast Cashier Workstation Actions Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-xl border border-[#E1DFDD] p-5 shadow-xs">
              <div className="flex items-center justify-between border-b border-[#EDEBE9] pb-3 mb-4">
                <h4 className="font-bold text-sm text-[#323130] flex items-center gap-2">
                  <span>⚡</span>
                  <span>{isSw ? 'Hatua za Haraka za Keshia (Counter Actions)' : 'Cashier Express Toolset'}</span>
                </h4>
                <span className="text-xs text-[#605E5C] font-medium">{isSw ? 'Bofya kutekeleza' : 'Click to run'}</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {canSeePOSTab && permissions.canSellPOS && (
                <button
                  onClick={() => safeNavigate('pos')}
                  className="p-3 bg-blue-50/70 hover:bg-blue-100/80 border border-blue-200 rounded-xl text-left transition-all cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#0078D4] text-white flex items-center justify-center font-bold mb-2 shadow-xs group-hover:scale-105 transition-transform">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <div className="font-bold text-xs text-[#323130]">{isSw ? 'Uza kwa POS' : 'Start POS Sale'}</div>
                  <p className="text-[10px] text-[#605E5C] mt-0.5">{isSw ? 'Fungua skrini ya mauzo' : 'Scan and checkout'}</p>
                </button>
                )}

                {canSeeCustomersTab && (
                <button
                  onClick={() => safeNavigate('customers')}
                  className="p-3 bg-purple-50/70 hover:bg-purple-100/80 border border-purple-200 rounded-xl text-left transition-all cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#6264A7] text-white flex items-center justify-center font-bold mb-2 shadow-xs group-hover:scale-105 transition-transform">
                    <Users className="w-4 h-4" />
                  </div>
                  <div className="font-bold text-xs text-[#323130]">{isSw ? 'Kagua Deni la Mteja' : 'Customer Credit Check'}</div>
                  <p className="text-[10px] text-[#605E5C] mt-0.5">{isSw ? 'Angalia kikomo cha deni' : 'Check balance limit'}</p>
                </button>
                )}

                <button
                  onClick={() => {
                    showToast(isSw ? 'Droo ya fedha imefunguliwa kielektroniki!' : 'Electronic cash drawer popped open!');
                  }}
                  className="p-3 bg-amber-50/70 hover:bg-amber-100/80 border border-amber-200 rounded-xl text-left transition-all cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center font-bold mb-2 shadow-xs group-hover:scale-105 transition-transform">
                    <Unlock className="w-4 h-4" />
                  </div>
                  <div className="font-bold text-xs text-[#323130]">{isSw ? 'Fungua Droo (Pop Drawer)' : 'Pop Cash Drawer'}</div>
                  <p className="text-[10px] text-[#605E5C] mt-0.5">{isSw ? 'Toa chenji au weka bili' : 'Make change float'}</p>
                </button>

                {canSeeReportsTab && (
                <button
                  onClick={() => safeNavigate('reports')}
                  className="p-3 bg-emerald-50/70 hover:bg-emerald-100/80 border border-emerald-200 rounded-xl text-left transition-all cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold mb-2 shadow-xs group-hover:scale-105 transition-transform">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <div className="font-bold text-xs text-[#323130]">{isSw ? 'Tafuta Risiti ya Zamani' : 'Lookup Receipt'}</div>
                  <p className="text-[10px] text-[#605E5C] mt-0.5">{isSw ? 'Rudia kuchapisha TRA' : 'Reprint TRA slip'}</p>
                </button>
                )}

                <button
                  onClick={() => onOpenAIChatWithPrompt(isSw ? 'Nisaidie kuhesabu mabadiliko ya bei na ofa za siku kwa wateja wa reja reja.' : 'Help analyze retail pricing and cashier promotions.')}
                  className="p-3 bg-indigo-50/70 hover:bg-indigo-100/80 border border-indigo-200 rounded-xl text-left transition-all cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex items-center justify-center font-bold mb-2 shadow-xs group-hover:scale-105 transition-transform">
                    <Sparkles className="w-4 h-4 text-amber-200" />
                  </div>
                  <div className="font-bold text-xs text-[#323130]">{isSw ? 'Msaidizi wa AI wa Bei' : 'AI Price Assistant'}</div>
                  <p className="text-[10px] text-[#605E5C] mt-0.5">{isSw ? 'Uliza bei au mbadala' : 'Find drug substitutes'}</p>
                </button>

                <button
                  onClick={() => setIsCashDrawerModalOpen(true)}
                  className="p-3 bg-rose-50/70 hover:bg-rose-100/80 border border-rose-200 rounded-xl text-left transition-all cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center font-bold mb-2 shadow-xs group-hover:scale-105 transition-transform">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div className="font-bold text-xs text-[#323130]">{isSw ? 'Funga Zamu (End Shift)' : 'Close Shift & Z-Report'}</div>
                  <p className="text-[10px] text-[#605E5C] mt-0.5">{isSw ? 'Hesabu na kabidhi kwa meneja' : 'Reconcile shift drawer'}</p>
                </button>
              </div>
            </div>

            {/* Recent Sales Table with Working Modal Triggers */}
            <div className="bg-white rounded-xl border border-[#E1DFDD] p-5 shadow-xs">
              <div className="flex items-center justify-between border-b border-[#EDEBE9] pb-3 mb-3">
                <h4 className="font-bold text-sm text-[#323130]">{isSw ? 'Risiti za Hivi Karibuni Kwenye Zamu Yako' : 'Recent Receipts Issued on Shift'}</h4>
                {canSeeReportsTab && (
                <button onClick={() => safeNavigate('reports')} className="text-xs text-[#0078D4] font-semibold hover:underline cursor-pointer">
                  {isSw ? 'Tazama Zote' : 'View All'} →
                </button>
                )}
              </div>

              <div className="divide-y divide-[#EDEBE9] text-xs">
                {recentSales.length === 0 ? (
                  <p className="py-6 text-center text-[#605E5C]">
                    {isSw ? 'Hakuna mauzo leo bado.' : 'No sales recorded today yet.'}
                  </p>
                ) : recentSales.map(sale => (
                  <div key={sale.id} className="py-2.5 flex items-center justify-between hover:bg-[#F8F8F8] px-2 rounded-lg transition-colors">
                    <div>
                      <div className="font-bold text-[#323130] flex items-center gap-2">
                        <span>{sale.receiptNumber}</span>
                        <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">TRA OK</span>
                      </div>
                      <div className="text-[11px] text-[#605E5C]">{sale.date} • {sale.customerName || 'Walk-in Cash Customer'}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="font-bold text-[#323130] font-mono">{formatTSh(sale.total)}</div>
                        <div className="text-[10px] text-[#0078D4] capitalize font-medium">{sale.payments[0]?.method || 'Cash'}</div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedReceipt(sale);
                          setIsReceiptModalOpen(true);
                        }}
                        className="p-1.5 bg-[#F3F2F1] hover:bg-[#EDEBE9] text-[#323130] rounded-lg border border-[#C8C6C4] cursor-pointer"
                        title={isSw ? 'Tazama / Chapisha Risiti' : 'View / Print Receipt'}
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Col: SOP Checklist & Live Till QR */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-[#E1DFDD] p-5 shadow-xs space-y-3">
              <h4 className="font-bold text-sm text-[#323130] flex items-center gap-2 border-b border-[#EDEBE9] pb-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{isSw ? 'Orodha ya Zamu ya Keshia' : 'Shift SOP Checklist'}</span>
              </h4>

              <div className="space-y-2 text-xs">
                <label className="flex items-center gap-2.5 p-2 bg-emerald-50/60 rounded-lg text-[#323130]">
                  <input type="checkbox" defaultChecked className="rounded text-emerald-600" />
                  <span>{isSw ? 'Kikombe cha float TSh 50,000 kimethibitishwa' : 'Float TSh 50,000 verified'}</span>
                </label>
                <label className="flex items-center gap-2.5 p-2 bg-emerald-50/60 rounded-lg text-[#323130]">
                  <input type="checkbox" defaultChecked className="rounded text-emerald-600" />
                  <span>{isSw ? 'Mashine ya TRA EFD ina karatasi na mtandao' : 'TRA EFD printer roll ready'}</span>
                </label>
                <label className="flex items-center gap-2.5 p-2 bg-blue-50/60 rounded-lg text-[#323130]">
                  <input type="checkbox" defaultChecked className="rounded text-[#0078D4]" />
                  <span>{isSw ? 'Kifaa cha Lipa Namba M-Pesa kiko mezani' : 'Lipa Namba QR visible to client'}</span>
                </label>
                <label className="flex items-center gap-2.5 p-2 bg-[#F8F8F8] rounded-lg text-[#323130]">
                  <input type="checkbox" className="rounded text-[#0078D4]" />
                  <span>{isSw ? 'Hesabu ya mwisho wa zamu (Z-Report)' : 'End of shift Z-Report handover'}</span>
                </label>
              </div>
            </div>

            {/* Quick M-Pesa / Tigo QR Card */}
            <div className="bg-gradient-to-br from-[#0078D4] to-[#6264A7] text-white p-5 rounded-xl shadow-md space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider">{isSw ? 'Lipa Namba ya Duka' : 'Instant Till QR'}</span>
                <span className="px-2 py-0.5 rounded bg-white/20 text-white text-[10px] font-mono font-bold">TILL: 884920</span>
              </div>
              <div className="bg-white p-3.5 rounded-xl flex items-center justify-center text-slate-800 shadow-inner">
                <div className="text-center">
                  <div className="font-mono font-extrabold text-xl text-[#0078D4]">LIPA HAPA</div>
                  <div className="text-xs text-slate-700 font-bold mt-0.5">{branchName}</div>
                  <div className="text-[10px] text-slate-500 mt-1 font-mono tracking-wider">VODACOM • TIGO • AIRTEL</div>
                </div>
              </div>
              <p className="text-[11px] text-blue-100 text-center">
                {isSw ? 'Mteja akilipa kwa simu, jina na risiti inatokea hapa papo hapo.' : 'Instant webhook sync on mobile payment.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // =========================================================================
  // 2. PHARMACIST CLINICAL DISPENSING SITE (MFAMASIA)
  // =========================================================================
  const renderPharmacistSite = () => {
    const rxProducts = products.filter(p => p.requiresPrescription || p.category.includes('Medicines') || p.category.includes('Antibiotics'));

    return (
      <div className="space-y-6 animate-fade-in font-sans">
        <div className="bg-gradient-to-r from-teal-900 via-teal-800 to-slate-900 text-white p-5 rounded-2xl shadow-md border border-teal-700/30 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-teal-400/20 text-teal-300 border border-teal-400/30 flex items-center justify-center text-2xl font-bold shadow-inner">
              🩺
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white tracking-tight">{staffName}</h3>
                <span className="px-2.5 py-0.5 rounded-full bg-teal-400/20 text-teal-300 border border-teal-400/30 text-[10px] font-extrabold uppercase">
                  {isSw ? 'Mfamasia Mkuu (Licensed Pharmacist)' : 'Clinical Lead & Dispenser'}
                </span>
              </div>
              <p className="text-xs text-slate-300 flex items-center gap-2 mt-1">
                <span>📍 TMDA License: TMDA-PHARM-2026-44</span>
                <span>•</span>
                <span>🏥 {branchName}</span>
                <span>•</span>
                <span className="text-teal-300 font-semibold">● Prescription Radar Active</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPrescriptionModalOpen(true)}
              className="px-4 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-xl text-xs font-extrabold shadow-md flex items-center gap-2 cursor-pointer transition-all hover:scale-105 active:scale-95"
            >
              <Pill className="w-4 h-4" />
              <span>{isSw ? 'Hakiki Dawa ya Cheti (Rx)' : 'Verify Prescription (Rx)'}</span>
            </button>
            <button
              onClick={() => setIsControlledDrugModalOpen(true)}
              className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold border border-white/15 cursor-pointer"
            >
              🔒 {isSw ? 'Dawa za Kudhibitiwa (DDA)' : 'Controlled Log (DDA)'}
            </button>
          </div>
        </div>

        {/* Clinical KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-[#E1DFDD] shadow-xs">
            <div className="text-xs text-[#605E5C] font-semibold flex items-center justify-between">
              <span>{isSw ? 'Dawa za Cheti Zilizotolewa' : 'Prescriptions Dispensed'}</span>
              <span>📋</span>
            </div>
            <div className="text-xl font-extrabold text-teal-800 mt-1 font-mono">
              19 {isSw ? 'Leo' : 'Today'}
            </div>
            <div className="text-[11px] text-teal-700 font-semibold mt-1">
              ✓ All signed with batch & expiry
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-[#E1DFDD] shadow-xs">
            <div className="text-xs text-[#605E5C] font-semibold flex items-center justify-between">
              <span>{isSw ? 'Dawa Karibu Kumalizika Muda' : 'Near-Expiry Batches (<90d)'}</span>
              <span>⚠️</span>
            </div>
            <div className="text-xl font-extrabold text-amber-700 mt-1 font-mono">
              3 Batches
            </div>
            <div className="text-[11px] text-amber-800 font-semibold mt-1">
              Flagged for FIFO Priority
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-[#E1DFDD] shadow-xs">
            <div className="text-xs text-[#605E5C] font-semibold flex items-center justify-between">
              <span>{isSw ? 'Dawa za Kipekee (Controlled)' : 'Controlled Substances Reg.'}</span>
              <span>🔒</span>
            </div>
            <div className="text-xl font-extrabold text-[#323130] mt-1 font-mono">
              14 Items
            </div>
            <div className="text-[11px] text-emerald-700 font-semibold mt-1">
              ✓ Vault balance locked & logged
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-[#E1DFDD] shadow-xs">
            <div className="text-xs text-[#605E5C] font-semibold flex items-center justify-between">
              <span>{isSw ? 'Mrejesho wa Wagonjwa (CRM)' : 'Patient Adherence Calls'}</span>
              <span>📞</span>
            </div>
            <div className="text-xl font-extrabold text-[#0078D4] mt-1 font-mono">
              8 Scheduled
            </div>
            <div className="text-[11px] text-[#0078D4] font-semibold mt-1">
              Refill alerts sent via SMS
            </div>
          </div>
        </div>

        {/* Prescription Verification Queue */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl border border-[#E1DFDD] p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#EDEBE9] pb-3">
              <h4 className="font-bold text-sm text-[#323130] flex items-center gap-2">
                <Pill className="w-4 h-4 text-teal-600" />
                <span>{isSw ? 'Dawa Zinazohitaji Ukaguzi wa Mfamasia (Rx Verification)' : 'Clinical Prescription Validation Queue'}</span>
              </h4>
              <button
                onClick={() => setIsPrescriptionModalOpen(true)}
                className="px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-bold hover:bg-teal-500 cursor-pointer"
              >
                + {isSw ? 'Ingiza Cheti Kipya' : 'Log New Prescription'}
              </button>
            </div>

            <div className="divide-y divide-[#EDEBE9] text-xs">
              {rxProducts.map((prod) => (
                <div key={prod.id} className="py-3 flex items-center justify-between hover:bg-teal-50/40 px-2 rounded-lg transition-colors">
                  <div>
                    <div className="font-bold text-[#323130] flex items-center gap-2">
                      <span>{prod.name}</span>
                      <span className="px-1.5 py-0.2 rounded bg-teal-100 text-teal-800 text-[10px] font-semibold">
                        Batch: {prod.batchNumber || 'BT-2026-A1'}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#605E5C] mt-0.5">
                      Expiry: {prod.expiryDate || '2027-12-31'} • Stock: {prod.stock} {prod.unit} • Price: {formatTSh(prod.price)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        showToast(isSw ? `Dawa ya ${prod.name} imehakikiwa kwa ufanisi!` : `Prescription for ${prod.name} approved!`);
                      }}
                      className="px-3 py-1 bg-teal-100 hover:bg-teal-200 text-teal-900 rounded font-bold text-xs cursor-pointer"
                    >
                      {isSw ? 'Thibitisha (Approve Rx)' : 'Approve Rx'}
                    </button>
                    <button
                      onClick={() => safeNavigate('pos')}
                      className="px-2.5 py-1 bg-[#0078D4] text-white rounded font-semibold text-xs hover:bg-[#006cbd] cursor-pointer"
                    >
                      {isSw ? 'Uza POS' : 'Dispense'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-[#E1DFDD] p-5 shadow-xs space-y-3">
              <h4 className="font-bold text-sm text-[#323130] flex items-center gap-2 border-b border-[#EDEBE9] pb-2">
                <ShieldCheck className="w-4 h-4 text-teal-600" />
                <span>{isSw ? 'Miongozo ya TMDA & Dawa Hatari' : 'TMDA Regulatory Adherence'}</span>
              </h4>
              <p className="text-xs text-[#605E5C]">
                {isSw 
                  ? 'Kila dawa ya Antibiotics na Dawa za Kudhibitiwa (Controlled) lazima zihakikiwe na Mfamasia kabla ya kutoa risiti ya TRA.' 
                  : 'All scheduled antibiotics and controlled substances require clinical sign-off.'
                }
              </p>
              <div className="p-3 bg-teal-50 rounded-lg border border-teal-200 text-xs text-teal-950 font-medium space-y-1">
                <div className="font-bold text-teal-900">🛡️ TMDA Good Pharmacy Practice (GPP)</div>
                <div className="text-[11px] text-teal-800">Status: Fully Compliant with TMDA 2026 Audit Standard</div>
              </div>

              <button
                onClick={() => onOpenAIChatWithPrompt('Explain dosage guidelines and contraindications for amoxicillin and cephalosporins in adult Tanzanian patients.')}
                className="w-full py-2 bg-gradient-to-r from-teal-600 to-indigo-600 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                <span>Clinical Dosage AI Assistant</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // =========================================================================
  // 3. STOREKEEPER & INVENTORY LOGISTICS SITE (MSIMAMIZI WA GHALA / STOO)
  // =========================================================================
  const renderStorekeeperSite = () => {
    const lowStock = products.filter(p => p.stock <= p.reorderPoint);

    return (
      <div className="space-y-6 animate-fade-in font-sans">
        <div className="bg-gradient-to-r from-amber-900 via-amber-800 to-stone-900 text-white p-5 rounded-2xl shadow-md border border-amber-700/30 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-amber-400/20 text-amber-300 border border-amber-400/30 flex items-center justify-center text-2xl font-bold shadow-inner">
              📦
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white tracking-tight">{staffName}</h3>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] font-extrabold uppercase">
                  {isSw ? 'Mkuu wa Stoo & Mizigo' : 'Warehouse & Logistics Lead'}
                </span>
              </div>
              <p className="text-xs text-slate-300 flex items-center gap-2 mt-1">
                <span>📍 Stoo Kuu (Warehouse Bay 1)</span>
                <span>•</span>
                <span>🚚 {purchaseOrders.length} {isSw ? 'Oda za Wasambazaji' : 'Active Supplier POs'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsReceivePOModalOpen(true)}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-extrabold shadow-md flex items-center gap-2 cursor-pointer"
            >
              <Truck className="w-4 h-4" />
              <span>{isSw ? 'Pokea Mzigo Mpya (Receive PO)' : 'Receive Goods Inward'}</span>
            </button>
            <button
              onClick={() => setIsStockTakeModalOpen(true)}
              className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold border border-white/15 cursor-pointer"
            >
              {isSw ? 'Hesabu ya Stoo (Cycle Count)' : 'Cycle Count'}
            </button>
            <button
              onClick={() => setIsInterBranchTransferModalOpen(true)}
              className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold border border-white/15 cursor-pointer"
            >
              🔄 {isSw ? 'Hamisha Tawi' : 'Branch Transfer'}
            </button>
          </div>
        </div>

        {/* Storekeeper Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-[#E1DFDD] shadow-xs">
            <div className="text-xs text-[#605E5C] font-semibold flex items-center justify-between">
              <span>{isSw ? 'Bidhaa Zilizobaki Kidogo' : 'Low Stock Reorder Alerts'}</span>
              <span>⚠️</span>
            </div>
            <div className="text-xl font-extrabold text-rose-700 mt-1 font-mono">
              {lowStock.length} {isSw ? 'Bidhaa' : 'Items'}
            </div>
            <div className="text-[11px] text-rose-700 font-semibold mt-1">
              Urgent restock needed
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-[#E1DFDD] shadow-xs">
            <div className="text-xs text-[#605E5C] font-semibold flex items-center justify-between">
              <span>{isSw ? 'Mizigo Inayotarajiwa' : 'Expected Deliveries'}</span>
              <span>🚚</span>
            </div>
            <div className="text-xl font-extrabold text-[#0078D4] mt-1 font-mono">
              {purchaseOrders.filter(p => p.status === 'sent').length || 2} Shipments
            </div>
            <div className="text-[11px] text-[#0078D4] mt-1">
              Harshil Pharma & MedStore
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-[#E1DFDD] shadow-xs">
            <div className="text-xs text-[#605E5C] font-semibold flex items-center justify-between">
              <span>{isSw ? 'Mizunguko ya Bidhaa (Movements)' : 'Stock Movements Today'}</span>
              <span>🔄</span>
            </div>
            <div className="text-xl font-extrabold text-emerald-700 mt-1 font-mono">
              {stockMovements.length} Logged
            </div>
            <div className="text-[11px] text-emerald-700 font-semibold mt-1">
              All batches audited
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-[#E1DFDD] shadow-xs">
            <div className="text-xs text-[#605E5C] font-semibold flex items-center justify-between">
              <span>{isSw ? 'Uharibifu / Upotevu' : 'Damaged / Write-off'}</span>
              <span>🗑️</span>
            </div>
            <div className="text-xl font-extrabold text-slate-700 mt-1 font-mono">
              {formatTSh(10400)}
            </div>
            <div className="text-[11px] text-[#605E5C] mt-1">
              Amoxicillin crushed box
            </div>
          </div>
        </div>

        {/* PO Inward Receiving & Low Stock Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl border border-[#E1DFDD] p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#EDEBE9] pb-3">
              <h4 className="font-bold text-sm text-[#323130] flex items-center gap-2">
                <Truck className="w-4 h-4 text-amber-600" />
                <span>{isSw ? 'Mizigo ya Wasambazaji Inayosubiri Kupokelewa' : 'Supplier Purchase Orders In Transit'}</span>
              </h4>
              <button onClick={() => safeNavigate('suppliers')} className="text-xs text-[#0078D4] font-semibold hover:underline cursor-pointer">
                {isSw ? 'Fungua Wasambazaji' : 'View POs'} →
              </button>
            </div>

            <div className="divide-y divide-[#EDEBE9] text-xs">
              {purchaseOrders.map((po) => (
                <div key={po.id} className="py-3 flex items-center justify-between hover:bg-amber-50/30 px-2 rounded-lg transition-colors">
                  <div>
                    <div className="font-bold text-[#323130] flex items-center gap-2">
                      <span>{po.poNumber}</span>
                      <span className="font-semibold text-slate-600">• {po.supplierName}</span>
                      <span className={`px-2 py-0.2 rounded-full text-[10px] font-bold ${
                        po.status === 'received' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {po.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#605E5C] mt-0.5">
                      {po.items.length} {isSw ? 'aina za bidhaa' : 'line items'} • Expected: {po.expectedDate} • Total: {formatTSh(po.totalAmount)}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedPO(po);
                      setIsReceivePOModalOpen(true);
                    }}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold cursor-pointer"
                  >
                    {isSw ? 'Hakiki & Pokea' : 'Receive Goods'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-[#E1DFDD] p-5 shadow-xs space-y-3">
              <h4 className="font-bold text-sm text-[#323130] flex items-center gap-2 border-b border-[#EDEBE9] pb-2">
                <Boxes className="w-4 h-4 text-amber-600" />
                <span>{isSw ? 'Tahadhari ya Kuisha kwa Bidhaa' : 'Reorder Priority List'}</span>
              </h4>
              <div className="space-y-2 text-xs max-h-72 overflow-y-auto">
                {lowStock.map(p => (
                  <div key={p.id} className="p-2.5 bg-rose-50/70 border border-rose-200 rounded-lg flex items-center justify-between">
                    <div>
                      <div className="font-bold text-rose-900">{p.name}</div>
                      <div className="text-[10px] text-rose-700">Stock: {p.stock} (Min: {p.reorderPoint})</div>
                    </div>
                    <button
                      onClick={() => safeNavigate('suppliers')}
                      className="px-2 py-1 bg-rose-600 text-white rounded text-[10px] font-bold hover:bg-rose-700 cursor-pointer"
                    >
                      {isSw ? 'Agiza' : 'Reorder'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // =========================================================================
  // 4. ACCOUNTANT & FINANCIAL CONTROLLER SITE (MHASIBU MKUU)
  // =========================================================================
  const renderAccountantSite = () => {
    return (
      <div className="space-y-6 animate-fade-in font-sans">
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white p-5 rounded-2xl shadow-md border border-indigo-700/30 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-indigo-400/20 text-indigo-300 border border-indigo-400/30 flex items-center justify-center text-2xl font-bold shadow-inner">
              📊
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white tracking-tight">{staffName}</h3>
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-400/20 text-indigo-300 border border-indigo-400/30 text-[10px] font-extrabold uppercase">
                  {isSw ? 'Mhasibu Mkuu (Financial Controller)' : 'Lead Accountant & Tax Auditor'}
                </span>
              </div>
              <p className="text-xs text-slate-300 flex items-center gap-2 mt-1">
                <span>📍 TRA EFD Node • {branchName}</span>
                <span>•</span>
                <span>📑 VAT 18% Ledger Ready</span>
                <span>•</span>
                <span className="text-emerald-400 font-semibold">● Real-time Bank Reconciliation</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsTraReconcileModalOpen(true)}
              className="px-4 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-2 cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              <span>{isSw ? 'Reconcile TRA EFD & Bank' : 'Audit TRA EFD Ledger'}</span>
            </button>
            <button
              onClick={() => safeNavigate('reports')}
              className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold border border-white/15 cursor-pointer"
            >
              {isSw ? 'Ripoti za Faida & Hasara' : 'P&L Reports'}
            </button>
          </div>
        </div>

        {/* Accountant Financial Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-[#E1DFDD] shadow-xs">
            <div className="text-xs text-[#605E5C] font-semibold flex items-center justify-between">
              <span>{isSw ? 'Mapato ya Mwezi Huu' : 'Monthly Gross Revenue'}</span>
              <span>📈</span>
            </div>
            <div className="text-xl font-extrabold text-[#323130] mt-1 font-mono">
              {formatTSh(monthlyRevenue)}
            </div>
            <div className="text-[11px] text-emerald-700 font-semibold mt-1">
              {sales.length > 0
                ? (isSw ? 'Kutoka rekodi halisi za POS' : 'From live POS records')
                : (isSw ? 'Hakuna mauzo bado' : 'No sales yet')}
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-[#E1DFDD] shadow-xs">
            <div className="text-xs text-[#605E5C] font-semibold flex items-center justify-between">
              <span>{isSw ? 'Kodi ya TRA VAT (18%)' : 'TRA Output VAT Liability'}</span>
              <span>🧾</span>
            </div>
            <div className="text-xl font-extrabold text-indigo-700 mt-1 font-mono">
              {formatTSh(monthlyVAT)}
            </div>
            <div className="text-[11px] text-[#605E5C] mt-1">
              Due on 20th next month
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-[#E1DFDD] shadow-xs">
            <div className="text-xs text-[#605E5C] font-semibold flex items-center justify-between">
              <span>{isSw ? 'Madeni ya Wateja (Debtors)' : 'Outstanding Accounts Receivable'}</span>
              <span>👥</span>
            </div>
            <div className="text-xl font-extrabold text-amber-700 mt-1 font-mono">
              {formatTSh(totalOutstandingCredit)}
            </div>
            <div className="text-[11px] text-amber-700 font-semibold mt-1">
              {creditCustomerCount} {isSw ? 'wateja wenye deni' : 'customers with active credit'}
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-[#E1DFDD] shadow-xs">
            <div className="text-xs text-[#605E5C] font-semibold flex items-center justify-between">
              <span>{isSw ? 'Madeni ya Wasambazaji (Payable)' : 'Accounts Payable (Suppliers)'}</span>
              <span>🚚</span>
            </div>
            <div className="text-xl font-extrabold text-rose-700 mt-1 font-mono">
              {formatTSh(1850000)}
            </div>
            <div className="text-[11px] text-[#605E5C] mt-1">
              Harshil Pharma Net 30
            </div>
          </div>
        </div>

        {/* Debt Dunning & Supplier Settlement Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-[#E1DFDD] p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#EDEBE9] pb-3">
              <h4 className="font-bold text-sm text-[#323130] flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-indigo-600" />
                <span>{isSw ? 'Madeni ya Wateja & Hatua za Dunning (Collections)' : 'Customer Credit Aging & Dunning'}</span>
              </h4>
              <button onClick={() => safeNavigate('customers')} className="text-xs text-[#0078D4] font-semibold hover:underline cursor-pointer">
                {isSw ? 'Fungua CRM' : 'Manage'} →
              </button>
            </div>

            <div className="divide-y divide-[#EDEBE9] text-xs">
              {customers.slice(0, 4).map(c => (
                <div key={c.id} className="py-3 flex items-center justify-between hover:bg-[#F8F8F8] px-2 rounded-lg">
                  <div>
                    <div className="font-bold text-[#323130]">{c.name}</div>
                    <div className="text-[11px] text-[#605E5C]">{c.phone} • Limit: {formatTSh(c.creditLimit)}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-amber-700 font-mono">{formatTSh(c.balance)}</div>
                    <button
                      onClick={() => {
                        showToast(isSw ? `Kumbusho la SMS limetumwa kwa ${c.name}!` : `Dunning SMS reminder sent to ${c.name}!`);
                      }}
                      className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded font-bold text-[10px] hover:bg-indigo-100 mt-1 cursor-pointer"
                    >
                      {isSw ? 'Tuma SMS ya Deni' : 'Send Reminder'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#E1DFDD] p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#EDEBE9] pb-3">
              <h4 className="font-bold text-sm text-[#323130] flex items-center gap-2">
                <Truck className="w-4 h-4 text-indigo-600" />
                <span>{isSw ? 'Malipo ya Wasambazaji (Supplier Settlements)' : 'Supplier Invoices Ready for Payment'}</span>
              </h4>
              <button onClick={() => safeNavigate('suppliers')} className="text-xs text-[#0078D4] font-semibold hover:underline cursor-pointer">
                {isSw ? 'Wasambazaji' : 'Suppliers'} →
              </button>
            </div>

            <div className="divide-y divide-[#EDEBE9] text-xs">
              {suppliers.map(s => (
                <div key={s.id} className="py-3 flex items-center justify-between hover:bg-[#F8F8F8] px-2 rounded-lg">
                  <div>
                    <div className="font-bold text-[#323130]">{s.name}</div>
                    <div className="text-[11px] text-[#605E5C]">{s.paymentTerms} • Contact: {s.contactPerson}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-rose-700 font-mono">{formatTSh(s.outstandingPayable)}</div>
                    <button
                      onClick={() => {
                        setIsSupplierPaymentModalOpen(true);
                      }}
                      className="px-2.5 py-0.5 bg-emerald-600 text-white rounded font-bold text-[10px] hover:bg-emerald-700 mt-1 cursor-pointer"
                    >
                      {isSw ? 'Lipa CRDB Bank' : 'Pay via Bank'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // =========================================================================
  // 5. MANAGER & BRANCH SUPERVISOR SITE (MENEJA WA TAWI)
  // =========================================================================
  const renderManagerSite = () => {
    return (
      <div className="space-y-6 animate-fade-in font-sans">
        <div className="flex flex-col xl:flex-row gap-4 xl:items-stretch">
          <div className="flex-1 order-2 xl:order-1">
        <div className="bg-gradient-to-r from-purple-900 via-purple-800 to-indigo-950 text-white p-5 rounded-2xl shadow-md border border-purple-700/30 flex flex-wrap items-center justify-between gap-4 h-full">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-purple-400/20 text-purple-300 border border-purple-400/30 flex items-center justify-center text-2xl font-bold shadow-inner">
              👑
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white tracking-tight">{staffName}</h3>
                <span className="px-2.5 py-0.5 rounded-full bg-purple-400/20 text-purple-300 border border-purple-400/30 text-[10px] font-extrabold uppercase">
                  {isSw ? 'Meneja wa Tawi (Branch General Manager)' : 'Branch Operations Manager'}
                </span>
              </div>
              <p className="text-xs text-slate-300 flex items-center gap-2 mt-1">
                <span>🏢 {branchName}</span>
                <span>•</span>
                <span>👥 {staffList.length || 5} Active Shift Personnel</span>
                <span>•</span>
                <span className="text-purple-300 font-semibold">● Store Operations Green</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsRosterModalOpen(true)}
              className="px-4 py-2.5 bg-purple-500 hover:bg-purple-400 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-2 cursor-pointer transition-all hover:scale-105 active:scale-95"
            >
              <Clock className="w-4 h-4" />
              <span>{isSw ? 'Ratiba ya Zamu (Roster)' : 'Manage Shift Roster'}</span>
            </button>
            {canManageRBAC && (
            <button
              onClick={() => safeNavigate('settings')}
              className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold border border-white/15 cursor-pointer"
            >
              🛡️ {isSw ? 'Mamlaka ya RBAC' : 'RBAC Matrix'}
            </button>
            )}
          </div>
        </div>
          </div>
          <TodaySalesHeroKpi
            stats={todaySalesStats}
            isSw={isSw}
            variant="owner"
            onClick={() => safeNavigate('reports')}
            className="w-full xl:w-[360px] shrink-0 order-1 xl:order-2"
          />
        </div>

        {/* Manager KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-[#E1DFDD] shadow-xs">
            <div className="text-xs text-[#605E5C] font-semibold flex items-center justify-between">
              <span>{isSw ? 'Lengo la Mauzo la Leo' : 'Today Sales Target'}</span>
              <span>🎯</span>
            </div>
            <div className="text-xl font-extrabold text-[#323130] mt-1 font-mono">
              84% (TSh 1.2M / 1.5M)
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
              <div className="bg-emerald-500 h-1.5 rounded-full w-[84%]"></div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-[#E1DFDD] shadow-xs">
            <div className="text-xs text-[#605E5C] font-semibold flex items-center justify-between">
              <span>{isSw ? 'Maombi ya Idhini (Approvals)' : 'Pending Manager Approvals'}</span>
              <span>🔔</span>
            </div>
            <div className="text-xl font-extrabold text-amber-700 mt-1 font-mono">
              {pendingApprovals.length} Actions
            </div>
            <div className="text-[11px] text-amber-800 font-semibold mt-1">
              Discounts, credits & refunds
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-[#E1DFDD] shadow-xs">
            <div className="text-xs text-[#605E5C] font-semibold flex items-center justify-between">
              <span>{isSw ? 'Wahudumu Kazini Sasa' : 'Staff On-Duty'}</span>
              <span>👥</span>
            </div>
            <div className="text-xl font-extrabold text-[#0078D4] mt-1 font-mono">
              {staffList.filter(s => s.active).length || 5} Active
            </div>
            <div className="text-[11px] text-emerald-700 font-semibold mt-1">
              100% Attendance on Morning Shift
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-[#E1DFDD] shadow-xs">
            <div className="text-xs text-[#605E5C] font-semibold flex items-center justify-between">
              <span>{isSw ? 'TRA EFD & Usalama' : 'TRA Device & Security'}</span>
              <span>🛡️</span>
            </div>
            <div className="text-xl font-extrabold text-emerald-700 mt-1 font-mono">
              Protected
            </div>
            <div className="text-[11px] text-emerald-700 font-semibold mt-1">
              No audit anomalies detected
            </div>
          </div>
        </div>

        {/* Manager Approvals Queue & Staff Quick Roster */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl border border-[#E1DFDD] p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#EDEBE9] pb-3">
              <h4 className="font-bold text-sm text-[#323130] flex items-center gap-2">
                <Shield className="w-4 h-4 text-purple-600" />
                <span>{isSw ? 'Orodha ya Idhini za Meneja (Live Authorization Queue)' : 'Real-Time Manager Authorization Queue'}</span>
              </h4>
              <span className="text-xs text-purple-700 font-bold bg-purple-50 px-2 py-0.5 rounded-full">
                {pendingApprovals.length} Pending
              </span>
            </div>

            {pendingApprovals.length > 0 ? (
              <div className="space-y-3">
                {pendingApprovals.map(item => (
                  <div key={item.id} className="p-3.5 bg-[#F8F9FC] border border-[#EDEBE9] rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="space-y-1 max-w-md">
                      <div className="font-bold text-[#323130] flex items-center gap-2">
                        <span>{item.title}</span>
                        <span className="text-[10px] text-slate-500 font-normal">({item.time})</span>
                      </div>
                      <div className="text-[11px] text-[#605E5C]">
                        Requested by: <span className="font-semibold text-slate-800">{item.requester}</span> for <span className="font-semibold text-purple-900">{item.target}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 italic">"{item.notes}"</div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRejectItem(item.id, item.title)}
                        className="px-3 py-1.5 border border-rose-200 text-rose-700 hover:bg-rose-50 rounded-lg font-bold cursor-pointer transition-colors"
                      >
                        {isSw ? 'Kataa' : 'Reject'}
                      </button>
                      <button
                        onClick={() => handleApproveItem(item.id, item.title)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold cursor-pointer transition-colors shadow-xs"
                      >
                        {isSw ? 'Idhinisha' : 'Authorize'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-[#605E5C] text-xs">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                <div className="font-bold text-slate-800">{isSw ? 'Hakuna maombi yanayosubiri!' : 'All requests authorized!'}</div>
                <div>{isSw ? 'Kila kitu kiko sawa katika zamu ya sasa.' : 'Store is running smoothly with 0 pending overrides.'}</div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-[#E1DFDD] p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-[#EDEBE9] pb-2">
                <h4 className="font-bold text-sm text-[#323130] flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-600" />
                  <span>{isSw ? 'Wahudumu wa Tawi Leo' : 'Branch Staff Roster'}</span>
                </h4>
                {canManageRBAC && (
                <button onClick={() => safeNavigate('settings')} className="text-xs text-[#0078D4] font-semibold hover:underline">
                  {isSw ? 'Wote' : 'Manage'} →
                </button>
                )}
              </div>

              <div className="space-y-2 text-xs divide-y divide-[#EDEBE9]">
                {staffList.map(s => (
                  <div key={s.id} className="pt-2 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-[#323130]">{s.name}</div>
                      <div className="text-[10px] text-[#605E5C]">{s.role} • {s.shift}</div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                      s.active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {s.active ? 'ACTIVE' : 'OFF'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // =========================================================================
  // 6. OWNER & EXECUTIVE DIRECTOR SITE (MMILIKI / MKURUGENZI)
  // =========================================================================
  const renderOwnerSite = () => {
    const isMultiBranch = branches.length > 1;
    const branchDots = ['bg-emerald-500', 'bg-blue-500', 'bg-amber-500', 'bg-purple-500'];

    return (
      <div className="space-y-6 animate-fade-in font-sans">
        <div className="bg-gradient-to-r from-[#1E213D] via-[#24284A] to-[#0A0D24] text-white p-5 rounded-2xl shadow-md border border-[#323762] flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-amber-400/20 text-amber-300 border border-amber-400/30 flex items-center justify-center text-2xl font-bold shadow-inner">
              🏛️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white tracking-tight">{staffName}</h3>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] font-extrabold uppercase">
                  {isSw ? 'Mkurugenzi Mtendaji & Mmiliki' : 'Executive Owner & Managing Director'}
                </span>
              </div>
              <p className="text-xs text-slate-300 flex items-center gap-2 mt-1 flex-wrap">
                <span>🏢 {businessDisplayName}{hqBranchId && branches.length === 1 ? ' — HQ' : ''}</span>
                <span>•</span>
                <span>
                  {isMultiBranch
                    ? (isSw ? `Uchambuzi wa Matawi ${branches.length}` : `${branches.length}-Branch P&L Command`)
                    : (isSw ? 'Uchambuzi wa Tawi' : 'Single-Branch P&L')}
                </span>
                <span>•</span>
                <span className="text-amber-300 font-semibold">● {isSw ? 'Hali ya Mmiliki' : 'Owner View'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => safeNavigate('reports')}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-extrabold shadow-md flex items-center gap-2 cursor-pointer transition-all hover:scale-105 active:scale-95"
            >
              <BarChart3 className="w-4 h-4" />
              <span>{isSw ? 'Uchambuzi wa Faida (P&L)' : 'Executive Financial P&L'}</span>
            </button>
            <button
              onClick={() => safeNavigate('settings')}
              className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold border border-white/15 cursor-pointer"
            >
              ⚙️ {isSw ? 'Mipangilio ya Duka' : 'Business Settings'}
            </button>
          </div>
        </div>

        {/* Executive Metric Cards — live from sales & inventory */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-[#E1DFDD] shadow-xs">
            <div className="text-xs text-[#605E5C] font-semibold flex items-center justify-between">
              <span>{isSw ? 'Mapato Ghafi ya Mwezi' : 'Monthly Gross GMV'}</span>
              <span>💎</span>
            </div>
            <div className="text-xl font-extrabold text-[#323130] mt-1 font-mono">
              {formatTSh(monthlyRevenue)}
            </div>
            <div className="text-[11px] text-[#605E5C] font-semibold mt-1">
              {monthSales.length > 0
                ? (isSw ? `${monthSales.length} mauzo mwezi huu` : `${monthSales.length} sales this month`)
                : (isSw ? 'Hakuna mauzo bado mwezi huu' : 'No sales recorded this month yet')}
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-[#E1DFDD] shadow-xs">
            <div className="text-xs text-[#605E5C] font-semibold flex items-center justify-between">
              <span>{isSw ? 'Faida Halisi (Net Margin)' : 'Estimated Net Profit'}</span>
              <span>💰</span>
            </div>
            <div className="text-xl font-extrabold text-emerald-700 mt-1 font-mono">
              {formatTSh(estimatedNetProfit)}{monthlyRevenue > 0 ? ` (${netMarginPct}%)` : ''}
            </div>
            <div className="text-[11px] text-[#605E5C] mt-1">
              {monthlyRevenue > 0
                ? (isSw ? 'Baada ya COGS (gharama ya bidhaa)' : 'After COGS (product cost)')
                : (isSw ? 'Inahitaji mauzo ya POS' : 'Requires POS sales data')}
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-[#E1DFDD] shadow-xs">
            <div className="text-xs text-[#605E5C] font-semibold flex items-center justify-between">
              <span>{isSw ? 'Thamani ya Bidhaa Stoo' : 'Inventory Valuation (Cost)'}</span>
              <span>📦</span>
            </div>
            <div className="text-xl font-extrabold text-[#0078D4] mt-1 font-mono">
              {formatTSh(inventoryValuation)}
            </div>
            <div className="text-[11px] text-[#605E5C] mt-1">
              {isSw
                ? `Katika ${branches.length || 1} ${branches.length === 1 ? 'tawi' : 'matawi'}`
                : `Across ${branches.length || 1} branch${branches.length === 1 ? '' : 'es'}`}
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-[#E1DFDD] shadow-xs">
            <div className="text-xs text-[#605E5C] font-semibold flex items-center justify-between">
              <span>{isSw ? 'Mauzo ya Leo' : "Today's Sales"}</span>
              <span>📈</span>
            </div>
            <div className="text-xl font-extrabold text-emerald-700 mt-1 font-mono">
              {formatTSh(todaySalesStats.todayRevenue)}
            </div>
            <div className="text-[11px] text-[#605E5C] mt-1">
              {todaySalesStats.todayReceiptCount > 0
                ? (isSw ? `${todaySalesStats.todayReceiptCount} risiti leo` : `${todaySalesStats.todayReceiptCount} receipts today`)
                : (isSw ? 'Hakuna mauzo leo bado' : 'No sales today yet')}
            </div>
          </div>
        </div>

        {/* Branch performance — real branches only */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl border border-[#E1DFDD] p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#EDEBE9] pb-3">
              <h4 className="font-bold text-sm text-[#323130] flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#0078D4]" />
                <span>{isSw ? 'Uchambuzi wa Utendaji wa Matawi' : 'Branch Performance Comparison'}</span>
              </h4>
              <button onClick={() => safeNavigate('branches')} className="text-xs text-[#0078D4] font-semibold hover:underline">
                {isSw ? 'Simamia Matawi' : 'Manage Branches'} →
              </button>
            </div>

            {branchPerformance.length === 0 ? (
              <p className="text-xs text-[#605E5C] py-6 text-center">
                {isSw ? 'Hakuna matawi yaliyosajiliwa bado.' : 'No branches registered yet.'}
              </p>
            ) : (
              <div className="space-y-3 text-xs">
                {branchPerformance.map((row, idx) => (
                  <div key={row.branchId} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between font-bold text-[#323130]">
                      <span className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${branchDots[idx % branchDots.length]}`} />
                        <span>{idx + 1}. {row.branchName}</span>
                      </span>
                      <span className="font-mono text-emerald-700">{formatTSh(row.revenue)}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[11px] text-[#605E5C] pt-1 border-t border-slate-200">
                      <div>{isSw ? 'Mauzo' : 'Transactions'}: <strong>{row.transactionCount}</strong></div>
                      <div>{isSw ? 'Wastani/Oda' : 'Avg Basket'}: <strong>{formatTSh(row.avgBasket)}</strong></div>
                      <div>{isSw ? 'Faida Ghafi' : 'Gross Margin'}: <strong>{row.grossMarginPct}%</strong></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="bg-gradient-to-br from-indigo-900 to-purple-950 text-white rounded-xl p-5 shadow-md space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                <h4 className="font-bold text-sm text-white">{isSw ? 'Mshauri wa AI wa Faida' : 'AI Expansion & Profit Advisor'}</h4>
              </div>
              <p className="text-xs text-indigo-200 leading-relaxed">
                {executiveAiHint}
              </p>
              <button
                onClick={() => onOpenAIChatWithPrompt(
                  isSw
                    ? `Nipe mkakati wa uongozi kwa ${businessDisplayName} yenye matawi ${branches.length}. Mapato ya mwezi: ${formatTSh(monthlyRevenue)}.`
                    : `Act as an executive strategist for ${businessDisplayName} (${branches.length} branch(es)). Monthly revenue: ${formatTSh(monthlyRevenue)}. Suggest inventory and margin improvements.`,
                )}
                className="w-full py-2 bg-white text-indigo-950 font-bold rounded-lg text-xs hover:bg-slate-100 transition-colors cursor-pointer shadow-xs"
              >
                {isSw ? 'Tengeneza Mkakati wa AI' : 'Generate Executive AI Strategy'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Dynamic Action Notification Toast */}
      {actionSuccessMsg && (
        <div className="fixed top-16 right-6 z-50 bg-[#107C10] text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-xs font-bold animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-white" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* Top Workstation Bar & RBAC Switcher */}
      <div className="bg-white rounded-xl border border-[#E1DFDD] p-4 shadow-xs flex flex-wrap items-center justify-between gap-4 text-xs font-sans">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl ${staffMember?.avatarColor || 'bg-indigo-600'} text-white flex items-center justify-center font-bold text-base shadow-xs`}>
            {staffName.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm text-[#323130]">{staffName}</span>
              <span className={`px-2 py-0.5 rounded-full font-extrabold border text-[10px] ${
                role === 'Cashier' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                role === 'Manager' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                role === 'Owner' ? 'bg-amber-100 text-amber-900 border-amber-200' :
                'bg-[#F3F2F1] text-[#323130] border-[#EDEBE9]'
              }`}>
                {role}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                {isSw ? 'KITUO HAI' : 'ACTIVE WORKSTATION'}
              </span>
            </div>
            <div className="text-[11px] text-[#605E5C] flex items-center gap-2 mt-0.5">
              <span>🏢 {branchName}</span>
              <span>•</span>
              <span>⏰ {shiftName}</span>
              <span>•</span>
              <span className="font-semibold text-[#6264A7]">
                {role === 'Cashier'
                  ? (isSw ? 'Mauzo & POS' : 'Sales & POS')
                  : role === 'Manager'
                    ? (isSw ? 'Usimamizi wa Tawi' : 'Branch Ops')
                    : role === 'Storekeeper'
                      ? (isSw ? 'Stoo & Manunuzi' : 'Stock & PO')
                      : (isSw ? 'Majukumu ya Zamu' : 'Shift duties')}
              </span>
            </div>
          </div>
        </div>

        {/* Workstation Quick Switcher Selector — owner/manager only */}
        <div className="flex items-center gap-2">
          {canSwitchStaff && staffList.length > 0 && onSwitchStaff && (
            <div className="flex items-center gap-1.5 bg-[#F8F8F8] border border-[#C8C6C4] px-2.5 py-1.5 rounded-xl">
              <span className="text-[10px] font-bold text-[#605E5C] uppercase">{isSw ? 'Badili Mfanyakazi:' : 'Switch Role:'}</span>
              <select
                value={effectiveStaff?.id || staffMember?.id || ''}
                onChange={(e) => {
                  const target = staffList.find(s => s.id === e.target.value);
                  if (target) {
                    onSwitchStaff(target);
                    showToast(isSw ? `Umeingia kwenye kituo cha ${target.name} (${target.role})` : `Switched to ${target.name}'s workstation (${target.role})`);
                  }
                }}
                className="bg-transparent font-bold text-[#323130] outline-none text-xs cursor-pointer"
              >
                {staffList.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.role}) — {s.branch}
                  </option>
                ))}
              </select>
            </div>
          )}

          {canManageRBAC && (
          <button
            onClick={() => safeNavigate('settings')}
            className="px-3 py-1.5 bg-blue-50 text-[#0078D4] border border-blue-200 rounded-xl font-bold hover:bg-blue-100 transition-colors cursor-pointer"
          >
            ⚙️ {isSw ? 'Mamlaka ya RBAC' : 'Manage RBAC'}
          </button>
          )}
        </div>
      </div>

      {/* Staff View Navigation Tabs */}
      <div className="flex items-center gap-2 p-1.5 bg-white rounded-xl border border-[#E1DFDD] shadow-xs">
        <button
          onClick={() => setActiveSiteView('workstation')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeSiteView === 'workstation'
              ? 'bg-[#6264A7] text-white shadow-xs'
              : 'text-[#605E5C] hover:bg-[#F3F2F1] hover:text-[#323130]'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>{isSw ? `Majukumu ya Zamu (${role})` : `Shift Workstation (${role})`}</span>
        </button>

        <button
          onClick={() => setActiveSiteView('my_earnings')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeSiteView === 'my_earnings'
              ? 'bg-[#6264A7] text-white shadow-xs'
              : 'text-[#605E5C] hover:bg-[#F3F2F1] hover:text-[#323130]'
          }`}
        >
          <Wallet className="w-4 h-4" />
          <span>{isSw ? 'Mshahara, Posho & Advance Zangu' : 'My Wages, Stipends & Advance'}</span>
          {!todayAllowanceClaimed && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
          )}
        </button>
      </div>

      {/* DAILY ALLOWANCE (FOOD & TRANSPORT) — staff self-claim */}
      {canSelfClaimStipend && effectiveStaff && (
      <div className={`p-4.5 rounded-2xl border transition-all ${
        todayAllowanceClaimed 
          ? 'bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50/30 border-emerald-300 shadow-xs' 
          : 'bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50/40 border-amber-300 shadow-md animate-pulse'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className={`p-3 rounded-2xl flex items-center justify-center text-xl shadow-xs ${
              todayAllowanceClaimed ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'
            }`}>
              {todayAllowanceClaimed ? '✓' : '☕'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-extrabold text-sm text-[#323130]">
                  {isSw ? 'Posho ya Leo: Chakula & Nauli (Daily Allowance)' : 'Today\'s Subsistence: Food & Transport'}
                </h4>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                  todayAllowanceClaimed ? 'bg-emerald-200 text-emerald-900' : 'bg-amber-200 text-amber-900'
                }`}>
                  {todayAllowanceClaimed ? '✓ UMEPOKEA & KUSAINI' : '⏳ TAYARI KUCHUKULIWA'}
                </span>
              </div>
              <p className="text-xs text-[#605E5C] mt-0.5 flex flex-wrap items-center gap-2">
                <span>Chakula: <strong className="text-slate-800 font-mono">{formatTSh(dailyFood)}</strong></span>
                <span>•</span>
                <span>Nauli: <strong className="text-slate-800 font-mono">{formatTSh(dailyTransport)}</strong></span>
                <span>•</span>
                <span>Jumla ya Siku: <strong className="text-emerald-700 font-mono font-black">{formatTSh(dailyTotal)}</strong></span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {todayAllowanceClaimed ? (
              <div className="text-right">
                <div className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                  <BadgeCheck className="w-4 h-4 text-emerald-600" />
                  <span>{isSw ? `Imethibitishwa: Saa ${allowanceClaimTime}` : `Verified at ${allowanceClaimTime}`}</span>
                </div>
                <div className="text-[10px] font-mono text-slate-500">Saini: {staffName} (Digital PIN)</div>
              </div>
            ) : (
              <button
                onClick={handleClaimDailyAllowance}
                disabled={isClaimingAllowance}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs shadow-md cursor-pointer transition-all hover:scale-105 active:scale-95 flex items-center gap-2 disabled:opacity-60"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isClaimingAllowance ? (isSw ? 'Inahifadhi...' : 'Saving...') : (isSw ? 'Saini & Chukua Posho ya Leo' : 'Sign & Claim Daily Stipend')}</span>
              </button>
            )}
          </div>
        </div>
      </div>
      )}

      {/* Render either Workstation or My Earnings */}
      {activeSiteView === 'workstation' ? (
        <>
          {role === 'Cashier' && renderCashierSite()}
          {role === 'Pharmacist' && renderPharmacistSite()}
          {role === 'Storekeeper' && renderStorekeeperSite()}
          {role === 'Accountant' && renderAccountantSite()}
          {role === 'Manager' && renderManagerSite()}
          {role === 'Owner' && renderOwnerSite()}
        </>
      ) : (
        /* MY EARNINGS, ADVANCES & PAYROLL VIEW FOR STAFF */
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Earnings Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-4.5 border border-[#E1DFDD] shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-[#605E5C] uppercase tracking-wider block">Mshahara Msingi (Basic)</span>
              <span className="text-xl font-black text-[#323130] block font-mono">{formatTSh(baseSalary)}</span>
              <span className="text-[10px] text-[#605E5C]">Kiwango cha Mkataba / mwezi</span>
            </div>

            <div className="bg-white rounded-2xl p-4.5 border border-[#E1DFDD] shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-[#605E5C] uppercase tracking-wider block">Posho za Kila Siku za Mwezi Huu</span>
              <span className="text-xl font-black text-emerald-700 block font-mono">+{formatTSh(dailyTotal * 26)}</span>
              <span className="text-[10px] text-emerald-700 font-bold">26 Siku za Kazi x {formatTSh(dailyTotal)}</span>
            </div>

            <div className="bg-white rounded-2xl p-4.5 border border-[#E1DFDD] shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-[#605E5C] uppercase tracking-wider block">Advance ya Mwezi Huu</span>
              <span className="text-xl font-black text-rose-600 block font-mono">
                -{formatTSh(myAdvances.filter(a => a.status === 'approved').reduce((acc, a) => acc + a.amount, 0))}
              </span>
              <span className="text-[10px] text-rose-600 font-medium">Inakatwa kwenye mshahara</span>
            </div>

            <div className="bg-gradient-to-br from-[#1E2244] to-[#3B427F] text-white rounded-2xl p-4.5 shadow-md space-y-1 border border-white/10">
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">Makadirio ya Net Pay</span>
              <span className="text-xl font-black text-emerald-300 block font-mono">
                {formatTSh(Math.round(baseSalary * 0.9 - myAdvances.filter(a => a.status === 'approved').reduce((acc, a) => acc + a.amount, 0)))}
              </span>
              <span className="text-[10px] text-slate-300">Baada ya NSSF 10% & Advance</span>
            </div>
          </div>

          {/* Action Bar & Advance Section */}
          <div className="bg-white rounded-2xl border border-[#E1DFDD] shadow-xs p-5 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#F3F2F1] pb-4">
              <div>
                <h3 className="font-extrabold text-base text-[#323130] flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-amber-600" />
                  <span>{isSw ? 'Maombi Yangu ya Advance za Mshahara' : 'My Salary Advance Requests & History'}</span>
                </h3>
                <p className="text-xs text-[#605E5C] mt-0.5">
                  {isSw 
                    ? 'Omba advance ya dharura mtandaoni. Boss anapokea ombi na akiafikia utalipwa kupitia M-Pesa mara moja.'
                    : 'Submit emergency advance requests. Verified and settled directly to your phone upon approval.'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsAdvanceModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isSw ? 'Omba Advance ya Dharura' : 'Request Advance'}</span>
                </button>

                <button
                  onClick={() => setIsPayslipModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-[#6264A7] hover:bg-[#555793] text-white font-bold text-xs shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <FileText className="w-4 h-4" />
                  <span>{isSw ? 'Tazama Slipi ya Mwezi Uliopita' : 'View Last Payslip'}</span>
                </button>
              </div>
            </div>

            {/* Advances Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#F8F8F8] text-[#605E5C] font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-3">Tarehe</th>
                    <th className="py-3 px-3 text-right">Kiasi (TSh)</th>
                    <th className="py-3 px-3">Sababu ya Dharura</th>
                    <th className="py-3 px-3 text-center">Hali ya Ombi</th>
                    <th className="py-3 px-3">Uthibitisho wa Boss</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F2F1]">
                  {myAdvances.map(adv => (
                    <tr key={adv.id} className="hover:bg-[#FAF9F8]">
                      <td className="py-3 px-3 font-mono text-[#605E5C]">{adv.date}</td>
                      <td className="py-3 px-3 text-right font-mono font-black text-rose-600 text-sm">
                        {formatTSh(adv.amount)}
                      </td>
                      <td className="py-3 px-3 text-[#323130]">{adv.reason}</td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          adv.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                          adv.status === 'pending' ? 'bg-amber-100 text-amber-800 animate-pulse' :
                          'bg-rose-100 text-rose-800'
                        }`}>
                          {adv.status === 'approved' ? '✓ IMEIDHINISHWA (M-PESA)' :
                           adv.status === 'pending' ? '⏳ INASUBIRI IDHINI YA BOSS' : '❌ IMEKATALIWA'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">
                        {adv.status === 'approved' ? 'Disbursed via M-Pesa Direct' : 'Pending Boss Review'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REQUEST SALARY ADVANCE */}
      {isAdvanceModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#F3F2F1] pb-3">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-base text-[#323130]">
                  {isSw ? 'Omba Advance ya Mshahara (Salary Advance)' : 'Request Salary Advance'}
                </h3>
              </div>
              <button onClick={() => setIsAdvanceModalOpen(false)} className="p-1 rounded-lg hover:bg-slate-100 cursor-pointer">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleRequestAdvance} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-[#323130] block mb-1">
                  {isSw ? 'Kiasi cha Advance Unachoomba (TSh)' : 'Requested Amount (TSh)'} *
                </label>
                <input
                  type="number"
                  required
                  min="5000"
                  max="150000"
                  placeholder="50,000"
                  value={advanceAmountInput}
                  onChange={e => setAdvanceAmountInput(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 border border-[#E1DFDD] rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <span className="text-[10px] text-[#605E5C] mt-1 block">
                  Kiwango cha juu cha mwezi huu ni TSh 150,000.
                </span>
              </div>

              <div>
                <label className="font-bold text-[#323130] block mb-1">
                  {isSw ? 'Sababu ya Dharura' : 'Reason for Emergency Advance'} *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder={isSw ? 'mf. Matibabu ya ghafla ya mtoto au ada ya shule...' : 'e.g. Family medical emergency...'}
                  value={advanceReasonInput}
                  onChange={e => setAdvanceReasonInput(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E1DFDD] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                />
              </div>

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[#605E5C] text-[11px]">
                {isSw 
                  ? 'Kumbuka: Kiasi hiki kitakatwa moja kwa moja kwenye mshahara wako wa mwisho wa mwezi pindi kitakapoidhinishwa na Boss.'
                  : 'Note: This advance will be automatically deducted from your upcoming month-end payroll payslip.'}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#F3F2F1]">
                <button
                  type="button"
                  onClick={() => setIsAdvanceModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#E1DFDD] text-xs font-bold text-[#323130] hover:bg-[#F3F2F1] cursor-pointer"
                >
                  {isSw ? 'Ghairi' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold cursor-pointer"
                >
                  {isSw ? 'Tuma Ombi kwa Boss' : 'Submit to Boss'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: STAFF DIGITAL PAYSLIP */}
      {isPayslipModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#F3F2F1] pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#1E2244]" />
                <h3 className="font-black text-base text-[#1E2244]">
                  {isSw ? 'Slipi Yangu ya Mshahara (Payslip - Julai 2026)' : 'My Salary Payslip (July 2026)'}
                </h3>
              </div>
              <button onClick={() => setIsPayslipModalOpen(false)} className="p-1 rounded-lg hover:bg-slate-100 cursor-pointer">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="p-5 rounded-2xl border border-slate-300 bg-white space-y-4 text-xs font-sans">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <h4 className="font-black text-sm text-[#1E2244] uppercase">{businessDisplayName}</h4>
                  <p className="text-[10px] text-slate-500">TIN: 142-889-102 • VRN: 40019283-Z</p>
                </div>
                <div className="text-right">
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">PAID</span>
                  <p className="text-[10px] font-mono text-slate-600 mt-1">PAYSLIP-2026-07-001</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-xl">
                <div><strong>Mfanyakazi:</strong> {staffName}</div>
                <div><strong>Wadhifa:</strong> {role}</div>
                <div><strong>Mwezi:</strong> Julai 2026</div>
                <div><strong>Tarehe:</strong> 2026-07-30</div>
              </div>

              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span>Mshahara Msingi</span>
                  <span className="font-mono font-bold">{formatTSh(baseSalary)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 text-emerald-700">
                  <span>Bonus ya Mauzo</span>
                  <span className="font-mono font-bold">+{formatTSh(30000)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 text-rose-600">
                  <span>Makato ya NSSF (10%)</span>
                  <span className="font-mono font-bold">-{formatTSh(Math.round(baseSalary * 0.1))}</span>
                </div>
                <div className="flex justify-between py-2 border-t-2 border-slate-900 font-black text-sm text-[#1E2244]">
                  <span>Kiasi Halisi Kilicholipwa (NET PAY)</span>
                  <span className="font-mono text-emerald-700">{formatTSh(Math.round(baseSalary * 0.9 + 30000))}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-200 text-[10px] text-slate-500">
                <div>Njia: M-Pesa Direct (+255 754 112 334)</div>
                <div className="flex items-center gap-1">
                  <QrCode className="w-4 h-4 text-slate-700" />
                  <span className="font-mono">VERIFIED</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={handlePrintStaffPayslip}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1E2244] text-white text-xs font-bold cursor-pointer hover:bg-[#2A305E]"
              >
                <Printer className="w-4 h-4" />
                <span>{isSw ? 'Chapisha (Print)' : 'Print'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: Cash Drawer Shift Tally & Denominations Counter */}
      {/* ========================================================================= */}
      {isCashDrawerModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-[#E1DFDD] shadow-2xl max-w-lg w-full p-6 space-y-4 text-xs font-sans max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#EDEBE9] pb-3">
              <h3 className="font-bold text-sm text-[#323130] flex items-center gap-2">
                <span>💵</span>
                <span>{isSw ? 'Hesabu ya Droo ya Fedha (Z-Report Shift Reconcile)' : 'Cash Drawer Shift Reconciliation'}</span>
              </h3>
              <button onClick={() => setIsCashDrawerModalOpen(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <div className="space-y-3">
              <div className="p-3 bg-[#F8F8F8] rounded-xl border border-[#EDEBE9] space-y-2">
                <div className="flex justify-between font-semibold text-[#605E5C]">
                  <span>Opening Float:</span>
                  <span className="font-mono text-[#323130]">TSh 50,000</span>
                </div>
                <div className="flex justify-between font-semibold text-[#605E5C]">
                  <span>Cash Sales Recorded:</span>
                  <span className="font-mono text-emerald-700">+ TSh 335,000</span>
                </div>
                <div className="flex justify-between font-bold text-[#323130] border-t border-[#EDEBE9] pt-1.5">
                  <span>Expected Total Cash in Drawer:</span>
                  <span className="font-mono text-base text-[#0078D4]">{formatTSh(cashDrawerTally)}</span>
                </div>
              </div>

              {/* Physical Notes Denomination Counter */}
              <div>
                <label className="block font-bold text-[#323130] mb-1.5">
                  {isSw ? 'Hesabu ya Noti za Tanzania (Physical Denominations Count):' : 'Physical Denominations Count:'}
                </label>
                <div className="grid grid-cols-2 gap-2 bg-[#F8F9FC] p-3 rounded-xl border border-[#EDEBE9]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-slate-700 font-bold">10,000 TSh:</span>
                    <input
                      type="number"
                      value={denominations.n10000}
                      onChange={(e) => setDenominations({ ...denominations, n10000: Math.max(0, parseInt(e.target.value) || 0) })}
                      className="w-16 px-2 py-1 bg-white border border-[#C8C6C4] rounded font-mono font-bold text-center"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-slate-700 font-bold">5,000 TSh:</span>
                    <input
                      type="number"
                      value={denominations.n5000}
                      onChange={(e) => setDenominations({ ...denominations, n5000: Math.max(0, parseInt(e.target.value) || 0) })}
                      className="w-16 px-2 py-1 bg-white border border-[#C8C6C4] rounded font-mono font-bold text-center"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-slate-700 font-bold">2,000 TSh:</span>
                    <input
                      type="number"
                      value={denominations.n2000}
                      onChange={(e) => setDenominations({ ...denominations, n2000: Math.max(0, parseInt(e.target.value) || 0) })}
                      className="w-16 px-2 py-1 bg-white border border-[#C8C6C4] rounded font-mono font-bold text-center"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-slate-700 font-bold">1,000 TSh:</span>
                    <input
                      type="number"
                      value={denominations.n1000}
                      onChange={(e) => setDenominations({ ...denominations, n1000: Math.max(0, parseInt(e.target.value) || 0) })}
                      className="w-16 px-2 py-1 bg-white border border-[#C8C6C4] rounded font-mono font-bold text-center"
                    />
                  </div>
                </div>
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase font-bold text-emerald-800">Physical Count Sum</div>
                  <div className="font-bold text-lg font-mono text-emerald-950">{formatTSh(calculatedCashTotal)}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase font-bold text-[#605E5C]">Variance</div>
                  <div className={`font-bold font-mono ${calculatedCashTotal - cashDrawerTally === 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {calculatedCashTotal - cashDrawerTally === 0 ? '✓ TSh 0 (Balanced)' : `${formatTSh(calculatedCashTotal - cashDrawerTally)}`}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-[#EDEBE9]">
              <button
                onClick={() => setIsCashDrawerModalOpen(false)}
                className="px-4 py-2 border border-[#C8C6C4] rounded-lg text-xs font-semibold hover:bg-[#F3F2F1] cursor-pointer"
              >
                {isSw ? 'Ghairi' : 'Cancel'}
              </button>
              <button
                onClick={() => {
                  setIsCashDrawerModalOpen(false);
                  showToast(isSw ? 'Zamu imefungwa na ripoti ya Z-Report imetumwa kwa meneja!' : 'Shift closed & Z-Report sent to manager!');
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                {isSw ? 'Thibitisha & Funga Zamu' : 'Confirm & Close Shift'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: Clinical Prescription Verification Modal */}
      {/* ========================================================================= */}
      {isPrescriptionModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-[#E1DFDD] shadow-2xl max-w-lg w-full p-6 space-y-4 text-xs font-sans">
            <div className="flex items-center justify-between border-b border-[#EDEBE9] pb-3">
              <h3 className="font-bold text-sm text-[#323130] flex items-center gap-2">
                <span>🩺</span>
                <span>{isSw ? 'Uhifadhi & Ukaguzi wa Cheti cha Dawa (TMDA Rx)' : 'Clinical Prescription Verification'}</span>
              </h3>
              <button onClick={() => setIsPrescriptionModalOpen(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-[#323130] mb-1">Patient Name</label>
                <input type="text" placeholder={isSw ? 'Jina la mgonjwa' : 'Patient name'} className="w-full px-3 py-2 bg-[#F8F8F8] border border-[#C8C6C4] rounded-lg text-xs" />
              </div>
              <div>
                <label className="block font-semibold text-[#323130] mb-1">Prescribing Doctor & Hospital</label>
                <input type="text" placeholder={isSw ? 'Daktari na hospitali' : 'Doctor and hospital'} className="w-full px-3 py-2 bg-[#F8F8F8] border border-[#C8C6C4] rounded-lg text-xs" />
              </div>
              <div className="col-span-2">
                <label className="block font-semibold text-[#323130] mb-1">Prescribed Medicines & Dosage Instructions</label>
                <textarea rows={3} defaultValue="Amoxicillin 250mg TDS x 5 days, Cetirizine 10mg OD x 7 days" className="w-full px-3 py-2 bg-[#F8F8F8] border border-[#C8C6C4] rounded-lg text-xs" />
              </div>
            </div>

            <div className="p-3 bg-teal-50 rounded-xl border border-teal-200 text-teal-950">
              <div className="font-bold flex items-center gap-1.5 text-teal-900">
                <ShieldCheck className="w-4 h-4 text-teal-600" />
                <span>TMDA Verification Check:</span>
              </div>
              <p className="text-[11px] text-teal-800 mt-0.5">
                Batch BT-2026-02A verified in date. No conflicting contraindications detected.
              </p>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-[#EDEBE9]">
              <button onClick={() => setIsPrescriptionModalOpen(false)} className="px-4 py-2 border rounded-lg text-xs font-semibold">Cancel</button>
              <button
                onClick={() => {
                  setIsPrescriptionModalOpen(false);
                  showToast(isSw ? 'Cheti kimehakikiwa na kupelekwa kwenye POS ya Keshia!' : 'Prescription approved & sent to cashier POS!');
                }}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                {isSw ? 'Thibitisha na Toa Dawa' : 'Authorize Dispensing'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: Controlled Substances (DDA) Log Modal */}
      {/* ========================================================================= */}
      {isControlledDrugModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-[#E1DFDD] shadow-2xl max-w-md w-full p-6 space-y-4 text-xs font-sans">
            <div className="flex items-center justify-between border-b border-[#EDEBE9] pb-3">
              <h3 className="font-bold text-sm text-[#323130] flex items-center gap-2">
                <span>🔒</span>
                <span>Controlled Substances (DDA) Register</span>
              </h3>
              <button onClick={() => setIsControlledDrugModalOpen(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block font-semibold text-[#323130] mb-1">Controlled Medicine</label>
                <select className="w-full px-3 py-2 bg-[#F8F8F8] border border-[#C8C6C4] rounded-lg text-xs font-semibold">
                  <option>Morphine 10mg/ml Injection (DDA-01)</option>
                  <option>Diazepam 5mg Tablets (DDA-04)</option>
                  <option>Tramadol 50mg Capsules (DDA-08)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#323130] mb-1">Quantity Dispensed</label>
                  <input type="number" defaultValue="10" className="w-full px-3 py-2 bg-[#F8F8F8] border border-[#C8C6C4] rounded-lg text-xs" />
                </div>
                <div>
                  <label className="block font-semibold text-[#323130] mb-1">Doctor TMDA ID</label>
                  <input type="text" defaultValue="TMDA-DOC-8819" className="w-full px-3 py-2 bg-[#F8F8F8] border border-[#C8C6C4] rounded-lg text-xs" />
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-[#EDEBE9]">
              <button onClick={() => setIsControlledDrugModalOpen(false)} className="px-4 py-2 border rounded-lg text-xs font-semibold">Cancel</button>
              <button
                onClick={() => {
                  setIsControlledDrugModalOpen(false);
                  showToast(isSw ? 'Dawa ya DDA imerekodiwa kwenye daftari rasmi la TMDA!' : 'Controlled substance logged in official TMDA ledger!');
                }}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Save DDA Log
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: Goods Inward PO Receiving Bay Modal */}
      {/* ========================================================================= */}
      {isReceivePOModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-[#E1DFDD] shadow-2xl max-w-lg w-full p-6 space-y-4 text-xs font-sans">
            <div className="flex items-center justify-between border-b border-[#EDEBE9] pb-3">
              <h3 className="font-bold text-sm text-[#323130] flex items-center gap-2">
                <span>🚚</span>
                <span>{isSw ? 'Kupokea Mzigo Kutoka kwa Msambazaji' : 'Receive Supplier Goods Inward'}</span>
              </h3>
              <button onClick={() => setIsReceivePOModalOpen(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block font-semibold text-[#323130] mb-1">Select Purchase Order (PO)</label>
                <select className="w-full px-3 py-2 bg-[#F8F8F8] border border-[#C8C6C4] rounded-lg text-xs font-semibold">
                  {purchaseOrders.map(po => (
                    <option key={po.id} value={po.id}>
                      {po.poNumber} - {po.supplierName} ({formatTSh(po.totalAmount)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#323130] mb-1">Batch Number on Delivery Box</label>
                  <input type="text" defaultValue="BT-2026-AUG9" className="w-full px-3 py-2 bg-[#F8F8F8] border border-[#C8C6C4] rounded-lg text-xs" />
                </div>
                <div>
                  <label className="block font-semibold text-[#323130] mb-1">Expiry Date Verified</label>
                  <input type="date" defaultValue="2028-12-31" className="w-full px-3 py-2 bg-[#F8F8F8] border border-[#C8C6C4] rounded-lg text-xs" />
                </div>
              </div>

              <label className="flex items-center gap-2 p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 cursor-pointer">
                <input type="checkbox" defaultChecked className="rounded text-emerald-600" />
                <span className="font-medium text-emerald-950">Package seal intact, zero physical box damage verified.</span>
              </label>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-[#EDEBE9]">
              <button onClick={() => setIsReceivePOModalOpen(false)} className="px-4 py-2 border rounded-lg text-xs font-semibold">Cancel</button>
              <button
                onClick={() => {
                  setIsReceivePOModalOpen(false);
                  showToast(isSw ? 'Mzigo umepokelewa na kuongezwa kwenye stoo!' : 'PO received and stock levels updated!');
                }}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                {isSw ? 'Hifadhi Mzigo Stoo' : 'Complete Receiving'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: Physical Stock Take & Cycle Count Modal */}
      {/* ========================================================================= */}
      {isStockTakeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-[#E1DFDD] shadow-2xl max-w-lg w-full p-6 space-y-4 text-xs font-sans">
            <div className="flex items-center justify-between border-b border-[#EDEBE9] pb-3">
              <h3 className="font-bold text-sm text-[#323130] flex items-center gap-2">
                <span>📦</span>
                <span>{isSw ? 'Hesabu ya Bidhaa Stoo (Physical Stock Take)' : 'Physical Inventory Cycle Count'}</span>
              </h3>
              <button onClick={() => setIsStockTakeModalOpen(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block font-semibold text-[#323130] mb-1">Select Product to Audit</label>
                <select className="w-full px-3 py-2 bg-[#F8F8F8] border border-[#C8C6C4] rounded-lg text-xs font-semibold">
                  {products.slice(0, 8).map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} (System Count: {p.stock} {p.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#323130] mb-1">Physical Shelf Count</label>
                  <input type="number" defaultValue="140" className="w-full px-3 py-2 bg-[#F8F8F8] border border-[#C8C6C4] rounded-lg text-xs font-mono font-bold" />
                </div>
                <div>
                  <label className="block font-semibold text-[#323130] mb-1">Discrepancy Reason</label>
                  <select className="w-full px-3 py-2 bg-[#F8F8F8] border border-[#C8C6C4] rounded-lg text-xs">
                    <option>Zero discrepancy (Exact Match)</option>
                    <option>Minor shelf shrinkage / break</option>
                    <option>Unrecorded warranty return</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-[#EDEBE9]">
              <button onClick={() => setIsStockTakeModalOpen(false)} className="px-4 py-2 border rounded-lg text-xs font-semibold">Cancel</button>
              <button
                onClick={() => {
                  setIsStockTakeModalOpen(false);
                  showToast(isSw ? 'Hesabu ya stoo imesasishwa kwenye kumbukumbu ya ukaguzi!' : 'Stock take discrepancy logged in audit ledger!');
                }}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Save Stock Audit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: Inter-Branch Transfer Modal */}
      {/* ========================================================================= */}
      {isInterBranchTransferModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-[#E1DFDD] shadow-2xl max-w-md w-full p-6 space-y-4 text-xs font-sans">
            <div className="flex items-center justify-between border-b border-[#EDEBE9] pb-3">
              <h3 className="font-bold text-sm text-[#323130] flex items-center gap-2">
                <span>🔄</span>
                <span>Inter-Branch Stock Transfer</span>
              </h3>
              <button onClick={() => setIsInterBranchTransferModalOpen(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#323130] mb-1">Source Branch</label>
                  <input type="text" readOnly value={branches[0]?.name || branchName} className="w-full px-3 py-2 bg-slate-100 border border-[#C8C6C4] rounded-lg text-xs text-slate-700 font-bold" />
                </div>
                <div>
                  <label className="block font-semibold text-[#323130] mb-1">Destination Branch</label>
                  <select className="w-full px-3 py-2 bg-[#F8F8F8] border border-[#C8C6C4] rounded-lg text-xs font-semibold" disabled={branches.length < 2}>
                    {branches.length < 2 ? (
                      <option>{isSw ? 'Ongeza tawi lingine kwanza' : 'Add another branch first'}</option>
                    ) : (
                      branches.slice(1).map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#323130] mb-1">Product & Quantity</label>
                <div className="flex gap-2">
                  <select className="flex-1 px-3 py-2 bg-[#F8F8F8] border border-[#C8C6C4] rounded-lg text-xs">
                    {products.slice(0, 5).map(p => (
                      <option key={p.id}>{p.name} (Stock: {p.stock})</option>
                    ))}
                  </select>
                  <input type="number" defaultValue="20" className="w-20 px-3 py-2 bg-[#F8F8F8] border border-[#C8C6C4] rounded-lg text-xs font-bold text-center" />
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-[#EDEBE9]">
              <button onClick={() => setIsInterBranchTransferModalOpen(false)} className="px-4 py-2 border rounded-lg text-xs font-semibold">Cancel</button>
              <button
                onClick={() => {
                  setIsInterBranchTransferModalOpen(false);
                  showToast(isSw ? 'Mzigo umeanza kusafirishwa na waybill imetolewa!' : 'Inter-branch transfer waybill dispatched!');
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Dispatch Transfer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 7: TRA EFD & Bank Reconciliation Modal */}
      {/* ========================================================================= */}
      {isTraReconcileModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-[#E1DFDD] shadow-2xl max-w-lg w-full p-6 space-y-4 text-xs font-sans">
            <div className="flex items-center justify-between border-b border-[#EDEBE9] pb-3">
              <h3 className="font-bold text-sm text-[#323130] flex items-center gap-2">
                <span>📑</span>
                <span>TRA EFD Fiscal Signatures & Bank Reconciliation</span>
              </h3>
              <button onClick={() => setIsTraReconcileModalOpen(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <div className="space-y-3">
              <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-200 text-indigo-950 space-y-1">
                <div className="font-bold text-xs">TRA EFD Server Node: Online & Synchronized</div>
                <div className="text-[11px] text-indigo-800">Total Signed Transactions: 148 | Output VAT 18%: TSh 8,730,000</div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between font-semibold p-2 bg-[#F8F8F8] rounded">
                  <span>M-Pesa Merchant Settlement:</span>
                  <span className="font-mono font-bold text-emerald-700">TSh 18,450,000 (Matched)</span>
                </div>
                <div className="flex justify-between font-semibold p-2 bg-[#F8F8F8] rounded">
                  <span>CRDB Bank POS Terminal:</span>
                  <span className="font-mono font-bold text-emerald-700">TSh 14,200,000 (Matched)</span>
                </div>
                <div className="flex justify-between font-semibold p-2 bg-[#F8F8F8] rounded">
                  <span>Cash Drawer Collections:</span>
                  <span className="font-mono font-bold text-emerald-700">TSh 15,850,000 (Matched)</span>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-[#EDEBE9]">
              <button onClick={() => setIsTraReconcileModalOpen(false)} className="px-4 py-2 border rounded-lg text-xs font-semibold">Close</button>
              <button
                onClick={() => {
                  setIsTraReconcileModalOpen(false);
                  showToast(isSw ? 'Ripoti ya kodi ya TRA VAT imehakikiwa na kupakuliwa!' : 'TRA VAT Ledger verified & exported!');
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Export TRA Monthly Return
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 8: Supplier Payment Modal */}
      {/* ========================================================================= */}
      {isSupplierPaymentModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-[#E1DFDD] shadow-2xl max-w-md w-full p-6 space-y-4 text-xs font-sans">
            <div className="flex items-center justify-between border-b border-[#EDEBE9] pb-3">
              <h3 className="font-bold text-sm text-[#323130] flex items-center gap-2">
                <span>🚚</span>
                <span>Pay Supplier via CRDB Bank</span>
              </h3>
              <button onClick={() => setIsSupplierPaymentModalOpen(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block font-semibold text-[#323130] mb-1">Supplier</label>
                <select className="w-full px-3 py-2 bg-[#F8F8F8] border border-[#C8C6C4] rounded-lg text-xs font-bold">
                  {suppliers.map(s => (
                    <option key={s.id}>{s.name} (Debt: {formatTSh(s.outstandingPayable)})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#323130] mb-1">Payment Amount (TSh)</label>
                <input type="number" defaultValue="1500000" className="w-full px-3 py-2 bg-[#F8F8F8] border border-[#C8C6C4] rounded-lg text-sm font-mono font-bold text-emerald-700" />
              </div>

              <div>
                <label className="block font-semibold text-[#323130] mb-1">Bank Reference Number</label>
                <input type="text" defaultValue="TXN-CRDB-2026-991" className="w-full px-3 py-2 bg-[#F8F8F8] border border-[#C8C6C4] rounded-lg text-xs font-mono" />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-[#EDEBE9]">
              <button onClick={() => setIsSupplierPaymentModalOpen(false)} className="px-4 py-2 border rounded-lg text-xs font-semibold">Cancel</button>
              <button
                onClick={() => {
                  setIsSupplierPaymentModalOpen(false);
                  showToast(isSw ? 'Malipo ya msambazaji yamethibitishwa na salio limesasishwa!' : 'Supplier payment recorded and ledger updated!');
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Confirm Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 9: Receipt Details & Reprint */}
      {/* ========================================================================= */}
      {isReceiptModalOpen && selectedReceipt && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-[#E1DFDD] shadow-2xl max-w-md w-full p-6 space-y-4 text-xs font-sans">
            <div className="flex items-center justify-between border-b border-[#EDEBE9] pb-3">
              <h3 className="font-bold text-sm text-[#323130] flex items-center gap-2">
                <span>🧾</span>
                <span>TRA Fiscal Receipt: {selectedReceipt.receiptNumber}</span>
              </h3>
              <button onClick={() => setIsReceiptModalOpen(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <div className="space-y-3 bg-[#F8F9FC] p-4 rounded-xl border border-[#EDEBE9] font-mono text-[11px]">
              <div className="text-center pb-2 border-b border-dashed border-slate-300">
                <div className="font-bold text-sm text-[#323130]">AFYA BORA PHARMACY</div>
                <div className="text-[10px] text-slate-500">TIN: 108-992-451 | VRN: 40-001928-Z</div>
                <div className="text-[10px] text-slate-500">{selectedReceipt.date} • {branchName}</div>
              </div>

              <div className="space-y-1 py-1">
                {selectedReceipt.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>{item.productName} x{item.quantity}</span>
                    <span>{formatTSh(item.total)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-dashed border-slate-300 pt-2 space-y-1">
                <div className="flex justify-between font-bold text-sm text-[#323130]">
                  <span>TOTAL:</span>
                  <span>{formatTSh(selectedReceipt.total)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>TRA EFD SIG:</span>
                  <span className="text-[9px] truncate max-w-[140px]">{selectedReceipt.traEfdSignature || 'EFD-TZ-2026-990814-OK'}</span>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-[#EDEBE9]">
              <button onClick={() => setIsReceiptModalOpen(false)} className="px-4 py-2 border rounded-lg text-xs font-semibold">Close</button>
              <button
                onClick={() => {
                  if (!selectedReceipt) return;
                  const tpl = getActive('invoice');
                  printDocument(
                    tpl,
                    saleReceiptRenderData(selectedReceipt, isSw),
                    config.branding,
                    isSw,
                  );
                  setIsReceiptModalOpen(false);
                }}
                className="px-4 py-2 bg-[#0078D4] hover:bg-[#006cbd] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{isSw ? 'Chapisha Risiti' : 'Reprint Receipt'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 10: Staff Roster Scheduler Modal */}
      {/* ========================================================================= */}
      {isRosterModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-[#E1DFDD] shadow-2xl max-w-lg w-full p-6 space-y-4 text-xs font-sans">
            <div className="flex items-center justify-between border-b border-[#EDEBE9] pb-3">
              <h3 className="font-bold text-sm text-[#323130] flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-600" />
                <span>{isSw ? 'Ratiba ya Zamu ya Wafanyakazi' : 'Weekly Staff Shift Roster'}</span>
              </h3>
              <button onClick={() => setIsRosterModalOpen(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <div className="space-y-2 divide-y divide-[#EDEBE9] max-h-72 overflow-y-auto">
              {staffList.map(s => (
                <div key={s.id} className="pt-2.5 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-[#323130]">{s.name} ({s.role})</div>
                    <div className="text-[11px] text-[#605E5C]">{s.branch}</div>
                  </div>
                  <select defaultValue={s.shift} className="px-2.5 py-1 bg-[#F8F8F8] border border-[#C8C6C4] rounded-lg text-xs font-semibold">
                    <option>Morning (07:30 - 15:30)</option>
                    <option>Evening (15:00 - 23:00)</option>
                    <option>Full Day (08:00 - 18:00)</option>
                  </select>
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-[#EDEBE9]">
              <button onClick={() => setIsRosterModalOpen(false)} className="px-4 py-2 border rounded-lg text-xs font-semibold">Cancel</button>
              <button
                onClick={() => {
                  setIsRosterModalOpen(false);
                  showToast(isSw ? 'Ratiba ya zamu imehifadhiwa na SMS imetumwa kwa wafanyakazi!' : 'Shift schedule saved and roster broadcast via SMS!');
                }}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Save & Broadcast Roster
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
