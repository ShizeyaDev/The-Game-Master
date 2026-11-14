import {                    cryptoRandomOrMathRandom, selectUniform } from './rng.js';

export const DEFAULT_CONSTRAINT_ATTEMPTS = 20000;

function enumerateNumericAssignments(
  categories                     ,
  rule
)                      {
  const validAssignments                      = [];
  const selected = new Map                ();
  const tolerance = rule.tolerance ?? 0;

  const visit = (index        , total        )       => {
    if (index === categories.length) {
      if (Math.abs(total - rule.target) <= tolerance) {
        validAssignments.push(new Map(selected));
      }
      return;
    }

    const category = categories[index];
    for (const option of category.options) {
      if (typeof option.constraintValue !== 'number') {
        continue;
      }
      selected.set(category.id, option);
      visit(index + 1, total + option.constraintValue);
    }
    selected.delete(category.id);
  };

  visit(0, 0);
  return validAssignments;
}

function prepareNumericAssignmentPools(bundle            )                               {
  const rules = bundle.constraints?.numericSums ?? [];
  if (rules.length === 0) {
    return [];
  }

  const categoriesById = new Map(bundle.categories.map((category) => [category.id, category]));
  const claimedCategoryIds = new Set        ();
  const pools                        = [];

  for (const rule of rules) {
    if (rule.categoryIds.some((id) => claimedCategoryIds.has(id))) {
      return null;
    }
    const categories = rule.categoryIds
      .map((id) => categoriesById.get(id))
      .filter((category)                       => Boolean(category));
    const combinations = categories.reduce(
      (count, category) => count * category.options.length,
      1
    );
    if (categories.length !== rule.categoryIds.length || combinations > 100000) {
      return null;
    }

    const assignments = enumerateNumericAssignments(categories, rule);
    if (assignments.length === 0) {
      throw new Error(rule.reason ?? `Numeric constraint targeting ${rule.target} has no solution.`);
    }
    pools.push(assignments);
    rule.categoryIds.forEach((id) => claimedCategoryIds.add(id));
  }

  return pools;
}

export function getConstraintViolations(
  bundle            ,
  results
)           {
  const constraints = bundle.constraints;
  if (!constraints) {
    return [];
  }

  const violations           = [];
  const selectedOptions = new Map(
    results.map((result) => [result.selectedOption.id, result.selectedOption])
  );
  const resultsByCategory = new Map(results.map((result) => [result.categoryId, result]));

  for (const limit of constraints.rankLimits ?? []) {
    const selectedCount = results.filter((result) =>
      limit.ranks.includes(result.selectedOption.rank)
    ).length;
    if (selectedCount > limit.max) {
      violations.push(
        limit.reason ??
          `At most ${limit.max} result(s) may use rank ${limit.ranks.join('/')}.`
      );
    }
  }

  for (const rule of constraints.forbiddenCombinations ?? []) {
    if (rule.optionIds.every((optionId) => selectedOptions.has(optionId))) {
      violations.push(rule.reason ?? `Forbidden option combination: ${rule.optionIds.join(', ')}.`);
    }
  }

  for (const rule of constraints.numericSums ?? []) {
    const values = rule.categoryIds.map(
      (categoryId) => resultsByCategory.get(categoryId)?.selectedOption.constraintValue
    );
    if (values.some((value) => typeof value !== 'number' || !Number.isFinite(value))) {
      violations.push(
        rule.reason ?? `Numeric sum rule is missing a constraintValue in one of its categories.`
      );
      continue;
    }

    const total = (values            ).reduce((sum, value) => sum + value, 0);
    const tolerance = rule.tolerance ?? 0;
    if (Math.abs(total - rule.target) > tolerance) {
      violations.push(rule.reason ?? `Numeric sum must equal ${rule.target}; received ${total}.`);
    }
  }

  return violations;
}

export function createUnconstrainedRollResults(
  bundle            ,
  rng               = cryptoRandomOrMathRandom
)               {
  if (!bundle.categories || bundle.categories.length === 0) {
    throw new Error(`Game "${bundle.title}" has no categories to roll.`);
  }

  return bundle.categories.map((category) => ({
    categoryId: category.id,
    categoryName: category.name,
    selectedOption: selectUniform(category.options, rng),
  }));
}

export function createConstrainedRollResults(
  bundle            ,
  rng               = cryptoRandomOrMathRandom
)               {
  if (!bundle.categories || bundle.categories.length === 0) {
    throw new Error(`Game "${bundle.title}" has no categories to roll.`);
  }

  if (!bundle.constraints) {
    return createUnconstrainedRollResults(bundle, rng);
  }

  const maxAttempts = bundle.constraints?.maxAttempts ?? DEFAULT_CONSTRAINT_ATTEMPTS;
  const numericAssignmentPools = prepareNumericAssignmentPools(bundle);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const selectedByCategory = new Map                ();
    if (numericAssignmentPools) {
      for (const pool of numericAssignmentPools) {
        const assignment = selectUniform(pool, rng);
        assignment.forEach((option, categoryId) => selectedByCategory.set(categoryId, option));
      }
    }

    const results = bundle.categories.map((category) => ({
      categoryId: category.id,
      categoryName: category.name,
      selectedOption: selectedByCategory.get(category.id) ?? selectUniform(category.options, rng),
    }));

    if (getConstraintViolations(bundle, results).length === 0) {
      return results;
    }
  }

  throw new Error(
    `No valid random configuration was found for "${bundle.title}" after ${maxAttempts} attempts. ` +
      'Review its constraints; they may be too strict or contradictory.'
  );
}
