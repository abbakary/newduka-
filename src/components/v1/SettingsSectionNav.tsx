import React from 'react';

export interface SettingsNavItem {
  id: string;
  labelEn: string;
  labelSw: string;
  icon: React.ReactNode;
  managerOnly?: boolean;
}

interface SettingsSectionNavProps {
  items: SettingsNavItem[];
  activeId: string;
  onChange: (id: string) => void;
  isSw: boolean;
}

export const SettingsSectionNav: React.FC<SettingsSectionNavProps> = ({
  items,
  activeId,
  onChange,
  isSw,
}) => (
  <nav className="flex flex-row lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0 shrink-0 lg:w-[9.5rem]">
    {items.map(item => {
      const active = activeId === item.id;
      return (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all cursor-pointer whitespace-nowrap lg:w-full ${
            active
              ? 'bg-[#6264A7]/10 text-[#6264A7] font-bold ring-1 ring-[#6264A7]/30'
              : 'text-[#605E5C] hover:bg-[#F3F2F1] hover:text-[#323130]'
          }`}
        >
          <span className="shrink-0 opacity-80">{item.icon}</span>
          <span className="text-[11px] leading-tight">{isSw ? item.labelSw : item.labelEn}</span>
        </button>
      );
    })}
  </nav>
);
