'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { readRouteAuthAccessToken } from '../../../../lib/routeAuthCookie';
import { useAuth } from '../../../components/AuthContext';

type Resources = {
  name?: string;
  company?: { name?: string } | null;
  vehicle?: { reg_plate?: string; make?: string; model?: string } | null;
  driver?: { driver_type?: string | null; can_commercial_bid?: boolean; availability_status?: string | null } | null;
  partial?: string[];
};
type MenuItem = { label: string; href: string };
const essentials: MenuItem[] = [
  { label: 'Documents', href: '/m/driver/documents' },
  { label: 'Availability', href: '/m/driver/availability' },
  { label: 'Return Journeys', href: '/m/driver/return-journeys' },
  { label: 'Messages', href: '/m/driver/messages' },
  { label: 'Profile & settings', href: '/m/driver/settings' },
  { label: 'Help & support', href: '/m/driver/support' },
];
export default function MobileMorePage() {
  const { logout } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [data, setData] = useState<Resources | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    setData(null);
    setLoading(true);
    try {
      const token = readRouteAuthAccessToken();
      if (!token) throw Error('Please sign in to see your driver tools.');
      const response = await fetch('/api/driver/web/resources', {
        cache: 'no-store', headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000)
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
  return <section className="xd-mobile-list">
    <header><h1>More</h1><p>Account and essentials</p></header>
    {loading ? <p role="status">Loading account...</p> : null}
    {error ? <div role="alert" className="xd-mobile-error"><p>{error}</p>
      <button type="button" onClick={() => void refresh()}>Retry</button></div> : null}
    {data ? <>
      <article className="xd-mobile-card">
        <strong>{data.name || 'Driver'}</strong>
        <p>{ownerDriver ? 'Owner Driver' : 'Company Driver'}</p>
        {data.company?.name ? <p>Company: {data.company.name}</p> : null}
        {data.vehicle ? <p>Vehicle: {[data.vehicle.make, data.vehicle.model, data.vehicle.reg_plate].filter(Boolean).join(' · ')}</p> : null}
        {data.driver?.availability_status ? <p>Availability: {data.driver.availability_status}</p> : null}
        {!data.driver?.can_commercial_bid ? <p>Commercial quoting is restricted for this account.</p> : null}
      </article>
      <nav aria-label="More tools" className="xd-mobile-more-links">
        {essentials.map(item => <article className="xd-mobile-card xd-mobile-link-row" key={item.href}>
          <Link href={item.href}>{item.label}</Link>
        </article>)}
        {ownerDriver ? <article className="xd-mobile-card xd-mobile-link-row"><Link href="/m/driver/finance">My finance</Link></article> : null}
      </nav>    </> : null}
    <button type="button" className="xd-mobile-card" disabled={signingOut} onClick={async () => { if (signingOut) return; setSigningOut(true); try { await logout(); } catch { setError("Sign out failed. Please retry."); setSigningOut(false); } }} style={{width:"100%",minHeight:48,textAlign:"center",fontWeight:700,color:"#a52620"}}>{signingOut ? "Signing out..." : "Log out"}</button>
  </section>;
}
