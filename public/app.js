// Handheld Hub: lê a API do Worker e monta as telas (visão geral, console, jogos, saúde).

const $ = (s) => document.querySelector(s);
// No snapshot estático (scripts/build_static.py), window.HH_API responde no lugar do Worker.
const api = (path) => window.HH_API ? window.HH_API(path) : fetch(path).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${path}: ${r.status}`))));
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtN = (n) => Number(n || 0).toLocaleString("pt-BR");
const fmtP = (x) => (x > 0 && x < 0.1 ? "<0,1%" : `${x.toLocaleString("pt-BR", { maximumFractionDigits: x < 1 ? 1 : 0 })}%`);
const fmtB = (b) => {
  if (!b) return "—";
  const u = ["B", "KB", "MB", "GB", "TB"]; let i = 0; let v = b;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toLocaleString("pt-BR", { maximumFractionDigits: v < 10 && i > 2 ? 1 : 0 })} ${u[i]}`;
};
// Data pura (AAAA-MM-DD) vira meio-dia local para não voltar um dia por causa do fuso.
const fmtDate = (s) => (s ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T12:00` : s).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "nunca");

const icon = (name, cls = "") => `<svg class="ic ${cls}" aria-hidden="true"><use href="icons.svg#i-${name}"/></svg>`;
// Logo decorativo: o nome do console já está escrito ao lado.
const logo = (d, cls = "") => {
  const id = (d.specs || {}).logo;
  if (!id) return "";
  if (id.startsWith("i-")) return icon(id.slice(2), cls);
  return `<svg class="logo ${id === "b-samsung" ? "wide" : ""} ${cls}" aria-hidden="true"><use href="icons.svg#${id}"/></svg>`;
};
// Foto de capa de estúdio de cada console. Sem foto: o logo grande.
const COVER = { s20fe: "img/s20fe.webp?v=2", miyoo: "img/miyoo.webp?v=2", switch: "img/switch.webp?v=2", drive: "img/drive.webp?v=2" };
const DEV_TAG = {
  s20fe: "SM-G780G · X5 Lite",
  miyoo: "OnionOS · RetroArch",
  switch: "Atmosphère · emuMMC",
  drive: "Cloud Vault · rclone",
};
const DEV_SUB = {
  s20fe: "Snapdragon 865 · Daijishō · 25 Ports nativos",
  miyoo: "SigmaStar · 3,5\" IPS 4:3 · 81 traduções PT-BR",
  switch: "Mariko CFW 22.5 · hekate + JKSV · Offline",
  drive: "Espelho mestre na nuvem · Games/Retrogame",
};
const cover = (d, badges = "") => `<div class="cover">${COVER[d.id]
  ? `<img src="${COVER[d.id]}" alt="" loading="lazy" decoding="async">`
  : logo(d, "logo-big")}${badges}</div>`;
// Cor de cada console vem do CSS (paleta validada nos dois temas), pelo atributo data-dev.
const dev = (id) => `data-dev="${esc(id)}"`;
// Ordem fixa dos consoles nos gráficos (a cor segue o console, nunca a posição).
const ORDER = ["switch", "s20fe", "drive", "miyoo"];

// Nome de exibição de cada sistema (o id fica nos filtros e no código).
const SYSTEM_NAME = {
  "3do": "3DO", "3ds": "Nintendo 3DS", arcade: "Arcade", atari2600: "Atari 2600", atari5200: "Atari 5200",
  atari7800: "Atari 7800", atomiswave: "Atomiswave", c64: "Commodore 64", colecovision: "ColecoVision",
  cps1: "CPS-1", cps2: "CPS-2", cps3: "CPS-3", dreamcast: "Dreamcast", fbneo: "FinalBurn Neo", fds: "Famicom Disk System",
  gamecube: "GameCube", gamegear: "Game Gear", gb: "Game Boy", gba: "Game Boy Advance", gbc: "Game Boy Color",
  intellivision: "Intellivision", jaguar: "Atari Jaguar", lightgun: "Light Gun", lutro: "Lutro", lynx: "Atari Lynx",
  mame: "MAME", mastersystem: "Master System", megadrive: "Mega Drive", model2: "Sega Model 2", model3: "Sega Model 3",
  msx: "MSX", msx2: "MSX2", n64: "Nintendo 64", naomi: "NAOMI", nds: "Nintendo DS", neogeo: "Neo Geo",
  neogeocd: "Neo Geo CD", nes: "NES", ngp: "Neo Geo Pocket", ngpc: "Neo Geo Pocket Color", pcengine: "PC Engine",
  pcenginecd: "PC Engine CD", pinballfx3: "Pinball FX3", ports: "Ports", ps2: "PlayStation 2", psp: "PSP",
  psx: "PlayStation", sega32x: "Sega 32X", segacd: "Sega CD", sg1000: "SG-1000", snes: "Super Nintendo",
  sufami: "Sufami Turbo", supergrafx: "SuperGrafx", switch: "Nintendo Switch", triforce: "Triforce",
  vectrex: "Vectrex", virtualboy: "Virtual Boy", wii: "Wii", windows: "Windows", wswanc: "WonderSwan Color",
};
const sysName = (id) => SYSTEM_NAME[id] || id;
// Ficha de cada plataforma para ordenar/agrupar: [ano de lançamento, geração de console (null = arcade/PC), fabricante].
const PLATFORM_META = {
  "3do": [1993, 5, "Panasonic"], "3ds": [2011, 8, "Nintendo"], arcade: [null, null, "Arcade"], atari2600: [1977, 2, "Atari"],
  atari5200: [1982, 2, "Atari"], atari7800: [1986, 3, "Atari"], atomiswave: [2003, null, "Arcade"], c64: [1982, null, "Commodore"],
  colecovision: [1982, 2, "Coleco"], cps1: [1988, null, "Arcade"], cps2: [1993, null, "Arcade"], cps3: [1996, null, "Arcade"],
  dreamcast: [1998, 6, "Sega"], fbneo: [null, null, "Arcade"], fds: [1986, 3, "Nintendo"], gamecube: [2001, 6, "Nintendo"],
  gamegear: [1990, 4, "Sega"], gb: [1989, 4, "Nintendo"], gba: [2001, 6, "Nintendo"], gbc: [1998, 5, "Nintendo"],
  intellivision: [1979, 2, "Mattel"], jaguar: [1993, 5, "Atari"], lightgun: [null, null, "Arcade"], lutro: [null, null, "Homebrew"],
  lynx: [1989, 4, "Atari"], mame: [null, null, "Arcade"], mastersystem: [1985, 3, "Sega"], megadrive: [1988, 4, "Sega"],
  model2: [1993, null, "Arcade"], model3: [1996, null, "Arcade"], msx: [1983, null, "MSX"], msx2: [1985, null, "MSX"],
  n64: [1996, 5, "Nintendo"], naomi: [1998, null, "Arcade"], nds: [2004, 7, "Nintendo"], neogeo: [1990, 4, "SNK"],
  neogeocd: [1994, 5, "SNK"], nes: [1983, 3, "Nintendo"], ngp: [1998, 5, "SNK"], ngpc: [1999, 5, "SNK"],
  pcengine: [1987, 4, "NEC"], pcenginecd: [1988, 4, "NEC"], pinballfx3: [2017, null, "PC"], ports: [null, null, "Android"],
  ps2: [2000, 6, "Sony"], psp: [2004, 7, "Sony"], psx: [1994, 5, "Sony"], sega32x: [1994, 4, "Sega"], segacd: [1991, 4, "Sega"],
  sg1000: [1983, 3, "Sega"], snes: [1990, 4, "Nintendo"], sufami: [1996, 4, "Bandai"], supergrafx: [1989, 4, "NEC"],
  switch: [2017, 8, "Nintendo"], triforce: [2002, null, "Arcade"], vectrex: [1982, 2, "GCE"], virtualboy: [1995, 5, "Nintendo"],
  wii: [2006, 7, "Nintendo"], windows: [null, null, "PC"], wswanc: [2000, 5, "Bandai"],
};
const meta = (id) => { const [ano, ger, fab] = PLATFORM_META[id] || [null, null, "Outros"]; return { ano, ger, fab }; };
const genLabel = (g) => (g ? `${g}ª geração` : "Arcade, computadores e outros");
// Ordenações (a mesma lista serve às plataformas e aos gráficos). Empates sempre por nome.
const byName = (a, b) => sysName(a.system).localeCompare(sysName(b.system), "pt-BR");
const SORTS = {
  jogos: { label: "Mais jogos", fn: (a, b) => b.games - a.games || byName(a, b) },
  nome: { label: "Nome (A–Z)", fn: byName },
  ano: { label: "Lançamento (mais antigo)", fn: (a, b) => (meta(a.system).ano ?? 9999) - (meta(b.system).ano ?? 9999) || byName(a, b) },
  geracao: { label: "Geração", fn: (a, b) => (meta(a.system).ger ?? 99) - (meta(b.system).ger ?? 99) || (meta(a.system).ano ?? 9999) - (meta(b.system).ano ?? 9999) || byName(a, b), group: (p) => genLabel(meta(p.system).ger) },
  fabricante: { label: "Fabricante", fn: (a, b) => meta(a.system).fab.localeCompare(meta(b.system).fab, "pt-BR") || (meta(a.system).ano ?? 9999) - (meta(b.system).ano ?? 9999), group: (p) => meta(p.system).fab },
  capasMenos: { label: "Menos capas (%)", fn: (a, b) => a.covered / a.games - b.covered / b.games || b.games - a.games },
  capasMais: { label: "Mais capas (%)", fn: (a, b) => b.covered / b.games - a.covered / a.games || b.games - a.games },
};
const pref = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
const setPref = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
// Preferências sincronizadas entre aparelhos (KV do Worker, por usuário do Access). Toda gravação dessas chaves no
// localStorage agenda um envio (1,5 s depois, juntando mudanças seguidas). Ao abrir, as do servidor vencem.
const SYNC_KEYS = ["hh_ra_user", "hh_theme", "hh_ptheme", "hh_layout", "hh_view", "hh_gsort", "hh_tsort", "hh_csort", "hh_psort", "hh_gpsort", "hh_listtab", "hh_keys", "hh-trusted-hosts"];
const PREFS = { on: false, timer: null };
const prefSnapshot = () => {
  const o = {};
  for (const k of SYNC_KEYS) { try { const v = localStorage.getItem(k); if (v != null) o[k] = v; } catch {} }
  return o;
};
function schedulePrefSync() {
  if (!PREFS.on) return;
  clearTimeout(PREFS.timer);
  PREFS.timer = setTimeout(() => fetch("api/prefs", { method: "PUT", credentials: "same-origin", headers: { "content-type": "application/json" },
    body: JSON.stringify(prefSnapshot()) }).catch(() => {}), 1500);
}
try {
  const { setItem, removeItem } = Storage.prototype;
  Storage.prototype.setItem = function (k, v) { setItem.call(this, k, v); if (this === localStorage && SYNC_KEYS.includes(k)) schedulePrefSync(); };
  Storage.prototype.removeItem = function (k) { removeItem.call(this, k); if (this === localStorage && SYNC_KEYS.includes(k)) schedulePrefSync(); };
} catch {}
// Busca as do servidor; devolve as chaves que mudaram neste aparelho (para aplicar sem recarregar).
async function loadPrefs() {
  let remote;
  try { const r = await fetch("api/prefs", { credentials: "same-origin" }); if (!r.ok) return []; remote = await r.json(); } catch { return []; }
  const changed = [];
  for (const [k, v] of Object.entries(remote || {})) {
    if (!SYNC_KEYS.includes(k) || (k === "hh_theme" && !["light", "dark"].includes(v))) continue;
    try { if (localStorage.getItem(k) !== v) { Storage.prototype.setItem.call(localStorage, k, v); changed.push(k); } } catch {}
  }
  PREFS.on = true;
  // Este aparelho tem preferência que o servidor ainda não tem (primeira vez): envia.
  if (Object.entries(prefSnapshot()).some(([k]) => !(k in (remote || {})))) schedulePrefSync();
  return changed;
}
// Tema das plataformas: "Arrow" (padrão, em public/platforms/) ou um pacote do Daijishō (R2, /themes/<id>/).
// Plataforma que o tema não cobre usa a imagem padrão do próprio tema; sem ela, volta para o Arrow.
const THEME = { list: [], cur: null };
const platImg = (s) => {
  const t = THEME.cur;
  if (t && t.systems.includes(s)) return `themes/${t.id}/${encodeURIComponent(s)}.webp`;
  if (t && t.default) return `themes/${t.id}/_default.webp#${encodeURIComponent(s)}`;   // #sistema: troca ao vivo
  return `platforms/${encodeURIComponent(s)}.webp`;
};
window.HH_PLATIMG = platImg;
// Seletor de ordenação reutilizável (rótulo visível para acessibilidade).
const sortSelect = (id, keys, value) => `<label class="sort"><span>Ordenar</span><select id="${id}">${keys.map((k) =>
  `<option value="${k}" ${k === value ? "selected" : ""}>${SORTS[k].label}</option>`).join("")}</select></label>`;

// Ícone de cada título de seção das fichas (devices.json).
const SECTION_ICON = {
  "Emuladores": "gamepad-2", "Ports nativos": "package", "Ajustes": "wrench", "Atenção": "triangle-alert",
  "Boot (hekate)": "power", "Segurança e offline": "shield-check", "Sysmodules": "cpu", "Homebrew": "package",
  "Backups e reinstalação": "archive", "Acervo": "layers", "Saves": "cloud", "Extras": "puzzle",
  "Ficha": "info", "Armazenamento": "hard-drive",
};
const sectionTitle = (title) => `<h2>${SECTION_ICON[title] ? icon(SECTION_ICON[title], "sm") : ""}${esc(title)}</h2>`;

const state = { devices: [], locations: [], offset: 0, loaded: {}, health: null };
const deviceOf = (id) => state.devices.find((d) => d.id === id) || {};
const locOf = (id) => state.locations.find((l) => l.id === id) || {};
// Rótulo curto de uma cópia: "S20 FE · Cartão SD", ou só "Drive" quando o device tem um local só.
const shortName = (d) => (d.name || "").replace(/^(Galaxy|Google|Nintendo) /, "");
const copyLabel = (d, locId) => {
  const many = state.locations.filter((l) => l.device_id === d.id).length > 1;
  return many ? `${shortName(d)} · ${locOf(locId).label}` : shortName(d);
};

// ---------- tema ----------
// Migração: o tema das plataformas chegou a ser gravado em "hh_theme" (a chave do claro/escuro). Move para "hh_ptheme".
try {
  const t = localStorage.getItem("hh_theme");
  if (t && t !== "light" && t !== "dark") { localStorage.setItem("hh_ptheme", t); localStorage.removeItem("hh_theme"); }
} catch {}
try { const t = localStorage.getItem("hh_theme"); if (t) document.documentElement.dataset.theme = t; } catch {}
const isDark = () => document.documentElement.dataset.theme
  ? document.documentElement.dataset.theme === "dark"
  : matchMedia("(prefers-color-scheme: dark)").matches;
// O rótulo diz o que o botão faz agora ("Usar tema claro"), não um "alternar" genérico.
const themeLabel = () => { const l = isDark() ? "Usar tema claro" : "Usar tema escuro"; $("#themeToggle").setAttribute("aria-label", l); $("#themeToggle").title = l; };
$("#themeToggle").onclick = () => {
  const t = isDark() ? "light" : "dark";
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem("hh_theme", t); } catch {}
  themeLabel();
};
themeLabel();

// Atalho "Pular para o conteúdo": foca o título da tela atual (o hash é usado pelas rotas).
// preventScroll: o foco vai ao título (leitor de tela anuncia a tela) sem desfazer a rolagem restaurada.
const focusHeading = () => { const h = document.querySelector(".view:not(.hidden) h1"); if (h) h.focus({ preventScroll: true }); };
$("#skip").onclick = focusHeading;

// Dica flutuante dos gráficos (só mouse; o mesmo dado está escrito na legenda ou na linha).
document.addEventListener("mousemove", (e) => {
  const el = e.target.closest("[data-tip]"); const tip = $("#tip");
  if (!el) { tip.classList.add("hidden"); return; }
  tip.textContent = el.dataset.tip; tip.style.left = `${e.clientX}px`; tip.style.top = `${e.clientY}px`;
  tip.classList.remove("hidden");
});

