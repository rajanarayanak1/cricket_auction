import { useEffect, useState } from 'react';
import { TeamsAPI } from '../api/client.js';
import { MAX_PHOTO_SIZE_MB, validatePhotoFile } from '../utils/fileValidation.js';

export default function TeamEditModal({ roomId, team, boughtCount, locked, onClose, onSaved }) {
  const [form, setForm] = useState({ team_name: team.team_name, num_players: team.num_players });
  const [logo, setLogo] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [logoError, setLogoError] = useState('');

  useEffect(() => {
    if (!logo) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(logo);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [logo]);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0] || null;
    const validationError = validatePhotoFile(file);
    if (validationError) {
      setLogoError(validationError);
      setLogo(null);
      e.target.value = '';
      return;
    }
    setLogoError('');
    setLogo(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('team_name', form.team_name);
      formData.append('num_players', form.num_players);
      if (logo) formData.append('logo', logo);

      const updated = await TeamsAPI.update(roomId, team.id, formData);
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update team.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card edit-player-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="card-title-row">
            <span className="card-icon-badge">✏️</span>
            <h3 style={{ margin: 0 }}>Edit Team</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose} type="button">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="edit-player-form">
          <div className="edit-player-photo-row">
            <div className="file-preview edit-player-photo-preview">
              {previewUrl ? (
                <img src={previewUrl} alt="New logo preview" />
              ) : team.logo_path ? (
                <img src={team.logo_path} alt={team.team_name} />
              ) : (
                '🛡️'
              )}
            </div>
            <div className="edit-player-photo-info">
              <span className="edit-player-photo-label">Team Logo</span>
              <label className="file-upload-btn">
                {logo ? logo.name : 'Change logo…'}
                <input type="file" accept="image/*" onChange={handleLogoChange} style={{ display: 'none' }} />
              </label>
              <span className="hint-text">Max {MAX_PHOTO_SIZE_MB}MB</span>
              {logoError && <span className="error-text">{logoError}</span>}
            </div>
          </div>

          <label className="field">
            Team Name
            <input name="team_name" value={form.team_name} onChange={handleChange} required autoFocus />
          </label>

          <label className="field">
            Number of Players
            <input
              type="number"
              min={boughtCount}
              name="num_players"
              value={form.num_players}
              onChange={handleChange}
              required
              disabled={locked}
            />
          </label>
          {locked && (
            <p className="hint-text" style={{ marginTop: -10 }}>
              🔒 The auction has started — roster size is locked, but the name and logo can still be updated.
            </p>
          )}

          {error && <p className="error-text">{error}</p>}

          <div className="modal-footer-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving || !form.team_name.trim()}>
              {saving ? 'Saving…' : '💾 Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
