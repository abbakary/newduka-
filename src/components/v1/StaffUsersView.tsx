import React, { useEffect, useMemo, useState } from 'react';
import {
  Users,
  UserCog,
  Banknote,
  HandCoins,
  CircleDollarSign,
  Clock,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  LogIn,
  ArrowRight,
} from 'lucide-react';
import { StaffTeamPanel } from '@/components/v1/StaffTeamPanel';
import { computeCashierLeaderboard } from '@/lib/analyticsCompute';
import { getOpenCashierShift } from '@/lib/cashierShiftStore';
import {
  currentMonthStr,
  findTodayAllowanceClaim,
  loadPayrollStore,
  savePayrollStore,
  todayDateStr,
  type StaffPayrollConfig,
} from '@/lib/payrollStore';
import { canManagePayroll, canManageStaffRBAC, canSwitchStaffWorkstation } from '@/lib/rbac';
import { formatTSh } from '@/utils/translations';
import type {
  AuthUser,
  Language,
  SaleTransaction,
  StaffMember,
} from '@/types/v1';

type PeopleTab = 'overview' | 'directory' | 'compensation' | 'attendance';

interface StaffUsersViewProps {
  language: Language;
  staffList: StaffMember[];
  setStaffList: React.Dispatch<React.SetStateAction<StaffMember[]>>;
  currentUser?: AuthUser | null;
  sales?: SaleTransaction[];
  tenantStorageId?: string;
  onNavigate?: (tab: string) => void;
  onSwitchToStaffSite?: (staff: StaffMember) => void;
}

