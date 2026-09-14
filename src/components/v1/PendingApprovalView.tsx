import React, { useState } from 'react';
import { 
  Clock, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Building2, 
  MapPin, 
  FileText, 
  Sparkles, 
  ArrowRight, 
  RefreshCw, 
  Edit3, 
  LogOut,
  XCircle,
  Home,
  UserCheck
} from 'lucide-react';
import { Language, VendorApplication, AuthUser, BusinessType } from '@/types/v1';
import confetti from 'canvas-confetti';

interface PendingApprovalViewProps {
  language: Language;
  user: AuthUser;
  application?: VendorApplication;
  onApproveNow: (appId?: string) => void;
  onSwitchToAdmin: () => void;
  onResubmit: (updatedDetails: Partial<VendorApplication>) => void;
  onLogout: () => void;
  onGoToLanding: () => void;
}

export const PendingApprovalView: React.FC<PendingApprovalViewProps> = ({
  language,
  user,
  application,
  onApproveNow,
  onSwitchToAdmin,
  onResubmit,
  onLogout,
  onGoToLanding,
}) => {
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editName, setEditName] = useState<string>(application?.businessName || user.businessName || '');
  const [editTin, setEditTin] = useState<string>(application?.tinNumber || user.tinNumber || '');
  const [editLicense, setEditLicense] = useState<string>(application?.licenseNumber || user.licenseNumber || '');
  const [editLocation, setEditLocation] = useState<string>(application?.location || user.location || '');

  const isSw = language === 'sw';
  const isRejected = user.status === 'rejected' || application?.status === 'rejected';
  const rejectionReason = application?.rejectionReason || user.rejectionReason || 'Incomplete BRELA / TMDA certification details.';

  const handleSaveResubmit = () => {
    onResubmit({
      businessName: editName,
      tinNumber: editTin,
      licenseNumber: editLicense,
      location: editLocation,
      status: 'pending',
    });
    setIsEditing(false);
    confetti({ particleCount: 30, spread: 50, origin: { y: 0.6 } });
  };

  const handleInstantApprove = () => {
    onApproveNow(application?.id || user.businessId);
    confetti({ particleCount: 70, spread: 80, origin: { y: 0.6 } });
  };

  return (
    <div className="min-h-screen bg-[#F3F2F1] text-[#323130] p-4 sm:p-6 lg:p-12 flex flex-col justify-between font-sans">
      {/* Top Header */}
      <div className="max-w-4xl mx-auto w-full flex items-center justify-between pb-6 border-b border-[#E1DFDD]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0078D4] to-[#6264A7] flex items-center justify-center text-white font-bold text-xl shadow-md">
            +
          </div>
          <div>
            <div className="font-extrabold text-lg tracking-tight">Duka+ Account Status</div>
            <p className="text-xs text-[#605E5C]">Tanzania Retail Compliance & Vendor Verification</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onGoToLanding}
            className="px-3 py-1.5 rounded-lg border border-[#C8C6C4] hover:bg-white text-xs font-semibold text-[#323130] flex items-center gap-1.5 cursor-pointer"
          >
            <Home className="w-3.5 h-3.5 text-[#0078D4]" />
            <span>{isSw ? 'Ukurasa Mkuu' : 'Landing Page'}</span>
          </button>
          <button
            onClick={onLogout}
            className="px-3 py-1.5 rounded-lg border border-rose-200 text-[#D13438] hover:bg-rose-50 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{isSw ? 'Ondoka' : 'Sign Out'}</span>
          </button>
        </div>
      </div>

      {/* Main Status Container */}
      <div className="max-w-3xl mx-auto w-full my-8">
        {!isRejected ? (
          /* PENDING APPROVAL CARD */
          <div className="bg-white rounded-2xl border border-[#E1DFDD] shadow-sm overflow-hidden space-y-6 p-6 sm:p-8">
            <div className="flex items-start justify-between flex-wrap gap-4 border-b border-[#EDEBE9] pb-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
                  <Clock className="w-7 h-7 animate-spin" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold uppercase tracking-wider mb-1">
                    <span>⏳ Status: Pending Super Admin Approval</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-[#323130]">
                    {isSw ? 'Ombi Lako Liko Kwenye Uhakiki' : 'Your Shop is Under Admin Verification'}
                  </h2>
                  <p className="text-xs text-[#605E5C] mt-0.5">
                    {isSw 
                      ? 'Asante kwa kusajili duka lako. Msimamizi mkuu (Super Admin) anapitia namba yako ya TIN na leseni.'
                      : 'Thank you for registering. The Super Admin is reviewing your regulatory credentials and TRA TIN.'
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* Live Step Progress Timeline */}
            <div className="bg-[#F8F8F8] rounded-xl p-5 border border-[#EDEBE9] space-y-3">
              <div className="text-xs font-bold text-[#323130] uppercase tracking-wider">
                {isSw ? 'Mwenendo wa Uhakiki (Verification Timeline)' : 'Verification Progress'}
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3 text-xs">
                  <div className="w-6 h-6 rounded-full bg-[#107C10] text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                    ✓
                  </div>
                  <div className="flex-1">
                    <span className="font-bold text-[#323130]">{isSw ? 'Usajili Umetumwa' : 'Application Submitted'}</span>
                    <span className="text-[11px] text-[#605E5C] ml-2">({application?.submittedDate || 'Today'})</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <div className="w-6 h-6 rounded-full bg-[#107C10] text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                    ✓
                  </div>
                  <div className="flex-1">
                    <span className="font-bold text-[#323130]">{isSw ? 'Uhakiki wa Mfumo (TIN & License Format Checked)' : 'Automated TRA & License Syntax Check'}</span>
                    <span className="text-[11px] text-emerald-700 font-semibold ml-2">Passed</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <div className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-[10px] shrink-0 animate-pulse">
                    3
                  </div>
                  <div className="flex-1">
                    <span className="font-bold text-amber-900">{isSw ? 'Idhini ya Mwisho ya Super Admin' : 'Super Admin Manual Review & Activation'}</span>
                    <span className="text-[11px] text-amber-700 font-semibold ml-2">(In Progress)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Submitted Store Details */}
            {!isEditing ? (
              <div className="p-5 bg-white rounded-xl border border-[#EDEBE9] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-[#323130]">
                    {isSw ? 'Taarifa za Duka Zilizowasilishwa' : 'Submitted Business Information'}
                  </div>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="text-xs text-[#0078D4] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{isSw ? 'Rekebisha Taarifa' : 'Edit Details'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-[#F8F8F8] rounded-lg border border-[#EDEBE9]">
                    <div className="text-[10px] text-[#605E5C]">Business Name</div>
                    <div className="font-bold text-[#323130] mt-0.5">{application?.businessName || user.businessName}</div>
                  </div>
                  <div className="p-3 bg-[#F8F8F8] rounded-lg border border-[#EDEBE9]">
                    <div className="text-[10px] text-[#605E5C]">Archetype / Category</div>
                    <div className="font-bold text-[#323130] uppercase mt-0.5">{application?.type || user.businessType || 'pharmacy'}</div>
                  </div>
                  <div className="p-3 bg-[#F8F8F8] rounded-lg border border-[#EDEBE9]">
                    <div className="text-[10px] text-[#605E5C]">TIN Number</div>
                    <div className="font-mono font-bold text-[#0078D4] mt-0.5">{application?.tinNumber || user.tinNumber || '108-992-451'}</div>
                  </div>
                  <div className="p-3 bg-[#F8F8F8] rounded-lg border border-[#EDEBE9]">
                    <div className="text-[10px] text-[#605E5C]">Regulatory License</div>
                    <div className="font-mono font-bold text-[#323130] mt-0.5">{application?.licenseNumber || user.licenseNumber || 'TMDA-2026-44'}</div>
                  </div>
                </div>
              </div>
            ) : (
              /* Inline Editing Form */
              <div className="p-5 bg-blue-50/50 rounded-xl border border-blue-200 space-y-3 text-xs">
                <div className="font-bold text-[#323130]">Edit Business Information</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-[#605E5C] mb-1">Business Name</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-[#C8C6C4] rounded text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#605E5C] mb-1">Location</label>
                    <input
                      type="text"
                      value={editLocation}
                      onChange={(e) => setEditLocation(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-[#C8C6C4] rounded text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#605E5C] mb-1">TIN Number</label>
                    <input
                      type="text"
                      value={editTin}
                      onChange={(e) => setEditTin(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-[#C8C6C4] rounded text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#605E5C] mb-1">License Number</label>
                    <input
                      type="text"
                      value={editLicense}
                      onChange={(e) => setEditLicense(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-[#C8C6C4] rounded text-xs font-mono"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={handleSaveResubmit}
                    className="px-4 py-1.5 bg-[#0078D4] text-white rounded text-xs font-bold cursor-pointer"
                  >
                    Save & Resubmit
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-3 py-1.5 border border-[#C8C6C4] rounded text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Quick Demo Actions */}
            <div className="border-t border-[#EDEBE9] pt-4 flex flex-wrap items-center justify-between gap-3">
              <button
                onClick={onSwitchToAdmin}
                className="px-4 py-2.5 bg-white border border-[#C8C6C4] hover:bg-[#F3F2F1] text-xs font-bold text-[#323130] rounded-xl flex items-center gap-2 cursor-pointer shadow-xs"
              >
                <ShieldCheck className="w-4 h-4 text-[#6264A7]" />
                <span>{isSw ? 'Badili Kuwa Super Admin (Uhakiki)' : 'Switch to Super Admin to Review'}</span>
              </button>

              <button
                onClick={handleInstantApprove}
                className="px-5 py-2.5 bg-[#107C10] hover:bg-[#0e6b0e] text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-200" />
                <span>{isSw ? '⚡ Idhinisha Papo Hapo (Demo Auto-Approve)' : '⚡ 1-Click Instant Auto-Approve'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          /* REJECTED STATE CARD */
          <div className="bg-white rounded-2xl border border-rose-200 shadow-sm overflow-hidden space-y-6 p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-[#D13438] shrink-0">
                <XCircle className="w-7 h-7" />
              </div>
              <div className="flex-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[11px] font-bold uppercase tracking-wider mb-1">
                  <span>❌ Status: Application Rejected</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-[#323130]">
                  {isSw ? 'Ombi Lako Limekataliwa' : 'Action Required on Your Application'}
                </h2>
                <p className="text-xs text-[#605E5C] mt-0.5">
                  {isSw 
                    ? 'Msimamizi Mkuu amekagua ombi lako na kuona mapungufu yafuatayo:'
                    : 'The Super Admin reviewed your documents and requested the following corrections:'
                  }
                </p>
              </div>
            </div>

            {/* Reason Box */}
            <div className="p-4 bg-rose-50/70 rounded-xl border border-rose-200 text-xs text-rose-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-rose-800">
                <AlertTriangle className="w-4 h-4" />
                <span>{isSw ? 'Sababu Iliyotolewa na Msimamizi Mkuu:' : 'Feedback from Super Admin:'}</span>
              </div>
              <p className="text-xs leading-relaxed font-medium pl-5">{rejectionReason}</p>
            </div>

            {/* Resubmission Form */}
            <div className="p-5 bg-[#F8F8F8] rounded-xl border border-[#EDEBE9] space-y-3 text-xs">
              <div className="font-bold text-[#323130]">{isSw ? 'Rekebisha na Utume Tena (Resubmit)' : 'Correct and Resubmit'}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-[#605E5C] mb-1">Business Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-[#C8C6C4] rounded text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#605E5C] mb-1">Location</label>
                  <input
                    type="text"
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-[#C8C6C4] rounded text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#605E5C] mb-1">Updated TIN Number</label>
                  <input
                    type="text"
                    value={editTin}
                    onChange={(e) => setEditTin(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-[#C8C6C4] rounded text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#605E5C] mb-1">Updated License Number (2026 Renewal)</label>
                  <input
                    type="text"
                    value={editLicense}
                    onChange={(e) => setEditLicense(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-[#C8C6C4] rounded text-xs font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  onClick={onSwitchToAdmin}
                  className="text-xs text-[#6264A7] hover:underline font-semibold"
                >
                  {isSw ? 'Tazama kwenye foleni ya Admin' : 'Switch to Admin Queue'}
                </button>

                <button
                  onClick={handleSaveResubmit}
                  className="px-5 py-2 bg-[#6264A7] hover:bg-[#525492] text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{isSw ? 'Tuma Upya kwa Uhakiki' : 'Resubmit for Review'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="max-w-4xl mx-auto w-full text-center text-xs text-[#605E5C] pt-6 border-t border-[#E1DFDD]">
        © 2026 Duka+ Smart Shop Management • United Republic of Tanzania
      </div>
    </div>
  );
};
