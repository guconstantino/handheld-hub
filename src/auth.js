// Login próprio do portal: usuário + senha ou PIN de 6 dígitos. Contas no KV LISTS:
//   user:<login>  → { login, id, name, role, pass?, pin? }   id = chave das listas/preferências (o Gustavo usa o e-mail)
//   email:<email> → login (conta do portal ligada a um e-mail do Access)
//   fail:<login>  → tentativas erradas (5 → bloqueia 15 min)
// Sessão: cookie assinado (HMAC-SHA256 com o segredo SESSION_SECRET), 30 dias. Validar não lê o KV — no modo "app"
// o Worker confere a sessão em todo arquivo (capas, temas), e ler o KV a cada um estouraria a cota grátis.
// Hash: PBKDF2-SHA256 com sal. 10 mil iterações por causa do limite de CPU do plano grátis (~10 ms por acesso);
// a proteção principal contra adivinhar o PIN é o bloqueio por tentativas.
const ITER = 10000;
const SESSION_DAYS = 30;
const MAX_FAILS = 5;
const LOCK_SECONDS = 15 * 60;
const enc = new TextEncoder();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function hashSecret(secret, salt = crypto.getRandomValues(new Uint8Array(16)), iter = ITER) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: iter }, key, 256);
  return { salt: b64(salt), hash: b64(bits), iter };
}
async function verify(secret, rec) {
  if (!rec) return false;
  const h = await hashSecret(secret, unb64(rec.salt), rec.iter);
  // comparação em tempo constante
  const a = unb64(h.hash), b = unb64(rec.hash);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.min(a.length, b.length); i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export const validLogin = (s) => typeof s === "string" && /^[a-z0-9._-]{3,32}$/.test(s);
export const validPin = (s) => typeof s === "string" && /^\d{6}$/.test(s);
export const validPassword = (s) => typeof s === "string" && s.length >= 8 && s.length <= 200;

const cookieOf = (request, name) => (request.headers.get("cookie") || "").split(/;\s*/).find((c) => c.startsWith(name + "="))?.slice(name.length + 1);
export const SESSION_COOKIE = "hh_sess";
const b64url = (buf) => b64(buf).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64url = (s) => unb64(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
async function hmac(env, data) {
  if (!env.SESSION_SECRET) throw new Error("SESSION_SECRET não configurado");
  const key = await crypto.subtle.importKey("raw", enc.encode(env.SESSION_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}
// Token: <payload base64url>.<assinatura>; payload { l: login, i: id, n: nome, r: papel, e: expira (ms) }.
async function sessionOf(request, env) {
  const t = cookieOf(request, SESSION_COOKIE);
  if (!t || !env.SESSION_SECRET || t.length > 600) return null;
  const [payload, sig] = t.split(".");
  if (!payload || !sig || (await hmac(env, payload)) !== sig) return null;
  try {
    const p = JSON.parse(new TextDecoder().decode(unb64url(payload)));
    return p.e > Date.now() ? p : null;
  } catch { return null; }
}

// Quem está fazendo o pedido: sessão do portal; senão, e-mail do Cloudflare Access (modo "access").
// strict: confere a conta no KV (removida/rebaixada perde o acesso na hora) — usado em /api/me e no admin.
export async function identify(request, env, { strict = false } = {}) {
  const s = await sessionOf(request, env);
  if (s) {
    if (!strict) return { id: s.i, login: s.l, name: s.n, role: s.r, via: "session" };
    const u = await env.LISTS.get(`user:${s.l}`, "json");
    if (u) return { id: u.id, login: u.login, name: u.name || u.login, role: u.role, via: "session", hasPin: !!u.pin };
    return null;
  }
  const email = (request.headers.get("cf-access-authenticated-user-email") || "").toLowerCase();
  if (email) {
    const admins = (env.ADMINS || "").toLowerCase().split(",").map((x) => x.trim());
    const role = admins.includes(email) ? "admin" : "user";
    if (!strict) return { id: email, login: null, name: email, role, via: "access" };
    const link = await env.LISTS.get(`email:${email}`);
    const u = link ? await env.LISTS.get(`user:${link}`, "json") : null;
    return { id: email, login: u?.login || null, name: u?.name || email, role, via: "access", hasPin: !!u?.pin, hasPassword: !!u?.pass };
  }
  return null;
}

async function newSession(env, u) {
  const exp = Date.now() + SESSION_DAYS * 864e5;
  const payload = b64url(enc.encode(JSON.stringify({ l: u.login, i: u.id, n: u.name || u.login, r: u.role, e: exp })));
  return `${SESSION_COOKIE}=${payload}.${await hmac(env, payload)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`;
}
const json = (data, status = 200, headers = {}) => Response.json(data, { status, headers: { "cache-control": "no-store", ...headers } });

// POST /api/auth/login { login, password } ou { login, pin } · POST /api/auth/logout
// POST /api/auth/pin { pin } (define o próprio PIN; no modo Access cria a conta ligada ao e-mail na primeira vez)
// POST /api/auth/password { password } (troca a própria senha)
export async function authRoute(request, env, url) {
  if (request.method !== "POST") return json({ error: "método" }, 405);
  const body = await request.json().catch(() => ({}));
  if (url.pathname === "/api/auth/logout") {
    return json({ ok: true }, 200, { "set-cookie": `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0` });
  }
  if (url.pathname === "/api/auth/login") {
    const login = String(body.login || "").trim().toLowerCase();
    if (!validLogin(login)) return json({ error: "Usuário ou senha incorretos." }, 401);
    const fails = Number((await env.LISTS.get(`fail:${login}`)) || 0);
    if (fails >= MAX_FAILS) return json({ error: "Muitas tentativas erradas. Tente de novo em 15 minutos." }, 429);
    const u = await env.LISTS.get(`user:${login}`, "json");
    const ok = u && (body.pin != null ? validPin(String(body.pin)) && (await verify(String(body.pin), u.pin))
      : validPassword(String(body.password || "")) && (await verify(String(body.password), u.pass)));
    if (!ok) {
      await env.LISTS.put(`fail:${login}`, String(fails + 1), { expirationTtl: LOCK_SECONDS });
      const left = MAX_FAILS - fails - 1;
      return json({ error: left > 0 ? `${body.pin != null ? "PIN" : "Usuário ou senha"} incorreto. ${left} tentativa${left === 1 ? "" : "s"} antes de bloquear.` : "Muitas tentativas erradas. Tente de novo em 15 minutos." }, 401);
    }
    if (fails) await env.LISTS.delete(`fail:${login}`);
    return json({ ok: true, login: u.login, name: u.name || u.login }, 200, { "set-cookie": await newSession(env, u) });
  }
  const me = await identify(request, env, { strict: true });
  if (!me) return json({ error: "entre primeiro" }, 401);
  if (url.pathname === "/api/auth/pin" || url.pathname === "/api/auth/password") {
    const isPin = url.pathname.endsWith("/pin");
    const v = String(isPin ? body.pin : body.password || "");
    if (isPin ? !validPin(v) : !validPassword(v)) return json({ error: isPin ? "O PIN tem 6 números." : "A senha precisa de pelo menos 8 caracteres." }, 400);
    let login = me.login;
    if (!login) {
      // Primeira vez pelo Access: cria a conta do portal ligada ao e-mail (o id continua sendo o e-mail).
      login = (body.login ? String(body.login).trim().toLowerCase() : me.id.split("@")[0].replace(/[^a-z0-9._-]/g, "")).slice(0, 32);
      if (!validLogin(login)) return json({ error: "Nome de usuário inválido (3 a 32: letras, números, ponto, hífen)." }, 400);
      const taken = await env.LISTS.get(`user:${login}`, "json");
      if (taken && taken.id !== me.id) return json({ error: "Esse nome de usuário já existe." }, 409);
      await env.LISTS.put(`email:${me.id}`, login);
    }
    const u = (await env.LISTS.get(`user:${login}`, "json")) || { login, id: me.id, name: me.name, role: me.role, created: Date.now() };
    u[isPin ? "pin" : "pass"] = await hashSecret(v);
    await env.LISTS.put(`user:${login}`, JSON.stringify(u));
    return json({ ok: true, login });
  }
  return json({ error: "não encontrado" }, 404);
}

// Admin: GET /api/admin/users · POST { login, name, password, role } cria/atualiza · DELETE ?login= remove
// (a sessão de quem foi removido deixa de valer nas rotas que conferem a conta; as demais expiram em até 30 dias).
export async function usersRoute(request, env, url) {
  if (request.method === "GET") {
    const out = [];
    let cursor;
    do {
      const page = await env.LISTS.list({ prefix: "user:", cursor });
      for (const k of page.keys) {
        const u = await env.LISTS.get(k.name, "json");
        if (u) out.push({ login: u.login, id: u.id, name: u.name, role: u.role, hasPin: !!u.pin, hasPassword: !!u.pass, created: u.created || null });
      }
      cursor = page.list_complete ? null : page.cursor;
    } while (cursor);
    return json({ users: out });
  }
  if (request.method === "POST") {
    const b = await request.json().catch(() => ({}));
    const login = String(b.login || "").trim().toLowerCase();
    if (!validLogin(login)) return json({ error: "Usuário: 3 a 32 caracteres (letras minúsculas, números, ponto, hífen)." }, 400);
    if (b.password && !validPassword(String(b.password))) return json({ error: "A senha precisa de pelo menos 8 caracteres." }, 400);
    const u = (await env.LISTS.get(`user:${login}`, "json")) || { login, id: login, created: Date.now() };
    if (!u.pass && !b.password) return json({ error: "Conta nova precisa de senha." }, 400);
    u.name = String(b.name || u.name || login).slice(0, 60);
    u.role = b.role === "admin" ? "admin" : "user";
    if (b.password) u.pass = await hashSecret(String(b.password));
    await env.LISTS.put(`user:${login}`, JSON.stringify(u));
    await env.LISTS.delete(`fail:${login}`);
    return json({ ok: true, login });
  }
  if (request.method === "DELETE") {
    const login = String(url.searchParams.get("login") || "").toLowerCase();
    if (!validLogin(login)) return json({ error: "usuário inválido" }, 400);
    await env.LISTS.delete(`user:${login}`);
    return json({ ok: true });
  }
  return json({ error: "método" }, 405);
}
