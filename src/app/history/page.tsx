"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import RoundCard from "@/components/RoundCard";
import ErrorBoundary from "@/components/ErrorBoundary";
import { searchRounds } from "@/lib/db";
import type { GolfRound } from "@/lib/types";

export default function HistoryPage() {
  const [rounds, setRounds] = useState<GolfRound[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "real" | "sample">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (q: string) => {
    setLoading(true);
    setError("");
    try {
      const data = await searchRounds(q);
      setRounds(data);
    } catch (err) {
      console.error(err);
      setRounds([]);
      setError(
        err instanceof Error
          ? err.message
          : "라운드 목록을 불러오지 못했습니다."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(query), 180);
    return () => clearTimeout(t);
  }, [query, load]);

  const filtered = useMemo(() => {
    if (filter === "real") return rounds.filter((r) => !r.isSample);
    if (filter === "sample") return rounds.filter((r) => r.isSample);
    return rounds;
  }, [rounds, filter]);

  return (
    <ErrorBoundary label="history">
    <main className="page space-y-4">
      <header className="flex items-center justify-between pt-1">
        <h1 className="text-2xl font-extrabold text-golf-950">라운드 기록</h1>
        <Link href="/add" className="text-base font-extrabold text-golf-700">
          + 추가
        </Link>
      </header>

      <input
        className="field"
        placeholder="코스·동반자·날짜 검색"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="검색"
      />

      <div className="flex gap-2">
        {(
          [
            ["all", "전체"],
            ["real", "내 기록"],
            ["sample", "예시만"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-full px-3.5 py-2 text-sm font-extrabold transition ${
              filter === key
                ? "bg-golf-700 text-white"
                : "border-2 border-golf-300 bg-white text-golf-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-xl border-2 border-red-300 bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700">
          {error}
        </p>
      )}

      {loading ? (
        <p className="py-10 text-center text-base font-medium text-golf-600">
          불러오는 중…
        </p>
      ) : filtered.length === 0 && !error ? (
        <div className="rounded-2xl border-2 border-dashed border-golf-300 px-4 py-12 text-center text-base font-medium text-golf-600">
          결과가 없습니다
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-bold text-golf-600">
            {filtered.length}개 라운드
          </p>
          {filtered.map((r, i) => (
            <RoundCard key={r.id ?? `round-${i}`} round={r} />
          ))}
        </div>
      )}
    </main>
    </ErrorBoundary>
  );
}
