import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Store, 
  ShoppingBag, 
  Pill, 
  Hammer, 
  Utensils, 
  Briefcase, 
  ShieldCheck, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft, 
  Lock, 
  Mail, 
  Phone, 
  User, 
  MapPin, 
  FileText, 
  X, 
  Sparkles,
  CreditCard,
  Eye,
  EyeOff
} from 'lucide-react';
import { BusinessType, Language, UserRole, VendorApplication, AuthUser } from '@/types/v1';
import { ALL_BUSINESS_TYPES, getBusinessProfile, isBusinessTypeRegistrationDisabled, businessTypeUnavailableMessage } from '@/lib/businessEngine';
import { api } from '@/lib/api';
import { loginAndLoadUser } from '@/lib/authBridge';
import { formatApiError } from '@/lib/formatApiError';
import confetti from 'canvas-confetti';

interface AuthModalOrViewProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  initialMode?: 'login' | 'register';
  initialBusinessType?: BusinessType;
  onLoginSuccess: (user: AuthUser, options?: { fromRegistration?: boolean }) => void;
  onRegisterSubmit: (newApp: VendorApplication, user: AuthUser) => void;
}

export const AuthModalOrView: React.FC<AuthModalOrViewProps> = ({
  isOpen,
  onClose,
  language,
  initialMode = 'login',
  initialBusinessType,
  onLoginSuccess,
  onRegisterSubmit,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [registerStep, setRegisterStep] = useState<number>(1);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Login form state
  const [loginEmail, setLoginEmail] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Register Wizard Form State
  const [fullName, setFullName] = useState<string>('');
  const [regEmail, setRegEmail] = useState<string>('');
  const [regPhone, setRegPhone] = useState<string>('+255');
  const [regPassword, setRegPassword] = useState<string>('');
  const [regPasswordConfirm, setRegPasswordConfirm] = useState<string>('');
  const [registerError, setRegisterError] = useState<string>('');
  const [registerLoading, setRegisterLoading] = useState(false);
  const [accountRole, setAccountRole] = useState<UserRole>('vendor_owner');
  const [businessType, setBusinessType] = useState<BusinessType>(initialBusinessType ?? 'retail');
  const [businessName, setBusinessName] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [tinNumber, setTinNumber] = useState<string>('');
  const [licenseNumber, setLicenseNumber] = useState<string>('');
  const [logoEmoji, setLogoEmoji] = useState<string>('💊');

  useEffect(() => {
    if (initialBusinessType && !isBusinessTypeRegistrationDisabled(initialBusinessType)) {
      setBusinessType(initialBusinessType);
    } else if (initialBusinessType && isBusinessTypeRegistrationDisabled(initialBusinessType)) {
      setBusinessType('retail');
      setRegisterError(businessTypeUnavailableMessage(language === 'sw', initialBusinessType));
    }
  }, [initialBusinessType, language]);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode, isOpen]);

  if (!isOpen) return null;

  const isSw = language === 'sw';

  // Handle Standard Login Form
  const handlePerformLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    const password = loginPassword;
    try {
      const user = await loginAndLoadUser(loginEmail, password);
      onLoginSuccess(user);
      onClose();
    } catch (err) {
      setLoginError(formatApiError(err, isSw));
    } finally {
      setLoginLoading(false);
    }
  };

  const handleCompleteRegistration = async () => {
    setRegisterError('');
    const password = regPassword.trim();
    if (!businessName.trim() || !fullName.trim() || !regEmail.trim() || !password) {
      setRegisterError(isSw ? 'Tafadhali jaza sehemu zote muhimu.' : 'Please fill all required fields.');
      return;
    }
    if (password.length < 6) {
      setRegisterError(isSw ? 'Nenosiri lazima liwe na angalau herufi 6.' : 'Password must be at least 6 characters.');
      return;
    }
    if (password !== regPasswordConfirm.trim()) {
      setRegisterError(isSw ? 'Nenosiri halilingani.' : 'Passwords do not match.');
      return;
    }
    if (isBusinessTypeRegistrationDisabled(businessType)) {
      setRegisterError(businessTypeUnavailableMessage(isSw, businessType));
      return;
    }
    const phone = regPhone.trim().replace(/\s+/g, '');
    if (phone.replace(/\D/g, '').length < 9) {
      setRegisterError(isSw ? 'Weka namba ya simu kamili (mf. +255712345678).' : 'Enter a full phone number (e.g. +255712345678).');
      return;
    }

    setRegisterLoading(true);
    try {
      await api.register({
        business_name: businessName.trim(),
        owner_name: fullName.trim(),
        email: regEmail.trim().toLowerCase(),
        phone,
        password,
        business_type: businessType,
        tin_number: tinNumber.trim(),
        license_number: licenseNumber.trim(),
        region: 'Dar es Salaam',
        district: location.trim() || 'Ilala',
        plan_tier: 'starter',
      });
      const user = await loginAndLoadUser(regEmail.trim().toLowerCase(), password);
      onLoginSuccess(user, { fromRegistration: true });
      confetti({ particleCount: 40, spread: 60, origin: { y: 0.6 } });
      onClose();
    } catch (err) {
      setRegisterError(formatApiError(err, isSw));
    } finally {
      setRegisterLoading(false);
    }
  };

  const validateRegisterStep = (step: number): boolean => {
    setRegisterError('');
    if (step === 1) {
      if (!fullName.trim()) {
        setRegisterError(isSw ? 'Weka jina kamili la mmiliki.' : 'Enter the owner full name.');
        return false;
      }
      if (!regEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail.trim())) {
        setRegisterError(isSw ? 'Weka barua pepe sahihi.' : 'Enter a valid email address.');
        return false;
      }
      const phone = regPhone.trim().replace(/\s+/g, '');
      if (phone.replace(/\D/g, '').length < 9) {
        setRegisterError(isSw ? 'Weka namba ya simu kamili (mf. +255712345678).' : 'Enter a full phone number (e.g. +255712345678).');
        return false;
      }
      if (!regPassword || regPassword.length < 6) {
        setRegisterError(isSw ? 'Nenosiri lazima liwe na angalau herufi 6.' : 'Password must be at least 6 characters.');
        return false;
      }
      if (regPassword !== regPasswordConfirm) {
        setRegisterError(isSw ? 'Nenosiri halilingani.' : 'Passwords do not match.');
        return false;
      }
    }
    if (step === 2 && isBusinessTypeRegistrationDisabled(businessType)) {
      setRegisterError(businessTypeUnavailableMessage(isSw, businessType));
      return false;
    }
    if (step === 3 && !businessName.trim()) {
      setRegisterError(isSw ? 'Weka jina rasmi la biashara.' : 'Enter your official business name.');
      return false;
    }
    return true;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fade-in font-sans">
      <div className="bg-white rounded-2xl border border-[#E1DFDD] shadow-2xl max-w-xl w-full overflow-hidden my-6">
        {/* Modal Top Header */}
        <div className="bg-[#24284A] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#0078D4] to-[#6264A7] flex items-center justify-center text-white font-bold text-lg shadow-sm">
              +
            </div>
            <div>
              <div className="font-extrabold text-base tracking-tight flex items-center gap-2">
                <span>Duka+ Portal</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#0078D4]/30 text-[#00A4EF] font-semibold border border-[#00A4EF]/30">v3.0</span>
              </div>
              <p className="text-xs text-slate-300">
                {mode === 'login' ? (isSw ? 'Ingia Kwenye Akaunti Yako' : 'Sign in to your account') : (isSw ? 'Sajili Duka Lako Jipya' : 'Create new business account')}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Tabs (Sign In vs Register) */}
        <div className="grid grid-cols-2 border-b border-[#E1DFDD] text-xs font-bold bg-[#F8F8F8]">
          <button
            onClick={() => setMode('login')}
            className={`py-3 text-center transition-all cursor-pointer ${
              mode === 'login'
                ? 'bg-white text-[#6264A7] border-b-2 border-[#6264A7]'
                : 'text-[#605E5C] hover:text-[#323130]'
            }`}
          >
            {isSw ? '🔑 Ingia (Sign In)' : '🔑 Sign In'}
          </button>
          <button
            onClick={() => {
              setMode('register');
              setRegisterStep(1);
              setRegisterError('');
            }}
            className={`py-3 text-center transition-all cursor-pointer ${
              mode === 'register'
                ? 'bg-white text-[#6264A7] border-b-2 border-[#6264A7]'
                : 'text-[#605E5C] hover:text-[#323130]'
            }`}
          >
            {isSw ? '✨ Jisajili (Register Business)' : '✨ Register Business'}
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6">
          {mode === 'login' ? (
            /* 1. LOGIN TAB */
            <div className="space-y-5">
              <form onSubmit={handlePerformLogin} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[#323130] mb-1">
                    {isSw ? 'Barua Pepe au Namba ya Simu' : 'Email Address or Phone Number'}
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#605E5C] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="salum@alfalahpharmacy.co.tz"
                      className="w-full pl-9 pr-3 py-2 bg-[#F8F8F8] border border-[#C8C6C4] focus:bg-white focus:border-[#0078D4] rounded-lg text-xs text-[#323130] outline-none"
                      required
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-[#323130]">
                      {isSw ? 'Nenosiri' : 'Password'}
                    </label>
                    <a href="#forgot" onClick={(e) => { e.preventDefault(); alert(isSw ? 'Tafadhali tumia 1-Click Demo Logins hapo chini kuingia bila nenosiri.' : 'Please use the 1-Click Demo Logins below.'); }} className="text-[11px] text-[#0078D4] hover:underline">
                      {isSw ? 'Umesahau nenosiri?' : 'Forgot password?'}
                    </a>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#605E5C] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full pl-9 pr-9 py-2 bg-[#F8F8F8] border border-[#C8C6C4] focus:bg-white focus:border-[#0078D4] rounded-lg text-xs text-[#323130] outline-none"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#605E5C] hover:text-[#323130]"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-[#6264A7] hover:bg-[#525492] text-white text-xs font-bold rounded-lg shadow-xs transition-all cursor-pointer"
                >
                  {isSw ? 'Ingia Kwenye Duka Lako' : 'Sign In to Portal'}
                </button>
              </form>
            </div>
          ) : (
            /* 2. MULTI-STEP REGISTER WIZARD */
            <div className="space-y-4">
              {/* Stepper Header */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-[#6264A7]">
                  {isSw ? `Hatua ${registerStep} ya 4` : `Step ${registerStep} of 4`}
                </span>
                <span className="text-[11px] text-[#605E5C]">
                  {registerStep === 1 && (isSw ? 'Taarifa za Mtumiaji' : 'User Credentials')}
                  {registerStep === 2 && (isSw ? 'Aina ya Biashara' : 'Business Archetype')}
                  {registerStep === 3 && (isSw ? 'Taarifa za Duka & TRA' : 'Business & Compliance')}
                  {registerStep === 4 && (isSw ? 'Hakiki & Tuma' : 'Review & Submit')}
                </span>
              </div>
              <div className="w-full bg-[#EDEBE9] h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-[#6264A7] h-full transition-all duration-300"
                  style={{ width: `${(registerStep / 4) * 100}%` }}
                ></div>
              </div>

              {/* STEP 1: Account Role & Credentials */}
              {registerStep === 1 && (
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-[#323130] mb-1">
                      {isSw ? 'Wewe ni Nani? (Chagua Nafasi / Role)' : 'Account Role'}
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setAccountRole('vendor_owner')}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                          accountRole === 'vendor_owner'
                            ? 'bg-[#6264A7]/10 border-[#6264A7] text-[#6264A7] font-bold'
                            : 'bg-[#F8F8F8] border-[#EDEBE9] text-[#605E5C]'
                        }`}
                      >
                        <Store className="w-4 h-4 mb-1 text-[#6264A7]" />
                        <div className="text-xs">{isSw ? 'Mwenye Biashara' : 'Vendor / Business'}</div>
                        <div className="text-[10px] opacity-80 font-normal">{isSw ? 'Duka, mgahawa au saluni' : 'Shop, pharmacy, hardware'}</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setAccountRole('super_admin')}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                          accountRole === 'super_admin'
                            ? 'bg-[#6264A7]/10 border-[#6264A7] text-[#6264A7] font-bold'
                            : 'bg-[#F8F8F8] border-[#EDEBE9] text-[#605E5C]'
                        }`}
                      >
                        <ShieldCheck className="w-4 h-4 mb-1 text-[#0078D4]" />
                        <div className="text-xs">{isSw ? 'Msimamizi (Super Admin)' : 'Super Admin'}</div>
                        <div className="text-[10px] opacity-80 font-normal">{isSw ? 'Idhinisha maduka & mfumo' : 'Platform approvals & stats'}</div>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#323130] mb-1">
                      {isSw ? 'Jina Kamili la Mmiliki' : 'Full Name'} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Salum Omar Mwakyoma"
                      className="w-full px-3 py-2 bg-[#F8F8F8] border border-[#C8C6C4] focus:bg-white rounded-lg text-xs text-[#323130] outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#323130] mb-1">
                        {isSw ? 'Barua Pepe' : 'Email Address'} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="salum@example.co.tz"
                        className="w-full px-3 py-2 bg-[#F8F8F8] border border-[#C8C6C4] focus:bg-white rounded-lg text-xs text-[#323130] outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#323130] mb-1">
                        {isSw ? 'Namba ya Simu (+255)' : 'Phone Number'} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        placeholder="+255 754 000 111"
                        className="w-full px-3 py-2 bg-[#F8F8F8] border border-[#C8C6C4] focus:bg-white rounded-lg text-xs text-[#323130] outline-none"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#323130] mb-1">
                        {isSw ? 'Nenosiri' : 'Password'} <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-[#605E5C] absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={regPassword}
                          onChange={(e) => setRegPassword(e.target.value)}
                          placeholder={isSw ? 'Angalau herufi 6' : 'At least 6 characters'}
                          minLength={6}
                          className="w-full pl-9 pr-9 py-2 bg-[#F8F8F8] border border-[#C8C6C4] focus:bg-white rounded-lg text-xs text-[#323130] outline-none"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#605E5C] hover:text-[#323130]"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#323130] mb-1">
                        {isSw ? 'Thibitisha Nenosiri' : 'Confirm Password'} <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-[#605E5C] absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={regPasswordConfirm}
                          onChange={(e) => setRegPasswordConfirm(e.target.value)}
                          placeholder={isSw ? 'Rudia nenosiri' : 'Repeat password'}
                          minLength={6}
                          className="w-full pl-9 pr-3 py-2 bg-[#F8F8F8] border border-[#C8C6C4] focus:bg-white rounded-lg text-xs text-[#323130] outline-none"
                          required
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: Business Type & Dynamic Modules */}
              {registerStep === 2 && (
                <div className="space-y-3 pt-2">
                  <label className="block text-xs font-semibold text-[#323130]">
                    {isSw ? 'Chagua Aina ya Biashara Yako (Dynamic Archetype)' : 'Select Your Business Type'}
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[320px] overflow-y-auto pr-1">
                    {ALL_BUSINESS_TYPES.map((type) => {
                      const p = getBusinessProfile(type);
                      const disabled = isBusinessTypeRegistrationDisabled(type);
                      return (
                      <button
                        key={type}
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          if (disabled) {
                            setRegisterError(businessTypeUnavailableMessage(isSw, type));
                            return;
                          }
                          setRegisterError('');
                          setBusinessType(type);
                          setLogoEmoji(p.icon);
                        }}
                        className={`p-3 rounded-xl border text-left transition-all relative ${
                          disabled
                            ? 'bg-slate-50 border-slate-200 opacity-70 cursor-not-allowed'
                            : businessType === type
                              ? 'bg-[#6264A7]/10 border-[#6264A7] ring-1 ring-[#6264A7] cursor-pointer'
                              : 'bg-[#F8F8F8] border-[#EDEBE9] hover:bg-white text-[#605E5C] cursor-pointer'
                        }`}
                      >
                        {disabled && (
                          <span className="absolute top-2 right-2 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                            {isSw ? 'Inakuja' : 'Coming soon'}
                          </span>
                        )}
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">{p.icon}</span>
                          <span className="text-xs font-bold text-[#323130]">{isSw ? p.label_sw : p.label_en}</span>
                        </div>
                        <p className="text-[10px] text-[#605E5C] leading-snug">
                          {disabled
                            ? businessTypeUnavailableMessage(isSw, type)
                            : p.modules.slice(0, 3).join(' • ')}
                        </p>
                      </button>
                    );})}
                  </div>
                </div>
              )}

              {/* STEP 3: Business Details & Compliance */}
              {registerStep === 3 && (
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-[#323130] mb-1">
                      {isSw ? 'Jina Rasmi la Biashara / Duka' : 'Official Business Name'} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="e.g. Afya Bora Pharmacy • Kariakoo"
                      className="w-full px-3 py-2 bg-[#F8F8F8] border border-[#C8C6C4] focus:bg-white rounded-lg text-xs text-[#323130] outline-none"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#323130] mb-1">
                        {isSw ? 'Eneo / Mtaa (Location)' : 'Location / Street'}
                      </label>
                      <input
                        type="text"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="Kariakoo, Dar es Salaam"
                        className="w-full px-3 py-2 bg-[#F8F8F8] border border-[#C8C6C4] focus:bg-white rounded-lg text-xs text-[#323130] outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#323130] mb-1">
                        {isSw ? 'Namba ya TIN ya TRA (9 Digits)' : 'TRA TIN Number'}
                      </label>
                      <input
                        type="text"
                        value={tinNumber}
                        onChange={(e) => setTinNumber(e.target.value)}
                        placeholder="108-992-451"
                        className="w-full px-3 py-2 bg-[#F8F8F8] border border-[#C8C6C4] focus:bg-white rounded-lg text-xs text-[#323130] outline-none font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#323130] mb-1">
                      {isSw ? 'Namba ya Leseni ya TMDA / BRELA' : 'TMDA / BRELA License Number'}
                    </label>
                    <input
                      type="text"
                      value={licenseNumber}
                      onChange={(e) => setLicenseNumber(e.target.value)}
                      placeholder="TMDA-PHARM-2026-44"
                      className="w-full px-3 py-2 bg-[#F8F8F8] border border-[#C8C6C4] focus:bg-white rounded-lg text-xs text-[#323130] outline-none font-mono"
                    />
                  </div>
                </div>
              )}

              {/* STEP 4: Review & Submit */}
              {registerStep === 4 && (
                <div className="space-y-3 pt-2">
                  <div className="p-4 bg-[#F8F8F8] rounded-xl border border-[#EDEBE9] space-y-2 text-xs">
                    <div className="flex items-center justify-between border-b border-[#EDEBE9] pb-2">
                      <span className="font-bold text-[#323130]">{businessName || 'My Duka Store'}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#0078D4]/10 text-[#0078D4] uppercase">
                        {businessType}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[#605E5C] text-[11px]">
                      <div>👤 Mmiliki: <strong className="text-[#323130]">{fullName || '—'}</strong></div>
                      <div>📧 Email: <strong className="text-[#323130]">{regEmail || '—'}</strong></div>
                      <div>📱 Simu: <strong className="text-[#323130]">{regPhone || '—'}</strong></div>
                      <div>📍 Eneo: <strong className="text-[#323130]">{location}</strong></div>
                      <div>📋 TIN: <strong className="text-[#323130]">{tinNumber || '—'}</strong></div>
                      <div>📜 Leseni: <strong className="text-[#323130]">{licenseNumber || '—'}</strong></div>
                    </div>
                  </div>

                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                    <div>
                      <strong>{isSw ? 'Akaunti Itafunguliwa Mara Moja' : 'Instant Account Access'}</strong>
                      <p className="text-[11px] text-emerald-800 mt-0.5">
                        {isSw
                          ? 'Baada ya kutuma, utaingia moja kwa moja kwenye eneo la kazi (workplace) la biashara yako.'
                          : 'After submitting, you will be signed in and taken directly to your business workplace.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {registerError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
                  {registerError}
                </div>
              )}

              {/* Wizard Navigation Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-[#EDEBE9]">
                {registerStep > 1 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setRegisterError('');
                      setRegisterStep(prev => prev - 1);
                    }}
                    className="px-3.5 py-1.5 border border-[#C8C6C4] hover:bg-[#F3F2F1] rounded-lg text-xs font-semibold text-[#323130] cursor-pointer flex items-center gap-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>{isSw ? 'Rudi Nyuma' : 'Back'}</span>
                  </button>
                ) : (
                  <div></div>
                )}

                {registerStep < 4 ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (!validateRegisterStep(registerStep)) return;
                      setRegisterStep(prev => prev + 1);
                    }}
                    className="px-4 py-2 bg-[#6264A7] hover:bg-[#525492] text-white rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1.5 shadow-xs"
                  >
                    <span>{isSw ? 'Endelea' : 'Next Step'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={registerLoading}
                    onClick={() => void handleCompleteRegistration()}
                    className="px-5 py-2 bg-[#107C10] hover:bg-[#0e6b0e] text-white rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-60"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {registerLoading
                        ? (isSw ? 'Inasajili…' : 'Creating…')
                        : (isSw ? 'Tuma Ombi la Duka' : 'Submit Application')}
                    </span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
