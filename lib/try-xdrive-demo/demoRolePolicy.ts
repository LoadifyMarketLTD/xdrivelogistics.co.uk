/** DEMO authorization contract. Server-side check; UI flags are not authority. */
export type DemoAction="post_load"|"publish_load"|"cancel_load"|"award_quote"|"view_received_quotes"|"submit_quote";
const rolePermissions:Record<DemoAction,readonly string[]>={
 post_load:["owner","admin","dispatcher","manager"],
 publish_load:["owner","admin","dispatcher","manager"],
 cancel_load:["owner","admin","dispatcher","manager"],
 award_quote:["owner","admin","dispatcher"],
 view_received_quotes:["owner","admin","dispatcher","manager"],
 submit_quote:["owner","admin","dispatcher","manager","driver"]
};
export function mayPerformDemoAction(role:string,action:DemoAction):boolean {
 return rolePermissions[action].includes(role.trim().toLowerCase());
}
export function canAwardDemoQuote(args:{role:string;buyerCompanyId:string;actorCompanyId:string;carrierCompanyId:string;jobStatus:string;visibility:string;bidStatus:string;priorAwardedCarrierId?:string|null}):boolean {
 return mayPerformDemoAction(args.role,"award_quote")
  && args.buyerCompanyId===args.actorCompanyId
  && args.carrierCompanyId!==args.buyerCompanyId
  && args.carrierCompanyId.length>0
  && args.jobStatus==="posted"
  && args.visibility==="exchange"
  && args.bidStatus==="submitted"
  && !args.priorAwardedCarrierId;
}
