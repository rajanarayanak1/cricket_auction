import { useEffect, useState } from 'react';
import { PlayersAPI } from '../api/client.js';
import { getCategoryMeta, getInitials } from '../utils/categoryMeta.js';
import { MAX_PHOTO_SIZE_MB, validatePhotoFile } from '../utils/fileValidation.js';

const CATEGORIES = ['Batsman', 'Bowler', 'All Rounder'];

export default function PlayerEditModal({ roomId, player, onClose, onSaved, photoOnly = false }) {
  const [form, setForm] = useState({
    name: player.name,
    category: player.category,
    base_value: player.base_value,
    is_captain: !!player.is_captain,
    is_icon: !!player.is_icon
  });
  const [photo, setPhoto] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [photoError, setPhotoError] = useState('');

  useEffect(() => {
    if (!photo) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0] || null;
    const validationError = validatePhotoFile(file);
    if (validationError) {
      setPhotoError(validationError);
      setPhoto(null);
      e.target.value = '';
      return;
    }
    setPhotoError('');
    setPhoto(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('name', form.name);
      formData.append('category', form.category);
      formData.append('base_value', form.base_value);
      formData.append('is_captain', form.is_captain);
      formData.append('is_icon', form.is_icon);
      if (photo) formData.append('photo', photo);

      const updated = await PlayersAPI.update(roomId, player.id, formData);
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update player.');
    } finally {
      setSaving(false);
    }
  };

  const meta = getCategoryMeta(form.category);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card edit-player-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="card-title-row">
            <span className="card-icon-badge">{photoOnly ? '📷' : '✏️'}</span>
            <h3 style={{ margin: 0 }}>{photoOnly ? 'Update Photo' : 'Edit Player'}</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose} type="button">✕</button>
        </div>

        {photoOnly && (
          <p className="hint-text" style={{ marginTop: -8, marginBottom: 16 }}>
            🔒 The auction is already underway, so other details are locked — you can still update the photo.
          </p>
        )}

        <form onSubmit={handleSubmit} className="edit-player-form">
          <div className="edit-player-photo-row">
            <div className="file-preview edit-player-photo-preview">
              {previewUrl ? (
                <img src={previewUrl} alt="New preview" />
              ) : player.photo_path ? (
                <img src={player.photo_path} alt={player.name} />
              ) : (
                <span className={`avatar ${meta.avatar}`} style={{ width: '100%', height: '100%' }}>
                  {getInitials(form.name || player.name)}
                </span>
              )}
            </div>
            <div className="edit-player-photo-info">
              <span className="edit-player-photo-label">Profile Picture</span>
              <label className="file-upload-btn">
                {photo ? photo.name : 'Change photo…'}
                <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />
              </label>
              <span className="hint-text">Max {MAX_PHOTO_SIZE_MB}MB</span>
              {photoError && <span className="error-text">{photoError}</span>}
            </div>
          </div>

          <label className="field">
            Player Name
            <input name="name" value={form.name} onChange={handleChange} required autoFocus={!photoOnly} disabled={photoOnly} />
          </label>

          <div className="edit-player-grid-2">
            <label className="field">
              Category
              <select name="category" value={form.category} onChange={handleChange} disabled={photoOnly}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="field">
              Base Value
              <input
                type="number"
                min="0"
                step="0.01"
                name="base_value"
                value={form.base_value}
                onChange={handleChange}
                required
                disabled={photoOnly}
              />
            </label>
          </div>

          <div className="edit-player-grid-2">
            <label className="checkbox-label">
              <input type="checkbox" name="is_captain" checked={form.is_captain} onChange={handleChange} disabled={photoOnly} />
              © Captain
            </label>
            <label className="checkbox-label">
              <input type="checkbox" name="is_icon" checked={form.is_icon} onChange={handleChange} disabled={photoOnly} />
              ⭐ Icon Player
            </label>
          </div>

          {error && <p className="error-text">{error}</p>}

          <div className="modal-footer-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving || !form.name.trim() || (photoOnly && !photo)}
            >
              {saving ? 'Saving…' : '💾 Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
