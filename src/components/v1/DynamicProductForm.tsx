import React, { useMemo, useState } from 'react';
import { Language, BusinessType } from '@/types/v1';
import { getBusinessProfile, type ProductFieldSchema } from '@/lib/businessEngine';
import { resolveFieldOptions, resolveFieldPlaceholder } from '@/lib/productFieldPresets';

export interface DynamicProductFormValues {
  metadata: Record<string, string | number | boolean>;
  batch_number?: string;
  expiry_date?: string;
  requires_prescription?: boolean;
  barcode?: string;
}

interface DynamicProductFormProps {
  language: Language;
  businessType: BusinessType;
  values: DynamicProductFormValues;
  onChange: (values: DynamicProductFormValues) => void;
}

const CUSTOM_OPTION = '__custom__';

function PresetSelectField({
  field,
  isSw,
  businessType,
  values,
  onChange,
}: {
  field: ProductFieldSchema;
  isSw: boolean;
  businessType: BusinessType;
  values: DynamicProductFormValues;
  onChange: (v: DynamicProductFormValues) => void;
}) {
  const label = isSw ? field.label_sw : field.label_en;
  const key = field.key;
  const parentKey = field.dependsOn;
  const parentVal = parentKey
    ? String(values.metadata[parentKey] ?? (values as Record<string, unknown>)[parentKey] ?? '')
    : undefined;

  const options = useMemo(
    () => resolveFieldOptions(field, parentVal),
    [field, parentVal],
  );

  const directKeys = ['batch_number', 'expiry_date', 'requires_prescription', 'barcode'];
  const currentVal = directKeys.includes(key)
    ? (values as Record<string, unknown>)[key]
    : values.metadata[key];
  const strVal = currentVal === undefined || currentVal === null ? '' : String(currentVal);

  const inList = options.includes(strVal);
  const [customMode, setCustomMode] = useState(Boolean(strVal && !inList && field.allowCustom !== false));

  const setMeta = (val: string | number | boolean) => {
    onChange({ ...values, metadata: { ...values.metadata, [key]: val } });
  };

  const setDirect = (val: string | boolean) => {
    onChange({ ...values, [key]: val } as DynamicProductFormValues);
  };

  const apply = (val: string) => {
    if (field.metadata) setMeta(val);
    else setDirect(val);
  };

  const selectValue = customMode ? CUSTOM_OPTION : strVal;
  const allowCustom = field.allowCustom !== false;

  return (
    <div key={key}>
      <label className="block text-xs font-bold text-[#605E5C] mb-1">{label}</label>
      <select
        value={selectValue}
        disabled={Boolean(parentKey && !parentVal)}
        onChange={e => {
          const v = e.target.value;
          if (v === CUSTOM_OPTION) {
            setCustomMode(true);
            apply('');
            return;
          }
          setCustomMode(false);
          const profile = getBusinessProfile(businessType);
          const nextMeta = { ...values.metadata, [key]: v };
          profile.product_fields.forEach(f => {
            if (f.dependsOn === key) delete nextMeta[f.key];
          });
          onChange({ ...values, metadata: nextMeta });
        }}
        className="w-full px-3 py-2 rounded-lg border border-[#E1DFDD] text-sm bg-white disabled:bg-[#F3F2F1] disabled:text-[#A19F9D]"
      >
        <option value="">
          {parentKey && !parentVal
            ? (isSw ? 'Chagua kwanza...' : 'Select parent first...')
            : (isSw ? 'Chagua...' : 'Select...')}
        </option>
        {options.map(o => (
          <option key={o} value={o}>{o}</option>
        ))}
        {allowCustom && (
          <option value={CUSTOM_OPTION}>{isSw ? 'Nyingine (andika)...' : 'Other (type custom)...'}</option>
        )}
      </select>
      {(customMode || (options.length === 0 && field.type !== 'select')) && allowCustom && (
        <input
          type="text"
          value={strVal}
          placeholder={resolveFieldPlaceholder(field, isSw)}
          onChange={e => apply(e.target.value)}
          className="w-full mt-1.5 px-3 py-2 rounded-lg border border-[#E1DFDD] text-sm bg-white"
        />
      )}
    </div>
  );
}

function renderField(
  field: ProductFieldSchema,
  isSw: boolean,
  businessType: BusinessType,
  values: DynamicProductFormValues,
  onChange: (v: DynamicProductFormValues) => void,
) {
  const label = isSw ? field.label_sw : field.label_en;
  const key = field.key;

  const setMeta = (val: string | number | boolean) => {
    onChange({ ...values, metadata: { ...values.metadata, [key]: val } });
  };

  const setDirect = (val: string | boolean) => {
    onChange({ ...values, [key]: val } as DynamicProductFormValues);
  };

  const directKeys = ['batch_number', 'expiry_date', 'requires_prescription', 'barcode'];
  const currentVal = directKeys.includes(key)
    ? (values as Record<string, unknown>)[key]
    : values.metadata[key];

  if (field.type === 'boolean') {
    const checked = Boolean(currentVal);
    return (
      <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={e => (field.metadata ? setMeta(e.target.checked) : setDirect(e.target.checked))}
          className="rounded border-[#C8C6C4]"
        />
        <span className="font-semibold text-[#323130]">{label}</span>
      </label>
    );
  }

  if (field.type === 'select' || field.preset) {
    return (
      <PresetSelectField
        key={key}
        field={field}
        isSw={isSw}
        businessType={businessType}
        values={values}
        onChange={onChange}
      />
    );
  }

  if (field.type === 'textarea') {
    return (
      <div key={key} className="col-span-full">
        <label className="block text-xs font-bold text-[#605E5C] mb-1">{label}</label>
        <textarea
          value={String(currentVal ?? '')}
          onChange={e => setMeta(e.target.value)}
          rows={3}
          placeholder={resolveFieldPlaceholder(field, isSw)}
          className="w-full px-3 py-2 rounded-lg border border-[#E1DFDD] text-sm"
        />
      </div>
    );
  }

  const inputType = field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text';
  return (
    <div key={key}>
      <label className="block text-xs font-bold text-[#605E5C] mb-1">{label}</label>
      <input
        type={inputType}
        value={currentVal === undefined || currentVal === null ? '' : String(currentVal)}
        placeholder={resolveFieldPlaceholder(field, isSw)}
        onChange={e => {
          const val = field.type === 'number' ? Number(e.target.value) : e.target.value;
          field.metadata ? setMeta(val) : setDirect(String(val));
        }}
        className="w-full px-3 py-2 rounded-lg border border-[#E1DFDD] text-sm"
      />
    </div>
  );
}

export const DynamicProductForm: React.FC<DynamicProductFormProps> = ({
  language,
  businessType,
  values,
  onChange,
}) => {
  const isSw = language === 'sw';
  const profile = getBusinessProfile(businessType);
  if (profile.product_fields.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#F3F2F1]">
      <div className="col-span-full">
        <span className="text-[10px] font-black uppercase text-[#6264A7] tracking-wider">
          {isSw ? `Maeneo maalum — ${profile.label_sw}` : `${profile.label_en} Specific Fields`}
        </span>
      </div>
      {profile.product_fields.map(f => renderField(f, isSw, businessType, values, onChange))}
    </div>
  );
};
