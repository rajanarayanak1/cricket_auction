import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminAPI } from '../api/client.js';

const emptyProfile = { first_name: '', last_name: '', email: '', phone_number: '' };
const emptyPasswordForm = { current_password: '', new_password: '', confirm_password: '' };

export default function ProfilePage() {
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [profile, setProfile] = useState(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');

  const [passwordForm, setPasswordForm] = useState(emptyPasswordForm);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  useEffect(() => {
    AdminAPI.getProfile()
      .then((data) => {
        setUsername(data.username);
        setProfile({
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          email: data.email || '',
          phone_number: data.phone_number || ''
        });
      })
      .catch(() => setProfileError('Failed to load your profile.'))
      .finally(() => setLoading(false));
  }, []);

  const handleProfileChange = (e) => {
    setProfile({ ...profile, [e.target.name]: e.target.value });
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');
    setSavingProfile(true);
    try {
      await AdminAPI.updateProfile(profile);
      setProfileSuccess('Profile updated successfully.');
    } catch (err) {
      setProfileError(err.response?.data?.message || 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordChange = (e) => {
    setPasswordForm({ ...passwordForm, [e.target.name]: e.target.value });
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    setChangingPassword(true);
    try {
      await AdminAPI.changePassword({
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password
      });
      setPasswordSuccess('Password changed successfully.');
      setPasswordForm(emptyPasswordForm);
    } catch (err) {
      setPasswordError(err.response?.data?.message || 'Failed to change password.');
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="page">
        <div className="skeleton-card" style={{ height: 220 }} />
      </div>
    );
  }

  return (
    <div className="page">
      <button className="link-btn back-link" onClick={() => navigate('/dashboard')}>← Back to Dashboard</button>

      <section className="card room-summary">
        <div className="card-title-row">
          <span className="card-icon-badge">👤</span>
          <h2 style={{ margin: 0 }}>My Profile</h2>
        </div>
        <p className="hint-text" style={{ marginTop: 6 }}>Signed in as <strong>{username}</strong></p>
      </section>

      <section className="card">
        <div className="card-title-row" style={{ marginBottom: 18 }}>
          <span className="card-icon-badge">📇</span>
          <h3 style={{ margin: 0 }}>Basic Details</h3>
        </div>
        <form className="form-grid" onSubmit={handleProfileSubmit}>
          <label>
            First Name
            <input name="first_name" placeholder="e.g. Jordan" value={profile.first_name} onChange={handleProfileChange} />
          </label>
          <label>
            Last Name
            <input name="last_name" placeholder="e.g. Smith" value={profile.last_name} onChange={handleProfileChange} />
          </label>
          <label>
            Email
            <input type="email" name="email" placeholder="e.g. jordan@example.com" value={profile.email} onChange={handleProfileChange} />
          </label>
          <label>
            Phone Number
            <input type="tel" name="phone_number" placeholder="e.g. 9876543210" value={profile.phone_number} onChange={handleProfileChange} />
          </label>
          <button type="submit" className="btn btn-accent" disabled={savingProfile}>
            {savingProfile ? 'Saving…' : '💾 Save Details'}
          </button>
        </form>
        {profileSuccess && <p className="form-success-banner" style={{ marginTop: 14 }}>{profileSuccess}</p>}
        {profileError && <p className="error-text" style={{ marginTop: 14 }}>{profileError}</p>}
      </section>

      <section className="card">
        <div className="card-title-row" style={{ marginBottom: 18 }}>
          <span className="card-icon-badge">🔒</span>
          <h3 style={{ margin: 0 }}>Change Password</h3>
        </div>
        <form className="form-grid" onSubmit={handlePasswordSubmit}>
          <label>
            Current Password
            <input
              type="password"
              name="current_password"
              value={passwordForm.current_password}
              onChange={handlePasswordChange}
              autoComplete="current-password"
              required
            />
          </label>
          <label>
            New Password
            <input
              type="password"
              name="new_password"
              value={passwordForm.new_password}
              onChange={handlePasswordChange}
              autoComplete="new-password"
              minLength={6}
              required
            />
          </label>
          <label>
            Confirm New Password
            <input
              type="password"
              name="confirm_password"
              value={passwordForm.confirm_password}
              onChange={handlePasswordChange}
              autoComplete="new-password"
              minLength={6}
              required
            />
          </label>
          <button type="submit" className="btn btn-secondary" disabled={changingPassword}>
            {changingPassword ? 'Updating…' : '🔑 Update Password'}
          </button>
        </form>
        {passwordSuccess && <p className="form-success-banner" style={{ marginTop: 14 }}>{passwordSuccess}</p>}
        {passwordError && <p className="error-text" style={{ marginTop: 14 }}>{passwordError}</p>}
      </section>
    </div>
  );
}
