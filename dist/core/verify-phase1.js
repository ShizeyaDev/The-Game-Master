import {
  BundleStorageEngine,
  DEFAULT_SEED_BUNDLE,

  evaluateRunDifficulty,
  executeBundleRoll,
  rankToNumber,
  selectUniform,
} from './index.js';

function assert(condition         , message        )       {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

class TestStorage                            {
          map = new Map                ();
  getItem(key        )                {
    return this.map.has(key) ? (this.map.get(key)          ) : null;
  }
  setItem(key        , value        )       {
    this.map.set(key, value);
  }
  removeItem(key        )       {
    this.map.delete(key);
  }
}

export function runPhase1Verification()       {
  const sampleOptions           = [
    { id: '1', label: 'Opt F', rank: 'F' },
    { id: '2', label: 'Opt C', rank: 'C' },
    { id: '3', label: 'Opt S', rank: 'S' },
  ];

  const pick0 = selectUniform(sampleOptions, () => 0.0);
  const pick1 = selectUniform(sampleOptions, () => 0.34);
  const pick2 = selectUniform(sampleOptions, () => 0.99);

  assert(pick0.id === '1', 'RNG 0.0 should select index 0');
  assert(pick1.id === '2', 'RNG 0.34 should select index 1');
  assert(pick2.id === '3', 'RNG 0.99 should select index 2');

  assert(rankToNumber('F') === 1, 'F should map to 1');
  assert(rankToNumber('S') === 7, 'S should map to 7');

  const standardResults               = [
    { categoryId: 'c1', categoryName: 'Cat 1', selectedOption: { id: 'o1', label: 'L1', rank: 'F' } },
    { categoryId: 'c2', categoryName: 'Cat 2', selectedOption: { id: 'o2', label: 'L2', rank: 'E' } },
    { categoryId: 'c3', categoryName: 'Cat 3', selectedOption: { id: 'o3', label: 'L3', rank: 'D' } },
  ];
  const evalStandard = evaluateRunDifficulty(standardResults);
  assert(evalStandard.numericalScore === 2, `Expected score 2, got ${evalStandard.numericalScore}`);
  assert(evalStandard.overallRank === 'E', `Expected rank E, got ${evalStandard.overallRank}`);
  assert(evalStandard.hasHazardOutlier === false, 'Expected hasHazardOutlier to be false');

  const hazardResults               = [
    { categoryId: 'c1', categoryName: 'Cat 1', selectedOption: { id: 'o1', label: 'L1', rank: 'F' } },
    { categoryId: 'c2', categoryName: 'Cat 2', selectedOption: { id: 'o2', label: 'L2', rank: 'F' } },
    { categoryId: 'c3', categoryName: 'Cat 3', selectedOption: { id: 'o3', label: 'L3', rank: 'F' } },
    { categoryId: 'c4', categoryName: 'Cat 4', selectedOption: { id: 'o4', label: 'L4', rank: 'F' } },
    { categoryId: 'c5', categoryName: 'Cat 5', selectedOption: { id: 'o5', label: 'L5', rank: 'S' } },
  ];
  const evalHazard = evaluateRunDifficulty(hazardResults);
  assert(evalHazard.numericalScore === 2.2, `Expected score 2.2, got ${evalHazard.numericalScore}`);
  assert(evalHazard.rawRank === 'E', `Expected rawRank E, got ${evalHazard.rawRank}`);
  assert(evalHazard.hasHazardOutlier === true, 'Expected hasHazardOutlier to be true');
  assert(evalHazard.wasClampedToB === true, 'Expected wasClampedToB to be true when rawRank < B');
  assert(evalHazard.overallRank === 'B', `Hazard Outlier Rule must clamp rank to B, got ${evalHazard.overallRank}`);
  assert(
    evalHazard.hazardBannerMessage ===
      '[ ! ] HAZARD OVERRIDE: S-Tier condition elevated minimum run rating to B.',
    `Unexpected hazard banner message: ${String(evalHazard.hazardBannerMessage)}`
  );

  const highHazardResults               = [
    { categoryId: 'c1', categoryName: 'Cat 1', selectedOption: { id: 'o1', label: 'L1', rank: 'A' } },
    { categoryId: 'c2', categoryName: 'Cat 2', selectedOption: { id: 'o2', label: 'L2', rank: 'S' } },
    { categoryId: 'c3', categoryName: 'Cat 3', selectedOption: { id: 'o3', label: 'L3', rank: 'S' } },
  ];
  const evalHighHazard = evaluateRunDifficulty(highHazardResults);
  assert(evalHighHazard.overallRank === 'S', `Expected rank S, got ${evalHighHazard.overallRank}`);
  assert(evalHighHazard.hasHazardOutlier === true, 'Expected hasHazardOutlier to be true');
  assert(evalHighHazard.wasClampedToB === false, 'Expected wasClampedToB to be false when rawRank >= B');
  assert(
    evalHighHazard.hazardBannerMessage === '[ ! ] S-TIER CONDITION ACTIVE',
    `Expected S-TIER CONDITION ACTIVE message, got ${String(evalHighHazard.hazardBannerMessage)}`
  );

  const mockStore = new TestStorage();
  const engine = new BundleStorageEngine(mockStore);

  const initialBundles = engine.getAllBundles();
  assert(initialBundles.length === 1, 'Storage should auto-seed with 1 default bundle on first read');
  assert(initialBundles[0].id === DEFAULT_SEED_BUNDLE.id, 'Seeded bundle ID should match DEFAULT_SEED_BUNDLE');

  const fetched = engine.getBundleById(DEFAULT_SEED_BUNDLE.id);
  assert(fetched !== null && fetched.title === DEFAULT_SEED_BUNDLE.title, 'getBundleById should return matching bundle');

  const customBundle             = {
    id: 'custom-bundle-1',
    title: 'Armored Core VI: Rubicon Trial',
    description: 'Strict assembly and sortie restrictions.',
    createdAt: 1730000000000,
    updatedAt: 1730000000000,
    categories: [
      {
        id: 'cat-frame',
        name: 'Frame Class',
        options: [
          { id: 'opt-biped', label: 'Lightweight Biped', rank: 'C' },
          { id: 'opt-loader', label: 'Stock Loader 4 (No OS Tuning)', rank: 'S' },
        ],
      },
    ],
  };
  engine.saveBundle(customBundle);
  assert(engine.getAllBundles().length === 2, 'Should have 2 bundles after saving customBundle');

  const exportedJson = engine.exportBundlesToJSON();
  const freshEngine = new BundleStorageEngine(new TestStorage());
  const importRes = freshEngine.importBundlesFromJSON(exportedJson);
  assert(importRes.success === true && importRes.count === 2, 'Import of exported JSON should succeed with count 2');

  const badRankImport = freshEngine.importBundlesFromJSON(
    JSON.stringify([
      {
        ...customBundle,
        id: 'bad-rank-bundle',
        categories: [
          {
            id: 'c1',
            name: 'Cat',
            options: [{ id: 'o1', label: 'Invalid Rank Z', rank: 'Z' }],
          },
        ],
      },
    ])
  );
  assert(badRankImport.success === false, 'Import with invalid rank Z must fail validation');

  const emptyCategoryImport = freshEngine.importBundlesFromJSON(
    JSON.stringify([
      {
        ...customBundle,
        id: 'empty-cat-bundle',
        categories: [],
      },
    ])
  );
  assert(emptyCategoryImport.success === false, 'Import with empty categories array must fail validation');

  const summary = executeBundleRoll(DEFAULT_SEED_BUNDLE);
  assert(summary.results.length === DEFAULT_SEED_BUNDLE.categories.length, 'Roll summary should have 1 result per category');

  engine.deleteBundle('custom-bundle-1');
  assert(engine.getAllBundles().length === 1, 'Should have 1 bundle after deleting custom-bundle-1');
}

runPhase1Verification();
console.log('Phase 1 verification passed: All assertions succeeded.');
