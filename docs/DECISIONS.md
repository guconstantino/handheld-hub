# DECISIONS

Formato ADR curto. Mais recente no topo. Data AAAA-MM-DD.

---

## 2026-10-18 — Domínio público para portfólio (handheldhub.gustavoconstantino.com) e isolamento de configs

- **Contexto:** transformar o projeto em showcase público de portfólio e para a comunidade, sem expor IPs locais, caminhos privados nem links diretos do Google Drive com ROMs.
- **Decisão:**
  1. **Dual-domain no Worker:** `gamehub.gustavoconstantino.com` (privado, sob Cloudflare Access) e `handheldhub.gustavoconstantino.com` (público, sem login, downloads no Drive bloqueados com modal de portfólio).
  2. **Isolamento de configs:** `scanner/devices.local.json` (gitignored, com caminhos e IPs reais) sobrepõe `scanner/devices.json` (genérico, público no git) nos scripts (`scan.py`, `backup_to_drive.py`, `fix_corrupted.py`).
  3. **Segurança jurídica:** `/go/drive` retorna 403 no domínio público; o frontend intercepta cliques e orienta o visitante a clonar o projeto para seu próprio acervo.
- **Motivo:** vitrine completa para recrutadores e comunidade com zero risco de pirataria e zero exposição de dados sensíveis.

## 2026-10-07 — Visual minimalista + ficha por console

- **Contexto:** o visual herdado do universal-dashboard (brilhos, vidro, gradientes) ficou carregado; faltavam os dados do Switch.
- **Decisão:** CSS próprio, neutro, fonte do sistema, cor só no acento de cada console; página de detalhe por console (`#device/<id>`). Fichas em `scanner/devices.json` (`facts`, `sections`, `storage`, `source`, `snapshot`), carregadas com `npm run devices`. Switch a partir de `switch-cfw/references/estado-do-console.md` (snapshot 2026-09-19).
- **Motivo:** pedido do Gustavo ("clean e minimalista"); a ficha declarada cobre consoles que ainda não são varridos.

## 2026-10-07 — Escrita no D1 só pelo scanner (sem API de escrita)

- **Contexto:** o portal vai ficar na internet; os dados vêm de varreduras feitas no Mac.
- **Opções:** endpoint `/api/ingest` com token; ou o scanner gera SQL e aplica com `wrangler d1 execute`.
- **Decisão:** SQL + wrangler. O Worker só tem GETs.
- **Motivo:** nenhum segredo de escrita no Worker e menos código; o wrangler já autentica na conta Cloudflare.

## 2026-10-08 — Capas no R2

- **Contexto:** os assets do Worker têm limite de 20 mil arquivos por versão; as capas já eram ~14,3 mil e ainda vêm ícones do RetroAchievements e mídia nova.
- **Decisão:** capas no bucket R2 `gamehub-media` (plano grátis: 10 GB, 1 mi escritas e 10 mi leituras/mês; uso ~0,3 GB). O Worker serve `/covers/*` do R2 (atrás do mesmo Access), com cache longo no navegador e na borda (`caches.default`), já que o nome da capa é hash e nunca muda. `public/.assetsignore` tira `covers/` dos assets. Envio com o login do wrangler (`npm run r2`, retomável via `data/r2-uploaded.txt`) — sem token.
- **Alternativas:** Workers pago (US$ 5/mês, 100 mil arquivos), Oracle (mais um servidor e outra regra de Access), Supabase Storage (tráfego grátis pequeno, fora do login), sprites de capas (pior carregamento).

## 2026-10-08 — Catálogo estático em vez de API no D1

- **Contexto:** no primeiro dia em produção o D1 estourou o limite grátis de leitura (5 mi de linhas/dia): cada acesso varria a tabela inteira (~36 mil linhas) em várias consultas; a busca, a cada letra.
- **Decisão:** `scripts/catalog.py` gera `public/data/catalog.json` (~1,3 MB compactado) a partir do D1 local; `public/hh-api.js` responde às rotas `/api/*` no navegador (mesma lógica do snapshot do celular). O Worker só serve arquivos. Capas também são assets (`public/covers/`, até 20 mil arquivos por versão).
- **Consequência:** zero leitura no D1 em produção; atualizar dados = scanner → `catalog.py` → `wrangler deploy`. O D1 remoto deixa de ser necessário (fica como está por enquanto).

