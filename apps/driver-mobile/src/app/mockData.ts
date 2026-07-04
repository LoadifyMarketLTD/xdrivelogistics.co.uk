import type { DriverJob } from '../jobs/types';

export const demoActiveJob: DriverJob = {
  id: 'demo-job',
  reference: 'XDL-READY',
  status: 'awarded',
  pickupLocation: 'Pickup assigned by dispatcher',
  deliveryLocation: 'Delivery assigned by dispatcher',
  pickupTime: 'Next pickup',
  deliveryTime: 'ETA pending',
  cargoType: 'Cargo confirmed in job',
  vehicleRequirement: 'Vehicle requirement confirmed',
  price: 'Price shown when allowed',
  priority: 'normal',
  podRequired: true,
  contactAllowed: false,
};
