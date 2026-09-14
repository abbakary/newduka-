import React, { useState, useMemo, useEffect } from 'react';
import { 
  DollarSign, 
  Receipt, 
  Users, 
  Plus, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Wallet, 
  ArrowDownRight, 
  ArrowUpRight, 
  Search, 
  Filter, 
  FileText, 
  QrCode, 
  Building2, 
  Check, 
  X, 
  TrendingUp, 
  ChevronRight, 
  Download, 
  Printer, 
  Send,
  Coffee,
  Bus,
  ShieldAlert,
  Sparkles,
  Layers,
  Edit2
} from 'lucide-react';
import { 
  ExpenseCategory, 
  ExpenseItem, 
  Language, 
  SalaryAdvanceRequest, 
  SalaryPayrollRecord, 
  StaffDailyAllowance, 
  StaffMember 
} from '@/types/v1';
import { formatTSh, getTranslation } from '@/utils/translations';
import { api } from '@/lib/api';
import { mapExpense, expenseToApiPayload } from '@/lib/apiSync';
import { canManageExpenses, canManagePayroll, canConfigureAllowances, canApproveAdvances, canViewPayrollHub, canManageStaffRBAC } from '@/lib/rbac';
import { StaffTeamPanel } from '@/components/v1/StaffTeamPanel';
import {
  loadPayrollStore,
  savePayrollStore,
  todayDateStr,
  currentMonthStr,
  monthAllowancesTotal,
  syncAllowancesFromStipendExpenses,
  type StaffPayrollConfig,
} from '@/lib/payrollStore';
import type { AuthUser } from '@/types/v1';
import { useDocumentTemplates } from '@/context/DocumentTemplateContext';
import { printDocument } from '@/lib/documentRenderer';
import { payslipToRenderData } from '@/lib/documentDataMappers';

interface ExpensesPayrollViewProps {
  language: Language;
  staffList: StaffMember[];
  expenses?: ExpenseItem[];
  setExpenses?: React.Dispatch<React.SetStateAction<ExpenseItem[]>>;
  onUpdateStaffMember?: (staff: StaffMember) => void;
  setStaffList?: React.Dispatch<React.SetStateAction<StaffMember[]>>;
  currentUser?: AuthUser | null;
  onOpenAIChatWithPrompt?: (prompt: string) => void;
  initialTab?: 'expenses' | 'allowances' | 'payroll' | 'advances' | 'team';
  tenantStorageId?: string;
}

