"use client";

import Link from "next/link";
import TeeChip from "./TeeChip";
import type { GolfRound } from "@/lib/types";
import { calcTotals, companionPlayers, companionsLabel } from "@/lib/types";

export default function RoundCard({ round }: { round: GolfRound }) {
  const comps = companionPlayers(round.players);
  const label = companionsLabel(round.players) || round.companions || "";

  return (
    <Link
      href={`/rounds/${round.id}`}
      className="block rounded-2xl border-2 border-golf-200 bg-white p-4 shadow-card transition active:scale-[0.98]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-lg font-extrabold text-golf-950">
              {round.courseName}
            </h3>
            <TeeChip teeColor={round.teeColor} size="sm" />
            {round.isSample && (
              <span className="shrink-0 rounded-full bg-amber-200 px-2 py-0.5 text-[11px] font-extrabold text-amber-900">
                예시
              </span>
            )}
          </div>
          <p className="mt-1 text-sm font-semibold text-golf-700">
            {round.date}
            {round.time ? ` · ${round.time}` : ""}
          </p>
          {(round.frontCourse || round.backCourse) && (
            <p className="mt-0.5 truncate text-sm font-medium text-golf-600">
              {[round.frontCourse, round.backCourse].filter(Boolean).join(" / ")}
            </p>
          )}
          {label && (
            <p className="mt-1.5 truncate text-sm font-medium text-golf-800">
              동반 {label}
            </p>
          )}
          {comps.some((c) => calcTotals(c.scores).total > 0) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {comps.map((c) => {
                const t = calcTotals(c.scores).total;
                if (!t) return null;
                return (
                  <span
                    key={c.name}
                    className="rounded-lg border border-golf-300 bg-golf-50 px-2 py-0.5 text-xs font-bold text-golf-900"
                  >
                    {c.name} {t}
                  </span>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl border-2 border-golf-300 bg-golf-100">
          <span className="text-2xl font-extrabold leading-none text-golf-900">
            {round.total || "–"}
          </span>
          <span className="text-[10px] font-bold text-golf-600">타</span>
        </div>
      </div>
    </Link>
  );
}
