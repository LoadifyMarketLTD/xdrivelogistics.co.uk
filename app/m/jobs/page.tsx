'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';

interface StoredJob {
  id: string;
  jobRef: string;
  client: { name: string; email: string; phone: string };
  pickup: { location: string; date: string; time: string };
  delivery: { location: string; date: string; time: string };
  cargo: { type: string; quantity: number; notes: string };
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface Job {
  id: string;
  ref: string;
  pickupLocation: string;
  deliveryLocation: string;
  pickupTime: string;
  deliveryTime: string;
  status: 'active' | 'pickup' | 'delivery' | 'completed';
}

// Map admin status values to mobile filter categories
const adminStatusToMobile = (status: string): Job['status'] => {
  switch (status) {
    case 'Posted': return 'pickup';
    case 'Allocated': return 'delivery';
    case 'Delivered': return 'completed';
    default: return 'active'; // 'Received' and any unknown
  }
};

export default function JobsPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialFilter = (searchParams.get('filter') as Job['status'] | 'all') ?? 'all';
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'pickup' | 'delivery' | 'completed'>(initialFilter);
  const [jobs, setJobs] = useState<Job[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('danny_jobs');
      if (stored) {
        const storedJobs: StoredJob[] = JSON.parse(stored);
        const mapped: Job[] = storedJobs
          .filter((j) => j.pickup?.location && j.delivery?.location)
          .map((j) => ({
          id: j.id,
          ref: j.jobRef || j.id,
          pickupLocation: j.pickup.location,
          deliveryLocation: j.delivery.location,
          pickupTime: j.pickup.date && j.pickup.time ? `${j.pickup.date}T${j.pickup.time}:00` : '',
          deliveryTime: j.delivery.date && j.delivery.time ? `${j.delivery.date}T${j.delivery.time}:00` : '',
          status: adminStatusToMobile(j.status),
        }));
        setJobs(mapped);
      }
    } catch (e) {
      console.error('Error loading jobs:', e);
    }
  }, []);

  const filters = [
    { id: 'all', label: 'All', icon: '📋', color: '#6366f1' },
    { id: 'active', label: 'Active', icon: '🚚', color: '#10b981' },
    { id: 'pickup', label: 'Pickup', icon: '📦', color: '#f59e0b' },
    { id: 'delivery', label: 'Delivery', icon: '✅', color: '#3b82f6' },
    { id: 'completed', label: 'History', icon: '📝', color: '#8b5cf6' },
  ];

  const filteredJobs = activeFilter === 'all'
    ? jobs
    : jobs.filter(job => job.status === activeFilter);

  const formatTime = (isoString: string) => {
    if (!isoString) return '—';
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (isoString: string) => {
    if (!isoString) return '—';
    const date = new Date(isoString);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#10b981';
      case 'pickup': return '#f59e0b';
      case 'delivery': return '#3b82f6';
      case 'completed': return '#8b5cf6';
      default: return '#6b7280';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Active';
      case 'pickup': return 'Ready for Pickup';
      case 'delivery': return 'In Delivery';
      case 'completed': return 'Completed';
      default: return status;
    }
  };

  return (
    <ProtectedRoute>
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f3f4f6'
      }}>
        {/* Header */}
        <header style={{
          backgroundColor: '#2563eb',
          color: 'white',
          padding: '1rem',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
          position: 'sticky',
          top: 0,
          zIndex: 10
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1rem'
          }}>
            <button
              onClick={() => router.push('/m')}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '0.5rem 0.75rem',
                fontSize: '1rem',
                cursor: 'pointer'
              }}
            >
              ← Back
            </button>
            <h1 style={{
              fontSize: '1.25rem',
              fontWeight: '700',
              margin: 0
            }}>
              Jobs
            </h1>
            <button
              onClick={logout}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '0.5rem 0.75rem',
                fontSize: '0.9rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Logout
            </button>
          </div>

          {/* Filter Tabs */}
          <div style={{
            display: 'flex',
            gap: '0.5rem',
            overflowX: 'auto',
            paddingBottom: '0.5rem'
          }}>
            {filters.map((filter) => (
              <button
                key={filter.id}
                onClick={() => setActiveFilter(filter.id as typeof activeFilter)}
                style={{
                  backgroundColor: activeFilter === filter.id
                    ? 'rgba(255, 255, 255, 0.3)'
                    : 'rgba(255, 255, 255, 0.1)',
                  color: 'white',
                  border: activeFilter === filter.id ? '2px solid white' : '2px solid transparent',
                  borderRadius: '8px',
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  minHeight: '40px'
                }}
              >
                {filter.icon} {filter.label}
              </button>
            ))}
          </div>
        </header>

        {/* Job List */}
        <div style={{
          padding: '1rem',
          maxWidth: '600px',
          margin: '0 auto'
        }}>
          {filteredJobs.length === 0 ? (
            <div style={{
              backgroundColor: 'white',
              padding: '2rem',
              borderRadius: '8px',
              textAlign: 'center',
              color: '#6b7280'
            }}>
              <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</p>
              <p style={{ margin: 0 }}>No jobs found</p>
            </div>
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}>
              {filteredJobs.map((job) => (
                <button
                  key={job.id}
                  onClick={() => router.push(`/m/jobs/${job.id}`)}
                  style={{
                    backgroundColor: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '1rem',
                    cursor: 'pointer',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                    textAlign: 'left',
                    transition: 'all 0.2s',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                  onMouseDown={(e) => {
                    e.currentTarget.style.transform = 'scale(0.98)';
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  {/* Status Badge */}
                  <div style={{
                    display: 'inline-block',
                    backgroundColor: getStatusColor(job.status),
                    color: 'white',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '12px',
                    marginBottom: '0.75rem'
                  }}>
                    {getStatusLabel(job.status)}
                  </div>

                  {/* Job Ref */}
                  <div style={{
                    fontSize: '1.1rem',
                    fontWeight: '700',
                    color: '#1f2937',
                    marginBottom: '0.75rem'
                  }}>
                    {job.ref}
                  </div>

                  {/* Pickup */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.5rem',
                    marginBottom: '0.5rem'
                  }}>
                    <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>📦</span>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        color: '#374151',
                        marginBottom: '0.125rem'
                      }}>
                        Pickup
                      </div>
                      <div style={{
                        fontSize: '0.875rem',
                        color: '#6b7280'
                      }}>
                        {job.pickupLocation}
                      </div>
                      <div style={{
                        fontSize: '0.75rem',
                        color: '#9ca3af',
                        marginTop: '0.125rem'
                      }}>
                        {formatDate(job.pickupTime)} at {formatTime(job.pickupTime)}
                      </div>
                    </div>
                  </div>

                  {/* Delivery */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.5rem'
                  }}>
                    <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>📍</span>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        color: '#374151',
                        marginBottom: '0.125rem'
                      }}>
                        Delivery
                      </div>
                      <div style={{
                        fontSize: '0.875rem',
                        color: '#6b7280'
                      }}>
                        {job.deliveryLocation}
                      </div>
                      <div style={{
                        fontSize: '0.75rem',
                        color: '#9ca3af',
                        marginTop: '0.125rem'
                      }}>
                        {formatDate(job.deliveryTime)} at {formatTime(job.deliveryTime)}
                      </div>
                    </div>
                  </div>

                  {/* Arrow indicator */}
                  <div style={{
                    position: 'absolute',
                    right: '1rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: '1.5rem',
                    color: '#d1d5db'
                  }}>
                    →
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
