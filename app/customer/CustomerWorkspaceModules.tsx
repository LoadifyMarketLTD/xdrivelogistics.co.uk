'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../components/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import LoadPostingForm from '../components/workspace/LoadPostingForm';
import { useCompanyWorkspaceData } from '../components/workspace/useCompanyWorkspaceData';
import { ActionButton, AlertBanner, DataTable, EmptyState, KpiCard, KpiGrid, PageFrame, PageHeader, Panel, StatusBadge, TwoColumn } from '../components/workspace/WorkspaceUI';

const money = (value: number, currency = 'GBP') => new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value);
const when = (value: string | null | undefined) => value ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not set';
const active = new Set(['awarded', 'allocated', 'accepted', 'on_my_way', 'on_my_way_to_pickup', 'on_site_pickup', 'loaded', 'collected', 'in_transit', 'on_my_way_to_delivery', 'on_site_delivery']);
const isCustomerVisibleInvoice = (invoice: { status: string; amount?: number | null; client_name?: string | null }) => {
  const status = String(invoice.status ?? '').toLowerCase();
  return !['pending', 'draft', 'cancelled'].includes(status)
    && Number(invoice.amount ?? 0) > 0
    && Boolean(invoice.client_name?.trim());
};

export function CustomerDashboard() {
  const router = useRouter();
  const data = useCompanyWorkspaceData();

  const metrics = useMemo(() => {
    const awaitingAward = data.jobs.filter(
      (job) => !job.awarded_carrier_company_id && data.bids.some((bid) => bid.job_id === job.id && bid.status === 'submitted')
    );
    const activeDeliveries = data.jobs.filter((job) => active.has(job.current_status ?? job.status));
    const delayed = activeDeliveries.filter((job) => job.delivery_datetime && new Date(job.delivery_datetime).getTime() < Date.now());
    const customerInvoices = data.invoices.filter((inv) => inv.buyer_company_id === data.companyId && isCustomerVisibleInvoice(inv));
    const unpaidInvoices = customerInvoices.filter((inv) => inv.payment_status !== 'paid' && !['paid', 'Paid'].includes(inv.status));
    const unpaidValue = unpaidInvoices.reduce((sum, inv) => sum + Number(inv.amount ?? 0), 0);
    return {
      draft: data.jobs.filter((j) => j.status === 'draft').length,
      open: data.jobs.filter((j) => ['posted', 'quoted'].includes(j.status)).length,
      quotesReceived: data.bids.filter((b) => b.status === 'submitted').length,
      awaitingAward,
      awarded: data.jobs.filter((j) => Boolean(j.awarded_carrier_company_id) || ['awarded', 'allocated'].includes(j.status)).length,
      activeDeliveries,
      delayed,
      pod: data.jobs.filter((j) => (j.delivery_photos?.length ?? 0) > 0).length,
      unpaidInvoices,
      unpaidValue,
    };
  }, [data]);

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Customer transport"
        title="Customer Dashboard"
        description="Post transport requirements, compare carrier quotes, track delivery milestones and retrieve POD and invoices."
        actions={<><ActionButton tone="warning" onClick={() => router.push('/customer/post-load')}>Post Load</ActionButton><ActionButton tone="secondary" onClick={() => router.push('/customer/deliveries')}>Track Deliveries</ActionButton></>}
      />
      {data.error && <AlertBanner>{data.error}</AlertBanner>}

      <KpiGrid>
        <KpiCard label="Draft loads" value={metrics.draft} detail="Not yet published" onClick={() => router.push('/customer/loads')} />
        <KpiCard label="Open loads" value={metrics.open} detail="Awaiting carrier quotes" tone="blue" onClick={() => router.push('/customer/loads')} />
        <KpiCard label="Quotes received" value={metrics.quotesReceived} detail="Ready to compare" tone="purple" onClick={() => router.push('/customer/quotes')} />
        <KpiCard label="Awaiting award" value={metrics.awaitingAward.length} detail="Your decision needed" tone="orange" onClick={() => router.push('/customer/quotes')} />
        <KpiCard label="Active deliveries" value={metrics.activeDeliveries.length} detail="In transit now" tone="green" onClick={() => router.push('/customer/deliveries')} />
        <KpiCard label="Delayed" value={metrics.delayed.length} detail="Past delivery window" tone="red" onClick={() => router.push('/customer/deliveries')} />
        <KpiCard label="POD ready" value={metrics.pod} detail="Proof of delivery available" tone="navy" onClick={() => router.push('/customer/documents')} />
        <KpiCard label="Unpaid invoices" value={metrics.unpaidInvoices.length} detail={metrics.unpaidValue > 0 ? money(metrics.unpaidValue) : 'None outstanding'} tone={metrics.unpaidInvoices.length ? 'orange' : 'green'} onClick={() => router.push('/customer/invoices')} />
      </KpiGrid>

      {metrics.awaitingAward.length > 0 && (
        <Panel
          title="Action required — awaiting your award decision"
          description="These loads have carrier quotes ready. Review prices and award before quotes expire."
          actions={<ActionButton tone="warning" onClick={() => router.push('/customer/quotes')}>Review all quotes</ActionButton>}
        >
          <DataTable
            columns={['Route', 'Pickup', 'Quotes received', 'Best price', 'Action']}
            rows={metrics.awaitingAward.slice(0, 6).map((job) => {
              const jobQuotes = data.bids.filter((b) => b.job_id === job.id && b.status === 'submitted');
              const prices = jobQuotes.map((b) => Number(b.bid_price_gbp ?? b.amount ?? 0)).filter((p) => p > 0);
              return [
                <strong key="route">{job.pickup_postcode ?? job.pickup_location} → {job.delivery_postcode ?? job.delivery_location}</strong>,
                when(job.pickup_datetime),
                jobQuotes.length,
                prices.length ? money(Math.min(...prices)) : 'No price',
                <ActionButton key="action" tone="success" onClick={() => router.push(`/customer/jobs/${job.id}`)}>Compare &amp; award</ActionButton>,
              ];
            })}
            empty={<EmptyState title="No loads awaiting award" />}
          />
        </Panel>
      )}

      <TwoColumn>
        <Panel
          title="Active deliveries"
          description="Live transport — track progress, identify delays and access POD when ready."
          actions={<ActionButton tone="secondary" onClick={() => router.push('/customer/deliveries')}>All deliveries</ActionButton>}
        >
          <DataTable
            columns={['Route', 'Pickup', 'Delivery window', 'Status', 'Action']}
            rows={metrics.activeDeliveries.slice(0, 6).map((job) => [
              <strong key="route">{job.pickup_postcode ?? job.pickup_location} → {job.delivery_postcode ?? job.delivery_location}</strong>,
              when(job.pickup_datetime),
              when(job.delivery_datetime),
              <StatusBadge key="status" value={job.current_status ?? job.status} tone={metrics.delayed.includes(job) ? 'red' : undefined} />,
              <ActionButton key="action" tone="secondary" onClick={() => router.push(`/customer/jobs/${job.id}`)}>Track</ActionButton>,
            ])}
            empty={<EmptyState title="No active deliveries" description="Active deliveries appear here once a carrier accepts and starts a job." />}
          />
        </Panel>

        <div style={{ display: 'grid', gap: '0.9rem' }}>
          <Panel
            title="Outstanding invoices"
            description="Invoices addressed to your company that are pending payment."
            actions={<ActionButton tone="secondary" onClick={() => router.push('/customer/invoices')}>All invoices</ActionButton>}
          >
            {metrics.unpaidInvoices.length > 0 ? (
              <>
                {metrics.unpaidInvoices.slice(0, 4).map((inv) => (
                  <button
                    key={inv.id}
                    onClick={() => router.push(`/customer/invoices/${inv.id}`)}
                    style={quickButton}
                  >
                    <span>
                      <strong style={{ display: 'block' }}>{inv.invoice_number ?? inv.id.slice(0, 8).toUpperCase()}</strong>
                      <small style={{ color: '#64748b' }}>{inv.due_date ? `Due ${when(inv.due_date)}` : 'No due date'}</small>
                    </span>
                    <span style={{ textAlign: 'right' }}>
                      <strong style={{ display: 'block', color: '#dc2626' }}>{money(Number(inv.amount ?? 0), inv.currency ?? 'GBP')}</strong>
                      <StatusBadge value={inv.payment_status ?? inv.status} />
                    </span>
                  </button>
                ))}
              </>
            ) : (
              <EmptyState title="No outstanding invoices" description="All invoices are paid or none have been issued yet." />
            )}
          </Panel>

          <Panel title="Quick actions">
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {([
                ['Post a new load', '/customer/post-load'],
                ['Review carrier quotes', '/customer/quotes'],
                ['Track active deliveries', '/customer/deliveries'],
                ['Download POD', '/customer/documents'],
                ['View all invoices', '/customer/invoices'],
                ['Team & settings', '/customer/settings'],
              ] as const).map(([label, href]) => (
                <button key={href} onClick={() => router.push(href)} style={quickButton}>
                  <span>{label}</span><span>→</span>
                </button>
              ))}
            </div>
          </Panel>
        </div>
      </TwoColumn>

      <Panel
        title="Recent transport activity"
        description="All your loads — sorted by most recent update."
        actions={<ActionButton tone="secondary" onClick={() => router.push('/customer/loads')}>View all loads</ActionButton>}
      >
        <DataTable
          columns={['Reference', 'Route', 'Pickup', 'Status', 'Quotes', 'Action']}
          rows={data.jobs.slice(0, 8).map((job) => [
            job.id.slice(0, 8).toUpperCase(),
            <strong key="route">{job.pickup_postcode ?? job.pickup_location} → {job.delivery_postcode ?? job.delivery_location}</strong>,
            when(job.pickup_datetime),
            <StatusBadge key="status" value={job.current_status ?? job.status} />,
            data.bids.filter((b) => b.job_id === job.id && b.status === 'submitted').length,
            <ActionButton key="action" tone="secondary" onClick={() => router.push(`/customer/jobs/${job.id}`)}>Open</ActionButton>,
          ])}
          empty={<EmptyState title="No transport activity yet" action={<ActionButton tone="warning" onClick={() => router.push('/customer/post-load')}>Post your first load</ActionButton>} />}
        />
      </Panel>
    </PageFrame>
  );
}
const quickButton = {width:'100%',display:'flex',justifyContent:'space-between',alignItems:'center',gap:'0.6rem',border:'1px solid #e2e8f0',borderRadius:'8px',padding:'0.62rem 0.68rem',background:'#f8fafc',color:'#0f172a',fontSize:'0.76rem',cursor:'pointer',textAlign:'left'} as const;

