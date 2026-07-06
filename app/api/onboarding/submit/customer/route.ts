import { buildSubmitHandler } from '../../_lib/handlers';
import { customerPayloadSchema } from '../../_lib/schemas';

export const POST = buildSubmitHandler({
  expectedAccountType: 'customer_shipper',
  payloadSchema: customerPayloadSchema,
});
