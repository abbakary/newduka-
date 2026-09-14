/**
 * Cashier shift open/close session (required before POS).
 * Persisted per tenant + staff/user in localStorage.
 */

export interface CashierShiftSession {
  id: string;
  tenantId: string;
  staffId: string;
  cashierName: string;
  openedAt: string;
  openingFloat: number;
  closedAt?: string;
  closingCashCounted?: number;
  closingNotes?: string;
  status: 'open' | 'closed';
}

const key = (tenantId: string, staffId: string) =>
  `duka_cashier_shift:${tenantId || 'local'}:${staffId || 'anon'}`;

export function getOpenCashierShift(
  tenantId: string,
  staffId: string,
): CashierShiftSession | null {
  try {
    const raw = localStorage.getItem(key(tenantId, staffId));
    if (!raw) return null;
    const s = JSON.parse(raw) as CashierShiftSession;
    if (s?.status === 'open' && !s.closedAt) return s;
    return null;
  } catch {
    return null;
  }
}

export function openCashierShift(input: {
  tenantId: string;
  staffId: string;
  cashierName: string;
  openingFloat?: number;
}): CashierShiftSession {
  const session: CashierShiftSession = {
    id: `shift-${Date.now()}`,
    tenantId: input.tenantId,
    staffId: input.staffId,
    cashierName: input.cashierName,
    openedAt: new Date().toISOString(),
    openingFloat: Number(input.openingFloat || 0),
    status: 'open',
  };
  localStorage.setItem(key(input.tenantId, input.staffId), JSON.stringify(session));
  return session;
}

export function closeCashierShift(input: {
  tenantId: string;
  staffId: string;
  closingCashCounted?: number;
  closingNotes?: string;
}): CashierShiftSession | null {
  const open = getOpenCashierShift(input.tenantId, input.staffId);
  if (!open) return null;
  const closed: CashierShiftSession = {
    ...open,
    status: 'closed',
    closedAt: new Date().toISOString(),
    closingCashCounted: input.closingCashCounted,
    closingNotes: input.closingNotes,
  };
  localStorage.setItem(key(input.tenantId, input.staffId), JSON.stringify(closed));
  // Keep last closed for audit; clear "open" by storing closed
  return closed;
}

export function localYmd(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function saleMatchesCashier(saleCashier: string | undefined, cashierName: string | undefined): boolean {
  if (!cashierName) return true;
  const a = (saleCashier || '').trim().toLowerCase();
  const b = cashierName.trim().toLowerCase();
  if (!a || !b) return true;
  return a === b || a.includes(b) || b.includes(a);
}
