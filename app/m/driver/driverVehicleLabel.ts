export function driverVehicleLabel(value: string | null | undefined): string {
  if (!value?.trim()) return 'Vehicle not specified';
  const normalized = value.trim().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').toLowerCase();
  const labels: Record<string, string> = {
    swb: 'SWB Van', mwb: 'MWB Van', lwb: 'LWB Van', xlwb: 'XLWB Van',
    luton: 'Luton Van', 'luton tail lift': 'Luton Van with Tail Lift',
    'small van': 'Small Van', 'box van': 'Box Van', '7 5t': '7.5t Truck',
  };
  return labels[normalized] || normalized.replace(/\b\w/g, letter => letter.toUpperCase());
}
