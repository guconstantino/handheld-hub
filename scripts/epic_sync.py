#!/usr/bin/env python3
"""
Sincroniza a biblioteca Epic Games do Gustavo com o Handheld Hub (public/data/epic-library.json).
- Reutiliza a sessão do legendary (~/.config/legendary) e, se expirar, renova via RememberMe + DPoPKey.bin (Secure Enclave).
- Faz cache incremental dos tamanhos de manifesto (só baixa manifesto de jogos novos ou atualizados).
- Detecta automaticamente os jogos instalados no S20 FE (/sdcard/3-Jogos/PC/ e aba PORTS).
- Com --deploy, publica automaticamente no Cloudflare Workers se houver mudança.
"""
import configparser
import hashlib
import json
import os
import re
import subprocess
import sys
import time
import uuid
import warnings
from base64 import b64decode, urlsafe_b64encode
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

warnings.filterwarnings("ignore")

# Garante que o pacote legendary do usuário seja encontrado mesmo via launchd/cron
for py_dir in Path.home().glob("Library/Python/*/lib/python/site-packages"):
    if str(py_dir) not in sys.path:
        sys.path.insert(0, str(py_dir))

import requests
from legendary.core import LegendaryCore
from legendary.utils.egl_crypt import AES, decrypt_epic_data

ROOT = Path(__file__).resolve().parent.parent
OUT_JSON = ROOT / "public" / "data" / "epic-library.json"
TMP_SCAN = Path("/tmp/epic_full_scan.json")


def b64u(b):
    if isinstance(b, str):
        b = b.encode("utf-8")
    return urlsafe_b64encode(b).rstrip(b"=").decode("ascii")


def fallback_egl_dpop_login(core: LegendaryCore) -> bool:
    """Se a sessão do legendary expirar, recupera do EpicGamesLauncher.app via Secure Enclave DPoP."""
    ini_path = Path.home() / "Library/Application Support/Epic/EpicGamesLauncher/Saved/Config/MacEditor/GameUserSettings.ini"
    dpop_path = Path.home() / "Library/Application Support/Epic/EpicGamesLauncher/DPoPKey.bin"
    bin_path = Path("/Applications/Epic Games Launcher.app/Contents/MacOS/EpicGamesLauncher-Mac-Shipping")
    if not (ini_path.exists() and dpop_path.exists() and bin_path.exists()):
        return False
    try:
        c = configparser.ConfigParser(strict=False)
        c.read(str(ini_path))
        raw = b64decode(c.get("RememberMe", "Data"))
        data = bin_path.read_bytes()
        key = None
        for m in re.findall(b"(?:[0-9A-Fa-f]\\x00){32}", data):
            k = m[::2]
            if AES(k).decrypt_block(raw[:16]).startswith(b'[{\"'):
                key = k.decode("ascii")
                break
        if not key:
            return False
        dec = json.loads(decrypt_epic_data(key, raw))[0]
        refresh_token = dec["Token"]

        swift_code = f"""
import Foundation
import CryptoKit
let data = try! Data(contentsOf: URL(fileURLWithPath: "{dpop_path}"))
let key = try! SecureEnclave.P256.Signing.PrivateKey(dataRepresentation: data)
let pub = key.publicKey.x963Representation
let msg = CommandLine.arguments[1].data(using: .utf8)!
let sig = try! key.signature(for: msg).rawRepresentation
print(pub.base64EncodedString() + "|" + sig.base64EncodedString())
"""

        def sign_dpop(htm, htu):
            out = subprocess.check_output(["swift", "-e", swift_code, "dummy"]).decode().strip()
            pub_raw = b64decode(out.split("|")[0])
            hdr = {
                "typ": "dpop+jwt",
                "alg": "ES256",
                "jwk": {"kty": "EC", "crv": "P-256", "x": b64u(pub_raw[1:33]), "y": b64u(pub_raw[33:65])},
            }
            pld = {"jti": str(uuid.uuid4()), "htm": htm, "htu": htu, "iat": int(time.time())}
            si = b64u(json.dumps(hdr, separators=(",", ":"))) + "." + b64u(json.dumps(pld, separators=(",", ":")))
            out2 = subprocess.check_output(["swift", "-e", swift_code, si]).decode().strip()
            return si + "." + b64u(b64decode(out2.split("|")[1]))

        url = "https://account-public-service-prod03.ol.epicgames.com/account/api/oauth/token"
        r = requests.post(
            url,
            headers={"DPoP": sign_dpop("POST", url)},
            auth=("34a02cf8f4414e29b15921876da36f9a", "daafbccc737745039dffe53d94fc76cf"),
            data={"grant_type": "refresh_token", "refresh_token": refresh_token, "token_type": "eg1"},
            timeout=15,
        )
        if r.status_code != 200:
            return False
        j = r.json()
        ex_url = "https://account-public-service-prod03.ol.epicgames.com/account/api/oauth/exchange"
        r_ex = requests.get(
            ex_url,
            headers={"Authorization": "Bearer " + j["access_token"], "DPoP": sign_dpop("GET", ex_url)},
            timeout=15,
        )
        if r_ex.status_code != 200:
            return False
        return core.auth_ex_token(r_ex.json()["code"])
    except Exception as e:
        print(f"[epic_sync] Fallback DPoP falhou: {e}", file=sys.stderr)
        return False


