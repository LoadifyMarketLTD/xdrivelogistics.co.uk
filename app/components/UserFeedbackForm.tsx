'use client';

import { useState } from 'react';
import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient';

type TicketCategory = 'general' | 'technical' | 'operations' | 'billing' | 'compliance';
type TicketPriority = 'low' | 'medium' | 'high' | 'critical';

const categories: Array<{ value: TicketCategory; label: string }> = [
  { value: 'general', label: 'General feedback' },
  { value: 'technical', label: 'Technical issue' },
  { value: 'operations', label: 'Operations workflow' },
  { value: 'billing', label: 'Billing / finance' },
  { value: 'compliance', label: 'Compliance' },
];

const priorities: Array<{ value: TicketPriority; label: string }> = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

export default function UserFeedbackForm() {
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TicketCategory>('general');
  const [priority, setPriority] = useState<TicketPriority>('medium');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const submitFeedback = async () => {
    setMessage('');
    setError('');

    if (!isSupabaseConfigured) {
      setError('Feedback cannot be sent because Supabase is not configured.');
      return;
    }

    if (subject.trim().length < 3) {
      setError('Please add a short subject.');
      return;
    }

    if (description.trim().length < 10) {
      setError('Please add a little more detail before sending.');
      return;
    }

    setSubmitting(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    if (!token) {
      setSubmitting(false);
      setError('You need to be signed in to send feedback.');
      return;
    }

    try {
      const response = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject: subject.trim(),
          description: description.trim(),
          category,
          priority,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(typeof payload.error === 'string' ? payload.error : 'Feedback could not be sent.');
        setSubmitting(false);
        return;
      }

      setSubject('');
      setDescription('');
      setCategory('general');
      setPriority('medium');
      setMessage('Feedback sent. The XDrive team can now review it from Support Tickets.');
    } catch {
      setError('Feedback could not be sent. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="feedback-card">
      <div className="feedback-header">
        <div>
          <p className="eyebrow">Support</p>
          <h1>Send feedback</h1>
        </div>
        <span className="status-pill">Private ticket</span>
      </div>

      {message && <div className="notice success">{message}</div>}
      {error && <div className="notice error">{error}</div>}

      <div className="form-grid">
        <label className="field field-wide">
          <span>Subject</span>
          <input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="What should we look at?"
            maxLength={200}
          />
        </label>

        <label className="field">
          <span>Category</span>
          <select value={category} onChange={(event) => setCategory(event.target.value as TicketCategory)}>
            {categories.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Priority</span>
          <select value={priority} onChange={(event) => setPriority(event.target.value as TicketPriority)}>
            {priorities.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
        </label>

        <label className="field field-wide">
          <span>Details</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Describe what happened, what page you were on, and what you expected instead."
            rows={7}
            maxLength={5000}
          />
        </label>
      </div>

      <div className="actions">
        <button type="button" onClick={() => void submitFeedback()} disabled={submitting}>
          {submitting ? 'Sending...' : 'Send feedback'}
        </button>
      </div>

      <style jsx>{`
        .feedback-card {
          background: #ffffff;
          border: 1px solid #dbe3ec;
          border-radius: 8px;
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
          padding: 24px;
        }

        .feedback-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 20px;
        }

        .eyebrow {
          margin: 0 0 6px;
          color: #64748b;
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
        }

        h1 {
          margin: 0;
          color: #0f172a;
          font-size: 28px;
          line-height: 1.2;
        }

        .status-pill {
          border: 1px solid #bbf7d0;
          border-radius: 999px;
          background: #f0fdf4;
          color: #166534;
          padding: 7px 10px;
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
        }

        .notice {
          border-radius: 8px;
          padding: 12px 14px;
          margin-bottom: 16px;
          font-weight: 700;
        }

        .success {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          color: #166534;
        }

        .error {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #991b1b;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }

        .field {
          display: grid;
          gap: 7px;
        }

        .field-wide {
          grid-column: 1 / -1;
        }

        .field span {
          color: #334155;
          font-size: 13px;
          font-weight: 800;
        }

        input,
        select,
        textarea {
          width: 100%;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          color: #0f172a;
          background: #ffffff;
          padding: 11px 12px;
          font: inherit;
          box-sizing: border-box;
        }

        textarea {
          resize: vertical;
          min-height: 150px;
        }

        .actions {
          display: flex;
          justify-content: flex-end;
          margin-top: 18px;
        }

        button {
          border: none;
          border-radius: 8px;
          background: #1f7a3d;
          color: #ffffff;
          padding: 11px 18px;
          font-weight: 800;
          cursor: pointer;
        }

        button:disabled {
          cursor: not-allowed;
          opacity: 0.65;
        }

        @media (max-width: 640px) {
          .feedback-card {
            padding: 18px;
          }

          .feedback-header {
            display: grid;
          }

          .form-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  );
}