// ---------- rotas: #overview, #device/<id>, #games, #health ----------
function route(moveFocus = false) {
  curView = null;                                   // a troca de tela muda a altura: não gravar essa rolagem
  const [view, arg] = (location.hash.slice(1) || "overview").split(/[/-](.*)/);
  const target = ["overview", "device", "platforms", "platform", "game", "games", "ports", "epic", "lists", "compare", "health", "settings", "admin"].includes(view) ? view : "overview";
  document.querySelectorAll(".nav a").forEach((a) => {
    const on = a.dataset.view === ({ device: "overview", platform: "platforms", game: "games" }[target] || target);
    a.classList.toggle("active", on);
    if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("hidden", v.id !== `view-${target}`));
  if (target === "device") renderDevice(arg);
  if (target === "platforms" && !state.loaded.platforms) { state.loaded.platforms = true; loadPlatforms(); }
  const pending = target === "platform" ? renderPlatform(arg) : target === "game" ? renderGame(decodeURIComponent(arg || "")) : null;
  if (target === "games" && !state.loaded.games) { state.loaded.games = true; loadGames(); }
  if (target === "ports") renderPorts();
  if (target === "epic") renderEpic();
  if (target === "overview" && state.loaded.mine) loadMine();
  if (target === "overview") state.loaded.mine = true;
  if (target === "health" && !state.loaded.health) { state.loaded.health = true; loadHealth(); }
  if (target === "compare" && !state.loaded.compare) { state.loaded.compare = true; initCompare(); drawMatrix(); }
  if (target === "lists") drawLists();
  if (target === "settings") drawSettings();
  if (target === "admin") renderAdmin();
  const h1 = document.querySelector(`#view-${target} h1`);
  document.title = h1 && target !== "overview" ? `${h1.textContent} · Handheld Hub` : "Handheld Hub";
  // Telas de lista voltam para onde estavam (abrir um jogo e voltar não perde a posição); detalhe abre no topo.
  window.scrollTo(0, KEEP_SCROLL.has(target) ? scrollMem[target] || 0 : 0);
  curView = target;
  window.HH_CHARTS?.redraw();                       // gráficos desenhados com a tela escondida ganham a largura certa
  // Troca de tela sem recarregar: leva o foco ao título para o leitor de tela anunciar a tela nova.
  if (moveFocus) (pending || Promise.resolve()).then(focusHeading);
  return pending;
}
const KEEP_SCROLL = new Set(["overview", "games", "platforms", "ports", "epic", "lists", "health", "compare"]);
const scrollMem = {};
let curView = null;
addEventListener("scroll", () => {
  if (curView) scrollMem[curView] = scrollY;
  $("#toTop").hidden = scrollY < innerHeight * 2;
}, { passive: true });
$("#toTop").onclick = () => {
  scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  focusHeading();                                     // teclado/leitor de tela também voltam ao começo
};
// Com fx.js, a troca de tela usa View Transitions (a arte da plataforma "cresce" até o topo).
window.addEventListener("hashchange", () => {
  if (!window.HH_TRANSITION) return route(true);
  window.HH_TRANSITION(() => route(true)).finally(() =>
    document.querySelectorAll(".ptile img, a[href^='#game-'] img, .ghero-cover img").forEach((i) => (i.style.viewTransitionName = "")));
});

// ---------- armazenamento (varrido ou declarado no devices.json) ----------
function storageOf(d) {
  const scanned = state.locations.filter((l) => l.device_id === d.id).map((l) => ({
    label: l.label, cloud: d.kind === "backup", total: l.total_bytes, free: l.free_bytes, files: l.files, corrupted: l.corrupted, last: l.last_scan,
  }));
  // Local varrido sem espaço (ex.: FTP do Switch) usa o espaço declarado na ficha.
  return scanned.some((s) => s.total) ? scanned : (d.specs.storage || scanned);
}
function storageHtml(s) {
  const used = s.total ? Math.round(((s.total - s.free) / s.total) * 100) : null;
  const right = s.total ? `${fmtB(s.free)} livres / ${fmtB(s.total)} · ${used}%` : s.files != null ? `${fmtN(s.files)} arquivos` : "";
  return `<div class="meter">
    <div class="meter-row"><span>${icon(s.cloud ? "cloud" : "hard-drive", "sm")}${esc(s.label)}</span><span>${right}</span></div>
    ${used !== null ? `<div class="bar"><i style="width:${used}%"></i></div>` : ""}
  </div>`;
}

function s20CoverLivePill(bad) {
  const dev = s20Telemetry?.device;
  if (dev && dev.batteryPct != null) {
    const bat = `${dev.charging ? "⚡" : "🔋"} ${dev.batteryPct}%`;
    const tmp = dev.tempC != null ? ` · ${dev.tempC.toFixed(1)}°C` : "";
    return `<span class="cover-pill live" data-dev-live="s20fe">${bat}${tmp}</span>`;
  }
  return bad
    ? `<span class="cover-pill warn" data-dev-live="s20fe">${fmtN(bad)} alertas</span>`
    : `<span class="cover-pill live" data-dev-live="s20fe">✓ Íntegro</span>`;
}

// ---------- visão geral ----------
async function loadSummary() {
  const s = await api("/api/summary");
  state.devices = s.devices; state.locations = s.locations; state.stats = s.stats || {};
  const t = s.totals;
  // Espaço livre somado de tudo que tem tamanho conhecido (varrido ou declarado na ficha).
  const disks = s.devices.flatMap((d) => storageOf(d)).filter((x) => x.total);
  const free = disks.reduce((n, x) => n + (x.free || 0), 0);
  const total = disks.reduce((n, x) => n + x.total, 0);
  const covPct = t.games ? (t.covers / t.games) * 100 : 0;
  // Bloco destaque: total de jogos + anel com a % de capas (o número fica escrito ao lado).
  const R = 52, C = 2 * Math.PI * R;
  $("#hero").innerHTML = `
    <div class="hero-main">
      <span class="kpi-label">${icon("gamepad-2", "sm")}Jogos no acervo</span>
      <span class="hero-num">${fmtN(t.games)}</span>
      <span class="kpi-sub">títulos únicos em ${fmtN(t.systems)} plataformas, ${fmtN(t.files)} arquivos em ${s.locations.length} lugares</span>
      <a class="hero-link" href="#platforms">Ver plataformas ${icon("chevron-right", "sm")}</a>
    </div>
    <figure class="ring">
      <svg viewBox="0 0 120 120" aria-hidden="true"><circle class="ring-bg" cx="60" cy="60" r="${R}"/>
        <circle class="ring-fg" cx="60" cy="60" r="${R}" stroke-dasharray="${(covPct / 100) * C} ${C}"/></svg>
      <figcaption><b>${fmtP(covPct)}</b><span>com capa</span><span class="ring-sub">${fmtN(t.covers)} de ${fmtN(t.games)}</span></figcaption>
    </figure>`;
  $("#stats").innerHTML = [
    ["Arquivos", fmtN(t.files), "folder-open", `cópias em ${s.locations.length} lugares`],
    ["Plataformas", fmtN(t.systems), "layers", "sistemas no acervo"],
    ["Espaço livre", fmtB(free), "hard-drive", `de ${fmtB(total)} nos consoles`],
    ["Corrompidos", fmtN(t.corrupted), "triangle-alert", t.corrupted ? "precisam de cópia nova" : "nenhum problema", t.corrupted > 0],
  ].map(([l, v, ic, sub, bad]) => `<div class="tile kpi b-kpi ${bad ? "bad" : ""}">
      <span class="kpi-label">${icon(ic, "sm")}${l}</span><span class="kpi-value">${v}</span><span class="kpi-sub">${sub}</span></div>`).join("");

  $("#devices").innerHTML = s.devices.map((d) => {
    const st = (s.stats || {})[d.id] || { games: 0, systems: 0, covered: 0, noBackup: 0, driveOnly: 0 };
    const bad = s.locations.filter((l) => l.device_id === d.id).reduce((n, l) => n + (l.corrupted || 0), 0);
    const lastScan = s.locations.filter((l) => l.device_id === d.id).map((l) => l.last_scan).filter(Boolean).sort().pop();
    const nums = [
      ["Jogos", fmtN(st.games)], ["Sistemas", fmtN(st.systems)],
      ["Capas", st.games ? fmtP((st.covered / st.games) * 100) : "—"],
      d.id === "drive" ? ["Só Drive", fmtN(st.driveOnly)] : ["S/ backup", fmtN(st.noBackup)],
    ];
    const hwTag = DEV_TAG[d.id] || d.kind;
    const statusPill = d.id === "s20fe"
      ? s20CoverLivePill(bad)
      : bad
        ? `<span class="cover-pill warn">${fmtN(bad)} alertas</span>`
        : `<span class="cover-pill live">✓ Íntegro</span>`;
    const badgesHtml = `<div class="cover-badges"><span class="cover-pill">${esc(hwTag)}</span>${statusPill}</div>`;
    return `<article class="device b-dev" ${dev(d.id)}>
      ${cover(d, badgesHtml)}
      <div class="device-body">
        <div class="device-head">
          <h3 class="device-name"><span class="dot"></span><a class="device-link" href="#device-${esc(d.id)}">${esc(d.name)}</a><span style="margin-left:auto;display:flex">${logo(d)}</span></h3>
          <p class="device-sub">${esc(DEV_SUB[d.id] || d.notes || "")}</p>
        </div>
        <dl class="nums">${nums.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>
        <div class="meters">${storageOf(d).map(storageHtml).join("")}</div>
        <div class="device-foot">
          <span class="scan-meta">${bad
            ? `<span class="badge bad small">${icon("triangle-alert", "sm")}${fmtN(bad)} corrompidos</span>`
            : `Varrido ${fmtDate(lastScan)}`}</span>
          <span class="more" aria-hidden="true">Explorar ${icon("chevron-right", "sm")}</span>
        </div>
      </div>
    </article>`;
  }).join("");

  // Onde estão os arquivos: barra empilhada por console, ordem fixa, legenda com números (é a tabela).
  const byDev = ORDER.map((id) => ({ d: deviceOf(id), n: s.locations.filter((l) => l.device_id === id).reduce((a, l) => a + (l.files || 0), 0) })).filter((x) => x.d.id);
  const sum = byDev.reduce((a, x) => a + x.n, 0) || 1;
  $("#where").innerHTML = `
    <div class="stack-plot" aria-hidden="true"></div>
    <ul class="legend">${byDev.map((x) => `<li ${dev(x.d.id)}><span class="sw"></span><span>${esc(x.d.name)}</span><span class="num">${fmtN(x.n)}</span><span class="pct">${fmtP((x.n / sum) * 100)}</span></li>`).join("")}</ul>`;

  // Cobertura de capas: sistemas com mais jogos, % com capa (o número fica escrito).
  const covAll = (s.coverage || []).slice(0, 14);
  $("#covSort").innerHTML = sortSelect("cSort", ["jogos", "capasMenos", "capasMais", "nome"], pref("hh_csort", "jogos"));
  const drawCov = () => {
  const covRows = [...covAll].sort(SORTS[$("#cSort").value].fn);
  if (window.HH_CHARTS) HH_CHARTS.percent($("#coverage"), covRows, {
    label: (c) => sysName(c.system), done: (c) => c.covered, total: (c) => c.games, href: (c) => `#platform-${c.system}`,
    aria: "Capas por sistema: " + covRows.map((c) => `${sysName(c.system)} ${fmtN(c.covered)} de ${fmtN(c.games)}`).join(", "),
  });
  else $("#coverage").innerHTML = `<ul class="barlist cov">${(s.coverage || []).slice(0, 14).map((c) => {
    const pct = c.games ? (c.covered / c.games) * 100 : 0;
    return `<li data-tip="${esc(sysName(c.system))}: ${fmtN(c.covered)} de ${fmtN(c.games)} com capa"><a class="name" href="#platform-${esc(c.system)}">${esc(sysName(c.system))}</a><span class="track" aria-hidden="true"><i style="width:${pct}%"></i></span><span class="num">${fmtP(pct)} · ${fmtN(c.covered)}/${fmtN(c.games)}</span></li>`;
  }).join("")}</ul>`;
  };
  $("#cSort").onchange = (e) => { setPref("hh_csort", e.target.value); drawCov(); };
  drawCov();

  if (window.HH_CHARTS) HH_CHARTS.stack($("#where .stack-plot"), byDev.map((x) => ({ id: x.d.id, name: x.d.name, n: x.n })), { aria: "Arquivos por lugar" });

  $("#fDevice").innerHTML = `<option value="">Todos os lugares</option>` +
    s.devices.map((d) => `<option value="${esc(d.id)}">${esc(d.name)}</option>`).join("");
  const last = s.locations.map((l) => l.last_scan).filter(Boolean).sort().pop();
  applyLayout();
  $("#footer").textContent = `Última varredura: ${fmtDate(last)}`;
  $("#scan").textContent = `Varrido em ${fmtDate(last)}`;
}

// ---------- visão geral personalizável (ordem e visibilidade dos blocos, salvas no navegador) ----------
// Ordem padrão: primeiro os consoles/devices no topo, seguido pela atividade ao vivo do S20 FE e resumo do acervo.
const BLOCKS = [["consoles", "Consoles"], ["s20live", "Atividade ao Vivo · S20 FE"], ["portsFeed", "Radar de Ports & Novidades"], ["hero", "Jogos no acervo"], ["stats", "Indicadores"], ["relacao", "Entre os aparelhos"], ["meus", "Seus jogos"], ["ra", "RetroAchievements"], ["plataformas", "Jogos por plataforma"],
  ["mosaico", "Do acervo (capas)"], ["onde", "Onde estão os arquivos"], ["capas", "Capas por sistema"], ["saude", "Saúde do acervo"]];
const loadLayout = () => {
  let l; try { l = JSON.parse(localStorage.getItem("hh_layout")); } catch {}
  if (l?.v !== 2) l = null;
  const ids = BLOCKS.map(([id]) => id);
  const order = (l?.order || []).filter((id) => ids.includes(id));
  // Bloco novo (que não existia quando a ordem foi salva) entra na posição padrão, não no fim.
  ids.forEach((id, i) => { if (!order.includes(id)) order.splice(Math.min(i, order.length), 0, id); });
  return { v: 2, order, hidden: (l?.hidden || []).filter((id) => ids.includes(id)) };
};
let layout = loadLayout();
function applyLayout() {
  layout.order.forEach((id, i) => {
    const el = document.querySelector(`#view-overview [data-block="${id}"]`);
    if (!el) return;
    // Wrappers "display: contents" não aceitam order: aplica nos filhos (e no título dos consoles).
    const parts = el.classList.contains("contents") ? [...el.children] : [el];
    if (id === "consoles") parts.unshift(document.querySelector('#view-overview [data-part="consoles"]'));
    for (const p of parts) { if (p) { p.style.order = i * 10; p.classList.toggle("hidden", layout.hidden.includes(id)); } }
  });
}
function drawLayoutList() {
  const names = Object.fromEntries(BLOCKS);
  $("#layoutList").innerHTML = layout.order.map((id, i) => `<li>
    <label><input type="checkbox" data-show="${id}" ${layout.hidden.includes(id) ? "" : "checked"}> ${esc(names[id])}</label>
    <span><button type="button" class="icon-btn" data-up="${id}" ${i ? "" : "disabled"} aria-label="Subir ${esc(names[id])}">↑</button>
    <button type="button" class="icon-btn" data-down="${id}" ${i < layout.order.length - 1 ? "" : "disabled"} aria-label="Descer ${esc(names[id])}">↓</button></span></li>`).join("");
}
const saveLayout = () => { layout.v = 2; try { localStorage.setItem("hh_layout", JSON.stringify(layout)); } catch {} applyLayout(); drawLayoutList(); };
$("#customize").onclick = () => { drawLayoutList(); $("#layoutDlg").showModal(); };
$("#layoutReset").onclick = () => { layout = { v: 2, order: BLOCKS.map(([id]) => id), hidden: [] }; saveLayout(); };
$("#layoutList").addEventListener("change", (e) => {
  const id = e.target.dataset.show;
  if (!id) return;
  layout.hidden = e.target.checked ? layout.hidden.filter((x) => x !== id) : [...layout.hidden, id];
  saveLayout();
  $(`#layoutList [data-show="${id}"]`)?.focus();
});
$("#layoutList").addEventListener("click", (e) => {
  const up = e.target.dataset.up, down = e.target.dataset.down, id = up || down;
  if (!id) return;
  const i = layout.order.indexOf(id), j = up ? i - 1 : i + 1;
  [layout.order[i], layout.order[j]] = [layout.order[j], layout.order[i]];
  saveLayout();
  $(`#layoutList [data-${up ? "up" : "down"}="${id}"]`)?.focus();
});

// ---------- detalhe do console ----------
// Abre a tela Jogos já filtrada (usado pela página do console e pelos chips).
function goGames(filters = {}) {
  // Filtros que não têm seletor (vindos dos cruzamentos da visão geral): viram etiqueta removível.
  state.gx = { missing: filters.missing, where: filters.where };
  location.hash = "#games";
  setTimeout(() => {
    for (const [id, v] of Object.entries({ "#fDevice": filters.device, "#fSystem": filters.system, "#fStatus": filters.status, "#fScore": filters.score }))
      if (v !== undefined) $(id).value = v;
    loadGames();
  }, 0);
}

// Relação do aparelho com os outros: só aqui (risco), pronto para instalar e jogos em comum.
async function drawDeviceRelation(d) {
  const x = await api("/api/insights"), el = $("#devRel");
  if (!el || $("#view-device").dataset.dev !== d.id) return;
  const only = x.combos.find((c) => c.devices.length === 1 && c.devices[0] === d.id)?.n || 0;
  const mine = x.combos.filter((c) => c.devices.includes(d.id)).reduce((n, c) => n + c.n, 0) || 1;
  const others = state.devices.filter((o) => o.id !== d.id).map((o) => ({ o, n: x.combos.filter((c) => c.devices.includes(d.id) && c.devices.includes(o.id)).reduce((n, c) => n + c.n, 0) }));
  const inst = x.install.find((i) => i.device === d.id);
  const drive = d.id === "drive";
  el.innerHTML = `<div class="tile-head"><h2 id="t-devrel">Relação com os outros aparelhos</h2></div>
    <div class="rel-grid">
      <div class="rel-cards">
        <button type="button" class="relcard ${only && !drive ? "warn" : ""}" data-go-where="${esc(d.id)}" ${only ? "" : "disabled"}>
          <span class="muted small">${drive ? "Só no Drive (em nenhum console)" : "Só neste aparelho (sem backup)"}</span><b class="kpi-value">${fmtN(only)}</b>
          <span class="small">${only ? "Ver jogos" : "Nada exclusivo aqui"}</span></button>
        ${inst ? `<button type="button" class="relcard" data-go-missing="${esc(d.id)}" ${inst.games ? "" : "disabled"}>
          <span class="muted small">Pronto para instalar</span><b class="kpi-value">${fmtN(inst.games)}</b>
          <span class="muted small">~${fmtB(inst.bytes)}${inst.space ? ` · ${fmtB(inst.space.free)} livres` : ""}</span>
          <span class="small">${inst.games ? "Ver jogos" : "Nada novo para instalar"}</span></button>` : ""}
      </div>
      <div><h3 class="rel-h">Jogos em comum</h3>
        <ul class="barlist">${others.map(({ o, n }) => `<li ${dev(o.id)}><span class="bl-label"><i class="dot"></i>${esc(shortName(o))}</span>
          <span class="track"><i style="width:${(n / mine) * 100}%"></i></span><span class="bl-n">${fmtN(n)} <span class="muted small">(${fmtP((n / mine) * 100)})</span></span></li>`).join("")}</ul></div>
    </div>`;
  el.hidden = false;
  el.querySelector("[data-go-where]")?.addEventListener("click", () => goGames({ device: "", system: "", status: "", where: d.id }));
  el.querySelector("[data-go-missing]")?.addEventListener("click", () => goGames({ device: "", system: "", status: "", missing: d.id }));
}
function renderDevice(id) {
  const d = deviceOf(id);
  if (!d.id) { $("#view-device").innerHTML = `<a class="back" href="#overview">${icon("chevron-left", "sm")}Visão geral</a><h1 tabindex="-1">Console não encontrado</h1>`; return; }
  document.title = `${d.name} · Handheld Hub`;
  const sp = d.specs || {};
  const facts = Object.entries(sp.facts || {});
  const locs = state.locations.filter((l) => l.device_id === d.id);
  const st = state.stats?.[d.id] || { games: 0, systems: 0, covered: 0, noBackup: 0, driveOnly: 0 };
  const bad = locs.reduce((n, l) => n + (l.corrupted || 0), 0);
  const disks = storageOf(d).filter((x) => x.total);
  const free = disks.reduce((n, x) => n + (x.free || 0), 0), total = disks.reduce((n, x) => n + x.total, 0);
  $("#view-device").setAttribute("data-dev", d.id);
  queueMicrotask(() => drawDeviceRelation(d));
  $("#view-device").innerHTML = `
    <div>
      <a class="back" href="#overview">${icon("chevron-left", "sm")}Visão geral</a>
      <div class="detail-hero">
        <div>
          <div class="detail-head"><span class="dot"></span><h1 tabindex="-1">${esc(d.name)}</h1></div>
          <p class="lead">${esc(d.notes || "")}</p>
          ${locs.length ? `<p style="margin-top:16px"><button type="button" class="btn primary" id="devGames">${icon("gamepad-2", "sm")}Ver os ${fmtN(st.games)} jogos deste console</button></p>` : ""}
        </div>
        ${cover(d)}
      </div>
    </div>
    <div class="kpis" role="list" aria-label="Números do console">
      ${[["Jogos", fmtN(st.games), "gamepad-2"], ["Plataformas", fmtN(st.systems), "layers"],
         ["Com capa", st.games ? fmtP((st.covered / st.games) * 100) : "—", "image", `${fmtN(st.covered)} de ${fmtN(st.games)}`],
         d.id === "drive" ? ["Só no Drive", fmtN(st.driveOnly), "cloud", "em nenhum console"] : ["Sem backup", fmtN(st.noBackup), "archive", "não estão no Drive"],
         total ? ["Espaço livre", fmtB(free), "hard-drive", `de ${fmtB(total)}`] : ["Arquivos", fmtN(locs.reduce((n, l) => n + (l.files || 0), 0)), "folder-open"],
         ["Corrompidos", fmtN(bad), "triangle-alert", "", bad > 0]]
        .map(([l, v, ic, sub, isBad]) => `<div class="kpi ${isBad ? "bad" : ""}" role="listitem"><span class="kpi-label">${icon(ic, "sm")}${l}</span><span class="kpi-value">${v}</span>${sub ? `<span class="kpi-sub">${sub}</span>` : ""}</div>`).join("")}
    </div>
    <section class="tile" id="devRel" aria-labelledby="t-devrel" hidden></section>
    <section class="tile" aria-labelledby="t-devsys">
      <div class="tile-head"><h2 id="t-devsys">Jogos por plataforma neste console</h2></div>
      <div id="devSystems"></div>
    </section>
    <div class="detail-grid">
      ${facts.length ? `<div>${sectionTitle("Ficha")}<div class="panel"><dl class="kv">${facts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl></div></div>` : ""}
      <div>${sectionTitle("Armazenamento")}<div class="panel">${storageOf(d).map(storageHtml).join("") || `<p class="muted small">Sem dados.</p>`}
        ${locs.map((l) => `<p class="muted small" style="margin-top:10px">${esc(l.label)}: ${fmtN(l.files)} itens${l.bytes ? `, ${fmtB(l.bytes)}` : ""} · varrido ${fmtDate(l.last_scan)}${l.corrupted ? ` · <span style="color:var(--danger)">${fmtN(l.corrupted)} corrompidos</span>` : ""}</p>`).join("")}
      </div></div>
    </div>
    ${(sp.sections || []).length ? `<div class="sections">${sp.sections.map((s) => `
      <div>${sectionTitle(s.title)}<div class="tags">${s.items.map((i) => `<span>${esc(i)}</span>`).join("")}</div></div>`).join("")}</div>` : ""}
    ${sp.source ? `<p class="source">Fonte: repo ${esc(sp.source)} · snapshot de ${fmtDate(sp.snapshot)}</p>` : ""}`;
  $("#devGames")?.addEventListener("click", () => goGames({ device: d.id, system: "", status: "" }));
  // Plataformas deste console (jogos únicos), as 15 maiores; cada barra abre a plataforma.
  const rows = (state.sysRows || []).filter((r) => r.device_id === d.id).sort((a, b) => b.games - a.games).slice(0, 15);
  if (!rows.length) $("#devSystems").innerHTML = `<p class="muted small">Sem jogos varridos neste console.</p>`;
  else if (window.HH_CHARTS) HH_CHARTS.bars($("#devSystems"), rows, {
    label: (r) => sysName(r.system), value: (r) => r.games, href: (r) => `#platform-${r.system}`, color: `--acc-${d.id}`,
    aria: `Jogos por plataforma em ${d.name}: ` + rows.map((r) => `${sysName(r.system)} ${fmtN(r.games)}`).join(", "),
  });
}

// ---------- jogos ----------
async function loadSystems() {
  const rows = (state.sysRows = await api("/api/systems"));
  const systems = [...new Set(rows.map((r) => r.system))].sort();
  $("#fSystem").innerHTML = `<option value="">Todas as plataformas</option>` +
    systems.sort((a, b) => sysName(a).localeCompare(sysName(b))).map((s) => `<option value="${esc(s)}">${esc(sysName(s))}</option>`).join("");
}

// Seus jogos: vistos recentemente e favoritos (iguais em todos os aparelhos).
async function loadMine() {
  const row = async (keys, el, empty) => {
    const games = await api(`/api/pick?keys=${encodeURIComponent(JSON.stringify(keys.slice(0, 16)))}`);
    $(el).innerHTML = games.length ? games.map((x) => `<li><a href="${gameHref(x)}">${x.cover ? `<img src="covers/${esc(x.cover)}" alt="" loading="lazy">` : `<img class="gplat" src="${platImg(x.system)}" alt="">`}<span>${esc(x.title)}</span></a></li>`).join("")
      : `<li class="muted small mine-empty">${empty}</li>`;
  };
  $("#minePlayingWrap").classList.toggle("hidden", !LISTS.playing.size);
  if (LISTS.playing.size) await row([...LISTS.playing].reverse(), "#minePlaying", "");
  await Promise.all([row(LISTS.recent, "#mineRecent", "Os jogos que você abrir aparecem aqui."),
    row([...LISTS.fav].reverse(), "#mineFav", "Marque jogos com a estrela na página do jogo.")]);
  const pl = (n, um, varios) => `${fmtN(n)} ${n === 1 ? um : varios}`;
  $("#mineCounts").textContent = `${pl(LISTS.fav.size, "favorito", "favoritos")} · ${fmtN(LISTS.want.size)} quero jogar · ${pl(LISTS.done.size, "zerado", "zerados")}`;
}

// Mosaico: capas aleatórias do acervo, cada uma leva à página da plataforma.
async function loadMosaic() {
  const list = await api("/api/mosaic?n=12");
  $("#mosaic").innerHTML = list.map((g) => `<li><a href="#platform-${esc(g.system)}" title="${esc(g.title)}" aria-label="${esc(g.title)} (${esc(sysName(g.system))})"><img src="covers/${esc(g.cover)}" alt="" loading="lazy" decoding="async"></a></li>`).join("");
}

// Jogos por plataforma: cada jogo conta uma vez, mesmo que esteja em vários lugares.
async function loadTopPlatforms() {
  const all = await getPlatforms();
  const sel = pref("hh_tsort", "jogos");
  $("#topSort").innerHTML = sortSelect("tSort", ["jogos", "nome", "ano"], sel);
  const draw = () => {
    // Sempre as 10 com mais jogos; a ordenação só muda a ordem de exibição.
    const top = [...all].sort(SORTS.jogos.fn).slice(0, 10).sort(SORTS[$("#tSort").value].fn);
    if (window.HH_CHARTS) return HH_CHARTS.bars($("#topSystems"), top, {
      label: (p) => sysName(p.system), value: (p) => p.games, href: (p) => `#platform-${p.system}`,
      aria: "Jogos por plataforma: " + top.map((p) => `${sysName(p.system)} ${fmtN(p.games)}`).join(", "),
    });
    $("#topSystems").textContent = top.map((p) => `${sysName(p.system)}: ${fmtN(p.games)}`).join(" · ");
  };
  $("#tSort").onchange = (e) => { setPref("hh_tsort", e.target.value); draw(); };
  draw();
}

// Link do Drive do jogo: a cópia no Drive (arquivo ou pasta de jogo), se houver.
const driveUrl = (g) => {
  const c = g.copies.find((x) => x.device_id === "drive" && x.drive_id);
  if (!c) return null;
  return c.ext === "pasta" ? `https://drive.google.com/drive/folders/${c.drive_id}` : `https://drive.google.com/file/d/${c.drive_id}/view`;
};
const driveBtn = (g, label = "Drive") => {
  const u = driveUrl(g);
  return u ? `<a class="drive-btn" href="${esc(u)}" target="_blank" rel="noopener" aria-label="Abrir ${esc(g.title)} no Google Drive (nova aba)"><svg class="logo" aria-hidden="true"><use href="icons.svg#b-googledrive"/></svg>${label}</a>` : "";
};
// Capa (alt vazio: o título está escrito ao lado) ou cartão com o sistema.
const coverImg = (g) => g.cover ? `<img src="covers/${esc(g.cover)}" alt="" loading="lazy" decoding="async">` : "";
const copyChip = (c) => {
  const d = deviceOf(c.device_id);
  const bad = c.status === "corrupted";
  return `<span class="${bad ? "bad" : ""}" ${dev(c.device_id)} title="${fmtB(c.size)}"><i class="dot"></i>${esc(copyLabel(d, c.location_id))}${flagsHtml(regionsOf(c.title), 2)}${bad ? " · corrompido" : ""}</span>`;
};

const gameHref = (g) => `#game-${encodeURIComponent(g.game_key)}`;
// Região pelo nome do arquivo: No-Intro "(USA, Europe)", GoodTools "(U)"/"(UE)"/"(J)", traduções "(BR)".
// Bandeiras em SVG (flag-icons): o Windows não desenha bandeira em emoji.
const REGION = {
  usa: "us", us: "us", u: "us", europe: "eu", eur: "eu", eu: "eu", e: "eu", pal: "eu", japan: "jp", jpn: "jp", j: "jp",
  world: "world", w: "world", brazil: "br", br: "br", b: "br", germany: "de", g: "de", france: "fr", f: "fr", spain: "es", s: "es",
  italy: "it", i: "it", australia: "au", a: "au", taiwan: "tw", korea: "kr", k: "kr", uk: "gb", netherlands: "nl", sweden: "se",
  china: "cn", ch: "cn", canada: "ca", portugal: "pt", asia: "asia",
};
const REGION_NAME = { us: "EUA", eu: "Europa", jp: "Japão", world: "Mundo", br: "Brasil", de: "Alemanha", fr: "França", es: "Espanha",
  it: "Itália", au: "Austrália", tw: "Taiwan", kr: "Coreia", gb: "Reino Unido", nl: "Holanda", se: "Suécia", cn: "China", ca: "Canadá", pt: "Portugal", asia: "Ásia" };
function regionsOf(title) {
  const out = [];
  for (const grp of (title || "").match(/\(([^)]*)\)/g) || []) {
    const inner = grp.slice(1, -1);
    const toks = /^[UEJ]{2,3}$/.test(inner) ? inner.split("") : inner.split(",").map((t) => t.trim());   // "(UE)" → U, E
    for (const t of toks) { const c = REGION[t.toLowerCase()]; if (c && !out.includes(c)) out.push(c); }
    if (out.length) break;                           // a região vem no primeiro parêntese que tem região
  }
  return out;
}
const flag = (c) => (c === "world" || c === "asia"
  ? `<span class="flag globe" title="${REGION_NAME[c]}" aria-hidden="true">${icon("globe", "sm")}</span>`
  : `<img class="flag" src="flags/${c}.svg" alt="" title="${REGION_NAME[c]}">`);
const flagsHtml = (codes, max = 9) => codes.length
  ? `<span class="flags">${codes.slice(0, max).map(flag).join("")}${codes.length > max ? `<span class="muted small">+${codes.length - max}</span>` : ""}<span class="sr-only">${codes.map((c) => REGION_NAME[c]).join(", ")}</span></span>` : "";
const gameRegions = (g) => [...new Set(g.copies.flatMap((c) => regionsOf(c.title)))];
// Estado vazio com explicação e saída (em vez de só "Nada encontrado").
const emptyState = (title, hint, withClear = true) => `<div class="empty">${icon("search")}<b>${esc(title)}</b><span>${esc(hint)}</span>
  ${withClear ? `<button type="button" class="btn" data-clear-all>Limpar filtros</button>` : ""}</div>`;

// Cartões da grade de jogos (tela Jogos e página de plataforma): a capa ocupa o cartão inteiro,
// nome e sistema ficam sobre ela. Sem capa: a arte da plataforma (lado do logo) no fundo.
// Nota do Metacritic (RAWG) em cartões e linhas; mesmas faixas do selo da página do jogo.
const mcTag = (g) => g.mc ? `<b class="gmc mc-${g.mc >= 75 ? "good" : g.mc >= 50 ? "mixed" : "bad"}" title="Nota do Metacritic">${g.mc}<span class="sr-only"> no Metacritic</span></b> ` : "";
const gridHtml = (games) => games.length ? games.map((g) => {
  const bad = g.copies.some((c) => c.status === "corrupted");
  const art = g.cover
    ? `<img class="gblur" src="covers/${esc(g.cover)}" alt="" loading="lazy" decoding="async"><img class="gimg" src="covers/${esc(g.cover)}" alt="" loading="lazy" decoding="async">`
    : `<img class="gplat" src="${platImg(g.system)}" alt="" loading="lazy" decoding="async">`;
  return `<li class="gcard ${g.cover ? "" : "nocover"}">
      <div class="gart">${art}</div>
      <a class="gfull" href="${gameHref(g)}" tabindex="-1" aria-hidden="true"></a>
      ${bad ? `<span class="gbad">${icon("triangle-alert", "sm")}Corrompido</span>` : ""}
      ${inList("fav", g.game_key) ? `<span class="gfav" title="Favorito">${icon("star", "sm")}<span class="sr-only">Favorito</span></span>` : ""}
      ${RA.has.get(g.game_key) ? `<span class="gra" title="${fmtN(RA.has.get(g.game_key))} conquistas no RetroAchievements">${icon("trophy", "sm")}<span class="sr-only">Tem conquistas</span></span>` : ""}
      <div class="gover">
        <a class="gtitle glink" href="${gameHref(g)}">${esc(g.title)}</a>
        <span class="gmeta"><span>${mcTag(g)}${esc(sysName(g.system))} ${flagsHtml(gameRegions(g), 3)}</span><span class="gdots">${g.copies.map((c) => `<i class="dot" ${dev(c.device_id)}></i>`).join("")}</span></span>
        <span class="sr-only">Onde está: ${g.copies.map((c) => esc(copyLabel(deviceOf(c.device_id), c.location_id))).join(", ")}</span>
      </div>
      <div class="gdrive">${driveBtn(g)}</div>
    </li>`;
}).join("") : `<li class="empty-li">${emptyState("Nenhum jogo encontrado", "Tente outro nome, outra plataforma ou tire algum filtro.")}</li>`;

// Exibição em grade ou lista (fica salva neste navegador).
let viewMode = "grid";
try { viewMode = ["grid", "list"].includes(localStorage.getItem("hh_view")) ? localStorage.getItem("hh_view") : "grid"; } catch {}
function renderGames() {
  const games = state.games || [];
  const grid = viewMode === "grid";
  document.querySelectorAll(".seg button[data-mode]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === viewMode)));
  $("#gamesGrid").classList.toggle("hidden", !grid);
  $("#gamesList").classList.toggle("hidden", grid);
  if (grid) {
    $("#gamesGrid").innerHTML = gridHtml(games);
  } else {
    $("#gamesTable tbody").innerHTML = games.length ? games.map((g) => `<tr>
      <td><div class="game-cell"><span class="thumb">${coverImg(g) || icon("gamepad-2")}</span><a class="tlink" href="${gameHref(g)}">${esc(g.title)}</a>${mcTag(g)}</div></td>
      <td class="sys">${esc(sysName(g.system))}</td>
      <td class="col-wide num-cell" data-info="${esc(g.game_key)}" data-field="ano">—</td>
      <td class="col-wide" data-info="${esc(g.game_key)}" data-field="dev">—</td>
      <td><div class="copies">${g.copies.map(copyChip).join("")}</div></td>
      <td>${driveBtn(g)}</td></tr>`).join("") : `<tr><td colspan="6">${emptyState("Nenhum jogo encontrado", "Tente outro nome, outra plataforma ou tire algum filtro.")}</td></tr>`;
    fillInfo();
  }
}
// Lista: ano e desenvolvedora vêm da ficha de cada plataforma (um arquivo por plataforma, em cache).
async function fillInfo() {
  const cells = [...document.querySelectorAll("#gamesTable [data-info]")];
  const systems = [...new Set(cells.map((c) => c.dataset.info.split("|")[0]))];
  const infos = Object.fromEntries(await Promise.all(systems.map(async (sy) => [sy, await getData("info", sy)])));
  for (const c of cells) {
    const [sy, ...rest] = c.dataset.info.split("|");
    const v = infos[sy]?.[rest.join("|")]?.[c.dataset.field];
    c.textContent = v ?? "—";
  }
}
// Cabeçalho da lista ordena (mesmas opções do seletor "Ordenar"); aria-sort mostra a coluna ativa.
function markSort() {
  document.querySelectorAll("#gamesTable th[data-sort]").forEach((th) =>
    th.setAttribute("aria-sort", th.dataset.sort === $("#fSort").value ? "ascending" : "none"));
}
document.querySelectorAll("#gamesTable th[data-sort] .thsort").forEach((b) => (b.onclick = () => {
  $("#fSort").value = b.closest("th").dataset.sort;
  setPref("hh_gsort", $("#fSort").value);
  loadGames();
}));
// "Limpar filtros" dos estados vazios.
document.addEventListener("click", (e) => {
  if (!e.target.closest("[data-clear-all]")) return;
  ["#q", "#fDevice", "#fSystem", "#fStatus", "#fScore"].forEach((id) => ($(id).value = ""));
  loadGames();
});

document.querySelectorAll(".seg button[data-mode]").forEach((b) => (b.onclick = () => {
  viewMode = b.dataset.mode;
  try { localStorage.setItem("hh_view", viewMode); } catch {}
  renderGames();
}));

// Capa terminou de carregar: tira o brilho de carregamento do cartão.
document.addEventListener("load", (e) => {
  if (e.target.tagName === "IMG" && e.target.closest(".gart")) e.target.closest(".gcard")?.classList.add("loaded");
}, true);
document.addEventListener("error", (e) => {
  if (e.target.tagName === "IMG" && e.target.closest(".gart")) e.target.closest(".gcard")?.classList.add("loaded");
}, true);

// Rolagem infinita: quando o botão "Carregar mais" chega perto da tela, ele se aciona sozinho.
// O botão continua visível e focável (teclado e leitor de tela).
let busy = false;
const autoMore = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (e.isIntersecting && !e.target.classList.contains("hidden") && !busy) e.target.click();
  }
}, { rootMargin: "800px 0px" });
const watchMore = (btn) => autoMore.observe(btn);
// O observer só avisa quando muda de estado: se depois de carregar o botão ainda está perto, carrega de novo.
const stillNear = (btn) => !btn.classList.contains("hidden") && btn.getBoundingClientRect().top < innerHeight + 800;
const autoLoad = async (btn, load) => {
  if (busy) return;
  busy = true;
  try { do { await load(); } while (stillNear(btn)); } finally { busy = false; }
};

