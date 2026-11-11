'use client';

import { useMemo, useState } from 'react';
import { useCompany3150Live } from './Company3150LiveData';
import DemoDriverProfile from './DemoDriverProfile';
import VerifiedDriverProfile from './VerifiedDriverProfile';
import {documentSummary,driverDocumentStatus} from '../../../lib/companyDocumentAssessment';
import './demo-drivers-board.css';

type Vehicle = { id: string; reg: string; vehicle: string; driver: string; status: string; location: string };
export type VerifiedDriverSnapshot = {
  drivers: Array<{ id: string; display_name: string | null; status: string | null; availability_status: string | null }>;
  vehicles: Array<{ id: string; reg_plate: string | null; type: string | null; assigned_driver_id: string | null }>;
  documents: Array<{ id: string; driver_id: string | null; doc_type: string | null; status: string | null; expiry_date: string | null }>;
  documentsUnavailable?: boolean;
  documentsRestricted?: boolean;
  limited: boolean;
};
type DriverRow = {
  name: string; id: string; reg: string; vehicle: string; status: string; compliance: string;
  documentCount: number; expiringCount: number;
};
type Props = {
  drivers?: string[]; vehicles?: Vehicle[]; onFleet?: () => void;
  suppressPreview?: boolean; verifiedDrivers?: VerifiedDriverSnapshot;
  readOnly?: boolean; manageHref?: string;
};

const sections = ['All Drivers', 'Available', 'On Job', 'Off Duty', 'Expiring Docs', 'Archived'];
const availabilityName = (value: string | null | undefined) => {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'available') return 'Available';
  if (['on_job','on job','busy'].includes(normalized)) return 'On Job';
  return 'Off Duty';
};
const expiringSoon = (date: string | null | undefined) => {
  if (!date) return false;
  const delta = new Date(date).getTime() - Date.now();
  return Number.isFinite(delta) && delta >= 0 && delta <= 30 * 86400000;
};

