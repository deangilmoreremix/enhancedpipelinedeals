import React, { useState, useEffect } from 'react';

interface LoadingTimeoutProps {
  timeoutMs?: number;
  message?: string;
}

const PageLoader: React.FC = () => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: '#f7fafc',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
  }}>
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    }}>
      <div style={{
        width: '32px',
        height: '32px',
        border: '3px solid #e2e8f0',
        borderTopColor: '#3182ce',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }} />
      <span style={{ color: '#4a5568', fontSize: '16px' }}>Loading application...</span>
    </div>
    <style>{`
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `}</style>
  </div>
);

export const LoadingTimeout: React.FC<LoadingTimeoutProps> = ({
  timeoutMs = 10000,
  message = "Still loading..."
}) => {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setTimedOut(true);
      console.warn(`[LoadingTimeout] Timeout reached after ${timeoutMs}ms - showing reload option`);
    }, timeoutMs);

    return () => clearTimeout(timer);
  }, [timeoutMs]);

  const handleReload = () => {
    window.location.reload();
  };

  if (!timedOut) {
    return <PageLoader />;
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: '#f7fafc',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      gap: '16px'
    }}>
      <PageLoader />
      <div style={{
        padding: '24px',
        background: 'white',
        borderRadius: '8px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        textAlign: 'center',
        maxWidth: '400px'
      }}>
        <p style={{ color: '#4a5568', marginBottom: '16px' }}>{message}</p>
        <button
          onClick={handleReload}
          style={{
            padding: '10px 24px',
            background: '#3182ce',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#2b6cb0'}
          onMouseLeave={(e) => e.currentTarget.style.background = '#3182ce'}
        >
          Reload Page
        </button>
      </div>
    </div>
  );
};

export default LoadingTimeout;