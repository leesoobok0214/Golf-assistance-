"use client";

import {
  TEE_COLOR_LABEL,
  normalizeTeeColor,
  type TeeColor,
} from "@/lib/types";

const CHIP_CLASS: Record<TeeColor, string> = {
  white:
    "border-gray-400 bg-white text-gray-800 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]",
  blue: "border-blue-700 bg-blue-600 text-white",
  red: "border-red-700 bg-red-600 text-white",
};

const DOT_CLASS: Record<TeeColor, string> = {
  white: "border border-gray-400 bg-white",
  blue: "bg-blue-500",
  red: "bg-red-500",
};

type Size = "sm" | "md";

export default function TeeChip({
  teeColor,
  size = "sm",
  showLabel = true,
}: {
  teeColor: TeeColor | string | undefined | null;
  size?: Size;
  showLabel?: boolean;
}) {
  const color = normalizeTeeColor(teeColor);
  const label = TEE_COLOR_LABEL[color];
  const pad = size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[11px]";

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border-2 font-extrabold ${CHIP_CLASS[color]} ${pad}`}
      title={`티: ${label}`}
      aria-label={`티 컬러 ${label}`}
    >
      <span
        className={`inline-block rounded-full ${DOT_CLASS[color]} ${
          size === "md" ? "h-2.5 w-2.5" : "h-2 w-2"
        }`}
        aria-hidden
      />
      {showLabel ? label : null}
    </span>
  );
}

/** Segmented tee selector — Smart Score style tabs. */
export function TeeColorTabs({
  value,
  onChange,
  required,
}: {
  value: TeeColor;
  onChange: (c: TeeColor) => void;
  required?: boolean;
}) {
  const options: { id: TeeColor; label: string; selected: string; idle: string }[] =
    [
      {
        id: "white",
        label: "화이트",
        selected:
          "border-gray-500 bg-white text-gray-900 shadow-sm ring-2 ring-golf-600",
        idle: "border-gray-300 bg-white/80 text-gray-600 hover:border-gray-400",
      },
      {
        id: "blue",
        label: "블루",
        selected:
          "border-blue-800 bg-blue-600 text-white shadow-sm ring-2 ring-golf-600",
        idle: "border-blue-300 bg-blue-50 text-blue-800 hover:border-blue-500",
      },
      {
        id: "red",
        label: "레드",
        selected:
          "border-red-800 bg-red-600 text-white shadow-sm ring-2 ring-golf-600",
        idle: "border-red-300 bg-red-50 text-red-800 hover:border-red-500",
      },
    ];

  return (
    <div className="space-y-1.5" role="radiogroup" aria-label="티 컬러">
      <div className="flex items-center justify-between">
        <span className="text-sm font-extrabold text-golf-900">
          티 컬러
          {required && <span className="ml-0.5 text-red-600">*</span>}
        </span>
        <span className="text-xs font-semibold text-golf-600">
          {TEE_COLOR_LABEL[value]}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {options.map((opt) => {
          const active = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(opt.id)}
              className={`flex items-center justify-center gap-1.5 rounded-xl border-2 px-2 py-3 text-sm font-extrabold transition active:scale-[0.98] ${
                active ? opt.selected : opt.idle
              }`}
            >
              <span
                className={`inline-block h-3 w-3 rounded-full border ${
                  opt.id === "white"
                    ? "border-gray-400 bg-white"
                    : opt.id === "blue"
                      ? "border-blue-800 bg-blue-500"
                      : "border-red-800 bg-red-500"
                }`}
                aria-hidden
              />
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
