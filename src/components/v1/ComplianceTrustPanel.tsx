import React from 'react';
import type { Language } from '@/types/v1';
import { TraEfdPage } from '@/components/v1/tra/TraEfdPage';

interface ComplianceTrustPanelProps {
  language: Language;
  businessName?: string;
  tinNumber?: string;
  /** @deprecated TRA hub is embedded on this same page */
  onOpenTraHub?: () => void;
}

/** Settings → Compliance tab — same unified TRA & EFD page as Operations module. */
export const ComplianceTrustPanel: React.FC<ComplianceTrustPanelProps> = ({
  language,
  businessName,
  tinNumber,
}) => (
  <TraEfdPage
    language={language}
    businessName={businessName}
    tinNumber={tinNumber}
    initialTab="setup"
  />
);
