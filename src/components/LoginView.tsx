import React, { useState } from 'react';
import { User, Lock, AlertCircle, Eye, EyeOff } from 'lucide-react';
import type { UserProfile } from '../security/roleAccess';
import { getPermissionsForRole, getUserByUsername, ROLE_USERS } from '../security/roleAccess';

interface LoginViewProps {
  onLoginSuccess: (user: UserProfile) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const json = await response.json();

      if (response.ok && json.success && json.data?.user) {
        onLoginSuccess(json.data.user);
        return;
      }

      setError(json.message || 'Invalid username or password. Use one of the role demo accounts below.');
    } catch {
      const user = getUserByUsername(username);

      if (user && password === 'password') {
        onLoginSuccess(user);
      } else {
        setError('Invalid username or password. Use one of the role demo accounts below.');
      }
    } finally {
      setIsLoading(false);
    }
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
          <div className="login-role-hint">
            {ROLE_USERS.map(user => (
              <button
                type="button"
                key={user.id}
                className="login-role-chip"
                onClick={() => {
                  setUsername(user.username);
                  setPassword('password');
                  setError(null);
                }}
                title={`${user.roleLabel}: ${getPermissionsForRole(user.role).join(', ')}`}
              >
                {user.roleLabel}
              </button>
            ))}
          </div>

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