export function CustomerPostLoadPage(){return <PageFrame><PageHeader eyebrow="New transport" title="Post Load" description="The form is grouped by collection, delivery, cargo, vehicle, references and commercial requirements."/><LoadPostingForm mode="customer"/></PageFrame>}

export function CustomerLoadsPage(){const data=useCompanyWorkspaceData();const router=useRouter();return <PageFrame><PageHeader eyebrow="Customer loads" title="My Loads" description="Real pages and stable URLs for every load status, instead of a single tab state." actions={<ActionButton tone="warning" onClick={()=>router.push('/customer/post-load')}>Post Load</ActionButton>}/><Panel title="Load register"><DataTable columns={['Reference','Route','Pickup','Vehicle','Quotes','Status','Action']} rows={data.jobs.map(job=>[job.id.slice(0,8).toUpperCase(),<strong key="route">{job.pickup_postcode??job.pickup_location} → {job.delivery_postcode??job.delivery_location}</strong>,when(job.pickup_datetime),(job.vehicle_type??'Not specified').replace(/_/g,' '),data.bids.filter(b=>b.job_id===job.id&&b.status==='submitted').length,<StatusBadge key="status" value={job.current_status??job.status}/>,<ActionButton key="action" tone="secondary" onClick={()=>router.push(`/customer/jobs/${job.id}`)}>Open</ActionButton>])} empty={<EmptyState title="No loads posted"/>}/></Panel></PageFrame>}

