import React from 'react';
import { CheckCircle2, ShieldCheck, XCircle } from 'lucide-react';
import { Language, VendorApplication } from '@/types/v1';
import { api } from '@/lib/api';

interface Props {
  language: Language;
  applications: VendorApplication[];
  setApplications: React.Dispatch<React.SetStateAction<VendorApplication[]>>;
  onImpersonateVendor?: (app: VendorApplication) => void;
  onApproved?: () => void;
}

export const AdminApprovalsView: React.FC<Props> = ({
  language,
  applications,
  setApplications,
  onApproved,
}) => {
  const isSw = language === 'sw';
  const pending = applications.filter(a => a.status === 'pending');

  const approve = async (id: string) => {
    try {
      await api.approveTenantKyc(id);
    } catch { /* local fallback */ }
    setApplications(prev => prev.map(a => (a.id === id ? { ...a, status: 'approved' as const } : a)));
    onApproved?.();
  };

  const reject = (id: string) => {
    setApplications(prev => prev.map(a => (a.id === id ? { ...a, status: 'rejected' as const } : a)));
  };

  return (
    <div className="space-y-5 pb-10">
      <header>
        <p className="text-[10px] font-black uppercase tracking-widest text-[#D4AF37]">KYC</p>
        <h1 className="text-2xl font-serif font-bold text-[#003322] flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-[#0d9488]" />
          {isSw ? 'Uthibitishaji wa wateja' : 'Client KYC queue'}
        </h1>
      </header>

      <div className="space-y-3">
        {pending.map(app => (
          <div key={app.id} className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-bold text-[#003322]">{app.businessName}</div>
              <div className="text-xs text-slate-500">{app.ownerName} · {app.email}</div>
              <div className="text-[11px] text-slate-500 mt-1">{app.businessType} · TIN {app.tinNumber || '—'}</div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => void approve(app.id)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold cursor-pointer">
                <CheckCircle2 className="w-3.5 h-3.5" /> {isSw ? 'Idhinisha' : 'Approve'}
              </button>
              <button type="button" onClick={() => reject(app.id)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-rose-300 text-rose-700 text-xs font-bold cursor-pointer">
                <XCircle className="w-3.5 h-3.5" /> {isSw ? 'Kataa' : 'Reject'}
              </button>
            </div>
          </div>
        ))}
        {pending.length === 0 && (
          <div className="text-center py-16 text-slate-500 text-sm">
            {isSw ? 'Hakuna maombi yanayosubiri.' : 'No pending applications.'}
          </div>
        )}
      </div>
    </div>
  );
};
