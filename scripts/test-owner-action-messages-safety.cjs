const fs=require('node:fs');
const cp=require('node:child_process');
const read=p=>fs.readFileSync(p,'utf8');
const action=read('app/driver/action-centre/page.tsx');
const messages=read('app/driver/messages/page.tsx');
const css=read('app/driver/xdrive-owner-actions-messages.css');
const x = [
['Owner Driver uses scoped Action Centre layout',action.includes('xd-owner-action') && action.includes('hideHeader={isOwnerDriver}')],
['Company Driver preserves existing Action Centre header and navigation',action.includes('headerActions={isOwnerDriver ? undefined')&&action.includes('!isOwnerDriver && <DriverIntegratedNav')],
['Action status not duplicated in Owner Driver',action.includes('isOwnerDriver ? <StatusBadge')&&action.includes('!isOwnerDriver && <StatusBadge')],
['Action navigation and filtering intact',action.includes('setView(item.id)')&&action.includes('window.location.href = row.cta_href')&&action.includes('loadRows()')],
['Owner Driver uses scoped messages layout',messages.includes('xd-owner-messages')&&messages.includes('hideHeader={isOwnerDriver}')],
['Company Driver message tab and nav preserved',messages.includes('!isOwnerDriver && <DriverIntegratedNav')&&messages.includes('!isOwnerDriver && <div className="driver-tab-strip"')],
['Messages still supports authenticated API and reply action',messages.includes('readRouteAuthAccessToken')&&messages.includes('sendReply')&&messages.includes('loadMessages()')],
['No arbitrary messaging or fabricated read-state',messages.includes('Verified participants')&&messages.includes('contextTargetMissing')&&messages.includes('No verified conversation exists')],
['Action Centre CSS only targets owner class',!css.includes('.driver-action-centre-board')&&css.includes('.xd-owner-action')],
['Messages CSS only targets owner class',!css.includes('.driver-messages-board')&&css.includes('.xd-owner-messages')],
['Post Load unmodified',!(cp.execFileSync('git',['diff','--name-only','origin/main','--','app/driver/post-load','app/admin/post-load'],{encoding:'utf8'}).trim())],
];
for(const [name,pass] of x)console.log((pass?'PASS':'FAIL')+' '+name);
if(x.some(([,pass])=>!pass))process.exitCode=1;
