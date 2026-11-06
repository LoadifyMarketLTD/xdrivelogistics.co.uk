from pathlib import Path
p=Path(__file__).resolve().parent.parent/'src'/'App.tsx'
s=p.read_text(encoding='utf-8-sig')
s=s.replace('type Tab = "Loads" | "Quotes" | "Bookings" | "Map" | "Invoices" | "More";','type Tab = "Loads" | "Quotes" | "Bookings" | "Map" | "Invoices" | "More" | "Alerts";')
s=s.replace('  pod?: string;\n};','  pod?: string;\n  company?: string;\n  terms?: string;\n  phone?: string;\n  distance?: string;\n  packages?: number;\n  dimensions?: string;\n  service?: string;\n};')
s=s.replace('    status: "OPEN",\n  },','    status: "OPEN",\n    company: "TEST CUSTOMER A", terms: "14 Days (From Invoice)", phone: "", distance: "Not calculated", packages: 2, dimensions: "Not supplied", service: "Same Day",\n  },',1)
s=s.replace('    status: "OPEN",\n  },','    status: "OPEN",\n    company: "TEST CUSTOMER B", terms: "30 Days (From Invoice)", phone: "", distance: "Not calculated", packages: 1, dimensions: "Not supplied", service: "Same Day",\n  },',1)
s=s.replace('  const [selected, setSelected] = useState<string | null>(null);','''  const [selected, setSelected] = useState<string | null>(null);
  const [alertSection, setAlertSection] = useState<"Inbox" | "Saved" | "Deleted">("Inbox");
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [detailMap, setDetailMap] = useState(false);
  const [quoteEta, setQuoteEta] = useState("On Time");''')
s=s.replace('    tab === "Loads"\n      ? filtered.filter((j) => j.status === "OPEN")','    tab === "Loads" || tab === "Alerts"\n      ? filtered.filter((j) => j.status === "OPEN" && (tab !== "Alerts" || (alertSection === "Saved" ? savedIds.includes(j.id) : alertSection === "Deleted" ? deletedIds.includes(j.id) : !deletedIds.includes(j.id))))')
s=s.replace('  const navigate = (dest: string) =>','''  const openJob = (id: string) => { setSelected(id); setDetailMap(false); };
  const toggleSaved = (id: string) => setSavedIds((v) => v.includes(id) ? v.filter((x) => x !== id) : [...v, id]);
  const toggleDeleted = (id: string) => setDeletedIds((v) => v.includes(id) ? v.filter((x) => x !== id) : [...v, id]);
  const navigate = (dest: string) =>''')
s=s.replace('onClick={() => setSelected(null)}','onClick={() => { setSelected(null); setDetailMap(false); }}')
needle='''              <p>{job.notes}</p>
              {job.quote !== undefined'''
repl='''              <div className="mobile-job-facts">
                <div><span>Service</span><strong>{job.service || "Not specified"}</strong></div>
                <div><span>Vehicle</span><strong>{job.vehicle}</strong></div>
                <div><span>Distance</span><strong>{job.distance || "Not calculated"}</strong></div>
                <div><span>Weight</span><strong>{job.weight} kg</strong></div>
                <div><span>Packages</span><strong>{job.packages ?? "Not specified"}</strong></div>
                <div><span>Dimensions</span><strong>{job.dimensions || "Not specified"}</strong></div>
              </div>
              <button className="map-action" onClick={() => setDetailMap(!detailMap)}>{detailMap ? "Hide Map" : "View on Map"}</button>
              {detailMap && <div className="map-preview">
                <p>Pickup: {job.from}</p><p>Delivery: {job.to}</p>
                <p>Route preview is not available offline. Open directions for the actual road route.</p>
                <button onClick={() => window.open("https://www.google.com/maps/dir/?api=1&origin="+encodeURIComponent(job.from)+"&destination="+encodeURIComponent(job.to),"_blank","noopener,noreferrer")}>Open Route in Maps</button>
              </div>}
              <div className="customer-panel">
                <div><span>Customer</span><strong>{job.company || "Customer not provided"}</strong></div>
                <div><span>Payment terms</span><strong>{job.terms || "Not provided"}</strong></div>
                {job.phone && <a href={"tel:"+job.phone}>Call customer</a>}
                <div><span>Instructions</span><strong>{job.notes || "No instructions"}</strong></div>
                <div><span>Feedback (last 90 days)</span><strong>Not available in local test</strong></div>
              </div>
              {job.status === "OPEN" && <div className="mobile-detail-actions">
                <button onClick={() => toggleSaved(job.id)}>{savedIds.includes(job.id) ? "Saved ✓" : "Save"}</button>
                <button onClick={() => { toggleDeleted(job.id); setSelected(null); setTab("Alerts"); setAlertSection("Deleted"); }}>Delete alert</button>
              </div>}
              {job.quote !== undefined'''
