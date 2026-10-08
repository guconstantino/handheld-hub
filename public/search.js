// Handheld Hub: busca global (paleta de comandos) e atalhos de teclado.
// Usa os helpers do app.js (scripts clássicos compartilham o escopo global): esc, icon, sysName, state...
(() => {
  const pal = document.getElementById("palette");
  const help = document.getElementById("shortcuts");
  const input = document.getElementById("palInput");
  const list = document.getElementById("palList");
  const live = document.getElementById("palLive");
  let items = [], active = 0, gameIndex = null;

  // Sem acento, minúsculo: "pokémon" acha "Pokemon".
  const fold = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  // Pontua: começo do texto > começo de palavra > dentro > letras na ordem (tolera erro de digitação).
  function score(text, q) {
    const t = fold(text);
    let total = 0;
    for (const w of q.split(/\s+/).filter(Boolean)) {
      if (t.startsWith(w)) total += 100;
      else if (new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(t)) total += 60;
      else if (t.includes(w)) total += 30;
      else {
        let i = 0;
        for (const ch of t) if (ch === w[i]) i++;
        if (i < w.length) return 0;
        total += 5;
      }
    }
    return total - t.length * 0.01;               // empate: o mais curto (mais exato) primeiro
  }

  const go = (hash) => () => { location.hash = hash; };
  const ACTIONS = [
    { label: "Visão geral", sub: "Tela", icon: "layers", run: go("#overview"), keys: "g v" },
    { label: "Plataformas", sub: "Tela", icon: "layout-grid", run: go("#platforms"), keys: "g p" },
    { label: "Jogos", sub: "Tela", icon: "gamepad-2", run: go("#games"), keys: "g j" },
    { label: "Saúde do acervo", sub: "Tela", icon: "shield-check", run: go("#health"), keys: "g s" },
    { label: "Alternar tema claro/escuro", sub: "Ação", icon: "sun-moon", run: () => document.getElementById("themeToggle").click(), keys: "t" },
    { label: "Jogos com capa corrompida", sub: "Filtro", icon: "triangle-alert", run: () => { location.hash = "#games"; setTimeout(() => { const s = document.getElementById("fStatus"); s.value = "corrupted"; s.dispatchEvent(new Event("change")); }, 0); } },
  ];

  async function search(qRaw) {
    const q = fold(qRaw.trim());
    gameIndex ||= await api("/api/index");
    const out = [];
    const take = (arr, n) => arr.filter((x) => x.sc > 0).sort((a, b) => b.sc - a.sc).slice(0, n);
    const acts = q ? take(ACTIONS.map((a) => ({ ...a, sc: score(a.label, q) })), 4) : ACTIONS.slice(0, 4).map((a) => ({ ...a, sc: 1 }));
    if (acts.length) out.push(["Telas e ações", acts]);
    const plats = (state.platforms || []).map((p) => ({ label: sysName(p.system), sub: `${fmtN(p.games)} jogos`, img: `platforms/${p.system}.webp`,
      run: go(`#platform-${p.system}`), sc: q ? Math.max(score(sysName(p.system), q), score(p.system, q)) : 0 }));
    const pl = take(plats, q ? 5 : 0);
    if (pl.length) out.push(["Plataformas", pl]);
    const devs = state.devices.map((d) => ({ label: d.name, sub: "Console", icon: "hard-drive", run: go(`#device-${d.id}`), sc: q ? score(d.name, q) : 0 }));
    const dv = take(devs, 3);
    if (dv.length) out.push(["Consoles", dv]);
    if (q.length >= 2) {
      const games = [];
      for (const g of gameIndex) {
        const sc = score(g.t, q);
        if (sc > 0) games.push({ label: g.t, sub: sysName(g.s), img: g.c ? `covers/${g.c}` : null, icon: "gamepad-2",
          run: go(`#game-${encodeURIComponent(g.k)}`), sc });
      }
      // A tolerância a erro de digitação (letras na ordem, pontuação baixa) só entra quando não há acerto de verdade.
      const strong = games.filter((g) => g.sc >= 30);
      const gs = take(strong.length ? strong : games, 30);
      if (gs.length) out.push([`Jogos`, gs]);
    }
    return out;
  }

  function render(groups) {
    items = groups.flatMap(([, arr]) => arr);
    active = 0;
    let i = 0;
    list.innerHTML = groups.length ? groups.map(([title, arr]) => `<li role="presentation" class="pal-group">${esc(title)}</li>` +
      arr.map((it) => `<li role="option" id="pal-${i}" class="pal-item" data-i="${i++}" aria-selected="false">
        <span class="pal-ico">${it.img ? `<img src="${esc(it.img)}" alt="" loading="lazy">` : icon(it.icon || "search", "sm")}</span>
        <span class="pal-txt"><b>${esc(it.label)}</b><span>${esc(it.sub || "")}</span></span>
        ${it.keys ? `<kbd>${esc(it.keys)}</kbd>` : ""}</li>`).join("")).join("")
      : `<li role="presentation" class="pal-empty">Nada encontrado.</li>`;
    live.textContent = items.length ? `${items.length} resultados` : "Nada encontrado";
    mark();
  }
  function mark() {
    list.querySelectorAll(".pal-item").forEach((el) => el.setAttribute("aria-selected", String(+el.dataset.i === active)));
    const el = document.getElementById(`pal-${active}`);
    input.setAttribute("aria-activedescendant", el ? el.id : "");
    el?.scrollIntoView({ block: "nearest" });
  }
  function run(i) {
    const it = items[i];
    if (!it) return;
    pal.close();
    it.run();
  }

  let t;
  input.addEventListener("input", () => { clearTimeout(t); t = setTimeout(async () => render(await search(input.value)), 80); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); active = Math.min(active + 1, items.length - 1); mark(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); active = Math.max(active - 1, 0); mark(); }
    else if (e.key === "Enter") { e.preventDefault(); run(active); }
  });
  list.addEventListener("click", (e) => { const li = e.target.closest(".pal-item"); if (li) run(+li.dataset.i); });
  list.addEventListener("mousemove", (e) => { const li = e.target.closest(".pal-item"); if (li && +li.dataset.i !== active) { active = +li.dataset.i; mark(); } });
  // Clique fora da caixa fecha.
  [pal, help].forEach((d) => d.addEventListener("click", (e) => { if (e.target === d) d.close(); }));

  async function open() {
    if (help.open) help.close();
    if (!pal.open) pal.showModal();
    input.value = "";
    input.focus();
    render(await search(""));
  }
  // Mostra a tecla certa: ⌘ no Mac, Ctrl no Windows/Linux.
  const mac = /mac|iphone|ipad/i.test(navigator.userAgentData?.platform || navigator.platform || "");
  document.querySelector(".searchbtn kbd").textContent = mac ? "⌘K" : "Ctrl K";
  document.querySelector(".keys dt kbd").textContent = mac ? "⌘" : "Ctrl";
  window.HH_SEARCH = open;
  document.getElementById("searchBtn").onclick = open;
  document.getElementById("helpBtn").onclick = () => help.showModal();

  // Atalhos. Os de uma tecla podem ser desligados (WCAG 2.1.4) e nunca disparam dentro de campos.
  const single = document.getElementById("singleKeys");
  try { single.checked = localStorage.getItem("hh_keys") !== "off"; } catch {}
  single.onchange = () => { try { localStorage.setItem("hh_keys", single.checked ? "on" : "off"); } catch {} };
  let prefix = null, prefixTimer;
  const typing = (el) => el?.closest?.("input, textarea, select, [contenteditable]");
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); return pal.open ? pal.close() : open(); }
    if (pal.open || help.open || typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "/") { e.preventDefault(); return open(); }
    if (!single.checked) return;
    if (e.key === "?") { e.preventDefault(); return help.showModal(); }
    const k = e.key.toLowerCase();
    if (prefix === "g") {
      prefix = null;
      const dest = { v: "#overview", p: "#platforms", j: "#games", s: "#health" }[k];
      if (dest) { e.preventDefault(); location.hash = dest; }
      return;
    }
    if (k === "g") { prefix = "g"; clearTimeout(prefixTimer); prefixTimer = setTimeout(() => (prefix = null), 1200); return; }
    if (k === "t") document.getElementById("themeToggle").click();
  });
})();
