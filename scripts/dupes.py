#!/usr/bin/env python3
"""Duplicatas reais: o mesmo arquivo de jogo repetido na mesma pasta do mesmo lugar.

Mesmo jogo = mesma pasta, mesma chave, mesma extensão, mesmas etiquetas entre parênteses ("(USA)", "(Rev 2)")
e o mesmo nome ignorando só pontuação ("Metroid Fusion" = "Metroid - Fusion"; "INV" ≠ "INV+"). O marcador
de cópia do Drive/Windows ("(1)", ".00", "- Copia") não conta. Não é duplicata: disco 1 × disco 2, .bin × .cue,
"(USA)" × "(Japan)", "(1996)" × "(2002)", "megadrive/" × "megadrivebr/".

- **Idênticas:** mesmo tamanho (a mesma cópia). Entram no comando de remoção.
- **Prováveis:** tamanho diferente (outro zip, outro dump). Só para revisar à mão.
- `--crc`: abre o índice dos zips prováveis (CRC e tamanho de cada arquivo de dentro, sem descompactar). Mesmo
  conteúdo → vira idêntica ("mesma ROM, zip diferente") e entra no comando; conteúdo diferente → "outro dump".
  No Drive isso baixa os zips (o Drive para Desktop só traz o arquivo quando alguém lê). Cache em data/dupes-crc.json.

Gera public/data/dupes.json (tela Saúde) e data/dupes-remover.sh (só no Mac, gitignored), com o `rm` de cada
cópia idêntica **do Drive**. Nos consoles o save e o estado ficam presos ao nome do arquivo (no Miyoo, "Metroid
Fusion" e "Metroid - Fusion" tinham cada um o seu progresso): lá só relata. O script não apaga nada (regra: o
scanner só lê); quem roda o .sh é o Gustavo.
  python3 scripts/dupes.py [--crc]
"""
import collections, glob, json, os, re, shlex, sys, time, zipfile
from concurrent.futures import ThreadPoolExecutor

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


CRC_CACHE = os.path.join(ROOT, "data", "dupes-crc.json")
SMD_CACHE = os.path.join(ROOT, "data", "dupes-smd.json")


def limpos(caminho):
    """CRCs possíveis da ROM de um zip de um arquivo só: como está, sem o cabeçalho de 512 bytes de copiadora
    (.smc/.smd) e, se for .smd, também desentrelaçada (blocos de 16 KB: metade 1 = bytes ímpares, metade 2 = pares)."""
    import zlib
    try:
        with zipfile.ZipFile(caminho) as z:
            info = [i for i in z.infolist() if not i.is_dir()]
            if len(info) != 1:
                return None
            nome = info[0].filename.lower()
            try:
                data = z.read(info[0])
            except Exception:
                return [-1]                           # abre, mas os dados não descompactam: cópia corrompida
    except Exception:
        return None
    crc = lambda b: zlib.crc32(b) & 0xFFFFFFFF
    out = {crc(data)}
    corpo = data[512:] if len(data) % 1024 == 512 else data
    out.add(crc(corpo))
    if nome.endswith(".smd"):
        d = bytearray(len(corpo))
        for b in range(0, len(corpo) - len(corpo) % 16384, 16384):
            blk = corpo[b:b + 16384]
            d[b + 1:b + 16384:2] = blk[:8192]
            d[b:b + 16384:2] = blk[8192:]
        out.add(crc(bytes(d)))
    return sorted(out)


def conteudo(caminho):
    """Assinatura do que há dentro do zip: (crc, tamanho) de cada arquivo, sem descompactar. None se não der."""
    try:
        with zipfile.ZipFile(caminho) as z:
            return sorted([i.CRC, i.file_size] for i in z.infolist() if not i.is_dir())
    except Exception:
        return None


