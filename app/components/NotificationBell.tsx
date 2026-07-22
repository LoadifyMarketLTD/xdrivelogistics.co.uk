'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthContext';
import { resolveActiveCompanyId } from '../../lib/activeCompany';
import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient';

export default function NotificationBell() {
  const router = useRouter();
  const { user, hasSupabaseSession } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [events, setEvents] = useState<Array<{id:string;event_type:string;entity_id:string;payload:Record<string,unknown>;status:string;created_at:string;processed_at:string|null}>>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  useEffect(()=>{let cancelled=false;const run=async()=>{if(!hasSupabaseSession||!user?.id){if(!cancelled)setCompanyId(null);return;}if(user.companyId){if(!cancelled)setCompanyId(user.companyId);return;}const id=await resolveActiveCompanyId({userId:user.id,fallbackCompanyId:null});if(!cancelled)setCompanyId(id);};void run();return()=>{cancelled=true;};},[hasSupabaseSession,user?.companyId,user?.id]);
  const storageKey=useMemo(()=>(user?.id&&companyId?`xdrive:notification-last-seen:${user.id}:${companyId}`:null),[companyId,user?.id]);
  useEffect(()=>{if(!storageKey||typeof window==='undefined'){setLastSeenAt(null);return;}setLastSeenAt(window.localStorage.getItem(storageKey));},[storageKey]);
  const fetchNotifications=useCallback(async()=>{if(!isSupabaseConfigured||!companyId){setEvents([]);return;}setIsLoading(true);const {data,error}=await supabase.from('notification_events').select('id, event_type, entity_id, payload, status, created_at, processed_at').eq('company_id',companyId).in('event_type',['job_assigned','bid_accepted','pod_uploaded']).order('created_at',{ascending:false}).limit(20);if(error){console.error('Failed to load notifications:',error.message);setEvents([]);}else setEvents((data??[]) as typeof events);setIsLoading(false);},[companyId]);
  useEffect(()=>{void fetchNotifications();},[fetchNotifications]);
  useEffect(()=>{if(!isOpen||!storageKey||typeof window==='undefined')return;const latest=events[0]?.created_at??new Date().toISOString();window.localStorage.setItem(storageKey,latest);setLastSeenAt(latest);},[events,isOpen,storageKey]);
  const unreadCount=useMemo(()=>{if(!lastSeenAt)return events.length;const t=new Date(lastSeenAt).getTime();return events.filter(e=>new Date(e.created_at).getTime()>t).length;},[events,lastSeenAt]);
  if(!hasSupabaseSession||!user)return null;
  return <div ref={rootRef} style={{position:'fixed',top:'1rem',right:'1rem',zIndex:1100}}><button type="button" onClick={()=>setIsOpen(v=>!v)} aria-label="Open notifications">🔔{unreadCount>0&&<span>{unreadCount>9?'9+':unreadCount}</span>}</button>{isOpen&&<div>{isLoading?'Loading notifications…':events.map(event=><button key={event.id} type="button" onClick={()=>{setIsOpen(false);router.push('/admin');}}>{event.event_type}</button>)}</div>}</div>;
}
