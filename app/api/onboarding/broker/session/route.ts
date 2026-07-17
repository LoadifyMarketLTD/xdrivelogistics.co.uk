import { buildSessionHandlers } from '../../_lib/handlers';
import { brokerPatchSchema } from '../../_lib/schemas';

const handlers = buildSessionHandlers({
  expectedAccountType: 'broker_shipper',
  patchSchema: brokerPatchSchema,
});

export const GET = handlers.GET;
export const PATCH = handlers.PATCH;
