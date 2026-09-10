import { useState, type ReactNode } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { StyleSheet } from 'react-native';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from '../theme/primitives';
import { BrandedHeader } from '../components/BrandedHeader';
import { colors, radius } from '../theme/tokens';
import type { DriverResources } from '../types/driver';
import { uploadDriverDocument, type ReturnIqMeta } from '../api/driver';

type ResourcePage = 'vehicle' | 'documents' | 'alerts' | 'journeys' | 'messenger' | 'invoices';

function text(row: Record<string, unknown> | null | undefined, keys: string[], fallback = 'Not set') {
  if (!row) return fallback;
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && String(value).trim()) return String(value);
  }
  return fallback;
}

function vehicleTypeLabel(value: unknown) {
  const raw = String(value ?? '').replace(/[_-]+/g, ' ').trim();
  const acronyms = new Set(['lwb', 'swb', 'mwb', 'xlwb', 'hgv']);
  return raw.split(/\s+/).filter(Boolean).map((part) => {
    const lower = part.toLowerCase();
    return acronyms.has(lower) ? lower.toUpperCase() : lower.charAt(0).toUpperCase() + lower.slice(1);
  }).join(' ') || 'Not set';
}

function money(value: unknown, currency = 'GBP') {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return '-';
  try { return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount); }
  catch { return `GBP ${amount.toFixed(2)}`; }
}

