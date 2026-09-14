import { idbDelete, idbGet, idbSet } from '@/lib/idbStore';

/** Per-product IDB key — avoids one giant map that blows quota and drops all photos. */
const imageKey = (tenantId: string, productId: string) =>
  `product-image:${tenantId || 'default'}:${productId}`;

const legacyMapKey = (tenantId: string) => `product-images:${tenantId || 'default'}`;

type ImageMap = Record<string, string>;

async function migrateLegacyMap(tenantId: string): Promise<void> {
  try {
    const map = await idbGet<ImageMap>(legacyMapKey(tenantId));
    if (!map || typeof map !== 'object') return;
    await Promise.all(
      Object.entries(map).map(async ([productId, url]) => {
        if (typeof url === 'string' && url.length > 32) {
          await idbSet(imageKey(tenantId, productId), url);
        }
      }),
    );
    await idbDelete(legacyMapKey(tenantId));
  } catch {
    /* ignore */
  }
}

export async function rememberProductImage(
  tenantId: string,
  productId: string,
  imageUrl: string | undefined | null,
): Promise<void> {
  if (!tenantId || !productId) return;
  try {
    if (imageUrl && imageUrl.length > 32) {
      await idbSet(imageKey(tenantId, productId), imageUrl);
    } else {
      await idbDelete(imageKey(tenantId, productId));
    }
  } catch {
    /* quota — ignore */
  }
}

export async function loadProductImage(
  tenantId: string,
  productId: string,
): Promise<string | undefined> {
  if (!tenantId || !productId) return undefined;
  try {
    const cached = await idbGet<string>(imageKey(tenantId, productId));
    if (typeof cached === 'string' && cached.length > 32) return cached;
  } catch {
    /* ignore */
  }
  return undefined;
}

/** Attach cached photos onto products missing imageUrl. */
export function applyProductImageCache<T extends { id: string; imageUrl?: string }>(
  products: T[],
  map: ImageMap,
): T[] {
  if (!products.length || !Object.keys(map).length) return products;
  return products.map(p => {
    if (p.imageUrl) return p;
    const cached = map[p.id];
    return cached ? { ...p, imageUrl: cached } : p;
  });
}

export async function withProductImageCache<T extends { id: string; imageUrl?: string }>(
  tenantId: string,
  products: T[],
): Promise<T[]> {
  if (!tenantId || !products.length) return products;
  await migrateLegacyMap(tenantId);

  return Promise.all(
    products.map(async p => {
      if (p.imageUrl && p.imageUrl.length > 32) {
        void rememberProductImage(tenantId, p.id, p.imageUrl);
        return p;
      }
      const cached = await loadProductImage(tenantId, p.id);
      return cached ? { ...p, imageUrl: cached } : p;
    }),
  );
}

/** Prefer incoming photo, then prior state, then IDB cache. */
export async function mergeProductImages<T extends { id: string; imageUrl?: string }>(
  tenantId: string | null | undefined,
  next: T[],
  prior: T[],
): Promise<T[]> {
  const priorById = new Map(prior.map(p => [p.id, p]));
  const merged = next.map(p => {
    const prev = priorById.get(p.id);
    return {
      ...p,
      imageUrl: p.imageUrl || prev?.imageUrl,
    };
  });
  if (!tenantId) return merged;
  return withProductImageCache(tenantId, merged);
}
