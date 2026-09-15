import { useState, useEffect } from 'react';
import { MAX_PHOTO_SIZE_MB, validatePhotoFile } from '../utils/fileValidation.js';

const emptyForm = {
  name: '',
  category: 'Batsman',
  base_value: 1000,
  is_captain: false,
  is_icon: false
};

export default function PlayerForm({ onSubmit }) {
  const [form, setForm] = useState(emptyForm);
  const [photo, setPhoto] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
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
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
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
    const formData = new FormData();
    formData.append('name', form.name);
    formData.append('category', form.category);
    formData.append('base_value', form.base_value);
    formData.append('is_captain', form.is_captain);
    formData.append('is_icon', form.is_icon);
    if (photo) formData.append('photo', photo);

    await onSubmit(formData);
    setForm(emptyForm);
    setPhoto(null);
    setPhotoError('');
    e.target.reset();
  };

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <label>
        Player Name
        <input name="name" placeholder="e.g. Rohit Sharma" value={form.name} onChange={handleChange} required />
      </label>
      <label>
        Category
        <select name="category" value={form.category} onChange={handleChange}>
          <option value="Batsman">🏏 Batsman</option>
          <option value="Bowler">🎯 Bowler</option>
          <option value="All Rounder">⭐ All Rounder</option>
        </select>
      </label>
      <label>
        Base Value
        <input type="number" min="0" step="0.01" name="base_value" value={form.base_value} onChange={handleChange} required />
      </label>        
      <label className="checkbox-label">
        <input type="checkbox" name="is_captain" checked={form.is_captain} onChange={handleChange} />
        © Captain
      </label>
      <label className="checkbox-label">
        <input type="checkbox" name="is_icon" checked={form.is_icon} onChange={handleChange} />
        ⭐ Icon Player
      </label>
      <div className="field">
        Profile Picture
        <div className="file-upload">
          <div className="file-upload-row">
            <div className="file-preview">
              {previewUrl ? <img src={previewUrl} alt="Player preview" /> : '🏏'}
            </div>
            <label className="file-upload-btn">
              {photo ? photo.name : 'Choose image…'}
              <input type="file" accept="image/*" onChange={handlePhotoChange} />
            </label>
          </div>
          <span className="hint-text">Max {MAX_PHOTO_SIZE_MB}MB</span>
          {photoError && <span className="error-text">{photoError}</span>}
        </div>
      </div>
      <button type="submit" className="btn btn-primary">➕ Add Player</button>
    </form>
  );
}
