(function () {
'use strict';

const VALID_RANKS                  = ['F', 'E', 'D', 'C', 'B', 'A', 'S']         ;

function cryptoRandomOrMathRandom()         {
  if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
    const buffer = new Uint32Array(1);
    globalThis.crypto.getRandomValues(buffer);
    return buffer[0] / 0x100000000;
  }
  return Math.random();
}
function selectUniform   (
  array              ,
  rng               = cryptoRandomOrMathRandom
)    {
  if (!Array.isArray(array) || array.length === 0) {
    throw new Error('Cannot perform uniform selection on an empty or invalid array.');
  }

  const randomValue = rng();
  const clampedValue = randomValue >= 1 ? 0.9999999999999999 : randomValue < 0 ? 0 : randomValue;
  const index = Math.floor(clampedValue * array.length);

  return array[index];
}

const DEFAULT_CONSTRAINT_ATTEMPTS = 20000;

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
function getConstraintViolations(
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
function createConstrainedRollResults(
  bundle            ,
  rng               = cryptoRandomOrMathRandom
)               {
  if (!bundle.categories || bundle.categories.length === 0) {
    throw new Error(`Game "${bundle.title}" has no categories to roll.`);
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

const RANK_TO_VALUE                                 = {
  F: 1,
  E: 2,
  D: 3,
  C: 4,
  B: 5,
  A: 6,
  S: 7,
};
const VALUE_TO_RANK                                 = {
  1: 'F',
  2: 'E',
  3: 'D',
  4: 'C',
  5: 'B',
  6: 'A',
  7: 'S',
};
function rankToNumber(rank      )         {
  return RANK_TO_VALUE[rank];
}
function numberToRank(score        )       {
  const clamped = Math.min(7, Math.max(1, Math.round(score)));
  return VALUE_TO_RANK[clamped];
}
function evaluateRunDifficulty(results                       )                       {
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

  let overallRank       = rawRank;
  let wasClampedToB = false;
  let hazardBannerMessage                = null;

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
function createRunSummary(
  bundle                                  ,
  results              ,
  timestamp         = Date.now()
)             {
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
  };
}
function executeBundleRoll(
  bundle            ,
  rng               = cryptoRandomOrMathRandom,
  timestamp         = Date.now()
)             {
  const results = createConstrainedRollResults(bundle, rng);

  return createRunSummary(bundle, results, timestamp);
}

const DEFAULT_SEED_BUNDLE             = {
  id: 'seed-elden-ring-cursed-v1',
  title: 'Elden Ring: Sovereign Arbiter Protocol',
  description:
    'Strict non-negotiable challenge parameters for the Lands Between. Dictates starting lineage, weapon constraints, combat restrictions, healing allowances, and spirit ash regulations.',
  createdAt: 1730000000000,
  updatedAt: 1730000000000,
  categories: [
    {
      id: 'cat-starting-lineage',
      name: 'Starting Lineage',
      options: [
        { id: 'opt-lineage-vagabond', label: 'Vagabond (Standard Knight Kit)', rank: 'F' },
        { id: 'opt-lineage-samurai', label: 'Samurai (Uchigatana & Longbow)', rank: 'E' },
        { id: 'opt-lineage-astrologer', label: 'Astrologer (Glintstone Sorcery)', rank: 'E' },
        { id: 'opt-lineage-confessor', label: 'Confessor (Broadsword & Incantations)', rank: 'D' },
        { id: 'opt-lineage-prisoner', label: 'Prisoner (Estoc & Magic Glintblade)', rank: 'D' },
        { id: 'opt-lineage-bandit', label: 'Bandit (Great Knife & Buckler Parries)', rank: 'C' },
        { id: 'opt-lineage-wretch', label: 'Wretch (Rune Level 1, Club Only Start)', rank: 'A' },
      ],
    },
    {
      id: 'cat-armament-doctrine',
      name: 'Armament Doctrine',
      options: [
        { id: 'opt-arm-unrestricted', label: 'Unrestricted Arsenal (Any Weapon & Upgrade)', rank: 'F' },
        { id: 'opt-arm-heavy-iron', label: 'Colossal & Great Weapons Only (No Shields)', rank: 'D' },
        { id: 'opt-arm-paired-steel', label: 'Dual-Wield Powerstance Only (No Blocking)', rank: 'C' },
        { id: 'opt-arm-starting-gear', label: 'Starting Equipment Lock (Upgrades Permitted)', rank: 'B' },
        { id: 'opt-arm-unupgraded', label: 'Smithing Prohibition (+0 Base Weapons Only)', rank: 'A' },
        { id: 'opt-arm-torches-flails', label: 'Torches, Crossbows, and Shields Only', rank: 'S' },
      ],
    },
    {
      id: 'cat-crimson-rationing',
      name: 'Crimson Tear Rationing',
      options: [
        { id: 'opt-heal-full', label: 'Full Sacred Flask Allocation', rank: 'F' },
        { id: 'opt-heal-capped-five', label: 'Maximum 5 Crimson Flasks Equipped', rank: 'D' },
        { id: 'opt-heal-physick-incant', label: 'Wondrous Physick & Healing Incantations Only', rank: 'B' },
        { id: 'opt-heal-grace-only', label: 'Zero Combat Healing (Sites of Grace Only)', rank: 'S' },
      ],
    },
    {
      id: 'cat-spirit-invocation',
      name: 'Spirit Calling Verdict',
      options: [
        { id: 'opt-spirit-any', label: 'All Spirit Ashes Permitted (Including Mimic Tear)', rank: 'F' },
        { id: 'opt-spirit-standard', label: 'Non-Elite Spirit Ashes Only (No Named/Legendary)', rank: 'D' },
        { id: 'opt-spirit-unupgraded', label: 'Base Level (+0) Spirit Ashes Only', rank: 'C' },
        { id: 'opt-spirit-solitary', label: 'Solitary Sovereign (Zero Summons or Spirit Ashes)', rank: 'B' },
      ],
    },
    {
      id: 'cat-mortality-clause',
      name: 'Mortality & Rune Clause',
      options: [
        { id: 'opt-mort-standard', label: 'Standard Recovery (Retrieve Runes on Death)', rank: 'F' },
        { id: 'opt-mort-forfeit', label: 'Blood Tax (Never Recover Dropped Runes)', rank: 'C' },
        { id: 'opt-mort-region-lock', label: 'Region Exile (Death Resets Current Legacy Dungeon)', rank: 'A' },
        { id: 'opt-mort-permadeath', label: 'Iron Verdict (Single Death Terminates Run)', rank: 'S' },
      ],
    },
  ],
};
function createDefaultSeedBundle()             {
  return JSON.parse(JSON.stringify(DEFAULT_SEED_BUNDLE))              ;
}

const STORAGE_NAMESPACE = 'TGM_BUNDLES_V1'         ;

class MemoryStorage                            {
          store = new Map                ();

  getItem(key        )                {
    return this.store.has(key) ? (this.store.get(key)          ) : null;
  }

  setItem(key        , value        )       {
    this.store.set(key, value);
  }

  removeItem(key        )       {
    this.store.delete(key);
  }
}

const fallbackMemoryStorage = new MemoryStorage();

function resolveStorage(customStorage                  )                  {
  if (customStorage) {
    return customStorage;
  }
  if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis && globalThis.localStorage) {
    return globalThis.localStorage;
  }
  return fallbackMemoryStorage;
}
function isValidRank(value         )                {
  return typeof value === 'string' && (VALID_RANKS                     ).includes(value);
}
function validateOption(raw         , contextPath        )                                                                   {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { valid: false, error: `${contextPath} must be a non-null object.` };
  }

  const candidate = raw                           ;

  if (typeof candidate.id !== 'string' || candidate.id.trim().length === 0) {
    return { valid: false, error: `${contextPath}.id must be a non-empty string.` };
  }

  if (typeof candidate.label !== 'string' || candidate.label.trim().length === 0) {
    return { valid: false, error: `${contextPath}.label must be a non-empty string.` };
  }

  if (!isValidRank(candidate.rank)) {
    return {
      valid: false,
      error: `${contextPath}.rank must be one of [${VALID_RANKS.join(', ')}], received "${String(candidate.rank)}".`,
    };
  }

  if (
    candidate.constraintValue !== undefined &&
    (typeof candidate.constraintValue !== 'number' || !Number.isFinite(candidate.constraintValue))
  ) {
    return { valid: false, error: `${contextPath}.constraintValue must be a finite number when provided.` };
  }

  return {
    valid: true,
    value: {
      id: candidate.id.trim(),
      label: candidate.label.trim(),
      rank: candidate.rank,
      ...(candidate.constraintValue === undefined
        ? {}
        : { constraintValue: candidate.constraintValue }),
    },
  };
}

function validateRollConstraints(
  raw         ,
  categories                     ,
  contextPath
)                                                                            {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { valid: false, error: `${contextPath} must be a non-null object.` };
  }

  const candidate = raw                           ;
  const categoryMap = new Map(categories.map((category) => [category.id, category]));
  const optionIds = new Set(categories.flatMap((category) => category.options.map((option) => option.id)));
  const value                  = {};

  if (candidate.maxAttempts !== undefined) {
    if (
      typeof candidate.maxAttempts !== 'number' ||
      !Number.isInteger(candidate.maxAttempts) ||
      candidate.maxAttempts < 1 ||
      candidate.maxAttempts > 100000
    ) {
      return { valid: false, error: `${contextPath}.maxAttempts must be an integer from 1 to 100000.` };
    }
    value.maxAttempts = candidate.maxAttempts;
  }

  if (candidate.rankLimits !== undefined) {
    if (!Array.isArray(candidate.rankLimits)) {
      return { valid: false, error: `${contextPath}.rankLimits must be an array.` };
    }
    value.rankLimits = [];
    for (let i = 0; i < candidate.rankLimits.length; i++) {
      const rawLimit = candidate.rankLimits[i];
      const path = `${contextPath}.rankLimits[${i}]`;
      if (typeof rawLimit !== 'object' || rawLimit === null || Array.isArray(rawLimit)) {
        return { valid: false, error: `${path} must be an object.` };
      }
      const limit = rawLimit                           ;
      if (!Array.isArray(limit.ranks) || limit.ranks.length === 0 || !limit.ranks.every(isValidRank)) {
        return { valid: false, error: `${path}.ranks must contain at least one valid rank.` };
      }
      if (typeof limit.max !== 'number' || !Number.isInteger(limit.max) || limit.max < 0) {
        return { valid: false, error: `${path}.max must be a non-negative integer.` };
      }
      if (limit.reason !== undefined && typeof limit.reason !== 'string') {
        return { valid: false, error: `${path}.reason must be a string when provided.` };
      }
      value.rankLimits.push({
        ranks: Array.from(new Set(limit.ranks          )),
        max: limit.max,
        ...(typeof limit.reason === 'string' ? { reason: limit.reason.trim() } : {}),
      });
    }
  }

  if (candidate.forbiddenCombinations !== undefined) {
    if (!Array.isArray(candidate.forbiddenCombinations)) {
      return { valid: false, error: `${contextPath}.forbiddenCombinations must be an array.` };
    }
    value.forbiddenCombinations = [];
    for (let i = 0; i < candidate.forbiddenCombinations.length; i++) {
      const rawRule = candidate.forbiddenCombinations[i];
      const path = `${contextPath}.forbiddenCombinations[${i}]`;
      if (typeof rawRule !== 'object' || rawRule === null || Array.isArray(rawRule)) {
        return { valid: false, error: `${path} must be an object.` };
      }
      const rule = rawRule                           ;
      if (
        !Array.isArray(rule.optionIds) ||
        rule.optionIds.length < 2 ||
        !rule.optionIds.every((id) => typeof id === 'string' && optionIds.has(id))
      ) {
        return { valid: false, error: `${path}.optionIds must reference at least two existing options.` };
      }
      if (new Set(rule.optionIds).size !== rule.optionIds.length) {
        return { valid: false, error: `${path}.optionIds must not contain duplicates.` };
      }
      if (rule.reason !== undefined && typeof rule.reason !== 'string') {
        return { valid: false, error: `${path}.reason must be a string when provided.` };
      }
      value.forbiddenCombinations.push({
        optionIds: Array.from(new Set(rule.optionIds            )),
        ...(typeof rule.reason === 'string' ? { reason: rule.reason.trim() } : {}),
      });
    }
  }

  if (candidate.numericSums !== undefined) {
    if (!Array.isArray(candidate.numericSums)) {
      return { valid: false, error: `${contextPath}.numericSums must be an array.` };
    }
    value.numericSums = [];
    for (let i = 0; i < candidate.numericSums.length; i++) {
      const rawRule = candidate.numericSums[i];
      const path = `${contextPath}.numericSums[${i}]`;
      if (typeof rawRule !== 'object' || rawRule === null || Array.isArray(rawRule)) {
        return { valid: false, error: `${path} must be an object.` };
      }
      const rule = rawRule                           ;
      if (
        !Array.isArray(rule.categoryIds) ||
        rule.categoryIds.length < 2 ||
        !rule.categoryIds.every((id) => typeof id === 'string' && categoryMap.has(id))
      ) {
        return { valid: false, error: `${path}.categoryIds must reference at least two existing categories.` };
      }
      if (new Set(rule.categoryIds).size !== rule.categoryIds.length) {
        return { valid: false, error: `${path}.categoryIds must not contain duplicates.` };
      }
      const uniqueCategoryIds = Array.from(new Set(rule.categoryIds            ));
      const missingValueCategory = uniqueCategoryIds.find((id) =>
        categoryMap.get(id)?.options.some((option) => option.constraintValue === undefined)
      );
      if (missingValueCategory) {
        return {
          valid: false,
          error: `${path} requires every option in category "${missingValueCategory}" to define constraintValue.`,
        };
      }
      if (typeof rule.target !== 'number' || !Number.isFinite(rule.target)) {
        return { valid: false, error: `${path}.target must be a finite number.` };
      }
      if (
        rule.tolerance !== undefined &&
        (typeof rule.tolerance !== 'number' || !Number.isFinite(rule.tolerance) || rule.tolerance < 0)
      ) {
        return { valid: false, error: `${path}.tolerance must be a non-negative finite number.` };
      }
      if (rule.reason !== undefined && typeof rule.reason !== 'string') {
        return { valid: false, error: `${path}.reason must be a string when provided.` };
      }
      value.numericSums.push({
        categoryIds: uniqueCategoryIds,
        target: rule.target,
        ...(typeof rule.tolerance === 'number' ? { tolerance: rule.tolerance } : {}),
        ...(typeof rule.reason === 'string' ? { reason: rule.reason.trim() } : {}),
      });
    }
  }

  return { valid: true, value };
}
function validateCategory(raw         , contextPath        )                                                                     {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { valid: false, error: `${contextPath} must be a non-null object.` };
  }

  const candidate = raw                           ;

  if (typeof candidate.id !== 'string' || candidate.id.trim().length === 0) {
    return { valid: false, error: `${contextPath}.id must be a non-empty string.` };
  }

  if (typeof candidate.name !== 'string' || candidate.name.trim().length === 0) {
    return { valid: false, error: `${contextPath}.name must be a non-empty string.` };
  }

  if (!Array.isArray(candidate.options) || candidate.options.length === 0) {
    return { valid: false, error: `${contextPath}.options must be a non-empty array.` };
  }

  const validatedOptions           = [];
  const seenOptionIds = new Set        ();

  for (let i = 0; i < candidate.options.length; i++) {
    const optCheck = validateOption(candidate.options[i], `${contextPath}.options[${i}]`);
    if (!optCheck.valid) {
      return optCheck;
    }
    if (seenOptionIds.has(optCheck.value.id)) {
      return {
        valid: false,
        error: `${contextPath}.options[${i}] has duplicate option id "${optCheck.value.id}".`,
      };
    }
    seenOptionIds.add(optCheck.value.id);
    validatedOptions.push(optCheck.value);
  }

  return {
    valid: true,
    value: {
      id: candidate.id.trim(),
      name: candidate.name.trim(),
      options: validatedOptions,
    },
  };
}
function validateGameBundle(raw         , contextPath = 'Game')                                                                       {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { valid: false, error: `${contextPath} must be a non-null object.` };
  }

  const candidate = raw                           ;

  if (typeof candidate.id !== 'string' || candidate.id.trim().length === 0) {
    return { valid: false, error: `${contextPath}.id must be a non-empty string.` };
  }

  if (typeof candidate.title !== 'string' || candidate.title.trim().length === 0) {
    return { valid: false, error: `${contextPath}.title must be a non-empty string.` };
  }

  if (typeof candidate.description !== 'string') {
    return { valid: false, error: `${contextPath}.description must be a string.` };
  }

  if (typeof candidate.createdAt !== 'number' || !Number.isFinite(candidate.createdAt) || candidate.createdAt < 0) {
    return { valid: false, error: `${contextPath}.createdAt must be a valid non-negative timestamp number.` };
  }

  if (typeof candidate.updatedAt !== 'number' || !Number.isFinite(candidate.updatedAt) || candidate.updatedAt < 0) {
    return { valid: false, error: `${contextPath}.updatedAt must be a valid non-negative timestamp number.` };
  }

  if (!Array.isArray(candidate.categories) || candidate.categories.length === 0) {
    return { valid: false, error: `${contextPath}.categories must be a non-empty array.` };
  }

  const validatedCategories             = [];
  const seenCategoryIds = new Set        ();
  const seenBundleOptionIds = new Set        ();

  for (let i = 0; i < candidate.categories.length; i++) {
    const catCheck = validateCategory(candidate.categories[i], `${contextPath}.categories[${i}]`);
    if (!catCheck.valid) {
      return catCheck;
    }
    if (seenCategoryIds.has(catCheck.value.id)) {
      return {
        valid: false,
        error: `${contextPath}.categories[${i}] has duplicate category id "${catCheck.value.id}".`,
      };
    }
    seenCategoryIds.add(catCheck.value.id);
    for (const option of catCheck.value.options) {
      if (seenBundleOptionIds.has(option.id)) {
        return {
          valid: false,
          error: `${contextPath}.categories[${i}] contains bundle-wide duplicate option id "${option.id}".`,
        };
      }
      seenBundleOptionIds.add(option.id);
    }
    validatedCategories.push(catCheck.value);
  }

  let constraints                             ;
  if (candidate.constraints !== undefined) {
    const constraintsCheck = validateRollConstraints(
      candidate.constraints,
      validatedCategories,
      `${contextPath}.constraints`
    );
    if (!constraintsCheck.valid) {
      return constraintsCheck;
    }
    constraints = constraintsCheck.value;
  }

  return {
    valid: true,
    value: {
      id: candidate.id.trim(),
      title: candidate.title.trim(),
      description: candidate.description.trim(),
      categories: validatedCategories,
      ...(constraints ? { constraints } : {}),
      createdAt: candidate.createdAt,
      updatedAt: candidate.updatedAt,
    },
  };
}
class BundleStorageEngine {
                   storage                 ;
                   namespace        ;

