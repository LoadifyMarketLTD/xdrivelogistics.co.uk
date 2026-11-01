/** Read-only mapping contract for adapting the legacy DEMO JSON into existing Staging schema.
 * Never writes to Supabase. Explicitly rejects incomplete or ambiguous mappings.
 */
import type {Load,Quote} from './store';
import type {FleetVehicle} from './fleet';
export type DemoMappingContext={companyId:string;userId:string};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const numberOrNull=(value:string|undefined):number|null=>{if(!value?.trim())return null;const n=Number(value);return Number.isFinite(n)&&n>=0?n:null};
const extractOutcode=(value:string):string|null=>value.toUpperCase().trim().match(/(?:^|\s)([A-Z]{1,2}[0-9][A-Z0-9]?)(?:\s*[0-9][A-Z]{2})?$/)?.[1]||null;
export function assertDemoMappingContext(ctx:DemoMappingContext){if(!uuid.test(ctx.companyId)||!uuid.test(ctx.userId))throw Error('Verified staging company and user UUIDs required');}
export function previewLoadToJob(load:Load,ctx:DemoMappingContext){assertDemoMappingContext(ctx);if(!load.from.trim()||!load.to.trim())throw Error('Pickup and delivery required');const pallets=numberOrNull(load.pallets);const weight=numberOrNull(load.weight);if(pallets!==null&&!Number.isInteger(pallets))throw Error('Pallet count must be integer');if(load.pallets?.trim()&&pallets===null)throw Error('Invalid pallet count');if(load.weight?.trim()&&weight===null)throw Error('Invalid weight');return {company_id:ctx.companyId,created_by:ctx.userId,pickup_location:load.from,delivery_location:load.to,pickup_postcode:extractOutcode(load.from),delivery_postcode:extractOutcode(load.to),requested_vehicle_label:load.vehicle,pallets,weight_kg:weight,load_details:load.notes||null,payment_terms:load.paymentTerms||null,legacy_demo_id:load.id};}
export function previewQuoteToJobBid(quote:Quote,jobId:string,ctx:DemoMappingContext){assertDemoMappingContext(ctx);if(!uuid.test(jobId))throw Error('Canonical job UUID required');if(!Number.isFinite(quote.amount)||quote.amount<0)throw Error('Invalid quote amount');return {job_id:jobId,company_id:ctx.companyId,bidder_user_id:ctx.userId,amount:quote.amount,currency:'GBP',message:quote.notes||null,legacy_demo_quote_id:quote.id};}
export function previewFleetToVehicle(vehicle:FleetVehicle,ctx:DemoMappingContext){assertDemoMappingContext(ctx);if(!vehicle.reg.trim())throw Error('Vehicle registration required');return {company_id:ctx.companyId,registration:vehicle.reg,requested_vehicle_label:vehicle.vehicle,legacy_demo_vehicle_id:vehicle.id,unresolved_driver_display_name:vehicle.driver};}
