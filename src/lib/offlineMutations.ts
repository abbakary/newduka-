import { isNetworkFailure } from '@/lib/authBridge';
import type { SyncQueueItem } from '@/lib/transactionEngine';

export type MutationOutcome = 'synced' | 'queued';

export async function runWithOfflineQueue(opts: {
  isOnline: boolean;
  tenantId: string;
  entity_type: string;
  entity_id: string;
  action: string;
  payload: Record<string, unknown>;
  enqueue: (item: SyncQueueItem) => void;
  executeOnline: () => Promise<void>;
  onQueued?: () => void;
}): Promise<MutationOutcome> {
  if (opts.isOnline && navigator.onLine) {
    try {
      await opts.executeOnline();
      return 'synced';
    } catch (error) {
      if (!isNetworkFailure(error)) throw error;
    }
  }

  opts.enqueue({
    entity_type: opts.entity_type,
    entity_id: opts.entity_id,
    action: opts.action,
    payload: opts.payload,
    client_timestamp: new Date().toISOString(),
  });
  opts.onQueued?.();
  return 'queued';
}
