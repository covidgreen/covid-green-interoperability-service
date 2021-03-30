ALTER TABLE exposures
  RENAME COLUMN test_type TO report_type;

ALTER TABLE exposures  
  ADD COLUMN test_type INT NOT NULL DEFAULT 1;
  