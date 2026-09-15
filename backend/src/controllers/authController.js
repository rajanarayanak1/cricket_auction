const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const signToken = (admin) =>
  jwt.sign({ id: admin.id, username: admin.username }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '12h'
  });

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const [[admin]] = await pool.query('SELECT * FROM admins WHERE username = ?', [username]);

    // Compare against a dummy hash when the username doesn't exist, so the
    // response time doesn't reveal whether the username is valid.
    const hashToCheck = admin ? admin.password_hash : '$2a$10$CwTycUXWue0Thq9StjUM0uJ8h.QqmS.NlLKlNI/1TN.Zt0MJm9dW.';
    const passwordMatches = await bcrypt.compare(password, hashToCheck);

    if (!admin || !passwordMatches) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    res.json({ token: signToken(admin), username: admin.username });
  } catch (err) {
    res.status(500).json({ message: 'Failed to log in', error: err.message });
  }
};

exports.register = async (req, res) => {
  try {
    const { first_name, last_name, email, phone_number, username, password } = req.body;

    if (!first_name || !last_name || !email || !phone_number || !username || !password) {
      return res.status(400).json({
        message: 'First name, last name, email, phone number, username and password are all required'
      });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Please enter a valid email address' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = phone_number.trim();

    const [existing] = await pool.query(
      'SELECT username, email, phone_number FROM admins WHERE username = ? OR email = ? OR phone_number = ?',
      [trimmedUsername, trimmedEmail, trimmedPhone]
    );
    if (existing.some((a) => a.username === trimmedUsername)) {
      return res.status(409).json({ message: 'That username is already taken' });
    }
    if (existing.some((a) => a.email === trimmedEmail)) {
      return res.status(409).json({ message: 'An account with that email already exists' });
    }
    if (existing.some((a) => a.phone_number === trimmedPhone)) {
      return res.status(409).json({ message: 'An account with that phone number already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      `INSERT INTO admins (username, password_hash, first_name, last_name, email, phone_number)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [trimmedUsername, passwordHash, first_name.trim(), last_name.trim(), trimmedEmail, trimmedPhone]
    );

    const admin = { id: result.insertId, username: trimmedUsername };
    res.status(201).json({ token: signToken(admin), username: admin.username });
  } catch (err) {
    // Backstop against a race between the pre-check above and the insert
    // (two registrations for the same username/email/phone landing at once).
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Username, email, or phone number is already registered' });
    }
    res.status(500).json({ message: 'Failed to register', error: err.message });
  }
};
