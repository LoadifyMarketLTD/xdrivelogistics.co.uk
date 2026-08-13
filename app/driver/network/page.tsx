'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';
import { isSupabaseConfigured, supabase } from '../../../lib/supabaseClient';
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
      setError('The member network could not be loaded. Please retry.');
      setCompanies([]);
      setDrivers([]);
    } else {
      setCompanies((companyResult.data as CompanyRow[] | null) ?? []);
      setDrivers((driverResult.data as DriverRow[] | null) ?? []);
      if (companyResult.error || driverResult.error) setError('Part of the member network is temporarily unavailable.');
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
    const loc = normalize(location);
    return drivers.filter((driver) => {
      const companyName = driver.company_id ? companyNames.get(driver.company_id) ?? '' : '';
      const memberText = normalize(`${driver.display_name ?? ''} ${companyName}`);
      return (!q || memberText.includes(q)) && (!loc || normalize(companyName).includes(loc));
    });
  }, [drivers, query, location, companyNames]);

  return (
    <DriverWorkspaceShell
      personaLabel="Driver network"
      driverName="Network"
      subtitle="Search active companies and drivers in the XDrive exchange network."
      headerActions={<button type="button" onClick={() => void loadDirectory()}>Refresh</button>}
    >
      {error && <AlertBanner tone="warning">{error}</AlertBanner>}

      <div className="driver-directory-layout">
        <aside className="driver-directory-search">
          <div className="driver-directory-search__head">Search Panel</div>
          <div className="driver-directory-search__body">
            <label><span>Member name / ID</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Company or driver" /></label>
            <label><span>Location</span><input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Town or postcode" /></label>
            <div className="driver-directory-search__actions"><button type="button" onClick={() => { setQuery(''); setLocation(''); }}>Clear</button></div>
          </div>
        </aside>

        <section className="driver-directory-results">
          <div className="driver-directory-tabs">
            <button type="button" data-active={activeTab === 'companies' ? 'true' : 'false'} onClick={() => setActiveTab('companies')}>Companies <span>{filteredCompanies.length}</span></button>
            <button type="button" data-active={activeTab === 'drivers' ? 'true' : 'false'} onClick={() => setActiveTab('drivers')}>Drivers <span>{filteredDrivers.length}</span></button>
          </div>

          <div className="driver-directory-toolbar"><strong>{activeTab === 'companies' ? 'COMPANIES' : 'DRIVERS'}</strong><span>{loading ? 'Loading…' : `${activeTab === 'companies' ? filteredCompanies.length : filteredDrivers.length} visible members`}</span></div>

          {activeTab === 'companies' ? (
            <div className="driver-directory-list">
              {filteredCompanies.map((company) => (
                <article key={company.id} className="driver-directory-row">
                  <div className="driver-directory-row__identity"><strong>{company.name ?? 'Unnamed company'}</strong><span>{company.company_number ? `GB ${company.company_number}` : 'Active exchange member'}</span></div>
                  <div><span className="driver-directory-label">Location</span><strong>{[company.city, company.postcode].filter(Boolean).join(', ') || 'Not supplied'}</strong></div>
                  <div><span className="driver-directory-label">Member type</span><strong>Company</strong></div>
                  <div className="driver-directory-row__status"><StatusBadge value={company.status ?? 'active'} /></div>
                </article>
              ))}
              {!loading && filteredCompanies.length === 0 && <EmptyState title="No companies found" description="Adjust the member or location search." />}
            </div>
          ) : (
            <div className="driver-directory-list">
              {filteredDrivers.map((driver) => (
                <article key={driver.id} className="driver-directory-row driver-directory-row--driver">
                  <div className="driver-directory-row__identity"><strong>{driver.display_name ?? 'Unnamed driver'}</strong><span>{driver.company_id ? companyNames.get(driver.company_id) ?? 'Company member' : 'Independent driver'}</span></div>
                  <div><span className="driver-directory-label">Company</span><strong>{driver.company_id ? companyNames.get(driver.company_id) ?? 'Company member' : 'Independent'}</strong></div>
                  <div><span className="driver-directory-label">Member type</span><strong>Driver</strong></div>
                  <div className="driver-directory-row__status"><StatusBadge value={driver.availability_status ?? driver.status ?? 'active'} /></div>
                </article>
              ))}
              {!loading && filteredDrivers.length === 0 && <EmptyState title="No drivers found" description="Adjust the member or location search." />}
            </div>
          )}
        </section>
      </div>
    </DriverWorkspaceShell>
  );
}
