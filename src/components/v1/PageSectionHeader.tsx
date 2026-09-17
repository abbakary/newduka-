import React from 'react';

interface PageSectionHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  toolbar?: React.ReactNode;
  className?: string;
}

/** Centered page title block used across vendor dashboards and modules. */
export const PageSectionHeader: React.FC<PageSectionHeaderProps> = ({
  title,
  subtitle,
  icon,
  badge,
  toolbar,
  className = '',
}) => (
  <div className={`bg-white rounded-2xl border border-[#E1DFDD] shadow-xs overflow-hidden w-full ${className}`}>
    <div className="px-4 py-4 sm:px-6 sm:py-5 border-b border-[#EDEBE9] bg-gradient-to-r from-white via-[#FAF9F8] to-white text-center">
      {icon && (
        <div className="flex justify-center mb-2">
          <div className="p-2.5 rounded-xl bg-[#6264A7]/10 text-[#6264A7] inline-flex">{icon}</div>
        </div>
      )}
      <h2 className="text-lg sm:text-xl md:text-2xl font-black text-[#323130] tracking-tight leading-tight">
        {title}
      </h2>
      {subtitle && (
        <p className="text-[11px] sm:text-xs text-[#605E5C] mt-1.5 max-w-2xl mx-auto leading-relaxed">
          {subtitle}
        </p>
      )}
      {badge && <div className="mt-2 flex justify-center flex-wrap gap-2">{badge}</div>}
    </div>
    {toolbar && (
      <div className="px-3 py-3 sm:px-4 sm:py-3.5 flex flex-wrap lg:flex-nowrap justify-center gap-2 w-full max-w-4xl mx-auto">
        {toolbar}
      </div>
    )}
  </div>
);
