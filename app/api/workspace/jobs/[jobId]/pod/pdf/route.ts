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
  try {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595.28, 841.89]);
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const navy = rgb(0.07, 0.17, 0.34);
    const safe = (value: unknown, max = 90) => String(value ?? 'Not supplied')
      .replace(/[^\x20-\x7e]/g, ' ').slice(0, max);
    const field = (name: string, value: unknown, y: number) => {
      page.drawText(name, { x: 40, y, size: 10, font: bold, color: navy });
      page.drawText(safe(value), { x: 180, y, size: 10, font: regular, color: navy });
    };
    page.drawText('XDRIVE LOGISTICS', { x: 40, y: 790, size: 20, font: bold, color: navy });
    page.drawText('PROOF OF DELIVERY', { x: 40, y: 750, size: 15, font: bold, color: navy });
    field('Job reference', job.id, 710);
    field('Collection', job.pickup_location, 685);
    field('Delivery', job.delivery_location, 660);
    field('Pickup time', job.pickup_datetime, 635);
    field('Delivery time', job.delivery_datetime, 610);
    field('POD completed', job.pod_generated_at, 585);
    field('Received by', job.client_signature_name, 560);
    field('Delivery photos', evidence.deliveryPhotoCount, 535);
    page.drawText('RECIPIENT SIGNATURE', { x: 40, y: 490, size: 11, font: bold, color: navy });
    const bytes = Buffer.from(signature.split(',')[1], 'base64');
    const image = /^data:image\/png/i.test(signature) ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
    const size = image.scaleToFit(400, 150);
    page.drawImage(image, { x: 40, y: 320, width: size.width, height: size.height });
    page.drawText('Delivery evidence stored securely in XDrive:', { x: 40, y: 288, size: 9, font: bold, color: navy });
    evidence.deliveryPhotos.slice(0, 9).forEach((path, index) => {
      page.drawText(safe(path, 115), { x: 40, y: 270 - index * 16, size: 7.5, font: regular, color: navy });
    });
    page.drawText('Original delivery photographs and signed evidence remain in secure job storage.', { x: 40, y: 40, size: 8, font: regular, color: navy });
    const data = await pdf.save();
    return new NextResponse(Buffer.from(data), { status: 200, headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="XDrive-POD.pdf"',
      'Cache-Control': 'private, no-store',
    } });
  } catch {
    return jsonError(500, 'POD PDF could not be generated.');
  }
}
