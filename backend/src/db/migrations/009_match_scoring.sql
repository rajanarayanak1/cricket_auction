USE cricket_auction;

ALTER TABLE fixtures
  ADD COLUMN match_status ENUM('not_started', 'live', 'completed') NOT NULL DEFAULT 'not_started',
  ADD COLUMN overs_limit INT DEFAULT NULL,
  ADD COLUMN toss_winner_team_id INT DEFAULT NULL,
  ADD COLUMN toss_decision ENUM('bat', 'field') DEFAULT NULL,
  ADD COLUMN current_innings TINYINT DEFAULT NULL,
  ADD COLUMN winner_team_id INT DEFAULT NULL,
  ADD COLUMN result_type ENUM('win', 'tie') DEFAULT NULL,
  ADD COLUMN player_of_match_id INT DEFAULT NULL,
  ADD CONSTRAINT fk_fixtures_toss_winner FOREIGN KEY (toss_winner_team_id) REFERENCES teams(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_fixtures_match_winner FOREIGN KEY (winner_team_id) REFERENCES teams(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_fixtures_pom FOREIGN KEY (player_of_match_id) REFERENCES players(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS match_innings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  fixture_id INT NOT NULL,
  innings_number TINYINT NOT NULL,
  batting_team_id INT NOT NULL,
  bowling_team_id INT NOT NULL,
  overs_limit INT NOT NULL,
  target INT DEFAULT NULL,
  total_runs INT NOT NULL DEFAULT 0,
  total_wickets INT NOT NULL DEFAULT 0,
  total_balls INT NOT NULL DEFAULT 0,
  extras INT NOT NULL DEFAULT 0,
  balls_in_current_over INT NOT NULL DEFAULT 0,
  striker_id INT DEFAULT NULL,
  non_striker_id INT DEFAULT NULL,
  current_bowler_id INT DEFAULT NULL,
  last_over_bowler_id INT DEFAULT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  all_out BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_innings_fixture FOREIGN KEY (fixture_id) REFERENCES fixtures(id) ON DELETE CASCADE,
  CONSTRAINT fk_innings_batting_team FOREIGN KEY (batting_team_id) REFERENCES teams(id) ON DELETE CASCADE,
  CONSTRAINT fk_innings_bowling_team FOREIGN KEY (bowling_team_id) REFERENCES teams(id) ON DELETE CASCADE,
  CONSTRAINT fk_innings_striker FOREIGN KEY (striker_id) REFERENCES players(id) ON DELETE SET NULL,
  CONSTRAINT fk_innings_non_striker FOREIGN KEY (non_striker_id) REFERENCES players(id) ON DELETE SET NULL,
  CONSTRAINT fk_innings_bowler FOREIGN KEY (current_bowler_id) REFERENCES players(id) ON DELETE SET NULL,
  CONSTRAINT fk_innings_last_bowler FOREIGN KEY (last_over_bowler_id) REFERENCES players(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS match_balls (
  id INT AUTO_INCREMENT PRIMARY KEY,
  innings_id INT NOT NULL,
  over_number INT NOT NULL,
  ball_in_over INT NOT NULL,
  bowler_id INT NOT NULL,
  batsman_id INT NOT NULL,
  runs INT NOT NULL DEFAULT 0,
  extra_type ENUM('none', 'wide', 'no_ball') NOT NULL DEFAULT 'none',
  extra_runs INT NOT NULL DEFAULT 0,
  is_wicket BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ball_innings FOREIGN KEY (innings_id) REFERENCES match_innings(id) ON DELETE CASCADE,
  CONSTRAINT fk_ball_bowler FOREIGN KEY (bowler_id) REFERENCES players(id) ON DELETE CASCADE,
  CONSTRAINT fk_ball_batsman FOREIGN KEY (batsman_id) REFERENCES players(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS match_player_stats (
  id INT AUTO_INCREMENT PRIMARY KEY,
  innings_id INT NOT NULL,
  player_id INT NOT NULL,
  team_id INT NOT NULL,
  runs_scored INT NOT NULL DEFAULT 0,
  balls_faced INT NOT NULL DEFAULT 0,
  is_out BOOLEAN NOT NULL DEFAULT FALSE,
  balls_bowled INT NOT NULL DEFAULT 0,
  runs_conceded INT NOT NULL DEFAULT 0,
  wickets_taken INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_stats_innings FOREIGN KEY (innings_id) REFERENCES match_innings(id) ON DELETE CASCADE,
  CONSTRAINT fk_stats_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  UNIQUE KEY uq_innings_player (innings_id, player_id)
);
