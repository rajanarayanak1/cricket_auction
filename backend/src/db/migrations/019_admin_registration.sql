-- Opens up admin signup (previously admins were only provisioned via
-- scripts/seedAdmin.js). Adds uniqueness on email/phone so no two admins can
-- register with the same contact details, and gives auction_rooms an owner
-- so each admin only sees their own auctions/tournaments.
USE cricket_auction;

ALTER TABLE admins
  ADD UNIQUE KEY uq_admins_email (email),
  ADD UNIQUE KEY uq_admins_phone (phone_number);

ALTER TABLE auction_rooms ADD COLUMN admin_id INT NULL;

-- Backfill: every pre-existing room (created back when there was only ever
-- one admin account) is assigned to the earliest admin.
UPDATE auction_rooms
SET admin_id = (SELECT id FROM admins ORDER BY id LIMIT 1)
WHERE admin_id IS NULL;

ALTER TABLE auction_rooms
  MODIFY COLUMN admin_id INT NOT NULL,
  ADD CONSTRAINT fk_auction_rooms_admin FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE;
