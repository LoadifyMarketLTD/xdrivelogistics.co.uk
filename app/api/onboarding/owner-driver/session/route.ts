import { buildSessionHandlers } from '../../_lib/handlers';
import { ownerDriverPatchSchema } from '../../_lib/schemas';

const handlers = buildSessionHandlers({
  expectedAccountType: 'owner_driver',
  patchSchema: ownerDriverPatchSchema,
});

export const GET = handlers.GET;
export const PATCH = handlers.PATCH;
