USE cricket_auction;

ALTER TABLE auction_rooms
  ADD COLUMN fixtures_finalized BOOLEAN NOT NULL DEFAULT FALSE;
