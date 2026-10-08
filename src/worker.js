import { raRoute } from "./ra.js";

// Handheld Hub: serve os arquivos de public/ (binding ASSETS) e as capas do R2 (binding MEDIA),
// tudo atrás do Cloudflare Access. O catálogo vai como public/data/catalog.json e é filtrado no
// navegador (public/hh-api.js): o site não lê o D1 em produção.
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/covers/") || url.pathname.startsWith("/themes/")) return cover(request, env, ctx, url);
    if (url.pathname === "/api/lists") return lists(request, env);
    if (url.pathname === "/api/prefs") return prefs(request, env);
    if (url.pathname.startsWith("/api/ra/")) return ra(request, env, ctx, url);
    if (url.pathname === "/api/me") return me(request, env);
    if (url.pathname.startsWith("/api/admin/")) return admin(request, env, url);
    return env.ASSETS.fetch(request);
  },
};

// Capas: nome com hash, nunca mudam → cache longo no navegador e na borda (menos leituras no R2).
async function cover(request, env, ctx, url) {
  const cache = caches.default;
  const hit = await cache.match(request);
  if (hit) return hit;
  const key = decodeURIComponent(url.pathname.slice(1));          // "covers/<arquivo>.webp" ou "themes/<tema>/<sistema>.webp"
  if (!/^(covers\/[\w.-]+|themes\/[a-z0-9-]+\/[\w.-]+)\.webp$/.test(key)) return new Response("não encontrado", { status: 404 });
  const obj = await env.MEDIA.get(key);
  if (!obj) return env.ASSETS.fetch(request);                       // sem a capa no R2 (rodar npm run r2): os assets respondem 404
  const res = new Response(obj.body, {
    headers: { "content-type": "image/webp", "cache-control": "public, max-age=31536000, immutable", etag: obj.httpEtag },
  });
  ctx.waitUntil(cache.put(request, res.clone()));
  return res;
}

// Favoritos e listas do usuário (KV). O e-mail vem do Cloudflare Access; sem ele, não há lista.
const LIST_NAMES = ["fav", "want", "done", "playing", "recent"];
async function lists(request, env) {
  const user = request.headers.get("cf-access-authenticated-user-email");
  if (!user) return Response.json({ error: "sem usuário do Access" }, { status: 401 });
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
async function prefs(request, env) {
  const user = request.headers.get("cf-access-authenticated-user-email");
  if (!user) return Response.json({ error: "sem usuário do Access" }, { status: 401 });
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
function me(request, env) {
  const email = userOf(request);
  if (!email) return Response.json({ error: "sem usuário do Access" }, { status: 401 });
  return Response.json({ email, role: isAdmin(env, email) ? "admin" : "user" }, { headers: { "cache-control": "no-store" } });
}

// Painel de admin: usuários que já usaram o portal (listas e preferências no KV) e quando foi a última atividade.
async function admin(request, env, url) {
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
  const cacheKey = new Request(`https://cache.handheld-hub${url.pathname}${url.search}`);
  const hit = await caches.default.match(cacheKey);
  if (hit) return hit;
  try {
    const data = await raRoute(url, { user: env.RA_USER, key: env.RA_API_KEY });
    const ttl = 600;
    const res = Response.json(data, { headers: { "cache-control": `private, max-age=${ttl}` } });
    ctx.waitUntil(caches.default.put(cacheKey, new Response(JSON.stringify(data), { headers: { "content-type": "application/json", "cache-control": `public, max-age=${ttl}` } })));
    return res;
  } catch (e) {
    return Response.json({ error: e.message }, { status: e.status || 502 });
  }
}
