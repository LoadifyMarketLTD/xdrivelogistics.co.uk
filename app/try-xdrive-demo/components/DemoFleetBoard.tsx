'use client';

import { useMemo, useState } from 'react';
import { useCompany3150Live } from './Company3150LiveData';
import DemoFleetManager from './DemoFleetManager';
import {documentSummary} from '../../../lib/companyDocumentAssessment';
import './demo-fleet-board.css';

type Vehicle = { id: string; reg: string; vehicle: string; driver: string; status: string; location: string };
export type VerifiedFleetSnapshot = {
  vehicles: Array<{
    id: string; reg_plate: string | null; type: string | null; body_type: string | null;
    payload_kg: number | null; pallets_capacity: number | null; has_tail_lift: boolean | null;
    assigned_driver_id: string | null; is_available: boolean | null;
  }>;
  drivers: Array<{ id: string; display_name: string | null; status: string | null; availability_status: string | null }>;
  documents: Array<{ id: string; vehicle_id: string | null; doc_type: string | null; status: string | null; expiry_date: string | null }>;
  limited: boolean;
  documentsUnavailable?: boolean;
  documentsRestricted?: boolean;
};
type Props = {
  vehicles?: Vehicle[]; setVehicles?: (fn: (v: Vehicle[]) => Vehicle[]) => void;
  drivers?: string[]; setDrivers?: (fn: (d: string[]) => string[]) => void;
  suppressPreview?: boolean; readOnly?: boolean;
  verifiedFleet?: VerifiedFleetSnapshot;
  manageHref?: string;
};
type FleetRow = Vehicle & {
  capacity: string; weight: string; dimensions: string; compliance: string;
};

