USE cricket_auction;

-- Tracks whether the NEXT ball to be bowled in this innings is a free hit.
-- Set to TRUE the moment a no-ball is recorded; stays TRUE across any run of
-- further wide/no-ball extras immediately after it, and clears the moment a
-- legal delivery (extra_type = 'none', including byes) is bowled.
ALTER TABLE match_innings
  ADD COLUMN free_hit BOOLEAN NOT NULL DEFAULT FALSE;
