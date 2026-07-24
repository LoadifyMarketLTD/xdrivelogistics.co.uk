import { buildSubmitHandler } from '../../_lib/handlers';
import { individualDriverPayloadSchema } from '../../_lib/schemas';

export const POST = buildSubmitHandler({
  expectedAccountType: 'individual_driver',
  payloadSchema: individualDriverPayloadSchema,
});
