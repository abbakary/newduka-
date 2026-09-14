import { createStore, get, set, del } from 'idb-keyval';

const tenantCacheStore = createStore('duka-db', 'tenant-cache');

export async function idbGet<T>(key: string): Promise<T | undefined> {
  return get<T>(key, tenantCacheStore);
}

export async function idbSet(key: string, value: unknown): Promise<void> {
  await set(key, value, tenantCacheStore);
}

export async function idbDelete(key: string): Promise<void> {
  await del(key, tenantCacheStore);
}
