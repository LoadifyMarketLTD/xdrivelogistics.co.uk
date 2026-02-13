'use client';

import ProtectedRoute from '../components/ProtectedRoute';
import { useAuth } from '../components/AuthContext';

export default function MobilePage() {
  const { user, logout } = useAuth();

  const tiles = [
    { id: 'active', label: 'Active Jobs', icon: '🚚', color: '#10b981' },
    { id: 'pickup', label: 'Pickup', icon: '📦', color: '#f59e0b' },
    { id: 'delivery', label: 'Delivery', icon: '✅', color: '#3b82f6' },
    { id: 'history', label: 'History', icon: '📋', color: '#6366f1' },
  ];

  const handleTileClick = (tileId: string) => {
    console.log(`Tile clicked: ${tileId}`);
    alert(`${tileId} - Coming soon!`);
  };

  return (
    <ProtectedRoute>
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f3f4f6',
        padding: 0
      }}>
        {/* Header */}
        <header style={{
          backgroundColor: '#2563eb',
          color: 'white',
          padding: '1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
        }}>
          <div>
            <h1 style={{
              fontSize: '1.25rem',
              fontWeight: '700',
              margin: 0
            }}>
              Mobile Ops
            </h1>
            <p style={{
              fontSize: '0.85rem',
              margin: '0.25rem 0 0 0',
              opacity: 0.9
            }}>
              {user?.email}
            </p>
          </div>
          <button
            onClick={logout}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              color: 'white',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              fontSize: '0.9rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseDown={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.3)'}
            onMouseUp={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'}
          >
            Logout
          </button>
        </header>

        {/* Main Content */}
        <div style={{
          padding: '1rem',
          maxWidth: '600px',
          margin: '0 auto'
        }}>
          {/* Welcome Message */}
          <div style={{
            backgroundColor: 'white',
            padding: '1rem',
            borderRadius: '8px',
            marginBottom: '1.5rem',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}>
            <p style={{
              margin: 0,
              fontSize: '1rem',
              color: '#374151',
              textAlign: 'center'
            }}>
              Welcome! Select an option below to get started.
            </p>
          </div>

          {/* 2x2 Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '1rem'
          }}>
            {tiles.map((tile) => (
              <button
                key={tile.id}
                onClick={() => handleTileClick(tile.id)}
                style={{
                  backgroundColor: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '2rem 1rem',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                  transition: 'all 0.2s',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.75rem',
                  minHeight: '150px',
                  position: 'relative'
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = 'scale(0.95)';
                  e.currentTarget.style.boxShadow = '0 1px 4px rgba(0, 0, 0, 0.1)';
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
                }}
              >
                <div style={{
                  fontSize: '3rem',
                  lineHeight: 1
                }}>
                  {tile.icon}
                </div>
                <div style={{
                  fontSize: '1.1rem',
                  fontWeight: '600',
                  color: '#1f2937',
                  textAlign: 'center'
                }}>
                  {tile.label}
                </div>
                <div style={{
                  position: 'absolute',
                  bottom: '0.5rem',
                  width: '60%',
                  height: '3px',
                  backgroundColor: tile.color,
                  borderRadius: '2px'
                }}></div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
