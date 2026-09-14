import React, { useState } from 'react';
import { 
  CheckCircle2, 
  Key, 
  Lock, 
  Mail, 
  Phone, 
  Plus, 
  ShieldAlert, 
  ShieldCheck, 
  UserCheck, 
  UserPlus, 
  Users, 
  X 
} from 'lucide-react';
import { Language, PlatformOperator } from '@/types/v1';
import confetti from 'canvas-confetti';

interface SuperAdminOperatorsViewProps {
  language: Language;
  operators: PlatformOperator[];
  setOperators: React.Dispatch<React.SetStateAction<PlatformOperator[]>>;
}

export const SuperAdminOperatorsView: React.FC<SuperAdminOperatorsViewProps> = ({
  language,
  operators,
  setOperators,
}) => {
  const isSw = language === 'sw';
  const [isInviteModalOpen, setIsInviteModalOpen] = useState<boolean>(false);
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [role, setRole] = useState<'Super Administrator' | 'Compliance Officer' | 'Billing Specialist' | 'Technical Support Lead'>('Compliance Officer');

  const handleAddOperator = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) return;

    const newOp: PlatformOperator = {
      id: `op-${Date.now()}`,
      name,
      email,
      phone: phone || '+255 754 000 000',
      role,
      lastActive: 'Invited (Pending 2FA)',
      status: 'active',
      permissions: role === 'Super Administrator' ? ['ALL_PERMISSIONS'] : ['KYC_APPROVAL', 'AUDIT_VIEW']
    };

    setOperators(prev => [...prev, newOp]);
    setIsInviteModalOpen(false);
    setName('');
    setEmail('');
    setPhone('');
    confetti({
      particleCount: 40,
      spread: 60,
      origin: { y: 0.6 }
    });
  };

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-[#323130] tracking-tight">
              {isSw ? 'Wafanyakazi wa Mfumo (Platform Staff & RBAC)' : 'System Provider Staff & RBAC'}
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-xs font-bold font-mono">
              SECURITY AUDITED
            </span>
          </div>
          <p className="text-xs text-[#605E5C]">
            {isSw 
              ? 'Dhibiti wafanyakazi wa mtoa huduma (Super Admins, Maafisa wa Ukaguzi wa TMDA/BRELA, Wataalamu wa Malipo, na Msaada wa Kiufundi).'
              : 'Govern SaaS provider administrators, compliance auditors, billing officers, and tier-3 technical support engineers.'
            }
          </p>
        </div>

        <button
          onClick={() => setIsInviteModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md transition-all cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>{isSw ? 'Alika Mfanyakazi Mpya' : 'Invite Staff Member'}</span>
        </button>
      </div>

      {/* Operators Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {operators.map(op => {
          const roleBadge = 
            op.role === 'Super Administrator' ? 'bg-rose-100 text-rose-800 border-rose-200' :
            op.role === 'Compliance Officer' ? 'bg-amber-100 text-amber-800 border-amber-200' :
            op.role === 'Billing Specialist' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
            'bg-blue-100 text-blue-800 border-blue-200';

          return (
            <div key={op.id} className="bg-white rounded-xl p-5 border border-[#E1DFDD] shadow-xs space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 font-bold flex items-center justify-center text-sm border border-indigo-100">
                    {op.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-[#323130]">{op.name}</h4>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${roleBadge}`}>
                      {op.role}
                    </span>
                  </div>
                </div>

                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                  2FA ACTIVE
                </span>
              </div>

              <div className="space-y-1 text-xs text-slate-600 border-t border-[#F3F2F1] pt-3">
                <p className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>{op.email}</span>
                </p>
                <p className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>{op.phone}</span>
                </p>
              </div>

              <div className="pt-2 border-t border-[#F3F2F1] flex items-center justify-between text-[11px] text-slate-500">
                <span>Last active: <strong className="text-slate-700">{op.lastActive}</strong></span>
                <span className="font-mono text-[10px] text-indigo-600 font-bold">{op.permissions.length} PERMISSIONS</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* INVITE MODAL */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-[#323130]">
              {isSw ? 'Alika Mfanyakazi wa Kituo Kikuu cha Mfumo' : 'Invite Platform Operator'}
            </h3>

            <form onSubmit={handleAddOperator} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {isSw ? 'Jina Kamili' : 'Full Name'}
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Advocate Zena Mwinyi"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-300 outline-none focus:bg-white focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {isSw ? 'Barua Pepe' : 'Email Address'}
                </label>
                <input
                  type="email"
                  required
                  placeholder="zena@dukaplus.co.tz"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-300 outline-none focus:bg-white focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {isSw ? 'Namba ya Simu' : 'Phone Number'}
                </label>
                <input
                  type="tel"
                  placeholder="+255 784 000 000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-300 outline-none focus:bg-white focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {isSw ? 'Wajibu (Role & Permissions)' : 'Platform Role'}
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-300 outline-none font-medium"
                >
                  <option value="Compliance Officer">Compliance Officer (TMDA/BRELA KYC)</option>
                  <option value="Billing Specialist">Billing Specialist (M-Pesa & Subscriptions)</option>
                  <option value="Technical Support Lead">Technical Support Lead (Telemetry & Sync)</option>
                  <option value="Super Administrator">Super Administrator (Full Cluster Access)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="px-3 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold cursor-pointer"
                >
                  {isSw ? 'Ghairi' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer"
                >
                  {isSw ? 'Tuma Mwaliko' : 'Send Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
