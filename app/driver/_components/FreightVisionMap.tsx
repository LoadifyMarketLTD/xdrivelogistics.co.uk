'use client';

import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

export type FreightVisionMapItem = {
  id: string;
  lat: number;
  lng: number;
  route: string;
  status: string;
  recordedAt: string | null;
  etaAt: string | null;
  risk: string | null;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[character] ?? character));
}

export default function FreightVisionMap({ jobs }: { jobs: FreightVisionMapItem[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || jobs.length === 0) return;
    let mounted = true;
    const initialise = async () => {
      const L = (await import('leaflet')).default;
      if (!mounted || !containerRef.current) return;
      mapRef.current?.remove();
      const first = jobs[0];
      const map = L.map(containerRef.current, { center: [first.lat, first.lng], zoom: 9, scrollWheelZoom: true });
      mapRef.current = map;
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors', maxZoom: 19 }).addTo(map);
      for (const job of jobs) {
        const icon = L.divIcon({
          className: '',
          html: '<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#0b2f6b;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3)"><div style="width:6px;height:6px;border-radius:50%;background:#fff;position:absolute;left:6px;top:6px"></div></div>',
          iconSize: [24, 24],
          iconAnchor: [12, 24],
        });
        const received = job.recordedAt ? new Date(job.recordedAt).toLocaleString('en-GB') : 'Not supplied';
        const eta = job.etaAt ? new Date(job.etaAt).toLocaleString('en-GB') : 'Not available';
        L.marker([job.lat, job.lng], { icon }).addTo(map).bindPopup(
          '<div style="font-family:Arial,sans-serif;min-width:210px;font-size:12px"><strong>' + escapeHtml(job.id.slice(0, 8).toUpperCase()) +
          '</strong><br>' + escapeHtml(job.route) + '<br>Status: ' + escapeHtml(job.status) +
          '<br>Position: ' + escapeHtml(received) + '<br>ETA: ' + escapeHtml(eta) +
          (job.risk ? '<br>ETA risk: ' + escapeHtml(job.risk) : '') + '</div>',
        );
      }
      if (jobs.length > 1) map.fitBounds(L.latLngBounds(jobs.map((job) => [job.lat, job.lng])), { padding: [30, 30] });
    };
    void initialise();
    return () => { mounted = false; mapRef.current?.remove(); mapRef.current = null; };
  }, [jobs]);

  if (!jobs.length) return <div className="xd2-calm-empty"><b>No approved live positions</b><span>Tracking positions appear only after an authorised source publishes them.</span></div>;
  return <div ref={containerRef} style={{ height: '100%', minHeight: 420 }} />;
}
