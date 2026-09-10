"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import RoundCard from "@/components/RoundCard";
import SampleDataPanel from "@/components/SampleDataPanel";
import { listRounds } from "@/lib/db";
import { computeStats } from "@/lib/stats";
import type { GolfRound } from "@/lib/types";

export default function HomePage() {
  const [rounds, setRounds] = useState<GolfRound[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listRounds();
      setRounds(data);
    } catch (err) {
      console.error(err);
      setRounds([]);
      setError(
        err instanceof Error
          ? err.message
          : "라운드를 불러오지 못했습니다."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stats = computeStats(rounds);
  const recent = rounds.slice(0, 5);

  return (
    <main className="page space-y-5">
      <header className="flex items-center gap-3 pt-2">
        <Image
          src="/icons/icon-192.png"
          alt="골프비서"
          width={56}
          height={56}
          className="rounded-2xl border-2 border-golf-200 shadow-card"
          priority
        />
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-golf-950">
            골프비서
          </h1>
          <p className="text-base font-medium text-golf-700">
            스코어를 쉽고 또렷하게 기록해요
          </p>
        </div>
      </header>

      {error && (
        <p className="rounded-xl border-2 border-red-300 bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700">
          {error}
        </p>
      )}

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border-2 border-golf-200 bg-white p-4 shadow-card">
          <p className="text-sm font-bold text-golf-600">평균 스코어</p>
          <p className="mt-1 text-3xl font-extrabold text-golf-900">
            {stats.average ?? "–"}
          </p>
        </div>
        <div className="rounded-2xl border-2 border-golf-200 bg-white p-4 shadow-card">
          <p className="text-sm font-bold text-golf-600">라운드 수</p>
          <p className="mt-1 text-3xl font-extrabold text-golf-900">
            {stats.count}
          </p>
        </div>
      </section>

      <Link
        href="/scan"
        className="btn-primary flex w-full flex-col items-center gap-1 !py-5 text-lg"
      >
        <span className="text-2xl" aria-hidden>
          📷
        </span>
        스코어카드 스캔
      </Link>

      <div className="grid grid-cols-3 gap-2">
        <Link
          href="/add"
          className="btn-secondary !px-2 !py-3.5 text-center text-sm"
        >
          ✏️ 수동 입력
        </Link>
        <Link
          href="/history"
          className="btn-secondary !px-2 !py-3.5 text-center text-sm"
        >
          📋 기록
        </Link>
        <Link
          href="/stats"
          className="btn-secondary !px-2 !py-3.5 text-center text-sm"
        >
          📊 통계
        </Link>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-golf-950">최근 라운드</h2>
          <Link href="/history" className="text-sm font-bold text-golf-700">
            전체 보기
          </Link>
        </div>
        {loading ? (
          <p className="py-8 text-center text-base font-medium text-golf-600">
            불러오는 중…
          </p>
        ) : recent.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-golf-300 bg-white/60 px-4 py-10 text-center">
            <p className="text-base font-semibold text-golf-700">
              아직 라운드가 없어요
            </p>
            <p className="mt-1 text-sm font-medium text-golf-600">
              스코어카드를 스캔하거나 수동으로 추가해 보세요
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {recent.map((r) => (
              <RoundCard key={r.id} round={r} />
            ))}
          </div>
        )}
      </section>

      <SampleDataPanel onChanged={load} />
    </main>
  );
}
