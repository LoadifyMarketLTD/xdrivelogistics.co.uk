import fs from 'node:fs';
import path from 'node:path';

describe('phone GOLDEN posted-job decision flow contract', () => {
  const appSource = fs.readFileSync(
    path.join(process.cwd(), 'apps/xdrive-driver-phone-golden/src/app/DriverMobileAppV3.tsx'),
    'utf8',
  );
  const liveSource = fs.readFileSync(
    path.join(process.cwd(), 'apps/xdrive-driver-phone-golden/src/api/liveLoads.ts'),
    'utf8',
  );
  const apiSource = fs.readFileSync(
    path.join(process.cwd(), 'app/api/driver/mobile/nearby-jobs/route.ts'),
    'utf8',
  );

  it('publishes safe operational detail needed before a driver quotes', () => {
    for (const field of ['paymentTerms', 'notesSummary', 'specialRequirements', 'accessRestrictions', 'journeyDistanceMiles', 'estimatedJourneyMinutes']) {
      expect(liveSource).toContain(field);
    }
    expect(apiSource).toContain("'payment_terms'");
  });

  it('keeps company reputation verified and best-effort', () => {
    expect(apiSource).toContain(".from('reviews')");
    expect(apiSource).toContain('lowRatingCount');
    expect(appSource).toContain('No verified XDrive feedback yet');
  });

  it('uses one reusable posted-job context in detail and quote screens', () => {
    expect(appSource).toContain('function PostedLoadContext');
    expect(appSource).toContain('<PostedLoadContext load={load} />');
    expect(appSource).toContain('<PostedLoadContext load={load} showRouteAction={false} />');
    expect(appSource).toContain('Preview public route');
  });

  it('keeps empty operational notes out of Job instructions', () => {
    expect(apiSource).toContain('function publicJobInstructions');
    expect(apiSource).toContain('notesSummary: publicJobInstructions(row.load_details)');
    expect(appSource).toContain('<Text style={styles.sectionTitle}>Job instructions</Text>');
    expect(appSource).toContain('{load.notesSummary ? <Text style={styles.longText}>{load.notesSummary}</Text> : null}');
    expect(appSource).toContain('<Text style={styles.sectionTitle}>Requirements</Text>');
  });
  it('never converts missing numeric marketplace data into zero', () => {
    expect(apiSource).toContain('if (value === null || value === undefined) return null;');
    expect(apiSource).toContain("if (typeof value === 'string' && value.trim() === '') return null;");
  });
  it('expires stale delivered Return IQ and uses the real delivered timestamp', () => {
    expect(apiSource).toContain('status,delivered_at,updated_at');
    expect(apiSource).toContain('RETURN_IQ_DELIVERED_WINDOW_MS');
    expect(apiSource).toContain('return-work window after the last delivery has expired');
  });

  it('publishes public multi-stop sequencing without street-level stop addresses', () => {
    expect(apiSource).toContain(".from('job_stops')");
    expect(apiSource).toContain('publicStops: publicStopsByJob.get(row.id) ?? []');
    expect(apiSource).toContain('stop.postcode,');
    expect(apiSource).toContain(".select('job_id,sequence,stop_type,postcode,window_start,window_end')");
    expect(liveSource).toContain('publicStops?: Array');
    expect(appSource).toContain('Route stops');
  });

  it('does not expose raw service enum labels to the driver', () => {
    expect(appSource).toContain('function formatServiceMode');
    expect(appSource).toContain('value={formatServiceMode(load.serviceMode)}');
  });

  it('preserves pre-award privacy while keeping company decision context', () => {
    expect(appSource).toContain('Company & commercial');
    expect(appSource).toContain('Payment terms');
    expect(appSource).toContain('Member feedback');
    expect(appSource).toContain('Street-level addresses and private contacts remain protected until allocation.');
  });
});