export default function DemoDriversBoard({
  drivers = [], vehicles = [], onFleet = () => {},
  suppressPreview: _suppressPreview = false,
  verifiedDrivers, readOnly = false, manageHref,
}: Props) {
  const real = useCompany3150Live();
  const verified = Boolean(verifiedDrivers);
  const [tab, setTab] = useState('All Drivers');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('Any Status');
  const [compliance, setCompliance] = useState('Any Compliance');
  const [selected, setSelected] = useState('');
  const [sort, setSort] = useState('Name (A-Z)');
  const [licence, setLicence] = useState('Any Licence');
  const canManage = !readOnly && (!verified || Boolean(manageHref));
  const manage = () => {
    if (!canManage) return;
    if (manageHref) window.location.assign(manageHref);
    else onFleet();
  };

  const rows = useMemo<DriverRow[]>(() => {
    if (verifiedDrivers) return verifiedDrivers.drivers.map(driver => {
      const assigned = verifiedDrivers.vehicles.find(vehicle => vehicle.assigned_driver_id === driver.id);
      const docs = verifiedDrivers.documents.filter(document => document.driver_id === driver.id);
      return {
        id: driver.id, name: driver.display_name || 'Unnamed driver',
        reg: assigned?.reg_plate || 'Unassigned',
        vehicle: assigned?.type || 'No vehicle',
        status: availabilityName(driver.availability_status),
        compliance: documentSummary(docs, verifiedDrivers.documentsUnavailable || verifiedDrivers.documentsRestricted).label,
        documentCount: docs.length,
        expiringCount: docs.filter(document => expiringSoon(document.expiry_date)).length,
      };
    });
    return drivers.map((name, i) => {
      const assigned = vehicles.find(vehicle => vehicle.driver === name);
      const member = real?.data.drivers[i];
      return {
        id: member?.id || 'DR-' + (i + 1),
        name, reg: assigned?.reg || 'Unassigned',
        vehicle: assigned?.vehicle || 'No vehicle',
        status: member ? availabilityName(member.availability_status) : assigned?.status === 'Available' ? 'Available' : 'Off Duty',
        compliance: 'Not verified', documentCount: 0, expiringCount: 0,
      };
    });
  }, [verifiedDrivers, drivers, vehicles, real]);

  const limited = verifiedDrivers?.limited === true;
  const filtered = rows.filter(driver =>
    (tab === 'All Drivers' || tab === driver.status ||
      tab === 'Expiring Docs' && driver.expiringCount > 0 ||
      tab === 'Archived' && false) &&
    (status === 'Any Status' || driver.status === status) &&
    (compliance === 'Any Compliance' || driver.compliance === compliance) &&
    (driver.name + ' ' + driver.reg + ' ' + driver.id).toLowerCase().includes(search.toLowerCase())
  ).sort((a, b) =>
    sort === 'Name (Z-A)' ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name)
  );
  const details = rows.find(driver => driver.id === selected);
  const availableCount = rows.filter(driver => driver.status === 'Available').length;
  const onJobCount = rows.filter(driver => driver.status === 'On Job').length;
  const expiringCount = verifiedDrivers ? verifiedDrivers.documents.filter(document => expiringSoon(document.expiry_date)).length : real?.data.driverDocuments.filter(document => expiringSoon(document.expiry_date)).length || 0;
  const documentTotals = documentSummary(verifiedDrivers?.documents ?? [], Boolean(verifiedDrivers?.documentsRestricted || verifiedDrivers?.documentsUnavailable));
  const counts = (section: string) => section === 'All Drivers' ? rows.length :
    section === 'Expiring Docs' ? rows.filter(driver => driver.expiringCount > 0).length :
    section === 'Archived' ? 0 : rows.filter(driver => driver.status === section).length;

  return <section className="xd-drivers" data-master-drivers={verified ? '3150-canonical-real' : '3150-canonical-demo'}>
    <h1>Drivers</h1><p>Manage your drivers, licences, documents and availability</p>
    {limited && <p role="status">Some company driver data is unavailable. Complete totals cannot be verified.</p>}
    <div className="xd-drivers-kpis">
      {[
        ['♙','Total Drivers',limited?'—':rows.length,availableCount+' Available','#ff7900'],
        ['▶','On Job',limited?'—':onJobCount,'Currently working','#1672e7'],
        ['✓','Compliant','—',verifiedDrivers ? `${documentTotals.approved} documents approved; eligibility not assessed` : 'Not verified','#0ca3'],
        ['▣','Expiring Soon',verifiedDrivers?.documentsUnavailable || verifiedDrivers?.documentsRestricted?'—':expiringCount,'Within 30 days','#ff9700'],
        ['⚠','Not Compliant','—',verifiedDrivers ? `${documentTotals.needsAction} documents need action; eligibility not assessed` : 'Not verified','#e21b2d'],
      ].map(([icon,title,count,description,color]) => <div key={title} className="xd-drivers-kpi" style={{borderLeftColor:String(color)}}>
        <span style={{color:String(color)}}>{icon}</span>
        <div><b>{title}</b><strong>{count}</strong><small>{description}</small></div>
      </div>)}
    </div>
    <div className="xd-drivers-tabs" role="tablist" aria-label="Driver status">
      {sections.map(value => <button type="button" role="tab" aria-selected={tab === value} key={value} className={tab === value ? 'active' : ''} onClick={() => setTab(value)}>
        {value} <span>{counts(value)}</span>
      </button>)}
      <button type="button" className="xd-drivers-add" disabled={!canManage} title={canManage?undefined:'Driver management is not permitted for this role'} onClick={manage}>＋ Add Driver</button>
    </div>
    <div className="xd-drivers-layout">
      <aside className="xd-drivers-filter">
        <h3>Find Driver</h3>
        <label>Driver Name / ID<input value={query} onChange={event => setQuery(event.target.value)} placeholder="e.g. name or registration" onKeyDown={event => {if(event.key === 'Enter')setSearch(query.trim())}} /></label>
        <label>Status<select value={status} onChange={event => setStatus(event.target.value)}>{['Any Status','Available','On Job','Off Duty'].map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Licence Type<select disabled={verified} title={verified?'Licence details are available only in authorised verified driver records':undefined} value={licence} onChange={event => setLicence(event.target.value)}>{['Any Licence','Category B','Category C1','Category C'].map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Compliance<select value={compliance} onChange={event => setCompliance(event.target.value)}>{['Any Compliance','Compliant','Expiring Soon','Not verified'].map(value => <option key={value}>{value}</option>)}</select></label>
        <button type="button" className="xd-drivers-clear" onClick={() => {setQuery('');setSearch('');setStatus('Any Status');setCompliance('Any Compliance');setTab('All Drivers');setLicence('Any Licence')}}>↻ Clear Filters</button>
        <button type="button" className="xd-drivers-search" onClick={() => setSearch(query.trim())}>⌕ Search Drivers</button>
      </aside>
      <div className="xd-drivers-results">
        <div className="xd-drivers-toolbar"><b>{filtered.length} Drivers Found</b><label>Sort by: <select value={sort} onChange={event => setSort(event.target.value)}><option>Name (A-Z)</option><option>Name (Z-A)</option></select></label></div>
        {filtered.map(driver => <article className="xd-drivers-row" key={driver.id} style={{borderLeftColor:driver.status === 'On Job' ? '#176de5' : driver.status === 'Off Duty' ? '#f90' : '#0a3'}}>
          <div className="xd-drivers-avatar" aria-hidden="true">♙</div>
          <div><strong>{driver.name}</strong><small>{driver.id.slice(0, 8).toUpperCase()}</small><span className={'xd-driver-state ' + driver.status.replace(' ','-')}>{driver.status}</span></div>
          <div className="xd-drivers-vehicle"><b>🚚 {driver.reg}</b><small>{driver.vehicle}</small></div>
          <div className="xd-drivers-checks"><span>Licence: {driverDocumentStatus((verifiedDrivers?.documents ?? []).filter(document=>document.driver_id===driver.id),'licence',Boolean(verifiedDrivers?.documentsUnavailable||verifiedDrivers?.documentsRestricted))}</span><span>CPC: {driverDocumentStatus((verifiedDrivers?.documents ?? []).filter(document=>document.driver_id===driver.id),'cpc',Boolean(verifiedDrivers?.documentsUnavailable||verifiedDrivers?.documentsRestricted))}</span><span>ID: {driverDocumentStatus((verifiedDrivers?.documents ?? []).filter(document=>document.driver_id===driver.id),'identity',Boolean(verifiedDrivers?.documentsUnavailable||verifiedDrivers?.documentsRestricted))}</span></div>
          <div className="xd-drivers-compliance"><b>Compliance</b><span>{driver.compliance}</span></div>
          <button type="button" className="xd-drivers-profile" onClick={() => setSelected(driver.id)}>View Profile</button>
        </article>)}
        {!filtered.length && <p role="status">No drivers match the current filters.</p>}
      </div>
    </div>
    {details && (verified
      ? <VerifiedDriverProfile driver={details} documents={verifiedDrivers?.documents ?? []} restricted={Boolean(verifiedDrivers?.documentsRestricted || verifiedDrivers?.documentsUnavailable)} onClose={() => setSelected('')} onManage={canManage ? manage : undefined} />
      : <DemoDriverProfile driver={details} onClose={() => setSelected('')} onFleet={onFleet}/>)}

  </section>;
}
