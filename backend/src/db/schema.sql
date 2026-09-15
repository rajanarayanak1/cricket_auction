-- Cricket Auction Application - MySQL Schema
CREATE DATABASE IF NOT EXISTS cricket_auction;
USE cricket_auction;

CREATE TABLE IF NOT EXISTS admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) DEFAULT NULL,
  last_name VARCHAR(100) DEFAULT NULL,
  email VARCHAR(255) DEFAULT NULL UNIQUE,
  phone_number VARCHAR(20) DEFAULT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS auction_rooms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  admin_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  auction_date DATE NOT NULL,
  num_teams INT NOT NULL,
  purse_value DECIMAL(14,2) NOT NULL,
  bid_step_up DECIMAL(14,2) NOT NULL,
  status ENUM('created', 'live', 'completed') NOT NULL DEFAULT 'created',
  phase ENUM('not_started', 'captains', 'icons', 'normal', 'unsold_round', 'completed') NOT NULL DEFAULT 'not_started',
  current_player_id INT DEFAULT NULL,
  current_bid_amount DECIMAL(14,2) DEFAULT NULL,
  current_bid_team_id INT DEFAULT NULL,
  last_category VARCHAR(20) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_auction_rooms_admin FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS players (
  id INT AUTO_INCREMENT PRIMARY KEY,
  auction_room_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  category ENUM('Batsman', 'Bowler', 'All Rounder') NOT NULL,
  base_value DECIMAL(14,2) NOT NULL DEFAULT 1000,
  is_captain BOOLEAN NOT NULL DEFAULT FALSE,
  is_icon BOOLEAN NOT NULL DEFAULT FALSE,
  original_is_captain BOOLEAN NOT NULL DEFAULT FALSE,
  original_is_icon BOOLEAN NOT NULL DEFAULT FALSE,
  auction_status ENUM('pending', 'sold', 'unsold') NOT NULL DEFAULT 'pending',
  unsold_revisited BOOLEAN NOT NULL DEFAULT FALSE,
  team_id INT DEFAULT NULL,
  sold_price DECIMAL(14,2) DEFAULT NULL,
  jersey_number VARCHAR(10) DEFAULT NULL,
  jersey_size ENUM('XS','S','M','L','XL','XXL','XXXL','4XL') DEFAULT NULL,
  sleeve_type ENUM('Full','Half') DEFAULT NULL,
  photo_path VARCHAR(500) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_players_auction_room FOREIGN KEY (auction_room_id)
    REFERENCES auction_rooms(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS teams (
  id INT AUTO_INCREMENT PRIMARY KEY,
  auction_room_id INT NOT NULL,
  team_name VARCHAR(255) NOT NULL,
  logo_path VARCHAR(500) DEFAULT NULL,
  owner_name VARCHAR(255) DEFAULT NULL,
  owner_jersey_number VARCHAR(10) DEFAULT NULL,
  owner_jersey_size ENUM('XS','S','M','L','XL','XXL','XXXL','4XL') DEFAULT NULL,
  num_players INT NOT NULL,
  purse_remaining DECIMAL(14,2) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_teams_auction_room FOREIGN KEY (auction_room_id)
    REFERENCES auction_rooms(id) ON DELETE CASCADE
);

ALTER TABLE players
  ADD CONSTRAINT fk_players_team FOREIGN KEY (team_id)
  REFERENCES teams(id) ON DELETE SET NULL;

ALTER TABLE auction_rooms
  ADD CONSTRAINT fk_room_current_player FOREIGN KEY (current_player_id)
    REFERENCES players(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_room_current_bid_team FOREIGN KEY (current_bid_team_id)
    REFERENCES teams(id) ON DELETE SET NULL;

-- One auction_room can run many tournaments over time, sequentially — only
-- one "ongoing" at a time (enforced in application code, not here: a
-- tournament is ongoing while it has zero fixtures or any non-completed
-- one). Each tournament owns its own fixtures/finalize-lock/POT, replacing
-- what used to live directly on auction_rooms.
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

CREATE TABLE IF NOT EXISTS fixtures (
  id INT AUTO_INCREMENT PRIMARY KEY,
  auction_room_id INT NOT NULL,
  tournament_id INT NOT NULL,
  fixture_type ENUM('round_robin', 'pool') NOT NULL,
  pool_name VARCHAR(50) DEFAULT NULL,
  match_order INT NOT NULL,
  team1_id INT DEFAULT NULL,
  team2_id INT DEFAULT NULL,
  team1_placeholder VARCHAR(100) DEFAULT NULL,
  team2_placeholder VARCHAR(100) DEFAULT NULL,
  stage ENUM('league', 'pool_playoff', 'semifinal', 'final') NOT NULL DEFAULT 'league',
  match_status ENUM('not_started', 'live', 'completed') NOT NULL DEFAULT 'not_started',
  overs_limit INT DEFAULT NULL,
  toss_winner_team_id INT DEFAULT NULL,
  toss_decision ENUM('bat', 'field') DEFAULT NULL,
  current_innings TINYINT DEFAULT NULL,
  winner_team_id INT DEFAULT NULL,
  result_type ENUM('win', 'tie') DEFAULT NULL,
  player_of_match_id INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_fixtures_room FOREIGN KEY (auction_room_id) REFERENCES auction_rooms(id) ON DELETE CASCADE,
  CONSTRAINT fk_fixtures_tournament FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
  CONSTRAINT fk_fixtures_team1 FOREIGN KEY (team1_id) REFERENCES teams(id) ON DELETE CASCADE,
  CONSTRAINT fk_fixtures_team2 FOREIGN KEY (team2_id) REFERENCES teams(id) ON DELETE CASCADE,
  CONSTRAINT fk_fixtures_toss_winner FOREIGN KEY (toss_winner_team_id) REFERENCES teams(id) ON DELETE SET NULL,
  CONSTRAINT fk_fixtures_match_winner FOREIGN KEY (winner_team_id) REFERENCES teams(id) ON DELETE SET NULL,
  CONSTRAINT fk_fixtures_pom FOREIGN KEY (player_of_match_id) REFERENCES players(id) ON DELETE SET NULL
);

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
  opening_striker_id INT DEFAULT NULL,
  opening_non_striker_id INT DEFAULT NULL,
  opening_bowler_id INT DEFAULT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  all_out BOOLEAN NOT NULL DEFAULT FALSE,
  free_hit BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_innings_fixture FOREIGN KEY (fixture_id) REFERENCES fixtures(id) ON DELETE CASCADE,
  CONSTRAINT fk_innings_batting_team FOREIGN KEY (batting_team_id) REFERENCES teams(id) ON DELETE CASCADE,
  CONSTRAINT fk_innings_bowling_team FOREIGN KEY (bowling_team_id) REFERENCES teams(id) ON DELETE CASCADE,
  CONSTRAINT fk_innings_striker FOREIGN KEY (striker_id) REFERENCES players(id) ON DELETE SET NULL,
  CONSTRAINT fk_innings_non_striker FOREIGN KEY (non_striker_id) REFERENCES players(id) ON DELETE SET NULL,
  CONSTRAINT fk_innings_bowler FOREIGN KEY (current_bowler_id) REFERENCES players(id) ON DELETE SET NULL,
  CONSTRAINT fk_innings_last_bowler FOREIGN KEY (last_over_bowler_id) REFERENCES players(id) ON DELETE SET NULL,
  CONSTRAINT fk_innings_opening_striker FOREIGN KEY (opening_striker_id) REFERENCES players(id) ON DELETE SET NULL,
  CONSTRAINT fk_innings_opening_non_striker FOREIGN KEY (opening_non_striker_id) REFERENCES players(id) ON DELETE SET NULL,
  CONSTRAINT fk_innings_opening_bowler FOREIGN KEY (opening_bowler_id) REFERENCES players(id) ON DELETE SET NULL
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
  bye_type ENUM('none', 'bye', 'leg_bye') NOT NULL DEFAULT 'none',
  bye_runs INT NOT NULL DEFAULT 0,
  overthrow_runs INT NOT NULL DEFAULT 0,
  is_wicket BOOLEAN NOT NULL DEFAULT FALSE,
  is_run_out BOOLEAN NOT NULL DEFAULT FALSE,
  run_out_player_id INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ball_innings FOREIGN KEY (innings_id) REFERENCES match_innings(id) ON DELETE CASCADE,
  CONSTRAINT fk_ball_bowler FOREIGN KEY (bowler_id) REFERENCES players(id) ON DELETE CASCADE,
  CONSTRAINT fk_ball_batsman FOREIGN KEY (batsman_id) REFERENCES players(id) ON DELETE CASCADE,
  CONSTRAINT fk_ball_run_out_player FOREIGN KEY (run_out_player_id) REFERENCES players(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS match_player_stats (
  id INT AUTO_INCREMENT PRIMARY KEY,
  innings_id INT NOT NULL,
  player_id INT NOT NULL,
  team_id INT NOT NULL,
  runs_scored INT NOT NULL DEFAULT 0,
  balls_faced INT NOT NULL DEFAULT 0,
  fours INT NOT NULL DEFAULT 0,
  sixes INT NOT NULL DEFAULT 0,
  is_out BOOLEAN NOT NULL DEFAULT FALSE,
  balls_bowled INT NOT NULL DEFAULT 0,
  runs_conceded INT NOT NULL DEFAULT 0,
  wickets_taken INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_stats_innings FOREIGN KEY (innings_id) REFERENCES match_innings(id) ON DELETE CASCADE,
  CONSTRAINT fk_stats_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  UNIQUE KEY uq_innings_player (innings_id, player_id)
);

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