export const StaffUsersView: React.FC<StaffUsersViewProps> = ({
  language,
  staffList,
  setStaffList,
  currentUser,
  sales = [],
  tenantStorageId,
  onNavigate,
  onSwitchToStaffSite,
}) => {
  const isSw = language === 'sw';
  const canTeam = canManageStaffRBAC(currentUser);
  const canPay = canManagePayroll(currentUser);
  const canSwitch = canSwitchStaffWorkstation(currentUser) && Boolean(onSwitchToStaffSite);
  const tenantId = tenantStorageId || currentUser?.businessId || currentUser?.id || 'local';
  const today = todayDateStr();
  const month = currentMonthStr();

  const [tab, setTab] = useState<PeopleTab>('overview');
  const [staffConfig, setStaffConfig] = useState<Record<string, StaffPayrollConfig>>({});
  const [payrollRecords, setPayrollRecords] = useState(() => loadPayrollStore(tenantId).payrollRecords);
  const [advances, setAdvances] = useState(() => loadPayrollStore(tenantId).advances);
  const [allowances, setAllowances] = useState(() => loadPayrollStore(tenantId).dailyAllowances);
  const [editRatesId, setEditRatesId] = useState<string | null>(null);
  const [rateDraft, setRateDraft] = useState({ baseSalary: 0, food: 0, transport: 0 });
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const store = loadPayrollStore(tenantId);
    setStaffConfig(store.staffConfig);
    setPayrollRecords(store.payrollRecords);
    setAdvances(store.advances);
    setAllowances(store.dailyAllowances);
  }, [tenantId, staffList.length]);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
  };

  const cashierBoard = useMemo(() => computeCashierLeaderboard(sales), [sales]);
  const topCashier = cashierBoard[0];

  const staffWithStats = useMemo(() => {
    return staffList.map(s => {
      const row = cashierBoard.find(
        r =>
          r.cashierName.toLowerCase() === s.name.toLowerCase() ||
          r.cashierName.toLowerCase().includes(s.name.toLowerCase()) ||
          s.name.toLowerCase().includes(r.cashierName.toLowerCase()),
      );
      const shift = getOpenCashierShift(tenantId, s.id);
      const posho = findTodayAllowanceClaim(s.id, today, allowances);
      const unpaid = !payrollRecords.some(p => p.staffId === s.id && p.monthYear === month);
      const pendingAdv = advances.filter(a => a.staffId === s.id && a.status === 'pending');
      const cfg = staffConfig[s.id] ?? {};
      return {
        ...s,
        todaySalesCount: row?.receipts ?? s.todaySalesCount ?? 0,
        todayRevenueTzs: row?.revenue ?? s.todayRevenueTzs ?? 0,
        shiftOpen: Boolean(shift),
        shiftOpenedAt: shift?.openedAt,
        poshoClaimed: Boolean(posho),
        poshoAmount: posho?.totalAmount ?? 0,
        payrollUnpaid: unpaid,
        pendingAdvances: pendingAdv.length,
        pendingAdvanceAmount: pendingAdv.reduce((sum, a) => sum + (a.requestedAmount || 0), 0),
        baseSalary: cfg.baseSalary ?? s.baseSalary ?? 450000,
        food: cfg.dailyFoodAllowance ?? s.dailyFoodAllowance ?? 5000,
        transport: cfg.dailyTransportAllowance ?? s.dailyTransportAllowance ?? 3000,
      };
    });
  }, [staffList, cashierBoard, tenantId, today, allowances, payrollRecords, advances, staffConfig, month]);

  const activeCount = staffWithStats.filter(s => s.active).length;
  const onShiftCount = staffWithStats.filter(s => s.shiftOpen).length;
  const unpaidPayrollCount = staffWithStats.filter(s => s.active && s.payrollUnpaid).length;
  const pendingAdvanceCount = advances.filter(a => a.status === 'pending').length;
  const poshoTodayCount = staffWithStats.filter(s => s.poshoClaimed).length;
  const teamRevenueToday = staffWithStats.reduce((sum, s) => sum + s.todayRevenueTzs, 0);

  const persistConfig = (next: Record<string, StaffPayrollConfig>) => {
    setStaffConfig(next);
    const store = loadPayrollStore(tenantId);
    savePayrollStore(tenantId, { ...store, staffConfig: next });
  };

  const openRateEditor = (staff: (typeof staffWithStats)[number]) => {
    setEditRatesId(staff.id);
    setRateDraft({
      baseSalary: staff.baseSalary,
      food: staff.food,
      transport: staff.transport,
    });
  };

  const saveRates = () => {
    if (!editRatesId) return;
    const next = {
      ...staffConfig,
      [editRatesId]: {
        ...staffConfig[editRatesId],
        baseSalary: rateDraft.baseSalary,
        dailyFoodAllowance: rateDraft.food,
        dailyTransportAllowance: rateDraft.transport,
      },
    };
    persistConfig(next);
    setStaffList(prev =>
      prev.map(s =>
        s.id === editRatesId
          ? {
              ...s,
              baseSalary: rateDraft.baseSalary,
              dailyFoodAllowance: rateDraft.food,
              dailyTransportAllowance: rateDraft.transport,
            }
          : s,
      ),
    );
    setEditRatesId(null);
    showToast(isSw ? 'Malipo yamesasishwa.' : 'Compensation updated.');
  };

  if (!canTeam && !canPay) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center space-y-3">
        <Users className="w-10 h-10 text-[#6264A7] mx-auto" />
        <h2 className="text-lg font-bold text-[#323130]">
          {isSw ? 'Hakuna ruhusa' : 'Access restricted'}
        </h2>
        <p className="text-sm text-[#605E5C]">
          {isSw
            ? 'Moduli ya Watu inapatikana kwa mmiliki na wasimamizi pekee.'
            : 'The People module is available to owners and managers only.'}
        </p>
      </div>
    );
  }

  const tabs: Array<{ id: PeopleTab; label: string; icon: typeof Users }> = [
    { id: 'overview', label: isSw ? 'Muhtasari' : 'Overview', icon: TrendingUp },
    { id: 'directory', label: isSw ? 'Orodha' : 'Directory', icon: UserCog },
    { id: 'compensation', label: isSw ? 'Malipo' : 'Compensation', icon: Banknote },
    { id: 'attendance', label: isSw ? 'Mahudhurio' : 'Attendance', icon: Clock },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-5 animate-in fade-in duration-300">
      {toast && (
        <div className="fixed top-16 right-6 z-50 bg-[#107C10] text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4" />
          {toast}
        </div>
      )}

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#6264A7]/10 text-[#6264A7]">
              <Users className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-[#323130] tracking-tight">
                {isSw ? 'Watu & HR' : 'People & HR'}
              </h1>
              <p className="text-sm text-[#605E5C]">
                {isSw
                  ? 'Simamia wafanyakazi, zamu, posho, na mishahara mahali pamoja.'
                  : 'Manage employees, shifts, stipends, and payroll in one place.'}
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {onNavigate && (
            <>
              <button
                type="button"
                onClick={() => onNavigate('payroll')}
                className="px-3 py-2 rounded-xl border border-[#E1DFDD] bg-white text-xs font-bold text-[#323130] hover:bg-[#F3F2F1] flex items-center gap-1.5 cursor-pointer"
              >
                <Banknote className="w-3.5 h-3.5 text-emerald-600" />
                {isSw ? 'Mishahara' : 'Run payroll'}
              </button>
              <button
                type="button"
                onClick={() => onNavigate('allowances')}
                className="px-3 py-2 rounded-xl border border-[#E1DFDD] bg-white text-xs font-bold text-[#323130] hover:bg-[#F3F2F1] flex items-center gap-1.5 cursor-pointer"
              >
                <HandCoins className="w-3.5 h-3.5 text-amber-600" />
                {isSw ? 'Posho' : 'Stipends'}
              </button>
              <button
                type="button"
                onClick={() => onNavigate('advances')}
                className="px-3 py-2 rounded-xl border border-[#E1DFDD] bg-white text-xs font-bold text-[#323130] hover:bg-[#F3F2F1] flex items-center gap-1.5 cursor-pointer"
              >
                <CircleDollarSign className="w-3.5 h-3.5 text-sky-600" />
                {isSw ? 'Mikopo' : 'Advances'}
              </button>
            </>
          )}
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-[#E1DFDD] p-4">
          <p className="text-[11px] font-semibold text-[#605E5C]">{isSw ? 'Hai / Jumla' : 'Active / Total'}</p>
          <p className="text-2xl font-black text-[#323130] mt-1">
            {activeCount}
            <span className="text-sm font-bold text-[#8A8886]"> / {staffList.length}</span>
          </p>
        </div>
        <div className="bg-white rounded-xl border border-[#E1DFDD] p-4">
          <p className="text-[11px] font-semibold text-[#605E5C]">{isSw ? 'Zamu wazi sasa' : 'On open shift'}</p>
          <p className="text-2xl font-black text-violet-700 mt-1">{onShiftCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-[#E1DFDD] p-4">
          <p className="text-[11px] font-semibold text-[#605E5C]">{isSw ? 'Mauzo ya timu leo' : "Team sales today"}</p>
          <p className="text-lg font-black text-emerald-700 mt-1 font-mono">{formatTSh(teamRevenueToday)}</p>
        </div>
        <div className="bg-white rounded-xl border border-[#E1DFDD] p-4">
          <p className="text-[11px] font-semibold text-[#605E5C]">{isSw ? 'Mishahara haijalipwa' : 'Unpaid this month'}</p>
          <p className={`text-2xl font-black mt-1 ${unpaidPayrollCount ? 'text-rose-600' : 'text-emerald-700'}`}>
            {unpaidPayrollCount}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 bg-[#F3F2F1] p-1 rounded-xl w-fit">
        {tabs.map(t => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                active ? 'bg-white text-[#323130] shadow-sm' : 'text-[#605E5C] hover:text-[#323130]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-white rounded-xl border border-[#E1DFDD] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#EDEBE9] flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#323130]">
                  {isSw ? 'Utendaji wa leo (keshia)' : "Today's cashier performance"}
                </h3>
                {topCashier && (
                  <span className="text-[11px] font-bold text-[#0078D4]">
                    🏆 {topCashier.cashierName} · {formatTSh(topCashier.revenue)}
                  </span>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-[#F8F8F8] text-[#605E5C] uppercase text-[10px] font-bold">
                    <tr>
                      <th className="py-2.5 px-4 text-left">{isSw ? 'Mfanyakazi' : 'Employee'}</th>
                      <th className="py-2.5 px-3 text-left">{isSw ? 'Nafasi' : 'Role'}</th>
                      <th className="py-2.5 px-3 text-right">{isSw ? 'Risiti' : 'Receipts'}</th>
                      <th className="py-2.5 px-3 text-right">{isSw ? 'Mapato' : 'Revenue'}</th>
                      <th className="py-2.5 px-4 text-left">{isSw ? 'Hali' : 'Status'}</th>
                      {canSwitch && <th className="py-2.5 px-3 text-right" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EDEBE9]">
                    {staffWithStats
                      .slice()
                      .sort((a, b) => b.todayRevenueTzs - a.todayRevenueTzs)
                      .map(s => (
                        <tr key={s.id} className="hover:bg-[#FAFBFC]">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-[#323130]">{s.name}</div>
                            <div className="text-[10px] text-[#605E5C]">{s.branch || 'HQ'}</div>
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded-md bg-[#F3F2F1] text-[10px] font-bold">{s.role}</span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono">{s.todaySalesCount}</td>
                          <td className="py-3 px-3 text-right font-mono font-semibold text-emerald-700">
                            {formatTSh(s.todayRevenueTzs)}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1">
                              {!s.active && (
                                <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 text-[9px] font-bold">
                                  {isSw ? 'Imesimamishwa' : 'Suspended'}
                                </span>
                              )}
                              {s.shiftOpen && (
                                <span className="px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 text-[9px] font-bold">
                                  {isSw ? 'Zamu' : 'Shift'}
                                </span>
                              )}
                              {s.poshoClaimed && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 text-[9px] font-bold">
                                  Posho
                                </span>
                              )}
                              {s.payrollUnpaid && s.active && (
                                <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 text-[9px] font-bold">
                                  {isSw ? 'Haijalipwa' : 'Unpaid'}
                                </span>
                              )}
                            </div>
                          </td>
                          {canSwitch && (
                            <td className="py-3 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => onSwitchToStaffSite?.(s)}
                                className="p-1.5 rounded-lg hover:bg-blue-50 text-[#0078D4] cursor-pointer"
                                title={isSw ? 'Ingia kituoni' : 'Open workstation'}
                              >
                                <LogIn className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    {staffWithStats.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-10 text-center text-[#605E5C]">
                          {isSw
                            ? 'Hakuna wafanyakazi bado — ongeza kwenye Orodha.'
                            : 'No staff yet — add people in Directory.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-3">
            <div className="bg-white rounded-xl border border-[#E1DFDD] p-4 space-y-3">
              <h3 className="text-sm font-bold text-[#323130] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                {isSw ? 'Vitendo vinavyosubiri' : 'HR action queue'}
              </h3>
              <ul className="space-y-2 text-xs">
                <li className="flex items-center justify-between gap-2">
                  <span className="text-[#605E5C]">{isSw ? 'Posho haijadaiwa leo' : 'Stipend not claimed today'}</span>
                  <span className="font-bold">{activeCount - poshoTodayCount}</span>
                </li>
                <li className="flex items-center justify-between gap-2">
                  <span className="text-[#605E5C]">{isSw ? 'Mikopo inayosubiri' : 'Pending advances'}</span>
                  <span className={`font-bold ${pendingAdvanceCount ? 'text-rose-600' : ''}`}>{pendingAdvanceCount}</span>
                </li>
                <li className="flex items-center justify-between gap-2">
                  <span className="text-[#605E5C]">{isSw ? `Mishahara ${month}` : `Payroll ${month}`}</span>
                  <span className={`font-bold ${unpaidPayrollCount ? 'text-rose-600' : 'text-emerald-700'}`}>
                    {unpaidPayrollCount} {isSw ? 'haijalipwa' : 'unpaid'}
                  </span>
                </li>
              </ul>
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate(unpaidPayrollCount ? 'payroll' : pendingAdvanceCount ? 'advances' : 'allowances')}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-[#6264A7] text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer hover:bg-[#5557a0]"
                >
                  {isSw ? 'Fungua malipo' : 'Open pay hub'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="bg-gradient-to-br from-[#1a2832] to-[#2d3f4f] rounded-xl p-4 text-white space-y-2">
              <p className="text-[11px] font-semibold text-white/70 uppercase tracking-wide">
                {isSw ? 'Mchakato wa HR' : 'HR lifecycle'}
              </p>
              <ol className="text-xs space-y-1.5 text-white/90 list-decimal list-inside">
                <li>{isSw ? 'Sajili mfanyakazi + nafasi + ruhusa' : 'Hire — role & permissions'}</li>
                <li>{isSw ? 'Weka mshahara & posho' : 'Set salary & daily stipend rates'}</li>
                <li>{isSw ? 'Fungua/funga zamu kwenye POS' : 'Open/close shifts at POS'}</li>
                <li>{isSw ? 'Thibitisha posho & mikopo' : 'Confirm stipends & advances'}</li>
                <li>{isSw ? 'Lipa mshahara wa mwezi + slipu' : 'Run monthly payroll + payslip'}</li>
              </ol>
              <button
                type="button"
                onClick={() => setTab('directory')}
                className="mt-2 w-full px-3 py-2 rounded-lg bg-white text-[#1a2832] text-xs font-bold cursor-pointer"
              >
                {isSw ? 'Nenda kwenye orodha' : 'Go to directory'}
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'directory' && canTeam && (
        <div className="bg-white rounded-xl border border-[#E1DFDD] p-4 md:p-5">
          <StaffTeamPanel
            language={language}
            staffList={staffList}
            setStaffList={setStaffList}
            currentUser={currentUser}
          />
        </div>
      )}

      {tab === 'directory' && !canTeam && (
        <p className="text-sm text-[#605E5C]">
          {isSw ? 'Orodha inapatikana kwa mmiliki/msimamizi.' : 'Directory is available to owners/managers.'}
        </p>
      )}

      {tab === 'compensation' && (
        <div className="bg-white rounded-xl border border-[#E1DFDD] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#EDEBE9]">
            <h3 className="text-sm font-bold text-[#323130]">
              {isSw ? 'Mishahara na posho kwa kila mfanyakazi' : 'Salary & stipend rates per employee'}
            </h3>
            <p className="text-[11px] text-[#605E5C] mt-0.5">
              {isSw
                ? 'Msingi wa mwezi, chakula, na usafiri — hutumika kwenye payroll na madai ya posho.'
                : 'Monthly base, food, and transport — used by payroll and stipend claims.'}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#F8F8F8] text-[#605E5C] uppercase text-[10px] font-bold">
                <tr>
                  <th className="py-2.5 px-4 text-left">{isSw ? 'Mfanyakazi' : 'Employee'}</th>
                  <th className="py-2.5 px-3 text-right">{isSw ? 'Mshahara' : 'Base salary'}</th>
                  <th className="py-2.5 px-3 text-right">{isSw ? 'Chakula/siku' : 'Food/day'}</th>
                  <th className="py-2.5 px-3 text-right">{isSw ? 'Usafiri/siku' : 'Transit/day'}</th>
                  <th className="py-2.5 px-3 text-right">{isSw ? 'Posho/siku' : 'Stipend/day'}</th>
                  <th className="py-2.5 px-4 text-right">{isSw ? 'Vitendo' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDEBE9]">
                {staffWithStats.map(s => (
                  <tr key={s.id} className={!s.active ? 'opacity-50' : ''}>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-[#323130]">{s.name}</div>
                      <div className="text-[10px] text-[#605E5C]">{s.role}</div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono">{formatTSh(s.baseSalary)}</td>
                    <td className="py-3 px-3 text-right font-mono">{formatTSh(s.food)}</td>
                    <td className="py-3 px-3 text-right font-mono">{formatTSh(s.transport)}</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700">
                      {formatTSh(s.food + s.transport)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {canPay && (
                        <button
                          type="button"
                          onClick={() => openRateEditor(s)}
                          className="px-2.5 py-1 rounded-lg border border-[#E1DFDD] text-[10px] font-bold hover:bg-[#F3F2F1] cursor-pointer"
                        >
                          {isSw ? 'Hariri' : 'Edit'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'attendance' && (
        <div className="bg-white rounded-xl border border-[#E1DFDD] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#EDEBE9]">
            <h3 className="text-sm font-bold text-[#323130]">
              {isSw ? `Mahudhurio — ${today}` : `Attendance — ${today}`}
            </h3>
            <p className="text-[11px] text-[#605E5C] mt-0.5">
              {isSw
                ? 'Zamu zilizofunguliwa kwenye POS na hali ya posho ya leo.'
                : 'POS open shifts and today’s stipend claim status.'}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#F8F8F8] text-[#605E5C] uppercase text-[10px] font-bold">
                <tr>
                  <th className="py-2.5 px-4 text-left">{isSw ? 'Mfanyakazi' : 'Employee'}</th>
                  <th className="py-2.5 px-3 text-left">{isSw ? 'Zamu iliyopangwa' : 'Scheduled shift'}</th>
                  <th className="py-2.5 px-3 text-left">{isSw ? 'Zamu sasa' : 'Live shift'}</th>
                  <th className="py-2.5 px-3 text-left">Posho</th>
                  <th className="py-2.5 px-3 text-right">{isSw ? 'Mauzo leo' : 'Sales today'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDEBE9]">
                {staffWithStats.map(s => (
                  <tr key={s.id}>
                    <td className="py-3 px-4 font-semibold text-[#323130]">{s.name}</td>
                    <td className="py-3 px-3 text-[#605E5C]">{s.shift || '—'}</td>
                    <td className="py-3 px-3">
                      {s.shiftOpen ? (
                        <span className="text-violet-700 font-bold">
                          {isSw ? 'Wazi' : 'Open'}
                          {s.shiftOpenedAt
                            ? ` · ${new Date(s.shiftOpenedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                            : ''}
                        </span>
                      ) : (
                        <span className="text-[#8A8886]">{isSw ? 'Haipo' : 'Closed'}</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {s.poshoClaimed ? (
                        <span className="text-emerald-700 font-bold">{formatTSh(s.poshoAmount)}</span>
                      ) : (
                        <span className="text-amber-700 font-semibold">{isSw ? 'Haijadaiwa' : 'Not claimed'}</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-mono">{formatTSh(s.todayRevenueTzs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editRatesId && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E1DFDD] shadow-xl max-w-sm w-full p-5 text-xs space-y-3">
            <h4 className="font-bold text-sm text-[#323130]">
              {isSw ? 'Hariri malipo' : 'Edit compensation'}
            </h4>
            <label className="block space-y-1">
              <span className="text-[10px] font-bold text-[#605E5C]">{isSw ? 'Mshahara wa mwezi' : 'Monthly base'}</span>
              <input
                type="number"
                min={0}
                value={rateDraft.baseSalary}
                onChange={e => setRateDraft(prev => ({ ...prev, baseSalary: Number(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-[#E1DFDD] rounded-lg font-mono"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[10px] font-bold text-[#605E5C]">{isSw ? 'Posho chakula / siku' : 'Food stipend / day'}</span>
              <input
                type="number"
                min={0}
                value={rateDraft.food}
                onChange={e => setRateDraft(prev => ({ ...prev, food: Number(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-[#E1DFDD] rounded-lg font-mono"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[10px] font-bold text-[#605E5C]">{isSw ? 'Posho usafiri / siku' : 'Transit stipend / day'}</span>
              <input
                type="number"
                min={0}
                value={rateDraft.transport}
                onChange={e => setRateDraft(prev => ({ ...prev, transport: Number(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-[#E1DFDD] rounded-lg font-mono"
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditRatesId(null)} className="px-3 py-2 rounded-lg border text-xs font-semibold cursor-pointer">
                {isSw ? 'Ghairi' : 'Cancel'}
              </button>
              <button type="button" onClick={saveRates} className="px-4 py-2 rounded-lg bg-[#107C10] text-white text-xs font-bold cursor-pointer">
                {isSw ? 'Hifadhi' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffUsersView;
