export function workspaceVehicleImageSrc(label: string) {
  const value = String(label ?? '').toLowerCase().replace(/_/g, ' ');
  if (/\bluton\b|box van|box truck|tail lift/.test(value)) return '/assets/vehicles/luton.png';
  if (/\bxlwb\b|extra[- ]?long|4m\+/.test(value)) return '/assets/vehicles/xlwb.png';
  if (/\blwb\b|long wheelbase|up to 4m/.test(value)) return '/assets/vehicles/lwb.png';
  if (/\bmwb\b|medium wheelbase/.test(value)) return '/assets/vehicles/lwb.png';
  if (/\bswb\b|short wheelbase/.test(value)) return '/assets/vehicles/swb.png';
  if (/small van|s\/van|compact|car derived/.test(value)) return '/assets/vehicles/small-van.png';
  return '/assets/vehicles/swb.png';
}
