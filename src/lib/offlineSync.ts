import { api } from '@/lib/api';
import { saveSyncQueue, type SyncQueueItem } from '@/lib/transactionEngine';

export interface SyncFlushResult {
  processed: number;
  failed: number;
  remaining: SyncQueueItem[];
}

async function replaySyncItem(item: SyncQueueItem): Promise<void> {
  const payload = item.payload as Record<string, unknown>;
  switch (item.entity_type) {
    case 'sale':
      if (item.action === 'create') await api.createSale(payload);
      break;
    case 'product':
      if (item.action === 'create') await api.createProduct(payload);
      else if (item.action === 'update') await api.updateProduct(item.entity_id, payload);
      break;
    case 'customer':
      if (item.action === 'create') await api.createCustomer(payload);
      else if (item.action === 'update') await api.updateCustomer(item.entity_id, payload);
      break;
    case 'stock':
      if (item.action === 'adjust') await api.adjustStock(payload);
      break;
    default:
      throw new Error(`Unsupported sync item: ${item.entity_type}/${item.action}`);
  }
}

/** Push queued mutations — batch endpoint first, then per-item fallback. */
export async function flushSyncQueue(
  tenantId: string,
  queue: SyncQueueItem[],
): Promise<SyncFlushResult> {
  if (!queue.length) {
    return { processed: 0, failed: 0, remaining: [] };
  }

  try {
    await api.syncBatch(queue as Array<Record<string, unknown>>);
    saveSyncQueue(tenantId, []);
    return { processed: queue.length, failed: 0, remaining: [] };
  } catch {
    /* batch unavailable — replay individually */
  }

  const remaining: SyncQueueItem[] = [];
  let processed = 0;
  let failed = 0;

  for (const item of queue) {
    try {
      await replaySyncItem(item);
      processed += 1;
    } catch {
      remaining.push(item);
      failed += 1;
    }
  }

  saveSyncQueue(tenantId, remaining);
  return { processed, failed, remaining };
}
