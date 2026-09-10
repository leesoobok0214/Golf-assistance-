/**
 * SmartScore-style digital scorecard parser.
 *
 * Card layout (user-confirmed):
 * - Top: total strokes + my name (e.g. 89 / 이수복) = "me"
 * - PAR row: absolute par per hole (OCR may say PR)
 * - Player rows: relative-to-par (0=par, +1=bogey, …)
 * - Actual strokes = par + relative
 * - Back nine may reuse hole labels 1–9
 * - OCR often mangles 이수복 → 이복 / o+= on later rows; pair by table order
 */

import {
  DEFAULT_TEE_COLOR,
  emptyScores,
  padScores,
  type HoleScores,
  type PlayerScores,
  type TeeColor,
} from "./types";

export const DEFAULT_ME_NAMES = [
  "이수복",
  "이복", // common OCR truncation of 이수복
  "나",
  "저",
  "본인",
  "ME",
  "SELF",
  "MY",
] as const;

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

type NamedNine = {
  name: string;
  relative: number[];
  nineTotal?: number;
  isMe: boolean;
  block: number; // 0 = front table, 1 = back table, …
};

function cleanName(s: string): string {
  return s
    .replace(/[|=_~`'"「」『』【】\[\]{}<>+]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Fuzzy: 이수복, OCR 이복, substring match. */
function isMeName(token: string, extra: string[] = []): boolean {
  const t = cleanName(token);
  if (!t) return false;
  const all = [...DEFAULT_ME_NAMES, ...extra];
  if (all.some((n) => n.toLowerCase() === t.toLowerCase() || t.includes(n))) {
    return true;
  }
  // 이수복 ↔ 이복 / 수복
  if (/이.?복/.test(t) || t === "수복") return true;
  return false;
}

function isLikelyCompanionName(n: string): boolean {
  const t = cleanName(n);
  if (!t || t.length < 2 || t.length > 4) return false;
  if (isMeName(t)) return false;
  if (/^플레이어\d*$/i.test(t)) return false;
  if (/^(AM|PR|PAR|HOLE|T|OUT|IN)$/i.test(t)) return false;
  if (/^\d+$/.test(t)) return false;
  if (/클럽|골프|코스|비앙|CC|GC/i.test(t)) return false;
  // Korean person names are usually 2–4 Hangul syllables
  if (/^[가-힣]{2,4}$/.test(t)) return true;
  return false;
}

/** Integers including 0 and negatives (OCR: -1, −1, ㅡ1). */
export function signedIntsFromLine(line: string): number[] {
  const nums: number[] = [];
  const re = /(?:^|[\s|:=])([−\-ㅡ]?\d{1,2})(?=[\s|:]|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    const raw = m[1].replace(/[−ㅡ]/g, "-");
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n)) continue;
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
  const ok = nine.every((n) => n >= 3 && n <= 6);
  if (!ok) return false;
  const avg = nine.reduce((a, b) => a + b, 0) / nine.length;
  return avg >= 3.2 && avg <= 5.2;
}

function looksLikeRelativeRow(nums: number[]): boolean {
  if (nums.length < 9) return false;
  const nine = nums.slice(0, 9);
  if (!nine.every((n) => n >= -4 && n <= 8)) return false;
  if (looksLikeHoleHeader(nine)) return false;
  if (looksLikeParRow(nine) && !nine.some((n) => n <= 2)) return false;
  const allStrokeAbs = nine.every((n) => n >= 3 && n <= 10);
  const hasZero = nine.some((n) => n === 0);
  const hasNeg = nine.some((n) => n < 0);
  if (allStrokeAbs && !hasZero && !hasNeg) return false;
  return hasZero || hasNeg || nine.some((n) => n >= -1 && n <= 2);
}

/**
 * Prefer "... 9 relatives + T(25–70)".
 * Handles OCR junk prefix like "o+=2 0 1 1 2 0 2 0 2 0 44".
 */
export function extractNineAndTotal(
  nums: number[]
): { nine: number[]; total?: number } | null {
  for (let end = nums.length; end >= 10; end--) {
    const maybeT = nums[end - 1];
    if (maybeT < 25 || maybeT > 70) continue;
    const nine = nums.slice(end - 10, end - 1);
    if (nine.length === 9 && looksLikeRelativeRow(nine)) {
      return { nine, total: maybeT };
    }
  }
  for (let start = 0; start + 9 <= nums.length; start++) {
    const nine = nums.slice(start, start + 9);
    if (looksLikeRelativeRow(nine)) {
      const after = nums[start + 9];
      if (after != null && after >= 25 && after <= 70) {
        return { nine, total: after };
      }
      return { nine };
    }
  }
  return null;
}

function nameFromLine(line: string): string {
  const withoutNums = line
    .replace(/[−\-ㅡ]?\d+/g, " ")
    .replace(/[|:：,，=+]/g, " ")
    .replace(/\b(HOLE|PAR|PR|HDCP|TOTAL|합계|OUT|IN|T)\b/gi, " ")
    .trim();
  const token = withoutNums.split(/\s+/)[0] || "";
  return cleanName(token);
}

function extractTotalHint(raw: string, lines: string[]): number | null {
  let totalHint: number | null = null;
  const near = raw.match(
    /(?:^|\n)\s*(\d{2,3})\s*[\s\S]{0,40}?(이수복|이복|나|저|본인)/m
  );
  if (near) {
    const n = parseInt(near[1], 10);
    if (n >= 60 && n <= 120) totalHint = n;
  }
  for (const line of lines.slice(0, 10)) {
    const m = line.match(/\b(\d{2,3})\b/);
    if (m && /이수복|이복/.test(line + (lines[lines.indexOf(line) + 1] || ""))) {
      const n = parseInt(m[1], 10);
      if (n >= 60 && n <= 120) totalHint = n;
    }
    const alone = line.match(/^(\d{2,3})$/);
    if (alone) {
      const n = parseInt(alone[1], 10);
      if (n >= 60 && n <= 120) totalHint = n;
    }
  }
  // "89" on same line as course
  const courseLine = lines.find((l) => /로제|CC|GC|클럽|골프/.test(l));
  if (courseLine) {
    const m = courseLine.match(/\b(\d{2,3})\b/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n >= 60 && n <= 120) totalHint = n;
    }
  }
  return totalHint;
}

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

  const parNines: number[][] = [];
  const playerNines: NamedNine[] = [];
  let block = -1;

  for (const line of lines) {
    if (/^(hole|홀|no\.?|#)\b/i.test(line)) continue;
    const nums = signedIntsFromLine(line);
    if (nums.length < 9) continue;
    if (looksLikeHoleHeader(nums)) continue;

    const name = nameFromLine(line);
    const isParLabel = /\bpar\b/i.test(line) || /\bpr\b/i.test(line) || /^파\b/.test(line);

    // PAR / PR row starts a new nine-block
    if (isParLabel || (looksLikeParRow(nums.slice(0, 9)) && !name)) {
      const nine = nums.slice(0, 9);
      if (looksLikeParRow(nine)) {
        parNines.push(nine);
        block = parNines.length - 1;
      }
      continue;
    }

    const extracted = extractNineAndTotal(nums);
    if (!extracted) continue;
    if (!looksLikeRelativeRow(extracted.nine)) continue;

    // Unlabeled flat par-like absolute? skip
    if (looksLikeParRow(extracted.nine) && !name && !extracted.nine.includes(0)) {
      continue;
    }

    if (block < 0) block = 0;

    playerNines.push({
      name: name || `플레이어${playerNines.length + 1}`,
      relative: extracted.nine,
      nineTotal: extracted.total,
      isMe: isMeName(name, meNames),
      block,
    });
  }

  if (parNines.length === 0 || playerNines.length === 0) {
    return empty;
  }

  const totalHint = extractTotalHint(raw, lines);

  const frontPlayers = playerNines.filter((p) => p.block === 0);
  const backPlayers = playerNines.filter((p) => p.block >= 1);

  // Me index in front table
  let meFrontIdx = frontPlayers.findIndex((p) => p.isMe || isMeName(p.name, meNames));
  if (meFrontIdx < 0 && frontPlayers.length) {
    // Prefer row whose nineTotal is closest to totalHint/2 or ~40–50
    if (totalHint) {
      let best = 0;
      let bestDiff = Infinity;
      frontPlayers.forEach((p, i) => {
        if (p.nineTotal == null) return;
        const diff = Math.abs(p.nineTotal - totalHint / 2);
        if (diff < bestDiff) {
          bestDiff = diff;
          best = i;
        }
      });
      meFrontIdx = best;
    } else {
      meFrontIdx = 0;
    }
  }

  const meFront = meFrontIdx >= 0 ? frontPlayers[meFrontIdx] : null;

  // Back nine: same slot as front (player order), else match by nineTotal ≈ totalHint - frontT
  let meBack: NamedNine | null = null;
  if (backPlayers.length && meFront) {
    if (meFrontIdx < backPlayers.length) {
      meBack = backPlayers[meFrontIdx];
    }
    if (totalHint && meFront.nineTotal != null) {
      const need = totalHint - meFront.nineTotal;
      const byTotal = backPlayers.find(
        (p) => p.nineTotal != null && Math.abs(p.nineTotal - need) <= 1
      );
      if (byTotal) meBack = byTotal;
    }
    // If slot 0 back row is garbage name but totals match, keep it
    if (!meBack && backPlayers[0]) meBack = backPlayers[0];
  }

  // Never invent a missing nine as all-par (zeros)
  const relFront = meFront?.relative ?? null;
  const relBack = meBack?.relative ?? null;
  if (!relFront) return empty;

  const parFront = parNines[0];
  const parBack = parNines[1] ?? null;

  const scores = emptyScores();
  for (let i = 0; i < 9; i++) {
    const stroke = (parFront[i] ?? 4) + relFront[i];
    if (stroke >= 1 && stroke <= 15) scores[i] = stroke;
  }
  if (relBack && parBack) {
    for (let i = 0; i < 9; i++) {
      const stroke = (parBack[i] ?? 4) + relBack[i];
      if (stroke >= 1 && stroke <= 15) scores[9 + i] = stroke;
    }
  }
  // If we have relBack but only one PAR, still apply using front par? No — wait for real back PAR.
  // If relBack exists and parBack missing, use typical? Better leave empty than wrong all-4s.
  // Exception: if only one PAR row OCR'd but two relative blocks, reuse is wrong.
  if (relBack && !parBack && parNines.length === 1) {
    // Still better to leave back empty than fake pars
  }

  // Also pull companion names from header lines (before HOLE)
  const headerCompanions: string[] = [];
  for (const line of lines) {
    if (/\b(HOLE|PAR|PR)\b/i.test(line)) break;
    const names = line.match(/[가-힣]{2,4}/g) || [];
    for (const n of names) {
      if (isLikelyCompanionName(n) && !isMeName(n, meNames)) headerCompanions.push(n);
    }
  }

    const companionNames = Array.from(
    new Set(
      [
        ...headerCompanions,
        ...[...frontPlayers, ...backPlayers]
          .map((p) => p.name)
          .filter((n) => isLikelyCompanionName(n) && !isMeName(n, meNames)),
      ]
    )
  );

  let courseName = "";
  for (const line of lines.slice(0, 10)) {
    const c = cleanName(line).replace(/\s*\d{2,3}\s*$/, "").trim();
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
    players: [{ name: "나", scores: finalScores, isMe: true }],
    meName: "나",
    totalHint,
  };
}

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
