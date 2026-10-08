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

## 2026-10-07 — Cloudflare (Worker + D1 + Access) em gamehub.gustavoconstantino.com

- **Contexto:** portal privado no domínio do Gustavo, acessível do celular e do Mac.
- **Opções:** Vercel + Supabase (como o flipclock); Firebase (como o organizacao-financeira); Cloudflare.
- **Decisão:** Cloudflare Worker com assets estáticos, D1 como banco e Cloudflare Access na frente (só o e-mail do Gustavo).
- **Motivo:** o domínio já está na Cloudflare (MyOpenClaude); Access dá login sem código próprio; D1 é SQLite, bom para as consultas do catálogo; tudo no plano grátis. Desenvolvimento 100% local (`wrangler dev`) até o Gustavo liberar produção.

## 2026-10-07 — Reaproveitar o "Handheld Hub" (universal-dashboard)

- **Contexto:** já existia um painel visual dos 3 consoles com dados escritos à mão (alguns errados, ex.: Exynos).
- **Decisão:** herdar o `styles.css` e a identidade; o conteúdo passa a vir da API. Specs ficam em `scanner/devices.json`.
