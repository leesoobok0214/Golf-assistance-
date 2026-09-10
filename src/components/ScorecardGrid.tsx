"use client";

import { calcTotals, padScores, type HoleScores } from "@/lib/types";

interface Props {
  scores: HoleScores | undefined | null;
  editable?: boolean;
  onChange?: (scores: HoleScores) => void;
  frontLabel?: string;
  backLabel?: string;
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
    <div className="overflow-hidden rounded-2xl border border-golf-200 bg-white shadow-card">
      <div
        className={`flex items-center justify-between bg-golf-50 px-3 ${
          compact ? "py-1.5" : "py-2"
        }`}
      >
        <span className="text-sm font-semibold text-golf-800">
          {label}
          <span className="ml-1.5 font-medium text-golf-500">
            {offset === 0 ? "OUT" : "IN"}
          </span>
        </span>
        <span className="rounded-full bg-golf-100 px-2.5 py-0.5 text-sm font-semibold text-golf-800">
          {nineTotal || "–"}
        </span>
      </div>

      {/* One cell = hole label + score. Equal 9 columns; no truncate so 10–18 stay visible. */}
      <div className="grid grid-cols-9 gap-px bg-golf-100 p-px">
        {Array.from({ length: 9 }, (_, i) => {
          const hole = offset + i + 1;
          const idx = offset + i;
          return (
            <div key={hole} className="min-w-0 bg-white">
              <div
                className={`flex h-6 items-center justify-center bg-golf-50/80 px-0 text-center font-medium tabular-nums leading-none text-golf-500 ${
                  compact ? "text-[10px]" : "text-[11px]"
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
                  className={`w-full min-w-0 appearance-none bg-white text-center font-semibold tabular-nums text-golf-950 outline-none focus:bg-golf-50 ${
                    compact ? "py-2 text-base" : "min-h-[44px] py-2.5 text-lg"
                  }`}
                  aria-label={`${playerName ? playerName + " " : ""}${hole}번 홀 스코어`}
                />
              ) : (
                <div
                  className={`flex items-center justify-center text-center font-semibold tabular-nums text-golf-950 ${
                    compact ? "py-2 text-base" : "min-h-[44px] py-2.5 text-lg"
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
        <p className="text-sm font-semibold text-golf-800">{playerName}</p>
      )}
      {renderNine(0, frontLabel || "전반", outTotal)}
      {renderNine(9, backLabel || "후반", inTotal)}
      <div
        className={`flex items-center justify-between rounded-2xl border border-golf-200 bg-white px-4 shadow-card ${
          compact ? "py-2.5" : "py-3"
        }`}
      >
        <span className="text-sm font-medium tracking-wide text-golf-600">
          TOTAL
        </span>
        <span
          className={`font-bold tracking-tight tabular-nums text-golf-900 ${
            compact ? "text-xl" : "text-2xl"
          }`}
        >
          {total || "–"}
        </span>
      </div>
    </div>
  );
}
