// Handheld Hub: lê a API do Worker e monta as três abas (visão geral, jogos, saúde).

const $ = (s) => document.querySelector(s);
const api = (path) => fetch(path).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${path}: ${r.status}`))));
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtN = (n) => Number(n || 0).toLocaleString("pt-BR");
const fmtB = (b) => {
  if (!b) return "—";
  const u = ["B", "KB", "MB", "GB", "TB"]; let i = 0; let v = b;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 && i > 2 ? 1 : 0)} ${u[i]}`;
};
const fmtDate = (s) => (s ? new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "nunca");

let state = { devices: [], locations: [], offset: 0 };

// ---------- tema ----------
try { document.documentElement.dataset.theme = localStorage.getItem("hh_theme") || "dark"; } catch {}
$("#themeToggle").onclick = () => {
  const t = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem("hh_theme", t); } catch {}
};

// ---------- abas ----------
document.querySelectorAll(".tab-btn").forEach((b) => (b.onclick = () => show(b.dataset.view)));
function show(view) {
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("hidden", v.id !== `view-${view}`));
  if (view === "games" && !$("#gamesTable tbody").children.length) loadGames();
  if (view === "health" && !$("#health").children.length) loadHealth();
  history.replaceState(null, "", `#${view}`);
}

// ---------- visão geral ----------
async function loadSummary() {
  const s = await api("/api/summary");
  state.devices = s.devices; state.locations = s.locations;
  const t = s.totals;
  $("#kpis").innerHTML = [
    ["Jogos únicos", fmtN(t.games)], ["Arquivos", fmtN(t.files)],
    ["Sistemas", fmtN(t.systems)], ["Corrompidos", fmtN(t.corrupted)],
  ].map(([l, v]) => `<div class="kpi-card"><div><div class="kpi-value">${v}</div><div class="kpi-label">${l}</div></div></div>`).join("");

  $("#devices").innerHTML = s.devices.map((d) => {
    const locs = s.locations.filter((l) => l.device_id === d.id);
    const scanned = locs.some((l) => l.last_scan);
    const specs = Object.entries(d.specs || {}).map(([k, v]) =>
      `<li><span class="label">${esc(k)}</span><span class="value">${esc(v)}</span></li>`).join("");
    const locHtml = locs.map((l) => {
      const used = l.total_bytes ? Math.round(((l.total_bytes - l.free_bytes) / l.total_bytes) * 100) : null;
      return `<div class="hub-loc">
        <div class="hub-loc-head"><span>${esc(l.label)}</span><span>${fmtN(l.files)} arquivos · ${fmtB(l.bytes)}</span></div>
        ${used !== null ? `<div class="progress-track"><div class="progress-fill" style="width:${used}%;background:${esc(d.accent)}"></div></div>
          <div class="hub-muted">${fmtB(l.free_bytes)} livres de ${fmtB(l.total_bytes)}</div>` : ""}
        ${l.corrupted ? `<span class="tag-pill tag-bad">${fmtN(l.corrupted)} corrompidos</span>` : ""}
        <div class="hub-muted">Varrido: ${fmtDate(l.last_scan)}</div></div>`;
    }).join("");
    return `<article class="card" style="--accent:${esc(d.accent)}">
      <div class="card-head"><h3>${esc(d.name)}</h3>
        <span class="tag-pill ${scanned ? "tag-ok" : "tag-warn"}">${scanned ? "varrido" : "não varrido"}</span></div>
      <p class="card-desc">${esc(d.notes || "")}</p>
      ${specs ? `<ul class="data-list">${specs}</ul>` : ""}
      ${locHtml}
    </article>`;
  }).join("");

  $("#fDevice").innerHTML = `<option value="">Todos os lugares</option>` +
    s.devices.map((d) => `<option value="${esc(d.id)}">${esc(d.name)}</option>`).join("");
  const last = s.locations.map((l) => l.last_scan).filter(Boolean).sort().pop();
  $("#footer").textContent = `Última varredura: ${fmtDate(last)} · dados locais (wrangler dev)`;
}

// ---------- jogos ----------
async function loadSystems() {
  const rows = await api("/api/systems");
  const systems = [...new Set(rows.map((r) => r.system))].sort();
  $("#fSystem").innerHTML = `<option value="">Todos os sistemas</option>` +
    systems.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join("");
}

const deviceOf = (id) => state.devices.find((d) => d.id === id) || {};
const locOf = (id) => state.locations.find((l) => l.id === id) || {};

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
      <td>${esc(g.title)}</td><td>${esc(g.system)}</td>
      <td><div class="hub-copies">${g.copies.map((c) => {
        const d = deviceOf(c.device_id);
        return `<span class="hub-copy ${c.status === "corrupted" ? "corrupted" : ""}" style="--dot:${esc(d.accent)}"
          title="${esc(c.rel_path)} · ${fmtB(c.size)}">${esc(locOf(c.location_id).label || c.location_id)}${c.status === "corrupted" ? " · corrompido" : ""}</span>`;
      }).join("")}</div></td></tr>`).join("");
  const tbody = $("#gamesTable tbody");
  tbody.innerHTML = append ? tbody.innerHTML + rows : rows || `<tr><td colspan="3" class="hub-muted">Nada encontrado.</td></tr>`;
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
  const list = (rows, fmt) => rows.length ? `<ul class="hub-list">${rows.map(fmt).join("")}</ul>` : `<p class="hub-muted">Nada aqui.</p>`;
  $("#health").innerHTML = `
    <article class="card"><div class="card-head"><h3>Corrompidos</h3><span class="tag-pill tag-bad">${fmtN(h.corrupted.length)}</span></div>
      <p class="card-desc">Começo do arquivo zerado: o emulador não reconhece. Precisam de cópia nova da fonte.</p>
      ${list(h.corrupted, (c) => `<li><span>${esc(c.title)}</span><span>${esc(c.system)} · ${esc(locOf(c.location_id).label || c.location_id)}</span></li>`)}</article>
    <article class="card"><div class="card-head"><h3>Sem backup no Drive</h3></div>
      <p class="card-desc">Jogos que estão em algum console mas não aparecem no Drive (por sistema).</p>
      ${list(h.noBackup, (r) => `<li><span>${esc(r.system)}</span><span>${fmtN(r.n)}</span></li>`)}</article>
    <article class="card"><div class="card-head"><h3>Só no Drive</h3></div>
      <p class="card-desc">Jogos do acervo que não estão em nenhum console (por sistema).</p>
      ${list(h.driveOnly, (r) => `<li><span>${esc(r.system)}</span><span>${fmtN(r.n)}</span></li>`)}</article>`;
}

window.addEventListener("hashchange", () => show((location.hash || "#overview").slice(1)));

// ---------- início ----------
(async () => {
  try {
    await loadSummary();
    await loadSystems();
    show((location.hash || "#overview").slice(1));
  } catch (e) {
    $("#footer").textContent = `Erro ao carregar: ${e.message}`;
  }
})();
