'use client';

import { useState, useEffect, useCallback } from 'react';
import type { CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Invitation {
  id: string;
  invited_email: string;
  carrier_company_id: string | null;
  carrier_company_name: string | null;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  message: string | null;
  created_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const statusColor: Record<string, string> = {
  pending: '#f59e0b',
  accepted: '#22c55e',
  revoked: '#ef4444',
  expired: '#6b7280',
};

function fmt(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

async function getToken(): Promise<string | null> {
    const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function getCompanyId(): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('company_memberships')
    .select('company_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();
  return (data as { company_id: string } | null)?.company_id ?? null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CarrierNetworkPage() {
  const router = useRouter();

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const [revoking, setRevoking] = useState<string | null>(null);

  // ── Load invitations ───────────────────────────────────────────────────────

  const load = useCallback(async (cid: string) => {
    setLoading(true);
    setError(null);
    const token = await getToken();
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

    const res = await fetch(`/api/broker/carrier-invitations?companyId=${cid}`, { headers });
    const body = (await res.json().catch(() => ({}))) as {
      invitations?: Invitation[];
      error?: string;
    };
    if (!res.ok) {
      setError(body.error ?? 'Failed to load invitations.');
    } else {
      setInvitations(body.invitations ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void (async () => {
      const cid = await getCompanyId();
      if (!cid) { router.push('/broker'); return; }
      setCompanyId(cid);
      await load(cid);
    })();
  }, [load, router]);

  // ── Send invitation ────────────────────────────────────────────────────────

  const sendInvitation = async () => {
    if (!companyId || !email.trim()) return;
    setSending(true);
    setSendResult(null);
    const token = await getToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    const res = await fetch('/api/broker/carrier-invitations', {
      method: 'POST',
      headers,
      body: JSON.stringify({ companyId, email: email.trim(), message: message.trim() || undefined }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setSendResult({ ok: false, msg: body.error ?? 'Failed to send invitation.' });
    } else {
      setSendResult({ ok: true, msg: `Invitation sent to ${email.trim()}.` });
      setEmail('');
      setMessage('');
      await load(companyId);
    }
    setSending(false);
  };

  // ── Revoke invitation ──────────────────────────────────────────────────────

  const revoke = async (invId: string) => {
    if (!companyId) return;
    setRevoking(invId);
    const token = await getToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    const res = await fetch('/api/broker/carrier-invitations', {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ invitationId: invId, companyId, action: 'revoke' }),
    });
    if (res.ok) {
      await load(companyId);
    }
    setRevoking(null);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const card: CSSProperties = {
    background: '#0b1220',
    border: '1px solid #1e2d45',
    borderRadius: '10px',
    padding: '1.5rem',
    marginBottom: '1.25rem',
  };
  const label: CSSProperties = {
    fontSize: '0.72rem',
    fontWeight: 700,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    display: 'block',
    marginBottom: '0.3rem',
  };
  const input: CSSProperties = {
    background: '#060f1c',
    border: '1px solid #1e2d45',
    borderRadius: '6px',
    color: '#f1f5f9',
    padding: '0.55rem 0.8rem',
    fontSize: '0.88rem',
    width: '100%',
    boxSizing: 'border-box',
    outline: 'none',
  };
  const btn = (tone: 'primary' | 'danger'): CSSProperties => ({
    background: tone === 'primary' ? '#f59e0b' : '#ef4444',
    color: tone === 'primary' ? '#0b1220' : '#fff',
    border: 'none',
    borderRadius: '6px',
    padding: '0.5rem 1rem',
    fontWeight: 700,
    fontSize: '0.82rem',
    cursor: 'pointer',
    opacity: 1,
  });

  return (
    <div style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto', color: '#f1f5f9' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.75rem' }}>
        <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem' }}>
          Carrier Network
        </div>
        <h1 style={{ fontSize: '1.65rem', fontWeight: 800, margin: 0, color: '#f1f5f9' }}>
          Carrier Invitations
        </h1>
        <p style={{ color: '#94a3b8', marginTop: '0.4rem', fontSize: '0.9rem' }}>
          Invite trusted carrier companies to your network. Pending invitations can be revoked at any time.
        </p>
      </div>

      {/* Invite form */}
      <div style={card}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 1rem', color: '#f59e0b' }}>
          Invite a Carrier
        </h2>
        <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: '1fr 1fr' }}>
          <div>
            <span style={label}>Carrier email address *</span>
            <input
              style={input}
              type="email"
              placeholder="carrier@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={sending}
            />
          </div>
          <div>
            <span style={label}>Optional message</span>
            <input
              style={input}
              type="text"
              placeholder="Personal message to carrier…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={sending}
            />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
          <button
            style={{ ...btn('primary'), opacity: sending || !email.trim() ? 0.5 : 1 }}
            onClick={() => void sendInvitation()}
            disabled={sending || !email.trim()}
          >
            {sending ? 'Sending…' : 'Send Invitation'}
          </button>
          {sendResult && (
            <span style={{ fontSize: '0.82rem', color: sendResult.ok ? '#22c55e' : '#ef4444', fontWeight: 700 }}>
              {sendResult.msg}
            </span>
          )}
        </div>
      </div>

      {/* Invitation list */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>
            Sent Invitations
            {!loading && (
              <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 400, marginLeft: '0.5rem' }}>
                ({invitations.length})
              </span>
            )}
          </h2>
          {companyId && (
            <button
              onClick={() => void load(companyId)}
              style={{ background: 'transparent', border: '1px solid #1e2d45', borderRadius: '6px', color: '#94a3b8', padding: '0.35rem 0.75rem', fontSize: '0.75rem', cursor: 'pointer' }}
            >
              ↻ Refresh
            </button>
          )}
        </div>

        {loading && <p style={{ color: '#64748b' }}>Loading…</p>}
        {!loading && error && <p style={{ color: '#ef4444' }}>{error}</p>}
        {!loading && !error && invitations.length === 0 && (
          <p style={{ color: '#64748b', fontSize: '0.88rem' }}>No invitations sent yet.</p>
        )}

        {!loading && invitations.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1e2d45' }}>
                {['Email', 'Carrier company', 'Status', 'Sent', 'Action'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '0.45rem 0.6rem', color: '#64748b', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invitations.map((inv) => (
                <tr key={inv.id} style={{ borderBottom: '1px solid #0f1e33' }}>
                  <td style={{ padding: '0.6rem', color: '#cbd5e1' }}>{inv.invited_email}</td>
                  <td style={{ padding: '0.6rem', color: '#94a3b8' }}>
                    {inv.carrier_company_name ?? (inv.status === 'accepted' ? 'Unknown' : '—')}
                  </td>
                  <td style={{ padding: '0.6rem' }}>
                    <span style={{ color: statusColor[inv.status] ?? '#94a3b8', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase' }}>
                      {inv.status}
                    </span>
                  </td>
                  <td style={{ padding: '0.6rem', color: '#64748b' }}>{fmt(inv.created_at)}</td>
                  <td style={{ padding: '0.6rem' }}>
                    {inv.status === 'pending' ? (
                      <button
                        style={{ ...btn('danger'), padding: '0.3rem 0.7rem', fontSize: '0.72rem', opacity: revoking === inv.id ? 0.5 : 1 }}
                        disabled={revoking === inv.id}
                        onClick={() => void revoke(inv.id)}
                      >
                        {revoking === inv.id ? 'Revoking…' : 'Revoke'}
                      </button>
                    ) : (
                      <span style={{ color: '#374151', fontSize: '0.72rem' }}>
                        {inv.status === 'accepted' ? `Accepted ${fmt(inv.accepted_at)}` : '—'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
