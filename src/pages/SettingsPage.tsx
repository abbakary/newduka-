import { useAuthStore } from '@/stores';
import { Card } from '@/components/ui';
import { BUSINESS_TYPE_LABELS } from '@/lib/utils';

export function SettingsPage() {
  const { user, language } = useAuthStore();
  const lang = language;
  const biz = user?.business_type ? BUSINESS_TYPE_LABELS[user.business_type] : null;

  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-2xl font-bold">{lang === 'sw' ? 'Mipangilio' : 'Settings'}</h1>
      <Card className="p-5 space-y-4">
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wide">{lang === 'sw' ? 'Biashara' : 'Business'}</p>
          <p className="font-semibold text-lg">{user?.business_name}</p>
          {biz && <p className="text-sm text-slate-500">{biz.icon} {biz[lang]}</p>}
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><p className="text-slate-400">{lang === 'sw' ? 'Jina' : 'Name'}</p><p className="font-medium">{user?.name}</p></div>
          <div><p className="text-slate-400">Email</p><p className="font-medium">{user?.email}</p></div>
          <div><p className="text-slate-400">{lang === 'sw' ? 'Jukumu' : 'Role'}</p><p className="font-medium">{user?.staff_role ?? user?.role}</p></div>
          <div><p className="text-slate-400">{lang === 'sw' ? 'Lugha' : 'Language'}</p><p className="font-medium">{lang === 'sw' ? 'Kiswahili' : 'English'}</p></div>
        </div>
      </Card>
    </div>
  );
}

export function ReportsPage() {
  const { language } = useAuthStore();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{language === 'sw' ? 'Ripoti' : 'Reports'}</h1>
      <Card className="p-8 text-center text-slate-400">
        {language === 'sw' ? 'Ripoti za kina zinakuja hivi karibuni' : 'Detailed reports coming soon'}
      </Card>
    </div>
  );
}
