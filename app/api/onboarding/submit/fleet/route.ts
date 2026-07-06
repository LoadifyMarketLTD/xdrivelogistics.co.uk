import { buildSubmitHandler } from '../../_lib/handlers';
import { fleetPayloadSchema } from '../../_lib/schemas';

export const POST = buildSubmitHandler({
  expectedAccountType: 'fleet_courier',
  payloadSchema: fleetPayloadSchema,
});
