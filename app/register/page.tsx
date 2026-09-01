'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  Check,
  CheckCircle2,
  ShieldCheck,
  Truck,
  UserRound,
} from 'lucide-react';
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import { getAuthCallbackEmailRedirectTo } from '../../lib/authFlow';
import { normalizeProfileRoleForStorage } from '../../lib/authRole';
import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient';

type RegisterRole = 'owner_operator' | 'fleet_operator' | 'transport_broker' | 'customer_shipper';

type SignupConfig = {
  appRole: 'broker' | 'company_admin' | 'driver' | 'customer';
  accountType: 'owner_driver' | 'fleet_courier' | 'broker_shipper' | 'customer_shipper';
  workspaceMode: 'owner_driver' | 'company' | 'broker' | 'customer';
  ownerDriverWorkspace: boolean;
};

type RolePresentation = {
  label: string;
  eyebrow: string;
  description: string;
  defaultPlan: string;
  price: string;
  pricePrefix?: string;
  icon: ReactNode;
  benefits: string[];
  flow: string[];
};

const REGISTER_ROLES = new Set<RegisterRole>(['owner_operator', 'fleet_operator', 'transport_broker', 'customer_shipper']);

const SIGNUP_ROLE_CONFIG: Record<Exclude<RegisterRole, 'owner_operator'>, SignupConfig> = {
  fleet_operator: { appRole: 'company_admin', accountType: 'fleet_courier', workspaceMode: 'company', ownerDriverWorkspace: false },
  transport_broker: { appRole: 'broker', accountType: 'broker_shipper', workspaceMode: 'broker', ownerDriverWorkspace: false },
  customer_shipper: { appRole: 'customer', accountType: 'customer_shipper', workspaceMode: 'customer', ownerDriverWorkspace: false },
};

const getSignupConfig = (role: RegisterRole): SignupConfig => role === 'owner_operator'
  ? { appRole: 'driver', accountType: 'owner_driver', workspaceMode: 'owner_driver', ownerDriverWorkspace: true }
  : SIGNUP_ROLE_CONFIG[role];

const PLAN_PRICES: Record<string, { label: string; price: string }> = {
  'owner-driver': { label: 'Owner Driver', price: '£29.99' },
  'customer-shipper': { label: 'Customer / Shipper', price: '£29.99' },
  'small-carrier': { label: 'Small Carrier', price: '£59.99' },
  broker: { label: 'Broker', price: '£79.99' },
  'growing-carrier': { label: 'Growing Carrier', price: '£89.99' },
  fleet: { label: 'Fleet', price: '£149.99' },
  enterprise: { label: 'Enterprise', price: 'From £249.99' },
};

const ROLE_UI: Record<RegisterRole, RolePresentation> = {
  customer_shipper: {
    label: 'Customer / Shipper',
    eyebrow: 'I need freight moved',
    description: 'Post transport work, compare quotes, award jobs and follow every movement through POD.',
    defaultPlan: 'customer-shipper',
    price: '£29.99',
    icon: <Building2 className="h-5 w-5" />,
    benefits: ['Post courier & freight work', 'Compare live carrier quotes', 'Award and track jobs', 'POD & invoice-ready records'],
    flow: ['Post', 'Compare', 'Award', 'Track', 'Prove'],
  },
  transport_broker: {
    label: 'Transport Broker',
    eyebrow: 'I manage transport for customers',
    description: 'Run the commercial workflow from posted requirement to awarded carrier and completed delivery.',
    defaultPlan: 'broker',
    price: '£79.99',
    icon: <BriefcaseBusiness className="h-5 w-5" />,
    benefits: ['Post and manage customer work', 'Compare carrier offers', 'Award directly into operations', 'Track through POD completion'],
    flow: ['Post', 'Quote', 'Award', 'Control', 'Complete'],
  },
  owner_operator: {
    label: 'Owner Driver',
    eyebrow: 'I move freight myself',
    description: 'Find suitable work, quote fast and move awarded jobs through a professional live workflow.',
    defaultPlan: 'owner-driver',
    price: '£29.99',
    icon: <UserRound className="h-5 w-5" />,
    benefits: ['Exchange access', 'Quote from one workspace', 'Awarded job operations', 'Live status & POD'],
    flow: ['Find', 'Quote', 'Win', 'Move', 'POD'],
  },
  fleet_operator: {
    label: 'Carrier / Fleet',
    eyebrow: 'I run vehicles and drivers',
    description: 'Bring multi-vehicle operations, driver allocation, dispatch and proof of delivery into one system.',
    defaultPlan: 'small-carrier',
    price: '£59.99',
    pricePrefix: 'From',
    icon: <Truck className="h-5 w-5" />,
    benefits: ['Exchange access', 'Driver allocation', 'Dispatch & operational records', 'POD & finance readiness'],
    flow: ['Find', 'Quote', 'Allocate', 'Dispatch', 'Complete'],
  },
};

