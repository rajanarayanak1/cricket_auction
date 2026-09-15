USE cricket_auction;

ALTER TABLE match_balls
  ADD COLUMN bye_type ENUM('none', 'bye', 'leg_bye') NOT NULL DEFAULT 'none',
  ADD COLUMN bye_runs INT NOT NULL DEFAULT 0,
  ADD COLUMN overthrow_runs INT NOT NULL DEFAULT 0,
  ADD COLUMN is_run_out BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN run_out_player_id INT DEFAULT NULL;

ALTER TABLE match_balls
  ADD CONSTRAINT fk_ball_run_out_player FOREIGN KEY (run_out_player_id) REFERENCES players(id) ON DELETE SET NULL;
