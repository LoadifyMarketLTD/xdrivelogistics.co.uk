'use client';

import { useEffect } from 'react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, type = 'success', onClose, duration = 3000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const backgroundColor = type === 'success' ? '#1E7A3E' : type === 'error' ? '#dc2626' : '#2563eb';

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '80px',
        right: '20px',
        backgroundColor,
        color: 'white',
        padding: '16px 24px',
        borderRadius: '10px',
        boxShadow: '0 14px 40px rgba(10,40,90,0.3)',
        zIndex: 9999,
        maxWidth: '320px',
        animation: 'slideIn 0.3s ease-out',
        fontWeight: 500,
      }}
      onClick={onClose}
      role="alert"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '18px' }}>
          {type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}
        </span>
        <span>{message}</span>
      </div>
      <style jsx>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
