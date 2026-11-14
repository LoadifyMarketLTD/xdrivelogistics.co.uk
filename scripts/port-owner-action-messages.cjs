const fs=require('node:fs');
const files={
 action:'app/driver/action-centre/page.tsx',
 messages:'app/driver/messages/page.tsx',
};
const load=p=>fs.readFileSync(p,'utf8').replaceAll('\r\n','\n');
function patch(s,a,b){const n=s.split(a).length-1;if(n!==1)throw Error('Expected 1 marker, got '+n+': '+a.slice(0,130));return s.replace(a,b)}
let a=load(files.action);
a=patch(a,
"import { readRouteAuthAccessToken } from '../../../lib/routeAuthCookie';",
"import { readRouteAuthAccessToken } from '../../../lib/routeAuthCookie';\nimport { resolveWorkspaceRole } from '../../../lib/workspaceRole';");
a=patch(a,
"  const { user } = useAuth();",
"  const { user } = useAuth();\n  const isOwnerDriver = resolveWorkspaceRole(user) === 'owner_driver';");
a=patch(a,
'      <DriverWorkspaceShell\n        driverName="Action Centre"',
'      <DriverWorkspaceShell\n        hideHeader={isOwnerDriver}\n        driverName="Action Centre"');
a=patch(a,
'headerActions={<ActionButton tone="primary" disabled={loading} onClick={() => void loadRows()}>Refresh</ActionButton>}',
'headerActions={isOwnerDriver ? undefined : <ActionButton tone="primary" disabled={loading} onClick={() => void loadRows()}>Refresh</ActionButton>}');
a=patch(a,
`        <DriverIntegratedNav label="Action Centre tools" items={[{ href: '/driver/action-centre', label: 'Actions' }, { href: '/driver/messages', label: 'Messages' }]} />`,
`        {!isOwnerDriver && <DriverIntegratedNav label="Action Centre tools" items={[{ href: '/driver/action-centre', label: 'Actions' }, { href: '/driver/messages', label: 'Messages' }]} />}`);
a=patch(a,
'<div className="driver-board-layout driver-action-centre-board">',
'<div className={isOwnerDriver ? "driver-board-layout driver-action-centre-board xd-owner-action" : "driver-board-layout driver-action-centre-board"}>');
a=patch(a,
`<div className="driver-load-cell"><span className="driver-cell-label">Status</span><strong className="driver-cell-primary">{formatLabel(row.status)}</strong><span className="driver-cell-secondary"><StatusBadge value={formatLabel(row.status)} tone={tone} /></span></div>`,
`<div className="driver-load-cell"><span className="driver-cell-label">Status</span>{isOwnerDriver ? <StatusBadge value={formatLabel(row.status)} tone={tone} /> : <><strong className="driver-cell-primary">{formatLabel(row.status)}</strong><span className="driver-cell-secondary"><StatusBadge value={formatLabel(row.status)} tone={tone} /></span></>}</div>`);
a=patch(a,
`<div className="driver-load-row__meta"><span>Action #{row.id.slice(0, 8).toUpperCase()}</span><StatusBadge value={formatLabel(row.status)} tone={tone} /><div className="driver-row-actions">`,
`<div className="driver-load-row__meta"><span>{isOwnerDriver ? (row.source === 'operational' ? 'Operational action' : 'Notification') : 'Action #' + row.id.slice(0, 8).toUpperCase()}</span>{!isOwnerDriver && <StatusBadge value={formatLabel(row.status)} tone={tone} />}<div className="driver-row-actions">`);
fs.writeFileSync(files.action,a,'utf8');
let m=load(files.messages);
m=patch(m,
"import { readRouteAuthAccessToken } from '../../../lib/routeAuthCookie';",
"import { readRouteAuthAccessToken } from '../../../lib/routeAuthCookie';\nimport { useAuth } from '../../components/AuthContext';\nimport { resolveWorkspaceRole } from '../../../lib/workspaceRole';");
m=patch(m,
"  const router = useRouter();",
"  const router = useRouter();\n  const { user } = useAuth();\n  const isOwnerDriver = resolveWorkspaceRole(user) === 'owner_driver';");
m=patch(m,
'      <DriverWorkspaceShell\n        subtitle="Participant messages are separate from operational notifications. Messages are immutable once sent; the current schema does not store read/unread state."',
'      <DriverWorkspaceShell\n        hideHeader={isOwnerDriver}\n        subtitle={isOwnerDriver ? undefined : "Participant messages are separate from operational notifications. Messages are immutable once sent; the current schema does not store read/unread state."}');
m=patch(m,
`headerActions={<ActionButton tone="secondary" disabled={loading} onClick={() => void loadMessages()}>{loading ? 'Refreshing…' : 'Refresh'}</ActionButton>}`,
`headerActions={isOwnerDriver ? undefined : <ActionButton tone="secondary" disabled={loading} onClick={() => void loadMessages()}>{loading ? 'Refreshing…' : 'Refresh'}</ActionButton>}`);
m=patch(m,
`        <DriverIntegratedNav label="Action Centre tools" items={[{ href: '/driver/action-centre', label: 'Actions' }, { href: '/driver/messages', label: 'Messages' }]} />`,
`        {!isOwnerDriver && <DriverIntegratedNav label="Action Centre tools" items={[{ href: '/driver/action-centre', label: 'Actions' }, { href: '/driver/messages', label: 'Messages' }]} />}`);
m=patch(m,
'<div className="driver-board-layout driver-messages-board">',
'<div className={isOwnerDriver ? "driver-board-layout driver-messages-board xd-owner-messages" : "driver-board-layout driver-messages-board"}>');
m=patch(m,
'Existing participant conversations. New arbitrary recipients are not exposed by the verified messaging contract.',
"{isOwnerDriver ? 'Conversations connected to your transport jobs and quotes.' : 'Existing participant conversations. New arbitrary recipients are not exposed by the verified messaging contract.'}");
m=patch(m,
`            <div className="driver-tab-strip" role="tablist" aria-label="Messaging workspace">
              <button type="button" data-active="true">Conversations <span>{threads.length}</span></button>
            </div>`,
`            {!isOwnerDriver && <div className="driver-tab-strip" role="tablist" aria-label="Messaging workspace">
              <button type="button" data-active="true">Conversations <span>{threads.length}</span></button>
            </div>}`);
