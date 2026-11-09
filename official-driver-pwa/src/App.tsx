import { useEffect, useRef, useState } from "react";
import "./App.css";
import {
  nextJobStatus,
  validateQuote,
  validateTransition,
  type JobStatus,
} from "./workflow";
import {
  readLocalRecords,
  writeLocalRecords,
} from "./localRepository";
import LocalInvoices from "./LocalInvoices";
import LiveInvoices from "./LiveInvoices";
import DriverMenu from "./DriverMenu";
import BookingDocuments from "./BookingDocuments";
import PodCapture from "./PodCapture";
import LivePodCapture from "./LivePodCapture";
import RouteMap from "./RouteMap";
import { login as liveLogin, loadLiveWithDiagnostics, driverGet, driverPost, bookingOfferRespond, renewSession, revokeLiveSession, type LiveSession } from "./liveApi";
const LIVE_SESSION_KEY = "xdrive-driver-live-session-v1";
function savedLiveSession(): LiveSession | null {
  try {
    const raw = localStorage.getItem(LIVE_SESSION_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const session = value as Partial<LiveSession>;
    return typeof session.token === "string" && typeof session.refreshToken === "string" && typeof session.expiresAt === "number"
      ? session as LiveSession : null;
  } catch { return null; }
}
import { useRoadRadius } from "./useRoadRadius";
type Tab = "Loads" | "Quotes" | "Bookings" | "Map" | "Invoices" | "More" | "Alerts";
type Load = {
  id: string;
  from: string;
  to: string;
  pickup: string;
  delivery: string;
  vehicle: string;
  weight: number;
  notes: string;
  status: JobStatus;
  price?: number;
  quote?: number;
  quoteEta?: string;
  quoteVehicle?: string;
  quoteNotes?: string;
  quoteExtraName?: string;
  quoteExtraPrice?: number;
  quoteSubmittedAt?: string;
  quoteOutcome?: "UNSUCCESSFUL" | "CANCELLED" | "AWARDED";
  quoteClosedAt?: string;
  distanceMiles?: number;
  travelMinutes?: number;
  smartPay?: boolean;
  notificationReason?: string;
  notificationAt?: string;
  zoneAlert?: string;
  stops?: number;
  routeStops?: { id: string; kind: "PICKUP" | "DELIVERY"; address: string; completedAt?: string }[];
  customerPhone?: string;
  feedbackPay?: { positive: number; neutral: number; negative: number };
  feedbackDelivery?: { positive: number; neutral: number; negative: number };
  customerRef?: string;
  yourRef?: string;
  acceptanceRequired?: boolean;
  offerId?: string;
  backendStatus?: string;
  podRecorded?: boolean;
  acceptedAt?: string;
  collectionWeight?: number;
  driverNotes?: string;
  podReceivedBy?: string;
  podLeftAt?: string;
  items?: number;
  etaDateTime?: string;
  pod?: string;
  company?: string;
  terms?: string;
  pickupCompany?: string;
  pickupDate?: string;
  pickupTimeMode?: string;
  pickupTimeTo?: string;
  pickupAdditionalAddress?: string;
  deliveryDate?: string;
  deliveryTimeMode?: string;
  deliveryAdditionalAddress?: string;
  hardCopyPodRequired?: boolean;
  jobDescription?: string;
  packaging?: string;
  bodyType?: string;
  jobType?: string;
  freightType?: string;
  loadMetres?: number;
  cubicMetres?: number;
  cargoLength?: number;
  cargoWidth?: number;
  cargoHeight?: number;
  cargoDimensionUnit?: string;
  handlingRequirements?: Record<string, boolean>;
  enRouteAlertEmails?: string[];
  enRouteAlertHours?: number;
  proximityAlertEnabled?: boolean;
  attachmentDocuments?: { name: string; url?: string }[];
  pickupAddress?: string;
  pickupContactName?: string;
  pickupContactPhone?: string;
  pickupContactEmail?: string;
  pickupInstructions?: string;
  pickupDetails?: Record<string, string | number | boolean | null | undefined>;
  deliveryContactName?: string;
  deliveryContactPhone?: string;
  deliveryContactEmail?: string;
  deliveryInstructions?: string;
  deliveryDetails?: Record<string, string | number | boolean | null | undefined>;
  deliveryDestinations?: { company?: string; address: string; reference?: string; instructions?: string; contactName?: string; contactPhone?: string; additionalAddress?: string; date?: string; time?: string; timeMode?: string }[];
  deliveryCompany?: string;
  deliveryAddress?: string;
  attachmentNames?: string[];
  packages?: number;
  service?: string;
  serviceType?: string;
  postedAt?: string;
  isNew?: boolean;
};
// Fictional, explicitly local-only sample data; never presented as live customer records.
function App() {
  const [tab, setTab] = useState<Tab>(() => savedLiveSession() ? "Loads" : "More");
  const [liveSession, setLiveSession] = useState<LiveSession | null>(savedLiveSession);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [liveBusy, setLiveBusy] = useState(false);
  const [liveError, setLiveError] = useState("");
  const [liveWarning, setLiveWarning] = useState("");
  const [liveConnected, setLiveConnected] = useState(false);
  useEffect(() => { if (liveSession) localStorage.setItem(LIVE_SESSION_KEY, JSON.stringify(liveSession)); }, [liveSession]);
  useEffect(() => {
    let active = true;
    const previous = savedLiveSession();
    if (!previous) return;
    setLiveBusy(true);
    void (async () => {
      try {
        const session = await renewSession(previous);
        if (!active) return;
        setLiveSession(session);
        setLiveConnected(true);
        void syncAuthenticatedRole(session.token).catch(() => { /* Optional profile metadata must not block authorised job feeds. */ });
        const records = await loadLiveWithDiagnostics(session.token, snapshot => { if (active && !statusOperationRef.current) setJobs(snapshot.jobs as Load[]); });
        if (!active) return;
        setJobs(records.jobs as Load[]);
        setLiveWarning(records.warnings.join(" | "));
        setLiveError("");
      } catch (error) {
        if (!active) return;
        setLiveConnected(false);
        const message = error instanceof Error ? error.message : 'Session restoration failed';
        if (/refresh.token|invalid.grant|session.expired|already.used|invalid.*token/i.test(message)) {
          localStorage.removeItem(LIVE_SESSION_KEY);
          setLiveSession(null);
          setLiveError('Your session expired. Sign in again to receive your bookings.');
        } else setLiveError(message);
      } finally { if (active) setLiveBusy(false); }
    })();
    return () => { active = false; };
  }, []);
  const syncAuthenticatedRole = async (token: string) => {
    const profile = await driverGet("/profile", token);
    const driver = profile.driver as Record<string, unknown> | undefined;
    const type = String(driver?.driver_type || "").toLowerCase();
    setRole(type.includes("owner") ? "Owner Driver" : "Company Driver");
  };
  const statusOperationRef = useRef(false);
  const refreshLive = async (token: string) => {
    void syncAuthenticatedRole(token).catch(() => { /* API endpoints independently enforce driver access. */ });
    const records = await loadLiveWithDiagnostics(token, snapshot => { if (!statusOperationRef.current) setJobs(snapshot.jobs as Load[]); });
    if (!statusOperationRef.current) setJobs(records.jobs as Load[]);
    setLiveWarning(records.warnings.join(" | "));
    setLiveConnected(true);
  };
  useEffect(() => {
    if (!liveConnected || !liveSession) return;
    let running = false;
    const poll = async () => {
      if (running || document.visibilityState === 'hidden') return;
      running = true;
      try {
        const session = await renewSession(liveSession);
        setLiveSession(session);
        await refreshLive(session.token);
      } catch (error) {
        setLiveWarning('Booking updates could not refresh: ' + (error instanceof Error ? error.message : 'Request failed'));
      } finally { running = false; }
    };
    const timer = window.setInterval(() => { void poll(); }, 20000);
    const onFocus = () => { void poll(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus); };
  }, [liveConnected, liveSession?.token, liveSession?.expiresAt]);
  const connectLive = async () => {
    setLiveBusy(true);
    setLiveError("");
    try {
      const session = await liveLogin(loginEmail.trim(), loginPassword);
      setLiveSession(session);
      localStorage.setItem(LIVE_SESSION_KEY, JSON.stringify(session));
      setLiveConnected(true);
      await refreshLive(session.token);
      setLoginPassword("");
      setSelected(null);
      setTab("Loads");
    } catch (error) {
      setLiveConnected(false);
      setLiveError(error instanceof Error ? error.message : "Live connection failed");
    } finally { setLiveBusy(false); }
  };
  // Never present locally stored or seeded test records as production loads.
  // The approved TEST-1099 UI can still be loaded explicitly from the local test workspace.
  const [jobs, setJobs] = useState<Load[]>([]);

  const [selected, setSelected] = useState<string | null>(null);
  const [bookingResponseBusy, setBookingResponseBusy] = useState(false);
  const [viewedBookingOfferIds, setViewedBookingOfferIds] = useState<string[]>(() => readLocalRecords<string>('xdrive-viewed-booking-offers-v1', (v): v is string => typeof v === 'string'));
  const [alertSection, setAlertSection] = useState<"Inbox" | "Saved" | "Deleted">("Inbox");
  const [savedIds, setSavedIds] = useState<string[]>(() => readLocalRecords<string>("xdrive-alerts-saved-v1", (x): x is string => typeof x === "string"));
  const [deletedIds, setDeletedIds] = useState<string[]>(() => readLocalRecords<string>("xdrive-alerts-deleted-v1", (x): x is string => typeof x === "string"));
  const [routeJobId, setRouteJobId] = useState<string | null>(null);
  const [navigationChoiceOpen, setNavigationChoiceOpen] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [bookingScreen, setBookingScreen] = useState<"details" | "status" | "pickup" | "loaded" | "history" | "delivery" | "pod">("details");
  const [amount, setAmount] = useState("");

  const [notes, setNotes] = useState("");
  const [quoteEta, setQuoteEta] = useState("ASAP");
  const [quoteVehicle, setQuoteVehicle] = useState("");
  const [driverVehicles, setDriverVehicles] = useState<{ id: string; label: string }[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  useEffect(() => {
    if (!quoteOpen || !liveConnected || !liveSession?.token) return;
    let active = true;
    setVehiclesLoading(true);
    void driverGet("/vehicles", liveSession.token).then(response => {
      if (!active) return;
      const rows = Array.isArray(response.vehicles) ? response.vehicles : [];
      const vehicles = rows.filter((v): v is Record<string, unknown> => !!v && typeof v === "object" && typeof v.id === "string").map(v => ({
        id: String(v.id),
        label: [String(v.type || "Vehicle").replaceAll("_", " "), String(v.reg_plate || "")].filter(Boolean).join(" Â· "),
      }));
      setDriverVehicles(vehicles);
      const preferred = String(response.canonicalVehicleId || response.assignedVehicleId || "");
      setQuoteVehicle(current => vehicles.some(v => v.id === current) ? current : vehicles.find(v => v.id === preferred)?.id || (vehicles.length === 1 ? vehicles[0].id : ""));
    }).catch(() => { if (active) setDriverVehicles([]); }).finally(() => { if (active) setVehiclesLoading(false); });
    return () => { active = false; };
  }, [quoteOpen, liveConnected, liveSession?.token]);
  const [quoteExtra, setQuoteExtra] = useState(false);
  const [quoteExtraName, setQuoteExtraName] = useState("");
  const [quoteExtraPrice, setQuoteExtraPrice] = useState("");
  const [quoteSection, setQuoteSection] = useState<"Submitted" | "Unsuccessful">("Submitted");
  const [bookingSection, setBookingSection] = useState<"Current" | "Completed" | "Archived">("Current");
  const [archivedBookingIds, setArchivedBookingIds] = useState<string[]>(() => readLocalRecords("xdrive-booking-archive-v1", (value): value is string => typeof value === "string"));
  const [bookingHistory, setBookingHistory] = useState<Record<string, { status: string; at: string }[]>>(() => { try { return JSON.parse(localStorage.getItem("xdrive-booking-history-v1") || "{}"); } catch { return {}; } });
  const [mode, setMode] = useState<"sandbox" | "unconfigured">("unconfigured");
  const [role, setRole] = useState<"Owner Driver" | "Company Driver">(
    "Owner Driver",
  );
  const canBid = true;
  const [yourRef, setYourRef] = useState("");
  const [collectionWeight, setCollectionWeight] = useState("");
  const [podName, setPodName] = useState("");
  const [podEvidence, setPodEvidence] = useState(false);
  const [availabilityPrompt, setAvailabilityPrompt] = useState(false);
  const [available, setAvailable] = useState(() => localStorage.getItem('xdrive-driver-available-v1') !== 'false');
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuSection, setMenuSection] = useState<string | null>(null);
  const [driverNotes, setDriverNotes] = useState("");
  const [itemCount, setItemCount] = useState("");
  const [etaDateTime, setEtaDateTime] = useState("");
  const [podReceivedBy, setPodReceivedBy] = useState("");
  const [podLeftAt, setPodLeftAt] = useState("");
  useEffect(() => { if (!liveConnected && mode === "sandbox") writeLocalRecords("xdrive-local-jobs-v1", jobs); }, [jobs, liveConnected, mode]);
  useEffect(() => writeLocalRecords("xdrive-alerts-saved-v1", savedIds), [savedIds]);
  useEffect(() => writeLocalRecords("xdrive-booking-archive-v1", archivedBookingIds), [archivedBookingIds]);
  useEffect(() => writeLocalRecords("xdrive-viewed-booking-offers-v1", viewedBookingOfferIds), [viewedBookingOfferIds]);
  useEffect(() => writeLocalRecords("xdrive-alerts-deleted-v1", deletedIds), [deletedIds]);
  useEffect(() => localStorage.setItem("xdrive-booking-history-v1", JSON.stringify(bookingHistory)), [bookingHistory]);
  useEffect(() => localStorage.setItem('xdrive-driver-available-v1', String(available)), [available]);
  const [searchRadius, setSearchRadius] = useState(() => { try { return Math.min(30, Math.max(1, Number(JSON.parse(localStorage.getItem("xdrive-driver-preferences-v1") || "{}").radiusMiles) || 30)); } catch { return 30; } });
  useEffect(() => { const sync = () => { try { setSearchRadius(Math.min(30, Math.max(1, Number(JSON.parse(localStorage.getItem("xdrive-driver-preferences-v1") || "{}").radiusMiles) || 10))); } catch { setSearchRadius(30); } }; window.addEventListener("xdrive-radius-change", sync); return () => window.removeEventListener("xdrive-radius-change", sync); }, []);
  const [returnLoads, setReturnLoads] = useState(() => { try { return JSON.parse(localStorage.getItem("xdrive-driver-preferences-v1") || "{}").returnLoads === true; } catch { return false; } });
  useEffect(() => { const sync = () => { try { setReturnLoads(JSON.parse(localStorage.getItem("xdrive-driver-preferences-v1") || "{}").returnLoads === true); } catch { setReturnLoads(false); } }; window.addEventListener("xdrive-radius-change", sync); return () => window.removeEventListener("xdrive-radius-change", sync); }, []);
  const activeDelivery = returnLoads ? jobs.find(j => j.status !== "OPEN" && j.quoteOutcome !== "CANCELLED" && j.quoteOutcome !== "UNSUCCESSFUL" && j.status !== "DELIVERED") : undefined;
  const roadRadius = useRoadRadius(jobs, searchRadius, activeDelivery ? (activeDelivery.deliveryAddress && !activeDelivery.deliveryAddress.includes("(TEST ADDRESS)") ? activeDelivery.deliveryAddress : activeDelivery.to) : undefined);
  const job = jobs.find((j) => j.id === selected);
  const update = (id: string, patch: Partial<Load>) => {
    if (liveConnected) { setLiveError("LIVE booking status updates are not yet connected. No changes were sent."); return; }
    if (patch.status) setBookingHistory((history) => ({ ...history, [id]: [...(history[id] || []), { status: patch.status!, at: new Date().toISOString() }] }));
    setJobs((js) => js.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  };
  const listed =
    tab === "Loads" || tab === "Alerts"
      ? jobs.filter((j) => j.status === "OPEN" && j.quote === undefined && (liveConnected || roadRadius.miles[j.id] !== undefined) && (tab !== "Alerts" || (alertSection === "Saved" ? savedIds.includes(j.id) : alertSection === "Deleted" ? deletedIds.includes(j.id) : !deletedIds.includes(j.id))))
      : tab === "Quotes"
        ? jobs.filter((j) => j.quote !== undefined && (quoteSection === "Submitted" ? j.status === "OPEN" && j.quoteOutcome !== "UNSUCCESSFUL" && j.quoteOutcome !== "CANCELLED" : j.quoteOutcome === "UNSUCCESSFUL" || j.quoteOutcome === "CANCELLED"))
        : jobs.filter((j) => (liveConnected || j.id === "TEST-1099") && j.status !== "OPEN" && j.quoteOutcome !== "UNSUCCESSFUL" && j.quoteOutcome !== "CANCELLED" && (bookingSection === "Archived" ? archivedBookingIds.includes(j.id) : bookingSection === "Completed" ? j.status === "DELIVERED" && !archivedBookingIds.includes(j.id) : j.status !== "DELIVERED" && !archivedBookingIds.includes(j.id)));
  const pendingAllocations = jobs.filter(j => j.acceptanceRequired === true && j.status === "ALLOCATED");
  const unseenAllocations = pendingAllocations.filter(j => !viewedBookingOfferIds.includes(j.offerId || j.id));
  const next = job ? nextJobStatus(job.status) : undefined;
  const openJob = (id: string) => { const found = jobs.find(j => j.id === id); if (found?.acceptanceRequired && found.offerId) setViewedBookingOfferIds(ids => ids.includes(found.offerId!) ? ids : [...ids, found.offerId!]); setSelected(id); setBookingScreen("details"); setYourRef(found?.yourRef || found?.id || ""); setCollectionWeight(found?.collectionWeight ? String(found.collectionWeight) : ""); setDriverNotes(found?.driverNotes || ""); setItemCount(found?.items ? String(found.items) : ""); setEtaDateTime(found?.etaDateTime || ""); };
  const [deliveryRecipient, setDeliveryRecipient] = useState('');
  const [deliveryItems, setDeliveryItems] = useState('');
  const [deliveryCondition, setDeliveryCondition] = useState('Good condition');
  const [deliveryLeftAt, setDeliveryLeftAt] = useState('Goods Inwards');
  const [statusBusy, setStatusBusy] = useState(false);
  const submitLiveStatus = async (booking: Load, nextStatus: JobStatus) => {
    if (!liveSession || statusOperationRef.current) return;
    statusOperationRef.current = true;
    const apiStatuses: Partial<Record<JobStatus, string>> = { ON_WAY_TO_PICKUP: 'on_my_way', ON_SITE_PICKUP: 'on_site_pickup', LOADED: 'loaded', ON_WAY_TO_DELIVERY: 'in_transit', ON_SITE_DELIVERY: 'on_site_delivery', DELIVERED: 'delivered' };
    const apiStatus = apiStatuses[nextStatus];
    if (!apiStatus) { statusOperationRef.current = false; setLiveError('This status requires a separate evidence or POD workflow.'); return; }
    setStatusBusy(true);
    setLiveError('');
    // Keep the server-confirmed stage visible until the status write succeeds.
    try {
      const session = liveSession.expiresAt > Date.now() + 60_000 ? liveSession : await renewSession(liveSession);
      if (session !== liveSession) setLiveSession(session);
      // The authoritative driver RPC requires allocated -> accepted -> on_my_way.
      // Booking acceptance via the offer endpoint can leave the job at allocated.
      if (booking.status === 'ALLOCATED' && nextStatus === 'ON_WAY_TO_PICKUP' && ['allocated', 'assigned'].includes(booking.backendStatus || 'allocated')) {
        await driverPost('/mobile/jobs/' + encodeURIComponent(booking.id) + '/status', session.token, { nextStatus: 'accepted' });
      }
      await driverPost('/mobile/jobs/' + encodeURIComponent(booking.id) + '/status', session.token, { nextStatus: apiStatus });
      setJobs(rows => rows.map(row => row.id === booking.id ? { ...row, status: nextStatus, backendStatus: apiStatus } : row));
      setBookingHistory(history => ({ ...history, [booking.id]: [...(history[booking.id] || []), { status: nextStatus, at: new Date().toISOString() }] }));
      if (nextStatus === 'ON_SITE_PICKUP') setBookingScreen('pickup');
      else if (nextStatus === 'ON_SITE_DELIVERY') setBookingScreen('delivery');
      else if (nextStatus === 'LOADED') setBookingScreen('status');
      void refreshLive(session.token).catch(() => setLiveWarning('Status saved, but refreshing booking details failed.'));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not update booking status';
      // A stale client must recover from the server's authoritative lifecycle rather than replay acceptance.
      const expected = message.match(/Invalid driver status transition:\s*([a-z_]+)\s*->\s*[a-z_]+\.\s*Expected\s*([a-z_]+)/i);
      if (expected) {
        const serverState = expected[1].toLowerCase();
        const recovered = ({ allocated: 'ALLOCATED', accepted: 'ALLOCATED', on_my_way: 'ON_WAY_TO_PICKUP', on_site_pickup: 'ON_SITE_PICKUP', loaded: 'LOADED', in_transit: 'ON_WAY_TO_DELIVERY', on_site_delivery: 'ON_SITE_DELIVERY', delivered: 'DELIVERED' } as Record<string, JobStatus>)[serverState];
        if (recovered) setJobs(rows => rows.map(row => row.id === booking.id ? { ...row, status: recovered, backendStatus: serverState } : row));
        setLiveWarning('Booking status synchronized with the server. Please confirm the next step.');
        setLiveError('');
        try { await refreshLive((await renewSession(liveSession)).token); } catch { /* Preserve recovered state when refresh is unavailable. */ }
      } else {
        setJobs(rows => rows.map(row => row.id === booking.id ? booking : row));
        setBookingScreen('status');
        setLiveError('Status not saved. Previous stage restored. ' + message);
      }
    }
    finally { statusOperationRef.current = false; setStatusBusy(false); }
  };
  const completeLiveDelivery = async (booking: Load) => {
    if (!liveSession || statusBusy) return;
    if (!deliveryRecipient.trim() || !deliveryLeftAt.trim() || deliveryItems === '' || !Number.isInteger(Number(deliveryItems)) || Number(deliveryItems) < 1) {
      setLiveError('Complete the recipient, delivered items and delivery location before confirming delivery.');
      return;
    }
    statusOperationRef.current = true;
    setStatusBusy(true);
    setLiveError('');
    try {
      const session = liveSession.expiresAt > Date.now() + 60_000 ? liveSession : await renewSession(liveSession);
      if (session !== liveSession) setLiveSession(session);
      const deliveryNotes = [
        'Received by: ' + deliveryRecipient.trim(),
        'Items delivered: ' + Number(deliveryItems),
        'Condition: ' + deliveryCondition,
        'Left at: ' + deliveryLeftAt.trim(),
        driverNotes.trim() ? 'Driver notes: ' + driverNotes.trim() : '',
      ].filter(Boolean).join(' | ');
      const draftResponse = await fetch('/api/driver/web/jobs/' + encodeURIComponent(booking.id) + '/pod-draft', {
        method: 'PUT',
        headers: { Authorization: 'Bearer ' + session.token, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientName: deliveryRecipient.trim(),
          leftAt: deliveryLeftAt.trim(),
          itemCount: String(Number(deliveryItems)),
          deliveryStatus: deliveryCondition,
          notes: deliveryNotes,
        }),
      });
      if (!draftResponse.ok) {
        const details = await draftResponse.json().catch(() => ({})) as { error?: string };
        throw new Error(details.error || 'Delivery details could not be saved.');
      }
      await driverPost('/mobile/jobs/' + encodeURIComponent(booking.id) + '/status', session.token, { nextStatus: 'delivered' });
      setJobs(rows => rows.map(row => row.id === booking.id ? { ...row, status: 'DELIVERED', backendStatus: 'delivered' } : row));
      setBookingHistory(history => ({ ...history, [booking.id]: [...(history[booking.id] || []), { status: 'DELIVERED', at: new Date().toISOString() }] }));
      setBookingScreen('pod');
      setLiveWarning('Delivery completed. Save POD signature and evidence to finish the booking.');
      try { await refreshLive(session.token); } catch { setLiveWarning('Delivery saved; booking refresh is delayed.'); }
    } catch (error) {
      setLiveError('Delivery not completed. ' + (error instanceof Error ? error.message : 'Please retry.'));
    } finally { statusOperationRef.current = false; setStatusBusy(false); }
  };  const saveLivePickupDraft = async (booking: Load) => {
    if (!liveSession || statusBusy) return;
    setStatusBusy(true);
    setLiveError('');
    try {
      const session = liveSession.expiresAt > Date.now() + 60_000 ? liveSession : await renewSession(liveSession);
      if (session !== liveSession) setLiveSession(session);
      await driverPost('/mobile/jobs/' + encodeURIComponent(booking.id) + '/handover', session.token, {
        itemCount: itemCount === '' ? null : Number(itemCount),
        weightKg: collectionWeight === '' ? null : Number(collectionWeight),
        notes: driverNotes,
      });
      setBookingScreen('loaded');
      setLiveWarning('Collection details saved to XDrive. Confirm Loaded when collection is complete.');
      try { await refreshLive(session.token); } catch { setLiveWarning('Collection saved, but booking refresh is delayed.'); }
    } catch (error) {
      setLiveError('Collection details not saved. ' + (error instanceof Error ? error.message : 'Please retry.'));
    } finally { setStatusBusy(false); }
  };  const saveLiveHandover = async (booking: Load) => {
    if (!liveSession || statusBusy) return;
    setStatusBusy(true);
    setLiveError('');
    try {
      const session = await renewSession(liveSession);
      setLiveSession(session);
      await driverPost('/mobile/jobs/' + encodeURIComponent(booking.id) + '/handover', session.token, {
        itemCount: itemCount === '' ? null : Number(itemCount),
        weightKg: collectionWeight === '' ? null : Number(collectionWeight),
        notes: driverNotes,
      });
      if (booking.status === 'ON_SITE_PICKUP') {
        await driverPost('/mobile/jobs/' + encodeURIComponent(booking.id) + '/status', session.token, { nextStatus: 'loaded' });
        setJobs(rows => rows.map(row => row.id === booking.id ? { ...row, status: 'LOADED', backendStatus: 'loaded' } : row));
        setBookingHistory(history => ({ ...history, [booking.id]: [...(history[booking.id] || []), { status: 'LOADED', at: new Date().toISOString() }] }));
        setBookingScreen('status');
        setLiveWarning('Collection handover and Loaded status saved to XDrive.');
      } else {
        setBookingScreen('status');
        setLiveWarning('Collection handover saved to XDrive.');
      }
      await refreshLive(session.token);
    } catch (error) {
      setLiveError(error instanceof Error ? error.message : 'Could not save collection handover');
    } finally { setStatusBusy(false); }
  };
  const undoLiveStatus = async (booking: Load) => {
    if (!liveSession || statusBusy) return;
    const previous: Partial<Record<JobStatus, { status: JobStatus; backend: string }>> = {
      ON_WAY_TO_PICKUP: { status: 'ALLOCATED', backend: 'accepted' },
      ON_SITE_PICKUP: { status: 'ON_WAY_TO_PICKUP', backend: 'on_my_way' },
      LOADED: { status: 'ON_SITE_PICKUP', backend: 'on_site_pickup' },
      ON_WAY_TO_DELIVERY: { status: 'LOADED', backend: 'loaded' },
      ON_SITE_DELIVERY: { status: 'ON_WAY_TO_DELIVERY', backend: 'in_transit' },
    };
    const target = previous[booking.status];
    if (!target) { setLiveError('This booking status cannot be undone.'); return; }
    // Optimistic UI: the driver sees the preceding stage on the same click.
    // The server remains authoritative; failures restore the original stage.
    setStatusBusy(true);
    setLiveError('');
    setJobs(rows => rows.map(row => row.id === booking.id ? { ...row, status: target.status, backendStatus: target.backend } : row));
    try {
      const session = liveSession.expiresAt > Date.now() + 60_000 ? liveSession : await renewSession(liveSession);
      if (session !== liveSession) setLiveSession(session);
      await driverPost('/mobile/jobs/' + encodeURIComponent(booking.id) + '/undo-status', session.token, { expectedCurrentStatus: booking.backendStatus || ({ ALLOCATED: 'accepted', ON_WAY_TO_PICKUP: 'on_my_way', ON_SITE_PICKUP: 'on_site_pickup', LOADED: 'loaded', ON_WAY_TO_DELIVERY: 'in_transit', ON_SITE_DELIVERY: 'on_site_delivery' } as Record<string,string>)[booking.status] });
      setBookingHistory(history => { const entries = history[booking.id] || []; const lastMatchingIndex = entries.map(entry => entry.status).lastIndexOf(booking.status); return { ...history, [booking.id]: lastMatchingIndex < 0 ? entries : entries.filter((_, index) => index !== lastMatchingIndex) }; });
      // A failed list refresh must not undo a successful server mutation.
      try { await refreshLive(session.token); } catch { setLiveWarning('Undo saved. Booking list refresh is delayed.'); }
    } catch (error) {
      setJobs(rows => rows.map(row => row.id === booking.id ? booking : row));
      setLiveError('Undo was not saved. Previous status restored. ' + (error instanceof Error ? error.message : 'Please retry.'));
    } finally { setStatusBusy(false); }
  };
  const respondToBooking = async (offer: Load, action: 'accept' | 'decline') => {
    if (!liveConnected || !liveSession || !offer.offerId || bookingResponseBusy) return;
    setBookingResponseBusy(true);
    setLiveError('');
    try {
      const session = await renewSession(liveSession);
      setLiveSession(session);
      await bookingOfferRespond(session.token, offer.offerId, action);
      setJobs(rows => rows.map(row => row.id === offer.id ? { ...row, acceptanceRequired: false, ...(action === 'decline' ? { status: 'OPEN' as const, quoteOutcome: 'CANCELLED' as const } : { acceptedAt: new Date().toISOString() }) } : row));
      if (action === 'decline') setSelected(null);
      try { await refreshLive(session.token); } catch (error) {
        setLiveWarning('Booking response saved, but the list could not refresh: ' + (error instanceof Error ? error.message : 'Please retry refreshing.'));
      }
    } catch (error) {
      setLiveError(error instanceof Error ? error.message : 'Booking response failed');
    } finally { setBookingResponseBusy(false); }
  };
  const toggleSaved = (id: string) => setSavedIds((v) => v.includes(id) ? v.filter((x) => x !== id) : [...v, id]);
  const toggleDeleted = (id: string) => setDeletedIds((v) => v.includes(id) ? v.filter((x) => x !== id) : [...v, id]);
  return (
    <div className={routeJobId ? "shell route-view" : tab === "Loads" && listed.length === 0 ? "shell no-empty-scroll" : "shell"}>
      <header>
        <div className="brand">
          <img className="driver-brand-logo" src={import.meta.env.DEV ? "/xdrive-logo-company-3150.png" : "/driver/official-pwa/xdrive-logo-company-3150.png"} alt="XDrive Logistics" />
        </div>
        <button
          className="headbtn"
          onClick={() => { setMenuSection(null); setMenuOpen(true); }}
          aria-label="Open driver menu"
        >
          Menu
        </button>
      </header>
      <main>
        {routeJobId && jobs.some(j => j.id === routeJobId) ? (() => {
          const routeJob = jobs.find(j => j.id === routeJobId)!;
          return <RouteMap from={routeJob.from} to={routeJob.to} stops={routeJob.routeStops} distanceMiles={routeJob.distanceMiles} travelMinutes={routeJob.travelMinutes} onBack={() => setRouteJobId(null)} />;
        })() : selected && job ? (
          <>
            <button className="back" onClick={() => setSelected(null)}>
              Back to {tab}
            </button>
            <article className={tab === "Bookings" && bookingScreen === "details" ? "booking-details-root" : tab === "Quotes" ? "card quote-green-card quote-green-details" : "card"}>
              {tab !== "Bookings" ? <div className="booking-overview">
              <div className="cardtop">
                <strong>{job.yourRef || job.customerRef || `Job ${job.id.slice(0, 8).toUpperCase()}`}</strong>
                <span className="pill">{job.status.replaceAll("_", " ")}</span>
              </div>
              <div className="route">
                <div>
                  <i /> <strong>{job.from}</strong>
                  <small>Pickup Â· {job.pickup}</small>
                </div>
                <div>
                  <i /> <strong>{job.to}</strong>
                  <small>Delivery Â· {job.delivery}</small>
                </div>
              </div>
              <div className="facts">
                <span>{job.vehicle}</span>
                <span>{job.weight} kg</span>
              </div>
              <div className="mobile-job-facts"><div>Service: {(job.service || "Same Day").replaceAll("_", " ")}</div><div>Vehicle: {job.vehicle}</div><div>Weight: {job.weight} kg</div>{job.packages != null && <div>Packages: {job.packages}</div>}</div>
              <button className="map-action" onClick={() => setRouteJobId(job.id)}>View on Map</button>

              {tab === "Alerts" && job.status === "OPEN" && <p className="notification-reason">Notification Reason: {job.notificationReason || "Driver current location"}</p>}
              <div className="customer-panel"><h2>Customer</h2><p>{job.company || "Customer not provided"}</p><p>Payment terms: {job.terms?.replace(/\s*EOM\b/gi, "").trim() || "Not provided"}</p>{job.customerPhone && <p>Telephone: <a href={`tel:${job.customerPhone}`}>{job.customerPhone}</a> <a href={`tel:${job.customerPhone}`}>Call</a></p>}<p>Instructions: {job.notes}</p>{job.feedbackPay || job.feedbackDelivery ? <div className="quote-feedback"><h3>Feedback (Last 90 days)</h3>{job.feedbackPay && <p>Pay: Pos: {job.feedbackPay.positive} Â· Neu: {job.feedbackPay.neutral} Â· Neg: {job.feedbackPay.negative}</p>}{job.feedbackDelivery && <p>Del: Pos: {job.feedbackDelivery.positive} Â· Neu: {job.feedbackDelivery.neutral} Â· Neg: {job.feedbackDelivery.negative}</p>}</div> : <p>Feedback not available</p>}</div>
              {job.status === "OPEN" && <div className="alert-actions"><button onClick={() => toggleSaved(job.id)}>{savedIds.includes(job.id) ? "Unsave" : "Save"}</button><button onClick={() => { toggleDeleted(job.id); setSelected(null); setTab("Alerts"); setAlertSection("Deleted"); }}>Delete alert</button></div>}
              {job.podReceivedBy && <p>Received by: {job.podReceivedBy}</p>}
              {job.podLeftAt && <p>Left at: {job.podLeftAt}</p>}
              {job.quoteEta && <p>Estimated collection arrival: <strong>{job.quoteEta}</strong></p>}
              {job.quoteNotes && <p>Quote notes: {job.quoteNotes}</p>}
              {job.quote !== undefined && (
                <p>
                  Your quote: <strong>Â£{job.quote.toFixed(2)} net</strong>
                </p>
              )}
              {job.status === "ALLOCATED" && job.acceptanceRequired && <section className="acceptance-panel"><h2>Acceptance Required</h2><p>{job.company || "XDrive test customer"} Â· Your Ref. {job.yourRef || job.id}</p><div className="actions"><button className="danger" disabled={bookingResponseBusy} onClick={() => { if (liveConnected) void respondToBooking(job, "decline"); else { update(job.id, { status: "OPEN", acceptanceRequired: false, quoteOutcome: "CANCELLED" }); setSelected(null); } }}>Decline</button><button className="accept-action" disabled={bookingResponseBusy} onClick={() => liveConnected ? void respondToBooking(job, "accept") : update(job.id, { acceptanceRequired: false, acceptedAt: new Date().toISOString() })}>Accept</button></div></section>}
              </div> : null}

              {job.status !== "OPEN" && bookingScreen === "details" && <section className="booking-detail-sheet booking-detail-redesign">
                <header className="booking-detail-hero"><h2>{job.company || "Customer not provided"}</h2><p>Your Ref. {job.yourRef || job.id}</p><strong>{job.acceptanceRequired ? "ACCEPTANCE REQUIRED" : job.status.replaceAll("_", " ")}</strong><small>Posted: {job.postedAt || "Not provided"}</small></header>
                <section className="booking-detail-group">
<h3>Collection Details</h3>
<h4>{job.from} Â· {job.pickup}</h4>{job.pickupDate && <div className="booking-info-row"><b>Collection date</b><span>{job.pickupDate}</span></div>}{job.pickupTimeMode && <div className="booking-info-row"><b>Time mode</b><span>{job.pickupTimeMode}</span></div>}{job.pickupTimeTo && <div className="booking-info-row"><b>Collection window ends</b><span>{job.pickupTimeTo}</span></div>}
<div className="booking-info-row">
<b>Company</b>
<span>{job.pickupCompany || "Not provided in Post Load"}</span>
</div>
<div className="booking-info-row">
<b>Full address</b>
<span>{job.pickupAddress || "Full address not provided in Post Load"}</span>
</div>{job.pickupContactName && <div className="booking-info-row">
<b>Contact</b>
<span>{job.pickupContactName}</span>
</div>}{job.pickupContactPhone && <div className="booking-info-row">
<b>Phone</b>
<a href={"tel:" + job.pickupContactPhone}>{job.pickupContactPhone}</a>
</div>}{job.pickupContactEmail && <div className="booking-info-row">
<b>Email</b>
<span>{job.pickupContactEmail}</span>
</div>}{job.customerRef && <div className="booking-info-row">
<b>Customer reference</b>
<span>{job.customerRef}</span>
</div>}{job.pickupAdditionalAddress && <div className="booking-info-row"><b>Additional address information</b><span>{job.pickupAdditionalAddress}</span></div>}{job.pickupInstructions && <p><strong>Collection instructions:</strong> {job.pickupInstructions}</p>}{Object.entries(job.pickupDetails || {}).filter(([,v]) => v !== undefined && v !== null && v !== "").map(([k,v]) => <div className="booking-info-row" key={k}>
<b>{k}</b>
<span>{String(v)}</span>
</div>)}<button className="booking-detail-nav" type="button" aria-expanded={navigationChoiceOpen} onClick={() => setNavigationChoiceOpen(open => !open)}>{["ALLOCATED", "ON_WAY_TO_PICKUP", "ON_SITE_PICKUP"].includes(job.status) ? "Navigate to Collection" : "Navigate to Delivery"}</button>{navigationChoiceOpen && <div className="navigation-app-picker" aria-label="Choose navigation application">
<p>Choose navigation app</p>
<a href={"https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(["ALLOCATED", "ON_WAY_TO_PICKUP", "ON_SITE_PICKUP"].includes(job.status) ? (job.pickupAddress || job.from) : (job.deliveryAddress || job.to)) + "&travelmode=driving"} target="_blank" rel="noopener noreferrer"><img src="https://www.google.com/maps/favicon.ico" alt="" /><span>Google Maps</span></a>
<a href={"https://waze.com/ul?q=" + encodeURIComponent(["ALLOCATED", "ON_WAY_TO_PICKUP", "ON_SITE_PICKUP"].includes(job.status) ? (job.pickupAddress || job.from) : (job.deliveryAddress || job.to)) + "&navigate=yes"} target="_blank" rel="noopener noreferrer"><img src="https://www.waze.com/favicon.ico" alt="" /><span>Waze</span></a>
<a href={"https://maps.apple.com/?daddr=" + encodeURIComponent(["ALLOCATED", "ON_WAY_TO_PICKUP", "ON_SITE_PICKUP"].includes(job.status) ? (job.pickupAddress || job.from) : (job.deliveryAddress || job.to)) + "&dirflg=d"} target="_blank" rel="noopener noreferrer"><img src="https://maps.apple.com/favicon.ico" alt="" /><span>Apple Maps</span></a>
</div>}</section>
                <section className="booking-detail-group"><h3>Delivery Details</h3>{(job.deliveryDestinations?.length ? job.deliveryDestinations : [{company:job.deliveryCompany,address:job.deliveryAddress || job.to,reference:job.customerRef,instructions:job.deliveryInstructions}]).map((dest,i) => <div key={i + "-" + dest.address}><h4>{i+1}. {dest.address} Â· {dest.time || job.delivery}</h4><div className="booking-info-row"><b>Company</b><span>{dest.company || "Not provided in Post Load"}</span></div><div className="booking-info-row"><b>Full address</b><span>{dest.address !== job.to ? dest.address : "Full address not provided in Post Load"}</span></div>{dest.reference && <div className="booking-info-row"><b>Reference</b><span>{dest.reference}</span></div>}{dest.instructions && <p>{dest.instructions}</p>}{dest.date && <div className="booking-info-row"><b>Delivery date</b><span>{dest.date}</span></div>}{dest.time && <div className="booking-info-row"><b>Delivery time</b><span>{dest.time}</span></div>}{dest.timeMode && <div className="booking-info-row"><b>Time mode</b><span>{dest.timeMode}</span></div>}{dest.contactName && <div className="booking-info-row"><b>Contact</b><span>{dest.contactName}</span></div>}{dest.contactPhone && <div className="booking-info-row"><b>Phone</b><a href={"tel:" + dest.contactPhone}>{dest.contactPhone}</a></div>}{dest.additionalAddress && <div className="booking-info-row"><b>Additional address information</b><span>{dest.additionalAddress}</span></div>}</div>)}{job.deliveryDate && <div className="booking-info-row"><b>Delivery date</b><span>{job.deliveryDate}</span></div>}{job.deliveryTimeMode && <div className="booking-info-row"><b>Delivery time mode</b><span>{job.deliveryTimeMode}</span></div>}{job.deliveryAdditionalAddress && <div className="booking-info-row"><b>Additional address information</b><span>{job.deliveryAdditionalAddress}</span></div>}{job.deliveryContactName && <div className="booking-info-row"><b>Contact</b><span>{job.deliveryContactName}</span></div>}{job.deliveryContactPhone && <div className="booking-info-row"><b>Phone</b><a href={"tel:" + job.deliveryContactPhone}>{job.deliveryContactPhone}</a></div>}{job.deliveryContactEmail && <div className="booking-info-row"><b>Email</b><span>{job.deliveryContactEmail}</span></div>}{Object.entries(job.deliveryDetails || {}).filter(([,v]) => v !== undefined && v !== null && v !== "").map(([k,v]) => <div className="booking-info-row" key={k}><b>{k}</b><span>{String(v)}</span></div>)}</section>
                <section className="booking-detail-group"><h3>Cargo & Job Details</h3>{job.jobDescription && <div className="booking-info-row"><b>Job description</b><span>{job.jobDescription}</span></div>}<div className="booking-info-row"><b>Vehicle</b><span>{job.vehicle}</span></div><div className="booking-info-row"><b>Items / packages</b><span>{job.items ?? job.packages ?? "Not provided"}</span></div><div className="booking-info-row"><b>Weight</b><span>{job.weight ? job.weight + " kg" : "Not provided"}</span></div><div className="booking-info-row"><b>Service</b><span>{job.service || "Not provided"}</span></div>{([['Packaging',job.packaging],['Body type',job.bodyType],['Job type',job.jobType],['Freight type',job.freightType],['Loading metres',job.loadMetres],['Cubic metres',job.cubicMetres],['Length',job.cargoLength],['Width',job.cargoWidth],['Height',job.cargoHeight],['Dimension units',job.cargoDimensionUnit]] as [string,string | number | undefined][]).filter(([,v])=>v!==undefined && v!=='').map(([k,v])=><div className="booking-info-row" key={k}><b>{k}</b><span>{v}</span></div>)}{Object.entries(job.handlingRequirements || {}).filter(([,enabled])=>enabled).length>0 && <><h4>Handling requirements</h4><p>{Object.entries(job.handlingRequirements || {}).filter(([,enabled])=>enabled).map(([name])=>name).join(' Â· ')}</p></>}<h4>Job instructions</h4><p>{job.notes || "No instructions supplied"}</p></section>
                <div className="booking-detail-metrics"><div><small>AGREED RATE</small><strong>{job.quote !== undefined ? "Â£" + job.quote.toFixed(2) : "Not provided"}</strong></div><div><small>DISTANCE</small><strong>{job.distanceMiles !== undefined ? job.distanceMiles.toFixed(2) + " miles" : "Not provided"}</strong></div><div><small>VEHICLE</small><strong>{job.vehicle}</strong></div><div><small>PAYMENT TERMS</small><strong>{job.terms?.replace(/\s*EOM\b/gi, "").trim() || "Not provided"}</strong></div></div>
                <section className="booking-detail-group"><h3>Documents</h3>{job.hardCopyPodRequired && <p><strong>Hard copy POD required</strong></p>}<BookingDocuments key={job.id} jobId={job.id} session={liveSession} live={liveConnected} />{job.attachmentDocuments?.length ? job.attachmentDocuments.map(doc=><p key={doc.name}>{doc.url ? <a href={doc.url} target="_blank" rel="noopener noreferrer">{doc.name}</a> : doc.name}</p>) : job.attachmentNames?.length ? job.attachmentNames.map(n => <p key={n}>{n}</p>) : <p>No documents attached in Post Load</p>}</section>
                {!job.acceptanceRequired && <button className="booking-history-action" type="button" onClick={() => setBookingScreen("history")}>Booking Status History</button>}
              </section>}
              {job.status !== "OPEN" && !job.acceptanceRequired && (bookingScreen === "status" || bookingScreen === "history") && <section className="booking-timeline" aria-label="Booking status"><h2>{bookingScreen === "history" ? "Booking Status History" : "Booking Status"}</h2><div className="timeline-step current"><span className="timeline-dot" /><button type="button" className="timeline-current-label" onClick={() => { if (job.status === "ON_WAY_TO_PICKUP") { if (liveConnected) void submitLiveStatus(job, "ON_SITE_PICKUP"); else { update(job.id, { status: "ON_SITE_PICKUP" }); setBookingScreen("pickup"); } } else if (job.status === "ON_SITE_PICKUP") { setBookingScreen("pickup"); } else if (job.status === "LOADED") { if (liveConnected) void submitLiveStatus(job, "ON_WAY_TO_DELIVERY"); else update(job.id, { status: "ON_WAY_TO_DELIVERY" }); } else if (job.status === "ON_WAY_TO_DELIVERY") { if (liveConnected) void submitLiveStatus(job, "ON_SITE_DELIVERY"); else { update(job.id, { status: "ON_SITE_DELIVERY" }); setBookingScreen("delivery"); } } else if (job.status === "ON_SITE_DELIVERY") { setBookingScreen("delivery"); } }}>{({ ALLOCATED: job.acceptanceRequired ? "Acceptance Required" : "On my Way to Pickup", ON_WAY_TO_PICKUP: "On Site (Pickup)", ON_SITE_PICKUP: "Loaded", LOADED: "On my Way to Delivery", ON_WAY_TO_DELIVERY: "On Site (Delivery)", ON_SITE_DELIVERY: "POD / Delivered", POD_SUBMITTED: "Delivered", DELIVERED: "Delivery Completed" } as Record<string, string>)[job.status]}</button></div>{["ALLOCATED", "ON_WAY_TO_PICKUP", "ON_SITE_PICKUP", "LOADED", "ON_WAY_TO_DELIVERY", "ON_SITE_DELIVERY", "POD_SUBMITTED", "DELIVERED"].filter(status => status !== "ALLOCATED" || !job.acceptanceRequired).filter(status => ["ALLOCATED", "ON_WAY_TO_PICKUP", "ON_SITE_PICKUP", "LOADED", "ON_WAY_TO_DELIVERY", "ON_SITE_DELIVERY", "POD_SUBMITTED", "DELIVERED"].indexOf(status) <= ["ALLOCATED", "ON_WAY_TO_PICKUP", "ON_SITE_PICKUP", "LOADED", "ON_WAY_TO_DELIVERY", "ON_SITE_DELIVERY", "POD_SUBMITTED", "DELIVERED"].indexOf(job.status)).filter(status => !liveConnected || status === job.status || (bookingHistory[job.id] || []).some(entry => entry.status === status)).reverse().map((status, index) => { const event = bookingHistory[job.id]?.find(entry => entry.status === status); const title = ({ ALLOCATED: "Accepted", ON_WAY_TO_PICKUP: "On my Way to Pickup", ON_SITE_PICKUP: "On Site (Pickup)", LOADED: "Loaded", ON_WAY_TO_DELIVERY: "On my Way to Delivery", ON_SITE_DELIVERY: "On Site (Delivery)", POD_SUBMITTED: "POD Submitted", DELIVERED: "Delivered" } as Record<string, string>)[status]; return <div key={status} className="timeline-step done"><span className="timeline-dot">&#10003;</span><div className="timeline-copy"><strong>{title}</strong>{event && <small>at {new Date(event.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</small>}{status === "LOADED" && <div className="timeline-loaded-details"><div>Your Ref: {job.yourRef || job.id}</div><div>Customer Ref: {job.customerRef || "Not provided"}</div><div>Items: {job.items ?? "Not provided"}</div></div>}</div>{index === 0 && status !== "ALLOCATED" && status !== "POD_SUBMITTED" && status !== "DELIVERED" && <button className="timeline-undo" type="button" onClick={() => { if (liveConnected) { void undoLiveStatus(job); return; } const history = bookingHistory[job.id] || []; const previous = history[history.length - 2]; if (!previous) return; setBookingHistory(h => ({ ...h, [job.id]: history.slice(0, -1) })); setJobs(js => js.map(j => j.id === job.id ? { ...j, status: previous.status as JobStatus } : j)); }}>Undo</button>}</div>; })}</section>}
              {job.status === "OPEN" ? (
                <>
                  <button
                    className="primary quote-now-green"
                    disabled={role === "Company Driver" && !canBid}
                    onClick={() => {
                      setQuoteOpen(true);
                      setAmount(String(job.quote ?? 160));
                    }}
                  >
                    {job.quote !== undefined ? "Edit Quote" : "Quote Now"}
                  </button>
                  {mode === "sandbox" &&
                    job.id.startsWith("TEST-") &&
                    job.quote !== undefined && (
                      <button
                        className="primary"
                        onClick={() => {
                          update(job.id, { status: "ALLOCATED", acceptanceRequired: true, quoteOutcome: "AWARDED" });
                          setTab("Bookings");
                          setSelected(null);
                          setPodName("");
                          setPodEvidence(false);
                        }}
                      >
                        Simulate Award (TEST ONLY)
                      </button>
                    )}
                  {job.quote !== undefined && (
                    <button
                      className="danger"
                      onClick={() => { update(job.id, { quote: undefined, quoteEta: undefined, quoteNotes: undefined, quoteSubmittedAt: undefined, quoteOutcome: undefined }); setTab("Loads"); setSelected(null); }}
                    >
                      Withdraw Quote
                    </button>
                  )}
                </>
              ) : bookingScreen === "status" || bookingScreen === "pickup" || bookingScreen === "loaded" || bookingScreen === "delivery" || bookingScreen === "pod" ? (
                <>
                  {liveError && <p role="alert" className="notification-reason">{liveError}</p>}
                  {statusBusy && <p role="status" className="notification-reason">Saving booking status to XDrive...</p>}
                  {job.status === "ON_SITE_PICKUP" && bookingScreen === "pickup" && <section className="booking-approved-onsite"><header className="booking-approved-heading"><h2>On Site (Pickup)</h2></header><div className="booking-approved-route"><div><strong>{job.pickupAddress || job.from}</strong><span>{job.pickup}</span></div><div><strong>{job.deliveryAddress || job.to}</strong><span>{job.delivery}</span></div></div><div className="booking-approved-details"><h3>Job Details</h3><p>{job.vehicle}</p>{job.pickupInstructions && <p>{job.pickupInstructions}</p>}</div><label className="booking-approved-notes">Driver's Notes<textarea rows={4} value={driverNotes} onChange={e=>setDriverNotes(e.target.value)} placeholder="Please add any notes regarding arrival at the pickup location if required" /></label><button type="button" className="booking-yellow booking-approved-save" disabled={statusBusy} onClick={()=>{if(liveConnected){void saveLivePickupDraft(job)}else{update(job.id,{yourRef:yourRef||job.id,driverNotes});setBookingScreen("loaded")}}}>{statusBusy?"Saving...":"Save"}</button></section>}
                  {(job.status === "ON_SITE_PICKUP" || job.status === "LOADED") && bookingScreen === "loaded" && <div className="settings booking-collection-form"><div className="collection-pair"><label>Your Ref.<input value={yourRef || job.id} readOnly aria-label="Automatically assigned job reference" /></label><label>Cust Ref. (from Post Load)<input value={job.customerRef || "Not provided in Post Load"} readOnly aria-label="Customer reference from Post Load" /></label></div><div className="collection-pair"><label>Number Of Items<input type="number" min="1" value={itemCount} onChange={e => setItemCount(e.target.value)} /></label><label>Weight (kg)<input type="number" min="0" value={collectionWeight} onChange={e => setCollectionWeight(e.target.value)} /></label></div><label>Enter your ETA for this Delivery<input type="datetime-local" step={900} value={etaDateTime} onChange={e => { const v=e.target.value; if (!v) {setEtaDateTime("");return;} const [date,time]=v.split("T"); const [h,m]=time.split(":").map(Number); const total=h*60+Math.round(m/15)*15; const next=new Date(date+"T00:00:00"); next.setMinutes(total); const pad=(n:number)=>String(n).padStart(2,"0"); setEtaDateTime(next.getFullYear()+"-"+pad(next.getMonth()+1)+"-"+pad(next.getDate())+"T"+pad(next.getHours())+":"+pad(next.getMinutes())); }} /></label><label>Driver's Notes<textarea value={driverNotes} onChange={e => setDriverNotes(e.target.value)} /></label>{!liveConnected && <PodCapture key={'loaded-' + job.id} jobId={job.id} recipient="" initialStage="LOADED" onSaved={() => { setPodEvidence(true); update(job.id, { podRecorded: true, podReceivedBy: podReceivedBy || podName }); setBookingScreen("status"); }} />}<button type="button" className="booking-yellow" onClick={() => { if (liveConnected) { void saveLiveHandover(job); } else { update(job.id, { customerRef: job.customerRef, yourRef: yourRef || job.id, collectionWeight: collectionWeight === "" ? undefined : Number(collectionWeight), driverNotes, items: itemCount === "" ? undefined : Number(itemCount), etaDateTime, status: "LOADED" }); setBookingScreen("status"); } }}>Save</button></div>}
                  
                  {job.status === "ON_SITE_DELIVERY" && bookingScreen === "delivery" && <section className="booking-approved-onsite booking-delivery-form"><header className="booking-approved-heading"><h2>On Site (Delivery)</h2></header><div className="booking-approved-route"><div><strong>{job.pickupAddress || job.from}</strong><span>Collection</span></div><div><strong>{job.deliveryAddress || job.to}</strong><span>Delivery</span></div></div><div className="booking-approved-details"><h3>Job Details</h3><p>{job.vehicle}</p><p>Customer Ref: {job.customerRef || 'Not provided'}</p><p>Items: {job.items ?? 'Not provided'}</p></div><label className="booking-approved-notes">Received By (Full Name)<input required value={deliveryRecipient} onChange={e => setDeliveryRecipient(e.target.value)} placeholder="Person receiving goods" /></label><label className="booking-approved-notes">Number Of Items Delivered<input required type="number" min="1" value={deliveryItems} onChange={e => setDeliveryItems(e.target.value)} placeholder={String(job.items ?? '')} /></label><label className="booking-approved-notes">Delivery Condition<select value={deliveryCondition} onChange={e => setDeliveryCondition(e.target.value)}><option>Good condition</option><option>Damaged</option><option>Shortage</option><option>Refused</option></select></label><label className="booking-approved-notes">Left At<input value={deliveryLeftAt} onChange={e => setDeliveryLeftAt(e.target.value)} placeholder="Goods Inwards / Reception" /></label><label className="booking-approved-notes">Driver's Notes<textarea rows={4} value={driverNotes} onChange={e => setDriverNotes(e.target.value)} placeholder="Delivery observations and exceptions" /></label><button className="booking-yellow booking-approved-save" type="button" disabled={statusBusy || !deliveryRecipient.trim() || deliveryItems === '' || !Number.isInteger(Number(deliveryItems)) || Number(deliveryItems) < 1 || !deliveryLeftAt.trim()} onClick={() => { if (liveConnected) void completeLiveDelivery(job); else { update(job.id, { status: 'DELIVERED', podReceivedBy: deliveryRecipient.trim(), podLeftAt: deliveryLeftAt.trim(), items: Number(deliveryItems), driverNotes: [deliveryCondition, driverNotes].filter(Boolean).join(' | ') }); setBookingScreen('pod'); } }}>Complete Delivery</button><p className="notification-reason">POD and recipient signature are recorded separately after delivery.</p></section>}
                  {job.status === "DELIVERED" && bookingScreen === "status" && (job.podRecorded ? <p className="success">POD already recorded for this booking.</p> : <button className="primary" type="button" onClick={() => setBookingScreen('pod')}>Open POD</button>)}
                  {next === "POD_SUBMITTED" && bookingScreen === "pod" && false && (
                    <label>
                      Recipient / POD reference
                      <input
                        value={podName}
                        onChange={(e) => {
                          setPodName(e.target.value);
                          setPodEvidence(false);
                        }}
                        placeholder="Recipient name"
                      />
                    </label>
                  )}
                  {next === "POD_SUBMITTED" && bookingScreen === "pod" && false && <div className="settings"><label>Received by<input value={podReceivedBy} onChange={e => { setPodReceivedBy(e.target.value); setPodEvidence(false); }} /></label><label>Left at<input value={podLeftAt} onChange={e => setPodLeftAt(e.target.value)} /></label></div>}
                  {job.status === "DELIVERED" && bookingScreen === "pod" && liveConnected && liveSession && (
                    <LivePodCapture key={job.id} jobId={job.id} alreadyDelivered={job.backendStatus === 'delivered'} reference={job.customerRef || job.yourRef || job.id} initialItems={job.items || 1} session={liveSession} onSession={setLiveSession} onCompleted={async token => { await refreshLive(token); setBookingScreen("status"); setAvailabilityPrompt(true); }} />
                  )}
                  {job.status === "DELIVERED" && bookingScreen === "pod" && !liveConnected && (
                    <PodCapture
                      key={job.id}
                      jobId={job.id}
                      recipient={podReceivedBy || podName}
                      reference={job.customerRef || job.yourRef || job.id}
                      initialItems={job.items || 1}
                      onRecipient={name => { setPodReceivedBy(name); setPodEvidence(false); }}
                      onFormChange={data => { setPodLeftAt(data.leftAt); }}
                      initialStage="DELIVERED_POD"
                      onSaved={() => { setPodEvidence(true); update(job.id, { podRecorded: true, podReceivedBy: podReceivedBy || podName }); setBookingScreen("status"); }}
                    />
                  )}
                  
                  {next && !job.acceptanceRequired && (bookingScreen === "status" || bookingScreen === "pod") && next !== "LOADED" && !(liveConnected && next === "POD_SUBMITTED") && (bookingScreen !== "pod" || next !== "POD_SUBMITTED") && (
                    <button
                      className="primary"
                      disabled={
                        statusBusy || (next === "POD_SUBMITTED" && bookingScreen !== "pod") || validateTransition(job.status, next, {
                          customerReference: job.customerRef,
                          recipientName: podReceivedBy || podName,
                          hasPodEvidence: podEvidence,
                        }) !== null
                      }
                      onClick={() => {
                        if (
                          validateTransition(job.status, next, {
                            customerReference: job.customerRef,
                            recipientName: podReceivedBy || podName,
                            hasPodEvidence: podEvidence,
                          }) !== null
                        )
                          return;
                        if (liveConnected) { void submitLiveStatus(job, next); return; }
                        update(job.id, {
                          status: next,
                          customerRef: job.customerRef,
                          yourRef,
                          collectionWeight: Number(collectionWeight) || job.collectionWeight,
                          pod: podReceivedBy || podName || job.pod,
                          podReceivedBy: podReceivedBy || podName,
                          podLeftAt,
                          driverNotes,
                          items: Number(itemCount) || job.items,
                          etaDateTime,
                        });
                        setPodName("");
                        setPodReceivedBy("");
                        setPodLeftAt("");
                        setPodEvidence(false);
                        if (next === "POD_SUBMITTED") { setAvailabilityPrompt(true); setBookingScreen("status"); } else if (next === "ON_SITE_DELIVERY") { setBookingScreen("delivery"); }
                      }}
                    >
                      Confirm: {next.replaceAll("_", " ")}
                    </button>
                  )}
                  {!next && (
                    <p className="success">
                      Delivery completed (local test only).
                    </p>
                  )}
                </>
              ) : null}
            </article>
          </>
        ) : (
          <>
            {tab === "Loads" || tab === "Quotes" || tab === "Bookings" || tab === "Alerts" ? (
              <>
                {tab === "Bookings" && <div className="alert-tabs booking-section-tabs" role="group" aria-label="Booking sections">{(["Current", "Completed", "Archived"] as const).map(section => <button key={section} type="button" className={bookingSection === section ? "selected" : ""} aria-pressed={bookingSection === section} onClick={() => setBookingSection(section)}>{section}</button>)}</div>}
                {tab === "Quotes" && <div className="alert-tabs booking-section-tabs quote-section-tabs" role="group" aria-label="Quote sections">{(["Submitted", "Unsuccessful"] as const).map((x) => <button key={x} type="button" className={quoteSection === x ? "selected" : ""} aria-pressed={quoteSection === x} onClick={() => setQuoteSection(x)}>{x}</button>)}</div>}
                {tab === "Alerts" && <p role="status" className="notification-reason">Road radius: {searchRadius} miles from GPS{activeDelivery ? ` or delivery destination (${activeDelivery.to})` : ""} to collection. {roadRadius.message}</p>}
                {tab === "Alerts" && <div className="alert-tabs">{(["Inbox","Saved","Deleted"] as const).map((x) => <button key={x} className={alertSection === x ? "selected" : ""} onClick={() => setAlertSection(x)}>{x}</button>)}</div>}
                {liveBusy && jobs.length === 0 && <p role="status" className="notification-reason">Connecting to XDrive LIVE and loading records...</p>}
                {liveError && <p role="alert" className="notification-reason">{liveError}</p>}
                {liveWarning && <p role="status" className="notification-reason">{liveWarning}</p>}
                {listed.length === 0 ? (
                  <div className="empty">
                    <span aria-hidden="true">&#128230;</span>
                    <h2>No {tab.toLowerCase()} available</h2>
                    <p>
                      {liveBusy && jobs.length === 0 ? "Loading real records from XDrive LIVE..." : liveError ? "Unable to load your Driver records. Check the error above and your Driver account access." : liveConnected ? "No matching real records returned by XDrive LIVE." : mode === "unconfigured"
                        ? "Sign in to see your available loads."
                        : "No matching records in the isolated test workspace."}
                    </p>
                    {!liveConnected && mode === "unconfigured" && <button className="primary" type="button" onClick={() => setTab("More")}>Sign in</button>}
                  </div>
                ) : (
                  listed.map((j) => (
                    <article className={tab === "Loads" ? "card unified-job-card compact-load-card" : tab === "Quotes" ? "card unified-job-card quote-green-card" : "card unified-job-card"} key={j.id}>
                      <div className="cardtop">
                        <strong>{j.company || "Customer not provided"}</strong>
                        {tab !== "Bookings" && <span className="pill">
                          {j.quoteOutcome === "UNSUCCESSFUL" || j.quoteOutcome === "CANCELLED" ? (j.quoteOutcome === "CANCELLED" ? "Cancelled" : "SOLD") : j.status === "OPEN"
                            ? (j.isNew ? "NEW" : "AVAILABLE")
                            : j.status.replaceAll("_", " ")}
                        </span>}
                      </div>
                      {tab === "Bookings" ? <div className="booking-card-heading"><div>Your Ref. {j.yourRef || j.id}</div><strong className={j.quoteOutcome === "CANCELLED" ? "booking-cancelled" : "booking-stage"}>{j.acceptanceRequired ? "Acceptance Required" : j.quoteOutcome === "CANCELLED" ? "Cancelled" : j.status === "ALLOCATED" ? "Accepted" : j.status.replaceAll("_"," ")}</strong>{j.zoneAlert && <div className="booking-zone-alert">{j.zoneAlert}</div>}<div className="job-posted-terms"><span>Terms: {j.terms?.replace(/\s*EOM\b/gi, "").trim() || "Not provided"}</span><span>Posted: {j.postedAt || "Not provided"}</span></div></div> : <small className="reference"><b>{j.service || "Same Day Â· Timed"}</b> Â· HOTSHOT Â· {j.vehicle}{j.quoteSubmittedAt ? ` Â· @ ${new Date(j.quoteSubmittedAt).toLocaleTimeString("en-GB", {hour:"2-digit",minute:"2-digit"})}` : ""}</small>}
                      {tab === "Alerts" && <div className="alert-service"><b>HOTSHOT</b> {j.vehicle} {j.notificationAt && <small>@ {j.notificationAt}</small>}{j.zoneAlert && <div>{j.zoneAlert}</div>}</div>}
                      {tab !== "Bookings" && <div className="job-posted-terms"><span>Terms: {j.terms?.replace(/\s*EOM\b/gi, "").trim() || "Not provided"}</span><span>Posted: {j.postedAt || (j.quoteSubmittedAt ? new Date(j.quoteSubmittedAt).toLocaleTimeString("en-GB", {hour:"2-digit",minute:"2-digit"}) : "Not provided")}</span></div>}
                      <div className="route">
                        <div>
                          <i />
                          <strong>{j.from}</strong>
                          <small>{tab === "Bookings" ? j.pickup : `${j.pickup} Â· Collection`}</small>
                        </div>
                        <div>
                          <i />
                          <strong>{j.to}</strong>
                          <small>{tab === "Bookings" ? j.delivery : `${j.delivery} Â· Delivery`}</small>
                        </div>
                      </div>
                      {j.distanceMiles !== undefined && <p className={tab === "Bookings" ? "booking-distance" : "job-distance"}><b>{tab === "Bookings" ? "Distance:" : "Dist:"}</b> {j.distanceMiles.toFixed(2)} miles{j.travelMinutes !== undefined ? ` (${Math.floor(j.travelMinutes / 60) ? `${Math.floor(j.travelMinutes / 60)}h ` : ""}${j.travelMinutes % 60}mins)` : ""}</p>}
                      {tab !== "Bookings" && tab !== "Loads" && <div className="quote-customer">{j.customerPhone && <div><b>Tel:</b> <a href={`tel:${j.customerPhone}`}>{j.customerPhone}</a> <a className="call-action" href={`tel:${j.customerPhone}`}>Call</a></div>}</div>}
                      {tab !== "Bookings" && (j.feedbackPay || j.feedbackDelivery) && <div className="quote-feedback"><strong>Feedback (Last 90 days)</strong>{j.feedbackPay && <div>Pay: Pos: {j.feedbackPay.positive} Â· Neu: {j.feedbackPay.neutral} Â· Neg: {j.feedbackPay.negative}</div>}{j.feedbackDelivery && <div>Del: Pos: {j.feedbackDelivery.positive} Â· Neu: {j.feedbackDelivery.neutral} Â· Neg: {j.feedbackDelivery.negative}</div>}</div>}
                      {j.notes && (tab === "Bookings" ? <><p className="booking-notes"><b>Notes:</b><span>{j.notes}</span></p><p className="booking-hint">View Booking Details for full notes...</p></> : <p>Notes: {j.notes}</p>)}
                      {tab === "Alerts" && j.stops !== undefined && <p>Stops: {j.stops}</p>}
                      {tab === "Alerts" && <p className="notification-reason">Notification Reason: {j.notificationReason || "Driver current location"}</p>}
                      {tab !== "Bookings" && j.quoteEta && <p>ETA at collection: {j.quoteEta}</p>}
                      {tab !== "Bookings" && j.quote !== undefined && (tab === "Quotes" && j.quoteOutcome === "UNSUCCESSFUL" ? <p className="quote-unsuccessful">Your Quote (Â£{j.quote.toFixed(2)}) was Unsuccessful</p> : tab === "Quotes" && j.quoteOutcome === "CANCELLED" ? <p className="quote-unsuccessful">Your Quote (Â£{j.quote.toFixed(2)}) was Cancelled</p> : <p>Quoted: <strong>Â£{j.quote.toFixed(2)} net</strong></p>)}
                      {tab !== "Bookings" && j.quoteOutcome === "AWARDED" && <p className="quote-awarded">Load allocated to your company</p>}
                      {tab !== "Loads" && <button className="map-action" onClick={() => setRouteJobId(j.id)}>View on Map</button>}
                      <div className={tab === "Bookings" ? "actions booking-card-actions" : "actions"}>
                        <button onClick={() => openJob(j.id)}>
                          {tab === "Bookings" ? "View Booking" : "View Details"}
                        </button>
                        {(tab === "Loads" || tab === "Alerts") && (
                          <button
                            className="primary"
                            disabled={role === "Company Driver" && !canBid}
                            onClick={() => {
                              setSelected(j.id);
                              setAmount(j.quote === undefined ? "" : String(j.quote));
                              setQuoteOpen(true);
                            }}
                          >
                            Quote Now
                          </button>
                        )}
                      </div>
                      {tab === "Bookings" && (bookingSection === "Completed" || bookingSection === "Archived") && <div className="actions booking-archive-actions"><button type="button" onClick={() => setArchivedBookingIds(ids => bookingSection === "Archived" ? ids.filter(id => id !== j.id) : ids.includes(j.id) ? ids : [...ids, j.id])}>{bookingSection === "Archived" ? "Restore to Completed" : "Archive booking"}</button></div>}
                      {tab === "Bookings" && j.acceptanceRequired && <div className="actions booking-decision"><button className="danger" disabled={bookingResponseBusy} onClick={() => liveConnected ? void respondToBooking(j, "decline") : update(j.id, { status: "OPEN", acceptanceRequired: false, quoteOutcome: "CANCELLED" })}>Decline</button><button className="accept-action" disabled={bookingResponseBusy} onClick={() => liveConnected ? void respondToBooking(j, "accept") : update(j.id, { acceptanceRequired: false, acceptedAt: new Date().toISOString() })}>Accept</button></div>}
                      {tab === "Bookings" && !j.acceptanceRequired && j.status === "ALLOCATED" && <button className="accept-action booking-next" onClick={() => { openJob(j.id); setBookingScreen("status"); if (liveConnected) void submitLiveStatus(j, "ON_WAY_TO_PICKUP"); else update(j.id, { status: "ON_WAY_TO_PICKUP" }); }}>On my Way to Pickup</button>}
                      {tab === "Bookings" && !j.acceptanceRequired && j.status === "ON_WAY_TO_PICKUP" && <button className="accept-action booking-next" onClick={() => { openJob(j.id); if (liveConnected) void submitLiveStatus(j, "ON_SITE_PICKUP"); else { update(j.id, { status: "ON_SITE_PICKUP" }); setBookingScreen("pickup"); } }}>On Site (Pickup)</button>}
                      {tab === "Bookings" && !j.acceptanceRequired && j.status === "ON_SITE_PICKUP" && <button className="accept-action booking-next" onClick={() => { openJob(j.id); setBookingScreen("loaded"); }}>Loaded</button>}
                      {tab === "Alerts" && <div className="alert-actions"><button onClick={() => toggleSaved(j.id)}>{savedIds.includes(j.id) ? "Unsave" : "SAVE"}</button><button onClick={() => toggleDeleted(j.id)}>{deletedIds.includes(j.id) ? "Restore" : "DELETE"}</button></div>}
                    </article>
                  ))
                )}
              </>
            ) : tab === "Invoices" ? (
              liveConnected && liveSession ? <LiveInvoices session={liveSession} onSession={setLiveSession} /> : <LocalInvoices jobs={jobs} />
            ) : tab === "Map" ? (
              <div className="empty">
                <span>Map</span>
                <h2>Map</h2>
                <p>
                  Live location and load markers require approved map
                  configuration and backend access. No fabricated vehicle
                  positions are displayed.
                </p>
                <button onClick={() => setTab("Loads")}>Back to Loads</button>
              </div>
            ) : (
              <div className="settings driver-account-gate">
                {liveConnected ? <>
                  <h2>Driver account</h2>
                  <p>Signed in to XDrive Logistics.</p>
                  <button type="button" onClick={() => { setMenuSection(null); setMenuOpen(true); }}>Open Driver Menu</button>
                </> : <>
                  <h2>Sign in to XDrive Logistics</h2>
                  <p>Sign in with your driver account to access your jobs, quotes and bookings.</p>
                  <form onSubmit={(event) => { event.preventDefault(); void connectLive(); }}>
                    <label>Email<input type="email" autoComplete="username" required value={loginEmail} onChange={event => setLoginEmail(event.target.value)} /></label>
                    <label>Password<input type="password" autoComplete="current-password" required value={loginPassword} onChange={event => setLoginPassword(event.target.value)} /></label>
                    <button type="submit" disabled={liveBusy}>{liveBusy ? "Signing in..." : "Sign in"}</button>
                  </form>
                  {liveError && <p role="alert">{liveError}</p>}
                </>}
              </div>
            )}
          </>
        )}
      </main>
      <nav>
        {(["Loads", "Quotes", "Bookings"] as Tab[]).map((t, i) => (
          <button
            key={t}
            className={[tab === t ? "active" : "", t === "Bookings" && unseenAllocations.length > 0 ? "booking-allocation-alert" : ""].filter(Boolean).join(" ")}
            onClick={() => {
              setTab(t);
              if (t === "Bookings" && unseenAllocations.length > 0) { setViewedBookingOfferIds(ids => [...new Set([...ids, ...pendingAllocations.map(j => j.offerId || j.id)])]); setBookingSection("Current"); openJob(unseenAllocations[0].id); setRouteJobId(null); return; }
              setSelected(null);
              setRouteJobId(null);
            }}
          >
            <span>{["\u{1F4E6}", "\u{1F4AC}", "\u{1F69A}", "\u{1F514}"][i]}</span>
            {t}
          </button>
        ))}
      </nav>
      {menuOpen && <DriverMenu section={menuSection} setSection={setMenuSection} onClose={() => setMenuOpen(false)} onNavigate={destination => { setMenuOpen(false); setSelected(null); setRouteJobId(null); if (destination === "Notifications") { setMenuSection("Notifications"); setMenuOpen(true); } else { if (destination === "Alerts") setAlertSection("Inbox"); setTab(destination); } }} role={role} available={available} setAvailable={setAvailable} savedCount={savedIds.length} liveConnected={liveConnected} token={liveSession?.token ?? null} onLogout={() => { if (liveSession) void revokeLiveSession(liveSession).catch(() => { console.warn('Server session revocation could not be confirmed; local credentials cleared.'); }); localStorage.removeItem(LIVE_SESSION_KEY); setLiveSession(null); setLiveConnected(false); setJobs([]); setSelected(null); setLiveError(""); setLiveWarning(""); setLoginPassword(""); setMode("unconfigured"); setTab("More"); setRole("Company Driver"); setMenuOpen(false); setMenuSection(null); }} />}
      {availabilityPrompt && <div className="overlay"><div className="modal"><h2>Update driver availability?</h2><p>Delivery POD saved to XDrive. Would you like to mark yourself available for new loads?</p><div className="actions"><button onClick={() => setAvailabilityPrompt(false)}>No, keep current setting</button><button className="primary" onClick={() => { setAvailable(true); setAvailabilityPrompt(false); }}>Yes, available</button></div></div></div>}
      {quoteOpen && job && (
        <div className="overlay">
          <div className="modal quote-form">
            <div className="cardtop">
              <h2>Submit Quote</h2>
              <button onClick={() => setQuoteOpen(false)}>Close</button>
            </div>
            <div className="quote-job-summary"><strong>{job.company || 'XDrive local test customer'}</strong><div><b className="hotshot">HOTSHOT</b> Â· {job.vehicle}</div>{job.zoneAlert && <b>{job.zoneAlert}</b>}<div className="quote-route"><strong>{job.from}</strong><span>{job.pickup} GMT | Today</span><strong>{job.to}</strong><span>{job.delivery} GMT</span></div>{job.distanceMiles !== undefined && <div className="quote-distance">Distance: {job.distanceMiles.toFixed(2)} miles {job.travelMinutes !== undefined && `(${Math.floor(job.travelMinutes / 60)}h ${job.travelMinutes % 60}mins)`}</div>}</div>
            <label>Will Pick Up Within<select value={quoteEta} onChange={e => setQuoteEta(e.target.value)}>{["ASAP","15 minutes","30 minutes","60 minutes","90 minutes","120 minutes"].map(v => <option key={v} value={v}>{v}</option>)}</select></label>
            <label>Vehicle{liveConnected ? (driverVehicles.length === 1 ? <strong>{driverVehicles[0].label}</strong> : driverVehicles.length > 1 ? <select value={quoteVehicle} onChange={e => setQuoteVehicle(e.target.value)}><option value="">Select vehicle</option>{driverVehicles.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}</select> : <small>{vehiclesLoading ? "Loading your registered vehicle..." : "Your registered vehicle could not be loaded. Retry before submitting."}</small>) : <strong>{job.vehicle}</strong>}</label>
            <label>Choose currency<input value="GBP" readOnly /></label>
            <label>
              My Quotes (Â£) *
              <input
                type="number"
                min="1"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <div className="quote-extras"><strong>Extras</strong><button type="button" onClick={() => setQuoteExtra(v => !v)}>+ ADD NEW</button></div>{quoteExtra && <div className="collection-pair"><label>Extra description<input value={quoteExtraName} onChange={e => setQuoteExtraName(e.target.value)} /></label><label>Extra amount (Â£)<input type="number" min="0" step="0.01" value={quoteExtraPrice} onChange={e => setQuoteExtraPrice(e.target.value)} /></label></div>}
            {false && <div className="stepper">
              <button
                onClick={() =>
                  setAmount(String(Math.max(1, Number(amount) - 10)))
                }
              >
                - Â£10
              </button>
              <button onClick={() => setAmount(String(Number(amount) + 10))}>
                + Â£10
              </button>
            </div>}

            <label>
              Notes
              <textarea
                value={notes}
                maxLength={150}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional driver notes"
              />
            </label>
            <div className="breakdown">
              Net Â£{(Number(amount) || 0).toFixed(2)}
              <br />
              VAT preview (20%): Â£{((Number(amount) || 0) * 0.2).toFixed(2)}
              <br />
              <strong>Gross Â£{((Number(amount) || 0) * 1.2).toFixed(2)}</strong>
              <small>{liveConnected ? "LIVE quote, excluding VAT." : "Local test quote, excluding VAT."}</small>
            </div>
            {liveError && <p role="alert">{liveError}</p>}
            <button
              className="primary"
              disabled={
                liveBusy ||
                validateQuote(Number(amount)) !== null ||
                (liveConnected && (!quoteVehicle || vehiclesLoading)) ||
                (role === "Company Driver" && !canBid)
              }
              onClick={async () => {
                if (liveConnected) {
                  if (!liveSession) { setLiveError("Driver session expired"); return; }
                  setLiveBusy(true); setLiveError("");
                  try {
                    const session = await renewSession(liveSession);
                    setLiveSession(session);
                    await driverPost("/mobile/bids", session.token, {
                      jobId: job.id,
                      amount: Number(amount) + (quoteExtra ? Number(quoteExtraPrice) || 0 : 0),
                      baseAmount: Number(amount),
                      additionalExtrasGbp: quoteExtra ? Number(quoteExtraPrice) || 0 : 0,
                      message: [notes.trim(), "Collection ETA: " + quoteEta, "Vehicle: " + (driverVehicles.find(v => v.id === quoteVehicle)?.label || job.vehicle), quoteExtra ? quoteExtraName.trim() : ""].filter(Boolean).join("; "),
                    });
                    setQuoteOpen(false); setTab("Quotes"); setSelected(null);
                    try { await refreshLive(session.token); } catch (refreshError) {
                      setLiveWarning("Quote submitted successfully, but the Quotes list could not refresh. " + (refreshError instanceof Error ? refreshError.message : "Please reload your quotes."));
                    }
                  } catch (error) {
                    setLiveError(error instanceof Error ? error.message : "Quote submission failed");
                  } finally { setLiveBusy(false); }
                  return;
                }
                update(job.id, { quote: Number(amount), quoteEta, quoteVehicle, quoteNotes: notes.trim(), quoteExtraName: quoteExtra ? quoteExtraName.trim() : undefined, quoteExtraPrice: quoteExtra ? Number(quoteExtraPrice) || 0 : undefined, quoteSubmittedAt: new Date().toISOString(), quoteOutcome: undefined });
                setQuoteOpen(false);
                setTab("Quotes");
                setSelected(null);
              }}
            >
              Submit Quote
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
export default App;

