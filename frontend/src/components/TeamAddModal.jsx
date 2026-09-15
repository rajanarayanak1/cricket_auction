import { useEffect, useState } from 'react';
import { TeamsAPI } from '../api/client.js';
import { MAX_PHOTO_SIZE_MB, validatePhotoFile } from '../utils/fileValidation.js';

const emptyTeam = { team_name: '' };

export default function TeamAddModal({ roomId, onCreated, onClose }) {
  const [form, setForm] = useState({ team_name: '', num_players: '' });
  const [logo, setLogo] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [addAnother, setAddAnother] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [logoError, setLogoError] = useState('');
  const [justAdded, setJustAdded] = useState('');

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
    setJustAdded('');
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleLogoChange = (e) => {
    setJustAdded('');
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

      const newTeam = await TeamsAPI.create(roomId, formData);
      onCreated(newTeam);

      if (addAnother) {
        // Team name and logo are team-specific and get cleared, but the
        // roster size is left as-is — tournaments usually give every team
        // the same squad size, so keeping it saves re-typing for each one.
        setJustAdded(form.team_name);
        setForm((prev) => ({ ...emptyTeam, num_players: prev.num_players }));
        setLogo(null);
        setLogoError('');
      } else {
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add team.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card edit-player-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="card-title-row">
            <span className="card-icon-badge">➕</span>
            <h3 style={{ margin: 0 }}>Add Team</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose} type="button">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="edit-player-form">
          {justAdded && (
            <p className="form-success-banner">✅ “{justAdded}” added — add another team below.</p>
          )}

          <div className="edit-player-photo-row">
            <div className="file-preview edit-player-photo-preview">
              {previewUrl ? <img src={previewUrl} alt="Logo preview" /> : '🛡️'}
            </div>
            <div className="edit-player-photo-info">
              <span className="edit-player-photo-label">Team Logo</span>
              <label className="file-upload-btn">
                {logo ? logo.name : 'Choose image…'}
                <input type="file" accept="image/*" onChange={handleLogoChange} style={{ display: 'none' }} />
              </label>
              <span className="hint-text">Max {MAX_PHOTO_SIZE_MB}MB</span>
              {logoError && <span className="error-text">{logoError}</span>}
            </div>
          </div>

          <label className="field">
            Team Name
            <input
              name="team_name"
              placeholder="e.g. Mumbai Warriors"
              value={form.team_name}
              onChange={handleChange}
              required
              autoFocus
            />
          </label>

          <label className="field">
            Number of Players
            <input
              type="number"
              min="1"
              placeholder="15"
              name="num_players"
              value={form.num_players}
              onChange={handleChange}
              required
            />
          </label>

          {error && <p className="error-text">{error}</p>}

          <label className="checkbox-label add-another-checkbox">
            <input type="checkbox" checked={addAnother} onChange={(e) => setAddAnother(e.target.checked)} />
            Add another team after saving
          </label>

          <div className="modal-footer-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              {justAdded ? 'Done' : 'Cancel'}
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving || !form.team_name.trim()}>
              {saving ? 'Saving…' : addAnother ? '💾 Save & Add Another' : '💾 Save Team'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
