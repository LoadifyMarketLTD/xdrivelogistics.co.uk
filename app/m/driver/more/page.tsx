'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { readRouteAuthAccessToken } from '../../../../lib/routeAuthCookie';

type Resources = {
  name?: string;
  company?: { name?: string } | null;
  vehicle?: { reg_plate?: string; make?: string; model?: string } | null;
  driver?: { driver_type?: string | null; can_commercial_bid?: boolean; availability_status?: string | null } | null;
  partial?: string[];
};
type Section = { title: string; items: { label: string; href: string; detail?: string }[] };
const operations = [
  { label: 'Availability', href: '/driver/availability/live', detail: 'Set your location and working status' },
  { label: 'Return journeys', href: '/driver/returns', detail: 'Declare a journey and find matching loads' },
  { label: 'Documents', href: '/driver/documents', detail: 'Driver and vehicle compliance documents' },
  { label: 'Messages', href: '/driver/messages', detail: 'Operational updates and contacts' },
  { label: 'Job history', href: '/driver/history' },
];
const account = [
  { label: 'Profile', href: '/driver/profile' },
  { label: 'Settings', href: '/driver/settings' },
  { label: 'Support', href: '/driver/support' },
];

export default function MobileMorePage() {
  const [data, setData] = useState<Resources | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const token = readRouteAuthAccessToken();
      if (!token) throw Error('Please sign in to see your driver tools.');
      const response = await fetch('/api/driver/mobile/resources', {
        cache: 'no-store', headers: { Authorization: `Bearer ${token}` }
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw Error(result.error || 'Your driver tools could not be loaded.');
      setData(result.resources ?? null);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load your driver tools.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const type = String(data?.driver?.driver_type ?? '').toLowerCase();
  const ownerDriver = type === 'owner_driver' || type === 'owner_operator';
  const sections: Section[] = [
    { title: 'Operations', items: [
      ...operations,
      { label: ownerDriver ? 'My vehicles' : 'Assigned vehicle', href: '/driver/vehicles',
        detail: ownerDriver ? 'Manage approved vehicles' : 'View assigned and approved vehicle' },
      { label: 'Vehicle readiness', href: '/driver/vehicle-readiness' },
    ] },
    ...(ownerDriver ? [{ title: 'Owner Driver', items: [
      { label: 'My finance', href: '/driver/finance', detail: 'Invoices and commercial records' },
      { label: 'Commercial availability', href: '/driver/nearby' },
    ] }] : []),
    { title: 'Account and help', items: account },
  ];

  return <section className="xd-mobile-list">
    <header><h1>More</h1><p>Your driver tools</p></header>
    {loading ? <p role="status">Loading account...</p> : null}
    {error ? <div role="alert" className="xd-mobile-error"><p>{error}</p>
      <button type="button" onClick={() => void refresh()}>Retry</button></div> : null}
    {data && !loading ? <>
      <article className="xd-mobile-card">
        <strong>{data.name || 'Driver'}</strong>
        <p>{ownerDriver ? 'Owner Driver' : 'Company Driver'}</p>
        {data.company?.name ? <p>Company: {data.company.name}</p> : null}
        {data.vehicle ? <p>Vehicle: {[data.vehicle.make, data.vehicle.model, data.vehicle.reg_plate].filter(Boolean).join(' · ')}</p> : null}
        {data.driver?.availability_status ? <p>Availability: {data.driver.availability_status}</p> : null}
        {!data.driver?.can_commercial_bid ? <p>Commercial quoting is restricted for this account.</p> : null}
      </article>
      {sections.map(section => <section key={section.title}>
        <h2>{section.title}</h2>
        {section.items.map(item => <article className="xd-mobile-card xd-mobile-link-row" key={item.href}>
          <Link href={item.href}>{item.label}</Link>
          {item.detail ? <p>{item.detail}</p> : null}
        </article>)}
      </section>)}
    </> : null}
  </section>;
}