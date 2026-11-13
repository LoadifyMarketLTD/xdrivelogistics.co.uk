const fs=require('fs'),base='app/driver/';
const read=p=>fs.readFileSync(p,'utf8').replaceAll('\r\n','\n');
function once(s,a,b){if(s.split(a).length!==2)throw Error('Unique marker required: '+a.slice(0,50));return s.replace(a,b)}
{
const p=base+'messages/page.tsx';let s=read(p);
s=once(s,"import DriverIntegratedNav from '../_components/DriverIntegratedNav';\n",'');
s=once(s,"        <DriverIntegratedNav label=\"Action Centre tools\" items={[{ href: '/driver/action-centre', label: 'Actions' }, { href: '/driver/messages', label: 'Messages' }]} />\n",'');
s=once(s,
`      <DriverWorkspaceShell
        subtitle="Participant messages are separate from operational notifications. Messages are immutable once sent; the current schema does not store read/unread state."
        headerActions={<ActionButton tone="secondary" disabled={loading} onClick={() => void loadMessages()}>{loading ? 'Refreshing…' : 'Refresh'}</ActionButton>}
      >`,
`      <DriverWorkspaceShell hideHeader>`
);
s=once(s,`            <div className="driver-tab-strip" role="tablist" aria-label="Messaging workspace">
              <button type="button" data-active="true">Conversations <span>{threads.length}</span></button>
            </div>
`,'');
s=s.replaceAll('��',' · ').replaceAll('�?�','...').replaceAll('Refreshing…','Refreshing...');
fs.writeFileSync(p,s);console.log('Messages simplified');
}
{
const p=base+'finance/page.tsx';let s=read(p);
s=once(s,'<div className={styles.metricLabel}>Paid</div>\n              <div className={styles.metricValue}>{money(values?.paid ?? 0)}</div>\n              <div className={styles.metricSub}>{counts.Paid} invoices</div>',
'<div className={styles.metricLabel}>Payments received</div>\n              <div className={styles.metricValue}>{money(values?.paid ?? 0)}</div>\n              <div className={styles.metricSub}>{counts.Paid} fully paid invoices</div>');
s=once(s,'<div className={styles.flowLabel}>Paid</div><div className={styles.flowSub}>Completed settlements</div>',
'<div className={styles.flowLabel}>Payments received</div><div className={styles.flowSub}>Recorded cash, including partial payments</div>');
fs.writeFileSync(p,s);console.log('Finance labels clarified');
}
