import React from 'react';
import type { BusinessType, Product } from '@/types/v1';
import { getProductMetaEntries, formatProductMetaSummary } from '@/lib/productMetaDisplay';

interface ProductMetaBadgesProps {
  product: Product;
  businessType: BusinessType;
  language?: 'sw' | 'en';
  max?: number;
  variant?: 'badges' | 'line';
  className?: string;
}

export const ProductMetaBadges: React.FC<ProductMetaBadgesProps> = ({
  product,
  businessType,
  language = 'en',
  max = 3,
  variant = 'badges',
  className = '',
}) => {
  const lang = language === 'sw' ? 'sw' : 'en';

  if (variant === 'line') {
    const summary = formatProductMetaSummary(product, businessType, max);
    if (!summary) return null;
    return (
      <p className={`text-[10px] text-[#605E5C] truncate ${className}`} title={summary}>
        {summary}
      </p>
    );
  }

  const entries = getProductMetaEntries(product, businessType, lang).slice(0, max);
  if (!entries.length) return null;

  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {entries.map(e => (
        <span
          key={e.key}
          title={`${e.label}: ${e.value}`}
          className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-[#F0F2FA] text-[#6264A7] text-[9px] font-semibold border border-[#6264A7]/15 max-w-[140px] truncate"
        >
          {e.value}
        </span>
      ))}
    </div>
  );
};
