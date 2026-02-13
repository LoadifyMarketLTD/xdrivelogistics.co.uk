'use client';

import ProtectedRoute from '../components/ProtectedRoute';
import { useAuth } from '../components/AuthContext';
import { useState } from 'react';

export default function AdminPage() {
  const { user, logout } = useAuth();
  const [activeSection, setActiveSection] = useState('dashboard');

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'invoices', label: 'Invoices', icon: '💰' },
    { id: 'jobs', label: 'Jobs', icon: '📦' },
    { id: 'drivers', label: 'Drivers', icon: '🚚' },
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
          backgroundColor: '#1e293b',
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
                  backgroundColor: activeSection === item.id ? 'rgba(59, 130, 246, 0.5)' : 'transparent',
                  color: 'white',
                  border: 'none',
                  borderLeft: activeSection === item.id ? '4px solid #3b82f6' : '4px solid transparent',
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
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
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
              {activeSection === 'invoices' && 'Manage and view all invoices (coming soon)'}
              {activeSection === 'jobs' && 'View and manage delivery jobs (coming soon)'}
              {activeSection === 'drivers' && 'Manage driver information (coming soon)'}
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
                  { label: 'Active Jobs', value: '24', icon: '🚚', color: '#10b981' },
                  { label: 'Pending Invoices', value: '12', icon: '💰', color: '#f59e0b' },
                  { label: 'Active Drivers', value: '8', icon: '👤', color: '#3b82f6' },
                  { label: 'Completed Today', value: '45', icon: '✅', color: '#8b5cf6' },
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
                    onClick={() => setActiveSection('invoices')}
                    style={{
                      padding: '1rem',
                      backgroundColor: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.95rem',
                      fontWeight: '600',
                      color: '#1e40af',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#dbeafe';
                      e.currentTarget.style.borderColor = '#93c5fd';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#eff6ff';
                      e.currentTarget.style.borderColor = '#bfdbfe';
                    }}
                  >
                    💰 View Invoices
                  </button>
                  <button
                    style={{
                      padding: '1rem',
                      backgroundColor: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.95rem',
                      fontWeight: '600',
                      color: '#15803d',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#dcfce7';
                      e.currentTarget.style.borderColor = '#86efac';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#f0fdf4';
                      e.currentTarget.style.borderColor = '#bbf7d0';
                    }}
                  >
                    ➕ New Job
                  </button>
                  <button
                    style={{
                      padding: '1rem',
                      backgroundColor: '#fef3c7',
                      border: '1px solid #fde68a',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.95rem',
                      fontWeight: '600',
                      color: '#92400e',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#fef08a';
                      e.currentTarget.style.borderColor = '#fcd34d';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#fef3c7';
                      e.currentTarget.style.borderColor = '#fde68a';
                    }}
                  >
                    📊 Generate Report
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Other sections placeholder */}
          {activeSection !== 'dashboard' && (
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
