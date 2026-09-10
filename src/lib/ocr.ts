"use client";

import { createWorker, type Worker } from "tesseract.js";
import {
  DEFAULT_TEE_COLOR,
  emptyScores,
  padScores,
  type HoleScores,
  type PlayerScores,
  type TeeColor,
} from "./types";
import { parseSmartScoreRelative } from "./smartscore";


export interface OcrParseResult {
  raw: string;
  courseName: string;
  date: string;
  time: string;
  frontCourse: string;
  backCourse: string;
  /** Kept for DB compat; UI no longer shows tee tabs. */
  teeColor: TeeColor;
  /** Optional companion names only (comma-separated). */
  companions: string;
  scores: HoleScores;
  /** Always a single me-player after parse. */
  players: PlayerScores[];
}

let workerPromise: Promise<Worker> | null = null;

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      try {
        const w = await createWorker("kor+eng", 1, {
          logger: () => {},
        });
        return w;
      } catch {
        const w = await createWorker("eng", 1, {
          logger: () => {},
        });
        return w;
      }
    })();
  }
  return workerPromise;
}

export async function recognizeScorecard(
  image: File | Blob | string,
  onProgress?: (p: number, status: string) => void
): Promise<OcrParseResult> {
  onProgress?.(5, "OCR 엔진 준비 중…");
  const worker = await getWorker();
  onProgress?.(20, "이미지 인식 중…");

  const { data } = await worker.recognize(image);
  onProgress?.(90, "결과 정리 중…");
  const raw = data.text || "";
  const parsed = parseOcrText(raw);
  onProgress?.(100, "완료");
  return parsed;
}

