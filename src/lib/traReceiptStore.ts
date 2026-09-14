import type { TraReceipt } from '@/types/traReceipt';

const PREFIX = 'dukamkononi_tra_receipts_';

export function traReceiptsStorageKey(tenantId?: string | null): string {
  return `${PREFIX}${tenantId || 'default'}`;
}

export function loadTraReceipts(tenantId?: string | null): TraReceipt[] {
  try {
    const raw = localStorage.getItem(traReceiptsStorageKey(tenantId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TraReceipt[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveTraReceipts(tenantId: string | null | undefined, receipts: TraReceipt[]): void {
  localStorage.setItem(traReceiptsStorageKey(tenantId), JSON.stringify(receipts));
}

export function addTraReceipt(
  tenantId: string | null | undefined,
  receipt: TraReceipt,
): TraReceipt[] {
  const list = [receipt, ...loadTraReceipts(tenantId)];
  saveTraReceipts(tenantId, list);
  return list;
}

export function updateTraReceipt(
  tenantId: string | null | undefined,
  id: string,
  patch: Partial<TraReceipt>,
): TraReceipt[] {
  const list = loadTraReceipts(tenantId).map(r => (r.id === id ? { ...r, ...patch } : r));
  saveTraReceipts(tenantId, list);
  return list;
}

export function getTraReceiptBySaleId(
  tenantId: string | null | undefined,
  saleId: string,
): TraReceipt | undefined {
  return loadTraReceipts(tenantId).find(r => r.saleId === saleId || r.posOrderId === saleId);
}
