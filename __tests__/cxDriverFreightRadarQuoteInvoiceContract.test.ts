import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('CX-close Driver marketplace radar / quote / invoice contract', () => {
  const advancedSearch = read('app/driver/loads/search/page.tsx');
  const searchApi = read('app/api/driver/search-loads/route.ts');
  const vehicleRange = read('lib/vehicleSizeRange.ts');
  const radar = read('app/driver/_components/DriverMarketplaceRadarMap.tsx');
  const quoteModal = read('app/driver/_components/MarketplaceQuoteModal.tsx');
  const invoicePreview = read('app/driver/_components/DriverInvoicePreviewModal.tsx');
  const invoiceRoute = read('app/api/driver/finance/invoices/[id]/preview/route.ts');
  const css = read('app/driver/driver-cx-loads-convergence.css');

  it('keeps list and Interactive Freight Radar Map as two presentations of the same advanced search results', () => {
    expect(advancedSearch).toContain("type SearchView = 'list' | 'map'");
    expect(advancedSearch).toContain('Interactive Freight Radar Map');
    expect(advancedSearch).toContain('<DriverMarketplaceRadarMap loads={radarLoads} />');
    expect(advancedSearch).toContain('OperationalExpandAllControl');
    expect(advancedSearch).toContain('Save as Default');
    expect(advancedSearch).toContain('On Demand');
    expect(advancedSearch).toContain('Regular Load');
    expect(advancedSearch).toContain('Daily Hire');
  });

  it('supports a canonical minimum/maximum vehicle range without forcing specialist capabilities into a fake size order', () => {
    expect(advancedSearch).toContain('Minimum vehicle');
    expect(advancedSearch).toContain('Maximum vehicle');
    expect(advancedSearch).toContain('minVehicle: activeFilters.minVehicle');
    expect(advancedSearch).toContain('maxVehicle: activeFilters.maxVehicle');
    expect(advancedSearch).toContain('Minimum vehicle must not be larger than maximum vehicle.');
    expect(searchApi).toContain("searchParams.get('minVehicle')");
    expect(searchApi).toContain("searchParams.get('maxVehicle')");
    expect(searchApi).toContain('vehicleMatchesMarketplaceSizeRange');
    expect(vehicleRange).toContain('MARKETPLACE_VEHICLE_SIZE_ORDER');
    expect(vehicleRange).toContain('Specialist capabilities');
    expect(vehicleRange).not.toContain("'hiab',");
    expect(vehicleRange).not.toContain("'moffett',");
    expect(vehicleRange).not.toContain("'adr_vehicle',");
  });

  it('keeps the Driver radar privacy-safe by locating public outcodes rather than accepting private job coordinates', () => {
    expect(radar).toContain('pickupPostcode');
    expect(radar).toContain('deliveryPostcode');
    expect(radar).toContain('L.polyline');
    expect(radar).toContain('driver-radar-direction-icon');
    expect(radar).toContain('Dashed arrow = pickup → delivery direction using public outcodes');
    expect(radar).toContain('api.postcodes.io/outcodes');
    expect(radar).toContain('public pickup and delivery postcode/outcode centroids only');
    expect(radar).not.toContain('pickup_lat');
    expect(radar).not.toContain('pickup_lng');
    expect(radar).not.toContain('delivery_lat');
    expect(radar).not.toContain('delivery_lng');
  });

  it('keeps Quote Now contextual while preserving the existing bid API payload', () => {
    expect(advancedSearch).toContain("fetch('/api/driver/bids'");
    expect(advancedSearch).toContain('jobId: quoteTarget.id, amount, message: quoteMessage.trim()');
    expect(advancedSearch).toContain('<MarketplaceQuoteModal');
    expect(quoteModal).toContain('My quote price (exc. VAT)');
    expect(quoteModal).toContain('Submit Quote');
    expect(quoteModal).not.toContain('Vehicle selector');
  });

  it('keeps contextual invoice preview behind the existing authenticated PDF endpoint', () => {
    expect(invoicePreview).toContain('/api/driver/finance/invoices/${encodeURIComponent(invoiceId)}/preview');
    expect(invoicePreview).toContain('Authorization: `Bearer ${token}`');
    expect(invoicePreview).toContain('URL.createObjectURL(blob)');
    expect(invoicePreview).toContain('URL.revokeObjectURL(objectUrl)');
    expect(invoicePreview).toContain('Return to Diary');
    expect(invoiceRoute).toContain("'owner', 'admin', 'dispatcher', 'finance', 'driver'");
    expect(invoiceRoute).toContain("'Content-Type': 'application/pdf'");
    expect(invoiceRoute).toContain("'Content-Disposition': `inline;");
  });

  it('keeps new interactions on the measured XDrive spacing contract', () => {
    expect(css).toContain('var(--ws-tab-h, 28px)');
    expect(css).toContain('var(--ws-control-h, 32px)');
    expect(css).toContain('var(--ws-radius, 4px)');
    expect(css).not.toContain('border-radius: 12px');
  });

  it('does not introduce Super Admin coupling', () => {
    expect(advancedSearch).not.toContain('/super-admin');
    expect(searchApi).not.toContain('/super-admin');
    expect(radar).not.toContain('/super-admin');
    expect(quoteModal).not.toContain('/super-admin');
    expect(invoicePreview).not.toContain('/super-admin');
  });
});
