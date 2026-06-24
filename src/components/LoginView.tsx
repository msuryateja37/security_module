import React, { useState } from 'react';
import { User, Lock, AlertCircle, ShieldAlert } from 'lucide-react';

interface LoginViewProps {
  onLoginSuccess: (username: string) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    // Mock API authentication delay for professional feel
    setTimeout(() => {
      if (username.toLowerCase() === 'supervisor' && password === 'password') {
        onLoginSuccess('supervisor');
      } else {
        setError('Invalid username or password. Please try again.');
        setIsLoading(false);
      }
    }, 600);
  };

  return (
    <div className="login-page-container">
      <div className="login-card">
        {/* Government Branding Header */}
        <div className="login-header">
          <div className="login-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: '40px', height: '40px' }}>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="rgba(14, 77, 65, 0.15)" stroke="#003326" />
              <circle cx="12" cy="11" r="3" fill="#31b399" />
              <path d="M12 2v20M2 11h20" stroke="#003326" strokeWidth="0.5" />
            </svg>
          </div>
          <h2 className="login-title">rural development & land reform</h2>
          <span style={{ fontSize: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(255, 255, 255, 0.6)', display: 'block', marginBottom: '0.25rem' }}>
            Department: Rural Development and Land Reform
          </span>
          <span className="login-subtitle">REPUBLIC OF SOUTH AFRICA</span>
        </div>

        {/* Login Credentials Body */}
        <div className="login-body">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#1f2937', marginBottom: '0.5rem', textAlign: 'center' }}>
            CD: Security Services Portal
          </h3>
          <p style={{ fontSize: '0.75rem', color: '#6b7280', textAlign: 'center', marginBottom: '1.5rem' }}>
            Log in to manage and report security incidents, inspections, and audit logs.
          </p>

          {error && (
            <div className="login-error-msg">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Username</label>
              <div className="login-input-wrapper">
                <User className="login-input-icon" size={18} />
                <input
                  type="text"
                  className="login-input"
                  placeholder="Enter username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div className="login-input-wrapper">
                <Lock className="login-input-icon" size={18} />
                <input
                  type="password"
                  className="login-input"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <button type="submit" className="login-btn" disabled={isLoading}>
              {isLoading ? (
                <span>Verifying credentials...</span>
              ) : (
                <>
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>

          {/* User hint matching request */}
          <div style={{ marginTop: '1.5rem', padding: '0.75rem', borderRadius: '6px', background: '#f8f9fa', border: '1px dashed #dee2e6' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', color: '#003326', fontSize: '0.75rem', fontWeight: 600 }}>
              <ShieldAlert size={14} />
              <span>Authorized Personnel Only</span>
            </div>
            <p style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '0.25rem', lineHeight: '1.3' }}>
              Access is restricted to DLRRD security officers. Use credentials <strong>supervisor / password</strong> to continue.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
