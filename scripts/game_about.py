#!/usr/bin/env python3
""""Sobre o jogo": introdução do artigo da Wikipédia (PT; EN se não houver) para os jogos do catálogo.

Casamento preciso, sem busca solta: o Wikidata lista os jogos de cada plataforma (P400) com o artigo
da Wikipédia; o nome é casado com o game_key (mesma normalização do scanner). Texto CC BY-SA 4.0:
a página mostra crédito e link. Gera public/data/about/<sistema>.json (um arquivo por plataforma).
  python3 scripts/game_about.py [sistema...]
"""
import json, os, re, sys, time, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from covers import norm, d1  # noqa: E402

UA = "HandheldHub/1.0 (catálogo pessoal; contato via github.com/guconstantino)"
# Plataforma no Wikidata (item do console). Arcade fica de fora: os nomes de ROM não batem com títulos.
QID = {
    "3do": "Q229429", "3ds": "Q203597", "atari2600": "Q206261", "atari5200": "Q743222", "atari7800": "Q753600", "c64": "Q99775",
    "colecovision": "Q1046862", "dreamcast": "Q184198", "fds": "Q135321", "gamecube": "Q182172", "gamegear": "Q751719",
    "gb": "Q186437", "gba": "Q188642", "gbc": "Q203992", "intellivision": "Q1061441", "jaguar": "Q650601", "lynx": "Q753657",
    "mastersystem": "Q209868", "megadrive": "Q10676", "msx": "Q853547", "msx2": "Q853547", "n64": "Q184839", "nds": "Q170323",
    "neogeo": "Q1054350", "neogeocd": "Q2703883", "nes": "Q172742", "ngp": "Q1977455", "ngpc": "Q1977455", "pcengine": "Q1057377",
    "pcenginecd": "Q1057377", "ps2": "Q10680", "psp": "Q170325", "psx": "Q10677", "sega32x": "Q1063978", "segacd": "Q1047516",
    "sg1000": "Q1136956", "snes": "Q183259", "sufami": "Q7200192", "supergrafx": "Q202375", "switch": "Q19610114",
    "vectrex": "Q767631", "virtualboy": "Q164651", "wii": "Q8079", "wswanc": "Q1048035",
}


def get(url, tries=4):
    for i in range(tries):
        try:
            return json.load(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"}), timeout=120))
        except Exception:
            time.sleep(5 * (i + 1))
    return None


def wikidata_games(qid):
    q = f"""SELECT ?g ?en ?pt ?ptw ?enw WHERE {{
      ?g wdt:P400 wd:{qid} .
      OPTIONAL {{ ?g rdfs:label ?en FILTER(lang(?en)="en") }}
      OPTIONAL {{ ?g rdfs:label ?pt FILTER(lang(?pt)="pt") }}
      OPTIONAL {{ ?ptw schema:about ?g ; schema:isPartOf <https://pt.wikipedia.org/> }}
      OPTIONAL {{ ?enw schema:about ?g ; schema:isPartOf <https://en.wikipedia.org/> }}
      FILTER(BOUND(?ptw) || BOUND(?enw)) }}"""
    d = get("https://query.wikidata.org/sparql?" + urllib.parse.urlencode({"query": q, "format": "json"}))
    out = []
    for b in (d or {}).get("results", {}).get("bindings", []):
        v = {k: x["value"] for k, x in b.items()}
        out.append(v)
    return out


def extracts(lang, titles):
    res = {}
    for i in range(0, len(titles), 20):
        q = urllib.parse.urlencode({"action": "query", "prop": "extracts", "exintro": 1, "explaintext": 1, "exlimit": 20,
                                    "redirects": 1, "format": "json", "titles": "|".join(titles[i:i + 20])})
        d = get(f"https://{lang}.wikipedia.org/w/api.php?{q}")
        if not d:
            continue
        d = d["query"]
        alias = {r["from"]: r["to"] for r in d.get("redirects", []) + d.get("normalized", [])}
        pages = {p["title"]: p.get("extract", "") for p in d["pages"].values()}
        for t in titles[i:i + 20]:
            res[t] = pages.get(alias.get(alias.get(t, t), alias.get(t, t)), "")
        time.sleep(0.3)
    return res


def paras(text, n=3):
    ps = [re.sub(r"\s+", " ", p).strip() for p in text.split("\n") if len(p.strip()) > 60]
    return ps[:n]


def main():
    systems = [a for a in sys.argv[1:] if a in QID] or sorted(QID)
    games = d1("SELECT DISTINCT game_key, system FROM files")
    keys = {}
    for g in games:
        keys.setdefault(g["system"], set()).add(g["game_key"].split("|", 1)[1])
    os.makedirs(os.path.join(ROOT, "public", "data", "about"), exist_ok=True)
    total = 0
    for s in systems:
        want = keys.get(s, set())
        if not want:
            continue
        found = {}
        art = lambda u: u and re.sub(r"\s*\((?:video ?game|jogo eletrônico|videojogo|jogo)[^)]*\)$", "", urllib.parse.unquote(u.rsplit("/wiki/", 1)[-1]).replace("_", " "), flags=re.I)
        for r in wikidata_games(QID[s]):
            for label in (r.get("en"), r.get("pt"), art(r.get("enw")), art(r.get("ptw"))):
                k = label and norm(label)
                if k in want and k not in found:
                    found[k] = r
        time.sleep(1)
        # Artigo em PT quando existe; senão EN.
        url_title = lambda u: urllib.parse.unquote(u.rsplit("/wiki/", 1)[-1]).replace("_", " ")
        pt = extracts("pt", sorted({url_title(r["ptw"]) for r in found.values() if r.get("ptw")}))
        en = extracts("en", sorted({url_title(r["enw"]) for r in found.values() if r.get("enw") and not r.get("ptw")}))
        out = {}
        for k, r in found.items():
            if r.get("ptw") and pt.get(url_title(r["ptw"])):
                text, lang, url = pt[url_title(r["ptw"])], "pt", r["ptw"]
            elif r.get("enw") and en.get(url_title(r["enw"])):
                text, lang, url = en[url_title(r["enw"])], "en", r["enw"]
            else:
                continue
            ps = paras(text)
            if ps:
                out[k] = {"lang": lang, "text": ps, "url": url}
        json.dump(out, open(os.path.join(ROOT, "public", "data", "about", f"{s}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
        total += len(out)
        print(f"{s:14s} {len(out):5d}/{len(want):<5d} ({sum(1 for v in out.values() if v['lang'] == 'pt')} em PT)", flush=True)
    print(f"total: {total} jogos com texto")


if __name__ == "__main__":
    main()
