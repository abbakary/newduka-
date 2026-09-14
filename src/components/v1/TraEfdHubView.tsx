import React from 'react';
import type { Language } from '@/types/v1';
import { TraEfdPage } from '@/components/v1/tra/TraEfdPage';

interface TraEfdHubViewProps {
  language: Language;
  businessName?: string;
  tinNumber?: string;
  /** @deprecated All tax settings are on this page — no external navigation needed */
  onOpenTaxSettings?: () => void;
}

/** Unified TRA & EFD page — setup, receipts, and reports in one place. */
export const TraEfdHubView: React.FC<TraEfdHubViewProps> = ({
  language,
  businessName,
  tinNumber,
}) => (
  <TraEfdPage
    language={language}
    businessName={businessName}
    tinNumber={tinNumber}
  />
);
