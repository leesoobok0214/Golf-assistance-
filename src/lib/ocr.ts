"use client";

import { createWorker, type Worker } from "tesseract.js";
import {
  DEFAULT_TEE_COLOR,
  emptyScores,
  normalizeTeeColor,
  padScores,
  type HoleScores,
  type PlayerScores,
  type TeeColor,
} from "./types";

export interface OcrParseResult {
  raw: string;
  courseName: string;
  date: string;
  time: string;
  frontCourse: string;
  backCourse: string;
  /** Detected tee box color, or default when not found (editable). */
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
  // Prefer lines that look like club names
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
    // Penalize mostly numeric / score-like
    const nums = (line.match(/\d+/g) || []).length;
    if (nums >= 3) score -= 5;
    if (score > 0) scored.push({ line, score });
  }
  scored.sort((a, b) => b.score - a.score);
  if (scored[0]) {
    let name = scored[0].line;
    // Trim trailing score-ish tokens
    name = name.replace(/\s+\d{1,3}(\s+\d{1,3}){3,}\s*$/, "").trim();
    name = name.replace(/\s*(전반|후반|OUT|IN)\s*.*$/i, "").trim();
    return name.slice(0, 40);
  }
  // Fallback: first non-noise Korean/English line
  for (const l of lines.slice(0, 8)) {
    const c = cleanName(l);
    if (c && /[가-힣A-Za-z]{2,}/.test(c) && !NOISE_LINE.test(c)) {
      return c.slice(0, 40);
    }
  }
  return "";
}

/**
 * Extract front/back (전반/후반) course names from Korean scorecards.
 * Patterns: "전반 레이크", "OUT : Lake", "후반:사이드", "레이크 / 사이드" near 전반·후반.
 */
function extractFrontBack(raw: string, lines: string[]): {
  frontCourse: string;
  backCourse: string;
} {
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
    // Drop if it's only numbers
    if (!rest || /^[\d\s]+$/.test(rest)) return "";
    // Keep short course nicknames
    const token = rest.split(/\s{2,}|\s*[|/]\s*/)[0]?.trim() ?? rest;
    return cleanName(token).slice(0, 20);
  };

  frontCourse =
    pickAfter(/(?:전반|OUT|Front)\s*[:：\-]?\s*([^\n]{1,24})/i, raw) ||
    pickAfter(/(?:전반\s*코스)\s*[:：\-]?\s*([^\n]{1,24})/i, raw);

  backCourse =
    pickAfter(/(?:후반|IN|Back)\s*[:：\-]?\s*([^\n]{1,24})/i, raw) ||
    pickAfter(/(?:후반\s*코스)\s*[:：\-]?\s*([^\n]{1,24})/i, raw);

  // "레이크 / 사이드" or "동코스 - 서코스" style pair on one line
  if (!frontCourse || !backCourse) {
    for (const line of lines) {
      const pair = line.match(
        /([가-힣A-Za-z][가-힣A-Za-z0-9]{0,10})\s*[\/·\-–~〜]\s*([가-힣A-Za-z][가-힣A-Za-z0-9]{0,10})/
      );
      if (pair && /전반|후반|OUT|IN|코스|course/i.test(line + raw.slice(0, 200))) {
        if (!frontCourse) frontCourse = cleanName(pair[1]).slice(0, 20);
        if (!backCourse) backCourse = cleanName(pair[2]).slice(0, 20);
        break;
      }
    }
  }

  // Line-local: "전반 레이크" as whole short line
  if (!frontCourse) {
    for (const line of lines) {
      const m = line.match(/^(?:전반|OUT)\s*[:：\-]?\s*([가-힣A-Za-z][가-힣A-Za-z0-9]{0,12})\s*$/i);
      if (m) {
        frontCourse = cleanName(m[1]).slice(0, 20);
        break;
      }
    }
  }
  if (!backCourse) {
    for (const line of lines) {
      const m = line.match(/^(?:후반|IN)\s*[:：\-]?\s*([가-힣A-Za-z][가-힣A-Za-z0-9]{0,12})\s*$/i);
      if (m) {
        backCourse = cleanName(m[1]).slice(0, 20);
        break;
      }
    }
  }

  // Avoid echoing labels
  if (/^(전반|후반|OUT|IN)$/i.test(frontCourse)) frontCourse = "";
  if (/^(전반|후반|OUT|IN)$/i.test(backCourse)) backCourse = "";

  return { frontCourse, backCourse };
}

