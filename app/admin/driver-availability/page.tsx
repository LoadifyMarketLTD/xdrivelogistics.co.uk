'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useCompanyWorkspaceData } from '../../components/workspace/useCompanyWorkspaceData';
import {
  ActionButton,
  EmptyState,
  PageFrame,
  PageHeader,
  StatusBadge,
} from '../../components/workspace/WorkspaceUI';

type AvailabilityTab = 'all' | 'available' | 'busy' | 'offline';

const normalizedAvailability = (value: string | null | undefined) => {
  const status = String(value || 'offline').toLowerCase();
  if (status === 'available') return 'available';
  if (['busy', 'on_job', 'on a job'].includes(status)) return 'busy';
  return 'offline';
};

export default function DriverAvailabilityPage() {
  const router = useRouter();
  const data = useCompanyWorkspaceData();
  const [tab, setTab] = useState<AvailabilityTab>('all');
  const [name, setName] = useState('');

  const rows = useMemo(() => {
    const term = name.trim().toLowerCase();
    return data.drivers
      .filter((driver) => tab === 'all' || normalizedAvailability(driver.availability_status) === tab)
      .filter((driver) => !term || `${driver.display_name || ''} ${driver.email || ''} ${driver.phone || ''}`.toLowerCase().includes(term));
  }, [data.drivers, name, tab]);

  const counts = useMemo(() => ({
    all: data.drivers.length,
    available: data.drivers.filter((driver) => normalizedAvailability(driver.availability_status) === 'available').length,
    busy: data.drivers.filter((driver) => normalizedAvailability(driver.availability_status) === 'busy').length,
    offline: data.drivers.filter((driver) => normalizedAvailability(driver.availability_status) === 'offline').length,
  }), [data.drivers]);

  const tabs: Array<{ id: AvailabilityTab; label: string; count: number }> = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'available', label: 'Available', count: counts.available },
    { id: 'busy', label: 'On Job / Busy', count: counts.busy },
    { id: 'offline', label: 'Offline', count: counts.offline },
  ];

  return (
    <ProtectedRoute allowedRoles={['owner', 'company_admin', 'company_staff']}>
      <PageFrame>
        <PageHeader
          eyebrow="Fleet resources"
          title="Availability"
          description="Scan current driver availability flags and recorded account status from one compact fleet register. Full operational eligibility is verified only by the canonical server contract when required."
          actions={<ActionButton tone="secondary" onClick={() => void data.refresh()}>Refresh</ActionButton>}
        />

        <div className="workspace-board-layout">
          <aside className="workspace-filter-rail" aria-label="Driver availability filters">
            <div className="workspace-filter-rail__header">Search Drivers</div>
            <div className="workspace-filter-rail__body">
              <label>
                DRIVER
                <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Name / email / phone" />
              </label>
              <ActionButton tone="secondary" onClick={() => setName('')}>Clear</ActionButton>
            </div>
          </aside>

          <main style={{ minWidth: 0 }}>
            <div className="workspace-tab-strip" style={{ display: 'flex', overflowX: 'auto', marginBottom: 4 }}>
              {tabs.map((item) => (
                <button key={item.id} type="button" data-active={tab === item.id ? 'true' : 'false'} onClick={() => setTab(item.id)}>
                  {item.label} {item.count}
                </button>
              ))}
            </div>

            {rows.length === 0 ? (
              <div className="workspace-panel" style={{ border: '1px solid var(--ws-border)', background: '#fff' }}>
                <EmptyState compact title="No matching drivers" description="Adjust the filter or review the company driver roster." />
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Driver</th>
                      <th>Phone</th>
                      <th>Account</th>
                      <th>Availability</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((driver) => {
                      const availability = normalizedAvailability(driver.availability_status);
                      return (
                        <tr key={driver.id}>
                          <td><strong>{driver.display_name || driver.email || 'Driver'}</strong></td>
                          <td>{driver.phone || 'Not recorded'}</td>
                          <td><StatusBadge value={driver.status || 'unknown'} /></td>
                          <td>
                            <StatusBadge
                              value={availability}
                              tone={availability === 'available' ? 'green' : availability === 'busy' ? 'orange' : 'grey'}
                            />
                          </td>
                          <td><ActionButton tone="secondary" onClick={() => router.push('/admin/drivers')}>Manage</ActionButton></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </main>
        </div>
      </PageFrame>
    </ProtectedRoute>
  );
}
