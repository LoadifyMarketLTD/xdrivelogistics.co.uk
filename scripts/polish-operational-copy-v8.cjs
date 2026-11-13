const fs=require('fs'),p='app/driver/messages/page.tsx';
let s=fs.readFileSync(p,'utf8').replaceAll('\r\n','\n');
const changes=[
 ["Existing participant conversations. New arbitrary recipients are not exposed by the verified messaging contract.","Conversations connected to your transport jobs and quotes."],
 ["{threads.length} conversation{threads.length === 1 ? '' : 's'} · no fabricated read-state","{threads.length} conversation{threads.length === 1 ? '' : 's'}"],
 ['<StatusBadge value="Participant scoped" tone="green" />','<StatusBadge value="Verified participants" tone="green" />'],
];
for(const [a,b] of changes){if(!s.includes(a))throw Error('Missing '+a);s=s.replace(a,b)}
fs.writeFileSync(p,s);
console.log('Simplified customer-facing messaging copy without altering read-state claims or API.');
