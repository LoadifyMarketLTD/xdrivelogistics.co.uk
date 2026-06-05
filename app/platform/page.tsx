'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../components/ProtectedRoute';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';

type PlatformKPIs = {
  totalCompanies: number;
  totalDrivers: number;
  totalJobs: number;
  openDisputes: number;
  pendingCompliance: number;
  activeBrokers: number;
};

const STAT_CARDS = [
  { key: 'totalCompanies', label: 'Companies', icon: '🏢', href: '/platform/companies', color: '#3b82f6' },
  { key: 'totalDrivers',   label: 'Drivers',   icon: '🚗', href: '/platform/drivers',   color: '#8b5cf6' },
  { key: 'totalJobs',      label: 'Jobs',       icon: '📦', href: '/platform/jobs',      color: '#10b981' },
  { key: 'openDisputes',   label: 'Disputes',   icon: '⚖️', href: '/platform/disputes',  color: '#ef4444' },
  { key: 'pendingCompliance', label: 'Compliance', icon: '📄', href: '/platform/compliance', color: '#f59e0b' },
  { key: 'activeBrokers',  label: 'Brokers',    icon: '🤝', href: '/platform/brokers',   color: '#06b6d4' },
] as const;

const MODULE_CARDS = [
  { id: 'trust',       label: 'Trust & Risk',      icon: '🛡️', href: '/platform/trust',       desc: 'Payment behaviour, dispute frequency, compliance readiness.' },
  { id: 'disputes',    label: 'Dispute Console',   icon: '⚖️', href: '/platform/disputes',    desc: 'Triage, respond, escalate and resolve disputes platform-wide.' },
  { id: 'suspensions', label: 'Suspensions',       icon: '🚫', href: '/platform/suspensions', desc: 'Suspend entities and manage reinstatement workflows.' },
  { id: 'compliance',  label: 'Compliance',        icon: '📄', href: '/platform/compliance',  desc: 'Document status, expiry alerts, and compliance readiness scores.' },
  { id: 'analytics',   label: 'KPI & Analytics',   icon: '📊', href: '/platform/analytics',   desc: 'Cross-tenant KPIs, trend analysis, and platform-wide reporting.' },
  { id: 'audit',       label: 'Audit Log',         icon: '📋', href: '/platform/audit',       desc: 'Every override, escalation and governance action with full trail.' },
];

const THEME = {
  pageBg: '#0f172a',
  cardBg: '#1e293b',
  cardBorder: '#334155',
  text: '#f1f5f9',
  muted: '#94a3b8',
  accent: '#f59e0b',
};

export default function PlatformDashboardPage() {
  const router = useRouter();
  const [kpis, setKpis] = useState<PlatformKPIs>({
    totalCompanies: 0,
    totalDrivers: 0,
    totalJobs: 0,
    openDisputes: 0,
    pendingCompliance: 0,
    activeBrokers: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    let cancelled = false;
    const loadKPIs = async () => {
      const [companiesRes, driversRes, jobsRes] = await Promise.all([
        supabase.from('companies').select('id', { count: 'exact', head: true }),
        supabase.from('drivers').select('id', { count: 'exact', head: true }),
        supabase.from('jobs').select('id', { count: 'exact', head: true }),
      ]);
      if (!cancelled) {
        setKpis({
          totalCompanies: companiesRes.count ?? 0,
          totalDrivers: driversRes.count ?? 0,
          totalJobs: jobsRes.count ?? 0,
          openDisputes: 0,
          pendingCompliance: 0,
          activeBrokers: 0,
        });
        setLoading(false);
      }
    };
    loadKPIs();
    return () => { cancelled = true; };
  }, []);

  const cardStyle = {
    backgroundColor: THEME.cardBg,
    border: `1px solid ${THEME.cardBorder}`,
    borderRadius: '10px',
    padding: '1.25rem',
    cursor: 'pointer',
  };

  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <div style={{ minHeight: '100vh', backgroundColor: THEME.pageBg, padding: '1.5rem' }}>

        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.5rem' }}>🏛️</span>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: THEME.text, margin: 0 }}>Platform Overview</h1>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: THEME.accent, backgroundColor: 'rgba(245,158,11,0.12)', padding: '0.2rem 0.6rem', borderRadius: '4px' }}>
              Owner Console
            </span>
          </div>
          <p style={{ color: THEME.muted, margin: 0, fontSize: '0.9rem' }}>
            Cross-tenant governance, oversight, and intervention for the XDrive network.
          </p>
        </div>

        {/* KPI stat grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          {STAT_CARDS.map(({ key, label, icon, href, color }) => (
            <div
              key={key}
              onClick={() => router.push(href)}
              style={{ ...cardStyle, borderTop: `3px solid ${color}` }}
            >
              <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{icon}</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: THEME.text, lineHeight: 1 }}>
                {loading ? '—' : (kpis[key] ?? 0)}
              </div>
              <div style={{ fontSize: '0.78rem', color: THEME.muted, marginTop: '0.3rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* Governance module cards */}
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: THEME.text, marginBottom: '1rem', letterSpacing: '0.02em' }}>
          Governance Modules
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          {MODULE_CARDS.map((mod) => (
            <div
              key={mod.id}
              onClick={() => router.push(mod.href)}
              style={{ ...cardStyle, display: 'flex', gap: '1rem', alignItems: 'flex-start', transition: 'border-color 0.15s' }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = THEME.accent)}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = THEME.cardBorder)}
            >
              <div style={{ fontSize: '1.6rem', lineHeight: 1, flexShrink: 0 }}>{mod.icon}</div>
              <div>
                <div style={{ fontWeight: 700, color: THEME.text, fontSize: '0.9rem', marginBottom: '0.3rem' }}>{mod.label}</div>
                <div style={{ color: THEME.muted, fontSize: '0.8rem', lineHeight: 1.5 }}>{mod.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Registry quick links */}
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: THEME.text, marginBottom: '1rem', letterSpacing: '0.02em' }}>
          Network Registry
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
          {[
            { label: 'Companies', icon: '🏢', href: '/platform/companies' },
            { label: 'Brokers',   icon: '🤝', href: '/platform/brokers' },
            { label: 'Customers', icon: '👥', href: '/platform/customers' },
            { label: 'Drivers',   icon: '🚗', href: '/platform/drivers' },
            { label: 'Vehicles',  icon: '🚛', href: '/platform/vehicles' },
            { label: 'Jobs',      icon: '📦', href: '/platform/jobs' },
            { label: 'Bids',      icon: '💼', href: '/platform/bids' },
            { label: 'Invoices',  icon: '💰', href: '/platform/invoices' },
            { label: 'PODs',      icon: '📸', href: '/platform/pods' },
          ].map(({ label, icon, href }) => (
            <button
              key={href}
              onClick={() => router.push(href)}
              style={{ backgroundColor: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: '8px', padding: '0.75rem', cursor: 'pointer', color: THEME.text, fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'border-color 0.15s' }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = THEME.accent)}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = THEME.cardBorder)}
            >
              <span>{icon}</span>{label}
            </button>
          ))}
        </div>
      </div>
    </ProtectedRoute>
  );
}
