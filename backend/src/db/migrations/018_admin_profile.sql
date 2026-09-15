-- Adds editable profile fields to admin accounts, surfaced on the new
-- Profile page (first/last name, email, phone). All nullable since existing
-- admins never filled these in.
USE cricket_auction;

ALTER TABLE admins
  ADD COLUMN first_name VARCHAR(100) DEFAULT NULL,
  ADD COLUMN last_name VARCHAR(100) DEFAULT NULL,
  ADD COLUMN email VARCHAR(255) DEFAULT NULL,
  ADD COLUMN phone_number VARCHAR(20) DEFAULT NULL;
