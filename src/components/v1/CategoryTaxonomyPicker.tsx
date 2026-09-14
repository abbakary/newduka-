import React, { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Language, BusinessType } from '@/types/v1';
import { getBusinessProfile, getMainCategories, type TaxonomyMain } from '@/lib/businessEngine';

export interface CategorySelection {
  main: string;
  group?: string;
  subgroup?: string;
  displayPath: string;
}

interface CategoryTaxonomyPickerProps {
  language: Language;
  businessType: BusinessType;
  value: CategorySelection;
  onChange: (sel: CategorySelection) => void;
  customCategories?: string[];
  onAddCustom?: (path: string) => void;
}

function buildPath(main: string, group?: string, subgroup?: string): string {
  if (subgroup && group) return `${main} > ${group} > ${subgroup}`;
  if (group) return `${main} > ${group}`;
  return main;
}

export const CategoryTaxonomyPicker: React.FC<CategoryTaxonomyPickerProps> = ({
  language,
  businessType,
  value,
  onChange,
  customCategories = [],
  onAddCustom,
}) => {
  const isSw = language === 'sw';
  const profile = getBusinessProfile(businessType);
  const mains = getMainCategories(businessType);
  const [showNewMain, setShowNewMain] = useState(false);
  const [newMainName, setNewMainName] = useState('');

  const selectedMain = mains.find(m => (isSw ? m.name_sw : m.name_en) === value.main || m.name_en === value.main);
  const groups = selectedMain?.groups ?? [];
  const selectedGroup = groups.find(g => (isSw ? g.name_sw : g.name_en) === value.group || g.name_en === value.group);
  const subgroups = selectedGroup?.subgroups ?? [];

  const label = (m: TaxonomyMain) => (isSw ? m.name_sw : m.name_en);

  const handleMain = (mainName: string) => {
    onChange({ main: mainName, displayPath: mainName });
  };

  const handleGroup = (groupName: string) => {
    onChange({ main: value.main, group: groupName, displayPath: buildPath(value.main, groupName) });
  };

  const handleSubgroup = (subName: string) => {
    onChange({
      main: value.main,
      group: value.group,
      subgroup: subName,
      displayPath: buildPath(value.main, value.group, subName),
    });
  };

  const presetOptions = useMemo(() => {
    return mains.flatMap(m => {
      const mainLabel = label(m);
      const items = [mainLabel];
      for (const g of m.groups ?? []) {
        const gLabel = isSw ? g.name_sw : g.name_en;
        items.push(`${mainLabel} > ${gLabel}`);
        for (const s of g.subgroups ?? []) {
          items.push(`${mainLabel} > ${gLabel} > ${isSw ? s.name_sw : s.name_en}`);
        }
      }
      return items;
    });
  }, [mains, isSw]);

  const allOptions = [...new Set([...presetOptions, ...customCategories])];

  const addCustomMain = () => {
    const name = newMainName.trim();
    if (!name) return;
    onAddCustom?.(name);
    onChange({ main: name, displayPath: name });
    setNewMainName('');
    setShowNewMain(false);
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-bold text-[#605E5C] mb-1">
          {isSw ? 'Kategoria Kuu' : 'Main Category'}
        </label>
        <select
          value={value.main}
          onChange={(e) => {
            if (e.target.value === '__new__') { setShowNewMain(true); return; }
            handleMain(e.target.value);
          }}
          className="w-full px-3 py-2 rounded-lg border border-[#E1DFDD] text-sm bg-white"
        >
          <option value="">{isSw ? 'Chagua...' : 'Select...'}</option>
          {mains.map(m => (
            <option key={m.name_en} value={label(m)}>{label(m)}</option>
          ))}
          {customCategories.filter(c => !c.includes('>')).map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
          {profile.allow_custom_taxonomy && (
            <option value="__new__">+ {isSw ? 'Unda Kategoria Mpya' : 'Create New Category'}</option>
          )}
        </select>
        {showNewMain && (
          <div className="flex gap-2 mt-2">
            <input
              value={newMainName}
              onChange={e => setNewMainName(e.target.value)}
              placeholder={isSw ? 'Jina la kategoria' : 'Category name'}
              className="flex-1 px-2 py-1.5 text-xs border rounded-lg"
            />
            <button type="button" onClick={addCustomMain} className="px-2 py-1.5 bg-[#6264A7] text-white text-xs rounded-lg cursor-pointer">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {profile.taxonomy_levels >= 2 && groups.length > 0 && value.main && (
        <div>
          <label className="block text-xs font-bold text-[#605E5C] mb-1">
            {isSw ? 'Kikundi' : 'Group'}
          </label>
          <select
            value={value.group ?? ''}
            onChange={e => handleGroup(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[#E1DFDD] text-sm bg-white"
          >
            <option value="">{isSw ? 'Si lazima' : 'Optional'}</option>
            {groups.map(g => (
              <option key={g.name_en} value={isSw ? g.name_sw : g.name_en}>
                {isSw ? g.name_sw : g.name_en}
              </option>
            ))}
          </select>
        </div>
      )}

      {profile.taxonomy_levels >= 3 && subgroups.length > 0 && value.group && (
        <div>
          <label className="block text-xs font-bold text-[#605E5C] mb-1">
            {isSw ? 'Kikundi Kidogo' : 'Subgroup'}
          </label>
          <select
            value={value.subgroup ?? ''}
            onChange={e => handleSubgroup(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[#E1DFDD] text-sm bg-white"
          >
            <option value="">{isSw ? 'Si lazima' : 'Optional'}</option>
            {subgroups.map(s => (
              <option key={s.name_en} value={isSw ? s.name_sw : s.name_en}>
                {isSw ? s.name_sw : s.name_en}
              </option>
            ))}
          </select>
        </div>
      )}

      {profile.taxonomy_levels === 1 && (
        <div>
          <label className="block text-xs font-bold text-[#605E5C] mb-1">
            {isSw ? 'Au chagua haraka' : 'Quick pick'}
          </label>
          <select
            value={value.displayPath}
            onChange={e => {
              const path = e.target.value;
              const parts = path.split(' > ').map(p => p.trim());
              onChange({
                main: parts[0] ?? '',
                group: parts[1],
                subgroup: parts[2],
                displayPath: path,
              });
            }}
            className="w-full px-3 py-2 rounded-lg border border-[#E1DFDD] text-sm bg-white"
          >
            <option value="">{isSw ? 'Chagua...' : 'Select...'}</option>
            {allOptions.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      )}
    </div>
  );
};
