export type HoleScores = (number | null)[];

/** Per-player 18-hole scores. User is marked with isMe (or first entry). */
export type PlayerScores = {
  name: string;
  scores: HoleScores;
  isMe?: boolean;
};

export interface GolfRound {
  id?: number;
  courseName: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  frontCourse: string;
  backCourse: string;
  /** @deprecated Prefer players[]. Kept for legacy IndexedDB rows. */
  companions?: string;
  /** User (isMe) hole scores — always kept in sync with players. */
  scores: HoleScores;
  /** All players including the user. */
  players: PlayerScores[];
  total: number;
  outTotal: number;
  inTotal: number;
  isSample?: boolean;
  createdAt: number;
  updatedAt: number;
  ocrRaw?: string;
}

export type RoundInput = Omit<
  GolfRound,
  "id" | "total" | "outTotal" | "inTotal" | "createdAt" | "updatedAt"
> & {
  id?: number;
  isSample?: boolean;
  ocrRaw?: string;
  /** Allow legacy companion string on input; normalized on save. */
  companions?: string;
};

export function emptyScores(): HoleScores {
  return Array.from({ length: 18 }, () => null);
}

export function padScores(scores: HoleScores | undefined | null): HoleScores {
  const next = [...(scores ?? [])];
  while (next.length < 18) next.push(null);
  return next.slice(0, 18);
}

export function calcTotals(scores: HoleScores) {
  const out = scores.slice(0, 9).reduce<number>((s, v) => s + (v ?? 0), 0);
  const inn = scores.slice(9, 18).reduce<number>((s, v) => s + (v ?? 0), 0);
  return { outTotal: out, inTotal: inn, total: out + inn };
}

export function formatScore(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "–";
  return String(n);
}

export function mePlayer(players: PlayerScores[] | undefined): PlayerScores {
  if (!players?.length) {
    return { name: "나", scores: emptyScores(), isMe: true };
  }
  return players.find((p) => p.isMe) ?? players[0];
}

export function companionPlayers(players: PlayerScores[] | undefined): PlayerScores[] {
  if (!players?.length) return [];
  const me = mePlayer(players);
  return players.filter((p) => p !== me && !p.isMe);
}

/** Build companions display string from players (excluding me). */
export function companionsLabel(players: PlayerScores[] | undefined): string {
  return companionPlayers(players)
    .map((p) => p.name.trim())
    .filter(Boolean)
    .join(", ");
}

/**
 * Normalize any legacy or partial round shape into a consistent GolfRound-like
 * object with players[] and synced user scores.
 */
export function normalizePlayers(
  input: {
    scores?: HoleScores;
    players?: PlayerScores[];
    companions?: string;
  },
  defaultMeName = "나"
): { scores: HoleScores; players: PlayerScores[]; companions: string } {
  const legacyCompanions = (input.companions ?? "").trim();

  if (input.players && input.players.length > 0) {
    const players = input.players.map((p, i) => ({
      name: (p.name || (p.isMe || i === 0 ? defaultMeName : `동반자${i}`)).trim() || defaultMeName,
      scores: padScores(p.scores),
      isMe: !!p.isMe || (i === 0 && !input.players!.some((x) => x.isMe)),
    }));
    // Ensure exactly one isMe
    const meIdx = players.findIndex((p) => p.isMe);
    players.forEach((p, i) => {
      p.isMe = i === (meIdx >= 0 ? meIdx : 0);
    });
    const me = players.find((p) => p.isMe)!;
    // Prefer explicit scores if provided and me scores empty
    const meScores =
      me.scores.some((s) => s != null)
        ? me.scores
        : padScores(input.scores);
    me.scores = meScores;
    return {
      scores: meScores,
      players,
      companions: companionsLabel(players) || legacyCompanions,
    };
  }

  // Legacy: companions string + user scores only
  const scores = padScores(input.scores);
  const players: PlayerScores[] = [
    { name: defaultMeName, scores, isMe: true },
  ];
  if (legacyCompanions) {
    const names = legacyCompanions
      .split(/[,，、\/|]+/)
      .map((n) => n.trim())
      .filter(Boolean);
    for (const name of names) {
      players.push({ name, scores: emptyScores(), isMe: false });
    }
  }
  return {
    scores,
    players,
    companions: companionsLabel(players) || legacyCompanions,
  };
}
