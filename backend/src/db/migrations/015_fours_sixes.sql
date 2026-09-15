USE cricket_auction;

ALTER TABLE match_player_stats
  ADD COLUMN fours INT NOT NULL DEFAULT 0,
  ADD COLUMN sixes INT NOT NULL DEFAULT 0;
