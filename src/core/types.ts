export type Rank = 'F' | 'E' | 'D' | 'C' | 'B' | 'A' | 'S';

export const VALID_RANKS: readonly Rank[] = ['F', 'E', 'D', 'C', 'B', 'A', 'S'] as const;

export interface Option {
  id: string;
  label: string;
  rank: Rank;
}

export interface Category {
  id: string;
  name: string;
  options: Option[];
}

export interface GameBundle {
  id: string;
  title: string;
  description: string;
  categories: Category[];
  createdAt: number;
  updatedAt: number;
}

export interface RollResult {
  categoryId: string;
  categoryName: string;
  selectedOption: Option;
}

export interface RunSummary {
  gameId: string;
  gameTitle: string;
  timestamp: number;
  results: RollResult[];
  numericalScore: number;
  rawRank: Rank;
  overallRank: Rank;
  hasHazardOutlier: boolean;
  wasClampedToB: boolean;
  hazardBannerMessage: string | null;
}

export interface ImportResult {
  success: boolean;
  count?: number;
  error?: string;
}
