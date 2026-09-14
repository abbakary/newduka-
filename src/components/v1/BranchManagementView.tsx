import React, { useState } from 'react';
import { 
  Building2, 
  GitBranch, 
  MapPin, 
  Plus, 
  Users, 
  Boxes, 
  TrendingUp, 
  ShieldCheck, 
  Sparkles, 
  ArrowRightLeft, 
  Clock, 
  Phone, 
  Mail, 
  CheckCircle2, 
  AlertTriangle, 
  Edit3, 
  Search, 
  Filter, 
  ChevronRight, 
  PackageCheck, 
  Truck, 
  ArrowUpRight, 
  CreditCard, 
  Zap, 
  Lock, 
  Share2, 
  Layers, 
  BarChart3, 
  DollarSign, 
  Check, 
  X, 
  ExternalLink,
  Eye
} from 'lucide-react';
import { 
  Language, 
  StoreBranch, 
  InterBranchTransfer, 
  InterBranchTransferItem, 
  Product, 
  StaffMember, 
  AuthUser, 
  SaaSPlanTier, 
  SaaSPlan,
  BusinessType
} from '@/types/v1';
import { DEFAULT_SAAS_PLANS } from '@/lib/emptyDefaults';
import { planBranchLabel, formatPlanPrice } from '@/lib/saasPlans';
import { useSaasPlans } from '@/context/SaasPlansContext';
import { api } from '@/lib/api';
import { mapBranch } from '@/lib/apiSync';
import { saveBranchVatOverride } from '@/lib/taxComplianceSettings';

interface BranchManagementViewProps {
  language: Language;
  branches: StoreBranch[];
  setBranches: React.Dispatch<React.SetStateAction<StoreBranch[]>>;
  transfers: InterBranchTransfer[];
  setTransfers: React.Dispatch<React.SetStateAction<InterBranchTransfer[]>>;
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  staffMembers: StaffMember[];
  currentUser?: AuthUser | null;
  activeBranchId: string; // 'all' or branch.id
  setActiveBranchId: (branchId: string) => void;
  currentPlanTier?: SaaSPlanTier;
  setCurrentPlanTier?: (tier: SaaSPlanTier) => void;
  onOpenAIChatWithPrompt?: (prompt: string) => void;
  onNavigateToPOS?: () => void;
  onNavigateToInventory?: () => void;
  tenantId?: string | null;
}

