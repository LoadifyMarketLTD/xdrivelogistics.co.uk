'use client';

import { useRouter } from 'next/navigation';
import { FileText, Headphones, Lock, ShieldCheck, UserCircle } from 'lucide-react';
import ProtectedRoute from '../../components/ProtectedRoute';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';
import { useAuth } from '../../components/AuthContext';

type Tool = {
  label: string;
  detail: string;
  href: string;
  icon: typeof FileText;
};

const tools: Tool[] = [
  { label: 'Documents', detail: 'Licences, insurance and uploaded files', href: '/driver/documents', icon: FileText },
  { label: 'Compliance', detail: 'Checks and expiry status', href: '/driver/documents', icon: ShieldCheck },
  { label: 'Profile', detail: 'Your contact and driver details', href: '/driver/profile', icon: UserCircle },
  { label: 'Password', detail: 'Security and login access', href: '/driver/change-password', icon: Lock },
  { label: 'Support', detail: 'Get operational help', href: '/driver/profile', icon: Headphones },
];

export default function DriverMorePage() {
  const router = useRouter();
  const { logout } = useAuth();

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell>
        <section style={{ display: 'grid', gap: '0.85rem' }}>
          <div>
            <p style={{ margin: 0, color: '#facc15', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>More</p>
            <h1 style={{ margin: '0.1rem 0 0', color: '#f8fafc', fontSize: '1.35rem', lineHeight: 1.15 }}>Personal tools</h1>
          </div>

          <div style={{ display: 'grid', gap: '0.65rem' }}>
            {tools.map((tool) => {
              const Icon = tool.icon;
              return (
                <button
                  key={tool.label}
                  onClick={() => router.push(tool.href)}
                  style={{ minHeight: '72px', width: '100%', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '18px', background: '#111d2f', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '0.85rem', textAlign: 'left', cursor: 'pointer' }}
                >
                  <span style={{ width: '42px', height: '42px', borderRadius: '14px', background: 'rgba(250,204,21,0.13)', color: '#facc15', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <Icon size={22} />
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 800, fontSize: '0.98rem' }}>{tool.label}</span>
                    <span style={{ display: 'block', color: '#94a3b8', fontSize: '0.78rem', marginTop: '0.15rem' }}>{tool.detail}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => void logout()}
            style={{ marginTop: '0.25rem', minHeight: '50px', borderRadius: '16px', border: '1px solid rgba(248,113,113,0.35)', background: 'rgba(239,68,68,0.12)', color: '#fecaca', fontWeight: 800, cursor: 'pointer' }}
          >
            Sign out
          </button>
        </section>
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
