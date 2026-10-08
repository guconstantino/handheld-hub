// Handheld Hub: serve os arquivos de public/ (binding ASSETS) e as capas do R2 (binding MEDIA),
// tudo atrás do Cloudflare Access. O catálogo vai como public/data/catalog.json e é filtrado no
// navegador (public/hh-api.js): o site não lê o D1 em produção.
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/covers/")) return cover(request, env, ctx, url);
    if (url.pathname === "/api/lists") return lists(request, env);
    return env.ASSETS.fetch(request);
  },
};

// Capas: nome com hash, nunca mudam → cache longo no navegador e na borda (menos leituras no R2).
async function cover(request, env, ctx, url) {
  const cache = caches.default;
  const hit = await cache.match(request);
  if (hit) return hit;
  const key = decodeURIComponent(url.pathname.slice(1));          // "covers/<arquivo>.webp"
  if (!/^covers\/[\w.-]+\.webp$/.test(key)) return new Response("não encontrado", { status: 404 });
  const obj = await env.MEDIA.get(key);
  if (!obj) return env.ASSETS.fetch(request);                       // ainda não subiu ao R2: usa a cópia dos assets
  const res = new Response(obj.body, {
    headers: { "content-type": "image/webp", "cache-control": "public, max-age=31536000, immutable", etag: obj.httpEtag },
  });
  ctx.waitUntil(cache.put(request, res.clone()));
  return res;
}

// Favoritos e listas do usuário (KV). O e-mail vem do Cloudflare Access; sem ele, não há lista.
const LIST_NAMES = ["fav", "want", "done", "recent"];
async function lists(request, env) {
  const user = request.headers.get("cf-access-authenticated-user-email");
  if (!user) return Response.json({ error: "sem usuário do Access" }, { status: 401 });
  const key = `lists:${user.toLowerCase()}`;
  const data = { fav: [], want: [], done: [], recent: [], ...((await env.LISTS.get(key, "json")) || {}) };
  if (request.method === "GET") return Response.json(data, { headers: { "cache-control": "no-store" } });
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