export function CustomerQuotesPage(){const data=useCompanyWorkspaceData();const [working,setWorking]=useState<string|null>(null);const [message,setMessage]=useState('');const grouped=useMemo(()=>data.jobs.map(job=>({job,quotes:data.bids.filter(b=>b.job_id===job.id&&['submitted','accepted','rejected'].includes(b.status))})).filter(g=>g.quotes.length),[data]);const award=async(id:string)=>{setWorking(id);setMessage('');const {data:session}=await supabase.auth.getSession();const response=await fetch(`/api/customer/bids/${id}/award`,{method:'POST',headers:session.session?.access_token?{Authorization:`Bearer ${session.session.access_token}`}:{}});const payload=await response.json().catch(()=>({})) as {error?:string};setWorking(null);if(!response.ok){setMessage(payload.error??'Unable to award quote.');return;}setMessage('Carrier quote awarded successfully.');await data.refresh();};const reject=async(id:string)=>{setWorking(id);setMessage('');const {data:session}=await supabase.auth.getSession();const response=await fetch(`/api/customer/bids/${id}/reject`,{method:'POST',headers:session.session?.access_token?{Authorization:`Bearer ${session.session.access_token}`}:{}});const payload=await response.json().catch(()=>({})) as {error?:string};setWorking(null);if(!response.ok){setMessage(payload.error??'Unable to reject quote.');return;}setMessage('Carrier quote rejected.');await data.refresh();};return <PageFrame><PageHeader eyebrow="Carrier quotes" title="Quotes" description="Compare price, carrier identity, availability and notes before making an award."/>{message&&<AlertBanner tone={message.includes('successfully')||message.includes('rejected')?'success':'danger'}>{message}</AlertBanner>}{grouped.map(({job,quotes})=><Panel key={job.id} title={`${job.pickup_postcode??job.pickup_location} → ${job.delivery_postcode??job.delivery_location}`} description={`Pickup ${when(job.pickup_datetime)}`} style={{marginBottom:'0.85rem'}}><DataTable columns={['Carrier','Price','Message','Submitted','Status','Decision']} rows={quotes.sort((a,b)=>Number(a.bid_price_gbp??a.amount??0)-Number(b.bid_price_gbp??b.amount??0)).map(bid=>[bid.companies?.name??'Carrier',money(Number(bid.bid_price_gbp??bid.amount??0)),bid.message??'No message',when(bid.created_at),<StatusBadge key="status" value={bid.status}/>,bid.status==='submitted'?<span key="actions" style={{display:'flex',gap:'0.4rem'}}><ActionButton key="award" tone="success" disabled={working===bid.id} onClick={()=>void award(bid.id)}>{working===bid.id?'Awarding…':'Accept'}</ActionButton><ActionButton key="reject" tone="danger" disabled={working===bid.id} onClick={()=>void reject(bid.id)}>Reject</ActionButton></span>:'—'])}/></Panel>)}{grouped.length===0&&<Panel><EmptyState title="No quotes received" description="Carrier quotes will appear after a load is published."/></Panel>}</PageFrame>}

