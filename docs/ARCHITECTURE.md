# Arquitetura

```
 S20 FE ──adb──┐
 Drive (Mac) ──┼─> scanner/scan.py ──> data/<local>.raw.json ──> data/<local>.sql ──> wrangler d1 execute ──> D1 "gamehub"
 Miyoo / Switch┘   (só leitura)          (cache da varredura)      (substitui o local)                         │
                                                                                                             v
                                              navegador <── public/ (assets) + src/worker.js (/api/*, só GET)
```

- **Escrita só pelo scanner**, direto no D1 via wrangler (local ou `--remote`). O Worker não tem endpoint de escrita: menos superfície exposta.
- **Modelo:** `devices` (console ou backup) → `locations` (SD, interno, pasta do Drive) → `files` (um item por jogo naquele local).
- **`game_key`** = `sistema|título normalizado` (sem tags de região/revisão, artigo no lugar certo). Agrupa as cópias do mesmo jogo entre locais.
- **Jogo-pasta:** nos sistemas de `FOLDER_SYSTEMS` (3DS, PSX, PS2, PSP, PC, Lutro, Naomi), a subpasta é o jogo; nos outros, cada arquivo é um jogo.
- **Estado:** `corrupted` quando um formato com assinatura (zip, chd, gcz, rvz, nsp...) começa com 8 bytes zerados; `ok` quando tem assinatura; `unknown` quando não dá pra verificar (Drive não é lido, só listado).
- **`--rebuild`** reprocessa `data/<local>.raw.json` sem reler o device (útil ao mudar as regras de agrupamento).
