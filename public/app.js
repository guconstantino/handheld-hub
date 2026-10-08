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
// Foto de capa de cada console (créditos no rodapé). Sem foto: o logo grande.
const COVER = { s20fe: "img/s20fe.webp", miyoo: "img/miyoo.webp", switch: "img/switch.webp" };
const cover = (d) => `<div class="cover">${COVER[d.id]
  ? `<img src="${COVER[d.id]}" alt="" loading="lazy" decoding="async">`
  : logo(d, "logo-big")}</div>`;
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
const focusHeading = () => { const h = document.querySelector(".view:not(.hidden) h1"); if (h) h.focus(); };
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
  const [view, arg] = (location.hash.slice(1) || "overview").split(/[/-](.*)/);
  const target = ["overview", "device", "platforms", "platform", "game", "games", "lists", "compare", "health"].includes(view) ? view : "overview";
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
  if (target === "overview" && state.loaded.mine) loadMine();
  if (target === "overview") state.loaded.mine = true;
  if (target === "health" && !state.loaded.health) { state.loaded.health = true; loadHealth(); }
  if (target === "compare" && !state.loaded.compare) { state.loaded.compare = true; initCompare(); }
  if (target === "lists") drawLists();
  const h1 = document.querySelector(`#view-${target} h1`);
  document.title = h1 && target !== "overview" ? `${h1.textContent} · Handheld Hub` : "Handheld Hub";
  window.scrollTo(0, 0);
  window.HH_CHARTS?.redraw();                       // gráficos desenhados com a tela escondida ganham a largura certa
  // Troca de tela sem recarregar: leva o foco ao título para o leitor de tela anunciar a tela nova.
  if (moveFocus) (pending || Promise.resolve()).then(focusHeading);
  return pending;
}
// Com fx.js, a troca de tela usa View Transitions (a arte da plataforma "cresce" até o topo).
window.addEventListener("hashchange", () => {
  if (!window.HH_TRANSITION) return route(true);
  window.HH_TRANSITION(() => route(true)).finally(() =>
    document.querySelectorAll(".ptile img").forEach((i) => (i.style.viewTransitionName = "")));
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
  const right = s.total ? `${fmtB(s.free)} livres de ${fmtB(s.total)} · ${used}% usado` : s.files != null ? `${fmtN(s.files)} itens` : "";
  return `<div class="meter">
    <div class="meter-row"><span>${icon(s.cloud ? "cloud" : "hard-drive", "sm")}${esc(s.label)}</span><span>${right}</span></div>
    ${used !== null ? `<div class="bar"><i style="width:${used}%"></i></div>` : ""}
  </div>`;
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
    const nums = [
      ["Jogos", fmtN(st.games)], ["Sistemas", fmtN(st.systems)],
      ["Com capa", st.games ? fmtP((st.covered / st.games) * 100) : "—"],
      d.id === "drive" ? ["Só no Drive", fmtN(st.driveOnly)] : ["Sem backup", fmtN(st.noBackup)],
    ];
    return `<article class="device b-dev" ${dev(d.id)}>
      ${cover(d)}
      <div class="device-body">
        <h3 class="device-name"><span class="dot"></span><a class="device-link" href="#device-${esc(d.id)}">${esc(d.name)}</a><span style="margin-left:auto;display:flex">${logo(d)}</span></h3>
        <div class="chips">${bad ? `<span class="badge bad">${icon("triangle-alert", "sm")}${fmtN(bad)} corrompidos</span>` : `<span class="badge ok">${icon("shield-check", "sm")}Sem problemas</span>`}</div>
        <dl class="nums">${nums.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>
        <div>${storageOf(d).map(storageHtml).join("")}</div>
        <p class="small muted">Varrido ${fmtDate(s.locations.filter((l) => l.device_id === d.id).map((l) => l.last_scan).filter(Boolean).sort().pop())}</p>
        <span class="more" aria-hidden="true">Ver detalhes ${icon("chevron-right", "sm")}</span>
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
const BLOCKS = [["meus", "Seus jogos"], ["ra", "RetroAchievements"], ["hero", "Jogos no acervo"], ["stats", "Indicadores"], ["consoles", "Consoles"], ["plataformas", "Jogos por plataforma"],
  ["mosaico", "Do acervo (capas)"], ["onde", "Onde estão os arquivos"], ["capas", "Capas por sistema"], ["saude", "Saúde do acervo"]];
const loadLayout = () => {
  let l; try { l = JSON.parse(localStorage.getItem("hh_layout")); } catch {}
  const ids = BLOCKS.map(([id]) => id);
  const order = (l?.order || []).filter((id) => ids.includes(id));
  // Bloco novo (que não existia quando a ordem foi salva) entra na posição padrão, não no fim.
  ids.forEach((id, i) => { if (!order.includes(id)) order.splice(Math.min(i, order.length), 0, id); });
  return { order, hidden: l?.hidden || [] };
};
let layout = loadLayout();
function applyLayout() {
  layout.order.forEach((id, i) => {
    const el = document.querySelector(`#view-overview [data-block="${id}"]`);
    if (!el) return;
    // Wrappers "display: contents" não aceitam order: aplica nos filhos (e no título dos consoles).
    const parts = el.classList.contains("contents") ? [...el.children] : [el];
    if (id === "consoles") parts.unshift(document.querySelector('#view-overview [data-part="consoles"]'));
    for (const p of parts) { p.style.order = i * 10; p.classList.toggle("hidden", layout.hidden.includes(id)); }
  });
}
function drawLayoutList() {
  const names = Object.fromEntries(BLOCKS);
  $("#layoutList").innerHTML = layout.order.map((id, i) => `<li>
    <label><input type="checkbox" data-show="${id}" ${layout.hidden.includes(id) ? "" : "checked"}> ${esc(names[id])}</label>
    <span><button type="button" class="icon-btn" data-up="${id}" ${i ? "" : "disabled"} aria-label="Subir ${esc(names[id])}">↑</button>
    <button type="button" class="icon-btn" data-down="${id}" ${i < layout.order.length - 1 ? "" : "disabled"} aria-label="Descer ${esc(names[id])}">↓</button></span></li>`).join("");
}
const saveLayout = () => { try { localStorage.setItem("hh_layout", JSON.stringify(layout)); } catch {} applyLayout(); drawLayoutList(); };
$("#customize").onclick = () => { drawLayoutList(); $("#layoutDlg").showModal(); };
$("#layoutReset").onclick = () => { layout = { order: BLOCKS.map(([id]) => id), hidden: [] }; saveLayout(); };
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
  location.hash = "#games";
  setTimeout(() => {
    for (const [id, v] of Object.entries({ "#fDevice": filters.device, "#fSystem": filters.system, "#fStatus": filters.status }))
      if (v !== undefined) $(id).value = v;
    loadGames();
  }, 0);
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
    $(el).innerHTML = games.length ? games.map((x) => `<li><a href="${gameHref(x)}">${x.cover ? `<img src="covers/${esc(x.cover)}" alt="" loading="lazy">` : `<img class="gplat" src="platforms/${esc(x.system)}.webp" alt="">`}<span>${esc(x.title)}</span></a></li>`).join("")
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
  return `<span class="${bad ? "bad" : ""}" ${dev(c.device_id)} title="${fmtB(c.size)}"><i class="dot"></i>${esc(copyLabel(d, c.location_id))}${bad ? " · corrompido" : ""}</span>`;
};

