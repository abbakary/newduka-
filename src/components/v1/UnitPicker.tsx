import React, { useEffect, useMemo, useState } from 'react';

const OTHER = '__other_unit__';

interface UnitPickerProps {
  units: string[];
  value: string;
  onChange: (unit: string) => void;
  isSw?: boolean;
  className?: string;
  selectClassName?: string;
  inputClassName?: string;
  label?: string;
}

export function UnitPicker({
  units,
  value,
  onChange,
  isSw = false,
  className = '',
  selectClassName = 'w-full px-3 py-2.5 bg-white border border-[#C8C6C4] rounded-lg outline-none text-sm font-medium',
  inputClassName = 'w-full mt-1.5 px-3 py-2.5 bg-white border border-[#C8C6C4] rounded-lg outline-none text-sm font-medium',
  label,
}: UnitPickerProps) {
  const inList = useMemo(() => units.includes(value), [units, value]);
  const [customMode, setCustomMode] = useState(() => Boolean(value && !units.includes(value)));
  const [customVal, setCustomVal] = useState(() => (value && !units.includes(value) ? value : ''));

  useEffect(() => {
    const custom = Boolean(value && !units.includes(value));
    setCustomMode(custom);
    if (custom) setCustomVal(value);
  }, [value, units]);

  const selectValue = customMode ? OTHER : (inList ? value : (units[0] ?? value));

  return (
    <div className={className}>
      {label && (
        <label className="block text-[11px] font-semibold text-[#605E5C] mb-1">{label}</label>
      )}
      <select
        value={selectValue}
        onChange={e => {
          const v = e.target.value;
          if (v === OTHER) {
            setCustomMode(true);
            onChange(customVal.trim());
            return;
          }
          setCustomMode(false);
          onChange(v);
        }}
        className={selectClassName}
      >
        {units.map(u => (
          <option key={u} value={u}>{u}</option>
        ))}
        <option value={OTHER}>{isSw ? 'Kipimo kingine…' : 'Other unit…'}</option>
      </select>
      {customMode && (
        <input
          type="text"
          value={customVal}
          placeholder={isSw ? 'Andika kipimo (kg, pcs…)' : 'Type unit (kg, pcs…)'}
          onChange={e => {
            setCustomVal(e.target.value);
            onChange(e.target.value.trim());
          }}
          className={inputClassName}
        />
      )}
    </div>
  );
}
