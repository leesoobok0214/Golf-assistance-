import {
  calcTotals,
  padPars,
  strokeFromRelative,
  type HolePars,
  type HoleScores,
} from "../src/lib/types";

function strokesFrom(pars: number[], rel: number[]): HoleScores {
  const scores: HoleScores = Array.from({ length: 18 }, () => null);
  for (let i = 0; i < pars.length && i < rel.length; i++) {
    scores[i] = strokeFromRelative(pars[i], rel[i]);
  }
  return scores;
}

const frontPars = [4, 5, 4, 3, 5, 4, 3, 4, 4];
const frontRel = [0, 0, 4, 1, 2, 1, 2, 2, 0];
const backPars = [5, 4, 4, 3, 5, 4, 4, 3, 4];
const backRel = [0, 3, 0, 0, 2, 3, 1, -1, 0];

const frontNine = strokesFrom(frontPars, frontRel).slice(0, 9);
const backNine = strokesFrom(backPars, backRel).slice(0, 9);

const frontTotal = frontNine.reduce<number>((s, v) => s + (v ?? 0), 0);
const backTotal = backNine.reduce<number>((s, v) => s + (v ?? 0), 0);

const all: HoleScores = [...frontNine, ...backNine];
const { outTotal, inTotal, total } = calcTotals(all);

console.log("front strokes:", frontNine.join(","), "sum=", frontTotal);
console.log("back strokes:", backNine.join(","), "sum=", backTotal);
console.log("calcTotals:", { outTotal, inTotal, total });
console.log("pars padded length:", padPars([...frontPars, ...backPars] as HolePars).length);

const ok =
  frontTotal === 48 &&
  backTotal === 44 &&
  total === 92 &&
  outTotal === 48 &&
  inTotal === 44;

if (!ok) {
  console.error("FAIL expected front=48 back=44 total=92");
  process.exit(1);
}
console.log("PASS Vision Hills style: 48 + 44 = 92");
