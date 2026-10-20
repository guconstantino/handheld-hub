import { raRoute } from "./ra.js";

// Handheld Hub: serve os arquivos de public/ (binding ASSETS) e as capas do R2 (binding MEDIA),
// tudo atrás do Cloudflare Access. O catálogo vai como public/data/catalog.json e é filtrado no
// navegador (public/hh-api.js): o site não lê o D1 em produção.
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    // Endpoint exclusivo para o PortLauncher.apk do S20 FE (protegido por chave de 256 bits)
    if (url.hostname === "s20-telemetry.gustavoconstantino.com") {
      if (request.method === "POST" && url.pathname === "/api/telemetry") {
        return ingestTelemetry(request, env);
      }
      const cookie = request.headers.get("cookie") || "";
      const hdrKey = request.headers.get("x-telemetry-key") || "";
      const qKey = url.searchParams.get("s20_key") || "";
      const valid = env.TELEMETRY_KEY && (
        hdrKey === env.TELEMETRY_KEY ||
        qKey === env.TELEMETRY_KEY ||
        cookie.split(";").some((c) => c.trim() === `s20_key=${env.TELEMETRY_KEY}`)
      );
      if (!valid) {
        return new Response("Forbidden", { status: 403 });
      }
      if (qKey === env.TELEMETRY_KEY) {
        url.searchParams.delete("s20_key");
        return new Response(null, {
          status: 302,
          headers: {
            location: url.pathname + (url.search || "") + (url.hash || "#overview"),
            "set-cookie": `s20_key=${env.TELEMETRY_KEY}; Path=/; Max-Age=31536000; Secure; HttpOnly; SameSite=Lax`,
          },
        });
      }
      const h = new Headers(request.headers);
      h.set("cf-access-authenticated-user-email", "gustavohconstantino@outlook.com");
      request = new Request(request, { headers: h });
    }
    if (url.pathname.startsWith("/covers/") || url.pathname.startsWith("/themes/")) return cover(request, env, ctx, url);
    if (url.pathname === "/api/lists") return lists(request, env, url);
    if (url.pathname === "/api/prefs") return prefs(request, env, url);
    if (url.pathname.startsWith("/api/ra/")) return ra(request, env, ctx, url);
    if (url.pathname === "/api/me") return me(request, env, url);
    if (url.pathname.startsWith("/api/admin/")) return admin(request, env, url);
    if (url.pathname.startsWith("/api/live/")) return live(request, env, url);
    if (url.pathname === "/go/drive") return goDrive(request, env, url);
    return serveAsset(request, env, ctx, url);
  },
};

