'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { readRouteAuthAccessToken } from '../../../../lib/routeAuthCookie';
type Account = { name?: string; company?: { name?: string } | null; driver?: { driver_type?: string | null; availability_status?: string | null } | null };
export default function MobileDriverSettingsPage() {
  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const token = readRouteAuthAccessToken();
    if (!token) { setError('Please sign in.'); return; }
    void fetch('/api/driver/web/resources', { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } })
      .then(async response => { const result = await response.json(); if (!response.ok) throw Error(result.error || 'Unable to load account'); return result; })
      .then(result => { if (active) setAccount(result.resources ?? {}); })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Unable to load account'); });
    return () => { active = false; };
  }, []);
  return <section className="xd-mobile-list"><header><h1>Profile &amp; settings</h1><p>Driver account information</p></header>
    {error && <p role="alert">{error}</p>}
    {!account && !error && <p role="status">Loading account...</p>}
    {account && <article className="xd-mobile-card"><p><strong>Name:</strong> {account.name || 'Driver'}</p>
      <p><strong>Company:</strong> {account.company?.name || 'Not available'}</p>
      <p><strong>Driver type:</strong> {account.driver?.driver_type || 'Not available'}</p>
      <p><strong>Availability:</strong> {account.driver?.availability_status || 'Not provided'}</p>
      <Link href="/m/driver/documents">Documents</Link>
    </article>}
  </section>;
}
