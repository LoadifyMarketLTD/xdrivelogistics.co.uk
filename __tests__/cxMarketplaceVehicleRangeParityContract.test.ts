import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('CX marketplace vehicle range parity', () => {
  const driverUi = read('app/driver/loads/search/page.tsx');
  const driverApi = read('app/api/driver/search-loads/route.ts');
  const companyUi = read('app/components/workspace/CompanyMarketplaceExchange.tsx');
  const companyApi = read('app/api/marketplace/company/route.ts');
  const range = read('lib/vehicleSizeRange.ts');

  it('uses the same canonical size taxonomy in Driver and Company workspaces', () => {
    expect(driverUi).toContain('marketplaceVehicleSizeOptions');
    expect(companyUi).toContain('marketplaceVehicleSizeOptions');
    expect(driverUi).toContain('Minimum vehicle');
    expect(driverUi).toContain('Maximum vehicle');
    expect(companyUi).toContain('Minimum vehicle');
    expect(companyUi).toContain('Maximum vehicle');
    expect(range).toContain('MARKETPLACE_VEHICLE_SIZE_ORDER');
  });

  it('sends min/max to both APIs and filters before totals/pagination', () => {
    expect(driverUi).toContain('minVehicle: activeFilters.minVehicle');
    expect(driverUi).toContain('maxVehicle: activeFilters.maxVehicle');
    expect(companyUi).toContain("['minVehicle', filters.minVehicle]");
    expect(companyUi).toContain("['maxVehicle', filters.maxVehicle]");
    expect(driverApi).toContain('vehicleMatchesMarketplaceSizeRange');
    expect(companyApi).toContain('vehicleMatchesMarketplaceSizeRange');
    expect(driverApi.indexOf('vehicleMatchesMarketplaceSizeRange(comparableVehicle')).toBeLessThan(driverApi.indexOf('const total = filtered.length'));
    expect(companyApi.indexOf('vehicleMatchesMarketplaceSizeRange(comparableVehicle')).toBeLessThan(companyApi.indexOf('const total = withBids.length'));
  });

  it('rejects inverted ranges in both UIs before search', () => {
    expect(driverUi).toContain('Minimum vehicle must not be larger than maximum vehicle.');
    expect(companyUi).toContain('Minimum vehicle must not be larger than maximum vehicle.');
    expect(driverUi).toContain('marketplaceVehicleSizeRank');
    expect(companyUi).toContain('marketplaceVehicleSizeRank');
  });

  it('keeps legacy exact/specialist filtering separate from the linear size range', () => {
    expect(driverUi).toContain('Exact / specialist vehicle');
    expect(companyUi).toContain('Exact / specialist vehicle');
    expect(range).not.toContain("'hiab',");
    expect(range).not.toContain("'moffett',");
    expect(range).not.toContain("'adr_vehicle',");
  });

  it('keeps older saved searches compatible after adding new fields', () => {
    expect(companyUi).toContain('setFilters({ ...DEFAULT_FILTERS, ...saved })');
    expect(companyUi).toContain('setFilters({ ...DEFAULT_FILTERS, ...found.filters })');
  });

  it('does not couple marketplace range search to Super Admin', () => {
    for (const source of [driverUi, driverApi, companyUi, companyApi, range]) {
      expect(source).not.toContain('/super-admin');
    }
  });
});
