import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthAPI } from '../api/client.js';
import { setToken } from '../utils/auth.js';

export default function LoginModal({ onClose }) {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token } = await AuthAPI.login(username, password);
      setToken(token);
      window.location.href = '/dashboard';
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to log in.');
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card login-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-btn login-modal-close" onClick={onClose} aria-label="Close">✕</button>

        <div className="login-brand">
          <span className="app-brand-icon">🏏</span>
          <div>
            <h1 className="login-title">Cricket Auction</h1>
            <p className="login-subtitle">Admin sign in</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <label className="field">
            Username
            <input
              name="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
              autoComplete="username"
            />
          </label>
          <label className="field">
            Password
            <input
              type="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>

          {error && <p className="error-text">{error}</p>}

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Signing in…' : '🔐 Sign In'}
          </button>
        </form>

        <p className="hint-text" style={{ marginTop: 16, textAlign: 'center' }}>
          New here?{' '}
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              onClose();
              navigate('/register');
            }}
          >
            Create an account
          </button>
        </p>
      </div>
    </div>
  );
}