// Chips: atalhos para cada console (com a cor dele) e os filtros ativos como etiquetas removíveis.
function renderChips() {
  const dev = $("#fDevice").value, sys = $("#fSystem").value, st = $("#fStatus").value, q = $("#q").value.trim(), sco = $("#fScore").value;
  const devChips = [["", "Todos os lugares"], ...state.devices.map((d) => [d.id, shortName(d)])].map(([id, label]) =>
    `<button type="button" class="chip ${id ? "" : "all"}" data-dev="${esc(id)}" data-set-device="${esc(id)}" aria-pressed="${dev === id}">${id ? `<i class="dot"></i>` : ""}${esc(label)}</button>`).join("");
  const STATUS = { ok: "OK", corrupted: "Corrompido", unknown: "Não verificado", nobackup: "Sem backup no Drive", driveonly: "Só no Drive", playing: "Jogando agora", fav: "Favoritos", want: "Quero jogar", done: "Zerei" };
  const active = [
    sys && ["system", sysName(sys)], st && ["status", STATUS[st]], sco && ["score", $("#fScore").selectedOptions[0].text], q && ["q", `“${q}”`],
    state.gx?.missing && ["missing", `Pronto para instalar no ${shortName(deviceOf(state.gx.missing))}`],
    state.gx?.where && ["where", `Só em: ${whereLabel(state.gx.where)}`],
  ].filter(Boolean);
  $("#gChips").innerHTML = `<div class="chiprow" role="group" aria-label="Lugar">${devChips}</div>` + (active.length
    ? `<div class="chiprow" aria-label="Filtros ativos">${active.map(([k, label]) =>
        `<button type="button" class="chip active" data-clear="${k}" aria-label="Remover filtro ${esc(label)}">${esc(label)} <span aria-hidden="true">✕</span></button>`).join("")}
       <button type="button" class="chip ghost" data-clear="all">Limpar tudo</button></div>` : "");
}
$("#gChips")?.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.setDevice !== undefined) $("#fDevice").value = b.dataset.setDevice;
  const c = b.dataset.clear;
  if (c === "system" || c === "all") $("#fSystem").value = "";
  if (c === "status" || c === "all") $("#fStatus").value = "";
  if (c === "score" || c === "all") $("#fScore").value = "";
  if (c === "q" || c === "all") $("#q").value = "";
  if (c === "all") $("#fDevice").value = "";
  if (c === "missing" || c === "all") state.gx = { ...state.gx, missing: undefined };
  if (c === "where" || c === "all") state.gx = { ...state.gx, where: undefined };
  loadGames();
});

let gamesReq = 0;
async function loadGames(append = false) {
  const req = ++gamesReq;                 // descarta respostas antigas (busca digitada durante a carga)
  if (!append) state.offset = 0;
  if (!append) window.HH_FILTERCOUNT?.();
  const p = new URLSearchParams({ limit: 100, offset: state.offset });
  if ($("#fSort").value) p.set("sort", $("#fSort").value);
  for (const [k, el] of [["q", "#q"], ["device", "#fDevice"], ["system", "#fSystem"], ["status", "#fStatus"], ["score", "#fScore"]])
    if ($(el).value.trim()) p.set(k, $(el).value.trim());
  for (const [k, v] of Object.entries(state.gx || {})) if (v) p.set(k, v);
  const r = await api(`/api/games?${p}`);
  if (req !== gamesReq) return;
  state.games = append ? [...(state.games || []), ...r.games] : r.games;
  if (!append) { renderChips(); markSort(); }
  renderGames();
  state.offset += r.games.length;
  $("#gamesCount").textContent = `${fmtN(r.total)} ${r.total === 1 ? "jogo" : "jogos"}`;
  $("#more").classList.toggle("hidden", state.offset >= r.total);
}
let t;
$("#q").oninput = () => { clearTimeout(t); t = setTimeout(() => loadGames(), 250); };
["#fDevice", "#fSystem", "#fStatus", "#fScore"].forEach((s) => ($(s).onchange = () => loadGames()));
$("#fSort").value = pref("hh_gsort", "");
$("#fSort").onchange = () => { setPref("hh_gsort", $("#fSort").value); loadGames(); };
$("#more").onclick = () => autoLoad($("#more"), () => loadGames(true));
watchMore($("#more"));

// ---------- plataformas (arte do pacote "Arrow" do Daijishō) ----------
const getPlatforms = async () => (state.platforms ||= await api("/api/platforms"));
const pct = (p) => (p.games ? (p.covered / p.games) * 100 : 0);
async function loadPlatforms() {
  const list = await getPlatforms();
  $("#platformsLead").textContent = `${fmtN(list.length)} sistemas. Arte do Daijishō, quantos jogos cada um tem e quantos já têm capa.`;
  const sel = pref("hh_psort", "jogos");
  $("#platformSort").innerHTML = sortSelect("pSort", ["jogos", "nome", "ano", "geracao", "fabricante", "capasMenos"], sel);
  $("#pSort").onchange = (e) => { setPref("hh_psort", e.target.value); drawPlatforms(); };
  drawPlatforms();
}
function drawPlatforms() {
  const sort = SORTS[$("#pSort").value] || SORTS.jogos;
  const list = [...state.platforms].sort(sort.fn);
  let last = null;
  $("#platformGrid").innerHTML = list.map((p) => {
    const m = meta(p.system), g = sort.group?.(p);
    const head = g && g !== last ? `<li class="pgroup"><h2>${esc(g)}</h2></li>` : "";
    last = g;
    return head + `<li>
    <a class="ptile" href="#platform-${esc(p.system)}">
      <img src="${platImg(p.system)}" alt="" loading="lazy" decoding="async">
      <span class="pinfo"><b>${esc(sysName(p.system))}</b><span>${fmtN(p.games)} ${p.games === 1 ? "jogo" : "jogos"} · ${fmtP(pct(p))} com capa${m.ano ? ` · ${m.ano}` : ""}</span></span>
    </a></li>`;
  }).join("");
}
async function renderPlatform(id) {
  const list = await getPlatforms();
  const i = list.findIndex((p) => p.system === id);
  const p = list[i];
  if (!p) { $("#view-platform").innerHTML = `<a class="back" href="#platforms">${icon("chevron-left", "sm")}Plataformas</a><h1 tabindex="-1">Plataforma não encontrada</h1>`; return; }
  document.title = `${sysName(p.system)} · Handheld Hub`;
  const devs = ORDER.filter((d) => p.byDevice[d]);
  const sum = devs.reduce((a, d) => a + p.byDevice[d], 0) || 1;
  $("#view-platform").innerHTML = `
    <div>
      <a class="back" href="#platforms">${icon("chevron-left", "sm")}Plataformas</a>
      <h1 tabindex="-1" class="ptitle">${esc(sysName(p.system))}</h1>
    </div>
    <div class="phero">
      <img src="${platImg(p.system)}" alt="">
      <span class="pbadge">${icon("gamepad-2", "sm")}${fmtN(p.games)} ${p.games === 1 ? "jogo" : "jogos"} · plataforma ${i + 1} de ${list.length}</span>
    </div>
    <div class="kpis" role="list" aria-label="Números da plataforma">
      ${[["Jogos", fmtN(p.games), "gamepad-2"], ["Com capa", fmtP(pct(p)), "image", `${fmtN(p.covered)} de ${fmtN(p.games)}`],
         ["Arquivos", fmtN(p.files), "folder-open", "cópias em todos os lugares"],
         ["Sem backup", fmtN(p.noBackup), "archive", "não estão no Drive"],
         ["Corrompidos", fmtN(p.corrupted), "triangle-alert", "", p.corrupted > 0]]
        .map(([l, v, ic, sub, bad]) => `<div class="kpi ${bad ? "bad" : ""}" role="listitem"><span class="kpi-label">${icon(ic, "sm")}${l}</span><span class="kpi-value">${v}</span>${sub ? `<span class="kpi-sub">${sub}</span>` : ""}</div>`).join("")}
    </div>
    <div class="pabout" id="pabout"></div>
    <section class="panel" aria-labelledby="t-pwhere">
      <h2 id="t-pwhere">Onde estão os jogos</h2>
      <div class="stack-plot" id="pstack" aria-hidden="true"></div>
      <ul class="legend">${devs.map((d) => `<li ${dev(d)}><span class="sw"></span><span>${esc(deviceOf(d).name)}</span><span class="num">${fmtN(p.byDevice[d])}</span><span class="pct">${fmtP((p.byDevice[d] / sum) * 100)}</span></li>`).join("")}</ul>
      <p class="chart-note">Um jogo pode estar em mais de um lugar.</p>
    </section>
    <div>
      <div class="tile-head"><h2>Jogos</h2><div id="gsortWrap"></div></div>
      <ul class="grid" id="platformGames"></ul>
      <button class="btn hidden" id="platformMore" style="margin-top:16px">Carregar mais</button>
    </div>`;
  // Sobre a plataforma: resumo e história (Wikipédia, CC BY-SA) + ficha técnica curada.
  (window.HH_PLATINFO ||= fetch("data/platforms.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({}))).then((all) => {
    const info = all[p.system] || {}, specs = Object.entries(info.specs || {});
    if (!info.text?.length && !specs.length) return;
    $("#pabout").innerHTML = `
      ${info.text?.length ? `<section class="tile pabout-text" aria-labelledby="t-pabout"><h2 id="t-pabout">Sobre ${esc(sysName(p.system))}</h2>
        ${info.lang === "en" ? `<p class="muted small">Sem artigo em português; resumo da Wikipédia em inglês.</p>` : ""}
        <div class="prose">${info.text.map((t, i) => `<p ${i ? `class="more-p"` : ""}>${esc(t)}</p>`).join("")}</div>
        ${info.text.length > 1 || info.text[0].length > 280 ? `<button type="button" class="linkbtn" id="pmore" aria-expanded="false">Ler mais</button>` : ""}
        <p class="muted small credit">Texto: <a class="tlink" href="${esc(info.url)}" target="_blank" rel="noopener">Wikipédia</a> (CC BY-SA 4.0).</p></section>` : ""}
      ${specs.length ? `<section class="tile" aria-labelledby="t-pspecs"><h2 id="t-pspecs">Ficha técnica</h2>
        <dl class="kv">${specs.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl></section>` : ""}`;
    $("#pmore")?.addEventListener("click", (e) => {
      const open = e.target.getAttribute("aria-expanded") !== "true";
      e.target.setAttribute("aria-expanded", String(open));
      e.target.textContent = open ? "Ler menos" : "Ler mais";
      $("#pabout").classList.toggle("open", open);
    });
  });
  if (window.HH_CHARTS) HH_CHARTS.stack($("#pstack"), devs.map((d) => ({ id: d, name: deviceOf(d).name, n: p.byDevice[d] })), { aria: "Jogos por lugar" });
  // Todos os jogos da plataforma de uma vez (ordenados aqui, com o ano da ficha); a grade mostra 60 por vez.
  const [all, info] = await Promise.all([api(`/api/games?system=${encodeURIComponent(p.system)}&limit=5000`), getData("info", p.system)]);
  const keyOf = (g) => g.game_key.split("|").slice(1).join("|");
  const name = (a, b) => a.title.localeCompare(b.title, "pt-BR");
  const PSORT = {
    nome: name,
    ano: (a, b) => (info[keyOf(a)]?.ano ?? 9999) - (info[keyOf(b)]?.ano ?? 9999) || name(a, b),
    capa: (a, b) => (!!b.cover - !!a.cover) || name(a, b),
  };
  $("#gsortWrap").innerHTML = `<label class="sort"><span>Ordenar</span><select id="gpSort">
    <option value="nome">Nome (A–Z)</option><option value="ano">Lançamento (mais antigo)</option><option value="capa">Com capa primeiro</option></select></label>`;
  $("#gpSort").value = pref("hh_gpsort", "nome");
  let shown = [], offset = 0;
  const more = async () => {
    $("#platformGames").insertAdjacentHTML("beforeend", gridHtml(shown.slice(offset, offset + 60)));
    offset += 60;
    $("#platformMore").classList.toggle("hidden", offset >= shown.length);
  };
  const resort = () => { shown = [...all.games].sort(PSORT[$("#gpSort").value] || name); offset = 0; $("#platformGames").innerHTML = ""; more(); };
  $("#gpSort").onchange = () => { setPref("hh_gpsort", $("#gpSort").value); resort(); };
  $("#platformMore").onclick = () => autoLoad($("#platformMore"), more);
  watchMore($("#platformMore"));
  resort();
}

// ---------- favoritos, listas e vistos recentemente (KV no Worker, iguais em todos os aparelhos) ----------
// Sem o Worker (teste local) ou sem rede, fica no navegador e tenta de novo depois.
const LISTS = (window.HH_LISTS = { playing: new Set(), fav: new Set(), want: new Set(), done: new Set(), recent: [] });
const LIST_LABEL = { playing: ["Jogando agora", "gamepad-2"], fav: ["Favorito", "star"], want: ["Quero jogar", "bookmark"], done: ["Zerei", "circle-check"] };
let listsRemote = false;
function setLists(d) {
  for (const k of ["playing", "fav", "want", "done"]) LISTS[k] = new Set(d[k] || []);
  LISTS.recent = d.recent || [];
  try { localStorage.setItem("hh_lists", JSON.stringify({ ...d })); } catch {}
}
async function loadLists() {
  try {
    const r = await fetch("api/lists", { credentials: "same-origin", headers: { accept: "application/json" } });
    if (!r.ok || !(r.headers.get("content-type") || "").includes("json")) throw new Error(r.status);
    setLists(await r.json()); listsRemote = true;
  } catch {
    try { setLists(JSON.parse(localStorage.getItem("hh_lists")) || {}); } catch { setLists({}); }
  }
}
const listsSnapshot = () => ({ playing: [...LISTS.playing], fav: [...LISTS.fav], want: [...LISTS.want], done: [...LISTS.done], recent: LISTS.recent });
async function putList(list, key, on) {
  if (!listsRemote) return;
  try {
    const r = await fetch("api/lists", { method: "PUT", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ list, key, on }) });
    if (r.ok) setLists(await r.json());
  } catch {}
}
// Está na lista? Considera todas as chaves do grupo (favorito salvo na grafia antiga continua valendo).
const inList = (list, key) => (window.HH_MEMBERS?.[key] || [key]).some((k) => LISTS[list].has(k));
function toggleList(list, key) {
  const on = !inList(list, key);
  if (on) LISTS[list].add(key);
  else for (const k of window.HH_MEMBERS?.[key] || [key]) { LISTS[list].delete(k); if (k !== key) putList(list, k, false); }
  setLists(listsSnapshot());
  putList(list, key, on);
  return on;
}
function markSeen(key) {
  if (LISTS.recent[0] === key) return;
  LISTS.recent = [key, ...LISTS.recent.filter((k) => k !== key)].slice(0, 30);
  setLists(listsSnapshot());
  putList("recent", key, true);
}

