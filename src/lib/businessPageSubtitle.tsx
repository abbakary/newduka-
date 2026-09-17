import React from 'react';
import type { AuthUser } from '@/types/v1';
import type { TaxComplianceSettings } from '@/lib/taxComplianceSettings';
import { getComplianceStatusLabel } from '@/lib/taxComplianceSettings';

/** Standard centered subtitle: business name • TRA/compliance line (+ optional module detail). */
export function BusinessPageSubtitle({
  currentUser,
  taxSettings,
  isSw,
  detail,
}: {
  currentUser?: AuthUser | null;
  taxSettings: TaxComplianceSettings;
  isSw: boolean;
  detail?: React.ReactNode;
}) {
  const business = currentUser?.businessName || (isSw ? 'Biashara Yako' : 'Your Business');
  return (
    <>
      {business} • {getComplianceStatusLabel(taxSettings, isSw)}
      {detail ? <span className="block mt-1 text-[#605E5C] font-medium">{detail}</span> : null}
    </>
  );
}
