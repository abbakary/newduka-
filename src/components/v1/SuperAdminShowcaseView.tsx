import React, { useCallback, useEffect, useState } from 'react';
import { Film, Image as ImageIcon, Plus, Star, Trash2, Video } from 'lucide-react';
import type { Language } from '@/types/v1';
import { api } from '@/lib/api';
import {
  DEFAULT_SHOWCASE_ITEMS,
  mapShowcaseFromApi,
  showcaseToApiPayload,
  type PlatformShowcaseItem,
} from '@/lib/platformShowcase';

interface SuperAdminShowcaseViewProps {
  language: Language;
}

const emptyForm = (): Partial<PlatformShowcaseItem> => ({
  title: '',
  subtitle: '',
  mediaType: 'image',
  mediaUrl: '',
  thumbnailUrl: '',
  linkUrl: '',
  sortOrder: 0,
  isActive: true,
  isFeatured: false,
});

export const SuperAdminShowcaseView: React.FC<SuperAdminShowcaseViewProps> = ({ language }) => {
  const isSw = language === 'sw';
  const [items, setItems] = useState<PlatformShowcaseItem[]>(DEFAULT_SHOWCASE_ITEMS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<PlatformShowcaseItem>>(emptyForm());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getAdminShowcase();
      setItems(data.map(mapShowcaseFromApi));
    } catch {
      setItems(DEFAULT_SHOWCASE_ITEMS);
      setError(isSw ? 'Imeshindwa kupakia kutoka seva — inaonyesha chaguo-msingi.' : 'Could not load from server — showing defaults.');
    } finally {
      setLoading(false);
    }
  }, [isSw]);

  useEffect(() => { void load(); }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm(), sortOrder: items.length });
    setFormOpen(true);
  };

  const openEdit = (item: PlatformShowcaseItem) => {
    setEditingId(item.id);
    setForm({ ...item });
    setFormOpen(true);
  };

  const save = async () => {
    if (!form.title?.trim() || !form.mediaUrl?.trim()) {
      setError(isSw ? 'Jaza kichwa na URL ya media.' : 'Title and media URL are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = showcaseToApiPayload(form as PlatformShowcaseItem);
      if (editingId) {
        await api.updateShowcaseItem(editingId, payload);
      } else {
        await api.createShowcaseItem(payload);
      }
      setFormOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm(isSw ? 'Futa kipengele hiki?' : 'Delete this showcase item?')) return;
    try {
      await api.deleteShowcaseItem(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const setFeatured = async (id: string) => {
    try {
      await api.updateShowcaseItem(id, { is_featured: true });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            {isSw ? 'Onyesha — Ukurasa wa Mwanzo' : 'Landing Page Showcase'}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {isSw
              ? 'Simamia video ya demo, picha, na matangazo kwenye ukurasa wa mwanzo.'
              : 'Manage demo video, images, and ads displayed on the public landing page.'}
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 text-white text-sm font-bold cursor-pointer hover:bg-teal-500"
        >
          <Plus className="w-4 h-4" />
          {isSw ? 'Ongeza kipengele' : 'Add item'}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{error}</div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">{isSw ? 'Inapakia…' : 'Loading…'}</p>
      ) : (
        <div className="grid gap-4">
          {items.map(item => (
            <div key={item.id} className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col sm:flex-row gap-4">
              <div className="w-full sm:w-40 shrink-0 aspect-video rounded-xl overflow-hidden bg-slate-100 border border-slate-100">
                {item.mediaType === 'video' ? (
                  item.thumbnailUrl ? (
                    <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-teal-600"><Video className="w-8 h-8" /></div>
                  )
                ) : (
                  <img src={item.mediaUrl} alt={item.title} className="w-full h-full object-cover" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-slate-900">{item.title}</h3>
                      {item.isFeatured && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 text-[10px] font-bold">
                          <Star className="w-3 h-3" /> {isSw ? 'Demo kuu' : 'Featured demo'}
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${item.mediaType === 'video' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                        {item.mediaType}
                      </span>
                    </div>
                    {item.subtitle && <p className="text-sm text-slate-500 mt-1">{item.subtitle}</p>}
                    <p className="text-xs text-slate-400 mt-2 truncate">{item.mediaUrl}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {!item.isFeatured && (
                      <button type="button" onClick={() => void setFeatured(item.id)} className="p-2 rounded-lg hover:bg-slate-100 cursor-pointer" title="Set as featured demo">
                        <Star className="w-4 h-4 text-slate-500" />
                      </button>
                    )}
                    <button type="button" onClick={() => openEdit(item)} className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 cursor-pointer">
                      {isSw ? 'Hariri' : 'Edit'}
                    </button>
                    <button type="button" onClick={() => void remove(item.id)} className="p-2 rounded-lg hover:bg-rose-50 text-rose-600 cursor-pointer">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-lg">{editingId ? (isSw ? 'Hariri onyesha' : 'Edit showcase') : (isSw ? 'Ongeza onyesha' : 'Add showcase item')}</h3>

            <input
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
              placeholder={isSw ? 'Kichwa' : 'Title'}
              value={form.title ?? ''}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            />
            <textarea
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
              placeholder={isSw ? 'Maelezo mafupi' : 'Subtitle'}
              rows={2}
              value={form.subtitle ?? ''}
              onChange={e => setForm(f => ({ ...f, subtitle: e.target.value }))}
            />

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, mediaType: 'video' }))}
                className={`py-2 rounded-xl border text-sm font-bold cursor-pointer flex items-center justify-center gap-1 ${form.mediaType === 'video' ? 'border-teal-500 bg-teal-50 text-teal-800' : 'border-slate-200'}`}
              >
                <Film className="w-4 h-4" /> Video
              </button>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, mediaType: 'image' }))}
                className={`py-2 rounded-xl border text-sm font-bold cursor-pointer flex items-center justify-center gap-1 ${form.mediaType === 'image' ? 'border-teal-500 bg-teal-50 text-teal-800' : 'border-slate-200'}`}
              >
                <ImageIcon className="w-4 h-4" /> Image
              </button>
            </div>

            <input
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
              placeholder={form.mediaType === 'video' ? 'YouTube embed URL or .mp4 link' : 'Image URL'}
              value={form.mediaUrl ?? ''}
              onChange={e => setForm(f => ({ ...f, mediaUrl: e.target.value }))}
            />
            {form.mediaType === 'video' && (
              <input
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                placeholder={isSw ? 'Picha ya jalada (hiari)' : 'Thumbnail URL (optional)'}
                value={form.thumbnailUrl ?? ''}
                onChange={e => setForm(f => ({ ...f, thumbnailUrl: e.target.value }))}
              />
            )}
            <input
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
              placeholder={isSw ? 'Kiungo cha nje (hiari)' : 'External link (optional)'}
              value={form.linkUrl ?? ''}
              onChange={e => setForm(f => ({ ...f, linkUrl: e.target.value }))}
            />

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.isFeatured ?? false} onChange={e => setForm(f => ({ ...f, isFeatured: e.target.checked }))} />
              {isSw ? 'Weka kama video kuu ya demo' : 'Set as featured demo video'}
            </label>

            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setFormOpen(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold cursor-pointer">
                {isSw ? 'Ghairi' : 'Cancel'}
              </button>
              <button type="button" disabled={saving} onClick={() => void save()} className="flex-1 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-bold cursor-pointer disabled:opacity-60">
                {saving ? '…' : (isSw ? 'Hifadhi' : 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
