import { ReactNode } from 'react';

interface SectionProps {
  children: ReactNode;
  className?: string;
  id?: string;
  backgroundColor?: string;
}

export function Section({ children, className = '', id, backgroundColor }: SectionProps) {
  return (
    <section 
      id={id}
      style={{ 
        backgroundColor: backgroundColor || 'transparent',
        width: '100%'
      }}
    >
      <div 
        className="container"
        style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '0 24px',
        }}
      >
        <div className={className}>
          {children}
        </div>
      </div>
    </section>
  );
}
