"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ScorecardGrid from "./ScorecardGrid";
import { saveRound } from "@/lib/db";
import {
  calcTotals,
  emptyScores,
  normalizePlayers,
  type HoleScores,
  type PlayerScores,
  type RoundInput,
} from "@/lib/types";
import { todayISO, nowTime } from "@/lib/ocr";

interface Props {
  initial?: Partial<RoundInput>;
  title?: string;
  submitLabel?: string;
  showOcrHint?: boolean;
}

function initPlayers(initial?: Partial<RoundInput>): PlayerScores[] {
  const { players } = normalizePlayers({
    scores: initial?.scores,
    players: initial?.players,
    companions: initial?.companions,
  });
  return players;
}

export default function RoundForm({
  initial,
  title = "라운드 입력",
  submitLabel = "저장하기",
  showOcrHint = false,
}: Props) {
  const router = useRouter();
  const [courseName, setCourseName] = useState(initial?.courseName ?? "");
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [time, setTime] = useState(initial?.time ?? nowTime());
  const [frontCourse, setFrontCourse] = useState(initial?.frontCourse ?? "");
  const [backCourse, setBackCourse] = useState(initial?.backCourse ?? "");
  const [players, setPlayers] = useState<PlayerScores[]>(() => initPlayers(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const meIdx = players.findIndex((p) => p.isMe);
  const meIndex = meIdx >= 0 ? meIdx : 0;
  const meScores = players[meIndex]?.scores ?? emptyScores();

  const filledHoles = useMemo(
    () => meScores.filter((s) => s != null).length,
    [meScores]
  );

  const updatePlayerScores = (index: number, scores: HoleScores) => {
    setPlayers((prev) =>
      prev.map((p, i) => (i === index ? { ...p, scores } : p))
    );
  };

  const updatePlayerName = (index: number, name: string) => {
    setPlayers((prev) =>
      prev.map((p, i) => (i === index ? { ...p, name } : p))
    );
  };

  const addCompanion = () => {
    if (players.length >= 4) return;
    setPlayers((prev) => [
      ...prev,
      { name: "", scores: emptyScores(), isMe: false },
    ]);
  };

  const removeCompanion = (index: number) => {
    setPlayers((prev) => {
      if (prev[index]?.isMe) return prev;
      return prev.filter((_, i) => i !== index);
    });
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!courseName.trim()) {
      setError("코스 이름을 입력해 주세요.");
      return;
    }
    if (filledHoles === 0) {
      setError("최소 한 홀 이상 내 스코어를 입력해 주세요.");
      return;
    }
    setSaving(true);
    try {
      const normalized = normalizePlayers({ players, scores: meScores });
      const id = await saveRound({
        id: initial?.id,
        courseName,
        date,
        time,
        frontCourse,
        backCourse,
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
          OCR 결과는 틀릴 수 있어요. 코스명·전반/후반·동반자 스코어를 꼭 확인해 주세요.
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

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-base font-extrabold text-golf-900">
            내 스코어
          </label>
          <span className="text-sm font-semibold text-golf-600">
            {filledHoles}/18 홀
          </span>
        </div>
        <div className="mb-2">
          <input
            className="field"
            value={players[meIndex]?.name ?? "나"}
            onChange={(e) => updatePlayerName(meIndex, e.target.value)}
            placeholder="내 이름 (선택)"
            aria-label="내 이름"
          />
        </div>
        <ScorecardGrid
          scores={meScores}
          editable
          onChange={(s) => updatePlayerScores(meIndex, s)}
          frontLabel={frontCourse || "전반"}
          backLabel={backCourse || "후반"}
          playerName={undefined}
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-extrabold text-golf-900">동반자 스코어</h3>
          <button
            type="button"
            onClick={addCompanion}
            disabled={players.length >= 4}
            className="rounded-xl border-2 border-golf-500 bg-white px-3 py-2 text-sm font-bold text-golf-800 disabled:opacity-40"
          >
            + 동반자 추가
          </button>
        </div>

        {players.filter((p) => !p.isMe).length === 0 && (
          <p className="rounded-xl border-2 border-dashed border-golf-300 bg-white px-3 py-4 text-sm font-medium text-golf-600">
            동반자를 추가하면 이름과 18홀 스코어를 함께 기록할 수 있어요.
          </p>
        )}

        {players.map((p, index) => {
          if (p.isMe) return null;
          const total = calcTotals(p.scores).total;
          return (
            <div
              key={`comp-${index}`}
              className="space-y-3 rounded-2xl border-2 border-golf-300 bg-golf-50/60 p-3"
            >
              <div className="flex items-center gap-2">
                <input
                  className="field !py-2.5"
                  value={p.name}
                  onChange={(e) => updatePlayerName(index, e.target.value)}
                  placeholder="동반자 이름"
                  aria-label="동반자 이름"
                />
                <span className="shrink-0 rounded-full bg-golf-700 px-2.5 py-1 text-sm font-extrabold text-white">
                  {total || "–"}
                </span>
                <button
                  type="button"
                  onClick={() => removeCompanion(index)}
                  className="shrink-0 rounded-xl border-2 border-red-300 bg-white px-2.5 py-2 text-xs font-bold text-red-700"
                  aria-label="동반자 삭제"
                >
                  삭제
                </button>
              </div>
              <ScorecardGrid
                scores={p.scores}
                editable
                onChange={(s) => updatePlayerScores(index, s)}
                frontLabel={frontCourse || "전반"}
                backLabel={backCourse || "후반"}
                compact
              />
            </div>
          );
        })}
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