const gameHref = (g) => `#game-${encodeURIComponent(g.game_key)}`;
// Estado vazio com explicação e saída (em vez de só "Nada encontrado").
const emptyState = (title, hint, withClear = true) => `<div class="empty">${icon("search")}<b>${esc(title)}</b><span>${esc(hint)}</span>
  ${withClear ? `<button type="button" class="btn" data-clear-all>Limpar filtros</button>` : ""}</div>`;

// Cartões da grade de jogos (tela Jogos e página de plataforma): a capa ocupa o cartão inteiro,
// nome e sistema ficam sobre ela. Sem capa: a arte da plataforma (lado do logo) no fundo.
const gridHtml = (games) => games.length ? games.map((g) => {
  const bad = g.copies.some((c) => c.status === "corrupted");
  const art = g.cover
    ? `<img class="gblur" src="covers/${esc(g.cover)}" alt="" loading="lazy" decoding="async"><img class="gimg" src="covers/${esc(g.cover)}" alt="" loading="lazy" decoding="async">`
    : `<img class="gplat" src="platforms/${esc(g.system)}.webp" alt="" loading="lazy" decoding="async">`;
  return `<li class="gcard ${g.cover ? "" : "nocover"}">
      <div class="gart">${art}</div>
      <a class="gfull" href="${gameHref(g)}" tabindex="-1" aria-hidden="true"></a>
      ${bad ? `<span class="gbad">${icon("triangle-alert", "sm")}Corrompido</span>` : ""}
      ${LISTS.fav.has(g.game_key) ? `<span class="gfav" title="Favorito">${icon("star", "sm")}<span class="sr-only">Favorito</span></span>` : ""}
      <div class="gover">
        <a class="gtitle glink" href="${gameHref(g)}">${esc(g.title)}</a>
        <span class="gmeta"><span>${esc(sysName(g.system))}</span><span class="gdots">${g.copies.map((c) => `<i class="dot" ${dev(c.device_id)}></i>`).join("")}</span></span>
        <span class="sr-only">Onde está: ${g.copies.map((c) => esc(copyLabel(deviceOf(c.device_id), c.location_id))).join(", ")}</span>
      </div>
      <div class="gdrive">${driveBtn(g)}</div>
    </li>`;
}).join("") : `<li class="empty-li">${emptyState("Nenhum jogo encontrado", "Tente outro nome, outra plataforma ou tire algum filtro.")}</li>`;

