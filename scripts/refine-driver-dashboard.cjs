const fs=require('node:fs');
const f='app/driver/page.tsx';
const s=fs.readFileSync(f,'utf8'),tag='className="driver-owner-parity-grid xdrive-owner-dashboard-grid"';
const first=s.indexOf(tag),second=s.indexOf(tag,first+tag.length);
if(first===-1||second===-1||s.indexOf(tag,second+tag.length)!==-1)throw Error('Dashboard root not unique');
fs.writeFileSync(f,s.slice(0,second)+s.slice(second).replace(tag,'className="driver-owner-parity-grid xdrive-owner-dashboard-grid xd-owner-commercial-dashboard"'),'utf8');
console.log('Scoped commercial dashboard styling to Owner Driver only');
