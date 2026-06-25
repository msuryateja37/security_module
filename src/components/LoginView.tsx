import React, { useState } from 'react';
import { User, Lock, AlertCircle, Eye, EyeOff } from 'lucide-react';

interface LoginViewProps {
  onLoginSuccess: (username: string) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
            <img src="/short_logo.png" alt="DLRRD Logo" />
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
                  type={showPassword ? "text" : "password"}
                  className="login-input"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingRight: '2.5rem' }}
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
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


        </div>
      </div>
    </div>
  );
};