def checar_crc(out, locs, tam):
    cache = json.load(open(CRC_CACHE)) if os.path.exists(CRC_CACHE) else {}
    tarefas = {}
    for i in out["probable"]:
        loc = locs[i["loc"]]
        base = raiz(loc) if loc["device_id"] != "s20fe" else None   # S20 só pelo adb: fica de fora
        if not base:
            continue
        for rel, size in [(i["keep"], tam.get((i["loc"], i["keep"]), 0))] + [(x["rel"], x["size"]) for x in i["extras"]]:
            if rel.lower().endswith(".zip"):
                ck = f"{i['loc']}|{rel}|{size}"
                if ck not in cache:
                    tarefas[ck] = os.path.join(base, rel)
    print(f"crc: {len(tarefas)} zips para ler ({len(cache)} no cache)", flush=True)
    with ThreadPoolExecutor(max_workers=6) as ex:
        for n, (ck, sig) in enumerate(zip(tarefas, ex.map(conteudo, tarefas.values())), 1):
            cache[ck] = sig
            if n % 50 == 0:
                print(f"crc: {n}/{len(tarefas)}", flush=True)
                json.dump(cache, open(CRC_CACHE, "w"))
    json.dump(cache, open(CRC_CACHE, "w"))
    return cache


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
    if "--crc" in sys.argv or os.path.exists(CRC_CACHE):
        tam = {(r["location_id"], r["rel_path"]): r["size"] or 0 for r in rows}
        cache = checar_crc(out, locs, tam) if "--crc" in sys.argv else json.load(open(CRC_CACHE))
        sig = lambda loc, rel, size: cache.get(f"{loc}|{rel}|{size}")
        smd = json.load(open(SMD_CACHE)) if os.path.exists(SMD_CACHE) else {}
        resto = []
        for i in out["probable"]:
            # Mesmo jogo em outra forma: (a) um pacote contém o outro (Neo Geo com o 000-lo.lo da BIOS a mais) →
            # fica o mais completo; (b) cabeçalho de copiadora (.smc/.smd +512 bytes) ou .smd entrelaçado → desfaz e
            # compara o CRC; fica o arquivo limpo (padrão No-Intro).
            membros = [(i["keep"], tam.get((i["loc"], i["keep"]), 0))] + [(x["rel"], x["size"]) for x in i["extras"]]
            sigs = [cache.get(f"{i['loc']}|{r}|{s}") for r, s in membros]
            base = raiz(locs[i["loc"]]) if locs[i["loc"]]["device_id"] != "s20fe" else None
            if base and len(membros) == 2 and all(sigs) and sigs[0] != sigs[1]:   # iguais: cai no CRC abaixo
                A, B = ({tuple(x) for x in sg} for sg in sigs)
                manter = None
                if A != B and (A <= B or B <= A):
                    manter, how = (1 if A <= B else 0), "conjunto"
                elif len(A) == len(B) == 1:
                    cands = []
                    for r, sz in membros:
                        ck = f"{i['loc']}|{r}|{sz}"
                        if ck not in smd and "--crc" in sys.argv:
                            smd[ck] = limpos(os.path.join(base, r))
                        cands.append(set(smd.get(ck) or []))
                    comum = cands[0] & cands[1]
                    ruim = [-1 in c for c in cands]
                    if ruim[0] != ruim[1] and all(cands):
                        manter, how = ruim.index(False), "corrompida"   # a outra não descompacta: fica a boa
                    elif comum:
                        cru0, cru1 = next(iter(A))[0], next(iter(B))[0]
                        manter, how = (0 if cru0 in comum else 1 if cru1 in comum else 0), "cabeçalho"
                if manter is not None:
                    out["exact"].append({**i, "by": how, "keep": membros[manter][0],
                                         "extras": [{"rel": membros[1 - manter][0], "size": membros[1 - manter][1]}]})
                    continue
            s0 = sig(i["loc"], i["keep"], tam.get((i["loc"], i["keep"]), 0))
            ss = [sig(i["loc"], x["rel"], x["size"]) for x in i["extras"]]
            if s0 and all(s == s0 for s in ss):
                i["by"] = "crc"                       # mesma ROM, zip diferente
                out["exact"].append(i)
            else:
                if s0 and all(ss):
                    i["diff"] = True                  # conteúdo diferente de verdade (outro dump/revisão)
                resto.append(i)
        out["probable"] = resto
        json.dump(smd, open(SMD_CACHE, "w"))
    for lst in (out["exact"], out["probable"]):
        lst.sort(key=lambda i: (i["loc"], i["system"], i["keep"].lower()))

    # Comando de remoção: só idênticas e só no Drive (backup, sem save). O Drive manda para a lixeira dele (30 dias).
    linhas = ["#!/bin/sh", f"# Cópias idênticas no Drive (mesmo nome sem o marcador de cópia, mesmo tamanho). Gerado em {out['generated']}.",
              "# Confira antes de rodar. Mantém uma cópia de cada jogo. Consoles ficam de fora (save preso ao nome).", "set -e"]
    for i in out["exact"]:
        loc = locs[i["loc"]]
        i["cmd"] = loc["device_id"] == "drive"
        if not i["cmd"]:
            continue
        base = raiz(loc)
        if not base:
            linhas.append(f"# {i['loc']}: pasta não encontrada, pulando {len(i['extras'])} arquivo(s)")
            continue
        for x in i["extras"]:
            linhas.append("rm -v -- " + shlex.quote(f"{base}/{x['rel']}"))
    json.dump(out, open(os.path.join(ROOT, "public", "data", "dupes.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    sh = os.path.join(ROOT, "data", "dupes-remover.sh")
    open(sh, "w").write("\n".join(linhas) + "\n")
    os.chmod(sh, 0o755)

    soma = lambda lst: sum(x["size"] for i in lst for x in i["extras"])
    print(f"idênticas: {sum(len(i['extras']) for i in out['exact'])} arquivos a mais ({soma(out['exact']) / 1e9:.2f} GB) · "
          f"prováveis: {sum(len(i['extras']) for i in out['probable'])} ({soma(out['probable']) / 1e9:.2f} GB) · comando em data/dupes-remover.sh")


if __name__ == "__main__":
    main()
