import type { GameBundle, Rank, RollResult, RunSummary } from './types.ts';
import { type RandomSource, cryptoRandomOrMathRandom } from './rng.ts';
import { createConstrainedRollResults } from './constraints.ts';

export const RANK_TO_VALUE: Readonly<Record<Rank, number>> = {
  F: 1,
  E: 2,
  D: 3,
  C: 4,
  B: 5,
  A: 6,
  S: 7,
};

export const VALUE_TO_RANK: Readonly<Record<number, Rank>> = {
  1: 'F',
  2: 'E',
  3: 'D',
  4: 'C',
  5: 'B',
  6: 'A',
  7: 'S',
};

export function rankToNumber(rank: Rank): number {
  return RANK_TO_VALUE[rank];
}

export function numberToRank(score: number): Rank {
  const clamped = Math.min(7, Math.max(1, Math.round(score)));
  return VALUE_TO_RANK[clamped];
}

export interface DifficultyEvaluation {
  numericalScore: number;
  rawRank: Rank;
  overallRank: Rank;
  hasHazardOutlier: boolean;
  wasClampedToB: boolean;
  hazardBannerMessage: string | null;
}

export interface RunSummaryOptions {
  constraintsBypassed?: boolean;
  constraintWarnings?: string[];
  minimumSeverityRequested?: number | null;
  severityGenerationAttempts?: number;
}

export function evaluateRunDifficulty(results: readonly RollResult[]): DifficultyEvaluation {
  if (!Array.isArray(results) || results.length === 0) {
    throw new Error('Cannot evaluate difficulty for an empty results set.');
  }

  let totalScore = 0;
  let sRankCount = 0;

  for (const item of results) {
    const rank = item.selectedOption.rank;
    const numericValue = rankToNumber(rank);
    totalScore += numericValue;

    if (rank === 'S') {
      sRankCount += 1;
    }
  }

  const hasHazardOutlier = sRankCount > 0;
  const allRollsAreS = sRankCount === results.length;

  const rawScore = totalScore / results.length;
  const numericalScore = Math.round(rawScore * 100) / 100;

  const rawRankValue = Math.min(7, Math.max(1, Math.round(rawScore)));
  const rawRank = VALUE_TO_RANK[rawRankValue];

  let overallRank: Rank = rawRank;
  let wasClampedToB = false;
  let hazardBannerMessage: string | null = null;

  if (hasHazardOutlier) {
    if (rawRankValue < RANK_TO_VALUE.B) {
      overallRank = 'B';
      wasClampedToB = true;
      hazardBannerMessage =
        '[ ! ] HAZARD OVERRIDE: S-Tier condition elevated minimum run rating to B.';
    } else {
      overallRank = rawRank;
      wasClampedToB = false;
      hazardBannerMessage = allRollsAreS ? null : '[ ! ] S-TIER CONDITION ACTIVE';
    }
  }

  return {
    numericalScore,
    rawRank,
    overallRank,
    hasHazardOutlier,
    wasClampedToB,
    hazardBannerMessage,
  };
}

export function createRunSummary(
  bundle: Pick<GameBundle, 'id' | 'title'>,
  results: RollResult[],
  timestamp: number = Date.now(),
  options: RunSummaryOptions = {}
): RunSummary {
  const evaluation = evaluateRunDifficulty(results);

  return {
    gameId: bundle.id,
    gameTitle: bundle.title,
    timestamp,
    results: [...results],
    numericalScore: evaluation.numericalScore,
    rawRank: evaluation.rawRank,
    overallRank: evaluation.overallRank,
    hasHazardOutlier: evaluation.hasHazardOutlier,
    wasClampedToB: evaluation.wasClampedToB,
    hazardBannerMessage: evaluation.hazardBannerMessage,
    constraintsBypassed: options.constraintsBypassed ?? false,
    constraintWarnings: [...(options.constraintWarnings ?? [])],
    minimumSeverityRequested: options.minimumSeverityRequested ?? null,
    severityGenerationAttempts: options.severityGenerationAttempts ?? 1,
  };
}

export function executeBundleRoll(
  bundle: GameBundle,
  rng: RandomSource = cryptoRandomOrMathRandom,
  timestamp: number = Date.now()
): RunSummary {
  const results = createConstrainedRollResults(bundle, rng);

  return createRunSummary(bundle, results, timestamp);
}
