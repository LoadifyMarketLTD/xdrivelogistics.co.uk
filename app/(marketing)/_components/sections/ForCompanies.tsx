import { Section } from '../ui/Section';

const OPERATIONS = [
  {
    title: 'Diary',
    description: 'Track job schedules and plan pickups and deliveries in one place.',
  },
  {
    title: 'Driver Assignment',
    description: 'Allocate awarded jobs to available drivers and dispatch execution.',
  },
  {
    title: 'Fleet View',
    description: 'Maintain operational awareness of active jobs and assigned resources.',
  },
  {
    title: 'POD Upload',
    description: 'Capture and store proof of delivery documents for completed jobs.',
  },
  {
    title: 'Invoice Creation',
    description: 'Generate invoices after delivery and POD completion in the workflow.',
  },
];

export function ForCompanies() {
  return (
    <Section>
      <div style={{ paddingTop: '4rem', paddingBottom: '4rem' }}>
        <h2 style={{ margin: '0 0 0.75rem', color: '#FFFFFF', fontSize: 'clamp(1.6rem, 4vw, 2.2rem)' }}>
          Operations Workspace
        </h2>
        <p style={{ margin: '0 0 1.5rem', color: 'rgba(255,255,255,0.8)', lineHeight: 1.6 }}>
          Once work is awarded, XDrive moves into execution with dispatch and delivery controls.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
          {OPERATIONS.map((item) => (
            <article
              key={item.title}
              style={{
                backgroundColor: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                borderRadius: '12px',
                padding: '1rem',
              }}
            >
              <h3 style={{ margin: '0 0 0.45rem', color: '#FFFFFF', fontSize: '1rem' }}>{item.title}</h3>
              <p style={{ margin: 0, color: 'rgba(255,255,255,0.82)', fontSize: '0.9rem', lineHeight: 1.55 }}>
                {item.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </Section>
  );
}
