# Roadmap

## Estado atual
Fase 1 pronta localmente: S20 FE (SD + interno) e Drive indexados; portal com visão geral, busca de jogos e saúde do acervo em `wrangler dev`. Fase 2 concluída: os 3 consoles e o Drive no catálogo. Próximo: produção (com ok) ou lista completa do Switch.

## Onde paramos (2026-10-07)
Handoff completo (portal + console) em `s20fe-gamesirx5lite/docs/STATE.md`, seção "Onde paramos". Próximo: o Gustavo escolhe entre lista completa do Switch (DBI), produção (só com ok) ou voltar aos problemas do console.

## Fases
- [x] **Fase 0 — Fundação:** schema D1, Worker só leitura, scanner Python, portal herdado do Handheld Hub.
- [x] **Fase 1 — S20 FE + Drive:** varredura, detecção de corrompidos, agrupamento por jogo.
- [x] **Fase 1.5 — Visual minimalista + fichas:** S20, Miyoo e Switch com ficha, armazenamento e seções.
- [x] **Fase 2 — Miyoo + Switch:** Miyoo varrido (6.689 jogos); Switch pelos saves do JKSV via FTP do DBI (8 jogos). Melhorar: lista completa de instalados do Switch.
- [ ] **Fase 3 — Produção (só com ok):** `wrangler d1 create gamehub`, deploy, domínio `gamehub.gustavoconstantino.com`, Cloudflare Access (só o e-mail do Gustavo), `scan.py --remote`.
- [ ] **Depois:** capas (Daijishō/OnionOS), pendências de cada repo no painel, varredura agendada.

## Fora do escopo
- Escrever ou apagar arquivos nos devices pelo portal.

## Problemas conhecidos
- Agrupamento por título é heurístico: traduções e hacks com nome diferente aparecem como jogos separados.
- Status do Drive é sempre "não verificado" (o conteúdo não é lido).
