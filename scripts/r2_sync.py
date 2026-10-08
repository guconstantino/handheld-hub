#!/usr/bin/env python3
"""Envia as capas de public/covers/ para o bucket R2 `gamehub-media` (prefixo covers/).

Usa o login do wrangler (sem token). Guarda em data/r2-uploaded.txt o que já subiu, então
dá para interromper e retomar, e nas próximas vezes só sobe o que é novo.
  python3 scripts/r2_sync.py [--workers 6]
"""
import os, subprocess, sys, threading
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "public", "covers")
MANIFEST = os.path.join(ROOT, "data", "r2-uploaded.txt")
BUCKET = "gamehub-media"
lock = threading.Lock()


def put(name):
    for _ in range(3):
        r = subprocess.run(["npx", "wrangler", "r2", "object", "put", f"{BUCKET}/covers/{name}", "--file", os.path.join(SRC, name),
                            "--content-type", "image/webp", "--cache-control", "public, max-age=31536000, immutable", "--remote"],
                           cwd=ROOT, capture_output=True, text=True)
        if r.returncode == 0:
            with lock:
                open(MANIFEST, "a").write(name + "\n")
            return True
    return False


def main():
    workers = int(sys.argv[sys.argv.index("--workers") + 1]) if "--workers" in sys.argv else 6
    done = set(open(MANIFEST).read().split()) if os.path.exists(MANIFEST) else set()
    todo = sorted(f for f in os.listdir(SRC) if f.endswith(".webp") and f not in done)
    print(f"{len(done)} já no R2, {len(todo)} para enviar", flush=True)
    ok = fail = 0
    with ThreadPoolExecutor(workers) as ex:
        for i, r in enumerate(ex.map(put, todo), 1):
            ok += r; fail += not r
            if i % 250 == 0:
                print(f"  {i}/{len(todo)} (falhas: {fail})", flush=True)
    print(f"enviadas {ok}, falhas {fail}", flush=True)


if __name__ == "__main__":
    main()
