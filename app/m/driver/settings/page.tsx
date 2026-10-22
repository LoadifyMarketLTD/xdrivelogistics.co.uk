'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { readRouteAuthAccessToken } from '../../../../lib/routeAuthCookie';

type Profile = {
  name?: string;
  email?: string;
  phone?: string;
  company?: { name?: string } | null;
  vehicle?: { reg_plate?: string } | null;
  driver?: { driver_type?: string | null } | null;
};
export default function DriverSettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const load = async () => {
      setProfile(null);
      try {
        const token = readRouteAuthAccessToken();
        if (!token) throw new Error('Please sign in.');
        const response = await fetch('/api/driver/web/resources', {
          cache: 'no-store', headers: { Authorization: 'Bearer ' + token },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.resources) throw new Error(data.error || 'Profile unavailable.');
        setProfile(data.resources);
      } catch (reason) { setError(reason instanceof Error ? reason.message : 'Profile unavailable.'); }
    };
    void load();
  }, []);
  const owner = profile?.driver?.driver_type === 'owner_driver';
  return <section className="xd-mobile-list">
    <header><Link className="xd-mobile-back" href="/m/driver/more">More</Link><h1>Profile &amp; settings</h1></header>
    {error ? <p role="alert" className="xd-mobile-error">{error}</p> : null}
    {!profile && !error ? <p role="status">Loading profile...</p> : null}
    {profile ? <article className="xd-mobile-card">
      <p><strong>Name:</strong> {profile.name || 'Not provided'}</p>
      <p><strong>Role:</strong> {owner ? 'Owner Driver' : 'Company Driver'}</p>
      <p><strong>Email:</strong> {profile.email || 'Not provided'}</p>
      {profile.phone ? <p><strong>Phone:</strong> {profile.phone}</p> : null}
      {profile.company?.name ? <p><strong>Company:</strong> {profile.company.name}</p> : null}
      {profile.vehicle?.reg_plate ? <p><strong>Vehicle:</strong> {profile.vehicle.reg_plate}</p> : null}
      <div className="xd-mobile-actions">
        <Link href="/driver/account">Edit account</Link>
        <Link href="/m/driver/documents">Documents</Link>
      </div>
    </article> : null}
  </section>;
}
