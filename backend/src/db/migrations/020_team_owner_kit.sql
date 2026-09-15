USE cricket_auction;

ALTER TABLE teams
  ADD COLUMN owner_jersey_number VARCHAR(10) DEFAULT NULL,
  ADD COLUMN owner_jersey_size ENUM('XS','S','M','L','XL','XXL','XXXL','4XL') DEFAULT NULL;
