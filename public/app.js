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
  const target = ["overview", "device", "platforms", "platform", "game", "games", "health"].includes(view) ? view : "overview";
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
  if (target === "health" && !state.loaded.health) { state.loaded.health = true; loadHealth(); }
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
  $("#footer").textContent = `Última varredura: ${fmtDate(last)}`;
  $("#scan").textContent = `Varrido em ${fmtDate(last)}`;
}

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
      <div class="gover">
        <a class="gtitle glink" href="${gameHref(g)}">${esc(g.title)}</a>
        <span class="gmeta"><span>${esc(sysName(g.system))}</span><span class="gdots">${g.copies.map((c) => `<i class="dot" ${dev(c.device_id)}></i>`).join("")}</span></span>
        <span class="sr-only">Onde está: ${g.copies.map((c) => esc(copyLabel(deviceOf(c.device_id), c.location_id))).join(", ")}</span>
      </div>
      <div class="gdrive">${driveBtn(g)}</div>
    </li>`;
}).join("") : `<li class="muted">Nada encontrado.</li>`;

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
      <td class="sys">${esc(g.system)}</td>
      <td><div class="copies">${g.copies.map(copyChip).join("")}</div></td>
      <td>${driveBtn(g)}</td></tr>`).join("") : `<tr><td colspan="4" class="muted">Nada encontrado.</td></tr>`;
  }
}
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
  const STATUS = { ok: "OK", corrupted: "Corrompido", unknown: "Não verificado" };
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
  if (!append) renderChips();
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

// ---------- página do jogo (dados: libretro-database, um arquivo por plataforma) ----------
const dataCache = {};
const getData = (kind, system) => (dataCache[kind + system] ||= fetch(`data/${kind}/${encodeURIComponent(system)}.json`)
  .then((r) => (r.ok ? r.json() : {})).catch(() => ({})));
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
async function renderGame(key) {
  const g = await api(`/api/game?key=${encodeURIComponent(key)}`);
  const v = $("#view-game");
  if (!g) { v.innerHTML = `<a class="back" href="#games">${icon("chevron-left", "sm")}Jogos</a><h1 tabindex="-1">Jogo não encontrado</h1>`; return; }
  document.title = `${g.title} · Handheld Hub`;
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
        <a class="back" href="#platform-${esc(g.system)}">${icon("chevron-left", "sm")}${esc(sysName(g.system))}</a>
        <div class="ghero-grid">
          <div class="ghero-cover">${g.cover ? `<img src="covers/${esc(g.cover)}" alt="Capa de ${esc(g.title)}">` : `<img class="gplat" src="platforms/${esc(g.system)}.webp" alt="">`}</div>
          <div class="ghero-text">
            <a class="pchip" href="#platform-${esc(g.system)}">${esc(sysName(g.system))}</a>
            <h1 tabindex="-1">${esc(g.title)}</h1>
            <p class="gsub">${[year, info.dev, info.genero].filter(Boolean).map(esc).join(" · ") || "Sem ficha no banco do libretro"}</p>
            ${bad ? `<span class="badge bad">${icon("triangle-alert", "sm")}Tem cópia corrompida</span>` : ""}
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
      <section class="tile"><h2>Onde está</h2>
        <ul class="where-list">${g.copies.map((c) => `<li ${dev(c.device_id)}>
          <span class="dot"></span><span>${esc(copyLabel(deviceOf(c.device_id), c.location_id))}</span>
          <span class="muted small">${esc(c.ext === "pasta" ? "pasta" : (c.ext || "").toUpperCase())}${c.size ? " · " + fmtB(c.size) : ""}</span>
          ${c.status === "corrupted" ? `<span class="badge bad">corrompido</span>` : c.status === "ok" ? `<span class="badge ok">${icon("shield-check", "sm")}ok</span>` : ""}
          ${c.device_id === "drive" && c.drive_id ? `<a class="small" href="${esc(c.ext === "pasta" ? `https://drive.google.com/drive/folders/${c.drive_id}` : `https://drive.google.com/file/d/${c.drive_id}/view`)}" target="_blank" rel="noopener">abrir</a>` : ""}
        </li>`).join("")}</ul>
      </section>
    </div>
    <section class="tile" id="gcodes" aria-labelledby="t-codes"><h2 id="t-codes">Códigos</h2><p class="muted small">Carregando…</p></section>
    <section aria-labelledby="t-more"><div class="tile-head"><h2 id="t-more">Mais de ${esc(sysName(g.system))}</h2>
      <a class="small tlink" href="#platform-${esc(g.system)}">Ver todos</a></div><ul class="morerow" id="gmore"></ul></section>
    <p class="chart-note">Descrição, história e curiosidades chegam na próxima fase (ROADMAP).</p>`;
  // Mais da plataforma: 14 outros jogos com capa, sorteados.
  api(`/api/games?system=${encodeURIComponent(g.system)}&sort=capa&limit=400`).then((r) => {
    const pool = r.games.filter((x) => x.cover && x.game_key !== g.game_key);
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    $("#gmore").innerHTML = pool.slice(0, 14).map((x) => `<li><a href="${gameHref(x)}"><img src="covers/${esc(x.cover)}" alt="" loading="lazy" decoding="async"><span>${esc(x.title)}</span></a></li>`).join("")
      || `<li class="muted small">Sem outros jogos com capa nesta plataforma.</li>`;
  });
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
  // Listas com rolagem própria: focáveis para rolar pelo teclado (Safari não foca sozinho).
  const list = (rows, fmt, label) => rows.length ? `<ul class="list" tabindex="0" aria-label="${esc(label)}">${rows.map(fmt).join("")}</ul>` : `<p class="muted small">Nada aqui.</p>`;
  $("#health").innerHTML = `
    <div class="panel"><h2>${icon("triangle-alert", "sm")}Corrompidos · ${fmtN(h.corrupted.length)}</h2>
      <p class="muted small" style="margin-bottom:10px">Começo do arquivo zerado. Precisam de cópia nova da fonte.</p>
      ${list(h.corrupted, (c) => `<li><span>${esc(c.title)}</span><span>${esc(c.system)}</span></li>`, "Corrompidos")}</div>
    <div class="panel"><h2>${icon("archive", "sm")}Sem backup no Drive</h2>
      <p class="muted small" style="margin-bottom:10px">Estão em algum console, mas não no Drive.</p>
      ${list(h.noBackup, (r) => `<li><span>${esc(r.system)}</span><span>${fmtN(r.n)}</span></li>`, "Sem backup no Drive")}</div>
    <div class="panel"><h2>${icon("cloud", "sm")}Só no Drive</h2>
      <p class="muted small" style="margin-bottom:10px">Estão no acervo, mas em nenhum console.</p>
      ${list(h.driveOnly, (r) => `<li><span>${esc(r.system)}</span><span>${fmtN(r.n)}</span></li>`, "Só no Drive")}</div>`;
}

// ---------- início ----------
(async () => {
  try {
    await loadSummary();
    await loadSystems();
    loadTopPlatforms();
    loadMosaic();
    loadHealthTiles();
    route();
  } catch (e) {
    $("#footer").textContent = `Erro ao carregar: ${e.message}`;
  }
})();
