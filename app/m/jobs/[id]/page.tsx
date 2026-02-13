'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { useAuth } from '../../../components/AuthContext';
import PODPhotoUpload from '../../../components/PODPhotoUpload';
import SignatureCanvas from '../../../components/SignatureCanvas';
import DelayUpdate from '../../../components/DelayUpdate';

interface JobPODData {
  pickupPhotos: string[];
  deliveryPhotos: string[];
  signature: string;
  recipientName: string;
  deliveredAt: string;
}

interface Job {
  id: string;
  ref: string;
  pickupLocation: string;
  deliveryLocation: string;
  pickupTime: string;
  deliveryTime: string;
  status: 'active' | 'pickup' | 'delivery' | 'completed';
  pickupAddress: string;
  deliveryAddress: string;
  specialInstructions?: string;
}

// Mock data
const mockJobs: Record<string, Job> = {
  '1': {
    id: '1',
    ref: 'DC-240115-0001',
    pickupLocation: 'Birmingham Warehouse',
    deliveryLocation: 'London Office',
    pickupTime: '2024-01-15T09:00:00',
    deliveryTime: '2024-01-15T14:00:00',
    status: 'active',
    pickupAddress: '123 Industrial Estate, Birmingham, B1 1AA',
    deliveryAddress: '456 Business Park, London, EC1A 1BB',
    specialInstructions: 'Ring bell at reception. Contact: John Smith 07700 900000'
  },
  '2': {
    id: '2',
    ref: 'DC-240115-0002',
    pickupLocation: 'Manchester Depot',
    deliveryLocation: 'Leeds Distribution Center',
    pickupTime: '2024-01-15T10:30:00',
    deliveryTime: '2024-01-15T13:30:00',
    status: 'pickup',
    pickupAddress: '789 Depot Road, Manchester, M1 1CC',
    deliveryAddress: '321 Distribution Way, Leeds, LS1 1DD'
  },
  '3': {
    id: '3',
    ref: 'DC-240115-0003',
    pickupLocation: 'Bristol Storage',
    deliveryLocation: 'Cardiff Warehouse',
    pickupTime: '2024-01-15T08:00:00',
    deliveryTime: '2024-01-15T11:00:00',
    status: 'delivery',
    pickupAddress: '555 Storage Lane, Bristol, BS1 1EE',
    deliveryAddress: '777 Warehouse Street, Cardiff, CF1 1FF'
  },
  '4': {
    id: '4',
    ref: 'DC-240114-0045',
    pickupLocation: 'Southampton Port',
    deliveryLocation: 'Reading HQ',
    pickupTime: '2024-01-14T15:00:00',
    deliveryTime: '2024-01-14T17:30:00',
    status: 'completed',
    pickupAddress: '999 Port Road, Southampton, SO1 1GG',
    deliveryAddress: '111 HQ Plaza, Reading, RG1 1HH'
  },
};

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
    recipientName: '',
    deliveredAt: ''
  });
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [showDelayModal, setShowDelayModal] = useState(false);

  useEffect(() => {
    // Load job data
    const jobData = mockJobs[jobId];
    if (jobData) {
      setJob(jobData);
      
      // Load POD data from localStorage
      const savedPOD = localStorage.getItem(`job_pod_${jobId}`);
      if (savedPOD) {
        try {
          setPodData(JSON.parse(savedPOD));
        } catch (e) {
          console.error('Failed to parse POD data:', e);
        }
      }
    }
  }, [jobId]);

  const savePODData = (newPodData: JobPODData) => {
    setPodData(newPodData);
    localStorage.setItem(`job_pod_${jobId}`, JSON.stringify(newPodData));
  };

  const handlePickupPhotosChange = (photos: string[]) => {
    const newPodData = { ...podData, pickupPhotos: photos };
    savePODData(newPodData);
  };

  const handleDeliveryPhotosChange = (photos: string[]) => {
    const newPodData = { ...podData, deliveryPhotos: photos };
    savePODData(newPodData);
  };

  const handleSignatureSave = (signatureData: string, recipientName: string) => {
    const newPodData = { ...podData, signature: signatureData, recipientName };
    savePODData(newPodData);
    setShowSignatureModal(false);
    alert('Signature saved successfully!');
  };

  const handleMarkDelivered = () => {
    if (!podData.signature || !podData.recipientName) {
      alert('Please capture signature before marking as delivered');
      return;
    }

    if (podData.deliveryPhotos.length === 0) {
      const confirm = window.confirm('No delivery photos added. Continue anyway?');
      if (!confirm) return;
    }

    const deliveredAt = new Date().toISOString();
    const newPodData = { ...podData, deliveredAt };
    savePODData(newPodData);

    alert(`Job ${job?.ref} marked as delivered!\nDelivery time: ${new Date(deliveredAt).toLocaleString()}`);
    
    // In production, this would sync to backend
    setTimeout(() => {
      router.push('/m/jobs');
    }, 1000);
  };

  const handleSendPickupPOD = () => {
    if (podData.pickupPhotos.length === 0) {
      alert('Please add at least one pickup photo');
      return;
    }
    alert(`Pickup POD sent for ${job?.ref}!\n${podData.pickupPhotos.length} photos uploaded.`);
    // In production, this would send to backend
  };

  const handleSendDeliveryPOD = () => {
    if (podData.deliveryPhotos.length === 0) {
      alert('Please add at least one delivery photo');
      return;
    }
    alert(`Delivery POD sent for ${job?.ref}!\n${podData.deliveryPhotos.length} photos uploaded.`);
    // In production, this would send to backend
  };

  const handleDelayUpdate = (delayMinutes: number, reason: string) => {
    const message = `Delay Update - ${job?.ref}\n\nEstimated delay: ${delayMinutes} minutes\nReason: ${reason}\n\nWe apologize for any inconvenience.`;
    
    // In production, this would send via WhatsApp/Email
    alert(`Delay update prepared:\n\n${message}\n\n(In production, this would be sent via WhatsApp/Email)`);
    
    setShowDelayModal(false);
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

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
            gap: '1rem'
          }}>
            <button
              onClick={() => router.push('/m/jobs')}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '0.5rem 0.75rem',
                fontSize: '1rem',
                cursor: 'pointer',
                minHeight: '40px'
              }}
            >
              ← Back
            </button>
            <div style={{ flex: 1 }}>
              <h1 style={{
                fontSize: '1.1rem',
                fontWeight: '700',
                margin: 0
              }}>
                {job.ref}
              </h1>
              <p style={{
                fontSize: '0.85rem',
                margin: 0,
                opacity: 0.9
              }}>
                Job Details
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
                {job.pickupLocation}
              </div>
              <div style={{
                fontSize: '0.875rem',
                color: '#6b7280',
                marginBottom: '0.25rem'
              }}>
                {job.pickupAddress}
              </div>
              <div style={{
                fontSize: '0.875rem',
                color: '#9ca3af',
                fontWeight: '500'
              }}>
                ⏰ {formatTime(job.pickupTime)}
              </div>
            </div>

            {/* Delivery Section */}
            <div>
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
                {job.deliveryLocation}
              </div>
              <div style={{
                fontSize: '0.875rem',
                color: '#6b7280',
                marginBottom: '0.25rem'
              }}>
                {job.deliveryAddress}
              </div>
              <div style={{
                fontSize: '0.875rem',
                color: '#9ca3af',
                fontWeight: '500'
              }}>
                ⏰ {formatTime(job.deliveryTime)}
              </div>
            </div>

            {/* Special Instructions */}
            {job.specialInstructions && (
              <div style={{
                marginTop: '1rem',
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
                  📝 SPECIAL INSTRUCTIONS
                </div>
                <div style={{
                  fontSize: '0.875rem',
                  color: '#78350f'
                }}>
                  {job.specialInstructions}
                </div>
              </div>
            )}
          </div>

          {/* Pickup POD */}
          <PODPhotoUpload
            maxPhotos={3}
            podType="pickup"
            onPhotosChange={handlePickupPhotosChange}
            initialPhotos={podData.pickupPhotos}
          />

          {podData.pickupPhotos.length > 0 && (
            <button
              onClick={handleSendPickupPOD}
              style={{
                width: '100%',
                backgroundColor: '#f59e0b',
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
              📤 Send Pickup POD
            </button>
          )}

          {/* Delivery POD */}
          <PODPhotoUpload
            maxPhotos={5}
            podType="delivery"
            onPhotosChange={handleDeliveryPhotosChange}
            initialPhotos={podData.deliveryPhotos}
          />

          {podData.deliveryPhotos.length > 0 && (
            <button
              onClick={handleSendDeliveryPOD}
              style={{
                width: '100%',
                backgroundColor: '#3b82f6',
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
              📤 Send Delivery POD
            </button>
          )}

          {/* Signature Section */}
          {!showSignatureModal && (
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
                Signature
              </h3>
              
              {podData.signature ? (
                <div>
                  <div style={{
                    border: '2px solid #10b981',
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
                  <div style={{
                    fontSize: '0.875rem',
                    color: '#374151',
                    marginBottom: '0.5rem'
                  }}>
                    <strong>Recipient:</strong> {podData.recipientName}
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
                    backgroundColor: '#10b981',
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
          )}

          {showSignatureModal && (
            <SignatureCanvas
              onSave={handleSignatureSave}
              onCancel={() => setShowSignatureModal(false)}
              initialSignature={podData.signature}
              initialRecipientName={podData.recipientName}
            />
          )}

          {/* Action Buttons */}
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
            <button
              onClick={handleMarkDelivered}
              style={{
                backgroundColor: '#10b981',
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
              ✅ Mark Delivered
            </button>
          </div>

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
                  jobRef={job.ref}
                  onSend={handleDelayUpdate}
                  onCancel={() => setShowDelayModal(false)}
                />
              </div>
            </div>
          )}

          {/* Delivered Status */}
          {podData.deliveredAt && (
            <div style={{
              backgroundColor: '#10b981',
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
                {new Date(podData.deliveredAt).toLocaleString()}
              </div>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
