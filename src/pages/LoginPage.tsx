import { useState } from 'react';
import { ArrowLeft, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores';
import { t } from '@/lib/utils';
import { BrandLogo } from '@/components/ui/BrandLogo';

const TEAL = '#0d9488';

/** Standalone login page — matches public landing auth style. */
export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const { login, isLoading, language } = useAuthStore();
  const navigate = useNavigate();
  const lang = language;
  const isSw = lang === 'sw';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      navigate('/app/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  return (
    <div className="min-h-dvh bg-[#f4f6f5] flex flex-col">
      <header className="p-4 sm:p-6">
        <Link to="/" className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft className="w-4 h-4" />
          {isSw ? 'Rudi ukurasa wa mwanzo' : 'Back to home'}
        </Link>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-16">
        <BrandLogo height={48} className="mb-8" />

        <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          <h1 className="text-2xl font-serif font-bold text-slate-900">{t('login', lang)}</h1>
          <p className="text-sm text-slate-500 mt-1">{isSw ? 'Ingia kwenye akaunti yako' : 'Sign in to your Duka+ account'}</p>

          {error && <div className="mt-4 p-3 rounded-xl bg-rose-50 text-rose-700 text-sm">{error}</div>}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Email</label>
              <div className="relative mt-1.5">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@business.co.tz"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-teal-500"
                />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{isSw ? 'Nenosiri' : 'Password'}</label>
              <div className="relative mt-1.5">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPass ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-teal-500"
                />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-full text-sm font-bold text-white disabled:opacity-60"
              style={{ background: TEAL }}
            >
              {isLoading ? '…' : t('login', lang)}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            {isSw ? 'Huna akaunti?' : 'No account?'}{' '}
            <Link to="/register" className="font-semibold hover:underline" style={{ color: TEAL }}>
              {isSw ? 'Jisajili' : 'Register'}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
