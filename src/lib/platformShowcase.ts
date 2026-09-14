import { getApiBaseUrl } from '@/lib/apiConfig';

export interface PlatformShowcaseItem {
  id: string;
  title: string;
  subtitle?: string | null;
  mediaType: 'video' | 'image';
  mediaUrl: string;
  thumbnailUrl?: string | null;
  linkUrl?: string | null;
  sortOrder: number;
  isActive?: boolean;
  isFeatured: boolean;
  createdBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export const DEFAULT_SHOWCASE_ITEMS: PlatformShowcaseItem[] = [
  {
    id: 'default-demo-video',
    title: 'Duka+ POS in 60 seconds',
    subtitle: 'Sell faster, track stock, manage credit — on phone and desktop.',
    mediaType: 'video',
    mediaUrl: 'https://www.youtube.com/embed/ScMzIvxBSi4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1200&auto=format&fit=crop',
    sortOrder: 0,
    isFeatured: true,
    isActive: true,
  },
  {
    id: 'default-ad-1',
    title: 'TRA EFD & VAT Compliance',
    subtitle: 'Receipts, signatures, and tax reports built for Tanzania.',
    mediaType: 'image',
    mediaUrl: 'https://images.unsplash.com/photo-1454165804603-c3d57bc86b40?w=800&auto=format&fit=crop',
    sortOrder: 1,
    isFeatured: false,
    isActive: true,
  },
  {
    id: 'default-ad-2',
    title: 'Multi-branch Inventory',
    subtitle: 'Track stock across branches, transfers, and low-stock alerts.',
    mediaType: 'image',
    mediaUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800&auto=format&fit=crop',
    sortOrder: 2,
    isFeatured: false,
    isActive: true,
  },
];

export function mapShowcaseFromApi(row: Record<string, unknown>): PlatformShowcaseItem {
  return {
    id: String(row.id),
    title: String(row.title),
    subtitle: row.subtitle != null ? String(row.subtitle) : undefined,
    mediaType: (row.media_type === 'video' ? 'video' : 'image') as 'video' | 'image',
    mediaUrl: String(row.media_url),
    thumbnailUrl: row.thumbnail_url != null ? String(row.thumbnail_url) : undefined,
    linkUrl: row.link_url != null ? String(row.link_url) : undefined,
    sortOrder: Number(row.sort_order ?? 0),
    isActive: row.is_active !== false,
    isFeatured: Boolean(row.is_featured),
    createdBy: row.created_by != null ? String(row.created_by) : undefined,
    createdAt: row.created_at != null ? String(row.created_at) : undefined,
    updatedAt: row.updated_at != null ? String(row.updated_at) : undefined,
  };
}

export function showcaseToApiPayload(item: Partial<PlatformShowcaseItem>): Record<string, unknown> {
  return {
    title: item.title,
    subtitle: item.subtitle ?? null,
    media_type: item.mediaType ?? 'image',
    media_url: item.mediaUrl,
    thumbnail_url: item.thumbnailUrl ?? null,
    link_url: item.linkUrl ?? null,
    sort_order: item.sortOrder ?? 0,
    is_active: item.isActive ?? true,
    is_featured: item.isFeatured ?? false,
  };
}

export async function fetchPublicShowcase(): Promise<PlatformShowcaseItem[]> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/platform/showcase`);
    if (!res.ok) return DEFAULT_SHOWCASE_ITEMS;
    const data = (await res.json()) as Record<string, unknown>[];
    if (!data.length) return DEFAULT_SHOWCASE_ITEMS;
    return data.map(mapShowcaseFromApi);
  } catch {
    return DEFAULT_SHOWCASE_ITEMS;
  }
}
