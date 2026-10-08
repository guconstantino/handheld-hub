# LEARNINGS

Pegadinhas, comandos que funcionaram ou falharam, quirks de plataforma. Mais recente no topo.

---

- **2026-10-07 — Switch pelo FTP do DBI:** o DBI (905-ru) tem servidor FTP próprio em `ftp://192.168.0.253:5000/` (raiz do SD) e devolve caminhos completos na listagem (`/JKSV/<jogo>`), diferente do ftpd. Só 8 jogos têm save no JKSV; os instalados não aparecem por nome (NCAs criptografadas no emuMMC). A tela do DBI mostra `SD: livre/total` e `NAND: livre/total`. O backup guardado é o DBI 912, mas o console roda o 905-ru.

- **2026-10-07 — Miyoo:** cartão `ONION-V4_3_` (64 GB, FAT32), 6.689 jogos em ~7 min lendo 8 bytes de cada; 0 corrompidos. OnionOS usa pastas por extenso para alguns sistemas: `THIRTYTWOX` (32X), `FIFTYTWOHUNDRED` (5200), `SEVENTYEIGHTHUNDRED` (7800), `COMMODORE`, `NEOCD`. O cartão pode ser ejetado durante o pós-processamento: o espaço livre agora é lido na própria varredura.
- **2026-10-07 — Cartão errado:** um cartão com o instalador do Zorin OS foi plugado achando que era o do Miyoo. O `detect` (`.tmp_update`) impediu a leitura. Conferir sempre o volume antes de varrer.

- **2026-10-07 — Versão para o celular sem produção:** `npm run build:static` gera `dist/handheld-hub.html` (arquivo único, dados do D1 local embutidos, ~2 MB) e publica como página privada no claude.ai: https://claude.ai/artifact/Pj1T3dTi6S5RnkCKWhn7wo. O visualizador só repassa âncoras simples, por isso as rotas aceitam `#device-<id>` além de `#device/<id>`. Atualizar = rodar o build e republicar o mesmo arquivo.

- **2026-10-07 — Ícones nítidos:** Lucide é desenhado em grade 24 com traço 2. Para o traço cair em 1,5 px CSS (3 px exatos no Retina) em qualquer tamanho: `stroke-width = 1.5 × 24 / tamanho` (20 px → 1,8; 16 px → 2,25). Sprite em `public/icons.svg`, gerado por `scripts/build_icons.py` a partir de `assets/icons/`.
- **2026-10-07 — Logos Nintendo:** removidos do Simple Icons atual; `nintendoswitch.svg` veio da `simple-icons@6.0.0`. Wordmark da Samsung ocupa só uma faixa do quadro 24×24: o sprite recorta o `viewBox` (`0 9.6 24 4.8`).

- **2026-10-07 — Varredura do S20 via adb é lenta (~18 min para ~11,5 mil arquivos):** um `stat` + `head` por arquivo no shell do aparelho. Por isso o `.raw.json` e o `--rebuild`. Otimização possível: ler cabeçalho só das extensões com assinatura.
- **2026-10-07 — Drive no Mac:** `os.stat` na pasta do Google Drive (CloudStorage) não baixa o arquivo; 35 mil arquivos em ~6 min. Ler o conteúdo (para checar corrupção) baixaria tudo, então o Drive fica `unknown`.
- **2026-10-07 — ROMs corrompidas:** 284 arquivos no S20 com os primeiros 256 KB zerados; as cópias do Drive têm o mesmo defeito (detalhes no repo `s20fe-gamesirx5lite`).
- **2026-10-07 — Preview do app desktop:** o `.claude/launch.json` lido é o da pasta raiz `Github Repositories`, não o do projeto. A config `handheld-hub` está lá (`cd handheld-hub && npx wrangler dev`).
- **2026-10-07 — D1 local:** `database_id` no `wrangler.jsonc` é um placeholder; o local não usa. Trocar pelo id real só ao criar o banco remoto.