// ---------- RetroAchievements (ao vivo pelo Worker; a chave fica no Cloudflare) ----------
const RA_CONSOLE = {
  "Game Boy": "gb", "Game Boy Color": "gbc", "Game Boy Advance": "gba", "NES/Famicom": "nes", "SNES/Super Famicom": "snes",
  "Nintendo 64": "n64", "Nintendo DS": "nds", "GameCube": "gamecube", "Wii": "wii", "Virtual Boy": "virtualboy", "Pokemon Mini": null,
  "Genesis/Mega Drive": "megadrive", "Master System": "mastersystem", "Game Gear": "gamegear", "Sega CD": "segacd", "32X": "sega32x",
  "SG-1000": "sg1000", "Dreamcast": "dreamcast", "Saturn": null, "PlayStation": "psx", "PlayStation 2": "ps2", "PlayStation Portable": "psp",
  "PC Engine/TurboGrafx-16": "pcengine", "PC Engine CD/TurboGrafx-CD": "pcenginecd", "Atari 2600": "atari2600", "Atari 7800": "atari7800",
  "Atari Lynx": "lynx", "Atari Jaguar": "jaguar", "Neo Geo Pocket": "ngpc", "Neo Geo CD": "neogeocd", "WonderSwan": "wswanc",
  "MSX": "msx", "ColecoVision": "colecovision", "Intellivision": "intellivision", "Vectrex": "vectrex", "3DO Interactive Multiplayer": "3do",
  "Arcade": "arcade", "Famicom Disk System": "fds",
};
// Mesma normalização do game_key do scanner: sem (região)/[tags], artigo no começo, só letras e números.
// Mesmo critério do scanner (scan.py game_key): sem versão "v1.8" e sem acento ("Pokémon" → "pokemon").
const normTitle = (t) => t.replace(/\.\d{2}$/, "").replace(/[\s_-]*decrypted\b/i, "").replace(/\s+v\d+(?:\.\d+)+$/i, "").replace(/\s*-\s*(c[oó]pia|copy)(\s*\(\d+\))?$/i, "").replace(/[([][^)\]]*[)\]]/g, " ").trim().replace(/^(.*), (the|a|an)\b/i, "$2 $1").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
// Chave (ou apelido) → chave do grupo, e também a grafia sem espaços ("megaman zx" acha "mega man zx").
function keyIndex(index) {
  const m = new Map();
  const loose = (k) => k.replace(/\|the /, "|").replace(/ /g, "");          // mesma regra do agrupamento (hh-api)
  for (const g of index) for (const k of g.a || [g.k]) { m.set(k, g.k); m.set(loose(k), g.k); }
  return { get: (k) => m.get(k) || m.get(loose(k)) };
}
const RA = { data: null, keyOf: new Map(), has: new Map() };   // has: jogo do catálogo → nº de conquistas no RA
// Usuário do RetroAchievements desta pessoa (Configurações). Vazio: o Worker usa o do admin, ou nenhum.
const raQ = (sep) => { const u = pref("hh_ra_user", "").trim(); return u ? `${sep}u=${encodeURIComponent(u)}` : ""; };
function raInvite() {
  const el = $("#raBlock");
  if (!el) return;
  el.classList.remove("ra-off");
  $("#raNote").textContent = "";
  $("#raHead").innerHTML = `<div><b>Ligue sua conta do RetroAchievements</b><span class="muted small">Suas conquistas, o progresso e o "Continuar jogando" aparecem aqui.</span></div>
    <a class="btn" href="#settings">Ligar em Configurações</a>`;
  $("#raRecent").innerHTML = ""; $("#raAch").innerHTML = "";
  el.querySelectorAll(".more-btn").forEach((b) => b.remove());
}
async function loadRA() {
  try {
    $("#raBlock")?.classList.add("ra-off");          // cada carga recomeça: dados, convite ou nada
    const r = await fetch(`api/ra/summary${raQ("?")}`, { credentials: "same-origin" });
    // Usuário sem conta do RA ligada (ex.: um sobrinho novo): em vez de sumir, o bloco convida a ligar.
    if (r.status === 404) { raInvite(); return; }
    if (!r.ok || !(r.headers.get("content-type") || "").includes("json")) return;
    RA.data = await r.json();
  } catch { return; }
  // Liga cada jogo do RA a um jogo do catálogo (plataforma + título normalizado).
  const idx = keyIndex(await api("/api/index"));
  for (const g of [...RA.data.recent, ...RA.data.progress]) {
    const sys = RA_CONSOLE[g.console];
    const k = sys && idx.get(`${sys}|${normTitle(g.title.replace(/^~[^~]+~\s*/, ""))}`);
    if (k) { g.key = k; RA.keyOf.set(k, g.id); }
  }
  drawRA();
  loadRACatalog();
}
// "Continuar jogando" (como a tela inicial dos consoles): o último jogo do RA ligado ao acervo; sem RA,
// o primeiro da lista "Jogando agora".
async function drawContinue() {
  const el = $("#contBlock");
  if (!el) return;
  const ra = RA.data?.recent?.find((g) => g.key);
  const raMs = ra?.last ? new Date(ra.last.replace(" ", "T") + "Z").getTime() : 0;

  // Verifica se há jogo mais recente na telemetria ao vivo do S20 FE
  let s20Hit = null;
  if (s20Telemetry) {
    try {
      const idx = keyIndex(await api("/api/index"));
      const candidates = [];
      if (s20Telemetry.nowPlaying?.title) {
        candidates.push({ ...s20Telemetry.nowPlaying, lastPlayedAt: Date.now(), isNow: true });
      }
      for (const it of s20Telemetry.recentOpened || []) {
        if (it.kind === "decomp" || it.kind === "port") candidates.push(it);
      }
      for (const c of candidates) {
        if ((c.lastPlayedAt || 0) <= raMs && !c.isNow) continue;
        const k = idx.get(`ports|${normTitle(c.title)}`);
        if (k) {
          s20Hit = { key: k, item: c };
          break;
        }
      }
    } catch {}
  }

  const key = s20Hit?.key || ra?.key || [...LISTS.playing][0];
  if (!key) return;
  const g = await api(`/api/game?key=${encodeURIComponent(key)}`).catch(() => null);
  if (!g?.game_key) return;
  const rel = (s) => {
    const d = (Date.now() - new Date(s.replace(" ", "T") + "Z")) / 864e5;
    const f = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
    return d < 1 ? "hoje" : d < 30 ? f.format(-Math.round(d), "day") : f.format(-Math.round(d / 30), "month");
  };
  const img = g.cover ? `covers/${esc(g.cover)}` : platImg(g.system);
  const useRa = !s20Hit && ra && ra.key === key;
  const pct = useRa && ra?.total ? (ra.earned / ra.total) * 100 : null;
  const eyebrow = s20Hit
    ? (s20Hit.item.isNow
        ? `Jogando agora no S20 FE`
        : `Jogado por último no S20 FE · ${fmtRelative(s20Hit.item.lastPlayedAt)}`)
    : (useRa ? `Jogado por último · ${rel(ra.last)}` : "Jogando agora");
  const subText = s20Hit
    ? `${esc(sysName(g.system))}${s20Hit.item.totalSeconds ? ` · ${fmtDuration(s20Hit.item.totalSeconds)} jogados no S20 FE` : ""}`
    : `${esc(sysName(g.system))}${useRa && ra?.total ? ` · ${fmtN(ra.earned)} de ${fmtN(ra.total)} conquistas` : ""}`;

  el.innerHTML = `<img class="cont-bg" src="${img}" alt="">
    <a class="cont-in" href="${gameHref(g)}">
      <span class="cont-cover">${g.cover ? `<img src="covers/${esc(g.cover)}" alt="">` : `<img class="gplat" src="${platImg(g.system)}" alt="">`}</span>
      <span class="cont-text">
        <span class="cont-eyebrow">${icon("gamepad-2", "sm")}${esc(eyebrow)}</span>
        <b class="cont-title">${esc(g.title.replace(/\s*\([^)]*\)/g, ""))}</b>
        <span class="cont-sub">${subText}</span>
        ${pct !== null ? `<span class="bar"><i style="width:${pct}%"></i></span>` : ""}
      </span>
      <span class="cont-go" aria-hidden="true">${icon("chevron-right")}</span>
    </a>`;
  el.hidden = false;
}
// Quais jogos do catálogo têm conquistas no RA (selo na grade e lista na página do jogo, mesmo sem ter jogado).
async function loadRACatalog() {
  try {
    const r = await fetch("data/ra-catalog.json");
    if (!r.ok) return;
    const cat = await r.json();
    const idx = keyIndex(await api("/api/index"));
    for (const [console, list] of Object.entries(cat)) {
      const sys = console !== "_ids" && RA_CONSOLE[console];
      if (!sys) continue;
      for (const [id, title, n] of list) {
        const k = idx.get(`${sys}|${normTitle(title)}`);
        if (!k) continue;
        RA.has.set(k, n);
        if (!RA.keyOf.has(k)) RA.keyOf.set(k, id);
      }
    }
    if (!$("#view-games").classList.contains("hidden")) renderGames();
  } catch {}
}
const raHref = (g) => (g.key ? gameHref({ game_key: g.key }) : `https://retroachievements.org/game/${g.id}`);
const raExt = (g) => (g.key ? "" : `target="_blank" rel="noopener"`);
function drawRA() {
  const d = RA.data, el = $("#raBlock");
  if (!d || !el) return;
  el.classList.remove("ra-off");
  const fmtD = (s) => (s ? new Date(s.replace(" ", "T") + "Z").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "");
  $("#raHead").innerHTML = `
    ${d.avatar ? `<img class="ra-avatar" src="${esc(d.avatar)}" alt="">` : ""}
    <div><b>${esc(d.user)}</b><span class="muted small">${fmtN(d.points)} pontos hardcore${d.softcorePoints ? ` · ${fmtN(d.softcorePoints)} softcore` : ""}${d.rank ? ` · ${fmtN(d.rank)}º de ${fmtN(d.totalRanked)}` : ""} · desde ${esc((d.memberSince || "").slice(0, 4))}</span></div>
    ${d.richPresence ? `<span class="ra-now">${icon("gamepad-2", "sm")}${esc(d.richPresence.replace(/^Playing /, "Jogando: "))}</span>` : ""}
    <a class="tlink small" href="https://retroachievements.org/user/${encodeURIComponent(d.user)}" target="_blank" rel="noopener">Perfil no RA</a>`;
  $("#raRecent").innerHTML = d.recent.slice(0, 12).map((g) => {
    const pct = g.total ? (g.earned / g.total) * 100 : 0;
    return `<li><a href="${raHref(g)}" ${raExt(g)}>
      <img src="${esc(g.icon || "")}" alt="" loading="lazy">
      <span class="ra-t">${esc(g.title)}</span>
      <span class="ra-s">${esc(g.console)} · ${fmtD(g.last)}</span>
      <span class="ra-p"><span class="bar"><i style="width:${pct}%"></i></span>${g.total ? `${fmtN(g.earned)}/${fmtN(g.total)}` : "sem conquistas"}</span></a></li>`;
  }).join("");
  // Últimas conquistas (todas as datas): selo, nome, jogo e quando.
  const ach = d.recentAchievements || [];
  $("#raAch").innerHTML = ach.length ? `<h3 class="ra-sub">Últimas conquistas${d.achievementsTotal > ach.length ? ` · ${fmtN(ach.length)} de ${fmtN(d.achievementsTotal)}` : ""}</h3>
    <ul class="ach ra-ach">${ach.map((a) => {
      const k = RA.keyOf && [...RA.keyOf].find(([, id]) => id === a.gameId)?.[0];
      const when = new Date(a.date.replace(" ", "T") + "Z").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
      return `<li class="on"><img src="${esc(a.badge || "")}" alt="" loading="lazy">
        <span><b>${esc(a.title)}</b><span class="muted small">${k ? `<a class="tlink" href="#game-${encodeURIComponent(k)}">${esc(a.game)}</a>` : esc(a.game)} · <time datetime="${esc(a.date.replace(" ", "T"))}">${when}</time>${a.hardcore ? " · hardcore" : ""}</span></span>
        <span class="ach-pts">${fmtN(a.points)}</span></li>`;
    }).join("")}</ul>` : "";
  clampList($("#raRecent"), 6, "Jogados recentemente");
  if ($("#raAch .ach")) clampList($("#raAch .ach"), 6, "Últimas conquistas");
  const started = d.progress.filter((g) => g.earned > 0).sort((a, b) => b.earned / b.total - a.earned / a.total);
  $("#raNote").textContent = started.length
    ? `${fmtN(started.length)} jogos com conquistas desbloqueadas.`
    : "Ainda sem conquistas desbloqueadas. Elas aparecem aqui assim que você ganhar a primeira (RetroArch → Conquistas ligado).";
}
async function drawGameRA(g) {
  const sec = $("#graSec");
  if (!sec) return;
  await RA.ready;                                   // acesso direto ao jogo: espera os dados do RA chegarem
  if (!RA.data) { sec.remove(); return; }
  const id = RA.keyOf.get(g.game_key);
  if (!id) {
    sec.innerHTML = `<h2>Conquistas</h2><p class="muted small">Você ainda não jogou este jogo com o RetroAchievements ligado.
      <a class="tlink" href="https://retroachievements.org/searchresults.php?s=${encodeURIComponent(g.title.replace(/\s*[([].*$/, ""))}" target="_blank" rel="noopener">Procurar no RetroAchievements</a></p>`;
    return;
  }
  const r = await fetch(`api/ra/game?id=${id}${raQ("&")}`, { credentials: "same-origin" }).catch(() => null);
  if (!r?.ok) { sec.innerHTML = `<h2>Conquistas</h2><p class="muted small">Não consegui falar com o RetroAchievements agora.</p>`; return; }
  const x = await r.json();
  const pct = x.total ? (x.earned / x.total) * 100 : 0;
  const neverPlayed = !RA.data.progress.some((p) => p.id === x.id) && !RA.data.recent.some((p) => p.id === x.id);
  sec.innerHTML = `<div class="tile-head"><h2>Conquistas · ${fmtN(x.earned)} de ${fmtN(x.total)}</h2>
      <a class="tlink small" href="https://retroachievements.org/game/${x.id}" target="_blank" rel="noopener">Ver no RetroAchievements</a></div>
    <div class="ra-progress"><span class="bar"><i style="width:${pct}%"></i></span><span class="muted small">${neverPlayed ? "Você ainda não jogou com conquistas ligadas · " : ""}${fmtN(x.userPoints)} de ${fmtN(x.points)} pontos · ${fmtN(x.players)} jogadores</span></div>
    <ul class="ach">${x.achievements.map((a) => `<li class="${a.earned ? "on" : ""}">
      <img src="${esc(a.badge || "")}" alt="" loading="lazy">
      <span><b>${esc(a.title)}</b><span class="muted small">${esc(a.description)}</span></span>
      <span class="ach-pts">${fmtN(a.points)}</span>
      <span class="sr-only">${a.earned ? "desbloqueada" : "bloqueada"}</span></li>`).join("")}</ul>`;
}

// ---------- página do jogo (dados: libretro-database, um arquivo por plataforma) ----------
const dataCache = {};
const getData = (kind, system) => (dataCache[kind + system] ||= fetch(`data/${kind}/${encodeURIComponent(system)}.json`)
  .then((r) => (r.ok ? r.json() : {})).catch(() => ({})));
