'use client';

/**
 * ActionConfirmModal — PR-0.5: canonical confirmation modal for all dangerous
 * super-admin actions.
 *
 * Replaces window.prompt / window.confirm / window.alert across:
 *   - companies/page.tsx (suspend / reject without reason)
 *   - marketplace/page.tsx
 *   - compliance/documents/page.tsx
 *   - compliance/fraud-cases/page.tsx
 *   - support/tickets/page.tsx
 *
 * Props:
 *   open         — whether the modal is visible
 *   title        — heading text (e.g. "Suspend company")
 *   description  — body copy shown to the operator (ideally includes entity name)
 *   confirmLabel — label on the confirm button (e.g. "Confirm suspension")
 *   cancelLabel  — label on the cancel button (defaults to "Cancel")
 *   danger       — true = red confirm button, false = amber/default
 *   reasonLabel  — label for the textarea (defaults to "Reason (required)")
 *   reasonRequired — whether reason must be >= 5 chars before confirm is enabled
 *   reasonPlaceholder — placeholder text for the textarea
 *   submitting   — disables both buttons while the request is in flight
 *   onConfirm    — called with the trimmed reason string
 *   onCancel     — called when the operator cancels
 */

import { useState, useEffect } from 'react';

const THEME = {
  pageBg: '#0f172a',
  cardBg: '#1e293b',
  cardBorder: '#334155',
  text: '#f1f5f9',
  muted: '#94a3b8',
  accent: '#f59e0b',
  green: '#22c55e',
  red: '#ef4444',
};

export type ActionConfirmModalProps = {
  open: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  reasonLabel?: string;
  reasonRequired?: boolean;
  reasonPlaceholder?: string;
  submitting?: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
};

export function ActionConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  danger = true,
  reasonLabel = 'Reason (required)',
  reasonRequired = true,
  reasonPlaceholder = 'Describe the reason for this action…',
  submitting = false,
  onConfirm,
  onCancel,
}: ActionConfirmModalProps) {
  const [reason, setReason] = useState('');

  // Reset reason whenever the modal opens.
  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  if (!open) return null;

  const reasonTooShort = reasonRequired && reason.trim().length < 5;
  const isDisabled = submitting || reasonTooShort;
  const confirmColor = danger ? THEME.red : THEME.accent;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="acm-title"
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        style={{
          backgroundColor: THEME.cardBg,
          border: `1px solid ${danger ? THEME.red + '66' : THEME.cardBorder}`,
          borderTop: `3px solid ${confirmColor}`,
          borderRadius: '14px',
          padding: '1.5rem',
          width: '100%',
          maxWidth: '460px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <h2
          id="acm-title"
          style={{ margin: '0 0 0.5rem', fontSize: '1.05rem', fontWeight: 700, color: THEME.text }}
        >
          {title}
        </h2>
        <div style={{ margin: '0 0 1.1rem', fontSize: '0.84rem', color: THEME.muted, lineHeight: 1.55 }}>
          {description}
        </div>

        {/* Reason textarea */}
        <label
          htmlFor="acm-reason"
          style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.77rem', fontWeight: 600, color: THEME.muted }}
        >
          {reasonLabel}
          {reasonRequired && <span style={{ color: THEME.red, marginLeft: '0.2rem' }}>*</span>}
        </label>
        <textarea
          id="acm-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder={reasonPlaceholder}
          disabled={submitting}
          style={{
            width: '100%', boxSizing: 'border-box',
            backgroundColor: '#0b1220',
            border: `1px solid ${reasonRequired && reason.trim().length > 0 && reasonTooShort ? THEME.red : THEME.cardBorder}`,
            borderRadius: '8px', padding: '0.55rem 0.75rem',
            color: THEME.text, fontSize: '0.82rem', resize: 'vertical',
            outline: 'none', fontFamily: 'inherit',
          }}
        />
        {reasonRequired && reason.trim().length > 0 && reasonTooShort && (
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.71rem', color: THEME.red }}>
            Reason must be at least 5 characters.
          </p>
        )}

        {/* Audit notice */}
        <p style={{ margin: '0.75rem 0 0', fontSize: '0.7rem', color: '#475569', lineHeight: 1.5 }}>
          🔒 This action will be recorded in the platform audit log with your identity, reason and timestamp.
        </p>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.1rem', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            style={{
              padding: '0.48rem 0.95rem', borderRadius: '7px',
              border: `1px solid ${THEME.cardBorder}`, backgroundColor: 'transparent',
              color: THEME.muted, fontSize: '0.8rem',
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => { if (!isDisabled) onConfirm(reason.trim()); }}
            disabled={isDisabled}
            style={{
              padding: '0.48rem 0.95rem', borderRadius: '7px', border: 'none',
              backgroundColor: confirmColor,
              color: '#fff', fontWeight: 700, fontSize: '0.8rem',
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              opacity: isDisabled ? 0.55 : 1,
            }}
          >
            {submitting ? '…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
