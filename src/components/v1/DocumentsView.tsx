import React from 'react';
import { Download, FileText, Truck, ShoppingCart } from 'lucide-react';
import { Language } from '@/types/v1';
import { DocumentTemplatesView } from '@/components/v1/DocumentTemplatesView';
import { useDocumentTemplates } from '@/context/DocumentTemplateContext';
import { useTaxCompliance } from '@/context/TaxComplianceContext';
import { DocumentType, documentTypeLabel } from '@/lib/documentTemplates';
import { downloadDocumentPdf, samplePreviewData } from '@/lib/documentRenderer';

interface DocumentsViewProps {
  language: Language;
}

const QUICK_TYPES: { id: DocumentType; icon: React.ReactNode; color: string }[] = [
  { id: 'delivery_note', icon: <Truck className="w-5 h-5" />, color: 'text-teal-600 bg-teal-50 border-teal-200' },
  { id: 'order_note', icon: <ShoppingCart className="w-5 h-5" />, color: 'text-orange-600 bg-orange-50 border-orange-200' },
  { id: 'invoice', icon: <FileText className="w-5 h-5" />, color: 'text-blue-600 bg-blue-50 border-blue-200' },
];

export const DocumentsView: React.FC<DocumentsViewProps> = ({ language }) => {
  const isSw = language === 'sw';
  const { config, getActive } = useDocumentTemplates();
  const { settings: taxSettings } = useTaxCompliance();

  const handleDownload = (type: DocumentType) => {
    const tpl = getActive(type);
    const data = samplePreviewData(type);
    data.showDiscount = taxSettings.showDiscountOnDocuments && taxSettings.discountEnabled;
    downloadDocumentPdf(tpl, data, config.branding, isSw);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-[#E1DFDD] p-6 shadow-xs">
        <h2 className="text-xl font-bold text-[#323130]">
          {isSw ? 'Hati za Biashara' : 'Business Documents'}
        </h2>
        <p className="text-sm text-[#605E5C] mt-1">
          {isSw
            ? 'Pakia nembo yako na simamia violezo vya noti ya uwasilishaji, noti ya agizo, na ankara. Pakua PDF au chagua muundo unaotumika.'
            : 'Upload your logo and manage delivery note, order note, and invoice templates. Download PDF samples or pick your active layout.'}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
          {QUICK_TYPES.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleDownload(item.id)}
              className={`flex items-center justify-between gap-3 p-4 rounded-xl border transition-all hover:shadow-md cursor-pointer ${item.color}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                {item.icon}
                <div className="text-left min-w-0">
                  <div className="text-sm font-bold truncate">{documentTypeLabel(item.id, isSw)}</div>
                  <div className="text-[10px] opacity-80 truncate">
                    {isSw ? 'Pakua PDF ya mfano' : 'Download sample PDF'}
                  </div>
                </div>
              </div>
              <Download className="w-4 h-4 shrink-0 opacity-70" />
            </button>
          ))}
        </div>
      </div>

      <DocumentTemplatesView language={language} />
    </div>
  );
};
