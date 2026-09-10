"use client";

import { useCallback, useEffect, useState } from "react";
import TrendChart from "@/components/TrendChart";
import SampleDataPanel from "@/components/SampleDataPanel";
import { listRounds } from "@/lib/db";
import { computeStats } from "@/lib/stats";
import type { GolfRound } from "@/lib/types";

export default function StatsPage() {
  const [rounds, setRounds] = useState<GolfRound[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRounds(await listRounds());
    } catch (err) {
      console.error(err);
      setRounds([]);
      setError(
        err instanceof Error
          ? err.message
          : "통계를 불러오지 못했습니다."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stats = computeStats(rounds);

  return (
    <main className="page space-y-5">
      <header className="pt-1">
        <h1 className="text-2xl font-semibold text-golf-950">통계</h1>
        <p className="text-base font-medium text-golf-700">
          내 스코어만 집계해요 (기기 안 IndexedDB)
        </p>
      </header>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700">
          {error}
        </p>
      )}

      {loading ? (
        <p className="py-10 text-center text-base font-medium text-golf-600">
          불러오는 중…
        </p>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3">
            <StatTile label="라운드" value={stats.count} />
            <StatTile label="평균" value={stats.average ?? "–"} />
            <StatTile label="베스트" value={stats.best ?? "–"} accent="good" />
            <StatTile label="워스트" value={stats.worst ?? "–"} accent="bad" />
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-golf-950">스코어 추세</h2>
            <TrendChart data={stats.trend} />
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-golf-950">코스별 평균</h2>
            {stats.perCourse.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-golf-300 px-4 py-8 text-center text-base font-medium text-golf-600">
                데이터가 없습니다
              </div>
            ) : (
              <ul className="space-y-2">
                {stats.perCourse.map((c) => (
                  <li
                    key={c.courseName}
                    className="flex items-center justify-between rounded-2xl border border-golf-200 bg-white px-4 py-3.5 shadow-card"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-golf-950">
                        {c.courseName}
                      </p>
                      <p className="text-sm font-medium text-golf-600">
                        {c.count}라운드
                      </p>
                    </div>
                    <span className="text-2xl font-bold text-golf-800">
                      {c.average}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <SampleDataPanel onChanged={load} />
    </main>
  );
}

function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: "good" | "bad";
}) {
  const color =
    accent === "good"
      ? "text-emerald-700"
      : accent === "bad"
        ? "text-orange-700"
        : "text-golf-900";
  return (
    <div className="rounded-2xl border border-golf-200 bg-white p-4 shadow-card">
      <p className="text-sm font-medium text-golf-600">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
