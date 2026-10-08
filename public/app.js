// Handheld Hub: lê a API do Worker e monta as telas (visão geral, console, jogos, saúde).

const $ = (s) => document.querySelector(s);
const api = (path) => fetch(path).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${path}: ${r.status}`))));
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
$("#themeToggle").onclick = () => {
  const dark = document.documentElement.dataset.theme
    ? document.documentElement.dataset.theme === "dark"
    : matchMedia("(prefers-color-scheme: dark)").matches;
  const t = dark ? "light" : "dark";
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem("hh_theme", t); } catch {}
};

// ---------- rotas: #overview, #device/<id>, #games, #health ----------
function route() {
  const [view, arg] = (location.hash.slice(1) || "overview").split("/");
  const target = ["overview", "device", "games", "health"].includes(view) ? view : "overview";
  document.querySelectorAll(".nav a").forEach((a) => a.classList.toggle("active", a.dataset.view === (target === "device" ? "overview" : target)));
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("hidden", v.id !== `view-${target}`));
  if (target === "device") renderDevice(arg);
  if (target === "games" && !state.loaded.games) { state.loaded.games = true; loadGames(); }
  if (target === "health" && !state.loaded.health) { state.loaded.health = true; loadHealth(); }
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", route);

// ---------- armazenamento (varrido ou declarado no devices.json) ----------
function storageOf(d) {
  const scanned = state.locations.filter((l) => l.device_id === d.id).map((l) => ({
    label: l.label, total: l.total_bytes, free: l.free_bytes, files: l.files, corrupted: l.corrupted, last: l.last_scan,
  }));
  return scanned.length ? scanned : (d.specs.storage || []);
}
function storageHtml(s) {
  const used = s.total ? Math.round(((s.total - s.free) / s.total) * 100) : null;
  const right = s.total ? `${fmtB(s.free)} livres de ${fmtB(s.total)}` : s.files != null ? `${fmtN(s.files)} itens` : "";
  return `<div class="store">
    <div class="store-row"><span>${esc(s.label)}</span><span>${right}</span></div>
    ${used !== null ? `<div class="bar"><i style="width:${used}%"></i></div>` : ""}
  </div>`;
}

// ---------- visão geral ----------
async function loadSummary() {
  const s = await api("/api/summary");
  state.devices = s.devices; state.locations = s.locations;
  const t = s.totals;
  $("#stats").innerHTML = [
    ["Jogos", t.games], ["Arquivos", t.files], ["Sistemas", t.systems], ["Corrompidos", t.corrupted, t.corrupted > 0],
  ].map(([l, v, bad]) => `<div class="stat ${bad ? "bad" : ""}"><b>${fmtN(v)}</b><span>${l}</span></div>`).join("");

  $("#devices").innerHTML = s.devices.map((d) => {
    const facts = Object.entries(d.specs.facts || {}).slice(0, 3);
    const bad = s.locations.filter((l) => l.device_id === d.id).reduce((n, l) => n + (l.corrupted || 0), 0);
    return `<a class="device" href="#device/${esc(d.id)}" style="--accent:${esc(d.accent)}">
      <div class="device-name"><span class="dot"></span>${esc(d.name)}
        ${bad ? `<span class="badge bad" style="margin-left:auto">${fmtN(bad)} corrompidos</span>` : ""}</div>
      <p>${esc(d.notes || "")}</p>
      ${facts.length ? `<dl class="kv">${facts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>` : ""}
      <div>${storageOf(d).map(storageHtml).join("")}</div>
      <span class="more">Ver detalhes →</span>
    </a>`;
  }).join("");

  $("#fDevice").innerHTML = `<option value="">Todos os lugares</option>` +
    s.devices.map((d) => `<option value="${esc(d.id)}">${esc(d.name)}</option>`).join("");
  const last = s.locations.map((l) => l.last_scan).filter(Boolean).sort().pop();
  $("#footer").textContent = `Última varredura: ${fmtDate(last)}`;
}

// ---------- detalhe do console ----------
function renderDevice(id) {
  const d = deviceOf(id);
  if (!d.id) { $("#view-device").innerHTML = `<a class="back" href="#overview">← Consoles</a><p class="muted">Console não encontrado.</p>`; return; }
  const sp = d.specs || {};
  const facts = Object.entries(sp.facts || {});
  const locs = state.locations.filter((l) => l.device_id === d.id);
  $("#view-device").style.setProperty("--accent", d.accent);
  $("#view-device").innerHTML = `
    <div>
      <a class="back" href="#overview">← Consoles</a>
      <div class="detail-head"><span class="dot"></span><h1>${esc(d.name)}</h1></div>
      <p class="lead">${esc(d.notes || "")}</p>
    </div>
    <div class="detail-grid">
      ${facts.length ? `<div><h2>Ficha</h2><div class="panel"><dl class="kv">${facts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl></div></div>` : ""}
      <div><h2>Armazenamento</h2><div class="panel">${storageOf(d).map(storageHtml).join("") || `<p class="muted small">Sem dados.</p>`}
        ${locs.map((l) => `<p class="muted small" style="margin-top:10px">${esc(l.label)}: ${fmtN(l.files)} itens, ${fmtB(l.bytes)} · varrido ${fmtDate(l.last_scan)}${l.corrupted ? ` · <span style="color:var(--danger)">${fmtN(l.corrupted)} corrompidos</span>` : ""}</p>`).join("")}
        ${locs.length ? `<p style="margin-top:14px"><a class="small" href="#games" onclick="setTimeout(()=>{$('#fDevice').value='${esc(d.id)}';loadGames()},0)">Ver jogos deste console →</a></p>` : ""}
      </div></div>
    </div>
    ${(sp.sections || []).length ? `<div class="sections">${sp.sections.map((s) => `
      <div><h2>${esc(s.title)}</h2><div class="tags">${s.items.map((i) => `<span>${esc(i)}</span>`).join("")}</div></div>`).join("")}</div>` : ""}
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
  const list = (rows, fmt) => rows.length ? `<ul class="list">${rows.map(fmt).join("")}</ul>` : `<p class="muted small">Nada aqui.</p>`;
  $("#health").innerHTML = `
    <div><h2>Corrompidos · ${fmtN(h.corrupted.length)}</h2>
      <p class="muted small" style="margin-bottom:10px">Começo do arquivo zerado. Precisam de cópia nova da fonte.</p>
      ${list(h.corrupted, (c) => `<li><span>${esc(c.title)}</span><span>${esc(c.system)}</span></li>`)}</div>
    <div><h2>Sem backup no Drive</h2>
      <p class="muted small" style="margin-bottom:10px">Estão em algum console, mas não no Drive.</p>
      ${list(h.noBackup, (r) => `<li><span>${esc(r.system)}</span><span>${fmtN(r.n)}</span></li>`)}</div>
    <div><h2>Só no Drive</h2>
      <p class="muted small" style="margin-bottom:10px">Estão no acervo, mas em nenhum console.</p>
      ${list(h.driveOnly, (r) => `<li><span>${esc(r.system)}</span><span>${fmtN(r.n)}</span></li>`)}</div>`;
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
