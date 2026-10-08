// Handheld Hub: lê a API do Worker e monta as telas (visão geral, console, jogos, saúde).

const $ = (s) => document.querySelector(s);
// No snapshot estático (scripts/build_static.py), window.HH_API responde no lugar do Worker.
const api = (path) => window.HH_API ? window.HH_API(path) : fetch(path).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${path}: ${r.status}`))));
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtN = (n) => Number(n || 0).toLocaleString("pt-BR");
const fmtB = (b) => {
  if (!b) return "—";
  const u = ["B", "KB", "MB", "GB", "TB"]; let i = 0; let v = b;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toLocaleString("pt-BR", { maximumFractionDigits: v < 10 && i > 2 ? 1 : 0 })} ${u[i]}`;
};
// Data pura (AAAA-MM-DD) vira meio-dia local para não voltar um dia por causa do fuso.
const fmtDate = (s) => (s ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T12:00` : s).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "nunca");

const icon = (name, cls = "") => `<svg class="ic ${cls}" aria-hidden="true"><use href="icons.svg#i-${name}"/></svg>`;
const logo = (d) => {
  const id = (d.specs || {}).logo;
  if (!id) return "";
  if (id.startsWith("i-")) return icon(id.slice(2));
  return `<svg class="logo ${id === "b-samsung" ? "wide" : ""}" aria-hidden="true"><use href="icons.svg#${id}"/></svg>`;
};
// Ícone de cada título de seção das fichas (devices.json).
const SECTION_ICON = {
  "Emuladores": "gamepad-2", "Ports nativos": "package", "Ajustes": "wrench", "Atenção": "triangle-alert",
  "Boot (hekate)": "power", "Segurança e offline": "shield-check", "Sysmodules": "cpu", "Homebrew": "package",
  "Backups e reinstalação": "archive", "Acervo": "layers", "Saves": "cloud", "Extras": "puzzle",
  "Ficha": "info", "Armazenamento": "hard-drive",
};
const sectionTitle = (title) => `<h2>${SECTION_ICON[title] ? icon(SECTION_ICON[title], "sm") : ""}${esc(title)}</h2>`;

const state = { devices: [], locations: [], offset: 0, loaded: {} };
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

// ---------- rotas: #overview, #device/<id>, #games, #health ----------
function route(moveFocus = false) {
  const [view, arg] = (location.hash.slice(1) || "overview").split(/[/-](.*)/);
  const target = ["overview", "device", "games", "health"].includes(view) ? view : "overview";
  document.querySelectorAll(".nav a").forEach((a) => {
    const on = a.dataset.view === (target === "device" ? "overview" : target);
    a.classList.toggle("active", on);
    if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("hidden", v.id !== `view-${target}`));
  if (target === "device") renderDevice(arg);
  if (target === "games" && !state.loaded.games) { state.loaded.games = true; loadGames(); }
  if (target === "health" && !state.loaded.health) { state.loaded.health = true; loadHealth(); }
  const h1 = document.querySelector(`#view-${target} h1`);
  document.title = h1 && target !== "overview" ? `${h1.textContent} · Handheld Hub` : "Handheld Hub";
  window.scrollTo(0, 0);
  // Troca de tela sem recarregar: leva o foco ao título para o leitor de tela anunciar a tela nova.
  if (moveFocus) focusHeading();
}
window.addEventListener("hashchange", () => route(true));

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
  const right = s.total ? `${fmtB(s.free)} livres de ${fmtB(s.total)}` : s.files != null ? `${fmtN(s.files)} itens` : "";
  return `<div class="store">
    <div class="store-row"><span>${icon(s.cloud ? "cloud" : "hard-drive", "sm")}${esc(s.label)}</span><span>${right}</span></div>
    ${used !== null ? `<div class="bar"><i style="width:${used}%"></i></div>` : ""}
  </div>`;
}

