"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import ErrorBoundary from "@/components/ErrorBoundary";
import ScorecardGrid from "@/components/ScorecardGrid";
import { deleteRound, getRound } from "@/lib/db";
import type { GolfRound } from "@/lib/types";
import { calcTotals, padScores } from "@/lib/types";

export default function RoundDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);
  const [round, setRound] = useState<GolfRound | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!Number.isFinite(id)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const r = await getRound(id);
      setRound(r ?? null);
    } catch (err) {
      console.error(err);
      setRound(null);
      setError(
        err instanceof Error
          ? err.message
          : "라운드를 불러오지 못했습니다."
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const onDelete = async () => {
    if (!round?.id) return;
    if (!confirm("이 라운드를 삭제할까요?")) return;
    try {
      await deleteRound(round.id);
      router.push("/history");
    } catch (err) {
      alert(err instanceof Error ? err.message : "삭제에 실패했습니다.");
    }
  };

  if (loading) {
    return (
      <main className="page">
        <p className="py-16 text-center text-base text-golf-600">불러오는 중…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="page space-y-4">
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-6 text-center text-base font-medium text-red-700">
          {error}
        </p>
        <Link href="/history" className="btn-secondary block text-center">
          기록으로 돌아가기
        </Link>
      </main>
    );
  }

  if (!round) {
    return (
      <main className="page space-y-4">
        <p className="py-10 text-center text-base text-golf-700">
          라운드를 찾을 수 없어요
        </p>
        <Link href="/history" className="btn-secondary block text-center">
          기록으로 돌아가기
        </Link>
      </main>
    );
  }

  const meScores = padScores(round.scores);
  const meTotals = calcTotals(meScores);
  const outVal = round.outTotal || meTotals.outTotal;
  const inVal = round.inTotal || meTotals.inTotal;
  const totalVal = round.total || meTotals.total;
  const companionNames = (round.companions ?? "").trim();

  return (
    <ErrorBoundary label="round-detail">
      <main className="page space-y-5">
        <header className="space-y-1 pt-1">
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-2xl font-semibold text-golf-950">
              {round.courseName || "무명 코스"}
            </h1>
            {round.isSample && (
              <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
                예시 데이터
              </span>
            )}
          </div>
          <p className="text-base text-golf-600">
            {round.date || ""}
            {round.time ? ` · ${round.time}` : ""}
          </p>
          {(round.frontCourse || round.backCourse) && (
            <p className="text-sm text-golf-500">
              {[round.frontCourse, round.backCourse].filter(Boolean).join(" / ")}
            </p>
          )}
          {companionNames && (
            <p className="text-sm text-golf-600">동반 {companionNames}</p>
          )}
        </header>

        <section className="grid grid-cols-3 gap-2">
          <MiniStat label="OUT" value={outVal} />
          <MiniStat label="IN" value={inVal} />
          <MiniStat label="TOTAL" value={totalVal} highlight />
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-golf-900">내 스코어</h2>
          <ScorecardGrid
            scores={meScores}
            pars={round.pars}
            frontLabel={round.frontCourse || "전반"}
            backLabel={round.backCourse || "후반"}
          />
        </section>

        <div className="flex gap-2">
          <Link href="/history" className="btn-secondary flex-1 text-center">
            목록
          </Link>
          <button
            type="button"
            onClick={onDelete}
            className="btn-secondary flex-1 !border-red-300 !text-red-700"
          >
            삭제
          </button>
        </div>
      </main>
    </ErrorBoundary>
  );
}

function MiniStat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-3 text-center shadow-card ${
        highlight
          ? "border-golf-600 bg-golf-700 text-white"
          : "border-golf-200 bg-white"
      }`}
    >
      <p
        className={`text-xs font-medium ${
          highlight ? "text-golf-100" : "text-golf-500"
        }`}
      >
        {label}
      </p>
      <p className="text-2xl font-bold tabular-nums">{value || "–"}</p>
    </div>
  );
}
