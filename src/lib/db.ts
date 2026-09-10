"use client";

import Dexie, { type Table } from "dexie";
import type { GolfRound, RoundInput } from "./types";
import {
  calcTotals,
  companionsLabel,
  normalizePlayers,
  padScores,
} from "./types";

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
  }
}

export const db =
  typeof window !== "undefined" ? new GolfDB() : (null as unknown as GolfDB);

/** Ensure legacy rows load with players[]. */
export function hydrateRound(raw: GolfRound): GolfRound {
  const { scores, players, companions } = normalizePlayers({
    scores: raw.scores,
    players: raw.players,
    companions: raw.companions,
  });
  const totals = calcTotals(scores);
  return {
    ...raw,
    scores,
    players,
    companions,
    outTotal: raw.outTotal || totals.outTotal,
    inTotal: raw.inTotal || totals.inTotal,
    total: raw.total || totals.total,
  };
}

export async function listRounds(): Promise<GolfRound[]> {
  const rows = await db.rounds.orderBy("date").reverse().toArray();
  return rows.map(hydrateRound);
}

export async function getRound(id: number): Promise<GolfRound | undefined> {
  const row = await db.rounds.get(id);
  return row ? hydrateRound(row) : undefined;
}

export async function saveRound(input: RoundInput): Promise<number> {
  const now = Date.now();
  const { scores, players, companions } = normalizePlayers({
    scores: input.scores,
    players: input.players,
    companions: input.companions,
  });
  const { outTotal, inTotal, total } = calcTotals(scores);
  const record: GolfRound = {
    courseName: input.courseName.trim() || "무명 코스",
    date: input.date,
    time: input.time,
    frontCourse: input.frontCourse.trim(),
    backCourse: input.backCourse.trim(),
    companions,
    scores: padScores(scores),
    players,
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
  return db.rounds.add(record);
}

export async function deleteRound(id: number): Promise<void> {
  await db.rounds.delete(id);
}

export async function deleteSampleRounds(): Promise<number> {
  const samples = await db.rounds.filter((r) => r.isSample === true).toArray();
  await db.rounds.bulkDelete(samples.map((r) => r.id!).filter(Boolean));
  return samples.length;
}

export async function clearAllRounds(): Promise<void> {
  await db.rounds.clear();
}

export async function searchRounds(query: string): Promise<GolfRound[]> {
  const all = await listRounds();
  const q = query.trim().toLowerCase();
  if (!q) return all;
  return all.filter((r) => {
    const companionText =
      companionsLabel(r.players) || (r.companions ?? "");
    const playerNames = (r.players ?? []).map((p) => p.name).join(" ");
    return (
      r.courseName.toLowerCase().includes(q) ||
      r.frontCourse.toLowerCase().includes(q) ||
      r.backCourse.toLowerCase().includes(q) ||
      companionText.toLowerCase().includes(q) ||
      playerNames.toLowerCase().includes(q) ||
      r.date.includes(q)
    );
  });
}
