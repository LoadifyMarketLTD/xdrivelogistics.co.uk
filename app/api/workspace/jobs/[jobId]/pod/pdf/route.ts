import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../../../../_lib/supabaseAdmin';
import { canonicalPodEvidence } from '../../../../../../../lib/pod/canonicalPodEvidence';

const jsonError = (status: number, error: string) => NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return jsonError(503, 'POD service is not configured.');
  const token = getBearerToken(request);
  if (!token) return jsonError(401, 'Unauthorized.');
  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: auth, error: authError } = await validator.auth.getUser(token);
  if (authError || !auth.user) return jsonError(401, 'Unauthorized.');

  const { jobId } = await params;
  const { data: job, error: jobError } = await supabaseAdmin.from('jobs')
    .select('id,company_id,awarded_carrier_company_id,assigned_company_id,created_by,pod_generated,pod_generated_at,delivery_photos,pod_photos,delivery_signature_data,client_signature_name,pickup_location,delivery_location,pickup_datetime,delivery_datetime')
    .eq('id', jobId).maybeSingle();
  if (jobError) return jsonError(500, jobError.message);
  if (!job) return jsonError(404, 'Job not found.');

  const companies = [job.company_id, job.awarded_carrier_company_id, job.assigned_company_id]
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
  let authorised = job.created_by === auth.user.id;
  if (!authorised && companies.length) {
    const { data: membership, error } = await supabaseAdmin.from('company_memberships')
      .select('id').eq('user_id', auth.user.id).eq('status', 'active')
      .in('company_id', companies).limit(1).maybeSingle();
    if (error) return jsonError(500, error.message);
    authorised = Boolean(membership?.id);
  }
  if (!authorised) return jsonError(403, 'This POD is outside your authorised workspace.');

  const evidence = canonicalPodEvidence(job);
  if (!evidence.complete) return jsonError(409, 'Complete delivery POD with a photo, handwritten signature and recipient name first.');
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
    const page = pdf.addPage([595.28, 841.89]);
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const navy = rgb(0.07, 0.16, 0.29);
    const blue = rgb(0.12, 0.33, 0.69);
    const orange = rgb(0.96, 0.63, 0.04);
    const charcoal = rgb(0.17, 0.21, 0.27);
    const pale = rgb(0.96, 0.97, 0.98);
    const safe = (value: unknown, max = 90) => String(value ?? 'Not supplied')
      .replace(/[^\x20-\x7e]/g, ' ').slice(0, max);
    const field = (name: string, value: unknown, y: number) => {
      page.drawText(name, { x: 40, y, size: 10, font: bold, color: navy });
      const raw = safe(value, 180);
      let display = raw;
      while (display.length > 3 && regular.widthOfTextAtSize(display, 10) > 355) display = display.slice(0, -1);
      if (display !== raw) display = display.slice(0, -3) + '...';
      page.drawText(display, { x: 180, y, size: 10, font: regular, color: navy });
    };
    page.drawRectangle({ x: 0, y: 831, width: 595.28, height: 11, color: orange });
    page.drawText(safe(carrier.name, 65), { x: 40, y: 783, size: 18, font: bold, color: navy });
    page.drawText('TRANSPORT CARRIER', { x: 40, y: 807, size: 9, font: bold, color: blue });
    page.drawLine({ start: { x: 40, y: 769 }, end: { x: 555, y: 769 }, color: rgb(0.86, 0.89, 0.92), thickness: 1 });
    page.drawText('PROOF OF DELIVERY', { x: 40, y: 737, size: 23, font: bold, color: navy });
    page.drawText('DELIVERY CONFIRMATION', { x: 40, y: 718, size: 9, font: bold, color: blue });
    page.drawRectangle({ x: 40, y: 666, width: 515, height: 34, color: navy });
    page.drawRectangle({ x: 40, y: 666, width: 5, height: 34, color: orange });
    page.drawText('DELIVERY COMPLETED', { x: 56, y: 679, size: 12, font: bold, color: rgb(1, 1, 1) });
    page.drawText('DELIVERY RECORD', { x: 40, y: 645, size: 9, font: bold, color: blue });
    page.drawRectangle({ x: 40, y: 394, width: 515, height: 238, color: pale });
    field('Job reference', job.id, 613);
    field('Collection', job.pickup_location, 584);
    field('Delivery', job.delivery_location, 555);
    field('Pickup time', job.pickup_datetime, 526);
    field('Delivery time', job.delivery_datetime, 497);
    field('POD completed', job.pod_generated_at, 468);
    field('Received by', job.client_signature_name, 439);
    field('Delivery photos', evidence.deliveryPhotoCount, 410);
    page.drawText('RECIPIENT SIGNATURE', { x: 40, y: 365, size: 11, font: bold, color: blue });
    const bytes = Buffer.from(signature.split(',')[1], 'base64');
    const image = /^data:image\/png/i.test(signature) ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
    const size = image.scaleToFit(440, 195);
    page.drawRectangle({ x: 40, y: 136, width: 515, height: 214, color: rgb(0.985, 0.989, 0.995), borderColor: rgb(0.88, 0.9, 0.93), borderWidth: 1 });
    page.drawImage(image, { x: 56, y: 146 + (190 - size.height) / 2, width: size.width, height: size.height });
    page.drawLine({ start: { x: 40, y: 102 }, end: { x: 555, y: 102 }, thickness: 1, color: rgb(0.86, 0.89, 0.92) });
    page.drawText('Issued by ' + safe(carrier.name, 55), { x: 40, y: 85, size: 9, font: bold, color: charcoal });
    page.drawText('Record ' + safe(job.id, 45), { x: 40, y: 68, size: 8, font: regular, color: charcoal });
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
      if (index % 2 === 0) photoPage.drawText(safe(carrier.name, 64), { x: 40, y: 805, size: 12, font: bold, color: navy });
      if (index % 2 === 0) photoPage.drawText('DELIVERY PHOTOGRAPHIC RECORD', { x: 40, y: 779, size: 15, font: bold, color: blue });
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
