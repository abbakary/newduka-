import QRCode from 'qrcode';
import type { SaleTransaction } from '@/types/v1';
import type {
  EfdApiSettings,
  TraCustomerIdType,
  TraReceipt,
  TraReceiptItem,
  TraReceiptStatus,
} from '@/types/traReceipt';
import type { TaxComplianceSettings } from '@/lib/taxComplianceSettings';
import { generateReceiptNumber, generateTraSignature } from '@/lib/taxComplianceSettings';

export interface TraReceiptBuildInput {
  sale: SaleTransaction;
  taxSettings: TaxComplianceSettings;
  efdSettings: EfdApiSettings;
  companyName: string;
  customerMobile?: string;
  customerIdType?: TraCustomerIdType;
  customerIdNumber?: string;
  branchId?: string;
}

export interface EfdApiSubmitResult {
  ok: boolean;
  receiptNumber?: string;
  verificationCode?: string;
  verificationLink?: string;
  zNumber?: string;
  vrn?: string;
  status?: TraReceiptStatus;
  rawResponse?: string;
  errorMessage?: string;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function splitDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) {
    const now = new Date();
    return {
      date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
      time: `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
    };
  }
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
  };
}

function saleItemsToTraItems(sale: SaleTransaction, vatRate: number): TraReceiptItem[] {
  return sale.items.map(item => {
    const lineTotal = item.total ?? item.unitPrice * item.quantity;
    const vatAmount = Math.round(lineTotal * (vatRate / (1 + vatRate)));
    return {
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      vatAmount,
      total: lineTotal,
    };
  });
}

function buildVerificationLink(code: string, vrn: string): string {
  const q = encodeURIComponent(code);
  const v = encodeURIComponent(vrn.replace(/\s/g, ''));
  return `https://verify.tra.go.tz/?vrn=${v}&code=${q}`;
}

export async function generateTraVerificationQrDataUrl(link: string): Promise<string> {
  if (!link) return '';
  try {
    return await QRCode.toDataURL(link, {
      width: 200,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#1E213D', light: '#FFFFFF' },
    });
  } catch {
    return '';
  }
}

function buildLocalTraResponse(
  receiptNumber: string,
  verificationCode: string,
  zNumber: string,
  vrn: string,
  demo: boolean,
): EfdApiSubmitResult {
  const verificationLink = buildVerificationLink(verificationCode, vrn);
  return {
    ok: true,
    receiptNumber,
    verificationCode,
    verificationLink,
    zNumber,
    vrn,
    status: demo ? 'demo' : 'success',
    rawResponse: JSON.stringify(
      {
        source: demo ? 'local_demo_efd' : 'local_tra_efd',
        receiptNumber,
        verificationCode,
        verificationLink,
        zNumber,
        vrn,
        message: demo
          ? 'Demo receipt — configure EFD API for live fiscal posting.'
          : 'Local TRA EFD receipt (API not enabled).',
      },
      null,
      2,
    ),
  };
}

export async function testEfdConnection(settings: EfdApiSettings): Promise<{
  ok: boolean;
  message: string;
}> {
  if (!settings.apiBaseUrl.trim()) {
    return { ok: false, message: 'API base URL is required.' };
  }
  const base = settings.apiBaseUrl.replace(/\/$/, '');
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (settings.apiKey) headers.Authorization = `Bearer ${settings.apiKey}`;
  if (settings.deviceId) headers['X-Device-Id'] = settings.deviceId;

  try {
    const res = await fetch(`${base}/health`, { method: 'GET', headers });
    if (res.ok) {
      const text = await res.text();
      return { ok: true, message: text || 'Connection successful.' };
    }
    if (res.status === 404) {
      return {
        ok: true,
        message: 'Endpoint reachable (health path not found — try submitting a receipt).',
      };
    }
    return { ok: false, message: `HTTP ${res.status}: ${await res.text()}` };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Network error',
    };
  }
}

