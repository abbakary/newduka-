import type { SaleTransaction } from '@/types/v1';

/** Local calendar date as YYYY-MM-DD (no timezone drift). */
export function todayIsoDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function defaultCreditDueDate(daysFromNow = 30): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function parseIsoDateLocal(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const day = Number(m[3]);
  if (mo < 1 || mo > 12 || day < 1 || day > 31) return null;
  return new Date(y, mo - 1, day);
}

export function isPastDate(iso: string, relativeTo: Date = new Date()): boolean {
  const due = parseIsoDateLocal(iso);
  if (!due) return true;
  const today = new Date(relativeTo.getFullYear(), relativeTo.getMonth(), relativeTo.getDate());
  return due < today;
}

/** Returns user-facing error message, or null if valid. */
export function validatePaymentDueDate(iso: string | undefined | null, isSw = false): string | null {
  if (!iso?.trim()) {
    return isSw
      ? 'Tarehe ya malipo inahitajika kwa mkopo au salio linalobaki.'
      : 'Payment due date is required when there is an outstanding balance.';
  }
  if (!parseIsoDateLocal(iso)) {
    return isSw ? 'Tarehe si sahihi.' : 'Invalid due date.';
  }
  if (isPastDate(iso)) {
    return isSw
      ? 'Tarehe ya malipo haiwezi kuwa ya zamani — chagua leo au siku zijazo.'
      : 'Due date cannot be in the past — choose today or a future date.';
  }
  return null;
}

export function formatDueDateDisplay(iso: string): string {
  const d = parseIsoDateLocal(iso);
  if (!d) return iso;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Strip or validate due date on persisted sales (no back-dates). */
export function enforceSaleDueDate(sale: SaleTransaction): SaleTransaction {
  if ((sale.balanceRemaining ?? 0) <= 0) {
    return { ...sale, paymentDueDate: undefined };
  }
  const err = validatePaymentDueDate(sale.paymentDueDate);
  if (err) {
    throw new Error(err);
  }
  return { ...sale, paymentDueDate: sale.paymentDueDate!.trim() };
}