## 2026-10-08 — Visual de dashboard + fotos dos consoles

- **Layout:** menu lateral no desktop (topo no celular), faixa de indicadores (inclui espaço livre somado), cards com capa, gráficos "Onde estão os arquivos" (barra empilhada) e "Sistemas com mais cópias" (barras), atalhos de saúde.
- **Cores dos consoles:** saem do CSS (`data-dev`), não do D1: paleta categórica validada com o script da skill dataviz nos dois temas; ordem fixa Switch → S20 → Drive → Miyoo (vermelho e âmbar nunca lado a lado, separação CVD ≥ 8). Números sempre escritos na legenda ou na linha (o âmbar e o verde ficam abaixo de 3:1 no claro).
- **Fotos:** Switch OLED (PantheraLeo1359531) e Galaxy S20 FE (GadgetsGuy), Wikimedia Commons, CC BY 4.0, crédito no rodapé; Miyoo Mini Plus do site oficial (lomiyoo.com), provisória até o Gustavo mandar fotos próprias. WebP com fundo transparente em `public/img/`; no snapshot estático viram data URI.

## 2026-10-08 — Acessibilidade: WCAG 2.2 AA + APCA como piso

- **Contexto:** auditoria do portal. Passava no WCAG 2 com o cinza secundário do tema escuro (6,7:1), mas o APCA dava Lc 48 — fraco para texto de 13–14px. Textos em `--faint` e bordas de campos ficavam abaixo de 3:1.
- **Decisão:** texto secundário com APCA Lc ≥ 75 e WCAG ≥ 4,5:1 nos dois temas (`--muted` #5b5b63 / #cfcfd5); `--faint` só para ícones decorativos; tokens novos `--control` (borda de input/select/botão, ≥ 3:1) e `--focus` (anel de foco 2px). Card do console vira `<article>` com o link só no nome; foco vai para o `h1` ao trocar de tela; `aria-current`, `aria-live` no contador de jogos, `role="status"` no rodapé, atalho "Pular para o conteúdo".
- **Como conferir:** script de contraste (WCAG 2 + APCA 0.0.98G) e navegação só com teclado no `npm run dev`.

## 2026-10-07 — Cloudflare (Worker + D1 + Access) em gamehub.gustavoconstantino.com

- **Contexto:** portal privado no domínio do Gustavo, acessível do celular e do Mac.
- **Opções:** Vercel + Supabase (como o flipclock); Firebase (como o organizacao-financeira); Cloudflare.
- **Decisão:** Cloudflare Worker com assets estáticos, D1 como banco e Cloudflare Access na frente (só o e-mail do Gustavo).
- **Motivo:** o domínio já está na Cloudflare (MyOpenClaude); Access dá login sem código próprio; D1 é SQLite, bom para as consultas do catálogo; tudo no plano grátis. Desenvolvimento 100% local (`wrangler dev`) até o Gustavo liberar produção.

## 2026-10-07 — Reaproveitar o "Handheld Hub" (universal-dashboard)

- **Contexto:** já existia um painel visual dos 3 consoles com dados escritos à mão (alguns errados, ex.: Exynos).
- **Decisão:** herdar o `styles.css` e a identidade; o conteúdo passa a vir da API. Specs ficam em `scanner/devices.json`.

## 2026-10-08 — Portal multiusuário, com o admin no controle

- **Contexto:** o sobrinho do Gustavo (e possivelmente outros) vai usar o portal; o Gustavo administra.
- **Decisão (regra para tudo que for construído):** o acervo é um só (o do Gustavo), mas **cada usuário tem o que é pessoal**: listas, vistos, preferências, tema, usuário do RetroAchievements. Tudo pessoal é guardado pela identidade do usuário (hoje o e-mail do Access; KV `lists:<id>`, `prefs:<id>`). Ações de manutenção (varrer, consertar, rotinas) e a visão de quem usa ficam **só no painel de admin** (papel pelo segredo `ADMINS`). Recurso novo deve responder: "o que é do usuário e o que é do admin?".
- **Login:** continua pelo Cloudflare Access (código por e-mail). O login próprio (usuário/senha para os sobrinhos, PIN de 6 dígitos para o Gustavo, sessão HMAC sem ler o KV a cada arquivo, bloqueio após 5 erros) está desenhado e guardado no ramo `wip/login-proprio`, sem integrar — o Gustavo decide depois. Integrar exige trocar a policy do Access (ação dele).
