import { buildSessionHandlers } from '../../_lib/handlers';
import { brokerPatchSchema } from '../../_lib/schemas';

const handlers = buildSessionHandlers({
  expectedAccountType: 'transport_broker',
  patchSchema: brokerPatchSchema,
});

export const GET = handlers.GET;
export const PATCH = handlers.PATCH;
