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
    "/api/summary": ({ D, F, byKey }) => ({
      devices: D.devices, locations: D.locations,
      totals: { games: byKey.size, files: F.length, corrupted: F.filter((f) => f.status === "corrupted").length,
                systems: new Set(F.map((f) => f.system)).size },
    }),
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
