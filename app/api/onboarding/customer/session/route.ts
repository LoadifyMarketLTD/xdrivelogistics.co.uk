import { buildSessionHandlers } from '../../_lib/handlers';
import { customerPatchSchema } from '../../_lib/schemas';

const handlers = buildSessionHandlers({
  expectedAccountType: 'customer_shipper',
  patchSchema: customerPatchSchema,
});

export const GET = handlers.GET;
export const PATCH = handlers.PATCH;