// ---------- visão geral ----------
async function loadSummary() {
  const s = await api("/api/summary");
  state.devices = s.devices; state.locations = s.locations;
  const t = s.totals;
  $("#stats").innerHTML = [
    ["Jogos", t.games, "gamepad-2"], ["Arquivos", t.files, "folder-open"], ["Sistemas", t.systems, "layers"],
    ["Corrompidos", t.corrupted, "triangle-alert", t.corrupted > 0],
  ].map(([l, v, ic, bad]) => `<div class="stat ${bad ? "bad" : ""}" role="listitem"><b>${fmtN(v)}</b><span>${icon(ic, "sm")}${l}</span></div>`).join("");

  $("#devices").innerHTML = s.devices.map((d) => {
    const facts = Object.entries(d.specs.facts || {}).slice(0, 3);
    const bad = s.locations.filter((l) => l.device_id === d.id).reduce((n, l) => n + (l.corrupted || 0), 0);
    return `<article class="device" style="--accent:${esc(d.accent)}">
      <h2 class="device-name"><span class="dot"></span><a class="device-link" href="#device-${esc(d.id)}">${esc(d.name)}</a><span style="margin-left:auto;display:flex">${logo(d)}</span></h2>
      ${bad ? `<span class="badge bad" style="align-self:flex-start">${fmtN(bad)} corrompidos</span>` : ""}
      <p>${esc(d.notes || "")}</p>
      ${facts.length ? `<dl class="kv">${facts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>` : ""}
      <div>${storageOf(d).map(storageHtml).join("")}</div>
      <span class="more" aria-hidden="true">Ver detalhes ${icon("chevron-right", "sm")}</span>
    </article>`;
  }).join("");

  $("#fDevice").innerHTML = `<option value="">Todos os lugares</option>` +
    s.devices.map((d) => `<option value="${esc(d.id)}">${esc(d.name)}</option>`).join("");
  const last = s.locations.map((l) => l.last_scan).filter(Boolean).sort().pop();
  $("#footer").textContent = `Última varredura: ${fmtDate(last)}`;
}

// ---------- detalhe do console ----------
function renderDevice(id) {
  const d = deviceOf(id);
  if (!d.id) { $("#view-device").innerHTML = `<a class="back" href="#overview">${icon("chevron-left", "sm")}Consoles</a><h1 tabindex="-1">Console não encontrado</h1>`; return; }
  const sp = d.specs || {};
  const facts = Object.entries(sp.facts || {});
  const locs = state.locations.filter((l) => l.device_id === d.id);
  $("#view-device").style.setProperty("--accent", d.accent);
  $("#view-device").innerHTML = `
    <div>
      <a class="back" href="#overview">${icon("chevron-left", "sm")}Consoles</a>
      <div class="detail-head"><span class="dot"></span><h1 tabindex="-1">${esc(d.name)}</h1><span style="margin-left:auto;display:flex">${logo(d)}</span></div>
      <p class="lead">${esc(d.notes || "")}</p>
    </div>
    <div class="detail-grid">
      ${facts.length ? `<div>${sectionTitle("Ficha")}<div class="panel"><dl class="kv">${facts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl></div></div>` : ""}
      <div>${sectionTitle("Armazenamento")}<div class="panel">${storageOf(d).map(storageHtml).join("") || `<p class="muted small">Sem dados.</p>`}
        ${locs.map((l) => `<p class="muted small" style="margin-top:10px">${esc(l.label)}: ${fmtN(l.files)} itens${l.bytes ? `, ${fmtB(l.bytes)}` : ""} · varrido ${fmtDate(l.last_scan)}${l.corrupted ? ` · <span style="color:var(--danger)">${fmtN(l.corrupted)} corrompidos</span>` : ""}</p>`).join("")}
        ${locs.length ? `<p style="margin-top:14px"><a class="small" href="#games" onclick="setTimeout(()=>{$('#fDevice').value='${esc(d.id)}';loadGames()},0)">Ver jogos deste console</a></p>` : ""}
      </div></div>
    </div>
    ${(sp.sections || []).length ? `<div class="sections">${sp.sections.map((s) => `
      <div>${sectionTitle(s.title)}<div class="tags">${s.items.map((i) => `<span>${esc(i)}</span>`).join("")}</div></div>`).join("")}</div>` : ""}
    ${sp.source ? `<p class="source">Fonte: repo ${esc(sp.source)} · snapshot de ${fmtDate(sp.snapshot)}</p>` : ""}`;
}

// ---------- jogos ----------
async function loadSystems() {
  const rows = await api("/api/systems");
  const systems = [...new Set(rows.map((r) => r.system))].sort();
  $("#fSystem").innerHTML = `<option value="">Todos os sistemas</option>` +
    systems.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join("");
}

let gamesReq = 0;
async function loadGames(append = false) {
  const req = ++gamesReq;                 // descarta respostas antigas (busca digitada durante a carga)
  if (!append) state.offset = 0;
  const p = new URLSearchParams({ limit: 100, offset: state.offset });
  for (const [k, el] of [["q", "#q"], ["device", "#fDevice"], ["system", "#fSystem"], ["status", "#fStatus"]])
    if ($(el).value.trim()) p.set(k, $(el).value.trim());
  const r = await api(`/api/games?${p}`);
  if (req !== gamesReq) return;
  const rows = r.games.map((g) => `<tr>
      <td>${esc(g.title)}</td><td class="sys">${esc(g.system)}</td>
      <td><div class="copies">${g.copies.map((c) => {
        const d = deviceOf(c.device_id);
        const bad = c.status === "corrupted";
        return `<span class="${bad ? "bad" : ""}" title="${esc(c.rel_path)} · ${fmtB(c.size)}"><i class="dot" style="--accent:${esc(d.accent)}"></i>${esc(copyLabel(d, c.location_id))}${bad ? " · corrompido" : ""}</span>`;
      }).join("")}</div></td></tr>`).join("");
  const tbody = $("#gamesTable tbody");
  tbody.innerHTML = append ? tbody.innerHTML + rows : rows || `<tr><td colspan="3" class="muted">Nada encontrado.</td></tr>`;
  state.offset += r.games.length;
  $("#gamesCount").textContent = `${fmtN(r.total)} ${r.total === 1 ? "jogo" : "jogos"}`;
  $("#more").classList.toggle("hidden", state.offset >= r.total);
}
let t;
$("#q").oninput = () => { clearTimeout(t); t = setTimeout(() => loadGames(), 250); };
["#fDevice", "#fSystem", "#fStatus"].forEach((s) => ($(s).onchange = () => loadGames()));
$("#more").onclick = () => loadGames(true);

// ---------- saúde ----------
async function loadHealth() {
  const h = await api("/api/health");
  // Listas com rolagem própria: focáveis para rolar pelo teclado (Safari não foca sozinho).
  const list = (rows, fmt, label) => rows.length ? `<ul class="list" tabindex="0" aria-label="${esc(label)}">${rows.map(fmt).join("")}</ul>` : `<p class="muted small">Nada aqui.</p>`;
  $("#health").innerHTML = `
    <div><h2>${icon("triangle-alert", "sm")}Corrompidos · ${fmtN(h.corrupted.length)}</h2>
      <p class="muted small" style="margin-bottom:10px">Começo do arquivo zerado. Precisam de cópia nova da fonte.</p>
      ${list(h.corrupted, (c) => `<li><span>${esc(c.title)}</span><span>${esc(c.system)}</span></li>`, "Corrompidos")}</div>
    <div><h2>${icon("archive", "sm")}Sem backup no Drive</h2>
      <p class="muted small" style="margin-bottom:10px">Estão em algum console, mas não no Drive.</p>
      ${list(h.noBackup, (r) => `<li><span>${esc(r.system)}</span><span>${fmtN(r.n)}</span></li>`, "Sem backup no Drive")}</div>
    <div><h2>${icon("cloud", "sm")}Só no Drive</h2>
      <p class="muted small" style="margin-bottom:10px">Estão no acervo, mas em nenhum console.</p>
      ${list(h.driveOnly, (r) => `<li><span>${esc(r.system)}</span><span>${fmtN(r.n)}</span></li>`, "Só no Drive")}</div>`;
}

// ---------- início ----------
(async () => {
  try {
    await loadSummary();
    loadSystems();
    route();
  } catch (e) {
    $("#footer").textContent = `Erro ao carregar: ${e.message}`;
  }
})();
