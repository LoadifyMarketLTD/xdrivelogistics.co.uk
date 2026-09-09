import { describe, expect, it } from 'vitest';

import {
  selectBestCompatibleVehicle,
  vehicleRequiresDriverCpc,
} from '../lib/driverCpc';

describe('Driver CPC per vehicle', () => {
  it('does not require CPC for category-B 3.5t vans', () => {
    for (const type of ['van_small', 'swb_van', 'mwb_van', 'lwb_van', 'luton', 'luton_tail_lift', 'truck_3_5t']) {
      expect(vehicleRequiresDriverCpc({ type, maxWeightKg: 3500 })).toBe(false);
    }
  });

  it('requires CPC above 3.5t for standard goods vehicles', () => {
    for (const type of ['truck_5t', 'truck_7_5t', 'truck_12t', 'truck_18t', 'truck_26t', 'artic']) {
      expect(vehicleRequiresDriverCpc({ type })).toBe(true);
    }
    expect(vehicleRequiresDriverCpc({ type: 'luton', maxWeightKg: 5000 })).toBe(true);
  });

  it('keeps zero-emission category-B vehicles exempt through 4.25t', () => {
    expect(vehicleRequiresDriverCpc({ type: 'van_large', maxWeightKg: 4250, zeroEmission: true })).toBe(false);
    expect(vehicleRequiresDriverCpc({ type: 'van_large', maxWeightKg: 4251, zeroEmission: true })).toBe(true);
  });

  it('selects the smallest compatible vehicle for the job', () => {
    const vehicles = [
      { id: 'truck', type: 'truck_7_5t', max_weight_kg: 7500 },
      { id: 'luton', type: 'luton', max_weight_kg: 3500 },
    ];

    expect(selectBestCompatibleVehicle(vehicles, 'luton')?.id).toBe('luton');
    expect(selectBestCompatibleVehicle(vehicles, 'truck_7_5t')?.id).toBe('truck');
  });

  it('does not let a light vehicle cover a heavy-vehicle job', () => {
    const vehicles = [{ id: 'luton', type: 'luton', max_weight_kg: 3500 }];
    expect(selectBestCompatibleVehicle(vehicles, 'truck_7_5t')).toBeNull();
  });
});