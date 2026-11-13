const fs=require('fs');
const file='app/driver/jobs/page.tsx';let x=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
const head='                    <div className="driver-load-row__top xd-booking-card__main">';
const end='                    <div className="driver-load-row__meta">';
const a=x.indexOf(head),b=x.indexOf(end,a+head.length);
if(a<0||b<0||x.indexOf(head,a+1)!==-1)throw Error('My Jobs card cannot be reliably identified');
x=x.slice(0,a)+`                    <XDriveTransportOverview
                      tone="diary"
                      from={job.pickup_location ?? job.pickup_postcode ?? 'Collection not supplied'}
                      to={job.delivery_location ?? job.delivery_postcode ?? 'Destination not supplied'}
                      pickup={{primary:fmtTime(job.pickup_datetime),meta:fmtDate(job.pickup_datetime)}}
                      delivery={{primary:fmtTime(job.delivery_datetime),meta:fmtDate(job.delivery_datetime)}}
                      status={workspaceJobOperationalLabel(job)}
                      caption={job.cargo_type?.replace(/_/g,' ') ?? 'Cargo not specified'}
                      stamp={hasPod ? 'Delivery photos recorded · Check POD in Diary' : inExecution ? 'Execution in progress' : complete ? 'Execution complete' : 'Assigned transport'}
                      vehicle={vehicleLabel(job)}
                    />
`+x.slice(b);
const before="import DriverIntegratedNav from '../_components/DriverIntegratedNav';";
if(!x.includes(before))throw Error('Missing import');
x=x.replace(before,"import XDriveTransportOverview from '../../components/workspace/XDriveTransportOverview';");
const nav='<DriverIntegratedNav label="Diary tools" items={[{ href: \'/driver/history\', label: \'Diary\' }, { href: \'/driver/jobs\', label: \'My Jobs\' }]} />';
if(x.split(nav).length!==2)throw Error('Navigation marker missing');
x=x.replace(nav,'');
x=x.replace('        subtitle="Assigned work, live execution and POD hand-off in one compact board."','        hideHeader');
const statusLine='                      <span className="xd-booking-heading__state">{workspaceJobOperationalLabel(job)}</span>';
if(!x.includes(statusLine))throw Error('Missing duplicate status marker');
x=x.replace(statusLine,'');
fs.writeFileSync(file,x,'utf8');
console.log('My Jobs now uses same XDrive journey/schedule/transport overview; duplicate page heading and subnav removed');
