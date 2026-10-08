import { raRoute } from "./ra.js";

// Handheld Hub: serve os arquivos de public/ (binding ASSETS) e as capas do R2 (binding MEDIA),
// tudo atrás do Cloudflare Access. O catálogo vai como public/data/catalog.json e é filtrado no
// navegador (public/hh-api.js): o site não lê o D1 em produção.
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/covers/") || url.pathname.startsWith("/themes/")) return cover(request, env, ctx, url);
    if (url.pathname === "/api/lists") return lists(request, env);
    if (url.pathname.startsWith("/api/ra/")) return ra(request, env, ctx, url);
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
    await env.LISTS.put(key, JSON.stringify(data));
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
  await env.LISTS.put(key, JSON.stringify(data));
  return Response.json(data, { headers: { "cache-control": "no-store" } });
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
