#!/usr/bin/env python3
"""Duplicatas reais: o mesmo arquivo de jogo repetido na mesma pasta do mesmo lugar.

Mesmo jogo = mesma pasta, mesma chave, mesma extensão, mesmas etiquetas entre parênteses ("(USA)", "(Rev 2)")
e o mesmo nome ignorando só pontuação ("Metroid Fusion" = "Metroid - Fusion"; "INV" ≠ "INV+"). O marcador
de cópia do Drive/Windows ("(1)", ".00", "- Copia") não conta. Não é duplicata: disco 1 × disco 2, .bin × .cue,
"(USA)" × "(Japan)", "(1996)" × "(2002)", "megadrive/" × "megadrivebr/".

- **Idênticas:** mesmo tamanho (a mesma cópia). Entram no comando de remoção.
- **Prováveis:** tamanho diferente (outro zip, outro dump). Só para revisar à mão.

Gera public/data/dupes.json (tela Saúde) e data/dupes-remover.sh (só no Mac, gitignored), com o `rm` de cada
cópia idêntica. O script não apaga nada (regra: o scanner só lê); quem roda o .sh é o Gustavo.
  python3 scripts/dupes.py
"""
import collections, glob, json, os, re, shlex, sys, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from catalog import d1  # noqa: E402

COPY = re.compile(r"(\s*\(\d{1,2}\)|\.\d{2}|\s*-\s*(c[oó]pia|copy)(\s*\(\d{1,2}\))?)+$", re.I)


def assinatura(r):
    t = COPY.sub("", r["title"]).strip()
    tags = tuple(sorted(x.strip().lower() for x in re.findall(r"[(\[]([^)\]]*)[)\]]", t)))
    nome = re.sub(r"[(\[][^)\]]*[)\]]", " ", t).lower()
    nome = re.sub(r"[\s_'&:,.\-!]+", " ", nome).strip()          # pontuação não conta; "+" e números contam
    return (r["location_id"], os.path.dirname(r["rel_path"]).lower(), r["game_key"], (r["ext"] or "").lower(), tags, nome)


def fica(grupo):
    """Qual cópia manter: sem marcador de cópia, sem "_" no lugar do apóstrofo, o nome mais curto."""
    return min(grupo, key=lambda x: (bool(COPY.search(x["title"])), "_" in x["title"], len(x["title"]), x["rel_path"]))


def raiz(loc):
    r = os.path.expanduser(loc["root"])
    if "*" in r:
        achou = sorted(glob.glob(r))
        return achou[0] if achou else None
    return r


def main():
    locs = {l["id"]: l for l in d1("SELECT * FROM locations")}
    rows = d1("SELECT location_id, system, rel_path, title, game_key, ext, size FROM files WHERE ext NOT IN ('bak', 'tmp', 'log')")
    grupos = collections.defaultdict(list)
    for r in rows:
        grupos[assinatura(r)].append(r)
    out = {"generated": time.strftime("%Y-%m-%d %H:%M"), "exact": [], "probable": []}
    for g in grupos.values():
        if len(g) < 2:
            continue
        k = fica(g)
        item = {"loc": k["location_id"], "system": k["system"], "key": k["game_key"], "keep": k["rel_path"],
                "extras": [{"rel": x["rel_path"], "size": x["size"] or 0} for x in g if x is not k]}
        (out["exact"] if len({x["size"] for x in g}) == 1 else out["probable"]).append(item)
    for lst in (out["exact"], out["probable"]):
        lst.sort(key=lambda i: (i["loc"], i["system"], i["keep"].lower()))
    json.dump(out, open(os.path.join(ROOT, "public", "data", "dupes.json"), "w"), ensure_ascii=False, separators=(",", ":"))

    # Comando de remoção (só idênticas). Drive e Miyoo: caminho no Mac; S20: pelo adb.
    linhas = ["#!/bin/sh", f"# Cópias idênticas (mesmo nome sem o marcador de cópia, mesmo tamanho). Gerado em {out['generated']}.",
              "# Confira antes de rodar. Mantém uma cópia de cada jogo.", "set -e"]
    for i in out["exact"]:
        loc = locs[i["loc"]]
        base = loc["root"] if loc["device_id"] == "s20fe" else raiz(loc)
        if not base:
            linhas.append(f"# {i['loc']}: não montado, pulando {len(i['extras'])} arquivo(s)")
            continue
        for x in i["extras"]:
            p = f"{base}/{x['rel']}"
            linhas.append(f"adb shell rm {shlex.quote(shlex.quote(p))}" if loc["device_id"] == "s20fe" else f"rm -v -- {shlex.quote(p)}")
    sh = os.path.join(ROOT, "data", "dupes-remover.sh")
    open(sh, "w").write("\n".join(linhas) + "\n")
    os.chmod(sh, 0o755)

    soma = lambda lst: sum(x["size"] for i in lst for x in i["extras"])
    print(f"idênticas: {sum(len(i['extras']) for i in out['exact'])} arquivos a mais ({soma(out['exact']) / 1e9:.2f} GB) · "
          f"prováveis: {sum(len(i['extras']) for i in out['probable'])} ({soma(out['probable']) / 1e9:.2f} GB) · comando em data/dupes-remover.sh")


if __name__ == "__main__":
    main()