// Exibição em grade ou lista (fica salva neste navegador).
let viewMode = "grid";
try { viewMode = localStorage.getItem("hh_view") || "grid"; } catch {}
function renderGames() {
  const games = state.games || [];
  const grid = viewMode === "grid";
  document.querySelectorAll(".seg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === viewMode)));
  $("#gamesGrid").classList.toggle("hidden", !grid);
  $("#gamesList").classList.toggle("hidden", grid);
  if (grid) {
    $("#gamesGrid").innerHTML = gridHtml(games);
  } else {
    $("#gamesTable tbody").innerHTML = games.length ? games.map((g) => `<tr>
      <td><div class="game-cell"><span class="thumb">${coverImg(g) || icon("gamepad-2")}</span><a class="tlink" href="${gameHref(g)}">${esc(g.title)}</a></div></td>
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
  ["#q", "#fDevice", "#fSystem", "#fStatus"].forEach((id) => ($(id).value = ""));
  loadGames();
});

document.querySelectorAll(".seg button").forEach((b) => (b.onclick = () => {
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
  const dev = $("#fDevice").value, sys = $("#fSystem").value, st = $("#fStatus").value, q = $("#q").value.trim();
  const devChips = [["", "Todos os lugares"], ...state.devices.map((d) => [d.id, shortName(d)])].map(([id, label]) =>
    `<button type="button" class="chip ${id ? "" : "all"}" data-dev="${esc(id)}" data-set-device="${esc(id)}" aria-pressed="${dev === id}">${id ? `<i class="dot"></i>` : ""}${esc(label)}</button>`).join("");
  const STATUS = { ok: "OK", corrupted: "Corrompido", unknown: "Não verificado", nobackup: "Sem backup no Drive", driveonly: "Só no Drive", playing: "Jogando agora", fav: "Favoritos", want: "Quero jogar", done: "Zerei" };
  const active = [
    sys && ["system", sysName(sys)], st && ["status", STATUS[st]], q && ["q", `“${q}”`],
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
  if (c === "q" || c === "all") $("#q").value = "";
  if (c === "all") $("#fDevice").value = "";
  loadGames();
});

let gamesReq = 0;
async function loadGames(append = false) {
  const req = ++gamesReq;                 // descarta respostas antigas (busca digitada durante a carga)
  if (!append) state.offset = 0;
  const p = new URLSearchParams({ limit: 100, offset: state.offset });
  if ($("#fSort").value) p.set("sort", $("#fSort").value);
  for (const [k, el] of [["q", "#q"], ["device", "#fDevice"], ["system", "#fSystem"], ["status", "#fStatus"]])
    if ($(el).value.trim()) p.set(k, $(el).value.trim());
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
["#fDevice", "#fSystem", "#fStatus"].forEach((s) => ($(s).onchange = () => loadGames()));
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
      <img src="platforms/${esc(p.system)}.webp" alt="" loading="lazy" decoding="async">
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
      <img src="platforms/${esc(p.system)}.webp" alt="">
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
        ${info.text.length > 1 ? `<button type="button" class="linkbtn" id="pmore" aria-expanded="false">Ler mais</button>` : ""}
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
function toggleList(list, key) {
  const on = !LISTS[list].has(key);
  if (on) LISTS[list].add(key); else LISTS[list].delete(key);
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
  "Arcade": "arcade",
};
// Mesma normalização do game_key do scanner: sem (região)/[tags], artigo no começo, só letras e números.
const normTitle = (t) => t.replace(/[([][^)\]]*[)\]]/g, " ").trim().replace(/^(.*), (the|a|an)\b/i, "$2 $1").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const RA = { data: null, keyOf: new Map() };
async function loadRA() {
  try {
    const r = await fetch("api/ra/summary", { credentials: "same-origin" });
    if (!r.ok || !(r.headers.get("content-type") || "").includes("json")) return;
    RA.data = await r.json();
  } catch { return; }
  // Liga cada jogo do RA a um jogo do catálogo (plataforma + título normalizado).
  const idx = new Set((await api("/api/index")).map((g) => g.k));
  for (const g of [...RA.data.recent, ...RA.data.progress]) {
    const sys = RA_CONSOLE[g.console];
    const k = sys && `${sys}|${normTitle(g.title.replace(/^~[^~]+~\s*/, ""))}`;
    if (k && idx.has(k)) { g.key = k; RA.keyOf.set(k, g.id); }
  }
  drawRA();
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
  const r = await fetch(`api/ra/game?id=${id}`, { credentials: "same-origin" }).catch(() => null);
  if (!r?.ok) { sec.innerHTML = `<h2>Conquistas</h2><p class="muted small">Não consegui falar com o RetroAchievements agora.</p>`; return; }
  const x = await r.json();
  const pct = x.total ? (x.earned / x.total) * 100 : 0;
  sec.innerHTML = `<div class="tile-head"><h2>Conquistas · ${fmtN(x.earned)} de ${fmtN(x.total)}</h2>
      <a class="tlink small" href="https://retroachievements.org/game/${x.id}" target="_blank" rel="noopener">Ver no RetroAchievements</a></div>
    <div class="ra-progress"><span class="bar"><i style="width:${pct}%"></i></span><span class="muted small">${fmtN(x.userPoints)} de ${fmtN(x.points)} pontos · ${fmtN(x.players)} jogadores</span></div>
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
  const info = (await getData("info", g.system))[short] || {};
  const bad = g.copies.some((c) => c.status === "corrupted");
  const year = info.ano ? `${info.mes ? MONTHS[info.mes - 1] + " de " : ""}${info.ano}` : null;
  const facts = [["Lançamento", year], ["Desenvolvedora", info.dev], ["Publicadora", info.pub], ["Gênero", info.genero],
    ["Jogadores", info.jogadores], ["Franquia", info.franquia]].filter(([, x]) => x);
  const q = encodeURIComponent(`${g.title.replace(/\s*[([].*$/, "")} ${sysName(g.system)} dicas`);
  v.innerHTML = `
    <div class="ghero">
      ${g.cover ? `<img class="ghero-bg" src="covers/${esc(g.cover)}" alt="">` : `<img class="ghero-bg" src="platforms/${esc(g.system)}.webp" alt="">`}
      <div class="ghero-in">
        <div class="gnav"><a class="back" href="#platform-${esc(g.system)}">${icon("chevron-left", "sm")}${esc(sysName(g.system))}</a>
          <span class="gstep" id="gstep"></span></div>
        <div class="ghero-grid">
          <div class="ghero-cover">${g.cover ? `<img src="covers/${esc(g.cover)}" alt="Capa de ${esc(g.title)}">` : `<img class="gplat" src="platforms/${esc(g.system)}.webp" alt="">`}</div>
          <div class="ghero-text">
            <a class="pchip" href="#platform-${esc(g.system)}">${esc(sysName(g.system))}</a>
            <h1 tabindex="-1">${esc(g.title)}</h1>
            <p class="gsub">${[year, info.dev, info.genero].filter(Boolean).map(esc).join(" · ") || "Sem ficha no banco do libretro"}</p>
            ${bad ? `<span class="badge bad">${icon("triangle-alert", "sm")}Tem cópia corrompida</span>` : ""}
            <div class="gactions">
              ${Object.entries(LIST_LABEL).map(([l, [label, ic]]) => `<button type="button" class="listbtn" data-list="${l}" aria-pressed="${LISTS[l].has(g.game_key)}">${icon(ic, "sm")}${label}</button>`).join("")}
            </div>
            <div class="gactions">
              ${driveBtn(g, "Abrir no Drive")}
              <a class="drive-btn" href="https://www.google.com/search?q=${q}" target="_blank" rel="noopener">${icon("search", "sm")}Buscar dicas</a>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="ggrid">
      ${facts.length ? `<section class="tile"><h2>Ficha</h2><dl class="kv">${facts.map(([k, x]) => `<dt>${k}</dt><dd>${esc(x)}</dd>`).join("")}</dl></section>` : ""}
      <section class="tile"><h2>Onde está · ${fmtN(g.copies.length)} ${g.copies.length === 1 ? "cópia" : "cópias"}</h2>
        ${bad ? (() => {
          const good = g.copies.find((c) => c.status === "ok");
          const where = good ? copyLabel(deviceOf(good.device_id), good.location_id) : null;
          return `<p class="gwarn">${icon("triangle-alert", "sm")}<span>Há cópia corrompida${where ? `. Cópia boa em <b>${esc(where)}</b>: copie de lá.` : g.copies.some((c) => c.device_id === "drive") ? ". A cópia do Drive não foi verificada." : ". Baixe de novo da fonte."}</span></p>`;
        })() : ""}
        <table class="table copies-table"><caption class="sr-only">Cópias deste jogo</caption>
          <thead><tr><th scope="col">Lugar</th><th scope="col">Formato</th><th scope="col">Tamanho</th><th scope="col">Estado</th><th scope="col"><span class="sr-only">Abrir</span></th></tr></thead>
          <tbody>${g.copies.map((c) => `<tr ${dev(c.device_id)}>
            <td><span class="cell-dev"><i class="dot"></i>${esc(copyLabel(deviceOf(c.device_id), c.location_id))}</span></td>
            <td>${esc(c.ext === "pasta" ? "pasta" : (c.ext || "—").toUpperCase())}</td>
            <td class="num-cell">${c.size ? fmtB(c.size) : "—"}</td>
            <td>${c.status === "corrupted" ? `<span class="badge bad">corrompido</span>` : c.status === "ok" ? `<span class="badge ok">${icon("shield-check", "sm")}ok</span>` : `<span class="muted small">não verificado</span>`}</td>
            <td>${c.device_id === "drive" && c.drive_id ? `<a class="small tlink" href="${esc(c.ext === "pasta" ? `https://drive.google.com/drive/folders/${c.drive_id}` : `https://drive.google.com/file/d/${c.drive_id}/view`)}" target="_blank" rel="noopener">Abrir no Drive</a>` : ""}</td>
          </tr>`).join("")}</tbody></table>
      </section>
    </div>
    <section class="tile" id="graSec"><h2>Conquistas</h2><p class="muted small">Carregando…</p></section>
    <section class="tile" id="gcodes" aria-labelledby="t-codes"><h2 id="t-codes">Códigos</h2><p class="muted small">Carregando…</p></section>
    <section aria-labelledby="t-more"><div class="tile-head"><h2 id="t-more">Mais de ${esc(sysName(g.system))}</h2>
      <a class="small tlink" href="#platform-${esc(g.system)}">Ver todos</a></div><ul class="morerow" id="gmore"></ul></section>
    <p class="chart-note">Descrição, história e curiosidades chegam na próxima fase (ROADMAP).</p>`;
  v.querySelectorAll(".listbtn").forEach((b) => (b.onclick = () => b.setAttribute("aria-pressed", String(toggleList(b.dataset.list, g.game_key)))));
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
  drawGameRA(g);
  const cheats = (await getData("cheats", g.system))[short] || [];
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
        <p class="muted small" style="margin-bottom:10px">Estão em algum console, mas não no Drive. Vale copiar para o Drive.</p>${sysList(h.noBackup, "nobackup", "Sem backup no Drive")}</section>
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
(async () => {
  try {
    await loadLists();
    await loadSummary();
    await loadSystems();
    loadTopPlatforms();
    loadMosaic();
    loadMine();
    RA.ready = loadRA();
    loadHealthTiles();
    route();
  } catch (e) {
    $("#footer").textContent = `Erro ao carregar: ${e.message}`;
  }
})();