def get_s20_installed(allow_adb=True):
    """Retorna conjunto de nomes normalizados instalados no S20 FE (sem acordar o S20 FE em background)."""
    installed = {"supermeatboy", "enterthegungeon", "evoland", "evoland2", "evolandlegendaryedition", "limbo", "fallguys", "sonicmania", "horizonchaseturbo", "dandara"}
    if OUT_JSON.exists():
        try:
            old = json.loads(OUT_JSON.read_text())
            for g in old.get("games", []):
                if g.get("installedS20"):
                    installed.add(re.sub(r"[^a-z0-9]", "", g.get("title", "").lower()))
        except Exception:
            pass
    if not allow_adb:
        return installed
    try:
        out = subprocess.check_output(
            ["adb", "shell", "ls -1 /sdcard/Rom/PC 2>/dev/null; ls -1 /sdcard/Rom/Ports/Shortcuts/*.port 2>/dev/null"],
            timeout=4,
            stderr=subprocess.DEVNULL,
        ).decode("utf-8", errors="ignore")
        for line in out.splitlines():
            clean = re.sub(r"[^a-z0-9]", "", Path(line.strip()).stem.lower())
            if clean:
                installed.add(clean)
    except Exception:
        pass
    return installed


def fmt_size(b):
    if b <= 0:
        return "~4.5 GB"
    mb = b / (1024 * 1024)
    gb = mb / 1024
    if gb >= 1.0:
        return f"{gb:.2f} GB"
    return f"{mb:.0f} MB"


def pick_cover(meta):
    images = meta.get("keyImages", [])
    by_type = {img.get("type"): img.get("url") for img in images if img.get("url")}
    for pref in ("DieselGameBoxTall", "Thumbnail", "OfferImageTall", "DieselGameBox", "OfferImageWide"):
        if pref in by_type:
            url = by_type[pref]
            return f"{url}?h=256&resize=1" if "?" not in url else url
    return images[0]["url"] if images else None


NATIVE_DECOMP = {
    "sonic mania": ("native-port", 100, "Port Nativo Android (Decomp RSDKv5 60fps Widescreen) + GameHub"),
    "doom 64": ("native-port", 100, "Port Nativo Android (Doom64EX+ c/ DOOM64.WAD) + GameHub"),
    "fallout: a post nuclear": ("native-port", 100, "Port Nativo Android (fallout1-ce SDL2) + GameHub"),
    "fallout 2:": ("native-port", 100, "Port Nativo Android (fallout2-ce SDL2) + GameHub"),
    "i have no mouth": ("native-port", 100, "Port Nativo Android (ScummVM) + GameHub"),
    "amnesia:  the dark descent": ("native-port", 100, "Port Nativo Android (Sclerosis / HPL2) + GameHub"),
}

HAS_ANDROID_EDITION = [
    "figment", "brotato", "vampire survivors", "bloons td 6", "horizon chase turbo",
    "turnip boy", "cat quest", "cassette beasts", "superbrothers", "kingdom new lands",
    "botanicula", "chuchel", "pilgrims", "the alto collection", "guild of dungeoneering",
    "2064: read only memories", "the bridge", "scourgebringer", "dandara", "lovecraft",
    "there is no game", "beholder", "costume quest 2", "deponia", "ken follett"
]

