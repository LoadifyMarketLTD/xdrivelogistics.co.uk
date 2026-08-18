'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';
import { isSupabaseConfigured, supabase } from '../../../lib/supabaseClient';
import { MemberIdentityLink } from '../../components/workspace/MemberProfile';
import { AlertBanner, EmptyState, StatusBadge } from '../../components/workspace/WorkspaceUI';

type CompanyRow = {
  id: string;
  name: string | null;
  company_number: string | null;
  status: string | null;
  city?: string | null;
  postcode?: string | null;
};

type DriverRow = {
  id: string;
  company_id: string | null;
  display_name: string | null;
  status: string | null;
  availability_status?: string | null;
};

const normalize = (value: string | null | undefined) => (value ?? '').trim().toLowerCase();

export default function DriverNetworkPage() {
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [activeTab, setActiveTab] = useState<'companies' | 'drivers'>('companies');
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDirectory = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setError('Network data is unavailable because the workspace data connection is not configured.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    const [companyResult, driverResult] = await Promise.all([
      supabase
        .from('companies')
        .select('id, name, company_number, status, city, postcode')
        .eq('status', 'active')
        .order('name', { ascending: true })
        .limit(250),
      supabase
        .from('drivers')
        .select('id, company_id, display_name, status, availability_status')
        .eq('status', 'active')
        .order('display_name', { ascending: true })
        .limit(250),
    ]);

    if (companyResult.error && driverResult.error) {
      setError('Accessible member records could not be loaded. Please retry.');
      setCompanies([]);
      setDrivers([]);
    } else {
      setCompanies((companyResult.data as CompanyRow[] | null) ?? []);
      setDrivers((driverResult.data as DriverRow[] | null) ?? []);
      if (companyResult.error || driverResult.error) setError('Part of the authorised member data is temporarily unavailable.');
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadDirectory();
  }, [loadDirectory]);

  const companyNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const company of companies) map.set(company.id, company.name ?? 'Company');
    return map;
  }, [companies]);

  const filteredCompanies = useMemo(() => {
    const q = normalize(query);
    const loc = normalize(location);
    return companies.filter((company) => {
      const memberText = normalize(`${company.name ?? ''} ${company.company_number ?? ''}`);
      const locationText = normalize(`${company.city ?? ''} ${company.postcode ?? ''}`);
      return (!q || memberText.includes(q)) && (!loc || locationText.includes(loc));
    });
  }, [companies, query, location]);

  const filteredDrivers = useMemo(() => {
    const q = normalize(query);
    return drivers.filter((driver) => {
      const companyName = driver.company_id ? companyNames.get(driver.company_id) ?? '' : '';
      const memberText = normalize(`${driver.display_name ?? ''} ${companyName}`);
      return !q || memberText.includes(q);
    });
  }, [drivers, query, companyNames]);

  return (
    <DriverWorkspaceShell
      personaLabel="Member network"
      driverName="Network"
      subtitle="Member records currently authorised by the XDrive backend. Global Directory access requires a dedicated verified directory data contract."
      headerActions={<button type="button" onClick={() => void loadDirectory()}>Refresh</button>}
    >
      {error && <AlertBanner tone="warning">{error}</AlertBanner>}
      <AlertBanner tone="info">
        Global Directory is not currently exposed by the verified backend permissions. This page shows only company and driver records your authenticated session is already allowed to read; it does not claim to be the full exchange directory.
      </AlertBanner>

      <div className="driver-directory-layout">
        <aside className="driver-directory-search">
          <div className="driver-directory-search__head">Search Panel</div>
          <div className="driver-directory-search__body">
            <label><span>Member name / ID</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Company or driver" /></label>
            <label>
              <span>Company location</span>
              <input
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder={activeTab === 'companies' ? 'Town or postcode' : 'Unavailable for driver records'}
                disabled={activeTab === 'drivers'}
                aria-describedby={activeTab === 'drivers' ? 'driver-location-unavailable' : undefined}
              />
            </label>
            {activeTab === 'drivers' && <span id="driver-location-unavailable">Driver location/radius filtering is unavailable from the current authorised Directory dataset.</span>}
            <div className="driver-directory-search__actions"><button type="button" onClick={() => { setQuery(''); setLocation(''); }}>Clear</button></div>
          </div>
        </aside>

        <section className="driver-directory-results">
          <div className="driver-directory-tabs">
            <button type="button" data-active={activeTab === 'companies' ? 'true' : 'false'} onClick={() => setActiveTab('companies')}>Companies <span>{filteredCompanies.length}</span></button>
            <button type="button" data-active={activeTab === 'drivers' ? 'true' : 'false'} onClick={() => setActiveTab('drivers')}>Drivers <span>{filteredDrivers.length}</span></button>
          </div>

          <div className="driver-directory-toolbar"><strong>{activeTab === 'companies' ? 'AUTHORISED COMPANIES' : 'AUTHORISED DRIVERS'}</strong><span>{loading ? 'Loading…' : `${activeTab === 'companies' ? filteredCompanies.length : filteredDrivers.length} accessible record(s)`}</span></div>

          {activeTab === 'companies' ? (
            <div className="driver-directory-list">
              {filteredCompanies.map((company) => (
                <article key={company.id} className="driver-directory-row">
                  <div className="driver-directory-row__identity"><strong><MemberIdentityLink companyId={company.id}>{company.name ?? 'Unnamed company'}</MemberIdentityLink></strong><span>{company.company_number ? `Member ID ${company.company_number}` : 'Member ID not supplied'}</span></div>
                  <div><span className="driver-directory-label">Location</span><strong>{[company.city, company.postcode].filter(Boolean).join(', ') || 'Not supplied'}</strong></div>
                  <div><span className="driver-directory-label">Member type</span><strong>Company</strong></div>
                  <div className="driver-directory-row__status"><StatusBadge value={company.status ?? 'active'} /></div>
                </article>
              ))}
              {!loading && filteredCompanies.length === 0 && <EmptyState title="No authorised companies found" description="The current backend does not expose a global member directory to this session." />}
            </div>
          ) : (
            <div className="driver-directory-list">
              {filteredDrivers.map((driver) => {
                const companyName = driver.company_id ? companyNames.get(driver.company_id) ?? 'Company member' : 'Independent driver';
                return (
                  <article key={driver.id} className="driver-directory-row driver-directory-row--driver">
                    <div className="driver-directory-row__identity"><strong>{driver.display_name ?? 'Unnamed driver'}</strong><span>{driver.company_id ? <MemberIdentityLink companyId={driver.company_id}>{companyName}</MemberIdentityLink> : companyName}</span></div>
                    <div><span className="driver-directory-label">Company</span><strong>{driver.company_id ? <MemberIdentityLink companyId={driver.company_id}>{companyName}</MemberIdentityLink> : 'Independent'}</strong></div>
                    <div><span className="driver-directory-label">Location / radius</span><strong>Unavailable</strong></div>
                    <div className="driver-directory-row__status"><StatusBadge value={driver.availability_status ?? driver.status ?? 'active'} /></div>
                  </article>
                );
              })}
              {!loading && filteredDrivers.length === 0 && <EmptyState title="No authorised drivers found" description="The current backend exposes only driver rows already permitted for this authenticated session." />}
            </div>
          )}
        </section>
      </div>
    </DriverWorkspaceShell>
  );
}
