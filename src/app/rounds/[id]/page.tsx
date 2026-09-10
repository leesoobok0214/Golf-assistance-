"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import ErrorBoundary from "@/components/ErrorBoundary";
import ScorecardGrid from "@/components/ScorecardGrid";
import TeeChip from "@/components/TeeChip";
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
      alert(
        err instanceof Error ? err.message : "삭제에 실패했습니다."
      );
    }
  };

  if (loading) {
    return (
      <main className="page">
        <p className="py-16 text-center text-base font-medium text-golf-600">
          불러오는 중…
        </p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="page space-y-4">
        <p className="rounded-2xl border-2 border-red-300 bg-red-50 px-4 py-6 text-center text-base font-semibold text-red-700">
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
        <p className="py-10 text-center text-base font-medium text-golf-700">
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
        <header className="space-y-2 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-extrabold text-golf-950">
              {round.courseName || "무명 코스"}
            </h1>
            <TeeChip teeColor={round.teeColor} size="md" />
            {round.isSample && (
              <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[11px] font-extrabold text-amber-900">
                예시
              </span>
            )}
          </div>
          <p className="text-base font-semibold text-golf-700">
            {round.date || ""}
            {round.time ? ` · ${round.time}` : ""}
          </p>
          {(round.frontCourse || round.backCourse) && (
            <p className="text-sm font-medium text-golf-600">
              {[round.frontCourse, round.backCourse].filter(Boolean).join(" / ")}
            </p>
          )}
          {companionNames && (
            <p className="text-sm font-medium text-golf-800">
              동반 {companionNames}
            </p>
          )}
        </header>

        <section className="grid grid-cols-3 gap-2">
          <SummaryTile label="OUT" value={outVal || "–"} />
          <SummaryTile label="IN" value={inVal || "–"} />
          <SummaryTile label="TOTAL" value={totalVal || "–"} emphasize />
        </section>

        <ScorecardGrid
          scores={meScores}
          frontLabel={round.frontCourse || "전반"}
          backLabel={round.backCourse || "후반"}
        />

        <div className="flex gap-2">
          <Link href="/history" className="btn-secondary flex-1 text-center">
            목록
          </Link>
          <button
            type="button"
            onClick={onDelete}
            className="btn-secondary flex-1 !border-red-400 !text-red-700"
          >
            삭제
          </button>
        </div>
      </main>
    </ErrorBoundary>
  );
}

function SummaryTile({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string | number;
  emphasize?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border-2 px-3 py-3 text-center shadow-card ${
        emphasize
          ? "border-golf-700 bg-golf-800 text-white"
          : "border-golf-200 bg-white text-golf-950"
      }`}
    >
      <p
        className={`text-xs font-bold ${
          emphasize ? "text-white/80" : "text-golf-600"
        }`}
      >
        {label}
      </p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums">{value}</p>
    </div>
  );
}
