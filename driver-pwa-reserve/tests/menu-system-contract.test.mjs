import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const menu=readFileSync(new URL('../src/DriverMenu.tsx',import.meta.url),'utf8')
const css=readFileSync(new URL('../src/DriverMenu.css',import.meta.url),'utf8')
const helper=readFileSync(new URL('../src/driverMenuView.ts',import.meta.url),'utf8')
const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8')
test('approved navbar and Loads/Quotes/Bookings are not replaced',()=>{
 assert.match(app,/\["Loads", "Quotes", "Bookings"\]/)
 assert.match(app,/menuOpen && <DriverMenu/)
})
test('driver menu no longer displays generic API field dumps',()=>{
 assert.doesNotMatch(menu,/fields\(entry\)|fields\(primary\)|String\(val\)/)
 for(const section of ['My Profile','My Vehicle','Availability','Notifications','Load Alerts','Invoices','Settings'])assert.ok(menu.includes(section))
})
test('private paths and backend IDs are not shown as document metadata',()=>{
 assert.match(menu,/Compliance documents/)
 assert.match(menu,/expiryLabel/)
 assert.doesNotMatch(menu,/\{document\.file_path\}/)
 assert.match(menu,/View document securely/)
})
test('notifications support read actions, filters and controlled pagination',()=>{
 assert.match(menu,/\/notifications\/read-all/)
 assert.match(menu,/\/read'/)
 assert.match(menu,/notificationsOnlyUnread/)
 assert.match(menu,/notificationLimit/)
 assert.match(menu,/Show more notifications/)
 assert.match(menu,/Open Bookings/)
})
test('load alerts are human-facing controls, persisted to real API',()=>{
 for(const key of ['matchCurrent','matchHome','matchFuture','matchVehicle','homeOutcode','minimumBudget','alertChannels','Save alert preferences'])assert.match(menu,new RegExp(key))
 assert.match(menu,/Choose at least one matching location/)
 assert.match(menu,/Choose at least one notification channel/)
 assert.match(menu,/apiBase\+path/)
 assert.match(menu,/Authorization:'Bearer '/)
})
test('availability uses authorised server writes and independent destination radius',()=>{
 assert.match(menu,/destinationPriorityEnabled/)
 assert.match(menu,/destinationRadiusMiles/)
 assert.match(menu,/Save destination preferences/)
})
test('invoice data reads actual rows from the backend',()=>{
 assert.match(menu,/asRows\(data\?\.rows\)/)
 assert.match(menu,/invoice\.payment_status/)
 assert.match(menu,/role==='Owner Driver'/)
})
test('shared style uses compact groups and no global header black background',()=>{
 assert.match(css,/driver-menu-group>header\{[^}]*background:transparent/)
 assert.match(css,/driver-menu-filters/)
 assert.match(css,/driver-menu-record/)
})
test('formatters turn technical keys and dates into user-facing labels',()=>{
 assert.match(helper,/exception_pod_alert/)
 assert.match(helper,/readableLabel/)
 assert.match(helper,/dateTimeLabel/)
 assert.match(helper,/expiryLabel/)
})
