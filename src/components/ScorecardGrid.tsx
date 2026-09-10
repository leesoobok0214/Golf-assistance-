"use client";

import { calcTotals, padScores, type HoleScores } from "@/lib/types";

interface Props {
  scores: HoleScores | undefined | null;
  editable?: boolean;
  onChange?: (scores: HoleScores) => void;
  frontLabel?: string;
  backLabel?: string;
  /** Compact mode for companion rows */
  compact?: boolean;
  playerName?: string;
}

export default function ScorecardGrid({
  scores,
  editable = false,
  onChange,
  frontLabel = "전반",
  backLabel = "후반",
  compact = false,
  playerName,
}: Props) {
  const safe = padScores(scores);
  const { outTotal, inTotal, total } = calcTotals(safe);

  const setHole = (idx: number, raw: string) => {
    if (!onChange) return;
    const next = [...safe] as HoleScores;
    if (raw === "" || raw === "-") {
      next[idx] = null;
    } else {
      const n = parseInt(raw, 10);
      if (!Number.isFinite(n)) return;
      next[idx] = Math.min(15, Math.max(1, n));
    }
    onChange(next);
  };

  const renderNine = (offset: number, label: string, nineTotal: number) => (
    <div className="overflow-hidden rounded-2xl border-2 border-golf-300 bg-white shadow-card">
      <div
        className={`flex items-center justify-between bg-golf-100 px-3 ${
          compact ? "py-1.5" : "py-2.5"
        }`}
      >
        <span className={`font-bold text-golf-900 ${compact ? "text-sm" : "text-base"}`}>
          {label}
          <span className="ml-1.5 font-semibold text-golf-600">
            {offset === 0 ? "OUT" : "IN"}
          </span>
        </span>
        <span className="rounded-full bg-golf-700 px-3 py-1 text-sm font-extrabold text-white">
          {nineTotal || "–"}
        </span>
      </div>
      <div className="grid grid-cols-9 gap-0.5 bg-golf-300 p-0.5">
        {Array.from({ length: 9 }, (_, i) => {
          const hole = offset + i + 1;
          const idx = offset + i;
          return (
            <div key={hole} className="bg-white">
              <div
                className={`bg-golf-50 text-center font-bold text-golf-700 ${
                  compact ? "py-0.5 text-[11px]" : "py-1.5 text-xs"
                }`}
              >
                {hole}
              </div>
              {editable ? (
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={15}
                  value={safe[idx] ?? ""}
                  onChange={(e) => setHole(idx, e.target.value)}
                  className={`w-full appearance-none bg-white text-center font-extrabold text-golf-950 outline-none focus:bg-golf-50 ${
                    compact ? "py-2 text-base" : "min-h-[48px] py-3 text-xl"
                  }`}
                  aria-label={`${playerName ? playerName + " " : ""}${hole}번 홀 스코어`}
                />
              ) : (
                <div
                  className={`text-center font-extrabold text-golf-950 ${
                    compact ? "py-2 text-base" : "min-h-[48px] py-3 text-xl"
                  }`}
                >
                  {safe[idx] ?? "–"}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {playerName && (
        <p className="text-sm font-extrabold text-golf-900">{playerName}</p>
      )}
      {renderNine(0, frontLabel || "전반", outTotal)}
      {renderNine(9, backLabel || "후반", inTotal)}
      <div
        className={`flex items-center justify-between rounded-2xl bg-golf-800 px-4 text-white shadow-soft ${
          compact ? "py-2.5" : "py-3.5"
        }`}
      >
        <span className="text-sm font-bold tracking-wide opacity-95">TOTAL</span>
        <span className={`font-extrabold tracking-tight ${compact ? "text-2xl" : "text-3xl"}`}>
          {total || "–"}
        </span>
      </div>
    </div>
  );
}
