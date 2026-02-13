'use client';

import { useState, useRef, useEffect } from 'react';

interface SignatureCanvasProps {
  onSave: (signatureData: string, recipientName: string) => void;
  onCancel?: () => void;
  initialSignature?: string;
  initialRecipientName?: string;
}

export default function SignatureCanvas({ 
  onSave, 
  onCancel,
  initialSignature = '',
  initialRecipientName = ''
}: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [recipientName, setRecipientName] = useState(initialRecipientName);
  const [hasSignature, setHasSignature] = useState(!!initialSignature);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = 200;

    // Set drawing style
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Load initial signature if provided
    if (initialSignature) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
      };
      img.src = initialSignature;
    }
  }, [initialSignature]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    setHasSignature(true);

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e 
      ? e.touches[0].clientX - rect.left
      : e.clientX - rect.left;
    const y = 'touches' in e
      ? e.touches[0].clientY - rect.top
      : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e
      ? e.touches[0].clientX - rect.left
      : e.clientX - rect.left;
    const y = 'touches' in e
      ? e.touches[0].clientY - rect.top
      : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();

    e.preventDefault();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!hasSignature) {
      alert('Please provide a signature');
      return;
    }

    if (!recipientName.trim()) {
      alert('Please enter recipient name');
      return;
    }

    const signatureData = canvas.toDataURL('image/png');
    onSave(signatureData, recipientName.trim());
  };

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
        Delivery Signature
      </h3>

      {/* Recipient Name Input */}
      <div style={{ marginBottom: '1rem' }}>
        <label style={{
          display: 'block',
          fontSize: '0.875rem',
          fontWeight: '500',
          color: '#374151',
          marginBottom: '0.5rem'
        }}>
          Recipient Name
        </label>
        <input
          type="text"
          value={recipientName}
          onChange={(e) => setRecipientName(e.target.value)}
          placeholder="Enter recipient name"
          style={{
            width: '100%',
            padding: '0.75rem',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            fontSize: '1rem',
            minHeight: '48px'
          }}
        />
      </div>

      {/* Canvas */}
      <div style={{
        border: '2px dashed #d1d5db',
        borderRadius: '8px',
        marginBottom: '1rem',
        backgroundColor: '#f9fafb'
      }}>
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          style={{
            width: '100%',
            height: '200px',
            cursor: 'crosshair',
            touchAction: 'none'
          }}
        />
      </div>

      <p style={{
        fontSize: '0.75rem',
        color: '#6b7280',
        textAlign: 'center',
        marginBottom: '1rem'
      }}>
        Sign above with your finger or stylus
      </p>

      {/* Buttons */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: onCancel ? '1fr 1fr' : '1fr',
        gap: '0.5rem'
      }}>
        <button
          onClick={clearSignature}
          style={{
            backgroundColor: '#f3f4f6',
            color: '#374151',
            border: 'none',
            borderRadius: '8px',
            padding: '0.75rem',
            fontSize: '1rem',
            fontWeight: '600',
            cursor: 'pointer',
            minHeight: '48px'
          }}
        >
          Clear
        </button>
        <button
          onClick={handleSave}
          style={{
            backgroundColor: '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '0.75rem',
            fontSize: '1rem',
            fontWeight: '600',
            cursor: 'pointer',
            minHeight: '48px'
          }}
        >
          Save Signature
        </button>
      </div>

      {onCancel && (
        <button
          onClick={onCancel}
          style={{
            width: '100%',
            backgroundColor: 'transparent',
            color: '#6b7280',
            border: 'none',
            padding: '0.75rem',
            fontSize: '0.9rem',
            fontWeight: '500',
            cursor: 'pointer',
            marginTop: '0.5rem'
          }}
        >
          Cancel
        </button>
      )}
    </div>
  );
}
