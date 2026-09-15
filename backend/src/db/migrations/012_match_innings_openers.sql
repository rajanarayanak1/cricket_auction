USE cricket_auction;

ALTER TABLE match_innings
  ADD COLUMN opening_striker_id INT DEFAULT NULL,
  ADD COLUMN opening_non_striker_id INT DEFAULT NULL,
  ADD COLUMN opening_bowler_id INT DEFAULT NULL;

ALTER TABLE match_innings
  ADD CONSTRAINT fk_innings_opening_striker FOREIGN KEY (opening_striker_id) REFERENCES players(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_innings_opening_non_striker FOREIGN KEY (opening_non_striker_id) REFERENCES players(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_innings_opening_bowler FOREIGN KEY (opening_bowler_id) REFERENCES players(id) ON DELETE SET NULL;