// "Abrir no Drive": o ID do arquivo fica em data/drive-ids.json (fora do catálogo do navegador). Redireciona.
let driveIds = null;
async function goDrive(request, env, url) {
  if (url.hostname === "handheldhub.gustavoconstantino.com") {
    return new Response(
      "Demonstração pública de portfólio. Downloads diretos e links para o Google Drive estão desabilitados nesta visualização.",
      { status: 403, headers: { "content-type": "text/plain; charset=utf-8" } }
    );
  }
  driveIds ||= await env.ASSETS.fetch(new Request(new URL("/data/drive-ids.json", request.url))).then((r) => (r.ok ? r.json() : {}));
  const p = url.searchParams;
  const v = driveIds[[p.get("l"), p.get("s"), p.get("t"), p.get("e") || ""].join("|")];
  if (!v) return new Response("Arquivo não encontrado no Drive (catálogo desatualizado?).", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  const id = encodeURIComponent(v.slice(2));
  return Response.redirect(v.startsWith("d:") ? `https://drive.google.com/drive/folders/${id}` : `https://drive.google.com/file/d/${id}/view`, 302);
}

async function ingestTelemetry(request, env) {
  const key = request.headers.get("x-telemetry-key") || "";
  if (!env.TELEMETRY_KEY || key !== env.TELEMETRY_KEY) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  body.receivedAt = new Date().toISOString();
  const raw = JSON.stringify(body);
  if (raw.length > 200000) {
    return Response.json({ error: "payload too large" }, { status: 413 });
  }
  await env.LISTS.put("live:telemetry", raw, { metadata: { at: body.receivedAt } });
  const prevStatus = (await env.LISTS.get("live:status", "json")) || {};
  prevStatus.telemetryAt = body.receivedAt;
  prevStatus.updatedAt = body.receivedAt;
  await env.LISTS.put("live:status", JSON.stringify(prevStatus));
  return Response.json({ ok: true, receivedAt: body.receivedAt });
}

// Dados ao vivo (Telemetria do S20 FE, Epic Games e Radar de Ports) gravados no KV,
// permitindo atualizar o portal em segundos sem precisar fazer redeploy de 19 mil assets do Worker.
async function live(request, env, url) {
  const headers = { "cache-control": "no-store" };
  if (url.pathname === "/api/live/status") {
    const [st, tel] = await Promise.all([
      env.LISTS.get("live:status", "json"),
      env.LISTS.getWithMetadata("live:telemetry", "text"),
    ]);
    const base = st || { epicHash: null, portsHash: null, telemetryAt: null, updatedAt: null };
    if (tel?.metadata?.at) base.telemetryAt = tel.metadata.at;
    return Response.json(base, { headers });
  }
  if (url.pathname === "/api/live/telemetry") {
    const data = (await env.LISTS.get("live:telemetry", "json")) || null;
    return Response.json(data || { empty: true }, { headers });
  }
  if (url.pathname === "/api/live/epic") {
    const data = await env.LISTS.get("live:epic", "json");
    if (data) return Response.json(data, { headers });
    return env.ASSETS.fetch(new Request(new URL("/data/epic-library.json", request.url)));
  }
  if (url.pathname === "/api/live/ports") {
    const data = await env.LISTS.get("live:ports", "json");
    if (data) return Response.json(data, { headers });
    return env.ASSETS.fetch(new Request(new URL("/data/ports-radar.json", request.url)));
  }
  return Response.json({ error: "não encontrado" }, { status: 404, headers });
}

// Capas: nome com hash, nunca mudam → cache longo no navegador e na borda (menos leituras no R2).
async function cover(request, env, ctx, url) {
  const cache = caches.default;
  const hit = await cache.match(request);
  if (hit) return hit;
  const key = decodeURIComponent(url.pathname.slice(1));          // "covers/<arquivo>.webp" ou "themes/<tema>/<sistema>.webp"
  if (!/^(covers\/[\w.-]+|themes\/[a-z0-9-]+\/[\w.-]+)\.webp$/.test(key)) return new Response("não encontrado", { status: 404 });
  const obj = await env.MEDIA.get(key);
  if (!obj) return serveAsset(request, env, ctx, url);             // sem a capa no R2 (rodar npm run r2): os assets respondem 404
  const res = new Response(obj.body, {
    headers: { "content-type": "image/webp", "cache-control": "public, max-age=31536000, s-maxage=31536000, immutable", etag: obj.httpEtag },
  });
  ctx.waitUntil(cache.put(request, res.clone()));
  return res;
}

// Assets estáticos com cache inteligente (evita acordar o Worker repetidamente e economiza cota diária)
async function serveAsset(request, env, ctx, url) {
  const cache = caches.default;
  if (request.method === "GET") {
    const hit = await cache.match(request);
    if (hit) return hit;
  }

  const res = await env.ASSETS.fetch(request);
  if (!res.ok || request.method !== "GET") return res;

  const path = url.pathname;
  let cc = "public, max-age=3600, s-maxage=86400"; // padrão: 1h browser, 24h borda da CDN

  if (path.startsWith("/fonts/") || path.endsWith(".woff2") || path.endsWith(".woff")) {
    cc = "public, max-age=31536000, s-maxage=31536000, immutable";
  } else if (path.startsWith("/flags/") || path.startsWith("/img/") || path.endsWith(".svg") || path.endsWith(".png") || path.endsWith(".webp") || path.endsWith(".ico")) {
    cc = "public, max-age=2592000, s-maxage=2592000, immutable";
  } else if (path.startsWith("/vendor/")) {
    cc = "public, max-age=604800, s-maxage=604800, immutable";
  } else if (path === "/data/catalog.json") {
    cc = "public, max-age=1800, s-maxage=3600";
  } else if (path.endsWith(".css") || path.endsWith(".js")) {
    cc = "public, max-age=3600, s-maxage=14400";
  } else if (path === "/" || path === "/index.html") {
    cc = "public, max-age=300, s-maxage=600";
  }

  const headers = new Headers(res.headers);
  headers.set("cache-control", cc);

  const cachedRes = new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });

  ctx.waitUntil(cache.put(request, cachedRes.clone()));
  return cachedRes;
}