function documentLabel(value: unknown) {
  const key = String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
  const labels: Record<string, string> = {
    drivinglicence: 'Driving Licence', drivinglicense: 'Driving Licence', drivinglicencecard: 'Driving Licence',
    cpccard: 'CPC Card', cpc: 'CPC Card', insurance: 'Insurance', insurancecertificate: 'Insurance',
    mot: 'MOT', vehiclemot: 'MOT', goodsvehicletest: 'MOT', other: 'Other document',
  };
  return labels[key] || String(value ?? 'Document').replace(/[_-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function readableStatus(value: unknown, fallback = 'Unknown') {
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;
  return raw.replace(/[_-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function expiryLine(value: unknown) {
  const raw = String(value ?? '').trim();
  if (!raw) return 'Expiry: -';
  const expiry = new Date(`${raw.slice(0, 10)}T23:59:59.999Z`).getTime();
  if (!Number.isFinite(expiry)) return `Expiry: ${raw}`;
  const days = Math.ceil((expiry - Date.now()) / 86400000);
  if (days < 0) return `Expiry: ${raw} (expired)`;
  if (days <= 30) return `Expiry: ${raw} (${days} day${days === 1 ? '' : 's'} remaining)`;
  return `Expiry: ${raw}`;
}

function alertTitle(value: unknown) {
  const event = String(value ?? '').trim().toLowerCase();
  const labels: Record<string, string> = {
    onboarding_invite: 'Driver account invitation', job_assigned: 'Job assigned', bid_accepted: 'Quote accepted',
    bid_submitted: 'Quote submitted', bid_rejected: 'Quote unsuccessful', job_cancelled: 'Job cancelled',
    job_canceled: 'Job cancelled', invoice_created: 'Invoice created', invoice_paid: 'Invoice paid',
  };
  return labels[event] || readableStatus(event || 'Alert', 'Alert');
}

function formatAlertTimestamp(value: unknown) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function alertLines(alert: Record<string, unknown>) {
  const payload = alert.payload && typeof alert.payload === 'object' ? alert.payload as Record<string, unknown> : undefined;
  const reference = text(payload, ['reference', 'jobReference', 'job_reference', 'publicReference'], '');
  const created = formatAlertTimestamp(text(alert, ['created_at'], ''));
  return [reference ? `Reference: ${reference}` : '', created].filter(Boolean);
}

export function ResourcesScreen({ page, resources, returnIq, returnIqBusy = false, onReturnIqChange, onDocumentsChanged, onBack }: {
  page: ResourcePage;
  resources?: DriverResources;
  returnIq?: ReturnIqMeta;
  returnIqBusy?: boolean;
  onReturnIqChange?: (enabled: boolean, radius: 10 | 20 | 30) => Promise<void>;
  onDocumentsChanged?: () => Promise<void> | void;
  onBack: () => void;
}) {
  const [documentBusy, setDocumentBusy] = useState(false);
  const [documentMessage, setDocumentMessage] = useState('');

  async function pickAndUploadDocument(docType: 'drivinglicence' | 'cpccard' | 'insurance', label: string) {
    if (documentBusy) return;
    setDocumentMessage('');
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      if (asset.size && asset.size > 10 * 1024 * 1024) throw new Error('Document must be smaller than 10 MB.');
      setDocumentBusy(true);
      const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
      const lowerName = asset.name.toLowerCase();
      const mimeType = asset.mimeType
        || (lowerName.endsWith('.pdf') ? 'application/pdf'
          : lowerName.endsWith('.png') ? 'image/png'
            : lowerName.endsWith('.webp') ? 'image/webp'
              : 'image/jpeg');
      await uploadDriverDocument({ docType, fileName: asset.name, mimeType, base64 });
      setDocumentMessage(`${label} uploaded for review.`);
      await onDocumentsChanged?.();
    } catch (cause) {
      setDocumentMessage(cause instanceof Error ? cause.message : 'Document could not be uploaded.');
    } finally {
      setDocumentBusy(false);
    }
  }

  if (page === 'vehicle') {
    const vehicle = resources?.vehicle;
    const rows: [string, string][] = [
      ['Registration', text(vehicle, ['reg_plate','registration','registration_number'])],
      ['Vehicle type', vehicleTypeLabel(text(vehicle, ['vehicle_type','type']))],
      ['Make / model', `${text(vehicle, ['make'], '')} ${text(vehicle, ['model'], '')}`.trim() || 'Not set'],
      ['Payload', text(vehicle, ['payload_kg'], 'Not set')],
      ['Pallet capacity', text(vehicle, ['pallets_capacity'], 'Not set')],
    ];
    return <Page title="Vehicle" onBack={onBack}>{rows.map(([label,value]) => <InfoRow key={label} label={label} value={value} />)}</Page>;
  }

  if (page === 'documents') {
    const docs = resources?.documents ?? [];
    const uploadTypes = [
      ['drivinglicence', 'Driving Licence'],
      ['cpccard', 'CPC Card'],
      ['insurance', 'Insurance'],
    ] as const;
    return <Page title={`Documents (${docs.length})`} onBack={onBack}>
      <View style={styles.uploadCard}>
        <Text style={styles.uploadTitle}>Add compliance document</Text>
        <Text style={styles.uploadText}>PDF, JPG, PNG or WEBP up to 10 MB. New uploads are submitted for approval before they count toward quote readiness.</Text>
        <View style={styles.uploadActions}>{uploadTypes.map(([docType, label]) => <Pressable key={docType} accessibilityRole="button" accessibilityLabel={`Upload ${label}`} disabled={documentBusy} onPress={() => void pickAndUploadDocument(docType, label)} style={[styles.uploadButton, documentBusy && styles.uploadButtonDisabled]}><Text style={styles.uploadButtonText}>{label}</Text></Pressable>)}</View>
        {documentBusy ? <View style={styles.savingRow}><ActivityIndicator size="small" color={colors.primary} /><Text style={styles.savingText}>Uploading document...</Text></View> : null}
        {documentMessage ? <Text style={styles.uploadMessage}>{documentMessage}</Text> : null}
      </View>
      {docs.length ? docs.map((doc, i) => <Card key={String(doc.id ?? i)} title={documentLabel(doc.doc_type)} lines={[`Status: ${readableStatus(doc.status)}`, `Issued: ${text(doc,['issued_date'],'-')}`, expiryLine(doc.expiry_date)]} />) : <Empty text="No documents found." />}
    </Page>;
  }

  if (page === 'alerts') {
    const alerts = resources?.alerts ?? [];
    return <Page title={`Alerts (${alerts.length})`} onBack={onBack}>{alerts.length ? alerts.map((alert, i) => <Card key={String(alert.id ?? i)} title={alertTitle(alert.event_type)} lines={alertLines(alert)} />) : <Empty text="No alerts found." />}</Page>;
  }

  if (page === 'journeys') {
    const driver = resources?.driver;
    const enabled = driver?.destination_priority_enabled === true || String(driver?.destination_priority_enabled ?? 'false').toLowerCase() === 'true';
    const rawRadius = Number(driver?.destination_radius_miles ?? 20);
    const selectedRadius: 10 | 20 | 30 = rawRadius === 10 || rawRadius === 20 || rawRadius === 30 ? rawRadius : 20;
    const engineStatus = enabled ? (returnIq?.active ? 'Active' : 'Waiting') : 'Paused';
    return <Page title="Return Journey" onBack={onBack}>
      <View style={styles.summary}>
        <Text style={styles.summaryLabel}>Return IQ</Text>
        <Text style={styles.summaryValue}>{enabled ? 'Enabled' : 'Paused'}</Text>
        <Text style={styles.summaryMeta}>Matching engine: {engineStatus}</Text>
      </View>
      <Text style={styles.controlLabel}>Return IQ status</Text>
      <View style={styles.controlRow}>
        {[true, false].map((value) => <Pressable key={String(value)} disabled={returnIqBusy || !onReturnIqChange}
          onPress={() => void onReturnIqChange?.(value, selectedRadius)} style={[styles.controlButton, enabled === value && styles.controlButtonActive]}>
          <Text style={[styles.controlButtonText, enabled === value && styles.controlButtonTextActive]}>{value ? 'Enabled' : 'Paused'}</Text>
        </Pressable>)}
      </View>
      <Text style={styles.controlLabel}>Search radius</Text>
      <View style={styles.controlRow}>
        {([10, 20, 30] as const).map((value) => <Pressable key={value} disabled={returnIqBusy || !onReturnIqChange}
          onPress={() => void onReturnIqChange?.(enabled, value)} style={[styles.radiusButton, selectedRadius === value && styles.controlButtonActive]}>
          <Text style={[styles.controlButtonText, selectedRadius === value && styles.controlButtonTextActive]}>{value} miles</Text>
        </Pressable>)}
      </View>
      {returnIqBusy ? <View style={styles.savingRow}><ActivityIndicator size="small" color={colors.primary} /><Text style={styles.savingText}>Updating matching...</Text></View> : null}
      {returnIq?.destinationArea ? <InfoRow label="Destination area" value={returnIq.destinationArea} /> : null}
      {returnIq?.currentJobReference ? <InfoRow label="Current job" value={returnIq.currentJobReference} /> : null}
      {returnIq?.availableAfter ? <InfoRow label="Available after" value={returnIq.availableAfter} /> : null}
      <InfoRow label="Engine radius" value={`${returnIq?.radiusMiles ?? selectedRadius} miles`} />
      {returnIq?.reason ? <Card title="Return IQ status" lines={[returnIq.reason]} /> : null}
      <Card title="Journey matching" lines={["Suitable loads are prioritised around the destination of your current work.", "Changing Return IQ or its radius updates your driver preferences and refreshes marketplace matching immediately.", "Private route details and live driver positions are not exposed."]} />
    </Page>;
  }

  if (page === 'messenger') {
    return <Page title="Messenger" onBack={onBack}>
      <Card title="No messages" lines={["Job and dispatcher messages will appear here when a verified XDrive messaging source is available."]} />
    </Page>;
  }

  const invoices = resources?.invoices ?? [];
  const paid = invoices.filter(i => /\bpaid\b/i.test(`${i.status ?? ''} ${i.payment_status ?? ''}`) && !/unpaid/i.test(`${i.status ?? ''} ${i.payment_status ?? ''}`));
  const overdue = invoices.filter(i => {
    if (paid.includes(i)) return false;
    if (/overdue/i.test(`${i.status ?? ''} ${i.payment_status ?? ''}`)) return true;
    const due = i.due_date ? new Date(String(i.due_date)) : null;
    return !!due && !Number.isNaN(due.getTime()) && due.getTime() < Date.now();
  });
  const awaiting = invoices.filter(i => !paid.includes(i) && !overdue.includes(i) && /unpaid|partial|sent|issued|approved|awaiting/i.test(`${i.status ?? ''} ${i.payment_status ?? ''}`));
  const review = invoices.filter(i => !paid.includes(i) && !awaiting.includes(i) && !overdue.includes(i));
  const sum = (rows: Record<string, unknown>[]) => rows.reduce((value, i) => value + (Number(i.amount) || 0), 0);
  const total = sum(invoices);
  const currency = text(invoices[0], ['currency'], 'GBP');
  return <Page title="Invoices & Earnings" onBack={onBack}>
    <View style={styles.summary}><Text style={styles.summaryLabel}>Summary</Text><Text style={styles.summaryValue}>{money(total,currency)}</Text><Text style={styles.summaryMeta}>{invoices.length} invoice{invoices.length===1?'':'s'} | {currency} only</Text></View>
    <View style={styles.metricGrid}>
      <Metric title="Pending approval" count={review.length} amount={money(sum(review),currency)} />
      <Metric title="Awaiting payment" count={awaiting.length + overdue.length} amount={money(sum([...awaiting, ...overdue]),currency)} />
      <Metric title="Paid" count={paid.length} amount={money(sum(paid),currency)} />
    </View>
    {overdue.length ? <View style={styles.attention}><Text style={styles.attentionTitle}>Requiring attention</Text><Text style={styles.attentionText}>Invoices overdue</Text><Text style={styles.attentionValue}>{overdue.length} | {money(sum(overdue),currency)}</Text></View> : null}
    <Text style={styles.sectionTitle}>Invoices</Text>
    {invoices.length ? invoices.map((invoice, i) => {
      const statusText = `${invoice.status ?? ''} ${invoice.payment_status ?? ''}`.trim() || 'Unknown';
      const amount = money(invoice.amount, text(invoice,['currency'],'GBP'));
      return <Card key={String(invoice.id ?? i)} title={text(invoice,['invoice_number'],`Invoice ${i+1}`)} lines={[amount, text(invoice,['client_name'],'Client not set'), `Status: ${statusText}`, `Invoice date: ${text(invoice,['invoice_date'],'-')}`, `Due: ${text(invoice,['due_date'],'-')}`]} />;
    }) : <Empty text="No invoices found." />}
  </Page>;
}

function Page({ title, onBack, children }: { title: string; onBack: () => void; children: ReactNode }) {
  return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
    <BrandedHeader title={title} subtitle="Live account data" />
    <Pressable onPress={onBack} style={styles.back}><Text style={styles.backText}>Back</Text></Pressable>
    {children}
  </ScrollView>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.row}><Text style={styles.rowLabel}>{label}</Text><Text style={styles.rowValue}>{value}</Text></View>;
}

function Card({ title, lines }: { title: string; lines: string[] }) {
  return <View style={styles.card}><Text style={styles.cardTitle}>{title}</Text>{lines.map((line, i) => <Text key={`${line}-${i}`} style={styles.cardLine}>{line}</Text>)}</View>;
}

function Metric({ title, count, amount }: { title: string; count: number; amount: string }) {
  return <View style={styles.metric}><Text style={styles.metricTitle}>{title}</Text><Text style={styles.metricCount}>{count} invoice{count===1?'':'s'}</Text><Text style={styles.metricAmount}>{amount}</Text></View>;
}

function Empty({ text }: { text: string }) { return <Text style={styles.empty}>{text}</Text>; }

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#EEF2F6' },
  content: { paddingBottom: 24, gap: 10 },
  back: { marginHorizontal: 16, alignSelf: 'flex-start', paddingVertical: 4 },
  backText: { fontFamily: 'Inter_700Bold', fontSize: 15, color: colors.primary },
  uploadCard: { marginHorizontal: 16, backgroundColor: colors.surface, borderRadius: radius.medium, padding: 14 },
  uploadTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#172033' },
  uploadText: { marginTop: 5, fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 17, color: '#526071' },
  uploadActions: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  uploadButton: { minHeight: 40, borderWidth: 1, borderColor: colors.primary, borderRadius: 10, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  uploadButtonDisabled: { opacity: 0.5 },
  uploadButtonText: { fontFamily: 'Inter_700Bold', fontSize: 12, color: colors.primary },
  uploadMessage: { marginTop: 9, fontFamily: 'Inter_600SemiBold', fontSize: 12, lineHeight: 17, color: '#334155' },
  row: { marginHorizontal: 16, backgroundColor: colors.surface, borderRadius: radius.medium, padding: 14 },
  rowLabel: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#526071' },
  rowValue: { marginTop: 4, fontFamily: 'Inter_700Bold', fontSize: 16, color: '#172033' },
  card: { marginHorizontal: 16, backgroundColor: colors.surface, borderRadius: radius.medium, padding: 14 },
  cardTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#172033' },
  cardLine: { marginTop: 4, fontFamily: 'Inter_500Medium', fontSize: 13, color: '#526071' },
  summary: { marginHorizontal: 16, backgroundColor: colors.surface, borderRadius: radius.medium, padding: 16 },
  summaryLabel: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#526071' },
  summaryValue: { marginTop: 4, fontFamily: 'Inter_700Bold', fontSize: 28, color: '#172033' },
  summaryMeta: { marginTop: 6, fontFamily: 'Inter_500Medium', fontSize: 12, color: '#526071' },
  paidValue: { marginTop: 10, fontFamily: 'Inter_700Bold', fontSize: 15, color: '#237A41' },
  metricGrid: { marginHorizontal: 16, flexDirection: 'row', gap: 8 },
  metric: { flex: 1, minHeight: 118, backgroundColor: colors.surface, borderRadius: radius.medium, padding: 12 },
  metricTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#526071' },
  metricCount: { marginTop: 12, fontFamily: 'Inter_500Medium', fontSize: 12, color: '#526071' },
  metricAmount: { marginTop: 5, fontFamily: 'Inter_700Bold', fontSize: 18, color: '#172033' },
  attention: { marginHorizontal: 16, backgroundColor: '#FFF7E6', borderRadius: radius.medium, padding: 14 },
  attentionTitle: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#172033' },
  attentionText: { marginTop: 5, fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#8A4B08' },
  attentionValue: { marginTop: 3, fontFamily: 'Inter_700Bold', fontSize: 17, color: '#8A4B08' },
  controlLabel: { marginHorizontal: 16, marginTop: 4, fontFamily: 'Inter_700Bold', fontSize: 13, color: '#334155' },
  controlRow: { marginHorizontal: 16, flexDirection: 'row', gap: 8 },
  controlButton: { flex: 1, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: '#B7C3D4', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  radiusButton: { flex: 1, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: '#B7C3D4', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  controlButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  controlButtonText: { fontFamily: 'Inter_700Bold', fontSize: 13, color: '#334155' },
  controlButtonTextActive: { color: '#FFFFFF' },
  savingRow: { marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  savingText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#475569' },
  sectionTitle: { marginHorizontal: 16, marginTop: 4, fontFamily: 'Inter_700Bold', fontSize: 18, color: '#172033' },
  empty: { marginHorizontal: 16, padding: 18, backgroundColor: colors.surface, borderRadius: radius.medium, fontFamily: 'Inter_500Medium', color: '#526071' },
});


