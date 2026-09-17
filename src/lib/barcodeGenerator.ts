import JsBarcode from 'jsbarcode';
import { Product } from '@/types/v1';
import { getProductBarcodeValue, getProductQRPayloadString } from '@/utils/qrGenerator';

/** Code128 PNG data URL for USB 1D scanners (value = barcode field or SKU). */
export function generateProductBarcodeDataUrl(product: Product, height = 80): string {
  const value = getProductBarcodeValue(product);
  const canvas = document.createElement('canvas');
  JsBarcode(canvas, value, {
    format: 'CODE128',
    width: 2,
    height,
    displayValue: true,
    fontSize: 14,
    margin: 8,
    background: '#ffffff',
    lineColor: '#1E213D',
  });
  return canvas.toDataURL('image/png');
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

export { getProductQRPayloadString, getProductBarcodeValue };
