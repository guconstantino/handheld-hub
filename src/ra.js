// RetroAchievements: consultas à Web API oficial (https://api-docs.retroachievements.org).
// Usado pelo Worker (chave em segredo do Cloudflare) e pelo scripts/serve.mjs (chave do .env, teste local).
// A chave nunca vai para o navegador: o site só recebe o resultado já filtrado.

const BASE = "https://retroachievements.org/API/";
const MEDIA = "https://media.retroachievements.org";

async function call(endpoint, params, key) {
  const q = new URLSearchParams({ ...params, y: key });
  const r = await fetch(`${BASE}${endpoint}.php?${q}`, { headers: { "user-agent": "HandheldHub/1.0 (uso pessoal)" } });
  if (!r.ok) throw new Error(`RetroAchievements ${endpoint}: ${r.status}`);
  return r.json();
}

// Resumo do usuário: perfil, jogando agora, jogados recentemente (com progresso) e progresso em todos os jogos.
export async function summary({ user, key }) {
  // Últimas conquistas: o RecentAchievements do resumo só cobre os jogos dos últimos dias; o
  // "earned between" (últimos 10 anos) traz o histórico completo com data e selo.
  const now = Math.floor(Date.now() / 1000);
  const [sum, prog, earned] = await Promise.all([
    call("API_GetUserSummary", { u: user, g: 30, a: 10 }, key),
    call("API_GetUserCompletionProgress", { u: user, c: 500 }, key),
    call("API_GetAchievementsEarnedBetween", { u: user, f: now - 10 * 365 * 86400, t: now }, key).catch(() => []),
  ]);
  // Jogados recentemente trazem a contagem em sum.Awarded[GameID]; o progresso geral traz no próprio item.
  const game = (g) => {
    const aw = sum.Awarded?.[g.GameID] || {};
    return {
      id: Number(g.GameID), title: g.Title, console: g.ConsoleName, icon: g.ImageIcon ? MEDIA + g.ImageIcon : null,
      boxart: g.ImageBoxArt ? MEDIA + g.ImageBoxArt : null,
      earned: Number(g.NumAchieved ?? g.NumAwarded ?? aw.NumAchieved ?? 0),
      total: Number(g.NumPossibleAchievements ?? g.MaxPossible ?? aw.NumPossibleAchievements ?? g.AchievementsTotal ?? 0),
      earnedHardcore: Number(g.NumAchievedHardcore ?? g.NumAwardedHardcore ?? aw.NumAchievedHardcore ?? 0),
      last: g.LastPlayed || g.MostRecentAwardedDate || null, award: g.HighestAwardKind || null,
    };
  };
  return {
    user: sum.User, avatar: sum.UserPic ? MEDIA + sum.UserPic : null, memberSince: sum.MemberSince,
    points: Number(sum.TotalPoints || 0), truePoints: Number(sum.TotalTruePoints || 0), softcorePoints: Number(sum.TotalSoftcorePoints || 0),
    rank: sum.Rank ? Number(sum.Rank) : null, totalRanked: sum.TotalRanked ? Number(sum.TotalRanked) : null,
    status: sum.Status || null, richPresence: sum.RichPresenceMsg || null, lastGameId: sum.LastGameID ? Number(sum.LastGameID) : null,
    recent: (sum.RecentlyPlayed || []).map(game),
    achievementsTotal: Array.isArray(earned) ? earned.length : 0,
    recentAchievements: (Array.isArray(earned) ? earned : []).map((a) => ({
      id: Number(a.AchievementID), title: a.Title, description: a.Description, points: Number(a.Points || 0), game: a.GameTitle,
      gameId: Number(a.GameID), console: a.ConsoleName, icon: a.GameIcon ? MEDIA + a.GameIcon : null,
      badge: a.BadgeURL ? MEDIA + a.BadgeURL : null, date: a.Date, hardcore: !!Number(a.HardcoreMode || 0),
    })).sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 12),
    progress: (prog.Results || []).map(game),
  };
}

// Um jogo: conquistas com o que o usuário já desbloqueou.
export async function game({ user, key }, id) {
  const g = await call("API_GetGameInfoAndUserProgress", { u: user, g: id }, key);
  const list = Object.values(g.Achievements || {}).sort((a, b) => (a.DisplayOrder ?? 0) - (b.DisplayOrder ?? 0)).map((a) => ({
    id: Number(a.ID), title: a.Title, description: a.Description, points: Number(a.Points || 0), type: a.type || null,
    badge: a.BadgeName ? `${MEDIA}/Badge/${a.BadgeName}.png` : null, earned: a.DateEarned || null, earnedHardcore: a.DateEarnedHardcore || null,
    unlockedBy: Number(a.NumAwarded || 0),
  }));
  return {
    id: Number(g.ID), title: g.Title, console: g.ConsoleName, icon: g.ImageIcon ? MEDIA + g.ImageIcon : null,
    players: Number(g.NumDistinctPlayers || 0), earned: list.filter((a) => a.earned).length, total: list.length,
    points: list.reduce((n, a) => n + a.points, 0), userPoints: list.filter((a) => a.earned).reduce((n, a) => n + a.points, 0),
    achievements: list,
  };
}

// Roteia /api/ra/summary e /api/ra/game?id=N. (A lista de jogos com conquistas é estática: scripts/ra_catalog.py.)
export async function raRoute(url, cfg) {
  if (url.pathname === "/api/ra/summary") return summary(cfg);
  if (url.pathname === "/api/ra/game") {
    const id = Number(url.searchParams.get("id"));
    if (!Number.isInteger(id) || id <= 0) throw Object.assign(new Error("id inválido"), { status: 400 });
    return game(cfg, id);
  }
  throw Object.assign(new Error("não encontrado"), { status: 404 });
}