m=patch(m,
`<span>{threads.length} conversation{threads.length === 1 ? '' : 's'} · no fabricated read-state</span>`,
`<span>{threads.length} conversation{threads.length === 1 ? '' : 's'}{isOwnerDriver ? '' : ' · no fabricated read-state'}</span>`);
m=patch(m,
`<StatusBadge value="Participant scoped" tone="green" />`,
`<StatusBadge value={isOwnerDriver ? 'Verified participants' : 'Participant scoped'} tone="green" />`);
fs.writeFileSync(files.messages,m,'utf8');
const base='C:/Users/xdriv/Desktop/XDrive-OwnerDriver-Redesign-20261113/app/driver/xdrive-operations-v8.css';
let css=load(base);
css=css.slice(0,css.indexOf('.xdrive-driver-workspace .xd-driver-event-log .workspace-operational-row{'));
css=css.replaceAll('.driver-action-centre-board','.xd-owner-action').replaceAll('.driver-messages-board','.xd-owner-messages');
css+='\n@media(max-width:1100px){.xdrive-driver-workspace .xd-owner-action .driver-load-row__top{grid-template-columns:repeat(2,minmax(0,1fr))!important}}\n';
css+='@media(max-width:680px){.xdrive-driver-workspace .xd-owner-action .driver-load-row__top{grid-template-columns:minmax(0,1fr)!important}.xdrive-driver-workspace .xd-owner-messages .driver-row-details article.driver-load-row{max-width:100%;min-width:0;width:auto}}\n';
fs.writeFileSync('app/driver/xdrive-owner-actions-messages.css',css,'utf8');
console.log('Owner-only Action Centre + Messages presentation, preserving data writes and Company Driver behavior.');
