export type HoleScores = (number | null)[];

/** Per-hole par values (3/4/5 typically). null = unknown. */
export type HolePars = (number | null)[];

/** Per-player 18-hole scores. Kept for IndexedDB compatibility; hydrate keeps a single me-player. */
export type PlayerScores = {
  name: string;
  scores: HoleScores;
  isMe?: boolean;
};

/**
 * Tee box color (Smart Score style).
 * Default: `"blue"` — most common men's regular tee in Korea.
 * Legacy IndexedDB rows without teeColor are hydrated to `"blue"`.
 */
export type TeeColor = "white" | "blue" | "red";

export const TEE_COLORS: readonly TeeColor[] = ["white", "blue", "red"] as const;

export const DEFAULT_TEE_COLOR: TeeColor = "blue";

export const TEE_COLOR_LABEL: Record<TeeColor, string> = {
  white: "화이트",
  blue: "블루",
  red: "레드",
};

export function isTeeColor(v: unknown): v is TeeColor {
  return v === "white" || v === "blue" || v === "red";
}

/** Coerce any value to a valid TeeColor; unknown/missing → default blue. */
export function normalizeTeeColor(v: unknown): TeeColor {
  return isTeeColor(v) ? v : DEFAULT_TEE_COLOR;
}

export interface GolfRound {
  id?: number;
  courseName: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  frontCourse: string;
  backCourse: string;
  /** Tee box: white / blue / red. Defaults to blue for legacy rows. */
  teeColor: TeeColor;
  /** Optional companion names only (comma-separated). No per-companion scores. */
  companions?: string;
  /** My hole scores. */
  scores: HoleScores;
  /** Per-hole par (optional; SmartScore OCR / manual). */
  pars?: HolePars;
  /** Compatibility: always a single me-player after hydrate/save. */
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
  companions?: string;
  /** Optional on input; saveRound / hydrate fall back to DEFAULT_TEE_COLOR. */
  teeColor?: TeeColor;
  /** Optional per-hole par; hydrate defaults to emptyPars. */
  pars?: HolePars;
};

export function emptyScores(): HoleScores {
  return Array.from({ length: 18 }, () => null);
}

export function padScores(scores: HoleScores | undefined | null): HoleScores {
  const next = [...(scores ?? [])];
  while (next.length < 18) next.push(null);
  return next.slice(0, 18);
}

export function emptyPars(): HolePars {
  return Array.from({ length: 18 }, () => null);
}

export function padPars(pars: HolePars | undefined | null): HolePars {
  const next = [...(pars ?? [])];
  while (next.length < 18) next.push(null);
  return next.slice(0, 18).map((p) => {
    if (p == null || Number.isNaN(p)) return null;
    const n = Math.round(Number(p));
    if (!Number.isFinite(n) || n < 3 || n > 6) return null;
    return n;
  });
}

/** Absolute strokes − par → relative (0=par, −1=birdie, +1=bogey). */
export function relativeToPar(
  stroke: number | null | undefined,
  par: number | null | undefined
): number | null {
  if (stroke == null || par == null) return null;
  if (!Number.isFinite(stroke) || !Number.isFinite(par)) return null;
  return stroke - par;
}

/** Par + relative → absolute strokes (clamped 1–15). */
export function strokeFromRelative(
  par: number | null | undefined,
  rel: number | null | undefined
): number | null {
  if (par == null || rel == null) return null;
  if (!Number.isFinite(par) || !Number.isFinite(rel)) return null;
  const stroke = par + rel;
  if (!Number.isFinite(stroke)) return null;
  return Math.min(15, Math.max(1, Math.round(stroke)));
}

/** Display relative: "0", "-1", "+2", or "–" when unknown. */
export function formatRelative(rel: number | null | undefined): string {
  if (rel == null || Number.isNaN(rel)) return "–";
  if (rel === 0) return "0";
  if (rel > 0) return `+${rel}`;
  return String(rel);
}

/** Tolerates undefined/null/short arrays — always pads first. */
export function calcTotals(scores: HoleScores | undefined | null) {
  const s = padScores(scores);
  const out = s.slice(0, 9).reduce<number>((sum, v) => sum + (v ?? 0), 0);
  const inn = s.slice(9, 18).reduce<number>((sum, v) => sum + (v ?? 0), 0);
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
  const p = players.find((x) => x.isMe) ?? players[0];
  return {
    name: (p?.name || "나").trim() || "나",
    scores: padScores(p?.scores),
    isMe: true,
  };
}

/** Names-only companion list from a comma-separated string. */
export function companionsLabel(
  companionsOrPlayers?: string | PlayerScores[] | null
): string {
  if (typeof companionsOrPlayers === "string") {
    return companionsOrPlayers.trim();
  }
  if (!companionsOrPlayers?.length) return "";
  const me = companionsOrPlayers.find((p) => p?.isMe) ?? companionsOrPlayers[0];
  return companionsOrPlayers
    .filter((p) => p && p !== me && !p.isMe)
    .map((p) => (p.name || "").trim())
    .filter(Boolean)
    .join(", ");
}

/**
 * Normalize any legacy or partial round into my-score-only shape.
 * players[] is always a single me-player; companions is names-only text.
 * Never throws — safe for hydrate.
 */
export function normalizePlayers(
  input: {
    scores?: HoleScores | null;
    players?: PlayerScores[] | null;
    companions?: string | null;
  },
  defaultMeName = "나"
): { scores: HoleScores; players: PlayerScores[]; companions: string } {
  try {
    let scores = padScores(input.scores);
    let meName = defaultMeName;
    let companions = (input.companions ?? "").trim();

    if (Array.isArray(input.players) && input.players.length > 0) {
      const safePlayers = input.players.filter(Boolean);
      const me =
        safePlayers.find((p) => p?.isMe) ?? safePlayers[0] ?? {
          name: defaultMeName,
          scores: emptyScores(),
          isMe: true,
        };
      meName = (me.name || defaultMeName).trim() || defaultMeName;
      const meScores = padScores(me.scores);
      // Prefer filled me scores; else top-level scores
      if (meScores.some((s) => s != null)) {
        scores = meScores;
      } else if (!scores.some((s) => s != null)) {
        scores = meScores;
      }
      if (!companions) {
        companions = safePlayers
          .filter((p) => p !== me && !p.isMe)
          .map((p) => (p.name || "").trim())
          .filter(Boolean)
          .join(", ");
      }
    }

    return {
      scores,
      players: [{ name: meName, scores, isMe: true }],
      companions,
    };
  } catch {
    const scores = padScores(input?.scores);
    return {
      scores,
      players: [{ name: defaultMeName, scores, isMe: true }],
      companions: (input?.companions ?? "").trim(),
    };
  }
}
