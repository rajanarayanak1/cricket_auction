-- Adds "mark unsold" support: an unsold player goes back into the pool and
-- gets one further offer in a dedicated "unsold_round" once the main pool
-- (captains -> icons -> normal) is exhausted. unsold_revisited distinguishes
-- "unsold, waiting for its second offer" from "unsold twice, permanently
-- skipped" so the round can never loop forever on an unaffordable player.
USE cricket_auction;

ALTER TABLE players
  ADD COLUMN auction_status ENUM('pending', 'sold', 'unsold') NOT NULL DEFAULT 'pending' AFTER original_is_icon,
  ADD COLUMN unsold_revisited BOOLEAN NOT NULL DEFAULT FALSE AFTER auction_status;

UPDATE players SET auction_status = 'sold' WHERE team_id IS NOT NULL;

ALTER TABLE auction_rooms
  MODIFY COLUMN phase ENUM('not_started', 'captains', 'icons', 'normal', 'unsold_round', 'completed') NOT NULL DEFAULT 'not_started';
