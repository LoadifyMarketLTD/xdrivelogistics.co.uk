const fs=require('node:fs');
const root='app/driver/';
const read=p=>fs.readFileSync(p,'utf8').replaceAll('\r\n','\n');
const one=(s,a,b,name)=>{if(s.split(a).length!==2)throw Error(name+': expected one '+a.slice(0,70));return s.replace(a,b)};
// Action Centre: one global navigation, one badge, human-readable reference and no repeated metadata.
{
let p=root+'action-centre/page.tsx',s=read(p);
s=one(s,"import DriverIntegratedNav from '../_components/DriverIntegratedNav';\n",'','Action import');
s=one(s,`        driverName="Action Centre"
        subtitle="Prioritised driver actions requiring review or acknowledgement."
        headerActions={<ActionButton tone="primary" disabled={loading} onClick={() => void loadRows()}>Refresh</ActionButton>}`,`        hideHeader`,'Action page header');
s=one(s,`        <DriverIntegratedNav label="Action Centre tools" items={[{ href: '/driver/action-centre', label: 'Actions' }, { href: '/driver/messages', label: 'Messages' }]} />
`,'','Action duplicate nav');
s=one(s,`                        <div className="driver-load-cell"><span className="driver-cell-label">Status</span><strong className="driver-cell-primary">{formatLabel(row.status)}</strong><span className="driver-cell-secondary"><StatusBadge value={formatLabel(row.status)} tone={tone} /></span></div>`,`                        <div className="driver-load-cell"><span className="driver-cell-label">Status</span><StatusBadge value={formatLabel(row.status)} tone={tone} /></div>`,'Action single badge');
s=one(s,`                      <div className="driver-load-row__meta"><span>Action #{row.id.slice(0, 8).toUpperCase()}</span><StatusBadge value={formatLabel(row.status)} tone={tone} /><div className="driver-row-actions">`,`                      <div className="driver-load-row__meta"><span>{row.source === 'operational' ? 'Operational action' : 'Notification'}</span><div className="driver-row-actions">`,'Action clean footer');
s=one(s,`{row.event_id?.slice(0, 8).toUpperCase() ?? row.id.slice(0, 8).toUpperCase()}`,`{row.event_id?.slice(0, 8).toUpperCase() ?? row.id.slice(0, 8).toUpperCase()}`,'Action reference untouched'); // no-op intentional verify
s=s.replaceAll('Refreshing�?�','Refreshing...').replaceAll('Loading Action Centre�?�','Loading Action Centre...');
fs.writeFileSync(p,s,'utf8');console.log('Action Centre: one navigation, one status, compact record footer');
}
// Messages: remove repeated Action Centre/Messages tabs; meaningful conversation structure.
{
let p=root+'messages/page.tsx',s=read(p);
s=one(s,"import DriverIntegratedNav from '../_components/DriverIntegratedNav';\n",'','Messages import');
const navRegex=/[ \t]*<DriverIntegratedNav label="[^"]+" items=\{\[\{ href: '\/driver\/action-centre', label: 'Actions' \}, \{ href: '\/driver\/messages', label: 'Messages' \}\]\} \/>\n/;
if(!navRegex.test(s))throw Error('Messages duplicate nav missing');
s=s.replace(navRegex,'');
const header=/[ \t]*driverName="Messages"\n[ \t]*subtitle="[^"]*"\n(?:[ \t]*headerActions=\{[^\n]*\}\n)?/;
if(!header.test(s))throw Error('Messages header shape changed');
s=s.replace(header,'        hideHeader\n');
const strip=`            <div className="driver-tab-strip" role="tablist" aria-label="Messaging workspace">
              <button type="button" data-active="true">Conversations <span>{threads.length}</span></button>
            </div>
`;
s=one(s,strip,'','Messages redundant single tab');
s=s.replaceAll('Refreshing�?�','Refreshing...').replaceAll('Loading messages�?�','Loading messages...').replaceAll('Sending�?�','Sending...');
s=s.replaceAll('��',' · ');
s=s.replaceAll('messages cannot be edited after sending','Messages cannot be edited after sending');
fs.writeFileSync(p,s,'utf8');console.log('Messages: removed duplicated navigation, single-option tab and encoding artifacts');
}
// Finance: don't claim 0 payment records; distinguish cash received from fully paid invoices.
// Also fix dashboard actions' text layout through CSS, no financial logic changes.
{
let p=root+'finance/page.tsx',s=read(p);
s=one(s,'<div className={styles.metricLabel}>Paid</div>\n              <div className={styles.metricValue}>{money(values?.paid ?? 0)}</div>\n              <div className={styles.metricSub}>{counts.Paid} invoices</div>',
'<div className={styles.metricLabel}>Payments received</div>\n              <div className={styles.metricValue}>{money(values?.paid ?? 0)}</div>\n              <div className={styles.metricSub}>{counts.Paid} fully paid invoices</div>','Finance paid metric');
s=one(s,'<div className={styles.flowLabel}>Paid</div><div className={styles.flowSub}>Completed settlements</div>',
'<div className={styles.flowLabel}>Payments received</div><div className={styles.flowSub}>Recorded cash, including partial payments</div>','Finance paid flow');
fs.writeFileSync(p,s,'utf8');console.log('Finance: payment amounts labeled separately from fully paid invoice count');
}
