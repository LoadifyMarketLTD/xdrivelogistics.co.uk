'use client';

import { ChangeEvent, useMemo, useState } from 'react';
import { useAuth } from '../AuthContext';
import { resolveActiveCompanyId } from '../../../lib/activeCompany';
import { downloadXlsx, readXlsxSheetRows } from '../../../lib/spreadsheetExport';
import { supabase } from '../../../lib/supabaseClient';
import {
  ActionButton,
  AlertBanner,
  DataTable,
  EmptyState,
  KpiCard,
  KpiGrid,
  PageFrame,
  PageHeader,
  Panel,
  StatusBadge,
} from './WorkspaceUI';

type ImportMode = 'customer' | 'admin';

type BookingRow = {
  rowNumber: number;
  pickupDate: string;
  pickupTime: string;
  pickupAddress: string;
  pickupPostcode: string;
  deliveryDate: string;
  deliveryTime: string;
  deliveryAddress: string;
  deliveryPostcode: string;
  vehicle: string;
  cargo: string;
  weightKg: number | null;
  pallets: number | null;
  customerName: string;
  customerReference: string;
  bookingReference: string;
  customerPrice: number | null;
  tailLift: boolean;
  forklift: boolean;
  handball: boolean;
  notes: string;
  errors: string[];
  status: 'ready' | 'created' | 'failed';
  result?: string;
};

const HEADERS = [
  'Pickup Date',
  'Pickup Time',
  'Pickup Address',
  'Pickup Postcode',
  'Delivery Date',
  'Delivery Time',
  'Delivery Address',
  'Delivery Postcode',
  'Vehicle',
  'Cargo',
  'Weight KG',
  'Pallets',
  'Customer Name',
  'Customer Reference',
  'Booking Reference',
  'Customer Price GBP',
  'Tail Lift',
  'Forklift',
  'Handball',
  'Notes',
] as const;

const REQUIRED = new Set([
  'Pickup Date',
  'Pickup Time',
  'Pickup Address',
  'Pickup Postcode',
  'Delivery Address',
  'Delivery Postcode',
  'Vehicle',
  'Cargo',
]);

const normalise = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
const postcode = (value: string) => {
  const compact = value.toUpperCase().replace(/\s+/g, '');
  return compact.length > 3 ? `${compact.slice(0, -3)} ${compact.slice(-3)}` : compact;
};
const isPostcode = (value: string) =>
  /^(GIR 0AA|(?:[A-Z]{1,2}\d[A-Z\d]?|[A-Z]{1,2}\d{1,2}) \d[A-Z]{2})$/i.test(postcode(value));

const bool = (value: string) => ['yes', 'y', 'true', '1', 'required'].includes(value.trim().toLowerCase());
const numeric = (value: string, integer = false) => {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(/,/g, ''));
  if (!Number.isFinite(parsed) || parsed < 0 || (integer && !Number.isInteger(parsed))) return Number.NaN;
  return parsed;
};
const isoDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
const quarterHour = (value: string) => /^(?:[01]\d|2[0-3]):(?:00|15|30|45)$/.test(value.trim());

const templateSheets = () => [
  {
    name: 'Instructions',
    title: 'XDrive Bulk Booking Import',
    subtitle: 'Complete the Bookings sheet. Required date format: YYYY-MM-DD. Required time format: HH:MM in 15-minute slots.',
    columns: [
      { header: 'Rule', key: 'rule', width: 34 },
      { header: 'Requirement', key: 'requirement', width: 80 },
    ],
    rows: [
      { rule: 'Required fields', requirement: 'Pickup Date, Pickup Time, Pickup Address, Pickup Postcode, Delivery Address, Delivery Postcode, Vehicle, Cargo.' },
      { rule: 'Dates', requirement: 'Use YYYY-MM-DD, for example 2026-10-05.' },
      { rule: 'Times', requirement: 'Use 15-minute slots such as 09:00, 09:15, 09:30 or 09:45.' },
      { rule: 'Postcodes', requirement: 'Use full UK postcodes.' },
      { rule: 'Handling flags', requirement: 'Use Yes or No for Tail Lift, Forklift and Handball.' },
      { rule: 'Safety', requirement: 'The file is validated before creation. XDrive uses the same server-side compliance, legal, Stripe, risk and audit controls as manual Post Load.' },
    ],
  },
  {
    name: 'Bookings',
    title: 'Bulk Booking Import Template',
    subtitle: 'Enter one booking per row below the headers. Do not rename header columns.',
    columns: HEADERS.map((header) => ({
      header,
      key: normalise(header).replace(/ /g, '_'),
      width: header.includes('Address') ? 34 : header.includes('Reference') ? 22 : 18,
    })),
    rows: [],
  },
];

