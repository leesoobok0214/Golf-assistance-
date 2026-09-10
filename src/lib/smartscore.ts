/**
 * SmartScore-style digital scorecard parser.
 *
 * Card layout (user-confirmed):
 * - Top: total strokes + my name (e.g. 89 / 이수복) = "me"
 * - PAR row: absolute par per hole
 * - Player rows: relative-to-par per hole (0=par, +1=bogey, -1=birdie, …)
 * - Actual strokes = par + relative
 * - Back nine may reuse hole labels 1–9
 */

import {
  DEFAULT_TEE_COLOR,
  emptyScores,
  padScores,
  type HoleScores,
  type PlayerScores,
  type TeeColor,
} from "./types";

export const DEFAULT_ME_NAMES = ["이수복", "나", "저", "본인", "ME", "SELF", "MY"] as const;

export type SmartScoreParse = {
  matched: boolean;
  courseName: string;
  date: string;
  time: string;
  frontCourse: string;
  backCourse: string;
  teeColor: TeeColor;
  companions: string;
  scores: HoleScores;
  players: PlayerScores[];
  meName: string;
  totalHint: number | null;
};

function cleanName(s: string): string {
  return s
    .replace(/[|=_~`'"「」『』【】\[\]{}<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isMeName(token: string, extra: string[] = []): boolean {
  const t = cleanName(token);
  if (!t) return false;
  const all = [...DEFAULT_ME_NAMES, ...extra];
  return all.some((n) => n.toLowerCase() === t.toLowerCase() || t.includes(n));
}

/** Integers including 0 and negatives (OCR: -1, −1, ㅡ1). */
export function signedIntsFromLine(line: string): number[] {
  const nums: number[] = [];
  const re = /(?:^|[\s|:])([−\-ㅡ]?\d{1,2})(?=[\s|:]|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    let raw = m[1].replace(/[−ㅡ]/g, "-");
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n)) continue;
    // Relative-to-par usually -4..+8; also allow par values 3–5 and totals up to 99
    if (n < -6 || n > 99) continue;
    nums.push(n);
  }
  return nums;
}

function looksLikeHoleHeader(nums: number[]): boolean {
  if (nums.length < 9) return false;
  const nine = nums.slice(0, 9);
  const is1to9 = nine.every((n, i) => n === i + 1);
  const is10to18 = nine.every((n, i) => n === 10 + i);
  return is1to9 || is10to18;
}

function looksLikeParRow(nums: number[]): boolean {
  if (nums.length < 9) return false;
  const nine = nums.slice(0, 9);
  // Typical golf pars 3–5; allow occasional 6
  const ok = nine.every((n) => n >= 3 && n <= 6);
  if (!ok) return false;
  const avg = nine.reduce((a, b) => a + b, 0) / nine.length;
  return avg >= 3.2 && avg <= 5.2;
}

function looksLikeRelativeRow(nums: number[]): boolean {
  if (nums.length < 9) return false;
  const nine = nums.slice(0, 9);
  // Relative scores: mostly -3..+5, often includes 0
  if (!nine.every((n) => n >= -4 && n <= 8)) return false;
  const hasZeroOrSmall = nine.some((n) => n >= -1 && n <= 2);
  const notAllParLike = !(
    nine.every((n) => n >= 3 && n <= 5) && new Set(nine).size <= 3
  );
  // Reject pure hole sequences
  if (looksLikeHoleHeader(nine)) return false;
  // Reject pure par rows
  if (looksLikeParRow(nine) && !nine.some((n) => n === 0 || n === 1 || n === 2)) {
    return false;
  }
  // If values look like absolute strokes (all 3–8, no zeros), treat as absolute elsewhere
  const allStrokeAbs = nine.every((n) => n >= 3 && n <= 10);
  const hasZero = nine.some((n) => n === 0);
  const hasNeg = nine.some((n) => n < 0);
  if (allStrokeAbs && !hasZero && !hasNeg) return false;
  return hasZeroOrSmall || hasNeg || hasZero;
}

type NamedNine = {
  name: string;
  relative: number[];
  nineTotal?: number;
  isMe: boolean;
};

function stripTrailingTotal(nums: number[]): { nine: number[]; total?: number } {
  if (nums.length >= 10) {
    const maybeT = nums[9];
    const nine = nums.slice(0, 9);
    // T is usually 30–60 for nine holes
    if (maybeT >= 25 && maybeT <= 70) {
      return { nine, total: maybeT };
    }
  }
  return { nine: nums.slice(0, 9) };
}

function nameFromLine(line: string): string {
  const withoutNums = line
    .replace(/[−\-ㅡ]?\d+/g, " ")
    .replace(/[|:：,，]/g, " ")
    .replace(/\b(HOLE|PAR|HDCP|TOTAL|합계|OUT|IN|T)\b/gi, " ")
    .trim();
  const token = withoutNums.split(/\s+/)[0] || "";
  return cleanName(token);
}

/**
 * Try to parse SmartScore relative-to-par layout from OCR text.
 * Returns matched:false if not that format.
 */
export function parseSmartScoreRelative(
  raw: string,
  opts?: { meNames?: string[]; fallbackDate?: string; fallbackTime?: string }
): SmartScoreParse {
  const meNames = opts?.meNames ?? [];
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const empty: SmartScoreParse = {
    matched: false,
    courseName: "",
    date: opts?.fallbackDate ?? "",
    time: opts?.fallbackTime ?? "",
    frontCourse: "",
    backCourse: "",
    teeColor: DEFAULT_TEE_COLOR,
    companions: "",
    scores: emptyScores(),
    players: [{ name: "나", scores: emptyScores(), isMe: true }],
    meName: "나",
    totalHint: null,
  };

  // Collect PAR nines and relative player nines in document order
  const parNines: number[][] = [];
  const playerNines: NamedNine[] = [];

  for (const line of lines) {
    if (/^(hole|홀|no\.?|#)\b/i.test(line)) continue;
    const nums = signedIntsFromLine(line);
    if (nums.length < 9) continue;
    if (looksLikeHoleHeader(nums)) continue;

    const name = nameFromLine(line);
    const isParLabel = /\bpar\b/i.test(line) || /^파\b/.test(line);

    if (isParLabel || (looksLikeParRow(nums) && !name)) {
      const { nine } = stripTrailingTotal(nums);
      if (looksLikeParRow(nine)) parNines.push(nine);
      continue;
    }

    if (looksLikeRelativeRow(nums) || (name && nums.length >= 9)) {
      const { nine, total } = stripTrailingTotal(nums);
      // Skip if this is actually another PAR (labeled elsewhere)
      if (looksLikeParRow(nine) && !name && !nine.includes(0)) {
        parNines.push(nine);
        continue;
      }
      if (!looksLikeRelativeRow(nine) && !name) continue;
      // Absolute stroke rows (no zero/neg) skipped here
      if (!looksLikeRelativeRow(nine)) continue;

      playerNines.push({
        name: name || `플레이어${playerNines.length + 1}`,
        relative: nine,
        nineTotal: total,
        isMe: isMeName(name, meNames),
      });
    }
  }

  if (parNines.length === 0 || playerNines.length === 0) {
    return empty;
  }

  // Need at least one full 9 relative for me; prefer 2 pars + my 2 nines
  const par18: number[] = [];
  if (parNines.length >= 2) {
    par18.push(...parNines[0], ...parNines[1]);
  } else {
    par18.push(...parNines[0], ...Array(9).fill(4));
  }

  // Pick me: explicit me name, else 이수복/extra, else first named Korean, else first
  let meRows = playerNines.filter((p) => p.isMe);
  if (!meRows.length) {
    meRows = playerNines.filter((p) => isMeName(p.name, meNames));
  }
  if (!meRows.length && meNames.length) {
    meRows = playerNines.filter((p) =>
      meNames.some((n) => p.name.includes(n))
    );
  }
  // Prefer rows whose nineTotal matches top total hint halves when possible
  const pickPool = meRows.length ? meRows : [playerNines[0]];

  // Group into front/back: first me nine + second me nine, else first two from pickPool
  let rel18: number[] = [];
  if (
    pickPool.length >= 2 &&
    pickPool[0].relative.length === 9 &&
    pickPool[1].relative.length === 9
  ) {
    rel18 = [...pickPool[0].relative, ...pickPool[1].relative];
  } else if (pickPool[0].relative.length === 9) {
    // Try find another nine for same name later in list
    const same = playerNines.filter(
      (p) => p.name === pickPool[0].name || (pickPool[0].isMe && p.isMe)
    );
    if (same.length >= 2) {
      rel18 = [...same[0].relative, ...same[1].relative];
    } else {
      rel18 = [...pickPool[0].relative, ...Array(9).fill(0)];
    }
  } else {
    return empty;
  }

  const scores = emptyScores();
  for (let i = 0; i < 18; i++) {
    const par = par18[i] ?? 4;
    const rel = rel18[i] ?? 0;
    const stroke = par + rel;
    if (stroke >= 1 && stroke <= 15) scores[i] = stroke;
  }

  // Top total hint e.g. "89" near my name
  let totalHint: number | null = null;
  const totalNearMe = raw.match(
    /(?:^|\n)\s*(\d{2,3})\s*(?:\n|\s)+(이수복|나|저|본인)/m
  ) || raw.match(/(이수복|나|저|본인)\s*[:：]?\s*(\d{2,3})/);
  if (totalNearMe) {
    const n = parseInt(totalNearMe[1].length <= 3 && /^\d+$/.test(totalNearMe[1]) ? totalNearMe[1] : totalNearMe[2], 10);
    if (n >= 60 && n <= 120) totalHint = n;
  }
  // Also: lone big number before name in first lines
  for (const line of lines.slice(0, 8)) {
    const m = line.match(/^(\d{2,3})$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n >= 60 && n <= 120) totalHint = n;
    }
  }

  // If we have totalHint and only front filled wrong, trust computed sum; optional adjust skipped
  const sum = scores.reduce<number>((a, v) => a + (v ?? 0), 0);
  if (totalHint && sum > 0 && Math.abs(sum - totalHint) > 6) {
    // Likely mis-ordered nines — try swapping me row pairs if 2+ rows
    const sameName = playerNines.filter(
      (p) => isMeName(p.name, meNames) || p.name === pickPool[0].name
    );
    if (sameName.length >= 2) {
      const alt = emptyScores();
      const altRel = [...sameName[1].relative, ...sameName[0].relative];
      for (let i = 0; i < 18; i++) {
        const stroke = (par18[i] ?? 4) + (altRel[i] ?? 0);
        if (stroke >= 1 && stroke <= 15) alt[i] = stroke;
      }
      const altSum = alt.reduce<number>((a, v) => a + (v ?? 0), 0);
      if (Math.abs(altSum - totalHint) < Math.abs(sum - totalHint)) {
        for (let i = 0; i < 18; i++) scores[i] = alt[i];
      }
    }
  }

  // Companions: other named players (unique names)
  const meLabel =
    pickPool.find((p) => isMeName(p.name, meNames))?.name ||
    meNames[0] ||
    "나";
  const companionNames = Array.from(
    new Set(
      playerNines
        .map((p) => p.name)
        .filter(
          (n) =>
            n &&
            !isMeName(n, meNames) &&
            !/^플레이어\d*$/i.test(n) &&
            n !== meLabel
        )
    )
  );

  // Course name: early line with Korean / CC / GC
  let courseName = "";
  for (const line of lines.slice(0, 10)) {
    const c = cleanName(line);
    if (!c || /^\d+$/.test(c)) continue;
    if (/CC|GC|클럽|골프|로제|비앙|COURSE/i.test(c) || /^[가-힣]{2,12}$/.test(c)) {
      if (!isMeName(c, meNames) && !companionNames.includes(c)) {
        courseName = c.slice(0, 40);
        break;
      }
    }
  }

  const dateMatch = raw.match(
    /(\d{4})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})/
  );
  let date = opts?.fallbackDate ?? "";
  if (dateMatch) {
    date = `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`;
  }
  const timeMatch = raw.match(/(\d{1,2})\s*[:시]\s*(\d{2})/);
  let time = opts?.fallbackTime ?? "08:00";
  if (timeMatch) {
    time = `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}`;
  }

  const finalScores = padScores(scores);
  const filled = finalScores.filter((s) => s != null).length;
  if (filled < 9) return empty;

  return {
    matched: true,
    courseName,
    date,
    time,
    frontCourse: "",
    backCourse: "",
    teeColor: DEFAULT_TEE_COLOR,
    companions: companionNames.join(", "),
    scores: finalScores,
    players: [{ name: meLabel === "이수복" ? "나" : meLabel || "나", scores: finalScores, isMe: true }],
    meName: meLabel || "나",
    totalHint,
  };
}

/** Build absolute strokes from par + relative arrays (length 9 or 18). */
export function strokesFromParRelative(
  pars: number[],
  relatives: number[]
): HoleScores {
  const scores = emptyScores();
  const n = Math.min(18, pars.length, relatives.length);
  for (let i = 0; i < n; i++) {
    const stroke = pars[i] + relatives[i];
    if (stroke >= 1 && stroke <= 15) scores[i] = stroke;
  }
  return scores;
}
