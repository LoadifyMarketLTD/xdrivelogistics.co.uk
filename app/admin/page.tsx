'use client';

import ProtectedRoute from '../components/ProtectedRoute';
import { useAuth } from '../components/AuthContext';
import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';

export default function AdminPage() {
  const { user, logout } = useAuth();
  const [activeSection, setActiveSection] = useState('dashboard');
  const [stats, setStats] = useState({ activeJobs: '—', pendingQuotes: '—', activeDrivers: '—', completedToday: '—' });

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setStats({ activeJobs: '0', pendingQuotes: '0', activeDrivers: '0', completedToday: '0' });
      return;
    }
    // Use start-of-UTC-day so "today" is consistent with the timestamps stored by Supabase
    const todayUtc = new Date().toISOString().slice(0, 10);
    Promise.all([
      supabase.from('jobs').select('id', { count: 'exact', head: true }).in('status', ['posted', 'allocated', 'in_transit']),
      supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('status', 'delivered').gte('updated_at', todayUtc),
      supabase.from('drivers').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('quotes').select('id', { count: 'exact', head: true }).in('status', ['draft', 'sent']),
    ]).then(([activeJobsRes, completedRes, driversRes, quotesRes]) => {
      setStats({
        activeJobs: String(activeJobsRes.count ?? 0),
        pendingQuotes: String(quotesRes.count ?? 0),
        activeDrivers: String(driversRes.count ?? 0),
        completedToday: String(completedRes.count ?? 0),
      });
    }).catch(() => {
      setStats({ activeJobs: '0', pendingQuotes: '0', activeDrivers: '0', completedToday: '0' });
    });
  }, []);

  const handleGenerateReport = async () => {
    if (!isSupabaseConfigured) {
      alert('Supabase is not configured. Cannot generate report.');
      return;
    }
    const { data, error } = await supabase
      .from('jobs')
      .select('id, status, pickup_location, delivery_location, pickup_datetime, delivery_datetime, created_at, updated_at')
      .order('created_at', { ascending: false });
    if (error || !data) {
      alert('Failed to fetch jobs for report.');
      return;
    }
    const headers = ['ID', 'Status', 'Pickup Location', 'Delivery Location', 'Pickup Date', 'Delivery Date', 'Created At', 'Updated At'];
    const rows = data.map((j) => [
      j.id,
      j.status,
      j.pickup_location ?? '',
      j.delivery_location ?? '',
      j.pickup_datetime ?? '',
      j.delivery_datetime ?? '',
      j.created_at,
      j.updated_at,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jobs-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'invoices', label: 'Invoices', icon: '💰' },
    { id: 'jobs', label: 'Jobs', icon: '📦' },
    { id: 'companies', label: 'Companies', icon: '🏢' },
    { id: 'drivers', label: 'Drivers', icon: '🚚' },
    { id: 'vehicles', label: 'Vehicles', icon: '🚛' },
    { id: 'documents', label: 'Documents', icon: '📄' },
    { id: 'bids', label: 'Bids', icon: '💼' },
    { id: 'quotes', label: 'Quotes', icon: '💬' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <ProtectedRoute>
      <div style={{
        display: 'flex',
        minHeight: '100vh',
        backgroundColor: '#f3f4f6'
      }}>
        {/* Sidebar */}
        <aside style={{
          width: '250px',
          backgroundColor: '#0A2239',
          color: 'white',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '2px 0 8px rgba(0, 0, 0, 0.1)'
        }}>
          {/* Logo/Brand */}
          <div style={{
            padding: '1.5rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <h1 style={{
              fontSize: '1.5rem',
              fontWeight: '700',
              margin: 0,
              color: 'white'
            }}>
              Danny Courier
            </h1>
            <p style={{
              fontSize: '0.85rem',
              margin: '0.5rem 0 0 0',
              opacity: 0.7
            }}>
              Admin Portal
            </p>
          </div>

          {/* Navigation */}
          <nav style={{
            flex: 1,
            padding: '1rem 0'
          }}>
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                style={{
                  width: '100%',
                  padding: '0.875rem 1.5rem',
                  backgroundColor: activeSection === item.id ? 'rgba(31, 122, 61, 0.5)' : 'transparent',
                  color: 'white',
                  border: 'none',
                  borderLeft: activeSection === item.id ? '4px solid #1F7A3D' : '4px solid transparent',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  fontSize: '1rem',
                  transition: 'all 0.2s',
                  fontWeight: activeSection === item.id ? '600' : '400'
                }}
                onMouseEnter={(e) => {
                  if (activeSection !== item.id) {
                    e.currentTarget.style.backgroundColor = 'rgba(10, 34, 57, 0.5)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeSection !== item.id) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <span style={{ fontSize: '1.25rem' }}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>

          {/* User Info & Logout */}
          <div style={{
            padding: '1rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <div style={{
              fontSize: '0.85rem',
              opacity: 0.8,
              marginBottom: '0.75rem',
              wordBreak: 'break-word'
            }}>
              {user?.email}
            </div>
            <button
              onClick={logout}
              style={{
                width: '100%',
                padding: '0.625rem',
                backgroundColor: 'rgba(239, 68, 68, 0.8)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.9rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 1)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.8)'}
            >
              Logout
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main style={{
          flex: 1,
          padding: '2rem'
        }}>
          {/* Header */}
          <div style={{
            marginBottom: '2rem'
          }}>
            <h2 style={{
              fontSize: '2rem',
              fontWeight: '700',
              color: '#1f2937',
              margin: '0 0 0.5rem 0'
            }}>
              {menuItems.find(item => item.id === activeSection)?.label}
            </h2>
            <p style={{
              color: '#6b7280',
              margin: 0
            }}>
              {activeSection === 'dashboard' && 'Overview of your courier operations'}
              {activeSection === 'invoices' && 'Manage and view all invoices'}
              {activeSection === 'jobs' && 'View and manage all delivery jobs'}
              {activeSection === 'companies' && 'Manage companies and memberships'}
              {activeSection === 'drivers' && 'Manage driver information'}
              {activeSection === 'vehicles' && 'Manage fleet vehicles'}
              {activeSection === 'documents' && 'Review and verify documents'}
              {activeSection === 'bids' && 'Review and manage job bids'}
              {activeSection === 'quotes' && 'Create and manage price quotes'}
              {activeSection === 'settings' && 'Configure system settings (coming soon)'}
            </p>
          </div>

          {/* Dashboard Content */}
          {activeSection === 'dashboard' && (
            <div>
              {/* Stats Cards */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '1.5rem',
                marginBottom: '2rem'
              }}>
                {[
                  { label: 'Active Jobs', value: stats.activeJobs, icon: '🚚', color: '#1F7A3D' },
                  { label: 'Pending Quotes', value: stats.pendingQuotes, icon: '💬', color: '#f59e0b' },
                  { label: 'Active Drivers', value: stats.activeDrivers, icon: '👤', color: '#0A2239' },
                  { label: 'Completed Today', value: stats.completedToday, icon: '✅', color: '#5C9FD8' },
                ].map((stat, index) => (
                  <div
                    key={index}
                    style={{
                      backgroundColor: 'white',
                      padding: '1.5rem',
                      borderRadius: '12px',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                      borderLeft: `4px solid ${stat.color}`
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '0.75rem'
                    }}>
                      <div style={{
                        fontSize: '0.9rem',
                        color: '#6b7280',
                        fontWeight: '500'
                      }}>
                        {stat.label}
                      </div>
                      <span style={{ fontSize: '1.5rem' }}>{stat.icon}</span>
                    </div>
                    <div style={{
                      fontSize: '2rem',
                      fontWeight: '700',
                      color: '#1f2937'
                    }}>
                      {stat.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick Actions */}
              <div style={{
                backgroundColor: 'white',
                padding: '1.5rem',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
              }}>
                <h3 style={{
                  fontSize: '1.25rem',
                  fontWeight: '600',
                  color: '#1f2937',
                  marginBottom: '1rem'
                }}>
                  Quick Actions
                </h3>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '1rem'
                }}>
                  <button
                    onClick={() => window.location.href = '/admin/invoices'}
                    style={{
                      padding: '1rem',
                      backgroundColor: '#f0fdf4',
                      border: '1px solid #86efac',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.95rem',
                      fontWeight: '600',
                      color: '#15803d',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#dcfce7';
                      e.currentTarget.style.borderColor = '#1F7A3D';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#f0fdf4';
                      e.currentTarget.style.borderColor = '#86efac';
                    }}
                  >
                    💰 View Invoices
                  </button>
                  <button
                    onClick={() => window.location.href = '/admin/jobs'}
                    style={{
                      padding: '1rem',
                      backgroundColor: '#1F7A3D',
                      border: '1px solid #1F7A3D',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.95rem',
                      fontWeight: '600',
                      color: 'white',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#166534';
                      e.currentTarget.style.borderColor = '#166534';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#1F7A3D';
                      e.currentTarget.style.borderColor = '#1F7A3D';
                    }}
                  >
                    📦 Manage Jobs
                  </button>
                  <button
                    onClick={handleGenerateReport}
                    style={{
                      padding: '1rem',
                      backgroundColor: '#e0f2fe',
                      border: '1px solid #7dd3fc',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.95rem',
                      fontWeight: '600',
                      color: '#075985',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#bae6fd';
                      e.currentTarget.style.borderColor = '#5C9FD8';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#e0f2fe';
                      e.currentTarget.style.borderColor = '#7dd3fc';
                    }}
                  >
                    📊 Generate Report
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Other sections */}
          {activeSection === 'invoices' && (
            <div style={{
              backgroundColor: 'white',
              padding: '3rem 2rem',
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
              textAlign: 'center'
            }}>
              <div style={{
                fontSize: '4rem',
                marginBottom: '1rem'
              }}>
                💰
              </div>
              <h3 style={{
                fontSize: '1.5rem',
                color: '#1f2937',
                marginBottom: '0.5rem'
              }}>
                Invoice Management
              </h3>
              <p style={{
                color: '#6b7280',
                fontSize: '1rem',
                marginBottom: '1.5rem'
              }}>
                Manage all your invoices in the dedicated invoice section.
              </p>
              <button
                onClick={() => window.location.href = '/admin/invoices'}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#1F7A3D',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#166534'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1F7A3D'}
              >
                Go to Invoices
              </button>
            </div>
          )}
          
          {activeSection === 'jobs' && (
            <div style={{
              backgroundColor: 'white',
              padding: '3rem 2rem',
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
              textAlign: 'center'
            }}>
              <div style={{
                fontSize: '4rem',
                marginBottom: '1rem'
              }}>
                📦
              </div>
              <h3 style={{
                fontSize: '1.5rem',
                color: '#1f2937',
                marginBottom: '0.5rem'
              }}>
                Job Management
              </h3>
              <p style={{
                color: '#6b7280',
                fontSize: '1rem',
                marginBottom: '1.5rem'
              }}>
                View and manage all your delivery jobs.
              </p>
              <button
                onClick={() => window.location.href = '/admin/jobs'}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#1F7A3D',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#166534'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1F7A3D'}
              >
                Go to Jobs
              </button>
            </div>
          )}
          
          {activeSection === 'companies' && (
            <div style={{ backgroundColor: 'white', padding: '3rem 2rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)', textAlign: 'center' }}>
              <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🏢</div>
              <h3 style={{ fontSize: '1.5rem', color: '#1f2937', marginBottom: '0.5rem' }}>Company Management</h3>
              <p style={{ color: '#6b7280', fontSize: '1rem', marginBottom: '1.5rem' }}>Manage companies and memberships.</p>
              <button onClick={() => window.location.href = '/admin/companies'} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#1F7A3D', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.95rem', fontWeight: '600', cursor: 'pointer' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#166534'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1F7A3D'}>Go to Companies</button>
            </div>
          )}
          {activeSection === 'drivers' && (
            <div style={{ backgroundColor: 'white', padding: '3rem 2rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)', textAlign: 'center' }}>
              <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🚚</div>
              <h3 style={{ fontSize: '1.5rem', color: '#1f2937', marginBottom: '0.5rem' }}>Driver Management</h3>
              <p style={{ color: '#6b7280', fontSize: '1rem', marginBottom: '1.5rem' }}>Manage your drivers.</p>
              <button onClick={() => window.location.href = '/admin/drivers'} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#1F7A3D', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.95rem', fontWeight: '600', cursor: 'pointer' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#166534'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1F7A3D'}>Go to Drivers</button>
            </div>
          )}
          {activeSection === 'vehicles' && (
            <div style={{ backgroundColor: 'white', padding: '3rem 2rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)', textAlign: 'center' }}>
              <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🚛</div>
              <h3 style={{ fontSize: '1.5rem', color: '#1f2937', marginBottom: '0.5rem' }}>Vehicle Management</h3>
              <p style={{ color: '#6b7280', fontSize: '1rem', marginBottom: '1.5rem' }}>Manage your fleet vehicles.</p>
              <button onClick={() => window.location.href = '/admin/vehicles'} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#1F7A3D', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.95rem', fontWeight: '600', cursor: 'pointer' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#166534'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1F7A3D'}>Go to Vehicles</button>
            </div>
          )}
          {activeSection === 'documents' && (
            <div style={{ backgroundColor: 'white', padding: '3rem 2rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)', textAlign: 'center' }}>
              <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📄</div>
              <h3 style={{ fontSize: '1.5rem', color: '#1f2937', marginBottom: '0.5rem' }}>Document Management</h3>
              <p style={{ color: '#6b7280', fontSize: '1rem', marginBottom: '1.5rem' }}>Review and verify driver & vehicle documents.</p>
              <button onClick={() => window.location.href = '/admin/documents'} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#1F7A3D', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.95rem', fontWeight: '600', cursor: 'pointer' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#166534'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1F7A3D'}>Go to Documents</button>
            </div>
          )}
          {activeSection === 'bids' && (
            <div style={{ backgroundColor: 'white', padding: '3rem 2rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)', textAlign: 'center' }}>
              <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>💼</div>
              <h3 style={{ fontSize: '1.5rem', color: '#1f2937', marginBottom: '0.5rem' }}>Bid Management</h3>
              <p style={{ color: '#6b7280', fontSize: '1rem', marginBottom: '1.5rem' }}>Review and manage job bids.</p>
              <button onClick={() => window.location.href = '/admin/bids'} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#1F7A3D', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.95rem', fontWeight: '600', cursor: 'pointer' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#166534'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1F7A3D'}>Go to Bids</button>
            </div>
          )}
          {activeSection === 'quotes' && (
            <div style={{ backgroundColor: 'white', padding: '3rem 2rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)', textAlign: 'center' }}>
              <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>💬</div>
              <h3 style={{ fontSize: '1.5rem', color: '#1f2937', marginBottom: '0.5rem' }}>Quote Management</h3>
              <p style={{ color: '#6b7280', fontSize: '1rem', marginBottom: '1.5rem' }}>Create and manage price quotes.</p>
              <button onClick={() => window.location.href = '/admin/quotes'} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#1F7A3D', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.95rem', fontWeight: '600', cursor: 'pointer' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#166534'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1F7A3D'}>Go to Quotes</button>
            </div>
          )}
          {activeSection === 'settings' && (
            <div style={{ backgroundColor: 'white', padding: '3rem 2rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)', textAlign: 'center' }}>
              <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>⚙️</div>
              <h3 style={{ fontSize: '1.5rem', color: '#1f2937', marginBottom: '0.5rem' }}>System Settings</h3>
              <p style={{ color: '#6b7280', fontSize: '1rem', marginBottom: '1.5rem' }}>Configure company information, notifications, and system preferences.</p>
              <button onClick={() => window.location.href = '/admin/settings'} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#1F7A3D', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.95rem', fontWeight: '600', cursor: 'pointer' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#166534'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1F7A3D'}>Go to Settings</button>
            </div>
          )}
          {activeSection !== 'dashboard' && activeSection !== 'invoices' && activeSection !== 'jobs' && activeSection !== 'companies' && activeSection !== 'drivers' && activeSection !== 'vehicles' && activeSection !== 'documents' && activeSection !== 'bids' && activeSection !== 'quotes' && activeSection !== 'settings' && (
            <div style={{
              backgroundColor: 'white',
              padding: '3rem 2rem',
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
              textAlign: 'center'
            }}>
              <div style={{
                fontSize: '4rem',
                marginBottom: '1rem'
              }}>
                {menuItems.find(item => item.id === activeSection)?.icon}
              </div>
              <h3 style={{
                fontSize: '1.5rem',
                color: '#1f2937',
                marginBottom: '0.5rem'
              }}>
                {menuItems.find(item => item.id === activeSection)?.label}
              </h3>
              <p style={{
                color: '#6b7280',
                fontSize: '1rem'
              }}>
                This section is under development and will be available soon.
              </p>
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
