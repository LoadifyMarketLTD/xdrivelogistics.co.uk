'use client';

import { useState } from 'react';
import type { PlatformSemanticAction } from './types';

const X = {
  navy: '#0B2F6B', blue: '#1D57D8', orange: '#F5A300', white: '#FFFFFF', charcoal: '#1A1F2B',
  light: '#F4F6F8', border: '#D9E1EA', muted: '#64748B', danger: '#DC2626', success: '#15803D',
} as const;

export default function PlatformActionPanel({
  title = 'Platform actions',
  description = 'Only canonical actions valid for the current entity and state are exposed.',
  actions,
  onCompleted,
}: {
  title?: string;
  description?: string;
  actions: PlatformSemanticAction[];
  onCompleted?: (actionId: string) => Promise<void> | void;
}) {
  const [selected, setSelected] = useState<PlatformSemanticAction | null>(null);
  const [reason, setReason] = useState('');
  const [running, setRunning] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'danger'; message: string } | null>(null);

  const execute = async (action: PlatformSemanticAction) => {
    const normalizedReason = reason.trim();
    if (action.requiresReason && normalizedReason.length < 5) {
      setFeedback({ tone: 'danger', message: 'A clear reason of at least 5 characters is required.' });
      return;
    }
    setRunning(action.id);
    setFeedback(null);
    try {
      await action.onExecute(normalizedReason);
      await onCompleted?.(action.id);
      setFeedback({ tone: 'success', message: `${action.label} completed.` });
      setSelected(null);
      setReason('');
    } catch (error) {
      setFeedback({ tone: 'danger', message: error instanceof Error ? error.message : `${action.label} failed.` });
    } finally {
      setRunning(null);
    }
  };

  return (
    <section style={{ border: `1px solid ${X.border}`, borderRadius: '4px', background: X.white, overflow: 'hidden' }}>
      <div style={{ padding: '8px 12px', background: X.light, borderBottom: `1px solid ${X.border}` }}>
        <h2 style={{ margin: 0, color: X.navy, fontSize: '12px', fontWeight: 800 }}>{title}</h2>
        <p style={{ margin: '2px 0 0', color: X.muted, fontSize: '10px' }}>{description}</p>
      </div>
      <div style={{ padding: '12px' }}>
        {feedback ? <div role="status" style={{ marginBottom: '8px', borderLeft: `4px solid ${feedback.tone === 'success' ? X.success : X.danger}`, background: X.light, padding: '7px 9px', color: feedback.tone === 'success' ? X.success : X.danger, fontSize: '10px', fontWeight: 700 }}>{feedback.message}</div> : null}
        {actions.length === 0 ? <div style={{ color: X.muted, fontSize: '11px' }}>No Platform Owner mutation is authorised for this entity in its current state.</div> : (
          <div style={{ display: 'grid', gap: '7px' }}>
            {actions.map((action) => {
              const disabled = Boolean(action.disabled || running);
              return <div key={action.id} style={{ minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', border: `1px solid ${X.border}`, borderRadius: '4px', padding: '7px 8px' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: X.charcoal, fontSize: '11px', fontWeight: 800 }}>{action.label}</div>
                  <div style={{ color: X.muted, fontSize: '10px', lineHeight: 1.4, marginTop: '2px' }}>{action.disabledReason && action.disabled ? action.disabledReason : action.description}</div>
                </div>
                <button type="button" disabled={disabled} onClick={() => { setSelected(action); setReason(''); setFeedback(null); }} style={actionButtonStyle(action.tone ?? 'secondary', disabled)}>{running === action.id ? 'Working…' : action.label}</button>
              </div>;
            })}
          </div>
        )}
      </div>

      {selected ? (
        <div role="dialog" aria-modal="true" aria-label={`Confirm ${selected.label}`} style={{ position: 'fixed', inset: 0, zIndex: 250, background: 'rgba(11,47,107,.28)', display: 'grid', placeItems: 'center', padding: '16px' }} onMouseDown={(event) => { if (event.currentTarget === event.target && !running) { setSelected(null); setReason(''); } }}>
          <div style={{ width: 'min(520px,96vw)', background: X.white, border: `1px solid ${X.border}`, borderRadius: '4px', boxShadow: '0 18px 50px rgba(11,47,107,.22)' }}>
            <div style={{ padding: '10px 12px', borderBottom: `1px solid ${X.border}` }}>
              <h3 style={{ margin: 0, color: X.navy, fontSize: '14px', fontWeight: 800 }}>{selected.label}</h3>
              <p style={{ margin: '4px 0 0', color: X.muted, fontSize: '10px', lineHeight: 1.45 }}>{selected.description}</p>
            </div>
            <div style={{ padding: '12px' }}>
              {selected.requiresReason ? <label style={{ display: 'grid', gap: '4px', color: X.charcoal, fontSize: '10px', fontWeight: 800 }}>{selected.reasonLabel ?? 'Reason'}<textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder={selected.reasonPlaceholder ?? 'Record the operational reason for this intervention…'} rows={4} style={{ resize: 'vertical', border: `1px solid ${X.border}`, borderRadius: '4px', padding: '8px', color: X.charcoal, font: 'inherit', fontWeight: 500 }} /></label> : null}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '12px' }}>
                <button type="button" disabled={Boolean(running)} onClick={() => { setSelected(null); setReason(''); }} style={actionButtonStyle('secondary', Boolean(running))}>Cancel</button>
                <button type="button" disabled={Boolean(running)} onClick={() => void execute(selected)} style={actionButtonStyle(selected.tone ?? 'primary', Boolean(running))}>{running ? 'Working…' : selected.confirmLabel ?? `Confirm ${selected.label}`}</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function actionButtonStyle(tone: NonNullable<PlatformSemanticAction['tone']>, disabled: boolean) {
  const palette = tone === 'danger' ? { bg: X.danger, border: X.danger, color: X.white }
    : tone === 'warning' ? { bg: X.orange, border: X.orange, color: X.navy }
      : tone === 'primary' ? { bg: X.blue, border: X.blue, color: X.white }
        : { bg: X.white, border: X.border, color: X.blue };
  return { minHeight: '32px', padding: '0 10px', borderRadius: '4px', border: `1px solid ${palette.border}`, background: disabled ? X.light : palette.bg, color: disabled ? '#9CA3AF' : palette.color, fontSize: '10px', fontWeight: 800, cursor: disabled ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' } as const;
}
