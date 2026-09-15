const bcrypt = require('bcryptjs');
const pool = require('../config/db');

const toProfile = (admin) => ({
  id: admin.id,
  username: admin.username,
  first_name: admin.first_name,
  last_name: admin.last_name,
  email: admin.email,
  phone_number: admin.phone_number,
  created_at: admin.created_at
});

exports.getProfile = async (req, res) => {
  try {
    const [[admin]] = await pool.query('SELECT * FROM admins WHERE id = ?', [req.admin.id]);
    if (!admin) return res.status(404).json({ message: 'Admin not found' });
    res.json(toProfile(admin));
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch profile', error: err.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { first_name, last_name, email, phone_number } = req.body;

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Please enter a valid email address' });
    }

    await pool.query(
      'UPDATE admins SET first_name = ?, last_name = ?, email = ?, phone_number = ? WHERE id = ?',
      [
        (first_name || '').trim() || null,
        (last_name || '').trim() || null,
        (email || '').trim() || null,
        (phone_number || '').trim() || null,
        req.admin.id
      ]
    );

    const [[admin]] = await pool.query('SELECT * FROM admins WHERE id = ?', [req.admin.id]);
    res.json(toProfile(admin));
  } catch (err) {
    res.status(500).json({ message: 'Failed to update profile', error: err.message });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    const [[admin]] = await pool.query('SELECT * FROM admins WHERE id = ?', [req.admin.id]);
    const matches = await bcrypt.compare(current_password, admin.password_hash);
    if (!matches) {
      // 400, not 401 — a wrong current-password is a bad request body, not
      // an expired session. The client's response interceptor treats any
      // 401 as "session expired" and force-logs-out, which would wrongly
      // kick the admin out to /login on a simple typo here.
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    const newHash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE admins SET password_hash = ? WHERE id = ?', [newHash, req.admin.id]);
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to change password', error: err.message });
  }
};
