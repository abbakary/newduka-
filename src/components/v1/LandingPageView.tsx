import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Play,
  Smartphone,
  Store,
  Zap,
} from 'lucide-react';
import type { BusinessType, Language, SaaSPlanTier, UserRole } from '@/types/v1';
import {
  DEFAULT_SHOWCASE_ITEMS,
  fetchPublicShowcase,
  type PlatformShowcaseItem,
} from '@/lib/platformShowcase';
import { useSaasPlans } from '@/context/SaasPlansContext';
import { formatPlanPrice, planBranchLabel, planFeatures, planPeriod } from '@/lib/saasPlans';
import { BrandLogo } from '@/components/ui/BrandLogo';

export interface LandingPageViewProps {
  language: Language;
  onOpenLogin: () => void;
  onOpenRegister: (businessType?: BusinessType, planTier?: SaaSPlanTier) => void;
  onLaunchPortal?: (role?: UserRole, type?: BusinessType, planTier?: SaaSPlanTier) => void;
  onOpenTerms?: () => void;
}

const TEAL = '#0d9488';

function ShowcaseMedia({ item, className = '' }: { item: PlatformShowcaseItem; className?: string }) {
  if (item.mediaType === 'video') {
    const isEmbed = item.mediaUrl.includes('youtube.com') || item.mediaUrl.includes('youtu.be');
    if (isEmbed) {
      const embedUrl = item.mediaUrl.includes('embed')
        ? item.mediaUrl
        : item.mediaUrl.replace('watch?v=', 'embed/');
      return (
        <iframe
          title={item.title}
          src={`${embedUrl}?rel=0&modestbranding=1`}
          className={`w-full aspect-video rounded-2xl border border-slate-200 bg-slate-900 ${className}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      );
    }
    return (
      <video
        controls
        poster={item.thumbnailUrl ?? undefined}
        className={`w-full aspect-video rounded-2xl border border-slate-200 bg-slate-900 object-cover ${className}`}
        src={item.mediaUrl}
      />
    );
  }
  return (
    <img
      src={item.mediaUrl}
      alt={item.title}
      className={`w-full aspect-[16/10] object-cover rounded-2xl border border-slate-200 ${className}`}
    />
  );
}

export const LandingPageView: React.FC<LandingPageViewProps> = ({
  language,
  onOpenLogin,
  onOpenRegister,
  onLaunchPortal,
  onOpenTerms,
}) => {
  const isSw = language === 'sw';
  const { plans } = useSaasPlans();
  const [showcase, setShowcase] = useState<PlatformShowcaseItem[]>(DEFAULT_SHOWCASE_ITEMS);
  const [galleryIndex, setGalleryIndex] = useState(0);

  useEffect(() => {
    void fetchPublicShowcase().then(setShowcase);
  }, []);

  const featured = useMemo(
    () => showcase.find(s => s.isFeatured) ?? showcase[0],
    [showcase],
  );
  const gallery = useMemo(
    () => showcase.filter(s => !s.isFeatured || s.id !== featured?.id),
    [showcase, featured],
  );

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const startRegister = (type?: BusinessType, planTier?: SaaSPlanTier) => {
    if (onLaunchPortal) onLaunchPortal(undefined, type, planTier);
    else onOpenRegister(type, planTier);
  };

  return (
    <div className="min-h-screen bg-[#fafafa] text-slate-900 font-sans">
      {/* Navigation */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center cursor-pointer">
            <BrandLogo height={44} />
          </button>
          <nav className="hidden md:flex items-center gap-8 text-sm text-slate-600">
            <button type="button" onClick={() => scrollTo('process')} className="hover:text-slate-900 cursor-pointer">{isSw ? 'Jinsi inavyofanya' : 'How it works'}</button>
            <button type="button" onClick={() => scrollTo('plans')} className="hover:text-slate-900 cursor-pointer">{isSw ? 'Mipango' : 'Plans'}</button>
            <button type="button" onClick={() => scrollTo('showcase')} className="hover:text-slate-900 cursor-pointer">{isSw ? 'Onyesha' : 'Showcase'}</button>
            <button type="button" onClick={() => scrollTo('features')} className="hover:text-slate-900 cursor-pointer">{isSw ? 'Kwa biashara yako' : 'For your business'}</button>
          </nav>
          <div className="flex items-center gap-3">
            <button type="button" onClick={onOpenLogin} className="text-sm font-medium text-slate-600 hover:text-slate-900 cursor-pointer">
              {isSw ? 'Ingia' : 'Sign in'}
            </button>
            <button
              type="button"
              onClick={() => startRegister()}
              className="px-4 py-2 rounded-full text-sm font-semibold text-white cursor-pointer shadow-sm hover:opacity-90 transition-opacity"
              style={{ background: TEAL }}
            >
              {isSw ? 'Anza sasa' : 'Get started'}
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute top-20 right-0 w-[500px] h-[500px] rounded-full bg-teal-100/40 blur-3xl pointer-events-none" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-20 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide bg-teal-50 text-teal-800 border border-teal-100">
              <Zap className="w-3.5 h-3.5" />
              {isSw ? 'Inapatikana Tanzania' : 'Built for Tanzania'}
            </span>
            <h1 className="mt-6 text-4xl sm:text-5xl lg:text-[3.25rem] leading-[1.1] font-serif font-bold text-slate-900">
              {isSw ? 'Biashara yako, ' : 'Your business, '}
              <span className="italic text-teal-700">{isSw ? 'imara.' : 'refined.'}</span>
            </h1>
            <p className="mt-5 text-lg text-slate-600 max-w-lg leading-relaxed">
              {isSw
                ? 'POS, hifadhi, wateja, TRA EFD, na ripoti — mfumo mmoja wa ERP kwa maduka, pharmacy, hardware na zaidi.'
                : 'POS, inventory, CRM, TRA EFD receipts, and reports — one ERP for retail, pharmacy, hardware, restaurants, and more.'}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => startRegister()}
                className="px-6 py-3 rounded-full text-sm font-bold text-white cursor-pointer shadow-md"
                style={{ background: TEAL }}
              >
                {isSw ? 'Anza sasa' : 'Get started'}
              </button>
              <button
                type="button"
                onClick={() => scrollTo('plans')}
                className="px-6 py-3 rounded-full text-sm font-bold border border-slate-200 bg-white text-slate-700 cursor-pointer hover:border-slate-300"
              >
                {isSw ? 'Angalia mipango' : 'See plans'}
              </button>
            </div>
            <div className="mt-10 grid grid-cols-3 gap-4 pt-8 border-t border-slate-100">
              {[
                { v: '20+', l: isSw ? 'Aina za biashara' : 'Business types' },
                { v: '~2s', l: isSw ? 'Mauzo ya POS' : 'POS checkout' },
                { v: 'TRA', l: isSw ? 'EFD tayari' : 'EFD ready' },
              ].map(s => (
                <div key={s.l}>
                  <div className="text-xl font-black text-slate-900">{s.v}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Floating POS preview cards */}
          <div className="relative hidden lg:block h-[420px]">
            <div className="absolute top-0 right-8 w-64 bg-white rounded-2xl border border-slate-200 shadow-xl p-4 animate-in fade-in">
              <div className="text-[10px] font-bold uppercase text-teal-700 tracking-wide">{isSw ? 'Mauzo leo' : 'Today\'s sales'}</div>
              <div className="text-2xl font-black mt-1">TZS 2.4M</div>
              <div className="text-xs text-emerald-600 font-semibold mt-1">+18% {isSw ? 'kuliko jana' : 'vs yesterday'}</div>
            </div>
            <div className="absolute top-28 left-4 w-72 bg-white rounded-2xl border border-slate-200 shadow-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center">
                  <Store className="w-5 h-5 text-teal-700" />
                </div>
                <div>
                  <div className="font-bold text-sm">{isSw ? 'POS — Haraka' : 'Fast POS checkout'}</div>
                  <div className="text-xs text-slate-500">{isSw ? 'M-Pesa, mkopo, stoo' : 'M-Pesa, credit, stock sync'}</div>
                </div>
              </div>
            </div>
            <div className="absolute bottom-8 right-0 w-56 bg-teal-700 text-white rounded-2xl shadow-xl p-4">
              <CheckCircle2 className="w-5 h-5 mb-2 opacity-90" />
              <div className="text-sm font-bold">{isSw ? 'Risiti TRA imetumwa' : 'TRA receipt issued'}</div>
              <div className="text-xs opacity-80 mt-1">RCP-20260831-A1B2</div>
            </div>
          </div>
        </div>
      </section>

      {/* Process */}
      <section id="process" className="py-20 bg-white border-y border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-widest text-teal-700">01 / {isSw ? 'Mchakato' : 'Process'}</p>
          <h2 className="mt-2 text-3xl sm:text-4xl font-serif font-bold text-slate-900">
            {isSw ? 'Hatua tatu za kuanza' : 'Three steps to start'}
          </h2>
          <div className="mt-12 grid md:grid-cols-3 gap-6">
            {[
              { n: '01', icon: Store, t: isSw ? 'Sajili duka' : 'Register your shop', d: isSw ? 'Chagua aina ya biashara, jaza TRA/TIN, na uanzishe akaunti kwa dakika chache.' : 'Pick your business type, add TRA/TIN details, and launch your account in minutes.' },
              { n: '02', icon: Smartphone, t: isSw ? 'Weka bidhaa & POS' : 'Add products & POS', d: isSw ? 'Ingiza bidhaa, wafanyakazi, na matawi. Anza kuuza kutoka simu au kompyuta.' : 'Import products, staff, and branches. Start selling from phone or desktop.' },
              { n: '03', icon: BarChart3, t: isSw ? 'Simamia & kua' : 'Manage & grow', d: isSw ? 'Fuata stoo, madeni, gharama, na ripoti — yote kwenye dashbodi moja.' : 'Track stock, credit, expenses, and analytics — all in one dashboard.' },
            ].map(step => (
              <div key={step.n} className="rounded-2xl border border-slate-200 p-6 hover:border-teal-200 hover:shadow-sm transition-all">
                <span className="text-xs font-bold text-teal-600">{step.n}</span>
                <step.icon className="w-8 h-8 text-teal-700 mt-4 mb-3" />
                <h3 className="font-bold text-lg text-slate-900">{step.t}</h3>
                <p className="text-sm text-slate-600 mt-2 leading-relaxed">{step.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Showcase — demo video & feature highlights */}
      <section id="showcase" className="py-20 bg-[#fafafa]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-widest text-teal-700">02 / {isSw ? 'Onyesha' : 'Showcase'}</p>
          <h2 className="mt-2 text-3xl sm:text-4xl font-serif font-bold text-slate-900">
            {isSw ? 'Angalia Duka+ inavyofanya kazi' : 'See Duka+ in action'}
          </h2>
          <p className="mt-3 text-slate-600 max-w-2xl">
            {isSw
              ? 'Video fupi ya mfumo na vipengele vilivyochaguliwa — uone jinsi Duka+ inavyosaidia duka lako kila siku.'
              : 'A short app demo and curated highlights — see how Duka+ helps your shop every day.'}
          </p>

          {featured && (
            <div className="mt-10 grid lg:grid-cols-5 gap-8 items-start">
              <div className="lg:col-span-3 relative group">
                <ShowcaseMedia item={featured} />
                {featured.mediaType === 'video' && (
                  <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 text-white text-xs font-bold">
                    <Play className="w-3.5 h-3.5" /> {isSw ? 'Demo' : 'Demo video'}
                  </div>
                )}
              </div>
              <div className="lg:col-span-2 space-y-4">
                <h3 className="text-xl font-bold text-slate-900">{featured.title}</h3>
                {featured.subtitle && <p className="text-sm text-slate-600 leading-relaxed">{featured.subtitle}</p>}
                <button
                  type="button"
                  onClick={() => startRegister()}
                  className="inline-flex items-center gap-2 text-sm font-bold text-teal-700 cursor-pointer hover:underline"
                >
                  {isSw ? 'Jaribu sasa' : 'Try it now'} <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {gallery.length > 0 && (
            <div className="mt-14">
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-4">
                {isSw ? 'Vipengele & mafunzo' : 'Features & tutorials'}
              </h3>
              <div className="relative">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {gallery.slice(galleryIndex, galleryIndex + 3).map(item => (
                    <a
                      key={item.id}
                      href={item.linkUrl ?? '#'}
                      onClick={e => { if (!item.linkUrl) e.preventDefault(); }}
                      className="group rounded-2xl border border-slate-200 bg-white overflow-hidden hover:shadow-md transition-shadow"
                    >
                      {item.mediaType === 'video' ? (
                        <div className="relative">
                          <ShowcaseMedia item={item} className="rounded-none border-0" />
                        </div>
                      ) : (
                        <img src={item.mediaUrl} alt={item.title} className="w-full aspect-[16/10] object-cover" />
                      )}
                      <div className="p-4">
                        <h4 className="font-bold text-sm text-slate-900 group-hover:text-teal-700">{item.title}</h4>
                        {item.subtitle && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{item.subtitle}</p>}
                      </div>
                    </a>
                  ))}
                </div>
                {gallery.length > 3 && (
                  <div className="flex justify-center gap-2 mt-6">
                    <button
                      type="button"
                      onClick={() => setGalleryIndex(i => Math.max(0, i - 1))}
                      disabled={galleryIndex === 0}
                      className="p-2 rounded-full border border-slate-200 disabled:opacity-40 cursor-pointer"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setGalleryIndex(i => Math.min(gallery.length - 3, i + 1))}
                      disabled={galleryIndex >= gallery.length - 3}
                      className="p-2 rounded-full border border-slate-200 disabled:opacity-40 cursor-pointer"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Plans */}
      <section id="plans" className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-widest text-teal-700">03 / {isSw ? 'Mipango' : 'Plans'}</p>
          <h2 className="mt-2 text-3xl sm:text-4xl font-serif font-bold text-slate-900">
            {isSw ? 'Mipango ya kila ukubwa wa biashara' : 'Plans for every business size'}
          </h2>
          <p className="mt-3 text-slate-600 max-w-2xl">
            {isSw
              ? 'Bei wazi — vipengele ni vile vile kwenye vifurushi vyote. Tofauti ni idadi ya matawi na bei tu (1, 2, au 3 matawi).'
              : 'Transparent pricing — every package includes the same features. Only branch count and price differ (1, 2, or 3 branches).'}
          </p>
          <div className="mt-12 grid md:grid-cols-3 gap-6">
            {plans.map(plan => (
              <div
                key={plan.id}
                className={`rounded-2xl border p-6 flex flex-col ${plan.popular ? 'border-teal-500 shadow-lg ring-1 ring-teal-500/20 relative' : 'border-slate-200'}`}
              >
                {plan.popular && (
                  <span className="absolute -top-3 right-4 px-3 py-0.5 rounded-full text-xs font-bold text-white" style={{ background: TEAL }}>
                    {isSw ? 'Maarufu' : 'Popular'}
                  </span>
                )}
                <h3 className="font-serif font-bold text-xl">{isSw ? plan.nameSw : plan.name}</h3>
                <span className="inline-block mt-2 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-100">
                  {planBranchLabel(plan, isSw)}
                </span>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-2xl font-black">{formatPlanPrice(plan, isSw)}</span>
                  {!plan.contactUs && (
                    <span className="text-sm text-slate-500 font-medium">{planPeriod(isSw)}</span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">{isSw ? plan.tagSw : plan.tagEn}</p>
                <ul className="mt-6 space-y-2.5 flex-1">
                  {planFeatures(plan, language).map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                      <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" /> {f}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => startRegister(undefined, plan.tier)}
                  className={`mt-6 w-full py-2.5 rounded-full text-sm font-bold cursor-pointer ${plan.popular ? 'text-white' : 'border border-slate-200 bg-white text-slate-800'}`}
                  style={plan.popular ? { background: TEAL } : undefined}
                >
                  {plan.contactUs
                    ? (isSw ? 'Wasiliana nasi' : 'Contact us')
                    : (isSw ? 'Chagua mpango' : 'Choose plan')}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Client benefits */}
      <section id="features" className="py-20 text-white" style={{ background: `linear-gradient(135deg, ${TEAL} 0%, #0f766e 100%)` }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-teal-100">04 / {isSw ? 'Wateja' : 'For clients'}</p>
            <h2 className="mt-2 text-3xl sm:text-4xl font-serif font-bold">
              {isSw ? 'Imejengwa kwa wamiliki wa maduka' : 'Built for shop owners'}
            </h2>
            <p className="mt-4 text-teal-50 leading-relaxed">
              {isSw
                ? 'Simamia mauzo, stoo, wateja, madeni, na risiti za TRA — yote kutoka simu au kompyuta, bila foleni wala karatasi nyingi.'
                : 'Run sales, stock, customers, credit, and TRA receipts — from phone or desktop, without queues or paperwork.'}
            </p>
            <div className="mt-8 flex flex-wrap gap-6 text-sm">
              {[
                { v: 'POS', l: isSw ? 'Mauzo haraka ~2s' : 'Fast checkout ~2s' },
                { v: 'TRA', l: isSw ? 'Risiti za EFD' : 'EFD receipts' },
                { v: '20+', l: isSw ? 'Aina za biashara' : 'Business types' },
              ].map(s => (
                <div key={s.l}>
                  <div className="text-xl font-black">{s.v}</div>
                  <div className="text-teal-100 text-xs">{s.l}</div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => startRegister()}
              className="mt-8 px-6 py-3 rounded-full bg-white text-teal-800 text-sm font-bold cursor-pointer hover:bg-teal-50"
            >
              {isSw ? 'Jisajili sasa' : 'Register now'}
            </button>
          </div>
          <div className="space-y-3">
            {[
              isSw ? 'Uza haraka na POS — M-Pesa, pesa taslimu, mkopo, na stoo inasasishwa papo hapo' : 'Sell fast with POS — M-Pesa, cash, credit, and instant stock updates',
              isSw ? 'Simamia bidhaa, wateja, madeni ya wateja, na wasambazaji mahali pamoja' : 'Manage products, customers, receivables, and suppliers in one place',
              isSw ? 'Toa risiti za TRA EFD na VAT 18% ili kufuata sheria za mapato' : 'Issue TRA EFD receipts with 18% VAT for full tax compliance',
              isSw ? 'Angalia ripoti za faida, mauzo, stoo chini, na utendaji wa wafanyakazi kwa wakati halisi' : 'View profit, sales, low-stock, and staff performance reports in real time',
            ].map((t, i) => (
              <div key={t} className="flex items-start gap-3 p-4 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20">
                <span className="text-teal-200 font-mono text-sm">{String(i + 1).padStart(2, '0')}</span>
                <span className="text-sm font-medium">{t}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 bg-[#fafafa] text-center">
        <div className="max-w-xl mx-auto px-4">
          <h2 className="text-3xl font-serif font-bold text-slate-900">{isSw ? 'Anza leo' : 'Start today'}</h2>
          <p className="mt-3 text-slate-600">
            {isSw ? 'ERP ya biashara. Hakuna foleni. Simu na kompyuta.' : 'Business ERP. No queues. Phone and desktop.'}
          </p>
          <button
            type="button"
            onClick={() => startRegister()}
            className="mt-8 px-8 py-3.5 rounded-full text-sm font-bold text-white cursor-pointer shadow-md"
            style={{ background: TEAL }}
          >
            {isSw ? 'Jisajili sasa' : 'Register now'}
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid sm:grid-cols-4 gap-8 text-sm">
          <div>
            <BrandLogo height={36} className="font-bold text-slate-800" />
            <p className="text-slate-500 mt-3 text-xs leading-relaxed">
              {isSw ? 'ERP ya biashara kwa Tanzania.' : 'Business ERP for Tanzania.'}
            </p>
          </div>
          {[
            { h: 'Product', links: [isSw ? 'Jinsi inavyofanya' : 'How it works', isSw ? 'Mipango' : 'Plans', isSw ? 'Kwa biashara yako' : 'For your business'] },
            { h: 'Company', links: [isSw ? 'Kuhusu' : 'About', isSw ? 'Wasiliana' : 'Contact'] },
            { h: 'Legal', links: [
              { label: isSw ? 'Faragha' : 'Privacy', action: onOpenTerms },
              { label: isSw ? 'Masharti' : 'Terms', action: onOpenTerms },
              { label: 'TRA EFD', action: onOpenTerms },
            ]},
          ].map(col => (
            <div key={col.h}>
              <h4 className="font-bold text-xs uppercase tracking-wide text-slate-400">{col.h}</h4>
              <ul className="mt-3 space-y-2 text-slate-600">
                {col.links.map(l => (
                  <li key={typeof l === 'string' ? l : l.label}>
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof l !== 'string') {
                          l.action?.();
                          return;
                        }
                        if (l === (isSw ? 'Mipango' : 'Plans')) scrollTo('plans');
                        else if (l === (isSw ? 'Jinsi inavyofanya' : 'How it works')) scrollTo('process');
                        else if (l === (isSw ? 'Kwa biashara yako' : 'For your business')) scrollTo('features');
                      }}
                      className="hover:text-teal-700 cursor-pointer"
                    >
                      {typeof l === 'string' ? l : l.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-slate-400 mt-10">© {new Date().getFullYear()} DukaMkononi · Tanzania</p>
      </footer>
    </div>
  );
};
