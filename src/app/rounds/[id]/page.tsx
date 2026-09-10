"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import GroupScorecard from "@/components/GroupScorecard";
import TeeChip from "@/components/TeeChip";
import { deleteRound, getRound } from "@/lib/db";
import type { GolfRound, HoleScores } from "@/lib/types";
import {
  calcTotals,
  companionPlayers,
  formatScore,
  mePlayer,
  padScores,
} from "@/lib/types";

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

  const me = mePlayer(round.players);
  const meScores = padScores(me.scores?.length ? me.scores : round.scores);
  const meTotals = calcTotals(meScores);
  const comps = companionPlayers(round.players);
  const outVal = round.outTotal || meTotals.outTotal;
  const inVal = round.inTotal || meTotals.inTotal;
  const totalVal = round.total || meTotals.total;
  const frontBack = [round.frontCourse, round.backCourse]
    .filter(Boolean)
    .join(", ");
  const stamp = formatStamp(round.date, round.time);

  return (
    <main className="mx-auto min-h-[100dvh] max-w-lg space-y-4 px-0 pb-28 pt-0">
      {/* —— Image A: Hero / my score only —— */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#1a3a28] via-[#2d5a3d] to-[#1e4030] px-4 pb-5 pt-3 text-white shadow-soft">
        {/* subtle fairway texture */}
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(ellipse at 20% 0%, rgba(255,255,255,0.18), transparent 50%), radial-gradient(ellipse at 80% 100%, rgba(0,0,0,0.35), transparent 55%)",
          }}
          aria-hidden
        />

        <div className="relative space-y-4">
          {/* Top meta */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-white/80">
                {[me.name || "나", ...comps.map((c) => c.name)]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <p className="mt-0.5 text-xs font-medium text-white/65">{stamp}</p>
            </div>
            {round.isSample && (
              <span className="shrink-0 rounded-full bg-amber-300/90 px-2 py-0.5 text-[10px] font-extrabold text-amber-950">
                예시
              </span>
            )}
          </div>

          {/* Course + large score + tee */}
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0 space-y-1.5">
              <h1 className="truncate text-2xl font-extrabold leading-tight tracking-tight text-white drop-shadow-sm">
                {round.courseName}
              </h1>
              {frontBack && (
                <p className="truncate text-sm font-semibold text-white/80">
                  {frontBack}
                </p>
              )}
              <TeeChip teeColor={round.teeColor} size="md" locale="en" />
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[56px] font-extrabold leading-none tracking-tight text-white drop-shadow-md">
                {totalVal || "–"}
              </p>
            </div>
          </div>

          {/* My scorecard only — two rows of 9 + OUT/IN subtotals */}
          <MyHeroScorecard
            scores={meScores}
            outTotal={outVal}
            inTotal={inVal}
          />
        </div>
      </section>

      {/* —— Image B: companion strip + 전체 스코어 tables —— */}
      <section className="space-y-3 px-4">
        {/* Compact identity strip echoing Image B header */}
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#E5E8EB] bg-white px-4 py-3 shadow-card">
          <div className="min-w-0">
            <p className="truncate text-lg font-extrabold text-[#1A1A1A]">
              {round.courseName}
            </p>
            <p className="text-xs font-semibold text-[#8B939C]">{stamp}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-3xl font-extrabold leading-none tabular-nums text-[#007AFF]">
              {totalVal || "–"}
            </p>
            <p className="mt-0.5 text-sm font-bold text-[#1A1A1A]">
              {me.name || "나"}
            </p>
          </div>
        </div>

        <GroupScorecard
          players={round.players}
          frontLabel={
            round.frontCourse && round.backCourse
              ? `${round.frontCourse}`
              : round.frontCourse || "전반"
          }
          backLabel={
            round.frontCourse && round.backCourse
              ? `${round.backCourse}`
              : round.backCourse || "후반"
          }
        />
      </section>

      <div className="flex gap-2 px-4">
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
  );
}

/** Image A — MY scorecard only: two dark rows of 9 holes + gold subtotals. */
function MyHeroScorecard({
  scores,
  outTotal,
  inTotal,
}: {
  scores: HoleScores;
  outTotal: number;
  inTotal: number;
}) {
  const safe = padScores(scores);
  return (
    <div className="space-y-1.5">
      <NineRow scores={safe.slice(0, 9)} subtotal={outTotal} />
      <NineRow scores={safe.slice(9, 18)} subtotal={inTotal} />
    </div>
  );
}

function NineRow({
  scores,
  subtotal,
}: {
  scores: (number | null)[];
  subtotal: number;
}) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-white/35 bg-black/35 backdrop-blur-[2px]">
      <div className="grid flex-1 grid-cols-9">
        {Array.from({ length: 9 }, (_, i) => (
          <div
            key={i}
            className={`flex min-h-[40px] items-center justify-center border-white/25 ${
              i < 8 ? "border-r" : ""
            }`}
          >
            <span className="text-base font-extrabold tabular-nums leading-none text-white">
              {formatScore(scores[i])}
            </span>
          </div>
        ))}
      </div>
      <div className="flex min-w-[48px] items-center justify-center border-l border-white/35 bg-black/25 px-2">
        <span className="text-base font-extrabold tabular-nums text-[#D4C48A]">
          {subtotal || "–"}
        </span>
      </div>
    </div>
  );
}

/** Format like Image A/B: 2026.09.09 13:37 */
function formatStamp(date: string, time: string): string {
  const d = (date || "").replace(/-/g, ".");
  if (!d) return time || "";
  return time ? `${d} ${time}` : d;
}
