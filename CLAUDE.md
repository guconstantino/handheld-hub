# Handheld Hub

Portal pessoal do Gustavo (`gamehub.gustavoconstantino.com`) com o painel dos consoles portáteis
(Galaxy S20 FE, Miyoo Mini Plus, Switch OLED) e o catálogo de jogos: onde cada jogo está e em que estado.

## Premissas
- **Objetivo:** uso pessoal. Responder "onde está o jogo X?" e "o que está corrompido/sem backup?" sem ir no Google Drive toda hora.
- **Stack:** Cloudflare Worker + D1 + assets estáticos (HTML/CSS/JS puros) e scanner em Python no Mac. Motivo em [docs/DECISIONS.md](docs/DECISIONS.md); visão do fluxo em [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
- **Fora do escopo agora:** produção (só com ok do Gustavo), varredura do Miyoo e do Switch, capas.

## Como rodar
```bash
npm install
npm run db:migrate          # cria o D1 local
npm run scan:s20            # S20 FE via adb (~18 min; ANDROID_SERIAL se houver mais de um device)
npm run scan:drive          # pasta do Drive no Mac (~6 min)
npm run dev                 # http://localhost:8787
```

## Regras (como trabalhamos)
1. **Planejar antes de codar.** Mudança não trivial: plano primeiro, implementar após "go".
2. **De-risk primeiro.** Validar o que é mais arriscado antes de construir o resto.
3. **Sem artefatos especulativos.** Doc, skill ou código só quando a fase pedir.
4. **Cada fato num lugar canônico:** decisões em `docs/DECISIONS.md`, pegadinhas em
   `docs/LEARNINGS.md`, estado em `docs/ROADMAP.md`. Os outros linkam.
5. **Segredos nunca no git.** Só em `.dev.vars`/`.env` (gitignored).
6. **Confirmar antes de agir "para fora":** push, deploy, DNS, regra do Cloudflare Access.
7. **O scanner só lê os devices.** Nunca apaga nem move arquivo em console ou no Drive.

## Disciplina de memória
- **Fim de cada rodada:** sugerir atualizar DECISIONS / LEARNINGS / ROADMAP com o que mudou.
- **Antes de o contexto ficar longo:** parar e persistir o estado nas docs.
- Algo se repetindo? Propor uma skill.

## Convenções
- Idioma: pt-BR em conversa, docs e código.
- Commits: Conventional Commits, direto na main.
- Repos relacionados (fonte dos dados de cada console): `s20fe-gamesirx5lite`, `miyoominiplus`, `switch-cfw`.
