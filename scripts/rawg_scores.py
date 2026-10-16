#!/usr/bin/env python3
"""Nota do Metacritic de cada jogo, pela API do RAWG (campo `metacritic`). Não raspa o Metacritic.

Só nas plataformas da era do Metacritic (antes de ~1999 quase nenhum jogo tem nota). Busca pelo título na
plataforma certa e só aceita resultado com o mesmo nome normalizado (ou quase igual, com os mesmos números).
Gera public/data/scores/<sistema>.json { chave: { mc, ano, slug, nome } }. Os termos do RAWG pedem crédito e
link: a página do jogo mostra "via RAWG". Retomável: data/rawg-cache.json guarda também o que não achou.
Usa RAWG_API_KEY do .env.
  python3 scripts/rawg_scores.py [sistema...] [--refazer]
"""
import json, os, re, sys, time, urllib.error, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from covers import norm, fuzzy  # noqa: E402  (mesma normalização e mesma trava de números das capas)

PLATAFORMAS = {"psx": 27, "ps2": 15, "psp": 17, "gba": 24, "gbc": 43, "nds": 9, "3ds": 8, "gamecube": 105,
               "wii": 11, "switch": 7, "n64": 83, "dreamcast": 106}
CACHE = os.path.join(ROOT, "data", "rawg-cache.json")
OUT = os.path.join(ROOT, "public", "data", "scores")


def chave_api():
    env = dict(l.split("=", 1) for l in open(os.path.join(ROOT, ".env")).read().splitlines() if "=" in l and not l.startswith("#"))
    return env["RAWG_API_KEY"].strip()


def buscar(key, titulo, plat):
    q = urllib.parse.urlencode({"key": key, "search": titulo, "platforms": plat, "page_size": 8, "search_precise": "true"})
    for i in range(4):
        try:
            req = urllib.request.Request(f"https://api.rawg.io/api/games?{q}", headers={"User-Agent": "HandheldHub/1.0 (uso pessoal)"})
            return json.load(urllib.request.urlopen(req, timeout=30)).get("results", [])
        except urllib.error.HTTPError as e:
            if e.code in (401, 403):
                sys.exit("RAWG recusou a chave (401/403): confira RAWG_API_KEY no .env")
            time.sleep(10 * (i + 1))
        except Exception:
            time.sleep(5 * (i + 1))
    return None


def detalhe(key, slug, plat):
    """A busca costuma vir com `metacritic` vazio; o detalhe traz a nota geral e a nota por plataforma."""
    for i in range(3):
        try:
            req = urllib.request.Request(f"https://api.rawg.io/api/games/{urllib.parse.quote(slug)}?key={key}",
                                         headers={"User-Agent": "HandheldHub/1.0 (uso pessoal)"})
            d = json.load(urllib.request.urlopen(req, timeout=30))
            por_plat = next((m.get("metascore") for m in d.get("metacritic_platforms") or []
                             if (m.get("platform") or {}).get("platform") == plat), None)
            return por_plat or d.get("metacritic")
        except Exception:
            time.sleep(5 * (i + 1))
    return None


def main():
    key = chave_api()
    sistemas = [a for a in sys.argv[1:] if a in PLATAFORMAS] or list(PLATAFORMAS)
    cat = json.load(open(os.path.join(ROOT, "public", "data", "catalog.json")))
    nomes = cat.get("names", {})
    jogos = {}
    for f in cat["files"]:
        s = cat["systems"][f[1]]
        if s in sistemas:
            jogos.setdefault(s, {}).setdefault(f[3], nomes.get(f"{s}|{f[3]}", f[2]))
    cache = json.load(open(CACHE)) if os.path.exists(CACHE) and "--refazer" not in sys.argv else {}
    os.makedirs(OUT, exist_ok=True)
    total = 0
    for s in sistemas:
        out, novos = {}, 0
        for k, titulo in sorted(jogos.get(s, {}).items()):
            ck = f"{s}|{k}"
            if ck not in cache:
                limpo = re.sub(r"\s*[\(\[].*$", "", titulo).strip() or titulo
                res = buscar(key, limpo, PLATAFORMAS[s])
                if res is None:
                    continue                              # falha de rede: tenta de novo na próxima vez
                por_nome = {norm(r["name"]): r for r in res}
                r = por_nome.get(k)
                if not r:
                    alvo = fuzzy(k, {n: n for n in por_nome}, cutoff=0.92)
                    r = por_nome.get(alvo) if alvo else None
                cache[ck] = {"mc": r.get("metacritic") or detalhe(key, r["slug"], PLATAFORMAS[s]),
                             "ano": (r.get("released") or "")[:4] or None, "slug": r.get("slug"), "nome": r.get("name")} if r else None
                novos += 1
                time.sleep(0.25)                          # gentil com a API
                if novos % 50 == 0:
                    json.dump(cache, open(CACHE, "w"), ensure_ascii=False)
            v = cache.get(ck)
            if v and v.get("mc"):
                out[k] = v
        json.dump(cache, open(CACHE, "w"), ensure_ascii=False)
        json.dump(out, open(os.path.join(OUT, f"{s}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
        total += len(out)
        print(f"{s:10s} {len(out):5d} com nota de {len(jogos.get(s, {}))} jogos ({novos} consultas novas)", flush=True)
    print(f"total: {total} jogos com nota do Metacritic")


if __name__ == "__main__":
    main()
