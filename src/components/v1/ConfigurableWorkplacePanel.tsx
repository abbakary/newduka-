import React, { useMemo } from 'react';
import {
  Pill, Barcode, Ruler, FileText, Smartphone, Shield, Car, Scissors,
  Calendar, Users, Package, AlertTriangle, Search, Wrench, Layers,
} from 'lucide-react';
import { BusinessType, Language, Product } from '@/types/v1';
import { getBusinessProfile } from '@/lib/businessEngine';
import { formatTSh } from '@/utils/translations';

export type WorkplaceMode =
  | 'tables' | 'kitchen' | 'appointments' | 'reception' | 'waiter' | 'restaurant-live'
  | 'prescriptions' | 'fractional' | 'barcodes' | 'quotations'
  | 'serial-numbers' | 'warranty' | 'vehicle-compat' | 'workshop'
  | 'variants' | 'batch-expiry' | 'commissions';

interface ConfigurableWorkplacePanelProps {
  language: Language;
  businessType: BusinessType;
  mode: WorkplaceMode;
  products?: Product[];
}

function PanelShell({
  icon, title, subtitle, children, isSw,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  isSw: boolean;
}) {
  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl p-6 border border-[#E1DFDD] shadow-xs">
        <div className="flex items-center gap-3 mb-2">
          <span className="p-2.5 rounded-xl bg-[#6264A7]/10 text-[#6264A7]">{icon}</span>
          <div>
            <h2 className="text-xl font-black text-[#323130]">{title}</h2>
            <p className="text-sm text-[#605E5C]">{subtitle}</p>
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}

export const ConfigurableWorkplacePanel: React.FC<ConfigurableWorkplacePanelProps> = ({
  language,
  businessType,
  mode,
  products = [],
}) => {
  const isSw = language === 'sw';
  const profile = getBusinessProfile(businessType);

  const rxProducts = useMemo(
    () => products.filter(p => p.requiresPrescription),
    [products],
  );
  const expiringProducts = useMemo(
    () => products.filter(p => p.expiryDate && new Date(p.expiryDate) < new Date(Date.now() + 90 * 86400000)),
    [products],
  );
  const lowStock = useMemo(
    () => products.filter(p => p.stock <= p.reorderPoint),
    [products],
  );
  const serializedProducts = useMemo(
    () => products.filter(p => (p as Record<string, unknown>).imei || (p as Record<string, unknown>).serial_number),
    [products],
  );

  if (mode === 'prescriptions') {
    return (
      <PanelShell
        icon={<Pill className="w-6 h-6" />}
        title={isSw ? 'Dawa za Rx / Prescriptions' : 'Rx Prescriptions'}
        subtitle={isSw ? 'Bidhaa zinazohitaji daktari' : 'Prescription-required medicines'}
        isSw={isSw}
      >
        {rxProducts.length === 0 ? (
          <EmptyState isSw={isSw} msg={isSw ? 'Hakuna dawa za Rx bado. Weka alama "Prescription Required" kwenye Inventory.' : 'No Rx items yet. Mark products as prescription-required in Inventory.'} />
        ) : (
          <ProductTable products={rxProducts} isSw={isSw} />
        )}
      </PanelShell>
    );
  }

  if (mode === 'batch-expiry') {
    return (
      <PanelShell
        icon={<AlertTriangle className="w-6 h-6 text-amber-600" />}
        title={isSw ? 'Batch & Expiry' : 'Batch & Expiry Management'}
        subtitle={isSw ? 'Fuatilia batch na tarehe za mwisho' : 'Track batches and expiry dates'}
        isSw={isSw}
      >
        {expiringProducts.length === 0 ? (
          <EmptyState isSw={isSw} msg={isSw ? 'Hakuna bidhaa zinazokaribia kuisha.' : 'No products nearing expiry.'} />
        ) : (
          <ProductTable products={expiringProducts} isSw={isSw} showExpiry />
        )}
      </PanelShell>
    );
  }

  if (mode === 'barcodes') {
    return (
      <PanelShell
        icon={<Barcode className="w-6 h-6" />}
        title={isSw ? 'Barcode / QR' : 'Barcode & QR Labels'}
        subtitle={isSw ? 'Chapisha lebo za barcode kutoka Inventory' : 'Print barcode labels from Inventory'}
        isSw={isSw}
      >
        <p className="text-sm text-[#605E5C] px-1">
          {isSw
            ? 'Fungua Inventory → chagua bidhaa → Print QR/Barcode. Tumia POS QR scanner kwa malipo ya haraka.'
            : 'Open Inventory → select product → Print QR/Barcode. Use POS QR scanner for fast checkout.'}
        </p>
        <ProductTable products={products.slice(0, 20)} isSw={isSw} />
      </PanelShell>
    );
  }

  if (mode === 'fractional') {
    return (
      <PanelShell
        icon={<Ruler className="w-6 h-6" />}
        title={isSw ? 'Vipimo vya Sehemu' : 'Fractional Units'}
        subtitle={isSw ? 'Mita, kg, lita — vipimo vya ujenzi' : 'Meters, kg, liters — hardware measurements'}
        isSw={isSw}
      >
        <p className="text-sm text-[#605E5C]">
          {isSw
            ? 'Weka vipimo (m, kg, bags) kwenye bidhaa za Inventory. POS inaunga mkono sehemu za vipimo.'
            : 'Set units (m, kg, bags) on Inventory products. POS supports fractional quantities.'}
        </p>
      </PanelShell>
    );
  }

  if (mode === 'quotations') {
    return (
      <PanelShell
        icon={<FileText className="w-6 h-6" />}
        title={isSw ? 'Makadirio / Quotations' : 'Quotations'}
        subtitle={isSw ? 'Tengeneza makadirio kwa wateja wa ujenzi' : 'Create quotes for contractor customers'}
        isSw={isSw}
      >
        <EmptyState isSw={isSw} msg={isSw ? 'Unda makadirio kutoka Receivables au POS.' : 'Create quotations from Receivables or POS.'} />
      </PanelShell>
    );
  }

  if (mode === 'serial-numbers' || mode === 'warranty') {
    return (
      <PanelShell
        icon={mode === 'warranty' ? <Shield className="w-6 h-6" /> : <Smartphone className="w-6 h-6" />}
        title={mode === 'warranty' ? (isSw ? 'Dhamana' : 'Warranty Tracking') : (isSw ? 'Serial / IMEI' : 'Serial & IMEI Registry')}
        subtitle={profile.label_en}
        isSw={isSw}
      >
        {serializedProducts.length === 0 ? (
          <EmptyState isSw={isSw} msg={isSw ? 'Ongeza IMEI/Serial kwenye bidhaa za elektroniki.' : 'Add IMEI/Serial fields when creating electronics products.'} />
        ) : (
          <ProductTable products={serializedProducts} isSw={isSw} showSerial />
        )}
      </PanelShell>
    );
  }

  if (mode === 'vehicle-compat') {
    return (
      <PanelShell
        icon={<Car className="w-6 h-6" />}
        title={isSw ? 'Ulinganifu wa Gari' : 'Vehicle Compatibility Search'}
        subtitle={isSw ? 'Toyota → Hilux → 2018 → Brake Pad' : 'Search parts by make, model, year'}
        isSw={isSw}
      >
        <div className="bg-[#F8F9FA] rounded-xl p-4 border border-[#E1DFDD]">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            {['Make', 'Model', 'Year', 'Part Type'].map(f => (
              <select key={f} className="px-3 py-2 rounded-lg border border-[#E1DFDD] bg-white">
                <option>{f}</option>
              </select>
            ))}
          </div>
          <button type="button" className="mt-3 flex items-center gap-2 px-4 py-2 bg-[#6264A7] text-white text-xs font-bold rounded-xl cursor-pointer">
            <Search className="w-4 h-4" /> {isSw ? 'Tafuta Sehemu' : 'Search Parts'}
          </button>
        </div>
        <ProductTable products={products.slice(0, 15)} isSw={isSw} />
      </PanelShell>
    );
  }

  if (mode === 'workshop') {
    return (
      <PanelShell
        icon={<Wrench className="w-6 h-6" />}
        title={isSw ? 'Kibanda cha Kazi' : 'Workshop Jobs'}
        subtitle={isSw ? 'Fuatilia matengenezo ya magari' : 'Track vehicle repair jobs'}
        isSw={isSw}
      >
        <EmptyState isSw={isSw} msg={isSw ? 'Hakuna kazi za workshop bado.' : 'No workshop jobs yet.'} />
      </PanelShell>
    );
  }

  if (mode === 'variants') {
    return (
      <PanelShell
        icon={<Layers className="w-6 h-6" />}
        title={isSw ? 'Variants (Ukubwa & Rangi)' : 'Size & Color Variants'}
        subtitle={isSw ? 'SKU kwa kila ukubwa/rangi' : 'SKU per size/color combination'}
        isSw={isSw}
      >
        <EmptyState isSw={isSw} msg={isSw ? 'Ongeza Size na Color kwenye bidhaa za mitindo.' : 'Add Size and Color fields when creating fashion products.'} />
      </PanelShell>
    );
  }

  if (mode === 'appointments' || mode === 'commissions') {
    return (
      <PanelShell
        icon={mode === 'commissions' ? <Users className="w-6 h-6" /> : <Calendar className="w-6 h-6" />}
        title={mode === 'commissions' ? (isSw ? 'Kamisheni za Wafanyakazi' : 'Staff Commissions') : (isSw ? 'Miadi / Appointments' : 'Appointments')}
        subtitle={profile.label_en}
        isSw={isSw}
      >
        <EmptyState
          isSw={isSw}
          msg={isSw
            ? 'Rekodi miadi na huduma kupitia Calendar na Staff Station.'
            : 'Record appointments and services via Calendar and Staff Station.'}
        />
      </PanelShell>
    );
  }

  return (
    <PanelShell
      icon={<Package className="w-6 h-6" />}
      title={profile.label_en}
      subtitle={isSw ? 'Eneo la kazi la biashara' : 'Business workplace module'}
      isSw={isSw}
    >
      <EmptyState isSw={isSw} msg={isSw ? 'Moduli hii inaendelea kujengwa.' : 'This module is being configured for your business type.'} />
    </PanelShell>
  );
};

function EmptyState({ msg, isSw }: { msg: string; isSw: boolean }) {
  return (
    <div className="bg-[#F8F9FA] rounded-xl p-10 text-center border border-dashed border-[#E1DFDD]">
      <Package className="w-10 h-10 mx-auto text-[#C8C6C4] mb-3" />
      <p className="text-sm text-[#605E5C]">{msg}</p>
    </div>
  );
}

function ProductTable({
  products, isSw, showExpiry, showSerial,
}: {
  products: Product[];
  isSw: boolean;
  showExpiry?: boolean;
  showSerial?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-[#E1DFDD] overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-[#F3F2F1] text-[#605E5C]">
            <th className="p-3">{isSw ? 'Bidhaa' : 'Product'}</th>
            <th className="p-3">{isSw ? 'Kategoria' : 'Category'}</th>
            <th className="p-3">{isSw ? 'Akiba' : 'Stock'}</th>
            {showExpiry && <th className="p-3">{isSw ? 'Mwisho' : 'Expiry'}</th>}
            {showSerial && <th className="p-3">IMEI/Serial</th>}
            <th className="p-3">{isSw ? 'Bei' : 'Price'}</th>
          </tr>
        </thead>
        <tbody>
          {products.map(p => (
            <tr key={p.id} className="border-b border-[#F3F2F1] hover:bg-[#FAF9F8]">
              <td className="p-3 font-bold">{p.name}</td>
              <td className="p-3">{p.category}</td>
              <td className="p-3">{p.stock} {p.unit}</td>
              {showExpiry && <td className="p-3">{p.expiryDate ?? '—'}</td>}
              {showSerial && <td className="p-3">{(p as Record<string, unknown>).imei as string ?? '—'}</td>}
              <td className="p-3">{formatTSh(p.price)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function resolveWorkplaceModeFromTab(tab: string): WorkplaceMode | null {
  if (!tab.startsWith('workplace-')) return null;
  return tab.replace('workplace-', '') as WorkplaceMode;
}

export function isRestaurantWorkplaceTab(tab: string): boolean {
  return ['workplace-reception', 'workplace-kitchen', 'workplace-waiter', 'workplace-restaurant-live', 'workplace-tables'].includes(tab);
}
