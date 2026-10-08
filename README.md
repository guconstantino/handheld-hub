# Handheld Hub

Painel dos consoles portáteis do Gustavo e catálogo de jogos: onde cada jogo está (S20 FE, Miyoo, Switch, Google Drive) e em que estado.

## Status
Fase 1: banco + varredura do S20 FE e do Drive, rodando local. Ver [docs/ROADMAP.md](docs/ROADMAP.md).

## Rodar localmente
```bash
npm install && npm run db:migrate
npm run scan:s20 && npm run scan:drive
npm run dev    # http://localhost:8787
```

## Estrutura
```
migrations/   # schema do D1 (devices, locations, files)
scanner/      # scan.py (varredura) + devices.json (specs e locais de cada device)
src/          # worker.js: API somente leitura (/api/summary, /api/games, /api/systems, /api/health)
public/       # portal (HTML/CSS/JS puros; styles.css herdado do universal-dashboard)
data/         # saídas da varredura (gitignored)
```

## Stack
- Cloudflare Workers + D1 (local via `wrangler dev`)
- HTML, CSS e JS puros
- Python 3.9+ (sem dependências) + adb

## Docs
- [Roadmap](docs/ROADMAP.md) · [Decisões](docs/DECISIONS.md) · [Aprendizados](docs/LEARNINGS.md) · [Arquitetura](docs/ARCHITECTURE.md)
