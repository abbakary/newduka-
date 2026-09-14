import React, { useCallback, useEffect, useState } from 'react';
import { Save, RotateCcw, Loader2, Users } from 'lucide-react';
import { Language } from '@/types/v1';
import { useSaasPlans } from '@/context/SaasPlansContext';
import { formatPlanPrice, planBranchLabel, planPeriod, PublicPlan } from '@/lib/saasPlans';
import { SHARED_PLAN_FEATURES, SHARED_PLAN_FEATURES_SW } from '@/lib/planCatalog';

interface Props {
  language: Language;
}

function featuresToText(list: string[]): string {
  return list.join('\n');
}

function textToFeatures(text: string): string[] {
  return text.split('\n').map(s => s.trim()).filter(Boolean);
}

export const SuperAdminPlansView: React.FC<Props> = ({ language }) => {
  const isSw = language === 'sw';
  const { plans, updatePlan, syncSharedFeatures, resetPlans, refreshPlans, loading } = useSaasPlans();
  const [drafts, setDrafts] = useState<Record<string, PublicPlan>>({});
  const [sharedFeaturesEn, setSharedFeaturesEn] = useState(featuresToText([...SHARED_PLAN_FEATURES]));
  const [sharedFeaturesSw, setSharedFeaturesSw] = useState(featuresToText([...SHARED_PLAN_FEATURES_SW]));
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [savingFeatures, setSavingFeatures] = useState(false);
  const [featuresSaved, setFeaturesSaved] = useState(false);

  useEffect(() => {
    const next: Record<string, PublicPlan> = {};
    plans.forEach(p => { next[p.id] = { ...p }; });
    setDrafts(next);
    if (plans[0]) {
      setSharedFeaturesEn(featuresToText(plans[0].features));
      setSharedFeaturesSw(featuresToText(plans[0].featuresSw));
    }
  }, [plans]);

  const patchDraft = (id: string, patch: Partial<PublicPlan>) => {
    setDrafts(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const saveSharedFeatures = useCallback(async () => {
    setSavingFeatures(true);
    try {
      await syncSharedFeatures(textToFeatures(sharedFeaturesEn), textToFeatures(sharedFeaturesSw));
      setFeaturesSaved(true);
      setTimeout(() => setFeaturesSaved(false), 2000);
    } finally {
      setSavingFeatures(false);
    }
  }, [sharedFeaturesEn, sharedFeaturesSw, syncSharedFeatures]);

  const savePlan = useCallback(async (id: string) => {
    const draft = drafts[id];
    if (!draft) return;
    setSavingId(id);
    try {
      await updatePlan(id, {
        name: draft.name,
        nameSw: draft.nameSw,
        tagEn: draft.tagEn,
        tagSw: draft.tagSw,
        priceMonthlyTzs: draft.priceMonthlyTzs,
        priceYearlyTzs: draft.priceYearlyTzs,
        maxBranches: draft.maxBranches,
        contactUs: draft.contactUs,
        popular: draft.popular,
      });
      setSavedId(id);
      setTimeout(() => setSavedId(null), 2000);
    } finally {
      setSavingId(null);
    }
  }, [drafts, updatePlan]);

  return (
    <div className="space-y-6 pb-10">
      <header className="flex flex-wrap justify-between gap-4 items-start">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-[#D4AF37]">
            {isSw ? 'VIFURUSHI & BEI' : 'PLANS & PRICING'}
          </p>
          <h1 className="text-2xl font-serif font-bold text-[#003322]">
            {isSw ? 'Simamia vifurushi' : 'Manage subscription packages'}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            {isSw
              ? 'Mabadiliko yanaonekana mara moja kwenye tovuti, usajili, na programu ya simu. Vipengele ni vile vile — tofauti ni idadi ya matawi na bei tu.'
              : 'Changes sync instantly to the website, registration, and mobile app. All packages share the same features — only branch count and price differ.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void refreshPlans()}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer bg-white"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            {isSw ? 'Onyesha upya' : 'Refresh'}
          </button>
          <button
            type="button"
            onClick={() => void resetPlans()}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer bg-white"
          >
            <RotateCcw className="w-3.5 h-3.5" /> {isSw ? 'Rejesha chaguo-msingi' : 'Reset defaults'}
          </button>
        </div>
      </header>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <div>
          <h2 className="text-sm font-bold text-[#003322]">
            {isSw ? 'Vipengele vya pamoja (kwa vifurushi vyote)' : 'Shared features (all packages)'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isSw ? 'Hariri mara moja — inasasishwa kwenye mipango yote mitatu.' : 'Edit once — applies to all three tiers on web and mobile.'}
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase">{isSw ? 'Vipengele EN' : 'Features EN'}</label>
            <textarea
              rows={6}
              value={sharedFeaturesEn}
              onChange={e => setSharedFeaturesEn(e.target.value)}
              className="w-full mt-0.5 px-2 py-1.5 border rounded-lg text-xs font-mono"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase">{isSw ? 'Vipengele SW' : 'Features SW'}</label>
            <textarea
              rows={6}
              value={sharedFeaturesSw}
              onChange={e => setSharedFeaturesSw(e.target.value)}
              className="w-full mt-0.5 px-2 py-1.5 border rounded-lg text-xs font-mono"
            />
          </div>
        </div>
        <button
          type="button"
          disabled={savingFeatures}
          onClick={() => void saveSharedFeatures()}
          className="px-4 py-2 rounded-xl bg-[#0d9488] text-white text-xs font-bold cursor-pointer disabled:opacity-60"
        >
          {savingFeatures ? (isSw ? 'Inahifadhi…' : 'Saving…') : featuresSaved ? (isSw ? 'Imehifadhiwa!' : 'Saved!') : (isSw ? 'Hifadhi vipengele vya pamoja' : 'Save shared features')}
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {plans.map(plan => {
          const draft = drafts[plan.id] ?? plan;
          return (
            <div
              key={plan.id}
              className={`bg-white rounded-2xl border p-5 space-y-3 flex flex-col ${draft.popular ? 'border-[#0d9488] ring-2 ring-teal-500/20' : 'border-slate-200'}`}
            >
              <div className="flex items-center justify-between gap-2">
                {draft.popular ? (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#0d9488] text-white">
                    {isSw ? 'Maarufu' : 'Popular'}
                  </span>
                ) : <span />}
                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {plan.activeSubscribersCount ?? 0} {isSw ? 'wateja' : 'subscribers'}
                </span>
              </div>

              <span className="inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 w-fit">
                {planBranchLabel(draft, isSw)}
              </span>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">EN {isSw ? 'jina' : 'name'}</label>
                  <input
                    value={draft.name}
                    onChange={e => patchDraft(plan.id, { name: e.target.value })}
                    className="w-full mt-0.5 px-2 py-1.5 border rounded-lg text-sm font-semibold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">SW {isSw ? 'jina' : 'name'}</label>
                  <input
                    value={draft.nameSw}
                    onChange={e => patchDraft(plan.id, { nameSw: e.target.value })}
                    className="w-full mt-0.5 px-2 py-1.5 border rounded-lg text-sm font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">{isSw ? 'Maelezo EN' : 'Tag EN'}</label>
                  <input
                    value={draft.tagEn}
                    onChange={e => patchDraft(plan.id, { tagEn: e.target.value })}
                    className="w-full mt-0.5 px-2 py-1.5 border rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">{isSw ? 'Maelezo SW' : 'Tag SW'}</label>
                  <input
                    value={draft.tagSw}
                    onChange={e => patchDraft(plan.id, { tagSw: e.target.value })}
                    className="w-full mt-0.5 px-2 py-1.5 border rounded-lg text-xs"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.contactUs ?? false}
                  onChange={e => patchDraft(plan.id, { contactUs: e.target.checked })}
                />
                {isSw ? 'Bei maalum — wasiliana' : 'Custom pricing — contact us'}
              </label>

              {!draft.contactUs && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">{isSw ? 'Bei/mwezi (TZS)' : 'Monthly (TZS)'}</label>
                    <input
                      type="number"
                      value={draft.priceMonthlyTzs}
                      onChange={e => patchDraft(plan.id, { priceMonthlyTzs: Number(e.target.value) })}
                      className="w-full mt-0.5 px-2 py-1.5 border rounded-lg text-sm font-mono font-bold"
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">{formatPlanPrice(draft, isSw)}{planPeriod(isSw)}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">{isSw ? 'Bei/mwaka (TZS)' : 'Yearly (TZS)'}</label>
                    <input
                      type="number"
                      value={draft.priceYearlyTzs}
                      onChange={e => patchDraft(plan.id, { priceYearlyTzs: Number(e.target.value) })}
                      className="w-full mt-0.5 px-2 py-1.5 border rounded-lg text-sm font-mono font-bold"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">{isSw ? 'Idadi ya matawi' : 'Branch limit'}</label>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={draft.maxBranches}
                  onChange={e => patchDraft(plan.id, { maxBranches: Number(e.target.value) })}
                  className="w-full mt-0.5 px-2 py-1.5 border rounded-lg text-sm font-black text-center"
                />
              </div>

              <ul className="text-[11px] text-slate-600 space-y-1 border-t border-slate-100 pt-2">
                {(isSw ? draft.featuresSw : draft.features).slice(0, 4).map(f => (
                  <li key={f}>• {f}</li>
                ))}
                <li className="text-slate-400 italic">{isSw ? '+ vipengele vingine vile vile…' : '+ same features as other tiers…'}</li>
              </ul>

              <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.popular ?? false}
                  onChange={e => patchDraft(plan.id, { popular: e.target.checked })}
                />
                {isSw ? 'Onyesha kama maarufu kwenye tovuti/simu' : 'Show as popular on web/mobile'}
              </label>

              <button
                type="button"
                disabled={savingId === plan.id}
                onClick={() => void savePlan(plan.id)}
                className="mt-auto w-full py-2.5 rounded-xl bg-[#003322] text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {savingId === plan.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : savedId === plan.id ? (
                  <>{isSw ? 'Imehifadhiwa!' : 'Saved!'}</>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {isSw ? 'Hifadhi bei & matawi' : 'Save price & branches'}
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