export async function submitReceiptToEfdApi(
  settings: EfdApiSettings,
  sale: SaleTransaction,
  taxSettings: TaxComplianceSettings,
  meta: { companyName: string; customerMobile?: string; customerIdType?: TraCustomerIdType; customerIdNumber?: string },
): Promise<EfdApiSubmitResult> {
  const base = settings.apiBaseUrl.replace(/\/$/, '');
  const payload = {
    deviceId: settings.deviceId,
    zNumber: settings.zNumber || settings.deviceId,
    vrn: taxSettings.vrnNumber,
    tin: taxSettings.tinNumber,
    companyName: meta.companyName,
    invoiceReference: sale.receiptNumber,
    posOrderId: sale.id,
    customerName: sale.customerName || 'Walk-in Customer',
    customerMobile: meta.customerMobile || '',
    customerIdType: meta.customerIdType || 'None',
    customerIdNumber: meta.customerIdNumber || '',
    items: sale.items.map(i => ({
      name: i.productName,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      total: i.total ?? i.unitPrice * i.quantity,
    })),
    totalExclTax: sale.subtotal - (sale.discountAmount ?? 0),
    totalVat: sale.vatAmount,
    totalInclTax: sale.total,
    demoMode: settings.demoMode,
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (settings.apiKey) headers.Authorization = `Bearer ${settings.apiKey}`;
  if (settings.apiSecret) headers['X-Api-Secret'] = settings.apiSecret;
  if (settings.deviceId) headers['X-Device-Id'] = settings.deviceId;

  try {
    const res = await fetch(`${base}/receipts`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      parsed = { raw: text };
    }

    if (!res.ok) {
      return {
        ok: false,
        errorMessage: `HTTP ${res.status}`,
        rawResponse: text,
        status: 'failed',
      };
    }

    const data = (parsed.data ?? parsed) as Record<string, unknown>;
    return {
      ok: true,
      receiptNumber: String(data.receiptNumber ?? data.receipt_number ?? sale.receiptNumber),
      verificationCode: String(data.verificationCode ?? data.verification_code ?? ''),
      verificationLink: String(data.verificationLink ?? data.verification_link ?? ''),
      zNumber: String(data.zNumber ?? data.z_number ?? settings.zNumber),
      vrn: String(data.vrn ?? taxSettings.vrnNumber),
      status: settings.demoMode ? 'demo' : 'success',
      rawResponse: JSON.stringify(parsed, null, 2),
    };
  } catch (err) {
    return {
      ok: false,
      errorMessage: err instanceof Error ? err.message : 'Network error',
      status: 'failed',
      rawResponse: JSON.stringify({ error: String(err) }, null, 2),
    };
  }
}

export async function issueTraReceipt(input: TraReceiptBuildInput): Promise<TraReceipt> {
  const { sale, taxSettings, efdSettings, companyName } = input;
  const { date, time } = splitDateTime(sale.date);
  const vrn = taxSettings.vrnNumber || '';
  const zNumber = efdSettings.zNumber || efdSettings.deviceId || taxSettings.traEfdSerial || '—';
  const receiptNumber = sale.receiptNumber || generateReceiptNumber(taxSettings);
  const items = saleItemsToTraItems(sale, taxSettings.vatRate);

  let apiResult: EfdApiSubmitResult;

  if (taxSettings.mode === 'tra_efd' && efdSettings.enabled && efdSettings.apiBaseUrl.trim()) {
    apiResult = await submitReceiptToEfdApi(efdSettings, sale, taxSettings, {
      companyName,
      customerMobile: input.customerMobile,
      customerIdType: input.customerIdType,
      customerIdNumber: input.customerIdNumber,
    });
    if (!apiResult.ok) {
      const verificationCode = generateTraSignature(taxSettings, receiptNumber).slice(-12) || `ERR-${Date.now().toString(36).toUpperCase()}`;
      return buildTraReceiptRecord({
        sale,
        companyName,
        receiptNumber,
        verificationCode,
        date,
        time,
        zNumber,
        vrn,
        verificationLink: '',
        items,
        status: 'failed',
        isDemo: efdSettings.demoMode,
        apiResponse: apiResult.rawResponse || apiResult.errorMessage,
        customerMobile: input.customerMobile,
        customerIdType: input.customerIdType,
        customerIdNumber: input.customerIdNumber,
        branchId: input.branchId,
      });
    }
  } else if (taxSettings.mode === 'tra_efd') {
    const verificationCode =
      generateTraSignature(taxSettings, receiptNumber).split('-').pop()?.slice(0, 12) ||
      `TRA${Date.now().toString(36).toUpperCase().slice(-8)}`;
    apiResult = buildLocalTraResponse(
      receiptNumber,
      verificationCode,
      zNumber,
      vrn,
      !efdSettings.enabled || efdSettings.demoMode,
    );
  } else {
    return buildTraReceiptRecord({
      sale,
      companyName,
      receiptNumber,
      verificationCode: '—',
      date,
      time,
      zNumber: '—',
      vrn: '—',
      verificationLink: '',
      items,
      status: 'pending',
      isDemo: true,
      apiResponse: 'Manual mode — TRA receipt not issued.',
      customerMobile: input.customerMobile,
      customerIdType: input.customerIdType ?? 'None',
      customerIdNumber: input.customerIdNumber,
      branchId: input.branchId,
    });
  }

  const verificationCode = apiResult.verificationCode || '';
  const verificationLink =
    apiResult.verificationLink || (verificationCode ? buildVerificationLink(verificationCode, apiResult.vrn || vrn) : '');

  return buildTraReceiptRecord({
    sale,
    companyName,
    receiptNumber: apiResult.receiptNumber || receiptNumber,
    verificationCode,
    date,
    time,
    zNumber: apiResult.zNumber || zNumber,
    vrn: apiResult.vrn || vrn,
    verificationLink,
    items,
    status: apiResult.status || (efdSettings.demoMode ? 'demo' : 'success'),
    isDemo: efdSettings.demoMode || apiResult.status === 'demo',
    apiResponse: apiResult.rawResponse,
    customerMobile: input.customerMobile,
    customerIdType: input.customerIdType,
    customerIdNumber: input.customerIdNumber,
    branchId: input.branchId,
  });
}

async function buildTraReceiptRecord(opts: {
  sale: SaleTransaction;
  companyName: string;
  receiptNumber: string;
  verificationCode: string;
  date: string;
  time: string;
  zNumber: string;
  vrn: string;
  verificationLink: string;
  items: TraReceiptItem[];
  status: TraReceiptStatus;
  isDemo: boolean;
  apiResponse?: string;
  customerMobile?: string;
  customerIdType?: TraCustomerIdType;
  customerIdNumber?: string;
  branchId?: string;
}): Promise<TraReceipt> {
  const qr = opts.verificationLink
    ? await generateTraVerificationQrDataUrl(opts.verificationLink)
    : '';

  const totalExcl = opts.sale.subtotal - (opts.sale.discountAmount ?? 0);
  return {
    id: `tra-${opts.sale.id}-${Date.now()}`,
    receiptNumber: opts.receiptNumber,
    verificationCode: opts.verificationCode,
    receiptDate: opts.date,
    receiptTime: opts.time,
    zNumber: opts.zNumber,
    vrn: opts.vrn,
    verificationLink: opts.verificationLink,
    verificationQrDataUrl: qr || undefined,
    source: 'pos_order',
    companyName: opts.companyName,
    invoiceReference: opts.sale.receiptNumber,
    invoiceDate: opts.date,
    saleId: opts.sale.id,
    posOrderId: opts.sale.id,
    customerName: opts.sale.customerName || 'Walk-in Customer',
    customerIdType: opts.customerIdType ?? 'None',
    customerIdNumber: opts.customerIdNumber ?? '',
    customerMobile: opts.customerMobile ?? '',
    totalExclTax: totalExcl,
    totalVat: opts.sale.vatAmount,
    totalInclTax: opts.sale.total,
    status: opts.status,
    isDemo: opts.isDemo,
    items: opts.items,
    apiResponse: opts.apiResponse,
    branchId: opts.branchId,
    createdAt: new Date().toISOString(),
  };
}

export const TRA_CUSTOMER_ID_TYPES: TraCustomerIdType[] = [
  'TIN',
  'NIDA',
  'Passport',
  'Driving License',
  'None',
];