ONLINE_OR_INCOMPAT = [
    "valorant", "fortnite", "destiny 2", "genshin impact", "wuthering waves",
    "world of warships", "dead by daylight", "chivalry 2", "hell let loose",
    "predator: hunting grounds", "arcadegeddon", "divine knockout", "first class trouble",
    "hood outlaws", "deceive inc", "midnight ghost hunt", "evil dead the game",
    "trackmania", "battlefield", "star wars™ battlefront", "killingfloor2beta",
    "mortal shell tech beta", "death stranding digital soundtrack", "selections of titan art book",
    "map pack", "hd wallpaper", "firestone", "idle champions", "thehunter"
]


def classify_game(g, s20_installed):
    t = g["title"].lower()
    norm = re.sub(r"[^a-z0-9]", "", t)
    disk_gb = g["disk_bytes"] / (1024**3)
    eng = g.get("engine") or "Custom / C++"
    tp = g.get("third_party") or ""
    is_installed = any(norm == inst or (len(inst) > 4 and inst in norm) for inst in s20_installed)
    if norm in ("supermeatboyforever", "supermeatboyforevermobileandroid"):
        is_installed = False

    if "android" in [p.lower() for p in g.get("platforms", [])] and g.get("exe") == "APK":
        return {
            "tier": 0 if is_installed else 1,
            "score": 100,
            "category": "installed" if is_installed else "native-port",
            "installedS20": is_installed,
            "compatLabel": "100% · APK Oficial (Epic Mobile)",
            "compatDetail": "APK nativo Android na sua conta Epic Mobile",
        }

    for k, (cat, score, desc) in NATIVE_DECOMP.items():
        if k in t:
            return {
                "tier": 0 if is_installed else 2,
                "score": score,
                "category": "installed" if is_installed else cat,
                "installedS20": is_installed,
                "compatLabel": "100% · Port Nativo / Decomp",
                "compatDetail": desc,
            }

    if g.get("anticheat") or tp or any(k in t for k in ONLINE_OR_INCOMPAT):
        reason = "Anti-Cheat (EAC/BattlEye)" if g.get("anticheat") else (f"Exige {tp}" if tp else "Online-Only / Extra")
        return {
            "tier": 9,
            "score": 0,
            "category": "incompatible",
            "installedS20": False,
            "compatLabel": f"Incompatível ({reason})",
            "compatDetail": f"Bloqueado localmente ({reason}) — usar Streaming",
        }

    if g.get("offline") == "false" and g.get("eos"):
        return {
            "tier": 8,
            "score": 30,
            "category": "heavy",
            "installedS20": is_installed,
            "compatLabel": f"30% · Exige Login Online EOS ({eng})",
            "compatDetail": f"Requer autenticação EOS ativa ({eng})",
        }

    if disk_gb <= 1.6 and any(k in t for k in HAS_ANDROID_EDITION):
        return {
            "tier": 0 if is_installed else 3,
            "score": 98,
            "category": "installed" if is_installed else "native-port",
            "installedS20": is_installed,
            "compatLabel": f"98% · Excelente ({eng})",
            "compatDetail": f"60 FPS no GameHub ({eng}, DRM-Free) + possui edição Android",
        }

    if disk_gb <= 0.6:
        return {
            "tier": 0 if is_installed else 4,
            "score": 95,
            "category": "installed" if is_installed else "great-light",
            "installedS20": is_installed,
            "compatLabel": f"95% · Super Leve 60 FPS ({eng})",
            "compatDetail": f"Roda a 60 FPS cravados no GameHub ({eng}, DRM-Free)",
        }

    if disk_gb <= 1.8:
        return {
            "tier": 0 if is_installed else 5,
            "score": 90,
            "category": "installed" if is_installed else "great-light",
            "installedS20": is_installed,
            "compatLabel": f"90% · Leve 60 FPS ({eng})",
            "compatDetail": f"Ótima performance no GameHub ({eng}, DRM-Free)",
        }

    if disk_gb <= 5.0:
        return {
            "tier": 0 if is_installed else 6,
            "score": 80,
            "category": "installed" if is_installed else "playable-mid",
            "installedS20": is_installed,
            "compatLabel": f"80% · Muito Boa 30–60 FPS ({eng})",
            "compatDetail": f"Médio porte ({eng}) — 30 a 60 FPS no Snapdragon 865",
        }

    if disk_gb <= 14.0:
        return {
            "tier": 0 if is_installed else 7,
            "score": 65,
            "category": "installed" if is_installed else "playable-mid",
            "installedS20": is_installed,
            "compatLabel": f"65% · Jogável em 720p ({eng})",
            "compatDetail": f"25–45 FPS em 720p no GameHub ({eng})",
        }

    return {
        "tier": 8,
        "score": 35,
        "category": "heavy",
        "installedS20": is_installed,
        "compatLabel": f"35% · Pesado / >14 GB ({eng})",
        "compatDetail": f"Acima de 14 GB ou pesado p/ Adreno 650 ({eng}) — melhor via Streaming",
    }


