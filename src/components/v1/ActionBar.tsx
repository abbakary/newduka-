import React from 'react';
import { Download, Filter, Plus, Sparkles } from 'lucide-react';
import { Language } from '@/types/v1';

interface ActionBarProps {
  language: Language;
  onAdd?: () => void;
  onEdit?: () => void;
  onView?: () => void;
  onExport?: () => void;
  onAISuggest?: () => void;
  onFilter?: () => void;
  customAddLabel?: string;
  customEditLabel?: string;
  customViewLabel?: string;
  exportLabel?: string;
  totalCount?: number;
  showExport?: boolean;
}

export const ActionBar: React.FC<ActionBarProps> = ({
  language,
  onAdd,
  onEdit,
  onView,
  onExport,
  onAISuggest,
  onFilter,
  customAddLabel,
  customEditLabel,
  customViewLabel,
  exportLabel,
  totalCount,
  showExport = true,
}) => {
  const isSw = language === 'sw';

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3 px-1 border-t border-[#EDEBE9] mt-4">
      <div className="flex flex-wrap items-center gap-2">
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0d9488] hover:bg-[#0f766e] text-white text-xs font-bold cursor-pointer transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            {customAddLabel ?? (isSw ? 'Ongeza' : 'Add')}
          </button>
        )}
        {onEdit && (
          <button type="button" onClick={onEdit} className="px-3 py-2 rounded-xl border border-[#E1DFDD] text-xs font-semibold text-[#323130] hover:bg-[#F3F2F1] cursor-pointer">
            {customEditLabel ?? (isSw ? 'Hariri' : 'Edit')}
          </button>
        )}
        {onView && (
          <button type="button" onClick={onView} className="px-3 py-2 rounded-xl border border-[#E1DFDD] text-xs font-semibold text-[#323130] hover:bg-[#F3F2F1] cursor-pointer">
            {customViewLabel ?? (isSw ? 'Angalia' : 'View')}
          </button>
        )}
        {onFilter && (
          <button type="button" onClick={onFilter} className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-[#E1DFDD] text-xs font-semibold cursor-pointer hover:bg-[#F3F2F1]">
            <Filter className="w-3.5 h-3.5" /> {isSw ? 'Chuja' : 'Filter'}
          </button>
        )}
        {onAISuggest && (
          <button type="button" onClick={onAISuggest} className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold cursor-pointer">
            <Sparkles className="w-3.5 h-3.5" /> AI
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        {totalCount != null && (
          <span className="text-[11px] text-[#605E5C] font-medium">
            {totalCount} {isSw ? 'rekodi' : 'records'}
          </span>
        )}
        {showExport && onExport && (
          <button
            type="button"
            onClick={onExport}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border-2 border-[#0d9488] text-[#0d9488] hover:bg-teal-50 text-xs font-bold cursor-pointer transition-colors"
          >
            <Download className="w-4 h-4" />
            {exportLabel ?? (isSw ? 'Pakua PDF' : 'Export PDF')}
          </button>
        )}
      </div>
    </div>
  );
};
