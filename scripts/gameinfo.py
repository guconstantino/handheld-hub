#!/usr/bin/env python3
"""Dados de cada jogo para a página do jogo: libretro-database (metadat + cht), casado pelo nome No-Intro.

Gera, por plataforma (poucos arquivos, por causa do limite de 20 mil do Worker):
  public/data/info/<sistema>.json    → { chave: { ano, mês, desenvolvedora, publicadora, gênero, jogadores, franquia } }
  public/data/cheats/<sistema>.json  → { chave: [ [origem, [[descrição, código], ...]], ... ] }
A chave é o game_key sem o prefixo do sistema. O repositório fica num clone parcial em
~/.cache/handheld-hub/libretro-database (sparse: metadat/* e cht/).
  python3 scripts/gameinfo.py
"""
import json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB = os.path.expanduser("~/.cache/handheld-hub/libretro-database")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from covers import LIBRETRO, norm, region_rank, d1  # noqa: E402  (mesmo mapa de sistemas e mesma normalização)

FIELDS = {"releaseyear": "ano", "releasemonth": "mes", "developer": "dev", "publisher": "pub",
          "genre": "genero", "maxusers": "jogadores", "franchise": "franquia"}
MAX_CODES = 150                                   # por arquivo de cheat (alguns têm centenas)


def parse_dat(path, field):
    """clrmamepro: game ( comment "Nome (Região)" campo "valor" ... ) → {nome: valor}."""
    out = {}
    if not os.path.exists(path):
        return out
    text = open(path, encoding="utf-8", errors="replace").read()
    for block in re.findall(r"game \((.*?)\n\)", text, re.S):
        name = re.search(r'comment "(.*?)"', block)
        val = re.search(rf'{field} "(.*?)"', block)
        if name and val:
            out[name.group(1)] = val.group(1)
    return out


def parse_cht(path):
    text = open(path, encoding="utf-8", errors="replace").read()
    desc = dict(re.findall(r'cheat(\d+)_desc = "(.*?)"', text))
    code = dict(re.findall(r'cheat(\d+)_code = "(.*?)"', text))
    items = [[desc[i], code[i]] for i in sorted(desc, key=int) if i in code and code[i]]
    return items[:MAX_CODES]


def main():
    games = d1("SELECT game_key, system, GROUP_CONCAT(title, '\x1f') AS titles FROM files GROUP BY game_key")
    by_sys = {}
    for g in games:
        by_sys.setdefault(g["system"], []).append(g)
    os.makedirs(os.path.join(ROOT, "public", "data", "info"), exist_ok=True)
    os.makedirs(os.path.join(ROOT, "public", "data", "cheats"), exist_ok=True)
    tot_info = tot_cht = 0
    for system, lr in sorted(LIBRETRO.items()):
        rows = by_sys.get(system, [])
        if not rows:
            continue
        # Campos: índice pelo nome exato e pelo nome normalizado (preferindo EUA/Mundo/Europa).
        fields = {}
        for f, short in FIELDS.items():
            exact = parse_dat(os.path.join(DB, "metadat", f, lr + ".dat"), f)
            byn = {}
            for n in sorted(exact, key=region_rank):
                byn.setdefault(norm(n), exact[n])
            fields[short] = (exact, byn)
        info = {}
        for g in rows:
            titles = sorted(set(g["titles"].split("\x1f")), key=region_rank)
            key = g["game_key"].split("|", 1)[1]
            rec = {}
            for short, (exact, byn) in fields.items():
                v = next((exact[t] for t in titles if t in exact), None) or byn.get(key)
                if v:
                    rec[short] = int(v) if short in ("ano", "mes", "jogadores") and v.isdigit() else v
            if rec:
                info[key] = rec
        # Cheats: todos os arquivos cujo nome normalizado bate com o jogo (USA, Europe, Game Genie...).
        cheats, cdir = {}, os.path.join(DB, "cht", lr)
        if os.path.isdir(cdir):
            want = {g["game_key"].split("|", 1)[1] for g in rows}
            for fn in sorted(os.listdir(cdir), key=region_rank):
                if not fn.endswith(".cht"):
                    continue
                stem = fn[:-4]
                k = norm(stem)
                if k in want:
                    items = parse_cht(os.path.join(cdir, fn))
                    if items:
                        src = " ".join(re.findall(r"\(([^)]*)\)", stem)) or "Padrão"
                        cheats.setdefault(k, []).append([src, items])
        json.dump(info, open(os.path.join(ROOT, "public", "data", "info", f"{system}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
        if cheats:
            json.dump(cheats, open(os.path.join(ROOT, "public", "data", "cheats", f"{system}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
        tot_info += len(info); tot_cht += len(cheats)
        print(f"{system:14s} dados {len(info):5d}/{len(rows):<5d} códigos {len(cheats):5d}")
    print(f"total: dados de {tot_info} jogos, códigos de {tot_cht}")


if __name__ == "__main__":
    main()
