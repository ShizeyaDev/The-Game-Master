import { type Category, type GameBundle, type ImportResult, type Option, type Rank, VALID_RANKS } from './types.ts';
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

  return {
    valid: true,
    value: {
      id: candidate.id.trim(),
      label: candidate.label.trim(),
      rank: candidate.rank,
    },
  };
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
    validatedCategories.push(catCheck.value);
  }

  return {
    valid: true,
    value: {
      id: candidate.id.trim(),
      title: candidate.title.trim(),
      description: candidate.description.trim(),
      categories: validatedCategories,
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