  constructor(storage                  , namespace         = STORAGE_NAMESPACE) {
    this.storage = resolveStorage(storage);
    this.namespace = namespace;
  }

         getAllBundles()               {
    const raw = this.storage.getItem(this.namespace);

    if (raw === null) {
      const initialSeed = [createDefaultSeedBundle()];
      this.writeBundlesInternal(initialSeed);
      return initialSeed;
    }

    try {
      const parsed          = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        const fallback = [createDefaultSeedBundle()];
        this.writeBundlesInternal(fallback);
        return fallback;
      }

      const validBundles               = [];
      for (let i = 0; i < parsed.length; i++) {
        const validation = validateGameBundle(parsed[i], `StoredGame[${i}]`);
        if (validation.valid) {
          validBundles.push(validation.value);
        }
      }

      return validBundles;
    } catch {
      const fallback = [createDefaultSeedBundle()];
      this.writeBundlesInternal(fallback);
      return fallback;
    }
  }

         getBundleById(id        )                    {
    const bundles = this.getAllBundles();
    const match = bundles.find((b) => b.id === id);
    return match ? (JSON.parse(JSON.stringify(match))              ) : null;
  }

         saveBundle(bundle            )       {
    const validation = validateGameBundle(bundle, 'Game');
    if (!validation.valid) {
      throw new Error(`Invalid Game: ${validation.error}`);
    }

    const sanitizedBundle = validation.value;
    const bundles = this.getAllBundles();
    const existingIndex = bundles.findIndex((b) => b.id === sanitizedBundle.id);

    if (existingIndex >= 0) {
      bundles[existingIndex] = {
        ...sanitizedBundle,
        createdAt: bundles[existingIndex].createdAt,
        updatedAt: Math.max(Date.now(), sanitizedBundle.updatedAt),
      };
    } else {
      bundles.push(sanitizedBundle);
    }

    this.writeBundlesInternal(bundles);
  }

         deleteBundle(id        )       {
    const bundles = this.getAllBundles();
    const filtered = bundles.filter((b) => b.id !== id);
    this.writeBundlesInternal(filtered);
  }

         exportBundlesToJSON()         {
    const bundles = this.getAllBundles();
    return JSON.stringify(bundles, null, 2);
  }

         importBundlesFromJSON(rawJson        )               {
    if (typeof rawJson !== 'string' || rawJson.trim().length === 0) {
      return {
        success: false,
        error: 'Import payload is empty.',
      };
    }

    let parsed         ;
    try {
      parsed = JSON.parse(rawJson);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Malformed JSON syntax';
      return {
        success: false,
        error: `JSON Parse Error: ${message}`,
      };
    }

    const rawList            = Array.isArray(parsed) ? parsed : [parsed];

    if (rawList.length === 0) {
      return {
        success: false,
        error: 'Import array must contain at least one Game.',
      };
    }

    const validatedIncoming               = [];
    const incomingIds = new Set        ();

    for (let i = 0; i < rawList.length; i++) {
      const check = validateGameBundle(rawList[i], `Game[${i}]`);
      if (!check.valid) {
        return {
          success: false,
          error: check.error,
        };
      }
      if (incomingIds.has(check.value.id)) {
        return {
          success: false,
          error: `Duplicate game id "${check.value.id}" found within import payload at Game[${i}].`,
        };
      }
      incomingIds.add(check.value.id);
      validatedIncoming.push(check.value);
    }

    const existingBundles = this.getAllBundles();
    const bundleMap = new Map                    ();

    for (const existing of existingBundles) {
      bundleMap.set(existing.id, existing);
    }

    for (const incoming of validatedIncoming) {
      bundleMap.set(incoming.id, incoming);
    }

    this.writeBundlesInternal(Array.from(bundleMap.values()));

    return {
      success: true,
      count: validatedIncoming.length,
    };
  }

          writeBundlesInternal(bundles              )       {
    this.storage.setItem(this.namespace, JSON.stringify(bundles));
  }
}

const defaultStorageEngine = new BundleStorageEngine();
function getAllBundles()               {
  return defaultStorageEngine.getAllBundles();
}
function getBundleById(id        )                    {
  return defaultStorageEngine.getBundleById(id);
}
function saveBundle(bundle            )       {
  defaultStorageEngine.saveBundle(bundle);
}
function deleteBundle(id        )       {
  defaultStorageEngine.deleteBundle(id);
}
function exportBundlesToJSON()         {
  return defaultStorageEngine.exportBundlesToJSON();
}
function importBundlesFromJSON(rawJson        )               {
  return defaultStorageEngine.importBundlesFromJSON(rawJson);
}

