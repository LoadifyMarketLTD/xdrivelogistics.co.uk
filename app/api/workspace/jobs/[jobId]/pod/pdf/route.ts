import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { drawOfficialPodCover } from '../../../../../../../lib/server/professionalPodPdf';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../../../../_lib/supabaseAdmin';
import { canonicalPodEvidence } from '../../../../../../../lib/pod/canonicalPodEvidence';
import { drawOfficialXDrivePdfLogo } from '../../../../../../../lib/server/officialXDrivePdfLogo';

const jsonError = (status: number, error: string) => NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return jsonError(503, 'POD service is not configured.');
  const token = getBearerToken(request);
  if (!token) return jsonError(401, 'Unauthorized.');
  // The trusted POD notification worker needs the exact same official PDF as the UI.
  // It authenticates with the server-only service key; browser users still require a valid session.
  const internalServiceRequest = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) &&
    token === process.env.SUPABASE_SERVICE_ROLE_KEY;
  let authenticatedUserId = '';
  if (!internalServiceRequest) {
    const validator = supabaseValidator ?? supabaseAdmin;
    const { data: auth, error: authError } = await validator.auth.getUser(token);
    if (authError || !auth.user) return jsonError(401, 'Unauthorized.');
    authenticatedUserId = auth.user.id;
  }

  const { jobId } = await params;
  const { data: job, error: jobError } = await supabaseAdmin.from('jobs')
    .select('id,company_id,awarded_carrier_company_id,assigned_company_id,created_by,pod_generated,pod_generated_at,delivery_photos,pod_photos,delivery_signature_data,client_signature_name,pickup_location,delivery_location,pickup_datetime,delivery_datetime,collection_contact_name,delivery_contact_name,no_of_items,items,weight_kg,delivery_status,customer_reference,load_reference,booking_reference,delivered_at,delivery_notes,vehicle_type,cargo_type')
    .eq('id', jobId).maybeSingle();
  if (jobError) return jsonError(500, jobError.message);
  if (!job) return jsonError(404, 'Job not found.');

  const companies = [job.company_id, job.awarded_carrier_company_id, job.assigned_company_id]
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
  let authorised = internalServiceRequest || job.created_by === authenticatedUserId;
  if (!authorised && companies.length) {
    const { data: membership, error } = await supabaseAdmin.from('company_memberships')
      .select('id').eq('user_id', authenticatedUserId).eq('status', 'active')
      .in('company_id', companies).limit(1).maybeSingle();
    if (error) return jsonError(500, error.message);
    authorised = Boolean(membership?.id);
  }
  if (!authorised) return jsonError(403, 'This POD is outside your authorised workspace.');

  const evidence = canonicalPodEvidence(job);
  if (!evidence.complete) return jsonError(409, 'Complete delivery POD with a photo, handwritten signature and recipient name first.');
  if (evidence.deliveryPhotoCount < 1) return jsonError(409, 'A delivery photograph is required for the POD PDF.');
  const storedSignature = job.delivery_signature_data;
  const signature = typeof storedSignature === 'string' ? storedSignature
    : storedSignature && typeof storedSignature === 'object' && !Array.isArray(storedSignature)
      ? String((storedSignature as Record<string, unknown>).value ?? '')
      : '';
  if (!/^data:image\/(png|jpeg);base64,/i.test(signature)) {
    return jsonError(409, 'A handwritten recipient signature image is required.');
  }
  // Identify the actual executing carrier, not the marketplace or booking customer.
  const carrierId = job.awarded_carrier_company_id ?? job.assigned_company_id;
  if (!carrierId) return jsonError(409, 'An executing carrier must be assigned before a POD can be issued.');
  const { data: carrier, error: carrierError } = await supabaseAdmin.from('companies')
    .select('id, name').eq('id', carrierId).maybeSingle();
  if (carrierError || !carrier?.name) return jsonError(409, 'Executing carrier details are unavailable.');

  try {
    const pdf = await PDFDocument.create();
    const logoBytes = await readFile(path.join(process.cwd(), 'public', 'xdrive-logo-primary.png'));
    const { data: savedDraft, error: draftError } = await supabaseAdmin.from('driver_pod_drafts')
      .select('form_data').eq('job_id', job.id).order('updated_at', { ascending: false })
      .limit(1).maybeSingle();
    if (draftError) throw new Error('Saved POD details could not be retrieved.');
    const handover = savedDraft?.form_data && typeof savedDraft.form_data === 'object' &&
      !Array.isArray(savedDraft.form_data) ? savedDraft.form_data as Record<string, unknown> : {};
    const reference = job.customer_reference || job.load_reference || job.booking_reference ||
      'XDL-' + job.id.replace(/-/g, '').slice(0, 8).toUpperCase();
    await drawOfficialPodCover(pdf, logoBytes, carrier.name, {
      ...job, reference,
    }, signature, evidence.deliveryPhotoCount, {
      leftAt: typeof handover.leftAt === 'string' ? handover.leftAt : undefined,
      itemCount: typeof handover.itemCount === 'string' || typeof handover.itemCount === 'number'
        ? handover.itemCount : undefined,
      deliveryStatus: typeof handover.deliveryStatus === 'string' ? handover.deliveryStatus : undefined,
      notes: typeof handover.notes === 'string' ? handover.notes : undefined,
    });
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const navy = rgb(0.043, 0.184, 0.420);
    const orange = rgb(0.961, 0.639, 0);
    const blue = rgb(0.12, 0.33, 0.69);
    const safe = (value: unknown, max = 90) => String(value ?? 'Not supplied')
      .replace(/[^\x20-\x7e]/g, ' ').slice(0, max);
    const carrierCompany = carrierId;
    let photoPage: ReturnType<typeof pdf.addPage> | null = null;
    for (const [index, storagePath] of evidence.deliveryPhotos.slice(0, 10).entries()) {
      if (!carrierCompany || !storagePath.startsWith(`${carrierCompany}/${job.id}/photos/`) ||
          storagePath.includes('..') || storagePath.includes('\\')) {
        throw new Error('POD photograph has an invalid storage path.');
      }
      const { data: stored, error: storageError } = await supabaseAdmin.storage
        .from('pod-photos').download(storagePath);
      if (storageError || !stored) throw new Error('POD photograph could not be retrieved.');
      const photoBytes = new Uint8Array(await stored.arrayBuffer());
      const photo = storagePath.toLowerCase().endsWith('.png')
        ? await pdf.embedPng(photoBytes) : await pdf.embedJpg(photoBytes);
      if (index % 2 === 0) photoPage = pdf.addPage([595.28, 841.89]);
      if (!photoPage) throw new Error('Photographic evidence page could not be created.');
      if (index % 2 === 0) photoPage.drawRectangle({ x: 0, y: 831, width: 595.28, height: 11, color: orange });
      if (index % 2 === 0) await drawOfficialXDrivePdfLogo(pdf, photoPage, { x: 40, y: 770, maxWidth: 195, maxHeight: 53 });
      if (index % 2 === 0) photoPage.drawText('DELIVERY PHOTO EVIDENCE', { x: 303, y: 797, size: 12, font: bold, color: navy });
      if (index % 2 === 0) photoPage.drawText(safe(carrier.name, 40), { x: 303, y: 780, size: 9, font: regular, color: blue });
      const slotTop = index % 2 === 0 ? 738 : 388;
      photoPage.drawText(`IMAGE ${index + 1} OF ${Math.min(evidence.deliveryPhotos.length, 10)}`, {
        x: 40, y: slotTop, size: 10, font: bold, color: blue,
      });
      const dimensions = photo.scaleToFit(515, 308);
      photoPage.drawImage(photo, {
        x: (595.28 - dimensions.width) / 2,
        y: (index % 2 === 0 ? 723 : 373) - dimensions.height,
        width: dimensions.width, height: dimensions.height,
      });
    }
    const data = await pdf.save();
    return new NextResponse(Buffer.from(data), { status: 200, headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Proof-of-Delivery-${job.id.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 50)}.pdf"`,
      'Cache-Control': 'private, no-store',
    } });
  } catch {
    return jsonError(500, 'POD PDF could not be generated.');
  }
}
