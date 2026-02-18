interface StatCardProps {
  value: string;
  label: string;
}

export function StatCard({ value, label }: StatCardProps) {
  return (
    <div
      style={{
        backgroundColor: 'var(--glass-bg)',
        border: '1px solid var(--glass-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '1.5rem',
        textAlign: 'center',
        backdropFilter: 'blur(10px)',
      }}
    >
      <div
        style={{
          fontSize: 'clamp(2rem, 4vw, 2.5rem)',
          fontWeight: 'var(--font-weight-bold)',
          color: 'var(--color-gold-primary)',
          marginBottom: '0.5rem',
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: '0.95rem',
          color: 'var(--color-text-white-transparent)',
          fontWeight: 'var(--font-weight-medium)',
        }}
      >
        {label}
      </div>
    </div>
  );
}