const Icons = {
  arbiterCrest: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">
    <polygon points="12 2 21 7 21 17 12 22 3 17 3 7 12 2"></polygon>
    <line x1="12" y1="2" x2="12" y2="22"></line>
    <polyline points="3 7 12 12 21 7"></polyline>
    <circle cx="12" cy="12" r="2.2" fill="currentColor"></circle>
  </svg>`,

  plus: `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" aria-hidden="true">
    <line x1="8" y1="2.5" x2="8" y2="13.5"></line>
    <line x1="2.5" y1="8" x2="13.5" y2="8"></line>
  </svg>`,

  trash: `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" aria-hidden="true">
    <polyline points="2.5 4 13.5 4"></polyline>
    <path d="M5.5 4V2.5h5V4"></path>
    <path d="M3.8 4l.7 9.5h7l.7-9.5"></path>
    <line x1="6.8" y1="6.5" x2="6.8" y2="11"></line>
    <line x1="9.2" y1="6.5" x2="9.2" y2="11"></line>
  </svg>`,

  edit: `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" aria-hidden="true">
    <path d="M11.2 2.2l2.6 2.6-8.3 8.3H2.9v-2.6l8.3-8.3z"></path>
    <line x1="9.4" y1="4" x2="12" y2="6.6"></line>
  </svg>`,

  duplicate: `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" aria-hidden="true">
    <rect x="5.5" y="5.5" width="8.5" height="8.5"></rect>
    <path d="M10.5 5.5V2H2v8.5h3.5"></path>
  </svg>`,

  play: `<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
    <polygon points="4 2.5 13.5 8 4 13.5 4 2.5"></polygon>
  </svg>`,

  download: `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square" aria-hidden="true">
    <path d="M8 2v8.5"></path>
    <polyline points="4.5 7.5 8 11 11.5 7.5"></polyline>
    <path d="M2.5 13.5h11"></path>
  </svg>`,

  upload: `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square" aria-hidden="true">
    <path d="M8 11V2.5"></path>
    <polyline points="4.5 5.5 8 2 11.5 5.5"></polyline>
    <path d="M2.5 13.5h11"></path>
  </svg>`,

  check: `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" aria-hidden="true">
    <polyline points="2.5 8.5 6.2 12.2 13.5 4"></polyline>
  </svg>`,

  chevronLeft: `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square" aria-hidden="true">
    <polyline points="10 3 5 8 10 13"></polyline>
  </svg>`,

  chevronRight: `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square" aria-hidden="true">
    <polyline points="6 3 11 8 6 13"></polyline>
  </svg>`,

  alertDiamond: `<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square" aria-hidden="true">
    <polygon points="8 1.5 14.5 8 8 14.5 1.5 8 8 1.5"></polygon>
    <line x1="8" y1="5" x2="8" y2="8.8"></line>
    <rect x="7.4" y="10.5" width="1.2" height="1.2" fill="currentColor" stroke="none"></rect>
  </svg>`,

  layers: `<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" aria-hidden="true">
    <polygon points="8 2 14 5.2 8 8.4 2 5.2 8 2"></polygon>
    <polyline points="2 8.2 8 11.4 14 8.2"></polyline>
    <polyline points="2 11.2 8 14.4 14 11.2"></polyline>
  </svg>`,

  gridNodes: `<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" aria-hidden="true">
    <rect x="2" y="2" width="4.5" height="4.5"></rect>
    <rect x="9.5" y="2" width="4.5" height="4.5"></rect>
    <rect x="2" y="9.5" width="4.5" height="4.5"></rect>
    <rect x="9.5" y="9.5" width="4.5" height="4.5"></rect>
  </svg>`,

  close: `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square" aria-hidden="true">
    <line x1="3.5" y1="3.5" x2="12.5" y2="12.5"></line>
    <line x1="12.5" y1="3.5" x2="3.5" y2="12.5"></line>
  </svg>`,

  lockSeal: `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square" aria-hidden="true">
    <rect x="3" y="7.2" width="10" height="7" rx="0"></rect>
    <path d="M5.2 7.2V5a2.8 2.8 0 0 1 5.6 0v2.2"></path>
    <circle cx="8" cy="10.7" r="1.1" fill="currentColor" stroke="none"></circle>
  </svg>`,

  crosshair: `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" aria-hidden="true">
    <circle cx="8" cy="8" r="5"></circle>
    <line x1="8" y1="1" x2="8" y2="4.2"></line>
    <line x1="8" y1="11.8" x2="8" y2="15"></line>
    <line x1="1" y1="8" x2="4.2" y2="8"></line>
    <line x1="11.8" y1="8" x2="15" y2="8"></line>
  </svg>`,

  forfeitFlag: `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square" aria-hidden="true">
    <line x1="3" y1="2" x2="3" y2="14.5"></line>
    <polygon points="3 2.5 13.5 5 11.5 7.5 13.5 10 3 10 3 2.5"></polygon>
  </svg>`,

  leverSwitch: `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square" aria-hidden="true">
    <rect x="2" y="10.5" width="12" height="3.5"></rect>
    <line x1="8" y1="10.5" x2="11.5" y2="3.5"></line>
    <circle cx="12" cy="2.8" r="1.6" fill="currentColor"></circle>
  </svg>`,

  clipboardCopy: `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" aria-hidden="true">
    <rect x="5" y="4.5" width="8.5" height="9.5"></rect>
    <path d="M10.5 4.5V2H2.5v9.5H5"></path>
    <line x1="7" y1="7.5" x2="11.5" y2="7.5"></line>
    <line x1="7" y1="10" x2="11.5" y2="10"></line>
  </svg>`,
}         ;

function evaluateBundleGuardrails(bundle            )                         {
  let titleError                = null;
  const bundleLevelErrors           = [];
  const categoryIssues                                          = {};
  const allErrorMessages           = [];

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
      const messages           = [];
      const emptyOptionIds           = [];
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
function computeBundleMetrics(bundle            )

  {
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

const TUMBLER_CARD_HEIGHT_PX = 76;
const TUMBLER_VIEWPORT_HEIGHT_PX = 228;
const TUMBLER_CENTER_OFFSET_PX = 76;
const TUMBLER_HIGH_SPEED_MS = 2500;
const TUMBLER_DECEL_MS = 2300;
const TUMBLER_TOTAL_DURATION_MS = 5000;
const RANK_SEVERITY_DESCRIPTIONS                                 = {
  F: 'TIER F // STANDARD BASELINE',
  E: 'TIER E // MILD RESTRICTION',
  D: 'TIER D // MODERATE CONSTRAINT',
  C: 'TIER C // STRICT DOCTRINE',
  B: 'TIER B // SEVERE MANDATE',
  A: 'TIER A // EXTREME ORDEAL',
  S: 'TIER S // SOVEREIGN HAZARD OUTLIER',
};

function escapeHtml(raw        )         {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function buildTumblerReelTrack(
  pool                   ,
  selectedOption
)                   {
  if (pool.length === 0) {
    throw new Error('Cannot build tumbler reel track from an empty option pool.');
  }

  const items           = [];
  const minimumCardsBeforeWinner = 54;

  while (items.length < minimumCardsBeforeWinner) {
    for (const opt of pool) {
      items.push(opt);
    }
  }

  const selectedIdxInPool = Math.max(
    0,
    pool.findIndex((o) => o.id === selectedOption.id)
  );

  for (let i = 0; i <= selectedIdxInPool; i++) {
    items.push(pool[i]);
  }

  const winningIndex = items.length - 1;

  for (let i = 1; i <= 4; i++) {
    const trailingOpt = pool[(selectedIdxInPool + i) % pool.length];
    items.push(trailingOpt);
  }

  const initialIndex = 1;
  const highSpeedTargetIndex = Math.max(initialIndex + 10, winningIndex - 16);

  const computeTranslateY = (cardIndex        )         =>
    TUMBLER_CENTER_OFFSET_PX - cardIndex * TUMBLER_CARD_HEIGHT_PX;

  return {
    items,
    initialIndex,
    highSpeedTargetIndex,
    winningIndex,
    initialTranslateY: computeTranslateY(initialIndex),
    highSpeedTranslateY: computeTranslateY(highSpeedTargetIndex),
    finalTranslateY: computeTranslateY(winningIndex),
  };
}
function buildDeceleratingSchedule(
  totalSteps = 25,
  totalDurationMs = TUMBLER_TOTAL_DURATION_MS
)           {
  const weights           = [];
  let weightSum = 0;

  for (let i = 0; i < totalSteps; i++) {
    const progress = i / Math.max(1, totalSteps - 1);
    const w = progress < 0.4 ? 1 : 1 + 8.5 * Math.pow((progress - 0.4) / 0.6, 2.6);
    weights.push(w);
    weightSum += w;
  }

  const cumulative           = [];
  let acc = 0;
  for (const w of weights) {
    acc += (w / weightSum) * totalDurationMs;
    cumulative.push(Math.round(acc));
  }
  return cumulative;
}
class SequentialRollController {
          stage                  = 'IDLE';
          bundle                    = null;
          currentCategoryIndex = 0;
          landedOption                = null;
          results               = [];
          plannedResults               = [];
          rng              ;

          activeTimers           = [];
          activeReelTrack                          = null;

                   onStateChange            ;
                   onAbortRun            ;
                   onCompleteRun                               ;

  constructor(options

   ) {
    this.onStateChange = options.onStateChange;
    this.onAbortRun = options.onAbortRun;
    this.onCompleteRun = options.onCompleteRun;
    this.rng = options.rng ?? cryptoRandomOrMathRandom;
  }

         getSnapshot()                            {
    const totalCategories = this.bundle ? this.bundle.categories.length : 0;
    const activeCategory =
      this.bundle && this.currentCategoryIndex < totalCategories
        ? this.bundle.categories[this.currentCategoryIndex]
        : null;

    return {
      stage: this.stage,
      bundle: this.bundle,
      currentCategoryIndex: this.currentCategoryIndex,
      totalCategories,
      activeCategory,
      landedOption: this.landedOption,
      results: [...this.results],
      isFinalCategory: totalCategories > 0 && this.currentCategoryIndex === totalCategories - 1,
    };
  }

         startSequence(bundle            , immediateResolveForTests = false)       {
    const nextBundle = JSON.parse(JSON.stringify(bundle))              ;
    const nextPlan = createConstrainedRollResults(nextBundle, this.rng);

    this.clearTimers();
    this.bundle = nextBundle;
    this.currentCategoryIndex = 0;
    this.results = [];
    this.plannedResults = nextPlan;
    this.landedOption = null;
    this.prepareCategoryReadyState();

    if (immediateResolveForTests) {
      this.initiateCategoryRoll(true);
    }
  }

          prepareCategoryReadyState()       {
    if (!this.bundle) {
      return;
    }
    const category = this.bundle.categories[this.currentCategoryIndex];
    if (!category || category.options.length === 0) {
      return;
    }

    this.clearTimers();
    this.stage = 'READY';
    this.landedOption = null;
    this.activeReelTrack = buildTumblerReelTrack(category.options, category.options[0]);
    this.onStateChange();
  }

         initiateCategoryRoll(immediateResolve = false)       {
    if (this.stage !== 'READY' || !this.bundle) {
      return;
    }

    const category = this.bundle.categories[this.currentCategoryIndex];
    if (!category || category.options.length === 0) {
      return;
    }

    this.clearTimers();
    this.stage = 'ROLLING';

    const chosenOutcome = this.plannedResults[this.currentCategoryIndex]?.selectedOption;
    if (!chosenOutcome) {
      throw new Error(`Missing planned outcome for category "${category.name}".`);
    }
    this.landedOption = chosenOutcome;
    const track = buildTumblerReelTrack(category.options, chosenOutcome);
    this.activeReelTrack = track;

    this.onStateChange();

    if (immediateResolve || typeof window === 'undefined') {
      this.finalizeCategoryLanding(category, chosenOutcome);
      return;
    }

    this.driveVerticalTumblerAnimation(category, chosenOutcome, track);
  }

          driveVerticalTumblerAnimation(
    category          ,
    chosenOutcome        ,
    track
  )       {
    const totalTelemetryTicks = 20;
    for (let tick = 1; tick <= totalTelemetryTicks; tick++) {
      const tickTime = Math.round((tick / totalTelemetryTicks) * TUMBLER_TOTAL_DURATION_MS);
      const tId = window.setTimeout(() => {
        if (this.stage !== 'ROLLING') {
          return;
        }
        this.updateAmbientTelemetryDom(tick, totalTelemetryTicks);
      }, tickTime);
      this.activeTimers.push(tId);
    }

    const kickOffTimer = window.setTimeout(() => {
      if (this.stage !== 'ROLLING') {
        return;
      }
      const stripEl = document.querySelector             ('[data-role="tumbler-strip"]');
      if (stripEl) {
        stripEl.classList.add('is-phase-highspeed');
        stripEl.style.transition = `transform ${TUMBLER_HIGH_SPEED_MS}ms cubic-bezier(0.35, 0.0, 0.85, 0.65)`;
        stripEl.style.transform = `translate3d(0, ${track.highSpeedTranslateY}px, 0)`;
      }
    }, 25);
    this.activeTimers.push(kickOffTimer);

    const decelTimer = window.setTimeout(() => {
      if (this.stage !== 'ROLLING') {
        return;
      }
      const stripEl = document.querySelector             ('[data-role="tumbler-strip"]');
      if (stripEl) {
        stripEl.classList.remove('is-phase-highspeed');
        stripEl.classList.add('is-phase-decel');
        stripEl.style.transition = `transform ${TUMBLER_DECEL_MS}ms cubic-bezier(0.08, 0.85, 0.2, 1.0)`;
        stripEl.style.transform = `translate3d(0, ${track.finalTranslateY}px, 0)`;
      }
    }, TUMBLER_HIGH_SPEED_MS);
    this.activeTimers.push(decelTimer);

    const snapTimer = window.setTimeout(() => {
      if (this.stage !== 'ROLLING') {
        return;
      }
      this.finalizeCategoryLanding(category, chosenOutcome);
    }, TUMBLER_TOTAL_DURATION_MS);
    this.activeTimers.push(snapTimer);
  }

          updateAmbientTelemetryDom(tick        , totalTicks        )       {
    if (typeof document === 'undefined') {
      return;
    }
    const telemetryEl = document.querySelector             ('[data-role="reel-cipher-telemetry"]');
    const fillEl = document.querySelector             ('[data-role="reel-decrypt-fill"]');
    if (telemetryEl) {
      const hex = ((tick * 2654435761) >>> 0).toString(16).toUpperCase().padStart(8, '0');
      telemetryEl.textContent = `0x${hex}`;
    }
    if (fillEl) {
      fillEl.style.width = `${Math.min(100, Math.round((tick / totalTicks) * 100))}%`;
    }
  }

          finalizeCategoryLanding(category          , chosenOutcome        )       {
    this.clearTimers();
    this.stage = 'LANDED';
    this.landedOption = chosenOutcome;

    this.results.push({
      categoryId: category.id,
      categoryName: category.name,
      selectedOption: chosenOutcome,
    });

    this.onStateChange();
  }

         advanceToNextStep(immediateResolveForTests = false)       {
    if (this.stage !== 'LANDED' || !this.bundle) {
      return;
    }

    const isLast = this.currentCategoryIndex >= this.bundle.categories.length - 1;

    if (isLast) {
      this.stage = 'COMPLETE';
      const summary = createRunSummary(this.bundle, this.results);
      this.onCompleteRun(summary);
      return;
    }

    this.currentCategoryIndex += 1;
    this.landedOption = null;
    this.prepareCategoryReadyState();

    if (immediateResolveForTests) {
      this.initiateCategoryRoll(true);
    }
  }

         abortSequence()       {
    this.clearTimers();
    this.stage = 'IDLE';
    this.bundle = null;
    this.currentCategoryIndex = 0;
    this.landedOption = null;
    this.results = [];
    this.plannedResults = [];
    this.activeReelTrack = null;
    this.onAbortRun();
  }

          clearTimers()       {
    if (typeof window !== 'undefined') {
      for (const id of this.activeTimers) {
        window.clearTimeout(id);
      }
    }
    this.activeTimers = [];
  }

         renderStageMarkup()         {
    if (!this.bundle) {
      return '';
    }

    const total = this.bundle.categories.length;
    const currentIdx = this.currentCategoryIndex;
    const category = this.bundle.categories[currentIdx];
    const mandateNumber = String(currentIdx + 1).padStart(2, '0');
    const totalNumber = String(total).padStart(2, '0');

    const isReady = this.stage === 'READY';
    const isRolling = this.stage === 'ROLLING';
    const isLanded = this.stage === 'LANDED';
    const isFinalCategory = currentIdx === total - 1;

    const landedOption = isLanded ? this.landedOption : null;
    const landedRank = landedOption ? landedOption.rank : null;
    const isHighThreat = landedRank === 'S' || landedRank === 'A';

    const stageImpactClass = isLanded
      ? landedRank === 'S'
        ? 'is-landed-s-rank'
        : landedRank === 'A'
        ? 'is-landed-a-rank'
        : 'is-landed-standard'
      : isRolling
      ? 'is-rolling-active'
      : 'is-ready-standby';

    const uniformProbabilityPct = (100 / category.options.length).toFixed(1);

    const track =
      this.activeReelTrack ?? buildTumblerReelTrack(category.options, category.options[0]);
    const currentTranslateY = isLanded ? track.finalTranslateY : track.initialTranslateY;

    const staticHex = (((currentIdx + 1) * 3042502635) >>> 0)
      .toString(16)
      .toUpperCase()
      .padStart(8, '0');

    const stepPillsHtml = this.bundle.categories
      .map((cat, idx) => {
        const statusClass =
          idx < currentIdx
            ? 'is-resolved'
            : idx === currentIdx
            ? isLanded
              ? 'is-current-landed'
              : isRolling
              ? 'is-current-rolling'
              : 'is-current-ready'
            : 'is-pending';
        return `<div class="tgm-step-segment ${statusClass}" title="${escapeHtml(cat.name)}"></div>`;
      })
      .join('');

    const stripCardsHtml = track.items
      .map((opt, idx) => {
        const isWinningCard = isLanded && idx === track.winningIndex;
        const isNeighborCard = isLanded && idx !== track.winningIndex;
        return `
          <div class="tgm-tumbler-card ${isWinningCard ? 'is-winning-card' : ''} ${
          isNeighborCard ? 'is-dimmed-neighbor' : ''
        }">
            <span class="tgm-tumbler-card-rank tgm-tier-badge-${opt.rank}">RANK ${opt.rank}</span>
            <span class="tgm-tumbler-card-label">${escapeHtml(opt.label)}</span>
          </div>
        `;
      })
      .join('');

    const resolvedHistoryHtml =
      this.results.length > 0
        ? this.results
            .map(
              (res, idx) => `
          <div class="tgm-resolved-item">
            <span class="tgm-resolved-index">${String(idx + 1).padStart(2, '0')}</span>
            <span class="tgm-resolved-cat">${escapeHtml(res.categoryName)}</span>
            <span class="tgm-resolved-opt">${escapeHtml(res.selectedOption.label)}</span>
            <span class="tgm-mini-rank tgm-tier-badge-${res.selectedOption.rank}">${res.selectedOption.rank}</span>
          </div>
        `
            )
            .join('')
        : `<div class="tgm-resolved-empty">No mandates locked yet. Pull lever to initiate Mandate 01.</div>`;

    return `
      <section class="tgm-roll-stage ${stageImpactClass}">
        <div class="tgm-roll-topbar">
          <div class="tgm-roll-protocol-info">
            <span class="tgm-roll-protocol-kicker">ACTIVE ARBITER SEQUENCE</span>
            <h2 class="tgm-roll-game-title">${escapeHtml(this.bundle.title)}</h2>
          </div>
          <button
            type="button"
            class="tgm-btn tgm-btn-ghost tgm-btn-danger-hover tgm-abort-btn"
            data-action="abort-sequence"
            title="Scrap this run and return to game selection"
          >
            ${Icons.forfeitFlag}
            <span>Forfeit</span>
          </button>
        </div>

        <div class="tgm-step-track-container">
          <div class="tgm-step-header-row">
            <div class="tgm-mandate-counter">
              <span class="tgm-mandate-tag">MANDATE ${mandateNumber} / ${totalNumber}</span>
              <span class="tgm-mandate-divider">:</span>
              <span class="tgm-mandate-name">${escapeHtml(category.name.toUpperCase())}</span>
            </div>
            <div class="tgm-mandate-odds">
              ${Icons.crosshair}
              <span>POOL SIZE: ${category.options.length} CANDIDATES // UNIFORM P = 1/${category.options.length} (${uniformProbabilityPct}%)</span>
            </div>
          </div>
          <div class="tgm-step-segments">
            ${stepPillsHtml}
          </div>
        </div>

        <div class="tgm-reel-arena ${
          isLanded ? 'is-locked' : isRolling ? 'is-cycling' : 'is-standby'
        } ${landedRank ? `tgm-arena-rank-${landedRank}` : ''}">
          <div class="tgm-reel-status-row">
            <span class="tgm-reel-telemetry" data-role="reel-cipher-telemetry">0x${staticHex}</span>
            <span class="tgm-reel-lock-indicator">
              ${
                isReady
                  ? 'READY TO ROLL'
                  : isRolling
                  ? 'JUDGING YOUR FATE...'
                  : `LOCKED // RANK ${landedRank}`
              }
            </span>
          </div>

          <div class="tgm-reel-decrypt-bar ${isLanded ? 'is-complete' : ''}">
            <div
              class="tgm-reel-decrypt-fill"
              data-role="reel-decrypt-fill"
              style="width: ${isLanded ? '100%' : isRolling ? '12%' : '0%'}"
            ></div>
          </div>

          <div class="tgm-tumbler-housing">
            <div class="tgm-tumbler-viewport" data-role="tumbler-viewport">
              <div class="tgm-tumbler-mask-top" aria-hidden="true"></div>
              <div class="tgm-tumbler-mask-bottom" aria-hidden="true"></div>

              <div class="tgm-tumbler-reticle ${isLanded ? 'is-reticle-locked' : ''} ${
      landedRank ? `tgm-reticle-rank-${landedRank}` : ''
    }" aria-hidden="true">
                <span class="tgm-reticle-arm tgm-reticle-left">[ &lt; TARGET</span>
                <span class="tgm-reticle-line"></span>
                <span class="tgm-reticle-arm tgm-reticle-right">TARGET &gt; ]</span>
              </div>

              <div
                class="tgm-tumbler-strip"
                data-role="tumbler-strip"
                style="transform: translate3d(0, ${currentTranslateY}px, 0);"
              >
                ${stripCardsHtml}
              </div>
            </div>
          </div>

          ${
            isReady
              ? `
            <div class="tgm-verdict-details is-ready-panel">
              <div class="tgm-ready-instructions">
                <div class="tgm-verdict-keyhint">
                  Press <kbd>SPACE</kbd> or <kbd>ENTER</kbd> or click lever to initiate uniform draw
                </div>
              </div>
              <button
                type="button"
                class="tgm-btn tgm-btn-primary tgm-btn-lever"
                data-action="pull-lever"
              >
                ${Icons.leverSwitch}
                <span>PULL LEVER</span>
              </button>
            </div>
          `
              : isRolling
              ? `
            <div class="tgm-verdict-details is-awaiting">
              <div class="tgm-awaiting-message">
                Mechanical tumbler engaged. Decelerating candidate strip toward target reticle...
              </div>
            </div>
          `
              : `
            <div class="tgm-verdict-details">
              <div class="tgm-verdict-severity ${isHighThreat ? 'is-high-threat' : ''}">
                ${Icons.alertDiamond}
                <span>${escapeHtml(
                  RANK_SEVERITY_DESCRIPTIONS[landedOption ? landedOption.rank : 'C']
                )}</span>
              </div>

              <div class="tgm-verdict-actions">
                <div class="tgm-verdict-keyhint">
                  Press <kbd>SPACE</kbd> or <kbd>ENTER</kbd> to confirm locked mandate
                </div>
                <button
                  type="button"
                  class="tgm-btn tgm-btn-primary tgm-btn-advance"
                  data-action="advance-sequence"
                >
                  <span>${
                    isFinalCategory ? 'PROCEED TO FINAL VERDICT' : 'ACCEPT FATE & ADVANCE'
                  }</span>
                  ${Icons.chevronRight}
                </button>
              </div>
            </div>
          `
          }
        </div>

        <div class="tgm-roll-bottom-grid">
          <div class="tgm-roll-panel">
            <div class="tgm-roll-panel-header">
              <span>MANDATE DECLARATIONS (${category.options.length})</span>
            </div>
            <div class="tgm-candidate-pool-list">
              ${category.options
                .map((opt) => {
                  const isChosen = isLanded && landedOption?.id === opt.id;
                  const isEliminated = isLanded && landedOption?.id !== opt.id;
                  return `
                    <div class="tgm-candidate-chip ${isChosen ? 'is-chosen' : ''} ${
                    isEliminated ? 'is-eliminated' : ''
                  }">
                      <span class="tgm-mini-rank tgm-tier-badge-${opt.rank}">${opt.rank}</span>
                      <span class="tgm-candidate-label">${escapeHtml(opt.label)}</span>
                    </div>
                  `;
                })
                .join('')}
            </div>
          </div>

          <div class="tgm-roll-panel">
            <div class="tgm-roll-panel-header">
              <span>SEALED MANDATES</span>
              <span>${this.results.length} / ${total} LOCKED</span>
            </div>
            <div class="tgm-resolved-list">
              ${resolvedHistoryHtml}
            </div>
          </div>
        </div>
      </section>
    `;
  }
}

function escapeHtml(raw        )         {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
const OVERALL_RANK_TITLES                                 = {
  F: 'LENIENT BASELINE PROTOCOL',
  E: 'MILD TACTICAL CONSTRAINT',
  D: 'STANDARD COMBAT DIRECTIVE',
  C: 'DISCIPLINED ARBITER DECREE',
  B: 'SEVERE OPERATIONAL TRIAL',
  A: 'PUNISHING CRUCIBLE VERDICT',
  S: 'SOVEREIGN MAXIMUM ORDEAL',
};
function formatRunDossierMarkdown(summary            )         {
  const isoTimestamp = new Date(summary.timestamp).toISOString().replace('T', ' ').slice(0, 19);
  const scoreFormatted = `${summary.numericalScore.toFixed(2)} / 7.00 SEVERITY`;

  const lines           = [
    `# THE GAME MASTER // ARBITER FINAL VERDICT`,
    `**Game Protocol:** ${summary.gameTitle}`,
    `**Overall Difficulty Rank:** RANK ${summary.overallRank} (${OVERALL_RANK_TITLES[summary.overallRank]})`,
    `**Severity Metric:** ${scoreFormatted}`,
    `**Timestamp (UTC):** ${isoTimestamp}`,
  ];

  if (summary.hazardBannerMessage) {
    lines.push(`> ${summary.hazardBannerMessage}`);
  }

  lines.push('', '## SEALED MANDATE BREAKDOWN');

  summary.results.forEach((res, idx) => {
    const num = String(idx + 1).padStart(2, '0');
    lines.push(
      `- **MANDATE ${num} // ${res.categoryName.toUpperCase()}:** ${res.selectedOption.label} \`[RANK ${res.selectedOption.rank}]\``
    );
  });

  lines.push('', '---', '*Generated by The Game Master (Strict 1/N Uniform Arbiter)*');

  return lines.join('\n');
}
function renderResultsDossierMarkup(summary            , copyConfirmed = false)         {
  const scoreReadout = `${summary.numericalScore.toFixed(2)} / 7.00 SEVERITY`;
  const isoTimestamp = new Date(summary.timestamp).toISOString().replace('T', ' ').slice(0, 19);
  const rankSubtitle = OVERALL_RANK_TITLES[summary.overallRank];

  const mandateCardsHtml = summary.results
    .map((res, idx) => {
      const mandateNum = String(idx + 1).padStart(2, '0');
      const shortTierTag = RANK_SEVERITY_DESCRIPTIONS[res.selectedOption.rank];
      return `
        <article class="tgm-dossier-card tgm-dossier-card-rank-${res.selectedOption.rank}">
          <div class="tgm-dossier-card-top">
            <div class="tgm-dossier-card-meta">
              <span class="tgm-dossier-mandate-num">MANDATE ${mandateNum}</span>
              <h3 class="tgm-dossier-category-name">${escapeHtml(res.categoryName)}</h3>
            </div>
            <div class="tgm-dossier-rank-badge tgm-tier-badge-${res.selectedOption.rank}">
              <span class="tgm-dossier-rank-prefix">RANK</span>
              <span class="tgm-dossier-rank-letter">${res.selectedOption.rank}</span>
            </div>
          </div>

          <div class="tgm-dossier-card-body">
            <div class="tgm-dossier-option-label">${escapeHtml(res.selectedOption.label)}</div>
            <div class="tgm-dossier-option-note">${escapeHtml(shortTierTag)}</div>
          </div>
        </article>
      `;
    })
    .join('');

  return `
    <section class="tgm-dossier-view" data-role="results-dossier">
      <div class="tgm-dossier-hero tgm-hero-rank-${summary.overallRank}">
        <div class="tgm-dossier-hero-kicker">
          <span>STAMPED ${escapeHtml(isoTimestamp)} UTC</span>
        </div>

        <h2 class="tgm-dossier-hero-title">ARBITER FINAL VERDICT</h2>
        <div class="tgm-dossier-game-subtitle">${escapeHtml(summary.gameTitle)}</div>

        <div class="tgm-rank-seal-wrapper">
          <div class="tgm-rank-seal tgm-tier-badge-${summary.overallRank}" data-role="overall-rank-seal">
            <span class="tgm-rank-seal-caption">OVERALL RANK</span>
            <span class="tgm-rank-seal-grade">${summary.overallRank}</span>
          </div>
        </div>

        <div class="tgm-dossier-rank-designation">${escapeHtml(rankSubtitle)}</div>

        <div class="tgm-dossier-severity-readout" data-role="severity-readout">
          <span class="tgm-severity-label">RUN DIFFICULTY RATING:</span>
          <strong class="tgm-severity-score">${scoreReadout}</strong>
        </div>

        ${
          summary.hazardBannerMessage
            ? `
          <div class="tgm-hazard-outlier-banner" role="alert" data-role="hazard-outlier-banner">
            <span class="tgm-hazard-code">${escapeHtml(summary.hazardBannerMessage)}</span>
          </div>
        `
            : ''
        }
      </div>

      <div class="tgm-dossier-section-header">
        <div>
          <h3 class="tgm-section-title">Sealed Mandate Breakdown (${summary.results.length})</h3>
        </div>
      </div>

      <div class="tgm-dossier-cards-grid">
        ${mandateCardsHtml}
      </div>

      <div class="tgm-dossier-footer-controls">
        <button
          type="button"
          class="tgm-btn tgm-btn-secondary tgm-btn-dossier-copy ${copyConfirmed ? 'is-copied' : ''}"
          data-action="copy-run-dossier"
        >
          ${copyConfirmed ? Icons.check : Icons.clipboardCopy}
          <span>${copyConfirmed ? 'DOSSIER COPIED TO CLIPBOARD' : 'Copy Run Dossier'}</span>
        </button>

        <button
          type="button"
          class="tgm-btn tgm-btn-primary tgm-btn-dossier-return"
          data-action="return-to-library"
        >
          ${Icons.check}
          <span>Acknowledge &amp; Return to Library</span>
        </button>
      </div>
    </section>
  `;
}

