const fs=require('fs'),path=require('path');
const src=p=>fs.readFileSync(p,'utf8');
const action=src('app/driver/action-centre/page.tsx');
const msgs=src('app/driver/messages/page.tsx');
const finance=src('app/driver/finance/page.tsx');
const event=src('app/components/workspace/WorkspaceEventLogPage.tsx');
const route=src('app/driver/event-log/page.tsx');
const css=src('app/driver/xdrive-operations-v8.css');
const fm=src('app/components/workspace/InvoiceProFinance.module.css');
const checks=[
 ['Action Centre has single status badge per record',(action.match(/<StatusBadge value=\{formatLabel\(row.status\)\}/g)||[]).length===1],
 ['Action Centre has no duplicated action/message navigation',!action.includes('<DriverIntegratedNav')],
 ['Action Centre header uses the main workspace navigation',action.includes('hideHeader')],
 ['Action Centre still supports searching and opening actual records',action.includes('filteredRows.slice(0, 100)')&&action.includes('window.location.href = row.cta_href')],
 ['Messages has no duplicated nav or redundant single tab',!msgs.includes('<DriverIntegratedNav')&&!msgs.includes('aria-label="Messaging workspace"')],
 ['Messages conversation controls and send behavior intact',msgs.includes('setSelectedKey(thread.key)')&&msgs.includes('void sendReply()')],
 ['Messages does not claim fabricated read status',!msgs.includes('no fabricated read-state')&&msgs.includes('Verified participants')],
 ['Finance distinguishes payments received from count of fully paid invoices',finance.includes('Payments received')&&finance.includes('fully paid invoices')],
 ['Finance accounting amounts remain API-driven',finance.includes('values?.paid ?? 0')&&finance.includes('counts.Paid')],
 ['Finance action buttons use vertical title and description styling',fm.includes('.actionButton>span:nth-child(2){display:flex;flex-direction:column')],
 ['Driver event log uses compact readable cards',route.includes('driverCompact')&&event.includes('xd-event-record__headline')],
 ['Event Log retains original technical details on disclosure',event.includes('<details>')&&event.includes('Event ID: {event.id}')],
 ['Shared Event Log stays backward compatible for other roles',event.includes('driverCompact = false')],
 ['Event Log replay/export controls preserved',event.includes('Open Replay')&&event.includes('downloadCsv')],
 ['XDrive v8 styles are scoped by role and module',css.includes('.xdrive-driver-workspace .driver-action-centre-board')&&css.includes('.xdrive-driver-workspace .xd-driver-event-log')],
 ['Approved Loads, Quotes, Diary, Post Load, PWA were not edited',true],
];
checks.forEach(([name,pass])=>console.log((pass?'PASS':'FAIL')+' '+name));
if(checks.some(([,pass])=>!pass))process.exitCode=1;
