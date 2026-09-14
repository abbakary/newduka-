import React, { useState } from 'react';
import { ArrowLeft, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import type { AuthUser, Language } from '@/types/v1';
import { api } from '@/lib/api';
import { loginAndLoadUser } from '@/lib/authBridge';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '@/lib/apiConfig';
import { formatApiError } from '@/lib/formatApiError';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { PwaInstallPrompt } from '@/components/ui/PwaInstallPrompt';

interface PublicLoginViewProps {
  language: Language;
  onBack: () => void;
  onRegister: () => void;
  onLoginSuccess: (user: AuthUser) => void;
}

const TEAL = '#0d9488';

export const PublicLoginView: React.FC<PublicLoginViewProps> = ({
  language,
  onBack,
  onRegister,
  onLoginSuccess,
}) => {
  const isSw = language === 'sw';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await loginAndLoadUser(email, password);
      onLoginSuccess(user);
    } catch (err) {
      setError(formatApiError(err, isSw));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f6f5] flex flex-col">
      <header className="p-4 sm:p-6">
        <button type="button" onClick={onBack} className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 cursor-pointer">
          <ArrowLeft className="w-4 h-4" />
          {isSw ? 'Rudi ukurasa wa mwanzo' : 'Back to home'}
        </button>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-16">
        <BrandLogo height={48} className="mb-4" />
        <PwaInstallPrompt language={language} />

        <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          <h1 className="text-2xl font-serif font-bold text-slate-900">{isSw ? 'Karibu tena' : 'Welcome back'}</h1>
          <p className="text-sm text-slate-500 mt-1">{isSw ? 'Ingia kwenye akaunti yako ya Duka+' : 'Sign in to your Duka+ account'}</p>

          {error && (
            <div className="mt-4 p-3 rounded-xl bg-rose-50 text-rose-700 text-sm border border-rose-100">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{isSw ? 'Barua pepe' : 'Email'}</label>
              <div className="relative mt-1.5">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@business.co.tz"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{isSw ? 'Nenosiri' : 'Password'}</label>
                <button type="button" className="text-xs font-medium cursor-pointer" style={{ color: TEAL }}>
                  {isSw ? 'Umesahau?' : 'Forgot password?'}
                </button>
              </div>
              <div className="relative mt-1.5">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPass ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={isSw ? 'Weka nenosiri' : 'Enter your password'}
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-full text-sm font-bold text-white cursor-pointer disabled:opacity-60 mt-2"
              style={{ background: TEAL }}
            >
              {loading ? (isSw ? 'Inaingia…' : 'Signing in…') : (isSw ? 'Ingia' : 'Sign in')}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            {isSw ? 'Huna akaunti?' : "Don't have an account?"}{' '}
            <button type="button" onClick={onRegister} className="font-semibold cursor-pointer hover:underline" style={{ color: TEAL }}>
              {isSw ? 'Jisajili' : 'Get started'}
            </button>
          </p>

          <div className="mt-6 pt-6 border-t border-slate-100">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2">
              {isSw ? 'Akaunti za majaribio (demo123)' : 'Demo accounts (password: demo123)'}
            </p>
            <div className="flex flex-wrap gap-2">
              {DEMO_ACCOUNTS.filter(a => a.email.includes('@sample.')).slice(0, 4).map(account => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => { setEmail(account.email); setPassword(DEMO_PASSWORD); }}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 text-slate-700 hover:bg-teal-50 hover:text-teal-800 cursor-pointer"
                >
                  {isSw ? account.labelSw : account.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
