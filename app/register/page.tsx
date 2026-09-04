'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  ShieldCheck,
  Truck,
  UserRound,
} from 'lucide-react';
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import { getAuthCallbackEmailRedirectTo } from '../../lib/authFlow';
import { normalizeProfileRoleForStorage } from '../../lib/authRole';
import { getRegistrationLegalConfig } from '../../lib/legal/registrationAgreements';
import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient';
import RegistrationAgreementGate, {
  isRegistrationAgreementGateComplete,
  type RegistrationAgreementGateValue,
} from './RegistrationAgreementGate';

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
const EMPTY_LEGAL_GATE: RegistrationAgreementGateValue = {
  agreementsAccepted: false,
  authorityConfirmed: false,
  roleDeclarationConfirmed: false,
  privacyAcknowledged: false,
};

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
  const [legalGate, setLegalGate] = useState<RegistrationAgreementGateValue>(EMPTY_LEGAL_GATE);
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
  const enterpriseSelected = selectedPlan === 'enterprise';
  const legalGateComplete = isRegistrationAgreementGateComplete(legalGate);

  const selectRole = (nextRole: RegisterRole) => {
    setRole(nextRole);
    setSelectedPlan(ROLE_UI[nextRole].defaultPlan);
    setLegalGate(EMPTY_LEGAL_GATE);
    setError('');
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(''); setMessage(''); setWarning('');

    if (enterpriseSelected) { router.push('/contact'); return; }
    if (!isSupabaseConfigured) { setError('Registration is unavailable: Supabase is not configured.'); return; }
    if (role === 'fleet_operator' && (!selectedPlan || !CARRIER_PLANS.has(selectedPlan as CarrierPlan))) {
      setError('Choose your Carrier / Fleet size before creating the account.'); return;
    }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    if (!legalGateComplete) { setError('Complete all required agreements and declarations before creating the account.'); return; }

    setLoading(true);
    try {
      const signupConfig = getSignupConfig(role);
      const storedRole = normalizeProfileRoleForStorage(signupConfig.appRole) ?? 'customer';
      const acceptedAt = new Date().toISOString();
      const legalConfig = getRegistrationLegalConfig(role);
      const agreementVersions = Object.fromEntries(legalConfig.agreements.map((agreement) => [agreement.code, agreement.version]));
      const agreementCodes = legalConfig.agreements.map((agreement) => agreement.code);
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
            legal_agreement_codes: agreementCodes,
            legal_agreement_versions: agreementVersions,
            legal_authority_confirmed_at: acceptedAt,
            legal_role_declaration_confirmed_at: acceptedAt,
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
      setEmail(''); setPassword(''); setConfirmPassword(''); setLegalGate(EMPTY_LEGAL_GATE);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Registration failed.');
    } finally { setLoading(false); }
  };

  return (
    <main className="min-h-screen bg-[#071B3C] lg:grid lg:grid-cols-2">
      <section className="relative overflow-hidden bg-[#071B3C] px-6 py-8 text-white lg:min-h-screen lg:px-10 lg:py-10">
        <div className="relative z-10 flex h-full flex-col">
          <div className="flex items-start justify-between gap-4">
            <Link href="/" className="inline-flex rounded-lg bg-white px-3 py-2 shadow-lg">
              <Image src="/xdrive-logo-primary.png" alt="XDrive Logistics" width={190} height={52} priority className="h-9 w-auto" />
            </Link>
            <div className="hidden text-right text-xs font-bold text-white/50 xl:block">Move Freight.<br />Manage Operations.<br />Grow Your Network.</div>
          </div>

          <div className="mt-10">
            <p className="text-xs font-black uppercase tracking-widest text-[#F5A300]">Your XDrive direction</p>
            <h1 className="mt-3 max-w-xl text-4xl font-black leading-tight tracking-tight lg:text-5xl">{roleUi.eyebrow}.</h1>
            <p className="mt-4 max-w-xl text-sm font-semibold leading-6 text-white/70">{roleUi.description}</p>
          </div>

          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-[#F5A300]">Selected membership</p>
                <h2 className="mt-1 text-xl font-black">{priceUi?.label ?? 'Choose your fleet tier'}</h2>
                {priceUi?.range ? <p className="mt-1 text-xs font-bold text-white/50">{priceUi.range}</p> : null}
              </div>
              <div className="text-right">
                <div className="text-2xl font-black">{priceUi?.price ?? '—'}</div>
                <p className="mt-1 text-xs font-bold text-white/50">{enterpriseSelected ? 'pricing agreed separately' : '/ month + VAT after trial'}</p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-4 rounded-xl bg-[#F5A300] px-4 py-3 text-[#071B3C]">
              <div><p className="text-xs font-black uppercase">{enterpriseSelected ? 'Enterprise access' : 'Launch access'}</p><p className="text-sm font-black">{enterpriseSelected ? 'Commercial review required' : 'Your first 3 months are free'}</p></div>
              <ShieldCheck className="h-5 w-5 shrink-0" />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              {roleUi.benefits.map((benefit) => <div key={benefit} className="flex items-start gap-2 text-xs font-bold leading-5 text-white/80"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-[#F5A300]" />{benefit}</div>)}
            </div>
          </div>

          <div className="mt-auto flex flex-wrap gap-4 pt-8 text-xs font-bold text-white/50">
            <span>✓ No XDrive commission</span><span>✓ No booking fee</span><span>{enterpriseSelected ? '✓ Custom commercial terms' : '✓ Monthly rolling'}</span>
          </div>
        </div>
      </section>

      <section className="bg-[#F4F6FA] px-5 py-8 text-[#071B3C] sm:px-8 lg:px-10">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-end justify-between gap-5">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-[#F5A300]">Create your XDrive account</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight">Choose how you use XDrive.</h2>
            </div>
            <Link href="/login" className="hidden text-sm font-black text-[#173B73] sm:block">Already a member? Sign in</Link>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            {ROLE_ORDER.map((item) => {
              const option = ROLE_UI[item];
              const active = role === item;
              return <button key={item} type="button" onClick={() => selectRole(item)} disabled={loading} className={`flex min-h-20 items-center gap-3 rounded-2xl border p-4 text-left transition ${active ? 'border-[#F5A300] bg-[#173B73] text-white shadow-lg' : 'border-[#DDE5EF] bg-white text-[#071B3C] hover:border-[#9BB5DD]'}`}>
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${active ? 'bg-[#F5A300] text-[#071B3C]' : 'bg-[#EDF3FB] text-[#173B73]'}`}>{option.icon}</span>
                <span><span className="block text-sm font-black">{option.label}</span><span className={`mt-1 block text-xs font-semibold ${active ? 'text-white/60' : 'text-[#60758F]'}`}>{option.eyebrow}</span></span>
              </button>;
            })}
          </div>

          {role === 'fleet_operator' ? <div className="mt-4 rounded-2xl border border-[#DDE5EF] bg-white p-4 shadow-sm">
            <p className="mb-3 text-xs font-black uppercase tracking-wider text-[#60758F]">Choose fleet size</p>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {CARRIER_ORDER.map((plan) => {
                const item = PLAN_PRICES[plan];
                const active = selectedPlan === plan;
                return <button key={plan} type="button" onClick={() => { setSelectedPlan(plan); setError(''); }} className={`rounded-xl border p-3 text-left transition ${active ? 'border-[#F5A300] bg-[#FFF7E5]' : 'border-[#DDE5EF] bg-[#F8FAFD]'}`}>
                  <span className="block text-xs font-black">{item.range}</span>
                  <span className="mt-1 block text-xs font-semibold text-[#60758F]">{item.label}</span>
                  <span className="mt-2 block text-sm font-black text-[#173B73]">{item.price}{plan === 'enterprise' ? ' · contact us' : ''}</span>
                </button>;
              })}
            </div>
          </div> : null}

          {enterpriseSelected ? (
            <div className="mt-5 overflow-hidden rounded-2xl border border-[#F5A300] bg-white shadow-lg">
              <div className="bg-[#173B73] p-5 text-white">
                <p className="text-xs font-black uppercase tracking-wider text-[#F5A300]">Enterprise setup</p>
                <h3 className="mt-2 text-2xl font-black">51+ vehicles / custom</h3>
              </div>
              <div className="p-5">
                <p className="text-sm font-semibold leading-6 text-[#60758F]">Enterprise pricing, launch terms, fleet scope and onboarding are agreed directly with XDrive. No public Enterprise subscription price is currently set.</p>
                <Link href="/contact" className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#F5A300] px-5 text-sm font-black text-[#071B3C]">Contact XDrive <ArrowRight className="h-4 w-4" /></Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-5 overflow-hidden rounded-2xl border border-[#F5A300] bg-white shadow-lg">
              <div className="flex items-center justify-between gap-4 bg-[#173B73] p-5 text-white">
                <div><p className="text-xs font-black uppercase tracking-wider text-[#F5A300]">Account setup</p><p className="mt-1 text-lg font-black">{priceUi?.label ?? roleUi.label}</p></div>
                <div className="text-right"><div className="text-xl font-black">{priceUi?.price ?? '—'}</div><div className="mt-1 rounded-lg bg-[#F5A300] px-3 py-1 text-xs font-black text-[#071B3C]">3 months free</div></div>
              </div>

              <div className="p-5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label htmlFor="register-email" className="mb-1 block text-xs font-black text-[#173B73]">Business email</label>
                    <input id="register-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={loading} placeholder="you@company.co.uk" className="h-11 w-full rounded-xl border border-[#CCD7E5] bg-[#F8FAFD] px-4 text-sm font-semibold outline-none focus:border-[#F5A300]" />
                  </div>
                  <div>
                    <label htmlFor="register-password" className="mb-1 block text-xs font-black text-[#173B73]">Password</label>
                    <input id="register-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} disabled={loading} placeholder="Minimum 8 characters" className="h-11 w-full rounded-xl border border-[#CCD7E5] bg-[#F8FAFD] px-4 text-sm font-semibold outline-none focus:border-[#F5A300]" />
                  </div>
                  <div>
                    <label htmlFor="register-password-confirm" className="mb-1 block text-xs font-black text-[#173B73]">Confirm password</label>
                    <input id="register-password-confirm" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} disabled={loading} placeholder="Repeat password" className="h-11 w-full rounded-xl border border-[#CCD7E5] bg-[#F8FAFD] px-4 text-sm font-semibold outline-none focus:border-[#F5A300]" />
                  </div>
                </div>

                <div className="mt-3 flex items-start gap-2 rounded-xl border border-[#DDE5EF] bg-[#F8FAFD] p-3 text-xs font-semibold leading-5 text-[#566D88]"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#F5A300]" /><p>{role === 'fleet_operator' ? 'Carrier/Fleet creates the company workspace first; drivers are invited into that company.' : role === 'owner_operator' ? 'Owner Drivers receive their own operations workspace and map internally to the driver role.' : 'Your account direction determines the onboarding path and workspace created after registration.'}</p></div>

                <RegistrationAgreementGate role={role} value={legalGate} onChange={setLegalGate} disabled={loading} />

                {error ? <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{error}</div> : null}
                {message ? <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">{message}</div> : null}
                {warning ? <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">{warning}</div> : null}

                <button type="submit" disabled={loading || !legalGateComplete} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#F5A300] px-5 text-sm font-black text-[#071B3C] transition hover:bg-[#E99B00] disabled:cursor-not-allowed disabled:opacity-50">{loading ? 'Creating your XDrive account…' : <>Start 3 Months Free <ArrowRight className="h-4 w-4" /></>}</button>
                <p className="mt-2 text-center text-xs font-semibold text-[#7A8DA4]">No membership charge during the qualifying 3-month launch period.</p>
              </div>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
