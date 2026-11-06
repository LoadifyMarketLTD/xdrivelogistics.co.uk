from pathlib import Path
p=Path(r'C:\Users\xdriv\OneDrive\Desktop\XDRIVE-DRIVER-PWA-NEW-LOCAL\src\App.tsx')
s=p.read_text(encoding='utf-8')
def change(a,b,n=1):
 global s
 count=s.count(a)
 if count!=n: raise RuntimeError(f'Expected {n}, found {count}: {a[:90]}')
 s=s.replace(a,b)
change('"details" | "status" | "pickup" | "loaded" | "history"','"details" | "status" | "pickup" | "loaded" | "history" | "pod"')
change('bookingScreen === "status" || bookingScreen === "pickup" || bookingScreen === "loaded" ? (','bookingScreen === "status" || bookingScreen === "pickup" || bookingScreen === "loaded" || bookingScreen === "pod" ? (')
a='                  {next === "POD_SUBMITTED" && ('
b='                  {next === "POD_SUBMITTED" && bookingScreen === "pod" && false && ('
change(a,b)
change('{next === "POD_SUBMITTED" && <div className="settings">','{next === "POD_SUBMITTED" && bookingScreen === "pod" && false && <div className="settings">')
change('{next === "POD_SUBMITTED" && bookingScreen === "status" && (','{next === "POD_SUBMITTED" && bookingScreen === "pod" && (')
change('recipient={podReceivedBy || podName}\n                      initialStage=', 'recipient={podReceivedBy || podName}\n                      reference={job.customerRef || job.yourRef || job.id}\n                      initialItems={job.items || 1}\n                      onRecipient={name => { setPodReceivedBy(name); setPodEvidence(false); }}\n                      onFormChange={data => { setPodLeftAt(data.leftAt); }}\n                      initialStage=')
change('next && !job.acceptanceRequired && bookingScreen === "status" && next !== "LOADED"','next && !job.acceptanceRequired && (bookingScreen === "status" || bookingScreen === "pod") && next !== "LOADED"')
change('if (next === "POD_SUBMITTED") setAvailabilityPrompt(true);','if (next === "POD_SUBMITTED") { setAvailabilityPrompt(true); setBookingScreen("status"); } else if (next === "ON_SITE_DELIVERY") { setBookingScreen("pod"); }')
change('                  {next === "POD_SUBMITTED" && bookingScreen === "pod" && (','                  {next === "POD_SUBMITTED" && bookingScreen === "pod" && (')
# Keep the status timeline separate: the action opens the POD form without embedding it in the timeline.
change('                  {next && !job.acceptanceRequired && (bookingScreen === "status" || bookingScreen === "pod") && next !== "LOADED" && (','                  {next === "POD_SUBMITTED" && bookingScreen === "status" && <button type="button" className="primary" onClick={() => setBookingScreen("pod")}>Create POD</button>}\n                  {next && !job.acceptanceRequired && (bookingScreen === "status" || bookingScreen === "pod") && next !== "LOADED" && (')
change('disabled={\n                        validateTransition(job.status, next, {','disabled={\n                        (next === "POD_SUBMITTED" && bookingScreen !== "pod") || validateTransition(job.status, next, {')
# Keep existing transition guard; button disabled until POD evidence saved.
p.write_text(s,encoding='utf-8')
print('APP_UPDATED')
