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
- **2026-10-08 — Access sem provedor de identidade:** a conta só tinha o provedor "Cloudflare" (login com a conta Cloudflare = Outlook), então a policy só com o Gmail barrava o Gustavo. Solução: Outlook incluído na policy. One-time PIN ativado em Integrations → Identity providers (2026-10-08): agora a tela de login oferece Cloudflare (Outlook) ou código por e-mail (Gmail).
- **2026-10-08 — Ordem segura do deploy:** o domínio respondeu 200 sem login entre o deploy e a criação do app no Access. Não vazou nada porque o D1 estava vazio; regra: criar o app do Access antes (pode ser criado para um hostname que ainda não existe) e só carregar dados depois de testar o 302 para `*.cloudflareaccess.com`.
- **2026-10-08 — `wrangler login` expira:** em sessão não interativa o wrangler não renova; rodar `npx wrangler login` no terminal.
- **2026-10-08 — D1 local depende do `database_id`:** ao trocar o id placeholder pelo real, o `wrangler dev` passou a abrir um banco local novo e vazio (`/api/summary` 500). Refazer: `npm run db:migrate` + `wrangler d1 execute gamehub --local --file data/<local>.sql` para cada `.sql`, e reiniciar o `wrangler dev`.
- **2026-10-08 — Arcade usa o nome curto da ROM:** "kof98.zip" não casa com nenhum acervo de capas nem com a Wikipédia. Os DATs do libretro (`metadat/mame/MAME.dat`, `metadat/fbneo-split/…`, `dat/Atomiswave.dat`) traduzem para o título completo. Neles "&" vem gravado como "_" ("Cloak _ Dagger"); trocar " _ " por " & " ao exibir.
- **2026-10-08 — Abrir aba depois de um diálogo:** `window.open` precisa rodar no próprio clique do usuário; no evento `close` do `<dialog>` o Safari já considera fora do gesto e bloqueia. Por isso o botão "Abrir site" é `type="button"` com handler próprio.
- **2026-10-08 — RA, últimas conquistas:** o `RecentAchievements` do `API_GetUserSummary` só cobre os últimos dias (veio vazio com 9 conquistas na conta). `API_GetAchievementsEarnedBetween` (de/até em epoch) traz o histórico com data e selo.
- **2026-10-08 — `__pycache__` estava no git:** importar `covers.py` de outro script criou o `.pyc` versionado. Agora no `.gitignore`.
- **2026-10-08 — Chave de preferência compartilhada por engano:** o tema das plataformas foi gravado em `hh_theme`, a mesma chave do claro/escuro; quem escolhia "Vivid" abria o portal com `data-theme="vivid"` e o modo de cor quebrava. Agora `hh_ptheme`, com migração. Regra: conferir `grep -o 'hh_[a-z]*'` antes de criar chave nova.
- **2026-10-08 — Redirecionamento na API da Wikipédia:** em `query.redirects`, o `from` é o título já **normalizado** (não o pedido, nem o destino). Comparar com o destino deixa passar "Sega Model 2" → "List of Sega arcade system boards". Redirecionamento com `tofragment` ou para "List of…" é de outra coisa; o de grafia ("Neo-Geo" → "Neo Geo") vale.
- **2026-10-08 — Seletor genérico demais:** `document.querySelectorAll(".seg button")` pegava também as abas de Comparar e podia gravar `hh_view` inválido. Usar o atributo que identifica o controle (`[data-mode]`).
- **2026-10-08 — `display` vence `hidden`:** botão com `display: inline-flex` no CSS aparece mesmo com o atributo `hidden`; precisa de `[hidden] { display: none }` explícito.
- **2026-10-08 — `focus()` rola a página:** ao restaurar a rolagem e depois focar o título (acessibilidade), o foco jogava para o topo. Usar `focus({ preventScroll: true })`.
- **2026-10-08 — ROM corrompida "consertável":** só aceitar cópia de outro lugar do acervo se o zip passar no `testzip()` (CRC); 26 das cópias candidatas também estavam ruins. Ver `scripts/fix_corrupted.py`.
