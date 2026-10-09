'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCompanyWorkspaceData } from '../../../components/workspace/useCompanyWorkspaceData';
import { supabase } from '../../../../lib/supabaseClient';
import { ActionButton, AlertBanner, DataTable, EmptyState, PageFrame, PageHeader, Panel, StatusBadge } from '../../../components/workspace/WorkspaceUI';

const when = (value: string | null | undefined) => value
  ? new Date(value).toLocaleDateString('en-GB')
  : 'Not supplied';

export default function FleetCompliancePage() {
  const router = useRouter();
  const data = useCompanyWorkspaceData();
  const [reminderWorking, setReminderWorking] = useState(false);
  const [reminderMessage, setReminderMessage] = useState('');
  const driverById = useMemo(() => new Map(data.drivers.map((driver) => [driver.id, driver])), [data.drivers]);
  const vehicleById = useMemo(() => new Map(data.vehicles.map((vehicle) => [vehicle.id, vehicle])), [data.vehicles]);

  const rows = [
    ...data.driverDocuments.map((document) => ({
      id: document.id,
      entity: document.driver_id
        ? (driverById.get(document.driver_id)?.display_name ?? driverById.get(document.driver_id)?.email ?? 'Driver')
        : 'Driver',
      document: (document.doc_type ?? 'Driver document').replace(/_/g, ' '),
      expiry: document.expiry_date,
      status: document.status ?? 'recorded',
      href: '/admin/documents?type=driver',
    })),
    ...data.vehicleDocuments.map((document) => {
      const vehicle = document.vehicle_id ? vehicleById.get(document.vehicle_id) : undefined;
      return {
        id: document.id,
        entity: vehicle ? (vehicle.reg_plate ?? ([vehicle.make, vehicle.model].filter(Boolean).join(' ') || 'Vehicle')) : 'Vehicle',
        document: (document.doc_type ?? 'Vehicle document').replace(/_/g, ' '),
        expiry: document.expiry_date,
        status: document.status ?? 'recorded',
        href: '/admin/documents?type=vehicle',
      };
    }),
  ];

  const sendDocumentReminders = async () => {
    if (!data.companyId || reminderWorking) return;
    setReminderWorking(true);
    setReminderMessage('');
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setReminderMessage('Your session has expired. Sign in again.');
      setReminderWorking(false);
      return;
    }
    const response = await fetch('/api/admin/fleet/document-reminders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId: data.companyId, daysAhead: 30 }),
    });
    const payload = await response.json().catch(() => ({})) as { error?: string; message?: string };
    setReminderMessage(response.ok ? (payload.message ?? 'Document reminders checked.') : (payload.error ?? 'Document reminders could not be queued.'));
    setReminderWorking(false);
  };

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Fleet readiness"
        title="Compliance"
        description="Driver and vehicle document status in one dense operational register."
        actions={<><ActionButton tone="secondary" disabled={reminderWorking || !data.companyId} onClick={() => void sendDocumentReminders()}>{reminderWorking ? 'Checking…' : 'Send due reminders'}</ActionButton><ActionButton tone="secondary" onClick={() => router.push('/admin/documents')}>Manage documents</ActionButton></>}
      />
      {reminderMessage ? <AlertBanner tone="info">{reminderMessage}</AlertBanner> : null}
      <Panel title="Compliance register">
        <DataTable
          columns={['Driver / Vehicle', 'Document', 'Expiry', 'Status', 'Action']}
          rows={rows.map((row) => [
            <strong key="entity">{row.entity}</strong>,
            row.document,
            when(row.expiry),
            <StatusBadge key="status" value={row.status} />,
            <ActionButton key="action" tone="secondary" onClick={() => router.push(row.href)}>Review</ActionButton>,
          ])}
          empty={<EmptyState title="No Fleet compliance documents recorded" />}
        />
      </Panel>
    </PageFrame>
  );
}
