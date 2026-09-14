import React, { useMemo, useState } from 'react';
import {
  Plus,
  Search,
  Trash2,
  Edit3,
  Users,
  ShieldCheck,
  CheckCircle2,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { resolveStaffPermissions } from '@/lib/apiSync';
import { loadPayrollStore, savePayrollStore } from '@/lib/payrollStore';
import type { AuthUser, Language, StaffMember, StaffPermissions, StaffRole } from '@/types/v1';

interface StaffTeamPanelProps {
  language: Language;
  staffList: StaffMember[];
  setStaffList: React.Dispatch<React.SetStateAction<StaffMember[]>>;
  currentUser?: AuthUser | null;
}

const defaultPermissions = (): StaffPermissions => ({
  canSellPOS: false,
  canGiveCredit: false,
  canModifyInventory: false,
  canViewInventory: false,
  canViewProfitReports: false,
  canManageSuppliers: false,
  canApproveDiscounts: false,
  canOverridePrices: false,
  canVoidReceipts: false,
  canPerformDailyClosing: false,
  canAccessSuperAdmin: false,
});

function rolePreset(role: StaffRole): StaffPermissions {
  const base = defaultPermissions();
  if (role === 'Cashier') {
    return { ...base, canSellPOS: true, canViewInventory: true, canPerformDailyClosing: true };
  }
  if (role === 'Pharmacist') {
    return {
      ...base,
      canSellPOS: true,
      canGiveCredit: true,
      canModifyInventory: true,
      canViewInventory: true,
      canManageSuppliers: true,
      canApproveDiscounts: true,
      canOverridePrices: true,
      canVoidReceipts: true,
    };
  }
  if (role === 'Storekeeper') {
    return { ...base, canModifyInventory: true, canViewInventory: true, canManageSuppliers: true };
  }
  if (role === 'Accountant') {
    return {
      ...base,
      canSellPOS: true,
      canGiveCredit: true,
      canModifyInventory: true,
      canViewInventory: true,
      canViewProfitReports: true,
      canManageSuppliers: true,
      canApproveDiscounts: true,
      canVoidReceipts: true,
      canPerformDailyClosing: true,
    };
  }
  return {
    canSellPOS: true,
    canGiveCredit: true,
    canModifyInventory: true,
    canViewInventory: true,
    canViewProfitReports: true,
    canManageSuppliers: true,
    canApproveDiscounts: true,
    canOverridePrices: true,
    canVoidReceipts: true,
    canPerformDailyClosing: true,
    canAccessSuperAdmin: false,
  };
}

export const StaffTeamPanel: React.FC<StaffTeamPanelProps> = ({
  language,
  staffList,
  setStaffList,
  currentUser,
}) => {
  const isSw = language === 'sw';
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [toast, setToast] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StaffMember | null>(null);
  const [editTarget, setEditTarget] = useState<StaffMember | null>(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '+255 7',
    password: '',
    baseSalary: 450000,
    role: 'Cashier' as StaffRole,
    branch: 'HQ',
    shift: 'Morning',
    permissions: rolePreset('Cashier'),
  });

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3200);
  };

  const filtered = useMemo(() => {
    return staffList.filter(s => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.phone.includes(q);
      const matchesRole = roleFilter === 'all' || s.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [staffList, search, roleFilter]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) return;
    try {
      const created = (await api.createStaff({
        name: form.name,
        email: form.email,
        phone: form.phone,
        role: form.role,
        password: form.password,
      })) as Record<string, unknown>;

      const member: StaffMember = {
        id: created.id as string,
        name: created.name as string,
        role: (created.role as StaffMember['role']) ?? form.role,
        email: created.email as string,
        phone: (created.phone as string) ?? form.phone,
        baseSalary: form.baseSalary,
        active: Boolean(created.active ?? true),
        joinedDate: new Date().toISOString().split('T')[0],
        branch: form.branch,
        shift: form.shift,
        todaySalesCount: 0,
        todayRevenueTzs: 0,
        lastActive: new Date().toISOString().slice(0, 10),
        permissions: form.permissions,
      };
      setStaffList(prev => [member, ...prev]);
      const tenantId = currentUser?.businessId || currentUser?.id || 'local';
      const payroll = loadPayrollStore(tenantId);
      savePayrollStore(tenantId, {
        ...payroll,
        staffConfig: {
          ...payroll.staffConfig,
          [member.id]: {
            ...payroll.staffConfig[member.id],
            baseSalary: form.baseSalary,
          },
        },
      });
      setAddOpen(false);
      setForm(prev => ({ ...prev, name: '', email: '', password: '', baseSalary: 450000 }));
      showToast(isSw ? `${member.name} amesajiliwa.` : `${member.name} added to team.`);
    } catch {
      showToast(isSw ? 'Imeshindikana kuongeza mfanyakazi.' : 'Failed to add staff member.');
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    try {
      await api.updateStaff(editTarget.id, {
        name: editTarget.name,
        phone: editTarget.phone,
        role: editTarget.role,
        active: editTarget.active,
      });
      setStaffList(prev => prev.map(s => (s.id === editTarget.id ? editTarget : s)));
      const tenantId = currentUser?.businessId || currentUser?.id || 'local';
      const payroll = loadPayrollStore(tenantId);
      savePayrollStore(tenantId, {
        ...payroll,
        staffConfig: {
          ...payroll.staffConfig,
          [editTarget.id]: {
            ...payroll.staffConfig[editTarget.id],
            baseSalary: editTarget.baseSalary ?? payroll.staffConfig[editTarget.id]?.baseSalary ?? 450000,
          },
        },
      });
      setEditTarget(null);
      showToast(isSw ? 'Taarifa zimesasishwa.' : 'Staff profile updated.');
    } catch {
      showToast(isSw ? 'Imeshindikana kusasisha.' : 'Update failed.');
    }
  };

  const toggleActive = async (staff: StaffMember) => {
    const next = { ...staff, active: !staff.active };
    try {
      await api.updateStaff(staff.id, { active: next.active });
      setStaffList(prev => prev.map(s => (s.id === staff.id ? next : s)));
      showToast(next.active ? (isSw ? 'Akaunti imewezeshwa.' : 'Staff reactivated.') : (isSw ? 'Akaunti imesimamishwa.' : 'Staff suspended.'));
    } catch {
      setStaffList(prev => prev.map(s => (s.id === staff.id ? next : s)));
    }
  };

  const confirmDelete = async (staff: StaffMember) => {
    try {
      await api.updateStaff(staff.id, { active: false });
    } catch {
      /* local fallback */
    }
    setStaffList(prev => prev.filter(s => s.id !== staff.id));
    setDeleteTarget(null);
    showToast(isSw ? 'Mfanyakazi ameondolewa.' : 'Staff removed from team.');
  };

  return (
    <div className="space-y-4">
      {toast && (
        <div className="fixed top-16 right-6 z-50 bg-[#107C10] text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4" />
          {toast}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-[#323130] flex items-center gap-2">
            <Users className="w-4 h-4 text-[#6264A7]" />
            {isSw ? 'Timu ya Wafanyakazi' : 'Staff Team'}
          </h3>
          <p className="text-[11px] text-[#605E5C] mt-0.5">
            {isSw
              ? 'Ongeza, badilisha nafasi, au ondoa wafanyakazi kutoka hapa.'
              : 'Add, update roles, suspend or remove staff from your business.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="px-3.5 py-2 bg-[#107C10] hover:bg-[#0e6b0e] text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          {isSw ? 'Ongeza Mfanyakazi' : 'Add Staff'}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={isSw ? 'Tafuta mfanyakazi...' : 'Search staff...'}
            className="w-full pl-9 pr-3 py-2 text-xs border border-[#E1DFDD] rounded-lg bg-[#FAFAFA]"
          />
        </div>
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          className="px-3 py-2 text-xs border border-[#E1DFDD] rounded-lg bg-white font-medium"
        >
          <option value="all">{isSw ? 'Nafasi zote' : 'All roles'}</option>
          {(['Cashier', 'Pharmacist', 'Storekeeper', 'Accountant', 'Manager', 'Owner'] as StaffRole[]).map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-[#E1DFDD] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-[#F8F8F8] text-[#605E5C] uppercase text-[10px] font-bold">
              <tr>
                <th className="py-2.5 px-4 text-left">{isSw ? 'Mfanyakazi' : 'Member'}</th>
                <th className="py-2.5 px-3 text-left">{isSw ? 'Nafasi' : 'Role'}</th>
                <th className="py-2.5 px-3 text-left">{isSw ? 'Mamlaka' : 'Access'}</th>
                <th className="py-2.5 px-3 text-left">{isSw ? 'Hali' : 'Status'}</th>
                <th className="py-2.5 px-4 text-right">{isSw ? 'Vitendo' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDEBE9]">
              {filtered.map(staff => {
                const perms = resolveStaffPermissions(staff);
                const isSelf = currentUser?.staffId === staff.id;
                return (
                  <tr key={staff.id} className="hover:bg-[#FAFBFC]">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-[#323130]">{staff.name}</div>
                      <div className="text-[10px] text-[#605E5C]">{staff.email}</div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-md bg-[#F3F2F1] text-[10px] font-bold">{staff.role}</span>
                      <div className="text-[10px] text-[#605E5C] mt-1">{staff.branch}</div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex flex-wrap gap-1 max-w-[140px]">
                        {perms.canSellPOS && <span className="px-1 py-0.5 rounded bg-blue-50 text-blue-700 text-[9px] font-semibold">POS</span>}
                        {perms.canModifyInventory && <span className="px-1 py-0.5 rounded bg-amber-50 text-amber-800 text-[9px] font-semibold">Stock</span>}
                        {perms.canViewProfitReports && <span className="px-1 py-0.5 rounded bg-emerald-50 text-emerald-800 text-[9px] font-semibold">Reports</span>}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <button
                        type="button"
                        onClick={() => toggleActive(staff)}
                        disabled={isSelf}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer disabled:opacity-50 ${
                          staff.active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {staff.active ? (isSw ? 'Hai' : 'Active') : (isSw ? 'Imesimamishwa' : 'Suspended')}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setEditTarget(staff)}
                          className="p-1.5 rounded-lg hover:bg-[#F3F2F1] text-[#605E5C] cursor-pointer"
                          title={isSw ? 'Hariri' : 'Edit'}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(staff)}
                          disabled={isSelf}
                          className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-600 cursor-pointer disabled:opacity-40"
                          title={isSw ? 'Ondoa' : 'Remove'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-[#605E5C]">
                    {isSw ? 'Hakuna wafanyakazi waliopatikana.' : 'No staff members found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {addOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E1DFDD] shadow-xl max-w-lg w-full p-5 text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#6264A7]" />
                {isSw ? 'Sajili Mfanyakazi Mpya' : 'Add New Staff'}
              </h4>
              <button type="button" onClick={() => setAddOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAdd} className="space-y-3">
              <div className="grid grid-cols-3 gap-1.5">
                {(['Cashier', 'Pharmacist', 'Storekeeper', 'Accountant', 'Manager'] as StaffRole[]).map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, role: r, permissions: rolePreset(r) }))}
                    className={`py-2 rounded-lg border text-[10px] font-bold cursor-pointer ${
                      form.role === r ? 'bg-[#6264A7] text-white border-[#6264A7]' : 'bg-[#FAFAFA] border-[#E1DFDD]'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <input
                required
                value={form.name}
                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder={isSw ? 'Jina kamili' : 'Full name'}
                className="w-full px-3 py-2 border border-[#E1DFDD] rounded-lg"
              />
              <input
                required
                type="email"
                value={form.email}
                onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="Email"
                className="w-full px-3 py-2 border border-[#E1DFDD] rounded-lg"
              />
              <input
                required
                type="password"
                minLength={6}
                value={form.password}
                onChange={e => setForm(prev => ({ ...prev, password: e.target.value }))}
                placeholder={isSw ? 'Nenosiri (angalau 6)' : 'Password (min 6)'}
                className="w-full px-3 py-2 border border-[#E1DFDD] rounded-lg"
              />
              <input
                value={form.phone}
                onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="+255..."
                className="w-full px-3 py-2 border border-[#E1DFDD] rounded-lg"
              />
              <div>
                <label className="block text-[10px] font-bold text-[#605E5C] mb-1">
                  {isSw ? 'Mshahara wa mwezi (TSh)' : 'Monthly base salary (TSh)'}
                </label>
                <input
                  required
                  type="number"
                  min="0"
                  value={form.baseSalary}
                  onChange={e => setForm(prev => ({ ...prev, baseSalary: Number(e.target.value) || 0 }))}
                  placeholder="450000"
                  className="w-full px-3 py-2 border border-[#E1DFDD] rounded-lg font-mono"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setAddOpen(false)} className="px-3 py-2 rounded-lg border text-xs font-semibold">
                  {isSw ? 'Ghairi' : 'Cancel'}
                </button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-[#107C10] text-white text-xs font-bold">
                  {isSw ? 'Hifadhi' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E1DFDD] shadow-xl max-w-md w-full p-5 text-xs">
            <h4 className="font-bold text-sm mb-3">{isSw ? 'Hariri Mfanyakazi' : 'Edit Staff'}</h4>
            <form onSubmit={handleSaveEdit} className="space-y-3">
              <input
                required
                value={editTarget.name}
                onChange={e => setEditTarget({ ...editTarget, name: e.target.value })}
                className="w-full px-3 py-2 border border-[#E1DFDD] rounded-lg"
              />
              <select
                value={editTarget.role}
                onChange={e => setEditTarget({ ...editTarget, role: e.target.value as StaffRole })}
                className="w-full px-3 py-2 border border-[#E1DFDD] rounded-lg"
              >
                {(['Cashier', 'Pharmacist', 'Storekeeper', 'Accountant', 'Manager'] as StaffRole[]).map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <input
                value={editTarget.phone}
                onChange={e => setEditTarget({ ...editTarget, phone: e.target.value })}
                className="w-full px-3 py-2 border border-[#E1DFDD] rounded-lg"
              />
              <div>
                <label className="block text-[10px] font-bold text-[#605E5C] mb-1">
                  {isSw ? 'Mshahara wa mwezi (TSh)' : 'Monthly base salary (TSh)'}
                </label>
                <input
                  required
                  type="number"
                  min="0"
                  value={editTarget.baseSalary ?? 450000}
                  onChange={e => setEditTarget({ ...editTarget, baseSalary: Number(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-[#E1DFDD] rounded-lg font-mono"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditTarget(null)} className="px-3 py-2 rounded-lg border text-xs font-semibold">
                  {isSw ? 'Ghairi' : 'Cancel'}
                </button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-[#6264A7] text-white text-xs font-bold">
                  {isSw ? 'Hifadhi' : 'Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E1DFDD] shadow-xl max-w-sm w-full p-5 text-xs space-y-3">
            <p className="text-[#323130]">
              {isSw
                ? `Ondoa ${deleteTarget.name} kutoka timu? Hawataweza kuingia tena.`
                : `Remove ${deleteTarget.name} from the team? They will lose access immediately.`}
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteTarget(null)} className="px-3 py-2 rounded-lg border text-xs font-semibold">
                {isSw ? 'Ghairi' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => confirmDelete(deleteTarget)}
                className="px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-bold cursor-pointer"
              >
                {isSw ? 'Ondoa' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
