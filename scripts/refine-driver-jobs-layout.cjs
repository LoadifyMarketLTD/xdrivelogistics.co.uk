const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');
const file=path.join(root,'app/driver/jobs/page.tsx');
const src=fs.readFileSync(file,'utf8');
const start='                    <div className="driver-load-row__top">';
const end='                    <div className="driver-load-row__meta">';
const a=src.indexOf(start),b=src.indexOf(end,a+start.length);
if(a<0||b<0||src.indexOf(start,a+start.length)!==-1)throw Error('Cannot unambiguously locate My Jobs card');
const block=`                    <div className="xd-booking-heading">
                      <span className="xd-booking-heading__type">Assigned transport</span>
                      <span className="xd-booking-heading__ref">XDrive ref · {job.id.slice(0, 8).toUpperCase()}</span>
                      <span className="xd-booking-heading__state">{workspaceJobOperationalLabel(job)}</span>
                    </div>
                    <div className="driver-load-row__top xd-booking-card__main">
                      <section className="xd-booking-card__route">
                        <div className="xd-booking-card__field"><span className="driver-cell-label">From</span><strong className="driver-cell-primary">{job.pickup_location ?? 'Collection'}</strong></div>
                        <div className="xd-booking-card__field"><span className="driver-cell-label">To</span><strong className="driver-cell-primary">{job.delivery_location ?? 'Delivery'}</strong></div>
                      </section>
                      <section className="xd-booking-card__times">
                        <div className="xd-booking-card__field"><span className="driver-cell-label">Pickup</span><strong className="driver-cell-primary">{job.pickup_postcode ?? 'Postcode TBC'}</strong><span className="driver-cell-secondary">{fmtDate(job.pickup_datetime)} {fmtTime(job.pickup_datetime)}</span></div>
                        <div className="xd-booking-card__field"><span className="driver-cell-label">Delivery</span><strong className="driver-cell-primary">{job.delivery_postcode ?? 'Postcode TBC'}</strong><span className="driver-cell-secondary">{fmtDate(job.delivery_datetime)} {fmtTime(job.delivery_datetime)}</span></div>
                      </section>
                      <section className="xd-booking-card__state">
                        <div className="xd-booking-card__field"><span className="driver-cell-label">Vehicle</span><strong className="driver-cell-primary">{vehicleLabel(job)}</strong><span className="driver-cell-secondary">{job.cargo_type?.replace(/_/g, ' ') ?? 'Cargo not specified'}</span></div>
                        <div className="xd-booking-card__field"><span className="driver-cell-label">Execution</span><strong className="driver-cell-primary">{workspaceJobOperationalLabel(job)}</strong><span className="driver-cell-secondary">{hasPod ? 'Delivery photo evidence captured' : inExecution ? 'Execution in progress' : complete ? 'Execution complete' : stage === 'allocated' || stage === 'awarded' ? 'Assigned / awaiting execution' : 'Job record'}</span></div>
                      </section>
                    </div>
`;
fs.writeFileSync(file,src.slice(0,a)+block+src.slice(b),'utf8');
console.log('Rebuilt booking cards into 3 XDrive information zones');
