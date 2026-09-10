/**
 * Vision Hills + Roseviang SmartScore parse regression.
 * Run: npx --yes tsx scripts/test-vision-hills.ts
 */
import { parseOcrText } from "../src/lib/ocr";
import { parseSmartScoreRelative, signedIntsFromLine } from "../src/lib/smartscore";
import { calcTotals } from "../src/lib/types";

const VISION_HILLS = `
비전힐스              92
2026.06.03 12:30                                              이수복
김승주          이종훈          김영민
89          100          94
HOLE 1 2 3 4 5 6 7 8 9 T
PAR 4 5 4 3 5 4 3 4 4 36
이복 0 0 4 1 2 1 2 2 0 48
김승주 0 0 2 0 2 3 1 0 1 45
HOLE 1 2 3 4 5 6 7 8 9 T
PAR 5 4 4 3 5 4 4 3 4 36
o= 0 3 0 0 2 3 1 -1 0 44
김승주 2 1 0 1 2 0 1 1 0 44
`.trim();

/** Birdie OCR'd as curly-quote 1 should normalize to -1. */
const VISION_HILLS_QUOTE_BIRDIE = VISION_HILLS.replace(
  "1 -1 0 44",
  '1 “1 0 44'
);

const ROSEVIANG = `
로제비앙                             89
2026.09.09 13:37                                    
      이수복
설동철                 오문규                 최선웅
86                    85                    89

로제-비앙

HOLE 1 2 3 4 5 6 7 8 9 T

PR 4 4 3 4 5 3 4 4 5 36
이복 1 0 1 2 1 1 1 1 1 45
설동철 0 1 1 1 2 0 1 1 0 43
27 1 0 0 1 1 1 1 0 1 42
AM 2 3 0 1 2 0 0 0 4 48

PAR 4 4 5 3 4 4 3 5 4 36
o+=2 0 1 1 2 0 2 0 2 0 44
설동철 1 1 1 0 0 1 2 1 0 43
27 0 1 2 1 1 0 2 0 0 43
AM2 1 0 1 0 0 1 2 0 0 41
`.trim();

const EXPECTED_VH_PARS = [4, 5, 4, 3, 5, 4, 3, 4, 4, 5, 4, 4, 3, 5, 4, 4, 3, 4];
const EXPECTED_VH_REL = [0, 0, 4, 1, 2, 1, 2, 2, 0, 0, 3, 0, 0, 2, 3, 1, -1, 0];

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function relFromScores(scores: (number | null)[], pars: (number | null)[]) {
  return scores.map((s, i) =>
    s != null && pars[i] != null ? s - (pars[i] as number) : null
  );
}

function testVisionHills(label: string, text: string) {
  const parsed = parseOcrText(text);
  const { outTotal, inTotal, total } = calcTotals(parsed.scores);
  const rel = relFromScores(parsed.scores, parsed.pars);

  console.log(`\n=== ${label} ===`);
  console.log("course:", parsed.courseName);
  console.log("companions:", parsed.companions);
  console.log("pars:", parsed.pars.join(","));
  console.log("scores:", parsed.scores.join(","));
  console.log("rel:", rel.join(","));
  console.log("totals:", { outTotal, inTotal, total });

  assert(parsed.pars.length === 18, "pars length 18");
  for (let i = 0; i < 18; i++) {
    assert(
      parsed.pars[i] === EXPECTED_VH_PARS[i],
      `par[${i}] expected ${EXPECTED_VH_PARS[i]} got ${parsed.pars[i]}`
    );
  }
  for (let i = 0; i < 18; i++) {
    assert(
      rel[i] === EXPECTED_VH_REL[i],
      `rel[${i}] expected ${EXPECTED_VH_REL[i]} got ${rel[i]}`
    );
  }
  assert(outTotal === 48, `front expected 48 got ${outTotal}`);
  assert(inTotal === 44, `back expected 44 got ${inTotal}`);
  assert(total === 92, `total expected 92 got ${total}`);
  assert(
    /비전힐스/.test(parsed.courseName) && !/\d{2,3}/.test(parsed.courseName),
    `course should be 비전힐스 without score, got "${parsed.courseName}"`
  );
  const comps = parsed.companions.split(",").map((s) => s.trim()).filter(Boolean);
  for (const bad of ["힐스", "비전", "로제", "비앙", "비전힐스"]) {
    assert(!comps.includes(bad), `companions must not include ${bad}: ${parsed.companions}`);
  }
  for (const need of ["김승주", "이종훈", "김영민"]) {
    assert(comps.includes(need), `companions should include ${need}: ${parsed.companions}`);
  }
  console.log(`PASS ${label}: 48+44=92`);
}

function testRoseviang() {
  const parsed = parseOcrText(ROSEVIANG);
  const { outTotal, inTotal, total } = calcTotals(parsed.scores);
  console.log("\n=== Roseviang ===");
  console.log("course:", parsed.courseName);
  console.log("companions:", parsed.companions);
  console.log("pars:", parsed.pars.join(","));
  console.log("scores:", parsed.scores.join(","));
  console.log("totals:", { outTotal, inTotal, total });

  assert(total === 89, `Roseviang total expected 89 got ${total}`);
  assert(outTotal === 45, `Roseviang front expected 45 got ${outTotal}`);
  assert(inTotal === 44, `Roseviang back expected 44 got ${inTotal}`);
  assert(
    parsed.pars.slice(0, 9).join(",") === "4,4,3,4,5,3,4,4,5",
    `Roseviang front pars wrong: ${parsed.pars.slice(0, 9)}`
  );
  assert(
    parsed.pars.slice(9).join(",") === "4,4,5,3,4,4,3,5,4",
    `Roseviang back pars wrong: ${parsed.pars.slice(9)}`
  );
  const comps = parsed.companions.split(",").map((s) => s.trim()).filter(Boolean);
  for (const bad of ["로제", "비앙", "로제비앙", "힐스", "비전"]) {
    assert(!comps.includes(bad), `Rose companions must not include ${bad}`);
  }
  console.log("PASS Roseviang: 45+44=89");
}

function testSignedInts() {
  const a = signedIntsFromLine('o= 0 3 0 0 2 3 1 “1 0 44');
  assert(a.includes(-1), `curly-quote birdie should be -1, got ${a}`);
  const b = signedIntsFromLine("1. 2. 3 4 5 6 7 8 9");
  assert(b[0] === 1 && b[1] === 2, `decimals 1. 2. → 1 2, got ${b}`);
  console.log("PASS signedIntsFromLine quote/decimal normalize");
}

function testSmartDirect() {
  const smart = parseSmartScoreRelative(VISION_HILLS, { meNames: ["이수복"] });
  assert(smart.matched, "smart should match Vision Hills");
  assert(smart.totalHint === 92, `totalHint expected 92 got ${smart.totalHint}`);
}

try {
  testSignedInts();
  testSmartDirect();
  testVisionHills("Vision Hills sample", VISION_HILLS);
  testVisionHills("Vision Hills curly-quote birdie", VISION_HILLS_QUOTE_BIRDIE);
  testRoseviang();
  console.log("\nALL PASS");
} catch (e) {
  console.error("\nFAIL", e);
  process.exit(1);
}
