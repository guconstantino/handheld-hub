// Handheld Hub: serve os arquivos de public/ (binding ASSETS) e as capas do R2 (binding MEDIA),
// tudo atrás do Cloudflare Access. O catálogo vai como public/data/catalog.json e é filtrado no
// navegador (public/hh-api.js): o site não lê o D1 em produção.
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/covers/")) return cover(request, env, ctx, url);
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
