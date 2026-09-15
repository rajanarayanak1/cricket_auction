USE cricket_auction;

ALTER TABLE auction_rooms
  ADD COLUMN player_of_tournament_id INT DEFAULT NULL,
  ADD CONSTRAINT fk_room_player_of_tournament FOREIGN KEY (player_of_tournament_id) REFERENCES players(id) ON DELETE SET NULL;