const gameNeighbors = {};
document.addEventListener("keydown", (e) => {
  if ($("#view-game").classList.contains("hidden") || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.target.closest?.("input, textarea, select, dialog") || document.querySelector("dialog[open]")) return;
  const a = document.querySelector(`#gstep [data-step="${e.key === "ArrowLeft" ? "prev" : e.key === "ArrowRight" ? "next" : ""}"]`);
  if (a) { e.preventDefault(); location.hash = a.getAttribute("href"); }
});
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
async function renderGame(key) {
  const g = await api(`/api/game?key=${encodeURIComponent(key)}`);
  const v = $("#view-game");
  if (!g) { v.innerHTML = `<a class="back" href="#games">${icon("chevron-left", "sm")}Jogos</a><h1 tabindex="-1">Jogo não encontrado</h1>`; return; }
  document.title = `${g.title} · Handheld Hub`;
  markSeen(g.game_key);
  const short = g.game_key.split("|").slice(1).join("|");
  const shorts = (window.HH_MEMBERS?.[g.game_key] || [g.game_key]).map((k) => k.split("|").slice(1).join("|"));
  const pickAny = (obj) => shorts.map((k) => obj[k]).find(Boolean);
  const info = pickAny(await getData("info", g.system)) || {};
  const bad = g.copies.some((c) => c.status === "corrupted");
  const year = info.ano ? `${info.mes ? MONTHS[info.mes - 1] + " de " : ""}${info.ano}` : null;
  const facts = [["Lançamento", year], ["Desenvolvedora", info.dev], ["Publicadora", info.pub], ["Gênero", info.genero],
    ["Jogadores", info.jogadores], ["Franquia", info.franquia]].filter(([, x]) => x);
  const q = encodeURIComponent(`${g.title.replace(/\s*[([].*$/, "")} ${sysName(g.system)} dicas`);
  v.innerHTML = `
    <div class="ghero">
      ${g.cover ? `<img class="ghero-bg" src="covers/${esc(g.cover)}" alt="">` : `<img class="ghero-bg" src="${platImg(g.system)}" alt="">`}
      <div class="ghero-in">
        <div class="gnav"><a class="back" href="#platform-${esc(g.system)}">${icon("chevron-left", "sm")}${esc(sysName(g.system))}</a>
          <span class="gstep" id="gstep"></span></div>
        <div class="ghero-grid">
          <div class="ghero-cover">${g.cover ? `<img src="covers/${esc(g.cover)}" alt="Capa de ${esc(g.title)}">` : `<img class="gplat" src="${platImg(g.system)}" alt="">`}</div>
          <div class="ghero-text">
            <a class="pchip" href="#platform-${esc(g.system)}">${esc(sysName(g.system))}</a>
            <h1 tabindex="-1">${esc(g.title)}</h1>
            <p class="gsub">${[year, info.dev, info.genero].filter(Boolean).map(esc).join(" · ") || "Sem ficha no banco do libretro"}</p>
            <p class="gscore" id="gScore" hidden></p>
            ${gameRegions(g).length ? `<p class="gregions">${gameRegions(g).map((c) => `<span>${flag(c)}${REGION_NAME[c]}</span>`).join("")}</p>` : ""}
            ${bad ? `<span class="badge bad">${icon("triangle-alert", "sm")}Tem cópia corrompida</span>` : ""}
            <div class="gactions">
              ${Object.entries(LIST_LABEL).map(([l, [label, ic]]) => `<button type="button" class="listbtn" data-list="${l}" aria-pressed="${inList(l, g.game_key)}">${icon(ic, "sm")}${label}</button>`).join("")}
            </div>
            <div class="gactions">
              ${isS20App() && g.copies.some((c) => c.device_id === "s20fe")
                ? `<a class="drive-btn play-btn" href="${esc(launchHref(s20EmulatorFor(g.system), g.title.replace(/\s*[([].*$/, "")))}">▶ Jogar no S20 FE</a>`
                : ""}
              ${driveBtn(g, "Abrir no Drive")}
              <a class="drive-btn" href="https://www.google.com/search?q=${q}" target="_blank" rel="noopener">${icon("search", "sm")}Buscar dicas</a>
            </div>
          </div>
        </div>
      </div>
    </div>
    <section class="tile gabout hidden" id="gabout" aria-labelledby="t-gabout"></section>
    <section class="tile gmedia" id="gMedia" aria-labelledby="t-gmedia" hidden></section>
    <div class="ggrid">
      ${facts.length ? `<section class="tile"><h2>Ficha</h2><dl class="kv">${facts.map(([k, x]) => `<dt>${k}</dt><dd>${esc(x)}</dd>`).join("")}</dl></section>` : ""}
      <section class="tile"><h2>Onde está · ${fmtN(g.copies.length)} ${g.copies.length === 1 ? "cópia" : "cópias"}</h2>
        ${bad ? (() => {
          const good = g.copies.find((c) => c.status === "ok");
          const where = good ? copyLabel(deviceOf(good.device_id), good.location_id) : null;
          return `<p class="gwarn">${icon("triangle-alert", "sm")}<span>Há cópia corrompida${where ? `. Cópia boa em <b>${esc(where)}</b>: copie de lá.` : g.copies.some((c) => c.device_id === "drive") ? ". A cópia do Drive não foi verificada." : ". Baixe de novo da fonte."}</span></p>`;
        })() : ""}
        <p class="gwhere hidden" id="gWhere"></p>
        <div class="xscroll" tabindex="0" role="region" aria-label="Cópias deste jogo"><table class="table copies-table"><caption class="sr-only">Cópias deste jogo</caption>
          <thead><tr><th scope="col">Lugar</th><th scope="col">Região</th><th scope="col">Formato</th><th scope="col">Tamanho</th><th scope="col">Estado</th><th scope="col"><span class="sr-only">Abrir</span></th></tr></thead>
          <tbody>${g.copies.map((c) => `<tr ${dev(c.device_id)}>
            <td><span class="cell-dev"><i class="dot"></i>${esc(copyLabel(deviceOf(c.device_id), c.location_id))}</span></td>
            <td>${flagsHtml(regionsOf(c.title)) || `<span class="muted small">—</span>`}</td>
            <td>${esc(c.ext === "pasta" ? "pasta" : (c.ext || "—").toUpperCase())}${c.rom && c.rom !== c.title ? ` <span class="muted small">${esc(c.rom)}${c.ext && c.ext !== "pasta" ? "." + esc(c.ext) : ""}</span>` : ""}</td>
            <td class="num-cell">${c.size ? fmtB(c.size) : "—"}</td>
            <td>${c.status === "corrupted" ? `<span class="badge bad">corrompido</span>` : c.status === "ok" ? `<span class="badge ok">${icon("shield-check", "sm")}ok</span>` : `<span class="muted small">não verificado</span>`}</td>
            <td>${c.device_id === "drive" && c.drive_id ? `<a class="small tlink" href="${esc(c.ext === "pasta" ? `https://drive.google.com/drive/folders/${c.drive_id}` : `https://drive.google.com/file/d/${c.drive_id}/view`)}" target="_blank" rel="noopener">Abrir no Drive</a>` : ""}</td>
          </tr>`).join("")}</tbody></table></div>
      </section>
    </div>
    <section class="tile" id="graSec"><h2>Conquistas</h2><p class="muted small">Carregando…</p></section>
    <section class="tile" id="gcodes" aria-labelledby="t-codes"><h2 id="t-codes">Códigos</h2><p class="muted small">Carregando…</p></section>
    <section aria-labelledby="t-more"><div class="tile-head"><h2 id="t-more">Mais de ${esc(sysName(g.system))}</h2>
      <a class="small tlink" href="#platform-${esc(g.system)}">Ver todos</a></div><ul class="morerow" id="gmore"></ul></section>
`;
  // Onde mais roda: consoles que já têm jogos desta plataforma, mas não este jogo.
  api("/api/insights").then((x) => {
    const has = new Set(g.copies.map((c) => c.device_id));
    const more = state.devices.filter((d) => d.kind === "console" && !has.has(d.id) && x.runs[d.id]?.includes(g.system));
    if (!more.length || !$("#gWhere")) return;
    const from = has.has("drive") ? "do Drive" : `do ${shortName(deviceOf([...has][0]))}`;
    $("#gWhere").innerHTML = `${icon("info", "sm")}<span>Também roda no ${more.map((d) => `<b ${dev(d.id)}>${esc(d.name)}</b>`).join(" e no ")}, que já tem jogos de ${esc(sysName(g.system))}. Dá para copiar ${from}.</span>`;
    $("#gWhere").classList.remove("hidden");
  });
  // Marcar numa lista: ícone dá um "pop" e um aviso confirma, com Desfazer (como nos consoles).
  const LIST_NAME = { playing: "Jogando agora", fav: "Favoritos", want: "Quero jogar", done: "Zerei" };
  const flip = (b) => {
    const on = toggleList(b.dataset.list, g.game_key);
    b.setAttribute("aria-pressed", String(on));
    b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop");
    return on;
  };
  v.querySelectorAll(".listbtn").forEach((b) => (b.onclick = () => {
    const on = flip(b);
    toast(`${on ? "Adicionado a" : "Removido de"} ${LIST_NAME[b.dataset.list]}`, { undo: () => flip(b) });
  }));
  // Anterior / próximo na plataforma (ordem alfabética); setas ← → do teclado também.
  (gameNeighbors[g.system] ||= api(`/api/games?system=${encodeURIComponent(g.system)}&sort=nome&limit=5000`)).then((r) => {
    const i = r.games.findIndex((x) => x.game_key === g.game_key);
    const prev = r.games[i - 1], next = r.games[i + 1];
    $("#gstep").innerHTML = `${prev ? `<a class="stepbtn" href="${gameHref(prev)}" data-step="prev" title="${esc(prev.title)}">${icon("chevron-left", "sm")}<span>Anterior</span></a>` : ""}
      <span class="muted small">${fmtN(i + 1)} de ${fmtN(r.games.length)}</span>
      ${next ? `<a class="stepbtn" href="${gameHref(next)}" data-step="next" title="${esc(next.title)}"><span>Próximo</span>${icon("chevron-right", "sm")}</a>` : ""}`;
  });
  // Mais da plataforma: 14 outros jogos com capa, sorteados.
  api(`/api/games?system=${encodeURIComponent(g.system)}&sort=capa&limit=400`).then((r) => {
    const pool = r.games.filter((x) => x.cover && x.game_key !== g.game_key);
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    $("#gmore").innerHTML = pool.slice(0, 14).map((x) => `<li><a href="${gameHref(x)}"><img src="covers/${esc(x.cover)}" alt="" loading="lazy" decoding="async"><span>${esc(x.title)}</span></a></li>`).join("")
      || `<li class="muted small">Sem outros jogos com capa nesta plataforma.</li>`;
  });
  // Sobre o jogo: introdução da Wikipédia (casada pelo Wikidata), um arquivo por plataforma.
  // Dados do RAWG (os termos pedem crédito e link): nota do Metacritic, duração, ficha que falta, imagens e trailer.
  getData("scores", g.system).then((all) => {
    const sc = pickAny(all);
    const el = $("#gScore");
    if (!sc || !el) return;
    const rawg = `https://rawg.io/games/${encodeURIComponent(sc.slug)}`;
    const parts = [];
    if (sc.mc) {
      const tier = sc.mc >= 75 ? "good" : sc.mc >= 50 ? "mixed" : "bad";
      parts.push(`<a class="mc-badge mc-${tier}" href="${rawg}" target="_blank" rel="noopener" aria-label="Nota do Metacritic: ${sc.mc} de 100. Dados do RAWG"><b>${sc.mc}</b><span>Metacritic</span></a>`);
    }
    if (sc.horas) parts.push(`<span class="gtime">${icon("clock", "sm")}~${sc.horas} h para zerar</span>`);
    if (parts.length) { el.innerHTML = parts.join("") + `<span class="muted small">via RAWG</span>`; el.hidden = false; }
    const sub = el.previousElementSibling;                 // sem ficha no libretro: o ano vem do RAWG
    if (sc.ano && sub?.classList.contains("gsub") && sub.textContent.startsWith("Sem ficha")) sub.textContent = sc.ano;
    // Ficha que o libretro não tem + imagens + trailer.
    const ficha = [[!info.genero && "Gênero", sc.generos?.join(", ")], [!info.dev && "Desenvolvedora", sc.dev?.join(", ")],
      [!info.pub && "Publicadora", sc.pub?.join(", ")], ["Classificação", sc.esrb], ["Duração média", sc.horas && `~${sc.horas} h`]]
      .filter(([k, v]) => k && v);                          // o que o libretro já mostra na ficha não se repete
    const shots = (sc.shots || []).map(rawgImg);
    if (!ficha.length && !shots.length && !sc.video?.mp4) return;
    const m = $("#gMedia");
    m.innerHTML = `<div class="tile-head"><h2 id="t-gmedia">Mais informações</h2><a class="tlink small" href="${rawg}" target="_blank" rel="noopener">Dados do RAWG</a></div>
      ${ficha.length ? `<dl class="kv gfacts">${ficha.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl>` : ""}
      ${sc.video?.mp4 ? `<video class="gvideo" controls preload="none" playsinline poster="${esc(rawgImg(sc.video.poster || ""))}" src="${esc(sc.video.mp4)}" aria-label="Trailer de ${esc(g.title)}"></video>` : ""}
      ${shots.length ? `<ul class="gshots" aria-label="Imagens do jogo">${shots.map((u, n) => `<li><button type="button" class="gshot" data-shot="${n}" aria-label="Ampliar imagem ${n + 1} de ${shots.length}"><img src="${esc(u)}" alt="" loading="lazy" decoding="async"></button></li>`).join("")}</ul>` : ""}`;
    m.hidden = false;
    m.querySelectorAll("[data-shot]").forEach((b) => (b.onclick = () => openShot(shots, +b.dataset.shot, g.title)));
  });
  getData("about", g.system).then((all) => {
    const ab = pickAny(all);
    if (!ab) return;
    $("#gabout").classList.remove("hidden");
    $("#gabout").innerHTML = `<h2 id="t-gabout">Sobre o jogo</h2>
      ${ab.lang === "en" ? `<p class="muted small">Sem artigo em português; resumo da Wikipédia em inglês.</p>` : ""}
      <div class="prose">${ab.text.map((t, i) => `<p ${i ? `class="more-p"` : ""}>${esc(t)}</p>`).join("")}</div>
      ${ab.text.length > 1 || ab.text[0].length > 280 ? `<button type="button" class="linkbtn" id="gmore2" aria-expanded="false">Ler mais</button>` : ""}
      <p class="muted small credit">Texto: <a class="tlink" href="${esc(ab.url)}" target="_blank" rel="noopener">Wikipédia</a> (CC BY-SA 4.0).</p>`;
    $("#gmore2")?.addEventListener("click", (e) => {
      const open = e.target.getAttribute("aria-expanded") !== "true";
      e.target.setAttribute("aria-expanded", String(open));
      e.target.textContent = open ? "Ler menos" : "Ler mais";
      $("#gabout").classList.toggle("open", open);
    });
  });
  drawGameRA(g);
  const cheats = pickAny(await getData("cheats", g.system)) || [];
  const total = cheats.reduce((n, [, list]) => n + list.length, 0);
  $("#gcodes").innerHTML = `<h2 id="t-codes">Códigos · ${fmtN(total)}</h2>` + (cheats.length
    ? `<p class="muted small">Para o RetroArch: Menu rápido → Trapaças → Adicionar. Fonte: libretro-database.</p>
       ${cheats.map(([src, list], i) => `<details ${i === 0 ? "open" : ""}><summary>${esc(src)} · ${fmtN(list.length)}</summary>
         <ul class="codes">${list.map(([d, c]) => `<li><span>${esc(d)}</span><code>${esc(c)}</code>
           <button type="button" class="copy" data-code="${esc(c)}" aria-label="Copiar código: ${esc(d)}">Copiar</button></li>`).join("")}</ul></details>`).join("")}`
    : `<p class="muted small">Nenhum código no banco do libretro para este jogo.</p>`);
}
document.addEventListener("click", async (e) => {
  const b = e.target.closest(".copy");
  if (!b) return;
  try { await navigator.clipboard.writeText(b.dataset.code); b.textContent = "Copiado"; } catch { b.textContent = "Erro"; }
  setTimeout(() => (b.textContent = "Copiar"), 1500);
});

// ---------- minhas listas ----------
const LIST_TABS = [["playing", "Jogando agora"], ["fav", "Favoritos"], ["want", "Quero jogar"], ["done", "Zerei"], ["recent", "Vistos recentemente"]];
let listTab = pref("hh_listtab", "playing"), listShown = [], listOffset = 0;
async function drawLists() {
  const keysOf = (l) => (l === "recent" ? LISTS.recent : [...LISTS[l]].reverse());
  $("#listTabs").innerHTML = LIST_TABS.map(([l, label]) => `<button type="button" data-tab="${l}" aria-pressed="${l === listTab}">${esc(label)} <span class="muted">${fmtN(keysOf(l).length)}</span></button>`).join("");
  $("#listTabs").querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => { listTab = b.dataset.tab; setPref("hh_listtab", listTab); drawLists(); }));
  $("#listsNote").textContent = listsRemote ? "Salvas na sua conta: iguais em todos os aparelhos." : "Sem conexão com a conta: salvas só neste navegador por enquanto.";
  const keys = keysOf(listTab);
  listShown = keys.length ? await api(`/api/pick?keys=${encodeURIComponent(JSON.stringify(keys))}`) : [];
  listOffset = 0;
  $("#listGames").innerHTML = "";
  moreLists();
}
function moreLists() {
  if (!listShown.length) {
    const hint = { playing: "Na página de um jogo, toque em “Jogando agora”.", fav: "Na página de um jogo, toque na estrela.", want: "Na página de um jogo, toque em “Quero jogar”.",
      done: "Na página de um jogo, toque em “Zerei”.", recent: "Os jogos que você abrir aparecem aqui." }[listTab];
    $("#listGames").innerHTML = `<li class="empty-li">${emptyState("Lista vazia", hint, false)}</li>`;
    $("#listMore").classList.add("hidden");
    return;
  }
  $("#listGames").insertAdjacentHTML("beforeend", gridHtml(listShown.slice(listOffset, listOffset + 60)));
  listOffset += 60;
  $("#listMore").classList.toggle("hidden", listOffset >= listShown.length);
}
$("#listMore").onclick = () => autoLoad($("#listMore"), async () => moreLists());
watchMore($("#listMore"));
// Backup: exporta as listas em JSON e importa de volta (substitui as atuais, depois de confirmar).
$("#listExport").onclick = () => {
  const blob = new Blob([JSON.stringify({ app: "handheld-hub", version: 1, exported_at: new Date().toISOString(), ...listsSnapshot() }, null, 1)], { type: "application/json" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `handheld-hub-listas-${new Date().toISOString().slice(0, 10)}.json` });
  a.click(); URL.revokeObjectURL(a.href);
};
$("#listImport").onchange = async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  let data;
  try { data = JSON.parse(await file.text()); } catch { return alert("Arquivo inválido: não é um JSON."); }
  if (data.app !== "handheld-hub") return alert("Este arquivo não é um backup do Handheld Hub.");
  const n = ["playing", "fav", "want", "done"].reduce((a, l) => a + (data[l]?.length || 0), 0);
  if (!confirm(`Importar ${n} jogos nas listas? Isso substitui as listas atuais.`)) return;
  if (listsRemote) {
    const r = await fetch("api/lists", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(data) }).catch(() => null);
    if (r?.ok) setLists(await r.json()); else return alert("Não consegui salvar na conta. Tente de novo.");
  } else setLists(data);
  drawLists();
};

// ---------- comparar dois lugares ----------
const cmp = { side: "A", system: "", list: [], offset: 0 };
function initCompare() {
  const opts = state.devices.map((d) => `<option value="${esc(d.id)}">${esc(d.name)}</option>`).join("");
  $("#cmpA").innerHTML = opts; $("#cmpB").innerHTML = opts;
  $("#cmpA").value = pref("hh_cmpA", "s20fe"); $("#cmpB").value = pref("hh_cmpB", "miyoo");
  $("#cmpA").onchange = $("#cmpB").onchange = () => { setPref("hh_cmpA", $("#cmpA").value); setPref("hh_cmpB", $("#cmpB").value); cmp.system = ""; drawCompare(); };
  $("#cmpSwap").onclick = () => { const a = $("#cmpA").value; $("#cmpA").value = $("#cmpB").value; $("#cmpB").value = a; $("#cmpA").onchange(); };
  document.querySelectorAll("#view-compare [data-side]").forEach((b) => (b.onclick = () => { cmp.side = b.dataset.side; drawCompareList(); }));
  $("#cmpMore").onclick = () => autoLoad($("#cmpMore"), async () => moreCompare());
  watchMore($("#cmpMore"));
  drawCompare();
}
async function drawCompare() {
  const A = $("#cmpA").value, B = $("#cmpB").value;
  const nA = shortName(deviceOf(A)), nB = shortName(deviceOf(B));
  const r = (cmp.data = await api(`/api/compare?a=${A}&b=${B}`));
  $("#cmpKpis").innerHTML = [[`Só no ${nA}`, r.totals.onlyA, A], ["Em ambos", r.both, ""], [`Só no ${nB}`, r.totals.onlyB, B]]
    .map(([l, n, d]) => `<div class="kpi" role="listitem" ${d ? dev(d) : ""}><span class="kpi-label">${d ? `<i class="dot"></i>` : icon("columns", "sm")}${esc(l)}</span><span class="kpi-value">${fmtN(n)}</span><span class="kpi-sub">jogos</span></div>`).join("");
  // Barra por plataforma: só em A (cor de A) | em ambos (neutro) | só em B (cor de B). Números escritos ao lado.
  const rows = r.bySystem.filter((x) => x.onlyA + x.onlyB > 0).slice(0, 20);
  $("#cmpSystems").innerHTML = rows.length ? `<ul class="cmprows">${rows.map((x) => {
    const t = x.onlyA + x.both + x.onlyB || 1;
    return `<li><button type="button" class="cmpsys ${cmp.system === x.system ? "on" : ""}" data-sys="${esc(x.system)}" aria-pressed="${cmp.system === x.system}">${esc(sysName(x.system))}</button>
      <span class="cmpbar" aria-hidden="true"><i ${dev(A)} style="flex:${x.onlyA}"></i><i class="both" style="flex:${x.both}"></i><i ${dev(B)} style="flex:${x.onlyB}"></i></span>
      <span class="cmpnum"><b ${dev(A)}>${fmtN(x.onlyA)}</b> · ${fmtN(x.both)} · <b ${dev(B)}>${fmtN(x.onlyB)}</b></span></li>`; }).join("")}</ul>
    <p class="chart-note">Cada linha: só no ${esc(nA)} · em ambos · só no ${esc(nB)}.</p>` : emptyState("Nada diferente", "Os dois lugares têm os mesmos jogos.", false);
  $("#cmpSystems").querySelectorAll("[data-sys]").forEach((b) => (b.onclick = () => {
    cmp.system = cmp.system === b.dataset.sys ? "" : b.dataset.sys;
    drawCompare();
  }));
  drawCompareList();
}
function drawCompareList() {
  const r = cmp.data, A = $("#cmpA").value, B = $("#cmpB").value;
  const filt = (l) => (cmp.system ? l.filter((g) => g.system === cmp.system) : l);
  const la = filt(r.onlyA), lb = filt(r.onlyB);
  $("#cmpTabA").textContent = `Só no ${shortName(deviceOf(A))} (${fmtN(la.length)})`;
  $("#cmpTabB").textContent = `Só no ${shortName(deviceOf(B))} (${fmtN(lb.length)})`;
  document.querySelectorAll("#view-compare [data-side]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.side === cmp.side)));
  $("#cmpFilter").innerHTML = cmp.system ? `<button type="button" class="chip active" id="cmpClear">${esc(sysName(cmp.system))} <span aria-hidden="true">✕</span></button>` : "";
  $("#cmpClear")?.addEventListener("click", () => { cmp.system = ""; drawCompare(); });
  cmp.list = cmp.side === "A" ? la : lb;
  cmp.offset = 0;
  $("#cmpGames").innerHTML = "";
  moreCompare();
}
function moreCompare() {
  if (!cmp.list.length) { $("#cmpGames").innerHTML = `<li class="empty-li">${emptyState("Nada faltando aqui", "Todos os jogos deste lado também estão no outro lugar.", false)}</li>`; $("#cmpMore").classList.add("hidden"); return; }
  $("#cmpGames").insertAdjacentHTML("beforeend", gridHtml(cmp.list.slice(cmp.offset, cmp.offset + 60)));
  cmp.offset += 60;
  $("#cmpMore").classList.toggle("hidden", cmp.offset >= cmp.list.length);
}

// ---------- saúde ----------
const getHealth = async () => (state.health ||= await api("/api/health"));
async function loadHealthTiles() {
  const h = await getHealth();
  const sumN = (rows) => rows.reduce((a, r) => a + (r.n || 0), 0);
  $("#healthTiles").innerHTML = [
    ["triangle-alert", fmtN(h.corrupted.length), "arquivos corrompidos", h.corrupted.length > 0],
    ["archive", fmtN(sumN(h.noBackup)), `jogos sem backup no Drive (${fmtN(h.noBackup.length)} sistemas)`],
    ["cloud", fmtN(sumN(h.driveOnly)), `jogos só no Drive (${fmtN(h.driveOnly.length)} sistemas)`],
  ].map(([ic, n, label, bad]) => `<a class="htile ${bad ? "bad" : ""}" href="#health">${icon(ic)}<div><b>${n}</b><span>${label}</span></div></a>`).join("");
}
async function loadHealth() {
  const h = await getHealth();
  const sumN = (rows) => rows.reduce((a, r) => a + (r.n || 0), 0);
  // Para cada corrompido: existe cópia boa (verificada) em outro lugar? Isso define a ação.
  const action = (c) => {
    const ok = c.others.find((o) => o.status === "ok");
    if (ok) return ["ok", `Cópia boa em ${copyLabel(deviceOf(ok.device_id), ok.location_id)}: copie de lá`];
    const drive = c.others.find((o) => o.device_id === "drive");
    if (drive) return ["warn", "Há cópia no Drive, não verificada (pode ter o mesmo defeito)"];
    return ["bad", "Sem outra cópia: baixe de novo da fonte"];
  };
  const groups = { ok: [], warn: [], bad: [] };
  for (const c of h.corrupted) groups[action(c)[0]].push(c);
  const byLoc = {};
  for (const c of h.corrupted) byLoc[c.location_id] = (byLoc[c.location_id] || 0) + 1;
  const sysList = (rows, status, label) => rows.length ? `<ul class="list" tabindex="0" aria-label="${esc(label)}">${rows.map((r) =>
    `<li><a class="tlink" href="#games" data-go="${status}|${esc(r.system)}">${esc(sysName(r.system))}</a><span>${fmtN(r.n)} jogos</span></li>`).join("")}</ul>` : `<p class="muted small">Nada aqui.</p>`;
  const item = (c) => { const [kind, text] = action(c); return `<li><a class="tlink" href="${gameHref(c)}">${esc(c.title)}</a>
      <span class="muted small">${esc(sysName(c.system))} · ${esc(copyLabel(deviceOf(c.device_id), c.location_id))}</span>
      <span class="fix ${kind}">${esc(text)}</span></li>`; };
  $("#health").innerHTML = `
    <div class="kpis" role="list" aria-label="Resumo da saúde">
      ${[["Corrompidos", h.corrupted.length, "triangle-alert", "arquivos com o começo zerado", "corrupted", h.corrupted.length > 0],
         ["Sem backup no Drive", sumN(h.noBackup), "archive", `jogos em ${h.noBackup.length} plataformas`, "nobackup"],
         ["Só no Drive", sumN(h.driveOnly), "cloud", `jogos em ${h.driveOnly.length} plataformas`, "driveonly"]]
        .map(([l, n, ic, sub, st, bad]) => `<div class="kpi ${bad ? "bad" : ""}" role="listitem"><span class="kpi-label">${icon(ic, "sm")}${l}</span>
          <span class="kpi-value">${fmtN(n)}</span><span class="kpi-sub">${sub}</span>
          <button type="button" class="btn small-btn" data-go="${st}|">Ver jogos</button></div>`).join("")}
    </div>
    <section class="tile" aria-labelledby="t-corr">
      <div class="tile-head"><h2 id="t-corr">${icon("triangle-alert", "sm")}Corrompidos: o que fazer</h2>
        <span class="muted small">${Object.entries(byLoc).map(([l, n]) => `${esc(copyLabel(deviceOf(locOf(l).device_id), l))}: ${fmtN(n)}`).join(" · ")}</span></div>
      <p class="muted small">Os primeiros 256 KB do arquivo estão zerados, então o emulador não abre. O caminho depende de existir outra cópia boa.</p>
      <div class="fixgroups">
        ${[["ok", "Copiar de outro lugar", "cópia boa já existe"], ["warn", "Conferir a cópia do Drive", "não verificada"], ["bad", "Baixar de novo", "sem outra cópia"]]
          .map(([k, t, sub]) => `<details ${groups[k].length && k !== "warn" ? "open" : ""}><summary><span class="fix ${k}">${t}</span> <b>${fmtN(groups[k].length)}</b> <span class="muted small">${sub}</span></summary>
            ${groups[k].length ? `<ul class="list fixlist" tabindex="0" aria-label="${t}">${groups[k].map(item).join("")}</ul>` : `<p class="muted small">Nenhum.</p>`}</details>`).join("")}
      </div>
    </section>
    <div class="grid-2">
      <section class="tile" aria-labelledby="t-nob"><h2 id="t-nob">${icon("archive", "sm")}Sem backup no Drive, por plataforma</h2>
        <p class="muted small" style="margin-bottom:10px">Estão em algum console, mas não no Drive. Vale copiar para o Drive. Switch, ports e jogos de PC ficam fora do backup por escolha e não entram nesta conta.</p>${sysList(h.noBackup, "nobackup", "Sem backup no Drive")}</section>
      <section class="tile" aria-labelledby="t-don"><h2 id="t-don">${icon("cloud", "sm")}Só no Drive, por plataforma</h2>
        <p class="muted small" style="margin-bottom:10px">Estão no acervo, mas em nenhum console. Bom para escolher o que instalar.</p>${sysList(h.driveOnly, "driveonly", "Só no Drive")}</section>
    </div>`;
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-go]");
  if (!b) return;
  e.preventDefault();
  const [status, system] = b.dataset.go.split("|");
  goGames({ device: "", status, system: system || "" });
});

