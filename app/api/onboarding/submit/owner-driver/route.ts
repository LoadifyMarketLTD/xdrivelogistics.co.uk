import { buildSubmitHandler } from '../../_lib/handlers';
import { ownerDriverPayloadSchema } from '../../_lib/schemas';

export const POST = buildSubmitHandler({
  expectedAccountType: 'owner_driver',
  payloadSchema: ownerDriverPayloadSchema,
});
