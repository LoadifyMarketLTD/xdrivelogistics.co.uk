const fs=require('node:fs');
const file='app/driver/jobs/page.tsx';
let text=fs.readFileSync(file,'utf8').replaceAll('\r\n','\n');
function once(a,b){if(text.split(a).length!==2)throw Error('Unexpected match '+a.slice(0,120));text=text.replace(a,b)}
once("import CxDiaryCard from '../../components/workspace/CxDiaryCard';",
"import CxDiaryCard from '../../components/workspace/CxDiaryCard';\nimport XDriveTransportOverview from '../../components/workspace/XDriveTransportOverview';");
once("import { useAuth } from '../../components/AuthContext';",
"import { useAuth } from '../../components/AuthContext';\nimport { resolveWorkspaceRole } from '../../../lib/workspaceRole';\nimport '../xdrive-operational-cards-v3.css';\nimport '../xdrive-owner-myjobs.css';");
once("import { ActionButton, AlertBanner, EmptyState } from '../../components/workspace/WorkspaceUI';",
"import { ActionButton, AlertBanner, EmptyState, StatusBadge } from '../../components/workspace/WorkspaceUI';");
once("  const { user } = useAuth();",
"  const { user } = useAuth();\n  const isOwnerDriver = resolveWorkspaceRole(user) === 'owner_driver';");
const card=String.raw`
                  if (isOwnerDriver) return (
                    <article key={job.id} className="driver-load-row xd-owner-job-card" data-state={status}>
                      <div className="xd-owner-job-heading">
                        <strong>Assigned transport</strong>
                        <span>XDrive ref · {job.id.slice(0, 8).toUpperCase()}</span>
                      </div>
                      <XDriveTransportOverview
                        tone="diary"
                        from={job.pickup_location ?? job.pickup_postcode ?? 'Collection not supplied'}
                        to={job.delivery_location ?? job.delivery_postcode ?? 'Destination not supplied'}
                        pickup={{primary:fmtTime(job.pickup_datetime),meta:fmtDate(job.pickup_datetime)}}
                        delivery={{primary:fmtTime(job.delivery_datetime),meta:fmtDate(job.delivery_datetime)}}
                        status={workspaceJobOperationalLabel(job)}
                        caption={job.cargo_type?.replace(/_/g, ' ') ?? 'Cargo not specified'}
                        stamp={hasPod ? 'POD complete' : isDeliveredAwaitingPod(job) ? 'POD action required' : inExecution ? 'Execution in progress' : complete ? 'Execution complete' : 'Assigned transport'}
                        vehicle={vehicleLabel(job)}
                      />
                      <div className="driver-load-row__meta xd-owner-job-actions">
                        <StatusBadge value={workspaceJobOperationalLabel(job)} tone={complete ? 'green' : inExecution ? 'orange' : stage === 'cancelled' ? 'red' : 'blue'} />
                        {hasPod && <StatusBadge value="POD complete" tone="green" />}
                        {isDeliveredAwaitingPod(job) && <StatusBadge value="POD action required" tone="orange" />}
                        <div className="driver-row-actions">
                          <ActionButton tone="secondary" onClick={() => toggleJob(job.id)}>{expanded ? 'Collapse' : 'Details'}</ActionButton>
                          <ActionButton tone={inExecution ? 'success' : 'secondary'} onClick={() => router.push('/driver/jobs/' + job.id)}>{inExecution ? 'Continue execution' : 'Open booking'}</ActionButton>
                        </div>
                      </div>
                      {expanded && <div className="driver-row-details">
                        <div className="driver-detail-grid">
                          <div className="driver-detail-item"><span>Pickup</span><strong>{fmtDate(job.pickup_datetime)} {fmtTime(job.pickup_datetime)}</strong></div>
                          <div className="driver-detail-item"><span>Delivery</span><strong>{fmtDate(job.delivery_datetime)} {fmtTime(job.delivery_datetime)}</strong></div>
                          <div className="driver-detail-item"><span>Vehicle</span><strong>{vehicleLabel(job)}</strong></div>
                          <div className="driver-detail-item"><span>Evidence</span><strong>{hasPod ? 'POD complete' : isDeliveredAwaitingPod(job) ? 'POD action required' : complete ? 'Review POD in booking' : 'Pending execution'}</strong></div>
                        </div>
                        <div className="driver-inline-quote driver-job-actions">
                          <span>Transport status and POD evidence remain managed through the authorised job execution workflow.</span>
                          <ActionButton tone={inExecution ? 'success' : 'secondary'} onClick={() => router.push('/driver/jobs/' + job.id)}>{inExecution ? 'Continue execution' : 'Open booking details'}</ActionButton>
                        </div>
                      </div>}
                    </article>
                  );
`;
once("                  return <CxDiaryCard",card+"                  return <CxDiaryCard");
fs.writeFileSync(file,text,'utf8');
console.log('Owner Driver My Jobs card added; full POD evidence and GPS detail route preserved.');
