"use client";

import Dexie, { type Table } from "dexie";
import type { GolfRound, RoundInput } from "./types";
import {
  DEFAULT_TEE_COLOR,
  calcTotals,
  emptyScores,
  normalizePlayers,
  normalizeTeeColor,
  padScores,
} from "./types";

export class DbError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "DbError";
    if (cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = cause;
    }
  }
}

export class GolfDB extends Dexie {
  rounds!: Table<GolfRound, number>;

  constructor() {
    super("golf-assistant");
    this.version(1).stores({
      rounds: "++id, date, courseName, total, createdAt, isSample",
    });
    // v2: players[] added; schema indexes unchanged (Dexie keeps old rows)
    this.version(2).stores({
      rounds: "++id, date, courseName, total, createdAt, isSample",
    });
    // v3: migrate legacy rows so every record has players[] + padded scores
    this.version(3)
      .stores({
        rounds: "++id, date, courseName, total, createdAt, isSample",
      })
      .upgrade(async (tx) => {
        const table = tx.table("rounds");
        await table.toCollection().modify((row: GolfRound & Record<string, unknown>) => {
          try {
            const { scores, players, companions } = normalizePlayers({
              scores: row.scores as GolfRound["scores"],
              players: row.players as GolfRound["players"],
              companions: row.companions as string | undefined,
            });
            const totals = calcTotals(scores);
            row.scores = scores;
            row.players = players;
            row.companions = companions;
            row.outTotal =
              (typeof row.outTotal === "number" && row.outTotal > 0
                ? row.outTotal
                : totals.outTotal) || totals.outTotal;
            row.inTotal =
              (typeof row.inTotal === "number" && row.inTotal > 0
                ? row.inTotal
                : totals.inTotal) || totals.inTotal;
            row.total =
              (typeof row.total === "number" && row.total > 0
                ? row.total
                : totals.total) || totals.total;
            if (typeof row.courseName !== "string") row.courseName = "무명 코스";
            if (typeof row.date !== "string") row.date = "";
            if (typeof row.time !== "string") row.time = "";
            if (typeof row.frontCourse !== "string") row.frontCourse = "";
            if (typeof row.backCourse !== "string") row.backCourse = "";
          } catch {
            row.scores = emptyScores();
            row.players = [{ name: "나", scores: emptyScores(), isMe: true }];
            row.companions = "";
            row.outTotal = 0;
            row.inTotal = 0;
            row.total = 0;
          }
        });
      });
    // v4: teeColor (white|blue|red); hydrate legacy rows with default blue
    this.version(4)
      .stores({
        rounds: "++id, date, courseName, total, createdAt, isSample",
      })
      .upgrade(async (tx) => {
        const table = tx.table("rounds");
        await table.toCollection().modify((row: GolfRound & Record<string, unknown>) => {
          row.teeColor = normalizeTeeColor(row.teeColor);
        });
      });
  }
}

export const db =
  typeof window !== "undefined" ? new GolfDB() : (null as unknown as GolfDB);

/** Ensure legacy / partial rows load with safe single me-player + padded scores + teeColor. */
export function hydrateRound(raw: GolfRound | null | undefined): GolfRound {
  if (!raw || typeof raw !== "object") {
    const scores = emptyScores();
    return {
      courseName: "무명 코스",
      date: "",
      time: "",
      frontCourse: "",
      backCourse: "",
      teeColor: DEFAULT_TEE_COLOR,
      companions: "",
      scores,
      players: [{ name: "나", scores, isMe: true }],
      outTotal: 0,
      inTotal: 0,
      total: 0,
      createdAt: 0,
      updatedAt: 0,
    };
  }
  try {
    const { scores, players, companions } = normalizePlayers({
      scores: raw.scores,
      players: raw.players,
      companions: raw.companions,
    });
    const totals = calcTotals(scores);
    return {
      ...raw,
      courseName: raw.courseName || "무명 코스",
      date: raw.date || "",
      time: raw.time || "",
      frontCourse: raw.frontCourse || "",
      backCourse: raw.backCourse || "",
      teeColor: normalizeTeeColor(raw.teeColor),
      scores,
      players,
      companions,
      outTotal: raw.outTotal || totals.outTotal,
      inTotal: raw.inTotal || totals.inTotal,
      total: raw.total || totals.total,
      createdAt: raw.createdAt ?? 0,
      updatedAt: raw.updatedAt ?? 0,
    };
  } catch {
    const scores = padScores(raw.scores);
    const totals = calcTotals(scores);
    return {
      ...raw,
      courseName: raw.courseName || "무명 코스",
      date: raw.date || "",
      time: raw.time || "",
      frontCourse: raw.frontCourse || "",
      backCourse: raw.backCourse || "",
      teeColor: normalizeTeeColor(
        (raw as GolfRound & { teeColor?: unknown }).teeColor
      ),
      scores,
      players: [{ name: "나", scores, isMe: true }],
      companions: typeof raw.companions === "string" ? raw.companions : "",
      outTotal: raw.outTotal || totals.outTotal,
      inTotal: raw.inTotal || totals.inTotal,
      total: raw.total || totals.total,
      createdAt: raw.createdAt ?? 0,
      updatedAt: raw.updatedAt ?? 0,
    };
  }
}

