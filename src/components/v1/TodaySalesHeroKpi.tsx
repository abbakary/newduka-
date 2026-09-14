import React, { useEffect, useRef, useState, useCallback } from 'react';
import { TrendingUp, Receipt, Sparkles, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { formatTSh } from '@/utils/translations';
import type { TodaySalesStats } from '@/lib/analyticsCompute';

interface TodaySalesHeroKpiProps {
  stats: TodaySalesStats;
  isSw?: boolean;
  variant?: 'owner' | 'staff';
  staffName?: string;
  onClick?: () => void;
  className?: string;
}

function useLiveCounter(target: number, hoverFast = false) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>(0);
  const mountedRef = useRef(true);

  const animateTo = useCallback((to: number, duration: number) => {
    cancelAnimationFrame(rafRef.current);
    const from = value;
    const start = performance.now();
    const tick = (now: number) => {
      if (!mountedRef.current) return;
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (to - from) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [value]);

  useEffect(() => {
    mountedRef.current = true;
    animateTo(target, 1400);
    return () => {
      mountedRef.current = false;
      cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  useEffect(() => {
    if (hoverFast) animateTo(target, 600);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoverFast, target]);

  return value;
}

export const TodaySalesHeroKpi: React.FC<TodaySalesHeroKpiProps> = ({
  stats,
  isSw = false,
  variant = 'owner',
  staffName,
  onClick,
  className = '',
}) => {
  const [hovered, setHovered] = useState(false);
  const animatedRevenue = useLiveCounter(stats.todayRevenue, hovered);
  const animatedReceipts = useLiveCounter(stats.todayReceiptCount, hovered);

  const title = variant === 'staff'
    ? (isSw ? 'Mauzo Yangu Leo' : 'My Sales Today')
    : (isSw ? 'Mauzo ya Leo' : "Today's Sales");

  const subtitle = variant === 'staff' && staffName
    ? (isSw ? `${staffName} • Zamu ya leo` : `${staffName} • On shift`)
    : (isSw ? 'Mauzo ya siku ya kazi' : 'Live business day revenue');

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`group relative overflow-hidden rounded-2xl border border-white/20 shadow-xl h-full cursor-default transition-all duration-500 hover:scale-[1.01] hover:shadow-2xl ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {/* Animated gradient mesh background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0078D4] via-[#6264A7] to-[#24284A] today-hero-gradient" />
      <div className="absolute inset-0 opacity-40 today-hero-shimmer" />
      <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-emerald-400/30 blur-3xl today-hero-orb" />
      <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-amber-400/25 blur-2xl today-hero-orb-delayed" />

      <div className="relative z-10 p-5 sm:p-6 flex flex-col h-full min-h-[240px] justify-between text-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 border border-white/25 text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {isSw ? 'Moja kwa Moja' : 'Live'}
              </span>
              {hovered && (
                <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
              )}
            </div>
            <h3 className="text-sm font-bold text-white/90 tracking-wide">{title}</h3>
            <p className="text-[11px] text-white/60 mt-0.5">{subtitle}</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center backdrop-blur-sm group-hover:bg-white/25 transition-colors">
            <TrendingUp className="w-5 h-5 text-emerald-300" />
          </div>
        </div>

        <div className="my-4">
          <div className={`text-3xl sm:text-4xl lg:text-[2.75rem] font-black tracking-tight font-mono transition-all duration-300 ${hovered ? 'text-emerald-200 scale-[1.02]' : 'text-white'}`}>
            {formatTSh(Math.round(animatedRevenue))}
          </div>
          {stats.changePercent !== null && (
            <div className={`flex items-center gap-1 mt-2 text-xs font-bold ${
              stats.changeDirection === 'up' ? 'text-emerald-200' :
              stats.changeDirection === 'down' ? 'text-rose-200' : 'text-white/70'
            }`}>
              {stats.changeDirection === 'up' ? (
                <ArrowUpRight className="w-4 h-4" />
              ) : stats.changeDirection === 'down' ? (
                <ArrowDownRight className="w-4 h-4" />
              ) : null}
              <span>
                {stats.changeDirection === 'flat'
                  ? (isSw ? 'Sawa na jana' : 'Same as yesterday')
                  : `${stats.changeDirection === 'up' ? '+' : ''}${stats.changePercent}% ${isSw ? 'dhidi ya jana' : 'vs yesterday'}`}
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/15">
          <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm border border-white/10 group-hover:bg-white/15 transition-colors">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-white/70 uppercase tracking-wide">
              <Receipt className="w-3.5 h-3.5" />
              {isSw ? 'Risiti' : 'Receipts'}
            </div>
            <div className="text-xl font-black font-mono mt-1">{Math.round(animatedReceipts)}</div>
          </div>
          <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm border border-white/10 group-hover:bg-white/15 transition-colors">
            <div className="text-[10px] font-semibold text-white/70 uppercase tracking-wide">
              {isSw ? 'Wastani/Risiti' : 'Avg / Receipt'}
            </div>
            <div className="text-lg font-black font-mono mt-1 truncate">
              {formatTSh(Math.round(stats.avgTicket))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
