# Roadmap

## Estado atual
Fase 1 pronta localmente: S20 FE (SD + interno) e Drive indexados; portal com visão geral, busca de jogos e saúde do acervo em `wrangler dev`. Próximo: Miyoo e Switch.

## Fases
- [x] **Fase 0 — Fundação:** schema D1, Worker só leitura, scanner Python, portal herdado do Handheld Hub.
- [x] **Fase 1 — S20 FE + Drive:** varredura, detecção de corrompidos, agrupamento por jogo.
- [ ] **Fase 2 — Miyoo + Switch:** Miyoo pelo SD plugado no Mac; Switch via ftpd/DBI.
- [ ] **Fase 3 — Produção (só com ok):** `wrangler d1 create gamehub`, deploy, domínio `gamehub.gustavoconstantino.com`, Cloudflare Access (só o e-mail do Gustavo), `scan.py --remote`.
- [ ] **Depois:** capas (Daijishō/OnionOS), pendências de cada repo no painel, varredura agendada.

## Fora do escopo
- Escrever ou apagar arquivos nos devices pelo portal.

## Problemas conhecidos
- Agrupamento por título é heurístico: traduções e hacks com nome diferente aparecem como jogos separados.
- Status do Drive é sempre "não verificado" (o conteúdo não é lido).
