import QRCode from 'qrcode';
import { Product } from '@/types/v1';

export interface ProductQRPayload {
  id: string;
  sku: string;
  name: string;
  price: number;
  cost?: number;
  batchNumber?: string;
  expiryDate?: string;
  category?: string;
}

/** Opaque POS lookup token — no price/name (safe if scanned outside the app). */
export const PRODUCT_QR_PREFIX = 'DUKA+SKU:';

/**
 * Encodes only SKU for shelf labels. POS resolves product from catalog.
 * Never embeds price, cost, or internal IDs in the scannable payload.
 */
export function getProductQRPayloadString(product: Product): string {
  const sku = (product.sku || product.id || '').trim();
  return `${PRODUCT_QR_PREFIX}${sku}`;
}

/** Value encoded in Code128 — prefer explicit barcode, else SKU (USB scanner wedge). */
export function getProductBarcodeValue(product: Product): string {
  const raw = (product.barcode || product.sku || product.id || '').trim();
  if (!raw || raw.length > 80) {
    throw new Error('Invalid barcode/SKU for label');
  }
  return raw;
}

/** @deprecated Legacy JSON — kept for parsing old printed labels only. */
export function getLegacyProductQRJson(product: Product): string {
  const payload: ProductQRPayload = {
    id: product.id,
    sku: product.sku,
    name: product.name,
    price: product.price,
    batchNumber: product.batchNumber,
    expiryDate: product.expiryDate,
    category: product.category,
  };
  return JSON.stringify(payload);
}

/**
 * Generate a high-resolution base64 PNG data URL for a product
 */
export async function generateProductQRCodeDataUrl(
  product: Product,
  width = 256
): Promise<string> {
  try {
    const payloadStr = getProductQRPayloadString(product);
    const dataUrl = await QRCode.toDataURL(payloadStr, {
      width,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#1E213D',
        light: '#FFFFFF',
      },
    });
    return dataUrl;
  } catch (err) {
    console.error('Failed to generate QR code data URL', err);
    return '';
  }
}

/**
 * Parse scanned QR string safely (opaque SKU, legacy DUKA:, legacy JSON, raw barcode).
 */
export function parseScannedQRPayload(scannedText: string): Partial<ProductQRPayload> | null {
  if (!scannedText) return null;
  let trimmed = scannedText.trim();
  if (trimmed.startsWith('\uFEFF')) trimmed = trimmed.slice(1);

  // Opaque secure format
  if (trimmed.toUpperCase().startsWith(PRODUCT_QR_PREFIX)) {
    return { sku: trimmed.slice(PRODUCT_QR_PREFIX.length).trim() };
  }
  // Alternate opaque forms
  if (/^dukaplus:product:/i.test(trimmed)) {
    return { sku: trimmed.replace(/^dukaplus:product:/i, '').trim() };
  }
  try {
    const url = new URL(trimmed);
    const sku = url.searchParams.get('sku') || url.pathname.split('/').filter(Boolean).pop();
    if (sku && (url.hostname.includes('duka') || url.pathname.includes('/p/') || url.pathname.includes('/scan'))) {
      return { sku: decodeURIComponent(sku) };
    }
  } catch {
    /* not a URL */
  }

  // Legacy JSON (old labels) — accept for POS lookup only; do not re-print this format
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed) as Partial<ProductQRPayload>;
      return {
        id: parsed.id,
        sku: parsed.sku,
        name: parsed.name,
        price: typeof parsed.price === 'number' ? parsed.price : Number(parsed.price) || 0,
        category: parsed.category,
        batchNumber: parsed.batchNumber,
        expiryDate: parsed.expiryDate,
      };
    } catch {
      /* ignore */
    }
  }

  // Legacy compact
  if (trimmed.startsWith('DUKA:')) {
    const parts = trimmed.split(':');
    return {
      sku: parts[1] || '',
      price: Number(parts[2]) || 0,
      id: parts[3] || '',
    };
  }

  // Raw SKU / barcode
  return { sku: trimmed };
}
