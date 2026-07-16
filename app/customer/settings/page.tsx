'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';

type CompanyForm = {
  name: string;
  email: string;
  phone: string;
  address_line1: string;
  address_line2: string;
  city: string;
  postcode: string;
};

type ProfileForm = {
  full_name: string;
  phone: string;
};

type NotificationForm = {
  notify_email_new_job: boolean;
  notify_email_status_change: boolean;
  notify_email_invoice_paid: boolean;
  notify_email_bid_received: boolean;
};

const emptyCompany: CompanyForm = {
  name: '',
  email: '',
  phone: '',
  address_line1: '',
  address_line2: '',
  city: '',
  postcode: '',
};

export default function CustomerSettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const companyId = user?.companyId ?? null;
  const [company, setCompany] = useState<CompanyForm>(emptyCompany);
  const [profile, setProfile] = useState<ProfileForm>({ full_name: '', phone: '' });
  const [notifications, setNotifications] = useState<NotificationForm>({
    notify_email_new_job: true,
    notify_email_status_change: true,
    notify_email_invoice_paid: true,
    notify_email_bid_received: true,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const run = async () => {
      if (!isSupabaseConfigured || !user?.id || !companyId) return;
      const [companyRes, profileRes, settingsRes] = await Promise.all([
        supabase.from('companies').select('name, email, phone, address_line1, address_line2, city, postcode').eq('id', companyId).maybeSingle(),
        supabase.from('profiles').select('full_name, phone').eq('user_id', user.id).maybeSingle(),
        supabase.from('company_settings').select('notify_email_new_job, notify_email_status_change, notify_email_invoice_paid, notify_email_bid_received').eq('company_id', companyId).maybeSingle(),
      ]);
      if (companyRes.data) setCompany({ ...emptyCompany, ...(companyRes.data as Partial<CompanyForm>) });
      if (profileRes.data) setProfile({
        full_name: (profileRes.data.full_name as string | null) ?? '',
        phone: (profileRes.data.phone as string | null) ?? '',
      });
      if (settingsRes.data) setNotifications({
        notify_email_new_job: settingsRes.data.notify_email_new_job ?? true,
        notify_email_status_change: settingsRes.data.notify_email_status_change ?? true,
        notify_email_invoice_paid: settingsRes.data.notify_email_invoice_paid ?? true,
        notify_email_bid_received: settingsRes.data.notify_email_bid_received ?? true,
      });
    };
    void run();
  }, [companyId, user?.id]);

  const save = async () => {
    if (!isSupabaseConfigured || !user?.id || !companyId) {
      setMessage('Customer account is not linked to a company yet.');
      return;
    }
    setSaving(true);
    setMessage('');
    const [companyRes, profileRes, settingsRes] = await Promise.all([
      supabase.from('companies').update(company).eq('id', companyId),
      supabase.from('profiles').update(profile).eq('user_id', user.id),
      supabase.from('company_settings').upsert({ company_id: companyId, ...notifications }, { onConflict: 'company_id' }),
    ]);
    setSaving(false);
    const error = companyRes.error ?? profileRes.error ?? settingsRes.error;
    setMessage(error ? error.message : 'Settings saved.');
  };

  const field = (label: string, value: string, onChange: (value: string) => void) => (
    <label className="field"><span>{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} /></label>
  );

  return (
    <ProtectedRoute allowedRoles={['customer']}>
      <main className="page">
        <button onClick={() => router.push('/customer')}>Back to Customer Portal</button>
        <section className="card">
          <h1>Customer Settings</h1>
          {message && <div className="notice">{message}</div>}
          <h2>Company Details</h2>
          <div className="grid">
            {field('Company Name', company.name, (value) => setCompany((current) => ({ ...current, name: value })))}
            {field('Company Email', company.email, (value) => setCompany((current) => ({ ...current, email: value })))}
            {field('Company Phone', company.phone, (value) => setCompany((current) => ({ ...current, phone: value })))}
          </div>
          <h2>Contact Details</h2>
          <div className="grid">
            {field('Contact Name', profile.full_name, (value) => setProfile((current) => ({ ...current, full_name: value })))}
            {field('Contact Phone', profile.phone, (value) => setProfile((current) => ({ ...current, phone: value })))}
          </div>
          <h2>Billing Details</h2>
          <div className="grid">
            {field('Address Line 1', company.address_line1, (value) => setCompany((current) => ({ ...current, address_line1: value })))}
            {field('Address Line 2', company.address_line2, (value) => setCompany((current) => ({ ...current, address_line2: value })))}
            {field('City', company.city, (value) => setCompany((current) => ({ ...current, city: value })))}
            {field('Postcode', company.postcode, (value) => setCompany((current) => ({ ...current, postcode: value })))}
          </div>
          <h2>Notification Preferences</h2>
          <div className="checks">
            {([
              ['notify_email_new_job', 'New job notifications'],
              ['notify_email_status_change', 'Delivery status updates'],
              ['notify_email_invoice_paid', 'Invoice notifications'],
              ['notify_email_bid_received', 'Quote notifications'],
            ] as const).map(([key, label]) => (
              <label key={key}><input type="checkbox" checked={notifications[key]} onChange={(event) => setNotifications((current) => ({ ...current, [key]: event.target.checked }))} />{label}</label>
            ))}
          </div>
          <button className="primary" disabled={saving} onClick={() => void save()}>{saving ? 'Saving...' : 'Save Settings'}</button>
        </section>
        <style jsx>{`
          .page { min-height: 100vh; background: #F4F6F8; color: #1A1F2B; padding: 16px; }
          .card { max-width: 980px; margin: 16px auto; background: white; border: 1px solid #F4F6F8; border-radius: 8px; padding: 16px; }
          .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
          .field { display: grid; gap: 6px; margin-bottom: 12px; }
          .field span { color: #0B2F6B; font-size: 12px; font-weight: 900; text-transform: uppercase; }
          input { border: 1px solid #F4F6F8; border-radius: 8px; padding: 11px; font: inherit; }
          button { border: 1px solid #F4F6F8; background: white; border-radius: 8px; padding: 10px 14px; font-weight: 800; cursor: pointer; color: #1A1F2B; }
          .primary { margin-top: 16px; background: #F5A300; border-color: #1A1F2B; }
          .checks { display: grid; gap: 8px; }
          .checks label { border: 1px solid #F4F6F8; border-radius: 8px; padding: 10px; display: flex; gap: 8px; align-items: center; font-weight: 700; }
          .notice { border: 1px solid #F5A300; background: #F4F6F8; color: #1A1F2B; border-radius: 8px; padding: 12px; font-weight: 800; }
        `}</style>
      </main>
    </ProtectedRoute>
  );
}
