'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { useAuth } from '../../../components/AuthContext';
import PODPhotoUpload from '../../../components/PODPhotoUpload';
import SignatureCanvas from '../../../components/SignatureCanvas';
import DelayUpdate from '../../../components/DelayUpdate';
import Toast from '../../../components/Toast';
import { JOB_STATUS, JOB_STATUS_LABEL } from '../../../config/company';

interface JobPODData {
  pickupPhotos: string[];
  pickupTimestamp?: string;
  deliveryPhotos: string[];
  signature: string;
  recipientName: string;
  deliveryTimestamp?: string;
}

interface Job {
  id: string;
  jobRef: string;
  client: {
    name: string;
    email: string;
    phone: string;
  };
  pickup: {
    location: string;
    date: string;
    time: string;
  };
  delivery: {
    location: string;
    date: string;
    time: string;
  };
  cargo: {
    type: string;
    quantity: number;
    notes: string;
  };
  status: string;
  createdAt: string;
  updatedAt: string;
  statusHistory?: Array<{
    status: string;
    timestamp: string;
  }>;
  pod?: JobPODData;
  delayHistory?: Array<{
    delayMinutes: number;
    reason: string;
    timestamp: string;
  }>;
}

export default function JobDetailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const jobId = params.id as string;

  const [job, setJob] = useState<Job | null>(null);
  const [podData, setPodData] = useState<JobPODData>({
    pickupPhotos: [],
    deliveryPhotos: [],
    signature: '',
    recipientName: ''
  });
  const [loading, setLoading] = useState(true);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [showDelayModal, setShowDelayModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    loadJobData();
  }, [jobId]);

  const loadJobData = () => {
    try {
      // Load jobs from localStorage
      const stored = localStorage.getItem('danny_jobs');
      if (stored) {
        const jobs: Job[] = JSON.parse(stored);
        const foundJob = jobs.find((j) => j.id === jobId);
        
        if (foundJob) {
          setJob(foundJob);
          
          // Load POD data for this specific job
          const podStorage = localStorage.getItem('danny_job_pods');
          if (podStorage) {
            const allPods = JSON.parse(podStorage);
            if (allPods[jobId]) {
              setPodData(allPods[jobId]);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading job data:', error);
      setToast({ message: 'Error loading job data', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const updateJobInStorage = (updates: Partial<Job>) => {
    try {
      const stored = localStorage.getItem('danny_jobs');
      if (stored) {
        const jobs: Job[] = JSON.parse(stored);
        const jobIndex = jobs.findIndex((j) => j.id === jobId);
        
        if (jobIndex !== -1) {
          jobs[jobIndex] = {
            ...jobs[jobIndex],
            ...updates,
            updatedAt: new Date().toISOString()
          };
          localStorage.setItem('danny_jobs', JSON.stringify(jobs));
          setJob(jobs[jobIndex]);
        }
      }
    } catch (error) {
      console.error('Error updating job:', error);
    }
  };

  const savePODData = (newPodData: JobPODData) => {
    try {
      setPodData(newPodData);
      
      // Get existing POD storage
      const podStorage = localStorage.getItem('danny_job_pods');
      const allPods = podStorage ? JSON.parse(podStorage) : {};
      
      // Update POD for this job
      allPods[jobId] = newPodData;
      
      // Save back to localStorage
      localStorage.setItem('danny_job_pods', JSON.stringify(allPods));
      
      // Also update job.pod field
      updateJobInStorage({ pod: newPodData });
    } catch (error) {
      console.error('Error saving POD data:', error);
      setToast({ message: 'Error saving POD data', type: 'error' });
    }
  };

  const handlePickupPhotosChange = (photos: string[]) => {
    const timestamp = photos.length > 0 && !podData.pickupTimestamp 
      ? new Date().toISOString() 
      : podData.pickupTimestamp;
    const newPodData = { 
      ...podData, 
      pickupPhotos: photos,
      pickupTimestamp: timestamp
    };
    savePODData(newPodData);
  };

  const handleDeliveryPhotosChange = (photos: string[]) => {
    const newPodData = { ...podData, deliveryPhotos: photos };
    savePODData(newPodData);
  };

  const handleSignatureSave = (signatureData: string, recipientName: string) => {
    const newPodData = { 
      ...podData, 
      signature: signatureData, 
      recipientName 
    };
    savePODData(newPodData);
    setShowSignatureModal(false);
    setToast({ message: 'Signature saved successfully!', type: 'success' });
  };

  const handleSavePickupPOD = () => {
    if (podData.pickupPhotos.length === 0) {
      setToast({ message: 'Please add at least one pickup photo', type: 'error' });
      return;
    }

    // Update job status to Allocated (picked up)
    updateJobInStorage({ 
      status: JOB_STATUS.ALLOCATED,
      statusHistory: [
        ...(job?.statusHistory || []),
        { status: JOB_STATUS.ALLOCATED, timestamp: new Date().toISOString() }
      ]
    });

    setToast({ 
      message: 'Pickup POD saved successfully!', 
      type: 'success' 
    });
  };

  const handleMarkDelivered = () => {
    if (!podData.signature || !podData.recipientName) {
      setToast({ message: 'Please capture signature and recipient name', type: 'error' });
      return;
    }

    if (podData.deliveryPhotos.length === 0) {
      const confirm = window.confirm('No delivery photos added. Continue anyway?');
      if (!confirm) return;
    }

    const deliveryTimestamp = new Date().toISOString();
    const newPodData = { 
      ...podData, 
      deliveryTimestamp 
    };
    savePODData(newPodData);

    // Update job status to Delivered
    updateJobInStorage({ 
      status: JOB_STATUS.DELIVERED,
      statusHistory: [
        ...(job?.statusHistory || []),
        { status: JOB_STATUS.DELIVERED, timestamp: deliveryTimestamp }
      ]
    });

    setToast({ 
      message: `Job ${job?.jobRef} marked as delivered!`, 
      type: 'success' 
    });
    
    setTimeout(() => {
      router.push('/m/jobs');
    }, 2000);
  };

  const handleDelayUpdate = (delayMinutes: number, reason: string) => {
    const timestamp = new Date().toISOString();
    
    // Log delay to job history
    const delayEntry = {
      delayMinutes,
      reason,
      timestamp
    };
    
    updateJobInStorage({
      delayHistory: [
        ...(job?.delayHistory || []),
        delayEntry
      ]
    });

    // Mock send notification (console.log for now)
    const message = `Delay Update - ${job?.jobRef}\n\nEstimated delay: ${delayMinutes} minutes\nReason: ${reason}\n\nWe apologize for any inconvenience.`;
    console.log('Delay notification:', message);
    
    setToast({ 
      message: `Delay notification sent: +${delayMinutes} minutes`, 
      type: 'info' 
    });
    
    setShowDelayModal(false);
  };

  const formatDateTime = (date: string, time: string) => {
    const dateObj = new Date(`${date}T${time}`);
    return dateObj.toLocaleString('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const canShowPickupPOD = () => {
    return job?.status === JOB_STATUS.RECEIVED || job?.status === JOB_STATUS.POSTED;
  };

  const canShowDeliveryPOD = () => {
    return job?.status === JOB_STATUS.ALLOCATED || job?.status === JOB_STATUS.DELIVERED;
  };

  const isReadOnly = () => {
    return job?.status === JOB_STATUS.DELIVERED;
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f3f4f6'
        }}>
          <div style={{ textAlign: 'center', color: '#6b7280' }}>
            <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏳</p>
            <p role="status" aria-live="polite">Loading job details...</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (!job) {
    return (
      <ProtectedRoute>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f3f4f6'
        }}>
          <div style={{ textAlign: 'center', color: '#6b7280' }}>
            <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>❌</p>
            <p>Job not found</p>
            <button
              onClick={() => router.push('/m/jobs')}
              style={{
                marginTop: '1rem',
                backgroundColor: '#0A2239',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '0.75rem 1.5rem',
                fontSize: '1rem',
                cursor: 'pointer'
              }}
            >
              Back to Jobs
            </button>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f3f4f6',
        paddingBottom: '2rem'
      }}>
        {/* Header - XDrive Logistics Navy #0A2239 */}
        <header style={{
          backgroundColor: '#0A2239',
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
            gap: '1rem'
          }}>
            <button
              onClick={() => router.push('/m/jobs')}
              aria-label="Back to jobs list"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '0.5rem 0.75rem',
                fontSize: '1rem',
                cursor: 'pointer',
                minHeight: '40px',
                minWidth: '40px'
              }}
            >
              ←
            </button>
            <div style={{ flex: 1 }}>
              <h1 style={{
                fontSize: '1.1rem',
                fontWeight: '700',
                margin: 0
              }}>
                {job.jobRef}
              </h1>
              <p style={{
                fontSize: '0.85rem',
                margin: 0,
                opacity: 0.9
              }}>
                Status: {JOB_STATUS_LABEL[job.status] ?? job.status}
              </p>
            </div>
          </div>
        </header>

        {/* Content */}
        <div style={{
          padding: '1rem',
          maxWidth: '600px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          {/* Job Info Card */}
          <div style={{
            backgroundColor: 'white',
            padding: '1rem',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}>
            {/* Pickup Section */}
            <div style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #e5e7eb' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '0.5rem'
              }}>
                <span style={{ fontSize: '1.25rem' }}>📦</span>
                <h3 style={{
                  fontSize: '1rem',
                  fontWeight: '600',
                  color: '#1f2937',
                  margin: 0
                }}>
                  Pickup
                </h3>
              </div>
              <div style={{
                fontSize: '0.875rem',
                color: '#374151',
                marginBottom: '0.25rem',
                fontWeight: '500'
              }}>
                {job.pickup.location}
              </div>
              <div style={{
                fontSize: '0.875rem',
                color: '#9ca3af',
                fontWeight: '500'
              }}>
                ⏰ {formatDateTime(job.pickup.date, job.pickup.time)}
              </div>
            </div>

            {/* Delivery Section */}
            <div style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #e5e7eb' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '0.5rem'
              }}>
                <span style={{ fontSize: '1.25rem' }}>📍</span>
                <h3 style={{
                  fontSize: '1rem',
                  fontWeight: '600',
                  color: '#1f2937',
                  margin: 0
                }}>
                  Delivery
                </h3>
              </div>
              <div style={{
                fontSize: '0.875rem',
                color: '#374151',
                marginBottom: '0.25rem',
                fontWeight: '500'
              }}>
                {job.delivery.location}
              </div>
              <div style={{
                fontSize: '0.875rem',
                color: '#9ca3af',
                fontWeight: '500'
              }}>
                ⏰ {formatDateTime(job.delivery.date, job.delivery.time)}
              </div>
            </div>

            {/* Cargo Info */}
            <div>
              <div style={{
                fontSize: '0.875rem',
                color: '#6b7280',
                marginBottom: '0.25rem'
              }}>
                <strong>Cargo:</strong> {job.cargo.type} ({job.cargo.quantity})
              </div>
              {job.cargo.notes && (
                <div style={{
                  marginTop: '0.5rem',
                  padding: '0.75rem',
                  backgroundColor: '#fef3c7',
                  borderRadius: '6px',
                  borderLeft: '3px solid #f59e0b'
                }}>
                  <div style={{
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    color: '#92400e',
                    marginBottom: '0.25rem'
                  }}>
                    📝 NOTES
                  </div>
                  <div style={{
                    fontSize: '0.875rem',
                    color: '#78350f'
                  }}>
                    {job.cargo.notes}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Pickup POD Section */}
          {canShowPickupPOD() && !isReadOnly() && (
            <>
              <div style={{
                backgroundColor: 'white',
                padding: '1rem',
                borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
              }}>
                <h3 style={{
                  fontSize: '1rem',
                  fontWeight: '600',
                  color: '#1f2937',
                  marginBottom: '0.5rem'
                }}>
                  📦 Pickup POD
                </h3>
                <PODPhotoUpload
                  maxPhotos={3}
                  podType="pickup"
                  onPhotosChange={handlePickupPhotosChange}
                  initialPhotos={podData.pickupPhotos}
                />
                {podData.pickupTimestamp && (
                  <div style={{
                    fontSize: '0.75rem',
                    color: '#6b7280',
                    marginTop: '0.5rem'
                  }}>
                    Captured: {formatTimestamp(podData.pickupTimestamp)}
                  </div>
                )}
              </div>

              {podData.pickupPhotos.length > 0 && (
                <button
                  onClick={handleSavePickupPOD}
                  style={{
                    width: '100%',
                    backgroundColor: '#1F7A3D',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '1rem',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    minHeight: '48px'
                  }}
                >
                  ✅ Save Pickup POD
                </button>
              )}
            </>
          )}

          {/* Delivery POD Section */}
          {canShowDeliveryPOD() && !isReadOnly() && (
            <>
              <div style={{
                backgroundColor: 'white',
                padding: '1rem',
                borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
              }}>
                <h3 style={{
                  fontSize: '1rem',
                  fontWeight: '600',
                  color: '#1f2937',
                  marginBottom: '0.5rem'
                }}>
                  📍 Delivery POD
                </h3>
                <PODPhotoUpload
                  maxPhotos={5}
                  podType="delivery"
                  onPhotosChange={handleDeliveryPhotosChange}
                  initialPhotos={podData.deliveryPhotos}
                />
              </div>

              {/* Recipient Name Input */}
              <div style={{
                backgroundColor: 'white',
                padding: '1rem',
                borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
              }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  Recipient Name *
                </label>
                <input
                  type="text"
                  value={podData.recipientName}
                  onChange={(e) => {
                    const newPodData = { ...podData, recipientName: e.target.value };
                    savePODData(newPodData);
                  }}
                  placeholder="Enter recipient name"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '1rem'
                  }}
                />
              </div>

              {/* Signature Section */}
              <div style={{
                backgroundColor: 'white',
                padding: '1rem',
                borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
              }}>
                <h3 style={{
                  fontSize: '1rem',
                  fontWeight: '600',
                  color: '#1f2937',
                  marginBottom: '0.5rem'
                }}>
                  ✍️ Signature *
                </h3>
                
                {podData.signature ? (
                  <div>
                    <div style={{
                      border: '2px solid #1F7A3D',
                      borderRadius: '8px',
                      padding: '0.5rem',
                      marginBottom: '0.5rem',
                      backgroundColor: '#f0fdf4'
                    }}>
                      <img 
                        src={podData.signature} 
                        alt="Signature" 
                        style={{
                          width: '100%',
                          height: 'auto',
                          display: 'block'
                        }}
                      />
                    </div>
                    <button
                      onClick={() => setShowSignatureModal(true)}
                      style={{
                        width: '100%',
                        backgroundColor: '#f3f4f6',
                        color: '#374151',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '0.75rem',
                        fontSize: '0.9rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        minHeight: '48px'
                      }}
                    >
                      ✏️ Edit Signature
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowSignatureModal(true)}
                    style={{
                      width: '100%',
                      backgroundColor: '#1F7A3D',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '1rem',
                      fontSize: '1rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      minHeight: '48px'
                    }}
                  >
                    ✍️ Capture Signature
                  </button>
                )}
              </div>
            </>
          )}

          {/* Read-only POD Display */}
          {isReadOnly() && (
            <>
              {podData.pickupPhotos.length > 0 && (
                <div style={{
                  backgroundColor: 'white',
                  padding: '1rem',
                  borderRadius: '8px',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                }}>
                  <h3 style={{
                    fontSize: '1rem',
                    fontWeight: '600',
                    color: '#1f2937',
                    marginBottom: '0.5rem'
                  }}>
                    📦 Pickup POD
                  </h3>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '0.5rem'
                  }}>
                    {podData.pickupPhotos.map((photo, index) => (
                      <img
                        key={index}
                        src={photo}
                        alt={`Pickup ${index + 1}`}
                        style={{
                          width: '100%',
                          height: '100px',
                          objectFit: 'cover',
                          borderRadius: '6px'
                        }}
                      />
                    ))}
                  </div>
                  {podData.pickupTimestamp && (
                    <div style={{
                      fontSize: '0.75rem',
                      color: '#6b7280',
                      marginTop: '0.5rem'
                    }}>
                      {formatTimestamp(podData.pickupTimestamp)}
                    </div>
                  )}
                </div>
              )}

              {podData.deliveryPhotos.length > 0 && (
                <div style={{
                  backgroundColor: 'white',
                  padding: '1rem',
                  borderRadius: '8px',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                }}>
                  <h3 style={{
                    fontSize: '1rem',
                    fontWeight: '600',
                    color: '#1f2937',
                    marginBottom: '0.5rem'
                  }}>
                    📍 Delivery POD
                  </h3>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '0.5rem',
                    marginBottom: '0.5rem'
                  }}>
                    {podData.deliveryPhotos.map((photo, index) => (
                      <img
                        key={index}
                        src={photo}
                        alt={`Delivery ${index + 1}`}
                        style={{
                          width: '100%',
                          height: '100px',
                          objectFit: 'cover',
                          borderRadius: '6px'
                        }}
                      />
                    ))}
                  </div>
                  {podData.recipientName && (
                    <div style={{
                      fontSize: '0.875rem',
                      color: '#374151',
                      marginBottom: '0.25rem'
                    }}>
                      <strong>Recipient:</strong> {podData.recipientName}
                    </div>
                  )}
                  {podData.signature && (
                    <div style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      padding: '0.5rem',
                      marginTop: '0.5rem'
                    }}>
                      <img src={podData.signature} alt="Signature" style={{ width: '100%' }} />
                    </div>
                  )}
                  {podData.deliveryTimestamp && (
                    <div style={{
                      fontSize: '0.75rem',
                      color: '#6b7280',
                      marginTop: '0.5rem'
                    }}>
                      Delivered: {formatTimestamp(podData.deliveryTimestamp)}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Action Buttons */}
          {!isReadOnly() && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.5rem'
            }}>
              <button
                onClick={() => setShowDelayModal(true)}
                style={{
                  backgroundColor: '#f59e0b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '1rem',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  minHeight: '48px'
                }}
              >
                ⏰ Delay Update
              </button>
              {canShowDeliveryPOD() && (
                <button
                  onClick={handleMarkDelivered}
                  disabled={!podData.signature || !podData.recipientName}
                  aria-label={!podData.signature || !podData.recipientName ? 'Complete signature and recipient name to enable' : 'Mark job as delivered'}
                  style={{
                    backgroundColor: podData.signature && podData.recipientName ? '#1F7A3D' : '#9ca3af',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '1rem',
                    fontSize: '0.95rem',
                    fontWeight: '600',
                    cursor: podData.signature && podData.recipientName ? 'pointer' : 'not-allowed',
                    minHeight: '48px'
                  }}
                >
                  ✅ Mark Delivered
                </button>
              )}
            </div>
          )}

          {/* Delivered Status */}
          {isReadOnly() && podData.deliveryTimestamp && (
            <div style={{
              backgroundColor: '#1F7A3D',
              color: 'white',
              padding: '1rem',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{
                fontSize: '2rem',
                marginBottom: '0.5rem'
              }}>
                ✅
              </div>
              <div style={{
                fontSize: '1rem',
                fontWeight: '600',
                marginBottom: '0.25rem'
              }}>
                Delivered Successfully
              </div>
              <div style={{
                fontSize: '0.875rem',
                opacity: 0.9
              }}>
                {formatTimestamp(podData.deliveryTimestamp)}
              </div>
            </div>
          )}

          {/* Delay History */}
          {job.delayHistory && job.delayHistory.length > 0 && (
            <div style={{
              backgroundColor: 'white',
              padding: '1rem',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
            }}>
              <h3 style={{
                fontSize: '1rem',
                fontWeight: '600',
                color: '#1f2937',
                marginBottom: '0.5rem'
              }}>
                ⏰ Delay History
              </h3>
              {job.delayHistory.map((delay, index) => (
                <div
                  key={index}
                  style={{
                    padding: '0.75rem',
                    backgroundColor: '#fef3c7',
                    borderRadius: '6px',
                    marginBottom: index < job.delayHistory!.length - 1 ? '0.5rem' : 0
                  }}
                >
                  <div style={{
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: '#92400e'
                  }}>
                    +{delay.delayMinutes} minutes
                  </div>
                  <div style={{
                    fontSize: '0.875rem',
                    color: '#78350f',
                    marginTop: '0.25rem'
                  }}>
                    {delay.reason}
                  </div>
                  <div style={{
                    fontSize: '0.75rem',
                    color: '#92400e',
                    marginTop: '0.25rem'
                  }}>
                    {formatTimestamp(delay.timestamp)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Signature Modal */}
        {showSignatureModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: '1rem'
          }}>
            <div style={{ maxWidth: '500px', width: '100%' }}>
              <SignatureCanvas
                onSave={handleSignatureSave}
                onCancel={() => setShowSignatureModal(false)}
                initialSignature={podData.signature}
                initialRecipientName={podData.recipientName}
              />
            </div>
          </div>
        )}

        {/* Delay Update Modal */}
        {showDelayModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: '1rem'
          }}>
            <div style={{ maxWidth: '500px', width: '100%' }}>
              <DelayUpdate
                jobRef={job.jobRef}
                onSend={handleDelayUpdate}
                onCancel={() => setShowDelayModal(false)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Toast Notification */}
      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}
    </ProtectedRoute>
  );
}
