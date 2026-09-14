import type {
  SalaryAdvanceRequest,
  SalaryPayrollRecord,
  StaffDailyAllowance,
} from '@/types/v1';

export interface StaffPayrollConfig {
  baseSalary?: number;
  dailyFoodAllowance?: number;
  dailyTransportAllowance?: number;
}

export interface PayrollStoreData {
  dailyAllowances: StaffDailyAllowance[];
  payrollRecords: SalaryPayrollRecord[];
  advances: SalaryAdvanceRequest[];
  staffConfig: Record<string, StaffPayrollConfig>;
}

const EMPTY: PayrollStoreData = {
  dailyAllowances: [],
  payrollRecords: [],
  advances: [],
  staffConfig: {},
};

function storageKey(tenantId: string): string {
  return `dukamkononi_payroll_${tenantId}`;
}

export function todayDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function currentMonthStr(): string {
  return new Date().toISOString().slice(0, 7);
}

export function loadPayrollStore(tenantId: string): PayrollStoreData {
  try {
    const raw = localStorage.getItem(storageKey(tenantId));
    if (!raw) return { ...EMPTY, staffConfig: {} };
    const parsed = JSON.parse(raw) as PayrollStoreData;
    return {
      dailyAllowances: parsed.dailyAllowances ?? [],
      payrollRecords: parsed.payrollRecords ?? [],
      advances: parsed.advances ?? [],
      staffConfig: parsed.staffConfig ?? {},
    };
  } catch {
    return { ...EMPTY, staffConfig: {} };
  }
}

export function savePayrollStore(tenantId: string, data: PayrollStoreData): void {
  localStorage.setItem(storageKey(tenantId), JSON.stringify(data));
}

export function monthAllowancesTotal(
  staffId: string,
  monthYear: string,
  allowances: StaffDailyAllowance[],
): number {
  return allowances
    .filter(a => a.staffId === staffId && a.date.startsWith(monthYear) && a.status === 'claimed')
    .reduce((sum, a) => sum + a.totalAmount, 0);
}

export function getStaffPayRates(
  staff: { id: string; dailyFoodAllowance?: number; dailyTransportAllowance?: number },
  staffConfig: Record<string, StaffPayrollConfig>,
): { food: number; transport: number; total: number } {
  const cfg = staffConfig[staff.id];
  const food = cfg?.dailyFoodAllowance ?? staff.dailyFoodAllowance ?? 5000;
  const transport = cfg?.dailyTransportAllowance ?? staff.dailyTransportAllowance ?? 3000;
  return { food, transport, total: food + transport };
}

export function findTodayAllowanceClaim(
  staffId: string,
  date: string,
  allowances: StaffDailyAllowance[],
): StaffDailyAllowance | undefined {
  return allowances.find(a => a.staffId === staffId && a.date === date && a.status === 'claimed');
}

export function recordStaffAllowanceClaim(
  store: PayrollStoreData,
  staff: { id: string; name: string; role: StaffDailyAllowance['staffRole'] },
  rates: { food: number; transport: number },
  date: string = todayDateStr(),
  expenseId?: string,
): { store: PayrollStoreData; record: StaffDailyAllowance } {
  const now = new Date();
  const timestamp = now.toISOString().replace('T', ' ').substring(0, 16);
  const record: StaffDailyAllowance = {
    id: `allow-${staff.id}-${date}`,
    date,
    staffId: staff.id,
    staffName: staff.name,
    staffRole: staff.role,
    foodAmount: rates.food,
    transportAmount: rates.transport,
    totalAmount: rates.food + rates.transport,
    status: 'claimed',
    claimedAt: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    claimedTimestamp: timestamp,
    acknowledgedSignature: `${staff.name} (Self-Claim)`,
    paymentSource: 'cash_drawer',
    notes: 'Claimed from staff workstation',
    expenseId,
  };
  return {
    store: {
      ...store,
      dailyAllowances: [
        record,
        ...store.dailyAllowances.filter(a => !(a.staffId === staff.id && a.date === date)),
      ],
    },
    record,
  };
}

export function appendSalaryAdvanceRequest(
  store: PayrollStoreData,
  request: SalaryAdvanceRequest,
): PayrollStoreData {
  return { ...store, advances: [request, ...store.advances] };
}

function parseStipendAmountsFromNotes(
  notes: string | undefined,
  total: number,
): { food: number; transport: number } {
  if (!notes) return { food: Math.round(total * 0.625), transport: total - Math.round(total * 0.625) };
  const foodMatch = notes.match(/Chakula\s+(\d+(?:\.\d+)?)/i) ?? notes.match(/food[:\s]+(\d+(?:\.\d+)?)/i);
  const transportMatch = notes.match(/Nauli\s+(\d+(?:\.\d+)?)/i) ?? notes.match(/transport[:\s]+(\d+(?:\.\d+)?)/i);
  const food = foodMatch ? Number(foodMatch[1]) : Math.round(total * 0.625);
  const transport = transportMatch ? Number(transportMatch[1]) : Math.max(0, total - food);
  return { food, transport };
}

/** Merge backend stipend expenses into payroll store so owner/manager see all claims. */
export function syncAllowancesFromStipendExpenses(
  store: PayrollStoreData,
  expenses: Array<{
    id: string;
    category: string;
    amount: number;
    recipient: string;
    date?: string;
    notes?: string;
  }>,
  staffList: Array<{ id: string; name: string; role: StaffDailyAllowance['staffRole'] }>,
): PayrollStoreData {
  const stipends = expenses.filter(e => e.category === 'daily_stipends_food_transport');
  if (stipends.length === 0) return store;

  let dailyAllowances = [...store.dailyAllowances];

  for (const exp of stipends) {
    const staff =
      staffList.find(s => s.name === exp.recipient) ??
      staffList.find(s => exp.notes?.includes(s.name) || exp.recipient.includes(s.name));
    if (!staff) continue;

    const date = (exp.date ?? todayDateStr()).slice(0, 10);
    const { food, transport } = parseStipendAmountsFromNotes(exp.notes, exp.amount);
    const record: StaffDailyAllowance = {
      id: `allow-${staff.id}-${date}`,
      date,
      staffId: staff.id,
      staffName: staff.name,
      staffRole: staff.role,
      foodAmount: food,
      transportAmount: transport,
      totalAmount: exp.amount,
      status: 'claimed',
      claimedTimestamp: exp.date,
      acknowledgedSignature: `${staff.name} (Expense #${exp.id.slice(0, 8)})`,
      paymentSource: 'cash_drawer',
      expenseId: exp.id,
      notes: exp.notes ?? 'Synced from expense ledger',
    };

    dailyAllowances = [
      record,
      ...dailyAllowances.filter(a => !(a.staffId === staff.id && a.date === date)),
    ];
  }

  return { ...store, dailyAllowances };
}
