// Servidor estático local de public/ (o site não precisa mais do Worker para rodar).
// Útil quando o `wrangler dev` cai vigiando milhares de capas em public/covers/.
//   node scripts/serve.mjs [porta]   → http://127.0.0.1:8788
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, existsSync } from "node:fs";
import { raRoute } from "../src/ra.js";

const ROOT = fileURLToPath(new URL("../public/", import.meta.url));
const PORT = Number(process.argv[2]) || 8788;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg" };

const ENV_FILE = fileURLToPath(new URL("../.env", import.meta.url));
const env = existsSync(ENV_FILE) ? Object.fromEntries(readFileSync(ENV_FILE, "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()])) : {};

createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  // Teste local: sem Access, quem abre é tratado como admin; o painel mostra usuários vazios (o KV só existe no Worker).
  if (u.pathname === "/go/drive") {                       // mesmo redirecionamento do Worker, para testar local
    const ids = JSON.parse(readFileSync(join(ROOT, "data", "drive-ids.json"), "utf8"));
    const v = ids[[u.searchParams.get("l"), u.searchParams.get("s"), u.searchParams.get("t"), u.searchParams.get("e") || ""].join("|")];
    if (!v) return res.writeHead(404).end("não encontrado");
    return res.writeHead(302, { location: v.startsWith("d:") ? `https://drive.google.com/drive/folders/${v.slice(2)}` : `https://drive.google.com/file/d/${v.slice(2)}/view` }).end();
  }
  if (u.pathname === "/api/me") return res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ email: "local@teste", role: "admin" }));
  if (u.pathname === "/api/admin/overview") return res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ me: "local@teste", users: [] }));
  if (u.pathname.startsWith("/api/ra/") && env.RA_API_KEY) {
    try {
      const asked = u.searchParams.get("u");
      const data = await raRoute(u, { user: asked && /^[A-Za-z0-9_]{2,20}$/.test(asked) ? asked : env.RA_USER, key: env.RA_API_KEY });
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(data));
    } catch (e) { res.writeHead(e.status || 502, { "content-type": "application/json" }).end(JSON.stringify({ error: e.message })); }
    return;
  }
  let path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
  if (path.endsWith("/")) path += "index.html";
  const file = join(ROOT, path);
  try {
    if (!file.startsWith(ROOT) || !(await stat(file)).isFile()) throw new Error();
    res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream", "cache-control": "no-store" });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end("não encontrado");
  }
}).listen(PORT, "127.0.0.1", () => console.log(`http://127.0.0.1:${PORT}`));
