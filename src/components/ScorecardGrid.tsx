"use client";

import {
  calcTotals,
  formatRelative,
  formatScore,
  padPars,
  padScores,
  relativeToPar,
  strokeFromRelative,
  type HolePars,
  type HoleScores,
} from "@/lib/types";

interface Props {
  scores: HoleScores | undefined | null;
  pars?: HolePars | undefined | null;
  editable?: boolean;
  onChange?: (scores: HoleScores) => void;
  onParsChange?: (pars: HolePars) => void;
  frontLabel?: string;
  backLabel?: string;
  compact?: boolean;
  playerName?: string;
}

export default function ScorecardGrid({
  scores,
  pars,
  editable = false,
  onChange,
  onParsChange,
  frontLabel = "전반",
  backLabel = "후반",
  compact = false,
  playerName,
}: Props) {
  const safe = padScores(scores);
  const safePars = padPars(pars);
  const { outTotal, inTotal, total } = calcTotals(safe);
  const canEditPars = editable && !!onParsChange;
  const meLabel = playerName?.trim() || "나";

  const setAbsolute = (idx: number, raw: string) => {
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

  const setRelative = (idx: number, raw: string) => {
    if (!onChange) return;
    const next = [...safe] as HoleScores;
    const trimmed = raw.trim().replace(/[−ㅡ]/g, "-");
    if (trimmed === "" || trimmed === "+" || trimmed === "-") {
      next[idx] = null;
      onChange(next);
      return;
    }
    const n = parseInt(trimmed, 10);
    if (!Number.isFinite(n)) return;
    const rel = Math.min(8, Math.max(-2, n));
    const stroke = strokeFromRelative(safePars[idx], rel);
    next[idx] = stroke;
    onChange(next);
  };

  const setPar = (idx: number, raw: string) => {
    if (!onParsChange) return;
    const next = [...safePars] as HolePars;
    if (raw === "" || raw === "-") {
      next[idx] = null;
    } else {
      const n = parseInt(raw, 10);
      if (!Number.isFinite(n)) return;
      next[idx] = Math.min(6, Math.max(3, n));
    }
    onParsChange(next);
  };

  const cellPad = compact ? "py-1.5 text-sm" : "min-h-[40px] py-2 text-base";
  const labelCls = compact
    ? "w-8 shrink-0 px-0.5 text-[9px] font-semibold tracking-wide text-golf-500"
    : "w-9 shrink-0 px-1 text-[10px] font-semibold tracking-wide text-golf-500";

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

      <div className="space-y-px bg-golf-100 p-px">
        {/* HOLE row */}
        <div className="flex bg-white">
          <div
            className={`flex items-center justify-center bg-golf-50/80 ${labelCls}`}
          >
            HOLE
          </div>
          <div className="grid min-w-0 flex-1 grid-cols-9 gap-px bg-golf-100">
            {Array.from({ length: 9 }, (_, i) => {
              const hole = offset + i + 1;
              return (
                <div
                  key={hole}
                  className={`flex items-center justify-center bg-golf-50/80 font-medium tabular-nums text-golf-500 ${
                    compact ? "h-6 text-[10px]" : "h-7 text-[11px]"
                  }`}
                >
                  {hole}
                </div>
              );
            })}
          </div>
        </div>

        {/* PAR row */}
        <div className="flex bg-white">
          <div
            className={`flex items-center justify-center bg-golf-50/60 ${labelCls}`}
          >
            PAR
          </div>
          <div className="grid min-w-0 flex-1 grid-cols-9 gap-px bg-golf-100">
            {Array.from({ length: 9 }, (_, i) => {
              const idx = offset + i;
              const hole = offset + i + 1;
              const par = safePars[idx];
              return (
                <div key={hole} className="min-w-0 bg-white">
                  {canEditPars ? (
                    <input
                      type="number"
                      inputMode="numeric"
                      min={3}
                      max={6}
                      value={par ?? ""}
                      onChange={(e) => setPar(idx, e.target.value)}
                      className={`w-full min-w-0 appearance-none bg-white text-center font-medium tabular-nums text-golf-700 outline-none focus:bg-golf-50 ${cellPad}`}
                      aria-label={`${hole}번 홀 파`}
                    />
                  ) : (
                    <div
                      className={`flex items-center justify-center text-center font-medium tabular-nums text-golf-600 ${cellPad}`}
                    >
                      {formatScore(par)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Score row (relative when par known) */}
        <div className="flex bg-white">
          <div
            className={`flex items-center justify-center bg-golf-50/40 ${labelCls} text-golf-700`}
          >
            {meLabel.length > 2 ? meLabel.slice(0, 2) : meLabel}
          </div>
          <div className="grid min-w-0 flex-1 grid-cols-9 gap-px bg-golf-100">
            {Array.from({ length: 9 }, (_, i) => {
              const idx = offset + i;
              const hole = offset + i + 1;
              const par = safePars[idx];
              const stroke = safe[idx];
              const hasPar = par != null;
              const rel = hasPar ? relativeToPar(stroke, par) : null;

              if (editable && onChange) {
                if (hasPar) {
                  return (
                    <div key={hole} className="min-w-0 bg-white">
                      <input
                        type="number"
                        inputMode="numeric"
                        min={-2}
                        max={8}
                        value={rel ?? ""}
                        onChange={(e) => setRelative(idx, e.target.value)}
                        className={`w-full min-w-0 appearance-none bg-white text-center font-semibold tabular-nums text-golf-950 outline-none focus:bg-golf-50 ${cellPad}`}
                        aria-label={`${meLabel} ${hole}번 홀 파 대비`}
                      />
                    </div>
                  );
                }
                return (
                  <div key={hole} className="min-w-0 bg-white">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={15}
                      value={stroke ?? ""}
                      onChange={(e) => setAbsolute(idx, e.target.value)}
                      className={`w-full min-w-0 appearance-none bg-white text-center font-semibold tabular-nums text-golf-950 outline-none focus:bg-golf-50 ${cellPad}`}
                      aria-label={`${meLabel} ${hole}번 홀 스코어`}
                    />
                  </div>
                );
              }

              return (
                <div
                  key={hole}
                  className={`flex items-center justify-center bg-white text-center font-semibold tabular-nums text-golf-950 ${cellPad}`}
                >
                  {hasPar ? formatRelative(rel) : formatScore(stroke)}
                </div>
              );
            })}
          </div>
        </div>
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
