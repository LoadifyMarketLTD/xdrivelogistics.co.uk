'use client';

import { useState } from 'react';

interface DelayUpdateProps {
  jobRef: string;
  onSend: (delayMinutes: number, reason: string) => void;
  onCancel?: () => void;
}

export default function DelayUpdate({ jobRef, onSend, onCancel }: DelayUpdateProps) {
  const [selectedDelay, setSelectedDelay] = useState<number | null>(null);
  const [reason, setReason] = useState('');

  const delayOptions = [
    { minutes: 15, label: '+15 min' },
    { minutes: 30, label: '+30 min' },
    { minutes: 45, label: '+45 min' },
    { minutes: 60, label: '+60 min' },
  ];

  const handleSend = () => {
    if (selectedDelay === null) {
      alert('Please select a delay time');
      return;
    }

    if (!reason.trim()) {
      alert('Please provide a reason for the delay');
      return;
    }

    onSend(selectedDelay, reason.trim());
  };

  return (
    <div style={{
      backgroundColor: 'white',
      padding: '1rem',
      borderRadius: '8px',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
    }}>
      <h3 style={{
        fontSize: '1rem',
        fontWeight: '600',
        color: '#1f2937',
        marginBottom: '0.25rem'
      }}>
        Send Delay Update
      </h3>
      <p style={{
        fontSize: '0.875rem',
        color: '#6b7280',
        marginBottom: '1rem'
      }}>
        {jobRef}
      </p>

      {/* Delay Selection */}
      <div style={{ marginBottom: '1rem' }}>
        <label style={{
          display: 'block',
          fontSize: '0.875rem',
          fontWeight: '500',
          color: '#374151',
          marginBottom: '0.5rem'
        }}>
          Estimated Delay
        </label>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '0.5rem'
        }}>
          {delayOptions.map((option) => (
            <button
              key={option.minutes}
              onClick={() => setSelectedDelay(option.minutes)}
              style={{
                backgroundColor: selectedDelay === option.minutes ? '#3b82f6' : '#f3f4f6',
                color: selectedDelay === option.minutes ? 'white' : '#374151',
                border: selectedDelay === option.minutes ? '2px solid #2563eb' : '2px solid #e5e7eb',
                borderRadius: '8px',
                padding: '0.875rem',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: 'pointer',
                minHeight: '48px',
                transition: 'all 0.2s'
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Reason Input */}
      <div style={{ marginBottom: '1rem' }}>
        <label style={{
          display: 'block',
          fontSize: '0.875rem',
          fontWeight: '500',
          color: '#374151',
          marginBottom: '0.5rem'
        }}>
          Reason for Delay
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="E.g., Traffic, Loading delay, etc."
          rows={3}
          style={{
            width: '100%',
            padding: '0.75rem',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            fontSize: '1rem',
            resize: 'vertical',
            fontFamily: 'inherit'
          }}
        />
      </div>

      {/* Action Buttons */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: onCancel ? '1fr 1fr' : '1fr',
        gap: '0.5rem'
      }}>
        {onCancel && (
          <button
            onClick={onCancel}
            style={{
              backgroundColor: '#f3f4f6',
              color: '#374151',
              border: 'none',
              borderRadius: '8px',
              padding: '0.75rem',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: 'pointer',
              minHeight: '48px'
            }}
          >
            Cancel
          </button>
        )}
        <button
          onClick={handleSend}
          style={{
            backgroundColor: '#f59e0b',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '0.75rem',
            fontSize: '1rem',
            fontWeight: '600',
            cursor: 'pointer',
            minHeight: '48px'
          }}
        >
          Send Update
        </button>
      </div>
    </div>
  );
}