const NOISE_LINE =
  /^(hole|par|hdcp|handicap|yard|yds?|m|meter|총|합계|total|score|스코어|서명|date|날짜|time|시간|no\.?|#)$/i;

const COURSE_HINT =
  /CC|GC|클럽|골프장|골프클럽|컨트리\s*클럽|COUNTRY|COURSE|GOLF|코스|CC\.|GC\./i;

/** Strip OCR junk from a candidate name. */
function cleanName(s: string): string {
  return s
    .replace(/[|=_~`'"「」『』【】\[\]{}<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractCourseName(raw: string, lines: string[]): string {
  const scored: { line: string; score: number }[] = [];
  for (let i = 0; i < Math.min(lines.length, 12); i++) {
    const line = cleanName(lines[i]);
    if (!line || line.length < 2 || line.length > 48) continue;
    if (NOISE_LINE.test(line)) continue;
    if (/^[\d\s./:\-년월일]+$/.test(line)) continue;

    let score = 0;
    if (COURSE_HINT.test(line)) score += 10;
    if (/CC|GC/i.test(line)) score += 6;
    if (/[가-힣]{2,}/.test(line)) score += 3;
    if (i < 3) score += 2;
    const nums = (line.match(/\d+/g) || []).length;
    if (nums >= 3) score -= 5;
    if (score > 0) scored.push({ line, score });
  }
  scored.sort((a, b) => b.score - a.score);
  if (scored[0]) {
    let name = scored[0].line;
    name = name.replace(/\s+\d{1,3}(\s+\d{1,3}){3,}\s*$/, "").trim();
    name = name.replace(/\s*(전반|후반|OUT|IN)\s*.*$/i, "").trim();
    return name.slice(0, 40);
  }
  for (const l of lines.slice(0, 8)) {
    const c = cleanName(l);
    if (c && /[가-힣A-Za-z]{2,}/.test(c) && !NOISE_LINE.test(c)) {
      return c.slice(0, 40);
    }
  }
  return "";
}

function extractFrontBack(
  raw: string,
  lines: string[]
): { frontCourse: string; backCourse: string } {
  let frontCourse = "";
  let backCourse = "";

  const pickAfter = (labelRe: RegExp, text: string): string => {
    const m = text.match(labelRe);
    if (!m) return "";
    let rest = (m[1] ?? "").trim();
    rest = rest
      .replace(/^[:：\-–·.\s]+/, "")
      .replace(/\s*(OUT|IN|홀|HOLE|PAR).*$/i, "")
      .replace(/[|].*$/, "")
      .trim();
    if (!rest || /^[\d\s]+$/.test(rest)) return "";
    const token = rest.split(/\s{2,}|\s*[|/]\s*/)[0]?.trim() ?? rest;
    return cleanName(token).slice(0, 20);
  };

  frontCourse =
    pickAfter(/(?:전반|OUT|Front)\s*[:：\-]?\s*([^\n]{1,24})/i, raw) ||
    pickAfter(/(?:전반\s*코스)\s*[:：\-]?\s*([^\n]{1,24})/i, raw);

  backCourse =
    pickAfter(/(?:후반|IN|Back)\s*[:：\-]?\s*([^\n]{1,24})/i, raw) ||
    pickAfter(/(?:후반\s*코스)\s*[:：\-]?\s*([^\n]{1,24})/i, raw);

  if (!frontCourse || !backCourse) {
    for (const line of lines) {
      const pair = line.match(
        /([가-힣A-Za-z][가-힣A-Za-z0-9]{0,10})\s*[\/·\-–~〜]\s*([가-힣A-Za-z][가-힣A-Za-z0-9]{0,10})/
      );
      if (
        pair &&
        /전반|후반|OUT|IN|코스|course/i.test(line + raw.slice(0, 200))
      ) {
        if (!frontCourse) frontCourse = cleanName(pair[1]).slice(0, 20);
        if (!backCourse) backCourse = cleanName(pair[2]).slice(0, 20);
        break;
      }
    }
  }

  if (!frontCourse) {
    for (const line of lines) {
      const m = line.match(
        /^(?:전반|OUT)\s*[:：\-]?\s*([가-힣A-Za-z][가-힣A-Za-z0-9]{0,12})\s*$/i
      );
      if (m) {
        frontCourse = cleanName(m[1]).slice(0, 20);
        break;
      }
    }
  }
  if (!backCourse) {
    for (const line of lines) {
      const m = line.match(
        /^(?:후반|IN)\s*[:：\-]?\s*([가-힣A-Za-z][가-힣A-Za-z0-9]{0,12})\s*$/i
      );
      if (m) {
        backCourse = cleanName(m[1]).slice(0, 20);
        break;
      }
    }
  }

  if (/^(전반|후반|OUT|IN)$/i.test(frontCourse)) frontCourse = "";
  if (/^(전반|후반|OUT|IN)$/i.test(backCourse)) backCourse = "";

  return { frontCourse, backCourse };
}

/** Extract integers 1–15 from a line. */
function numbersFromLine(line: string): number[] {
  const nums: number[] = [];
  const re = /\b([1-9]|1[0-5])\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    nums.push(parseInt(m[1], 10));
  }
  return nums;
}

/**
 * True when nums look like hole labels (1..9, 10..18, or 1..18),
 * or any long strictly-ascending-by-1 run (never stroke scores).
 */
function isHoleNumberSequence(nums: number[]): boolean {
  if (nums.length < 9) return false;

  const isSeq = (arr: number[], start: number) =>
    arr.length >= 9 && arr.every((n, i) => n === start + i);

  if (isSeq(nums.slice(0, 9), 1)) return true;
  if (isSeq(nums.slice(0, 9), 10)) return true;
  if (nums.length >= 18 && isSeq(nums.slice(0, 18), 1)) return true;

  // Any 8+ consecutive values ascending by exactly 1 (catches 2..10 etc.)
  let streak = 1;
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] === nums[i - 1] + 1) {
      streak += 1;
      if (streak >= 8) return true;
    } else {
      streak = 1;
    }
  }

  const nine = nums.slice(0, 9);
  let hits = 0;
  for (let i = 0; i < nine.length; i++) {
    if (nine[i] === i + 1) hits += 1;
  }
  if (hits >= 7) return true;

  return false;
}

/** Prefer rows whose values are mostly typical strokes (3–7). */
function strokeQuality(nums: number[]): number {
  if (nums.length < 9) return -1;
  if (isHoleNumberSequence(nums)) return -100;

  const pick = nums.slice(0, 18);
  const strokeLike = pick.filter((n) => n >= 3 && n <= 7);
  const ratio = strokeLike.length / pick.length;

  const avg = pick.reduce((a, b) => a + b, 0) / pick.length;
  const uniq = new Set(pick).size;
  let score = ratio * 10;
  // Flat par-ish rows
  if (avg >= 3 && avg <= 5.2 && uniq <= 3) score -= 5;
  if (pick[0] === 1 && pick[1] === 2 && pick[2] === 3) score -= 8;
  // Long consecutive +1 streak = hole labels (not scattered 4→5 pairs)
  let streak = 1;
  let maxStreak = 1;
  for (let i = 1; i < pick.length; i++) {
    if (pick[i] === pick[i - 1] + 1) {
      streak += 1;
      maxStreak = Math.max(maxStreak, streak);
    } else {
      streak = 1;
    }
  }
  if (maxStreak >= 7) score -= 20;
  return score;
}

function isMeName(token: string): boolean {
  return /^(나|저|본인|ME|SELF|MY)$/i.test(cleanName(token));
}

function isLikelyName(token: string): boolean {
  const t = cleanName(token);
  if (!t || t.length > 12) return false;
  if (isMeName(t)) return true; // "나" is 1 char
  if (t.length < 2) return false;
  if (NOISE_LINE.test(t)) return false;
  if (/^(전반|후반|OUT|IN|PAR|HDCP|TOTAL|합계|HOLE|홀)$/i.test(t)) return false;
  if (/^[\d\s]+$/.test(t)) return false;
  if (/^[가-힣]{2,4}$/.test(t)) return true;
  if (/^[A-Za-z][A-Za-z.\-]{1,11}$/.test(t)) return true;
  if (/^[가-힣]{2,4}\s*[A-Za-z]?$/.test(t)) return true;
  return false;
}

function toScores(pick: number[]): HoleScores {
  const scores = emptyScores();
  pick.slice(0, 18).forEach((v, i) => {
    scores[i] = v;
  });
  return scores;
}

function isParLike(pick: number[]): boolean {
  if (pick.length < 9) return false;
  const avg = pick.reduce((a, b) => a + b, 0) / pick.length;
  const uniq = new Set(pick).size;
  return avg >= 3 && avg <= 5.2 && uniq <= 3 && pick.every((n) => n >= 3 && n <= 5);
}

/**
 * Try to parse player score rows.
 * Skips hole-number sequences (1–9 / 1–18) and prefers stroke-like rows (3–7).
 */
function extractPlayerRows(raw: string, lines: string[]): PlayerScores[] {
  const rows: PlayerScores[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^(hole|홀|no\.?|#|par|hdcp|handicap|야드|yard|yds?)\b/i.test(trimmed)) {
      continue;
    }
    if (/\b(par|hdcp|handicap)\b/i.test(trimmed) && !/[가-힣]{2,}/.test(trimmed)) {
      continue;
    }

    const nums = numbersFromLine(line);
    if (nums.length < 9) continue;
    if (isHoleNumberSequence(nums)) continue;

    const quality = strokeQuality(nums);
    if (quality < 3) continue;

    const strokes = nums.filter((n) => n >= 2 && n <= 10);
    const pick =
      strokes.length >= 18
        ? strokes.slice(0, 18)
        : strokes.length >= 9
          ? strokes.slice(0, 18)
          : nums.slice(0, 18);

    if (pick.length < 9) continue;
    if (isHoleNumberSequence(pick)) continue;
    const strokeRatio =
      pick.filter((n) => n >= 3 && n <= 7).length / pick.length;
    if (strokeRatio < 0.5) continue;

    const namePart = line
      .replace(/[\d]+/g, " ")
      .replace(/[|:：,，]/g, " ")
      .trim()
      .split(/\s+/)[0];

    const name =
      isMeName(namePart || "") || isLikelyName(namePart || "")
        ? cleanName(namePart)
        : "";

    // Skip unnamed flat par rows
    if (isParLike(pick) && !name) continue;

    rows.push({
      name: name || `플레이어${rows.length + 1}`,
      scores: toScores(pick),
      isMe: isMeName(name),
    });
  }

  const unique: PlayerScores[] = [];
  for (const r of rows) {
    const key = r.scores.map((s) => s ?? "x").join(",");
    if (unique.some((u) => u.scores.map((s) => s ?? "x").join(",") === key))
      continue;
    unique.push(r);
  }

  // Prefer me/named rows; keep document order otherwise (OUT then IN).
  unique.sort((a, b) => {
    const aMe = a.isMe || isMeName(a.name) ? 2 : isLikelyName(a.name) ? 1 : 0;
    const bMe = b.isMe || isMeName(b.name) ? 2 : isLikelyName(b.name) ? 1 : 0;
    return bMe - aMe;
  });

  return unique.slice(0, 4);
}

/**
 * Single-run fallback across whole text.
 * Never returns a hole-label sequence. If unsure, leave empty.
 */
function extractSingleScoreRun(raw: string, lines: string[]): HoleScores {
  let best: { nums: number[]; quality: number; named: boolean } | null = null;
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^(hole|홀|no\.?|#|par|hdcp|handicap|야드|yard|yds?)\b/i.test(trimmed)) {
      continue;
    }
    const nums = numbersFromLine(line);
    if (nums.length < 9) continue;
    if (isHoleNumberSequence(nums)) continue;
    if (isParLike(nums.slice(0, 18))) continue;
    const quality = strokeQuality(nums);
    if (quality < 5) continue;
    const namePart = line
      .replace(/[\d]+/g, " ")
      .replace(/[|:：,，]/g, " ")
      .trim()
      .split(/\s+/)[0];
    const named = isLikelyName(namePart || "");
    if (
      !best ||
      (named && !best.named) ||
      (named === best.named && quality > best.quality)
    ) {
      best = { nums, quality, named };
    }
  }

  if (best) {
    const strokes = best.nums.filter((n) => n >= 2 && n <= 10);
    const pick =
      strokes.length >= 9 ? strokes.slice(0, 18) : best.nums.slice(0, 18);
    if (
      !isHoleNumberSequence(pick) &&
      !isParLike(pick) &&
      pick.filter((n) => n >= 3 && n <= 7).length >= 5
    ) {
      return toScores(pick);
    }
  }

  // Whole-document scan — still reject hole sequences / par-like
  const numbers: number[] = [];
  const numRe = /\b([1-9]|1[0-5])\b/g;
  let m: RegExpExecArray | null;
  while ((m = numRe.exec(raw)) !== null) {
    numbers.push(parseInt(m[1], 10));
  }

  let bestWindow: number[] | null = null;
  let bestQ = -1;
  for (const len of [18, 9]) {
    for (let i = 0; i + len <= numbers.length; i++) {
      const win = numbers.slice(i, i + len);
      if (isHoleNumberSequence(win)) continue;
      if (isParLike(win)) continue;
      const q = strokeQuality(win);
      if (q > bestQ) {
        bestQ = q;
        bestWindow = win;
      }
    }
  }

  if (bestWindow && bestQ >= 6) {
    return toScores(bestWindow);
  }

  return emptyScores();
}

export function parseOcrText(raw: string): OcrParseResult {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const dateMatch = raw.match(
    /(\d{4})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})/
  );
  let date = todayISO();
  if (dateMatch) {
    const y = dateMatch[1];
    const m = dateMatch[2].padStart(2, "0");
    const d = dateMatch[3].padStart(2, "0");
    date = `${y}-${m}-${d}`;
  }

  const timeMatch = raw.match(/(\d{1,2})\s*[:시]\s*(\d{2})/);
  let time = "08:00";
  if (timeMatch) {
    time = `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}`;
  }

  // SmartScore relative-to-par (PAR row + ± scores) — preferred when detected
  const smart = parseSmartScoreRelative(raw, {
    meNames: ["이수복"],
    fallbackDate: date,
    fallbackTime: time,
  });
  if (smart.matched) {
    return {
      raw,
      courseName: smart.courseName || extractCourseName(raw, lines),
      date: smart.date || date,
      time: smart.time || time,
      frontCourse: smart.frontCourse,
      backCourse: smart.backCourse,
      teeColor: smart.teeColor,
      companions: smart.companions,
      scores: smart.scores,
      players: smart.players,
    };
  }

  const courseName = extractCourseName(raw, lines);
  const { frontCourse, backCourse } = extractFrontBack(raw, lines);

  const playerRows = extractPlayerRows(raw, lines);
  let scores = emptyScores();
  let companions = "";

  if (playerRows.length === 0) {
    scores = extractSingleScoreRun(raw, lines);
  } else {
    const meRows = playerRows.filter(
      (p) => p.isMe || /^(나|저|본인|ME|SELF|MY)$/i.test(p.name)
    );
    const pickRows = meRows.length ? meRows : [playerRows[0]];

    // Merge two 9-hole me rows into 18 when possible
    let candidate = emptyScores();
    if (
      pickRows.length >= 2 &&
      pickRows[0].scores.slice(0, 9).every((s) => s != null) &&
      pickRows[0].scores.slice(9).every((s) => s == null) &&
      pickRows[1].scores.slice(0, 9).every((s) => s != null) &&
      pickRows[1].scores.slice(9).every((s) => s == null)
    ) {
      candidate = padScores([
        ...pickRows[0].scores.slice(0, 9),
        ...pickRows[1].scores.slice(0, 9),
      ]);
    } else {
      candidate = padScores(pickRows[0].scores);
    }

    const vals = candidate.filter((s): s is number => s != null);
    if (isHoleNumberSequence(vals) || strokeQuality(vals) < 3) {
      scores = emptyScores();
    } else {
      scores = candidate;
    }

    const used = new Set(pickRows);
    companions = playerRows
      .filter((p) => !used.has(p) && !p.isMe)
      .map((p) => (p.name || "").trim())
      .filter((n) => n && !/^플레이어\d*$/i.test(n))
      .join(", ");
  }

  // Final safety: never ship a hole-number sequence as scores
  const finalVals = scores.filter((s): s is number => s != null);
  if (finalVals.length >= 9 && isHoleNumberSequence(finalVals)) {
    scores = emptyScores();
  }

  const players: PlayerScores[] = [
    { name: "나", scores: padScores(scores), isMe: true },
  ];

  return {
    raw,
    courseName,
    date,
    time,
    frontCourse,
    backCourse,
    teeColor: DEFAULT_TEE_COLOR,
    companions,
    scores: padScores(scores),
    players,
  };
}

export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
}

export async function terminateOcr(): Promise<void> {
  if (workerPromise) {
    try {
      const w = await workerPromise;
      await w.terminate();
    } catch {
      /* ignore */
    }
    workerPromise = null;
  }
}
