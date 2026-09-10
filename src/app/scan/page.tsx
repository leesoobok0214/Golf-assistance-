"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import RoundForm from "@/components/RoundForm";
import { recognizeScorecard, type OcrParseResult } from "@/lib/ocr";
import { emptyScores } from "@/lib/types";

type Stage = "pick" | "ocr" | "review";

export default function ScanPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("pick");
  const [preview, setPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [parsed, setParsed] = useState<OcrParseResult | null>(null);

  const runOcr = async (file: File) => {
    setError("");
    setStage("ocr");
    setProgress(0);
    setStatus("준비 중…");
    const url = URL.createObjectURL(file);
    setPreview(url);
    try {
      const result = await recognizeScorecard(file, (p, s) => {
        setProgress(p);
        setStatus(s);
      });
      setParsed(result);
      setStage("review");
    } catch (e) {
      console.error(e);
      setError(
        "OCR에 실패했습니다. 네트워크(언어 데이터)를 확인하거나 수동 입력을 이용해 주세요."
      );
      setParsed({
        raw: "",
        courseName: "",
        date: new Date().toISOString().slice(0, 10),
        time: "08:00",
        frontCourse: "",
        backCourse: "",
        companions: "",
        scores: emptyScores(),
        players: [{ name: "나", scores: emptyScores(), isMe: true }],
      });
      setStage("review");
    }
  };

  const onFile = (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("이미지 파일만 업로드할 수 있어요.");
      return;
    }
    void runOcr(file);
  };

  if (stage === "review" && parsed) {
    return (
      <main className="page space-y-4">
        {preview && (
          <div className="overflow-hidden rounded-2xl border-2 border-golf-300 bg-white shadow-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="스코어카드 미리보기"
              className="max-h-40 w-full object-contain bg-golf-50"
            />
          </div>
        )}
        {error && (
          <p className="rounded-xl border-2 border-red-300 bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700">
            {error}
          </p>
        )}
        <RoundForm
          title="OCR 결과 확인·수정"
          submitLabel="라운드 저장"
          showOcrHint
          initial={{
            courseName: parsed.courseName,
            date: parsed.date,
            time: parsed.time,
            frontCourse: parsed.frontCourse,
            backCourse: parsed.backCourse,
            companions: parsed.companions,
            scores: parsed.scores,
            players: parsed.players,
            ocrRaw: parsed.raw,
          }}
        />
        <button
          type="button"
          className="btn-secondary w-full"
          onClick={() => {
            setStage("pick");
            setParsed(null);
            setPreview(null);
            setError("");
          }}
        >
          다시 스캔하기
        </button>
      </main>
    );
  }

  if (stage === "ocr") {
    return (
      <main className="page flex flex-col items-center justify-center gap-4 pt-16">
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="처리 중"
            className="max-h-48 w-full rounded-2xl object-contain opacity-80"
          />
        )}
        <div className="w-full max-w-xs space-y-2 text-center">
          <p className="text-lg font-extrabold text-golf-900">스코어카드 읽는 중…</p>
          <p className="text-sm font-medium text-golf-700">{status}</p>
          <div className="h-3 overflow-hidden rounded-full border border-golf-300 bg-golf-100">
            <div
              className="h-full rounded-full bg-golf-700 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs font-medium text-golf-600">
            첫 실행 시 언어 데이터 다운로드로 시간이 걸릴 수 있어요
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="page space-y-5">
      <header className="pt-1">
        <h1 className="text-2xl font-extrabold text-golf-950">스코어카드 스캔</h1>
        <p className="mt-1.5 text-base font-medium leading-relaxed text-golf-700">
          종이 스코어카드를 촬영하거나 사진 파일을 올리면, 기기에서 OCR로 읽어
          편집할 수 있어요. 서버로 이미지가 전송되지 않습니다.
        </p>
      </header>

      <div className="overflow-hidden rounded-3xl border-2 border-golf-200 bg-gradient-to-br from-golf-100 to-golf-50 p-6 shadow-card">
        <div className="flex flex-col items-center gap-3 text-center">
          <Image
            src="/icons/icon-192.png"
            alt=""
            width={72}
            height={72}
            className="rounded-2xl"
          />
          <p className="text-base font-bold text-golf-800">
            카드 전체가 잘 보이게 찍어 주세요
          </p>
        </div>
      </div>

      {error && (
        <p className="rounded-xl border-2 border-red-300 bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700">
          {error}
        </p>
      )}

      <button
        type="button"
        className="btn-primary w-full !py-4"
        onClick={() => cameraRef.current?.click()}
      >
        📷 카메라로 촬영
      </button>
      <button
        type="button"
        className="btn-secondary w-full !py-4"
        onClick={() => fileRef.current?.click()}
      >
        🖼️ 앨범에서 선택
      </button>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />

      <div className="rounded-2xl border-2 border-golf-300 bg-white p-4 text-sm font-medium leading-relaxed text-golf-800 shadow-card">
        <p className="font-extrabold text-golf-950">OCR 안내</p>
        <ul className="mt-2 list-disc space-y-1.5 pl-4">
          <li>클라이언트에서 Tesseract.js로 처리합니다 (kor+eng 시도, 실패 시 eng).</li>
          <li>코스명·전반/후반·여러 명 스코어 행을 자동으로 읽어 보려 합니다.</li>
          <li>인식 후 반드시 편집 화면에서 홀 스코어를 확인해 주세요.</li>
          <li>손글씨·빛반사·기울기는 정확도가 떨어질 수 있어요.</li>
        </ul>
      </div>
    </main>
  );
}
