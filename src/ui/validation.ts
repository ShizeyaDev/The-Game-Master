import { type GameBundle, isValidRank, validateGameBundle } from '../core/index.ts';

export interface CategoryValidationIssue {
  categoryId: string;
  categoryIndex: number;
  categoryName: string;
  messages: string[];
  emptyOptionIds: string[];
}

export interface BundleValidationReport {
  isValid: boolean;
  titleError: string | null;
  bundleLevelErrors: string[];
  categoryIssues: Record<string, CategoryValidationIssue>;
  allErrorMessages: string[];
}

export function evaluateBundleGuardrails(bundle: GameBundle): BundleValidationReport {
  let titleError: string | null = null;
  const bundleLevelErrors: string[] = [];
  const categoryIssues: Record<string, CategoryValidationIssue> = {};
  const allErrorMessages: string[] = [];

  if (!bundle.title || bundle.title.trim().length === 0) {
    titleError = 'Game title is required and cannot be empty.';
    allErrorMessages.push(titleError);
  }

  if (!Array.isArray(bundle.categories) || bundle.categories.length === 0) {
    const msg = 'Game must define at least 1 category before saving or launching.';
    bundleLevelErrors.push(msg);
    allErrorMessages.push(msg);
  } else {
    bundle.categories.forEach((cat, idx) => {
      const messages: string[] = [];
      const emptyOptionIds: string[] = [];
      const displayCatName = cat.name.trim() || `Category #${idx + 1}`;

      if (!cat.name || cat.name.trim().length === 0) {
        messages.push(`Category #${idx + 1} requires a valid category name.`);
      }

      if (!Array.isArray(cat.options) || cat.options.length < 2) {
        const count = Array.isArray(cat.options) ? cat.options.length : 0;
        messages.push(
          `"${displayCatName}" has ${count} option${count === 1 ? '' : 's'}. Minimum 2 options required to avoid a trivial roll.`
        );
      }

      if (Array.isArray(cat.options)) {
        cat.options.forEach((opt, optIdx) => {
          if (!opt.label || opt.label.trim().length === 0) {
            emptyOptionIds.push(opt.id);
            messages.push(`"${displayCatName}" Option #${optIdx + 1} has an empty outcome label.`);
          }
          if (!isValidRank(opt.rank)) {
            messages.push(`"${displayCatName}" Option #${optIdx + 1} has an invalid difficulty rank.`);
          }
        });
      }

      if (messages.length > 0) {
        categoryIssues[cat.id] = {
          categoryId: cat.id,
          categoryIndex: idx,
          categoryName: displayCatName,
          messages,
          emptyOptionIds,
        };
        allErrorMessages.push(...messages);
      }
    });
  }

  if (titleError === null && bundleLevelErrors.length === 0 && Object.keys(categoryIssues).length === 0) {
    const schemaCheck = validateGameBundle(bundle);
    if (!schemaCheck.valid) {
      bundleLevelErrors.push(schemaCheck.error);
      allErrorMessages.push(schemaCheck.error);
    }
  }

  const isValid =
    titleError === null &&
    bundleLevelErrors.length === 0 &&
    Object.keys(categoryIssues).length === 0;

  return {
    isValid,
    titleError,
    bundleLevelErrors,
    categoryIssues,
    allErrorMessages,
  };
}

export function computeBundleMetrics(bundle: GameBundle): {
  categoryCount: number;
  totalOptionsCount: number;
} {
  const categoryCount = Array.isArray(bundle.categories) ? bundle.categories.length : 0;
  let totalOptionsCount = 0;

  if (Array.isArray(bundle.categories)) {
    for (const cat of bundle.categories) {
      if (Array.isArray(cat.options)) {
        totalOptionsCount += cat.options.length;
      }
    }
  }

  return { categoryCount, totalOptionsCount };
}
