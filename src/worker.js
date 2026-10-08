// Handheld Hub: API de leitura do catálogo (D1). Os arquivos de public/ são servidos pelo binding ASSETS.
// A escrita acontece só pelo scanner (wrangler d1 execute); não há endpoint de escrita.

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const routes = {
  // Devices, locais e totais por local.
  async "/api/summary"(db) {
    const devices = (await db.prepare("SELECT * FROM devices ORDER BY kind DESC, name").all()).results;
    const locations = (await db.prepare(
      `SELECT l.*, COUNT(f.id) AS files, COALESCE(SUM(f.size),0) AS bytes,
              SUM(f.status='corrupted') AS corrupted, COUNT(DISTINCT f.system) AS systems
         FROM locations l LEFT JOIN files f ON f.location_id = l.id
        GROUP BY l.id ORDER BY l.device_id, l.id`).all()).results;
    const totals = await db.prepare(
      `SELECT COUNT(DISTINCT game_key) AS games, COUNT(*) AS files,
              SUM(status='corrupted') AS corrupted, COUNT(DISTINCT system) AS systems FROM files`).first();
    return { devices: devices.map((d) => ({ ...d, specs: JSON.parse(d.specs || "{}") })), locations, totals };
  },

  // Sistemas com contagem por device.
  async "/api/systems"(db) {
    return (await db.prepare(
      `SELECT f.system, l.device_id, COUNT(DISTINCT f.game_key) AS games, SUM(f.status='corrupted') AS corrupted
         FROM files f JOIN locations l ON l.id = f.location_id
        GROUP BY f.system, l.device_id ORDER BY f.system`).all()).results;
  },

  // Busca de jogos agrupados por game_key, com as cópias (onde cada um está).
  async "/api/games"(db, p) {
    const where = [], args = [];
    if (p.get("q")) { where.push("(f.title LIKE ? OR f.game_key LIKE ?)"); args.push(`%${p.get("q")}%`, `%${p.get("q").toLowerCase()}%`); }
    if (p.get("system")) { where.push("f.system = ?"); args.push(p.get("system")); }
    if (p.get("device")) { where.push("l.device_id = ?"); args.push(p.get("device")); }
    if (p.get("status")) { where.push("f.status = ?"); args.push(p.get("status")); }
    const limit = Math.min(Number(p.get("limit")) || 100, 500);
    const offset = Number(p.get("offset")) || 0;
    const cond = where.length ? "WHERE " + where.join(" AND ") : "";
    const keys = (await db.prepare(
      `SELECT f.game_key, MIN(f.title) AS title, f.system, COUNT(*) AS copies
         FROM files f JOIN locations l ON l.id = f.location_id ${cond}
        GROUP BY f.game_key ORDER BY f.system, title LIMIT ? OFFSET ?`).bind(...args, limit, offset).all()).results;
    const total = (await db.prepare(
      `SELECT COUNT(DISTINCT f.game_key) AS n FROM files f JOIN locations l ON l.id = f.location_id ${cond}`)
      .bind(...args).first()).n;
    if (!keys.length) return { total, games: [] };
    const copies = (await db.prepare(
      `SELECT f.game_key, f.location_id, l.device_id, f.rel_path, f.size, f.status
         FROM files f JOIN locations l ON l.id = f.location_id
        WHERE f.game_key IN (${keys.map(() => "?").join(",")})`).bind(...keys.map((k) => k.game_key)).all()).results;
    const byKey = {};
    for (const c of copies) (byKey[c.game_key] ||= []).push(c);
    return { total, games: keys.map((k) => ({ ...k, copies: byKey[k.game_key] || [] })) };
  },

  // Saúde da coleção: corrompidos e o que só existe num lugar.
  async "/api/health"(db) {
    const corrupted = (await db.prepare(
      `SELECT f.system, f.title, f.rel_path, f.location_id, l.device_id FROM files f
         JOIN locations l ON l.id = f.location_id WHERE f.status='corrupted' ORDER BY f.system, f.title`).all()).results;
    const presence = `SELECT f.game_key, MIN(f.title) AS title, f.system,
              MAX(l.device_id='drive') AS in_drive, MAX(l.device_id<>'drive') AS in_console
         FROM files f JOIN locations l ON l.id = f.location_id GROUP BY f.game_key`;
    const noBackup = (await db.prepare(
      `SELECT system, COUNT(*) AS n FROM (${presence}) WHERE in_drive=0 GROUP BY system ORDER BY n DESC`).all()).results;
    const driveOnly = (await db.prepare(
      `SELECT system, COUNT(*) AS n FROM (${presence}) WHERE in_console=0 GROUP BY system ORDER BY n DESC`).all()).results;
    return { corrupted, noBackup, driveOnly };
  },
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const route = routes[url.pathname];
    if (route) {
      if (request.method !== "GET") return json({ error: "method not allowed" }, 405);
      try {
        return json(await route(env.DB, url.searchParams));
      } catch (err) {
        return json({ error: String(err.message || err) }, 500);
      }
    }
    if (url.pathname.startsWith("/api/")) return json({ error: "not found" }, 404);
    return env.ASSETS.fetch(request);
  },
};
