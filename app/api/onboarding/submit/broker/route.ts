import { buildSubmitHandler } from '../../_lib/handlers';
import { brokerPayloadSchema } from '../../_lib/schemas';

export const POST = buildSubmitHandler({
  expectedAccountType: 'transport_broker',
  payloadSchema: brokerPayloadSchema,
});
