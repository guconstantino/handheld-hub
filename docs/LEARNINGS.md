# LEARNINGS

Pegadinhas, comandos que funcionaram ou falharam, quirks de plataforma. Mais recente no topo.

---

- **2026-10-07 — Varredura do S20 via adb é lenta (~18 min para ~11,5 mil arquivos):** um `stat` + `head` por arquivo no shell do aparelho. Por isso o `.raw.json` e o `--rebuild`. Otimização possível: ler cabeçalho só das extensões com assinatura.
- **2026-10-07 — Drive no Mac:** `os.stat` na pasta do Google Drive (CloudStorage) não baixa o arquivo; 35 mil arquivos em ~6 min. Ler o conteúdo (para checar corrupção) baixaria tudo, então o Drive fica `unknown`.
- **2026-10-07 — ROMs corrompidas:** 284 arquivos no S20 com os primeiros 256 KB zerados; as cópias do Drive têm o mesmo defeito (detalhes no repo `s20fe-gamesirx5lite`).
- **2026-10-07 — Preview do app desktop:** o `.claude/launch.json` lido é o da pasta raiz `Github Repositories`, não o do projeto. A config `handheld-hub` está lá (`cd handheld-hub && npx wrangler dev`).
- **2026-10-07 — D1 local:** `database_id` no `wrangler.jsonc` é um placeholder; o local não usa. Trocar pelo id real só ao criar o banco remoto.
