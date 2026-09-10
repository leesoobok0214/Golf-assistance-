"use client";

import { useEffect, useState } from "react";
import { deleteSampleRounds } from "@/lib/db";
import { hasSampleData, seedSampleData } from "@/lib/seed";

export default function SampleDataPanel({ onChanged }: { onChanged?: () => void }) {
  const [hasSample, setHasSample] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setHasSample(await hasSampleData());
  };

  useEffect(() => {
    refresh();
  }, []);

  const seed = async () => {
    setBusy(true);
    try {
      await seedSampleData();
      await refresh();
      onChanged?.();
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm("예시 데이터를 모두 삭제할까요?")) return;
    setBusy(true);
    try {
      await deleteSampleRounds();
      await refresh();
      onChanged?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border-2 border-dashed border-amber-500 bg-amber-50 p-4">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-lg" aria-hidden>
          ⛳
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-extrabold text-amber-950">예시 데이터</p>
          <p className="mt-0.5 text-sm font-medium leading-relaxed text-amber-900">
            앱 기능을 미리 살펴볼 수 있는 <strong>가짜 라운드</strong>입니다. 실제
            기록과 섞이지 않도록 항상 &quot;예시&quot; 배지가 붙습니다. 동반자
            스코어도 포함되어 있어요.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={seed}
              className="rounded-xl bg-amber-600 px-3.5 py-2.5 text-sm font-extrabold text-white disabled:opacity-50"
            >
              {hasSample ? "예시 데이터 다시 넣기" : "예시 데이터 넣기"}
            </button>
            {hasSample && (
              <button
                type="button"
                disabled={busy}
                onClick={remove}
                className="rounded-xl border-2 border-amber-600 bg-white px-3.5 py-2.5 text-sm font-extrabold text-amber-950 disabled:opacity-50"
              >
                예시 데이터 삭제
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
