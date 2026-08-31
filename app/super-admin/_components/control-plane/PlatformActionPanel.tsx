'use client';

import { useState } from 'react';
import type { PlatformSemanticAction } from './types';

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
    <section className="sa-panel">
      <div className="sa-panel-header">
        <div>
          <h2 className="sa-panel-title">{title}</h2>
          <p className="sa-panel-subtitle">{description}</p>
        </div>
        <span className="sa-section-pill">{actions.length} available</span>
      </div>
      <div style={{ padding: 14 }}>
        {feedback ? <div role="status" className="sa-notice" data-tone={feedback.tone === 'success' ? 'info' : 'danger'} style={{ marginBottom: 10 }}>{feedback.message}</div> : null}
        {actions.length === 0 ? <div className="sa-empty" style={{ padding: '20px 10px' }}>No Platform Owner mutation is authorised for this entity in its current state.</div> : (
          <div style={{ display: 'grid', gap: 9 }}>
            {actions.map((action) => {
              const disabled = Boolean(action.disabled || running);
              const tone = action.tone ?? 'secondary';
              return <div key={action.id} style={{ minHeight: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, border: '1px solid #e5eaf2', borderRadius: 12, padding: '10px 11px', background: '#fbfcff' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: '#172033', fontSize: 11, fontWeight: 820 }}>{action.label}</div>
                  <div style={{ color: '#667085', fontSize: 10, lineHeight: 1.45, marginTop: 3 }}>{action.disabledReason && action.disabled ? action.disabledReason : action.description}</div>
                </div>
                <button type="button" disabled={disabled} onClick={() => { setSelected(action); setReason(''); setFeedback(null); }} className="sa-button" data-variant={tone === 'primary' ? 'primary' : undefined} style={actionToneStyle(tone, disabled)}>{running === action.id ? 'Working…' : action.label}</button>
              </div>;
            })}
          </div>
        )}
      </div>

      {selected ? (
        <div role="dialog" aria-modal="true" aria-label={`Confirm ${selected.label}`} style={{ position: 'fixed', inset: 0, zIndex: 250, background: 'rgba(5,20,47,.48)', backdropFilter: 'blur(3px)', display: 'grid', placeItems: 'center', padding: 16 }} onMouseDown={(event) => { if (event.currentTarget === event.target && !running) { setSelected(null); setReason(''); } }}>
          <div style={{ width: 'min(540px,96vw)', overflow: 'hidden', background: '#fff', border: '1px solid #dfe6f0', borderRadius: 16, boxShadow: '0 28px 80px rgba(8,42,97,.28)' }}>
            <div style={{ padding: '16px 18px', borderBottom: '1px solid #e5eaf2', background: 'linear-gradient(180deg,#fff,#f9fbff)' }}>
              <div className="sa-eyebrow" style={{ marginBottom: 5 }}>Privileged action</div>
              <h3 style={{ margin: 0, color: '#082a61', fontSize: 18, fontWeight: 850 }}>{selected.label}</h3>
              <p style={{ margin: '5px 0 0', color: '#667085', fontSize: 11, lineHeight: 1.5 }}>{selected.description}</p>
            </div>
            <div style={{ padding: 18 }}>
              {selected.requiresReason ? <label style={{ display: 'grid', gap: 6, color: '#172033', fontSize: 10, fontWeight: 800 }}>{selected.reasonLabel ?? 'Reason'}<textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder={selected.reasonPlaceholder ?? 'Record the operational reason for this intervention…'} rows={4} style={{ resize: 'vertical', border: '1px solid #dfe6f0', borderRadius: 10, padding: 10, color: '#172033', background: '#fbfcff', font: 'inherit', fontWeight: 500, outline: 'none' }} /></label> : null}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                <button type="button" disabled={Boolean(running)} onClick={() => { setSelected(null); setReason(''); }} className="sa-button">Cancel</button>
                <button type="button" disabled={Boolean(running)} onClick={() => void execute(selected)} className="sa-button" data-variant="primary" style={actionToneStyle(selected.tone ?? 'primary', Boolean(running))}>{running ? 'Working…' : selected.confirmLabel ?? `Confirm ${selected.label}`}</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function actionToneStyle(tone: NonNullable<PlatformSemanticAction['tone']>, disabled: boolean) {
  if (disabled) return { opacity: .5, cursor: 'not-allowed', whiteSpace: 'nowrap' } as const;
  if (tone === 'danger') return { background: '#d92d20', borderColor: '#d92d20', color: '#fff', whiteSpace: 'nowrap' } as const;
  if (tone === 'warning') return { background: '#fff6e4', borderColor: '#f2c66d', color: '#8a5800', whiteSpace: 'nowrap' } as const;
  if (tone === 'primary') return { background: '#1d57d8', borderColor: '#1d57d8', color: '#fff', whiteSpace: 'nowrap' } as const;
  return { whiteSpace: 'nowrap' } as const;
}