export function CustomerAwardsPage(){const data=useCompanyWorkspaceData();const router=useRouter();const rows=data.jobs.filter(j=>j.awarded_carrier_company_id||['awarded','allocated'].includes(j.status));return <PageFrame><PageHeader eyebrow="Carrier selection" title="Awards" description="Loads with an accepted carrier quote and operational confirmation status."/><Panel><DataTable columns={['Load','Route','Pickup','Status','Action']} rows={rows.map(j=>[j.id.slice(0,8).toUpperCase(),`${j.pickup_postcode??j.pickup_location} → ${j.delivery_postcode??j.delivery_location}`,when(j.pickup_datetime),<StatusBadge key="status" value={j.current_status??j.status}/>,<ActionButton key="action" tone="secondary" onClick={()=>router.push(`/customer/jobs/${j.id}`)}>View</ActionButton>])} empty={<EmptyState title="No awarded loads"/>}/></Panel></PageFrame>}

export function CustomerDeliveriesPage(){const data=useCompanyWorkspaceData();const router=useRouter();const rows=data.jobs.filter(j=>active.has(j.current_status??j.status)||['delivered','completed'].includes(j.status));return <PageFrame><PageHeader eyebrow="Live transport" title="Deliveries" description="Upcoming, active, delayed, delivered and POD-ready work in a structured delivery list."/><Panel><DataTable columns={['Route','Collection','Delivery','Vehicle','Status','POD','Action']} rows={rows.map(j=>[<strong key="route">{j.pickup_location} → {j.delivery_location}</strong>,when(j.pickup_datetime),when(j.delivery_datetime),(j.vehicle_type??'Not specified').replace(/_/g,' '),<StatusBadge key="status" value={j.current_status??j.status}/>,(j.delivery_photos?.length??0)>0?<StatusBadge key="pod" value="ready" tone="green"/>:<StatusBadge key="pod" value="pending" tone="orange"/>,<ActionButton key="action" tone="secondary" onClick={()=>router.push(`/customer/jobs/${j.id}`)}>Track</ActionButton>])} empty={<EmptyState title="No active deliveries"/>}/></Panel></PageFrame>}

