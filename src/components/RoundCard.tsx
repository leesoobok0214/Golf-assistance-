"use client";

import Link from "next/link";
import type { GolfRound } from "@/lib/types";

export default function RoundCard({ round }: { round: GolfRound }) {
  try {
    const id = round.id;
    const companionNames = (round.companions ?? "").trim();

    return (
      <Link
        href={id != null ? `/rounds/${id}` : "/history"}
        className="block rounded-2xl border border-golf-200 bg-white p-4 shadow-card transition active:scale-[0.98]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-lg font-semibold text-golf-950">
                {round.courseName || "무명 코스"}
              </h3>
              {round.isSample && (
                <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                  예시
                </span>
              )}
            </div>
            <p className="mt-1 text-sm font-normal text-golf-600">
              {round.date || ""}
              {round.time ? ` · ${round.time}` : ""}
            </p>
            {(round.frontCourse || round.backCourse) && (
              <p className="mt-0.5 truncate text-sm text-golf-500">
                {[round.frontCourse, round.backCourse].filter(Boolean).join(" / ")}
              </p>
            )}
            {companionNames && (
              <p className="mt-1 truncate text-sm text-golf-600">
                동반 {companionNames}
              </p>
            )}
          </div>
          <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl border border-golf-200 bg-golf-50">
            <span className="text-xl font-bold leading-none text-golf-900">
              {round.total || "–"}
            </span>
            <span className="text-[10px] font-medium text-golf-500">타</span>
          </div>
        </div>
      </Link>
    );
  } catch (err) {
    console.error("RoundCard render failed", err);
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
        이 라운드 카드를 표시하지 못했어요. 상세로 들어가 보거나 삭제해 주세요.
        {round.id != null && (
          <Link
            href={`/rounds/${round.id}`}
            className="mt-2 block font-semibold underline"
          >
            상세 열기
          </Link>
        )}
      </div>
    );
  }
}
