USE cricket_auction;

ALTER TABLE teams
  ADD COLUMN owner_name VARCHAR(255) DEFAULT NULL;
