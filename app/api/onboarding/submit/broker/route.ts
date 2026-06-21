import { buildSubmitHandler } from '../../_lib/handlers';
import { brokerPayloadSchema } from '../../_lib/schemas';

export const POST = buildSubmitHandler({
  expectedAccountType: 'broker_shipper',
  payloadSchema: brokerPayloadSchema,
  persist: async () => undefined,
});
