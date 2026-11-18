'use client';

import type { ReactNode } from 'react';

export type CanonicalTransportField = { label: string; value: ReactNode };
export type CanonicalTransportSection = { title: string; fields: CanonicalTransportField[] };

export default function Canonical3150TransportSummary({
  reference, route, status, sections,
}: {
  reference: string;
  route: string;
  status: string;
  sections: CanonicalTransportSection[];
}) {
  return (
    <section className="xdrive3150-real-transport" aria-label="Verified transport details">
      <header className="xdrive3150-real-transport__header">
        <div>
          <small>TRANSPORT DETAILS - VERIFIED XDRIVE RECORD</small>
          <h2>{reference}</h2>
          <p>{route}</p>
        </div>
        <span className="xdrive3150-real-transport__status">{status}</span>
      </header>
      <div className="xdrive3150-real-transport__sections">
        {sections.map((section) => (
          <section className="xdrive3150-real-transport__section" key={section.title}>
            <h3>{section.title}</h3>
            <div className="xdrive3150-real-transport__fields">
              {section.fields.map(({ label, value }) => (
                <div className="xdrive3150-real-transport__field" key={label}>
                  <small>{label}</small>
                  <strong>{value || 'Not recorded'}</strong>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