// ---------- início ----------
// Lista longa mostra os primeiros N itens e um botão "Mostrar mais" (aria-expanded) logo depois.
function clampList(ul, n, what) {
  ul.nextElementSibling?.classList.contains("more-btn") && ul.nextElementSibling.remove();
  const total = ul.children.length;
  ul.classList.toggle("clamped", total > n);
  ul.style.setProperty("--clamp", n);
  if (total <= n) return;
  const b = document.createElement("button");
  b.type = "button"; b.className = "btn more-btn"; b.setAttribute("aria-expanded", "false");
  const label = () => (ul.classList.contains("open") ? "Mostrar menos" : `Mostrar mais (${total - n})`);
  b.textContent = label();
  b.setAttribute("aria-label", `${what}: ${label().toLowerCase()}`);
  b.onclick = () => {
    ul.classList.toggle("open");
    b.setAttribute("aria-expanded", ul.classList.contains("open"));
    b.textContent = label();
    b.setAttribute("aria-label", `${what}: ${label().toLowerCase()}`);
  };
  ul.after(b);
}

// Botão "Filtros" (tela estreita): abre/fecha os seletores e mostra quantos estão ativos.
(() => {
  const btn = $("#fMoreBtn"), box = $("#fMore");
  if (!btn) return;
  const count = () => {
    const n = ["#fDevice", "#fSystem", "#fStatus", "#fScore"].filter((id) => $(id).value).length;
    $("#fMoreLabel").textContent = n ? `Filtros (${n})` : "Filtros";
  };
  btn.onclick = () => { box.classList.toggle("open"); btn.setAttribute("aria-expanded", box.classList.contains("open")); };
  box.addEventListener("change", count);
  window.HH_FILTERCOUNT = count;                     // filtros trocados por link/chip também atualizam o número
  count();
})();

// ---------- entre os aparelhos (visão geral) ----------
// Mapa plataforma × aparelho (tela Comparar). Sombra proporcional à fatia da plataforma em cada lugar;
// o número está sempre escrito (a cor só reforça).
async function drawMatrix(all = false) {
  const x = await api("/api/insights");
  const devs = state.devices.map((d) => d.id);
  const rows = all ? x.matrix : x.matrix.slice(0, 15);
  $("#matrix").innerHTML = `<caption class="sr-only">Jogos únicos por plataforma e aparelho</caption>
    <thead><tr><th scope="col">Plataforma</th>${devs.map((d) => `<th scope="col" ${dev(d)}><i class="dot"></i>${esc(shortName(deviceOf(d)))}</th>`).join("")}<th scope="col" class="num-cell">Total</th></tr></thead>
    <tbody>${rows.map((r) => `<tr><th scope="row"><a class="tlink" href="#platform-${esc(r.system)}">${esc(sysName(r.system))}</a></th>${devs.map((d) => {
      const n = r.by[d] || 0, share = n / r.total;
      return `<td class="mcell" style="--share:${Math.round(share * 100)}%">${n ? `<button type="button" data-dev-sys="${esc(d)}|${esc(r.system)}" aria-label="${fmtN(n)} jogos de ${esc(sysName(r.system))} em ${esc(shortName(deviceOf(d)))}">${fmtN(n)}</button>` : `<span class="muted" aria-label="nenhum">—</span>`}</td>`;
    }).join("")}<td class="num-cell"><b>${fmtN(r.total)}</b></td></tr>`).join("")}</tbody>`;
  $("#matrixMore").hidden = all || x.matrix.length <= 15;
}
$("#matrix").addEventListener("click", (e) => {
  const b = e.target.closest("[data-dev-sys]");
  if (!b) return;
  const [d, sys] = b.dataset.devSys.split("|");
  goGames({ device: d, system: sys, status: "" });
});
$("#matrixMore").onclick = () => drawMatrix(true);

const whereLabel = (sig) => sig.split("+").map((d) => shortName(deviceOf(d))).join(" + ");
async function loadRelation() {
  const x = await api("/api/insights");
  const max = Math.max(...x.combos.map((c) => c.n), 1);
  // Risco: com backup (Drive + console), sem backup (só em console), só no Drive (não está em nenhum console).
  const risk = (ds) => {
    const drive = ds.includes("drive"), cons = ds.some((d) => d !== "drive");
    if (ds.length === 1 && ds[0] === "switch") return ["muted", "info", "fora do backup"];   // Switch: fora por decisão
    return drive && cons ? ["ok", "shield-check", "com backup"] : cons ? ["warn", "triangle-alert", "sem backup"] : ["muted", "cloud", "só no Drive"];
  };
  $("#relCombos").innerHTML = x.combos.map((c) => {
    const [cls, ic, label] = risk(c.devices), sig = c.devices.join("+");
    return `<li><button type="button" class="combo" data-where="${esc(sig)}" aria-label="${esc(whereLabel(sig))}: ${fmtN(c.n)} jogos, ${label}. Ver jogos">
      <span class="combo-devs">${c.devices.map((d) => `<i class="dot" ${dev(d)} title="${esc(shortName(deviceOf(d)))}"></i>`).join("")}<span>${esc(whereLabel(sig))}</span></span>
      <span class="combo-tag ${cls}">${icon(ic, "sm")}${label}</span>
      <span class="bar"><i style="width:${(c.n / max) * 100}%"></i></span>
      <b class="combo-n">${fmtN(c.n)}</b></button></li>`;
  }).join("");
  $("#relInstall").innerHTML = x.install.filter((i) => i.games).map((i) => {
    const d = deviceOf(i.device), fits = i.space ? i.bytes <= i.space.free : null;
    const pctFree = i.space ? Math.min(100, (i.bytes / Math.max(i.space.free, 1)) * 100) : null;
    return `<article class="install" ${dev(i.device)}>
      <header><i class="dot"></i><b>${esc(d.name)}</b><span class="muted small">${fmtN(i.have)} jogos hoje</span></header>
      <p class="install-n"><span class="kpi-value">${fmtN(i.games)}</span> <span class="muted">jogos de plataformas que ele já roda</span></p>
      <p class="small">~${fmtB(i.bytes)}${i.space ? ` · ${fits ? "cabe" : "não cabe tudo"} nos ${fmtB(i.space.free)} livres` : ""}</p>
      ${pctFree !== null ? `<span class="bar ${fits ? "" : "over"}" role="img" aria-label="Ocuparia ${Math.round(pctFree)}% do espaço livre"><i style="width:${pctFree}%"></i></span>` : ""}
      <p class="install-top muted small">Mais em ${i.top.map(([s, n]) => `${esc(sysName(s))} (${fmtN(n)})`).join(", ")}</p>
      <button type="button" class="btn" data-missing="${esc(i.device)}">Ver jogos para instalar</button>
    </article>`;
  }).join("") || `<p class="muted small">Todos os consoles já têm tudo das plataformas que rodam.</p>`;
}
$("#relCombos").addEventListener("click", (e) => { const b = e.target.closest("[data-where]"); if (b) goGames({ device: "", system: "", status: "", where: b.dataset.where }); });
$("#relInstall").addEventListener("click", (e) => { const b = e.target.closest("[data-missing]"); if (b) goGames({ device: "", system: "", status: "", missing: b.dataset.missing }); });

// Aviso rápido no rodapé (some sozinho em 5 s; pausa com o mouse ou o foco em cima). Anunciado pelo leitor de tela.
function toast(msg, { undo } = {}) {
  const box = $("#toasts"), el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = `<span>${esc(msg)}</span>${undo ? `<button type="button" class="toast-undo">Desfazer</button>` : ""}`;
  box.replaceChildren(el);                           // um aviso por vez: o novo substitui o anterior
  let left = 5000, start = Date.now(), timer;
  const close = () => { el.classList.add("out"); setTimeout(() => el.remove(), 200); };
  const run = () => { start = Date.now(); timer = setTimeout(close, left); };
  const pause = () => { clearTimeout(timer); left -= Date.now() - start; };
  el.addEventListener("mouseenter", pause); el.addEventListener("mouseleave", run);
  el.addEventListener("focusin", pause); el.addEventListener("focusout", run);
  el.querySelector(".toast-undo")?.addEventListener("click", () => { undo(); clearTimeout(timer); close(); });
  run();
}

// Preferências que vieram de outro aparelho e mudam o que já está na tela.
function applyRemotePrefs(changed = []) {
  if (changed.includes("hh_theme")) { document.documentElement.dataset.theme = pref("hh_theme", ""); themeLabel(); }
  if (changed.includes("hh_layout")) { layout = loadLayout(); applyLayout(); }
  if (changed.includes("hh_view")) { const v = pref("hh_view", "grid"); if (["grid", "list"].includes(v)) viewMode = v; }
  if (changed.includes("hh_gsort")) $("#fSort").value = pref("hh_gsort", "");
}