export const ExpensesPayrollView: React.FC<ExpensesPayrollViewProps> = ({
  language,
  staffList,
  expenses: expensesProp = [],
  setExpenses: setExpensesProp,
  onUpdateStaffMember,
  setStaffList,
  currentUser,
  initialTab = 'expenses',
  tenantStorageId,
}) => {
  const isSw = language === 'sw';
  const t = (key: any) => getTranslation(language, key);
  const { config, getActive } = useDocumentTemplates();
  const canManage = canManageExpenses(currentUser);
  const canPayroll = canManagePayroll(currentUser);
  const canConfigAllowances = canConfigureAllowances(currentUser);
  const canAdvances = canApproveAdvances(currentUser);
  const canTeam = canManageStaffRBAC(currentUser);
  const canView = canViewPayrollHub(currentUser);
  const isOwnerAdmin = canPayroll || canTeam;
  const tenantId = tenantStorageId || currentUser?.businessId || currentUser?.id || 'local';
  const todayStr = todayDateStr();

  // Active Sub-Tab
  const [activeTab, setActiveTab] = useState<'expenses' | 'allowances' | 'payroll' | 'advances' | 'team'>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  if (!canView) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-[#E1DFDD]">
        <ShieldAlert className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <p className="font-bold text-[#323130]">
          {isSw ? 'Huna ruhusa ya kuona Matumizi & Mishahara.' : 'You do not have permission to view Expenses & Payroll.'}
        </p>
      </div>
    );
  }

  // State for expenses
  const [expenses, setExpensesLocal] = useState<ExpenseItem[]>(expensesProp);
  const setExpenses = setExpensesProp ?? setExpensesLocal;
  const [dailyAllowances, setDailyAllowances] = useState<StaffDailyAllowance[]>([]);
  const [advances, setAdvances] = useState<SalaryAdvanceRequest[]>([]);
  const [payrollRecords, setPayrollRecords] = useState<SalaryPayrollRecord[]>([]);
  const [staffConfig, setStaffConfig] = useState<Record<string, StaffPayrollConfig>>({});

  useEffect(() => {
    const stored = loadPayrollStore(tenantId);
    const synced = syncAllowancesFromStipendExpenses(stored, expensesProp, staffList);
    setDailyAllowances(synced.dailyAllowances);
    setAdvances(synced.advances);
    setPayrollRecords(synced.payrollRecords);
    setStaffConfig(synced.staffConfig);
    if (synced.dailyAllowances.length !== stored.dailyAllowances.length) {
      savePayrollStore(tenantId, synced);
    }
  }, [tenantId, expensesProp, staffList]);

  useEffect(() => {
    if (activeTab !== 'allowances' && activeTab !== 'advances') return;
    const stored = loadPayrollStore(tenantId);
    const synced = syncAllowancesFromStipendExpenses(stored, expensesProp, staffList);
    setDailyAllowances(synced.dailyAllowances);
    setAdvances(synced.advances);
    setPayrollRecords(synced.payrollRecords);
    setStaffConfig(synced.staffConfig);
  }, [activeTab, tenantId, expensesProp, staffList]);

  useEffect(() => {
    savePayrollStore(tenantId, {
      dailyAllowances,
      advances,
      payrollRecords,
      staffConfig,
    });
  }, [tenantId, dailyAllowances, advances, payrollRecords, staffConfig]);

  useEffect(() => {
    setExpensesLocal(expensesProp);
  }, [expensesProp]);

  // Filters & Searches
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr());

  // Modals
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isConfigAllowancesOpen, setIsConfigAllowancesOpen] = useState(false);
  const [isPaySalaryModalOpen, setIsPaySalaryModalOpen] = useState(false);
  const [isRecordAdvanceOpen, setIsRecordAdvanceOpen] = useState(false);
  const [selectedStaffForPay, setSelectedStaffForPay] = useState<StaffMember | null>(null);
  const [selectedPayslip, setSelectedPayslip] = useState<SalaryPayrollRecord | null>(null);
  const [advanceStaffId, setAdvanceStaffId] = useState('');
  const [advanceAmount, setAdvanceAmount] = useState<number | ''>('');
  const [advanceReason, setAdvanceReason] = useState('');
  const [editingBaseSalaryStaffId, setEditingBaseSalaryStaffId] = useState<string | null>(null);
  const [editBaseSalaryAmount, setEditBaseSalaryAmount] = useState<number>(450000);

  // New Expense Form State
  const [newExpenseTitle, setNewExpenseTitle] = useState('');
  const [newExpenseCategory, setNewExpenseCategory] = useState<ExpenseCategory>('utilities_luku');
  const [newExpenseAmount, setNewExpenseAmount] = useState<number | ''>('');
  const [newExpenseMethod, setNewExpenseMethod] = useState<'cash_drawer' | 'mpesa_till' | 'bank_transfer' | 'other'>('cash_drawer');
  const [newExpenseRecipient, setNewExpenseRecipient] = useState('');
  const [newExpenseRef, setNewExpenseRef] = useState('');
  const [newExpenseNotes, setNewExpenseNotes] = useState('');

  // Rate Editing State
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [editFoodAmount, setEditFoodAmount] = useState<number>(5000);
  const [editTransportAmount, setEditTransportAmount] = useState<number>(3000);

  // Category Dictionary
  const categoryLabels: Record<ExpenseCategory, { en: string; sw: string; color: string }> = {
    rent: { en: 'Premises Rent', sw: 'Kodi ya Pango', color: 'bg-rose-100 text-rose-800 border-rose-200' },
    supplier_settlements: { en: 'Supplier Settlements', sw: 'Malipo ya Wasambazaji', color: 'bg-purple-100 text-purple-800 border-purple-200' },
    staff_salaries: { en: 'Staff Base Salaries', sw: 'Mishahara ya Wafanyakazi', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
    daily_stipends_food_transport: { en: 'Daily Food & Transport Stipends', sw: 'Posho za Chakula & Nauli', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    licenses_permits_brela_tmda: { en: 'Govt Licenses (TMDA/BRELA)', sw: 'Leseni & Vibali (TMDA/BRELA)', color: 'bg-blue-100 text-blue-800 border-blue-200' },
    taxes_tra_local: { en: 'Taxes & TRA Levies', sw: 'Kodi za TRA & Halmashauri', color: 'bg-red-100 text-red-800 border-red-200' },
    equipment_assets: { en: 'Equipment & Hardware', sw: 'Vifaa & Mashine', color: 'bg-teal-100 text-teal-800 border-teal-200' },
    cleaning_sanitation: { en: 'Cleaning & Hygiene', sw: 'Usafi & Mazingira', color: 'bg-emerald-50 text-emerald-900 border-emerald-300' },
    utilities_luku: { en: 'Electricity (LUKU)', sw: 'Umeme wa LUKU', color: 'bg-amber-100 text-amber-800 border-amber-200' },
    maintenance_repairs: { en: 'Repairs & Maintenance', sw: 'Matengenezo & Ukarabati', color: 'bg-orange-100 text-orange-800 border-orange-200' },
    marketing_sms: { en: 'Marketing & Bulk SMS', sw: 'Matangazo & SMS za Wateja', color: 'bg-sky-100 text-sky-800 border-sky-200' },
    petty_cash: { en: 'Petty Cash & Shop Supplies', sw: 'Matumizi Madogo & Karatasi', color: 'bg-slate-100 text-slate-800 border-slate-200' },
    water: { en: 'Water Bill (DAWASA)', sw: 'Bili ya Maji (DAWASA)', color: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
    other: { en: 'Other Operational Cost', sw: 'Matumizi Mengine', color: 'bg-gray-100 text-gray-800 border-gray-200' }
  };

  // Filtered Expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      if (categoryFilter !== 'all' && e.category !== categoryFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          e.title.toLowerCase().includes(q) ||
          e.recipient.toLowerCase().includes(q) ||
          (e.referenceNumber && e.referenceNumber.toLowerCase().includes(q)) ||
          e.category.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [expenses, categoryFilter, searchQuery]);

  // Aggregate OPEX KPIs
  const totalExpensesAmount = useMemo(() => {
    return expenses.reduce((acc, e) => acc + e.amount, 0);
  }, [expenses]);

  const totalAllowancesClaimedToday = useMemo(() => {
    return dailyAllowances
      .filter(a => a.date === todayStr && a.status === 'claimed')
      .reduce((acc, a) => acc + a.totalAmount, 0);
  }, [dailyAllowances, todayStr]);

  const claimedTodayCount = useMemo(() => {
    return dailyAllowances.filter(a => a.date === todayStr && a.status === 'claimed').length;
  }, [dailyAllowances, todayStr]);

  const unclaimedStipendCount = useMemo(() => {
    const activeStaff = staffList.filter(s => s.active);
    const claimedIds = new Set(
      dailyAllowances.filter(a => a.date === todayStr && a.status === 'claimed').map(a => a.staffId),
    );
    return activeStaff.filter(s => !claimedIds.has(s.id)).length;
  }, [dailyAllowances, todayStr, staffList]);

  const pendingAdvancesCount = useMemo(() => {
    return advances.filter(a => a.status === 'pending').length;
  }, [advances]);

  const monthOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString(isSw ? 'sw-TZ' : 'en-GB', { month: 'long', year: 'numeric' });
      opts.push({ value, label });
    }
    return opts;
  }, [isSw]);

  // Handle Add Expense
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) {
      alert(isSw ? 'Huna ruhusa ya kurekodi matumizi.' : 'You do not have permission to record expenses.');
      return;
    }
    if (!newExpenseTitle || !newExpenseAmount || Number(newExpenseAmount) <= 0) return;

    try {
      const raw = await api.createExpense(expenseToApiPayload({
        title: newExpenseTitle,
        category: newExpenseCategory,
        amount: Number(newExpenseAmount),
        paymentMethod: newExpenseMethod,
        recipient: newExpenseRecipient || 'General Vendor',
        notes: newExpenseNotes,
      }));
      const created = mapExpense(raw as Record<string, unknown>);
      setExpenses(prev => [created, ...prev]);
      setIsAddExpenseOpen(false);
      setNewExpenseTitle('');
      setNewExpenseAmount('');
      setNewExpenseRecipient('');
      setNewExpenseRef('');
      setNewExpenseNotes('');
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!canManage) return;
    if (!window.confirm(isSw ? 'Una uhakika unataka kufuta matumizi haya?' : 'Delete this expense record?')) return;
    try {
      await api.deleteExpense(expenseId);
      setExpenses(prev => prev.filter(e => e.id !== expenseId));
    } catch (err) {
      alert((err as Error).message);
    }
  };

  // Handle Approve Advance
  const handleApproveAdvance = (advId: string) => {
    if (!canAdvances) {
      alert(isSw ? 'Huna ruhusa ya kuidhinisha advance.' : 'You cannot approve salary advances.');
      return;
    }
    setAdvances(prev => prev.map(a => {
      if (a.id === advId) {
        return {
          ...a,
          status: 'approved',
          approvedBy: 'Boss / Owner (Verified)',
          approvedDate: new Date().toISOString().replace('T', ' ').substring(0, 16),
          disbursedMethod: 'M-Pesa Direct',
          disbursedDate: new Date().toISOString().replace('T', ' ').substring(0, 16),
          referenceNumber: `MP-ADV-${Math.floor(100000 + Math.random() * 900000)}`
        };
      }
      return a;
    }));
  };

  // Handle Reject Advance
  const handleRejectAdvance = (advId: string) => {
    if (!canAdvances) return;
    setAdvances(prev => prev.map(a => {
      if (a.id === advId) {
        return {
          ...a,
          status: 'rejected',
          approvedBy: 'Boss / Owner (Declined)',
          approvedDate: new Date().toISOString().replace('T', ' ').substring(0, 16)
        };
      }
      return a;
    }));
  };

  const handleConfirmAllStipends = async () => {
    if (!canConfigAllowances) return;
    const unclaimed = staffList.filter(s => {
      if (!s.active) return false;
      return !dailyAllowances.some(a => a.staffId === s.id && a.date === todayStr && a.status === 'claimed');
    });
    for (const staff of unclaimed) {
      await handleMarkAllowanceClaimed(staff);
    }
  };

  const handleRecordAdvance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAdvances) return;
    const staff = staffList.find(s => s.id === advanceStaffId);
    if (!staff || !advanceAmount || Number(advanceAmount) <= 0) return;
    const request: SalaryAdvanceRequest = {
      id: `adv-${staff.id}-${Date.now()}`,
      dateRequested: todayStr,
      staffId: staff.id,
      staffName: staff.name,
      staffRole: staff.role,
      requestedAmount: Number(advanceAmount),
      reason: advanceReason.trim() || (isSw ? 'Advance ya dharura' : 'Emergency advance'),
      status: 'pending',
    };
    setAdvances(prev => [request, ...prev]);
    setIsRecordAdvanceOpen(false);
    setAdvanceStaffId('');
    setAdvanceAmount('');
    setAdvanceReason('');
  };

  const handleSaveBaseSalary = (staffId: string) => {
    if (!canPayroll) return;
    setStaffConfig(prev => ({
      ...prev,
      [staffId]: {
        ...prev[staffId],
        baseSalary: editBaseSalaryAmount,
      },
    }));
    const staff = staffList.find(s => s.id === staffId);
    if (staff && onUpdateStaffMember) {
      onUpdateStaffMember({ ...staff, baseSalary: editBaseSalaryAmount });
    }
    setEditingBaseSalaryStaffId(null);
  };

  const openRecordAdvanceModal = () => {
    if (!canAdvances) return;
    setAdvanceStaffId(staffList[0]?.id ?? '');
    setAdvanceAmount('');
    setAdvanceReason('');
    setIsRecordAdvanceOpen(true);
  };

  const getStaffRates = (staff: StaffMember) => {
    const cfg = staffConfig[staff.id] ?? {};
    return {
      baseSalary: cfg.baseSalary ?? staff.baseSalary ?? 450000,
      food: cfg.dailyFoodAllowance ?? staff.dailyFoodAllowance ?? 5000,
      transport: cfg.dailyTransportAllowance ?? staff.dailyTransportAllowance ?? 3000,
    };
  };

  const handleSaveStaffRates = (staffId: string) => {
    if (!canConfigAllowances) {
      alert(isSw ? 'Huna ruhusa ya kubadili viwango vya posho.' : 'You cannot configure allowance rates.');
      return;
    }
    setStaffConfig(prev => ({
      ...prev,
      [staffId]: {
        ...prev[staffId],
        dailyFoodAllowance: editFoodAmount,
        dailyTransportAllowance: editTransportAmount,
      },
    }));
    if (onUpdateStaffMember) {
      const staff = staffList.find(s => s.id === staffId);
      if (staff) {
        onUpdateStaffMember({
          ...staff,
          dailyFoodAllowance: editFoodAmount,
          dailyTransportAllowance: editTransportAmount,
        });
      }
    }
    setEditingStaffId(null);
  };

  const handleMarkAllowanceClaimed = async (staff: StaffMember) => {
    if (!canConfigAllowances) return;
    const rates = getStaffRates(staff);
    const total = rates.food + rates.transport;
    const now = new Date();
    const timestamp = now.toISOString().replace('T', ' ').substring(0, 16);
    const record: StaffDailyAllowance = {
      id: `allow-${staff.id}-${todayStr}`,
      date: todayStr,
      staffId: staff.id,
      staffName: staff.name,
      staffRole: staff.role,
      foodAmount: rates.food,
      transportAmount: rates.transport,
      totalAmount: total,
      status: 'claimed',
      claimedAt: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      claimedTimestamp: timestamp,
      acknowledgedSignature: `${staff.name} (Verified)`,
      paymentSource: 'cash_drawer',
    };
    setDailyAllowances(prev => [record, ...prev.filter(a => !(a.staffId === staff.id && a.date === todayStr))]);
    if (canManage) {
      try {
        const raw = await api.createExpense(expenseToApiPayload({
          title: `Posho ya leo — ${staff.name}`,
          category: 'daily_stipends_food_transport',
          amount: total,
          paymentMethod: 'cash_drawer',
          recipient: staff.name,
          notes: `Chakula ${rates.food} + Nauli ${rates.transport}`,
        }));
        const created = mapExpense(raw as Record<string, unknown>);
        setExpenses(prev => [created, ...prev]);
      } catch (err) {
        alert((err as Error).message);
      }
    }
  };

  // Process Salary Payment
  const handleProcessSalaryPayment = async (staff: StaffMember, method: string, ref: string, bonus: number) => {
    if (!canPayroll) {
      alert(isSw ? 'Huna ruhusa ya kulipa mishahara.' : 'You cannot process payroll payments.');
      return;
    }
    const rates = getStaffRates(staff);
    const base = rates.baseSalary;
    const allowances = monthAllowancesTotal(staff.id, selectedMonth, dailyAllowances);
    const advancesDeducted = advances
      .filter(a => a.staffId === staff.id && a.status === 'approved')
      .reduce((acc, a) => acc + a.requestedAmount, 0);
    const nssf = Math.round(base * 0.1);
    const net = base + bonus - advancesDeducted - nssf;

    const newRecord: SalaryPayrollRecord = {
      id: `pay-${Date.now()}`,
      monthYear: selectedMonth,
      staffId: staff.id,
      staffName: staff.name,
      staffRole: staff.role,
      baseSalary: base,
      totalDailyAllowancesPaid: allowances,
      advancesDeducted: advancesDeducted,
      statutoryDeductions: nssf,
      performanceBonus: bonus,
      netPayable: net,
      status: 'paid',
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: method,
      paymentReference: ref || `SAL-TXN-${Math.floor(100000 + Math.random() * 900000)}`,
      payslipNumber: `PAYSLIP-${selectedMonth}-${Math.floor(100 + Math.random() * 900)}`,
      notes: `Mshahara wa ${selectedMonth} umelipwa kikamilifu.`
    };

    setPayrollRecords([newRecord, ...payrollRecords]);
    setIsPaySalaryModalOpen(false);
    setSelectedStaffForPay(null);

    if (canManage) {
      try {
        const raw = await api.createExpense(expenseToApiPayload({
          title: `Mshahara ${selectedMonth} — ${staff.name}`,
          category: 'staff_salaries',
          amount: net,
          paymentMethod: method.includes('M-Pesa') ? 'mpesa_till' : 'bank_transfer',
          recipient: staff.name,
          notes: newRecord.notes,
        }));
        const created = mapExpense(raw as Record<string, unknown>);
        setExpenses(prev => [created, ...prev]);
      } catch (err) {
        alert((err as Error).message);
      }
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#1B1E3B] via-[#2A305E] to-[#3B427F] rounded-2xl p-6 text-white shadow-lg border border-white/10">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-rose-400/20 text-rose-300 border border-rose-400/30">
                <Receipt className="w-6 h-6" />
              </span>
              <h2 className="text-2xl font-black tracking-tight text-white">
                {isSw ? 'Usimamizi wa Matumizi, Posho & Mishahara' : 'Expenses, Daily Allowances & Payroll Hub'}
              </h2>
            </div>
            <p className="text-sm text-slate-300 mt-1.5 max-w-2xl">
              {isSw 
                ? 'Dhibiti matumizi yote ya duka (Kodi, LUKU, DAWASA, Stoo), fuatilia posho za kila siku za wafanyakazi (Chakula na Nauli), na fanya malipo ya mishahara ya mwezi.'
                : 'Full-stack financial tracking for operating overheads, daily staff stipends (food/transit), salary advances, and monthly statutory payroll.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {activeTab === 'expenses' && canManage ? (
              <button
                onClick={() => setIsAddExpenseOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white text-xs font-black shadow-md cursor-pointer transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>{isSw ? '+ Rekodi Matumizi Mapya' : '+ Log New Expense'}</span>
              </button>
            ) : activeTab === 'allowances' && canConfigAllowances ? (
              <button
                onClick={() => void handleConfirmAllStipends()}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white text-xs font-black shadow-md cursor-pointer transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSw ? 'Thibitisha Posho Zote' : 'Confirm All Stipends'}</span>
              </button>
            ) : activeTab === 'advances' && canAdvances ? (
              <button
                onClick={openRecordAdvanceModal}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-xs font-black shadow-md cursor-pointer transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>{isSw ? '+ Rekodi Advance' : '+ Record Advance'}</span>
              </button>
            ) : activeTab === 'team' && canTeam ? (
              <span className="text-xs text-slate-300 font-medium px-3 py-2 rounded-lg bg-white/10 border border-white/20">
                {isSw ? 'Ongeza, hariri na simamia ruhusa za wafanyakazi hapa chini' : 'Add, edit and manage staff permissions below'}
              </span>
            ) : !canManage && activeTab === 'expenses' ? (
              <span className="text-xs text-slate-300 font-medium px-3 py-2 rounded-lg bg-white/10 border border-white/20">
                {isSw ? 'Unaweza kuona tu — hakuna ruhusa ya kurekodi' : 'View only — no permission to add expenses'}
              </span>
            ) : isOwnerAdmin ? (
              <span className="text-xs text-slate-300 font-medium px-3 py-2 rounded-lg bg-white/10 border border-white/20">
                {isSw ? 'Mmiliki/Meneja — ruhusa kamili ya kusimamia' : 'Owner/Manager — full management access'}
              </span>
            ) : null}
          </div>
        </div>

        {/* Quick KPI Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">Jumla ya Matumizi (OPEX)</span>
            <span className="text-lg font-black text-rose-300 block mt-0.5">{formatTSh(totalExpensesAmount)}</span>
            <span className="text-[10px] text-slate-300 font-medium mt-0.5 block">{expenses.length} Rekodi za Mwezi Huu</span>
          </div>

          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">Posho za Leo (Zilizochukuliwa)</span>
            <span className="text-lg font-black text-emerald-300 block mt-0.5">{formatTSh(totalAllowancesClaimedToday)}</span>
            <span className="text-[10px] text-emerald-400 font-bold mt-0.5 block">
              {claimedTodayCount}/{staffList.length} {isSw ? 'Wamesaini Leo' : 'Signed Today'}
            </span>
          </div>

          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">Maombi ya Advance</span>
            <span className="text-lg font-black text-amber-300 block mt-0.5">{pendingAdvancesCount} Yanasubiri</span>
            <span className="text-[10px] text-amber-400 font-bold mt-0.5 block">Zingatia Kwenye Mshahara</span>
          </div>

          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">Jumla ya Wafanyakazi</span>
            <span className="text-lg font-black text-sky-300 block mt-0.5">{staffList.length} Active Staff</span>
            <span className="text-[10px] text-sky-300 font-medium mt-0.5 block">Kariakoo & Mlimani Branches</span>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-[#F3F2F1] rounded-xl border border-[#E1DFDD] overflow-x-auto">
        {([
          { id: 'expenses' as const, icon: Receipt, label: isSw ? 'Matumizi' : 'Expenses', badge: expenses.length },
          { id: 'allowances' as const, icon: Coffee, label: isSw ? 'Posho' : 'Stipends', badge: unclaimedStipendCount > 0 ? unclaimedStipendCount : undefined, pulse: unclaimedStipendCount > 0 },
          { id: 'payroll' as const, icon: Wallet, label: isSw ? 'Mishahara' : 'Payroll' },
          { id: 'advances' as const, icon: DollarSign, label: isSw ? 'Advance' : 'Advances', badge: pendingAdvancesCount > 0 ? pendingAdvancesCount : undefined, pulse: pendingAdvancesCount > 0 },
          ...(canTeam ? [{ id: 'team' as const, icon: Users, label: isSw ? 'Timu' : 'Team', badge: staffList.length }] : []),
        ]).map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                active
                  ? 'bg-white text-[#323130] shadow-sm ring-1 ring-[#E1DFDD]'
                  : 'text-[#605E5C] hover:bg-white/70 hover:text-[#323130]'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${active ? 'text-[#6264A7]' : ''}`} />
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge !== 0 && (
                <span className={`ml-0.5 min-w-[1.125rem] px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                  tab.pulse ? 'bg-amber-500 text-white' : 'bg-[#6264A7]/10 text-[#6264A7]'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {isOwnerAdmin && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#6264A7]/8 border border-[#6264A7]/20 text-[#323130]">
          <ShieldAlert className="w-4 h-4 text-[#6264A7] shrink-0" />
          <p className="text-xs font-semibold">
            {isSw
              ? 'Mmiliki/Meneja — una ruhusa kamili ya kurekodi matumizi, kuidhinisha posho, kulipa mishahara, kuidhinisha advance na kusimamia timu.'
              : 'Owner/Manager — you have full access to record expenses, confirm stipends, pay payroll, approve advances and manage team.'}
          </p>
        </div>
      )}

      {/* Per-tab admin quick actions */}
      <div className="flex flex-wrap items-center gap-2">
        {activeTab === 'expenses' && canManage && (
          <button
            type="button"
            onClick={() => setIsAddExpenseOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            {isSw ? 'Rekodi Matumizi' : 'Log Expense'}
          </button>
        )}
        {activeTab === 'allowances' && canConfigAllowances && (
          <>
            <button
              type="button"
              onClick={() => void handleConfirmAllStipends()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {isSw ? 'Thibitisha Zote Leo' : 'Confirm All Today'}
            </button>
          </>
        )}
        {activeTab === 'payroll' && canPayroll && (
          <span className="text-[11px] font-semibold text-[#605E5C]">
            {isSw ? 'Badili mshahara msingi kwa kila mfanyakazi kwenye jedwali, kisha bonyeza Lipa Sasa.' : 'Edit base salary per staff in the table, then click Pay Now.'}
          </span>
        )}
        {activeTab === 'advances' && canAdvances && (
          <button
            type="button"
            onClick={openRecordAdvanceModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            {isSw ? 'Rekodi Advance Mpya' : 'Record New Advance'}
          </button>
        )}
      </div>

      {/* TAB 1: OPERATING EXPENSES LEDGER */}
      {activeTab === 'expenses' && (
        <div className="bg-white rounded-2xl border border-[#E1DFDD] shadow-xs p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 text-[#8A8886] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder={isSw ? 'Tafuta matumizi, mlipwaji, namba...' : 'Search expense, recipient, ref #...'}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9 pr-3 py-1.5 text-xs bg-[#F8F9FA] border border-[#E1DFDD] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0078D4] w-64"
                />
              </div>

              {/* Category Filter */}
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="text-xs bg-[#F8F9FA] border border-[#E1DFDD] rounded-xl px-3 py-1.5 font-bold text-[#323130] focus:outline-none"
              >
                <option value="all">{isSw ? 'Aina Zote za Matumizi' : 'All Categories'}</option>
                <option value="rent">{isSw ? 'Kodi ya Pango (Rent)' : 'Premises Rent'}</option>
                <option value="utilities_luku">{isSw ? 'Umeme wa LUKU' : 'Electricity (LUKU)'}</option>
                <option value="water">{isSw ? 'Bili ya Maji (DAWASA)' : 'Water (DAWASA)'}</option>
                <option value="daily_stipends_food_transport">{isSw ? 'Posho za Chakula & Nauli' : 'Food & Transport Stipends'}</option>
                <option value="licenses_permits_brela_tmda">{isSw ? 'Leseni za TMDA / BRELA' : 'TMDA / BRELA Licenses'}</option>
                <option value="supplier_settlements">{isSw ? 'Malipo ya Wasambazaji' : 'Supplier Settlements'}</option>
                <option value="maintenance_repairs">{isSw ? 'Matengenezo & Ukarabati' : 'Maintenance & Repairs'}</option>
                <option value="marketing_sms">{isSw ? 'Matangazo & SMS' : 'Marketing & SMS'}</option>
                <option value="petty_cash">{isSw ? 'Matumizi Madogo (Petty Cash)' : 'Petty Cash Supplies'}</option>
              </select>
            </div>

            <span className="text-xs font-bold text-[#605E5C]">
              {filteredExpenses.length} {isSw ? 'matumizi yamepatikana' : 'records found'}
            </span>
          </div>

          {/* Expenses Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#F8F8F8] text-[#605E5C] font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-3">Tarehe & Saa</th>
                  <th className="py-3 px-3">Aina ya Matumizi</th>
                  <th className="py-3 px-3">Maelezo ya Malipo</th>
                  <th className="py-3 px-3">Mlipwaji (Recipient)</th>
                  <th className="py-3 px-3 text-right">Kiasi (TSh)</th>
                  <th className="py-3 px-3">Njia & Kumbukumbu</th>
                  <th className="py-3 px-3 text-center">Hali</th>
                  {canManage && <th className="py-3 px-3 text-center">{isSw ? 'Kitendo' : 'Action'}</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F2F1]">
                {filteredExpenses.map(item => {
                  const cat = categoryLabels[item.category] || { en: item.category, sw: item.category, color: 'bg-gray-100 text-gray-800' };
                  return (
                    <tr key={item.id} className="hover:bg-[#FAF9F8] transition-colors">
                      <td className="py-3 px-3 font-mono text-[#605E5C]">
                        <div>{item.date}</div>
                        <div className="text-[10px]">{item.time}</div>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold border ${cat.color}`}>
                          {isSw ? cat.sw : cat.en}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-[#323130]">{item.title}</div>
                        {item.notes && <div className="text-[10px] text-[#605E5C] mt-0.5">{item.notes}</div>}
                      </td>
                      <td className="py-3 px-3 font-medium text-[#323130]">
                        {item.recipient}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-black text-rose-600 text-sm">
                        -{formatTSh(item.amount)}
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-[#605E5C]">
                        <div className="capitalize">{item.paymentMethod.replace('_', ' ')}</div>
                        <div className="text-[10px] font-bold text-slate-700">{item.referenceNumber}</div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.status === 'reconciled'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {item.status === 'reconciled' ? '✓ Reconciled' : 'Paid'}
                        </span>
                      </td>
                      {canManage && (
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteExpense(item.id)}
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                            title={isSw ? 'Futa' : 'Delete'}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: DAILY STAFF ALLOWANCES & STIPENDS */}
      {activeTab === 'allowances' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-[#E1DFDD] shadow-xs p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#F3F2F1] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Coffee className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-extrabold text-base text-[#323130]">
                    {isSw ? 'Ufuatiliaji wa Posho za Kila Siku (Chakula na Nauli)' : 'Daily Staff Allowance Disbursal & Digital Verification'}
                  </h3>
                </div>
                <p className="text-xs text-[#605E5C] mt-0.5">
                  {isSw 
                    ? 'Wafanyakazi wanasaini na kukiri posho moja kwa moja kwenye akaunti zao wanapoingia kazini. Mmiliki anaona uthibitisho wa saini ya kidijitali na muda mara moja.'
                    : 'Staff authenticate and claim daily subsistence directly at their workstations upon clocking in. Zero petty cash leakages.'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold font-mono">
                  {isSw ? 'Tarehe ya Leo' : 'Today'}: {todayStr}
                </span>
              </div>
            </div>

            {/* Live Today's Disbursal Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#F8F8F8] text-[#605E5C] font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-3">Mfanyakazi & Wadhifa</th>
                    <th className="py-3 px-3 text-right">Chakula (Food)</th>
                    <th className="py-3 px-3 text-right">Nauli (Transport)</th>
                    <th className="py-3 px-3 text-right font-black text-[#323130]">Jumla ya Siku</th>
                    <th className="py-3 px-3 text-center">Hali ya Madai</th>
                    <th className="py-3 px-3">Saini ya Kidijitali & Muda</th>
                    <th className="py-3 px-3 text-center">Vitendo vya Mmiliki</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F2F1]">
                  {staffList.map(staff => {
                    const rates = getStaffRates(staff);
                    const todayRecord = dailyAllowances.find(a => a.staffId === staff.id && a.date === todayStr);
                    const food = rates.food;
                    const transport = rates.transport;
                    const total = food + transport;
                    const isClaimed = todayRecord?.status === 'claimed';

                    return (
                      <tr key={staff.id} className="hover:bg-[#FAF9F8] transition-colors">
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-8 h-8 rounded-full ${staff.avatarColor || 'bg-indigo-600'} text-white flex items-center justify-center text-xs font-bold`}>
                              {staff.name.charAt(0)}
                            </div>
                            <div>
                              <div className="font-bold text-[#323130]">{staff.name}</div>
                              <div className="text-[10px] text-[#605E5C]">{staff.role} • {staff.branch}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-[#605E5C]">{formatTSh(food)}</td>
                        <td className="py-3 px-3 text-right font-mono text-[#605E5C]">{formatTSh(transport)}</td>
                        <td className="py-3 px-3 text-right font-mono font-black text-emerald-700 text-sm">
                          {formatTSh(total)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            isClaimed 
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                              : 'bg-amber-100 text-amber-800 border border-amber-300 animate-pulse'
                          }`}>
                            {isClaimed ? '✓ AMECHUKUA' : '⏳ HAIJACHUKULIWA'}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px]">
                          {isClaimed ? (
                            <div className="text-emerald-900">
                              <div className="font-bold">{todayRecord?.acknowledgedSignature}</div>
                              <div className="text-[10px] text-[#605E5C]">{todayRecord?.claimedTimestamp}</div>
                            </div>
                          ) : (
                            <span className="text-[#8A8886] italic">{isSw ? 'Inasubiri saini ya mfanyakazi' : 'Awaiting staff check-in'}</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {canConfigAllowances ? (
                            <div className="flex items-center justify-center gap-1">
                              {!isClaimed && (
                                <button
                                  onClick={() => handleMarkAllowanceClaimed(staff)}
                                  className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer text-[10px] font-bold"
                                >
                                  {isSw ? 'Thibitisha' : 'Confirm'}
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setEditingStaffId(staff.id);
                                  setEditFoodAmount(food);
                                  setEditTransportAmount(transport);
                                }}
                                className="p-1.5 rounded-lg bg-[#F3F2F1] hover:bg-[#EDEBE9] text-[#323130] cursor-pointer transition-all text-xs font-bold inline-flex items-center gap-1"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                                <span>{isSw ? 'Viwango' : 'Rates'}</span>
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-[#605E5C]">{isSw ? 'Angalia tu' : 'View only'}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Edit Rates Modal */}
          {editingStaffId && (
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between border-b border-[#F3F2F1] pb-3">
                  <h3 className="font-bold text-base text-[#323130]">
                    {isSw ? 'Weka Viwango vya Posho vya Kila Siku' : 'Configure Daily Allowance Rates'}
                  </h3>
                  <button onClick={() => setEditingStaffId(null)} className="p-1 rounded-lg hover:bg-slate-100 cursor-pointer">
                    <X className="w-5 h-5 text-slate-500" />
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="font-bold text-[#323130] block mb-1">
                      {isSw ? 'Posho ya Chakula kwa Siku (TSh)' : 'Daily Food Allowance (TSh)'}
                    </label>
                    <input
                      type="number"
                      value={editFoodAmount}
                      onChange={e => setEditFoodAmount(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-[#E1DFDD] rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#0078D4]"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-[#323130] block mb-1">
                      {isSw ? 'Posho ya Nauli kwa Siku (TSh)' : 'Daily Transport Allowance (TSh)'}
                    </label>
                    <input
                      type="number"
                      value={editTransportAmount}
                      onChange={e => setEditTransportAmount(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-[#E1DFDD] rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#0078D4]"
                    />
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[#605E5C]">
                    {isSw ? 'Jumla ya Posho kwa Siku' : 'Total Daily Subsistence'}: <strong className="text-emerald-700 font-mono text-sm">{formatTSh(editFoodAmount + editTransportAmount)}</strong>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-[#F3F2F1]">
                  <button
                    onClick={() => setEditingStaffId(null)}
                    className="px-4 py-2 rounded-xl border border-[#E1DFDD] text-xs font-bold text-[#323130] hover:bg-[#F3F2F1] cursor-pointer"
                  >
                    {isSw ? 'Ghairi' : 'Cancel'}
                  </button>
                  <button
                    onClick={() => handleSaveStaffRates(editingStaffId)}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                  >
                    {isSw ? 'Hifadhi Viwango' : 'Save Rates'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: MONTHLY PAYROLL MATRIX & PAYSLIPS */}
      {activeTab === 'payroll' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-[#E1DFDD] shadow-xs p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#F3F2F1] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-extrabold text-base text-[#323130]">
                    {isSw ? 'Jedwali la Mishahara ya Mwezi (Staff Payroll Matrix)' : 'Staff Monthly Payroll & Net Wage Matrix'}
                  </h3>
                </div>
                <p className="text-xs text-[#605E5C] mt-0.5">
                  {isSw 
                    ? 'Hesabu kamili: Mshahara Msingi + Posho + Bonus - Advance za Mwezi - Makato ya NSSF (10%) = Kiasi Halisi cha Kulipwa.'
                    : 'Automated statutory payroll calculating base salary, performance incentives, advance reconciliations, and NSSF deductions.'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#605E5C]">{isSw ? 'Mwezi' : 'Month'}:</span>
                <select
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  className="text-xs font-bold px-3 py-1.5 rounded-xl border border-[#E1DFDD] bg-[#F8F9FA] text-[#323130]"
                >
                  {monthOptions.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Payroll Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#F8F8F8] text-[#605E5C] font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-3">Mfanyakazi</th>
                    <th className="py-3 px-3 text-right">Mshahara Msingi</th>
                    <th className="py-3 px-3 text-right">Posho Zilizolipwa</th>
                    <th className="py-3 px-3 text-right text-rose-600">Makato ya Advance</th>
                    <th className="py-3 px-3 text-right text-rose-600">NSSF (10%)</th>
                    <th className="py-3 px-3 text-right text-emerald-600">Bonus</th>
                    <th className="py-3 px-3 text-right font-black text-indigo-900">Kiasi Halisi (Net Pay)</th>
                    <th className="py-3 px-3 text-center">Hali ya Malipo</th>
                    <th className="py-3 px-3 text-center">Vitendo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F2F1]">
                  {staffList.map(staff => {
                    const paidRecord = payrollRecords.find(p => p.staffId === staff.id && p.monthYear === selectedMonth);
                    const rates = getStaffRates(staff);
                    const base = rates.baseSalary;
                    const allowances = monthAllowancesTotal(staff.id, selectedMonth, dailyAllowances);
                    const advancesTotal = advances
                      .filter(a => a.staffId === staff.id && a.status === 'approved')
                      .reduce((acc, a) => acc + a.requestedAmount, 0);
                    const nssf = Math.round(base * 0.1);
                    const bonus = 25000;
                    const net = base + bonus - advancesTotal - nssf;

                    const isPaid = !!paidRecord;

                    return (
                      <tr key={staff.id} className="hover:bg-[#FAF9F8] transition-colors">
                        <td className="py-3 px-3">
                          <div className="font-bold text-[#323130]">{staff.name}</div>
                          <div className="text-[10px] text-[#605E5C]">{staff.role} • NSSF: {staff.nssfNumber || 'N/A'}</div>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-[#323130]">
                          {canPayroll ? (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingBaseSalaryStaffId(staff.id);
                                setEditBaseSalaryAmount(base);
                              }}
                              className="inline-flex items-center gap-1 hover:text-indigo-700 cursor-pointer"
                              title={isSw ? 'Badili mshahara msingi' : 'Edit base salary'}
                            >
                              {formatTSh(base)}
                              <Edit2 className="w-3 h-3" />
                            </button>
                          ) : (
                            formatTSh(base)
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-emerald-700">{formatTSh(allowances)}</td>
                        <td className="py-3 px-3 text-right font-mono text-rose-600 font-bold">
                          {advancesTotal > 0 ? `-${formatTSh(advancesTotal)}` : '0'}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-rose-600">-{formatTSh(nssf)}</td>
                        <td className="py-3 px-3 text-right font-mono text-emerald-600 font-bold">+{formatTSh(bonus)}</td>
                        <td className="py-3 px-3 text-right font-mono font-black text-indigo-900 text-sm">
                          {formatTSh(paidRecord ? paidRecord.netPayable : net)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isPaid
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {isPaid ? '✓ IMELIPWA' : '⏳ TAYARI KULIPWA'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center space-x-1">
                          {isPaid ? (
                            <button
                              onClick={() => setSelectedPayslip(paidRecord)}
                              className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] cursor-pointer inline-flex items-center gap-1"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>Slipi (Payslip)</span>
                            </button>
                          ) : canPayroll ? (
                            <button
                              onClick={() => {
                                setSelectedStaffForPay(staff);
                                setIsPaySalaryModalOpen(true);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] cursor-pointer inline-flex items-center gap-1"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>Lipa Sasa</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-[#605E5C]">{isSw ? 'Angalia tu' : 'View only'}</span>
                          )}
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

      {/* TAB 4: SALARY ADVANCE REQUESTS */}
      {activeTab === 'advances' && (
        <div className="bg-white rounded-2xl border border-[#E1DFDD] shadow-xs p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#F3F2F1] pb-4">
            <div>
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-amber-600" />
                <h3 className="font-extrabold text-base text-[#323130]">
                  {isSw ? 'Maombi ya Advance za Mishahara (Emergency Salary Advances)' : 'Salary Advance Requests & Approvals'}
                </h3>
              </div>
              <p className="text-xs text-[#605E5C] mt-0.5">
                {isSw 
                  ? 'Wafanyakazi wanaweza kuomba advance ya mshahara kupitia akaunti zao. Mmiliki akiafikia, kiasi kinakatwa moja kwa moja mwisho wa mwezi.'
                  : 'Emergency advance claims logged by employees for boss review. Automatically deducted from monthly payroll upon approval.'}
              </p>
            </div>

            <span className="text-xs font-bold px-3 py-1 bg-amber-50 text-amber-800 rounded-full border border-amber-200">
              {advances.length} {isSw ? 'Maombi Yapo' : 'Total Requests'}
            </span>
            {canAdvances && (
              <button
                type="button"
                onClick={openRecordAdvanceModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                {isSw ? 'Rekodi Advance' : 'Record Advance'}
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#F8F8F8] text-[#605E5C] font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-3">Tarehe</th>
                  <th className="py-3 px-3">Mfanyakazi</th>
                  <th className="py-3 px-3 text-right">Kiasi Kilichoombwa</th>
                  <th className="py-3 px-3">Sababu ya Dharura</th>
                  <th className="py-3 px-3 text-center">Hali</th>
                  <th className="py-3 px-3">Uthibitisho / Njia</th>
                  <th className="py-3 px-3 text-center">Uamuzi wa Mmiliki</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F2F1]">
                {advances.map(adv => (
                  <tr key={adv.id} className="hover:bg-[#FAF9F8] transition-colors">
                    <td className="py-3 px-3 font-mono text-[#605E5C]">{adv.dateRequested}</td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-[#323130]">{adv.staffName}</div>
                      <div className="text-[10px] text-[#605E5C]">{adv.staffRole}</div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-black text-rose-600 text-sm">
                      {formatTSh(adv.requestedAmount)}
                    </td>
                    <td className="py-3 px-3 text-[#323130] max-w-xs">{adv.reason}</td>
                    <td className="py-3 px-3 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        adv.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                        adv.status === 'pending' ? 'bg-amber-100 text-amber-800 animate-pulse' :
                        'bg-rose-100 text-rose-800'
                      }`}>
                        {adv.status === 'approved' ? '✓ IMEIDHINISHWA' :
                         adv.status === 'pending' ? '⏳ INASUBIRI KUKAGULIWA' : '❌ IMEKATALIWA'}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-[#605E5C]">
                      {adv.status === 'approved' ? (
                        <div>
                          <div className="text-emerald-900 font-bold">{adv.disbursedMethod}</div>
                          <div className="text-[10px]">{adv.referenceNumber}</div>
                        </div>
                      ) : (
                        <span>-</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {adv.status === 'pending' && canAdvances ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleApproveAdvance(adv.id)}
                            className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer text-xs font-bold inline-flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Idhinisha</span>
                          </button>
                          <button
                            onClick={() => handleRejectAdvance(adv.id)}
                            className="p-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white cursor-pointer text-xs font-bold inline-flex items-center gap-1"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Kataa</span>
                          </button>
                        </div>
                      ) : adv.status === 'pending' ? (
                        <span className="text-[11px] text-[#605E5C] font-medium">{isSw ? 'Inasubiri mmiliki' : 'Awaiting owner approval'}</span>
                      ) : (
                        <span className="text-[11px] text-[#605E5C] font-medium">{isSw ? 'Tayari imekamilika' : 'Completed'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'team' && canTeam && setStaffList && (
        <div className="bg-white rounded-2xl border border-[#E1DFDD] shadow-xs p-5">
          <StaffTeamPanel
            language={language}
            staffList={staffList}
            setStaffList={setStaffList}
            currentUser={currentUser}
          />
        </div>
      )}

      {/* MODAL 1: ADD NEW EXPENSE */}
      {isAddExpenseOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#F3F2F1] pb-3">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-rose-600" />
                <h3 className="font-bold text-base text-[#323130]">
                  {isSw ? 'Rekodi Matumizi Mapya ya Duka (New Expense)' : 'Record New Operational Expense'}
                </h3>
              </div>
              <button onClick={() => setIsAddExpenseOpen(false)} className="p-1 rounded-lg hover:bg-slate-100 cursor-pointer">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-[#323130] block mb-1">
                  {isSw ? 'Kichwa cha Matumizi (Title)' : 'Expense Title'} *
                </label>
                <input
                  type="text"
                  required
                  placeholder={isSw ? 'mf. Malipo ya TANESCO LUKU ya Mwezi' : 'e.g. Monthly Electricity Token'}
                  value={newExpenseTitle}
                  onChange={e => setNewExpenseTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E1DFDD] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0078D4]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-[#323130] block mb-1">
                    {isSw ? 'Aina ya Matumizi' : 'Category'} *
                  </label>
                  <select
                    value={newExpenseCategory}
                    onChange={e => setNewExpenseCategory(e.target.value as ExpenseCategory)}
                    className="w-full px-3 py-2 border border-[#E1DFDD] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0078D4]"
                  >
                    <option value="rent">{isSw ? 'Kodi ya Pango (Rent)' : 'Premises Rent'}</option>
                    <option value="utilities_luku">{isSw ? 'Umeme wa LUKU (TANESCO)' : 'Electricity (LUKU)'}</option>
                    <option value="water">{isSw ? 'Bili ya Maji (DAWASA)' : 'Water (DAWASA)'}</option>
                    <option value="daily_stipends_food_transport">{isSw ? 'Posho za Chakula & Nauli' : 'Food & Transport Stipends'}</option>
                    <option value="licenses_permits_brela_tmda">{isSw ? 'Leseni & Vibali (TMDA/BRELA)' : 'Permits (TMDA/BRELA)'}</option>
                    <option value="supplier_settlements">{isSw ? 'Malipo ya Wasambazaji' : 'Supplier Settlements'}</option>
                    <option value="maintenance_repairs">{isSw ? 'Matengenezo & Ukarabati' : 'Maintenance & Repairs'}</option>
                    <option value="marketing_sms">{isSw ? 'Matangazo & Bulk SMS' : 'Marketing & SMS'}</option>
                    <option value="petty_cash">{isSw ? 'Matumizi Madogo (Petty Cash)' : 'Petty Cash Supplies'}</option>
                    <option value="other">{isSw ? 'Matumizi Mengine' : 'Other'}</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-[#323130] block mb-1">
                    {isSw ? 'Kiasi cha Fedha (TSh)' : 'Amount (TSh)'} *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="50,000"
                    value={newExpenseAmount}
                    onChange={e => setNewExpenseAmount(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 border border-[#E1DFDD] rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#0078D4]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-[#323130] block mb-1">
                    {isSw ? 'Njia ya Malipo' : 'Payment Method'}
                  </label>
                  <select
                    value={newExpenseMethod}
                    onChange={e => setNewExpenseMethod(e.target.value as any)}
                    className="w-full px-3 py-2 border border-[#E1DFDD] rounded-xl focus:outline-none"
                  >
                    <option value="cash_drawer">{isSw ? 'Kutoka Droo ya Fedha (Cash Drawer)' : 'Cash Drawer'}</option>
                    <option value="mpesa_till">{isSw ? 'M-Pesa Till / Lipa Namba' : 'M-Pesa Till'}</option>
                    <option value="bank_transfer">{isSw ? 'Benki (CRDB / NMB Transfer)' : 'Bank Transfer'}</option>
                    <option value="other">{isSw ? 'Njia Nyingine' : 'Other'}</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-[#323130] block mb-1">
                    {isSw ? 'Mlipwaji (Recipient / Vendor)' : 'Recipient / Vendor'}
                  </label>
                  <input
                    type="text"
                    placeholder={isSw ? 'mf. TANESCO Ilala' : 'e.g. TANESCO'}
                    value={newExpenseRecipient}
                    onChange={e => setNewExpenseRecipient(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E1DFDD] rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-[#323130] block mb-1">
                  {isSw ? 'Namba ya Kumbukumbu / Risiti (Ref #)' : 'Reference / Receipt Number'}
                </label>
                <input
                  type="text"
                  placeholder={isSw ? 'mf. LUKU-882194 au REC-098' : 'e.g. TXN-99214'}
                  value={newExpenseRef}
                  onChange={e => setNewExpenseRef(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E1DFDD] rounded-xl font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-[#323130] block mb-1">
                  {isSw ? 'Maelezo ya Ziada (Notes)' : 'Additional Notes'}
                </label>
                <textarea
                  rows={2}
                  placeholder={isSw ? 'Maelezo mengine muhimu...' : 'Extra notes...'}
                  value={newExpenseNotes}
                  onChange={e => setNewExpenseNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E1DFDD] rounded-xl focus:outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#F3F2F1]">
                <button
                  type="button"
                  onClick={() => setIsAddExpenseOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#E1DFDD] text-xs font-bold text-[#323130] hover:bg-[#F3F2F1] cursor-pointer"
                >
                  {isSw ? 'Ghairi' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
                >
                  {isSw ? 'Hifadhi Matumizi' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: PAY SALARY MODAL */}
      {isPaySalaryModalOpen && selectedStaffForPay && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#F3F2F1] pb-3">
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-base text-[#323130]">
                  {isSw ? `Lipa Mshahara: ${selectedStaffForPay.name}` : `Disburse Salary: ${selectedStaffForPay.name}`}
                </h3>
              </div>
              <button onClick={() => setIsPaySalaryModalOpen(false)} className="p-1 rounded-lg hover:bg-slate-100 cursor-pointer">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-[#F8F9FA] border border-[#E1DFDD] space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-[#605E5C]">Mshahara Msingi:</span>
                  <span className="font-bold font-mono">{formatTSh(selectedStaffForPay.baseSalary || 450000)}</span>
                </div>
                <div className="flex justify-between text-rose-600">
                  <span>Makato ya NSSF (10%):</span>
                  <span className="font-mono">-{formatTSh(Math.round((selectedStaffForPay.baseSalary || 450000) * 0.1))}</span>
                </div>
                <div className="flex justify-between text-emerald-700 font-black text-sm pt-1.5 border-t border-[#E1DFDD]">
                  <span>Kiasi cha Kulipwa (Net Pay):</span>
                  <span className="font-mono">{formatTSh(Math.round((selectedStaffForPay.baseSalary || 450000) * 0.9))}</span>
                </div>
              </div>

              <div>
                <label className="font-bold text-[#323130] block mb-1">
                  {isSw ? 'Njia ya Malipo' : 'Disbursement Channel'}
                </label>
                <select className="w-full px-3 py-2 border border-[#E1DFDD] rounded-xl focus:outline-none">
                  <option value="mpesa">M-Pesa Direct ({selectedStaffForPay.phone})</option>
                  <option value="crdb">CRDB Bank Transfer</option>
                  <option value="nmb">NMB Bank Transfer</option>
                  <option value="cash">Taslimu (Cash)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-[#323130] block mb-1">
                  {isSw ? 'Namba ya Muamala / Reference #' : 'Transaction Reference'}
                </label>
                <input
                  type="text"
                  defaultValue={`SAL-MP-${Math.floor(100000 + Math.random() * 900000)}`}
                  className="w-full px-3 py-2 border border-[#E1DFDD] rounded-xl font-mono focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#F3F2F1]">
              <button
                onClick={() => setIsPaySalaryModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-[#E1DFDD] text-xs font-bold text-[#323130] hover:bg-[#F3F2F1] cursor-pointer"
              >
                {isSw ? 'Ghairi' : 'Cancel'}
              </button>
              <button
                onClick={() => handleProcessSalaryPayment(selectedStaffForPay, 'M-Pesa Direct', '', 0)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
              >
                {isSw ? 'Thibitisha & Toa Slipi' : 'Confirm & Generate Slip'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: OFFICIAL TANZANIAN PAYSLIP VIEW */}
      {selectedPayslip && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#F3F2F1] pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#1E2244]" />
                <h3 className="font-black text-base text-[#1E2244]">
                  {isSw ? 'Slipi Rasmi ya Mshahara (Payslip)' : 'Official Salary Payslip'}
                </h3>
              </div>
              <button onClick={() => setSelectedPayslip(null)} className="p-1 rounded-lg hover:bg-slate-100 cursor-pointer">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* Printable Payslip Container */}
            <div className="p-5 rounded-2xl border border-slate-300 bg-white space-y-4 text-xs font-sans">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <h4 className="font-black text-sm text-[#1E2244] uppercase tracking-wide">Afya Bora Pharmacy Ltd</h4>
                  <p className="text-[10px] text-slate-500">TIN: 142-889-102 • VRN: 40019283-Z</p>
                  <p className="text-[10px] text-slate-500">Kariakoo Market Street, Dar es Salaam</p>
                </div>
                <div className="text-right">
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">PAID</span>
                  <p className="text-[10px] font-mono text-slate-600 mt-1">{selectedPayslip.payslipNumber}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-xl">
                <div><strong>Jina la Mfanyakazi:</strong> {selectedPayslip.staffName}</div>
                <div><strong>Wadhifa:</strong> {selectedPayslip.staffRole}</div>
                <div><strong>Mwezi wa Malipo:</strong> {selectedPayslip.monthYear}</div>
                <div><strong>Tarehe ya Malipo:</strong> {selectedPayslip.paymentDate}</div>
              </div>

              {/* Breakdown */}
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span>Mshahara Msingi (Basic Salary)</span>
                  <span className="font-mono font-bold">{formatTSh(selectedPayslip.baseSalary)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 text-emerald-700">
                  <span>Bonus ya Mauzo (Performance Incentive)</span>
                  <span className="font-mono font-bold">+{formatTSh(selectedPayslip.performanceBonus)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 text-rose-600">
                  <span>Makato ya Advance (Salary Advance Repayment)</span>
                  <span className="font-mono font-bold">-{formatTSh(selectedPayslip.advancesDeducted)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 text-rose-600">
                  <span>Makato ya NSSF 10% (Pension Contribution)</span>
                  <span className="font-mono font-bold">-{formatTSh(selectedPayslip.statutoryDeductions)}</span>
                </div>
                <div className="flex justify-between py-2 border-t-2 border-slate-900 font-black text-sm text-[#1E2244]">
                  <span>Kiasi Kilicholipwa (NET PAYABLE)</span>
                  <span className="font-mono text-emerald-700">{formatTSh(selectedPayslip.netPayable)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-200 text-[10px] text-slate-500">
                <div>Njia: {selectedPayslip.paymentMethod} (Ref: {selectedPayslip.paymentReference})</div>
                <div className="flex items-center gap-1">
                  <QrCode className="w-4 h-4 text-slate-700" />
                  <span className="font-mono">VERIFIED-BY-DUKA+</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  if (!selectedPayslip) return;
                  const tpl = getActive('invoice');
                  const data = payslipToRenderData(selectedPayslip, isSw);
                  printDocument(tpl, data, config.branding, isSw);
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1E2244] text-white text-xs font-bold cursor-pointer hover:bg-[#2A305E]"
              >
                <Printer className="w-4 h-4" />
                <span>{isSw ? 'Chapisha Slipi (Print)' : 'Print Payslip'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: RECORD SALARY ADVANCE */}
      {isRecordAdvanceOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#F3F2F1] pb-3">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-base text-[#323130]">
                  {isSw ? 'Rekodi Advance ya Mshahara' : 'Record Salary Advance'}
                </h3>
              </div>
              <button onClick={() => setIsRecordAdvanceOpen(false)} className="p-1 rounded-lg hover:bg-slate-100 cursor-pointer">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleRecordAdvance} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-[#323130] block mb-1">{isSw ? 'Mfanyakazi' : 'Staff member'} *</label>
                <select
                  required
                  value={advanceStaffId}
                  onChange={e => setAdvanceStaffId(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E1DFDD] rounded-xl focus:outline-none"
                >
                  {staffList.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-bold text-[#323130] block mb-1">{isSw ? 'Kiasi (TSh)' : 'Amount (TSh)'} *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={advanceAmount}
                  onChange={e => setAdvanceAmount(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 border border-[#E1DFDD] rounded-xl font-mono focus:outline-none"
                />
              </div>
              <div>
                <label className="font-bold text-[#323130] block mb-1">{isSw ? 'Sababu' : 'Reason'}</label>
                <textarea
                  rows={2}
                  value={advanceReason}
                  onChange={e => setAdvanceReason(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E1DFDD] rounded-xl focus:outline-none resize-none"
                  placeholder={isSw ? 'Mf. dharura ya matibabu' : 'e.g. medical emergency'}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsRecordAdvanceOpen(false)} className="px-4 py-2 rounded-xl border border-[#E1DFDD] text-xs font-bold cursor-pointer">
                  {isSw ? 'Ghairi' : 'Cancel'}
                </button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer">
                  {isSw ? 'Hifadhi Advance' : 'Save Advance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT BASE SALARY */}
      {editingBaseSalaryStaffId && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#F3F2F1] pb-3">
              <h3 className="font-bold text-base text-[#323130]">
                {isSw ? 'Badili Mshahara Msingi' : 'Edit Base Salary'}
              </h3>
              <button onClick={() => setEditingBaseSalaryStaffId(null)} className="p-1 rounded-lg hover:bg-slate-100 cursor-pointer">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <p className="text-[#605E5C]">
                {staffList.find(s => s.id === editingBaseSalaryStaffId)?.name}
              </p>
              <input
                type="number"
                min="0"
                value={editBaseSalaryAmount}
                onChange={e => setEditBaseSalaryAmount(Number(e.target.value))}
                className="w-full px-3 py-2 border border-[#E1DFDD] rounded-xl font-mono focus:outline-none"
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setEditingBaseSalaryStaffId(null)} className="px-4 py-2 rounded-xl border border-[#E1DFDD] text-xs font-bold cursor-pointer">
                  {isSw ? 'Ghairi' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveBaseSalary(editingBaseSalaryStaffId)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer"
                >
                  {isSw ? 'Hifadhi' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
