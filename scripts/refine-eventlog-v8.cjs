const fs=require('fs');
const file='app/components/workspace/WorkspaceEventLogPage.tsx';
let s=fs.readFileSync(file,'utf8').replaceAll('\r\n','\n');
const one=(a,b)=>{if(s.split(a).length!==2)throw Error('Expected one '+a.slice(0,70));s=s.replace(a,b)};
one("  description = 'Search and export operational events delivered to your authenticated account.',\n}: {",
    "  description = 'Search and export operational events delivered to your authenticated account.',\n  driverCompact = false,\n}: {");
one("  description?: string;\n}) {","  description?: string;\n  driverCompact?: boolean;\n}) {");
const anchor='<article key={event.id} className="workspace-operational-row">';
const branch=`<article key={event.id} className="workspace-operational-row">
                  {driverCompact ? (
                    <div className="xd-event-record">
                      <div className="xd-event-record__headline">
                        <strong>{eventLabel(event.event_type)}</strong>
                        <span>{fmtDate(event.created_at)}</span>
                      </div>
                      <div className="xd-event-record__context">
                        <span><b>Reference</b> {eventReference(event)}</span>
                        <span><b>Actor</b> {actorLabel(event)}</span>
                        <span><b>Source</b> {sourceLabel(event.source)}</span>
                      </div>
                      <p>{payloadSummary(event)}</p>
                      <div className="xd-event-record__footer">
                        <details>
                          <summary>Technical details</summary>
                          <div>Event ID: {event.id}</div>
                          <div>Entity ID: {event.entity_id ?? 'Not provided'}</div>
                          <div>Entity type: {event.entity_type ?? 'Not provided'}</div>
                        </details>
                        {replayJobId ? <ActionButton tone="secondary" onClick={() => window.location.assign(\`/job-replay/\${replayJobId}\`)}>Open Replay</ActionButton> : null}
                      </div>
                    </div>
                  ) : (
                  <>`;
one(anchor,branch);
const closing=`                  <div className="workspace-record-meta"><span>Event #{event.id.slice(0, 8).toUpperCase()}</span><span>Source: {sourceLabel(event.source)}</span>{replayJobId ? <ActionButton tone="secondary" onClick={() => window.location.assign(\`/job-replay/\${replayJobId}\`)}>Open Replay</ActionButton> : null}</div>
                </article>`;
one(closing,`                  <div className="workspace-record-meta"><span>Event #{event.id.slice(0, 8).toUpperCase()}</span><span>Source: {sourceLabel(event.source)}</span>{replayJobId ? <ActionButton tone="secondary" onClick={() => window.location.assign(\`/job-replay/\${replayJobId}\`)}>Open Replay</ActionButton> : null}</div>
                  </>
                  )}
                </article>`);
fs.writeFileSync(file,s,'utf8');
const driver='app/driver/event-log/page.tsx';
let d=fs.readFileSync(driver,'utf8').replaceAll('\r\n','\n');
if(!d.includes('<WorkspaceEventLogPage'))throw Error('Missing driver event component');
d=d.replace('<WorkspaceEventLogPage','<WorkspaceEventLogPage\n      driverCompact');
fs.writeFileSync(driver,d,'utf8');
console.log('Owner Driver Event Log now uses readable summary cards with expandable technical details.');
