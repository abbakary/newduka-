import React, { useState } from 'react';
import { 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Filter, 
  Mail, 
  Plus, 
  Radio, 
  RadioTower, 
  Send, 
  ShieldAlert, 
  Smartphone, 
  Sparkles, 
  Users 
} from 'lucide-react';
import { Language, PlatformBroadcast } from '@/types/v1';
import confetti from 'canvas-confetti';

interface SuperAdminBroadcastsViewProps {
  language: Language;
  broadcasts: PlatformBroadcast[];
  setBroadcasts: React.Dispatch<React.SetStateAction<PlatformBroadcast[]>>;
}

export const SuperAdminBroadcastsView: React.FC<SuperAdminBroadcastsViewProps> = ({
  language,
  broadcasts,
  setBroadcasts,
}) => {
  const isSw = language === 'sw';
  const [isComposeOpen, setIsComposeOpen] = useState<boolean>(false);
  const [title, setTitle] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [targetAudience, setTargetAudience] = useState<'all' | 'pharmacy' | 'hardware' | 'restaurant' | 'retail' | 'service'>('all');
  const [targetRegion, setTargetRegion] = useState<string>('All Tanzania');
  const [channel, setChannel] = useState<'in_app' | 'sms' | 'both'>('both');

  const handleSendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !message) return;

    const newBroadcast: PlatformBroadcast = {
      id: `bc-${Date.now()}`,
      title,
      message,
      targetAudience,
      targetRegion,
      channel,
      sentAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      sentBy: 'System Platform Ops (Super Admin)',
      deliveryCount: targetAudience === 'all' ? 148 : targetAudience === 'pharmacy' ? 38 : 25,
      status: 'sent'
    };

    setBroadcasts(prev => [newBroadcast, ...prev]);
    setIsComposeOpen(false);
    setTitle('');
    setMessage('');
    confetti({
      particleCount: 50,
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
              {isSw ? 'Mawasiliano na Matangazo ya Mfumo (Global Broadcasts)' : 'Platform Broadcasts & Alerts Engine'}
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 text-xs font-bold font-mono">
              SMS + IN-APP
            </span>
          </div>
          <p className="text-xs text-[#605E5C]">
            {isSw 
              ? 'Tuma jumbe za dharura za kiudhibiti (TMDA/TRA), taarifa za matengenezo ya mifumo, au ofa kwa maduka yote nchini Tanzania.'
              : 'Dispatch urgent regulatory advisories (TMDA/TRA), scheduled server maintenance notices, or campaigns to stores across Tanzania.'
            }
          </p>
        </div>

        <button
          onClick={() => setIsComposeOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md transition-all cursor-pointer"
        >
          <Send className="w-4 h-4" />
          <span>{isSw ? 'Tunga Tangazo Jipya' : 'Compose Broadcast'}</span>
        </button>
      </div>

      {/* Preset Quick Templates */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div 
          onClick={() => {
            setTitle('TMDA Urgent Batch Quarantine Advisory');
            setMessage('TMDA has issued an immediate freeze on Lot #2026-X. Please verify your current inventory batches and halt dispensing immediately.');
            setTargetAudience('pharmacy');
            setChannel('both');
            setIsComposeOpen(true);
          }}
          className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl hover:border-amber-400 cursor-pointer transition-all"
        >
          <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
            <ShieldAlert className="w-4 h-4 text-amber-700" />
            <span>TMDA Batch Recall Alert</span>
          </div>
          <p className="text-[11px] text-amber-700 mt-1">
            Template for pharmacies regarding drug batch recalls or regulatory updates.
          </p>
        </div>

        <div 
          onClick={() => {
            setTitle('TRA EFD Gateway Maintenance Notice');
            setMessage('TRA VFD Bridge will undergo essential system upgrade tonight from 01:00 AM to 03:00 AM. Offline transaction buffering will automatically engage.');
            setTargetAudience('all');
            setChannel('in_app');
            setIsComposeOpen(true);
          }}
          className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl hover:border-blue-400 cursor-pointer transition-all"
        >
          <div className="flex items-center gap-2 text-blue-900 font-bold text-xs">
            <Clock className="w-4 h-4 text-blue-700" />
            <span>TRA Maintenance Notice</span>
          </div>
          <p className="text-[11px] text-blue-700 mt-1">
            Template notifying all shops of planned TRA server downtime or VFD bridge upgrade.
          </p>
        </div>

        <div 
          onClick={() => {
            setTitle('Duka+ v3.2 AI Feature Release');
            setMessage('New AI Stock Predictor and automated WhatsApp customer credit receipts are now live on your POS terminal!');
            setTargetAudience('all');
            setChannel('in_app');
            setIsComposeOpen(true);
          }}
          className="p-3.5 bg-purple-50 border border-purple-200 rounded-xl hover:border-purple-400 cursor-pointer transition-all"
        >
          <div className="flex items-center gap-2 text-purple-900 font-bold text-xs">
            <Sparkles className="w-4 h-4 text-purple-700" />
            <span>Platform Feature Announcement</span>
          </div>
          <p className="text-[11px] text-purple-700 mt-1">
            Template for announcing new features or platform upgrades to tenants.
          </p>
        </div>
      </div>

      {/* Broadcast History Table */}
      <div className="bg-white rounded-xl border border-[#E1DFDD] shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#F3F2F1]">
          <h3 className="text-sm font-bold text-[#323130] uppercase tracking-wider">
            {isSw ? 'Historia ya Matangazo Yaliyotumwa' : 'Dispatched Broadcast History'}
          </h3>
        </div>

        <div className="divide-y divide-[#F3F2F1]">
          {broadcasts.map(bc => (
            <div key={bc.id} className="p-4 hover:bg-[#FAF9F8] transition-all space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
                    <Radio className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-[#323130]">{bc.title}</h4>
                    <p className="text-[11px] text-[#605E5C]">
                      Sent by <strong>{bc.sentBy}</strong> • {bc.sentAt}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-bold uppercase">
                    {bc.targetAudience.toUpperCase()}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                    {bc.deliveryCount} DELIVERED
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100 leading-relaxed">
                {bc.message}
              </p>

              <div className="flex items-center gap-4 text-[11px] text-slate-500 pt-1">
                <span>Region: <strong>{bc.targetRegion}</strong></span>
                <span>Channel: <strong>{bc.channel.toUpperCase()}</strong></span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* COMPOSE MODAL */}
      {isComposeOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-[#323130]">
              {isSw ? 'Tunga Tangazo Jipya la Mfumo' : 'Compose Platform Broadcast'}
            </h3>

            <form onSubmit={handleSendBroadcast} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {isSw ? 'Kichwa cha Tangazo' : 'Broadcast Title'}
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. TMDA 2026 Batch Quarantine Advisory"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-300 outline-none focus:bg-white focus:border-purple-600 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {isSw ? 'Walengwa (Audience)' : 'Target Audience'}
                  </label>
                  <select
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-300 outline-none font-medium"
                  >
                    <option value="all">All Stores in Tanzania (148)</option>
                    <option value="pharmacy">Pharmacies Only (38)</option>
                    <option value="hardware">Hardware Stores (32)</option>
                    <option value="restaurant">Restaurants (24)</option>
                    <option value="retail">Retail Stores (42)</option>
                    <option value="service">Service Businesses (12)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {isSw ? 'Njia ya Utumaji' : 'Channel'}
                  </label>
                  <select
                    value={channel}
                    onChange={(e) => setChannel(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-300 outline-none font-medium"
                  >
                    <option value="both">Both SMS & In-App Banner</option>
                    <option value="sms">SMS Only (NextSMS TZ)</option>
                    <option value="in_app">In-App Banner Only</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {isSw ? 'Ujumbe wa Tangazo' : 'Broadcast Message Content'}
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Type your official directive or advisory here..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-300 outline-none focus:bg-white focus:border-purple-600 leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsComposeOpen(false)}
                  className="px-3 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold cursor-pointer"
                >
                  {isSw ? 'Ghairi' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold cursor-pointer"
                >
                  {isSw ? 'Tuma Tangazo Sasa' : 'Dispatch Broadcast'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