// Favoritos e listas do usuário (KV). O e-mail vem do Cloudflare Access; sem ele, não há lista.
const LIST_NAMES = ["fav", "want", "done", "playing", "recent"];
async function lists(request, env, url) {
  const isPublic = url && url.hostname === "handheldhub.gustavoconstantino.com";
  const user = request.headers.get("cf-access-authenticated-user-email");
  if (!user) {
    if (isPublic) {
      if (request.method === "GET") return Response.json({ fav: [], want: [], done: [], playing: [], recent: [] }, { headers: { "cache-control": "no-store" } });
      return Response.json({ fav: [], want: [], done: [], playing: [], recent: [] }, { headers: { "cache-control": "no-store" } });
    }
    return Response.json({ error: "sem usuário do Access" }, { status: 401 });
  }
  const key = `lists:${user.toLowerCase()}`;
  const data = { fav: [], want: [], done: [], playing: [], recent: [], ...((await env.LISTS.get(key, "json")) || {}) };
  if (request.method === "GET") return Response.json(data, { headers: { "cache-control": "no-store" } });
  // POST = importar um backup inteiro (substitui as listas; só chaves de texto, limites de tamanho).
  if (request.method === "POST") {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return Response.json({ error: "backup inválido" }, { status: 400 });
    for (const l of LIST_NAMES) {
      const arr = Array.isArray(body[l]) ? body[l].filter((k) => typeof k === "string" && k.length <= 300) : [];
      data[l] = l === "recent" ? arr.slice(0, 30) : [...new Set(arr)].slice(-5000);
    }
    await env.LISTS.put(key, JSON.stringify(data), { metadata: { at: Date.now() } });
    return Response.json(data, { headers: { "cache-control": "no-store" } });
  }
  if (request.method !== "PUT") return Response.json({ error: "método" }, { status: 405 });
  const body = await request.json().catch(() => null);
  if (!body || !LIST_NAMES.includes(body.list) || typeof body.key !== "string" || body.key.length > 300)
    return Response.json({ error: "pedido inválido" }, { status: 400 });
  if (body.list === "recent") {
    // Vistos recentemente: o mais novo primeiro, sem repetir, até 30.
    if (data.recent[0] === body.key) return Response.json(data, { headers: { "cache-control": "no-store" } });  // nada mudou: poupa escrita
    data.recent = [body.key, ...data.recent.filter((k) => k !== body.key)].slice(0, 30);
  } else {
    const set = new Set(data[body.list] || []);
    if (body.on) set.add(body.key); else set.delete(body.key);
    data[body.list] = [...set].slice(-5000);
  }
  await env.LISTS.put(key, JSON.stringify(data), { metadata: { at: Date.now() } });
  return Response.json(data, { headers: { "cache-control": "no-store" } });
}

// Preferências do usuário (tema, ordenações, layout…): as mesmas em todos os aparelhos. KV por e-mail do Access.
// Só chaves "hh_…"/"hh-…" com texto curto; o objeto inteiro é substituído a cada gravação (o último aparelho vence).
async function prefs(request, env, url) {
  const isPublic = url && url.hostname === "handheldhub.gustavoconstantino.com";
  const user = request.headers.get("cf-access-authenticated-user-email");
  if (!user) {
    if (isPublic) {
      if (request.method === "GET") return Response.json({}, { headers: { "cache-control": "no-store" } });
      return Response.json({}, { headers: { "cache-control": "no-store" } });
    }
    return Response.json({ error: "sem usuário do Access" }, { status: 401 });
  }
  const key = `prefs:${user.toLowerCase()}`;
  const headers = { "cache-control": "no-store" };
  if (request.method === "GET") return Response.json((await env.LISTS.get(key, "json")) || {}, { headers });
  if (request.method !== "PUT") return Response.json({ error: "método" }, { status: 405 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ error: "pedido inválido" }, { status: 400 });
  const clean = Object.fromEntries(Object.entries(body)
    .filter(([k, v]) => /^hh[_-][\w-]{1,40}$/.test(k) && typeof v === "string" && v.length <= 4000).slice(0, 40));
  const before = await env.LISTS.get(key);
  if (before === JSON.stringify(clean)) return Response.json(clean, { headers });     // nada mudou: poupa escrita no KV
  await env.LISTS.put(key, JSON.stringify(clean), { metadata: { at: Date.now() } });
  return Response.json(clean, { headers });
}

