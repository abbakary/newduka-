export type TraCustomerIdType = 'TIN' | 'NIDA' | 'Passport' | 'Driving License' | 'None';

export type TraReceiptStatus = 'success' | 'failed' | 'pending' | 'demo';

export type TraReceiptSource = 'pos_order' | 'invoice' | 'manual';

export interface TraReceiptItem {
  productName: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  vatAmount: number;
  total: number;
}

export interface TraReceipt {
  id: string;
  receiptNumber: string;
  verificationCode: string;
  receiptDate: string;
  receiptTime: string;
  zNumber: string;
  vrn: string;
  verificationLink: string;
  verificationQrDataUrl?: string;
  source: TraReceiptSource;
  companyName: string;
  invoiceReference: string;
  invoiceDate: string;
  saleId?: string;
  posOrderId?: string;
  customerName: string;
  customerIdType: TraCustomerIdType;
  customerIdNumber: string;
  customerMobile: string;
  totalExclTax: number;
  totalVat: number;
  totalInclTax: number;
  status: TraReceiptStatus;
  isDemo: boolean;
  items: TraReceiptItem[];
  apiResponse?: string;
  branchId?: string;
  createdAt: string;
}

export interface EfdApiSettings {
  enabled: boolean;
  apiBaseUrl: string;
  apiKey: string;
  apiSecret: string;
  deviceId: string;
  zNumber: string;
  demoMode: boolean;
  lastTestAt?: string;
  lastTestOk?: boolean;
  lastTestMessage?: string;
}

export const DEFAULT_EFD_API_SETTINGS: EfdApiSettings = {
  enabled: false,
  apiBaseUrl: '',
  apiKey: '',
  apiSecret: '',
  deviceId: '',
  zNumber: '',
  demoMode: true,
};
