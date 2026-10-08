# Roadmap

## Estado atual
Fase 1 pronta localmente: S20 FE (SD + interno) e Drive indexados; portal com visão geral, busca de jogos e saúde do acervo em `wrangler dev`. Fase 2 concluída: os 3 consoles e o Drive no catálogo. **Fase 3 no ar (2026-10-08):** https://gamehub.gustavoconstantino.com atrás do Cloudflare Access. Login: conta Cloudflare (Outlook) ou One-time PIN (Gmail). Próximo: lista completa do Switch.

## Onde paramos (2026-10-07)
Handoff completo (portal + console) em `s20fe-gamesirx5lite/docs/STATE.md`, seção "Onde paramos". Próximo: o Gustavo escolhe entre lista completa do Switch (DBI), produção (só com ok) ou voltar aos problemas do console.

## Fases
- [x] **Fase 0 — Fundação:** schema D1, Worker só leitura, scanner Python, portal herdado do Handheld Hub.
- [x] **Fase 1 — S20 FE + Drive:** varredura, detecção de corrompidos, agrupamento por jogo.
- [x] **Fase 1.5 — Visual minimalista + fichas:** S20, Miyoo e Switch com ficha, armazenamento e seções.
- [x] **Fase 2 — Miyoo + Switch:** Miyoo varrido (6.689 jogos); Switch pelos saves do JKSV via FTP do DBI (8 jogos). Melhorar: lista completa de instalados do Switch.
- [x] **Fase 3 — Produção (2026-10-08):** D1 remoto `gamehub` (ENAM), Worker só no domínio próprio (`workers_dev`/`preview_urls` off), Access app "Handheld Hub" com policy reutilizável "Só Gustavo" (Gmail + Outlook), dados carregados (S20 11.496 / Miyoo 6.689 / Switch 8 / Drive 17.463). Atualizar dados: `python3 scanner/scan.py --remote <local>` (ou `--rebuild` para reenviar sem varrer).
- [x] **Fase 4 — Capas, Drive e visual (2026-10-08):** capas (libretro + OnionOS + Daijishō), link do Drive por jogo, grade/lista, plataformas com a arte Arrow do Daijishō, catálogo estático, layout adaptativo e bento grid.
- [x] **Lote 3 — Micro-interações (2026-10-08):** Motion 13.4.2 + fonte Geist (OFL), revelação ao rolar em sequência, números contando, barras e anel enchendo, inclinação dos cartões no mouse, View Transitions (arte da plataforma vira o topo), skeleton nas capas. Tudo desliga com "reduzir movimento".
- [ ] **Lote 4 — Gráficos minimalistas:** trocar os gráficos feitos à mão por uma biblioteca com visual limpo, **linhas quando fizer sentido, sem pizza/rosca**. Candidatas: Observable Plot (padrões elegantes, base D3), uPlot (~50 KB, linhas e séries temporais) — escolher juntos. Referências: design systems Wise, Base (Coinbase), MUI X Charts; dashboards do Dribbble/Awwwards/Behance/Pinterest (traço fino, área com gradiente sutil, rótulo direto, grade discreta). Regras da skill dataviz (paleta validada, um eixo só, cor segue o console). **Linhas precisam de histórico:** gravar um retrato a cada varredura (`data/history`: jogos, capas, arquivos e espaço livre por console) para mostrar a evolução do acervo, das capas e do espaço no tempo.
- [ ] **Página do jogo — fase 1 (dados livres):** `#game-…` com capa grande, ano, desenvolvedora, publicadora, gênero e jogadores (libretro-database, casado pelo nome No-Intro); seção "Códigos" com os cheats do RetroArch (libretro-database/cht) e botão de copiar; onde está + Drive. Dados num JSON por plataforma (limite de 20 mil arquivos do Worker).
- [ ] **Página do jogo — fase 2 (texto):** descrição, história e curiosidades. Fonte a decidir: IGDB (resumo + storyline, inglês; precisa conta de dev da Twitch do Gustavo, chaves no `.env`) é a recomendada; ScreenScraper (PT parcial, chave de dev pedida no fórum) e Wikipédia PT (curiosidades, só jogos conhecidos) como complemento. Tradução para PT com a API do Claude: combinar custo antes. Dicas: link "Buscar dicas" (sem coleta do GameFAQs, proibida nos termos).
- [ ] **RetroAchievements:** importar do perfil `guconstantino` (Web API oficial: usuário + chave de API da página de configurações do RA, guardada no `.env`, nunca no git). Buscar na hora do build (`scripts/retroachievements.py` → `public/data/ra.json`), sem chamar a API pelo navegador. Exibir: conquistas desbloqueadas/total por jogo (com ícones), jogos **mais jogados e jogados recentemente**, jogos zerados/masterizados (prêmios), pontos e ranking, linha do tempo de conquistas (gráfico de linha do lote 4). **Horas jogadas:** a API não dá tempo exato por jogo — mostrar o que existir (última vez jogado, tempo estimado se a API oferecer) e confirmar na implementação. Casar os jogos do RA com o catálogo pelo título/sistema (e pelo hash do ROM quando possível) para mostrar as conquistas na página do jogo e um selo "tem conquistas" na grade.
- [ ] **Scanner:** pastas de sistema do 3DS (`config`, `shaders`, `slates`, `User`, `idmo`) contadas como jogos — filtrar.
- [ ] **Depois:** pendências de cada repo no painel, varredura agendada.

## Fora do escopo
- Escrever ou apagar arquivos nos devices pelo portal.

## Problemas conhecidos
- Agrupamento por título é heurístico: traduções e hacks com nome diferente aparecem como jogos separados.
- Status do Drive é sempre "não verificado" (o conteúdo não é lido).
