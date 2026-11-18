'use client';

import WorkspaceRestrictionBanner from '../../../components/workspace/WorkspaceRestrictionBanner';
import { WORKSPACE_READINESS_CHANGED } from '../../../../lib/workspaceReadiness';

import { use, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../../components/ProtectedRoute';
import DriverWorkspaceShell from '../../_components/DriverWorkspaceShell';
import { supabase, isSupabaseConfigured } from '../../../../lib/supabaseClient';
import { MemberIdentityLink } from '../../../components/workspace/MemberProfile';
import { ActionButton, EmptyState, StatusBadge } from '../../../components/workspace/WorkspaceUI';
import QuotePublicRouteMap from '../../../components/workspace/QuotePublicRouteMap';
import MarketplaceQuoteModal, { type MarketplaceQuoteSubmitPayload } from '../../_components/MarketplaceQuoteModal';

type MarketplaceLoad = {
  route_stops?: {sequence:number;stop_type:string;area:string;window_start:string|null;window_end:string|null}[];
  id: string;
  company_id: string;
  status: string;
  pickup_area: string;
  pickup_postcode_area: string | null;
  pickup_datetime: string | null;
  pickup_time_slot: string | null;
  delivery_area: string;
  delivery_postcode_area: string | null;
  delivery_datetime: string | null;
  delivery_time_slot: string | null;
  pickup_country_code: string | null;
  delivery_country_code: string | null;
  vehicle_type: string | null;
  requested_vehicle_type: string | null;
  requested_vehicle_label: string | null;
  cargo_type: string | null;
  requested_cargo_label: string | null;
  weight_kg: number | null;
  pallets: number | null;
  length_cm: number | null;
  width_cm: number | null;
  height_cm: number | null;
  cargo_value_gbp: number | null;
  pallet_type: string | null;
  pallet_stackable: boolean | null;
  collection_forklift_available: boolean | null;
  collection_tail_lift_required: boolean | null;
  collection_handball_required: boolean | null;
  delivery_forklift_available: boolean | null;
  delivery_tail_lift_required: boolean | null;
  delivery_handball_required: boolean | null;
  handling_requirements: string[];
  service_mode: string | null;
  direct_delivery_required: boolean;
  distance_miles: number | null;
  distance_minutes: number | null;
  distance_to_pickup_miles: number | null;
  pickup_eta_minutes: number | null;
  is_fixed_price: boolean;
  budget_amount: number | null;
  currency: string;
  exchange_posted_at: string | null;
  hard_copy_pod: string | null;
  pod_required: boolean | null;
  payment_terms: string | null;
  public_quote_notes: string | null;
  member: {
    companyId: string;
    name: string;
    memberId: string | null;
    phone: string | null;
    memberType: string | null;
    memberSince: string | null;
    postedBy: string | null;
  };
  myBid: {
    status: string | null;
    amount: number | null;
    message: string | null;
  } | null;
};

const money = (value: number | null, currency = 'GBP') =>
  value == null
    ? 'Quote required'
    : new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value);

const formatDT = (value: string | null) =>
  value
    ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
    : 'TBC';

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString('en-GB', { dateStyle: 'medium' }) : 'Not supplied';

function dimensions(load: MarketplaceLoad) {
  const values = [load.length_cm, load.width_cm, load.height_cm];
  if (values.every((value) => value == null)) return 'Not supplied';
  return values.map((value) => value == null ? '—' : `${value}`).join(' × ') + ' cm';
}

