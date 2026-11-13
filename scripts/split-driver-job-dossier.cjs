const fs=require('node:fs');
const file='app/components/workspace/DriverJobExecutionPage.tsx';
let x=fs.readFileSync(file,'utf8').replace(new RegExp(String.fromCharCode(13,10),'g'),String.fromCharCode(10));
function replaceOne(a,b){const n=x.split(a).length-1;if(n!==1)throw new Error('Expected unique '+JSON.stringify(a.slice(0,80))+' got '+n);x=x.replace(a,b);console.log('REPLACED',a.slice(0,58));}
replaceOne("  const [showPodDetails, setShowPodDetails] = useState(false);","  const [showPodDetails, setShowPodDetails] = useState(false);\n  const [caseTab, setCaseTab] = useState<'overview'|'order'|'tracking'|'pod'|'documents'|'invoice'|'history'>('overview');");
const anchor='      <Panel title="Order" description="Awarded booking confirmation and operational instructions from the driver-authorised job sheet.">';
const tabs=`      <section className="xd-case-dossier" aria-label="Transport dossier">
        <div className="xd-case-dossier__topline">
          <span>TRANSPORT DOSSIER</span>
          <strong>{sheet?.bookingReference ?? sheet?.reference ?? job.booking_reference ?? \`XDL-\${job.id.slice(0,8).toUpperCase()}\`}</strong>
          <span className="xd-case-dossier__status">{statusLabel[currentStatus] ?? currentStatus}</span>
        </div>
        <div className="xd-case-tabs" role="tablist" aria-label="Booking dossier sections">
          {([
            ['overview','Overview'],['order','Order'],['tracking','Tracking'],['pod','POD'],
            ['documents','Documents'],['invoice','Invoice'],['history','History'],
          ] as const).map(([id,label]) => (
            <button key={id} type="button" role="tab" aria-selected={caseTab===id}
              className={caseTab===id?'xd-case-tabs__active':''}
              onClick={()=>setCaseTab(id)}>{label}</button>
          ))}
        </div>
      </section>

      {caseTab==='overview' && <section className="xd-case-overview" aria-label="Transport overview">
        <header><span>Journey &amp; execution</span><strong>{statusLabel[currentStatus] ?? currentStatus}</strong></header>
        <div className="xd-case-overview__grid">
          <div><small>COLLECTION</small><strong>{job.pickup_location ?? job.pickup_postcode ?? 'Collection not supplied'}</strong><span>{formatDateTime(job.pickup_datetime)}</span></div>
          <div><small>DESTINATION</small><strong>{job.delivery_location ?? job.delivery_postcode ?? 'Delivery not supplied'}</strong><span>{formatDateTime(job.delivery_datetime)}</span></div>
          <div><small>VEHICLE</small><strong>{requestedVehicle}</strong><span>{allocatedVehicleSummary}</span></div>
          <div><small>DOCUMENTS</small><strong>{podComplete ? 'POD completed' : 'POD pending'}</strong><span>{sheet?.invoices[0]?.number ?? 'Invoice not issued'}</span></div>
        </div>
        <div className="xd-case-overview__actions">
          <button type="button" onClick={()=>setCaseTab('order')}>View order</button>
          <button type="button" onClick={()=>setCaseTab('tracking')}>Tracking &amp; Journey Replay</button>
          <button type="button" onClick={()=>setCaseTab('pod')}>{podComplete ? 'View POD' : 'Complete POD'}</button>
          <button type="button" onClick={()=>setCaseTab('invoice')}>Invoice &amp; payment</button>
          {canShowLifecycleAction && nextStatus && nextLabel && <ActionButton tone="success" disabled={working} onClick={()=>void moveStatus(nextStatus)}>{working?'Saving...':nextLabel}</ActionButton>}
        </div>
      </section>}

      {caseTab==='order' && <>
`;
replaceOne(anchor,tabs+anchor);
const orderEnd='      <TwoColumn>\n        <div style={{ display: \'grid\', gap: 8 }}>';
const replOrderEnd=`      </>}

      <div className="xd-case-panels">
        <div className="xd-case-panels__column">
`;
replaceOne(orderEnd,replOrderEnd);
replaceOne('          <Panel title="Route and navigation">',"{caseTab==='order' && <Panel title=\"Route and navigation\">");
replaceOne('          </Panel>\n\n          {loadSections.map((section)',"          </Panel>}\n\n          {caseTab==='order' && loadSections.map((section)");
replaceOne("          {(currentStatus === 'on_site_pickup' || currentStatus === 'loaded') && (","          {caseTab==='pod' && (currentStatus === 'on_site_pickup' || currentStatus === 'loaded') && (");
replaceOne("          {(currentStatus === 'on_site_delivery' || (currentStatus === 'delivered' && !podComplete)) && (","          {caseTab==='pod' && (currentStatus === 'on_site_delivery' || (currentStatus === 'delivered' && !podComplete)) && (");
replaceOne("        <div style={{ display: 'grid', gap: 8, alignContent: 'start' }}>","        <div className=\"xd-case-panels__column\">");
replaceOne('          <Panel title="Operational timeline" description="Pickup, loading, transit, delivery and completion events.">',"{caseTab==='history' && <Panel title=\"Operational timeline\" description=\"Pickup, loading, transit, delivery and completion events.\">");
replaceOne('rows={timelineRows} empty={<EmptyState title="No recorded history" />} /></Panel>', 'rows={timelineRows} empty={<EmptyState title="No recorded history" />} /></Panel>}');
replaceOne('          <div id="journey-replay"><Panel title="Journey Replay"','          {caseTab===\'tracking\' && <div id="journey-replay"><Panel title="Journey Replay"');
replaceOne('<WorkspaceJobReplay jobId={jobId} /></Panel></div>','<WorkspaceJobReplay jobId={jobId} /></Panel></div>}');
replaceOne('          <Panel title="Notes" description=',"{caseTab==='order' && <Panel title=\"Notes\" description=");
replaceOne('rows={5} placeholder="Loading condition, waiting time, access issue or delivery note" style={{ ...inputStyle, resize: \'vertical\' }} /></Panel>',"rows={5} placeholder=\"Loading condition, waiting time, access issue or delivery note\" style={{ ...inputStyle, resize: 'vertical' }} /></Panel>}");
replaceOne('          <Panel title="Documents"><div style=',"{caseTab==='documents' && <Panel title=\"Documents\"><div style=");
replaceOne('<EmptyState title="No job documents" />}</div></Panel>', '<EmptyState title="No job documents" />}</div></Panel>}');
replaceOne('          <Panel title="POD and invoice" description=',"{caseTab==='pod' && <Panel title=\"POD and invoice\" description=");
replaceOne('          {podComplete && showPodDetails && (',"          {caseTab==='pod' && podComplete && showPodDetails && (");
// unique close for POD and invoice panel preceding POD details
replaceOne('            </div>}\n          </Panel>\n          {caseTab', '            </div>}\n          </Panel>}\n          {caseTab');
const ending='        </div>\n      </TwoColumn>\n    </PageFrame>';
const invoice=`          {caseTab==='invoice' && <section className="xd-case-invoice" aria-label="Invoice and payment">
            <header><strong>Invoice &amp; payment</strong><span>Financial documents</span></header>
            <div className="xd-case-invoice__grid">
              <div><small>INVOICE</small><strong>{sheet?.invoices[0]?.number ?? (podComplete ? 'Ready to create' : 'Awaiting POD')}</strong></div>
              <div><small>INVOICE STATUS</small><strong>{sheet?.invoices[0]?.status ?? 'Not issued'}</strong></div>
              <div><small>PAYMENT STATUS</small><strong>{sheet?.invoices[0]?.paymentStatus ?? 'Not recorded'}</strong></div>
              <div><small>PAYMENT TERMS</small><strong>{sheet?.paymentTerms ?? 'Not supplied'}</strong></div>
            </div>
            <div className="xd-case-overview__actions">
              {sheet?.invoices[0]?.id ? <ActionButton tone="primary" onClick={()=>router.push(\`/driver/finance/invoices/\${sheet.invoices[0].id}\`)}>View Invoice</ActionButton> :
                podComplete && canGenerateInvoices ? <ActionButton tone="primary" disabled={working} onClick={()=>void createInvoice()}>{working?'Creating...':'Create Invoice'}</ActionButton> :
                <span>{podComplete?'Invoice generation is managed by the authorised carrier.':'Complete POD before creating an invoice.'}</span>}
            </div>
          </section>}
        </div>
      </div>
    </PageFrame>`;
replaceOne(ending,invoice);
replaceOne("onClick={() => document.getElementById('journey-replay')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}", "onClick={() => setCaseTab('tracking')}");
x=x.replaceAll('onClick={() => void openPodDetails()}>View POD', "onClick={() => {setCaseTab('pod');void openPodDetails();}}>View POD");
fs.writeFileSync(file,x,'utf8');
console.log('Updated',file,'length',x.length);
