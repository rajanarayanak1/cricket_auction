-- Adds "reset auction" support: remembers each player's original captain/icon
-- designation so a reset can restore it, since the live is_captain/is_icon
-- flags get unmarked mid-auction once every team has picked one.
USE cricket_auction;

ALTER TABLE players
  ADD COLUMN original_is_captain BOOLEAN NOT NULL DEFAULT FALSE AFTER is_icon,
  ADD COLUMN original_is_icon BOOLEAN NOT NULL DEFAULT FALSE AFTER original_is_captain;

UPDATE players SET original_is_captain = is_captain, original_is_icon = is_icon;
