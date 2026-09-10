"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import ScorecardGrid from "@/components/ScorecardGrid";
import { deleteRound, getRound } from "@/lib/db";
import type { GolfRound } from "@/lib/types";
import { calcTotals, companionPlayers, mePlayer } from "@/lib/types";

export default function RoundDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);
  const [round, setRound] = useState<GolfRound | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!Number.isFinite(id)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const r = await getRound(id);
      setRound(r ?? null);
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
    await deleteRound(round.id);
    router.push("/history");
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
  const comps = companionPlayers(round.players);

  return (
    <main className="page space-y-5">
      <header className="space-y-1 pt-1">
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-2xl font-extrabold text-golf-950">{round.courseName}</h1>
          {round.isSample && (
            <span className="shrink-0 rounded-full bg-amber-200 px-2.5 py-1 text-xs font-extrabold text-amber-900">
              예시 데이터
            </span>
          )}
        </div>
        <p className="text-base font-semibold text-golf-700">
          {round.date}
          {round.time ? ` · ${round.time}` : ""}
        </p>
      </header>

      <section className="grid grid-cols-3 gap-2">
        <MiniStat label="OUT" value={round.outTotal} />
        <MiniStat label="IN" value={round.inTotal} />
        <MiniStat label="TOTAL" value={round.total} highlight />
      </section>

      <section className="rounded-2xl border-2 border-golf-300 bg-white p-4 shadow-card space-y-2.5 text-base">
        {(round.frontCourse || round.backCourse) && (
          <Row
            label="코스"
            value={[
              round.frontCourse && `전반 ${round.frontCourse}`,
              round.backCourse && `후반 ${round.backCourse}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          />
        )}
        {comps.length > 0 && (
          <Row
            label="동반자"
            value={comps
              .map((c) => {
                const t = calcTotals(c.scores).total;
                return t > 0 ? `${c.name} ${t}타` : c.name;
              })
              .join(", ")}
          />
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-extrabold text-golf-950">
          {me.name || "나"} · 내 스코어
        </h2>
        <ScorecardGrid
          scores={round.scores}
          frontLabel={round.frontCourse || "전반"}
          backLabel={round.backCourse || "후반"}
        />
      </section>

      {comps.map((c) => (
        <section key={c.name} className="space-y-2">
          <h2 className="text-base font-extrabold text-golf-950">
            {c.name}
            <span className="ml-2 text-sm font-bold text-golf-600">
              {calcTotals(c.scores).total || "–"}타
            </span>
          </h2>
          <ScorecardGrid
            scores={c.scores}
            frontLabel={round.frontCourse || "전반"}
            backLabel={round.backCourse || "후반"}
            compact
          />
        </section>
      ))}

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
      className={`rounded-2xl border-2 p-3 text-center shadow-card ${
        highlight
          ? "border-golf-800 bg-golf-800 text-white"
          : "border-golf-300 bg-white"
      }`}
    >
      <p
        className={`text-xs font-bold ${
          highlight ? "text-golf-100" : "text-golf-600"
        }`}
      >
        {label}
      </p>
      <p className="text-2xl font-extrabold">{value || "–"}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="w-16 shrink-0 font-extrabold text-golf-700">{label}</span>
      <span className="font-semibold text-golf-950">{value}</span>
    </div>
  );
}