export function CustomerDocumentsPage(){const data=useCompanyWorkspaceData();const rows=data.jobs.filter(j=>(j.delivery_photos?.length??0)>0||['delivered','completed'].includes(j.status));return <PageFrame><PageHeader eyebrow="Delivery evidence" title="POD & Documents" description="Customer access is limited to documents for the customer&apos;s own jobs; driver and vehicle compliance documents remain private."/><Panel><DataTable columns={['Load','Route','Delivered','POD files','Status']} rows={rows.map(j=>[j.id.slice(0,8).toUpperCase(),`${j.pickup_postcode??j.pickup_location} → ${j.delivery_postcode??j.delivery_location}`,when(j.delivery_datetime),j.delivery_photos?.length??0,(j.delivery_photos?.length??0)>0?<StatusBadge key="status" value="Available" tone="green"/>:<StatusBadge key="status" value="Awaiting POD" tone="orange"/>])} empty={<EmptyState title="No POD documents available"/>}/></Panel></PageFrame>}

export function CustomerInvoicesPage(){const data=useCompanyWorkspaceData();const router=useRouter();const rows=data.invoices.filter(i=>(i.buyer_company_id===data.companyId||data.jobs.some(j=>j.id===i.job_id))&&isCustomerVisibleInvoice(i));return <PageFrame><PageHeader eyebrow="Customer finance" title="Invoices" description="Invoices addressed to this customer company, linked to the transport job and payment status."/><Panel><DataTable columns={['Invoice','Job','Amount','Due','Payment status','Action']} rows={rows.map(i=>[i.invoice_number??i.id.slice(0,8),i.job_id?.slice(0,8)??'—',money(Number(i.amount??0),i.currency??'GBP'),i.due_date?new Date(i.due_date).toLocaleDateString('en-GB'):'Not set',<StatusBadge key="status" value={i.payment_status??i.status}/>,<ActionButton key="open" tone="secondary" onClick={()=>router.push(`/customer/invoices/${i.id}`)}>Open</ActionButton>])} empty={<EmptyState title="No customer invoices"/>}/></Panel></PageFrame>}

export function CustomerUpdatesPage(){const {user}=useAuth();const [rows,setRows]=useState<Array<{id:string;event_type:string;entity_type:string;status:string;created_at:string;payload:Record<string,unknown>|null}>>([]);const [loading,setLoading]=useState(true);useEffect(()=>{if(!user?.companyId){setLoading(false);return;}supabase.from('notification_events').select('id,event_type,entity_type,status,created_at,payload').eq('company_id',user.companyId).order('created_at',{ascending:false}).limit(100).then(({data})=>{setRows((data??[]) as typeof rows);setLoading(false);});},[user?.companyId]);return <PageFrame><PageHeader eyebrow="Notifications" title="Updates" description="A chronological feed of quotes, awards, status changes, POD and invoice events."/><Panel>{loading?<EmptyState title="Loading updates…"/>:<DataTable columns={['Event','Entity','Time','Status','Detail']} rows={rows.map(r=>[r.event_type.replace(/_/g,' '),r.entity_type,when(r.created_at),<StatusBadge key="status" value={r.status}/>,typeof r.payload?.message==='string'?r.payload.message:'—'])} empty={<EmptyState title="No updates yet"/>}/>}</Panel></PageFrame>}

export function CustomerTeamPage(){const {user}=useAuth();const [rows,setRows]=useState<Array<{id:string;role_in_company:string;status:string;user_id:string|null;created_at:string}>>([]);useEffect(()=>{if(!user?.companyId)return;supabase.from('company_memberships').select('id,role_in_company,status,user_id,created_at').eq('company_id',user.companyId).order('created_at',{ascending:true}).then(({data})=>setRows((data??[]) as typeof rows));},[user?.companyId]);return <PageFrame><PageHeader eyebrow="Customer administration" title="Team" description="Company members who can post loads, review quotes or view delivery and invoice information."/><Panel><DataTable columns={['Member','Role','Status','Joined']} rows={rows.map(r=>[r.user_id?.slice(0,8)??'Invited member',r.role_in_company,<StatusBadge key="status" value={r.status}/>,when(r.created_at)])} empty={<EmptyState title="No team members"/>}/></Panel></PageFrame>}

