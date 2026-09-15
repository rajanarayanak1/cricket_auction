-- Adds a profile photo per player, shown on the live auction page.
USE cricket_auction;

ALTER TABLE players
  ADD COLUMN photo_path VARCHAR(500) DEFAULT NULL AFTER sleeve_type;
