'use client';

import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';

const cardStyle = {
  backgroundColor: '#ffffff',
  border: '1px solid #d7e0ea',
  borderRadius: '12px',
  padding: '1rem',
  boxShadow: '0 2px 8px rgba(15,23,42,0.06)',
} as const;

export default function DriverDocumentsPage() {
  const { user } = useAuth();

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell subtitle="Upcoming document management for licences, compliance, and vehicle paperwork.">
        <div style={{ display: 'grid', gap: '1rem', maxWidth: '860px' }}>
          <div style={cardStyle}>
            <div style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.55rem' }}>Coming soon</div>
            <h1 style={{ margin: 0, fontSize: '1.35rem', color: '#0f172a' }}>Driver documents</h1>
            <p style={{ margin: '0.6rem 0 0', color: '#475569', lineHeight: 1.6, fontSize: '0.92rem' }}>
              This page will become the driver-side home for licence checks, insurance reminders, and document expiry visibility.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div style={cardStyle}>
              <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem' }}>What will appear here</div>
              <ul style={{ margin: 0, paddingLeft: '1rem', color: '#475569', fontSize: '0.86rem', lineHeight: 1.7 }}>
                <li>Driving licence and CPC status</li>
                <li>Vehicle compliance reminders</li>
                <li>Expiry alerts from your dispatcher</li>
              </ul>
            </div>
            <div style={cardStyle}>
              <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem' }}>Current status</div>
              <div style={{ fontSize: '0.86rem', color: '#475569', lineHeight: 1.6 }}>
                No upload or edit actions are enabled yet. Your dispatcher continues to manage document records centrally.
              </div>
            </div>
          </div>

          <div style={{ ...cardStyle, borderStyle: 'dashed', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.35rem' }}>🗂️</div>
            <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.25rem' }}>No self-service document workflow yet</div>
            <div style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: 1.6 }}>
              Signed in as {user?.email ?? 'driver account'}. When document management is ready, this page will show your assigned records and clear next actions.
            </div>
          </div>
        </div>
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