const ROLE_BY_PLAN: Record<string, RegisterRole> = {
  'owner-driver': 'owner_operator',
  'customer-shipper': 'customer_shipper',
  'small-carrier': 'fleet_operator',
  broker: 'transport_broker',
  'growing-carrier': 'fleet_operator',
  fleet: 'fleet_operator',
  enterprise: 'fleet_operator',
};

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<RegisterRole>('customer_shipper');
  const [selectedPlan, setSelectedPlan] = useState('customer-shipper');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [message, setMessage] = useState('');
  const [warning, setWarning] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedRole = params.get('role') as RegisterRole | null;
    const plan = params.get('plan')?.trim() || '';
    if (plan && ROLE_BY_PLAN[plan]) {
      setSelectedPlan(plan);
      setRole(ROLE_BY_PLAN[plan]);
      return;
    }
    if (requestedRole && REGISTER_ROLES.has(requestedRole)) {
      setRole(requestedRole);
      setSelectedPlan(ROLE_UI[requestedRole].defaultPlan);
    }
  }, []);

  const roleUi = ROLE_UI[role];
  const priceUi = useMemo(() => PLAN_PRICES[selectedPlan] ?? { label: roleUi.label, price: roleUi.price }, [roleUi, selectedPlan]);

  const selectRole = (nextRole: RegisterRole) => {
    setRole(nextRole);
    setSelectedPlan(ROLE_UI[nextRole].defaultPlan);
    setError('');
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(''); setMessage(''); setWarning('');

    if (!isSupabaseConfigured) { setError('Registration is unavailable: Supabase is not configured.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    if (!acceptedTerms) { setError('Please confirm that you agree to the Terms and have read the Privacy Policy.'); return; }

    setLoading(true);
    try {
      const signupConfig = getSignupConfig(role);
      const storedRole = normalizeProfileRoleForStorage(signupConfig.appRole) ?? 'customer';
      const acceptedAt = new Date().toISOString();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          emailRedirectTo: getAuthCallbackEmailRedirectTo(),
          data: {
            role: signupConfig.appRole,
            requested_role: role,
            signup_type: role,
            account_type: signupConfig.accountType,
            workspace_mode: signupConfig.workspaceMode,
            owner_driver_workspace: signupConfig.ownerDriverWorkspace,
            selected_membership_plan: selectedPlan || null,
            terms_accepted_at: acceptedAt,
            terms_version: '2026-09-01',
            privacy_acknowledged_at: acceptedAt,
            privacy_version: '2026-09-01',
          },
        },
      });

      if (signUpError) { setError(signUpError.message); return; }

      if (data.session && data.user) {
        const { error: profileUpsertError } = await supabase.from('profiles').upsert({
          user_id: data.user.id,
          role: storedRole,
          status: 'active',
          is_driver: signupConfig.appRole === 'driver',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

        if (profileUpsertError) setWarning(`Account created, but profile sync needs attention: ${profileUpsertError.message}`);

        const initResponse = await fetch('/api/onboarding/init', {
          method: 'POST',
          headers: { Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ forceRegenerateToken: false }),
        });
        const initPayload = (await initResponse.json().catch(() => null)) as { error?: string } | null;
        if (!initResponse.ok) { setError(initPayload?.error ?? 'Account created, but onboarding could not be started.'); return; }

        router.replace('/onboarding/resume');
        return;
      }

      setMessage('Account created. Check your email to verify your account, then sign in.');
      setEmail(''); setPassword(''); setConfirmPassword(''); setAcceptedTerms(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Registration failed.');
    } finally { setLoading(false); }
  };

  return (
    <main className="min-h-screen bg-[#071B3C] text-[#102447] lg:grid lg:grid-cols-[0.9fr_1.1fr]">
      <section className="relative overflow-hidden bg-[#071B3C] px-6 py-10 text-white sm:px-10 lg:sticky lg:top-0 lg:flex lg:min-h-screen lg:flex-col lg:justify-between lg:px-14 lg:py-12 xl:px-20">
        <div className="pointer-events-none absolute -right-36 -top-36 h-[420px] w-[420px] rounded-full border border-white/10 shadow-[0_0_0_70px_rgba(29,87,216,0.08),0_0_0_140px_rgba(29,87,216,0.05)]" />
        <div className="pointer-events-none absolute bottom-[-180px] left-[-180px] h-[420px] w-[420px] rounded-full border border-[#F5A300]/15" />

        <div className="relative z-10">
          <Link href="/" className="inline-flex rounded-xl bg-white px-4 py-3 shadow-[0_18px_45px_rgba(0,0,0,0.18)]">
            <Image src="/xdrive-logo-primary.png" alt="XDrive Logistics" width={220} height={60} priority className="h-[44px] w-auto" />
          </Link>
          <p className="mt-10 text-xs font-black uppercase tracking-[0.2em] text-[#F5A300]">Your XDrive direction</p>
          <h1 className="mt-4 max-w-2xl text-[2.8rem] font-black leading-[0.95] tracking-tight sm:text-[3.8rem] xl:text-[4.7rem]">{roleUi.eyebrow}.</h1>
          <p className="mt-6 max-w-xl text-base font-semibold leading-7 text-white/70 sm:text-lg">{roleUi.description}</p>
        </div>

        <div className="relative z-10 my-10 rounded-[28px] border border-white/12 bg-white/[0.07] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-5 border-b border-white/10 pb-6">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#F5A300]">Selected membership</p>
              <h2 className="mt-2 text-2xl font-black">{priceUi.label}</h2>
            </div>
            <div className="text-right">
              <div className="text-[2rem] font-black tracking-tight text-white">{priceUi.price}</div>
              <p className="mt-1 text-xs font-bold text-white/50">per month + VAT after trial</p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-[#F5A300] px-5 py-4 text-[#071B3C] shadow-[0_15px_35px_rgba(245,163,0,0.18)]">
            <div className="flex items-center justify-between gap-4">
              <div><p className="text-xs font-black uppercase tracking-[0.13em]">Launch access</p><p className="mt-1 text-xl font-black">Your first 3 months are free</p></div>
              <ShieldCheck className="h-8 w-8 shrink-0" />
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {roleUi.benefits.map((benefit) => <div key={benefit} className="flex items-start gap-3 text-sm font-bold text-white/82"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#F5A300]" />{benefit}</div>)}
          </div>

          <div className="mt-7 border-t border-white/10 pt-6">
            <p className="text-[0.68rem] font-black uppercase tracking-[0.15em] text-white/40">Your operating flow</p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {roleUi.flow.map((step, index) => <div key={step} className="flex items-center gap-2"><span className="rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-xs font-black text-white/85">{step}</span>{index < roleUi.flow.length - 1 ? <ArrowRight className="h-3.5 w-3.5 text-[#F5A300]" /> : null}</div>)}
            </div>
          </div>
        </div>

        <div className="relative z-10 flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold text-white/50">
          <span>✓ No XDrive commission</span><span>✓ No booking fee</span><span>✓ Monthly rolling</span>
        </div>
      </section>

      <section className="bg-[#F7F9FC] px-5 py-8 sm:px-8 lg:flex lg:min-h-screen lg:items-center lg:px-12 lg:py-12 xl:px-20">
        <div className="mx-auto w-full max-w-[760px]">
          <div className="mb-8 flex items-center justify-between gap-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.17em] text-[#F5A300]">Create your account</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-[#071B3C] sm:text-4xl">Choose how you use XDrive.</h2>
            </div>
            <Link href="/login" className="hidden text-sm font-black text-[#0E3FA9] sm:block">Already a member? Sign in</Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {(Object.keys(ROLE_UI) as RegisterRole[]).map((item) => {
              const option = ROLE_UI[item];
              const active = role === item;
              return <button key={item} type="button" onClick={() => selectRole(item)} disabled={loading} className={`group relative flex min-h-[116px] items-start gap-4 rounded-2xl border p-5 text-left transition ${active ? 'border-[#0E3FA9] bg-white shadow-[0_18px_45px_rgba(14,63,169,0.12)] ring-2 ring-[#0E3FA9]/10' : 'border-[#DDE5EF] bg-white/70 hover:border-[#9BB5DD] hover:bg-white'}`}>
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${active ? 'bg-[#0E3FA9] text-white' : 'bg-[#EDF3FB] text-[#0E3FA9]'}`}>{option.icon}</span>
                <span className="pr-5"><span className="block text-sm font-black text-[#071B3C]">{option.label}</span><span className="mt-1.5 block text-xs font-semibold leading-5 text-[#60758F]">{option.eyebrow}</span></span>
                {active ? <span className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-[#F5A300] text-[#071B3C]"><Check className="h-3.5 w-3.5" /></span> : null}
              </button>;
            })}
          </div>

          <form onSubmit={handleSubmit} className="mt-6 rounded-[26px] border border-[#DDE5EF] bg-white p-6 shadow-[0_24px_70px_rgba(7,27,60,0.08)] sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E8EDF4] pb-5">
              <div><p className="text-xs font-black uppercase tracking-[0.13em] text-[#6A7C95]">Account setup</p><p className="mt-1 text-lg font-black text-[#071B3C]">{roleUi.label}</p></div>
              <div className="rounded-full bg-[#FFF4D7] px-3 py-1.5 text-xs font-black text-[#8A6100]">3 months free</div>
            </div>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="register-email" className="mb-2 block text-sm font-black text-[#071B3C]">Business email</label>
                <input id="register-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={loading} placeholder="you@company.co.uk" className="h-13 w-full rounded-xl border border-[#CCD7E5] bg-[#FBFCFE] px-4 py-3 text-[#071B3C] outline-none transition placeholder:text-[#9AA9BA] focus:border-[#0E3FA9] focus:bg-white focus:ring-4 focus:ring-[#0E3FA9]/10" />
              </div>
              <div>
                <label htmlFor="register-password" className="mb-2 block text-sm font-black text-[#071B3C]">Password</label>
                <input id="register-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} disabled={loading} placeholder="Minimum 8 characters" className="h-13 w-full rounded-xl border border-[#CCD7E5] bg-[#FBFCFE] px-4 py-3 text-[#071B3C] outline-none transition placeholder:text-[#9AA9BA] focus:border-[#0E3FA9] focus:bg-white focus:ring-4 focus:ring-[#0E3FA9]/10" />
              </div>
              <div>
                <label htmlFor="register-password-confirm" className="mb-2 block text-sm font-black text-[#071B3C]">Confirm password</label>
                <input id="register-password-confirm" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} disabled={loading} placeholder="Repeat password" className="h-13 w-full rounded-xl border border-[#CCD7E5] bg-[#FBFCFE] px-4 py-3 text-[#071B3C] outline-none transition placeholder:text-[#9AA9BA] focus:border-[#0E3FA9] focus:bg-white focus:ring-4 focus:ring-[#0E3FA9]/10" />
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-[#E3EAF2] bg-[#F8FAFD] p-4">
              <div className="flex items-start gap-3 text-xs font-semibold leading-5 text-[#566D88]"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#0E3FA9]" /><p>{role === 'fleet_operator' ? 'Carrier/Fleet accounts create the company workspace first; drivers can then be invited into that company.' : role === 'owner_operator' ? 'Owner Drivers receive their own operations workspace and are mapped internally to the driver role.' : 'Your selected account direction determines the onboarding path and workspace created after registration.'}</p></div>
            </div>

            <label className="mt-5 flex items-start gap-3 rounded-2xl border border-[#E3EAF2] bg-white p-4 text-xs font-semibold leading-5 text-[#526983]">
              <input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} disabled={loading} required className="mt-1 h-4 w-4 shrink-0 accent-[#0E3FA9]" />
              <span>I agree to the <Link href="/terms" target="_blank" className="font-black text-[#0E3FA9] underline decoration-[#0E3FA9]/30 underline-offset-2">Terms & Conditions</Link> and confirm I have read the <Link href="/privacy" target="_blank" className="font-black text-[#0E3FA9] underline decoration-[#0E3FA9]/30 underline-offset-2">Privacy Policy</Link>. Membership billing, when activated, is also governed by the <Link href="/subscription-terms" target="_blank" className="font-black text-[#0E3FA9] underline decoration-[#0E3FA9]/30 underline-offset-2">Membership & Subscription Terms</Link>.</span>
            </label>

            {error ? <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div> : null}
            {message ? <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</div> : null}
            {warning ? <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700">{warning}</div> : null}

            <button type="submit" disabled={loading} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0E3FA9] px-5 py-4 text-sm font-black text-white shadow-[0_16px_34px_rgba(14,63,169,0.24)] transition hover:bg-[#0B348C] disabled:cursor-not-allowed disabled:opacity-60">{loading ? 'Creating your XDrive account…' : <>Start 3 Months Free <ArrowRight className="h-4 w-4" /></>}</button>
            <p className="mt-4 text-center text-xs font-semibold text-[#7A8DA4]">No membership charge during the qualifying 3-month launch period.</p>
          </form>

          <p className="mt-6 text-center text-sm font-semibold text-[#60758F] sm:hidden">Already have an account? <Link href="/login" className="font-black text-[#0E3FA9]">Sign in</Link></p>
        </div>
      </section>
    </main>
  );
}