export default function BulkBookingImport({ mode }: { mode: ImportMode }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState('');
  const [running, setRunning] = useState(false);
  const [publish, setPublish] = useState(false);
  const [summary, setSummary] = useState('');

  const invalid = useMemo(() => rows.filter((row) => row.errors.length > 0), [rows]);
  const ready = useMemo(() => rows.filter((row) => row.errors.length === 0 && row.status === 'ready'), [rows]);
  const created = useMemo(() => rows.filter((row) => row.status === 'created'), [rows]);

  const downloadTemplate = () =>
    downloadXlsx('xdrive-bulk-booking-import-template.xlsx', templateSheets());

  const parseFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setParseError('');
    setSummary('');
    setRows([]);
    setFileName(file.name);

    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setParseError('Use the XDrive .xlsx template. CSV and legacy .xls files are not accepted for bulk booking import.');
      return;
    }

    try {
      const workbookRows = await readXlsxSheetRows(await file.arrayBuffer(), 'Bookings');
      const headerValues = workbookRows[3] ?? [];
      const headerMap = new Map<string, number>();
      headerValues.forEach((header, index) => {
        if (header.trim()) headerMap.set(normalise(header), index);
      });

      const missing = HEADERS.filter((header) => REQUIRED.has(header) && !headerMap.has(normalise(header)));
      if (missing.length) throw new Error(`Required columns are missing: ${missing.join(', ')}.`);

      const value = (rowNumber: number, header: typeof HEADERS[number]) => {
        const column = headerMap.get(normalise(header));
        return column == null ? '' : workbookRows[rowNumber - 1]?.[column]?.trim() ?? '';
      };

      const parsedRows: BookingRow[] = [];
      for (let rowNumber = 5; rowNumber <= workbookRows.length; rowNumber += 1) {
        const rawValues = HEADERS.map((header) => value(rowNumber, header));
        if (rawValues.every((entry) => !entry)) continue;

        const pickupDate = value(rowNumber, 'Pickup Date');
        const pickupTime = value(rowNumber, 'Pickup Time');
        const pickupAddress = value(rowNumber, 'Pickup Address');
        const pickupPostcode = value(rowNumber, 'Pickup Postcode');
        const deliveryDate = value(rowNumber, 'Delivery Date');
        const deliveryTime = value(rowNumber, 'Delivery Time');
        const deliveryAddress = value(rowNumber, 'Delivery Address');
        const deliveryPostcode = value(rowNumber, 'Delivery Postcode');
        const vehicle = value(rowNumber, 'Vehicle');
        const cargo = value(rowNumber, 'Cargo');
        const weightKg = numeric(value(rowNumber, 'Weight KG'));
        const pallets = numeric(value(rowNumber, 'Pallets'), true);
        const customerPrice = numeric(value(rowNumber, 'Customer Price GBP'));

        const errors: string[] = [];
        if (!isoDate(pickupDate)) errors.push('Pickup Date must use YYYY-MM-DD');
        if (!quarterHour(pickupTime)) errors.push('Pickup Time must use a 15-minute HH:MM slot');
        if (!pickupAddress) errors.push('Pickup Address is required');
        if (!isPostcode(pickupPostcode)) errors.push('Pickup Postcode must be a full UK postcode');
        if (deliveryDate && !isoDate(deliveryDate)) errors.push('Delivery Date must use YYYY-MM-DD');
        if (deliveryDate && !deliveryTime) errors.push('Delivery Time is required when Delivery Date is supplied');
        if (deliveryTime && !deliveryDate) errors.push('Delivery Date is required when Delivery Time is supplied');
        if (deliveryTime && !quarterHour(deliveryTime)) errors.push('Delivery Time must use a 15-minute HH:MM slot');
        if (!deliveryAddress) errors.push('Delivery Address is required');
        if (!isPostcode(deliveryPostcode)) errors.push('Delivery Postcode must be a full UK postcode');
        if (!vehicle) errors.push('Vehicle is required');
        if (!cargo) errors.push('Cargo is required');
        if (Number.isNaN(weightKg)) errors.push('Weight KG must be a positive number');
        if (Number.isNaN(pallets)) errors.push('Pallets must be a whole positive number');
        if (Number.isNaN(customerPrice)) errors.push('Customer Price GBP must be a positive number');

        const pickup = new Date(`${pickupDate}T${pickupTime || '00:00'}:00`);
        if (isoDate(pickupDate) && quarterHour(pickupTime) && pickup.getTime() <= Date.now()) {
          errors.push('Pickup must be in the future');
        }
        if (deliveryDate && deliveryTime) {
          const delivery = new Date(`${deliveryDate}T${deliveryTime}:00`);
          if (delivery.getTime() < pickup.getTime()) errors.push('Delivery cannot be before collection');
        }

        parsedRows.push({
          rowNumber,
          pickupDate,
          pickupTime,
          pickupAddress,
          pickupPostcode: postcode(pickupPostcode),
          deliveryDate,
          deliveryTime,
          deliveryAddress,
          deliveryPostcode: postcode(deliveryPostcode),
          vehicle,
          cargo,
          weightKg: Number.isNaN(weightKg) ? null : weightKg,
          pallets: Number.isNaN(pallets) ? null : pallets,
          customerName: value(rowNumber, 'Customer Name'),
          customerReference: value(rowNumber, 'Customer Reference'),
          bookingReference: value(rowNumber, 'Booking Reference'),
          customerPrice: Number.isNaN(customerPrice) ? null : customerPrice,
          tailLift: bool(value(rowNumber, 'Tail Lift')),
          forklift: bool(value(rowNumber, 'Forklift')),
          handball: bool(value(rowNumber, 'Handball')),
          notes: value(rowNumber, 'Notes'),
          errors,
          status: 'ready',
        });
      }

      if (!parsedRows.length) throw new Error('No booking rows were found below the Bookings headers.');
      setRows(parsedRows);
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'The workbook could not be read.');
    }
  };

  const importRows = async () => {
    if (!user?.id || ready.length === 0 || invalid.length > 0) return;
    setRunning(true);
    setSummary('');
    try {
      const companyId = await resolveActiveCompanyId({ userId: user.id, fallbackCompanyId: user.companyId ?? null });
      if (!companyId) throw new Error('This account is not linked to a company.');
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error('Your session has expired. Please sign in again.');

      let successful = 0;
      for (const row of rows) {
        if (row.errors.length || row.status !== 'ready') continue;
        const body = {
          idempotencyKey: crypto.randomUUID(),
          companyId,
          mode,
          publish,
          directInviteCompanyId: null,
          clientName: mode === 'admin' ? row.customerName || null : null,
          clientEmail: '',
          clientPhone: null,
          pickupDateTime: `${row.pickupDate}T${row.pickupTime}:00`,
          pickupTimeSlot: row.pickupTime,
          pickupAddress: row.pickupAddress,
          pickupPostcode: row.pickupPostcode,
          collectionContact: null,
          collectionPhone: null,
          deliveryDateTime: row.deliveryDate && row.deliveryTime ? `${row.deliveryDate}T${row.deliveryTime}:00` : null,
          deliveryTimeSlot: row.deliveryTime,
          deliveryAddress: row.deliveryAddress,
          deliveryPostcode: row.deliveryPostcode,
          deliveryContact: null,
          deliveryPhone: null,
          additionalStops: [],
          vehicleLabel: row.vehicle,
          cargoLabel: row.cargo,
          weightKg: row.weightKg,
          pallets: row.pallets,
          itemCount: null,
          palletType: null,
          palletStackable: null,
          lengthCm: null,
          widthCm: null,
          heightCm: null,
          cargoValueGbp: null,
          customerReference: row.customerReference || null,
          purchaseOrder: null,
          bookingReference: row.bookingReference || null,
          customerPrice: row.customerPrice,
          targetCarrierCost: null,
          tailLift: row.tailLift,
          forklift: row.forklift,
          handball: row.handball,
          deliveryTailLift: false,
          deliveryForklift: false,
          deliveryHandball: false,
          adr: false,
          temperatureControlled: false,
          fragile: false,
          documentChecklist: [],
          collectionAccessRestrictions: [],
          deliveryAccessRestrictions: [],
          specialRequirementsList: [],
          isFixedPrice: false,
          publicQuoteNotes: null,
          executionInstructions: row.notes || null,
        };

        const response = await fetch('/api/jobs/create', {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const payload = await response.json().catch(() => null) as {
          job?: { id: string };
          error?: string;
          reason?: string;
          resolution?: string;
          referenceId?: string;
        } | null;

        if (!response.ok || !payload?.job?.id) {
          const message = [
            payload?.error || 'The booking could not be created.',
            payload?.reason ? `Cause: ${payload.reason}` : '',
            payload?.resolution ? `Resolution: ${payload.resolution}` : '',
            payload?.referenceId ? `Reference: ${payload.referenceId}` : '',
          ].filter(Boolean).join(' ');
          setRows((current) => current.map((item) =>
            item.rowNumber === row.rowNumber ? { ...item, status: 'failed', result: message } : item
          ));
          setSummary(`${successful} booking(s) created. Import stopped at Excel row ${row.rowNumber} so the failure can be resolved safely before continuing.`);
          return;
        }

        successful += 1;
        setRows((current) => current.map((item) =>
          item.rowNumber === row.rowNumber
            ? { ...item, status: 'created', result: `XDL-${payload.job!.id.slice(0, 8).toUpperCase()}` }
            : item
        ));
      }
      setSummary(`${successful} booking(s) ${publish ? 'published' : 'saved as drafts'} successfully.`);
    } catch (error) {
      setSummary(error instanceof Error ? error.message : 'Bulk import could not be completed.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Reports & Data / spreadsheet import"
        title="Bulk Booking Import"
        description="Create transport bookings from the controlled XDrive Excel template. Every booking passes through the same server-side membership, legal, risk, Stripe, compliance, idempotency and audit controls as manual Post Load."
        actions={<ActionButton tone="secondary" onClick={() => void downloadTemplate()}>Download XLSX Template</ActionButton>}
      />

      <KpiGrid>
        <KpiCard label="Rows loaded" value={rows.length} tone="blue" />
        <KpiCard label="Ready" value={ready.length} tone="green" />
        <KpiCard label="Needs correction" value={invalid.length} tone={invalid.length ? 'orange' : 'navy'} />
        <KpiCard label="Created" value={created.length} tone="green" />
      </KpiGrid>

      {parseError && <AlertBanner tone="danger">{parseError}</AlertBanner>}
      {summary && <AlertBanner tone={summary.toLowerCase().includes('success') ? 'success' : 'info'}>{summary}</AlertBanner>}

      <Panel title="1. Prepare and validate workbook" description="Download the controlled template, complete one booking per row, then upload the .xlsx file for validation. Nothing is created during validation.">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', minHeight: 34, border: '1px solid #cbd5e1', borderRadius: 6, padding: '0 12px', background: '#fff', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>
            Choose XLSX
            <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => void parseFile(event)} style={{ display: 'none' }} />
          </label>
          <span style={{ color: '#64748b', fontSize: 12 }}>{fileName || 'No workbook selected'}</span>
        </div>
      </Panel>

      <Panel title="2. Review validated rows" description="XDrive blocks the import until every row is valid. Error details refer to the original Excel row number." flush>
        {rows.length ? (
          <DataTable
            columns={['Excel row', 'Route', 'Pickup', 'Vehicle / cargo', 'Reference', 'Validation', 'Result']}
            rows={rows.map((row) => [
              row.rowNumber,
              <strong key="route">{row.pickupPostcode} → {row.deliveryPostcode}</strong>,
              `${row.pickupDate} ${row.pickupTime}`,
              `${row.vehicle} · ${row.cargo}`,
              row.bookingReference || row.customerReference || '—',
              row.errors.length
                ? <span key="errors" style={{ color: '#b91c1c', fontSize: 11 }}>{row.errors.join('; ')}</span>
                : <StatusBadge key="valid" value={row.status === 'created' ? 'created' : row.status === 'failed' ? 'failed' : 'ready'} tone={row.status === 'failed' ? 'red' : 'green'} />,
              row.result || '—',
            ])}
          />
        ) : <EmptyState title="No workbook validated yet" description="Download the XDrive template and upload the completed .xlsx file." />}
      </Panel>

      <Panel title="3. Create bookings" description="Draft is the safer default. Publishing uses the same marketplace readiness controls as manual Post Load.">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: '#334155' }}>
            <input type="checkbox" checked={publish} onChange={(event) => setPublish(event.target.checked)} disabled={running || created.length > 0} />
            Publish valid bookings to the Exchange immediately
          </label>
          <ActionButton
            tone={publish ? 'warning' : 'primary'}
            disabled={running || rows.length === 0 || invalid.length > 0 || ready.length === 0}
            onClick={() => void importRows()}
          >
            {running ? 'Importing…' : publish ? `Publish ${ready.length} Booking(s)` : `Save ${ready.length} Draft Booking(s)`}
          </ActionButton>
        </div>
        {invalid.length > 0 && (
          <div style={{ marginTop: 10, color: '#b45309', fontSize: 11, fontWeight: 700 }}>
            Correct all {invalid.length} invalid row(s) in Excel and upload the workbook again before import.
          </div>
        )}
      </Panel>
    </PageFrame>
  );
}
