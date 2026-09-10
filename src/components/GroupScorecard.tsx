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
  /** Optional 18-hole PAR values. When missing, PAR row is omitted. */
  pars?: (number | null)[] | null;
  /** Hide companion strip (rare). Default shows when companions exist. */
  showCompanionStrip?: boolean;
}

/**
 * Image B — Smart Score “전체 스코어” block:
 * 1) Light grey companion summary strip (name + total)
 * 2) Two dark-header tables (전반 / 후반) with HOLE, optional PAR, every player, blue nine-total
 */
export default function GroupScorecard({
  players,
  frontLabel = "전반",
  backLabel = "후반",
  pars,
  showCompanionStrip = true,
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

  const hasPars =
    Array.isArray(pars) &&
    padScores(pars).slice(0, 18).some((p) => p != null && p > 0);

  return (
    <div className="space-y-3">
      {showCompanionStrip && comps.length > 0 && (
        <CompanionStrip companions={comps} />
      )}

      <div className="space-y-3">
        <p className="px-0.5 text-sm font-extrabold text-golf-950">전체 스코어</p>
        <NineTable
          offset={0}
          title={frontLabel || "전반"}
          rows={rows}
          pars={hasPars ? padScores(pars) : null}
        />
        <NineTable
          offset={9}
          title={backLabel || "후반"}
          rows={rows}
          pars={hasPars ? padScores(pars) : null}
        />
      </div>
    </div>
  );
}

function CompanionStrip({ companions }: { companions: PlayerScores[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#E5E8EB] bg-[#F1F3F5]">
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${companions.length}, minmax(0, 1fr))`,
        }}
      >
        {companions.map((c, i) => {
          const total = calcTotals(c.scores).total;
          return (
            <div
              key={`${c.name}-${i}`}
              className={`flex flex-col items-center justify-center px-2 py-3 ${
                i > 0 ? "border-l border-[#D8DCE0]" : ""
              }`}
            >
              <span className="max-w-full truncate text-xs font-semibold text-[#8B939C]">
                {c.name}
              </span>
              <span className="mt-0.5 text-2xl font-extrabold tabular-nums leading-none text-[#1A1A1A]">
                {total || "–"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NineTable({
  offset,
  title,
  rows,
  pars,
}: {
  offset: number;
  title: string;
  rows: PlayerScores[];
  pars: (number | null)[] | null;
}) {
  const parNine =
    pars?.slice(offset, offset + 9).reduce<number>((s, v) => s + (v ?? 0), 0) ??
    0;

  return (
    <div className="overflow-hidden rounded-xl border border-[#C5CDD6] bg-white shadow-card">
      {/* Course / half header — dark navy */}
      <div className="flex items-center gap-1.5 bg-[#1A3044] px-3 py-2">
        <span className="text-sm leading-none" aria-hidden>
          🚩
        </span>
        <span className="text-sm font-extrabold tracking-tight text-white">
          {title}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse text-center">
          <thead>
            {/* HOLE row */}
            <tr className="bg-[#5B6B7C] text-white">
              <th className="sticky left-0 z-10 bg-[#5B6B7C] px-2 py-1.5 text-left text-[11px] font-extrabold tracking-wide">
                HOLE
              </th>
              {Array.from({ length: 9 }, (_, i) => (
                <th
                  key={offset + i + 1}
                  className="px-0.5 py-1.5 text-[11px] font-bold tabular-nums"
                >
                  {i + 1}
                </th>
              ))}
              <th className="bg-[#4A5A6A] px-1.5 py-1.5 text-[11px] font-extrabold">
                T
              </th>
            </tr>
            {/* Optional PAR row */}
            {pars && (
              <tr className="bg-[#D9E2EC] text-[#3D4F5F]">
                <td className="sticky left-0 z-10 bg-[#D9E2EC] px-2 py-1 text-left text-[11px] font-extrabold">
                  PAR
                </td>
                {Array.from({ length: 9 }, (_, i) => (
                  <td
                    key={i}
                    className="px-0.5 py-1 text-xs font-bold tabular-nums"
                  >
                    {pars[offset + i] ?? "–"}
                  </td>
                ))}
                <td className="px-1.5 py-1 text-xs font-extrabold tabular-nums">
                  {parNine || "–"}
                </td>
              </tr>
            )}
          </thead>
          <tbody>
            {rows.map((row, ri) => {
              const scores = padScores(row.scores);
              const { outTotal, inTotal } = calcTotals(scores);
              const nine = offset === 0 ? outTotal : inTotal;
              const isMe = !!row.isMe;
              const bg = isMe
                ? "bg-[#EEF5FF]"
                : ri % 2 === 0
                  ? "bg-white"
                  : "bg-[#F7F9FB]";
              return (
                <tr key={`${row.name}-${ri}`} className={`${bg} text-[#1A1A1A]`}>
                  <td
                    className={`sticky left-0 z-10 max-w-[76px] truncate px-2 py-2.5 text-left text-sm font-bold ${bg}`}
                  >
                    {isMe ? (
                      <span className="inline-flex max-w-full items-center gap-1">
                        <span className="shrink-0 rounded bg-[#007AFF] px-1 py-0.5 text-[10px] font-extrabold text-white">
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
                  {Array.from({ length: 9 }, (_, i) => (
                    <td
                      key={i}
                      className="px-0.5 py-2.5 text-base font-extrabold tabular-nums leading-none"
                    >
                      {formatScore(scores[offset + i])}
                    </td>
                  ))}
                  <td className="px-1.5 py-2.5 text-base font-extrabold tabular-nums text-[#007AFF]">
                    {nine || "–"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
