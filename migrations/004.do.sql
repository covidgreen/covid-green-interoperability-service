CREATE TABLE IF NOT EXISTS metrics (
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  event TEXT NOT NULL,
  region TEXT NOT NULL,
  value INT DEFAULT 0,
  PRIMARY KEY (date, event, region)
);
