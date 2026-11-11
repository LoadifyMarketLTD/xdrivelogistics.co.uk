/**
 * Single navigation registry for operational workspace deep links.
 * A screen's route is authoritative; route sections choose the matching
 * Master Workspace tab without changing the underlying secured page actions.
 */
export const ADMIN_MASTER_SECTION_TABS: Readonly<Record<string, number>> = {
 'action-centre':16,'bids':3,'broker-invitations':9,'bulk-import':1,
 'collections':4,'companies':10,'deliveries':4,'diary':7,
 'dispatchers':6,'disputes':16,'documents':9,'driver-availability':11,
 'drivers':6,'drivers-vehicles':6,'event-log':7,'exchange':3,
 'exchange-quotes':3,'finance':8,'fleet':5,'freight-vision':13,
 'incidents':16,'invoices':8,'jobs':2,'live-availability':11,
 'marketplace':2,'network-tools':9,'messages':14,'notifications':15,'operations-centre':0,
 'pod':4,'post-load':1,'quotes':3,'reports':16,'returns':12,'settings':9,
 'support':9,'team':9,'vehicles':5,'won-work':4,
};
export const BROKER_MASTER_SECTION_TABS: Readonly<Record<string, number>> = {
 'post-load':1,'loads':2,'jobs':4,'quotes':3,'bids':3,
 'awards':3,'bookings':4,'fleet':5,'drivers':6,'diary':7,'invoices':8,'finance':8,
 'network':9,'carrier-network':9,'directory':10,'availability':11,'live-availability':11,'returns':12,'freight-vision':13,
 'messages':14,'notifications':15,'reports':16,'action-centre':16,
 'compare-quotes':3,'enquiries':3,'carrier-costs':8,'customer-invoices':8,
 'margins':8,'pod-review':4,'disputes':16,'event-log':7,
 'customers':10,'team':9,'settings':9,'account':9,'support':9,
 'bulk-import':1,'updates':15,
};
export const CUSTOMER_MASTER_SECTION_TABS: Readonly<Record<string, number>> = {
 'post-load':1,'bulk-import':1,loads:2,quotes:3,awards:3,
 bookings:4,jobs:4,tracking:4,deliveries:4,fleet:5,drivers:6,
 diary:7,'event-log':7,invoices:8,network:9,team:9,settings:9,
 account:9,documents:9,directory:10,'live-availability':11,
 returns:12,'freight-vision':13,messages:14,notifications:15,
 reports:16,'action-centre':16,disputes:16,updates:15,
};
export function customerMasterTab(pathname:string):number {
 const parts=pathname.split('/').filter(Boolean);
 if(parts[0]!=='customer'||parts.length===1)return 0;
 return CUSTOMER_MASTER_SECTION_TABS[parts[1]]??0;
}
export function adminMasterTab(pathname: string):number {
 const parts=pathname.split('/').filter(Boolean);
 if(parts[0]!=='admin'||parts.length===1) return 0;
 if(parts[1]==='marketplace'&&parts[2]==='directory')return 10;
 if(parts[1]==='fleet'){
   if(['returns'].includes(parts[2]))return 12;
   if(['assignments','active-jobs','jobs'].includes(parts[2]))return 4;
   if(['drivers','managers','resources'].includes(parts[2]))return 6;
   if(['positions','availability','future-availability'].includes(parts[2]))return 11;
 }
 return ADMIN_MASTER_SECTION_TABS[parts[1]] ?? 0;
}
export function brokerMasterTab(pathname: string):number {
 const section=pathname.split('/').filter(Boolean)[1];
 return BROKER_MASTER_SECTION_TABS[section??'']??0;
}
