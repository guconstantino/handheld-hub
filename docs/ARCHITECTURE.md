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

## Coletores por local (`method` no devices.json)
- **adb** (S20): um shell no aparelho lista tamanho, mtime e 8 bytes iniciais.
- **local** (Drive, Miyoo): `os.walk` no Mac. `detect` confirma o volume certo (Miyoo: `.tmp_update` do OnionOS); `read_head` lê os 8 bytes (só em disco local de verdade, nunca no Drive).
- **ftp** (Switch): `curl --list-only` em `/JKSV/`. Cada pasta é um jogo **com save**; os instalados ficam criptografados no emuMMC e não têm nome legível por FTP.
- Pastas do OnionOS usam códigos próprios (FC, SFC, PS, MD, PCE, WS...), mapeados em `SYSTEM_ALIAS`. No `PORTS` do Miyoo só contam os atalhos `.port`.