// Quem está usando e com que papel. Admins: segredo ADMINS (e-mails separados por vírgula; fora do git).
// Quem entra é decidido pelo Cloudflare Access (policy "Só Gustavo"); aqui só se distingue admin de usuário.
const userOf = (request) => (request.headers.get("cf-access-authenticated-user-email") || "").toLowerCase();
const isAdmin = (env, email) => !!email && (env.ADMINS || "").toLowerCase().split(",").map((x) => x.trim()).includes(email);
function me(request, env, url) {
  const isPublic = url && url.hostname === "handheldhub.gustavoconstantino.com";
  const email = userOf(request);
  if (!email) {
    if (isPublic) {
      return Response.json({ email: "visitante@portfolio", role: "guest", demo: true }, { headers: { "cache-control": "no-store" } });
    }
    return Response.json({ error: "sem usuário do Access" }, { status: 401 });
  }
  return Response.json({ email, role: isAdmin(env, email) ? "admin" : "user", demo: isPublic }, { headers: { "cache-control": "no-store" } });
}

// Painel de admin: usuários que já usaram o portal (listas e preferências no KV) e quando foi a última atividade.
async function admin(request, env, url) {
  if (url.hostname === "handheldhub.gustavoconstantino.com") {
    return Response.json({ error: "não permitido no modo público" }, { status: 403 });
  }
  const email = userOf(request);
  if (!isAdmin(env, email)) return Response.json({ error: "só para admin" }, { status: 403 });
  if (url.pathname !== "/api/admin/overview") return Response.json({ error: "não encontrado" }, { status: 404 });
  const users = {};
  for (const prefix of ["lists:", "prefs:"]) {
    let cursor;
    do {
      const page = await env.LISTS.list({ prefix, cursor });
      for (const k of page.keys) {
        const who = k.name.slice(prefix.length);
        const u = (users[who] ||= { email: who, role: isAdmin(env, who) ? "admin" : "user", at: 0 });
        u.at = Math.max(u.at, k.metadata?.at || 0);
        if (prefix === "lists:") {
          const d = (await env.LISTS.get(k.name, "json")) || {};
          u.lists = Object.fromEntries(["playing", "fav", "want", "done", "recent"].map((l) => [l, (d[l] || []).length]));
        } else u.prefs = true;
      }
      cursor = page.list_complete ? null : page.cursor;
    } while (cursor);
  }
  return Response.json({ me: email, users: Object.values(users).sort((a, b) => b.at - a.at) }, { headers: { "cache-control": "no-store" } });
}

// RetroAchievements ao vivo, com cache de 10 minutos na borda (poupa a API deles e deixa rápido).
async function ra(request, env, ctx, url) {
  if (!env.RA_API_KEY) return Response.json({ error: "RetroAchievements não configurado" }, { status: 503 });
  // Cada usuário informa o próprio nome no RA (Configurações, ?u=). Sem nome: admin usa RA_USER; usuário comum não tem RA.
  const asked = url.searchParams.get("u");
  const raUser = asked && /^[A-Za-z0-9_]{2,20}$/.test(asked) ? asked : isAdmin(env, userOf(request)) ? env.RA_USER : null;
  if (!raUser) return Response.json({ error: "sem usuário do RetroAchievements" }, { status: 404 });
  url.searchParams.set("u", raUser);                 // a chave do cache separa um usuário do outro
  const cacheKey = new Request(`https://cache.handheld-hub${url.pathname}${url.search}`);
  const hit = await caches.default.match(cacheKey);
  if (hit) return hit;
  try {
    const data = await raRoute(url, { user: raUser, key: env.RA_API_KEY });
    const ttl = 600;
    const res = Response.json(data, { headers: { "cache-control": `private, max-age=${ttl}` } });
    ctx.waitUntil(caches.default.put(cacheKey, new Response(JSON.stringify(data), { headers: { "content-type": "application/json", "cache-control": `public, max-age=${ttl}` } })));
    return res;
  } catch (e) {
    return Response.json({ error: e.message }, { status: e.status || 502 });
  }
}
