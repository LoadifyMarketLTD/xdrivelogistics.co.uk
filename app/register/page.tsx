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
type CarrierPlan = 'small-carrier' | 'growing-carrier' | 'fleet' | 'enterprise';

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
  icon: ReactNode;
  benefits: string[];
  flow: string[];
};

const REGISTER_ROLES = new Set<RegisterRole>(['owner_operator', 'fleet_operator', 'transport_broker', 'customer_shipper']);
const CARRIER_PLANS = new Set<CarrierPlan>(['small-carrier', 'growing-carrier', 'fleet', 'enterprise']);

const SIGNUP_ROLE_CONFIG: Record<Exclude<RegisterRole, 'owner_operator'>, SignupConfig> = {
  fleet_operator: { appRole: 'company_admin', accountType: 'fleet_courier', workspaceMode: 'company', ownerDriverWorkspace: false },
  transport_broker: { appRole: 'broker', accountType: 'broker_shipper', workspaceMode: 'broker', ownerDriverWorkspace: false },
  customer_shipper: { appRole: 'customer', accountType: 'customer_shipper', workspaceMode: 'customer', ownerDriverWorkspace: false },
};

const getSignupConfig = (role: RegisterRole): SignupConfig => role === 'owner_operator'
  ? { appRole: 'driver', accountType: 'owner_driver', workspaceMode: 'owner_driver', ownerDriverWorkspace: true }
  : SIGNUP_ROLE_CONFIG[role];

const PLAN_PRICES: Record<string, { label: string; price: string; range?: string }> = {
  'owner-driver': { label: 'Owner Driver', price: '£29.99' },
  'customer-shipper': { label: 'Customer / Shipper', price: '£29.99' },
  broker: { label: 'Broker', price: '£79.99' },
  'small-carrier': { label: 'Small Carrier', range: '2–5 vehicles', price: '£59.99' },
  'growing-carrier': { label: 'Growing Carrier', range: '6–15 vehicles', price: '£129.99' },
  fleet: { label: 'Fleet', range: '16–50 vehicles', price: '£249.99' },
  enterprise: { label: 'Enterprise', range: '51+ / custom', price: 'Custom' },
};

const ROLE_UI: Record<RegisterRole, RolePresentation> = {
  customer_shipper: {
    label: 'Customer / Shipper', eyebrow: 'I need freight moved',
    description: 'Post transport work, compare quotes, award jobs and follow every movement through POD.',
    defaultPlan: 'customer-shipper', icon: <Building2 className="h-5 w-5" />,
    benefits: ['Post courier & freight work', 'Compare live carrier quotes', 'Award and track jobs', 'POD & invoice-ready records'],
    flow: ['Post', 'Compare', 'Award', 'Track', 'Prove'],
  },
  transport_broker: {
    label: 'Transport Broker', eyebrow: 'I manage transport for customers',
    description: 'Run the commercial workflow from posted requirement to awarded carrier and completed delivery.',
    defaultPlan: 'broker', icon: <BriefcaseBusiness className="h-5 w-5" />,
    benefits: ['Post and manage customer work', 'Compare carrier offers', 'Award directly into operations', 'Track through POD completion'],
    flow: ['Post', 'Quote', 'Award', 'Control', 'Complete'],
  },
  owner_operator: {
    label: 'Owner Driver', eyebrow: 'I move freight myself',
    description: 'Find suitable work, quote fast and move awarded jobs through a professional live workflow.',
    defaultPlan: 'owner-driver', icon: <UserRound className="h-5 w-5" />,
    benefits: ['Exchange access', 'Quote from one workspace', 'Awarded job operations', 'Live status & POD'],
    flow: ['Find', 'Quote', 'Win', 'Move', 'POD'],
  },
  fleet_operator: {
    label: 'Carrier / Fleet', eyebrow: 'I run vehicles and drivers',
    description: 'Choose the fleet tier that matches your operation, then manage allocation, dispatch and POD in one workspace.',
    defaultPlan: '', icon: <Truck className="h-5 w-5" />,
    benefits: ['Exchange access', 'Driver allocation', 'Dispatch & operational records', 'POD & finance readiness'],
    flow: ['Find', 'Quote', 'Allocate', 'Dispatch', 'Complete'],
  },
};

