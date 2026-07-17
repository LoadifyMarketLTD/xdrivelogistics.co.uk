'use client';

import { useState, useRef } from 'react';

interface PODPhotoUploadProps {
  maxPhotos: number;
  podType: 'pickup' | 'delivery';
  onPhotosChange: (photos: string[]) => void;
  initialPhotos?: string[];
}

export default function PODPhotoUpload({ 
  maxPhotos, 
  podType, 
  onPhotosChange,
  initialPhotos = []
}: PODPhotoUploadProps) {
  const [photos, setPhotos] = useState<string[]>(initialPhotos);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const remainingSlots = maxPhotos - photos.length;
    const filesToProcess = Array.from(files).slice(0, remainingSlots);

    const newPhotos: string[] = [];
    for (const file of filesToProcess) {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        const photoData = await new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        newPhotos.push(photoData);
      }
    }

    const updatedPhotos = [...photos, ...newPhotos];
    setPhotos(updatedPhotos);
    onPhotosChange(updatedPhotos);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCameraCapture = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const deletePhoto = (index: number) => {
    const updatedPhotos = photos.filter((_, i) => i !== index);
    setPhotos(updatedPhotos);
    onPhotosChange(updatedPhotos);
  };

  const canAddMore = photos.length < maxPhotos;

  return (
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
        marginBottom: '0.75rem'
      }}>
        {podType === 'pickup' ? 'Pickup Photos' : 'Delivery Photos'} ({photos.length}/{maxPhotos})
      </h3>

      {/* Photo Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '0.5rem',
        marginBottom: canAddMore ? '1rem' : '0'
      }}>
        {photos.map((photo, index) => (
          <div key={index} style={{
            position: 'relative',
            aspectRatio: '1',
            borderRadius: '8px',
            overflow: 'hidden',
            border: '2px solid #e5e7eb'
          }}>
            <img 
              src={photo} 
              alt={`Photo ${index + 1}`}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
            />
            <button
              onClick={() => deletePhoto(index)}
              style={{
                position: 'absolute',
                top: '4px',
                right: '4px',
                backgroundColor: 'rgba(239, 68, 68, 0.9)',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '28px',
                height: '28px',
                cursor: 'pointer',
                fontSize: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold'
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Camera/Upload Button */}
      {canAddMore && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          <button
            onClick={handleCameraCapture}
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
              minHeight: '48px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
          >
            <span style={{ fontSize: '1.25rem' }}>📷</span>
            Add Photo
          </button>
        </>
      )}
    </div>
  );
}
