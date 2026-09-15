USE cricket_auction;

CREATE TABLE IF NOT EXISTS fixtures (
  id INT AUTO_INCREMENT PRIMARY KEY,
  auction_room_id INT NOT NULL,
  fixture_type ENUM('round_robin', 'pool') NOT NULL,
  pool_name VARCHAR(50) DEFAULT NULL,
  match_order INT NOT NULL,
  team1_id INT NOT NULL,
  team2_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_fixtures_room FOREIGN KEY (auction_room_id) REFERENCES auction_rooms(id) ON DELETE CASCADE,
  CONSTRAINT fk_fixtures_team1 FOREIGN KEY (team1_id) REFERENCES teams(id) ON DELETE CASCADE,
  CONSTRAINT fk_fixtures_team2 FOREIGN KEY (team2_id) REFERENCES teams(id) ON DELETE CASCADE
);
