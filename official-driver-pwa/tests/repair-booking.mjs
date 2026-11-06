import fs from 'node:fs'
const file='src/App.tsx'
let s=fs.readFileSync(file,'utf8')
const marker='                  {job.quote !== undefined && (\n                    <button\n                      className="danger"'
if(!s.includes(marker))throw Error('Quote action marker not found')
const insert=`                  {mode === "sandbox" && job.id.startsWith("TEST-") && job.quote !== undefined && (
                    <button className="primary" onClick={() => {
                      update(job.id, { status: "ALLOCATED" });
                      setTab("Bookings");
                      setRef("");
                      setPodName("");
                      setPodEvidence(false);
                    }}>
                      Simulate Award (TEST ONLY)
                    </button>
                  )}
`
s=s.replace(marker,insert+marker)
const old='setSelected(j.id);\n                              setQuoteOpen(true);'
const replacement='setSelected(j.id);\n                              setAmount(String(j.quote ?? 160));\n                              setQuoteOpen(true);'
if(!s.includes(old))throw Error('Quote card marker not found')
s=s.replace(old,replacement)
const old2='disabled={validateQuote(Number(amount)) !== null}'
const new2='disabled={validateQuote(Number(amount)) !== null || (role === "Company Driver" && !canBid)}'
if(!s.includes(old2))throw Error('Quote permission marker not found')
s=s.replace(old2,new2)
fs.writeFileSync(file,s,'utf8')