export function CustomerJobPage({jobId}:{jobId:string}){
  const data=useCompanyWorkspaceData();
  const router=useRouter();
  const [events,setEvents]=useState<Array<{id:string;event_type:string;message?:string|null;created_at:string}>>([]);
  const [openingPod,setOpeningPod]=useState<string|null>(null);
  const [podError,setPodError]=useState('');
  const [awarding,setAwarding]=useState<string|null>(null);
  const [actionMsg,setActionMsg]=useState('');
  const job=data.jobs.find(j=>j.id===jobId);
  const jobQuotes=data.bids.filter(b=>b.job_id===jobId&&b.status==='submitted');
  const jobInvoice=data.invoices.find(i=>i.job_id===jobId);

  useEffect(()=>{
    if(!jobId)return;
    supabase.from('job_tracking_events').select('id,event_type,message,created_at').eq('job_id',jobId).order('created_at',{ascending:true}).then(({data})=>setEvents((data??[]) as typeof events));
  },[jobId]);

  const openPod=async(path:string,index:number)=>{
    const key=`${index}`;
    setOpeningPod(key);
    setPodError('');
    const {data:session}=await supabase.auth.getSession();
    const token=session.session?.access_token;
    if(!token){setPodError('Session expired.');setOpeningPod(null);return;}
    const params=new URLSearchParams({jobId,path});
    const response=await fetch(`/api/pod/signed-url?${params.toString()}`,{headers:{Authorization:'Bearer ' + token}});
    const payload=await response.json().catch(()=>({})) as {signedUrl?:string;error?:string};
    setOpeningPod(null);
    if(!response.ok||!payload.signedUrl){setPodError(payload.error??'Unable to open the POD file.');return;}
    window.open(payload.signedUrl,'_blank','noopener,noreferrer');
  };

  const awardQuote=async(bidId:string)=>{
    setAwarding(bidId);
    setActionMsg('');
    const {data:session}=await supabase.auth.getSession();
    const response=await fetch(`/api/customer/bids/${bidId}/award`,{method:'POST',headers:session.session?.access_token?{Authorization:'Bearer ' + session.session.access_token}:{}});
    const payload=await response.json().catch(()=>({})) as {error?:string};
    setAwarding(null);
    if(!response.ok){setActionMsg(payload.error??'Unable to award quote.');return;}
    setActionMsg('Carrier quote awarded successfully.');
    await data.refresh();
  };

  if(data.loading)return <PageFrame><EmptyState title="Loading job…"/></PageFrame>;
  if(!job)return <PageFrame><AlertBanner tone="danger">This job was not found in the current customer company.</AlertBanner></PageFrame>;

  const podPaths=Array.isArray(job.delivery_photos)?job.delivery_photos.filter((p):p is string=>typeof p==='string'&&p.length>0):[];

  return <PageFrame>
    <PageHeader
      eyebrow={`Job ${job.id.slice(0,8).toUpperCase()}`}
      title={`${job.pickup_postcode??'Collection'} → ${job.delivery_postcode??'Delivery'}`}
      description="Collection, delivery, carrier progress, timeline, POD documents and invoices in a stable job URL."
      actions={<>
        {jobQuotes.length>0&&<ActionButton tone="secondary" onClick={()=>router.push('/customer/quotes')}>View quotes ({jobQuotes.length})</ActionButton>}
        {jobInvoice&&<ActionButton tone="primary" onClick={()=>router.push(`/customer/invoices/${jobInvoice.id}`)}>Open invoice</ActionButton>}
      </>}
    />
    {actionMsg&&<AlertBanner tone={actionMsg.includes('success')?'success':'danger'}>{actionMsg}</AlertBanner>}
    {podError&&<AlertBanner tone="danger">{podError}</AlertBanner>}
    <KpiGrid>
      <KpiCard label="Status" value={<span style={{fontSize:'1rem'}}>{(job.current_status??job.status).replace(/_/g,' ')}</span>}/>
      <KpiCard label="Pickup" value={<span style={{fontSize:'0.9rem'}}>{when(job.pickup_datetime)}</span>}/>
      <KpiCard label="Delivery" value={<span style={{fontSize:'0.9rem'}}>{when(job.delivery_datetime)}</span>}/>
      <KpiCard label="POD files" value={podPaths.length} tone="green"/>
      <KpiCard label="Quotes" value={jobQuotes.length} tone="purple"/>
    </KpiGrid>
    <TwoColumn>
      <div style={{display:'grid',gap:'0.9rem'}}>
        <Panel title="Transport details">
          <dl style={{display:'grid',gridTemplateColumns:'150px 1fr',gap:'0.55rem',fontSize:'0.8rem'}}>
            <dt>Collection</dt><dd>{job.pickup_location}</dd>
            <dt>Delivery</dt><dd>{job.delivery_location}</dd>
            <dt>Vehicle</dt><dd>{job.vehicle_type?.replace(/_/g,' ')??'Not specified'}</dd>
            <dt>Customer price</dt><dd>{money(Number(job.budget_amount??0))}</dd>
            <dt>Status</dt><dd><StatusBadge value={job.current_status??job.status}/></dd>
          </dl>
        </Panel>
        {podPaths.length>0&&(
          <Panel title="Proof of delivery" description="Short-lived signed links — issued per session.">
            <div style={{display:'flex',flexWrap:'wrap',gap:'0.5rem'}}>
              {podPaths.map((path,index)=>(
                <ActionButton key={index} tone="secondary" disabled={openingPod===String(index)} onClick={()=>void openPod(path,index)}>
                  {openingPod===String(index)?'Opening…':`Open POD file ${index+1}`}
                </ActionButton>
              ))}
            </div>
          </Panel>
        )}
        {jobInvoice&&(
          <Panel title="Invoice">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:'0.82rem'}}>
              <div>
                <div><strong>{jobInvoice.invoice_number??jobInvoice.id.slice(0,8)}</strong></div>
                <div style={{color:'#64748b'}}>{money(Number(jobInvoice.amount??0))}{jobInvoice.due_date?` · Due ${new Date(jobInvoice.due_date).toLocaleDateString('en-GB')}`:''}</div>
              </div>
              <div style={{display:'flex',gap:'0.4rem',alignItems:'center'}}>
                <StatusBadge value={jobInvoice.payment_status??jobInvoice.status}/>
                <ActionButton tone="primary" onClick={()=>router.push(`/customer/invoices/${jobInvoice.id}`)}>Open</ActionButton>
              </div>
            </div>
          </Panel>
        )}
      </div>
      <div style={{display:'grid',gap:'0.9rem'}}>
        {jobQuotes.length>0&&(
          <Panel title="Carrier quotes" description="Accept a quote to award this job to a carrier.">
            {jobQuotes.sort((a,b)=>Number(a.bid_price_gbp??a.amount??0)-Number(b.bid_price_gbp??b.amount??0)).map(bid=>(
              <div key={bid.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'0.5rem 0',borderBottom:'1px solid #e2e8f0',fontSize:'0.8rem'}}>
                <div>
                  <strong>{bid.companies?.name??'Carrier'}</strong>
                  <div style={{color:'#64748b'}}>{money(Number(bid.bid_price_gbp??bid.amount??0))}{bid.message?` · ${bid.message}`:''}</div>
                </div>
                <ActionButton tone="success" disabled={awarding===bid.id} onClick={()=>void awardQuote(bid.id)}>
                  {awarding===bid.id?'Awarding…':'Accept'}
                </ActionButton>
              </div>
            ))}
          </Panel>
        )}
        <Panel title="Tracking timeline">
          {events.map(e=><div key={e.id} style={{borderLeft:'3px solid #1d4ed8',padding:'0.2rem 0 0.75rem 0.7rem',fontSize:'0.76rem'}}>
            <strong>{e.event_type.replace(/_/g,' ')}</strong>
            <div style={{color:'#64748b'}}>{e.message??when(e.created_at)}</div>
          </div>)}
          {events.length===0&&<EmptyState title="No tracking events recorded"/>}
        </Panel>
      </div>
    </TwoColumn>
  </PageFrame>;
}