// ---------- configurações ----------
// Tela única com as preferências (as mesmas chaves que cada tela já usa; sincronizadas por /api/prefs).
function drawSettings() {
  const color = pref("hh_theme", "");
  document.querySelectorAll("#sColor button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.color === color)));
  document.querySelectorAll("#sView button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.viewMode === viewMode)));
  $("#sSort").value = pref("hh_gsort", "");
  $("#sThemeName").textContent = THEME.cur ? `${THEME.cur.name} · ${THEME.cur.authors.join(", ")}` : "Arrow (padrão) · Post Mortem";
  $("#sKeys").checked = pref("hh_keys", "on") !== "off";
  $("#sRaUser").value = pref("hh_ra_user", "");
  $("#sRaUser").placeholder = state.me?.role === "admin" ? "guconstantino (padrão)" : "seu usuário no RA";
  let hosts = [];
  try { hosts = JSON.parse(localStorage.getItem("hh-trusted-hosts") || "[]"); } catch {}
  $("#sTrusted").innerHTML = hosts.length ? hosts.map((h) => `<li><span>${esc(h)}</span><button type="button" class="btn" data-untrust="${esc(h)}" aria-label="Voltar a perguntar antes de abrir ${esc(h)}">Remover</button></li>`).join("")
    : `<li class="muted small">Nenhum. Todo site externo pergunta antes de abrir.</li>`;
}
$("#sColor").addEventListener("click", (e) => {
  const b = e.target.closest("[data-color]");
  if (!b) return;
  const v = b.dataset.color;
  if (v) { document.documentElement.dataset.theme = v; setPref("hh_theme", v); }
  else { delete document.documentElement.dataset.theme; try { localStorage.removeItem("hh_theme"); } catch {} }
  themeLabel(); drawSettings();
});
$("#sView").addEventListener("click", (e) => {
  const b = e.target.closest("[data-view-mode]");
  if (!b) return;
  viewMode = b.dataset.viewMode; setPref("hh_view", viewMode);
  if (state.loaded.games) renderGames();
  drawSettings();
});
$("#sSort").onchange = (e) => { setPref("hh_gsort", e.target.value); $("#fSort").value = e.target.value; if (state.loaded.games) loadGames(); toast("Ordenação salva"); };
$("#sThemeBtn").onclick = () => $("#themeBtn").click();
$("#themeDlg").addEventListener("close", () => { if (location.hash === "#settings") drawSettings(); });
$("#sLayout").onclick = () => $("#customize").click();
$("#sKeys").onchange = (e) => {
  setPref("hh_keys", e.target.checked ? "on" : "off");
  const s = $("#singleKeys"); if (s) s.checked = e.target.checked;   // o atalho de busca lê esta caixa
  toast(e.target.checked ? "Atalhos de uma tecla ligados" : "Atalhos de uma tecla desligados");
};
$("#sTrusted").addEventListener("click", (e) => {
  const b = e.target.closest("[data-untrust]");
  if (!b) return;
  let hosts = [];
  try { hosts = JSON.parse(localStorage.getItem("hh-trusted-hosts") || "[]"); } catch {}
  setPref("hh-trusted-hosts", JSON.stringify(hosts.filter((h) => h !== b.dataset.untrust)));
  drawSettings();
});
$("#sRaForm").onsubmit = async (e) => {
  e.preventDefault();
  const v = $("#sRaUser").value.trim();
  if (v && !/^[A-Za-z0-9_]{2,20}$/.test(v)) { toast("Usuário do RA: só letras, números e _ (2 a 20)"); return; }
  setPref("hh_ra_user", v);
  RA.data = null; RA.keyOf.clear();
  RA.ready = loadRA(); await RA.ready;
  if (!RA.data) $("#contBlock").hidden = true;
  drawContinue();
  toast(RA.data ? `RetroAchievements: ${RA.data.user}` : v ? "Não achei esse usuário no RetroAchievements" : "RetroAchievements: padrão");
};
$("#sReset").onclick = () => {
  if (!confirm("Restaurar todas as preferências ao padrão? Suas listas não mudam.")) return;
  for (const k of SYNC_KEYS) { try { localStorage.removeItem(k); } catch {} }
  schedulePrefSync();
  setTimeout(() => location.reload(), 1800);          // depois do envio (1,5 s): os outros aparelhos recebem o padrão também
  toast("Preferências restauradas. Recarregando…");
};

// ---------- admin ----------
// Quem está logado (Cloudflare Access) e o papel. Admin vê o painel; usuário comum, não.
async function loadMe() {
  try { const r = await fetch("api/me", { credentials: "same-origin" }); state.me = r.ok ? await r.json() : null; } catch { state.me = null; }
  const admin = state.me?.role === "admin";
  $("#sAdmin").hidden = !admin;
  window.HH_ADMIN = admin;                            // a busca global mostra "Admin" só para admin
}
const ROUTINES = [
  ["Varrer o S20 FE (adb, ~20–40 min)", "npm run scan:s20"],
  ["Varrer o cartão do Miyoo (montado no Mac)", "npm run scan:miyoo"],
  ["Varrer a pasta do Drive no Mac", "npm run scan:drive"],
  ["Capas novas (libretro, arcade) e envio ao R2", "~/.cache/s20fe-outpaint/bin/python scripts/covers.py --all && ~/.cache/s20fe-outpaint/bin/python scripts/covers.py --arcade && ~/.cache/s20fe-outpaint/bin/python scripts/covers.py --sql && npm run r2"],
  ["Gerar o catálogo e publicar", "python3 scripts/catalog.py && npx wrangler deploy"],
  ["Textos “Sobre o jogo” (Wikipédia; horas, por causa do limite)", "python3 scripts/game_about.py"],
  ["Consertar ROMs corrompidas do S20 (relatório; --apply troca)", "python3 scripts/fix_corrupted.py"],
];
async function renderAdmin() {
  const body = $("#adminBody");
  if (state.me && state.me.role !== "admin") { body.innerHTML = emptyState("Só para admin", "Esta tela é do administrador do portal."); return; }
  // Vai direto ao Worker (o api() do portal responde pelo catálogo local, que não tem usuários).
  const x = await fetch("api/admin/overview", { credentials: "same-origin" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const rel = (t) => (t ? new Date(t).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");
  const users = x?.users || [];
  const locs = [...state.locations].sort((a, b) => (a.last_scan || "").localeCompare(b.last_scan || ""));
  const old = (s) => !s || (Date.now() - new Date(s)) / 864e5 > 30;
  body.innerHTML = `
    <section class="tile" aria-labelledby="t-a-users">
      <div class="tile-head"><h2 id="t-a-users">Usuários</h2><span class="muted small">Quem já usou o portal (listas ou preferências salvas)</span></div>
      ${users.length ? `<div class="xscroll" tabindex="0" role="region" aria-labelledby="t-a-users"><table class="table">
        <thead><tr><th scope="col">E-mail</th><th scope="col">Papel</th><th scope="col" class="num-cell">Jogando</th><th scope="col" class="num-cell">Favoritos</th><th scope="col" class="num-cell">Quero jogar</th><th scope="col" class="num-cell">Zerei</th><th scope="col">Última atividade</th></tr></thead>
        <tbody>${users.map((u) => `<tr><td>${esc(u.email)}${u.email === x.me ? ` <span class="muted small">(você)</span>` : ""}</td>
          <td><span class="badge ${u.role === "admin" ? "ok" : ""}">${u.role === "admin" ? "admin" : "usuário"}</span></td>
          ${["playing", "fav", "want", "done"].map((l) => `<td class="num-cell">${fmtN(u.lists?.[l] || 0)}</td>`).join("")}
          <td>${rel(u.at)}</td></tr>`).join("")}</tbody></table></div>`
        : `<p class="muted small">${x ? "Ninguém salvou listas ou preferências ainda." : "Os usuários só aparecem no portal publicado (o KV fica no Cloudflare)."}</p>`}
      <details class="howto"><summary>Dar acesso a alguém novo</summary>
        <ol>
          <li>No Cloudflare: Zero Trust → Access → Policies → <b>Só Gustavo</b> → incluir o e-mail da pessoa (Emails).</li>
          <li>Ela entra em gamehub.gustavoconstantino.com com esse e-mail (código de uso único). Já chega como <b>usuário</b>, com listas e preferências próprias.</li>
          <li>Para virar admin: <code>npx wrangler secret put ADMINS</code> com todos os e-mails de admin separados por vírgula.</li>
        </ol></details>
    </section>
    <section class="tile" aria-labelledby="t-a-scan">
      <div class="tile-head"><h2 id="t-a-scan">Varreduras</h2><span class="muted small">Mais de 30 dias sem varrer aparece em destaque</span></div>
      <div class="xscroll" tabindex="0" role="region" aria-labelledby="t-a-scan"><table class="table">
        <thead><tr><th scope="col">Local</th><th scope="col">Última varredura</th><th scope="col" class="num-cell">Arquivos</th><th scope="col" class="num-cell">Corrompidos</th><th scope="col" class="num-cell">Tamanho</th></tr></thead>
        <tbody>${locs.map((l) => `<tr ${dev(l.device_id)}><td><span class="cell-dev"><i class="dot"></i>${esc(copyLabel(deviceOf(l.device_id), l.id))}</span></td>
          <td>${old(l.last_scan) ? `<span class="badge bad">${fmtDate(l.last_scan)}</span>` : fmtDate(l.last_scan)}</td>
          <td class="num-cell">${fmtN(l.files || 0)}</td><td class="num-cell">${l.corrupted ? `<a class="tlink" href="#health">${fmtN(l.corrupted)}</a>` : "0"}</td>
          <td class="num-cell">${l.bytes ? fmtB(l.bytes) : "—"}</td></tr>`).join("")}</tbody></table></div>
    </section>
    <section class="tile" aria-labelledby="t-a-run">
      <div class="tile-head"><h2 id="t-a-run">Rotinas de atualização</h2><span class="muted small">Rodar no Mac, na pasta handheld-hub</span></div>
      <ul class="routines">${ROUTINES.map(([label, cmd]) => `<li><span>${esc(label)}</span><code>${esc(cmd)}</code><button type="button" class="copy" data-copy="${esc(cmd)}">Copiar</button></li>`).join("")}</ul>
    </section>`;
}
$("#adminBody").addEventListener("click", (e) => {
  const b = e.target.closest("[data-copy]");
  if (!b) return;
  navigator.clipboard?.writeText(b.dataset.copy).then(() => toast("Comando copiado"), () => toast("Não consegui copiar"));
});

// Imagem ampliada (sem sair do portal): setas trocam, Esc fecha.
/* O CDN do RAWG só serve alguns tamanhos: crop/640/360 dá 404, resize/640/- funciona. */
const rawgImg = (u) => u.replace(/\/media\/crop\/\d+\/\d+\//, "/media/resize/640/-/");

function openShot(shots, n, title) {
  const dlg = $("#shotDlg"), big = (u) => rawgImg(u).replace("/resize/640/-/", "/resize/1280/-/");
  const show = () => {
    $("#shotImg").src = big(shots[n]);
    $("#shotImg").alt = `Imagem ${n + 1} de ${shots.length} de ${title}`;
    $("#shotCount").textContent = `${n + 1} / ${shots.length}`;
  };
  $("#shotPrev").onclick = () => { n = (n - 1 + shots.length) % shots.length; show(); };
  $("#shotNext").onclick = () => { n = (n + 1) % shots.length; show(); };
  dlg.onkeydown = (e) => { if (e.key === "ArrowLeft") $("#shotPrev").click(); if (e.key === "ArrowRight") $("#shotNext").click(); };
  show();
  dlg.showModal();
}

// ---------- tema das plataformas ----------
async function loadThemes() {
  THEME.list = await fetch("data/themes.json").then((r) => (r.ok ? r.json() : [])).catch(() => []);
  THEME.cur = THEME.list.find((t) => t.id === pref("hh_ptheme", "")) || null;
  $("#themeName").textContent = THEME.cur?.name || "Arrow";
  if (!THEME.list.length) $("#themeBtn").hidden = true;
}
function drawThemes() {
  const q = $("#themeFilter").value.trim().toLowerCase();
  const all = [{ id: "", name: "Arrow", authors: ["Post Mortem"], systems: null }, ...THEME.list];
  const shown = all.filter((t) => !q || t.name.toLowerCase().includes(q) || t.authors.join(" ").toLowerCase().includes(q));
  const cur = THEME.cur?.id || "";
  $("#themeCount").textContent = `${fmtN(shown.length)} de ${fmtN(all.length)} temas`;
  $("#themeList").innerHTML = shown.map((t) => {
    // Prévia comparável: a mesma plataforma (Super Nintendo) em todos os temas; miniatura do pacote só se faltar.
    const pick = t.id && ["snes", "gba", "megadrive", "psx"].find((x) => t.systems.includes(x));
    const img = !t.id ? "platforms/snes.webp" : pick ? `themes/${t.id}/${pick}.webp` : t.thumb ? `themes/${t.id}/_thumb.webp` : `themes/${t.id}/${t.systems[0]}.webp`;
    return `<li><button type="button" class="theme-opt" data-theme="${esc(t.id)}" aria-pressed="${t.id === cur}">
      <img src="${esc(img)}" alt="" loading="lazy" decoding="async">
      <span><b>${esc(t.name)}${t.id ? "" : " (padrão)"}</b><span class="muted small">${esc(t.authors.join(", ") || "autor não informado")}${t.systems ? ` · ${fmtN(t.systems.length)} plataformas` : ""}</span></span>
    </button></li>`;
  }).join("") || `<li class="muted small">Nenhum tema com esse nome.</li>`;
}
$("#themeBtn").onclick = () => { $("#themeFilter").value = ""; drawThemes(); $("#themeDlg").showModal(); };
$("#themeFilter").oninput = drawThemes;
$("#themeList").onclick = (e) => {
  const b = e.target.closest("[data-theme]");
  if (!b) return;
  THEME.cur = THEME.list.find((t) => t.id === b.dataset.theme) || null;
  setPref("hh_ptheme", THEME.cur?.id || "");
  $("#themeName").textContent = THEME.cur?.name || "Arrow";
  drawThemes();
  // As telas ficam montadas em cache: troca as imagens de plataforma que já estão na página
  // (com transição suave quando o navegador tem View Transitions e o movimento não está reduzido).
  const swap = () => document.querySelectorAll('img[src^="platforms/"], img[src^="themes/"]').forEach((img) => {
    const src = img.getAttribute("src");
    const sys = decodeURIComponent(src.includes("#") ? src.split("#")[1] : src.split("/").pop().replace(/\.webp$/, ""));
    if (sys && !sys.startsWith("_") && !img.closest("#themeList")) img.setAttribute("src", platImg(sys));
  });
  if (document.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) document.startViewTransition(swap);
  else swap();
};

// Links para outros sites (Drive, Wikipédia, RetroAchievements…) pedem confirmação antes de sair do portal.
// Delegação: vale para links criados depois. "Não perguntar de novo" fica por site, neste aparelho.
(() => {
  const dlg = $("#leaveDlg"), KEY = "hh-trusted-hosts";
  const trusted = () => { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } };
  let pending = null;
  const go = ({ url, blank }) => (blank ? window.open(url, "_blank", "noopener") : location.assign(url));
  const intercept = (e) => {
    const a = e.target.closest?.("a[href]");
    if (!a || e.defaultPrevented || (e.type === "auxclick" && e.button !== 1)) return;
    const url = new URL(a.href, location.href);
    if (!/^https?:$/.test(url.protocol) || url.origin === location.origin) return;
    const host = url.hostname.replace(/^www\./, "");
    const blank = a.target === "_blank" || e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1;
    if (trusted().includes(host)) return;                    // segue o comportamento normal do link
    e.preventDefault();
    pending = { url: url.href, blank, host };
    $("#leaveHost").textContent = host;
    $("#leaveUrl").textContent = url.href.length > 120 ? url.href.slice(0, 117) + "…" : url.href;
    $("#leaveTrust").checked = false;
    dlg.showModal();
  };
  document.addEventListener("click", intercept);
  document.addEventListener("auxclick", intercept);
  // Abre no próprio clique do botão (gesto do usuário): o Safari bloqueia janela aberta depois.
  $("#leaveGo").onclick = () => {
    if (!pending) return dlg.close();
    if ($("#leaveTrust").checked) { try { localStorage.setItem(KEY, JSON.stringify([...new Set([...trusted(), pending.host])])); } catch {} }
    const p = pending; pending = null;
    dlg.close();
    go(p);
  };
  dlg.addEventListener("close", () => { pending = null; });
})();

let portsCache = null, portsFilter = "all", portsSort = "status", portsQuery = "", liveHashes = { epicHash: null, portsHash: null };
async function fetchLiveOrStatic(liveUrl, staticUrl) {
  try {
    const r = await fetch(liveUrl, { cache: "no-store" });
    if (r.ok) return await r.json();
  } catch {}
  const r2 = await fetch(staticUrl, { cache: "no-store" });
  if (!r2.ok) throw new Error(`${staticUrl} não encontrado`);
  return await r2.json();
}

async function loadPortsFeed(forceReload = false) {
  const block = $("#portsFeedBlock");
  if (!block) return;
  try {
    if (!portsCache || forceReload) {
      portsCache = await fetchLiveOrStatic("/api/live/ports", "data/ports-radar.json");
    }
    const c = portsCache.counts || {};
    const all = portsCache.ports || [];
    if (!all.length) return;

    // Badges no cabeçalho
    const updates = all.filter((p) => p.updateStatus === "update-available").length;
    const ready = all.filter((p) => p.updateStatus === "ready-to-install").length;

    let kpiHtml = `<span class="badge ok">${c.installed || 0} no S20 FE</span>`;
    if (updates > 0) {
      kpiHtml += `<span class="badge warn" style="font-weight:600">${updates} update${updates > 1 ? "s" : ""}!</span>`;
    }
    if (ready > 0) {
      kpiHtml += `<span class="badge" style="background:var(--accent);color:#fff">${ready} pronto${ready > 1 ? "s" : ""}</span>`;
    }
    kpiHtml += `<span class="badge muted">${(c.desktopRecomp || 0) + (c.decompRadar || 0)} no radar</span>`;
    const kpisEl = $("#portsFeedKpis");
    if (kpisEl) kpisEl.innerHTML = kpiHtml;

    const allBtn = $("#portsFeedAllBtn");
    if (allBtn) allBtn.innerHTML = `Ver todos (${all.length}) <svg class="ic sm" aria-hidden="true"><use href="icons.svg#i-chevron-right"/></svg>`;

    // Ordenar itens do feed: updates primeiro, prontos para Android depois, depois por data recente de lançamento
    const sorted = [...all].sort((a, b) => {
      const aUp = a.updateStatus === "update-available" ? 1 : 0;
      const bUp = b.updateStatus === "update-available" ? 1 : 0;
      if (bUp !== aUp) return bUp - aUp;

      const aRdy = a.updateStatus === "ready-to-install" ? 1 : 0;
      const bRdy = b.updateStatus === "ready-to-install" ? 1 : 0;
      if (bRdy !== aRdy) return bRdy - aRdy;

      const dateA = a.publishedAt || "1970-01-01";
      const dateB = b.publishedAt || "1970-01-01";
      return dateB.localeCompare(dateA);
    });

    const feedList = $("#portsFeedList");
    if (!feedList) return;

    feedList.innerHTML = sorted.slice(0, 10).map((p) => {
      let statusBadge = "";
      if (p.updateStatus === "update-available") {
        statusBadge = `<span class="port-feed-badge warn">🔄 Update</span>`;
      } else if (p.updateStatus === "ready-to-install" || p.category === "android-ready") {
        statusBadge = `<span class="port-feed-badge info">📲 Pronto p/ Instalar</span>`;
      } else if (p.category === "installed") {
        statusBadge = `<span class="port-feed-badge ok">✅ No S20 FE</span>`;
      } else if (p.category === "decomp-radar") {
        const is100 = (p.name || "").includes("100%") || (p.features || []).some((f) => f.includes("100%"));
        statusBadge = is100
          ? `<span class="port-feed-badge" style="background:#0891b2;color:#fff">🎯 Decomp 100%</span>`
          : `<span class="port-feed-badge muted">⏳ Não jogável</span>`;
      } else {
        statusBadge = `<span class="port-feed-badge" style="background:#7c3aed;color:#fff">💻 Só PC</span>`;
      }

      const coverSrc = p.iconUrl || "icons/favicon-96.png";
      const relDate = p.publishedAt ? p.publishedAt.split("-").reverse().slice(0, 2).join("/") : "";

      return `<a class="port-feed-card" href="#ports" title="${esc(p.name)} · ${esc(p.engine)}">
        <div class="port-feed-thumb">
          <img src="${esc(coverSrc)}" alt="${esc(p.name)}" loading="lazy" onerror="this.src='icons/favicon-96.png'">
          ${statusBadge}
        </div>
        <div class="port-feed-info">
          <strong class="port-feed-title">${esc(p.shortName || p.name)}</strong>
          <div class="port-feed-meta">
            <span class="engine-tag">${esc(p.engine || "Port")}</span>
            ${relDate ? `<span class="date-tag">${relDate}</span>` : ""}
          </div>
        </div>
      </a>`;
    }).join("");
  } catch (e) {
    console.warn("loadPortsFeed error:", e);
  }
}

async function renderPorts(forceReload = false) {
  const el = $("#portsBody");
  if (!el) return;
  try {
    if (!portsCache || forceReload) {
      portsCache = await fetchLiveOrStatic("/api/live/ports", "data/ports-radar.json");
    }
    const c = portsCache.counts || {};
    const all = portsCache.ports || [];
    const pkgStats = {};
    if (s20Telemetry) {
      for (const arr of [s20Telemetry.mostPlayed, s20Telemetry.recentOpened]) {
        if (Array.isArray(arr)) {
          arr.forEach((it) => { if (it.pkg && !pkgStats[it.pkg]) pkgStats[it.pkg] = it; });
        }
      }
    }

    const updatesCount = all.filter((p) => p.updateStatus === "update-available").length;
    const readyCount = all.filter((p) => p.category === "android-ready" || p.updateStatus === "ready-to-install").length;
    const ptbrCount = all.filter((p) => p.ptbr && p.ptbr !== "—" && !p.ptbr.toLowerCase().startsWith("não")).length;
    const pcCount = all.filter((p) => p.category === "n64recomp-desktop").length;
    const decompCount = all.filter((p) => p.category === "decomp-radar").length;
    const installedCount = all.filter((p) => p.category === "installed").length;

    const filtered = all.filter((p) => {
      if (portsFilter === "installed" && p.category !== "installed") return false;
      if (portsFilter === "updates" && p.updateStatus !== "update-available") return false;
      if (portsFilter === "ready" && !(p.category === "android-ready" || p.updateStatus === "ready-to-install")) return false;
      if (portsFilter === "pc" && p.category !== "n64recomp-desktop") return false;
      if (portsFilter === "decomp" && p.category !== "decomp-radar") return false;
      if (portsFilter === "ptbr" && !(p.ptbr && p.ptbr !== "—" && !p.ptbr.toLowerCase().startsWith("não"))) return false;

      if (portsQuery) {
        const q = portsQuery.toLowerCase();
        const hay = `${p.name || ""} ${p.shortName || ""} ${p.engine || ""} ${p.system || ""} ${p.packageName || ""} ${p.repository || ""} ${p.ptbr || ""} ${(p.features || []).join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const getStatusPriority = (p) => {
      if (p.updateStatus === "update-available") return 0;
      if (p.category === "android-ready" || p.updateStatus === "ready-to-install") return 1;
      if (p.category === "installed") return 2;
      if (p.category === "n64recomp-desktop") return 3;
      if (p.category === "decomp-radar") {
        const is100 = (p.name || "").includes("100%") || (p.features || []).some((f) => f.includes("100%"));
        return is100 ? 4 : 5;
      }
      return 6;
    };

    filtered.sort((a, b) => {
      if (portsSort === "played") {
        const sa = (a.packageName && pkgStats[a.packageName]?.totalSeconds) || 0;
        const sb = (b.packageName && pkgStats[b.packageName]?.totalSeconds) || 0;
        if (sb !== sa) return sb - sa;
        return (a.name || "").localeCompare(b.name || "", "pt-BR");
      }
      if (portsSort === "recent") {
        const da = a.publishedAt || "1970-01-01";
        const db = b.publishedAt || "1970-01-01";
        if (db !== da) return db.localeCompare(da);
        return (a.name || "").localeCompare(b.name || "", "pt-BR");
      }
      if (portsSort === "title") {
        return (a.name || "").localeCompare(b.name || "", "pt-BR");
      }
      if (portsSort === "system") {
        const sa = a.system || "zzz";
        const sb = b.system || "zzz";
        if (sa !== sb) return sa.localeCompare(sb);
        return (a.name || "").localeCompare(b.name || "", "pt-BR");
      }
      if (portsSort === "category") {
        const catOrder = { installed: 0, "android-ready": 1, "n64recomp-desktop": 2, "decomp-radar": 3 };
        const ca = catOrder[a.category] ?? 9, cb = catOrder[b.category] ?? 9;
        if (ca !== cb) return ca - cb;
        return (a.name || "").localeCompare(b.name || "", "pt-BR");
      }
      // default: status (Prontos e Updates primeiro)
      const pa = getStatusPriority(a);
      const pb = getStatusPriority(b);
      if (pa !== pb) return pa - pb;
      if (pa === 2) {
        const sa = (a.packageName && pkgStats[a.packageName]?.totalSeconds) || 0;
        const sb = (b.packageName && pkgStats[b.packageName]?.totalSeconds) || 0;
        if (sb !== sa) return sb - sa;
      }
      return (a.name || "").localeCompare(b.name || "", "pt-BR");
    });

    const statusBadge = (p) => {
      const st = p.packageName ? pkgStats[p.packageName] : null;
      const usageLine = st && st.totalSeconds > 0
        ? `<div class="muted small" style="margin-top:4px">Jogado: <b>${fmtDuration(st.totalSeconds)}</b> · ${fmtRelative(st.lastPlayedAt)}</div>`
        : "";
      if (p.updateStatus === "up-to-date")
        return `<span class="badge ok">Instalado · v${esc(p.installedVersion || "—")}</span>${usageLine}`;
      if (p.updateStatus === "update-available")
        return `<span class="badge warn" title="Instalado: v${esc(p.installedVersion || "")}">Update · ${esc(p.latestTag || "novo")}</span>${usageLine}`;
      if (p.updateStatus === "ready-to-install")
        return `<span class="badge" style="background:var(--accent);color:#fff">APK Android · ${esc(p.latestTag || "pronto")}</span>`;
      if (p.category === "decomp-radar")
        return `<span class="badge" style="background:rgba(85,60,154,0.9);color:#fff">Decomp .dev (${esc(p.system?.toUpperCase() || "WII")})</span>`;
      return `<span class="badge muted">Mac/PC · ${esc(p.latestTag || "N64Recomp")}</span>`;
    };

    const portStateBadge = (p) => {
      if (p.updateStatus === "update-available") {
        return `<span class="port-state-badge state-update" title="Nova versão disponível no GitHub (${esc(p.latestTag || "update")})">🔄 Update</span>`;
      }
      if (p.category === "installed") {
        return `<span class="port-state-badge state-installed" title="Instalado e jogável no S20 FE">✅ No S20 FE</span>`;
      }
      if (p.category === "android-ready" || p.updateStatus === "ready-to-install") {
        return `<span class="port-state-badge state-ready" title="APK oficial pronto para download e instalação no Android">📲 Pronto p/ Instalar</span>`;
      }
      if (p.category === "n64recomp-desktop") {
        return `<span class="port-state-badge state-pc" title="Recompilação executável somente no Mac/PC (sem port Android)">💻 Só PC</span>`;
      }
      if (p.category === "decomp-radar") {
        const is100 = (p.name || "").includes("100%") || (p.features || []).some((f) => f.includes("100%"));
        if (is100) {
          return `<span class="port-state-badge state-decomp-ready" title="Código 100% decompilado, aguardando port Android/Recomp">🎯 Decomp 100%</span>`;
        }
        return `<span class="port-state-badge state-decomp-wip" title="Decompilação em andamento no decomp.dev (ainda não jogável / sem app)">⏳ Não jogável</span>`;
      }
      return "";
    };

    const romBadges = (rom) => {
      if (!rom) return `<span class="muted small">—</span>`;
      const parts = [];
      if (rom.s20Sd) parts.push(`<span class="badge ok" title="${esc(rom.bestPath || "")}">S20 SD</span>`);
      if (rom.gdrive) parts.push(`<span class="badge" title="${esc(rom.bestPath || "")}">Google Drive</span>`);
      return parts.length ? parts.join(" ") : `<span class="muted small">Não exigida / Integrada</span>`;
    };

    const sourceCell = (p) => {
      const canPlay = isS20App() && p.category === "installed" && (p.packageName || p.name);
      const playBtn = canPlay
        ? `<a href="${esc(launchHref(p.packageName, p.name))}" class="btn small play-btn" title="Iniciar ${esc(p.name)} no S20 FE" style="white-space:nowrap">▶ Jogar</a>`
        : "";
      const apkBtn = (p.apkUrl && p.category !== "installed")
        ? `<a href="${esc(p.apkUrl)}" target="_blank" rel="noopener" class="btn small" title="Baixar APK direto (${esc(p.apkName || "app.apk")})" style="white-space:nowrap;background:var(--accent);color:#fff">⬇ APK</a>`
        : "";
      if (!p.repository) return playBtn || apkBtn || `<span class="badge muted">APK Nativo</span>`;
      const shortRepo = p.repository.split("/")[1] || p.repository;
      const href = p.releaseUrl || `https://github.com/${p.repository}`;
      const ghBtn = `<a href="${esc(href)}" target="_blank" rel="noopener" class="btn small" title="${esc(p.repository)}" style="white-space:nowrap">${esc(shortRepo)}</a>`;
      return (playBtn || apkBtn) ? `<div style="display:flex;gap:6px;align-items:center">${playBtn}${apkBtn}${ghBtn}</div>` : ghBtn;
    };

    const syncDate = portsCache.updatedAt
      ? new Date(portsCache.updatedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
      : "—";

    el.innerHTML = `
      <div class="kpis" role="list" aria-label="Resumo de Ports e Decompilações">
        <div class="kpi" role="button" tabindex="0" title="Filtrar instalados no S20 FE" data-kpi-filter="installed" style="cursor:pointer"><span class="kpi-label">${icon("gamepad-2", "sm")}Instalados no S20 FE</span><span class="kpi-value">${fmtN(installedCount)}</span><span class="kpi-sub">60 fps · Widescreen 20:9</span></div>
        <div class="kpi" role="button" tabindex="0" title="Filtrar traduzidos em PT-BR" data-kpi-filter="ptbr" style="cursor:pointer"><span class="kpi-label">${icon("shield-check", "sm")}Traduzidos PT-BR</span><span class="kpi-value">${fmtN(ptbrCount)}</span><span class="kpi-sub">Mods .o2r, Lua e nativos</span></div>
        <div class="kpi" role="button" tabindex="0" title="Filtrar prontos para Android" data-kpi-filter="ready" style="cursor:pointer"><span class="kpi-label">${icon("layers", "sm")}Prontos p/ Android</span><span class="kpi-value">${fmtN(readyCount)}</span><span class="kpi-sub">Com APK oficial no GitHub</span></div>
        <div class="kpi" role="button" tabindex="0" title="Filtrar radar de recomps e decomps" data-kpi-filter="decomp" style="cursor:pointer"><span class="kpi-label">${icon("wrench", "sm")}Radar de Decomps</span><span class="kpi-value">${fmtN(pcCount + decompCount)}</span><span class="kpi-sub">${decompCount} decomp.dev · ${pcCount} recomps</span></div>
      </div>

      <div class="tile">
        <div class="tile-head" style="flex-wrap:wrap;gap:12px">
          <div class="seg tabs" role="group" aria-label="Filtrar categoria de port" id="portsTabs">
            <button type="button" data-pcat="all" aria-pressed="${portsFilter === "all"}">Todos (${all.length})</button>
            <button type="button" data-pcat="installed" aria-pressed="${portsFilter === "installed"}">No S20 FE (${installedCount})</button>
            ${updatesCount > 0 ? `<button type="button" data-pcat="updates" aria-pressed="${portsFilter === "updates"}" style="color:var(--warn);font-weight:600">Updates (${updatesCount})</button>` : ""}
            <button type="button" data-pcat="ready" aria-pressed="${portsFilter === "ready"}">Prontos p/ Android (${readyCount})</button>
            <button type="button" data-pcat="pc" aria-pressed="${portsFilter === "pc"}">Só PC (${pcCount})</button>
            <button type="button" data-pcat="decomp" aria-pressed="${portsFilter === "decomp"}">Radar Decomp .dev (${decompCount})</button>
            <button type="button" data-pcat="ptbr" aria-pressed="${portsFilter === "ptbr"}">Traduzidos PT-BR (${ptbrCount})</button>
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-left:auto">
            <input type="search" id="portsSearchInput" aria-label="Buscar nos ports" value="${esc(portsQuery)}" placeholder="Buscar port, console ou engine..." style="padding:6px 10px;border-radius:6px;border:1px solid var(--border);background:var(--surface-2);color:var(--fg);min-width:140px;max-width:240px;flex:1 1 180px">
            <select id="portsSortSelect" aria-label="Ordenar por" style="padding:6px 10px;border-radius:6px;border:1px solid var(--border);background:var(--surface-2);color:var(--fg)">
              <option value="status" ${portsSort === "status" ? "selected" : ""}>Status (Prontos / Updates primeiro)</option>
              <option value="played" ${portsSort === "played" ? "selected" : ""}>Mais jogados no S20 FE</option>
              <option value="recent" ${portsSort === "recent" ? "selected" : ""}>Lançamentos / Updates recentes</option>
              <option value="title" ${portsSort === "title" ? "selected" : ""}>Ordem alfabética (A–Z)</option>
              <option value="system" ${portsSort === "system" ? "selected" : ""}>Plataforma / Console</option>
              <option value="category" ${portsSort === "category" ? "selected" : ""}>Categoria de Port</option>
            </select>
            <button type="button" class="btn small" id="portsRefreshBtn">Atualizar agora</button>
          </div>
        </div>
        <div class="muted small" style="margin-top:8px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px">
          <span>Exibindo <b>${filtered.length}</b> de ${all.length} projetos catalogados</span>
          <span><span class="badge ok">Sync Inteligente (KV)</span> · Último sync: ${esc(syncDate)}</span>
        </div>
        <div class="table-wrap xscroll" style="margin-top:12px" tabindex="0" role="region" aria-label="Tabela de Ports e Decompilações">
          <table class="table" id="portsTable">
            <thead>
              <tr>
                <th scope="col">Port / Jogo</th>
                <th scope="col">Engine / Base</th>
                <th scope="col">Status & Tempo Jogado</th>
                <th scope="col">Tradução PT-BR & Recursos</th>
                <th scope="col">ROM no Acervo</th>
                <th scope="col">Fonte / GitHub</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.length ? filtered.map((p) => `
                <tr>
                  <td>
                    <div style="display:flex;align-items:center;gap:10px">
                      ${p.iconUrl ? `<img src="${esc(p.iconUrl)}" alt="" width="34" height="34" loading="lazy" style="border-radius:6px;object-fit:cover;background:var(--surface-2);flex-shrink:0" onerror="this.onerror=null;this.style.display='none';this.nextElementSibling.style.display='inline-flex'"><span class="brand-mark" style="display:none;width:34px;height:34px;align-items:center;justify-content:center;border-radius:6px;flex-shrink:0">${icon("gamepad-2", "sm")}</span>` : `<span class="brand-mark" style="width:34px;height:34px;display:inline-flex;align-items:center;justify-content:center;border-radius:6px;flex-shrink:0">${icon("gamepad-2", "sm")}</span>`}
                      <div>
                        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                          <b>${esc(p.name)}</b>
                          ${portStateBadge(p)}
                        </div>
                        ${p.packageName ? `<div class="muted small"><code>${esc(p.packageName)}</code></div>` : ""}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span class="badge">${esc((p.system || "").toUpperCase())}</span>
                    <div class="muted small" style="margin-top:4px">${esc(p.engine || "")}</div>
                  </td>
                  <td>${statusBadge(p)}</td>
                  <td>
                    <div>${esc(p.ptbr || "—")}</div>
                    <div class="muted small" style="margin-top:4px">${(p.features || []).map((f) => esc(f)).join(" · ")}</div>
                  </td>
                  <td>${romBadges(p.rom)}</td>
                  <td>${sourceCell(p)}</td>
                </tr>
              `).join("") : `<tr><td colspan="6" style="text-align:center;padding:36px 16px" class="muted">Nenhum projeto encontrado nesta categoria.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `;

    el.querySelectorAll("#portsTabs button").forEach((btn) => {
      btn.onclick = () => {
        portsFilter = btn.dataset.pcat;
        renderPorts();
      };
    });
    el.querySelectorAll(".kpi[data-kpi-filter]").forEach((kpi) => {
      kpi.onclick = () => {
        portsFilter = kpi.dataset.kpiFilter;
        renderPorts();
      };
      kpi.onkeydown = (ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          portsFilter = kpi.dataset.kpiFilter;
          renderPorts();
        }
      };
    });
    const searchInput = el.querySelector("#portsSearchInput");
    if (searchInput) {
      searchInput.oninput = (ev) => {
        portsQuery = ev.target.value;
        const pos = searchInput.selectionStart;
        renderPorts().then(() => {
          const next = $("#portsSearchInput");
          if (next) {
            next.focus();
            try { next.setSelectionRange(pos, pos); } catch {}
          }
        });
      };
    }
    const sortSel = el.querySelector("#portsSortSelect");
    if (sortSel) {
      sortSel.onchange = (ev) => {
        portsSort = ev.target.value;
        renderPorts();
      };
    }
    const rBtn = el.querySelector("#portsRefreshBtn");
    if (rBtn) {
      rBtn.onclick = () => {
        rBtn.textContent = "Atualizando...";
        renderPorts(true);
      };
    }
  } catch (e) {
    el.innerHTML = `<p class="muted">Erro ao carregar radar de ports: ${esc(e.message)}</p>`;
  }
}

let epicCache = null, epicFilter = "all", epicQuery = "", epicSort = "compat";
async function renderEpic(forceReload = false) {
  const el = $("#epicBody");
  if (!el) return;
  try {
    if (!epicCache || forceReload) {
      epicCache = await fetchLiveOrStatic("/api/live/epic", "data/epic-library.json");
    }
    const c = epicCache.counts || {};
    const all = epicCache.games || [];

    const filtered = all.filter((g) => {
      if (epicFilter === "installed" && !g.installedS20) return false;
      if (epicFilter !== "all" && epicFilter !== "installed" && g.category !== epicFilter) return false;
      if (epicQuery) {
        const q = epicQuery.toLowerCase();
        const hay = `${g.title || ""} ${g.developer || ""} ${g.engine || ""} ${g.appName || ""} ${g.compatLabel || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    filtered.sort((a, b) => {
      if (epicSort === "size-asc") {
        const sa = a.diskBytes || Number.MAX_SAFE_INTEGER;
        const sb = b.diskBytes || Number.MAX_SAFE_INTEGER;
        return sa - sb || a.title.localeCompare(b.title);
      }
      if (epicSort === "size-desc") {
        return (b.diskBytes || 0) - (a.diskBytes || 0) || a.title.localeCompare(b.title);
      }
      if (epicSort === "title") {
        return a.title.localeCompare(b.title);
      }
      // default: compat
      if (a.tier !== b.tier) return a.tier - b.tier;
      if (b.score !== a.score) return b.score - a.score;
      return (a.diskBytes || Number.MAX_SAFE_INTEGER) - (b.diskBytes || Number.MAX_SAFE_INTEGER);
    });

    const compatBadge = (g) => {
      let cls = "badge muted";
      if (g.score >= 90) cls = "badge ok";
      else if (g.score >= 75) cls = "badge";
      else if (g.score >= 60) cls = "badge warn";
      return `
        <div><span class="${cls}">${esc(g.compatLabel || "")}</span></div>
        <div class="muted small" style="margin-top:4px">${esc(g.compatDetail || "")}</div>
      `;
    };

    const syncDate = epicCache.updatedAt
      ? new Date(epicCache.updatedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
      : "—";

    const installedNames = all.filter((g) => g.installedS20).map((g) => g.title).join(" · ") || "Nenhum detectado";

    el.innerHTML = `
      <div class="kpis" role="list" aria-label="Resumo da Biblioteca Epic Games">
        <div class="kpi" role="listitem"><span class="kpi-label">${icon("layers", "sm")}Total na Conta Epic</span><span class="kpi-value">${fmtN(c.total || 0)}</span><span class="kpi-sub">Conta @${esc(epicCache.account || "guconstantino")} · Sync ${esc(syncDate)}</span></div>
        <div class="kpi" role="listitem"><span class="kpi-label">${icon("gamepad-2", "sm")}Instalados no S20 FE</span><span class="kpi-value">${fmtN(c.installed || 0)}</span><span class="kpi-sub" title="${esc(installedNames)}">${esc(installedNames)}</span></div>
        <div class="kpi" role="listitem"><span class="kpi-label">${icon("star", "sm")}Ótimos no S20 FE (90–100%)</span><span class="kpi-value">${fmtN((c.nativeOrPort || 0) + (c.greatLight || 0))}</span><span class="kpi-sub">${fmtN(c.nativeOrPort || 0)} Nativos/Ports + ${fmtN(c.greatLight || 0)} Leves 60 FPS</span></div>
        <div class="kpi" role="listitem"><span class="kpi-label">${icon("shield-check", "sm")}DRM-Free / Offline</span><span class="kpi-value">${fmtN(c.drmFree || 0)}</span><span class="kpi-sub">Rodam direto via GameHub Proton ARM64X</span></div>
      </div>

      <div class="tile">
        <div class="tile-head" style="flex-wrap:wrap;gap:12px">
          <div class="seg tabs" role="group" aria-label="Filtrar biblioteca Epic Games" id="epicTabs">
            <button type="button" data-ecat="all" aria-pressed="${epicFilter === "all"}">Todos (${all.length})</button>
            <button type="button" data-ecat="installed" aria-pressed="${epicFilter === "installed"}">No S20 FE (${c.installed || 0})</button>
            <button type="button" data-ecat="native-or-port" aria-pressed="${epicFilter === "native-or-port"}">Nativo / Port Android (${c.nativeOrPort || 0})</button>
            <button type="button" data-ecat="great-light" aria-pressed="${epicFilter === "great-light"}">Leves 60 FPS &lt;1.8 GB (${c.greatLight || 0})</button>
            <button type="button" data-ecat="playable-mid" aria-pressed="${epicFilter === "playable-mid"}">Médios 1.8–14 GB (${c.playableMid || 0})</button>
            <button type="button" data-ecat="heavy-or-incompat" aria-pressed="${epicFilter === "heavy-or-incompat"}">Pesados / Incompatíveis (${c.heavyOrIncompat || 0})</button>
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-left:auto">
            <input type="search" id="epicSearchInput" aria-label="Buscar na biblioteca da Epic" value="${esc(epicQuery)}" placeholder="Buscar jogo, engine ou estúdio..." style="padding:6px 10px;border-radius:6px;border:1px solid var(--border);background:var(--surface-2);color:var(--fg);min-width:140px;max-width:240px;flex:1 1 180px">
            <select id="epicSortSelect" aria-label="Ordenar por" style="padding:6px 10px;border-radius:6px;border:1px solid var(--border);background:var(--surface-2);color:var(--fg)">
              <option value="compat" ${epicSort === "compat" ? "selected" : ""}>Maior compatibilidade S20 FE</option>
              <option value="size-asc" ${epicSort === "size-asc" ? "selected" : ""}>Menor tamanho em disco</option>
              <option value="size-desc" ${epicSort === "size-desc" ? "selected" : ""}>Maior tamanho em disco</option>
              <option value="title" ${epicSort === "title" ? "selected" : ""}>Ordem alfabética (A–Z)</option>
            </select>
            <button type="button" class="btn small" id="epicRefreshBtn">Atualizar agora</button>
          </div>
        </div>
        <div class="muted small" style="margin-top:8px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px">
          <span>Exibindo <b>${filtered.length}</b> de ${all.length} títulos da conta Epic Games</span>
          <span><span class="badge ok">Sync Inteligente (KV)</span> · Último sync: ${esc(syncDate)}</span>
        </div>
        <div class="table-wrap xscroll" style="margin-top:12px" tabindex="0" role="region" aria-label="Tabela da Biblioteca Epic Games">
          <table class="table" id="epicTable">
            <thead>
              <tr>
                <th scope="col">Nome do Jogo</th>
                <th scope="col">Tamanho (Instalado / DL)</th>
                <th scope="col">Engine & DRM</th>
                <th scope="col">Compatibilidade S20 FE</th>
                <th scope="col">Status / App ID</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.length ? filtered.map((g) => `
                <tr>
                  <td>
                    <div style="display:flex;align-items:center;gap:10px">
                      ${g.cover ? `<img src="${esc(g.cover)}" alt="" width="34" height="45" loading="lazy" style="border-radius:5px;object-fit:cover;background:var(--surface-2);flex-shrink:0" onerror="this.onerror=null;this.style.display='none';this.nextElementSibling.style.display='inline-flex'"><span class="brand-mark" style="display:none;width:34px;height:45px;align-items:center;justify-content:center;border-radius:5px;flex-shrink:0">${icon("layers", "sm")}</span>` : `<span class="brand-mark" style="width:34px;height:45px;display:inline-flex;align-items:center;justify-content:center;border-radius:5px;flex-shrink:0">${icon("layers", "sm")}</span>`}
                      <div>
                        <b>${esc(g.title)}</b>
                        <div class="muted small">${esc(g.developer || "—")}${g.exe ? ` · <code>${esc(g.exe)}</code>` : ""}</div>
                      </div>
                    </div>
                  </td>
                  <td style="white-space:nowrap">
                    <b>${esc(g.diskHuman || "—")}</b>
                    ${g.dlHuman && g.dlHuman !== "—" ? `<div class="muted small">DL: ${esc(g.dlHuman)}</div>` : ""}
                  </td>
                  <td>
                    <span class="badge">${esc(g.engine || "Windows")}</span>
                    <div class="muted small" style="margin-top:4px">${g.offline ? "DRM-Free / Offline" : "Requer Token Online"} · ${esc((g.platforms || []).join(", "))}</div>
                  </td>
                  <td>${compatBadge(g)}</td>
                  <td>
                    ${g.installedS20
                      ? `<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                          ${isS20App() ? `<a href="${esc(launchHref("com.xiaoji.egggame", g.title))}" class="btn small play-btn" style="white-space:nowrap">▶ Jogar</a>` : ""}
                          <span class="badge ok">Instalado no S20 FE</span>
                        </div>
                        <div class="muted small" style="margin-top:4px"><code>${esc(g.appName)}</code></div>`
                      : `<code class="small" title="legendary install ${esc(g.appName)}">${esc(g.appName)}</code>`}
                  </td>
                </tr>
              `).join("") : `<tr><td colspan="5" style="text-align:center;padding:36px 16px" class="muted">Nenhum título encontrado com os filtros atuais.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `;

    el.querySelectorAll("#epicTabs button").forEach((btn) => {
      btn.onclick = () => {
        epicFilter = btn.dataset.ecat;
        renderEpic();
      };
    });
    const searchInput = el.querySelector("#epicSearchInput");
    if (searchInput) {
      searchInput.oninput = (ev) => {
        epicQuery = ev.target.value;
        const pos = searchInput.selectionStart;
        renderEpic().then(() => {
          const next = $("#epicSearchInput");
          if (next) {
            next.focus();
            try { next.setSelectionRange(pos, pos); } catch {}
          }
        });
      };
    }
    const sortSel = el.querySelector("#epicSortSelect");
    if (sortSel) {
      sortSel.onchange = (ev) => {
        epicSort = ev.target.value;
        renderEpic();
      };
    }
    const rBtn = el.querySelector("#epicRefreshBtn");
    if (rBtn) {
      rBtn.onclick = () => {
        rBtn.textContent = "Atualizando...";
        renderEpic(true);
      };
    }
  } catch (e) {
    el.innerHTML = `<p class="muted">Erro ao carregar biblioteca Epic Games: ${esc(e.message)}</p>`;
  }
}

function isS20App() {
  try {
    if (window.HH_IS_S20_APP || new URLSearchParams(location.search).has("app")) {
      sessionStorage.setItem("hh_s20_app", "1");
      return true;
    }
    return sessionStorage.getItem("hh_s20_app") === "1";
  } catch {
    return Boolean(window.HH_IS_S20_APP);
  }
}
function launchHref(pkg, title) {
  return `handheld://launch?pkg=${encodeURIComponent(pkg || "")}&title=${encodeURIComponent(title || "")}`;
}
function s20EmulatorFor(system) {
  const map = {
    ports: "",
    psp: "org.ppsspp.ppsspp",
    nds: "me.magnum.melonds",
    "3ds": "org.azahar_emu.azahar",
    ps2: "xyz.aethersx2.android",
    gamecube: "org.dolphinemu.dolphinemu",
    wii: "org.dolphinemu.dolphinemu",
    psx: "com.github.stenzek.duckstation",
    dreamcast: "io.recompiled.redream",
  };
  return system in map ? map[system] : "com.retroarch";
}

let s20Telemetry = null;
function fmtDuration(sec) {
  if (!sec || sec < 60) return `${Math.max(1, Math.round(sec || 0))}s`;
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), rm = m % 60;
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
}
function fmtRelative(ms) {
  if (!ms) return "—";
  const diffMin = Math.round((Date.now() - ms) / 60000);
  if (diffMin < 1) return "agora mesmo";
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `há ${diffH}h`;
  const d = new Date(ms);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

async function loadS20Telemetry() {
  const el = $("#s20LiveBlock");
  try {
    const r = await fetch("/api/live/telemetry", { cache: "no-store" });
    if (!r.ok) return;
    const data = await r.json();
    if (!data || data.empty) return;
    s20Telemetry = data;
    drawContinue();
    if (curView === "ports") renderPorts(false);

    const dev = data.device || {};
    const livePill = document.querySelector('[data-dev-live="s20fe"]');
    if (livePill && dev.batteryPct != null) {
      const bat = `${dev.charging ? "⚡" : "🔋"} ${dev.batteryPct}%`;
      const tmp = dev.tempC != null ? ` · ${dev.tempC.toFixed(1)}°C` : "";
      livePill.className = "cover-pill live";
      livePill.textContent = `${bat}${tmp}`;
    }

    if (!el) return;
    const np = data.nowPlaying;
    const most = (data.mostPlayed || []).slice(0, 8);
    const recent = (data.recentOpened || []).slice(0, 8);
    const retro = (data.retroarchRecent || []).slice(0, 8);
    const maxSec = Math.max(1, ...most.map((x) => x.totalSeconds || 0));
    const syncTime = data.receivedAt
      ? new Date(data.receivedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
      : "—";
    const inApp = isS20App();

    const kindBadge = (k) => {
      const map = { decomp: "Decomp", port: "Port", pc: "PC/Epic", emu: "Emu" };
      const key = k || "app";
      return `<span class="ktag" data-k="${esc(key)}">${esc(map[k] || k || "App")}</span>`;
    };

    const devPills = [];
    if (dev.batteryPct != null) devPills.push(`<span class="badge mono ${dev.batteryPct <= 20 ? "warn" : "ok"}">${dev.charging ? "⚡" : "🔋"} ${dev.batteryPct}%</span>`);
    if (dev.tempC != null) devPills.push(`<span class="badge mono ${dev.tempC >= 40 ? "warn" : ""}">${dev.tempC.toFixed(1)} °C</span>`);
    if (dev.internalFreeGb != null) devPills.push(`<span class="badge mono">Interno: ${dev.internalFreeGb} GB livres</span>`);
    if (dev.sdFreeGb != null) devPills.push(`<span class="badge mono">SD: ${dev.sdFreeGb} GB livres</span>`);

    el.classList.add("live-tile");
    el.hidden = false;
    applyLayout();
    el.innerHTML = `
      <div class="live-head">
        <div class="live-title">
          <span class="live-dot" aria-hidden="true"></span>
          <h2 id="t-s20live">Telemetria ao Vivo · Galaxy S20 FE</h2>
          ${np && np.title
            ? `<span class="badge ok">Jogando agora: ${esc(np.title)}</span>`
            : `<span class="badge mono">Sync · ${esc(syncTime)}</span>`}
        </div>
        <div class="live-pills">
          ${devPills.join("")}
        </div>
      </div>
      <div class="live-grid">
        <div class="live-col">
          <h3>${icon("trophy", "sm")} Mais jogados no S20 FE</h3>
          <ul class="live-list">
            ${most.map((it, idx) => {
              const pct = Math.max(6, Math.round(((it.totalSeconds || 0) / maxSec) * 100));
              const href = inApp && (it.pkg || it.title) ? launchHref(it.pkg, it.title) : "";
              return `
              <li class="live-item"${href ? ` data-launch="${esc(href)}"` : ""}>
                <i class="live-fill" style="width:${pct}%"></i>
                <div class="live-main">
                  <span class="live-rank">${idx + 1}</span>
                  <span class="live-name" title="${esc(it.title)}">${esc(it.title)}</span>
                </div>
                <div class="live-meta">
                  ${kindBadge(it.kind)}
                  <span class="badge mono ok">${fmtDuration(it.totalSeconds)}</span>
                  ${href ? `<a class="play-btn badge ok" href="${esc(href)}" title="Jogar ${esc(it.title)}">▶</a>` : ""}
                </div>
              </li>`;
            }).join("") || `<li class="muted small">Sem dados ainda</li>`}
          </ul>
        </div>
        <div class="live-col">
          <h3>${icon("clock", "sm")} Abertos recentemente</h3>
          <ul class="live-list">
            ${recent.map((it) => {
              const href = inApp && (it.pkg || it.title) ? launchHref(it.pkg, it.title) : "";
              return `
              <li class="live-item"${href ? ` data-launch="${esc(href)}"` : ""}>
                <div class="live-main">
                  <span class="live-name" title="${esc(it.title)}">${esc(it.title)}</span>
                </div>
                <div class="live-meta">
                  ${kindBadge(it.kind)}
                  <span class="badge mono">${fmtRelative(it.lastPlayedAt)}</span>
                  ${href ? `<a class="play-btn badge ok" href="${esc(href)}" title="Jogar ${esc(it.title)}">▶</a>` : ""}
                </div>
              </li>`;
            }).join("") || `<li class="muted small">Sem dados ainda</li>`}
          </ul>
        </div>
        <div class="live-col">
          <h3>${icon("gamepad-2", "sm")} Últimos no RetroArch</h3>
          <ul class="live-list">
            ${retro.map((it) => {
              const href = inApp ? launchHref("com.retroarch", it.title) : "";
              return `
              <li class="live-item"${href ? ` data-launch="${esc(href)}"` : ""}>
                <div class="live-main" title="${esc(it.core || "")}">
                  <span class="live-name">${esc(it.title)}</span>
                </div>
                <div class="live-meta">
                  <span class="badge mono">${esc((it.system || "retro").toUpperCase())}</span>
                  ${href ? `<a class="play-btn badge ok" href="${esc(href)}" title="Abrir no RetroArch">▶</a>` : ""}
                </div>
              </li>`;
            }).join("") || `<li class="muted small">Sem histórico no RetroArch</li>`}
          </ul>
        </div>
      </div>
    `;
  } catch {}
}
window.HH_REFRESH_LIVE = () => loadS20Telemetry();
document.addEventListener("click", (e) => {
  if (e.target.closest("a.play-btn")) return;
  const item = e.target.closest(".live-item[data-launch]");
  if (!item) return;
  const btn = item.querySelector("a.play-btn");
  if (btn) btn.click();
});

async function pollLiveStatus() {
  if (document.visibilityState === "hidden") return;
  try {
    const r = await fetch("/api/live/status", { cache: "no-store" });
    if (!r.ok) return;
    const st = await r.json();
    if (st.telemetryAt && st.telemetryAt !== liveHashes.telemetryAt) {
      const hadPrev = !!liveHashes.telemetryAt;
      liveHashes.telemetryAt = st.telemetryAt;
      if (hadPrev) loadS20Telemetry();
    }
    if (st.epicHash && st.epicHash !== liveHashes.epicHash) {
      const hadPrev = !!liveHashes.epicHash;
      liveHashes.epicHash = st.epicHash;
      if (hadPrev) {
        epicCache = null;
        if (curView === "epic") renderEpic(true);
      }
    }
    if (st.portsHash && st.portsHash !== liveHashes.portsHash) {
      const hadPrev = !!liveHashes.portsHash;
      liveHashes.portsHash = st.portsHash;
      if (hadPrev) {
        portsCache = null;
        loadPortsFeed(true);
        if (curView === "ports") renderPorts(true);
      }
    }
  } catch {}
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") pollLiveStatus();
});

(async () => {
  try {
    const [, changed] = await Promise.all([loadLists(), loadPrefs(), loadMe()]);
    applyRemotePrefs(changed);
    await loadThemes();
    await loadSummary();
    await loadSystems();
    loadTopPlatforms();
    loadMosaic();
    loadMine();
    loadRelation();
    loadS20Telemetry();
    loadPortsFeed();
    RA.ready = loadRA();
    RA.ready.then(drawContinue);
    loadHealthTiles();
    route();
    $("#boot").remove();
  } catch (e) {
    $("#footer").textContent = `Erro ao carregar: ${e.message}`;
    $("#boot").classList.add("failed");
    $("#boot").setAttribute("aria-label", `Erro ao carregar o acervo: ${e.message}`);
  }
})();
