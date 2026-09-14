import type { Language } from '@/types/v1';

export type TermsSection = {
  id: string;
  icon: 'shield' | 'receipt' | 'building' | 'scale' | 'alert';
  titleEn: string;
  titleSw: string;
  bodyEn: string[];
  bodySw: string[];
  highlight?: boolean;
};

export const TERMS_LAST_UPDATED = '2026-09-01';
export const TERMS_VERSION = '1.0';

export const TERMS_SECTIONS: TermsSection[] = [
  {
    id: 'intro',
    icon: 'shield',
    titleEn: 'Welcome to DukaMkononi',
    titleSw: 'Karibu DukaMkononi',
    bodyEn: [
      'These Terms of Service ("Terms") govern your use of the DukaMkononi cloud ERP platform operated by the Duka+ provider ("Provider", "we", "us"). By creating an account or using the service, you agree to these Terms.',
      'DukaMkononi helps Tanzanian businesses manage POS, inventory, customers, reports, and TRA-aligned receipt workflows. The platform is a software tool — ultimate compliance with Tanzania Revenue Authority (TRA) rules remains your responsibility as the business owner.',
    ],
    bodySw: [
      'Masharti haya ya Huduma ("Masharti") yanasimamia matumizi yako ya jukwaa la DukaMkononi linaloendeshwa na mtoa huduma wa Duka+ ("Mtoa Huduma", "sisi"). Kwa kuunda akaunti au kutumia huduma, unakubali Masharti haya.',
      'DukaMkononi husaidia biashara za Tanzania kusimamia POS, stoo, wateja, ripoti, na mtiririko wa risiti unaolingana na TRA. Jukwaa ni zana ya programu — kufuata sheria za Mamlaka ya Mapato Tanzania (TRA) bado ni wajibu wako kama mmiliki wa biashara.',
    ],
  },
  {
    id: 'tin',
    icon: 'building',
    titleEn: 'TIN & Business Information',
    titleSw: 'TIN & Taarifa za Biashara',
    highlight: true,
    bodyEn: [
      'You must provide accurate, complete, and truthful business information during registration, including your Tax Identification Number (TIN), business name, location, and licence details where applicable.',
      'You confirm that you are authorised to register and operate the business on this platform and that all submitted credentials belong to a legitimate, registered entity.',
      'The Provider does not independently verify every TIN or licence at registration. We assume you submit genuine information in good faith.',
    ],
    bodySw: [
      'Lazima utoe taarifa sahihi, kamili, na za kweli za biashara wakati wa usajili, ikiwa ni pamoja na Namba ya Utambulisho wa Kodi (TIN), jina la biashara, mahali, na maelezo ya leseni inapohitajika.',
      'Unathibitisha kuwa una mamlaka ya kusajili na kuendesha biashara kwenye jukwaa hili na kwamba nyaraka zote ni za chombo halali kilichosajiliwa.',
      'Mtoa Huduma hahakiki kila TIN au leseni wakati wa usajili. Tunachukulia kuwa unawasilisha taarifa za kweli kwa nia njema.',
    ],
  },
  {
    id: 'tra-efd',
    icon: 'receipt',
    titleEn: 'TRA EFD & Fiscal Receipts',
    titleSw: 'TRA EFD & Risiti za Kodi',
    highlight: true,
    bodyEn: [
      'Features labelled for TRA EFD, VAT (18%), or fiscal receipts are designed to assist with common Tanzania retail workflows. They do not replace your legal obligation to register with TRA, obtain valid Electronic Fiscal Devices (EFD/VFD) where required, and file returns on time.',
      'You are solely responsible for configuring correct tax settings, ensuring your EFD serial numbers and TIN on receipts match TRA records, and remitting VAT and other taxes due to TRA.',
      'The Provider is not a tax agent, auditor, or representative of TRA. Any sample receipts, exports, or templates are for operational convenience only.',
    ],
    bodySw: [
      'Vipengele vilivyoandikwa TRA EFD, VAT (18%), au risiti za kodi vimeundwa kusaidia mtiririko wa kawaida wa rejareja Tanzania. Havibadilishi wajibu wako wa kisheria wa kusajiliwa na TRA, kupata Vifaa vya EFD halali inapohitajika, na kuwasilisha malipo kwa wakati.',
      'Wewe pekee unawajibika kuweka mipangilio sahihi ya kodi, kuhakikisha namba za EFD na TIN kwenye risiti zinalingana na rekodi za TRA, na kulipa VAT na kodi nyingine zinazodaiwa.',
      'Mtoa Huduma si wakala wa kodi, mkaguzi, au mwakilishi wa TRA. Risiti za mfano, mauzo ya nje, au violezo ni kwa urahisi wa uendeshaji tu.',
    ],
  },
  {
    id: 'liability',
    icon: 'alert',
    titleEn: 'Client Responsibility & Provider Limitation',
    titleSw: 'Wajibu wa Mteja & Ukomo wa Mtoa Huduma',
    highlight: true,
    bodyEn: [
      'You accept full responsibility for all business data, tax declarations, TIN usage, licence validity, and regulatory compliance arising from your use of DukaMkononi.',
      'If you provide false, expired, or misleading TIN, licence, or business information, you — not the Provider — bear all legal, financial, and penal consequences, including TRA penalties, business closure orders, or criminal liability under Tanzanian law.',
      'To the fullest extent permitted by law, the Provider shall not be liable for losses caused by inaccurate information you supplied, misuse of EFD features, failure to pay taxes, or third-party enforcement actions against your business.',
      'The Provider may suspend or terminate accounts that appear fraudulent, misrepresent regulatory status, or pose compliance risk to the platform.',
    ],
    bodySw: [
      'Unakubali wajibu kamili kwa data yote ya biashara, makaratasi ya kodi, matumizi ya TIN, uhalali wa leseni, na kufuata sheria kutokana na matumizi yako ya DukaMkononi.',
      'Uktoa TIN, leseni, au taarifa za biashara za uongo, zilizoisha muda, au za kudanganya — wewe, si Mtoa Huduma — unabeba matokeo yote ya kisheria, kifedha, na adhabu, ikiwa ni pamoja na faini za TRA, amri za kufungwa biashara, au hatua za jinai chini ya sheria za Tanzania.',
      'Kwa kiwango cha juu kinachoruhusiwa na sheria, Mtoa Huduma hatawajibika kwa hasara zinazotokana na taarifa zisizo sahihi ulizotoa, matumizi mabaya ya vipengele vya EFD, kushindwa kulipa kodi, au hatua za utekelezaji wa wahusika wa tatu dhidi ya biashara yako.',
      'Mtoa Huduma anaweza kusimamisha au kufuta akaunti zinazoonekana kuwa za ulaghai, zinazopotosha hali ya kufuata sheria, au zinazoweza kuleta hatari kwa jukwaa.',
    ],
  },
  {
    id: 'service',
    icon: 'scale',
    titleEn: 'Service, Billing & Changes',
    titleSw: 'Huduma, Malipo & Mabadiliko',
    bodyEn: [
      'Subscription plans, pricing, and features may change with notice on the platform. Continued use after changes constitutes acceptance.',
      'We strive for high availability but do not guarantee uninterrupted service. Scheduled maintenance will be communicated when possible.',
      'These Terms may be updated. Material changes will be posted on this page with a revised date. Your continued use signifies acceptance.',
    ],
    bodySw: [
      'Mipango ya usajili, bei, na vipengele vinaweza kubadilika kwa taarifa kwenye jukwaa. Kuendelea kutumia baada ya mabadiliko ni kukubali.',
      'Tunajitahidi kuwa na upatikanaji wa juu lakini hatuhakikishi huduma isiyokatika. Matengenezo yaliyopangwa yatajulishwa inapowezekana.',
      'Masharti haya yanaweza kusasishwa. Mabadiliko makubwa yatawekwa kwenye ukurasa huu na tarehe mpya. Kuendelea kutumia ni kukubali.',
    ],
  },
];

export function termsSectionTitle(section: TermsSection, isSw: boolean): string {
  return isSw ? section.titleSw : section.titleEn;
}

export function termsSectionBody(section: TermsSection, isSw: boolean): string[] {
  return isSw ? section.bodySw : section.bodyEn;
}

export function termsAcceptanceLabel(isSw: boolean): string {
  return isSw
    ? 'Nimesoma na nakubali Masharti ya Huduma, ikiwa ni pamoja na wajibu wangu wa TRA EFD na TIN.'
    : 'I have read and agree to the Terms of Service, including my TRA EFD and TIN responsibilities.';
}

export function termsMustAcceptError(isSw: boolean): string {
  return isSw
    ? 'Lazima ukubali Masharti ya Huduma ili kuendelea.'
    : 'You must accept the Terms of Service to continue.';
}
