ALTER TABLE exposures
  DROP COLUMN report_type;

ALTER TABLE exposures  
  ADD COLUMN report_type INT NOT NULL DEFAULT 1;
  