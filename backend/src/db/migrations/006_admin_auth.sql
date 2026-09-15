-- Adds admin accounts for authentication. Passwords are stored as bcrypt
-- hashes, never in plain text. Admins are provisioned via the seed script
-- (backend/scripts/seedAdmin.js) — there is no public self-registration.
USE cricket_auction;

CREATE TABLE IF NOT EXISTS admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
