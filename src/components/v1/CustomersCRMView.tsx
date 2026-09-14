import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  Phone, 
  Mail, 
  MapPin, 
  CreditCard, 
  AlertCircle, 
  CheckCircle2, 
  Send, 
  Sparkles, 
  FileText, 
  Sliders, 
  ArrowUpRight,
  TrendingDown,
  Calendar,
  X,
  Clock,
  Award
} from 'lucide-react';
import { Customer, Language, DunningStage, AuthUser } from '@/types/v1';
import { getTranslation, formatTSh } from '@/utils/translations';
import { ActionBar } from '@/components/v1/ActionBar';
import { exportCustomerLedger } from '@/utils/reportGenerator';
import confetti from 'canvas-confetti';
import { api } from '@/lib/api';
import { mapCustomer, customerToApiPayload, filterByBranchId } from '@/lib/apiSync';
import { runWithOfflineQueue } from '@/lib/offlineMutations';
import { useOfflineStore } from '@/stores';
import type { SyncQueueItem } from '@/lib/transactionEngine';

interface CustomersCRMViewProps {
  language: Language;
  customers: Customer[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
  onCustomersChanged?: () => void | Promise<void>;
  onOpenAIChatWithPrompt?: (prompt: string) => void;
  currentUser?: AuthUser | null;
  tenantId?: string;
  enqueueSyncItem?: (item: SyncQueueItem) => void;
  onQueueMutation?: (entityType: string) => void;
  activeBranchId?: string | null;
}

export const CustomersCRMView: React.FC<CustomersCRMViewProps> = ({
  language,
  customers,
  setCustomers,
  onCustomersChanged,
  onOpenAIChatWithPrompt,
  currentUser,
  tenantId,
  enqueueSyncItem,
  onQueueMutation,
  activeBranchId,
}) => {
  const t = (key: any) => getTranslation(language, key);
  const isSw = language === 'sw';
  const isOnline = useOfflineStore(s => s.isOnline);
  const storageId = tenantId || currentUser?.businessId || currentUser?.id || 'local';
  const enqueue = enqueueSyncItem ?? (() => {});

  const branchCustomers = useMemo(
    () => filterByBranchId(customers, activeBranchId),
    [customers, activeBranchId],
  );

  const handleExportCustomers = () => {
    const totalReceivables = customers.reduce((s, c) => s + (c.outstandingBalance || c.creditLimit - c.creditLimit + (c as any).balance || 0), 0);
    exportCustomerLedger({
      provider: {
        businessName: currentUser?.businessName || 'Duka+ Business',
        ownerName:    currentUser?.name          || 'Owner',
        email:        currentUser?.email         || '',
        phone:        (currentUser as any)?.phone,
        tinNumber:    (currentUser as any)?.tinNumber,
        businessType: currentUser?.businessType,
      },
      customers: customers.map(c => ({
        name:      c.name,
        phone:     c.phone,
        purchases: formatTSh((c as any).totalPurchases || 0),
        balance:   formatTSh((c as any).balance || c.outstandingBalance || 0),
        lastSeen:  (c as any).lastPurchaseDate || (c as any).lastSeen || '—',
      })),
      totalReceivables: formatTSh(totalReceivables),
      language: language as 'en' | 'sw',
    });
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(customers[0]?.id || null);
  const [filterRisk, setFilterRisk] = useState<string>('all');
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [smsNotificationMsg, setSmsNotificationMsg] = useState<string | null>(null);

  // New Customer Form State
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    phone: '',
    email: '',
    address: 'Dar es Salaam, Tanzania',
    creditLimit: 300000,
    notes: '',
  });

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId) || customers[0];

  useEffect(() => {
    void onCustomersChanged?.();
  }, []);

  useEffect(() => {
    if (branchCustomers.length === 0) {
      setSelectedCustomerId(null);
      return;
    }
    if (!selectedCustomerId || !branchCustomers.some(c => c.id === selectedCustomerId)) {
      setSelectedCustomerId(branchCustomers[0].id);
    }
  }, [branchCustomers, selectedCustomerId]);

  const filteredCustomers = branchCustomers.filter(c => {
    const email = (c.email ?? '').toLowerCase();
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery) ||
      email.includes(searchQuery.toLowerCase());
    const matchesRisk = filterRisk === 'all' || (c.riskScore ?? 'Low').toLowerCase() === filterRisk.toLowerCase();
    return matchesSearch && matchesRisk;
  });

  // Action: Add new customer
  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomer.name || !newCustomer.phone) return;

    const payload = customerToApiPayload({
      name: newCustomer.name,
      phone: newCustomer.phone,
      email: newCustomer.email,
      address: newCustomer.address,
      creditLimit: Number(newCustomer.creditLimit),
    }, activeBranchId);
    const tempId = `local-cust-${Date.now()}`;

    try {
      const outcome = await runWithOfflineQueue({
        isOnline,
        tenantId: storageId,
        entity_type: 'customer',
        entity_id: tempId,
        action: 'create',
        payload,
        enqueue,
        executeOnline: async () => {
          const raw = await api.createCustomer(payload);
          const created = {
            ...mapCustomer(raw as Record<string, unknown>),
            branchId: (raw as { branch_id?: string }).branch_id ?? activeBranchId ?? undefined,
          };
          setCustomers(prev => {
            const scoped = filterByBranchId(prev, activeBranchId);
            return [created, ...scoped.filter(c => c.id !== created.id)];
          });
          setSelectedCustomerId(created.id);
          await onCustomersChanged?.();
        },
        onQueued: () => onQueueMutation?.('customer'),
      });

      if (outcome === 'queued') {
        const localCustomer: Customer = {
          id: tempId,
          branchId: activeBranchId ?? undefined,
          name: newCustomer.name,
          phone: newCustomer.phone,
          email: newCustomer.email,
          address: newCustomer.address,
          creditLimit: Number(newCustomer.creditLimit),
          balance: 0,
          totalPurchases: 0,
          loyaltyPoints: 0,
          riskScore: 'Low',
          daysOverdue: 0,
          dunningStage: 'cleared',
        };
        setCustomers(prev => {
          const scoped = filterByBranchId(prev, activeBranchId);
          return [localCustomer, ...scoped];
        });
        setSelectedCustomerId(tempId);
      }

      setIsAddingNew(false);
      setNewCustomer({ name: '', phone: '', email: '', address: 'Dar es Salaam, Tanzania', creditLimit: 300000, notes: '' });
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
    } catch (err) {
      alert((err as Error).message);
    }
  };

  // Action: Send Dunning SMS / Statement
  const handleSendReminderSMS = (cust: Customer) => {
    const msg = language === 'sw'
      ? `Habari ${cust.name}, tunakukumbusha salio lako la mkopo katika Al-Falah Pharmacy ni ${formatTSh(cust.balance)}. Tafadhali lipa kupitia M-Pesa Lipa Namba 552099.`
      : `Dear ${cust.name}, friendly reminder that your outstanding account balance at Al-Falah Pharmacy is ${formatTSh(cust.balance)}. Please remit via M-Pesa Till 552099.`;
    
    setSmsNotificationMsg(`SMS Queued for ${cust.phone}: "${msg}"`);
    setTimeout(() => setSmsNotificationMsg(null), 6000);
  };

  // Action: Adjust Credit Limit
  const handleAdjustCredit = async (cust: Customer, delta: number) => {
    const newLimit = Math.max(50000, cust.creditLimit + delta);
    const payload = { credit_limit: newLimit };
    try {
      const outcome = await runWithOfflineQueue({
        isOnline,
        tenantId: storageId,
        entity_type: 'customer',
        entity_id: cust.id,
        action: 'update',
        payload,
        enqueue,
        executeOnline: async () => {
          const raw = await api.updateCustomer(cust.id, payload);
          const updated = mapCustomer(raw as Record<string, unknown>);
          setCustomers(prev => prev.map(c => c.id === cust.id ? updated : c));
        },
        onQueued: () => onQueueMutation?.('customer'),
      });
      if (outcome === 'queued') {
        setCustomers(prev => prev.map(c => c.id === cust.id ? { ...c, creditLimit: newLimit } : c));
      }
    } catch (err) {
      alert((err as Error).message);
    }
  };

  return (
    <div className="space-y-5 pb-12">
      {/* View Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#323130] tracking-tight">{t('customers')}</h2>
          <p className="text-xs text-[#605E5C]">
            Integrated CRM • Credit Scoring • 5-Stage Dunning Workflow • Loyalty Rewards
          </p>
        </div>

        <button
          id="btn-register-customer-top"
          onClick={() => setIsAddingNew(!isAddingNew)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#6264A7] hover:bg-[#555793] text-white font-semibold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{isAddingNew ? t('cancel') : t('addCustomer')}</span>
        </button>
      </div>

      {/* Action Notification Toast */}
      {smsNotificationMsg && (
        <div className="p-3 bg-[#107C10]/10 border border-[#107C10]/30 rounded-xl text-xs text-[#107C10] font-medium flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#107C10]" />
            <span>{smsNotificationMsg}</span>
          </div>
          <button onClick={() => setSmsNotificationMsg(null)} className="text-xs underline">Dismiss</button>
        </div>
      )}

      {/* FULL-WIDTH ACTION BAR */}
      <ActionBar
        language={language}
        onAdd={() => setIsAddingNew(true)}
        onView={() => selectedCustomer && handleSendReminderSMS(selectedCustomer)}
        onAISuggest={() => {
          if (onOpenAIChatWithPrompt && selectedCustomer) {
            onOpenAIChatWithPrompt(`Fanya uchambuzi wa hatari ya mkopo (Credit Risk Assessment) kwa mteja ${selectedCustomer.name} mwenye deni la ${formatTSh(selectedCustomer.balance)} na kikomo cha ${formatTSh(selectedCustomer.creditLimit)}.`);
          }
        }}
        onExport={handleExportCustomers}
        customAddLabel="➕ Register Customer"
        selectedCount={selectedCustomerId ? 1 : 0}
        totalCount={customers.length}
      />

      {/* INLINE CUSTOMER REGISTRATION FORM (When toggled) */}
      {isAddingNew && (
        <form 
          onSubmit={handleSaveCustomer} 
          className="bg-white rounded-xl p-5 border-2 border-[#6264A7] shadow-md space-y-4"
        >
          <div className="flex items-center justify-between border-b border-[#F3F2F1] pb-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-[#6264A7]" />
              <h3 className="font-bold text-sm text-[#323130]">{t('addCustomer')}</h3>
            </div>
            <button 
              type="button" 
              onClick={() => setIsAddingNew(false)}
              className="text-[#605E5C] hover:text-[#323130]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#323130] mb-1">Full Customer Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Maria Kato"
                value={newCustomer.name}
                onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-[#F3F2F1] border border-[#EDEBE9] rounded-lg focus:bg-white focus:border-[#0078D4] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#323130] mb-1">Phone Number (Tanzania) *</label>
              <input
                type="text"
                required
                placeholder="e.g. +255 784 987 654"
                value={newCustomer.phone}
                onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-[#F3F2F1] border border-[#EDEBE9] rounded-lg focus:bg-white focus:border-[#0078D4] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#323130] mb-1">Initial Credit Limit (TSh)</label>
              <input
                type="number"
                step="50000"
                value={newCustomer.creditLimit}
                onChange={e => setNewCustomer({ ...newCustomer, creditLimit: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs bg-[#F3F2F1] border border-[#EDEBE9] rounded-lg focus:bg-white focus:border-[#0078D4] outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#323130] mb-1">Physical Address / Location</label>
              <input
                type="text"
                placeholder="e.g. Kariakoo Street, Dar es Salaam"
                value={newCustomer.address}
                onChange={e => setNewCustomer({ ...newCustomer, address: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-[#F3F2F1] border border-[#EDEBE9] rounded-lg focus:bg-white focus:border-[#0078D4] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#323130] mb-1">Customer Category / Notes</label>
              <input
                type="text"
                placeholder="e.g. Chronic prescription holder, verified clinic staff"
                value={newCustomer.notes}
                onChange={e => setNewCustomer({ ...newCustomer, notes: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-[#F3F2F1] border border-[#EDEBE9] rounded-lg focus:bg-white focus:border-[#0078D4] outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAddingNew(false)}
              className="px-4 py-2 text-xs font-semibold text-[#605E5C] bg-[#F3F2F1] rounded-lg hover:bg-[#EDEBE9]"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-white bg-[#6264A7] hover:bg-[#555793] rounded-lg shadow-xs"
            >
              {t('save')} Customer Record
            </button>
          </div>
        </form>
      )}

      {/* MAIN TWO-COLUMN CRM LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT LIST COLUMN (5 COLS) */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-[#E1DFDD] shadow-xs flex flex-col overflow-hidden">
          {/* Search & Filter Bar */}
          <div className="p-3 border-b border-[#F3F2F1] space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 text-[#605E5C] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search name, phone, email..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#F3F2F1] border border-transparent focus:border-[#0078D4] focus:bg-white rounded-lg outline-none"
              />
            </div>

            <div className="flex items-center gap-1 text-xs">
              <span className="text-[11px] text-[#605E5C] font-semibold mr-1">Risk:</span>
              {['all', 'low', 'medium', 'high'].map(risk => (
                <button
                  key={risk}
                  onClick={() => setFilterRisk(risk)}
                  className={`px-2.5 py-0.5 rounded-md capitalize text-[11px] font-medium transition-all ${
                    filterRisk === risk
                      ? 'bg-[#6264A7] text-white font-bold'
                      : 'bg-[#F3F2F1] text-[#605E5C] hover:text-[#323130]'
                  }`}
                >
                  {risk}
                </button>
              ))}
            </div>
          </div>

          {/* Customer Scroll List */}
          <div className="divide-y divide-[#F3F2F1] max-h-[580px] overflow-y-auto">
            {filteredCustomers.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#605E5C]">
                {customers.length === 0
                  ? (isSw
                    ? 'Hakuna wateja bado. Sajili mteja hapa au kwenye POS.'
                    : 'No customers yet. Register here or from POS checkout.')
                  : (isSw ? 'Hakuna wateja wanaolingana na utafutaji.' : 'No customers match your search.')}
              </div>
            ) : filteredCustomers.map(cust => {
              const isSelected = cust.id === selectedCustomerId;
              const creditUsagePct = Math.min(100, Math.round((cust.balance / cust.creditLimit) * 100));

              return (
                <div
                  key={cust.id}
                  onClick={() => setSelectedCustomerId(cust.id)}
                  className={`p-3.5 flex items-start justify-between gap-3 cursor-pointer transition-colors ${
                    isSelected ? 'bg-[#F0F2FA] border-l-4 border-[#6264A7]' : 'hover:bg-[#FAF9F8]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full ${cust.avatarColor} text-white font-bold text-xs flex items-center justify-center ring-2 ring-white shadow-xs`}>
                      {cust.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#323130]">{cust.name}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                          cust.loyaltyTier === 'Gold' ? 'bg-amber-100 text-amber-800' :
                          cust.loyaltyTier === 'Silver' ? 'bg-slate-200 text-slate-700' : 'bg-orange-100 text-orange-800'
                        }`}>
                          {cust.loyaltyTier}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#605E5C] font-mono">{cust.phone}</div>
                      
                      {/* Mini Credit Bar */}
                      <div className="mt-1.5 w-36">
                        <div className="flex justify-between text-[9px] text-[#605E5C] font-semibold mb-0.5">
                          <span>{formatTSh(cust.balance)}</span>
                          <span>{creditUsagePct}%</span>
                        </div>
                        <div className="w-full bg-[#EDEBE9] h-1.5 rounded-full overflow-hidden">
                          <div
                            style={{ width: `${creditUsagePct}%` }}
                            className={`h-full ${
                              creditUsagePct > 80 ? 'bg-[#D13438]' : creditUsagePct > 50 ? 'bg-[#FFB900]' : 'bg-[#107C10]'
                            }`}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      cust.riskScore === 'High' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                      cust.riskScore === 'Medium' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                      'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    }`}>
                      {cust.riskScore} Risk
                    </span>
                    {cust.daysOverdue > 0 && (
                      <div className="text-[10px] text-[#D13438] font-bold mt-1">
                        {cust.daysOverdue}d overdue
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT DETAIL CRM PROFILE CARD (7 COLS) */}
        <div className="lg:col-span-7 space-y-4">
          {selectedCustomer ? (
            <div className="bg-white rounded-xl border border-[#E1DFDD] p-5 shadow-xs space-y-5">
              {/* Profile Header */}
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#F3F2F1] pb-4">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl ${selectedCustomer.avatarColor} text-white font-extrabold text-xl flex items-center justify-center shadow-md`}>
                    {selectedCustomer.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-[#323130]">{selectedCustomer.name}</h3>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#6264A7]/10 text-[#6264A7] border border-[#6264A7]/20">
                        {selectedCustomer.loyaltyTier} Tier
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-[#605E5C] mt-1">
                      <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5 text-[#0078D4]" /> {selectedCustomer.phone}</span>
                      <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5 text-[#6264A7]" /> {selectedCustomer.email}</span>
                      <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-[#107C10]" /> {selectedCustomer.address}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSendReminderSMS(selectedCustomer)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0078D4] hover:bg-[#006cbd] text-white text-xs font-semibold shadow-xs transition-all active:scale-95"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send SMS</span>
                  </button>
                  <button
                    onClick={() => {
                      if (onOpenAIChatWithPrompt) {
                        onOpenAIChatWithPrompt(`Chambua historia ya ununuzi na utabiri uwezo wa malipo wa mteja ${selectedCustomer.name}.`);
                      }
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-indigo-600 text-white text-xs font-semibold shadow-xs"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>AI Score</span>
                  </button>
                </div>
              </div>

              {/* Credit & Dunning Stage Status Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-[#F8F8F8] rounded-xl border border-[#EDEBE9]">
                  <div className="text-[11px] font-semibold text-[#605E5C]">Current Outstanding Debt</div>
                  <div className="text-lg font-extrabold text-[#D13438] mt-0.5">
                    {formatTSh(selectedCustomer.balance)}
                  </div>
                  <div className="text-[10px] text-[#605E5C] mt-1">
                    Limit: {formatTSh(selectedCustomer.creditLimit)}
                  </div>
                </div>

                <div className="p-3 bg-[#F8F8F8] rounded-xl border border-[#EDEBE9]">
                  <div className="text-[11px] font-semibold text-[#605E5C]">Dunning Collection Stage</div>
                  <div className="text-sm font-bold text-[#323130] mt-1 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    <span className="capitalize">{(selectedCustomer.dunningStage || 'cleared').replace(/_/g, ' ')}</span>
                  </div>
                  <div className="text-[10px] text-[#D13438] font-semibold mt-1">
                    {selectedCustomer.daysOverdue > 0 ? `${selectedCustomer.daysOverdue} days overdue` : 'Up to date'}
                  </div>
                </div>

                <div className="p-3 bg-[#F8F8F8] rounded-xl border border-[#EDEBE9]">
                  <div className="text-[11px] font-semibold text-[#605E5C]">Loyalty Points Earned</div>
                  <div className="text-lg font-extrabold text-[#107C10] mt-0.5 flex items-center gap-1">
                    <Award className="w-4 h-4 text-amber-500" />
                    <span>{selectedCustomer.loyaltyPoints} pts</span>
                  </div>
                  <div className="text-[10px] text-[#605E5C] mt-1">
                    Total LTV: {formatTSh(selectedCustomer.totalPurchases)}
                  </div>
                </div>
              </div>

              {/* Quick Credit Limit Adjuster */}
              <div className="p-3.5 bg-[#FAF9F8] rounded-xl border border-[#EDEBE9] flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-[#323130]">Credit Limit Controller</div>
                  <div className="text-[11px] text-[#605E5C]">Authorize higher or lower credit bounds based on payment punctuality.</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleAdjustCredit(selectedCustomer, -50000)}
                    className="px-2.5 py-1 text-xs font-bold bg-white hover:bg-rose-50 text-[#D13438] border border-rose-200 rounded-lg shadow-xs"
                  >
                    -50k TSh
                  </button>
                  <button
                    onClick={() => handleAdjustCredit(selectedCustomer, 50000)}
                    className="px-2.5 py-1 text-xs font-bold bg-white hover:bg-emerald-50 text-[#107C10] border border-emerald-200 rounded-lg shadow-xs"
                  >
                    +50k TSh
                  </button>
                  <button
                    onClick={() => handleAdjustCredit(selectedCustomer, 100000)}
                    className="px-2.5 py-1 text-xs font-bold bg-[#6264A7] hover:bg-[#555793] text-white rounded-lg shadow-xs"
                  >
                    +100k TSh
                  </button>
                </div>
              </div>

              {/* Customer Notes & Prescription History */}
              <div>
                <h4 className="text-xs font-bold text-[#323130] uppercase tracking-wider mb-2">Customer Profile Notes</h4>
                <div className="p-3 bg-[#F8F8F8] rounded-lg text-xs text-[#605E5C] border border-[#EDEBE9]">
                  {selectedCustomer.notes || 'No specific clinical or credit notes recorded yet.'}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl p-12 text-center text-[#605E5C] border border-[#E1DFDD]">
              Select a customer from the left list to view CRM telemetry.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
