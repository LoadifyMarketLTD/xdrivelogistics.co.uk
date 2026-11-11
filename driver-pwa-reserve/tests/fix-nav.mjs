import fs from 'node:fs'
let s=fs.readFileSync('src/App.tsx','utf8')
s=s.replace('<span>Jobs</span>','<span aria-hidden="true">▤</span>')
s=s.replace('["Jobs", "£", "Bookings", "Menu"][i]','["▤", "£", "▣", "☰"][i]')
fs.writeFileSync('src/App.tsx',s,'utf8')