function friendlyDbMessage(err: unknown, fallback: string): string {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  if (/QuotaExceeded|quota/i.test(msg)) {
    return "저장 공간이 부족합니다. 기기 저장 공간을 확인해 주세요.";
  }
  if (/IndexedDB|Dexie|Database|IDB/i.test(msg)) {
    return "데이터 저장소에 문제가 있습니다. 브라우저를 새로고침해 주세요.";
  }
  return fallback;
}

export async function listRounds(): Promise<GolfRound[]> {
  try {
    if (!db) return [];
    const rows = await db.rounds.orderBy("date").reverse().toArray();
    return rows.map((r) => hydrateRound(r));
  } catch (err) {
    console.error("listRounds failed", err);
    throw new DbError(
      friendlyDbMessage(err, "라운드 목록을 불러오지 못했습니다."),
      err
    );
  }
}

export async function getRound(id: number): Promise<GolfRound | undefined> {
  try {
    if (!db || !Number.isFinite(id)) return undefined;
    const row = await db.rounds.get(id);
    return row ? hydrateRound(row) : undefined;
  } catch (err) {
    console.error("getRound failed", err);
    throw new DbError(
      friendlyDbMessage(err, "라운드를 불러오지 못했습니다."),
      err
    );
  }
}

export async function saveRound(input: RoundInput): Promise<number> {
  try {
    if (!db) {
      throw new DbError("브라우저 저장소를 사용할 수 없습니다.");
    }
    const now = Date.now();
    const { scores, players, companions } = normalizePlayers({
      scores: input.scores,
      players: input.players,
      companions: input.companions,
    });
    const { outTotal, inTotal, total } = calcTotals(scores);
    const record: GolfRound = {
      courseName: (input.courseName ?? "").trim() || "무명 코스",
      date: input.date || "",
      time: input.time || "",
      frontCourse: (input.frontCourse ?? "").trim(),
      backCourse: (input.backCourse ?? "").trim(),
      teeColor: normalizeTeeColor(input.teeColor),
      companions,
      scores: padScores(scores),
      players: [
        {
          name: (players[0]?.name || "나").trim() || "나",
          scores: padScores(scores),
          isMe: true,
        },
      ],
      outTotal,
      inTotal,
      total,
      isSample: !!input.isSample,
      ocrRaw: input.ocrRaw,
      createdAt: now,
      updatedAt: now,
    };
    if (input.id != null) {
      const existing = await db.rounds.get(input.id);
      await db.rounds.put({
        ...record,
        id: input.id,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      });
      return input.id;
    }
    const id = await db.rounds.add(record);
    return id as number;
  } catch (err) {
    if (err instanceof DbError) throw err;
    console.error("saveRound failed", err);
    throw new DbError(
      friendlyDbMessage(err, "저장에 실패했습니다. 다시 시도해 주세요."),
      err
    );
  }
}

export async function deleteRound(id: number): Promise<void> {
  try {
    await db.rounds.delete(id);
  } catch (err) {
    console.error("deleteRound failed", err);
    throw new DbError(
      friendlyDbMessage(err, "삭제에 실패했습니다."),
      err
    );
  }
}

export async function deleteSampleRounds(): Promise<number> {
  try {
    const samples = await db.rounds.filter((r) => r.isSample === true).toArray();
    await db.rounds.bulkDelete(samples.map((r) => r.id!).filter(Boolean));
    return samples.length;
  } catch (err) {
    console.error("deleteSampleRounds failed", err);
    throw new DbError(
      friendlyDbMessage(err, "예시 데이터 삭제에 실패했습니다."),
      err
    );
  }
}

export async function clearAllRounds(): Promise<void> {
  try {
    await db.rounds.clear();
  } catch (err) {
    console.error("clearAllRounds failed", err);
    throw new DbError(
      friendlyDbMessage(err, "전체 삭제에 실패했습니다."),
      err
    );
  }
}

export async function searchRounds(query: string): Promise<GolfRound[]> {
  try {
    const all = await listRounds();
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((r) => {
      const companionText = (r.companions ?? "").toLowerCase();
      return (
        (r.courseName ?? "").toLowerCase().includes(q) ||
        (r.frontCourse ?? "").toLowerCase().includes(q) ||
        (r.backCourse ?? "").toLowerCase().includes(q) ||
        companionText.includes(q) ||
        (r.date ?? "").includes(q)
      );
    });
  } catch (err) {
    if (err instanceof DbError) throw err;
    console.error("searchRounds failed", err);
    throw new DbError(
      friendlyDbMessage(err, "검색에 실패했습니다."),
      err
    );
  }
}
