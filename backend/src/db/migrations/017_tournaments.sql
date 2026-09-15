USE cricket_auction;

CREATE TABLE IF NOT EXISTS tournaments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  auction_room_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  fixtures_finalized BOOLEAN NOT NULL DEFAULT FALSE,
  player_of_tournament_id INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tournaments_room FOREIGN KEY (auction_room_id) REFERENCES auction_rooms(id) ON DELETE CASCADE,
  CONSTRAINT fk_tournaments_pot FOREIGN KEY (player_of_tournament_id) REFERENCES players(id) ON DELETE SET NULL,
  CONSTRAINT uq_tournaments_room_name UNIQUE (auction_room_id, name)
);

ALTER TABLE fixtures ADD COLUMN tournament_id INT NULL;

-- Backfill: every room that already has fixtures gets one synthetic
-- "Tournament 1" wrapping its existing schedule, carrying over its current
-- fixtures_finalized/player_of_tournament_id so nothing existing breaks.
INSERT INTO tournaments (auction_room_id, name, fixtures_finalized, player_of_tournament_id)
SELECT r.id, 'Tournament 1', r.fixtures_finalized, r.player_of_tournament_id
FROM auction_rooms r
WHERE EXISTS (SELECT 1 FROM fixtures f WHERE f.auction_room_id = r.id);

UPDATE fixtures f
JOIN tournaments t ON t.auction_room_id = f.auction_room_id AND t.name = 'Tournament 1'
SET f.tournament_id = t.id
WHERE f.tournament_id IS NULL;

ALTER TABLE fixtures
  MODIFY COLUMN tournament_id INT NOT NULL,
  ADD CONSTRAINT fk_fixtures_tournament FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE;

ALTER TABLE auction_rooms
  DROP FOREIGN KEY fk_room_player_of_tournament,
  DROP COLUMN player_of_tournament_id,
  DROP COLUMN fixtures_finalized;
