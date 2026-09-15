USE cricket_auction;

ALTER TABLE fixtures
  MODIFY COLUMN team1_id INT DEFAULT NULL,
  MODIFY COLUMN team2_id INT DEFAULT NULL,
  ADD COLUMN team1_placeholder VARCHAR(100) DEFAULT NULL,
  ADD COLUMN team2_placeholder VARCHAR(100) DEFAULT NULL,
  ADD COLUMN stage ENUM('league', 'pool_playoff', 'semifinal', 'final') NOT NULL DEFAULT 'league';
