import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthAPI } from '../api/client.js';
import { setToken } from '../utils/auth.js';

const emptyForm = {
  first_name: '',
  last_name: '',
  email: '',
  phone_number: '',
  username: '',
  password: '',
  confirm_password: ''
};

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirm_password) {
      setError('Password and confirmation do not match.');
      return;
    }

    setLoading(true);
    try {
      const { token } = await AuthAPI.register({
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        phone_number: form.phone_number,
        username: form.username,
        password: form.password
      });
      setToken(token);
      window.location.href = '/dashboard';
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to register.');
      setLoading(false);
    }
  };

  return (
    <div className="page" style={{ maxWidth: 640, margin: '0 auto' }}>
      <section className="card">
        <div className="login-brand" style={{ marginBottom: 24 }}>
          <span className="app-brand-icon">🏏</span>
          <div>
            <h1 className="login-title">Create Admin Account</h1>
            <p className="login-subtitle">Register to create and manage your own auctions &amp; tournaments</p>
          </div>
        </div>

        <form className="form-grid" onSubmit={handleSubmit}>
          <label className="field">
            First Name
            <input name="first_name" value={form.first_name} onChange={handleChange} required autoFocus />
          </label>
          <label className="field">
            Last Name
            <input name="last_name" value={form.last_name} onChange={handleChange} required />
          </label>
          <label className="field">
            Email
            <input type="email" name="email" value={form.email} onChange={handleChange} required autoComplete="email" />
          </label>
          <label className="field">
            Phone Number
            <input type="tel" name="phone_number" value={form.phone_number} onChange={handleChange} required autoComplete="tel" />
          </label>
          <label className="field">
            Username
            <input name="username" value={form.username} onChange={handleChange} required autoComplete="username" />
          </label>
          <label className="field">
            Password
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </label>
          <label className="field">
            Confirm Password
            <input
              type="password"
              name="confirm_password"
              value={form.confirm_password}
              onChange={handleChange}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </label>

          {error && <p className="error-text">{error}</p>}

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Creating account…' : '✨ Create Account'}
          </button>
        </form>

        <p className="hint-text" style={{ marginTop: 18, textAlign: 'center' }}>
          Already have an account?{' '}
          <button type="button" className="link-btn" onClick={() => navigate('/login')}>
            Sign in
          </button>
        </p>
      </section>
    </div>
  );
}
