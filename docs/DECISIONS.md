# DECISIONS

Formato ADR curto. Mais recente no topo. Data AAAA-MM-DD.

---

## 2026-10-07 — Visual minimalista + ficha por console

- **Contexto:** o visual herdado do universal-dashboard (brilhos, vidro, gradientes) ficou carregado; faltavam os dados do Switch.
- **Decisão:** CSS próprio, neutro, fonte do sistema, cor só no acento de cada console; página de detalhe por console (`#device/<id>`). Fichas em `scanner/devices.json` (`facts`, `sections`, `storage`, `source`, `snapshot`), carregadas com `npm run devices`. Switch a partir de `switch-cfw/references/estado-do-console.md` (snapshot 2026-09-19).
- **Motivo:** pedido do Gustavo ("clean e minimalista"); a ficha declarada cobre consoles que ainda não são varridos.

## 2026-10-07 — Escrita no D1 só pelo scanner (sem API de escrita)

- **Contexto:** o portal vai ficar na internet; os dados vêm de varreduras feitas no Mac.
- **Opções:** endpoint `/api/ingest` com token; ou o scanner gera SQL e aplica com `wrangler d1 execute`.
- **Decisão:** SQL + wrangler. O Worker só tem GETs.
- **Motivo:** nenhum segredo de escrita no Worker e menos código; o wrangler já autentica na conta Cloudflare.

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