/** Extract integers that look like hole strokes from a line. */
function strokeNumbersFromLine(line: string): number[] {
  const nums: number[] = [];
  const re = /\b([1-9]|1[0-5])\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    nums.push(parseInt(m[1], 10));
  }
  return nums;
}

function isLikelyName(token: string): boolean {
  const t = cleanName(token);
  if (!t || t.length < 2 || t.length > 12) return false;
  if (NOISE_LINE.test(t)) return false;
  if (/^(전반|후반|OUT|IN|PAR|HDCP|TOTAL|합계|나|ME|SELF)$/i.test(t)) return false;
  if (/^[\d\s]+$/.test(t)) return false;
  // Korean 2–4 char name or Latin name
  if (/^[가-힣]{2,4}$/.test(t)) return true;
  if (/^[A-Za-z][A-Za-z.\-]{1,11}$/.test(t)) return true;
  if (/^[가-힣]{2,4}\s*[A-Za-z]?$/.test(t)) return true;
  return false;
}

/**
 * Try to parse multiple player score rows.
 * Heuristics for Korean scorecards:
 * - Line starts with a name, then 9 or 18 stroke numbers
 * - Or clustered runs of 18 stroke-like numbers assigned to detected names
 */
function extractPlayerRows(raw: string, lines: string[]): PlayerScores[] {
  const rows: PlayerScores[] = [];

  for (const line of lines) {
    const nums = strokeNumbersFromLine(line);
    // Need at least 9 stroke-like numbers on the line
    const strokes = nums.filter((n) => n >= 2 && n <= 10);
    if (strokes.length < 9 && nums.length < 9) continue;

    // Name = leading non-numeric token(s)
    const namePart = line
      .replace(/[\d]+/g, " ")
      .replace(/[|:：,，]/g, " ")
      .trim()
      .split(/\s+/)[0];

    const pick =
      strokes.length >= 18
        ? strokes.slice(0, 18)
        : nums.filter((n) => n >= 2 && n <= 12).length >= 18
          ? nums.filter((n) => n >= 2 && n <= 12).slice(0, 18)
          : strokes.length >= 9
            ? strokes.slice(0, 18)
            : nums.slice(0, 18);

    if (pick.length < 9) continue;

    const name = isLikelyName(namePart || "") ? cleanName(namePart) : "";
    const scores = emptyScores();
    pick.slice(0, 18).forEach((v, i) => {
      scores[i] = v;
    });

    // Skip rows that look like PAR/HDCP (all 3–5 and very flat)
    const avg = pick.reduce((a, b) => a + b, 0) / pick.length;
    if (avg >= 3 && avg <= 5.2 && new Set(pick).size <= 3 && !name) {
      // Likely par row without a name
      continue;
    }

    rows.push({
      name: name || `플레이어${rows.length + 1}`,
      scores,
      isMe: false,
    });
  }

  // Deduplicate near-identical score rows
  const unique: PlayerScores[] = [];
  for (const r of rows) {
    const key = r.scores.map((s) => s ?? "x").join(",");
    if (unique.some((u) => u.scores.map((s) => s ?? "x").join(",") === key)) continue;
    unique.push(r);
  }

  // Cap at 4 players (typical foursome)
  return unique.slice(0, 4);
}

