'use client';

import type { ReactNode } from 'react';
import { workspaceTheme } from './WorkspaceUI';

export function DashboardHomeHeader({
  eyebrow,
  title,
  description,
  badge,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  badge?: string;
  actions?: ReactNode;
}) {
  return (
    <header
      style={{
        minHeight: '52px',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '12px',
        marginBottom: '12px',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ minWidth: 0, flex: '1 1 520px' }}>
        <div
          style={{
            color: workspaceTheme.blue,
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            lineHeight: '16px',
            marginBottom: '4px',
          }}
        >
          {eyebrow}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <h1
            style={{
              margin: 0,
              color: workspaceTheme.navy,
              fontSize: '20px',
              lineHeight: '26px',
              fontWeight: 600,
            }}
          >
            {title}
          </h1>
          {badge ? (
            <span
              style={{
                padding: '3px 6px',
                borderRadius: '4px',
                background: '#EEF4FF',
                color: workspaceTheme.blue,
                fontSize: '10px',
                lineHeight: '14px',
                fontWeight: 800,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              {badge}
            </span>
          ) : null}
        </div>
        <p
          style={{
            margin: '4px 0 0',
            maxWidth: '900px',
            color: workspaceTheme.muted,
            fontSize: '12px',
            lineHeight: '16px',
          }}
        >
          {description}
        </p>
      </div>
      {actions ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {actions}
        </div>
      ) : null}
    </header>
  );
}
