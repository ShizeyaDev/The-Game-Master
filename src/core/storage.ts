import {
  type Category,
  type GameBundle,
  type ImportResult,
  type Option,
  type Rank,
  type RollConstraints,
  VALID_RANKS,
} from './types.ts';
import { createDefaultSeedBundle } from './seed.ts';

export const STORAGE_NAMESPACE = 'TGM_BUNDLES_V1' as const;

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

class MemoryStorage implements KeyValueStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }
}

const fallbackMemoryStorage = new MemoryStorage();

function resolveStorage(customStorage?: KeyValueStorage): KeyValueStorage {
  if (customStorage) {
    return customStorage;
  }
  if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis && globalThis.localStorage) {
    return globalThis.localStorage;
  }
  return fallbackMemoryStorage;
}

export function isValidRank(value: unknown): value is Rank {
  return typeof value === 'string' && (VALID_RANKS as readonly string[]).includes(value);
}

export function validateOption(raw: unknown, contextPath: string): { valid: true; value: Option } | { valid: false; error: string } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { valid: false, error: `${contextPath} must be a non-null object.` };
  }

  const candidate = raw as Record<string, unknown>;

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
  raw: unknown,
  categories: readonly Category[],
  contextPath: string
): { valid: true; value: RollConstraints } | { valid: false; error: string } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { valid: false, error: `${contextPath} must be a non-null object.` };
  }

  const candidate = raw as Record<string, unknown>;
  const categoryMap = new Map(categories.map((category) => [category.id, category]));
  const optionIds = new Set(categories.flatMap((category) => category.options.map((option) => option.id)));
  const value: RollConstraints = {};

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
      const limit = rawLimit as Record<string, unknown>;
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
        ranks: Array.from(new Set(limit.ranks as Rank[])),
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
      const rule = rawRule as Record<string, unknown>;
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
        optionIds: Array.from(new Set(rule.optionIds as string[])),
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
      const rule = rawRule as Record<string, unknown>;
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
      const uniqueCategoryIds = Array.from(new Set(rule.categoryIds as string[]));
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

export function validateCategory(raw: unknown, contextPath: string): { valid: true; value: Category } | { valid: false; error: string } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { valid: false, error: `${contextPath} must be a non-null object.` };
  }

  const candidate = raw as Record<string, unknown>;

  if (typeof candidate.id !== 'string' || candidate.id.trim().length === 0) {
    return { valid: false, error: `${contextPath}.id must be a non-empty string.` };
  }

  if (typeof candidate.name !== 'string' || candidate.name.trim().length === 0) {
    return { valid: false, error: `${contextPath}.name must be a non-empty string.` };
  }

  if (!Array.isArray(candidate.options) || candidate.options.length === 0) {
    return { valid: false, error: `${contextPath}.options must be a non-empty array.` };
  }

  const validatedOptions: Option[] = [];
  const seenOptionIds = new Set<string>();

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

export function validateGameBundle(raw: unknown, contextPath = 'Game'): { valid: true; value: GameBundle } | { valid: false; error: string } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { valid: false, error: `${contextPath} must be a non-null object.` };
  }

  const candidate = raw as Record<string, unknown>;

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

  const validatedCategories: Category[] = [];
  const seenCategoryIds = new Set<string>();
  const seenBundleOptionIds = new Set<string>();

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

  let constraints: RollConstraints | undefined;
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

export class BundleStorageEngine {
  private readonly storage: KeyValueStorage;
  private readonly namespace: string;

  constructor(storage?: KeyValueStorage, namespace: string = STORAGE_NAMESPACE) {
    this.storage = resolveStorage(storage);
    this.namespace = namespace;
  }

  public getAllBundles(): GameBundle[] {
    const raw = this.storage.getItem(this.namespace);

    if (raw === null) {
      const initialSeed = [createDefaultSeedBundle()];
      this.writeBundlesInternal(initialSeed);
      return initialSeed;
    }

    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        const fallback = [createDefaultSeedBundle()];
        this.writeBundlesInternal(fallback);
        return fallback;
      }

      const validBundles: GameBundle[] = [];
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

  public getBundleById(id: string): GameBundle | null {
    const bundles = this.getAllBundles();
    const match = bundles.find((b) => b.id === id);
    return match ? (JSON.parse(JSON.stringify(match)) as GameBundle) : null;
  }

  public saveBundle(bundle: GameBundle): void {
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

  public deleteBundle(id: string): void {
    const bundles = this.getAllBundles();
    const filtered = bundles.filter((b) => b.id !== id);
    this.writeBundlesInternal(filtered);
  }

  public exportBundlesToJSON(): string {
    const bundles = this.getAllBundles();
    return JSON.stringify(bundles, null, 2);
  }

  public importBundlesFromJSON(rawJson: string): ImportResult {
    if (typeof rawJson !== 'string' || rawJson.trim().length === 0) {
      return {
        success: false,
        error: 'Import payload is empty.',
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawJson);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Malformed JSON syntax';
      return {
        success: false,
        error: `JSON Parse Error: ${message}`,
      };
    }

    const rawList: unknown[] = Array.isArray(parsed) ? parsed : [parsed];

    if (rawList.length === 0) {
      return {
        success: false,
        error: 'Import array must contain at least one Game.',
      };
    }

    const validatedIncoming: GameBundle[] = [];
    const incomingIds = new Set<string>();

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
    const bundleMap = new Map<string, GameBundle>();

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

  private writeBundlesInternal(bundles: GameBundle[]): void {
    this.storage.setItem(this.namespace, JSON.stringify(bundles));
  }
}

const defaultStorageEngine = new BundleStorageEngine();

export function getAllBundles(): GameBundle[] {
  return defaultStorageEngine.getAllBundles();
}

export function getBundleById(id: string): GameBundle | null {
  return defaultStorageEngine.getBundleById(id);
}

export function saveBundle(bundle: GameBundle): void {
  defaultStorageEngine.saveBundle(bundle);
}

export function deleteBundle(id: string): void {
  defaultStorageEngine.deleteBundle(id);
}

export function exportBundlesToJSON(): string {
  return defaultStorageEngine.exportBundlesToJSON();
}

export function importBundlesFromJSON(rawJson: string): ImportResult {
  return defaultStorageEngine.importBundlesFromJSON(rawJson);
}