def main():
    core = LegendaryCore()
    try:
        logged_in = core.login()
    except Exception:
        logged_in = False
    if not logged_in:
        print("[epic_sync] Sessão expirada; tentando renovar via EpicGamesLauncher + Secure Enclave...")
        if not fallback_egl_dpop_login(core):
            raise RuntimeError("Não foi possível autenticar na Epic Games.")

    # Carrega cache anterior (de public/data/epic-library.json ou /tmp/epic_full_scan.json)
    prev_cache = {}
    if OUT_JSON.exists():
        try:
            old = json.loads(OUT_JSON.read_text())
            for item in old.get("games", []):
                if item.get("diskBytes", 0) > 0:
                    prev_cache[item["appName"]] = item
        except Exception:
            pass
    if TMP_SCAN.exists():
        try:
            for item in json.loads(TMP_SCAN.read_text()):
                if item.get("disk_bytes", 0) > 0 and item["app_name"] not in prev_cache:
                    prev_cache[item["app_name"]] = {
                        "diskBytes": item["disk_bytes"],
                        "dlBytes": item["dl_bytes"],
                        "exe": item.get("exe", ""),
                        "engine": item.get("engine", "Custom / C++"),
                        "anticheat": item.get("anticheat", False),
                        "eos": item.get("eos", False),
                    }
        except Exception:
            pass

    games_raw = [g for g in core.get_game_list(update_assets=True) if not g.is_dlc]
    print(f"[epic_sync] {len(games_raw)} jogos de PC/Mac encontrados na conta {core.lgd.userdata.get('displayName')}.")

    def process_one(g):
        ca = g.metadata.get("customAttributes", {})
        offline = ca.get("CanRunOffline", {}).get("value", "true")
        third_party = ca.get("ThirdPartyManagedApp", {}).get("value", "")
        plats = list(g.asset_infos.keys())
        plat = "Windows" if "Windows" in plats else (plats[0] if plats else None)
        cached = prev_cache.get(g.app_name)

        res = {
            "app_name": g.app_name,
            "title": g.app_title,
            "platforms": plats,
            "offline": offline,
            "third_party": third_party,
            "dl_bytes": cached["dlBytes"] if cached else 0,
            "disk_bytes": cached["diskBytes"] if cached else 0,
            "exe": cached.get("exe", "") if cached else "",
            "engine": cached.get("engine", "Custom / C++") if cached else "Custom / C++",
            "anticheat": cached.get("anticheat", False) if cached else False,
            "eos": cached.get("eos", False) if cached else False,
            "cover": pick_cover(g.metadata),
            "developer": g.metadata.get("developer", ""),
        }
        if cached or not plat or third_party:
            return res
        try:
            m_data, _ = core.get_cdn_manifest(g, plat)
            m = core.load_manifest(m_data)
            res["disk_bytes"] = sum(fm.file_size for fm in m.file_manifest_list.elements)
            res["dl_bytes"] = sum(c.file_size for c in m.chunk_data_list.elements)
            res["exe"] = m.meta.launch_exe or ""
            fnames = [fm.filename.lower() for fm in m.file_manifest_list.elements]
            if any("easyanticheat" in f or "battleye" in f for f in fnames):
                res["anticheat"] = True
            if any("eossdk" in f for f in fnames):
                res["eos"] = True
            if any("unityplayer.dll" in f or "_data/managed/unityengine" in f for f in fnames):
                res["engine"] = "Unity"
            elif any("engine/binaries/win" in f or (".pak" in f and "engine/" in f) for f in fnames):
                res["engine"] = "Unreal"
            elif any(f.endswith(".pck") for f in fnames):
                res["engine"] = "Godot"
            elif any(f.endswith("data.win") for f in fnames):
                res["engine"] = "GameMaker"
            elif any("fna.dll" in f or "monogame" in f or "xna" in f for f in fnames):
                res["engine"] = "FNA/XNA"
            elif any("dosbox" in f or "scummvm" in f for f in fnames):
                res["engine"] = "DOSBox/ScummVM"
        except Exception:
            pass
        return res

    scanned = []
    with ThreadPoolExecutor(max_workers=16) as ex:
        futs = [ex.submit(process_one, g) for g in games_raw]
        for fut in as_completed(futs):
            scanned.append(fut.result())

    # Inclui os 3 jogos Android exclusivos da Epic Mobile
    scanned.extend([
        {
            "app_name": "67042b70b5964ebd8f1976a82f76c5c7",
            "title": "Super Meat Boy Forever Mobile",
            "platforms": ["Android"],
            "offline": "true",
            "third_party": "",
            "dl_bytes": 210 * 1024 * 1024,
            "disk_bytes": 240 * 1024 * 1024,
            "exe": "APK",
            "engine": "Native Android",
            "anticheat": False,
            "eos": False,
            "cover": None,
            "developer": "Team Meat",
        },
        {
            "app_name": "09e8f92d436c4484b4c666bac75bc041",
            "title": "Eastern Exorcist (Android)",
            "platforms": ["Android"],
            "offline": "true",
            "third_party": "",
            "dl_bytes": 850 * 1024 * 1024,
            "disk_bytes": 950 * 1024 * 1024,
            "exe": "APK",
            "engine": "Native Android",
            "anticheat": False,
            "eos": False,
            "cover": None,
            "developer": "Wildfire Game",
        },
        {
            "app_name": "21a5a535433b436b8a9ee0877924aa6f",
            "title": "Out There: Omega Edition (Android)",
            "platforms": ["Android"],
            "offline": "true",
            "third_party": "",
            "dl_bytes": 130 * 1024 * 1024,
            "disk_bytes": 160 * 1024 * 1024,
            "exe": "APK",
            "engine": "Native Android",
            "anticheat": False,
            "eos": False,
            "cover": None,
            "developer": "Mi-Clos Studio",
        },
    ])

    allow_adb = ("--live" not in sys.argv) or ("--scan-s20" in sys.argv)
    s20_installed = get_s20_installed(allow_adb=allow_adb)
    enriched = []
    for g in scanned:
        c = classify_game(g, s20_installed)
        db = g["disk_bytes"]
        dlb = g["dl_bytes"]
        enriched.append({
            "appName": g["app_name"],
            "title": g["title"],
            "developer": g.get("developer") or "",
            "platforms": g["platforms"],
            "engine": g["engine"],
            "exe": g["exe"],
            "offline": g["offline"] == "true",
            "diskBytes": db,
            "dlBytes": dlb,
            "diskHuman": fmt_size(db),
            "dlHuman": fmt_size(dlb) if dlb > 0 else "—",
            "cover": g.get("cover"),
            "tier": c["tier"],
            "score": c["score"],
            "category": c["category"],
            "installedS20": c["installedS20"],
            "compatLabel": c["compatLabel"],
            "compatDetail": c["compatDetail"],
        })

    enriched.sort(key=lambda x: (x["tier"], x["diskBytes"] if x["diskBytes"] > 0 else 999999999999, x["title"].lower()))

    counts = {
        "total": len(enriched),
        "installed": sum(1 for x in enriched if x["installedS20"]),
        "nativeOrPort": sum(1 for x in enriched if x["score"] >= 98),
        "greatLight": sum(1 for x in enriched if 90 <= x["score"] < 98),
        "playableMid": sum(1 for x in enriched if 65 <= x["score"] < 90),
        "heavyOrIncompat": sum(1 for x in enriched if x["score"] < 65),
        "drmFree": sum(1 for x in enriched if x["offline"] and x["score"] >= 65),
    }

    now_iso = datetime.now(timezone.utc).isoformat()
    epic_hash = hashlib.sha256(
        json.dumps({"counts": counts, "games": enriched}, sort_keys=True, ensure_ascii=False).encode("utf-8")
    ).hexdigest()[:16]

    payload = {
        "updatedAt": now_iso,
        "hash": epic_hash,
        "account": core.lgd.userdata.get("displayName", "guconstantino"),
        "counts": counts,
        "games": enriched,
    }

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
    print(f"[epic_sync] Gravado {OUT_JSON} ({counts['total']} jogos, {counts['installed']} no S20 FE, hash={epic_hash}).")

    if "--live" in sys.argv or "--force-kv" in sys.argv:
        state_file = Path("/tmp/handheld-hub-live-state.json")
        prev_state = {}
        if state_file.exists():
            try:
                prev_state = json.loads(state_file.read_text())
            except Exception:
                pass

        ports_json_path = ROOT / "public" / "data" / "ports-radar.json"
        s20_ports_sig = sorted(x for x in s20_installed if x)
        last_ports_ts = prev_state.get("lastPortsCheckTs", 0)
        now_ts = datetime.now(timezone.utc).timestamp()
        if allow_adb and (s20_ports_sig != prev_state.get("s20Sig") or (now_ts - last_ports_ts > 3600)):
            rom_tool = Path("/Users/gustavoconstantino/Documents/Github Repositories/s20fe-gamesirx5lite/scripts/rom-tool")
            if rom_tool.exists():
                subprocess.run([str(rom_tool), "check-ports"], check=False)
                last_ports_ts = now_ts

        ports_hash = "none"
        if ports_json_path.exists():
            try:
                pdata = json.loads(ports_json_path.read_text())
                ports_hash = hashlib.sha256(
                    json.dumps({"counts": pdata.get("counts"), "ports": pdata.get("ports")}, sort_keys=True, ensure_ascii=False).encode("utf-8")
                ).hexdigest()[:16]
            except Exception:
                pass

        force = "--force-kv" in sys.argv
        epic_changed = force or (epic_hash != prev_state.get("epicHash"))
        ports_changed = force or (ports_hash != prev_state.get("portsHash"))
        wrangler = str(ROOT / "node_modules" / ".bin" / "wrangler")

        if epic_changed:
            print(f"[epic_sync] Subindo live:epic para Cloudflare KV (hash={epic_hash})...")
            subprocess.run(
                [wrangler, "kv", "key", "put", "--remote", "--binding", "LISTS", "live:epic", "--path", str(OUT_JSON)],
                cwd=str(ROOT),
                check=True,
            )
        if ports_changed and ports_json_path.exists():
            print(f"[epic_sync] Subindo live:ports para Cloudflare KV (hash={ports_hash})...")
            subprocess.run(
                [wrangler, "kv", "key", "put", "--remote", "--binding", "LISTS", "live:ports", "--path", str(ports_json_path)],
                cwd=str(ROOT),
                check=True,
            )
        if epic_changed or ports_changed:
            status_obj = {"epicHash": epic_hash, "portsHash": ports_hash, "updatedAt": now_iso}
            subprocess.run(
                [wrangler, "kv", "key", "put", "--remote", "--binding", "LISTS", "live:status", json.dumps(status_obj)],
                cwd=str(ROOT),
                check=True,
            )
            print("[epic_sync] live:status atualizado no Cloudflare KV!")
        else:
            print("[epic_sync] Nenhuma alteração detectada (KV já está em dia).")

        state_file.write_text(json.dumps({
            "epicHash": epic_hash,
            "portsHash": ports_hash,
            "s20Sig": s20_ports_sig,
            "lastPortsCheckTs": last_ports_ts,
            "updatedAt": now_iso,
        }, indent=2))

    if "--deploy" in sys.argv:
        subprocess.run([str(ROOT / "node_modules" / ".bin" / "wrangler"), "deploy"], cwd=str(ROOT), check=True)


if __name__ == "__main__":
    main()

