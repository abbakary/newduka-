import React, { useState, useEffect, useMemo } from 'react';
import { api } from '@/lib/api';
import { resolveStaffPermissions } from '@/lib/apiSync';
import { computeCashierLeaderboard } from '@/lib/analyticsCompute';
import type { SaleTransaction } from '@/types/v1';
import { 
  Building2, 
  Store, 
  Users, 
  ShieldCheck, 
  Key, 
  Smartphone, 
  CheckCircle2, 
  Plus, 
  Trash2, 
  Edit3, 
  Save, 
  Download, 
  RefreshCw, 
  MapPin, 
  Phone, 
  Mail, 
  FileText, 
  Shield, 
  Lock,
  Eye,
  CreditCard,
  MoreVertical,
  LogIn,
  Sliders,
  History,
  AlertCircle,
  Clock,
  Sparkles,
  ChevronDown,
  Search,
  Filter,
  Check,
  X,
  ExternalLink,
  Palette,
} from 'lucide-react';
import { 
  AuthUser, 
  BusinessType, 
  Language, 
  StaffMember, 
  StaffPermissions, 
  StaffRole, 
  UserRole 
} from '@/types/v1';
import { formatTSh } from '@/utils/translations';
import { ComplianceTrustPanel } from '@/components/v1/ComplianceTrustPanel';
import { DocumentTemplatesView } from '@/components/v1/DocumentTemplatesView';
import { BrandThemePanel } from '@/components/v1/BrandThemePanel';
import { SettingsSectionNav } from '@/components/v1/SettingsSectionNav';
import { canManageStaffRBAC } from '@/lib/rbac';
import { useSaasPlans } from '@/context/SaasPlansContext';
import { derivePaymentStatus, formatPlanPrice, paymentStatusLabel, paymentStatusTone, planBranchLabel, planPeriod } from '@/lib/saasPlans';
import type { SaaSPlanTier } from '@/types/v1';
import confetti from 'canvas-confetti';

interface AccountSettingsViewProps {
  language: Language;
  businessName: string;
  setBusinessName: (name: string) => void;
  businessType: BusinessType;
  setBusinessType: (type: BusinessType) => void;
  userRole: UserRole;
  currentUser?: AuthUser | null;
  location?: string;
  tinNumber?: string;
  licenseNumber?: string;
  staffList?: StaffMember[];
  setStaffList?: React.Dispatch<React.SetStateAction<StaffMember[]>>;
  onSwitchToStaffSite?: (staff: StaffMember) => void;
  onNavigate?: (tab: string) => void;
  currentPlanTier?: SaaSPlanTier;
  subscriptionExpiry?: string;
  sales?: SaleTransaction[];
}

