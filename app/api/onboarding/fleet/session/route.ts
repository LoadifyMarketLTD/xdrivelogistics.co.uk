import { buildSessionHandlers } from '../../_lib/handlers';
import { fleetPatchSchema } from '../../_lib/schemas';

const handlers = buildSessionHandlers({
  expectedAccountType: 'fleet_courier',
  patchSchema: fleetPatchSchema,
});

export const GET = handlers.GET;
export const PATCH = handlers.PATCH;
