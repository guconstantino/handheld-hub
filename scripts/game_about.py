#!/usr/bin/env python3
""""Sobre o jogo": introdução do artigo da Wikipédia (PT; EN se não houver) para os jogos do catálogo.

Casamento preciso, sem busca solta: o Wikidata lista os jogos de cada plataforma (P400) com o artigo
da Wikipédia; o nome é casado com o game_key (mesma normalização do scanner). Texto CC BY-SA 4.0:
a página mostra crédito e link. Gera public/data/about/<sistema>.json (um arquivo por plataforma).
  python3 scripts/game_about.py [sistema...]
"""
import json, os, re, sys, time, urllib.error, urllib.parse, urllib.request

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
# Arcade: plataforma "arcade video game" (Q192851). O arquivo tem o nome curto da ROM; o casamento usa
# o título do DAT do libretro (covers.rom_titles), e a consulta é uma só para todos estes sistemas.
ARCADE = ["arcade", "mame", "fbneo", "neogeo", "cps1", "cps2", "cps3", "lightgun", "model2", "model3", "naomi", "atomiswave"]
QID.update({s: "Q192851" for s in ARCADE})


def get(url, tries=5):
    for i in range(tries):
        try:
            return json.load(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"}), timeout=180))
        except urllib.error.HTTPError as e:
            # 429: o servidor diz quanto esperar (Retry-After); respeita, até 25 min.
            wait = int(e.headers.get("Retry-After") or 0) if e.code == 429 else 0
            print(f"  HTTP {e.code}; esperando {max(wait, 30 * (i + 1))} s", flush=True)
            time.sleep(min(max(wait, 30 * (i + 1)), 1500))
        except Exception:
            time.sleep(30 * (i + 1))
    return None


def wikidata_games(qid):
    """Jogos da plataforma com artigo na Wikipédia PT ou EN. Consulta leve (sem rótulos) para não estourar o
    tempo nos consoles grandes; o casamento usa o título do artigo. None = falhou (não sobrescrever nada)."""
    q = f"""SELECT ?g ?ptw ?enw WHERE {{
      ?g wdt:P400 wd:{qid} .
      OPTIONAL {{ ?ptw schema:about ?g ; schema:isPartOf <https://pt.wikipedia.org/> }}
      OPTIONAL {{ ?enw schema:about ?g ; schema:isPartOf <https://en.wikipedia.org/> }}
      FILTER(BOUND(?ptw) || BOUND(?enw)) }}"""
    d = get("https://query.wikidata.org/sparql?" + urllib.parse.urlencode({"query": q, "format": "json"}))
    if d is None:
        return None
    return [{k: x["value"] for k, x in b.items()} for b in d.get("results", {}).get("bindings", [])]


def extracts(lang, titles):
    res = {}
    for i in range(0, len(titles), 20):
        q = urllib.parse.urlencode({"action": "query", "prop": "extracts", "exintro": 1, "explaintext": 1, "exlimit": 20,
                                    "redirects": 1, "format": "json", "titles": "|".join(titles[i:i + 20])})
        d = get(f"https://{lang}.wikipedia.org/w/api.php?{q}")
        if not d:
            continue
        d = d["query"]
        norm_ = {r["from"]: r["to"] for r in d.get("normalized", [])}
        redir = {r["from"]: r["to"] for r in d.get("redirects", [])}
        pages = {p["title"]: p.get("extract", "") for p in d["pages"].values()}
        for t in titles[i:i + 20]:
            t2 = norm_.get(t, t)
            # Redirecionamento = o artigo é de outra coisa (ex.: o jogo vira a série). Fica vazio e cai no EN.
            res[t] = "" if t2 in redir else pages.get(t2, "")
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
    from covers import rom_titles
    titles = rom_titles()
    rows_cache = {}
    os.makedirs(os.path.join(ROOT, "public", "data", "about"), exist_ok=True)
    total = 0
    for s in systems:
        want = keys.get(s, set())
        if not want:
            continue
        path = os.path.join(ROOT, "public", "data", "about", f"{s}.json")
        if "--force" not in sys.argv and os.path.exists(path) and json.load(open(path)):
            print(f"{s:14s} já existe, pulando", flush=True)
            continue
        cached = QID[s] in rows_cache
        rows = rows_cache[QID[s]] if cached else wikidata_games(QID[s])
        if rows is None:
            print(f"{s:14s} Wikidata não respondeu; arquivo mantido", flush=True)
            continue
        rows_cache[QID[s]] = rows
        # Nome casável → chaves do sistema. Arcade: pelo título do DAT ("kof98" → "the king of fighters 98").
        by_name = {}
        for k in want:
            name = norm(titles[k]) if s in ARCADE and k in titles else k
            by_name.setdefault(name, []).append(k)
        found = {}
        art = lambda u: u and re.sub(r"\s*\((?:video ?game|arcade game|jogo eletrônico|videojogo|jogo)[^)]*\)$", "", urllib.parse.unquote(u.rsplit("/wiki/", 1)[-1]).replace("_", " "), flags=re.I)
        for r in rows:
            for label in (art(r.get("enw")), art(r.get("ptw"))):
                for k in by_name.get(label and norm(label), []):
                    found.setdefault(k, r)
        if not cached:
            time.sleep(60)                               # um minuto entre plataformas: gentil com o Wikidata
        # Artigo em PT quando existe; senão EN.
        url_title = lambda u: urllib.parse.unquote(u.rsplit("/wiki/", 1)[-1]).replace("_", " ")
        pt = extracts("pt", sorted({url_title(r["ptw"]) for r in found.values() if r.get("ptw")}))
        need_en = lambda r: r.get("enw") and not (r.get("ptw") and pt.get(url_title(r["ptw"])))
        en = extracts("en", sorted({url_title(r["enw"]) for r in found.values() if need_en(r)}))
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
        json.dump(out, open(path, "w"), ensure_ascii=False, separators=(",", ":"))
        total += len(out)
        print(f"{s:14s} {len(out):5d}/{len(want):<5d} ({sum(1 for v in out.values() if v['lang'] == 'pt')} em PT)", flush=True)
    print(f"total: {total} jogos com texto")


if __name__ == "__main__":
    main()