const ROLE_BY_PLAN: Record<string, RegisterRole> = {
  'owner-driver': 'owner_operator',
  'customer-shipper': 'customer_shipper',
  broker: 'transport_broker',
  'small-carrier': 'fleet_operator',
  'growing-carrier': 'fleet_operator',
  fleet: 'fleet_operator',
  enterprise: 'fleet_operator',
};

const ROLE_ORDER: RegisterRole[] = ['customer_shipper', 'transport_broker', 'owner_operator', 'fleet_operator'];
const CARRIER_ORDER: CarrierPlan[] = ['small-carrier', 'growing-carrier', 'fleet', 'enterprise'];

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
  const priceUi = useMemo(() => selectedPlan ? PLAN_PRICES[selectedPlan] : null, [selectedPlan]);

  const selectRole = (nextRole: RegisterRole) => {
    setRole(nextRole);
    setSelectedPlan(ROLE_UI[nextRole].defaultPlan);
    setError('');
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(''); setMessage(''); setWarning('');

    if (!isSupabaseConfigured) { setError('Registration is unavailable: Supabase is not configured.'); return; }
    if (role === 'fleet_operator' && (!selectedPlan || !CARRIER_PLANS.has(selectedPlan as CarrierPlan))) {
      setError('Choose your Carrier / Fleet size before creating the account.'); return;
    }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    if (!acceptedTerms) { setError('Please confirm that you agree to the Terms and have read the Privacy Policy.'); return; }

    setLoading(true);
    try {
      const signupConfig = getSignupConfig(role);
      const storedRole = normalizeProfileRoleForStorage(signupConfig.appRole) ?? 'customer';
      const acceptedAt = new Date().toISOString();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(), password,
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
    <main className="min-h-[100svh] bg-[#071B3C] text-[#102447] lg:grid lg:grid-cols-[minmax(300px,0.88fr)_minmax(560px,1.12fr)]">
      <section className="relative overflow-hidden bg-[#071B3C] px-[clamp(1.25rem,3vw,3.5rem)] py-[clamp(1.1rem,2.8vh,2.5rem)] text-white lg:sticky lg:top-0 lg:h-[100svh]">
        <div className="pointer-events-none absolute -right-24 -top-32 h-[clamp(260px,32vw,420px)] w-[clamp(260px,32vw,420px)] rounded-full border border-white/10 shadow-[0_0_0_60px_rgba(29,87,216,0.06),0_0_0_120px_rgba(29,87,216,0.035)]" />
        <div className="relative z-10 flex h-full flex-col">
          <div className="flex items-start justify-between gap-4">
            <Link href="/" className="inline-flex rounded-lg bg-white px-3 py-2 shadow-[0_14px_35px_rgba(0,0,0,0.18)]">
              <Image src="/xdrive-logo-primary.png" alt="XDrive Logistics" width={190} height={52} priority className="h-[clamp(28px,4vh,38px)] w-auto" />
            </Link>
            <div className="hidden text-right text-[clamp(9px,1.2vh,11px)] font-bold text-white/45 xl:block">Move Freight.<br />Manage Operations.<br />Grow Your Network.</div>
          </div>

          <div className="mt-[clamp(1rem,2.3vh,2rem)]">
            <p className="text-[clamp(9px,1.2vh,11px)] font-black uppercase tracking-[0.2em] text-[#F5A300]">Your XDrive direction</p>
            <h1 className="mt-2 max-w-xl text-[clamp(2rem,5.1vh,3.6rem)] font-black leading-[0.94] tracking-tight">{roleUi.eyebrow}.</h1>
            <p className="mt-[clamp(0.55rem,1.5vh,1rem)] max-w-xl text-[clamp(0.76rem,1.7vh,0.98rem)] font-semibold leading-[1.55] text-white/68">{roleUi.description}</p>
          </div>

          <div className="mt-[clamp(0.9rem,2vh,1.5rem)] rounded-[clamp(16px,2vw,22px)] border border-white/12 bg-white/[0.07] p-[clamp(0.9rem,2.2vh,1.3rem)] shadow-[0_24px_70px_rgba(0,0,0,0.16)] backdrop-blur-xl">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-[clamp(0.6rem,1.4vh,1rem)]">
              <div>
                <p className="text-[clamp(8px,1.1vh,10px)] font-black uppercase tracking-[0.15em] text-[#F5A300]">Selected membership</p>
                <h2 className="mt-1 text-[clamp(1rem,2.2vh,1.3rem)] font-black">{priceUi?.label ?? 'Choose your fleet tier'}</h2>
                {priceUi?.range ? <p className="mt-0.5 text-[10px] font-bold text-white/45">{priceUi.range}</p> : null}
              </div>
              <div className="text-right">
                <div className="text-[clamp(1.3rem,3.2vh,1.8rem)] font-black tracking-tight text-white">{priceUi?.price ?? '—'}</div>
                <p className="text-[clamp(8px,1vh,10px)] font-bold text-white/48">{selectedPlan === 'enterprise' ? 'pricing agreed separately' : '/ month + VAT after trial'}</p>
              </div>
            </div>

            <div className="mt-[clamp(0.65rem,1.5vh,1rem)] flex items-center justify-between gap-4 rounded-xl bg-[#F5A300] px-4 py-[clamp(0.55rem,1.25vh,0.8rem)] text-[#071B3C]">
              <div><p className="text-[9px] font-black uppercase tracking-[0.13em]">Launch access</p><p className="text-[clamp(0.85rem,1.8vh,1rem)] font-black">Your first 3 months are free</p></div>
              <ShieldCheck className="h-5 w-5 shrink-0" />
            </div>

            <div className="mt-[clamp(0.65rem,1.5vh,1rem)] grid grid-cols-2 gap-x-4 gap-y-[clamp(0.35rem,0.9vh,0.6rem)]">
              {roleUi.benefits.map((benefit) => <div key={benefit} className="flex items-start gap-2 text-[clamp(9px,1.25vh,11px)] font-bold leading-4 text-white/80"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#F5A300]" />{benefit}</div>)}
            </div>

            <div className="mt-[clamp(0.65rem,1.5vh,1rem)] border-t border-white/10 pt-[clamp(0.55rem,1.3vh,0.9rem)]">
              <div className="flex flex-wrap items-center gap-1.5">
                {roleUi.flow.map((step, index) => <div key={step} className="flex items-center gap-1.5"><span className="rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-1 text-[9px] font-black text-white/82">{step}</span>{index < roleUi.flow.length - 1 ? <ArrowRight className="h-3 w-3 text-[#F5A300]" /> : null}</div>)}
              </div>
            </div>
          </div>

          <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-3 text-[clamp(8px,1.1vh,10px)] font-bold text-white/48">
            <span>✓ No XDrive commission</span><span>✓ No booking fee</span><span>✓ Monthly rolling</span>
          </div>
        </div>
      </section>

      <section className="bg-[#F7F9FC] px-[clamp(1rem,3vw,3rem)] py-[clamp(1rem,2.6vh,2rem)] lg:min-h-[100svh]">
        <div className="mx-auto w-full max-w-[820px]">
          <div className="mb-[clamp(0.65rem,1.5vh,1rem)] flex items-end justify-between gap-5">
            <div>
              <p className="text-[clamp(9px,1.1vh,10px)] font-black uppercase tracking-[0.17em] text-[#F5A300]">Create your account</p>
              <h2 className="mt-1 text-[clamp(1.45rem,3.4vh,2.15rem)] font-black tracking-tight text-[#071B3C]">Choose how you use XDrive.</h2>
            </div>
            <Link href="/login" className="hidden pb-1 text-xs font-black text-[#0E3FA9] sm:block">Already a member? Sign in</Link>
          </div>

          <div className="grid grid-cols-2 gap-[clamp(0.45rem,1vh,0.7rem)]">
            {ROLE_ORDER.map((item) => {
              const option = ROLE_UI[item];
              const active = role === item;
              return <button key={item} type="button" onClick={() => selectRole(item)} disabled={loading} className={`group relative flex min-h-[clamp(62px,8vh,82px)] items-center gap-3 rounded-xl border px-[clamp(0.7rem,1.4vw,1rem)] py-[clamp(0.55rem,1.2vh,0.8rem)] text-left transition ${active ? 'border-[#0E3FA9] bg-white shadow-[0_10px_24px_rgba(14,63,169,0.10)] ring-1 ring-[#0E3FA9]/10' : 'border-[#DDE5EF] bg-white/72 hover:border-[#9BB5DD] hover:bg-white'}`}>
                <span className={`flex h-[clamp(30px,4vh,38px)] w-[clamp(30px,4vh,38px)] shrink-0 items-center justify-center rounded-lg ${active ? 'bg-[#0E3FA9] text-white' : 'bg-[#EDF3FB] text-[#0E3FA9]'}`}>{option.icon}</span>
                <span className="min-w-0 pr-4"><span className="block text-[clamp(10px,1.4vh,12px)] font-black text-[#071B3C]">{option.label}</span><span className="mt-0.5 block text-[clamp(8px,1.15vh,10px)] font-semibold leading-4 text-[#60758F]">{option.eyebrow}</span></span>
                {active ? <span className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#F5A300] text-[#071B3C]"><Check className="h-3 w-3" /></span> : null}
              </button>;
            })}
          </div>

          {role === 'fleet_operator' ? <div className="mt-[clamp(0.55rem,1.2vh,0.8rem)]">
            <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-[#6A7C95]">Choose fleet size</p>
            <div className="grid grid-cols-2 gap-1.5 md:grid-cols-4">
              {CARRIER_ORDER.map((plan) => {
                const item = PLAN_PRICES[plan];
                const active = selectedPlan === plan;
                return <button key={plan} type="button" onClick={() => { setSelectedPlan(plan); setError(''); }} className={`rounded-lg border px-2.5 py-2 text-left transition ${active ? 'border-[#0E3FA9] bg-[#EDF4FF] shadow-sm' : 'border-[#DDE5EF] bg-white hover:border-[#9BB5DD]'}`}>
                  <span className="block text-[10px] font-black text-[#071B3C]">{item.range}</span>
                  <span className="mt-0.5 block text-[9px] font-semibold text-[#60758F]">{item.label}</span>
                  <span className="mt-1 block text-[11px] font-black text-[#0E3FA9]">{item.price}{plan === 'enterprise' ? ' · contact us' : ''}</span>
                </button>;
              })}
            </div>
          </div> : null}

          <form onSubmit={handleSubmit} className="mt-[clamp(0.6rem,1.3vh,0.9rem)] rounded-[clamp(16px,2vw,20px)] border border-[#DDE5EF] bg-white p-[clamp(0.8rem,1.8vh,1.2rem)] shadow-[0_18px_50px_rgba(7,27,60,0.07)]">
            <div className="flex items-center justify-between gap-3 border-b border-[#E8EDF4] pb-[clamp(0.45rem,1vh,0.7rem)]">
              <div><p className="text-[9px] font-black uppercase tracking-[0.13em] text-[#6A7C95]">Account setup</p><p className="mt-0.5 text-sm font-black text-[#071B3C]">{roleUi.label}{priceUi ? ` · ${priceUi.label}` : ''}</p></div>
              <div className="rounded-full bg-[#FFF4D7] px-3 py-1 text-[10px] font-black text-[#8A6100]">3 months free</div>
            </div>

            <div className="mt-[clamp(0.55rem,1.2vh,0.8rem)] grid grid-cols-2 gap-[clamp(0.45rem,1vh,0.7rem)]">
              <div className="col-span-2">
                <label htmlFor="register-email" className="mb-1 block text-[10px] font-black text-[#071B3C]">Business email</label>
                <input id="register-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={loading} placeholder="you@company.co.uk" className="h-[clamp(36px,4.8vh,42px)] w-full rounded-lg border border-[#CCD7E5] bg-[#FBFCFE] px-3 text-sm text-[#071B3C] outline-none transition placeholder:text-[#9AA9BA] focus:border-[#0E3FA9] focus:bg-white focus:ring-2 focus:ring-[#0E3FA9]/10" />
              </div>
              <div>
                <label htmlFor="register-password" className="mb-1 block text-[10px] font-black text-[#071B3C]">Password</label>
                <input id="register-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} disabled={loading} placeholder="Minimum 8 characters" className="h-[clamp(36px,4.8vh,42px)] w-full rounded-lg border border-[#CCD7E5] bg-[#FBFCFE] px-3 text-sm text-[#071B3C] outline-none transition placeholder:text-[#9AA9BA] focus:border-[#0E3FA9] focus:bg-white focus:ring-2 focus:ring-[#0E3FA9]/10" />
              </div>
              <div>
                <label htmlFor="register-password-confirm" className="mb-1 block text-[10px] font-black text-[#071B3C]">Confirm password</label>
                <input id="register-password-confirm" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} disabled={loading} placeholder="Repeat password" className="h-[clamp(36px,4.8vh,42px)] w-full rounded-lg border border-[#CCD7E5] bg-[#FBFCFE] px-3 text-sm text-[#071B3C] outline-none transition placeholder:text-[#9AA9BA] focus:border-[#0E3FA9] focus:bg-white focus:ring-2 focus:ring-[#0E3FA9]/10" />
              </div>
            </div>

            <div className="mt-[clamp(0.45rem,1vh,0.65rem)] flex items-start gap-2 rounded-lg border border-[#E3EAF2] bg-[#F8FAFD] px-3 py-2 text-[9px] font-semibold leading-4 text-[#566D88]"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0E3FA9]" /><p>{role === 'fleet_operator' ? 'Carrier/Fleet creates the company workspace first; drivers are invited into that company.' : role === 'owner_operator' ? 'Owner Drivers receive their own operations workspace and map internally to the driver role.' : 'Your account direction determines the onboarding path and workspace created after registration.'}</p></div>

            <label className="mt-[clamp(0.4rem,0.9vh,0.6rem)] flex items-start gap-2 rounded-lg border border-[#E3EAF2] bg-white px-3 py-2 text-[9px] font-semibold leading-4 text-[#526983]">
              <input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} disabled={loading} required className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[#0E3FA9]" />
              <span>I agree to the <Link href="/terms" target="_blank" className="font-black text-[#0E3FA9] underline underline-offset-2">Terms & Conditions</Link>, have read the <Link href="/privacy" target="_blank" className="font-black text-[#0E3FA9] underline underline-offset-2">Privacy Policy</Link>, and understand that membership billing is governed by the <Link href="/subscription-terms" target="_blank" className="font-black text-[#0E3FA9] underline underline-offset-2">Membership & Subscription Terms</Link>.</span>
            </label>

            {error ? <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[10px] font-bold text-red-700">{error}</div> : null}
            {message ? <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] font-bold text-emerald-700">{message}</div> : null}
            {warning ? <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] font-bold text-amber-700">{warning}</div> : null}

            <button type="submit" disabled={loading} className="mt-[clamp(0.5rem,1vh,0.7rem)] flex h-[clamp(38px,5vh,44px)] w-full items-center justify-center gap-2 rounded-lg bg-[#0E3FA9] px-5 text-xs font-black text-white shadow-[0_12px_28px_rgba(14,63,169,0.20)] transition hover:bg-[#0B348C] disabled:cursor-not-allowed disabled:opacity-60">{loading ? 'Creating your XDrive account…' : <>Start 3 Months Free <ArrowRight className="h-4 w-4" /></>}</button>
            <p className="mt-1.5 text-center text-[9px] font-semibold text-[#7A8DA4]">No membership charge during the qualifying 3-month launch period.</p>
          </form>
        </div>
      </section>
    </main>
  );
}
