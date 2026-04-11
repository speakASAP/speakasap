export const LEVEL_THRESHOLD = 80;
export const QUESTION_ACTIVE_SECONDS = 45;

export type LevelStatRow = {
  difficult: number;
  isRight: boolean;
};

export type LevelStat = {
  difficult: number;
  right: number;
  wrong: number;
  total: number;
  percent: number;
};

export function computeLevelStat(rows: LevelStatRow[], difficult: number): LevelStat {
  let right = 0;
  let wrong = 0;
  for (const r of rows) {
    if (r.difficult !== difficult) {
      continue;
    }
    if (r.isRight) {
      right += 1;
    } else {
      wrong += 1;
    }
  }
  const total = right + wrong;
  const percent = total > 0 ? Math.round((right / total) * 100) : 0;
  return { difficult, right, wrong, total, percent };
}

export function buildAllLevelStats(rows: LevelStatRow[]): LevelStat[] {
  const difficulties = [...new Set(rows.map((r) => r.difficult))].sort((a, b) => a - b);
  return difficulties.map((d) => computeLevelStat(rows, d));
}

export function overallScoreFromStats(stats: LevelStat[]): number {
  return stats.reduce((acc, s) => acc + s.percent * s.difficult, 0);
}

export function pickAssignedDifficult(statsSorted: LevelStat[], threshold = LEVEL_THRESHOLD): number {
  if (statsSorted.length === 0) {
    return 1;
  }
  let result = statsSorted[0].difficult;
  for (const s of statsSorted) {
    if (s.percent >= threshold) {
      result = s.difficult;
      continue;
    }
    break;
  }
  return result;
}

export function setsEqual(a: Set<number>, b: Set<number>): boolean {
  if (a.size !== b.size) {
    return false;
  }
  for (const x of a) {
    if (!b.has(x)) {
      return false;
    }
  }
  return true;
}

export function computeMaxScore(levelDifficulties: number[]): number {
  const distinct = [...new Set(levelDifficulties)];
  return distinct.reduce((acc, d) => acc + d * 100, 0);
}