export const BranchManagementView: React.FC<BranchManagementViewProps> = ({
  language,
  branches,
  setBranches,
  transfers,
  setTransfers,
  products,
  setProducts,
  staffMembers,
  currentUser,
  activeBranchId,
  setActiveBranchId,
  currentPlanTier = 'starter',
  setCurrentPlanTier,
  onOpenAIChatWithPrompt,
  onNavigateToPOS,
  onNavigateToInventory,
  tenantId,
}) => {
  const isSw = language === 'sw';
  const [activeTab, setActiveTab] = useState<'branches' | 'transfers' | 'analytics' | 'pricing'>('branches');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Modals
  const [isAddBranchModalOpen, setIsAddBranchModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<StoreBranch | null>(null);
  const [selectedBranchDetail, setSelectedBranchDetail] = useState<StoreBranch | null>(null);

  // New Branch Form
  const [branchFormData, setBranchFormData] = useState<{
    name: string;
    code: string;
    type: 'main_hq' | 'sub_branch' | 'warehouse';
    region: string;
    district: string;
    address: string;
    phone: string;
    email: string;
    managerStaffId: string;
    adminName: string;
    adminEmail: string;
    adminPhone: string;
    adminPassword: string;
    traEfdSerial: string;
    openingHours: string;
    notes: string;
    vatTaxStatus: 'inherit' | 'vat_registered' | 'not_vat_registered';
  }>({
    name: '',
    code: '',
    type: 'sub_branch',
    region: 'Dar es Salaam',
    district: 'Kinondoni',
    address: '',
    phone: '+255 ',
    email: '',
    managerStaffId: '',
    adminName: '',
    adminEmail: '',
    adminPhone: '+255 ',
    adminPassword: '',
    traEfdSerial: `EFD-TZ-2026-${Math.floor(1000 + Math.random() * 9000)}`,
    openingHours: '08:00 - 20:00',
    notes: '',
    vatTaxStatus: 'inherit',
  });
  const [branchSaving, setBranchSaving] = useState(false);
  const [branchSaveError, setBranchSaveError] = useState<string | null>(null);

  // New Transfer Form
  const [transferSourceId, setTransferSourceId] = useState<string>('branch-1');
  const [transferDestId, setTransferDestId] = useState<string>('branch-2');
  const [transferItems, setTransferItems] = useState<{ productId: string; quantity: number }[]>([
    { productId: products[0]?.id || '', quantity: 5 }
  ]);
  const [transferNotes, setTransferNotes] = useState<string>('');
  const [transferWaybill, setTransferWaybill] = useState<string>('');

  const { plans: saasPlans } = useSaasPlans();

  // Selected plan lookup
  const currentPlan = saasPlans.find(p => p.tier === currentPlanTier) || saasPlans[0] || DEFAULT_SAAS_PLANS[0];
  const maxBranchesAllowed = currentPlan.maxBranches;
  const isBranchQuotaReached = branches.length >= maxBranchesAllowed;
  const canCreateBranches = currentUser?.role === 'vendor_owner' || currentUser?.staffRole === 'Owner';

  // Aggregate metrics
  const totalCombinedRevenueToday = branches.reduce((acc, b) => acc + (b.dailyGmvTzs || 0), 0);
  const totalCombinedStockValuation = branches.reduce((acc, b) => acc + (b.stockValuationTzs || 0), 0);
  const totalCombinedStaff = staffMembers.length;
  const pendingTransfersCount = transfers.filter(t => t.status === 'in_transit' || t.status === 'pending').length;

  // Filtered branches
  const filteredBranches = branches.filter(b => {
    const matchesSearch = b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          b.district.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          b.region.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          b.code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Handle Add / Edit Branch submit
  const handleSaveBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchFormData.name || !branchFormData.address) return;

    if (editingBranch) {
      const selectedManager = staffMembers.find(s => s.id === branchFormData.managerStaffId);
      const branchVatRegistered =
        branchFormData.vatTaxStatus === 'inherit'
          ? null
          : branchFormData.vatTaxStatus === 'vat_registered';
      if (tenantId) {
        saveBranchVatOverride(tenantId, editingBranch.id, branchVatRegistered);
      }
      setBranches(prev => prev.map(b => b.id === editingBranch.id ? {
        ...b,
        name: branchFormData.name,
        code: branchFormData.code || b.code,
        type: branchFormData.type,
        region: branchFormData.region,
        district: branchFormData.district,
        address: branchFormData.address,
        phone: branchFormData.phone,
        email: branchFormData.email,
        managerStaffId: branchFormData.managerStaffId,
        managerName: selectedManager ? `${selectedManager.name} (${selectedManager.role})` : b.managerName,
        openingHours: branchFormData.openingHours,
        notes: branchFormData.notes,
        vatRegistered: branchVatRegistered,
      } : b));
      setEditingBranch(null);
      setIsAddBranchModalOpen(false);
      return;
    }

    if (isBranchQuotaReached) {
      setIsUpgradeModalOpen(true);
      return;
    }

    if (!branchFormData.adminName.trim() || !branchFormData.adminEmail.trim() || !branchFormData.adminPassword.trim()) {
      setBranchSaveError(isSw ? 'Jaza jina, barua pepe na nenosiri la meneja wa tawi' : 'Branch admin name, email and password are required');
      return;
    }

    setBranchSaving(true);
    setBranchSaveError(null);
    try {
      const created = await api.createBranch({
        name: branchFormData.name,
        code: branchFormData.code || undefined,
        branch_type: branchFormData.type,
        region: branchFormData.region,
        district: branchFormData.district,
        address: branchFormData.address,
        phone: branchFormData.phone,
        tra_efd_serial: branchFormData.traEfdSerial,
        opening_hours: branchFormData.openingHours,
        admin: {
          name: branchFormData.adminName.trim(),
          email: branchFormData.adminEmail.trim().toLowerCase(),
          phone: branchFormData.adminPhone.trim(),
          password: branchFormData.adminPassword,
        },
      });
      const newBranch = mapBranch(created as Record<string, unknown>);
      newBranch.notes = branchFormData.notes;
      setBranches(prev => [...prev, newBranch]);
      setIsAddBranchModalOpen(false);
      setBranchFormData(prev => ({
        ...prev,
        name: '',
        code: '',
        address: '',
        adminName: '',
        adminEmail: '',
        adminPassword: '',
        notes: '',
      }));
    } catch (err) {
      setBranchSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setBranchSaving(false);
    }
  };

  // Open Edit modal
  const handleOpenEditBranch = (b: StoreBranch) => {
    setEditingBranch(b);
    setBranchFormData({
      name: b.name,
      code: b.code,
      type: b.type,
      region: b.region,
      district: b.district,
      address: b.address,
      phone: b.phone,
      email: b.email,
      managerStaffId: b.managerStaffId || '',
      traEfdSerial: b.traEfdSerial,
      openingHours: b.openingHours,
      notes: b.notes || '',
      adminName: '',
      adminEmail: '',
      adminPhone: '+255 ',
      adminPassword: '',
      vatTaxStatus:
        b.vatRegistered === true
          ? 'vat_registered'
          : b.vatRegistered === false
            ? 'not_vat_registered'
            : 'inherit',
    });
    setIsAddBranchModalOpen(true);
  };

  // Handle Create Transfer Submit
  const handleCreateTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (transferSourceId === transferDestId) {
      alert(isSw ? 'Tawi la kutuma na tawi la kupokea hayawezi kuwa sawa!' : 'Source and destination branches cannot be the same!');
      return;
    }

    const sourceBranch = branches.find(b => b.id === transferSourceId);
    const destBranch = branches.find(b => b.id === transferDestId);
    if (!sourceBranch || !destBranch) return;

    const itemsToAdd: InterBranchTransferItem[] = [];
    let totalValuation = 0;
    let totalUnits = 0;

    for (const item of transferItems) {
      const prod = products.find(p => p.id === item.productId);
      if (prod && item.quantity > 0) {
        const val = item.quantity * prod.cost;
        totalValuation += val;
        totalUnits += item.quantity;
        itemsToAdd.push({
          productId: prod.id,
          productName: prod.name,
          sku: prod.sku,
          unit: prod.unit,
          quantity: item.quantity,
          unitCostTzs: prod.cost,
          totalValuationTzs: val
        });
      }
    }

    if (itemsToAdd.length === 0) {
      alert(isSw ? 'Tafadhali chagua bidhaa na idadi halisi!' : 'Please select valid products and quantities!');
      return;
    }

    const newTransfer: InterBranchTransfer = {
      id: `ibt-${Date.now()}`,
      transferNumber: `IBT-2026-00${transfers.length + 80}`,
      sourceBranchId: sourceBranch.id,
      sourceBranchName: sourceBranch.name,
      destinationBranchId: destBranch.id,
      destinationBranchName: destBranch.name,
      status: 'in_transit',
      items: itemsToAdd,
      totalUnits,
      totalValuationTzs: totalValuation,
      initiatedBy: currentUser?.name || 'Salum Omar (Boss)',
      dateInitiated: new Date().toISOString().replace('T', ' ').substring(0, 16),
      notes: transferNotes,
      dispatchDriverOrWaybill: transferWaybill || 'Standard Van Dispatch'
    };

    // Deduct stock from source branch
    setProducts(prev => prev.map(p => {
      const transferred = itemsToAdd.find(i => i.productId === p.id);
      if (transferred) {
        return {
          ...p,
          stock: Math.max(0, p.stock - transferred.quantity)
        };
      }
      return p;
    }));

    setTransfers(prev => [newTransfer, ...prev]);
    setIsTransferModalOpen(false);
    setTransferNotes('');
    setTransferWaybill('');
  };

  // Confirm receipt of transfer
  const handleConfirmReceiveTransfer = (transferId: string) => {
    setTransfers(prev => prev.map(t => {
      if (t.id === transferId) {
        // Update product inventory for receiving branch
        return {
          ...t,
          status: 'received',
          receivedBy: currentUser?.name || 'Branch Manager',
          dateReceived: new Date().toISOString().replace('T', ' ').substring(0, 16)
        };
      }
      return t;
    }));
  };

  // Switch Plan Tier
  const handleSelectPlanTier = (tier: SaaSPlanTier) => {
    if (setCurrentPlanTier) {
      setCurrentPlanTier(tier);
    }
    setIsUpgradeModalOpen(false);
  };

  return (
    <div className="space-y-6 select-none font-['Calibri',_'Aptos',_'Segoe_UI',_sans-serif]">
      {/* 1. TOP HEADER & MULTI-BRANCH PLAN BANNER */}
      <div className="bg-gradient-to-r from-[#24284A] via-[#2D3360] to-[#1E2240] rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-1 rounded-md bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                <GitBranch className="w-3.5 h-3.5" />
                {isSw ? 'Usimamizi wa Matawi (Multi-Branch SaaS)' : 'Multi-Branch SaaS Engine'}
              </span>
              <span className="px-2.5 py-1 rounded-md bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 text-xs font-bold">
                {currentPlan.name}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {isSw ? 'Matawi & Sehemu za Biashara Yako' : 'Store Branches & Locations Management'}
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
              {isSw 
                ? 'Dhibiti kila tawi likiwa peke yake (Isolated POS, Stoo, Madeni & Wafanyakazi) huku wewe kama Boss ukipata ripoti jumuishi ya biashara zote kwa pamoja.'
                : 'Manage isolated branches with independent POS, inventory and staff, with seamless centralized owner aggregation and inter-branch logistics.'}
            </p>
          </div>

          {/* Plan Quota & Upgrade Actions */}
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/15 shrink-0 flex flex-col gap-3 min-w-[260px]">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300">{isSw ? 'Kiwango cha Matawi:' : 'Branch Quota:'}</span>
              <span className="font-extrabold text-amber-300">
                {branches.length} / {maxBranchesAllowed}
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all ${
                  isBranchQuotaReached ? 'bg-rose-400' : 'bg-emerald-400'
                }`}
                style={{ 
                  width: `${Math.min(100, (branches.length / Math.max(1, maxBranchesAllowed)) * 100)}%` 
                }}
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                id="btn-upgrade-plan-branch"
                onClick={() => setIsUpgradeModalOpen(true)}
                className="flex-1 py-1.5 px-3 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 text-xs font-extrabold shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isSw ? 'Boresha Mpango' : 'Upgrade Plan'}</span>
              </button>

              {canCreateBranches && (
              <button
                id="btn-add-branch-top"
                onClick={() => {
                  if (isBranchQuotaReached) {
                    setIsUpgradeModalOpen(true);
                  } else {
                    setEditingBranch(null);
                    setBranchSaveError(null);
                    setBranchFormData({
                      name: '',
                      code: '',
                      type: 'sub_branch',
                      region: 'Dar es Salaam',
                      district: 'Kinondoni',
                      address: '',
                      phone: '+255 ',
                      email: '',
                      managerStaffId: '',
                      adminName: '',
                      adminEmail: '',
                      adminPhone: '+255 ',
                      adminPassword: '',
                      traEfdSerial: `EFD-TZ-2026-${Math.floor(1000 + Math.random() * 9000)}`,
                      openingHours: '08:00 - 20:00',
                      notes: ''
                    });
                    setIsAddBranchModalOpen(true);
                  }
                }}
                className="py-1.5 px-3 rounded-lg bg-[#6264A7] hover:bg-[#525492] text-white text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isSw ? 'Tawi Jipya' : 'Add Branch'}</span>
              </button>
              )}
            </div>
          </div>
        </div>

        {/* Active branch selector — one branch at a time, fully isolated */}
        <div className="mt-5 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-300 font-semibold">{isSw ? 'Tawi Unalofanya Kazi Sasa:' : 'Active Branch:'}</span>
            <div className="inline-flex rounded-lg bg-black/30 p-1 border border-white/10">
              {branches.map(b => (
                <button
                  key={b.id}
                  onClick={() => setActiveBranchId(b.id)}
                  className={`px-3 py-1 rounded-md font-bold transition-all cursor-pointer ${
                    activeBranchId === b.id
                      ? 'bg-[#6264A7] text-white shadow-xs'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  📍 {b.name}
                </button>
              ))}
            </div>
          </div>

          <div className="text-slate-300 text-[11px] flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>{isSw ? 'Kila tawi lina data yake pekee — hakuna mchanganyiko' : 'Each branch shows only its own data — no mixing'}</span>
          </div>
        </div>
      </div>

      {/* 2. AGGREGATE STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Branches */}
        <div className="bg-white rounded-xl border border-[#E1DFDD] p-4 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs text-[#605E5C] font-semibold">{isSw ? 'Jumla ya Matawi' : 'Total Branches'}</div>
            <div className="text-2xl font-extrabold text-[#323130] mt-1">{branches.length}</div>
            <div className="text-[11px] text-[#107C10] font-bold mt-0.5">
              1 HQ • {branches.length - 1} {isSw ? 'Sub-Branches' : 'Sub-Branches'}
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#0078D4] flex items-center justify-center">
            <Building2 className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: Combined Daily Sales */}
        <div className="bg-white rounded-xl border border-[#E1DFDD] p-4 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs text-[#605E5C] font-semibold">{isSw ? 'Mauzo ya Leo (Matawi Yote)' : 'Today Sales (All Branches)'}</div>
            <div className="text-2xl font-extrabold text-[#107C10] mt-1">
              TSh {totalCombinedRevenueToday.toLocaleString()}
            </div>
            <div className="text-[11px] text-[#605E5C] mt-0.5">
              {isSw ? 'Kupitia Kaunta 3 za POS' : 'Across 3 Active Registers'}
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-[#107C10] flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Combined Stock Valuation */}
        <div className="bg-white rounded-xl border border-[#E1DFDD] p-4 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs text-[#605E5C] font-semibold">{isSw ? 'Thamani ya Stoo (Yote)' : 'Total Stock Valuation'}</div>
            <div className="text-2xl font-extrabold text-[#323130] mt-1">
              TSh {totalCombinedStockValuation.toLocaleString()}
            </div>
            <div className="text-[11px] text-[#6264A7] font-bold mt-0.5">
              {products.length} {isSw ? 'Aina za Bidhaa' : 'Unique Catalog Items'}
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-[#6264A7] flex items-center justify-center">
            <Boxes className="w-6 h-6" />
          </div>
        </div>

        {/* Card 4: Inter-branch transfers */}
        <div className="bg-white rounded-xl border border-[#E1DFDD] p-4 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs text-[#605E5C] font-semibold">{isSw ? 'Uhamisho wa Stoo (IBT)' : 'Active Stock Transfers'}</div>
            <div className="text-2xl font-extrabold text-[#D83B01] mt-1">
              {pendingTransfersCount} {isSw ? 'Njiani' : 'In Transit'}
            </div>
            <div className="text-[11px] text-[#605E5C] mt-0.5">
              {transfers.length} {isSw ? 'Uhamisho uliorekodiwa' : 'Total recorded transfers'}
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-[#D83B01] flex items-center justify-center">
            <Truck className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 3. MAIN TAB NAVIGATION */}
      <div className="bg-white rounded-xl border border-[#E1DFDD] shadow-xs">
        <div className="flex flex-wrap items-center justify-between border-b border-[#EDEBE9] px-4 pt-3 gap-3">
          <div className="flex items-center gap-2">
            <button
              id="tab-branch-list"
              onClick={() => setActiveTab('branches')}
              className={`pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'branches'
                  ? 'border-[#6264A7] text-[#6264A7]'
                  : 'border-transparent text-[#605E5C] hover:text-[#323130]'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>{isSw ? 'Orodha ya Matawi' : 'Branch Directory'}</span>
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-[#6264A7]/10 text-[#6264A7]">
                {branches.length}
              </span>
            </button>

            <button
              id="tab-branch-transfers"
              onClick={() => setActiveTab('transfers')}
              className={`pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'transfers'
                  ? 'border-[#6264A7] text-[#6264A7]'
                  : 'border-transparent text-[#605E5C] hover:text-[#323130]'
              }`}
            >
              <ArrowRightLeft className="w-4 h-4" />
              <span>{isSw ? 'Uhamisho wa Stoo (Transfers)' : 'Stock Transfers (IBT)'}</span>
              {pendingTransfersCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-rose-500 text-white font-bold animate-pulse">
                  {pendingTransfersCount}
                </span>
              )}
            </button>

            <button
              id="tab-branch-analytics"
              onClick={() => setActiveTab('analytics')}
              className={`pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'analytics'
                  ? 'border-[#6264A7] text-[#6264A7]'
                  : 'border-transparent text-[#605E5C] hover:text-[#323130]'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>{isSw ? 'Ulinganishi wa Utendaji' : 'Performance Matrix'}</span>
            </button>

            <button
              id="tab-branch-pricing"
              onClick={() => setActiveTab('pricing')}
              className={`pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'pricing'
                  ? 'border-[#6264A7] text-[#6264A7]'
                  : 'border-transparent text-[#605E5C] hover:text-[#323130]'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>{isSw ? 'Mipango ya Bei (TSh 60,000)' : 'Pricing & Quota'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2 pb-3">
            <button
              onClick={() => {
                if (isBranchQuotaReached) {
                  setIsUpgradeModalOpen(true);
                } else {
                  setIsTransferModalOpen(true);
                }
              }}
              className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>{isSw ? 'Tuma Stoo Tawi Jingine' : 'Transfer Stock'}</span>
            </button>

            <button
              onClick={() => {
                if (isBranchQuotaReached) {
                  setIsUpgradeModalOpen(true);
                } else {
                  setEditingBranch(null);
                  setIsAddBranchModalOpen(true);
                }
              }}
              className="px-3 py-1.5 rounded-lg bg-[#6264A7] hover:bg-[#525492] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isSw ? 'Fungua Tawi Jipya' : 'Add New Branch'}</span>
            </button>
          </div>
        </div>

        {/* 4. TAB 1: BRANCH LIST */}
        {activeTab === 'branches' && (
          <div className="p-5 space-y-5">
            {/* Filter bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#F8F8F8] p-3 rounded-xl border border-[#EDEBE9]">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-[#605E5C] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isSw ? 'Tafuta tawi kwa jina, mtaa, kodi...' : 'Search branch by name, area, code...'}
                  className="w-full pl-9 pr-3 py-1.5 bg-white border border-[#C8C6C4] rounded-lg text-xs outline-none focus:border-[#6264A7]"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <span className="text-xs text-[#605E5C] font-semibold">{isSw ? 'Hali:' : 'Status:'}</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-white border border-[#C8C6C4] rounded-lg px-2.5 py-1.5 text-xs text-[#323130] font-semibold outline-none"
                >
                  <option value="all">{isSw ? 'Matawi Yote' : 'All Statuses'}</option>
                  <option value="active">{isSw ? 'Yaliyo Hai (Active)' : 'Active'}</option>
                  <option value="renovation">{isSw ? 'Maboresho (Renovation)' : 'Renovation'}</option>
                  <option value="inactive">{isSw ? 'Yaliyositishwa (Inactive)' : 'Inactive'}</option>
                </select>
              </div>
            </div>

            {/* Branch Cards Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {filteredBranches.map(branch => {
                const isHQ = branch.type === 'main_hq';
                const isCurrentActive = activeBranchId === branch.id;

                return (
                  <div
                    key={branch.id}
                    className={`bg-white rounded-xl border-2 transition-all p-5 shadow-xs flex flex-col justify-between ${
                      isCurrentActive
                        ? 'border-[#6264A7] ring-2 ring-[#6264A7]/20 shadow-md'
                        : 'border-[#E1DFDD] hover:border-slate-400'
                    }`}
                  >
                    <div>
                      {/* Top Header of Card */}
                      <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#EDEBE9]">
                        <div className="flex items-center gap-3">
                          <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-lg shadow-xs ${
                            isHQ ? 'bg-[#0078D4] text-white' : 'bg-[#6264A7] text-white'
                          }`}>
                            {isHQ ? 'HQ' : 'BR'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-extrabold text-base text-[#323130]">{branch.name}</h3>
                              {isHQ && (
                                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-blue-100 text-blue-800 uppercase tracking-wider">
                                  {isSw ? 'Makao Makuu' : 'Flagship HQ'}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-[#605E5C] flex items-center gap-1.5 mt-0.5">
                              <span className="font-mono font-bold text-slate-700">{branch.code}</span>
                              <span>•</span>
                              <span>{branch.district}, {branch.region}</span>
                            </div>
                          </div>
                        </div>

                        <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${
                          branch.status === 'active' 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {branch.status === 'active' ? (isSw ? 'Inafanya Kazi' : 'Active') : branch.status}
                        </span>
                      </div>

                      {/* Details Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 my-4 text-xs">
                        <div className="p-2.5 bg-[#F8F8F8] rounded-lg border border-[#EDEBE9]">
                          <div className="text-[10px] text-[#605E5C]">{isSw ? 'Mauzo ya Leo' : 'Today Sales'}</div>
                          <div className="text-sm font-extrabold text-[#107C10] mt-0.5">
                            TSh {(branch.dailyGmvTzs || 0).toLocaleString()}
                          </div>
                        </div>

                        <div className="p-2.5 bg-[#F8F8F8] rounded-lg border border-[#EDEBE9]">
                          <div className="text-[10px] text-[#605E5C]">{isSw ? 'Thamani ya Stoo' : 'Stock Valuation'}</div>
                          <div className="text-sm font-extrabold text-[#323130] mt-0.5">
                            TSh {(branch.stockValuationTzs || 0).toLocaleString()}
                          </div>
                        </div>

                        <div className="p-2.5 bg-[#F8F8F8] rounded-lg border border-[#EDEBE9]">
                          <div className="text-[10px] text-[#605E5C]">{isSw ? 'Wafanyakazi' : 'Staff Count'}</div>
                          <div className="text-sm font-extrabold text-[#6264A7] mt-0.5 flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" />
                            <span>{branch.staffCount || 2} {isSw ? 'Watu' : 'Staff'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Location & Contact */}
                      <div className="space-y-1.5 text-xs text-[#605E5C] bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <div className="flex items-start gap-2">
                          <MapPin className="w-3.5 h-3.5 text-[#6264A7] shrink-0 mt-0.5" />
                          <span className="text-[#323130] font-medium">{branch.address}</span>
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{branch.phone}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>{branch.openingHours}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[11px] text-slate-500">
                            {isSw ? 'Meneja wa Tawi:' : 'Manager:'} <strong>{branch.managerName || 'Salum Omar'}</strong>
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">{branch.traEfdSerial}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="pt-4 border-t border-[#EDEBE9] flex items-center justify-between gap-2 mt-2">
                      <button
                        onClick={() => handleOpenEditBranch(branch)}
                        className="px-3 py-1.5 rounded-lg border border-[#C8C6C4] hover:bg-[#F3F2F1] text-xs font-bold text-[#323130] flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>{isSw ? 'Hariri' : 'Edit'}</span>
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setTransferSourceId(isHQ ? branch.id : 'branch-1');
                            setTransferDestId(!isHQ ? branch.id : 'branch-2');
                            setIsTransferModalOpen(true);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{isSw ? 'Uhamisho' : 'Transfer'}</span>
                        </button>

                        <button
                          onClick={() => setActiveBranchId(branch.id)}
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                            isCurrentActive
                              ? 'bg-[#6264A7] text-white shadow-xs'
                              : 'bg-[#F3F2F1] hover:bg-[#6264A7] hover:text-white text-[#323130]'
                          }`}
                        >
                          <span>{isCurrentActive ? (isSw ? '✓ Tawi Linalotumika' : '✓ Active Context') : (isSw ? 'Ingia Tawi Hili' : 'Switch Context')}</span>
                          {!isCurrentActive && <ChevronRight className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 5. TAB 2: INTER-BRANCH TRANSFERS */}
        {activeTab === 'transfers' && (
          <div className="p-5 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-base text-[#323130]">
                  {isSw ? 'Uhamisho wa Bidhaa & Stoo Kati ya Matawi (Inter-Branch Transfers)' : 'Inter-Branch Stock Movement & Logistics'}
                </h3>
                <p className="text-xs text-[#605E5C]">
                  {isSw
                    ? 'Rekodi na ufuatilie mizigo inayotoka Tawi Kuu kwenda Matawi Madogo au kati ya matawi kwa usalama na uwazi.'
                    : 'Audit-ready trail of all inventory dispatches, transit tracking, waybills, and destination receipt acknowledgments.'}
                </p>
              </div>

              <button
                onClick={() => setIsTransferModalOpen(true)}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{isSw ? 'Tengeneza Uhamisho Mpya' : 'New Stock Transfer'}</span>
              </button>
            </div>

            {/* Transfer List Table */}
            <div className="overflow-x-auto border border-[#EDEBE9] rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8F8F8] text-[#605E5C] font-bold border-b border-[#EDEBE9] uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3">{isSw ? 'Namba ya Uhamisho' : 'Transfer No.'}</th>
                    <th className="p-3">{isSw ? 'Kutoka (Source)' : 'From'}</th>
                    <th className="p-3">{isSw ? 'Kwenda (Destination)' : 'To'}</th>
                    <th className="p-3">{isSw ? 'Bidhaa Zilizotumwa' : 'Items & Units'}</th>
                    <th className="p-3">{isSw ? 'Thamani (TSh)' : 'Total Valuation'}</th>
                    <th className="p-3">{isSw ? 'Hali (Status)' : 'Status'}</th>
                    <th className="p-3 text-right">{isSw ? 'Hatua' : 'Action'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EDEBE9]">
                  {transfers.map(transfer => (
                    <tr key={transfer.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-mono font-bold text-slate-800">
                        {transfer.transferNumber}
                        <div className="text-[10px] text-[#605E5C] font-normal">{transfer.dateInitiated}</div>
                      </td>
                      <td className="p-3 font-semibold text-[#323130]">
                        {transfer.sourceBranchName}
                        <div className="text-[10px] text-slate-500">{isSw ? 'Iliagizwa na:' : 'By:'} {transfer.initiatedBy}</div>
                      </td>
                      <td className="p-3 font-semibold text-[#323130]">
                        {transfer.destinationBranchName}
                        {transfer.receivedBy && (
                          <div className="text-[10px] text-emerald-600 font-medium">
                            {isSw ? 'Imepokelewa na:' : 'Recv by:'} {transfer.receivedBy}
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-[#323130]">{transfer.totalUnits} Units</div>
                        <div className="text-[10px] text-[#605E5C] max-w-xs truncate">
                          {transfer.items.map(i => `${i.productName} (${i.quantity})`).join(', ')}
                        </div>
                      </td>
                      <td className="p-3 font-bold text-[#107C10]">
                        TSh {transfer.totalValuationTzs.toLocaleString()}
                      </td>
                      <td className="p-3">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                          transfer.status === 'received'
                            ? 'bg-emerald-100 text-emerald-800'
                            : transfer.status === 'in_transit'
                            ? 'bg-amber-100 text-amber-800 animate-pulse'
                            : 'bg-slate-100 text-slate-800'
                        }`}>
                          {transfer.status === 'received' && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                          {transfer.status === 'in_transit' && <Truck className="w-3 h-3 text-amber-600" />}
                          <span>
                            {transfer.status === 'received' ? (isSw ? 'Imepokelewa' : 'Received') : (isSw ? 'Njiani (Transit)' : 'In Transit')}
                          </span>
                        </span>
                        {transfer.dispatchDriverOrWaybill && (
                          <div className="text-[10px] text-slate-500 mt-0.5 font-mono">{transfer.dispatchDriverOrWaybill}</div>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        {transfer.status === 'in_transit' ? (
                          <button
                            onClick={() => handleConfirmReceiveTransfer(transfer.id)}
                            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold text-xs shadow-xs cursor-pointer"
                          >
                            {isSw ? 'Thibitisha Kupokea' : 'Confirm Receipt'}
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-semibold">
                            {isSw ? 'Imekamilika' : 'Completed'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 6. TAB 3: ANALYTICS & COMPARISON */}
        {activeTab === 'analytics' && (
          <div className="p-5 space-y-6">
            <div>
              <h3 className="font-extrabold text-base text-[#323130]">
                {isSw ? 'Ulinganisho wa Utendaji wa Kila Tawi (Branch Analytics)' : 'Branch Sales, Turnover & Gross Profit Comparison'}
              </h3>
              <p className="text-xs text-[#605E5C]">
                {isSw
                  ? 'Tathmini tawi lipi linaloongoza kwa faida, bidhaa zinazotembea haraka kila eneo na ufanisi wa stoo.'
                  : 'Compare revenue run-rates, gross margin contribution, and inventory turnover efficiency across all business outlets.'}
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Branch Revenue Breakdown */}
              <div className="bg-white rounded-xl border border-[#EDEBE9] p-4 shadow-xs space-y-4">
                <h4 className="font-bold text-xs uppercase tracking-wider text-[#605E5C]">
                  {isSw ? 'Mchango wa Mauzo kwa Kila Tawi (Revenue Share)' : 'Revenue Share by Branch'}
                </h4>
                <div className="space-y-3">
                  {branches.map(branch => {
                    const sharePercent = totalCombinedRevenueToday > 0 
                      ? Math.round(((branch.dailyGmvTzs || 0) / totalCombinedRevenueToday) * 100) 
                      : 50;
                    return (
                      <div key={branch.id} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span>{branch.name}</span>
                          <span className="text-[#107C10] font-bold">
                            TSh {(branch.dailyGmvTzs || 0).toLocaleString()} ({sharePercent}%)
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              branch.type === 'main_hq' ? 'bg-[#0078D4]' : 'bg-[#6264A7]'
                            }`}
                            style={{ width: `${sharePercent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Stock Health per Branch */}
              <div className="bg-white rounded-xl border border-[#EDEBE9] p-4 shadow-xs space-y-4">
                <h4 className="font-bold text-xs uppercase tracking-wider text-[#605E5C]">
                  {isSw ? 'Mgawanyo wa Thamani ya Stoo (Stock Allocation)' : 'Stock Valuation per Location'}
                </h4>
                <div className="space-y-3">
                  {branches.map(branch => {
                    const stockShare = totalCombinedStockValuation > 0
                      ? Math.round(((branch.stockValuationTzs || 0) / totalCombinedStockValuation) * 100)
                      : 50;
                    return (
                      <div key={branch.id} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span>{branch.name}</span>
                          <span className="text-[#6264A7] font-bold">
                            TSh {(branch.stockValuationTzs || 0).toLocaleString()} ({stockShare}%)
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-indigo-500"
                            style={{ width: `${stockShare}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 7. TAB 4: PRICING PLANS & QUOTA */}
        {activeTab === 'pricing' && (
          <div className="p-5 space-y-6">
            <div className="max-w-3xl">
              <h3 className="font-extrabold text-lg text-[#323130]">
                {isSw ? 'Mipango ya Bei na Uwezo wa Matawi (SaaS Tiers)' : 'Subscription Plans & Branch Multi-Location Limits'}
              </h3>
              <p className="text-xs sm:text-sm text-[#605E5C] mt-1">
                {isSw
                  ? 'Mipango 3 yote ni ya malipo — vipengele ni vile vile; chagua kulingana na idadi ya matawi (1, 2, au 3).'
                  : 'All three paid plans include the same features — choose by branch count (1, 2, or 3).'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {saasPlans.map(plan => {
                const isCurrent = plan.tier === currentPlanTier;
                const isPro = plan.tier === 'biashara_pro';

                return (
                  <div
                    key={plan.id}
                    className={`rounded-2xl border-2 p-6 flex flex-col justify-between transition-all relative ${
                      isCurrent
                        ? 'border-[#6264A7] bg-white shadow-md ring-2 ring-[#6264A7]/20'
                        : isPro
                        ? 'border-indigo-300 bg-white'
                        : 'border-[#E1DFDD] bg-[#F8F8F8]'
                    }`}
                  >
                    {isCurrent && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#6264A7] text-white text-[10px] font-extrabold px-3 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
                        {isSw ? 'Mpango Wako wa Sasa' : 'Your Current Plan'}
                      </div>
                    )}

                    <div>
                      <div className="text-xs font-bold text-[#6264A7] uppercase">{plan.name}</div>
                      <span className="inline-block mt-1.5 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-100">
                        {planBranchLabel(plan, isSw)}
                      </span>
                      <div className="mt-2 flex items-baseline gap-1">
                        <span className="text-3xl font-extrabold text-[#323130]">
                          {formatPlanPrice(plan, isSw).replace('TZS ', 'TSh ')}
                        </span>
                        <span className="text-xs text-[#605E5C]">/{isSw ? 'mwezi' : 'month'}</span>
                      </div>

                      <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[#605E5C]">{isSw ? 'Upeo wa Matawi:' : 'Max Branches:'}</span>
                          <strong className="text-[#323130] font-bold">
                            {`${plan.maxBranches} ${isSw ? 'Matawi' : 'Branches'}`}
                          </strong>
                        </div>
                      </div>

                      <div className="mt-4 space-y-2 text-xs text-[#323130]">
                        {plan.features.map((feat, idx) => (
                          <div key={idx} className="flex items-start gap-2">
                            <Check className="w-4 h-4 text-[#107C10] shrink-0 mt-0.5" />
                            <span>{feat}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-6">
                      <button
                        onClick={() => handleSelectPlanTier(plan.tier)}
                        disabled={isCurrent}
                        className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          isCurrent
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 font-extrabold cursor-default'
                            : isPro
                            ? 'bg-[#6264A7] hover:bg-[#525492] text-white shadow-xs'
                            : 'bg-white border border-[#C8C6C4] hover:bg-slate-50 text-[#323130]'
                        }`}
                      >
                        {isCurrent ? (isSw ? '✓ Mpango Ulio nao' : '✓ Active Plan') : (isSw ? `Chagua ${plan.name}` : `Select ${plan.name}`)}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 8. MODAL: ADD / EDIT BRANCH */}
      {isAddBranchModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[min(90vh,calc(100dvh-2rem))] flex flex-col shadow-2xl border border-[#E1DFDD] animate-in fade-in zoom-in-95 my-auto">
            <div className="flex items-center justify-between shrink-0 px-6 pt-6 pb-4 border-b border-[#EDEBE9]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#6264A7] text-white flex items-center justify-center font-bold">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-[#323130]">
                    {editingBranch ? (isSw ? 'Hariri Taarifa za Tawi' : 'Edit Branch Details') : (isSw ? 'Sajili Tawi Jipya (Sub-Branch)' : 'Add New Sub-Branch')}
                  </h3>
                  <p className="text-[11px] text-[#605E5C]">
                    {isSw ? 'Weka maelezo ya tawi litakalotengwa (Isolated Station)' : 'Configure isolated branch parameters'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddBranchModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBranch} className="flex flex-col flex-1 min-h-0 text-xs">
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <div>
                <label className="font-bold text-[#323130] block mb-1">
                  {isSw ? 'Jina la Tawi *' : 'Branch Name *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={isSw ? 'Mfano: Mlimani City Mall Branch' : 'e.g. Mlimani City Mall Branch'}
                  value={branchFormData.name}
                  onChange={(e) => setBranchFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-[#C8C6C4] rounded-lg outline-none focus:border-[#6264A7]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-[#323130] block mb-1">
                    {isSw ? 'Aina ya Tawi' : 'Branch Type'}
                  </label>
                  <select
                    value={branchFormData.type}
                    onChange={(e: any) => setBranchFormData(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-[#C8C6C4] rounded-lg outline-none"
                  >
                    <option value="sub_branch">{isSw ? 'Tawi Dogo (Sub-Branch)' : 'Sub-Branch'}</option>
                    <option value="warehouse">{isSw ? 'Stoo Kuu (Warehouse)' : 'Central Warehouse'}</option>
                    <option value="main_hq">{isSw ? 'Makao Makuu (HQ)' : 'Headquarters'}</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-[#323130] block mb-1">
                    {isSw ? 'Mkoa (Region)' : 'Region'}
                  </label>
                  <select
                    value={branchFormData.region}
                    onChange={(e) => setBranchFormData(prev => ({ ...prev, region: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-[#C8C6C4] rounded-lg outline-none"
                  >
                    <option value="Dar es Salaam">Dar es Salaam</option>
                    <option value="Arusha">Arusha</option>
                    <option value="Mwanza">Mwanza</option>
                    <option value="Dodoma">Dodoma</option>
                    <option value="Zanzibar">Zanzibar</option>
                    <option value="Mbeya">Mbeya</option>
                    <option value="Morogoro">Morogoro</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-[#323130] block mb-1">
                    {isSw ? 'Wilaya / Eneo *' : 'District / Area *'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kinondoni (Sam Nujoma)"
                    value={branchFormData.district}
                    onChange={(e) => setBranchFormData(prev => ({ ...prev, district: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-[#C8C6C4] rounded-lg outline-none"
                  />
                </div>

                {editingBranch ? (
                  <div>
                    <label className="font-bold text-[#323130] block mb-1">
                      {isSw ? 'Meneja wa Tawi' : 'Branch Manager'}
                    </label>
                    <select
                      value={branchFormData.managerStaffId}
                      onChange={(e) => setBranchFormData(prev => ({ ...prev, managerStaffId: e.target.value }))}
                      className="w-full px-3 py-2 bg-white border border-[#C8C6C4] rounded-lg outline-none"
                    >
                      <option value="">{isSw ? '-- Chagua Meneja --' : '-- Select Staff Member --'}</option>
                      {staffMembers.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </div>

              {!editingBranch && (
                <div className="rounded-xl border border-[#6264A7]/25 bg-[#6264A7]/5 p-3 space-y-3">
                  <p className="text-[11px] font-bold text-[#6264A7] uppercase tracking-wide">
                    {isSw ? 'Akaunti ya Meneja wa Tawi (Ingia & Kazi)' : 'Branch Admin Login (isolated workspace)'}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="font-bold text-[#323130] block mb-1">
                        {isSw ? 'Jina la Meneja *' : 'Admin Full Name *'}
                      </label>
                      <input
                        type="text"
                        required
                        value={branchFormData.adminName}
                        onChange={(e) => setBranchFormData(prev => ({ ...prev, adminName: e.target.value }))}
                        className="w-full px-3 py-2 bg-white border border-[#C8C6C4] rounded-lg outline-none"
                        placeholder={isSw ? 'Mfano: Mwajuma Rashid' : 'e.g. Mwajuma Rashid'}
                      />
                    </div>
                    <div>
                      <label className="font-bold text-[#323130] block mb-1">
                        {isSw ? 'Barua Pepe ya Kuingia *' : 'Login Email *'}
                      </label>
                      <input
                        type="email"
                        required
                        value={branchFormData.adminEmail}
                        onChange={(e) => setBranchFormData(prev => ({ ...prev, adminEmail: e.target.value }))}
                        className="w-full px-3 py-2 bg-white border border-[#C8C6C4] rounded-lg outline-none"
                        placeholder="manager@duka.co.tz"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-[#323130] block mb-1">
                        {isSw ? 'Simu' : 'Phone'}
                      </label>
                      <input
                        type="text"
                        value={branchFormData.adminPhone}
                        onChange={(e) => setBranchFormData(prev => ({ ...prev, adminPhone: e.target.value }))}
                        className="w-full px-3 py-2 bg-white border border-[#C8C6C4] rounded-lg outline-none"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="font-bold text-[#323130] block mb-1">
                        {isSw ? 'Nenosiri la Kuanza *' : 'Initial Password *'}
                      </label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={branchFormData.adminPassword}
                        onChange={(e) => setBranchFormData(prev => ({ ...prev, adminPassword: e.target.value }))}
                        className="w-full px-3 py-2 bg-white border border-[#C8C6C4] rounded-lg outline-none"
                        placeholder={isSw ? 'Angalau herufi 6' : 'At least 6 characters'}
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-[#605E5C]">
                    {isSw
                      ? 'Meneja ataingia kwa barua pepe hii na kuona data ya tawi hili pekee. Mmiliki anaona matawi yote.'
                      : 'This manager logs in with this email and sees only this branch. The owner can track all branches.'}
                  </p>
                </div>
              )}

              <div>
                <label className="font-bold text-[#323130] block mb-1">
                  {isSw ? 'Anwani Kamili ya Mtaa *' : 'Street Address *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder="Plot / Shop number, Street name"
                  value={branchFormData.address}
                  onChange={(e) => setBranchFormData(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-[#C8C6C4] rounded-lg outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-[#323130] block mb-1">
                    {isSw ? 'Simu ya Tawi' : 'Branch Phone'}
                  </label>
                  <input
                    type="text"
                    value={branchFormData.phone}
                    onChange={(e) => setBranchFormData(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-[#C8C6C4] rounded-lg outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-[#323130] block mb-1">
                    {isSw ? 'Muda wa Kazi' : 'Opening Hours'}
                  </label>
                  <input
                    type="text"
                    value={branchFormData.openingHours}
                    onChange={(e) => setBranchFormData(prev => ({ ...prev, openingHours: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-[#C8C6C4] rounded-lg outline-none"
                  />
                </div>
              </div>

              {editingBranch && (
                <div>
                  <label className="font-bold text-[#323130] block mb-1">
                    {isSw ? 'Hali ya Kodi (VAT)' : 'Tax status (VAT)'}
                  </label>
                  <select
                    value={branchFormData.vatTaxStatus}
                    onChange={e => setBranchFormData(prev => ({
                      ...prev,
                      vatTaxStatus: e.target.value as 'inherit' | 'vat_registered' | 'not_vat_registered',
                    }))}
                    className="w-full px-3 py-2 bg-white border border-[#C8C6C4] rounded-lg outline-none text-sm"
                  >
                    <option value="inherit">{isSw ? 'Rudi kwa mpangilio wa biashara' : 'Inherit organization default'}</option>
                    <option value="vat_registered">{isSw ? 'Msajili wa VAT' : 'VAT Registered'}</option>
                    <option value="not_vat_registered">{isSw ? 'Sio msajili wa VAT' : 'Not VAT Registered'}</option>
                  </select>
                </div>
              )}

              {branchSaveError && (
                <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2">
                  {branchSaveError}
                </div>
              )}
              </div>

              <div className="shrink-0 px-6 py-4 border-t border-[#EDEBE9] flex items-center justify-end gap-2 bg-white rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => setIsAddBranchModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-[#C8C6C4] text-[#323130] font-bold hover:bg-[#F8F8F8]"
                  disabled={branchSaving}
                >
                  {isSw ? 'Ghairi' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={branchSaving}
                  className="px-5 py-2 rounded-lg bg-[#6264A7] hover:bg-[#525492] text-white font-bold shadow-xs cursor-pointer disabled:opacity-60"
                >
                  {branchSaving
                    ? (isSw ? 'Inasajili...' : 'Creating...')
                    : editingBranch
                      ? (isSw ? 'Hifadhi Mabadiliko' : 'Save Changes')
                      : (isSw ? 'Sajili Tawi Sasa' : 'Register Branch')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 9. MODAL: INTER-BRANCH STOCK TRANSFER */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-[#E1DFDD] animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-[#EDEBE9]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-bold">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-[#323130]">
                    {isSw ? 'Tengeneza Uhamisho wa Stoo (IBT Dispatch)' : 'Create Inter-Branch Stock Transfer'}
                  </h3>
                  <p className="text-[11px] text-[#605E5C]">
                    {isSw ? 'Hamisha bidhaa toka tawi moja kwenda tawi lingine kwa nambari ya waybill' : 'Transfer inventory with automatic origin deduction'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsTransferModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTransfer} className="space-y-4 pt-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <label className="font-bold text-[#323130] block mb-1">
                    {isSw ? 'Kutoka (Source Branch) *' : 'Origin Branch *'}
                  </label>
                  <select
                    value={transferSourceId}
                    onChange={(e) => setTransferSourceId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#C8C6C4] rounded-lg outline-none font-semibold"
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-[#323130] block mb-1">
                    {isSw ? 'Kwenda (Destination) *' : 'Destination Branch *'}
                  </label>
                  <select
                    value={transferDestId}
                    onChange={(e) => setTransferDestId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#C8C6C4] rounded-lg outline-none font-semibold"
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Product Selection Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="font-bold text-[#323130]">
                    {isSw ? 'Chagua Bidhaa na Idadi *' : 'Select Transfer Products & Quantities *'}
                  </label>
                  <button
                    type="button"
                    onClick={() => setTransferItems(prev => [...prev, { productId: products[0]?.id || '', quantity: 1 }])}
                    className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isSw ? 'Ongeza Bidhaa Nyingine' : 'Add Another Product'}</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {transferItems.map((item, idx) => {
                    const selectedProd = products.find(p => p.id === item.productId);
                    return (
                      <div key={idx} className="flex items-center gap-2 bg-[#F8F8F8] p-2 rounded-lg border border-[#EDEBE9]">
                        <select
                          value={item.productId}
                          onChange={(e) => {
                            const val = e.target.value;
                            setTransferItems(prev => prev.map((itm, i) => i === idx ? { ...itm, productId: val } : itm));
                          }}
                          className="flex-1 px-2.5 py-1.5 bg-white border border-[#C8C6C4] rounded-md outline-none text-xs"
                        >
                          {products.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.name} (Stoo Kuu: {p.stock} {p.unit})
                            </option>
                          ))}
                        </select>

                        <div className="w-24">
                          <input
                            type="number"
                            min="1"
                            max={selectedProd ? selectedProd.stock : 999}
                            value={item.quantity}
                            onChange={(e) => {
                              const qty = parseInt(e.target.value) || 1;
                              setTransferItems(prev => prev.map((itm, i) => i === idx ? { ...itm, quantity: qty } : itm));
                            }}
                            className="w-full px-2.5 py-1.5 bg-white border border-[#C8C6C4] rounded-md outline-none text-xs font-bold"
                          />
                        </div>

                        {transferItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setTransferItems(prev => prev.filter((_, i) => i !== idx))}
                            className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-[#323130] block mb-1">
                    {isSw ? 'Dereva / Waybill No.' : 'Driver / Waybill / Boda'}
                  </label>
                  <input
                    type="text"
                    placeholder="Mfano: Waybill #WB-991 au Juma Boda"
                    value={transferWaybill}
                    onChange={(e) => setTransferWaybill(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#C8C6C4] rounded-lg outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-[#323130] block mb-1">
                    {isSw ? 'Maelezo ya Ziada (Notes)' : 'Transfer Notes'}
                  </label>
                  <input
                    type="text"
                    placeholder="Mfano: Restock ya haraka"
                    value={transferNotes}
                    onChange={(e) => setTransferNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#C8C6C4] rounded-lg outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-[#EDEBE9] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-[#C8C6C4] text-[#323130] font-bold hover:bg-[#F8F8F8]"
                >
                  {isSw ? 'Ghairi' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span>{isSw ? 'Tuma Mzigo Sasa' : 'Dispatch Transfer'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 10. MODAL: UPGRADE TO ENTERPRISE */}
      {isUpgradeModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-[#E1DFDD] animate-in fade-in zoom-in-95 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#EDEBE9]">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center font-bold">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-[#323130]">
                    {isSw ? 'Boresha Mpango wa Matawi (Upgrade SaaS Tier)' : 'Unlock More Store Branches'}
                  </h3>
                  <p className="text-[11px] text-[#605E5C]">
                    {isSw ? 'Mpango wako wa sasa umefikia kikomo cha matawi' : 'Expand your footprint across Tanzania'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsUpgradeModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>{isSw ? 'Kikomo cha Matawi Kimefikiwa:' : 'Branch Quota Limit Reached:'}</strong>
                <p className="mt-0.5">
                  {isSw 
                    ? `Mpango wa ${currentPlan.name} (TSh ${currentPlan.priceMonthlyTzs.toLocaleString()}/mwezi) unaruhusu hadi matawi ${currentPlan.maxBranches}. Boresha mpango ili kuongeza idadi ya matawi.`
                    : `Your current plan allows up to ${currentPlan.maxBranches} branch(es). Upgrade to add more branches.`}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {saasPlans.filter(plan => plan.maxBranches > currentPlan.maxBranches).map(plan => {
                const isSelected = currentPlanTier === plan.tier;
                const isEnterprise = plan.tier === 'enterprise_chain';
                return (
                  <div
                    key={plan.tier}
                    onClick={() => handleSelectPlanTier(plan.tier)}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                      isEnterprise
                        ? 'border-amber-500 bg-amber-50/20 hover:bg-amber-50/50 ring-2 ring-amber-500/20'
                        : isSelected
                        ? 'border-[#6264A7] bg-blue-50/40'
                        : 'border-[#E1DFDD] hover:border-slate-400'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-sm text-[#323130]">{plan.name}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                          isEnterprise ? 'bg-amber-200 text-amber-900' : 'bg-teal-100 text-teal-800'
                        }`}>
                          {planBranchLabel(plan, isSw)}
                        </span>
                      </div>
                      <div className="text-xs text-[#605E5C] mt-0.5">
                        {isSw
                          ? `Hadi matawi ${plan.maxBranches} • Vipengele vile vile`
                          : `Up to ${plan.maxBranches} branch(es) • Same features`}
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <div className="font-extrabold text-base text-[#107C10]">
                        TSh {plan.priceMonthlyTzs.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-[#605E5C]">/{isSw ? 'mwezi' : 'mo'}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-[#EDEBE9] flex items-center justify-between text-xs text-[#605E5C]">
              <span>{isSw ? 'Lipa kupitia M-Pesa, Tigo Pesa au Benki' : 'Instant Activation via Mobile Money / Bank'}</span>
              <button
                onClick={() => setIsUpgradeModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-[#323130] text-white font-bold cursor-pointer"
              >
                {isSw ? 'Funga' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
