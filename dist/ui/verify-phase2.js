import {
  DEFAULT_SEED_BUNDLE,

  createDefaultSeedBundle,
} from '../core/index.js';
import { Icons, computeBundleMetrics, evaluateBundleGuardrails } from './index.js';

function assert(condition         , message        )       {
  if (!condition) {
    throw new Error(`Phase 2 Assertion Failed: ${message}`);
  }
}

export function runPhase2Verification()       {
  const validSeed = createDefaultSeedBundle();
  const validReport = evaluateBundleGuardrails(validSeed);
  assert(validReport.isValid === true, 'Default seed bundle must pass all guardrails');
  assert(validReport.allErrorMessages.length === 0, 'Valid bundle must have 0 error messages');

  const metrics = computeBundleMetrics(DEFAULT_SEED_BUNDLE);
  assert(metrics.categoryCount === 5, `Expected 5 categories, got ${metrics.categoryCount}`);
  assert(metrics.totalOptionsCount === 25, `Expected 25 total options, got ${metrics.totalOptionsCount}`);

  const emptyTitleBundle             = {
    ...createDefaultSeedBundle(),
    title: '   ',
  };
  const titleReport = evaluateBundleGuardrails(emptyTitleBundle);
  assert(titleReport.isValid === false, 'Empty bundle title must fail guardrails');
  assert(titleReport.titleError !== null, 'titleError must be populated when title is empty');

  const zeroCategoriesBundle             = {
    ...createDefaultSeedBundle(),
    categories: [],
  };
  const zeroCatReport = evaluateBundleGuardrails(zeroCategoriesBundle);
  assert(zeroCatReport.isValid === false, 'Zero categories must fail guardrails');
  assert(zeroCatReport.bundleLevelErrors.length === 1, 'bundleLevelErrors must report missing categories');

  const singleOptionBundle = createDefaultSeedBundle();
  singleOptionBundle.categories[0].options = [
    { id: 'only-one', label: 'Sole Option', rank: 'C' },
  ];
  const singleOptReport = evaluateBundleGuardrails(singleOptionBundle);
  assert(singleOptReport.isValid === false, 'Category with < 2 options must fail guardrails');
  assert(
    Boolean(singleOptReport.categoryIssues[singleOptionBundle.categories[0].id]),
    'categoryIssues must pinpoint the category with < 2 options'
  );

  const emptyLabelBundle = createDefaultSeedBundle();
  emptyLabelBundle.categories[1].options[0].label = '';
  const emptyLabelReport = evaluateBundleGuardrails(emptyLabelBundle);
  assert(emptyLabelReport.isValid === false, 'Option with empty label must fail guardrails');
  assert(
    emptyLabelReport.categoryIssues[emptyLabelBundle.categories[1].id].emptyOptionIds.includes(
      emptyLabelBundle.categories[1].options[0].id
    ),
    'emptyOptionIds must pinpoint the specific option with an empty label'
  );

  for (const [key, svgMarkup] of Object.entries(Icons)) {
    assert(svgMarkup.startsWith('<svg') && svgMarkup.endsWith('</svg>'), `Icon "${key}" must be valid SVG`);
  }
}

runPhase2Verification();
console.log('Phase 2 verification passed: All guardrail, metric, and UI checks succeeded.');
