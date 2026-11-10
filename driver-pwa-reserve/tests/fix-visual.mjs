import fs from 'node:fs'
const file='src/App.tsx'
let s=fs.readFileSync(file,'utf8')
const pairs=[
['â€¢',' · '],['â˜°','Menu'],['â€¹','<'],['Â£','£'],['â˜·','Filter'],['âŒ–','Map'],['â–¤','Jobs'],['â–£','Bookings'],['âœ•','Close'],['â†’','→'],['âˆ’','-'],['Â·','·']
]
for(const [a,b] of pairs)s=s.split(a).join(b)
s=s.replace("(['Loads','Quotes','Bookings','Map','Invoices','More'] as Tab[])","(['Loads','Quotes','Bookings','More'] as Tab[])")
s=s.replace("['Jobs','£','Bookings','Map','£','Menu'][i]","['Jobs','£','Bookings','Menu'][i]")
s=s.replace("<h2>Driver profile</h2>","<button type=\"button\" onClick={()=>setTab('Invoices')}>Invoices</button><button type=\"button\" onClick={()=>setTab('Map')}>Map</button><h2>Driver profile</h2>")
s=s.replace('>Menu</button></header>',' aria-label="Open More menu">Menu</button></header>')
fs.writeFileSync(file,s,'utf8')
fs.writeFileSync('src/index.css',":root{font-family:Inter,system-ui,Arial,sans-serif;font-synthesis:none;text-rendering:optimizeLegibility;-webkit-font-smoothing:antialiased}html{min-width:320px}body{margin:0}#root{min-height:100dvh;width:100%}","utf8")
console.log('Replaced',pairs.map(([a])=>a).join(', '),'and reset conflicting Vite CSS')
