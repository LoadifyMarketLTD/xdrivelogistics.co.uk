import fs from 'node:fs'
let s=fs.readFileSync('src/App.tsx','utf8')
s=s.replace('< Back to {tab}','Back to {tab}').replace('Filter Filter','Filter').replace('Map Map','Map')
fs.writeFileSync('src/App.tsx',s,'utf8')