export default function DemoFleetBoard({
  vehicles = [], setVehicles = () => {}, drivers = [], setDrivers = () => {},
  suppressPreview: _suppressPreview = false, readOnly = false,
  verifiedFleet, manageHref,
}: Props) {
  const real = useCompany3150Live();
  const [section, setSection] = useState('Vehicles');
  const [type, setType] = useState('Any Type');
  const [status, setStatus] = useState('Any Status');
  const [compliance, setCompliance] = useState('Any Compliance');
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState('');
  const [sort, setSort] = useState('Vehicle (A-Z)');
  const isVerified = Boolean(verifiedFleet);
  const sourceDrivers = verifiedFleet?.drivers ?? real?.data.drivers ?? [];
  const sourceDocuments = verifiedFleet?.documents ?? real?.data.vehicleDocuments ?? [];
  const driverNameById = useMemo(
    () => new Map(sourceDrivers.map((driver) => [driver.id, driver.display_name || 'Unnamed driver'])),
    [sourceDrivers],
  );
  const fleetVehicles: Vehicle[] = verifiedFleet
    ? verifiedFleet.vehicles.map((vehicle) => ({
        id: vehicle.id,
        reg: vehicle.reg_plate || 'Not recorded',
        vehicle: vehicle.type || 'Vehicle type not recorded',
        driver: vehicle.assigned_driver_id ? driverNameById.get(vehicle.assigned_driver_id) || 'Driver not verified' : 'Unassigned',
        status: vehicle.is_available === true ? 'Available' : vehicle.is_available === false ? 'Unavailable' : 'Not verified',
        location: 'Not recorded',
      }))
    : vehicles;
  const fleetDrivers = verifiedFleet
    ? verifiedFleet.drivers.map((driver) => driver.display_name || 'Unnamed driver')
    : drivers;
  const verifiedById = new Map(verifiedFleet?.vehicles.map((vehicle) => [vehicle.id, vehicle]) ?? []);
  const rows: FleetRow[] = fleetVehicles.map((vehicle) => {
    const source = verifiedById.get(vehicle.id);
    return {
      ...vehicle,
      capacity: source?.pallets_capacity == null ? 'Not recorded' : source.pallets_capacity + ' pallets',
      weight: source?.payload_kg == null ? 'Not recorded' : source.payload_kg + ' kg',
      dimensions: source?.body_type || 'Not recorded',
      compliance: documentSummary(sourceDocuments.filter(document=>document.vehicle_id===vehicle.id),Boolean(verifiedFleet?.documentsUnavailable||verifiedFleet?.documentsRestricted)).label,
    };
  });
  const documentTotals = documentSummary(sourceDocuments,Boolean(verifiedFleet?.documentsUnavailable||verifiedFleet?.documentsRestricted));
  const availableVehicles = isVerified && verifiedFleet?.vehicles.some(vehicle=>vehicle.is_available == null)
    ? null
    : fleetVehicles.filter((vehicle) => vehicle.status === 'Available').length;
  const availableDrivers = sourceDrivers.filter(
    (driver) => String(driver.availability_status || '').toLowerCase() === 'available',
  ).length;
  const expiringDocuments = sourceDocuments.filter((document) => {
    if (!document.expiry_date) return false;
    const ms = new Date(document.expiry_date).getTime() - Date.now();
    return Number.isFinite(ms) && ms >= 0 && ms <= 30 * 86400000;
  }).length;
  const options = [...new Set(rows.map((vehicle) => vehicle.vehicle))].sort();
  const filtered = rows.filter((vehicle) =>
    (type === 'Any Type' || vehicle.vehicle === type) &&
    (status === 'Any Status' || vehicle.status === status) &&
    (compliance === 'Any Compliance' || vehicle.compliance === compliance) &&
    [vehicle.reg, vehicle.vehicle, vehicle.driver].join(' ').toLowerCase().includes(query.toLowerCase())
  ).sort((a, b) => sort === 'Vehicle (Z-A)'
    ? b.reg.localeCompare(a.reg)
    : a.reg.localeCompare(b.reg));
  const detail = rows.find((vehicle) => vehicle.id === selected);
  const manage = () => {
    if (readOnly) return;
    if (manageHref) { window.location.assign(manageHref); return; }
    if (!isVerified && real) { window.location.assign('/admin/fleet'); return; }
    if (!isVerified) setSection('Manage Fleet');
  };
  const clearFilters = () => {
    setType('Any Type'); setStatus('Any Status'); setCompliance('Any Compliance');
    setQueryInput(''); setQuery('');
  };
  const complianceFindings = sourceDocuments.filter((document) => {
    const status = String(document.status || '').trim().toLowerCase();
    const approved = ['verified', 'approved', 'valid', 'compliant', 'active'].includes(status);
    const expiry = document.expiry_date ? new Date(document.expiry_date).getTime() : NaN;
    return !approved || !Number.isFinite(expiry) || expiry <= Date.now() + 30 * 86400000;
  });
  const partial = verifiedFleet?.limited === true;
  const noPermission = readOnly || (isVerified && !manageHref);
  return <section className="xd-fleet" data-master-fleet={isVerified ? '3150-canonical-real' : '3150-canonical-demo'}>
    <h1>My Fleet</h1>
    <p>Manage your vehicles, drivers, documents and compliance</p>
    {partial && <p role="status">Verified company data is partial. Complete totals are unavailable.</p>}
    <div className="xd-fleet-kpis">
      {[
        ['🚚', 'Total Vehicles', partial ? '—' : fleetVehicles.length, availableVehicles == null ? 'Availability not verified' : availableVehicles + ' Available', '#ff7900'],
        ['♙', 'Total Drivers', partial ? '—' : fleetDrivers.length, availableDrivers + ' Available', '#1672e7'],
        ['✓', 'Compliant', '—', isVerified ? `${documentTotals.approved} documents approved; eligibility not assessed` : 'Not verified', '#0ca52b'],
        ['▣', 'Expiring Soon', sourceDocuments.length ? expiringDocuments : '—', sourceDocuments.length ? 'Within 30 days' : 'Documents not verified', '#ff9700'],
        ['⚠', 'Not Compliant', '—', isVerified ? `${documentTotals.needsAction} documents need action; eligibility not assessed` : 'Not verified', '#e21b2d'],
      ].map(([icon, name, count, detailText, color]) =>
        <div className="xd-fleet-kpi" key={name} style={{ borderLeftColor: String(color) }}>
          <span style={{ color: String(color) }}>{icon}</span>
          <div><b>{name}</b><strong>{count}</strong><small>{detailText}</small></div>
        </div>
      )}
    </div>
    <div className="xd-fleet-tabs" role="tablist" aria-label="Fleet sections">
      {['Vehicles', 'Drivers', 'Documents', 'Compliance'].map((tab) =>
        <button key={tab} type="button" role="tab" aria-selected={section === tab} className={section === tab ? 'active' : ''} onClick={() => setSection(tab)}>
          {tab}{tab === 'Vehicles' ? ' (' + fleetVehicles.length + ')' : tab === 'Drivers' ? ' (' + fleetDrivers.length + ')' : ''}
        </button>
      )}
      <button type="button" className="xd-fleet-add" disabled={noPermission} title={noPermission ? 'You do not have permission to manage fleet' : undefined} onClick={manage}>＋ Add Vehicle</button>
    </div>
    {section === 'Vehicles' ? <div className="xd-fleet-layout">
      <aside className="xd-fleet-filter">
        <h3>Find in Fleet</h3>
        <label>Vehicle Type
          <select value={type} onChange={(event) => setType(event.target.value)}>
            <option>Any Type</option>
            {options.map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
        <label>Status
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            {['Any Status', 'Available', 'Unavailable', 'In Use', 'On Service', 'Inactive', 'Not verified'].map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
        <label>Compliance
          <select value={compliance} onChange={(event) => setCompliance(event.target.value)}>
            {['Any Compliance', 'Compliant', 'Expires in 14 days', 'Not verified'].map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
        <input placeholder="Registration or driver" aria-label="Search fleet" value={queryInput} onChange={(event) => setQueryInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') setQuery(queryInput.trim()); }} />
        <button type="button" className="xd-fleet-clear" onClick={clearFilters}>↻ Clear Filters</button>
        <button type="button" className="xd-fleet-search" onClick={() => setQuery(queryInput.trim())}>⌕ Search Fleet</button>
      </aside>
      <div className="xd-fleet-results">
        <div className="xd-fleet-toolbar">
          <b>{filtered.length} Vehicles Found</b>
          <label>Sort by:
            <select value={sort} onChange={(event) => setSort(event.target.value)}>
              <option>Vehicle (A-Z)</option><option>Vehicle (Z-A)</option>
            </select>
          </label>
        </div>
        {filtered.map((vehicle) =>
          <article key={vehicle.id} className="xd-fleet-row" style={{ borderLeftColor: vehicle.status === 'In Use' ? '#176de5' : vehicle.status === 'On Service' ? '#f90' : '#0a3' }}>
            <div className="xd-fleet-truck">🚚<small>{vehicle.status}</small></div>
            <strong>{vehicle.reg}</strong>
            <div className="xd-fleet-spec"><b>🚚 {vehicle.vehicle}</b><span>▦ Max: {vehicle.capacity} ♧ {vehicle.weight} ↔ {vehicle.dimensions}</span></div>
            <div className="xd-fleet-driver"><b>♙ {vehicle.driver}</b><small>{vehicle.driver === 'Unassigned' ? 'Unassigned' : 'Assigned'}</small></div>
            <div className="xd-fleet-compliance">⚠ {vehicle.compliance}</div>
            <button className="xd-fleet-detail" type="button" onClick={() => setSelected(vehicle.id)}>View Details</button>
            <button className="xd-fleet-edit" type="button" disabled={noPermission} onClick={manage}>✎ Edit</button>
          </article>
        )}
        {!filtered.length && <p role="status">No company vehicles match the current filters.</p>}
      </div>
    </div> : <div className="xd-fleet-manager">
      {isVerified ? <div className="panel">
        <h2>{section}</h2>
        {section === 'Drivers'
          ? sourceDrivers.map((driver) => <div className="network-job" key={driver.id}><strong>{driver.display_name || 'Unnamed driver'}</strong><small>{driver.availability_status || 'Availability not recorded'}</small></div>)
          : section === 'Documents' ? sourceDocuments.map((document) => <div className="network-job" key={document.id}><strong>{document.doc_type || 'Document'}</strong><small>{document.status || 'Status not recorded'} · {document.expiry_date || 'No expiry recorded'}</small></div>) : null}
        {section === 'Compliance' && <p className="muted">Compliance flags use recorded document status and expiry dates; absence of a flag is not proof of full compliance.</p>}
        {section === 'Compliance' && complianceFindings.map((document) => <div className="network-job" key={document.id}><strong>{document.doc_type || 'Document type not recorded'}</strong><small>{document.status || 'Status not recorded'} | {document.expiry_date || 'Expiry not recorded'}</small></div>)}
        {section === 'Compliance' && complianceFindings.length === 0 && sourceDocuments.length > 0 && <p className="muted">No known expiring or unverified documents in available records.</p>}
        {section === 'Drivers' && !sourceDrivers.length && <p className="muted">No registered drivers.</p>}
        {section !== 'Drivers' && verifiedFleet?.documentsRestricted && <p role="status">Company compliance documents are restricted for this workspace role.</p>}
        {section !== 'Drivers' && verifiedFleet?.documentsUnavailable && <p role="status">Vehicle documents are currently unavailable. Compliance results cannot be verified.</p>}
        {section !== 'Drivers' && !sourceDocuments.length && !verifiedFleet?.documentsUnavailable && !verifiedFleet?.documentsRestricted && <p className="muted">No verified vehicle documents available.</p>}
        {!noPermission && <p><a href={manageHref}>Manage fleet records</a></p>}
      </div> : real || readOnly ? <div className="panel">
        <h2>{section}</h2>
        {section === 'Drivers'
          ? (real?.data.drivers || []).map((driver) => <div className="network-job" key={driver.id}><strong>{driver.display_name || 'Unnamed driver'}</strong><small>{driver.availability_status || 'Availability not recorded'}</small></div>)
          : (real?.data.vehicleDocuments || []).map((document) => <div className="network-job" key={document.id}><strong>{document.doc_type || 'Document'}</strong><small>{document.status || 'Status not recorded'} · {document.expiry_date || 'No expiry recorded'}</small></div>)}
        {!noPermission && <p><a href="/admin/fleet">Manage fleet records</a></p>}
      </div> : <DemoFleetManager vehicles={vehicles} setVehicles={setVehicles} drivers={drivers} setDrivers={setDrivers} />}
    </div>}
    {detail && <div className="xd-fleet-backdrop" onClick={() => setSelected('')}>
      <section className="xd-fleet-modal" role="dialog" aria-modal="true" aria-label="Vehicle details" onClick={(event) => event.stopPropagation()}>
        <header><h2>Vehicle Details — {detail.reg}</h2><button type="button" onClick={() => setSelected('')} aria-label="Close vehicle details">×</button></header>
        <div>
          {[
            ['Vehicle', detail.vehicle],
            ['Assigned Driver', detail.driver],
            ['Availability', detail.status],
            ['Pallet Capacity', detail.capacity],
            ['Payload', detail.weight],
            ['Internal Dimensions', detail.dimensions],
            ['Compliance', detail.compliance],
          ].map(([name, value]) => <p key={name}><b>{name}:</b> {value}</p>)}
          <small>Equipment and documents must be verified before operational use.</small>
          <p><button type="button" disabled={noPermission} onClick={() => { setSelected(''); manage(); }}>Manage Fleet Record</button></p>
        </div>
      </section>
    </div>}
  </section>;
}