function generateId(prefix        )         {
  const randomPart = Math.random().toString(36).substring(2, 9);
  const timePart = Date.now().toString(36).slice(-4);
  return `${prefix}-${timePart}-${randomPart}`;
}

function escapeHtml(raw        )         {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
class GameMasterUIController {
                   root             ;
          viewMode           = 'LIBRARY';
          bundles               = [];

          draftBundle                    = null;
          isCreatingNew = false;
          showValidationErrors = false;

          pendingDeleteBundle                    = null;
          importModalOpen = false;
          importDraftText = '';
          importErrorMessage                = null;
          statusBanner                      = null;
          statusTimeoutId                = null;

          onBeginSequenceCallback                        ;
          onSequenceCompleteCallback                           ;
                   rollController                          ;
          completedRunSummary                    = null;
          dossierCopyConfirmed = false;
          copyResetTimeoutId                = null;

  constructor(
    rootElement             ,
    onBeginSequence                        ,
    onSequenceComplete
  ) {
    this.root = rootElement;
    this.onBeginSequenceCallback = onBeginSequence;
    this.onSequenceCompleteCallback = onSequenceComplete;

    this.rollController = new SequentialRollController({
      onStateChange: () => {
        this.render();
      },
      onAbortRun: () => {
        this.completedRunSummary = null;
        this.dossierCopyConfirmed = false;
        this.viewMode = 'LIBRARY';
        this.render();
        this.setStatusBanner(
          'info',
          'Run aborted. Ephemeral mandate history wiped. Returned to Game Library.'
        );
      },
      onCompleteRun: (summary            ) => {
        this.completedRunSummary = summary;
        this.dossierCopyConfirmed = false;
        if (this.onSequenceCompleteCallback) {
          this.onSequenceCompleteCallback(summary);
        } else {
          this.viewMode = 'VERDICT_HANDOFF';
          this.render();
        }
      },
    });
  }

         init()       {
    this.refreshBundles();
    this.bindRootDelegation();
    this.render();
  }

         setBeginSequenceHandler(handler                       )       {
    this.onBeginSequenceCallback = handler;
  }

         setSequenceCompleteHandler(handler                          )       {
    this.onSequenceCompleteCallback = handler;
  }

         getRollController()                           {
    return this.rollController;
  }

         refreshBundles()       {
    this.bundles = getAllBundles();
  }

          setStatusBanner(type                      , message        , autoClearMs = 5000)       {
    if (this.statusTimeoutId !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.statusTimeoutId);
      this.statusTimeoutId = null;
    }

    this.statusBanner = { type, message };
    this.renderStatusBannerOnly();

    if (autoClearMs > 0 && typeof window !== 'undefined') {
      this.statusTimeoutId = window.setTimeout(() => {
        this.statusBanner = null;
        this.renderStatusBannerOnly();
      }, autoClearMs);
    }
  }

          renderStatusBannerOnly()       {
    const slot = this.root.querySelector             ('[data-role="status-banner-slot"]');
    if (slot) {
      slot.innerHTML = this.renderStatusBannerMarkup();
    }
  }

          handleCreateNewBundle()       {
    const now = Date.now();
    this.isCreatingNew = true;
    this.showValidationErrors = false;
    this.draftBundle = {
      id: generateId('game'),
      title: 'New Challenge Protocol',
      description: 'Define non-negotiable parameters and category pools for this run.',
      createdAt: now,
      updatedAt: now,
      categories: [
        {
          id: generateId('cat'),
          name: 'Primary Restriction',
          options: [
            { id: generateId('opt'), label: 'Standard Loadout Permitted', rank: 'F' },
            { id: generateId('opt'), label: 'Restricted Equipment Lock', rank: 'B' },
          ],
        },
      ],
    };
    this.viewMode = 'EDITOR';
    this.render();
  }

          handleEditBundle(bundleId        )       {
    const existing = getBundleById(bundleId);
    if (!existing) {
      this.setStatusBanner('error', 'Target game could not be found in storage.');
      return;
    }

    this.isCreatingNew = false;
    this.showValidationErrors = false;
    this.draftBundle = JSON.parse(JSON.stringify(existing))              ;
    this.viewMode = 'EDITOR';
    this.render();
  }

          handleDuplicateBundle(bundleId        )       {
    const existing = getBundleById(bundleId);
    if (!existing) {
      this.setStatusBanner('error', 'Cannot duplicate: source game not found.');
      return;
    }

    const now = Date.now();
    const clonedCategories             = existing.categories.map((cat) => ({
      id: generateId('cat'),
      name: cat.name,
      options: cat.options.map((opt) => ({
        id: generateId('opt'),
        label: opt.label,
        rank: opt.rank,
      })),
    }));

    const duplicated             = {
      id: generateId('game'),
      title: `${existing.title} (Copy)`,
      description: existing.description,
      categories: clonedCategories,
      createdAt: now,
      updatedAt: now,
    };

    try {
      saveBundle(duplicated);
      this.refreshBundles();
      this.render();
      this.setStatusBanner('success', `Duplicated game "${duplicated.title}".`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to duplicate game.';
      this.setStatusBanner('error', msg);
    }
  }

          handleRequestDeleteBundle(bundleId        )       {
    const target = this.bundles.find((b) => b.id === bundleId) || null;
    if (!target) {
      return;
    }
    this.pendingDeleteBundle = target;
    this.render();
  }

          handleConfirmDeleteBundle()       {
    if (!this.pendingDeleteBundle) {
      return;
    }
    const deletedTitle = this.pendingDeleteBundle.title;
    deleteBundle(this.pendingDeleteBundle.id);
    this.pendingDeleteBundle = null;
    this.refreshBundles();
    this.render();
    this.setStatusBanner('info', `Deleted game "${deletedTitle}".`);
  }

          handleBeginSequence(bundleId        )       {
    const target = getBundleById(bundleId);
    if (!target) {
      this.setStatusBanner('error', 'Selected game could not be loaded.');
      return;
    }

    const report = evaluateBundleGuardrails(target);
    if (!report.isValid) {
      this.setStatusBanner(
        'error',
        `Cannot launch "${target.title}": ${report.allErrorMessages[0]}`
      );
      return;
    }

    if (this.onBeginSequenceCallback) {
      this.onBeginSequenceCallback(target);
      return;
    }

    this.completedRunSummary = null;
    this.statusBanner = null;
    this.viewMode = 'ROLL_SEQUENCE';
    try {
      this.rollController.startSequence(target);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to create a valid random configuration.';
      this.viewMode = 'LIBRARY';
      this.setStatusBanner('error', message, 10000);
    }
  }

          handleExportLibrary()       {
    try {
      const jsonString = exportBundlesToJSON();
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const dateStamp = new Date().toISOString().slice(0, 10);
      anchor.href = url;
      anchor.download = `tgm-games-${dateStamp}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);

      this.setStatusBanner(
        'success',
        `Exported ${this.bundles.length} game${this.bundles.length === 1 ? '' : 's'} to JSON.`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Export failed.';
      this.setStatusBanner('error', msg);
    }
  }

          handleOpenImportModal()       {
    this.importModalOpen = true;
    this.importDraftText = '';
    this.importErrorMessage = null;
    this.render();
  }

          handleCloseImportModal()       {
    this.importModalOpen = false;
    this.importDraftText = '';
    this.importErrorMessage = null;
    this.render();
  }

          handleExecuteImport()       {
    const raw = this.importDraftText.trim();
    const result = importBundlesFromJSON(raw);

    if (!result.success) {
      this.importErrorMessage = result.error ?? 'Schema validation failed for imported JSON.';
      this.render();
      return;
    }

    this.importModalOpen = false;
    this.importDraftText = '';
    this.importErrorMessage = null;
    this.refreshBundles();
    this.render();
    this.setStatusBanner(
      'success',
      `Successfully validated and imported ${result.count ?? 0} game${result.count === 1 ? '' : 's'}.`
    );
  }

          handleCancelEdit()       {
    this.draftBundle = null;
    this.isCreatingNew = false;
    this.showValidationErrors = false;
    this.viewMode = 'LIBRARY';
    this.render();
  }

          handleSaveDraftBundle()       {
    if (!this.draftBundle) {
      return;
    }

    this.showValidationErrors = true;
    const report = evaluateBundleGuardrails(this.draftBundle);

    if (!report.isValid) {
      this.render();
      this.setStatusBanner(
        'error',
        `Validation blocked save: ${report.allErrorMessages.length} issue${report.allErrorMessages.length === 1 ? '' : 's'} require resolution.`
      );
      return;
    }

    try {
      this.draftBundle.updatedAt = Date.now();
      saveBundle(this.draftBundle);
      const savedTitle = this.draftBundle.title;
      this.draftBundle = null;
      this.isCreatingNew = false;
      this.showValidationErrors = false;
      this.refreshBundles();
      this.viewMode = 'LIBRARY';
      this.render();
      this.setStatusBanner('success', `Saved game "${savedTitle}".`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to save game.';
      this.setStatusBanner('error', msg);
    }
  }

          handleAddCategory()       {
    if (!this.draftBundle) {
      return;
    }
    const nextNumber = this.draftBundle.categories.length + 1;
    this.draftBundle.categories.push({
      id: generateId('cat'),
      name: `Category ${nextNumber}`,
      options: [
        { id: generateId('opt'), label: 'Outcome Option A', rank: 'D' },
        { id: generateId('opt'), label: 'Outcome Option B', rank: 'B' },
      ],
    });
    this.render();
  }

          handleDeleteCategory(categoryId        )       {
    if (!this.draftBundle) {
      return;
    }
    this.draftBundle.categories = this.draftBundle.categories.filter((c) => c.id !== categoryId);
    this.render();
  }

          handleAddOption(categoryId        )       {
    if (!this.draftBundle) {
      return;
    }
    const cat = this.draftBundle.categories.find((c) => c.id === categoryId);
    if (!cat) {
      return;
    }

    const quickInput = this.root.querySelector                  (
      `input[data-action="quick-add-input"][data-category-id="${categoryId}"]`
    );
    const labelValue =
      quickInput && quickInput.value.trim().length > 0
        ? quickInput.value.trim()
        : `Option ${cat.options.length + 1}`;

    cat.options.push({
      id: generateId('opt'),
      label: labelValue,
      rank: 'C',
    });

    this.render();

    const updatedQuickInput = this.root.querySelector                  (
      `input[data-action="quick-add-input"][data-category-id="${categoryId}"]`
    );
    if (updatedQuickInput) {
      updatedQuickInput.focus();
    }
  }

          handleDeleteOption(categoryId        , optionId        )       {
    if (!this.draftBundle) {
      return;
    }
    const cat = this.draftBundle.categories.find((c) => c.id === categoryId);
    if (!cat) {
      return;
    }
    cat.options = cat.options.filter((o) => o.id !== optionId);
    this.render();
  }

          handleSetOptionRank(categoryId        , optionId        , rank      )       {
    if (!this.draftBundle) {
      return;
    }
    const cat = this.draftBundle.categories.find((c) => c.id === categoryId);
    if (!cat) {
      return;
    }
    const opt = cat.options.find((o) => o.id === optionId);
    if (!opt) {
      return;
    }
    opt.rank = rank;

    const selectorGroup = this.root.querySelector             (
      `[data-role="rank-selector"][data-category-id="${categoryId}"][data-option-id="${optionId}"]`
    );
    if (selectorGroup) {
      const buttons = selectorGroup.querySelectorAll                   ('button[data-rank]');
      buttons.forEach((btn) => {
        const isSelected = btn.getAttribute('data-rank') === rank;
        btn.classList.toggle('is-active', isSelected);
        btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
      });
    } else {
      this.render();
    }
  }

          bindRootDelegation()       {
    this.root.addEventListener('click', (event            ) => {
      const target = event.target                      ;
      if (!target) {
        return;
      }

      const actionEl = target.closest             ('[data-action]');
      if (!actionEl) {
        return;
      }

      const action = actionEl.getAttribute('data-action');
      const bundleId = actionEl.getAttribute('data-bundle-id') ?? '';
      const categoryId = actionEl.getAttribute('data-category-id') ?? '';
      const optionId = actionEl.getAttribute('data-option-id') ?? '';

      switch (action) {
        case 'create-bundle':
          this.handleCreateNewBundle();
          break;
        case 'export-library':
          this.handleExportLibrary();
          break;
        case 'open-import-modal':
          this.handleOpenImportModal();
          break;
        case 'close-import-modal':
          this.handleCloseImportModal();
          break;
        case 'confirm-import':
          this.handleExecuteImport();
          break;
        case 'trigger-file-input': {
          const fileInput = this.root.querySelector                  ('#tgm-import-file-input');
          if (fileInput) {
            fileInput.click();
          }
          break;
        }
        case 'begin-sequence':
          this.handleBeginSequence(bundleId);
          break;
        case 'edit-bundle':
          this.handleEditBundle(bundleId);
          break;
        case 'duplicate-bundle':
          this.handleDuplicateBundle(bundleId);
          break;
        case 'request-delete-bundle':
          this.handleRequestDeleteBundle(bundleId);
          break;
        case 'cancel-delete-bundle':
          this.pendingDeleteBundle = null;
          this.render();
          break;
        case 'confirm-delete-bundle':
          this.handleConfirmDeleteBundle();
          break;
        case 'save-bundle':
          this.handleSaveDraftBundle();
          break;
        case 'cancel-edit':
          this.handleCancelEdit();
          break;
        case 'add-category':
          this.handleAddCategory();
          break;
        case 'delete-category':
          this.handleDeleteCategory(categoryId);
          break;
        case 'add-option':
          this.handleAddOption(categoryId);
          break;
        case 'delete-option':
          this.handleDeleteOption(categoryId, optionId);
          break;
        case 'select-rank': {
          const rankAttr = actionEl.getAttribute('data-rank')               ;
          if (rankAttr && (VALID_RANKS                     ).includes(rankAttr)) {
            this.handleSetOptionRank(categoryId, optionId, rankAttr);
          }
          break;
        }
        case 'pull-lever':
          this.rollController.initiateCategoryRoll();
          break;
        case 'advance-sequence':
          this.rollController.advanceToNextStep();
          break;
        case 'abort-sequence':
          this.rollController.abortSequence();
          break;
        case 'copy-run-dossier':
          this.handleCopyRunDossier();
          break;
        case 'return-to-library':
          this.completedRunSummary = null;
          this.dossierCopyConfirmed = false;
          this.viewMode = 'LIBRARY';
          this.render();
          break;
        case 'dismiss-status':
          this.statusBanner = null;
          this.renderStatusBannerOnly();
          break;
      }
    });

    this.root.addEventListener('input', (event       ) => {
      const target = event.target                                                 ;
      if (!target) {
        return;
      }

      const field = target.getAttribute('data-field');
      if (!field) {
        return;
      }

      if (field === 'import-json-textarea') {
        this.importDraftText = target.value;
        return;
      }

      if (!this.draftBundle) {
        return;
      }

      if (field === 'bundle-title') {
        this.draftBundle.title = target.value;
        this.refreshEditorValidationOutlines();
      } else if (field === 'bundle-description') {
        this.draftBundle.description = target.value;
      } else if (field === 'category-name') {
        const categoryId = target.getAttribute('data-category-id');
        const cat = this.draftBundle.categories.find((c) => c.id === categoryId);
        if (cat) {
          cat.name = target.value;
          this.refreshEditorValidationOutlines();
        }
      } else if (field === 'option-label') {
        const categoryId = target.getAttribute('data-category-id');
        const optionId = target.getAttribute('data-option-id');
        const cat = this.draftBundle.categories.find((c) => c.id === categoryId);
        const opt = cat?.options.find((o) => o.id === optionId);
        if (opt) {
          opt.label = target.value;
          this.refreshEditorValidationOutlines();
        }
      }
    });

    this.root.addEventListener('keydown', (event               ) => {
      const target = event.target                      ;
      if (!target) {
        return;
      }
      if (event.key === 'Enter' && target.getAttribute('data-action') === 'quick-add-input') {
        event.preventDefault();
        const categoryId = target.getAttribute('data-category-id') ?? '';
        if (categoryId) {
          this.handleAddOption(categoryId);
        }
      }
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', (event               ) => {
        if (this.viewMode !== 'ROLL_SEQUENCE') {
          return;
        }
        const activeTag = document.activeElement?.tagName.toLowerCase();
        if (event.key === ' ' || event.key === 'Enter') {
          if (activeTag !== 'input' && activeTag !== 'textarea' && activeTag !== 'button') {
            const snapshot = this.rollController.getSnapshot();
            if (snapshot.stage === 'READY') {
              event.preventDefault();
              this.rollController.initiateCategoryRoll();
            } else if (snapshot.stage === 'LANDED') {
              event.preventDefault();
              this.rollController.advanceToNextStep();
            }
          }
        }
      });
    }

    this.root.addEventListener('change', (event       ) => {
      const target = event.target                           ;
      if (!target || target.id !== 'tgm-import-file-input') {
        return;
      }

      const file = target.files?.[0];
      if (!file) {
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          this.importDraftText = reader.result;
          this.importErrorMessage = null;
          this.render();
        }
      };
      reader.onerror = () => {
        this.importErrorMessage = 'Failed to read selected file from disk.';
        this.render();
      };
      reader.readAsText(file);
    });
  }

          refreshEditorValidationOutlines()       {
    if (!this.draftBundle) {
      return;
    }
    const report = evaluateBundleGuardrails(this.draftBundle);

    const saveBtn = this.root.querySelector                   ('[data-action="save-bundle"]');
    if (saveBtn) {
      saveBtn.classList.toggle('is-guardrail-blocked', !report.isValid);
    }

    const bannerSlot = this.root.querySelector             ('[data-role="editor-validation-slot"]');
    if (bannerSlot) {
      bannerSlot.innerHTML = this.renderEditorValidationSummary(report);
    }
  }

         render()       {
    let content = '';
    if (this.viewMode === 'LIBRARY') {
      content = this.renderLibraryView();
    } else if (this.viewMode === 'EDITOR') {
      content = this.renderEditorView();
    } else if (this.viewMode === 'ROLL_SEQUENCE') {
      content = this.rollController.renderStageMarkup();
    } else if (this.viewMode === 'VERDICT_HANDOFF') {
      content = this.renderVerdictHandoffView();
    }

    this.root.innerHTML = `
      <div class="tgm-shell">
        ${this.renderGlobalHeader()}
        <div data-role="status-banner-slot">${this.renderStatusBannerMarkup()}</div>
        <main class="tgm-main">
          ${content}
        </main>
        ${this.renderGlobalFooter()}
        ${this.renderDeleteConfirmationModal()}
        ${this.renderImportModal()}
      </div>
    `;
  }

          renderGlobalFooter()         {
    return `
      <footer class="tgm-footer">
        <div class="tgm-footer-inner">
          <span class="tgm-footer-protocol">THE GAME MASTER // BUILD 1.0.0 // 2026-11-11 // <a
            href="https://github.com/ShizeyaDev/the-game-master/blob/main/LICENSE"
            target="_blank"
            rel="noopener noreferrer"
            class="tgm-footer-license"
          >POLYFORM NONCOMMERCIAL 1.0.0</a></span>
          <a
            href="https://github.com/ShizeyaDev"
            target="_blank"
            rel="noopener noreferrer"
            class="tgm-creator-signature"
          >DESIGNED BY SHIZEYA</a>
        </div>
      </footer>
    `;
  }

          renderGlobalHeader()         {
    const isLibrary = this.viewMode === 'LIBRARY';
    const modeLabel =
      this.viewMode === 'EDITOR'
        ? 'PROTOCOL CONFIGURATION MODE'
        : this.viewMode === 'ROLL_SEQUENCE'
        ? 'DECREE EXECUTION'
        : 'FINAL VERDICT';

    return `
      <header class="tgm-header">
        <div class="tgm-brand">
          <div class="tgm-brand-emblem">${Icons.arbiterCrest}</div>
          <div class="tgm-brand-text">
            <div class="tgm-brand-kicker">UNCOMPROMISING CHALLENGE ARBITER</div>
            <h1 class="tgm-brand-title">THE GAME MASTER</h1>
          </div>
        </div>
        ${
          isLibrary
            ? `
          <div class="tgm-header-actions">
            <button type="button" class="tgm-btn tgm-btn-secondary" data-action="open-import-modal">
              ${Icons.upload}
              <span>Import Library</span>
            </button>
            <button type="button" class="tgm-btn tgm-btn-secondary" data-action="export-library">
              ${Icons.download}
              <span>Export Library (JSON)</span>
            </button>
            <button type="button" class="tgm-btn tgm-btn-primary" data-action="create-bundle">
              ${Icons.plus}
              <span>Create New Game</span>
            </button>
          </div>
        `
            : `
          <div class="tgm-header-mode-indicator">
            <span class="tgm-mode-dot"></span>
            <span>${modeLabel}</span>
          </div>
        `
        }
      </header>
    `;
  }

          renderStatusBannerMarkup()         {
    if (!this.statusBanner) {
      return '';
    }
    return `
      <div class="tgm-status-banner tgm-status-${this.statusBanner.type}" role="status">
        <div class="tgm-status-content">
          <span class="tgm-status-icon">${
            this.statusBanner.type === 'success' ? Icons.check : Icons.alertDiamond
          }</span>
          <span class="tgm-status-message">${escapeHtml(this.statusBanner.message)}</span>
        </div>
        <button type="button" class="tgm-icon-btn" data-action="dismiss-status" aria-label="Dismiss notification">
          ${Icons.close}
        </button>
      </div>
    `;
  }

          renderLibraryView()         {
    if (this.bundles.length === 0) {
      return `
        <section class="tgm-empty-state">
          <div class="tgm-empty-crest">${Icons.arbiterCrest}</div>
          <h2 class="tgm-empty-title">No Games Registered</h2>
          <p class="tgm-empty-subtitle">
            Create a new game or import an existing JSON library to begin.
          </p>
          <div class="tgm-empty-actions">
            <button type="button" class="tgm-btn tgm-btn-primary" data-action="create-bundle">
              ${Icons.plus}
              <span>Create New Game</span>
            </button>
            <button type="button" class="tgm-btn tgm-btn-secondary" data-action="open-import-modal">
              ${Icons.upload}
              <span>Import Library</span>
            </button>
          </div>
        </section>
      `;
    }

    const cardsHtml = this.bundles.map((bundle) => this.renderBundleCard(bundle)).join('');

    return `
      <section class="tgm-section">
        <div class="tgm-section-header">
          <div>
            <h2 class="tgm-section-title">Registered Games</h2>
          </div>
          <div class="tgm-section-meta">
            <span class="tgm-stat-pill">${this.bundles.length} GAME${this.bundles.length === 1 ? '' : 'S'} ACTIVE</span>
          </div>
        </div>
        <div class="tgm-bundle-grid">
          ${cardsHtml}
        </div>
      </section>
    `;
  }

          renderBundleCard(bundle            )         {
    const metrics = computeBundleMetrics(bundle);
    const report = evaluateBundleGuardrails(bundle);
    const updatedDate = new Date(bundle.updatedAt).toISOString().slice(0, 10);

    return `
      <article class="tgm-bundle-card ${!report.isValid ? 'has-validation-warning' : ''}">
        <div class="tgm-card-top">
          <div class="tgm-card-header-row">
            <h3 class="tgm-card-title">${escapeHtml(bundle.title)}</h3>
            <span class="tgm-card-timestamp" title="Last modified">REV // ${updatedDate}</span>
          </div>
          <p class="tgm-card-description">
            ${
              bundle.description.trim().length > 0
                ? escapeHtml(bundle.description)
                : 'No protocol description specified.'
            }
          </p>
          <div class="tgm-card-chips">
            <span class="tgm-chip">
              ${Icons.layers}
              <span><strong>${metrics.categoryCount}</strong> Categor${metrics.categoryCount === 1 ? 'y' : 'ies'}</span>
            </span>
            <span class="tgm-chip">
              ${Icons.gridNodes}
              <span><strong>${metrics.totalOptionsCount}</strong> Pool Options</span>
            </span>
            <span class="tgm-chip tgm-chip-uniform">
              <span>1/N UNIFORM RNG</span>
            </span>
          </div>
          ${
            !report.isValid
              ? `
            <div class="tgm-card-warning">
              ${Icons.alertDiamond}
              <span>${escapeHtml(report.allErrorMessages[0])}</span>
            </div>
          `
              : ''
          }
        </div>

        <div class="tgm-card-actions">
          <button
            type="button"
            class="tgm-btn tgm-btn-launch"
            data-action="begin-sequence"
            data-bundle-id="${escapeHtml(bundle.id)}"
            ${!report.isValid ? 'disabled title="Resolve game validation issues before launching"' : ''}
          >
            ${Icons.play}
            <span>Begin Sequence</span>
          </button>
          <div class="tgm-card-secondary-actions">
            <button
              type="button"
              class="tgm-btn tgm-btn-ghost"
              data-action="edit-bundle"
              data-bundle-id="${escapeHtml(bundle.id)}"
              title="Edit Game"
            >
              ${Icons.edit}
              <span>Edit Game</span>
            </button>
            <button
              type="button"
              class="tgm-btn tgm-btn-ghost"
              data-action="duplicate-bundle"
              data-bundle-id="${escapeHtml(bundle.id)}"
              title="Duplicate Game"
            >
              ${Icons.duplicate}
              <span>Duplicate</span>
            </button>
            <button
              type="button"
              class="tgm-btn tgm-btn-ghost tgm-btn-danger-hover"
              data-action="request-delete-bundle"
              data-bundle-id="${escapeHtml(bundle.id)}"
              title="Delete Game"
            >
              ${Icons.trash}
              <span>Delete</span>
            </button>
          </div>
        </div>
      </article>
    `;
  }

          renderEditorView()         {
    if (!this.draftBundle) {
      return '';
    }

    const report = evaluateBundleGuardrails(this.draftBundle);
    const metrics = computeBundleMetrics(this.draftBundle);

    const categoriesMarkup =
      this.draftBundle.categories.length === 0
        ? `
        <div class="tgm-empty-categories">
          <div class="tgm-empty-icon">${Icons.alertDiamond}</div>
          <p>This game currently has zero categories. At least 1 category with 2+ options is required.</p>
          <button type="button" class="tgm-btn tgm-btn-primary" data-action="add-category">
            ${Icons.plus}
            <span>Add First Category</span>
          </button>
        </div>
      `
        : this.draftBundle.categories
            .map((cat, idx) => this.renderCategoryEditorBlock(cat, idx, report))
            .join('');

    return `
      <section class="tgm-editor">
        <div class="tgm-editor-topbar">
          <div class="tgm-editor-topbar-left">
            <button type="button" class="tgm-btn tgm-btn-secondary" data-action="cancel-edit">
              ${Icons.chevronLeft}
              <span>Cancel / Return</span>
            </button>
            <div class="tgm-editor-context">
              <span class="tgm-editor-badge">${this.isCreatingNew ? 'NEW GAME DRAFT' : 'EDITING GAME'}</span>
              <span class="tgm-editor-metrics">${metrics.categoryCount} Categories // ${metrics.totalOptionsCount} Total Options</span>
            </div>
          </div>
          <div class="tgm-editor-topbar-right">
            <button
              type="button"
              class="tgm-btn tgm-btn-primary ${!report.isValid ? 'is-guardrail-blocked' : ''}"
              data-action="save-bundle"
            >
              ${Icons.check}
              <span>Save Changes</span>
            </button>
          </div>
        </div>

        <div data-role="editor-validation-slot">
          ${this.renderEditorValidationSummary(report)}
        </div>

        <div class="tgm-editor-metadata-panel">
          <div class="tgm-field-group">
            <label class="tgm-field-label" for="tgm-bundle-title-input">
              <span>GAME TITLE</span>
              <span class="tgm-field-required">REQUIRED</span>
            </label>
            <input
              id="tgm-bundle-title-input"
              type="text"
              class="tgm-input tgm-input-lg ${report.titleError ? 'is-invalid' : ''}"
              data-field="bundle-title"
              placeholder="e.g., Elden Ring: Cursed Sovereign Run"
              value="${escapeHtml(this.draftBundle.title)}"
              autocomplete="off"
            />
            ${
              report.titleError
                ? `<div class="tgm-inline-error">${Icons.alertDiamond} <span>${escapeHtml(report.titleError)}</span></div>`
                : ''
            }
          </div>

          <div class="tgm-field-group">
            <label class="tgm-field-label" for="tgm-bundle-desc-input">
              <span>PROTOCOL DESCRIPTION &amp; MANDATES</span>
              <span class="tgm-field-optional">OPTIONAL</span>
            </label>
            <textarea
              id="tgm-bundle-desc-input"
              class="tgm-textarea"
              data-field="bundle-description"
              rows="2"
              placeholder="Specify overarching rules or context for this challenge..."
            >${escapeHtml(this.draftBundle.description)}</textarea>
          </div>
        </div>

        <div class="tgm-editor-categories-header">
          <div>
            <h2 class="tgm-section-title">Category &amp; Outcome Pools</h2>
            <p class="tgm-section-subtitle">
              Every option within a category has an identical 1/N selection probability. Ranks (F to S) evaluate post-roll difficulty only.
            </p>
          </div>
          <button type="button" class="tgm-btn tgm-btn-secondary" data-action="add-category">
            ${Icons.plus}
            <span>Add New Category</span>
          </button>
        </div>

        <div class="tgm-category-list">
          ${categoriesMarkup}
        </div>

        <div class="tgm-editor-bottom-bar">
          <button type="button" class="tgm-btn tgm-btn-secondary" data-action="add-category">
            ${Icons.plus}
            <span>Add Another Category</span>
          </button>
          <div class="tgm-editor-bottom-actions">
            <button type="button" class="tgm-btn tgm-btn-ghost" data-action="cancel-edit">
              <span>Cancel / Return</span>
            </button>
            <button
              type="button"
              class="tgm-btn tgm-btn-primary ${!report.isValid ? 'is-guardrail-blocked' : ''}"
              data-action="save-bundle"
            >
              ${Icons.check}
              <span>Save Changes</span>
            </button>
          </div>
        </div>
      </section>
    `;
  }

          renderEditorValidationSummary(report                        )         {
    if (report.isValid) {
      return `
        <div class="tgm-guardrail-banner is-valid">
          ${Icons.check}
          <span>All guardrails satisfied. Game is ready to save and launch.</span>
        </div>
      `;
    }

    const items = report.allErrorMessages
      .map((msg) => `<li>${escapeHtml(msg)}</li>`)
      .join('');

    return `
      <div class="tgm-guardrail-banner is-invalid ${this.showValidationErrors ? 'is-emphasized' : ''}">
        <div class="tgm-guardrail-header">
          ${Icons.alertDiamond}
          <span>Guardrail Check: ${report.allErrorMessages.length} requirement${
            report.allErrorMessages.length === 1 ? '' : 's'
          } must be resolved before saving</span>
        </div>
        <ul class="tgm-guardrail-list">
          ${items}
        </ul>
      </div>
    `;
  }

          renderCategoryEditorBlock(
    category          ,
    index        ,
    report
  )         {
    const issue = report.categoryIssues[category.id];
    const optionCount = category.options.length;
    const uniformChanceText =
      optionCount > 0 ? `1/${optionCount} (${(100 / optionCount).toFixed(1)}% each)` : '0 options';

    const optionsHtml = category.options
      .map((opt, optIndex) =>
        this.renderOptionEditorRow(
          category.id,
          opt,
          optIndex,
          issue?.emptyOptionIds.includes(opt.id) ?? false
        )
      )
      .join('');

    return `
      <div class="tgm-category-block ${issue ? 'has-category-issue' : ''}" data-category-id="${escapeHtml(category.id)}">
        <div class="tgm-category-header">
          <div class="tgm-category-index">CAT // ${String(index + 1).padStart(2, '0')}</div>
          <div class="tgm-category-name-wrap">
            <input
              type="text"
              class="tgm-input tgm-category-name-input ${!category.name.trim() ? 'is-invalid' : ''}"
              data-field="category-name"
              data-category-id="${escapeHtml(category.id)}"
              value="${escapeHtml(category.name)}"
              placeholder="Category Name (e.g., Combat Restriction)"
              aria-label="Category Name"
            />
          </div>
          <div class="tgm-category-meta">
            <span class="tgm-chip ${optionCount < 2 ? 'is-chip-error' : ''}">
              <span>${optionCount} Option${optionCount === 1 ? '' : 's'}</span>
            </span>
            <span class="tgm-chip tgm-chip-subtle" title="Strict Uniform Selection Probability">
              <span>P = ${uniformChanceText}</span>
            </span>
          </div>
          <button
            type="button"
            class="tgm-btn tgm-btn-ghost tgm-btn-danger-hover"
            data-action="delete-category"
            data-category-id="${escapeHtml(category.id)}"
            title="Delete Category"
          >
            ${Icons.trash}
            <span>Delete Category</span>
          </button>
        </div>

        ${
          issue
            ? `
          <div class="tgm-category-issue-banner">
            ${Icons.alertDiamond}
            <span>${escapeHtml(issue.messages[0])}</span>
          </div>
        `
            : ''
        }

        <div class="tgm-options-table-head">
          <span class="tgm-col-index">#</span>
          <span class="tgm-col-label">OUTCOME OPTION LABEL</span>
          <span class="tgm-col-rank">DIFFICULTY EVALUATION RANK (F - S)</span>
          <span class="tgm-col-action">ACTION</span>
        </div>

        <div class="tgm-options-list">
          ${optionsHtml}
        </div>

        <div class="tgm-category-footer">
          <div class="tgm-quick-add-row">
            <input
              type="text"
              class="tgm-input tgm-quick-add-input"
              data-action="quick-add-input"
              data-category-id="${escapeHtml(category.id)}"
              placeholder="Type a new option outcome label and press Enter, or click Add Option..."
            />
            <button
              type="button"
              class="tgm-btn tgm-btn-secondary"
              data-action="add-option"
              data-category-id="${escapeHtml(category.id)}"
            >
              ${Icons.plus}
              <span>Add Option</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

          renderOptionEditorRow(
    categoryId        ,
    option        ,
    optIndex        ,
    isLabelEmpty
  )         {
    return `
      <div class="tgm-option-row" data-option-id="${escapeHtml(option.id)}">
        <div class="tgm-option-index">${String(optIndex + 1).padStart(2, '0')}</div>
        <div class="tgm-option-label-cell">
          <input
            type="text"
            class="tgm-input ${isLabelEmpty ? 'is-invalid' : ''}"
            data-field="option-label"
            data-category-id="${escapeHtml(categoryId)}"
            data-option-id="${escapeHtml(option.id)}"
            value="${escapeHtml(option.label)}"
            placeholder="Outcome description..."
            aria-label="Option Label"
          />
        </div>
        <div class="tgm-option-rank-cell">
          ${this.renderRankSelector(categoryId, option.id, option.rank)}
        </div>
        <div class="tgm-option-action-cell">
          <button
            type="button"
            class="tgm-icon-btn tgm-btn-danger-hover"
            data-action="delete-option"
            data-category-id="${escapeHtml(categoryId)}"
            data-option-id="${escapeHtml(option.id)}"
            title="Remove Option"
            aria-label="Remove Option"
          >
            ${Icons.trash}
          </button>
        </div>
      </div>
    `;
  }

          renderRankSelector(categoryId        , optionId        , activeRank      )         {
    const buttons = VALID_RANKS.map((rank) => {
      const isSelected = rank === activeRank;
      return `
        <button
          type="button"
          class="tgm-rank-btn tgm-rank-${rank} ${isSelected ? 'is-active' : ''}"
          data-action="select-rank"
          data-category-id="${escapeHtml(categoryId)}"
          data-option-id="${escapeHtml(optionId)}"
          data-rank="${rank}"
          aria-pressed="${isSelected ? 'true' : 'false'}"
          title="Difficulty Rank ${rank}"
        >
          ${rank}
        </button>
      `;
    }).join('');

    return `
      <div
        class="tgm-rank-selector"
        role="group"
        aria-label="Difficulty Rank Selector"
        data-role="rank-selector"
        data-category-id="${escapeHtml(categoryId)}"
        data-option-id="${escapeHtml(optionId)}"
      >
        ${buttons}
      </div>
    `;
  }

          renderDeleteConfirmationModal()         {
    if (!this.pendingDeleteBundle) {
      return '';
    }
    return `
      <div class="tgm-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="tgm-delete-modal-title">
        <div class="tgm-modal">
          <div class="tgm-modal-header">
            <h3 id="tgm-delete-modal-title" class="tgm-modal-title">Confirm Game Deletion</h3>
            <button type="button" class="tgm-icon-btn" data-action="cancel-delete-bundle" aria-label="Close modal">
              ${Icons.close}
            </button>
          </div>
          <div class="tgm-modal-body">
            <p>
              Are you sure you want to permanently delete
              <strong>"${escapeHtml(this.pendingDeleteBundle.title)}"</strong>?
            </p>
            <p class="tgm-modal-subtext">
              This action removes all associated categories and option pools from localStorage and cannot be undone.
            </p>
          </div>
          <div class="tgm-modal-footer">
            <button type="button" class="tgm-btn tgm-btn-secondary" data-action="cancel-delete-bundle">
              <span>Cancel</span>
            </button>
            <button type="button" class="tgm-btn tgm-btn-danger" data-action="confirm-delete-bundle">
              ${Icons.trash}
              <span>Delete Permanently</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

          renderImportModal()         {
    if (!this.importModalOpen) {
      return '';
    }
    return `
      <div class="tgm-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="tgm-import-modal-title">
        <div class="tgm-modal tgm-modal-lg">
          <div class="tgm-modal-header">
            <h3 id="tgm-import-modal-title" class="tgm-modal-title">Import Game Library (JSON)</h3>
            <button type="button" class="tgm-icon-btn" data-action="close-import-modal" aria-label="Close modal">
              ${Icons.close}
            </button>
          </div>
          <div class="tgm-modal-body">
            <p class="tgm-modal-subtext">
              Select a JSON file exported from The Game Master or paste a raw JSON game / array below. All categories, option arrays, and difficulty ranks (F-S) are strictly validated before storage update.
            </p>

            <div class="tgm-import-file-bar">
              <input
                id="tgm-import-file-input"
                type="file"
                accept=".json,application/json"
                class="tgm-sr-only"
              />
              <button type="button" class="tgm-btn tgm-btn-secondary" data-action="trigger-file-input">
                ${Icons.upload}
                <span>Select JSON File From Disk</span>
              </button>
              <span class="tgm-import-hint">or paste JSON payload directly below:</span>
            </div>

            <textarea
              class="tgm-textarea tgm-code-textarea"
              data-field="import-json-textarea"
              rows="10"
              placeholder='[\n  {\n    "id": "custom-game-1",\n    "title": "Challenge Protocol",\n    "description": "...",\n    "createdAt": 1730000000000,\n    "updatedAt": 1730000000000,\n    "categories": [...]\n  }\n]'
            >${escapeHtml(this.importDraftText)}</textarea>

            ${
              this.importErrorMessage
                ? `
              <div class="tgm-guardrail-banner is-invalid is-emphasized">
                <div class="tgm-guardrail-header">
                  ${Icons.alertDiamond}
                  <span>Schema Validation Rejected Import</span>
                </div>
                <p class="tgm-import-error-detail">${escapeHtml(this.importErrorMessage)}</p>
              </div>
            `
                : ''
            }
          </div>
          <div class="tgm-modal-footer">
            <button type="button" class="tgm-btn tgm-btn-secondary" data-action="close-import-modal">
              <span>Cancel</span>
            </button>
            <button type="button" class="tgm-btn tgm-btn-primary" data-action="confirm-import">
              ${Icons.check}
              <span>Validate &amp; Import</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

          handleCopyRunDossier()       {
    if (!this.completedRunSummary) {
      return;
    }

    const markdown = formatRunDossierMarkdown(this.completedRunSummary);

    const markCopied = () => {
      if (this.copyResetTimeoutId !== null && typeof window !== 'undefined') {
        window.clearTimeout(this.copyResetTimeoutId);
        this.copyResetTimeoutId = null;
      }

      this.dossierCopyConfirmed = true;
      this.render();
      this.setStatusBanner('success', 'Run Dossier copied to clipboard (Markdown format).', 2500);

      if (typeof window !== 'undefined') {
        this.copyResetTimeoutId = window.setTimeout(() => {
          this.dossierCopyConfirmed = false;
          this.copyResetTimeoutId = null;
          if (this.viewMode === 'VERDICT_HANDOFF') {
            this.render();
          }
        }, 2500);
      }
    };

    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(markdown).then(markCopied).catch(() => {
        this.fallbackCopyText(markdown);
        markCopied();
      });
    } else {
      this.fallbackCopyText(markdown);
      markCopied();
    }
  }

          fallbackCopyText(text        )       {
    if (typeof document === 'undefined') {
      return;
    }
    const temp = document.createElement('textarea');
    temp.value = text;
    temp.style.position = 'fixed';
    temp.style.opacity = '0';
    document.body.appendChild(temp);
    temp.select();
    try {
      document.execCommand('copy');
    } finally {
      document.body.removeChild(temp);
    }
  }

          renderVerdictHandoffView()         {
    if (!this.completedRunSummary) {
      return '';
    }
    return renderResultsDossierMarkup(this.completedRunSummary, this.dossierCopyConfirmed);
  }
}

function bootstrap()       {
  const appRoot = document.getElementById('app');
  if (!appRoot) {
    throw new Error('Root element #app not found in document.');
  }

  const controller = new GameMasterUIController(appRoot);
  controller.init();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}

})();
