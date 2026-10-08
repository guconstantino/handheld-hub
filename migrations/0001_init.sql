-- Handheld Hub: catálogo de jogos por console e por local de armazenamento.

CREATE TABLE devices (
  id         TEXT PRIMARY KEY,          -- s20fe, miyoo, switch, drive
  name       TEXT NOT NULL,
  kind       TEXT NOT NULL,             -- console | backup
  accent     TEXT,                      -- cor do card no portal
  specs      TEXT NOT NULL DEFAULT '{}',-- JSON livre (chip, SO, emuladores...)
  notes      TEXT,
  updated_at TEXT
);

CREATE TABLE locations (
  id         TEXT PRIMARY KEY,          -- s20-sd, s20-int, drive-plataform...
  device_id  TEXT NOT NULL REFERENCES devices(id),
  label      TEXT NOT NULL,
  root       TEXT NOT NULL,             -- caminho base no device
  last_scan  TEXT,
  free_bytes INTEGER,
  total_bytes INTEGER
);

CREATE TABLE files (
  id          INTEGER PRIMARY KEY,
  location_id TEXT NOT NULL REFERENCES locations(id),
  system      TEXT NOT NULL,            -- sistema canônico (snes, megadrive, ps2...)
  folder      TEXT NOT NULL,            -- pasta original (snesbr, megadrivebr...)
  rel_path    TEXT NOT NULL,
  title       TEXT NOT NULL,            -- nome do arquivo sem extensão
  game_key    TEXT NOT NULL,            -- sistema|título normalizado, agrupa cópias
  ext         TEXT,
  size        INTEGER,
  mtime       INTEGER,
  status      TEXT NOT NULL DEFAULT 'unknown', -- ok | corrupted | unknown
  scanned_at  TEXT NOT NULL,
  UNIQUE (location_id, rel_path)
);

CREATE INDEX idx_files_game   ON files(game_key);
CREATE INDEX idx_files_system ON files(system);
CREATE INDEX idx_files_status ON files(status);