export const AccountSettingsView: React.FC<AccountSettingsViewProps> = ({
  language,
  businessName,
  setBusinessName,
  businessType,
  setBusinessType,
  userRole,
  currentUser,
  location = 'Ilala Boma, Kariakoo, Dar es Salaam',
  tinNumber = '108-992-451',
  licenseNumber = 'TMDA-PHARM-2026-44',
  staffList: externalStaffList,
  setStaffList: externalSetStaffList,
  onSwitchToStaffSite,
  onNavigate,
  currentPlanTier = 'starter',
  subscriptionExpiry = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  sales = [],
}) => {
  const isSw = language === 'sw';
  const { plans } = useSaasPlans();
  const activePlan = plans.find(p => p.tier === currentPlanTier) ?? plans[0];
  const paymentStatus = derivePaymentStatus(subscriptionExpiry, 'active');
  const canManageTeam = canManageStaffRBAC(currentUser);
  const [activeTab, setActiveTab] = useState<'profile' | 'branding' | 'team' | 'branches' | 'compliance' | 'documents' | 'billing'>('profile');

  const settingsNavItems = [
    { id: 'profile', labelEn: 'Profile', labelSw: 'Wasifu', icon: <Store className="w-3.5 h-3.5" /> },
    { id: 'branding', labelEn: 'Logo & Colors', labelSw: 'Nembo & Rangi', icon: <Palette className="w-3.5 h-3.5" /> },
    { id: 'team', labelEn: 'People & HR', labelSw: 'Watu & HR', icon: <Users className="w-3.5 h-3.5" />, managerOnly: true },
    { id: 'compliance', labelEn: 'TRA & Tax', labelSw: 'TRA & Kodi', icon: <ShieldCheck className="w-3.5 h-3.5" /> },
    { id: 'documents', labelEn: 'Documents', labelSw: 'Hati', icon: <FileText className="w-3.5 h-3.5" /> },
    { id: 'billing', labelEn: 'Plan', labelSw: 'Malipo', icon: <CreditCard className="w-3.5 h-3.5" /> },
    { id: 'branches', labelEn: 'Branches', labelSw: 'Matawi', icon: <Building2 className="w-3.5 h-3.5" />, managerOnly: true },
  ].filter(tab => !tab.managerOnly || canManageTeam);

  // Internal or external staff list
  const [internalStaffList, setInternalStaffList] = useState<StaffMember[]>([]);
  const staffList = externalStaffList || internalStaffList;
  const setStaffList = externalSetStaffList || setInternalStaffList;

  const cashierBoard = useMemo(() => computeCashierLeaderboard(sales), [sales]);
  const topCashier = cashierBoard[0];

  const staffWithTodaySales = useMemo(() => {
    return staffList.map(s => {
      const row = cashierBoard.find(
        r => r.cashierName.toLowerCase() === s.name.toLowerCase()
          || r.cashierName.toLowerCase().includes(s.name.toLowerCase())
          || s.name.toLowerCase().includes(r.cashierName.toLowerCase()),
      );
      return {
        ...s,
        todaySalesCount: row?.receipts ?? 0,
        todayRevenueTzs: row?.revenue ?? 0,
      };
    });
  }, [staffList, cashierBoard]);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Action Dropdown State
  const [openDropdownStaffId, setOpenDropdownStaffId] = useState<string | null>(null);
  const [isBulkMenuOpen, setIsBulkMenuOpen] = useState<boolean>(false);

  // Modals
  const [isAddStaffModalOpen, setIsAddStaffModalOpen] = useState<boolean>(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [permissionsStaff, setPermissionsStaff] = useState<StaffMember | null>(null);
  const [pinResetStaff, setPinResetStaff] = useState<StaffMember | null>(null);
  const [auditLogStaff, setAuditLogStaff] = useState<StaffMember | null>(null);
  const [deleteConfirmStaff, setDeleteConfirmStaff] = useState<StaffMember | null>(null);

  // Feedback Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
    confetti({ particleCount: 30, spread: 50, origin: { y: 0.7 } });
  };

  // Form states for business profile
  const [bName, setBName] = useState<string>(businessName);
  const [bType, setBType] = useState<BusinessType>(businessType);
  const [bLocation, setBLocation] = useState<string>(location);
  const [bTin, setBTin] = useState<string>(tinNumber);
  const [bLicense, setBLicense] = useState<string>(licenseNumber);
  const [bPhone, setBPhone] = useState<string>('+255 754 000 111');
  const [bEmail, setBEmail] = useState<string>('info@afyabora.co.tz');

  // New staff form state
  const [newStaffForm, setNewStaffForm] = useState({
    name: '',
    role: 'Cashier' as StaffRole,
    email: '',
    phone: '+255 7',
    password: '',
    branch: '',
    shift: 'Morning',
    pinCode: '',
    permissions: {
      canSellPOS: true,
      canGiveCredit: false,
      canModifyInventory: false,
      canViewInventory: true,
      canViewProfitReports: false,
      canManageSuppliers: false,
      canApproveDiscounts: false,
      canOverridePrices: false,
      canVoidReceipts: false,
      canPerformDailyClosing: true,
      canAccessSuperAdmin: false,
    } as StaffPermissions
  });

  // Preset permissions by role
  const applyRolePresetToForm = (role: StaffRole) => {
    let perms: StaffPermissions = {
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
    };

    if (role === 'Cashier') {
      perms = { ...perms, canSellPOS: true, canViewInventory: true, canPerformDailyClosing: true };
    } else if (role === 'Pharmacist') {
      perms = { ...perms, canSellPOS: true, canGiveCredit: true, canModifyInventory: true, canViewInventory: true, canManageSuppliers: true, canApproveDiscounts: true, canOverridePrices: true, canVoidReceipts: true };
    } else if (role === 'Storekeeper') {
      perms = { ...perms, canModifyInventory: true, canViewInventory: true, canManageSuppliers: true };
    } else if (role === 'Accountant') {
      perms = { ...perms, canSellPOS: true, canGiveCredit: true, canModifyInventory: true, canViewInventory: true, canViewProfitReports: true, canManageSuppliers: true, canApproveDiscounts: true, canVoidReceipts: true, canPerformDailyClosing: true };
    } else if (role === 'Manager' || role === 'Owner') {
      perms = {
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

    setNewStaffForm(prev => ({
      ...prev,
      role,
      permissions: perms
    }));
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setBusinessName(bName);
    setBusinessType(bType);
    showToast(isSw ? 'Wasifu wa duka umehifadhiwa kikamilifu!' : 'Store profile updated successfully!');
  };

  const handleAddNewStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffForm.name || !newStaffForm.email || !newStaffForm.password) return;

    try {
      const created = await api.createStaff({
        name: newStaffForm.name,
        email: newStaffForm.email,
        phone: newStaffForm.phone,
        role: newStaffForm.role,
        password: newStaffForm.password,
      }) as Record<string, unknown>;

      const newStaff: StaffMember = {
        id: created.id as string,
        name: created.name as string,
        role: (created.role as StaffMember['role']) ?? newStaffForm.role,
        email: created.email as string,
        phone: (created.phone as string) ?? newStaffForm.phone,
        active: Boolean(created.active ?? true),
        joinedDate: new Date().toISOString().split('T')[0],
        branch: newStaffForm.branch || 'HQ',
        shift: newStaffForm.shift,
        todaySalesCount: 0,
        todayRevenueTzs: 0,
        lastActive: new Date().toISOString().slice(0, 10),
        permissions: newStaffForm.permissions,
      };

      setStaffList(prev => [newStaff, ...prev]);
      setIsAddStaffModalOpen(false);
      setNewStaffForm(prev => ({ ...prev, name: '', email: '', phone: '+255 7', password: '' }));
      showToast(isSw ? `Mfanyakazi ${newStaff.name} amesajiliwa kikamilifu!` : `Staff member ${newStaff.name} added successfully!`);
    } catch {
      showToast(isSw ? 'Imeshindikana kuongeza mfanyakazi.' : 'Failed to add staff member.');
    }
  };

  const handleUpdateStaff = (updated: StaffMember) => {
    setStaffList(prev => prev.map(s => s.id === updated.id ? updated : s));
    setEditingStaff(null);
    showToast(isSw ? `Taarifa za ${updated.name} zimesasishwa!` : `Updated ${updated.name} successfully!`);
  };

  const handleSavePermissions = (staffId: string, permissions: StaffPermissions) => {
    setStaffList(prev => prev.map(s => s.id === staffId ? { ...s, permissions } : s));
    setPermissionsStaff(null);
    showToast(isSw ? 'Mamlaka ya RBAC yamesasishwa kikamilifu!' : 'RBAC Permissions matrix updated!');
  };

  const handleToggleStaffStatus = (staff: StaffMember) => {
    const nextStatus = !staff.active;
    setStaffList(prev => prev.map(s => s.id === staff.id ? { ...s, active: nextStatus } : s));
    setOpenDropdownStaffId(null);
    showToast(
      nextStatus 
        ? (isSw ? `Akaunti ya ${staff.name} imewezeshwa!` : `${staff.name} is now ACTIVE!`)
        : (isSw ? `Akaunti ya ${staff.name} imezimwa kwa muda!` : `${staff.name} account SUSPENDED!`)
    );
  };

  const handleDeleteStaffConfirm = (staffId: string) => {
    setStaffList(prev => prev.filter(s => s.id !== staffId));
    setDeleteConfirmStaff(null);
    setOpenDropdownStaffId(null);
    showToast(isSw ? 'Mfanyakazi ameondolewa kwenye mfumo.' : 'Staff member removed from system.');
  };

  const handleInstantSwitchStaff = (staff: StaffMember) => {
    if (!canManageTeam) return;
    setOpenDropdownStaffId(null);
    if (onSwitchToStaffSite) {
      onSwitchToStaffSite(staff);
      return;
    }
    onNavigate?.('staff');
  };

  useEffect(() => {
    if (!canManageTeam && (activeTab === 'team' || activeTab === 'branches')) {
      setActiveTab('profile');
    }
  }, [canManageTeam, activeTab]);

  // Filtered staff list
  const filteredStaff = staffWithTodaySales.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          s.phone.includes(searchQuery);
    const matchesBranch = branchFilter === 'all' || s.branch === branchFilter;
    const matchesRole = roleFilter === 'all' || s.role === roleFilter;
    return matchesSearch && matchesBranch && matchesRole;
  });

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 right-6 z-50 bg-[#107C10] text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-xs font-bold animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-white" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header & Overview */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#323130] tracking-tight">
            {isSw ? 'Usimamizi wa Akaunti & Wahudumu (Staff RBAC)' : 'Account Settings & Staff RBAC'}
          </h2>
          <p className="text-xs text-[#605E5C]">
            {isSw 
              ? 'Dhibiti wasifu wa duka, mamlaka ya wafanyakazi kwa kila kituo (Keshia, Mfamasia, Mhasibu, Stoo), na vituo vya matawi.'
              : 'Granular Role-Based Access Control, branch workstations, and operational permission management.'
            }
          </p>
        </div>

        {/* Global Quick Action Toolbars */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => canManageTeam && setIsAddStaffModalOpen(true)}
            disabled={!canManageTeam}
            className="px-4 py-2 bg-[#107C10] hover:bg-[#0e6b0e] text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-2 cursor-pointer transition-all hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            <span>{isSw ? '+ Sajili Mfanyakazi Mpya' : '+ Add New Staff'}</span>
          </button>
        </div>
      </div>

      {/* Settings layout: compact section nav + content */}
      <div className="flex flex-col lg:flex-row gap-4 items-start">
        <SettingsSectionNav
          items={settingsNavItems}
          activeId={activeTab === 'team' ? 'profile' : activeTab}
          onChange={id => {
            if (id === 'team') {
              onNavigate?.('staff');
              return;
            }
            setActiveTab(id as typeof activeTab);
          }}
          isSw={isSw}
        />
        <div className="flex-1 min-w-0 w-full">
      {activeTab === 'team' && canManageTeam && (
        <div className="space-y-6">
          {/* 4 Staff Summary & Performance KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-[#E1DFDD] shadow-xs">
              <div className="text-xs text-[#605E5C] font-semibold flex items-center justify-between">
                <span>{isSw ? 'Wafanyakazi Walio Kazini' : 'Staff Active on Duty'}</span>
                <span className="text-base">👥</span>
              </div>
              <div className="text-2xl font-extrabold text-[#323130] mt-1">
                {staffList.filter(s => s.active).length} / {staffList.length}
              </div>
              <div className="text-[11px] text-emerald-700 font-semibold mt-1">
                ✓ 100% active shift roster
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-[#E1DFDD] shadow-xs">
              <div className="text-xs text-[#605E5C] font-semibold flex items-center justify-between">
                <span>{isSw ? 'Mauzo ya Keshia Bora Leo' : "Today's Top Cashier"}</span>
                <span className="text-base">🏆</span>
              </div>
              <div className="text-base font-bold text-[#0078D4] mt-1 truncate">
                {topCashier?.cashierName || (isSw ? 'Hakuna bado' : 'None yet')}
              </div>
              <div className="text-[11px] text-emerald-700 font-semibold mt-1 font-mono">
                {topCashier
                  ? `${formatTSh(topCashier.revenue)} (${topCashier.receipts} ${isSw ? 'risiti' : 'receipts'})`
                  : (isSw ? 'Hakuna mauzo leo' : 'No sales today')}
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-[#E1DFDD] shadow-xs">
              <div className="text-xs text-[#605E5C] font-semibold flex items-center justify-between">
                <span>{isSw ? 'Mamlaka ya Kutoa Dawa (Rx)' : 'Clinical Prescribers'}</span>
                <span className="text-base">💊</span>
              </div>
              <div className="text-2xl font-extrabold text-teal-800 mt-1">
                {staffList.filter(s => s.role === 'Pharmacist').length} Licensed
              </div>
              <div className="text-[11px] text-[#605E5C] mt-1">
                TMDA compliance certified
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-[#E1DFDD] shadow-xs">
              <div className="text-xs text-[#605E5C] font-semibold flex items-center justify-between">
                <span>{isSw ? 'Mashine ya TRA EFD' : 'TRA Operator Sync'}</span>
                <span className="text-base">🧾</span>
              </div>
              <div className="text-2xl font-extrabold text-emerald-700 mt-1">
                EFD-8819 OK
              </div>
              <div className="text-[11px] text-emerald-700 font-semibold mt-1">
                All 5 operators linked
              </div>
            </div>
          </div>

          {/* Filter & Advanced Action Bar */}
          <div className="bg-white rounded-xl border border-[#E1DFDD] p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              {/* Search */}
              <div className="relative min-w-[220px] flex-1 max-w-sm">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isSw ? 'Tafuta kwa jina, simu, au barua pepe...' : 'Search staff by name, phone, or email...'}
                  className="w-full pl-9 pr-3 py-1.5 bg-[#F8F8F8] border border-[#C8C6C4] rounded-lg text-xs focus:bg-white text-[#323130]"
                />
              </div>

              {/* Branch Filter */}
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="px-3 py-1.5 bg-[#F8F8F8] border border-[#C8C6C4] rounded-lg text-xs font-semibold text-[#323130]"
              >
                <option value="all">{isSw ? '🏢 Matawi Yote (All Branches)' : '🏢 All Branches'}</option>
                <option value="Main Kariakoo (Flagship)">Main Kariakoo (Flagship)</option>
                <option value="Mlimani City Mall Branch">Mlimani City Mall Branch</option>
              </select>

              {/* Role Filter */}
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-1.5 bg-[#F8F8F8] border border-[#C8C6C4] rounded-lg text-xs font-semibold text-[#323130]"
              >
                <option value="all">{isSw ? '🎭 Nafasi Zote (All Roles)' : '🎭 All Roles'}</option>
                <option value="Cashier">Cashier</option>
                <option value="Pharmacist">Pharmacist</option>
                <option value="Accountant">Accountant</option>
                <option value="Storekeeper">Storekeeper</option>
                <option value="Manager">Manager</option>
                <option value="Owner">Owner</option>
              </select>
            </div>

            {/* Bulk Actions Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsBulkMenuOpen(!isBulkMenuOpen)}
                className="px-3 py-1.5 bg-[#F3F2F1] hover:bg-[#EDEBE9] text-[#323130] rounded-lg text-xs font-bold border border-[#C8C6C4] flex items-center gap-1.5 cursor-pointer"
              >
                <Sliders className="w-3.5 h-3.5 text-[#605E5C]" />
                <span>{isSw ? 'Vitendo vya Pamoja (Bulk Actions)' : 'Bulk Operations'}</span>
                <ChevronDown className="w-3 h-3 text-[#605E5C]" />
              </button>

              {isBulkMenuOpen && (
                <div className="absolute right-0 mt-1 w-64 bg-white rounded-xl shadow-xl border border-[#E1DFDD] p-1.5 z-40 text-xs animate-fade-in">
                  <button
                    onClick={() => {
                      setIsBulkMenuOpen(false);
                      showToast(isSw ? 'Orodha ya Wafanyakazi imepakuliwa kwa PDF!' : 'Staff roster exported as PDF!');
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-[#F3F2F1] rounded-lg flex items-center gap-2 text-[#323130]"
                  >
                    <Download className="w-4 h-4 text-[#0078D4]" />
                    <span>{isSw ? 'Pakua Orodha (Export Roster PDF)' : 'Export Staff Roster (PDF)'}</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsBulkMenuOpen(false);
                      showToast(isSw ? 'PIN za msimbo zimetumwa kwa SMS kwa wafanyakazi wote!' : 'PIN reset OTPs sent via SMS!');
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-[#F3F2F1] rounded-lg flex items-center gap-2 text-[#323130]"
                  >
                    <Smartphone className="w-4 h-4 text-emerald-600" />
                    <span>{isSw ? 'Tuma SMS ya Ratiba ya Zamu' : 'Broadcast Shift Roster SMS'}</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsBulkMenuOpen(false);
                      showToast(isSw ? 'Masharti ya usalama wa TRA yamesasishwa!' : 'TRA Security policies refreshed!');
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-[#F3F2F1] rounded-lg flex items-center gap-2 text-[#323130]"
                  >
                    <ShieldCheck className="w-4 h-4 text-purple-600" />
                    <span>{isSw ? 'Sasisha Mamlaka ya TRA EFD' : 'Sync TRA EFD User Tokens'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Comprehensive Staff Table with Advanced Dropdown Action Buttons */}
          <div className="bg-white rounded-xl border border-[#E1DFDD] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#F8F8F8] text-[#605E5C] uppercase text-[10px] font-bold border-b border-[#EDEBE9]">
                  <tr>
                    <th className="py-3 px-4">Staff Member & Workstation</th>
                    <th className="py-3 px-3">Role & Branch</th>
                    <th className="py-3 px-3">Shift & Performance</th>
                    <th className="py-3 px-3">RBAC Privileges</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4 text-right">Advanced Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EDEBE9]">
                  {filteredStaff.map((staff) => {
                    const isDropdownOpen = openDropdownStaffId === staff.id;
                    const permissions = resolveStaffPermissions(staff);

                    return (
                      <tr key={staff.id} className="hover:bg-[#F8F9FC] transition-colors">
                        {/* Name & Contact */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl ${staff.avatarColor || 'bg-indigo-600'} text-white flex items-center justify-center font-bold text-sm shadow-xs`}>
                              {staff.name.charAt(0)}
                            </div>
                            <div>
                              <div className="font-bold text-sm text-[#323130] flex items-center gap-2">
                                <span>{staff.name}</span>
                                {currentUser?.staffId === staff.id && (
                                  <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[9px] font-extrabold">
                                    YOU (ACTIVE)
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-[#605E5C] flex items-center gap-2 mt-0.5">
                                <span>{staff.phone}</span>
                                <span>•</span>
                                <span className="text-slate-400 truncate max-w-[150px]">{staff.email}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Role & Branch */}
                        <td className="py-3.5 px-3">
                          <div className="font-bold text-[#323130] flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded-md bg-[#F3F2F1] text-[#323130] font-bold border border-[#EDEBE9]">
                              {staff.role}
                            </span>
                          </div>
                          <div className="text-[10px] text-[#605E5C] mt-1 flex items-center gap-1">
                            <span>📍</span>
                            <span>{staff.branch}</span>
                          </div>
                        </td>

                        {/* Shift & Performance */}
                        <td className="py-3.5 px-3">
                          <div className="text-[#323130] font-medium flex items-center gap-1">
                            <Clock className="w-3 h-3 text-[#605E5C]" />
                            <span>{staff.shift}</span>
                          </div>
                          <div className="text-[10px] text-emerald-700 font-semibold mt-1">
                            {staff.todaySalesCount > 0 
                              ? `💰 ${formatTSh(staff.todayRevenueTzs)} (${staff.todaySalesCount} sales)`
                              : `🕒 ${staff.lastActive}`
                            }
                          </div>
                        </td>

                        {/* Permissions Badges */}
                        <td className="py-3.5 px-3">
                          <div className="flex flex-wrap gap-1 max-w-[180px]">
                            {permissions.canSellPOS && (
                              <span className="px-1.5 py-0.2 bg-blue-50 text-blue-800 border border-blue-200 rounded text-[9px] font-semibold">POS</span>
                            )}
                            {permissions.canGiveCredit && (
                              <span className="px-1.5 py-0.2 bg-purple-50 text-purple-800 border border-purple-200 rounded text-[9px] font-semibold">Credit</span>
                            )}
                            {permissions.canModifyInventory && (
                              <span className="px-1.5 py-0.2 bg-amber-50 text-amber-800 border border-amber-200 rounded text-[9px] font-semibold">Stock</span>
                            )}
                            {permissions.canViewProfitReports && (
                              <span className="px-1.5 py-0.2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded text-[9px] font-semibold">Reports</span>
                            )}
                            {permissions.canManageSuppliers && (
                              <span className="px-1.5 py-0.2 bg-indigo-50 text-indigo-800 border border-indigo-200 rounded text-[9px] font-semibold">Suppliers</span>
                            )}
                          </div>
                        </td>

                        {/* Status Toggle */}
                        <td className="py-3.5 px-3">
                          <button
                            onClick={() => handleToggleStaffStatus(staff)}
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer transition-colors ${
                              staff.active 
                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300' 
                                : 'bg-rose-100 text-rose-800 hover:bg-rose-200 border border-rose-300'
                            }`}
                          >
                            {staff.active ? '● ACTIVE' : '○ SUSPENDED'}
                          </button>
                        </td>

                        {/* Advanced Action Dropdown */}
                        <td className="py-3.5 px-4 text-right relative">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Quick Switch Button */}
                            {canManageTeam && (
                            <button
                              onClick={() => handleInstantSwitchStaff(staff)}
                              className="px-2.5 py-1.5 bg-[#0078D4]/10 hover:bg-[#0078D4] text-[#0078D4] hover:text-white rounded-lg text-xs font-bold border border-[#0078D4]/30 transition-all flex items-center gap-1 cursor-pointer"
                              title={isSw ? 'Ingia kama Mfanyakazi huyu kwenye Kituo chake' : 'Instant Login to Workstation'}
                            >
                              <LogIn className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">{isSw ? 'Ingia Kituoni' : 'Login'}</span>
                            </button>
                            )}

                            {/* Dropdown Toggle Button */}
                            <button
                              onClick={() => setOpenDropdownStaffId(isDropdownOpen ? null : staff.id)}
                              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                isDropdownOpen 
                                  ? 'bg-[#6264A7] text-white border-[#6264A7]' 
                                  : 'bg-white text-[#605E5C] hover:text-[#323130] border-[#C8C6C4] hover:bg-[#F3F2F1]'
                              }`}
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </div>

                          {/* FLOATING ACTION DROPDOWN MENU */}
                          {isDropdownOpen && (
                            <>
                              <div 
                                className="fixed inset-0 z-30" 
                                onClick={() => setOpenDropdownStaffId(null)}
                              />
                              <div className="absolute right-4 mt-2 w-60 bg-white rounded-2xl shadow-2xl border border-[#E1DFDD] p-1.5 z-40 text-xs text-left animate-fade-in font-sans divide-y divide-[#EDEBE9]">
                                {/* SECTION 1: ROLE SITE & SWITCH */}
                                <div className="p-1 space-y-1">
                                  <div className="px-2.5 py-1 text-[10px] font-bold text-[#605E5C] uppercase tracking-wider">
                                    {isSw ? 'Kituo cha Kazi (Workstation)' : 'Workstation Access'}
                                  </div>
                                  <button
                                    onClick={() => handleInstantSwitchStaff(staff)}
                                    className="w-full text-left px-2.5 py-2 hover:bg-blue-50 text-blue-900 rounded-lg font-bold flex items-center gap-2 cursor-pointer transition-colors"
                                  >
                                    <LogIn className="w-4 h-4 text-[#0078D4]" />
                                    <span>{isSw ? 'Ingia Kwenye Kituo Chake' : 'Open Tailored Site (Login)'}</span>
                                  </button>
                                </div>

                                {/* SECTION 2: MANAGEMENT PROCESSES */}
                                <div className="p-1 space-y-1">
                                  <div className="px-2.5 py-1 text-[10px] font-bold text-[#605E5C] uppercase tracking-wider">
                                    {isSw ? 'Mchakato wa Usimamizi' : 'Staff Processes'}
                                  </div>

                                  <button
                                    onClick={() => {
                                      setEditingStaff(staff);
                                      setOpenDropdownStaffId(null);
                                    }}
                                    className="w-full text-left px-2.5 py-1.5 hover:bg-[#F3F2F1] rounded-lg text-[#323130] flex items-center gap-2 cursor-pointer"
                                  >
                                    <Edit3 className="w-3.5 h-3.5 text-[#605E5C]" />
                                    <span>{isSw ? 'Hariri Wasifu & Mawasiliano' : 'Edit Profile & Details'}</span>
                                  </button>

                                  <button
                                    onClick={() => {
                                      setPermissionsStaff({ ...staff, permissions: resolveStaffPermissions(staff) });
                                      setOpenDropdownStaffId(null);
                                    }}
                                    className="w-full text-left px-2.5 py-1.5 hover:bg-[#F3F2F1] rounded-lg text-[#323130] flex items-center gap-2 cursor-pointer"
                                  >
                                    <Shield className="w-3.5 h-3.5 text-purple-600" />
                                    <span>{isSw ? 'Weka Mamlaka ya RBAC' : 'RBAC Permissions Matrix'}</span>
                                  </button>

                                  <button
                                    onClick={() => {
                                      setPinResetStaff(staff);
                                      setOpenDropdownStaffId(null);
                                    }}
                                    className="w-full text-left px-2.5 py-1.5 hover:bg-[#F3F2F1] rounded-lg text-[#323130] flex items-center gap-2 cursor-pointer"
                                  >
                                    <Key className="w-3.5 h-3.5 text-amber-600" />
                                    <span>{isSw ? 'Badilisha Nenosiri / PIN' : 'Reset POS PIN & OTP'}</span>
                                  </button>

                                  <button
                                    onClick={() => {
                                      setAuditLogStaff(staff);
                                      setOpenDropdownStaffId(null);
                                    }}
                                    className="w-full text-left px-2.5 py-1.5 hover:bg-[#F3F2F1] rounded-lg text-[#323130] flex items-center gap-2 cursor-pointer"
                                  >
                                    <History className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>{isSw ? 'Kumbukumbu ya Kazi (Audit)' : 'Activity & Audit Log'}</span>
                                  </button>
                                </div>

                                {/* SECTION 3: STATUS & DELETION */}
                                <div className="p-1 space-y-1">
                                  <button
                                    onClick={() => handleToggleStaffStatus(staff)}
                                    className="w-full text-left px-2.5 py-1.5 hover:bg-[#F3F2F1] rounded-lg text-[#323130] flex items-center gap-2 cursor-pointer font-medium"
                                  >
                                    <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
                                    <span>{staff.active ? (isSw ? 'Zima Akaunti Hii' : 'Suspend Account') : (isSw ? 'Wezesha Akaunti Hii' : 'Activate Account')}</span>
                                  </button>

                                  <button
                                    onClick={() => {
                                      setDeleteConfirmStaff(staff);
                                      setOpenDropdownStaffId(null);
                                    }}
                                    className="w-full text-left px-2.5 py-1.5 hover:bg-rose-50 text-rose-700 rounded-lg flex items-center gap-2 cursor-pointer font-semibold"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                    <span>{isSw ? 'Ondoa Mfanyakazi' : 'Remove Staff Member'}</span>
                                  </button>
                                </div>
                              </div>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: STORE PROFILE */}
      {activeTab === 'profile' && (
        <form onSubmit={handleSaveProfile} className="bg-white rounded-xl border border-[#E1DFDD] p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-[#EDEBE9] pb-4">
            <div>
              <h3 className="text-base font-bold text-[#323130]">{isSw ? 'Wasifu wa Duka & Taarifa Rasmi' : 'Store Identity & Registration'}</h3>
              <p className="text-xs text-[#605E5C]">{isSw ? 'Taarifa hizi zinatokea kwenye risiti za TRA EFD na ankara' : 'Shown on receipts and official invoices.'}</p>
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-[#0078D4] hover:bg-[#006cbd] text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{isSw ? 'Hifadhi Mabadiliko' : 'Save Changes'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-xs font-semibold text-[#323130] mb-1">Business Registered Name</label>
              <input
                type="text"
                value={bName}
                onChange={(e) => setBName(e.target.value)}
                className="w-full px-3 py-2 bg-[#F8F8F8] border border-[#C8C6C4] rounded-lg text-xs text-[#323130] font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#323130] mb-1">Business Category / Type</label>
              <select
                value={bType}
                onChange={(e) => setBType(e.target.value as BusinessType)}
                className="w-full px-3 py-2 bg-[#F8F8F8] border border-[#C8C6C4] rounded-lg text-xs font-semibold text-[#323130]"
              >
                <option value="pharmacy">💊 Pharmacy (Duka la Dawa)</option>
                <option value="retail">🛒 Retail Shop & Supermarket</option>
                <option value="hardware">🔨 Hardware & Building Supplies</option>
                <option value="restaurant">🍽️ Restaurant & Cafe</option>
                <option value="service">💼 Service Provider & Clinic</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#323130] mb-1">TRA TIN Number</label>
              <input
                type="text"
                value={bTin}
                onChange={(e) => setBTin(e.target.value)}
                className="w-full px-3 py-2 bg-[#F8F8F8] border border-[#C8C6C4] rounded-lg text-xs font-mono font-bold text-[#0078D4]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#323130] mb-1">Regulatory License (TMDA / BRELA)</label>
              <input
                type="text"
                value={bLicense}
                onChange={(e) => setBLicense(e.target.value)}
                className="w-full px-3 py-2 bg-[#F8F8F8] border border-[#C8C6C4] rounded-lg text-xs font-mono text-[#323130]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#323130] mb-1">Location & Physical Street</label>
              <input
                type="text"
                value={bLocation}
                onChange={(e) => setBLocation(e.target.value)}
                className="w-full px-3 py-2 bg-[#F8F8F8] border border-[#C8C6C4] rounded-lg text-xs text-[#323130]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#323130] mb-1">Official Contact Phone (+255)</label>
              <input
                type="text"
                value={bPhone}
                onChange={(e) => setBPhone(e.target.value)}
                className="w-full px-3 py-2 bg-[#F8F8F8] border border-[#C8C6C4] rounded-lg text-xs text-[#323130]"
              />
            </div>
          </div>
        </form>
      )}

      {/* TAB 3: STORE BRANCHES */}
      {activeTab === 'branches' && (
        <div className="bg-white rounded-xl border border-[#E1DFDD] p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#EDEBE9] pb-4">
            <div>
              <h3 className="text-base font-bold text-[#323130]">{isSw ? 'Matawi ya Biashara (Multi-Branch Network)' : 'Multi-Branch Network Management'}</h3>
              <p className="text-xs text-[#605E5C]">{isSw ? 'Weka na dhibiti matawi, wasimamizi, na kugawa bidhaa' : 'Manage branch sites and staff allocation.'}</p>
            </div>
            <button
              onClick={() => showToast(isSw ? 'Fomu ya tawi jipya inafunguka...' : 'Branch registration modal opening...')}
              className="px-4 py-2 bg-[#0078D4] text-white rounded-lg text-xs font-bold cursor-pointer"
            >
              + {isSw ? 'Ongeza Tawi Jipya' : 'Add New Branch'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50/40 rounded-xl border border-blue-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-bold text-sm text-[#323130]">Main Kariakoo Branch (Flagship)</div>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">HEADQUARTERS</span>
              </div>
              <p className="text-xs text-[#605E5C]">Kariakoo Msimbazi / Swahili Street, Dar es Salaam</p>
              <div className="text-xs text-[#323130] font-semibold bg-white p-2.5 rounded-lg border border-blue-100 flex items-center justify-between">
                <span>Staff: Salum Omar, Fatuma Ally, Dr. Kimaro</span>
                <span className="text-[#0078D4] font-bold">4 Active POS</span>
              </div>
            </div>

            <div className="p-4 bg-[#F8F8F8] rounded-xl border border-[#EDEBE9] space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-bold text-sm text-[#323130]">Mlimani City Mall Branch</div>
                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded-full">SUB-BRANCH</span>
              </div>
              <p className="text-xs text-[#605E5C]">Mlimani City Commercial Wing, Mwenge, Dar es Salaam</p>
              <div className="text-xs text-[#323130] font-semibold bg-white p-2.5 rounded-lg border border-[#EDEBE9] flex items-center justify-between">
                <span>Manager: Mwajuma Rashid</span>
                <span className="text-emerald-700 font-bold">2 Active POS</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: COMPLIANCE & TRA EFD */}
      {activeTab === 'compliance' && (
        <ComplianceTrustPanel
          language={language}
          businessName={businessName}
          tinNumber={tinNumber}
        />
      )}

      {activeTab === 'billing' && (
        <div className="bg-white rounded-xl border border-[#E1DFDD] p-6 shadow-xs space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-[#323130]">{isSw ? 'Kifurushi chako cha Duka+' : 'Your Duka+ subscription'}</h3>
              <p className="text-xs text-[#605E5C] mt-1">
                {isSw ? 'Hali ya malipo inasawazishwa na mtoa huduma.' : 'Payment status syncs with the provider portal.'}
              </p>
            </div>
            <span className={`text-xs px-3 py-1 rounded-full border font-bold ${paymentStatusTone(paymentStatus)}`}>
              {paymentStatusLabel(paymentStatus, isSw)}
            </span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-[#F9F9F7] border border-[#003322]/10">
              <div className="text-[10px] font-black uppercase tracking-wider text-[#D4AF37]">{isSw ? 'Mpango' : 'Plan'}</div>
              <div className="text-lg font-bold text-[#003322] mt-1">{isSw ? activePlan.nameSw : activePlan.name}</div>
              <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-100">
                {planBranchLabel(activePlan, isSw)}
              </span>
              <div className="text-sm text-[#605E5C] mt-1">{formatPlanPrice(activePlan, isSw)}{!activePlan.contactUs && planPeriod(isSw)}</div>
            </div>
            <div className="p-4 rounded-xl bg-[#F9F9F7] border border-[#003322]/10">
              <div className="text-[10px] font-black uppercase tracking-wider text-[#D4AF37]">{isSw ? 'Inaisha' : 'Renews / expires'}</div>
              <div className="text-lg font-bold text-[#003322] mt-1">{subscriptionExpiry}</div>
              <div className="text-xs text-[#605E5C]">{isSw ? 'Mwezi mmoja baada ya malipo' : 'Extended 1 month after payment'}</div>
            </div>
            <div className="p-4 rounded-xl bg-[#F9F9F7] border border-[#003322]/10">
              <div className="text-[10px] font-black uppercase tracking-wider text-[#D4AF37]">M-Pesa</div>
              <div className="text-sm font-bold text-[#003322] mt-1">Lipa kwa: 150 000 — DUKAPLUS</div>
              <div className="text-xs text-[#605E5C]">{isSw ? 'Tuma kumbukumbu ya barua pepe yako' : 'Use your registered email as reference'}</div>
            </div>
          </div>
          <ul className="text-xs text-[#605E5C] space-y-1">
            {activePlan.features.slice(0, 4).map(f => (
              <li key={f} className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> {f}</li>
            ))}
          </ul>
          <div className="border-t border-[#EDEBE9] pt-5 space-y-3">
            <div>
              <h4 className="text-sm font-bold text-[#323130]">{isSw ? 'Mipango yote' : 'All plans'}</h4>
              <p className="text-xs text-[#605E5C] mt-0.5">
                {isSw
                  ? 'Hakuna mpango wa bure — boresha kupitia M-Pesa au kwenye Usimamizi wa Matawi.'
                  : 'No free tier — upgrade via M-Pesa or Branch Management.'}
              </p>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              {plans.map(plan => {
                const isCurrent = plan.tier === currentPlanTier;
                return (
                  <div
                    key={plan.id}
                    className={`p-3 rounded-xl border text-xs ${isCurrent ? 'border-[#6264A7] bg-[#6264A7]/5 ring-1 ring-[#6264A7]/20' : 'border-[#E1DFDD] bg-white'}`}
                  >
                    <div className="font-bold text-[#323130]">{isSw ? plan.nameSw : plan.name}</div>
                    <span className="inline-block mt-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-teal-50 text-teal-800">
                      {planBranchLabel(plan, isSw)}
                    </span>
                    <div className="font-extrabold text-[#107C10] mt-2">{formatPlanPrice(plan, isSw)}</div>
                    {!plan.contactUs && <div className="text-[10px] text-[#605E5C]">{planPeriod(isSw)}</div>}
                    {isCurrent && (
                      <div className="mt-2 text-[10px] font-bold text-emerald-700">{isSw ? '✓ Mpango wako' : '✓ Current plan'}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'branding' && (
        <BrandThemePanel language={language} />
      )}

      {activeTab === 'documents' && (
        <DocumentTemplatesView language={language} />
      )}

        </div>
      </div>

      {/* MODAL 1: ADD NEW STAFF WITH ROLE PRESETS */}
      {isAddStaffModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-[#E1DFDD] shadow-2xl max-w-2xl w-full p-6 space-y-4 text-xs font-sans max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#EDEBE9] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#323130]">
                    {isSw ? 'Sajili Mfanyakazi Mpya & Mamlaka (RBAC)' : 'Register New Staff Member & Workstation'}
                  </h3>
                  <p className="text-[11px] text-[#605E5C]">
                    {isSw ? 'Chagua nafasi na mfumo utaweka mamlaka kiotomatiki' : 'Select role preset for auto-configured RBAC'}
                  </p>
                </div>
              </div>
              <button onClick={() => setIsAddStaffModalOpen(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <form onSubmit={handleAddNewStaff} className="space-y-4">
              {/* Role Presets */}
              <div>
                <label className="block font-semibold text-[#323130] mb-1.5">
                  {isSw ? '1. Chagua Nafasi / Preset ya Kazi:' : '1. Select Role Preset:'}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {(['Cashier', 'Pharmacist', 'Storekeeper', 'Accountant', 'Manager'] as StaffRole[]).map((r) => (
                    <button
                      type="button"
                      key={r}
                      onClick={() => applyRolePresetToForm(r)}
                      className={`p-2.5 rounded-xl border text-center font-bold transition-all cursor-pointer ${
                        newStaffForm.role === r 
                          ? 'bg-[#6264A7] text-white border-[#6264A7] shadow-sm' 
                          : 'bg-[#F8F8F8] text-[#323130] border-[#E1DFDD] hover:bg-[#F3F2F1]'
                      }`}
                    >
                      <div>{r === 'Cashier' ? '💳' : r === 'Pharmacist' ? '💊' : r === 'Storekeeper' ? '📦' : r === 'Accountant' ? '📊' : '👔'}</div>
                      <div className="text-[11px] mt-1">{r}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Personal Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#323130] mb-1">Full Legal Name *</label>
                  <input
                    type="text"
                    value={newStaffForm.name}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, name: e.target.value })}
                    placeholder="e.g. Amina Said"
                    className="w-full px-3 py-2 bg-[#F8F8F8] border border-[#C8C6C4] rounded-lg text-xs"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#323130] mb-1">Email *</label>
                  <input
                    type="email"
                    value={newStaffForm.email}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, email: e.target.value })}
                    placeholder="staff@yourbusiness.co.tz"
                    className="w-full px-3 py-2 bg-[#F8F8F8] border border-[#C8C6C4] rounded-lg text-xs"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#323130] mb-1">{isSw ? 'Nenosiri la Kuingia *' : 'Login Password *'}</label>
                  <input
                    type="password"
                    value={newStaffForm.password}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, password: e.target.value })}
                    placeholder={isSw ? 'Angalau herufi 6' : 'Min. 6 characters'}
                    className="w-full px-3 py-2 bg-[#F8F8F8] border border-[#C8C6C4] rounded-lg text-xs"
                    required
                    minLength={6}
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#323130] mb-1">Phone Number (+255)</label>
                  <input
                    type="text"
                    value={newStaffForm.phone}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, phone: e.target.value })}
                    placeholder="+255 754 889 000"
                    className="w-full px-3 py-2 bg-[#F8F8F8] border border-[#C8C6C4] rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#323130] mb-1">Assigned Store Branch</label>
                  <select
                    value={newStaffForm.branch}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, branch: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F8F8F8] border border-[#C8C6C4] rounded-lg text-xs font-semibold"
                  >
                    <option value="HQ">{isSw ? 'Tawi Kuu (HQ)' : 'Headquarters (HQ)'}</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#323130] mb-1">Shift Schedule</label>
                  <select
                    value={newStaffForm.shift}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, shift: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F8F8F8] border border-[#C8C6C4] rounded-lg text-xs font-semibold"
                  >
                    <option value="Morning (07:30 - 15:30)">Morning (07:30 - 15:30)</option>
                    <option value="Evening (15:00 - 23:00)">Evening (15:00 - 23:00)</option>
                    <option value="Full Day (08:00 - 18:00)">Full Day (08:00 - 18:00)</option>
                  </select>
                </div>
              </div>

              {/* Granular Permissions Checkboxes */}
              <div className="p-3 bg-[#F8F9FC] rounded-xl border border-[#EDEBE9] space-y-2">
                <div className="font-bold text-[#323130] flex items-center justify-between">
                  <span>Granular RBAC Permissions:</span>
                  <span className="text-[10px] text-[#605E5C]">Customize as needed</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { key: 'canSellPOS', label: 'POS Checkout & Sales' },
                    { key: 'canGiveCredit', label: 'Issue Customer Credit' },
                    { key: 'canViewInventory', label: 'View Inventory (read-only)' },
                    { key: 'canModifyInventory', label: 'Modify Stock & Prices' },
                    { key: 'canViewProfitReports', label: 'View Financial P&L' },
                    { key: 'canManageSuppliers', label: 'Order from Suppliers' },
                    { key: 'canApproveDiscounts', label: 'Authorize Discounts' },
                    { key: 'canOverridePrices', label: 'Override Unit Prices' },
                    { key: 'canVoidReceipts', label: 'Void TRA Receipts' },
                    { key: 'canPerformDailyClosing', label: 'Daily Shift Closing' },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 p-1.5 bg-white rounded border border-[#EDEBE9] cursor-pointer hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={(newStaffForm.permissions as any)[key]}
                        onChange={(e) => setNewStaffForm({
                          ...newStaffForm,
                          permissions: {
                            ...newStaffForm.permissions,
                            [key]: e.target.checked
                          }
                        })}
                        className="rounded text-[#0078D4]"
                      />
                      <span className="text-[11px] font-medium text-[#323130]">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-[#EDEBE9]">
                <button
                  type="button"
                  onClick={() => setIsAddStaffModalOpen(false)}
                  className="px-4 py-2 border border-[#C8C6C4] rounded-lg text-xs font-semibold hover:bg-[#F3F2F1] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#107C10] hover:bg-[#0e6b0e] text-white rounded-lg text-xs font-bold shadow-sm cursor-pointer"
                >
                  {isSw ? 'Kamilisha Usajili' : 'Register Staff Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT STAFF DETAILS */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-[#E1DFDD] shadow-2xl max-w-lg w-full p-6 space-y-4 text-xs font-sans">
            <div className="flex items-center justify-between border-b border-[#EDEBE9] pb-3">
              <h3 className="font-bold text-sm text-[#323130] flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#0078D4]" />
                <span>{isSw ? 'Hariri Wasifu wa Mfanyakazi' : 'Edit Staff Profile'}</span>
              </h3>
              <button onClick={() => setEditingStaff(null)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block font-semibold text-[#323130] mb-1">Full Name</label>
                <input
                  type="text"
                  value={editingStaff.name}
                  onChange={(e) => setEditingStaff({ ...editingStaff, name: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F8F8F8] border border-[#C8C6C4] rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#323130] mb-1">Role</label>
                  <select
                    value={editingStaff.role}
                    onChange={(e) => setEditingStaff({ ...editingStaff, role: e.target.value as any })}
                    className="w-full px-3 py-2 bg-[#F8F8F8] border border-[#C8C6C4] rounded-lg text-xs font-semibold"
                  >
                    <option value="Cashier">Cashier</option>
                    <option value="Pharmacist">Pharmacist</option>
                    <option value="Storekeeper">Storekeeper</option>
                    <option value="Accountant">Accountant</option>
                    <option value="Manager">Manager</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#323130] mb-1">Branch</label>
                  <select
                    value={editingStaff.branch}
                    onChange={(e) => setEditingStaff({ ...editingStaff, branch: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F8F8F8] border border-[#C8C6C4] rounded-lg text-xs font-semibold"
                  >
                    <option value="Main Kariakoo (Flagship)">Main Kariakoo (Flagship)</option>
                    <option value="Mlimani City Mall Branch">Mlimani City Mall Branch</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#323130] mb-1">Phone</label>
                  <input
                    type="text"
                    value={editingStaff.phone}
                    onChange={(e) => setEditingStaff({ ...editingStaff, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F8F8F8] border border-[#C8C6C4] rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#323130] mb-1">Shift</label>
                  <input
                    type="text"
                    value={editingStaff.shift}
                    onChange={(e) => setEditingStaff({ ...editingStaff, shift: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F8F8F8] border border-[#C8C6C4] rounded-lg text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 flex justify-end gap-2 border-t border-[#EDEBE9]">
              <button onClick={() => setEditingStaff(null)} className="px-4 py-2 border rounded-lg text-xs font-semibold">Cancel</button>
              <button
                onClick={() => handleUpdateStaff(editingStaff)}
                className="px-4 py-2 bg-[#0078D4] hover:bg-[#006cbd] text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: PERMISSIONS MATRIX (RBAC) */}
      {permissionsStaff && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-[#E1DFDD] shadow-2xl max-w-xl w-full p-6 space-y-4 text-xs font-sans">
            <div className="flex items-center justify-between border-b border-[#EDEBE9] pb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-purple-600" />
                <div>
                  <h3 className="font-bold text-sm text-[#323130]">
                    RBAC Matrix: {permissionsStaff.name} ({permissionsStaff.role})
                  </h3>
                  <p className="text-[11px] text-[#605E5C]">Set granular permissions for security compliance</p>
                </div>
              </div>
              <button onClick={() => setPermissionsStaff(null)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[
                  { key: 'canSellPOS', label: 'POS Selling & Invoicing', desc: 'Can process sales and print customer receipts' },
                  { key: 'canGiveCredit', label: 'Issue Customer Credit', desc: 'Can approve post-pay / ledger credit sales' },
                  { key: 'canViewInventory', label: 'View Inventory (read-only)', desc: 'Can look up prices and stock without changing them' },
                  { key: 'canModifyInventory', label: 'Modify Stock & Pricing', desc: 'Can adjust product quantities, buy prices, and write-offs' },
                  { key: 'canViewProfitReports', label: 'View Profit & Margins', desc: 'Can view gross profit, net revenue, and supplier buy costs' },
                  { key: 'canManageSuppliers', label: 'Order from Suppliers', desc: 'Can create POs and record vendor invoice settlements' },
                  { key: 'canApproveDiscounts', label: 'Authorize Price Discounts', desc: 'Can apply custom discount overrides' },
                  { key: 'canOverridePrices', label: 'Override Unit Prices', desc: 'Can manually change item prices at POS' },
                  { key: 'canVoidReceipts', label: 'Void Issued Receipts', desc: 'Can cancel or refund issued TRA transactions' },
                  { key: 'canPerformDailyClosing', label: 'Shift Drawer Closing', desc: 'Can perform end-of-day Z-report reconciliations' },
                ].map(({ key, label, desc }) => (
                  <label key={key} className="flex items-start gap-2.5 p-2.5 bg-[#F8F9FC] rounded-xl border border-[#EDEBE9] cursor-pointer hover:bg-slate-100">
                    <input
                      type="checkbox"
                      checked={(permissionsStaff.permissions as any)[key]}
                      onChange={(e) => setPermissionsStaff({
                        ...permissionsStaff,
                        permissions: {
                          ...permissionsStaff.permissions,
                          [key]: e.target.checked
                        }
                      })}
                      className="mt-0.5 rounded text-purple-600"
                    />
                    <div>
                      <div className="font-bold text-xs text-[#323130]">{label}</div>
                      <div className="text-[10px] text-[#605E5C] leading-tight mt-0.5">{desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="pt-3 flex justify-end gap-2 border-t border-[#EDEBE9]">
              <button onClick={() => setPermissionsStaff(null)} className="px-4 py-2 border rounded-lg text-xs font-semibold">Cancel</button>
              <button
                onClick={() => handleSavePermissions(permissionsStaff.id, permissionsStaff.permissions)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Save Permissions
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: PIN RESET & CREDENTIALS */}
      {pinResetStaff && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-[#E1DFDD] shadow-2xl max-w-md w-full p-6 space-y-4 text-xs font-sans">
            <div className="flex items-center justify-between border-b border-[#EDEBE9] pb-3">
              <h3 className="font-bold text-sm text-[#323130] flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-600" />
                <span>{isSw ? 'Weka Upya PIN ya Kituo cha Mauzo' : 'Reset Workstation POS PIN'}</span>
              </h3>
              <button onClick={() => setPinResetStaff(null)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-[#605E5C]">
                {isSw 
                  ? `Tengeneza PIN mpya ya nambari 4 kwa ajili ya ${pinResetStaff.name}. Mfumo utatuma pia ujumbe wa SMS kwa simu ${pinResetStaff.phone}.`
                  : `Generate a new 4-digit PIN for ${pinResetStaff.name}. An SMS confirmation will be sent to ${pinResetStaff.phone}.`
                }
              </p>

              <div>
                <label className="block font-semibold text-[#323130] mb-1">New 4-Digit PIN Code</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    defaultValue={Math.floor(1000 + Math.random() * 9000).toString()}
                    id="new-pin-input"
                    className="w-full px-3 py-2 bg-[#F8F8F8] border border-[#C8C6C4] rounded-lg text-sm font-mono font-bold tracking-widest text-[#0078D4]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const input = document.getElementById('new-pin-input') as HTMLInputElement;
                      if (input) input.value = Math.floor(1000 + Math.random() * 9000).toString();
                    }}
                    className="px-3 py-2 bg-[#F3F2F1] rounded-lg font-bold hover:bg-[#EDEBE9]"
                  >
                    🎲
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button onClick={() => setPinResetStaff(null)} className="px-4 py-2 border rounded-lg text-xs font-semibold">Cancel</button>
              <button
                onClick={() => {
                  setPinResetStaff(null);
                  showToast(isSw ? `PIN mpya imetumwa kwa SMS kwa ${pinResetStaff.phone}!` : `New PIN sent via SMS to ${pinResetStaff.phone}!`);
                }}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                {isSw ? 'Tuma PIN kwa SMS' : 'Save & Send SMS'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: AUDIT LOG DRAWER */}
      {auditLogStaff && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-[#E1DFDD] shadow-2xl max-w-xl w-full p-6 space-y-4 text-xs font-sans max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#EDEBE9] pb-3">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-emerald-600" />
                <div>
                  <h3 className="font-bold text-sm text-[#323130]">
                    {isSw ? 'Kumbukumbu ya Kazi ya Mfanyakazi' : 'Staff Audit Trail & Activity Log'}
                  </h3>
                  <p className="text-[11px] text-[#605E5C]">{auditLogStaff.name} ({auditLogStaff.role})</p>
                </div>
              </div>
              <button onClick={() => setAuditLogStaff(null)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <div className="space-y-2 divide-y divide-[#EDEBE9]">
              {(auditLogStaff.recentAuditLogs && auditLogStaff.recentAuditLogs.length > 0) ? (
                auditLogStaff.recentAuditLogs.map((log) => (
                  <div key={log.id} className="pt-2.5 pb-1">
                    <div className="flex items-center justify-between font-bold text-[#323130]">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        <span>{log.action}</span>
                      </span>
                      <span className="text-[10px] text-[#605E5C] font-mono">{log.timestamp}</span>
                    </div>
                    <div className="text-[11px] text-[#605E5C] mt-0.5 pl-3.5">{log.details}</div>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-[#605E5C]">
                  {isSw ? 'Hakuna kumbukumbu za hivi karibuni.' : 'No recent audit logs available for this staff member.'}
                </div>
              )}
            </div>

            <div className="pt-3 flex justify-end">
              <button onClick={() => setAuditLogStaff(null)} className="px-4 py-2 bg-[#0078D4] text-white rounded-lg text-xs font-bold">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: SAFE DELETE CONFIRMATION */}
      {deleteConfirmStaff && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-[#E1DFDD] shadow-2xl max-w-md w-full p-6 space-y-4 text-xs font-sans">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center font-bold text-lg">
                ⚠️
              </div>
              <div>
                <h3 className="font-bold text-sm text-[#323130]">
                  {isSw ? 'Ondoa Mfanyakazi Huyu?' : 'Confirm Staff Offboarding'}
                </h3>
                <p className="text-[11px] text-[#605E5C]">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-[#323130]">
              {isSw 
                ? `Je, una uhakika unataka kuondoa akaunti ya ${deleteConfirmStaff.name} (${deleteConfirmStaff.role})? Hatoweza tena kuingia kwenye kituo cha mauzo.`
                : `Are you sure you want to remove ${deleteConfirmStaff.name} (${deleteConfirmStaff.role})? They will immediately lose access to their workstation.`
              }
            </p>

            <div className="pt-2 flex justify-end gap-2">
              <button onClick={() => setDeleteConfirmStaff(null)} className="px-4 py-2 border rounded-lg text-xs font-semibold">
                Cancel
              </button>
              <button
                onClick={() => handleDeleteStaffConfirm(deleteConfirmStaff.id)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                {isSw ? 'Ndio, Ondoa Kabisa' : 'Yes, Offboard Staff'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