function extractSingleScoreRun(raw: string): HoleScores {
  const numbers: number[] = [];
  const numRe = /\b([1-9]|1[0-2])\b/g;
  let m: RegExpExecArray | null;
  while ((m = numRe.exec(raw)) !== null) {
    numbers.push(parseInt(m[1], 10));
  }
  const scores = emptyScores();
  const strokeLike = numbers.filter((n) => n >= 2 && n <= 10);
  const pick =
    strokeLike.length >= 18
      ? strokeLike.slice(-18)
      : numbers.length >= 18
        ? numbers.slice(-18)
        : strokeLike;
  pick.slice(0, 18).forEach((v, i) => {
    scores[i] = v;
  });
  return scores;
}


/**
 * Detect tee markers from OCR text (화이트/블루/레드 or W/B/R near tee keywords).
 * Returns DEFAULT_TEE_COLOR when nothing clear is found — form stays editable.
 */
function extractTeeColor(raw: string): TeeColor {
  const text = raw.replace(/\s+/g, " ");

  // Explicit Korean labels (prefer longer / clearer matches)
  if (/화이트\s*티|화이트티|White\s*Tee|WHITE\s*TEE|백티/i.test(text)) {
    return "white";
  }
  if (/블루\s*티|블루티|Blue\s*Tee|BLUE\s*TEE|청티/i.test(text)) {
    return "blue";
  }
  if (/레드\s*티|레드티|Red\s*Tee|RED\s*TEE|적티|레이디\s*티/i.test(text)) {
    return "red";
  }

  // Standalone color words near tee / 티 / tee box context
  const nearTee =
    /(?:티|tee|tee\s*box|티박스|티잉)\s*[:：\-]?\s*(화이트|블루|레드|white|blue|red|W|B|R)\b/i;
  const m1 = text.match(nearTee);
  if (m1) {
    const token = m1[1].toLowerCase();
    if (token === "화이트" || token === "white" || token === "w") return "white";
    if (token === "블루" || token === "blue" || token === "b") return "blue";
    if (token === "레드" || token === "red" || token === "r") return "red";
  }

  const colorThenTee =
    /(화이트|블루|레드|white|blue|red)\s*(?:티|tee)/i;
  const m2 = text.match(colorThenTee);
  if (m2) {
    const token = m2[1].toLowerCase();
    if (token === "화이트" || token === "white") return "white";
    if (token === "블루" || token === "blue") return "blue";
    if (token === "레드" || token === "red") return "red";
  }

  // Loose Korean color word anywhere (last resort — only if single color mentioned)
  const hits: TeeColor[] = [];
  if (/화이트|\bWHITE\b/i.test(text)) hits.push("white");
  if (/블루|\bBLUE\b/i.test(text)) hits.push("blue");
  if (/레드|\bRED\b/i.test(text)) hits.push("red");
  if (hits.length === 1) return hits[0];

  return DEFAULT_TEE_COLOR;
}

export function parseOcrText(raw: string): OcrParseResult {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const dateMatch = raw.match(/(\d{4})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})/);
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

  const courseName = extractCourseName(raw, lines);
  const { frontCourse, backCourse } = extractFrontBack(raw, lines);
  const teeColor = normalizeTeeColor(extractTeeColor(raw));

  // Multi-player rows: keep first (or 나/ME) as me scores; other names → companions text only
  const playerRows = extractPlayerRows(raw, lines);
  let scores = emptyScores();
  let companions = "";

  if (playerRows.length === 0) {
    scores = extractSingleScoreRun(raw);
  } else {
    const meIdx = playerRows.findIndex((p) =>
      /^(나|저|본인|ME|SELF|MY)$/i.test(p.name)
    );
    const idx = meIdx >= 0 ? meIdx : 0;
    scores = padScores(playerRows[idx].scores);
    companions = playerRows
      .filter((_, i) => i !== idx)
      .map((p) => (p.name || "").trim())
      .filter((n) => n && !/^플레이어\d*$/i.test(n))
      .join(", ");
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
    teeColor,
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
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
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