if needle not in s: raise Exception('details anchor missing')
s=s.replace(needle,repl,1)
s=s.replace('''            {tab === "Loads" || tab === "Quotes" || tab === "Bookings" ? (''','''            {tab === "Loads" || tab === "Quotes" || tab === "Bookings" || tab === "Alerts" ? (''')
s=s.replace('''                <div className="tools">
                  <button onClick={() => setShowFilter(!showFilter)}>''','''                {tab === "Alerts" && <div className="alert-tabs">{(["Inbox","Saved","Deleted"] as const).map((x) => <button key={x} className={alertSection === x ? "selected" : ""} onClick={() => setAlertSection(x)}>{x}</button>)}</div>}
                <div className="tools">
                  <button onClick={() => setShowFilter(!showFilter)}>''')
s=s.replace('''                      <div className="cardtop">
                        <strong>{j.vehicle}</strong>''','''                      <div className="cardtop">
                        <strong>{tab === "Alerts" ? (j.company || "Customer not provided") : j.vehicle}</strong>''')
s=s.replace('''                      <small className="reference">
                        {j.id} · {j.weight} kg
                      </small>''','''                      <small className="reference">
                        {j.id} · {j.weight} kg · {j.vehicle} · {j.service || "Service not specified"}
                      </small>''')
s=s.replace('''                      <p>{j.notes}</p>
                      {j.quote''','''                      <p>{j.notes}</p>
                      {tab === "Alerts" && <p className="notification-reason">Notification reason: driver current location (TEST ONLY)</p>}
                      {j.quote''')
s=s.replace('onClick={() => setSelected(j.id)}','onClick={() => openJob(j.id)}')
s=s.replace('''                        {tab === "Loads" && (''','''                        {(tab === "Loads" || tab === "Alerts") && (''')
s=s.replace('''                      </div>
                    </article>
                  ))
                )}
              </>
            ) : tab === "Invoices"''','''                      </div>
                      {tab === "Alerts" && <div className="alert-actions"><button onClick={() => toggleSaved(j.id)}>{savedIds.includes(j.id) ? "Unsave" : "Save"}</button><button onClick={() => toggleDeleted(j.id)}>{deletedIds.includes(j.id) ? "Restore" : "Delete"}</button></div>}
                    </article>
                  ))
                )}
              </>
            ) : tab === "Invoices"''')
s=s.replace('''            <label>
              Notes
              <textarea''','''            <label>
              Estimated arrival
              <select value={quoteEta} onChange={(e) => setQuoteEta(e.target.value)}>{["ASAP","15 min","30 min","45 min","60 min","90 min","120 min","On Time"].map(x => <option key={x}>{x}</option>)}</select>
            </label>
            <label>
              Notes
              <textarea''')
s=s.replace('''            <button
              className="primary"
              disabled={
                validateQuote''','''            <button
              className="primary"
              disabled={
                validateQuote''')
s=s.replace('''        {(["Loads", "Quotes", "Bookings", "More"] as Tab[]).map((t, i) => (''','''        {(["Alerts", "Loads", "Quotes", "Bookings", "More"] as Tab[]).map((t, i) => (''')
s=s.replace('''            <span>{["▤", "£", "▣", "☰"][i]}</span>''','''            <span>{["♧", "▤", "£", "▣", "☰"][i]}</span>''')
p.write_text(s,encoding='utf-8')
css=Path(__file__).resolve().parent.parent/'src'/'App.css'
with css.open('a',encoding='utf-8') as f:
 f.write('\n.alert-tabs{display:flex;background:#edf0f3;border-radius:18px;margin-bottom:12px;padding:4px;gap:3px}.alert-tabs button{flex:1;padding:11px 5px;border:0;background:transparent;border-radius:17px;font-weight:750}.alert-tabs .selected{background:white;box-shadow:0 1px 5px #0002}.notification-reason{background:#f0f1f3;padding:9px;font-size:11px!important}.alert-actions,.mobile-detail-actions{display:flex;gap:8px;margin-top:12px}.alert-actions button,.mobile-detail-actions button{flex:1;padding:12px;border:0;background:#f5ca1d;color:#17202a;font-weight:800;border-radius:5px}.alert-actions button:last-child,.mobile-detail-actions button:last-child{background:#e76666;color:white}.mobile-job-facts{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:14px 0}.mobile-job-facts div,.customer-panel>div{display:grid;gap:4px;border-bottom:1px solid #e5e7eb;padding:9px 3px}.mobile-job-facts span,.customer-panel span{font-size:11px;color:#697483}.mobile-job-facts strong,.customer-panel strong{font-size:13px}.customer-panel{border:1px solid #e5e7eb;border-radius:9px;padding:12px;margin:13px 0}.customer-panel a{display:block;padding:10px;color:#1767b6}.map-action{background:#f4c318;border:0;border-radius:5px;padding:13px;width:100%;font-weight:800}.map-preview{background:#e8f2ed;padding:16px;border-radius:8px;margin-top:8px}.map-preview button{background:white;border:1px solid #a4b2b0;padding:12px;border-radius:7px}.shell:has(.alert-tabs) header{background:#f4a600}.shell:has(.alert-tabs) .primary{background:#86bc25!important;border-color:#86bc25!important}\n')
print('Mobile reference UI updated')
