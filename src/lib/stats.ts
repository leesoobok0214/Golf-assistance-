import type { GolfRound, PlayerScores } from "./types";
import { calcTotals, companionPlayers, padScores } from "./types";

export interface StatsSummary {
  count: number;
  average: number | null;
  best: number | null;
  worst: number | null;
  trend: { date: string; total: number; courseName: string }[];
  perCourse: { courseName: string; count: number; average: number }[];
  companionStats: {
    name: string;
    rounds: number;
    average: number | null;
  }[];
}

function playerTotal(p: PlayerScores): number {
  return calcTotals(padScores(p?.scores)).total;
}

export function computeStats(rounds: GolfRound[]): StatsSummary {
  const real = (rounds ?? []).filter((r) => (r?.total ?? 0) > 0);
  if (real.length === 0) {
    return {
      count: 0,
      average: null,
      best: null,
      worst: null,
      trend: [],
      perCourse: [],
      companionStats: [],
    };
  }
  const totals = real.map((r) => r.total);
  const sum = totals.reduce((a, b) => a + b, 0);
  const average = Math.round((sum / totals.length) * 10) / 10;
  const best = Math.min(...totals);
  const worst = Math.max(...totals);

  const chronological = [...real].sort((a, b) =>
    a.date === b.date ? a.createdAt - b.createdAt : a.date.localeCompare(b.date)
  );
  const trend = chronological.map((r) => ({
    date: r.date,
    total: r.total,
    courseName: r.courseName,
  }));

  const byCourse = new Map<string, number[]>();
  for (const r of real) {
    const key = r.courseName || "무명 코스";
    const arr = byCourse.get(key) ?? [];
    arr.push(r.total);
    byCourse.set(key, arr);
  }
  const perCourse = Array.from(byCourse.entries())
    .map(([courseName, scores]) => ({
      courseName,
      count: scores.length,
      average:
        Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
    }))
    .sort((a, b) => a.average - b.average);

  const byCompanion = new Map<string, number[]>();
  for (const r of real) {
    for (const c of companionPlayers(r.players)) {
      const t = playerTotal(c);
      const arr = byCompanion.get(c.name) ?? [];
      arr.push(t);
      byCompanion.set(c.name, arr);
    }
  }
  const companionStats = Array.from(byCompanion.entries())
    .map(([name, scores]) => {
      const scored = scores.filter((s) => s > 0);
      return {
        name,
        rounds: scores.length,
        average:
          scored.length > 0
            ? Math.round(
                (scored.reduce((a, b) => a + b, 0) / scored.length) * 10
              ) / 10
            : null,
      };
    })
    .sort((a, b) => b.rounds - a.rounds);

  return {
    count: real.length,
    average,
    best,
    worst,
    trend,
    perCourse,
    companionStats,
  };
}
