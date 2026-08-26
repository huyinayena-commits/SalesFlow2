PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS month_targets (
  month TEXT PRIMARY KEY CHECK (month GLOB '####-##'),
  target_spd INTEGER NOT NULL DEFAULT 0 CHECK (target_spd >= 0),
  target_akm INTEGER NOT NULL DEFAULT 0 CHECK (target_akm >= 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS daily_sales (
  month TEXT NOT NULL,
  day INTEGER NOT NULL CHECK (day BETWEEN 1 AND 31),
  sales_net INTEGER CHECK (sales_net IS NULL OR sales_net >= 0),
  total_struk INTEGER CHECK (total_struk IS NULL OR total_struk >= 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (month, day),
  FOREIGN KEY (month) REFERENCES month_targets(month) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_daily_sales_month ON daily_sales(month);
