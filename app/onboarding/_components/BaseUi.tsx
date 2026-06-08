'use client';

export function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'email' | 'date';
}) {
  return (
    <label style={{ display: 'block', marginBottom: '0.75rem' }}>
      <div style={{ marginBottom: '0.35rem', fontWeight: 500 }}>{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: '100%', border: '1px solid #D1D5DB', borderRadius: 6, padding: '0.6rem 0.75rem' }}
      />
    </label>
  );
}

export function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function PageLayout({
  title,
  status,
  currentStep,
  progress,
  children,
  error,
  message,
  onSave,
  onSubmit,
  saving,
  backToLogin,
  submitDisabled,
}: {
  title: string;
  status: string;
  currentStep: string;
  progress: number;
  children: React.ReactNode;
  error: string;
  message: string;
  onSave: () => void;
  onSubmit: () => void;
  saving: boolean;
  backToLogin: () => void;
  submitDisabled?: boolean;
}) {
  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '2rem' }}>
      <h1>{title}</h1>
      <p>
        Status: <strong>{status}</strong>
      </p>
      <p>
        Current step: <strong>{currentStep}</strong>
      </p>

      <div style={{ background: '#E5E7EB', borderRadius: 8, overflow: 'hidden', marginBottom: '1rem' }}>
        <div style={{ width: `${progress}%`, height: 10, background: '#2563EB' }} />
      </div>
      <p style={{ marginTop: 0 }}>{progress.toFixed(0)}% complete</p>

      {children}

      {error && <p style={{ color: '#B91C1C' }}>{error}</p>}
      {message && <p style={{ color: '#166534' }}>{message}</p>}

      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
        <button
          onClick={onSave}
          disabled={saving}
          style={{ padding: '0.75rem 1rem', borderRadius: 6, border: '1px solid #D1D5DB', cursor: 'pointer' }}
        >
          Save and continue later
        </button>
        <button
          onClick={onSubmit}
          disabled={saving || submitDisabled}
          style={{
            padding: '0.75rem 1rem',
            borderRadius: 6,
            border: 'none',
            background: '#1D4ED8',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          Submit for review
        </button>
        <button
          onClick={backToLogin}
          style={{ padding: '0.75rem 1rem', borderRadius: 6, border: '1px solid #D1D5DB', cursor: 'pointer' }}
        >
          Back to login
        </button>
      </div>
    </main>
  );
}
