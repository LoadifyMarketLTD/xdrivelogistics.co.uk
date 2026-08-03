'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import type { Vehicle, VehicleType, Company } from '../../../lib/types/database';
import { isMissingColumnError } from '../../../lib/supabaseSchemaCompat';
import { logRuntimeProof } from '../../../lib/runtimeProof';
import { useAdminCompanyContext } from '../_hooks/useAdminCompanyContext';
import { PageFrame, PageHeader, ActionButton, AlertBanner } from '../../components/workspace/WorkspaceUI';
import cssStyles from '../../components/workspace/WorkspaceUI.module.css';

const VEHICLE_TYPES: VehicleType[] = ['bicycle', 'motorbike', 'car', 'van_small', 'van_large', 'luton', 'truck_7_5t', 'truck_18t', 'artic'];

interface DriverOption { id: string; display_name: string; }
type AdvertisingState = 'none' | 'exchange' | 'partner';
const isAdvertisingState = (value: unknown): value is AdvertisingState =>
  value === 'none' || value === 'exchange' || value === 'partner';

export default function VehiclesPage() {
  const { user } = useAuth();
  const { companyId, companyResolved, companyError } = useAdminCompanyContext();  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [formData, setFormData] = useState({ type: 'van_large' as VehicleType, reg_plate: '', make: '', model: '', manufacture_year: '', payload_kg: '', has_tail_lift: false, assigned_driver_id: '' });
  const [editData, setEditData] = useState({ type: 'van_large' as VehicleType, reg_plate: '', make: '', model: '', manufacture_year: '', payload_kg: '', has_tail_lift: false, assigned_driver_id: '' });
  const [error, setError] = useState('');
  const [editError, setEditError] = useState('');
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [advertisingUpdating, setAdvertisingUpdating] = useState<Record<string, boolean>>({});
  const [advertisingFeedback, setAdvertisingFeedback] = useState<Record<string, { tone: 'success' | 'error'; message: string }>>({});
  const [advertisingStateAvailable, setAdvertisingStateAvailable] = useState(true);
  const VEHICLES_PER_PAGE = 12;
  const [vehiclePage, setVehiclePage] = useState(0);
  const isDriverWorkspace = user?.role === 'driver' || user?.ownerDriverWorkspace === true;

  const loadVehicles = async () => {
    setLoading(true);
    if (!isSupabaseConfigured) { setLoading(false); return; }
    if (!companyId) { setVehicles([]); setLoading(false); return; }
    setAdvertisingStateAvailable(true);
    const selectColumns = 'id, company_id, type, advertising_state, reg_plate, make, model, manufacture_year, payload_kg, has_tail_lift, assigned_driver_id, created_at';
    const legacySelectColumns = 'id, company_id, vehicle_type, advertising_state, reg_plate, make, model, manufacture_year, payload_kg, has_tail_lift, assigned_driver_id, created_at';
    const query = supabase
      .from('vehicles')
      .select(selectColumns)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    let { data, error } = await query;
    if (error && isMissingColumnError(error, 'vehicles', 'advertising_state')) {
      setAdvertisingStateAvailable(false);
      setVehicles([]);
      setError('Vehicle advertising contract is not installed in this environment yet.');
      setLoading(false);
      return;
    }
    if (error && isMissingColumnError(error, 'vehicles', 'type')) {
      const legacyResult = await supabase
        .from('vehicles')
        .select(legacySelectColumns)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      data = ((legacyResult.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
        ...row,
        type: (row.vehicle_type as VehicleType | undefined) ?? 'van_large',
        advertising_state: isAdvertisingState(row.advertising_state) ? row.advertising_state : 'none',
      })) as unknown as Vehicle[];
      error = legacyResult.error;
    }
    // If manufacture_year column not yet present, retry without it
    if (error && isMissingColumnError(error, 'vehicles', 'manufacture_year')) {
      const fallbackResult = await supabase
        .from('vehicles')
        .select('id, company_id, type, advertising_state, reg_plate, make, model, payload_kg, has_tail_lift, assigned_driver_id, created_at')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      data = fallbackResult.data as Vehicle[] | null;
      error = fallbackResult.error;
    }
    if (!error && data) setVehicles(data as Vehicle[]);
    setLoading(false);
  };

  const loadCompanies = async () => {
    if (!isSupabaseConfigured || !companyId) return;
    const { data, error } = await supabase.from('companies').select('id, name').eq('id', companyId).order('name');
    if (error) { console.error('Failed to load companies:', error.message); return; }
    if (data) setCompanies(data as Company[]);
  };

  const loadDrivers = async () => {
    if (!isSupabaseConfigured || !companyId) return;
    let query = supabase
      .from('drivers')
      .select('id, display_name')
      .eq('company_id', companyId)
      .eq('status', 'active')
      .order('display_name');
    let { data, error } = await query;

    if (error && isMissingColumnError(error, 'drivers', 'status')) {
      query = supabase
        .from('drivers')
        .select('id, display_name')
        .eq('company_id', companyId)
        .order('display_name');
      ({ data, error } = await query);
    }

    if (error) {
      console.error('Failed to load vehicle drivers:', error.message);
      return;
    }
    if (data) setDrivers(data as DriverOption[]);
  };

  useEffect(() => {
    if (!companyResolved) return;
    if (!companyId) {
      setVehicles([]);
      setDrivers([]);
      setCompanies([]);
      setLoading(false);
      return;
    }
    loadVehicles();
    loadCompanies();
    loadDrivers();
  }, [companyResolved, companyId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!formData.assigned_driver_id) return;
    if (drivers.some((driver) => driver.id === formData.assigned_driver_id)) return;
    setFormData((prev) => ({ ...prev, assigned_driver_id: '' }));
  }, [drivers, formData.assigned_driver_id]);
  useEffect(() => {
    setVehiclePage(0);
  }, [vehicles.length]);

  const handleCreate = async () => {
    if (!companyId) { setError('Company is required'); return; }
    if (!isSupabaseConfigured) { setError('Supabase is not configured'); return; }
    const payloadKg = formData.payload_kg ? Number.parseFloat(formData.payload_kg) : null;
    if (payloadKg !== null && (!Number.isFinite(payloadKg) || payloadKg < 0)) {
      setError('Payload must be a valid positive number.');
      return;
    }
    setCreating(true);
    try {
      const assignedDriverId = !isDriverWorkspace && drivers.some((driver) => driver.id === formData.assigned_driver_id)
        ? formData.assigned_driver_id
        : '';
      const insertPayload: Record<string, string | number | boolean | null> = {
        ...formData,
        company_id: companyId,
        advertising_state: 'none',
        type: formData.type,
        vehicle_type: formData.type,
        reg_plate: formData.reg_plate.trim() || null,
        // legacy alias used by some production DB builds — kept in sync with reg_plate
        registration: formData.reg_plate.trim() || null,
        make: formData.make.trim() || null,
        model: formData.model.trim() || null,
        manufacture_year: formData.manufacture_year ? parseInt(formData.manufacture_year, 10) : null,
        payload_kg: payloadKg,
        assigned_driver_id: assignedDriverId || null,
      };
      logRuntimeProof({
        flow: 'Add Vehicle',
        authUid: user?.id ?? null,
        membershipId: user?.membershipId ?? null,
        companyId,
        payload: insertPayload,
        table: 'vehicles',
        rlsPolicy: 'vehicles_insert_operator',
      });
      const { error: createError } = await supabase.from('vehicles').insert([insertPayload]);
      if (createError) {
        console.error('[XDrive Vehicles] insert failed', {
          authUid: user?.id ?? null,
          resolvedCompanyId: companyId,
          userRole: user?.role ?? null,
          payloadCompanyId: insertPayload.company_id,
          payloadAssignedDriverId: insertPayload.assigned_driver_id,
          errorCode: createError.code ?? null,
          errorMessage: createError.message,
          errorDetails: createError.details ?? null,
        });
        setError(createError.message ?? 'Failed to create vehicle.');
        return;
      }
      setShowModal(false);
      setFormData({ type: 'van_large', reg_plate: '', make: '', model: '', manufacture_year: '', payload_kg: '', has_tail_lift: false, assigned_driver_id: '' });
      setError('');
      loadVehicles();
    } finally {
      setCreating(false);
    }
  };

  const openEditModal = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setEditData({
      type: vehicle.type,
      reg_plate: vehicle.reg_plate ?? '',
      make: vehicle.make ?? '',
      model: vehicle.model ?? '',
      manufacture_year: vehicle.manufacture_year != null ? String(vehicle.manufacture_year) : '',
      payload_kg: vehicle.payload_kg != null ? String(vehicle.payload_kg) : '',
      has_tail_lift: vehicle.has_tail_lift ?? false,
      assigned_driver_id: vehicle.assigned_driver_id ?? '',
    });
    setEditError('');
  };

  const handleUpdate = async () => {
    if (!editingVehicle || !companyId || !isSupabaseConfigured) return;
    setSaving(true);
    const updatePayload: Record<string, string | number | boolean | null> = {
      type: editData.type,
      vehicle_type: editData.type,
      reg_plate: editData.reg_plate.trim() || null,
      // legacy alias used by some production DB builds — kept in sync with reg_plate
      registration: editData.reg_plate.trim() || null,
      make: editData.make.trim() || null,
      model: editData.model.trim() || null,
      manufacture_year: editData.manufacture_year ? parseInt(editData.manufacture_year, 10) : null,
      payload_kg: editData.payload_kg ? parseFloat(editData.payload_kg) : null,
      has_tail_lift: editData.has_tail_lift,
      assigned_driver_id: isDriverWorkspace ? null : editData.assigned_driver_id || null,
    };
    const { error } = await supabase
      .from('vehicles')
      .update(updatePayload)
      .eq('id', editingVehicle.id)
      .eq('company_id', companyId);
    setSaving(false);
    if (error) { setEditError(error.message ?? 'Failed to update vehicle.'); return; }
    setEditingVehicle(null);
    loadVehicles();
  };

  const handleDelete = async (vehicleId: string) => {
    if (!companyId || !isSupabaseConfigured) return;
    await supabase.from('vehicles').delete().eq('id', vehicleId).eq('company_id', companyId);
    setShowDeleteConfirm(null);
    loadVehicles();
  };

  const handleAdvertisingChange = async (vehicleId: string, nextState: AdvertisingState) => {
    if (!isSupabaseConfigured) return;
    setAdvertisingUpdating((prev) => ({ ...prev, [vehicleId]: true }));
    setAdvertisingFeedback((prev) => {
      const next = { ...prev };
      delete next[vehicleId];
      return next;
    });
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setAdvertisingFeedback((prev) => ({ ...prev, [vehicleId]: { tone: 'error', message: 'Authentication required.' } }));
        return;
      }
      const response = await fetch(`/api/admin/vehicles/${vehicleId}/advertising`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({
          state: nextState,
          reason: `Updated from Vehicles workspace to ${nextState}`,
          metadata: { source: 'admin_vehicles_page', requested_state: nextState },
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; newState?: AdvertisingState };
      if (!response.ok) {
        setAdvertisingFeedback((prev) => ({
          ...prev,
          [vehicleId]: { tone: 'error', message: payload.error ?? 'Unable to persist advertising state.' },
        }));
        return;
      }
      const committedState = payload.newState ?? nextState;
      setVehicles((prev) => prev.map((row) => (row.id === vehicleId ? { ...row, advertising_state: committedState } : row)));
      setAdvertisingFeedback((prev) => ({
        ...prev,
        [vehicleId]: { tone: 'success', message: 'Saved' },
      }));
    } finally {
      setAdvertisingUpdating((prev) => ({ ...prev, [vehicleId]: false }));
    }
  };

  const formatDate = (value: string | null | undefined) => {
    if (!value) return '—';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString();
  };
  const totalVehiclePages = Math.max(1, Math.ceil(vehicles.length / VEHICLES_PER_PAGE));
  const safeVehiclePage = Math.min(vehiclePage, totalVehiclePages - 1);
  const paginatedVehicles = vehicles.slice(
    safeVehiclePage * VEHICLES_PER_PAGE,
    (safeVehiclePage + 1) * VEHICLES_PER_PAGE,
  );

  return (
    <ProtectedRoute>
      <PageFrame>
        <PageHeader
          title={isDriverWorkspace ? 'My Vehicle' : 'Vehicles'}
          description={isDriverWorkspace ? 'Manage your own vehicle details.' : 'Manage fleet vehicles'}
          actions={
            <ActionButton
              tone="primary"
              disabled={!companyResolved || !companyId}
              onClick={() => { setError(''); setShowModal(true); }}
            >
              + Add Vehicle
            </ActionButton>
          }
        />

        {companyError && <AlertBanner tone="warning">{companyError}</AlertBanner>}
        {!isSupabaseConfigured && <AlertBanner tone="warning">⚠️ Supabase is not configured. Database features are disabled.</AlertBanner>}

        {/* Vehicles table — Section 9+10: header 36px; rows 42px; radius 4px */}
        <div className={cssStyles.operationalTableContainer}>
          {!companyResolved || loading ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#5f6368', fontSize: '12px' }}>Loading…</div>
          ) : !companyId ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#5f6368', fontSize: '12px' }}>
              <p style={{ margin: 0 }}>Company profile not available. Vehicles are hidden until company access resolves.</p>
            </div>
          ) : vehicles.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#5f6368', fontSize: '12px' }}>
              <p style={{ margin: 0 }}>No vehicles yet. Add your first vehicle.</p>
            </div>
          ) : (
            <>
              <div className={cssStyles.operationalTableScroll}>
                <table className={cssStyles.operationalTable} style={{ minWidth: '1120px' }}>
                  <caption className={cssStyles.operationalTableCaption}>Fleet vehicles</caption>
                  <thead>
                    <tr className={cssStyles.operationalTableHeaderRow}>
                      {['Reg Plate', 'Type', 'Make / Model', 'Year', 'Payload (kg)', 'Tail Lift', ...(isDriverWorkspace ? [] : ['Assigned Driver']), 'Advertise', 'Created', 'Actions'].map(h => (
                        <th key={h} scope="col" className={cssStyles.operationalTableHeadCell}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedVehicles.map((v) => {
                      const assignedDriver = drivers.find(d => d.id === v.assigned_driver_id);
                      const currentAdvertisingState = (v.advertising_state ?? 'none') as AdvertisingState;
                      const feedback = advertisingFeedback[v.id];
                      const updating = Boolean(advertisingUpdating[v.id]);
                      return (
                        <tr key={v.id} className={`${cssStyles.operationalTableRow} xdrive-table-row`}>
                          <td className={cssStyles.operationalTableCell} style={{ fontWeight: 600 }}>{v.reg_plate || '—'}</td>
                          <td className={cssStyles.operationalTableCell}>{v.type.replace(/_/g, ' ')}</td>
                          <td className={cssStyles.operationalTableCell}>{[v.make, v.model].filter(Boolean).join(' ') || '—'}</td>
                          <td className={cssStyles.operationalTableCell}>{v.manufacture_year ?? '—'}</td>
                          <td className={cssStyles.operationalTableCell}>{v.payload_kg ?? '—'}</td>
                          <td className={cssStyles.operationalTableCell}>{v.has_tail_lift ? '✅' : '—'}</td>
                          {!isDriverWorkspace && <td className={cssStyles.operationalTableCell}>{assignedDriver?.display_name ?? '—'}</td>}
                          <td className={cssStyles.operationalTableCell}>
                            <select
                              value={currentAdvertisingState}
                              onChange={(e) => { void handleAdvertisingChange(v.id, e.target.value as AdvertisingState); }}
                              disabled={!advertisingStateAvailable || updating}
                              className={cssStyles.settingsInput}
                              style={{ width: 'auto', opacity: !advertisingStateAvailable || updating ? 0.7 : 1 }}
                            >
                              <option value="none">Not advertised</option>
                              <option value="exchange">General Exchange</option>
                              <option value="partner">Partner Only</option>
                            </select>
                            {updating && <div style={{ fontSize: '11px', color: '#5f6368', marginTop: '2px' }}>Saving…</div>}
                            {feedback && (
                              <div style={{ fontSize: '11px', color: feedback.tone === 'error' ? '#b91c1c' : '#166534', marginTop: '2px' }}>
                                {feedback.message}
                              </div>
                            )}
                          </td>
                          <td className={cssStyles.operationalTableCell}>{formatDate(v.created_at)}</td>
                          <td className={`${cssStyles.operationalTableCell} ${cssStyles.operationalTableActionCell}`}>
                            <div style={{ display: 'inline-flex', gap: '4px' }}>
                              <ActionButton tone="secondary" onClick={() => openEditModal(v)}>Edit</ActionButton>
                              <ActionButton tone="danger" onClick={() => setShowDeleteConfirm(v.id)}>Delete</ActionButton>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {vehicles.length > VEHICLES_PER_PAGE && (
                <div className={cssStyles.operationalTableMeta}>
                  <span>
                    Showing {safeVehiclePage * VEHICLES_PER_PAGE + 1}–{Math.min((safeVehiclePage + 1) * VEHICLES_PER_PAGE, vehicles.length)} of {vehicles.length}
                  </span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <ActionButton tone="secondary" disabled={safeVehiclePage === 0} onClick={() => setVehiclePage((prev) => Math.max(prev - 1, 0))}>
                      Previous
                    </ActionButton>
                    <ActionButton tone="secondary" disabled={safeVehiclePage >= totalVehiclePages - 1} onClick={() => setVehiclePage((prev) => Math.min(prev + 1, totalVehiclePages - 1))}>
                      Next
                    </ActionButton>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Create Modal */}
        {showModal && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
            <div style={{ backgroundColor: 'white', borderRadius: '4px', border: '1px solid #d9e2ec', width: '90%', maxWidth: '500px', maxHeight: '90vh', overflow: 'auto' }}>
              <div style={{ padding: '10px 16px', borderBottom: '1px solid #d9e2ec', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '40px' }}>
                <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#202124' }}>Add Vehicle</h2>
                <button type="button" onClick={() => { setShowModal(false); setError(''); }} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#5f6368', lineHeight: 1, padding: '0 4px' }} aria-label="Close">×</button>
              </div>
              <div style={{ padding: '12px 16px', display: 'grid', gap: '8px' }}>
                {error && <AlertBanner tone="danger">{error}</AlertBanner>}
                <div className={cssStyles.settingsFieldRow}>
                  <label className={cssStyles.settingsLabel}>Company *</label>
                  <input className={`${cssStyles.settingsInput} ${cssStyles.settingsInputReadonly}`} value={companies[0]?.name ?? 'Company linked to your account'} disabled readOnly />
                </div>
                <div className={cssStyles.settingsFieldRow}>
                  <label className={cssStyles.settingsLabel}>Vehicle Type *</label>
                  <select className={cssStyles.settingsInput} value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as VehicleType})}>
                    {VEHICLE_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div className={cssStyles.settingsFieldRow}>
                  <label className={cssStyles.settingsLabel}>Reg Plate</label>
                  <input className={cssStyles.settingsInput} value={formData.reg_plate} onChange={e => setFormData({...formData, reg_plate: e.target.value})} placeholder="AB12 CDE" />
                </div>
                <div className={cssStyles.settingsFieldGrid}>
                  <div>
                    <label className={cssStyles.settingsLabel}>Make</label>
                    <input className={cssStyles.settingsInput} value={formData.make} onChange={e => setFormData({...formData, make: e.target.value})} placeholder="Ford" />
                  </div>
                  <div>
                    <label className={cssStyles.settingsLabel}>Model</label>
                    <input className={cssStyles.settingsInput} value={formData.model} onChange={e => setFormData({...formData, model: e.target.value})} placeholder="Transit" />
                  </div>
                  <div>
                    <label className={cssStyles.settingsLabel}>Year</label>
                    <input type="number" min="1900" max="2100" className={cssStyles.settingsInput} value={formData.manufacture_year} onChange={e => setFormData({...formData, manufacture_year: e.target.value})} placeholder="2020" />
                  </div>
                </div>
                <div className={cssStyles.settingsFieldRow}>
                  <label className={cssStyles.settingsLabel}>Payload (kg)</label>
                  <input type="number" className={cssStyles.settingsInput} value={formData.payload_kg} onChange={e => setFormData({...formData, payload_kg: e.target.value})} placeholder="1000" />
                </div>
                {!isDriverWorkspace && (
                  <div className={cssStyles.settingsFieldRow}>
                    <label className={cssStyles.settingsLabel}>Assign Driver</label>
                    <select className={cssStyles.settingsInput} value={formData.assigned_driver_id} onChange={e => setFormData({...formData, assigned_driver_id: e.target.value})}>
                      <option value="">— Unassigned —</option>
                      {drivers.map(d => <option key={d.id} value={d.id}>{d.display_name}</option>)}
                    </select>
                  </div>
                )}
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', color: '#202124' }}>
                  <input type="checkbox" checked={formData.has_tail_lift} onChange={e => setFormData({...formData, has_tail_lift: e.target.checked})} style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#1D57D8' }} />
                  Has Tail Lift
                </label>
              </div>
              <div style={{ padding: '8px 16px', borderTop: '1px solid #d9e2ec', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <ActionButton tone="secondary" onClick={() => { setShowModal(false); setError(''); }}>Cancel</ActionButton>
                <ActionButton tone="primary" disabled={creating} onClick={handleCreate}>{creating ? 'Adding…' : 'Add Vehicle'}</ActionButton>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {editingVehicle && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
            <div style={{ backgroundColor: 'white', borderRadius: '4px', border: '1px solid #d9e2ec', width: '90%', maxWidth: '500px', maxHeight: '90vh', overflow: 'auto' }}>
              <div style={{ padding: '10px 16px', borderBottom: '1px solid #d9e2ec', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '40px' }}>
                <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#202124' }}>Edit Vehicle</h2>
                <button type="button" onClick={() => setEditingVehicle(null)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#5f6368', lineHeight: 1, padding: '0 4px' }} aria-label="Close">×</button>
              </div>
              <div style={{ padding: '12px 16px', display: 'grid', gap: '8px' }}>
                {editError && <AlertBanner tone="danger">{editError}</AlertBanner>}
                <div className={cssStyles.settingsFieldRow}>
                  <label className={cssStyles.settingsLabel}>Vehicle Type *</label>
                  <select className={cssStyles.settingsInput} value={editData.type} onChange={e => setEditData({...editData, type: e.target.value as VehicleType})}>
                    {VEHICLE_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div className={cssStyles.settingsFieldRow}>
                  <label className={cssStyles.settingsLabel}>Reg Plate</label>
                  <input className={cssStyles.settingsInput} value={editData.reg_plate} onChange={e => setEditData({...editData, reg_plate: e.target.value})} />
                </div>
                <div className={cssStyles.settingsFieldGrid}>
                  <div>
                    <label className={cssStyles.settingsLabel}>Make</label>
                    <input className={cssStyles.settingsInput} value={editData.make} onChange={e => setEditData({...editData, make: e.target.value})} />
                  </div>
                  <div>
                    <label className={cssStyles.settingsLabel}>Model</label>
                    <input className={cssStyles.settingsInput} value={editData.model} onChange={e => setEditData({...editData, model: e.target.value})} />
                  </div>
                  <div>
                    <label className={cssStyles.settingsLabel}>Year</label>
                    <input type="number" min="1900" max="2100" className={cssStyles.settingsInput} value={editData.manufacture_year} onChange={e => setEditData({...editData, manufacture_year: e.target.value})} placeholder="2020" />
                  </div>
                </div>
                <div className={cssStyles.settingsFieldRow}>
                  <label className={cssStyles.settingsLabel}>Payload (kg)</label>
                  <input type="number" className={cssStyles.settingsInput} value={editData.payload_kg} onChange={e => setEditData({...editData, payload_kg: e.target.value})} />
                </div>
                {!isDriverWorkspace && (
                  <div className={cssStyles.settingsFieldRow}>
                    <label className={cssStyles.settingsLabel}>Assign Driver</label>
                    <select className={cssStyles.settingsInput} value={editData.assigned_driver_id} onChange={e => setEditData({...editData, assigned_driver_id: e.target.value})}>
                      <option value="">— Unassigned —</option>
                      {drivers.map(d => <option key={d.id} value={d.id}>{d.display_name}</option>)}
                    </select>
                  </div>
                )}
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', color: '#202124' }}>
                  <input type="checkbox" checked={editData.has_tail_lift} onChange={e => setEditData({...editData, has_tail_lift: e.target.checked})} style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#1D57D8' }} />
                  Has Tail Lift
                </label>
              </div>
              <div style={{ padding: '8px 16px', borderTop: '1px solid #d9e2ec', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <ActionButton tone="secondary" disabled={saving} onClick={() => setEditingVehicle(null)}>Cancel</ActionButton>
                <ActionButton tone="primary" disabled={saving} onClick={handleUpdate}>{saving ? 'Saving…' : 'Save Changes'}</ActionButton>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirm */}
        {showDeleteConfirm && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
            <div style={{ backgroundColor: 'white', borderRadius: '4px', border: '1px solid #d9e2ec', padding: '20px', maxWidth: '400px', width: '90%', textAlign: 'center' }}>
              <p style={{ fontSize: '14px', fontWeight: 700, color: '#202124', margin: '0 0 4px' }}>Delete Vehicle?</p>
              <p style={{ color: '#5f6368', fontSize: '12px', margin: '0 0 12px' }}>This action cannot be undone.</p>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                <ActionButton tone="secondary" onClick={() => setShowDeleteConfirm(null)}>Cancel</ActionButton>
                <ActionButton tone="danger" onClick={() => handleDelete(showDeleteConfirm)}>Delete</ActionButton>
              </div>
            </div>
          </div>
        )}
      </PageFrame>
    </ProtectedRoute>
  );
}
