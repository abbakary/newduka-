export interface PageMeta {
  total: number;
  skip: number;
  limit: number;
  has_more: boolean;
}

export interface Paginated<T> {
  items: T[];
  meta: PageMeta;
}

/** Supports legacy bare arrays and new paginated API responses. */
export function unwrapPage<T>(raw: unknown): Paginated<T> {
  if (Array.isArray(raw)) {
    return {
      items: raw as T[],
      meta: { total: raw.length, skip: 0, limit: raw.length, has_more: false },
    };
  }
  if (raw && typeof raw === 'object' && 'items' in raw) {
    const obj = raw as { items: T[]; meta?: Partial<PageMeta> };
    const items = obj.items ?? [];
    const meta = obj.meta ?? {};
    return {
      items,
      meta: {
        total: meta.total ?? items.length,
        skip: meta.skip ?? 0,
        limit: meta.limit ?? items.length,
        has_more: Boolean(meta.has_more),
      },
    };
  }
  return { items: [], meta: { total: 0, skip: 0, limit: 0, has_more: false } };
}

export async function fetchAllPages<T>(
  fetchPage: (skip: number, limit: number) => Promise<Paginated<T>>,
  pageSize = 500,
  maxItems = 5000,
): Promise<T[]> {
  const all: T[] = [];
  let skip = 0;
  while (all.length < maxItems) {
    const page = await fetchPage(skip, pageSize);
    all.push(...page.items);
    if (!page.meta.has_more || page.items.length === 0) break;
    skip += pageSize;
  }
  return all;
}
