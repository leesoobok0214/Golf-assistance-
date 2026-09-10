"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ScorecardGrid from "./ScorecardGrid";
import { TeeColorTabs } from "./TeeChip";
import { saveRound } from "@/lib/db";
import {
  DEFAULT_TEE_COLOR,
  emptyScores,
  normalizePlayers,
  normalizeTeeColor,
  padScores,
  type HoleScores,
  type RoundInput,
  type TeeColor,
} from "@/lib/types";
import { todayISO, nowTime } from "@/lib/ocr";

interface Props {
  initial?: Partial<RoundInput>;
  title?: string;
  submitLabel?: string;
  showOcrHint?: boolean;
}

export default function RoundForm({
  initial,
  title = "라운드 입력",
  submitLabel = "저장하기",
  showOcrHint = false,
}: Props) {
  const router = useRouter();
  const seeded = normalizePlayers({
    scores: initial?.scores,
    players: initial?.players,
    companions: initial?.companions,
  });

  const [courseName, setCourseName] = useState(initial?.courseName ?? "");
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [time, setTime] = useState(initial?.time ?? nowTime());
  const [frontCourse, setFrontCourse] = useState(initial?.frontCourse ?? "");
  const [backCourse, setBackCourse] = useState(initial?.backCourse ?? "");
  const [teeColor, setTeeColor] = useState<TeeColor>(() =>
    normalizeTeeColor(initial?.teeColor ?? DEFAULT_TEE_COLOR)
  );
  const [companions, setCompanions] = useState(seeded.companions);
  const [scores, setScores] = useState<HoleScores>(() =>
    padScores(seeded.scores)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const filledHoles = useMemo(
    () => scores.filter((s) => s != null).length,
    [scores]
  );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!courseName.trim()) {
      setError("코스 이름을 입력해 주세요.");
      return;
    }
    if (!teeColor) {
      setError("티 컬러를 선택해 주세요.");
      return;
    }
    if (filledHoles === 0) {
      setError("최소 한 홀 이상 내 스코어를 입력해 주세요.");
      return;
    }
    setSaving(true);
    try {
      const normalized = normalizePlayers({
        scores,
        companions,
        players: [{ name: "나", scores, isMe: true }],
      });
      const id = await saveRound({
        id: initial?.id,
        courseName,
        date,
        time,
        frontCourse,
        backCourse,
        teeColor,
        scores: normalized.scores,
        players: normalized.players,
        companions: normalized.companions,
        isSample: false,
        ocrRaw: initial?.ocrRaw,
      });
      router.push(`/rounds/${id}`);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "저장에 실패했습니다. 다시 시도해 주세요."
      );
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <h2 className="text-xl font-extrabold text-golf-950">{title}</h2>

      {showOcrHint && (
        <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 px-4 py-3.5 text-sm font-medium text-amber-950">
          OCR 결과는 틀릴 수 있어요. 코스명·전반/후반·티 컬러·스코어를 꼭 확인해 주세요.
        </div>
      )}

      <Field label="코스 이름" required>
        <input
          className="field"
          value={courseName}
          onChange={(e) => setCourseName(e.target.value)}
          placeholder="예: 남서울 CC"
          required
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="날짜">
          <input
            type="date"
            className="field"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <Field label="시간">
          <input
            type="time"
            className="field"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="전반 코스">
          <input
            className="field"
            value={frontCourse}
            onChange={(e) => setFrontCourse(e.target.value)}
            placeholder="예: 동코스"
          />
        </Field>
        <Field label="후반 코스">
          <input
            className="field"
            value={backCourse}
            onChange={(e) => setBackCourse(e.target.value)}
            placeholder="예: 서코스"
          />
        </Field>
      </div>

      <Field label="동반자 (선택)">
        <input
          className="field"
          value={companions}
          onChange={(e) => setCompanions(e.target.value)}
          placeholder="이름만, 쉼표로 구분 (예: 김민수, 이서연)"
          aria-label="동반자 이름"
        />
      </Field>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-base font-extrabold text-golf-900">
            내 스코어
          </label>
          <span className="text-sm font-semibold text-golf-600">
            {filledHoles}/18 홀
          </span>
        </div>

        <TeeColorTabs value={teeColor} onChange={setTeeColor} required />

        <ScorecardGrid
          scores={scores.length ? scores : emptyScores()}
          editable
          onChange={setScores}
          frontLabel={frontCourse || "전반"}
          backLabel={backCourse || "후반"}
        />
      </div>

      {error && (
        <p className="rounded-xl border-2 border-red-300 bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="btn-primary w-full disabled:opacity-60"
      >
        {saving ? "저장 중…" : submitLabel}
      </button>
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-extrabold text-golf-900">
        {label}
        {required && <span className="ml-0.5 text-red-600">*</span>}
      </span>
      {children}
    </label>
  );
}
