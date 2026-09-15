-- Adds live-auction engine support: per-team purse tracking, jersey/kit fields,
-- auction phase + current-bid state, and bid history for undo support.
USE cricket_auction;

ALTER TABLE teams
  ADD COLUMN purse_remaining DECIMAL(14,2) NULL AFTER num_players;

UPDATE teams t
  JOIN auction_rooms r ON r.id = t.auction_room_id
  SET t.purse_remaining = r.purse_value
  WHERE t.purse_remaining IS NULL;

ALTER TABLE players
  ADD COLUMN jersey_number VARCHAR(10) NULL AFTER sold_price,
  ADD COLUMN jersey_size ENUM('XS','S','M','L','XL','XXL','XXXL','4XL') NULL AFTER jersey_number,
  ADD COLUMN sleeve_type ENUM('Full','Half') NULL AFTER jersey_size;

ALTER TABLE auction_rooms
  ADD COLUMN phase ENUM('not_started','captains','icons','normal','completed') NOT NULL DEFAULT 'not_started' AFTER status,
  ADD COLUMN current_player_id INT NULL AFTER phase,
  ADD COLUMN current_bid_amount DECIMAL(14,2) NULL AFTER current_player_id,
  ADD COLUMN current_bid_team_id INT NULL AFTER current_bid_amount,
  ADD COLUMN last_category VARCHAR(20) NULL AFTER current_bid_team_id;

SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = 'cricket_auction' AND CONSTRAINT_NAME = 'fk_room_current_player'
);
SET @sql := IF(@fk_exists = 0,
  'ALTER TABLE auction_rooms ADD CONSTRAINT fk_room_current_player FOREIGN KEY (current_player_id) REFERENCES players(id) ON DELETE SET NULL',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = 'cricket_auction' AND CONSTRAINT_NAME = 'fk_room_current_bid_team'
);
SET @sql := IF(@fk_exists = 0,
  'ALTER TABLE auction_rooms ADD CONSTRAINT fk_room_current_bid_team FOREIGN KEY (current_bid_team_id) REFERENCES teams(id) ON DELETE SET NULL',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS bid_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  auction_room_id INT NOT NULL,
  player_id INT NOT NULL,
  team_id INT NOT NULL,
  bid_amount DECIMAL(14,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_bid_room FOREIGN KEY (auction_room_id) REFERENCES auction_rooms(id) ON DELETE CASCADE,
  CONSTRAINT fk_bid_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  CONSTRAINT fk_bid_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);
