// Creates (or updates the password for) an admin account.
// Usage: node scripts/seedAdmin.js <username> <password>
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../src/config/db');

async function main() {
  const [username, password] = process.argv.slice(2);

  if (!username || !password) {
    console.error('Usage: node scripts/seedAdmin.js <username> <password>');
    process.exitCode = 1;
    return;
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exitCode = 1;
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await pool.query(
    `INSERT INTO admins (username, password_hash) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE password_hash = ?`,
    [username, passwordHash, passwordHash]
  );

  console.log(`Admin "${username}" is ready.`);
}

main()
  .catch((err) => {
    console.error('Failed to seed admin:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
