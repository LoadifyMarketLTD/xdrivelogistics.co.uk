'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import type { Vehicle, VehicleType, Company } from '../../../lib/types/database';
import { isMissingColumnError } from '../../../lib/supabaseSchemaCompat';
import { logRuntimeProof } from '../../../lib/runtimeProof';
import { useAdminCompanyContext } from '../_hooks/useAdminCompanyContext';
import { PageFrame, PageHeader } from '../../components/workspace/WorkspaceUI';

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

  const inputStyle = { width: '100%', height: '32px', padding: '0 8px', border: '1px solid #d9e2ec', borderRadius: '4px', fontSize: '13px', boxSizing: 'border-box' as const, backgroundColor: 'white' };
  const labelStyle = { display: 'block', fontSize: '12px', fontWeight: '600' as const, color: '#5f6368', marginBottom: '4px' };
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
            <button onClick={() => { setError(''); setShowModal(true); }} disabled={!companyResolved || !companyId} style={{ height: '32px', padding: '0 16px', backgroundColor: !companyResolved || !companyId ? '#9ca3af' : '#1d57d8', color: 'white', border: 'none', borderRadius: '4px', fontSize: '13px', fontWeight: 600, cursor: !companyResolved || !companyId ? 'not-allowed' : 'pointer' }}>
              + Add Vehicle
            </button>
          }
        />

        {companyError && (
          <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '4px', padding: '8px 12px', marginBottom: '8px', color: '#92400e', fontSize: '13px' }}>
            {companyError}
          </div>
        )}

        {!isSupabaseConfigured && (
          <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '4px', padding: '8px 12px', marginBottom: '8px', color: '#92400e', fontSize: '13px' }}>
            ⚠️ Supabase is not configured. Database features are disabled.
          </div>
        )}

        <div style={{ backgroundColor: 'white', borderRadius: '4px', border: '1px solid #d9e2ec', overflow: 'hidden' }}>
            {!companyResolved || loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#5f6368', fontSize: '13px' }}>Loading...</div>
            ) : !companyId ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#5f6368', fontSize: '13px' }}>
                <p>Company profile not available. Vehicles are hidden until company access resolves.</p>
              </div>
            ) : vehicles.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#5f6368', fontSize: '13px' }}>
                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🚛</div>
                <p>No vehicles yet. Add your first vehicle.</p>
              </div>
            ) : (
              <>
              <div style={{ overflowX: 'auto', width: '100%' }}>
                <table style={{ width: '100%', minWidth: '1120px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f5f7fa', borderBottom: '1px solid #d9e2ec' }}>
                      {['Reg Plate', 'Type', 'Make / Model', 'Year', 'Payload (kg)', 'Tail Lift', ...(isDriverWorkspace ? [] : ['Assigned Driver']), 'Advertise', 'Created', 'Actions'].map(h => (
                        <th key={h} style={{ height: '36px', padding: '0 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#5f6368', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedVehicles.map((v, i) => {
                      const assignedDriver = drivers.find(d => d.id === v.assigned_driver_id);
                      const currentAdvertisingState = (v.advertising_state ?? 'none') as AdvertisingState;
                      const feedback = advertisingFeedback[v.id];
                      const updating = Boolean(advertisingUpdating[v.id]);
                      return (
                        <tr key={v.id} style={{ height: '40px', borderBottom: i < paginatedVehicles.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                          <td style={{ padding: '0 12px', fontWeight: 600, color: '#202124', fontSize: '13px' }}>{v.reg_plate || '—'}</td>
                          <td style={{ padding: '0 12px', color: '#5f6368', fontSize: '13px' }}>{v.type.replace(/_/g, ' ')}</td>
                          <td style={{ padding: '0 12px', color: '#5f6368', fontSize: '13px' }}>{[v.make, v.model].filter(Boolean).join(' ') || '—'}</td>
                          <td style={{ padding: '0 12px', color: '#5f6368', fontSize: '13px' }}>{v.manufacture_year ?? '—'}</td>
                          <td style={{ padding: '0 12px', color: '#5f6368', fontSize: '13px' }}>{v.payload_kg ?? '—'}</td>
                          <td style={{ padding: '0 12px', fontSize: '13px' }}>{v.has_tail_lift ? '✅' : '—'}</td>
                          {!isDriverWorkspace && <td style={{ padding: '0 12px', color: '#5f6368', fontSize: '13px' }}>{assignedDriver?.display_name ?? '—'}</td>}
                          <td style={{ padding: '0 12px' }}>
                            <select
                              value={currentAdvertisingState}
                              onChange={(e) => { void handleAdvertisingChange(v.id, e.target.value as AdvertisingState); }}
                              disabled={!advertisingStateAvailable || updating}
                              style={{ border: '1px solid #d9e2ec', borderRadius: '4px', padding: '3px 8px', fontSize: '12px', background: currentAdvertisingState === 'exchange' ? '#dcfce7' : currentAdvertisingState === 'partner' ? '#eff6ff' : '#f5f7fa', color: currentAdvertisingState === 'exchange' ? '#166534' : currentAdvertisingState === 'partner' ? '#1e40af' : '#5f6368', cursor: !advertisingStateAvailable || updating ? 'not-allowed' : 'pointer', opacity: !advertisingStateAvailable || updating ? 0.7 : 1 }}
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
                          <td style={{ padding: '0 12px', color: '#5f6368', fontSize: '12px' }}>{formatDate(v.created_at)}</td>
                          <td style={{ padding: '0 12px' }}>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button
                                onClick={() => openEditModal(v)}
                                style={{ height: '26px', padding: '0 8px', backgroundColor: '#e0f2fe', color: '#075985', border: 'none', borderRadius: '4px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => setShowDeleteConfirm(v.id)}
                                style={{ height: '26px', padding: '0 8px', backgroundColor: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '4px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {vehicles.length > VEHICLES_PER_PAGE && (
                <div style={{ borderTop: '1px solid #d9e2ec', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#5f6368' }}>
                  <span>
                    Showing {safeVehiclePage * VEHICLES_PER_PAGE + 1}–{Math.min((safeVehiclePage + 1) * VEHICLES_PER_PAGE, vehicles.length)} of {vehicles.length}
                  </span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      onClick={() => setVehiclePage((prev) => Math.max(prev - 1, 0))}
                      disabled={safeVehiclePage === 0}
                      style={{ height: '28px', padding: '0 10px', border: '1px solid #d9e2ec', borderRadius: '4px', backgroundColor: safeVehiclePage === 0 ? '#f5f7fa' : '#fff', cursor: safeVehiclePage === 0 ? 'not-allowed' : 'pointer', fontSize: '12px' }}
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setVehiclePage((prev) => Math.min(prev + 1, totalVehiclePages - 1))}
                      disabled={safeVehiclePage >= totalVehiclePages - 1}
                      style={{ height: '28px', padding: '0 10px', border: '1px solid #d9e2ec', borderRadius: '4px', backgroundColor: safeVehiclePage >= totalVehiclePages - 1 ? '#f5f7fa' : '#fff', cursor: safeVehiclePage >= totalVehiclePages - 1 ? 'not-allowed' : 'pointer', fontSize: '12px' }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
              </>
            )}
          </div>

        {/* Create Modal */}
        {showModal && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ backgroundColor: 'white', borderRadius: '4px', border: '1px solid #d9e2ec', width: '90%', maxWidth: '500px', maxHeight: '90vh', overflow: 'auto' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #d9e2ec', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#202124', lineHeight: '22px' }}>Add Vehicle</h2>
                <button onClick={() => { setShowModal(false); setError(''); }} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#5f6368', lineHeight: 1 }}>×</button>
              </div>
              <div style={{ padding: '16px', display: 'grid', gap: '8px' }}>
                {error && <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '4px', padding: '8px 12px', color: '#dc2626', fontSize: '13px' }}>{error}</div>}
                <div>
                  <label style={labelStyle}>Company *</label>
                  <input
                    style={{ ...inputStyle, backgroundColor: '#f5f7fa', color: '#5f6368' }}
                    value={companies[0]?.name ?? 'Company linked to your account'}
                    disabled
                    readOnly
                  />
                </div>
                <div>
                  <label style={labelStyle}>Vehicle Type *</label>
                  <select style={inputStyle} value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as VehicleType})}>
                    {VEHICLE_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div><label style={labelStyle}>Reg Plate</label><input style={inputStyle} value={formData.reg_plate} onChange={e => setFormData({...formData, reg_plate: e.target.value})} placeholder="AB12 CDE" /></div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px' }}>
                  <div><label style={labelStyle}>Make</label><input style={inputStyle} value={formData.make} onChange={e => setFormData({...formData, make: e.target.value})} placeholder="Ford" /></div>
                  <div><label style={labelStyle}>Model</label><input style={inputStyle} value={formData.model} onChange={e => setFormData({...formData, model: e.target.value})} placeholder="Transit" /></div>
                  <div><label style={labelStyle}>Year</label><input style={inputStyle} type="number" min="1900" max="2100" value={formData.manufacture_year} onChange={e => setFormData({...formData, manufacture_year: e.target.value})} placeholder="2020" /></div>
                </div>
                <div><label style={labelStyle}>Payload (kg)</label><input style={inputStyle} type="number" value={formData.payload_kg} onChange={e => setFormData({...formData, payload_kg: e.target.value})} placeholder="1000" /></div>
                {!isDriverWorkspace && (
                  <div>
                    <label style={labelStyle}>Assign Driver</label>
                    <select style={inputStyle} value={formData.assigned_driver_id} onChange={e => setFormData({...formData, assigned_driver_id: e.target.value})}>
                      <option value="">— Unassigned —</option>
                      {drivers.map(d => <option key={d.id} value={d.id}>{d.display_name}</option>)}
                    </select>
                  </div>
                )}
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', color: '#202124' }}>
                  <input type="checkbox" checked={formData.has_tail_lift} onChange={e => setFormData({...formData, has_tail_lift: e.target.checked})} />
                  Has Tail Lift
                </label>
              </div>
              <div style={{ padding: '12px 16px', borderTop: '1px solid #d9e2ec', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button onClick={() => { setShowModal(false); setError(''); }} style={{ height: '32px', padding: '0 16px', backgroundColor: 'white', color: '#202124', border: '1px solid #d9e2ec', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
                <button onClick={handleCreate} disabled={creating} style={{ height: '32px', padding: '0 16px', backgroundColor: creating ? '#9ca3af' : '#1d57d8', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 600, cursor: creating ? 'not-allowed' : 'pointer', fontSize: '13px' }}>{creating ? 'Adding...' : 'Add Vehicle'}</button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {editingVehicle && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ backgroundColor: 'white', borderRadius: '4px', border: '1px solid #d9e2ec', width: '90%', maxWidth: '500px', maxHeight: '90vh', overflow: 'auto' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #d9e2ec', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#202124', lineHeight: '22px' }}>Edit Vehicle</h2>
                <button onClick={() => setEditingVehicle(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#5f6368', lineHeight: 1 }}>×</button>
              </div>
              <div style={{ padding: '16px', display: 'grid', gap: '8px' }}>
                {editError && <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '4px', padding: '8px 12px', color: '#dc2626', fontSize: '13px' }}>{editError}</div>}
                <div>
                  <label style={labelStyle}>Vehicle Type *</label>
                  <select style={inputStyle} value={editData.type} onChange={e => setEditData({...editData, type: e.target.value as VehicleType})}>
                    {VEHICLE_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div><label style={labelStyle}>Reg Plate</label><input style={inputStyle} value={editData.reg_plate} onChange={e => setEditData({...editData, reg_plate: e.target.value})} /></div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px' }}>
                  <div><label style={labelStyle}>Make</label><input style={inputStyle} value={editData.make} onChange={e => setEditData({...editData, make: e.target.value})} /></div>
                  <div><label style={labelStyle}>Model</label><input style={inputStyle} value={editData.model} onChange={e => setEditData({...editData, model: e.target.value})} /></div>
                  <div><label style={labelStyle}>Year</label><input style={inputStyle} type="number" min="1900" max="2100" value={editData.manufacture_year} onChange={e => setEditData({...editData, manufacture_year: e.target.value})} placeholder="2020" /></div>
                </div>
                <div><label style={labelStyle}>Payload (kg)</label><input style={inputStyle} type="number" value={editData.payload_kg} onChange={e => setEditData({...editData, payload_kg: e.target.value})} /></div>
                {!isDriverWorkspace && (
                  <div>
                    <label style={labelStyle}>Assign Driver</label>
                    <select style={inputStyle} value={editData.assigned_driver_id} onChange={e => setEditData({...editData, assigned_driver_id: e.target.value})}>
                      <option value="">— Unassigned —</option>
                      {drivers.map(d => <option key={d.id} value={d.id}>{d.display_name}</option>)}
                    </select>
                  </div>
                )}
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', color: '#202124' }}>
                  <input type="checkbox" checked={editData.has_tail_lift} onChange={e => setEditData({...editData, has_tail_lift: e.target.checked})} />
                  Has Tail Lift
                </label>
              </div>
              <div style={{ padding: '12px 16px', borderTop: '1px solid #d9e2ec', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button onClick={() => setEditingVehicle(null)} disabled={saving} style={{ height: '32px', padding: '0 16px', backgroundColor: 'white', color: '#202124', border: '1px solid #d9e2ec', borderRadius: '4px', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '13px' }}>Cancel</button>
                <button onClick={handleUpdate} disabled={saving} style={{ height: '32px', padding: '0 16px', backgroundColor: '#1d57d8', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontSize: '13px' }}>{saving ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirm */}
        {showDeleteConfirm && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ backgroundColor: 'white', borderRadius: '4px', border: '1px solid #d9e2ec', padding: '24px', maxWidth: '400px', width: '90%', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '12px' }}>⚠️</div>
              <h3 style={{ color: '#202124', marginBottom: '8px', fontSize: '16px', fontWeight: 600 }}>Delete Vehicle?</h3>
              <p style={{ color: '#5f6368', marginBottom: '16px', fontSize: '13px' }}>This action cannot be undone.</p>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                <button onClick={() => setShowDeleteConfirm(null)} style={{ height: '32px', padding: '0 16px', backgroundColor: 'white', color: '#202124', border: '1px solid #d9e2ec', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
                <button onClick={() => handleDelete(showDeleteConfirm)} style={{ height: '32px', padding: '0 16px', backgroundColor: '#d93025', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}>Delete</button>
              </div>
            </div>
          </div>
        )}
      </PageFrame>
    </ProtectedRoute>
  );
}
