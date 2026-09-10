import type { RoundInput } from "./types";
import { emptyScores } from "./types";
import { db, saveRound } from "./db";

function scoresFrom(arr: number[]): (number | null)[] {
  const s = emptyScores();
  arr.forEach((v, i) => {
    if (i < 18) s[i] = v;
  });
  return s;
}

const SAMPLE_ROUNDS: RoundInput[] = [
  {
    courseName: "레이크사이드 CC (예시)",
    date: "2026-08-12",
    time: "07:30",
    frontCourse: "레이크",
    backCourse: "사이드",
    teeColor: "blue",
    scores: scoresFrom([5, 4, 4, 5, 3, 4, 5, 4, 5, 4, 5, 3, 4, 5, 4, 4, 5, 4]),
    players: [
      {
        name: "나",
        scores: scoresFrom([5, 4, 4, 5, 3, 4, 5, 4, 5, 4, 5, 3, 4, 5, 4, 4, 5, 4]),
        isMe: true,
      },
    ],
    companions: "김민수, 이서연",
    isSample: true,
  },
  {
    courseName: "남서울 CC (예시)",
    date: "2026-07-20",
    time: "12:40",
    frontCourse: "동코스",
    backCourse: "서코스",
    teeColor: "white",
    scores: scoresFrom([4, 5, 4, 6, 4, 5, 4, 5, 5, 5, 4, 4, 5, 6, 4, 5, 4, 5]),
    players: [
      {
        name: "나",
        scores: scoresFrom([4, 5, 4, 6, 4, 5, 4, 5, 5, 5, 4, 4, 5, 6, 4, 5, 4, 5]),
        isMe: true,
      },
    ],
    companions: "박준호",
    isSample: true,
  },
  {
    courseName: "스카이72 (예시)",
    date: "2026-06-05",
    time: "08:10",
    frontCourse: "오션",
    backCourse: "클래식",
    teeColor: "red",
    scores: scoresFrom([5, 5, 4, 4, 3, 5, 4, 4, 6, 4, 5, 4, 5, 4, 3, 5, 5, 4]),
    players: [
      {
        name: "나",
        scores: scoresFrom([5, 5, 4, 4, 3, 5, 4, 4, 6, 4, 5, 4, 5, 4, 3, 5, 5, 4]),
        isMe: true,
      },
    ],
    companions: "최유진, 정하늘, 한도윤",
    isSample: true,
  },
];

export async function seedSampleData(): Promise<number> {
  const existing = await db.rounds.filter((r) => r.isSample === true).toArray();
  if (existing.length > 0) {
    await db.rounds.bulkDelete(existing.map((r) => r.id!).filter(Boolean));
  }
  let n = 0;
  for (const r of SAMPLE_ROUNDS) {
    await saveRound(r);
    n += 1;
  }
  return n;
}

export async function hasSampleData(): Promise<boolean> {
  const c = await db.rounds.filter((r) => r.isSample === true).count();
  return c > 0;
}
