'use client';

import type { CSSProperties, ReactNode } from 'react';
import './approved-demo-fleet-shell.css';

type VehicleRegisterShellProps = {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  ariaLabel?: string;
};

export function VehicleRegisterShell({ title, subtitle, actions, children, ariaLabel }: VehicleRegisterShellProps) {
  return (
    <div className="carrier-register-page carrier-register-page--vehicles xd-approved-demo-fleet" aria-label={ariaLabel}>
      <div style={{ width: '100%' }}>
        <div className="carrier-register-toolbar">
          <div>
            <h1 className="carrier-register-title">{title}</h1>
            {subtitle ? <p className="carrier-register-subtitle">{subtitle}</p> : null}
          </div>
          {actions ? <div className="carrier-register-toolbar__actions">{actions}</div> : null}
        </div>
        {children}
      </div>
    </div>
  );
}

export function VehicleRegisterSection({ children, ariaLabel, style }: { children: ReactNode; ariaLabel?: string; style?: CSSProperties }) {
  return (
    <section className="carrier-register-results" aria-label={ariaLabel} style={style}>
      {children}
    </section>
  );
}

export function VehicleRegisterEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="carrier-register-empty" style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
      {children}
    </div>
  );
}
