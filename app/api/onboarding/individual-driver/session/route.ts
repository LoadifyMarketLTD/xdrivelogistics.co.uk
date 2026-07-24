import { buildSessionHandlers } from '../../_lib/handlers';
import { individualDriverPatchSchema } from '../../_lib/schemas';

const handlers = buildSessionHandlers({
  expectedAccountType: 'individual_driver',
  patchSchema: individualDriverPatchSchema,
});

export const GET = handlers.GET;
export const PATCH = handlers.PATCH;
