// Handheld Hub: as rotas /api/* respondidas no próprio navegador, a partir de data/catalog.json.
// Assim o site não lê o D1 em produção (ver docs/DECISIONS.md). No snapshot de arquivo único
// (scripts/build_static.py) os dados já vêm embutidos em window.HH_DATA.
(() => {
  let ready;
  const load = () => (ready ||= (window.HH_DATA ? Promise.resolve(window.HH_DATA)
    : fetch("data/catalog.json").then((r) => (r.ok ? r.json() : Promise.reject(new Error(`catálogo: ${r.status}`)))))
    .then(index));

  // Descompacta uma vez e monta os agrupamentos que todas as rotas usam.
  function index(D) {
    const F = D.files.map(([li, si, title, key, st, size, ext, drive_id]) => ({
      location_id: D.locations[li].id, device_id: D.locations[li].device_id, system: D.systems[si], title,
      game_key: D.systems[si] + "|" + key, status: D.status[st], size, ext, drive_id: drive_id || null,
    }));
    const byKey = new Map();
    for (const f of F) (byKey.get(f.game_key) || byKey.set(f.game_key, []).get(f.game_key)).push(f);
    return { D, F, byKey };
  }
  const bySystem = (list) => Object.entries(list.reduce((m, g) => ((m[g.system] = (m[g.system] || 0) + 1), m), {}))
    .map(([system, n]) => ({ system, n })).sort((a, b) => b.n - a.n);
  const byTitle = (a, b) => a.system.localeCompare(b.system) || a.title.localeCompare(b.title);

  const routes = {
    "/api/summary": ({ D, F, byKey }) => {
      // Por console: jogos únicos, sistemas, quantos têm capa e quantos não têm cópia no Drive.
      const per = {};
      for (const [k, copies] of byKey) {
        const inDrive = copies.some((c) => c.device_id === "drive");
        for (const dev of new Set(copies.map((c) => c.device_id))) {
          const s = (per[dev] ||= { games: 0, systems: new Set(), covered: 0, noBackup: 0, driveOnly: 0 });
          s.games++; s.systems.add(copies[0].system);
          if (D.covers[k]) s.covered++;
          if (dev !== "drive" && !inDrive) s.noBackup++;
          if (dev === "drive" && copies.every((c) => c.device_id === "drive")) s.driveOnly++;
        }
      }
      // Cobertura de capas por sistema (jogos únicos).
      const cov = {};
      for (const [k, copies] of byKey) {
        const c = (cov[copies[0].system] ||= { system: copies[0].system, games: 0, covered: 0 });
        c.games++; if (D.covers[k]) c.covered++;
      }
      return {
        devices: D.devices, locations: D.locations, history: D.history || [],
        stats: Object.fromEntries(Object.entries(per).map(([d, s]) => [d, { ...s, systems: s.systems.size }])),
        coverage: Object.values(cov).sort((a, b) => b.games - a.games),
        totals: { games: byKey.size, files: F.length, corrupted: F.filter((f) => f.status === "corrupted").length,
                  systems: new Set(F.map((f) => f.system)).size, covers: [...byKey.keys()].filter((k) => D.covers[k]).length },
      };
    },
    // Jogos (game_keys distintos) por sistema e device, como a rota antiga do Worker.
    "/api/systems": ({ F }) => {
      const m = new Map();
      for (const f of F) {
        const k = f.system + "|" + f.device_id;
        const r = m.get(k) || { system: f.system, device_id: f.device_id, keys: new Set(), corrupted: 0 };
        r.keys.add(f.game_key); if (f.status === "corrupted") r.corrupted++;
        m.set(k, r);
      }
      return [...m.values()].map(({ keys, ...r }) => ({ ...r, games: keys.size })).sort((a, b) => a.system.localeCompare(b.system));
    },
    "/api/games": ({ D, F, byKey }, p) => {
      const q = (p.get("q") || "").toLowerCase();
      const hit = new Set();
      for (const f of F) {
        if ((!q || f.title.toLowerCase().includes(q) || f.game_key.includes(q))
          && (!p.get("system") || f.system === p.get("system")) && (!p.get("device") || f.device_id === p.get("device"))
          && (!p.get("status") || f.status === p.get("status"))) hit.add(f.game_key);
      }
      const list = [...hit].map((k) => {
        const copies = byKey.get(k);
        return { game_key: k, system: copies[0].system, title: copies.reduce((t, c) => (c.title < t ? c.title : t), copies[0].title), copies };
      }).sort(byTitle);
      const limit = Math.min(Number(p.get("limit")) || 100, 500), offset = Number(p.get("offset")) || 0;
      return { total: list.length, games: list.slice(offset, offset + limit).map((g) => ({ ...g, cover: D.covers[g.game_key] || null })) };
    },
    // Uma linha por plataforma: jogos, capas, cópias por console, corrompidos e sem backup no Drive.
    "/api/platforms": ({ D, F, byKey }) => {
      const m = {};
      for (const [k, copies] of byKey) {
        const sys = copies[0].system;
        const p = (m[sys] ||= { system: sys, games: 0, covered: 0, files: 0, corrupted: 0, noBackup: 0, byDevice: {} });
        p.games++; p.files += copies.length;
        if (D.covers[k]) p.covered++;
        if (copies.some((c) => c.status === "corrupted")) p.corrupted++;
        if (!copies.some((c) => c.device_id === "drive")) p.noBackup++;
        for (const dev of new Set(copies.map((c) => c.device_id))) p.byDevice[dev] = (p.byDevice[dev] || 0) + 1;
      }
      return Object.values(m).sort((a, b) => b.games - a.games);
    },
    // Jogos aleatórios com capa (mosaico da visão geral); muda a cada visita.
    "/api/mosaic": ({ D, byKey }, p) => {
      const keys = Object.keys(D.covers), n = Math.min(Number(p.get("n")) || 18, keys.length), out = [];
      for (let i = 0; i < n; i++) {
        const k = keys.splice(Math.floor(Math.random() * keys.length), 1)[0];
        const c = byKey.get(k);
        if (c) out.push({ game_key: k, title: c[0].title, system: c[0].system, cover: D.covers[k] });
      }
      return out;
    },
    // Um jogo: cópias, capa e título (os dados extras vêm de data/info e data/cheats, por plataforma).
    "/api/game": ({ D, byKey }, p) => {
      const k = p.get("key"), copies = byKey.get(k);
      if (!copies) return null;
      return { game_key: k, system: copies[0].system, title: copies.reduce((t, c) => (c.title < t ? c.title : t), copies[0].title),
               cover: D.covers[k] || null, copies };
    },
    // Índice da busca global: um item por jogo (título, plataforma, capa). Montado uma vez.
    "/api/index": (X) => (X.index ||= [...X.byKey].map(([k, c]) => ({
      k, s: c[0].system, t: c.reduce((t, x) => (x.title < t ? x.title : t), c[0].title), c: X.D.covers[k] || null,
    }))),
    "/api/health": ({ F, byKey }) => {
      const all = [...byKey.values()].map((c) => ({ system: c[0].system, drive: c.some((f) => f.device_id === "drive"), console: c.some((f) => f.device_id !== "drive") }));
      return {
        corrupted: F.filter((f) => f.status === "corrupted").sort(byTitle),
        noBackup: bySystem(all.filter((g) => !g.drive)), driveOnly: bySystem(all.filter((g) => !g.console)),
      };
    },
  };

  window.HH_API = async (path) => {
    const u = new URL(path, "https://hub.local");
    const route = routes[u.pathname];
    if (!route) throw new Error(`${u.pathname}: rota desconhecida`);
    return structuredClone(route(await load(), u.searchParams));
  };
})();