export default function LoadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [load, setLoad] = useState<MarketplaceLoad | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [bidAmount, setBidAmount] = useState('');
  const [bidMessage, setBidMessage] = useState('');
  const [bidLoading, setBidLoading] = useState(false);
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [showMap,setShowMap]=useState(true);
  const [costPerMile,setCostPerMile]=useState("");
  const [extraMiles,setExtraMiles]=useState("");
  const [extraCosts,setExtraCosts]=useState("");
  const [estimate,setEstimate]=useState("");

  const getAccessToken = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    return sessionData.session?.access_token ?? null;
  }, []);

  const fetchLoad = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setError('Service temporarily unavailable.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Your session has expired. Sign in again.');
      const response = await fetch(`/api/driver/marketplace/loads?id=${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const payload = (await response.json().catch(() => ({}))) as { load?: MarketplaceLoad; error?: string };
      if (!response.ok || !payload.load) throw new Error(payload.error || 'This load is no longer available on the marketplace.');
      setLoad(payload.load);
      if (payload.load.budget_amount != null && payload.load.budget_amount > 0) setBidAmount(String(payload.load.budget_amount));
      else setBidAmount('');
    } catch (reason) {
      setLoad(null);
      setError(reason instanceof Error ? reason.message : 'Unable to load this marketplace listing.');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, id]);

  useEffect(() => { void fetchLoad(); }, [fetchLoad]);

  const handleBidSubmit = async (quote: MarketplaceQuoteSubmitPayload) => {
    if (bidLoading) return;
    const amount = quote.totalAmount;
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter a valid quote amount greater than £0.');
      return;
    }

    setBidLoading(true);
    setError('');
    setSuccess('');
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Your session has expired. Sign in again.');
      const response = await fetch('/api/driver/bids', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobId: id,
          amount,
          baseAmount: quote.baseAmount,
          additionalExtrasGbp: quote.additionalExtrasGbp,
          message: quote.message,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; denialReasons?: string[] };
      if (!response.ok) { window.dispatchEvent(new Event(WORKSPACE_READINESS_CHANGED)); throw new Error(payload.error || 'Your quote could not be submitted.'); }
      setSuccess('Quote submitted successfully. The posting member will review it.');
      setBidMessage('');
      setQuoteModalOpen(false);
      await fetchLoad();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Your quote could not be submitted.');
    } finally {
      setBidLoading(false);
    }
  };

  const hasProposedPrice = Boolean(load?.budget_amount != null && load.budget_amount > 0);

  const areaLabel = (town:string, postcode:string|null) => [town,postcode].filter(Boolean).filter((v,i,a)=>i===0 || !String(a[0]).toUpperCase().endsWith(String(v).toUpperCase())).join(", ");
  const stops = load?.route_stops ?? [];
  const panel = {border:"1px solid #E5E7EB",borderRadius:6,padding:12,background:"#FFFFFF"};
  const field = (name:string,value:React.ReactNode) => <div style={{display:"flex",justifyContent:"space-between",gap:12,padding:"5px 0",borderBottom:"1px solid #E5E7EB"}}><span>{name}</span><strong style={{textAlign:"right"}}>{value}</strong></div>;
  const yn = (v:boolean|null)=>v==null?"Not supplied":v?"Yes":"No";
  const routeLabel = stops.length>2 ? (stops.filter(s=>s.stop_type==="collection").length>1?"Multi-Stop / ":"Multi-Drop / ") : "";
  const serviceLabel = load?.service_mode?.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase()) ?? (load?.direct_delivery_required?"Direct":"On Demand");
  const journey = load ? (stops.length ? stops.map((v,i)=>({label:v.stop_type==="collection"?"Collection":i===stops.length-1?"Final delivery":"Intermediate delivery",area:i===0?areaLabel(load.pickup_area,load.pickup_postcode_area):i===stops.length-1?areaLabel(load.delivery_area,load.delivery_postcode_area):v.area,when:v.window_start?formatDT(v.window_start)+(v.window_end?" - "+formatDT(v.window_end):""):i===stops.length-1?(load.delivery_time_slot??"Time not specified"):"Time not specified"})):[{label:"Collection",area:areaLabel(load.pickup_area,load.pickup_postcode_area),when:[formatDT(load.pickup_datetime),load.pickup_time_slot].filter(Boolean).join(" / ")},{label:"Final delivery",area:areaLabel(load.delivery_area,load.delivery_postcode_area),when:[formatDT(load.delivery_datetime),load.delivery_time_slot].filter(Boolean).join(" / ")}]):[];
  const mapsParams = new URLSearchParams({api:"1",origin:journey[0]?.area??"",destination:journey.at(-1)?.area??"",travelmode:"driving"});
  if(journey.length>2)mapsParams.set("waypoints",journey.slice(1,-1).map(v=>v.area).join("|"));
  const miles = (load?.distance_miles??0)+Number(extraMiles);
  const costs = miles*Number(costPerMile)+Number(extraCosts);
  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell>
        <div style={{ display: 'grid', gap: 8 }}>
          <div className="driver-board-summary" style={{ justifyContent: 'space-between' }}><span><button type="button" onClick={() => router.back()} style={{ border: 0, background: 'transparent', color: '#1d57d8', cursor: 'pointer', fontWeight: 700, padding: 0 }}>← Back to Loads</button></span><span>Pre-award marketplace view · exact execution details protected</span></div>
          {error && <div role="alert" style={{ minHeight: 32, display: 'flex', alignItems: 'center', padding: '6px 10px', border: '1px solid #fecaca', borderRadius: 4, background: '#fef2f2', color: '#b91c1c', fontSize: 12, fontWeight: 700 }}>{error}</div>}
          {error && <WorkspaceRestrictionBanner operation="quote" inline />}
          {success && <div style={{ minHeight: 32, display: 'flex', alignItems: 'center', padding: '6px 10px', border: '1px solid #bbf7d0', borderRadius: 4, background: '#ecfdf3', color: '#166534', fontSize: 12, fontWeight: 700 }}>{success}</div>}

          {loading ? <div className="driver-load-row"><EmptyState compact title="Loading marketplace load…" /></div> : load ? (
            <article className="driver-load-row xd-load-detail-redesign" data-state={load.myBid?.status ? 'quoted' : 'open'}>
              <div style={{display:'grid',gap:12,padding:12,color:'#1F2937'}}><style>{".xd-load-detail-redesign .xd-overview{background:#0A234F!important;color:white!important;border-bottom:3px solid #F5A300!important}.xd-load-detail-redesign .xd-overview *{color:inherit!important}.xd-load-detail-redesign .xd-overview small{color:#D8E4FA!important}.xd-load-detail-redesign .xd-detail-columns{display:grid;grid-template-columns:minmax(0,7fr) minmax(0,3fr);gap:12px;align-items:start}.xd-load-detail-redesign h3{font-size:15px;margin:0 0 8px;color:#0A234F;font-weight:700}.xd-load-detail-redesign .xd-overview h2{font-size:20px;margin:4px 0}.xd-load-detail-redesign .xd-stop{position:relative}.xd-load-detail-redesign .xd-stop:not(:last-of-type):before{content:'';position:absolute;left:13px;top:40px;bottom:-12px;width:2px;background:#B6C8E5}.xd-load-detail-redesign .xd-stop strong{z-index:1}.xd-load-detail-redesign .xd-cargo-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 20px}.xd-load-detail-redesign .xd-quote-action{position:sticky;bottom:0;background:white;padding:12px;border-top:1px solid #E5E7EB;z-index:2}@media(max-width:900px){.xd-load-detail-redesign .xd-detail-columns,.xd-load-detail-redesign .xd-cargo-grid{grid-template-columns:1fr}}"}</style>
                <section className='xd-overview' style={{...panel,background:'#0A234F',color:'#FFFFFF',display:'flex',flexWrap:'wrap',gap:24,alignItems:'center'}}>
                  <div><small>XDrive Reference</small><h2>XDL-{load.id.slice(0,8).toUpperCase()}</h2></div>
                  <div><small>Transport / Service</small><strong style={{display:'block'}}>{routeLabel+serviceLabel}</strong></div>
                  <div><small>Job distance / Driving time</small><strong style={{display:'block'}}>{load.distance_miles??'Not supplied'} mi / {load.distance_minutes??'Not supplied'} min</strong></div>
                  <div><small>Payment terms</small><strong style={{display:'block'}}>{load.payment_terms??'Not supplied'}</strong></div>
                  <div><small>{hasProposedPrice?'Proposed rate':'Commercial status'}</small><strong style={{display:'block',color:'#F5A300'}}>{hasProposedPrice?money(load.budget_amount,load.currency):'Quote required'}</strong></div>
                  <div><small>Posted</small><strong style={{display:'block'}}>{formatDT(load.exchange_posted_at)}</strong></div>
                </section>
                <div className='xd-detail-columns'>
                  <div style={{display:'grid',gap:12}}>
                    <section style={panel}><h3>Journey &amp; Schedule / {journey.length} stops</h3><p>{journey.filter(v=>v.label!=='Collection').length} deliveries</p>
                      {journey.map((v,i)=><div className='xd-stop' key={i} style={{display:'grid',gridTemplateColumns:'32px 1fr',gap:12,padding:'12px 0',borderBottom:'1px solid #E5E7EB'}}><strong style={{background:i===0?'#0E3FA9':i===journey.length-1?'#16834B':'#F5A300',color:i>0&&i<journey.length-1?'#0A234F':'white',borderRadius:'50%',width:28,height:28,display:'grid',placeItems:'center'}}>{i+1}</strong><div><small>{v.label}</small><h3>{v.area}</h3><span>{v.when}</span></div></div>)}
                      {field('Collection timing',load.pickup_time_slot??'Not supplied')}{field('Delivery timing',load.delivery_time_slot??'Not supplied')}
                    </section>
                    <section style={panel}><h3>Route &amp; Operational Map</h3><p>Approximate public postcode areas only.</p><button type="button" onClick={()=>setShowMap(v=>!v)}>{showMap?'Hide route map':'Show route map'}</button> <a href={'https://www.google.com/maps/dir/?'+mapsParams.toString()} target="_blank" rel="noreferrer">Open Google Maps</a>{showMap&&<QuotePublicRouteMap stops={journey}/>}</section>
                    <section style={panel}><h3>Load &amp; Cargo Information</h3><div className="xd-cargo-grid">
                    {field('Requested vehicle',load.requested_vehicle_label??load.requested_vehicle_type??load.vehicle_type??'Not supplied')}{field('Freight type',load.requested_cargo_label??load.cargo_type??'Not supplied')}{field('Packaging',load.pallet_type??'Not supplied')}{field('Pallets',load.pallets??'Not supplied')}{field('Weight',load.weight_kg==null?'Not supplied':load.weight_kg+' kg')}{field('Dimensions',dimensions(load))}{field('Cargo value',load.cargo_value_gbp==null?'Not supplied':money(load.cargo_value_gbp))}{field('Stackable',yn(load.pallet_stackable))}</div>
                    </section>
                  </div>
                  <div style={{display:'grid',gap:12}}>
                    <section style={panel}><h3>Posting Company</h3><h3><MemberIdentityLink companyId={load.member.companyId}>{load.member.name}</MemberIdentityLink></h3>{field('Member ID',load.member.memberId??'Not supplied')}{field('Member type',load.member.memberType??'Not supplied')}{field('Member since',formatDate(load.member.memberSince))}{field('Quote contact',load.member.phone??'Not supplied')}{field('Posted by',load.member.postedBy??'Not supplied')}{field('To Collection',load.distance_to_pickup_miles==null?'Not available':load.distance_to_pickup_miles+' mi / '+(load.pickup_eta_minutes??'Unknown')+' min')}</section>
                    <section style={panel}><h3>Commercial Terms &amp; Requirements</h3>{field('Payment terms',load.payment_terms??'Not supplied')}{field('Pricing',load.is_fixed_price?'Fixed price':hasProposedPrice?'Proposed rate':'Quote required')}{field('Digital POD','Required for every job')}{field('Hard-copy POD',load.hard_copy_pod??'No additional requirement')}{field('Collection forklift',yn(load.collection_forklift_available))}{field('Collection tail lift',yn(load.collection_tail_lift_required))}{field('Collection handball',yn(load.collection_handball_required))}{field('Delivery forklift',yn(load.delivery_forklift_available))}{field('Delivery tail lift',yn(load.delivery_tail_lift_required))}{field('Delivery handball',yn(load.delivery_handball_required))}{field('Public requirements',load.handling_requirements.join(' / ')||'Not supplied')}{field('Public quote notes',load.public_quote_notes??'Not supplied')}</section>
                    <section style={panel}><h3>Quote Preparation Calculator</h3><p>Private estimate only. Not shared or submitted.</p>{([{name:'Operating cost (?/mile)',value:costPerMile,set:setCostPerMile},{name:'Empty mileage',value:extraMiles,set:setExtraMiles},{name:'Additional costs (?)',value:extraCosts,set:setExtraCosts},{name:'Proposed quote (?)',value:estimate,set:setEstimate}]).map(f=><label key={f.name} style={{display:'flex',justifyContent:'space-between',gap:8,margin:'8px 0'}}>{f.name}<input type="number" min="0" step="any" value={f.value} onChange={e=>f.set(e.target.value)} style={{width:100}}/></label>)}{load.distance_miles!=null&&costPerMile!==''&&[costPerMile,extraMiles,extraCosts,estimate].every(v=>Number.isFinite(Number(v))&&Number(v)>=0)&&<>{field('Total mileage',miles.toFixed(1)+' mi')}{field('Estimated costs',money(costs))}{estimate!==''&&field('Estimated margin',money(Number(estimate)-costs))}</>}</section>
                  </div>
                </div>
                <div style={{...panel,background:'#F4F6F8'}}><strong>Execution privacy boundary:</strong> exact addresses, operational contacts, private references and execution instructions are protected until authorised allocation.</div>
                {load.myBid ? <div style={{ padding: 8, border: '1px solid #bae6fd', borderRadius: 4, background: '#f0f9ff', color: '#0369a1', fontSize: 12 }}><strong>Quote already submitted</strong><div style={{ marginTop: 3 }}>Amount: {money(load.myBid.amount)} · Status: {load.myBid.status ?? 'submitted'}</div>{load.myBid.message && <div style={{ marginTop: 3 }}>Message: {load.myBid.message}</div>}</div> : (
                  <div className="xd-quote-action" style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                    {hasProposedPrice ? <ActionButton tone="success" disabled={bidLoading} onClick={() => { setBidAmount(String(load.budget_amount ?? '')); setQuoteModalOpen(true); }}>{`Accept proposed price (${money(load.budget_amount, load.currency)})`}</ActionButton> : null}
                    <ActionButton tone="success" disabled={bidLoading} onClick={() => setQuoteModalOpen(true)}>Quote Now</ActionButton>
                  </div>
                )}
              </div>
            </article>
          ) : null}
          <MarketplaceQuoteModal
            target={load && quoteModalOpen ? {
              id: load.id,
              reference: "XDL-" + load.id.slice(0,8).toUpperCase(),
              distanceMiles: load.distance_miles, durationMinutes: load.distance_minutes,
              stops: (load.route_stops ?? []).map((s,i,all)=>({label:s.stop_type==="collection"?"Collection":"Delivery",area:i===0?[load.pickup_area,load.pickup_postcode_area].filter(Boolean).join(", "):i===all.length-1?[load.delivery_area,load.delivery_postcode_area].filter(Boolean).join(", "):s.area,when:s.window_start?formatDT(s.window_start)+(s.window_end?" - "+formatDT(s.window_end):""):"Time not specified"})),
              pallets: load.pallets, weight: load.weight_kg != null ? load.weight_kg+" kg" : null, dimensions: dimensions(load), cargo: load.requested_cargo_label ?? load.cargo_type,
              service: ((load.route_stops?.length ?? 0)>2 ? ((load.route_stops ?? []).filter(s=>s.stop_type==="collection").length>1?"Multi-stop / ":"Multi-drop / "):"")+(load.service_mode?.replace(/_/g," ")??"On Demand"),
              notes:load.public_quote_notes,paymentTerms:load.payment_terms,hardPod:load.hard_copy_pod,
              memberName: load.member.postedBy ?? load.member.name,
              companyId: load.company_id, memberCode: load.member.memberId,
              pickup: `${load.pickup_area}${load.pickup_postcode_area ? `, ${load.pickup_postcode_area}` : ''}`,
              delivery: `${load.delivery_area}${load.delivery_postcode_area ? `, ${load.delivery_postcode_area}` : ''}`,
              pickupAt: load.pickup_datetime,
              deliveryAt: load.delivery_datetime,
              vehicle: load.requested_vehicle_label
                ?? load.requested_vehicle_type?.replace(/_/g, ' ')
                ?? load.vehicle_type?.replace(/_/g, ' ')
                ?? 'Vehicle not specified',
            } : null}
            amount={bidAmount}
            message={bidMessage}
            working={bidLoading}
            error={error}
            onAmountChange={setBidAmount}
            onMessageChange={setBidMessage}
            onSubmit={(payload) => void handleBidSubmit(payload)}
            onClose={() => {
              if (!bidLoading) {
                setQuoteModalOpen(false);
                setBidMessage('');
              }
            }}
          />
        </div>
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
