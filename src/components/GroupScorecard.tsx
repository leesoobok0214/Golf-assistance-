"use client";

import {
  calcTotals,
  companionPlayers,
  formatScore,
  mePlayer,
  padScores,
  type PlayerScores,
} from "@/lib/types";

interface Props {
  players: PlayerScores[] | undefined | null;
  frontLabel?: string;
  backLabel?: string;
}

/**
 * Smart Score–style combined scorecard: me first, then companions.
 * Two blocks (OUT 1–9 + OUT, then IN 10–18 + IN + TOTAL) with sticky names
 * and large high-contrast numbers for outdoor use.
 */
export default function GroupScorecard({
  players,
  frontLabel = "전반",
  backLabel = "후반",
}: Props) {
  const me = mePlayer(players ?? undefined);
  const comps = companionPlayers(players ?? undefined);
  const rows: PlayerScores[] = [
    { ...me, name: me.name || "나", scores: padScores(me.scores), isMe: true },
    ...comps.map((c) => ({
      ...c,
      scores: padScores(c.scores),
    })),
  ];

  return (
    <div className="space-y-3">
      <NineBlock
        offset={0}
        label={frontLabel || "전반"}
        side="OUT"
        rows={rows}
        showTotal={false}
      />
      <NineBlock
        offset={9}
        label={backLabel || "후반"}
        side="IN"
        rows={rows}
        showTotal
      />
    </div>
  );
}

function NineBlock({
  offset,
  label,
  side,
  rows,
  showTotal,
}: {
  offset: number;
  label: string;
  side: "OUT" | "IN";
  rows: PlayerScores[];
  showTotal: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border-2 border-golf-900 bg-golf-950 shadow-card">
      <div className="flex items-center justify-between bg-golf-900 px-3 py-2">
        <span className="text-sm font-extrabold text-white">
          {label}
          <span className="ml-1.5 font-bold text-golf-200">{side}</span>
        </span>
        {showTotal && (
          <span className="text-xs font-bold uppercase tracking-wide text-golf-200">
            + TOTAL
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-center">
          <thead>
            <tr className="bg-golf-800 text-golf-100">
              <th className="sticky left-0 z-10 bg-golf-800 px-2 py-2 text-left text-xs font-extrabold">
                선수
              </th>
              {Array.from({ length: 9 }, (_, i) => (
                <th
                  key={offset + i + 1}
                  className="px-1 py-2 text-[11px] font-bold tabular-nums"
                >
                  {offset + i + 1}
                </th>
              ))}
              <th className="bg-golf-700 px-1.5 py-2 text-[11px] font-extrabold text-white">
                {side}
              </th>
              {showTotal && (
                <th className="bg-amber-600 px-1.5 py-2 text-[11px] font-extrabold text-white">
                  T
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => {
              const scores = padScores(row.scores);
              const { outTotal, inTotal, total } = calcTotals(scores);
              const nine = offset === 0 ? outTotal : inTotal;
              const isMe = !!row.isMe;
              return (
                <tr
                  key={`${row.name}-${ri}`}
                  className={
                    isMe
                      ? "bg-golf-100 text-golf-950"
                      : ri % 2 === 0
                        ? "bg-white text-golf-950"
                        : "bg-golf-50 text-golf-950"
                  }
                >
                  <td
                    className={`sticky left-0 z-10 max-w-[72px] truncate px-2 py-2.5 text-left text-sm font-extrabold ${
                      isMe
                        ? "bg-golf-100 text-golf-900"
                        : ri % 2 === 0
                          ? "bg-white"
                          : "bg-golf-50"
                    }`}
                  >
                    {isMe ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="rounded bg-golf-800 px-1 py-0.5 text-[10px] font-extrabold text-white">
                          나
                        </span>
                        <span className="truncate">
                          {row.name === "나" ? "" : row.name}
                        </span>
                      </span>
                    ) : (
                      row.name
                    )}
                  </td>
                  {Array.from({ length: 9 }, (_, i) => {
                    const v = scores[offset + i];
                    return (
                      <td
                        key={i}
                        className="px-0.5 py-2.5 text-lg font-extrabold tabular-nums leading-none"
                      >
                        {formatScore(v)}
                      </td>
                    );
                  })}
                  <td className="bg-golf-200 px-1.5 py-2.5 text-lg font-extrabold tabular-nums text-golf-950">
                    {nine || "–"}
                  </td>
                  {showTotal && (
                    <td className="bg-amber-100 px-1.5 py-2.5 text-xl font-extrabold tabular-nums text-golf-950">
                      {total || "–"}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
