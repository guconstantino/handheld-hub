-- Link do Drive por arquivo e capa por jogo.

-- ID do arquivo (ou da pasta, em jogos-pasta) no Google Drive, lido do xattr do Drive para Desktop.
-- Vira https://drive.google.com/file/d/<id>/view (arquivo) ou /drive/folders/<id> (pasta).
ALTER TABLE files ADD COLUMN drive_id TEXT;

-- Capa de cada jogo, servida como asset estático em /covers/<file>.
CREATE TABLE covers (
  game_key   TEXT PRIMARY KEY,
  file       TEXT NOT NULL,              -- nome do .webp em public/covers/
  source     TEXT NOT NULL,              -- libretro | daijisho | onion
  updated_at TEXT NOT NULL
);
