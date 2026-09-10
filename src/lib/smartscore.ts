/**
 * SmartScore-style digital scorecard parser.
 *
 * Card layout (user-confirmed):
 * - Top: total strokes + my name (e.g. 89 / 이수복) = "me"
 * - PAR row: absolute par per hole (OCR may say PR)
 * - Player rows: relative-to-par (0=par, +1=bogey, …)
 * - Actual strokes = par + relative
 * - Back nine may reuse hole labels 1–9
 * - OCR often mangles 이수복 → 이복 / 이속 / o+= on later rows; pair by table order
 * - HOLE header starts a new nine-block; PAR attaches to the *current* block
 */

import {
  DEFAULT_TEE_COLOR,
  emptyPars,
  emptyScores,
  padPars,
  padScores,
  type HolePars,
  type HoleScores,
  type PlayerScores,
  type TeeColor,
} from "./types";

export const DEFAULT_ME_NAMES = [
  "이수복",
  "이복", // common OCR truncation of 이수복
  "이속", // OCR misread of 이수복
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
  pars: HolePars;
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

/** Map curly/smart quotes before digits to ASCII minus; normalize dashes. */
export function normalizeOcrLine(line: string): string {
  return line
    .replace(/[“”„‟「」『』]/g, '"')
    .replace(/["'‘’`´]\s*(?=\d)/g, "-")
    .replace(/[−ㅡ–—]/g, "-")
    .replace(/(\d)\.(?=[\s|]|$)/g, "$1");
}

function cleanName(s: string): string {
  return s
    .replace(/[|=_~`'"「」『』【】\[\]{}<>+]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** OCR often renders 이수복 as o+= / o= on later rows. */
function isOcrMeJunk(token: string): boolean {
  const t = token.replace(/\s+/g, "");
  return /^o\+?=*$/i.test(t) || /^o\+=/i.test(t) || /^[o0]\+=?$/i.test(t);
}

/** Fuzzy: 이수복, OCR 이복/이속, o+= junk, substring match. */
function isMeName(token: string, extra: string[] = []): boolean {
  const raw = (token || "").trim();
  if (!raw) return false;
  if (isOcrMeJunk(raw)) return true;
  const t = cleanName(token);
  if (!t) return false;
  if (isOcrMeJunk(t)) return true;
  const all = [...DEFAULT_ME_NAMES, ...extra];
  if (all.some((n) => n.toLowerCase() === t.toLowerCase() || t.includes(n))) {
    return true;
  }
  // 이수복 ↔ 이복 / 이속 / 수복
  if (/이.?복/.test(t) || /이.?속/.test(t) || t === "수복") return true;
  return false;
}

function isCourseLikeToken(t: string): boolean {
  return /힐스|비전|로제|비앙|클럽|골프|코스|CC|GC|COURSE/i.test(t);
}

function isLikelyCompanionName(n: string): boolean {
  const t = cleanName(n);
  if (!t || t.length < 2 || t.length > 4) return false;
  if (isMeName(t)) return false;
  if (/^플레이어\d*$/i.test(t)) return false;
  if (/^(AM|PR|PAR|HOLE|T|OUT|IN)$/i.test(t)) return false;
  if (/^\d+$/.test(t)) return false;
  if (isCourseLikeToken(t)) return false;
  // Korean person names are usually 2–4 Hangul syllables
  if (/^[가-힣]{2,4}$/.test(t)) return true;
  return false;
}

/**
 * Integers including 0 and negatives (OCR: -1, −1, ㅡ1, “1 after normalize).
 * Trailing decimal dots (`1.`) are treated as integers.
 */
export function signedIntsFromLine(line: string): number[] {
  const normalized = normalizeOcrLine(line);
  const nums: number[] = [];
  const re = /(?:^|[\s|:=])(-?\d{1,2})(?=[\s|:]|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(normalized)) !== null) {
    const n = parseInt(m[1], 10);
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

/** Extract a labeled PAR nine (values 3–6) optionally followed by 36. */
function extractParNine(nums: number[]): number[] | null {
  for (let start = 0; start + 9 <= nums.length; start++) {
    const nine = nums.slice(start, start + 9);
    if (!looksLikeParRow(nine)) continue;
    const after = nums[start + 9];
    if (after == null || after === 36 || (after >= 30 && after <= 40)) {
      return nine;
    }
    // labeled PAR without trailing total still ok
    if (start === 0) return nine;
  }
  if (looksLikeParRow(nums.slice(0, 9))) return nums.slice(0, 9);
  return null;
}

function nameFromLine(line: string): string {
  const withoutNums = normalizeOcrLine(line)
    .replace(/-?\d+/g, " ")
    .replace(/[|:：,，]/g, " ")
    .replace(/\b(HOLE|PAR|PR|HDCP|TOTAL|합계|OUT|IN|T)\b/gi, " ")
    .trim();
  // Keep o+= / o= before stripping symbols
  const rawToken = withoutNums.split(/\s+/)[0] || "";
  if (isOcrMeJunk(rawToken) || /^o\+?=+/i.test(rawToken)) {
    return rawToken.replace(/[^oO+=]/g, "") || "o+=";
  }
  return cleanName(rawToken.replace(/[=+]/g, " "));
}

function lineLooksLikeMe(line: string, name: string, meNames: string[]): boolean {
  if (isMeName(name, meNames)) return true;
  if (/o\+?=/.test(line)) return true;
  if (/이\s*[속복]/.test(line)) return true;
  return false;
}

function extractTotalHint(raw: string, lines: string[]): number | null {
  let totalHint: number | null = null;
  const near = raw.match(
    /(?:^|\n)\s*(\d{2,3})\s*[\s\S]{0,40}?(이수복|이복|이속|나|저|본인)/m
  );
  if (near) {
    const n = parseInt(near[1], 10);
    if (n >= 60 && n <= 120) totalHint = n;
  }
  // "비전힐스 92" / "로제비앙 89" on first lines
  for (const line of lines.slice(0, 8)) {
    const m = line.match(
      /(?:힐스|비전|로제|비앙|클럽|골프|CC|GC)\s*(\d{2,3})\b/i
    );
    if (m) {
      const n = parseInt(m[1], 10);
      if (n >= 60 && n <= 120) totalHint = n;
    }
    const trailing = line.match(/^(.+?)\s+(\d{2,3})\s*$/);
    if (trailing && /[가-힣]{2,}/.test(trailing[1])) {
      const n = parseInt(trailing[2], 10);
      if (n >= 60 && n <= 120) totalHint = n;
    }
  }
  for (const line of lines.slice(0, 10)) {
    const m = line.match(/\b(\d{2,3})\b/);
    if (m && /이수복|이복|이속/.test(line + (lines[lines.indexOf(line) + 1] || ""))) {
      const n = parseInt(m[1], 10);
      if (n >= 60 && n <= 120) totalHint = n;
    }
    const alone = line.match(/^(\d{2,3})$/);
    if (alone) {
      const n = parseInt(alone[1], 10);
      if (n >= 60 && n <= 120 && totalHint == null) totalHint = n;
    }
  }
  return totalHint;
}

function ensureBlockSlot(parsByBlock: (number[] | null)[], block: number) {
  while (parsByBlock.length <= block) parsByBlock.push(null);
}

/**
 * Prefer known me-ish nine totals (~48 front / ~44 back) when matching totalHint.
 */
function pickMeInBlock(
  players: NamedNine[],
  totalHint: number | null,
  preferredTotal?: number
): NamedNine | null {
  if (!players.length) return null;
  const named = players.find((p) => p.isMe);
  if (named) return named;

  if (preferredTotal != null) {
    const hit = players.find(
      (p) => p.nineTotal != null && Math.abs(p.nineTotal - preferredTotal) <= 1
    );
    if (hit) return hit;
  }

  if (totalHint != null) {
    let best: NamedNine | null = null;
    let bestDiff = Infinity;
    for (const p of players) {
      if (p.nineTotal == null) continue;
      const diff = Math.abs(p.nineTotal - totalHint / 2);
      // slight preference for 48 then 44
      const bias =
        Math.abs(p.nineTotal - 48) <= 1
          ? -0.5
          : Math.abs(p.nineTotal - 44) <= 1
            ? -0.25
            : 0;
      const score = diff + bias;
      if (score < bestDiff) {
        bestDiff = score;
        best = p;
      }
    }
    if (best) return best;
  }

  return players[0] ?? null;
}

/**
 * When fuzzy names miss, choose one row per block so nineTotals sum closest to totalHint.
 */
function pickMeByTotalSum(
  frontPlayers: NamedNine[],
  backPlayers: NamedNine[],
  totalHint: number
): { front: NamedNine | null; back: NamedNine | null } {
  if (!frontPlayers.length) {
    return { front: null, back: pickMeInBlock(backPlayers, totalHint, 44) };
  }
  if (!backPlayers.length) {
    return { front: pickMeInBlock(frontPlayers, totalHint, 48), back: null };
  }

  let bestFront = frontPlayers[0];
  let bestBack = backPlayers[0];
  let bestDiff = Infinity;

  for (const f of frontPlayers) {
    for (const b of backPlayers) {
      if (f.nineTotal == null || b.nineTotal == null) continue;
      const sum = f.nineTotal + b.nineTotal;
      let diff = Math.abs(sum - totalHint);
      // prefer T≈48 then T≈44
      if (Math.abs(f.nineTotal - 48) <= 1) diff -= 0.4;
      if (Math.abs(b.nineTotal - 44) <= 1) diff -= 0.3;
      if (diff < bestDiff) {
        bestDiff = diff;
        bestFront = f;
        bestBack = b;
      }
    }
  }

  // If no totals, fall back to index 0 / preferred
  if (bestDiff === Infinity) {
    return {
      front: pickMeInBlock(frontPlayers, totalHint, 48),
      back: pickMeInBlock(backPlayers, totalHint, 44),
    };
  }
  return { front: bestFront, back: bestBack };
}

export function parseSmartScoreRelative(
  raw: string,
  opts?: { meNames?: string[]; fallbackDate?: string; fallbackTime?: string }
): SmartScoreParse {
  const meNames = opts?.meNames ?? [];
  const lines = raw
    .split(/\r?\n/)
    .map((l) => normalizeOcrLine(l.trim()))
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
    pars: emptyPars(),
    players: [{ name: "나", scores: emptyScores(), isMe: true }],
    meName: "나",
    totalHint: null,
  };

  const parsByBlock: (number[] | null)[] = [];
  const playerNines: NamedNine[] = [];
  let block = -1;
  /** True after HOLE until a player row (unlabeled par-like may attach). */
  let awaitingParOrPlayers = false;

  for (const line of lines) {
    const nums = signedIntsFromLine(line);
    const isHoleLabel = /^(hole|홀|no\.?|#)\b/i.test(line);
    const holeHeader =
      isHoleLabel || (nums.length >= 9 && looksLikeHoleHeader(nums));

    // HOLE 1..9 header starts a new block (do not skip for block tracking)
    if (holeHeader && (isHoleLabel || looksLikeHoleHeader(nums))) {
      block = block < 0 ? 0 : block + 1;
      ensureBlockSlot(parsByBlock, block);
      awaitingParOrPlayers = true;
      continue;
    }

    if (nums.length < 9) continue;

    const name = nameFromLine(line);
    const isParLabel =
      /\bpar\b/i.test(line) || /\bpr\b/i.test(line) || /^파\b/.test(line);

    // PAR / PR attaches to *current* block.
    // If this block already has a PAR or player rows (e.g. Roseviang back
    // nine with no second HOLE header), advance to the next block first.
    if (isParLabel) {
      if (block < 0) {
        block = 0;
      } else {
        const blockHasPar = parsByBlock[block] != null;
        const blockHasPlayers = playerNines.some((p) => p.block === block);
        if (blockHasPar || blockHasPlayers) {
          block += 1;
        }
      }
      const nine = extractParNine(nums);
      if (nine) {
        ensureBlockSlot(parsByBlock, block);
        parsByBlock[block] = nine;
      }
      awaitingParOrPlayers = false;
      continue;
    }

    // Unlabeled par-like nine + total 36 between HOLE and players → PAR for block
    if (
      awaitingParOrPlayers &&
      !name &&
      looksLikeParRow(nums.slice(0, 9)) &&
      (nums[9] === 36 || nums.includes(36))
    ) {
      if (block < 0) {
        block = 0;
        ensureBlockSlot(parsByBlock, block);
      }
      const nine = extractParNine(nums);
      if (nine) {
        ensureBlockSlot(parsByBlock, block);
        parsByBlock[block] = nine;
      }
      awaitingParOrPlayers = false;
      continue;
    }

    // Also accept unlabeled par row when no name and looks like PAR (nine of 3–5 + optional 36)
    if (
      !name &&
      looksLikeParRow(nums.slice(0, 9)) &&
      (nums[9] === 36 || (nums.length === 9 && !nums.slice(0, 9).includes(0)))
    ) {
      // Only if we already have a block (after HOLE) and no PAR yet
      if (block >= 0 && (parsByBlock[block] == null || awaitingParOrPlayers)) {
        const nine = extractParNine(nums);
        if (nine && !nine.includes(0)) {
          ensureBlockSlot(parsByBlock, block);
          parsByBlock[block] = nine;
          awaitingParOrPlayers = false;
          continue;
        }
      }
    }

    const extracted = extractNineAndTotal(nums);
    if (!extracted) continue;
    if (!looksLikeRelativeRow(extracted.nine)) continue;

    // Unlabeled flat par-like absolute? skip (unless handled above)
    if (
      looksLikeParRow(extracted.nine) &&
      !name &&
      !extracted.nine.includes(0) &&
      extracted.nine.every((n) => n >= 3)
    ) {
      continue;
    }

    if (block < 0) {
      block = 0;
      ensureBlockSlot(parsByBlock, block);
    }

    const me = lineLooksLikeMe(line, name, meNames);
    playerNines.push({
      name: name || `플레이어${playerNines.length + 1}`,
      relative: extracted.nine,
      nineTotal: extracted.total,
      isMe: me,
      block,
    });
    awaitingParOrPlayers = false;
  }

  const hasAnyPar = parsByBlock.some((p) => p != null && p.length >= 9);
  if (!hasAnyPar || playerNines.length === 0) {
    return empty;
  }

  const totalHint = extractTotalHint(raw, lines);

  const frontPlayers = playerNines.filter((p) => p.block === 0);
  const backPlayers = playerNines.filter((p) => p.block >= 1);

  let meFront: NamedNine | null = pickMeInBlock(frontPlayers, totalHint, 48);
  let meBack: NamedNine | null = null;

  if (backPlayers.length) {
    // Prefer fuzzy me in back; else same slot as front; else complementary total
    const fuzzyBack = backPlayers.find((p) => p.isMe);
    if (fuzzyBack) {
      meBack = fuzzyBack;
    } else if (totalHint != null) {
      const bySum = pickMeByTotalSum(
        meFront ? [meFront] : frontPlayers,
        backPlayers,
        totalHint
      );
      if (!meFront) meFront = bySum.front;
      meBack = bySum.back;
    } else {
      const frontIdx = meFront ? frontPlayers.indexOf(meFront) : 0;
      meBack =
        (frontIdx >= 0 && backPlayers[frontIdx]) || backPlayers[0] || null;
    }
  }

  // If front fuzzy missed but totals can recover both nines
  if (
    totalHint != null &&
    (!meFront?.isMe || (backPlayers.length > 0 && meBack && !meBack.isMe))
  ) {
    const bySum = pickMeByTotalSum(frontPlayers, backPlayers, totalHint);
    // Only override non-fuzzy picks
    if (meFront && !meFront.isMe && bySum.front) meFront = bySum.front;
    if ((!meBack || !meBack.isMe) && bySum.back) meBack = bySum.back;
    if (!meFront && bySum.front) meFront = bySum.front;
  }

  // Never invent a missing nine as all-par (zeros)
  const relFront = meFront?.relative ?? null;
  const relBack = meBack?.relative ?? null;
  if (!relFront) return empty;

  const parFront = parsByBlock[0] ?? null;
  const parBack =
    parsByBlock.find((p, i) => i >= 1 && p != null) ??
    (parsByBlock.length > 1 ? parsByBlock[1] : null);

  const scores = emptyScores();
  // Only fill strokes when we have real course pars — never invent par 4
  if (parFront) {
    for (let i = 0; i < 9; i++) {
      const p = parFront[i];
      if (p == null || p < 3 || p > 6) continue;
      const stroke = p + relFront[i];
      if (stroke >= 1 && stroke <= 15) scores[i] = stroke;
    }
  }
  if (relBack && parBack) {
    for (let i = 0; i < 9; i++) {
      const p = parBack[i];
      if (p == null || p < 3 || p > 6) continue;
      const stroke = p + relBack[i];
      if (stroke >= 1 && stroke <= 15) scores[9 + i] = stroke;
    }
  }

  // Companion names from header (before HOLE) + player rows
  const headerCompanions: string[] = [];
  for (const line of lines) {
    if (/\b(HOLE|PAR|PR)\b/i.test(line)) break;
    const names = line.match(/[가-힣]{2,4}/g) || [];
    for (const n of names) {
      if (isLikelyCompanionName(n) && !isMeName(n, meNames)) {
        headerCompanions.push(n);
      }
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
    // Strip trailing score numbers: "비전힐스 92" → "비전힐스"
    let c = cleanName(line).replace(/\s+\d{2,3}\s*$/, "").trim();
    c = c.replace(/\s*\d{2,3}\s*$/, "").trim();
    if (!c || /^\d+$/.test(c)) continue;
    if (
      isCourseLikeToken(c) ||
      /CC|GC|클럽|골프|COURSE/i.test(c) ||
      /^[가-힣]{2,12}$/.test(c)
    ) {
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
  // Need at least one full nine with real pars
  if (filled < 9) return empty;

  // Build pars[18] from parsByBlock[0]+parsByBlock[1] — nulls if missing, never invent
  const parsOut = emptyPars();
  if (parFront) {
    for (let i = 0; i < 9; i++) {
      const p = parFront[i];
      parsOut[i] = p != null && p >= 3 && p <= 6 ? p : null;
    }
  }
  if (parBack) {
    for (let i = 0; i < 9; i++) {
      const p = parBack[i];
      parsOut[9 + i] = p != null && p >= 3 && p <= 6 ? p : null;
    }
  }

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
    pars: padPars(parsOut),
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
