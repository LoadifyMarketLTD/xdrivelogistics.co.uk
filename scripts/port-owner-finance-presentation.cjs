const fs=require('fs');
const file='app/driver/finance/page.tsx';
let t=fs.readFileSync(file,'utf8').replaceAll('\r\n','\n');
function one(a,b){if(t.split(a).length!==2)throw Error('Expected unique marker '+a);t=t.replace(a,b)}
one("import { readRouteAuthAccessToken } from '../../../lib/routeAuthCookie';","import { readRouteAuthAccessToken } from '../../../lib/routeAuthCookie';\nimport { resolveWorkspaceRole } from '../../../lib/workspaceRole';");
one("  const { user } = useAuth();","  const { user } = useAuth();\n  const isOwnerDriver = resolveWorkspaceRole(user) === 'owner_driver';");
one('<InvoiceProSurface data-testid="invoice-pro-driver-finance">','<InvoiceProSurface data-testid="invoice-pro-driver-finance" data-owner-finance={isOwnerDriver ? "true" : undefined}>');
fs.writeFileSync(file,t,'utf8');
const cssFile='app/components/workspace/InvoiceProFinance.module.css';
let css=fs.readFileSync(cssFile,'utf8');
const stamp='/* Owner Driver-only finance visual adjustments; canonical accounting and APIs unchanged. */';
if(css.includes(stamp))throw Error('Already applied');
css+='\n'+stamp+'\n'+
'.surface[data-owner-finance="true"]{gap:12px;--ip-line:#d8e3ef;--ip-bg:#f4f8fc;--ip-ink:#112f53}\n'+
'.surface[data-owner-finance="true"] .nav{border-radius:9px;box-shadow:none}\n'+
'.surface[data-owner-finance="true"] .navButton{border-radius:6px;min-height:37px;font-size:13px}\n'+
'.surface[data-owner-finance="true"] .metric{min-height:106px;border-radius:9px;padding:15px 16px;box-shadow:0 1px 4px rgba(17,47,83,.05)}\n'+
'.surface[data-owner-finance="true"] .metricLabel{font-size:11px;letter-spacing:.09em}\n'+
'.surface[data-owner-finance="true"] .metricValue{font-size:25px;line-height:1.15}\n'+
'.surface[data-owner-finance="true"] .metricSub{font-size:12px;line-height:18px}\n'+
'.surface[data-owner-finance="true"] .panel,.surface[data-owner-finance="true"] .register{border-radius:9px;box-shadow:0 1px 4px rgba(17,47,83,.05)}\n'+
'.surface[data-owner-finance="true"] .flow{border-radius:7px}\n'+
'.surface[data-owner-finance="true"] .flowRow{padding:12px}\n'+
'.surface[data-owner-finance="true"] .flowLabel{font-size:13px}\n'+
'.surface[data-owner-finance="true"] .flowSub{font-size:12px;line-height:17px}\n'+
'.surface[data-owner-finance="true"] .actionButton{grid-template-columns:30px minmax(0,1fr) 16px;border-radius:7px;gap:10px;min-height:53px;padding:9px 12px}\n'+
'.surface[data-owner-finance="true"] .actionButton>span:nth-child(2){display:flex;flex-direction:column;min-width:0;gap:3px}\n'+
'.surface[data-owner-finance="true"] .actionLabel{display:block;font-size:13px;line-height:18px;font-weight:800}\n'+
'.surface[data-owner-finance="true"] .actionSub{display:block;font-size:12px;line-height:17px;overflow-wrap:anywhere}\n'+
'.surface[data-owner-finance="true"] .actionIcon{width:29px;height:29px;border-radius:6px}\n'+
'.surface[data-owner-finance="true"] .table th{font-size:12px}\n'+
'.surface[data-owner-finance="true"] .table td{font-size:13px}\n'+
'@media(max-width:700px){.surface[data-owner-finance="true"] .actionButton{grid-template-columns:28px minmax(0,1fr) 12px}}\n';
fs.writeFileSync(cssFile,css,'utf8');
console.log('Scoped Owner Driver Invoice Pro redesign only; invoices status semantics, generation/review/send and financial calculations untouched.');
