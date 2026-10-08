#!/usr/bin/env python3
"""Lista de jogos com conquistas no RetroAchievements, por console (selo na grade e conquistas na página
do jogo mesmo sem ter jogado). Muda pouco: gerada aqui, no deploy, e não pelo Worker (o plano grátis
limita 50 sub-pedidos por acesso). Usa RA_API_KEY do .env. Gera public/data/ra-catalog.json.
  python3 scripts/ra_catalog.py
"""
import json, os, sys, time, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONSOLES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 25, 28, 29, 33, 40, 41, 43, 44, 45, 46, 51, 53, 56, 76, 81]


def main():
    env = dict(l.split("=", 1) for l in open(os.path.join(ROOT, ".env")).read().splitlines() if "=" in l and not l.startswith("#"))
    key = env["RA_API_KEY"].strip()
    # Retomável: mantém o que já foi baixado e busca só os consoles pedidos (ou os que faltam).
    path = os.path.join(ROOT, "public", "data", "ra-catalog.json")
    out = json.load(open(path)) if os.path.exists(path) and "--force" not in sys.argv else {}
    done_ids = set(out.pop("_ids", []))
    todo = [int(a) for a in sys.argv[1:] if a.isdigit()] or [c for c in CONSOLES if c not in done_ids]
    missing = []
    for c in todo:
        for t in range(6):
            try:
                q = urllib.parse.urlencode({"y": key, "i": c, "f": 1})
                req = urllib.request.Request(f"https://retroachievements.org/API/API_GetGameList.php?{q}", headers={"User-Agent": "HandheldHub/1.0"})
                lst = json.load(urllib.request.urlopen(req, timeout=240))
                if lst:
                    out[lst[0]["ConsoleName"]] = [[int(g["ID"]), g["Title"], int(g.get("NumAchievements") or 0)] for g in lst if not g["Title"].startswith("~")]
                done_ids.add(c)
                break
            except Exception:
                time.sleep(3 * (t + 1))
        else:
            missing.append(c)
        time.sleep(1)                                    # gentil com a API do RA
    out["_ids"] = sorted(done_ids)
    json.dump(out, open(path, "w"), ensure_ascii=False, separators=(",", ":"))
    n = {k: v for k, v in out.items() if k != "_ids"}
    print(f"{path}: {len(n)} consoles, {sum(len(v) for v in n.values())} jogos" + (f" — faltaram {missing}" if missing else ""))


if __name__ == "__main__":
    main()
