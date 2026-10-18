<div align="center">

# 🕹️ Handheld Hub

**Unified edge catalog, health monitor, and multi-device gaming manager syncing 15,000+ titles across heterogeneous consoles.**

[![Live Showcase](https://img.shields.io/badge/Live_Showcase-handheldhub.gustavoconstantino.com-2563EB?style=for-the-badge&logo=cloudflare&logoColor=white)](https://handheldhub.gustavoconstantino.com)
[![Case Study](https://img.shields.io/badge/Case_Study-gustavoconstantino.com-black?style=for-the-badge&logo=safari)](https://gustavoconstantino.com/work/handheld-hub.html)
[![Author](https://img.shields.io/badge/Author-Gustavo_Constantino-0A66C2?style=for-the-badge&logo=linkedin)](https://www.linkedin.com/in/gustavoconstantino/)

<br />

[![Cloudflare Workers](https://img.shields.io/badge/Edge-Cloudflare_Workers-F38020?style=flat-square&logo=cloudflare&logoColor=white)](https://workers.cloudflare.com)
[![Cloudflare D1](https://img.shields.io/badge/Database-Cloudflare_D1_SQL-F38020?style=flat-square&logo=sqlite&logoColor=white)](https://developers.cloudflare.com/d1/)
[![Cloudflare R2](https://img.shields.io/badge/Media-Cloudflare_R2_Zero_Egress-F38020?style=flat-square&logo=cloudflare&logoColor=white)](https://developers.cloudflare.com/r2/)
[![WCAG 2.2 AA](https://img.shields.io/badge/Accessibility-WCAG_2.2_AA_%26_APCA_Lc_≥_75-16A34A?style=flat-square)](https://www.w3.org/WAI/standards-guidelines/wcag/)
[![Zero Build](https://img.shields.io/badge/Frontend-Zero--Build_HTML%2FCSS%2FJS-8B5CF6?style=flat-square)](https://developer.mozilla.org/en-US/docs/Web)
[![License: MIT](https://img.shields.io/badge/License-MIT-gray?style=flat-square)](LICENSE)

<br />

[Live Showcase](https://handheldhub.gustavoconstantino.com) · [Architecture](#-system-architecture) · [Key Features](#-key-features) · [Design System & A11y](#-design-system--accessibility-craft) · [Quick Start](#-quick-start) · [Case Study](https://gustavoconstantino.com/work/handheld-hub.html)

<br />

<a href="https://handheldhub.gustavoconstantino.com">
  <img src="assets/preview.png" alt="Handheld Hub Dashboard Preview" width="100%" style="border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.4);" />
</a>

<p align="center">
  <em>Live dashboard running on <code>handheldhub.gustavoconstantino.com</code>: real-time device health, unified storage telemetry, and multi-platform library indexing.</em>
</p>

</div>

---

## 💡 Overview

**Handheld Hub** is an accessible, zero-build personal gaming portal and serverless edge database that federates **15,000+ games across 5 heterogeneous devices and storage tiers**. 

Built from the ground up by a **Design Systems Engineer & Senior Product Designer**, it demonstrates how design tokens, rigorous accessibility standards (WCAG 2.2 AA + APCA Lc ≥ 75), and modern edge primitives can unify fragmented hardware ecosystems without bulky homelab servers or recurring cloud costs.

### The Problem

Portable retro emulation and modern handheld gaming suffer from severe ecosystem fragmentation:
- **Disparate Operating Systems:** Android handhelds (Samsung Galaxy S20 FE + GameSir X5 Lite), Linux micro-consoles (Miyoo Mini Plus / OnionOS), custom Nintendo Switch CFW (Atmosphère / Mariko), Windows living-room emulation rigs (GPBox), and cloud cold storage (Google Drive / rclone).
- **Siloed File Structures:** Saves, game ROMs, native source ports, and cover art live scattered across internal UFS chips, FAT32/exFAT MicroSD cards, encrypted emuMMC partitions, and remote FTP daemons with zero unified index.
- **Homelab Overhead:** Existing self-hosted managers (like RomM or LaunchBox) require heavy Docker container stacks, continuous CPU idle draw, and local network tunneling.

### The Solution

Handheld Hub replaces heavy infrastructure with an **edge-first, serverless pipeline**:
1. **Lightweight Python Daemons:** High-throughput local collectors ingest file trees directly via Android ADB socket pipelines (`<15ms`), Unix filesystem crawls, streaming FTP parsers, and macOS Secure Enclave APIs.
2. **Deep Deduplication & Integrity Checking:** Detects corrupted dumps via 8-byte magic header inspection and matches cross-platform clones by stripping legacy copier headers (`.smc`, `.smd`).
3. **Pre-Baked Edge Distribution:** Cloudflare Workers + D1 SQLite + Cloudflare R2 object storage deliver sub-50ms query responses and 15,000+ WebP box covers worldwide with **$0 egress fees**.
4. **Zero-Build Accessible Web Portal:** Semantic HTML5, modern CSS custom properties tokens, and vanilla ES modules — zero framework bloat, instant First Contentful Paint, and 100% keyboard, screen-reader, and retro gamepad support.

---

## 🏛️ System Architecture

```
  ┌─────────────────────────────────────────────────────────────────────────────────┐
  │                           HARDWARE & INGESTION LAYER                            │
  └─────────────────────────────────────────────────────────────────────────────────┘
    Galaxy S20 FE         Miyoo Mini Plus          Switch OLED         Windows GPBox       Google Drive
    (Android / ADB)      (OnionOS / Linux)       (DBI FTP Daemon)       (FTP Stream)     (macOS CloudStorage)
           │                     │                      │                    │                    │
    <15ms adb shell        .tmp_update guard       JKSV save crawler    live tree parse       stat metadata
           └─────────────────────┼──────────────────────┼────────────────────┼────────────────────┘
                                 v                      v                    v
  ┌─────────────────────────────────────────────────────────────────────────────────┐
  │                         DATA PROCESSING & INTEGRITY                             │
  │  scanner/scan.py · scripts/catalog.py · scripts/r2_sync.py                      │
  ├─────────────────────────────────────────────────────────────────────────────────┤
  │  • 8-Byte Magic Header Check : Flags corrupted dumps (zeroed blocks)            │
  │  • CRC-32 Copier Stripper    : Removes .smc/.smd headers for No-Intro matching │
  │  • Title Normalization       : NFKD unicode accent folding, canonical aliases   │
  │  • Arcade DAT Mapping        : Maps short filenames (kof98.zip) to full titles │
  │  • Secure Enclave Auth       : P-256 CryptoKit DPoP signature for Epic sync    │
  └─────────────────────────────────────────────────────────────────────────────────┘
                                 │
                 ┌───────────────┴───────────────┐
                 v                               v
    ┌───────────────────────────┐   ┌───────────────────────────┐
    │    SQLite (Cloudflare D1) │   │  Media Storage (Cloudflare │
    │    Structured game_keys,  │   │  R2 Zero-Egress Bucket)   │
    │    locations & metadata   │   │  15,000+ WebP box covers  │
    └───────────────────────────┘   └───────────────────────────┘
                 │                               │
                 └───────────────┬───────────────┘
                                 v
  ┌─────────────────────────────────────────────────────────────────────────────────┐
  │                        EDGE DELIVERY (Cloudflare Workers)                       │
  ├─────────────────────────────────────────────────────────────────────────────────┤
  │  gamehub.gustavoconstantino.com       │  handheldhub.gustavoconstantino.com     │
  │  [Private Admin Environment]          │  [Public Portfolio Showcase]            │
  │  • Cloudflare Zero Trust Access       │  • Public unauthenticated read access   │
  │  • Full ROM / Drive download access   │  • Drive downloads gracefully disabled   │
  │  • Admin maintenance & repair tools   │  • Accessible tooltip & legal guidance  │
  └─────────────────────────────────────────────────────────────────────────────────┘
                                 │
                                 v
  ┌─────────────────────────────────────────────────────────────────────────────────┐
  │                          CLIENT & ACCESSIBILITY LAYER                           │
  ├─────────────────────────────────────────────────────────────────────────────────┤
  │  • Pure HTML5 + CSS Tokens (zero bundlers, zero framework runtime)              │
  │  • Dual-Theme Token Architecture (Light / Dark, WCAG 2.2 AA & APCA Lc ≥ 75)     │
  │  • Command Palette (⌘K / /), Shortcuts Modal (?), Full Focus Restoration       │
  │  • HTML5 Gamepad API Support (gamepad.js): Physical D-pad & stick navigation    │
  │  • Observable Plot & D3 Data Visualizations: CVD-tested categorical palettes    │
  └─────────────────────────────────────────────────────────────────────────────────┘
```

---

## ✨ Key Features

### ⚡ Edge-Native Performance & Zero Egress
- **Sub-50ms Global Query Latency:** Hosted on Cloudflare Workers edge nodes globally.
- **−34% Compressed Payload Optimization:** The static catalog pre-baking pipeline (`scripts/catalog.py`) normalizes redundant Google Drive IDs into indexed lookup structures, reducing compressed catalog transfers from **2.2 MB to 1.4 MB**.
- **Zero Cloud Operating Cost:** Operates 100% within Cloudflare's free tiers (Workers, D1, and R2 with zero egress bandwidth charges).
- **Zero-Build Web Standards:** No Vite, Webpack, or Babel. Native ES modules and CSS custom properties allow instant debugging directly in the browser.

### 📱 Heterogeneous Hardware Ingestion
- **Sub-15ms Android ADB Bridge:** High-performance shell pipelines scan Galaxy S20 FE internal storage and external MicroSD cards in milliseconds, inspecting binary headers and package configurations.
- **Volume Guarding on Unix Mounts:** Checks for signature volume markers (e.g., OnionOS `.tmp_update`) to prevent reading incorrect volumes or partitions.
- **Live FTP Tree Crawlers:** Direct socket streaming queries for Nintendo Switch (via DBI FTP) and Windows living-room setups.
- **Hardware-Level macOS Secure Enclave Auth:** `scripts/epic_sync.py` uses Swift `CryptoKit` to read AES-256 encrypted tokens and sign DPoP JWTs with P-256 keys bound to Apple's **Secure Enclave**, enabling fully headless Epic Games catalog synchronization.

### 🛡️ Binary Integrity & Deep Deduplication
- **Instant Corrupt Dump Detection:** Reads the initial 8-byte file header to detect zeroed blocks and invalid signatures (e.g., zip, chd, gcz, rvz, nsp) without transferring multi-gigabyte disk images.
- **Copier Header Stripping & De-interlacing:** Unpacks and strips 512-byte SNES copier headers (`.smc`) and de-interlaces Sega Mega Drive dumps (`.smd`), resolving identical ROMs regardless of legacy file format quirks.
- **Libretro Arcade Translation:** Matches raw arcade ROM filenames (`kof98.zip`, `sf2.zip`) against official Libretro and FBNeo DATs to render full, human-readable titles.
- **Automated Repair Daemons:** `scripts/fix_corrupted.py` inspects valid alternative mirrors across the ecosystem and performs CRC-verified local repairs.

### 🎨 Design System & Accessibility Craft
- **Rigorous Contrast Baselines:** Every color pair satisfies both **WCAG 2.2 AA (≥ 4.5:1)** and **APCA (Lc ≥ 75)** across Light and Dark modes.
- **Dual-Domain Token Architecture:** Strict semantic tokens (`--bg`, `--surface`, `--control`, `--muted`, `--focus`) prevent color regressions and ensure consistent elevation.
- **Keyboard-First Navigation:**
  - `⌘K` or `/` opens the live Command Palette.
  - `?` opens the Keyboard Shortcuts modal.
  - `g v` navigates to Overview, `g p` to Platforms, `t` toggles color theme.
  - Full focus trapping on modals, accessible `aria-live` announcements, and `preventScroll` focus restoration on `Esc`.
- **Physical Gamepad Support (`gamepad.js`):** Browse the entire collection from your couch using an 8BitDo, Xbox, PlayStation, or Switch controller with D-pad navigation, action triggers, and haptic rumble.
- **Accessible Data Visualizations:** Observable Plot and D3 charts designed with categorical color-vision deficiency (CVD) separation (delta ≥ 8) and accessible tabular screen-reader fallbacks.

### 🔐 Dual-Domain Security Architecture
To allow public demonstration without copyright exposure or private token leakage:
- **Private Environment (`gamehub.gustavoconstantino.com`):** Protected by Cloudflare Access Zero Trust with One-Time PIN and Outlook SSO. Enables private ROM backups and device synchronization.
- **Public Showcase (`handheldhub.gustavoconstantino.com`):** Open to recruiters and the open-source community. Direct file download endpoints respond with `403 Forbidden`, and UI download buttons are gracefully disabled with contextual tooltips (`data-tip`) and a legal compliance guidance modal.
- **Configuration Isolation:** Real IP addresses and local storage mounts live in gitignored `scanner/devices.local.json`, while the repository only tracks the sanitized `scanner/devices.json` template.

---

## 📊 Live Scale & Device Matrix

| Device | System / OS | Ingestion Method | Role in Ecosystem | Typical Library |
|---|---|---|---|---|
| **Samsung Galaxy S20 FE** | Android 13 · Snapdragon 865 | ADB Socket Bridge (`<15ms`) | Primary portable powerhouse · Daijishō front-end | 10,400+ games · 41 systems · 25 native ports |
| **Miyoo Mini Plus** | OnionOS 4.3 (Linux ARM) | Unix mount + `.tmp_update` guard | Pocket retro micro-console · 3.5" IPS 4:3 | 6,400+ games · 22 retro systems |
| **Nintendo Switch OLED** | Atmosphère CFW · Mariko | DBI FTP Daemon | Hybrid handheld · JKSV save manager integration | Installed library + active save tracking |
| **PC · GPBox** | Windows 11 Emulation Rig | Streaming FTP parser | High-end arcade & 3D emulation | 5,900+ games · 56 systems |
| **Cloud Vault** | Google Drive (rclone) | macOS CloudStorage `os.stat` | Master cold-storage backup mirror | 15,000+ files cataloged |

---

## 🗂️ Project Structure

```
handheld-hub/
├── assets/                 # Brand assets, preview screenshots, and vector icons
│   ├── icons/              # 24x24 Lucide SVG icons tailored for crisp Retina stroke
│   └── preview.png         # High-resolution dashboard screenshot
├── docs/                   # Engineering documentation (PT-BR canonical records)
│   ├── ARCHITECTURE.md     # Ingestion flow, database schema, and edge routing
│   ├── DECISIONS.md        # Architecture Decision Records (ADRs)
│   ├── LEARNINGS.md        # Technical gotchas (macOS Secure Enclave, DPoP, CRC-32)
│   └── ROADMAP.md          # Multi-phase milestone roadmap
├── migrations/             # Cloudflare D1 SQLite database migrations
│   └── 0001_init.sql       # Devices, locations, and files relational schema
├── public/                 # Zero-build web frontend (deployed to edge assets)
│   ├── app.js              # Application core, routing, state, and UI bindings
│   ├── hh-api.js           # Client-side catalog search and query engine
│   ├── gamepad.js          # HTML5 Gamepad API controller support & haptics
│   ├── charts.js           # Observable Plot / D3 accessible dataviz
│   ├── search.js           # ⌘K command palette fuzzy search index
│   ├── styles.css          # Semantic CSS tokens (WCAG 2.2 AA / APCA compliant)
│   ├── icons.svg           # Optimized SVG icon sprite sheet
│   └── data/               # Pre-baked static catalog, ports radar, and specs
├── scanner/                # Hardware ingestion daemons (Python 3.9+, zero deps)
│   ├── scan.py             # Multi-device crawler (ADB, Unix, FTP, CloudStorage)
│   ├── devices.json        # Sanitized device schema template
│   └── devices.local.json  # Gitignored private hostnames, IPs, and paths
├── scripts/                # Edge synchronization & maintenance utilities
│   ├── catalog.py          # Pre-bakes D1 SQLite database into optimized JSON (−34%)
│   ├── epic_sync.py        # Headless Epic Games sync via macOS Secure Enclave
│   ├── r2_sync.py          # Resumable Cloudflare R2 WebP cover art uploader
│   ├── fix_corrupted.py    # CRC-verified file recovery utility
│   └── build_static.py     # Single-file HTML bundle builder
└── wrangler.jsonc          # Cloudflare Workers, D1, and R2 configuration
```

---

## 🚀 Quick Start

### Prerequisites
- **Node.js 18+** & **npm**
- **Python 3.9+** (uses standard library only; zero pip dependencies)
- **Android SDK Platform-Tools** (`adb` on PATH, optional for S20 FE scanning)
- **Cloudflare Wrangler CLI** (`npm install` installs it locally)

### 1. Clone & Install
```bash
git clone https://github.com/guconstantino/handheld-hub.git
cd handheld-hub
npm install
```

### 2. Configure Devices
Create your private device definition file from the sanitized template:
```bash
cp scanner/devices.json scanner/devices.local.json
```
Edit `scanner/devices.local.json` with your local mount paths, device serials, or FTP credentials. (This file is strictly gitignored).

### 3. Initialize Local Edge Database
Apply SQLite migrations to your local Cloudflare D1 development environment:
```bash
npm run db:migrate
```

### 4. Ingest Hardware & Build Catalog
Run the ingestion daemons for your connected devices:
```bash
# Scan Android device over ADB
npm run scan:s20

# Scan local/cloud backup directories
npm run scan:drive

# Pre-bake optimized static catalog (−34% compression)
npm run catalog
```

### 5. Launch Local Dev Server
```bash
npm run dev
```
Open **[http://localhost:8787](http://localhost:8787)** to explore the portal with live hot-reloading.

---

## ⌨️ Keyboard & Gamepad Shortcuts

The interface is built to be controlled entirely without a mouse:

| Shortcut | Action | Scope |
|---|---|---|
| `⌘K` or `/` | Open Command Palette / Global Search | Everywhere |
| `?` | Open Keyboard Shortcuts Modal | Everywhere |
| `g` then `v` | Navigate to **Visão Geral** (Overview) | Global |
| `g` then `p` | Navigate to **Plataformas** (Platforms) | Global |
| `g` then `j` | Navigate to **Jogos** (Games Catalog) | Global |
| `g` then `s` | Navigate to **Saúde** (Library Health & Corrupted) | Global |
| `t` | Toggle Theme (Dark / Light) | Global |
| `Esc` | Close dialogs, tooltips, or command palette (restores focus) | Modals / Dialogs |
| **D-Pad / Left Stick** | Grid card navigation & focus | Gamepad |
| **Button A / ✕** | Select / Open item | Gamepad |
| **Button B / ○** | Back / Close modal | Gamepad |

---

## ♿ Accessibility & Performance Metrics

| Audit Dimension | Target / Benchmark | Handheld Hub Result | Verification Method |
|---|---|---|---|
| **WCAG Contrast** | WCAG 2.2 AA (≥ 4.5:1 text, ≥ 3.0:1 controls) | **Passed (100%)** | Automated headless script + manual contrast audit |
| **APCA Legibility** | APCA Lc ≥ 75 for body text (13–14px) | **Passed (Lc ≥ 78)** | APCA 0.0.98G contrast calculator |
| **Lighthouse Score** | 100 Accessibility, 100 Best Practices | **100 / 100** | Google Chrome DevTools Audit |
| **Keyboard Nav** | No keyboard traps, visible focus rings, focus restore | **100% compliant** | Tab-only navigation test & `preventScroll` |
| **Screen Readers** | Dynamic counter updates, semantic headings | **`aria-live` & landmark roles** | VoiceOver on macOS & iOS Safari |
| **Network Payload** | Compressed catalog size | **1.4 MB (−34% from 2.2 MB)** | Brotli / Gzip static asset pre-bake |
| **Edge TTFB** | Sub-100ms global response | **< 50ms average** | Cloudflare Workers Edge Network |

---

## 🛠️ Available NPM Scripts

| Command | Description |
|---|---|
| `npm run dev` | Starts local Cloudflare Worker development server on port 8787 |
| `npm run db:migrate` | Applies SQLite schema migrations to the local D1 database |
| `npm run scan:s20` | Scans Samsung Galaxy S20 FE internal and MicroSD storage via ADB |
| `npm run scan:drive` | Scans Google Drive / cloud storage directory manifests |
| `npm run scan:miyoo` | Crawls OnionOS MicroSD card with volume marker validation |
| `npm run scan:switch` | Queries Nintendo Switch DBI FTP daemon for titles and saves |
| `npm run scan:epic` | Synchronizes Epic Games library via macOS Secure Enclave DPoP auth |
| `npm run scan:ports` | Scans installed native source ports on Android hardware |
| `npm run catalog` | Compiles local D1 SQL data into compressed static `catalog.json` |
| `npm run r2` | Uploads converted WebP cover art to Cloudflare R2 bucket |
| `npm run build:static` | Generates a standalone, zero-dependency offline HTML file |

---

## 📚 Deep Documentation

Comprehensive architectural records and platform gotchas are maintained in the repository:

- 🏛️ [**Architecture Guide** (docs/ARCHITECTURE.md)](docs/ARCHITECTURE.md) — Detailed collector mechanics, D1 schema, and query pipelines.
- 📋 [**Architecture Decision Records** (docs/DECISIONS.md)](docs/DECISIONS.md) — Dual-domain isolation, R2 storage tradeoffs, accessibility baselines, and static caching.
- 💡 [**Technical Learnings** (docs/LEARNINGS.md)](docs/LEARNINGS.md) — Deep platform quirks: macOS Secure Enclave DPoP authentication, FAT32/exFAT header stripping, and Cloudflare Access policies.
- 🗺️ [**Project Roadmap** (docs/ROADMAP.md)](docs/ROADMAP.md) — Hardware milestones, planned device ingestion, and feature progression.

---

## 👤 Author

**Gustavo Constantino**  
*Design Systems Engineer & Senior Product Designer*  
*iF DESIGN AWARD 2026 Winner · Lead Designer for CastanhaDS (Caju) · Ex-Itaú Unibanco*

- 🌐 **Portfolio & Case Study:** [gustavoconstantino.com/work/handheld-hub.html](https://gustavoconstantino.com/work/handheld-hub.html)
- 💼 **LinkedIn:** [linkedin.com/in/gustavoconstantino](https://www.linkedin.com/in/gustavoconstantino/)
- 🐙 **GitHub:** [@guconstantino](https://github.com/guconstantino)

---

## 📄 License & Attributions

This project is open-source under the [MIT License](LICENSE).

### Attributions
- Device photography: Samsung Galaxy S20 FE by *GadgetsGuy* & Nintendo Switch OLED by *PantheraLeo1359531* ([Wikimedia Commons, CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)).
- Icons: [Lucide Icons](https://lucide.dev) (ISC License) tailored for 1.5px CSS Retina grid alignment, and [Simple Icons](https://simpleicons.org).
- Typography: [Geist Sans & Geist Mono](https://vercel.com/font) by Vercel.

<div align="center">
  <sub>Crafted with obsessive precision for design tokens, edge performance, and retro gaming preservation.</sub>
</div>
