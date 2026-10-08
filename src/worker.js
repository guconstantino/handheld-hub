// Handheld Hub: só serve os arquivos de public/ (binding ASSETS), atrás do Cloudflare Access.
// O catálogo vai como public/data/catalog.json e é filtrado no navegador (public/hh-api.js):
// o site não lê o D1 em produção. O D1 local é só a origem dos dados (scanner → scripts/catalog.py).
export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
};
