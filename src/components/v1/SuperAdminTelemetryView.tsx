import React, { useState } from 'react';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Copy, 
  Download, 
  Filter, 
  HardDrive, 
  RefreshCw, 
  Search, 
  Server, 
  ShieldCheck, 
  Smartphone, 
  Terminal, 
  Wifi, 
  Zap 
} from 'lucide-react';
import { Language, PlatformMetrics, SystemTelemetryLog } from '@/types/v1';

interface SuperAdminTelemetryViewProps {
  language: Language;
  metrics: PlatformMetrics;
  telemetryLogs: SystemTelemetryLog[];
}

export const SuperAdminTelemetryView: React.FC<SuperAdminTelemetryViewProps> = ({
  language,
  metrics,
  telemetryLogs,
}) => {
  const isSw = language === 'sw';
  const [selectedService, setSelectedService] = useState<string>('all');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [searchLog, setSearchLog] = useState<string>('');

  const filteredLogs = telemetryLogs.filter(log => {
    const matchesService = selectedService === 'all' || log.service === selectedService;
    const matchesLevel = selectedLevel === 'all' || log.level === selectedLevel;
    const matchesSearch = log.message.toLowerCase().includes(searchLog.toLowerCase()) ||
                          (log.tenantName && log.tenantName.toLowerCase().includes(searchLog.toLowerCase()));
    return matchesService && matchesLevel && matchesSearch;
  });

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-[#323130] tracking-tight">
              {isSw ? 'Telemetria ya Mfumo & TRA EFD API Health' : 'Platform Telemetry & Infrastructure Health'}
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-cyan-100 text-cyan-800 text-xs font-bold font-mono">
              REALTIME STATUS
            </span>
          </div>
          <p className="text-xs text-[#605E5C]">
            {isSw 
              ? 'Ufuatiliaji wa kina wa muunganisho wa TRA EFD, SMS Gateway ya Tanzania, kasi ya API (latency), na kumbukumbu za mfumo.'
              : 'Deep operational telemetry for TRA fiscal signatures, Tanzania SMS gateways, SQLite-cloud synchronization queues, and server latency.'
            }
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            ALL SYSTEMS NORMAL
          </span>
        </div>
      </div>

      {/* Cluster Nodes & Services Health Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-white rounded-xl p-4 border border-[#E1DFDD] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#605E5C]">
              TRA EFD Gateway API
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
          </div>
          <div className="mt-2 text-2xl font-black text-[#323130] font-mono">
            {metrics.traReceiptsProcessedToday.toLocaleString()}
          </div>
          <p className="text-[11px] text-emerald-700 font-semibold mt-1">
            0 errors in last 24h • 38ms avg latency
          </p>
        </div>

        {/* Metric 2 */}
        <div className="bg-white rounded-xl p-4 border border-[#E1DFDD] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#605E5C]">
              NextSMS Tanzania Balance
            </span>
            <Smartphone className="w-4 h-4 text-purple-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-[#323130] font-mono">
            {metrics.smsCreditsRemaining.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Credits remaining (~48 days at current run-rate)
          </p>
        </div>

        {/* Metric 3 */}
        <div className="bg-white rounded-xl p-4 border border-[#E1DFDD] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#605E5C]">
              Overall API Uptime
            </span>
            <Activity className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-700 font-mono">
            {metrics.apiUptimePercent}%
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Region: europe-west1 (Cloud Run + Cloud SQL)
          </p>
        </div>

        {/* Metric 4 */}
        <div className="bg-white rounded-xl p-4 border border-[#E1DFDD] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#605E5C]">
              Cloud Tenant Storage
            </span>
            <HardDrive className="w-4 h-4 text-cyan-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-[#323130] font-mono">
            {metrics.cloudStorageUsedGb} GB
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Encrypted SQLite replicas & document blobs
          </p>
        </div>
      </div>

      {/* Live Log Stream Viewer */}
      <div className="bg-white rounded-xl border border-[#E1DFDD] text-[#323130] overflow-hidden shadow-xs">
        {/* Terminal Header Bar */}
        <div className="p-4 border-b border-[#EDEBE9] bg-[#FAF9F8] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-600" />
            <h3 className="font-mono text-xs font-bold text-[#323130] uppercase tracking-wider">
              {isSw ? 'Kumbukumbu za Moja kwa Moja za Mfumo (Audit Logs)' : 'Platform System Telemetry Stream'}
            </h3>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={selectedService}
              onChange={(e) => setSelectedService(e.target.value)}
              className="bg-white text-[#323130] text-xs px-2.5 py-1 rounded-lg border border-[#EDEBE9] outline-none"
            >
              <option value="all">All Services</option>
              <option value="TRA-EFD-Bridge">TRA-EFD-Bridge</option>
              <option value="SMS-Gateway">SMS-Gateway</option>
              <option value="Subscription-Engine">Subscription-Engine</option>
              <option value="Offline-Sync-Relay">Offline-Sync-Relay</option>
              <option value="Auth-Security">Auth-Security</option>
            </select>

            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="bg-white text-[#323130] text-xs px-2.5 py-1 rounded-lg border border-[#EDEBE9] outline-none"
            >
              <option value="all">All Levels</option>
              <option value="success">Success</option>
              <option value="info">Info</option>
              <option value="warn">Warn</option>
              <option value="error">Error</option>
            </select>
          </div>
        </div>

        {/* Search inside logs */}
        <div className="p-3 border-b border-[#EDEBE9] bg-white">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#605E5C] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter logs by message, tenant name, or keyword..."
              value={searchLog}
              onChange={(e) => setSearchLog(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-[#F3F2F1] rounded-lg text-xs text-[#323130] placeholder-[#605E5C] outline-none font-mono"
            />
          </div>
        </div>

        {/* Log Entries */}
        <div className="p-4 font-mono text-xs space-y-2 max-h-[420px] overflow-y-auto divide-y divide-[#F3F2F1]">
          {filteredLogs.map(log => {
            const levelColor = 
              log.level === 'success' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' :
              log.level === 'warn' ? 'text-amber-800 bg-amber-50 border-amber-200' :
              log.level === 'error' ? 'text-rose-800 bg-rose-50 border-rose-200' : 'text-blue-700 bg-blue-50 border-blue-200';

            return (
              <div key={log.id} className="pt-2 flex flex-col sm:flex-row items-start justify-between gap-2 hover:bg-[#FAF9F8] p-2 rounded transition-colors">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[#605E5C] text-[10px]">{log.timestamp}</span>
                    <span className={`font-bold text-[10px] px-1.5 py-0.5 rounded border ${levelColor}`}>[{log.level.toUpperCase()}]</span>
                    <span className="text-[#323130] font-bold">{log.service}</span>
                    {log.tenantName && (
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold border border-slate-200">
                        {log.tenantName}
                      </span>
                    )}
                  </div>
                  <p className="text-[#323130] text-xs font-medium">{log.message}</p>
                  {log.details && (
                    <p className="text-[#605E5C] text-[10px]">{log.details}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
