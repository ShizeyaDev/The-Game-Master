import {
  DEFAULT_SEED_BUNDLE,

  createDefaultSeedBundle,
  createRunSummary,
} from '../core/index.js';
import {
  RANK_SEVERITY_DESCRIPTIONS,
  SequentialRollController,
  TUMBLER_CARD_HEIGHT_PX,
  TUMBLER_CENTER_OFFSET_PX,
  TUMBLER_TOTAL_DURATION_MS,
  buildDeceleratingSchedule,
  buildTumblerReelTrack,
  formatRunDossierMarkdown,
  renderResultsDossierMarkup,
} from './index.js';

function assert(condition         , message        )       {
  if (!condition) {
    throw new Error(`Phase 3/4 Assertion Failed: ${message}`);
  }
}

export function runPhase3And4Verification()       {
  const samplePool = DEFAULT_SEED_BUNDLE.categories[0].options;
  const targetOption = samplePool[2];
  const track = buildTumblerReelTrack(samplePool, targetOption);

  assert(
    track.items[track.winningIndex].id === targetOption.id,
    'Winning index in tumbler strip must match the uniformly selected option'
  );
  assert(
    track.finalTranslateY === TUMBLER_CENTER_OFFSET_PX - track.winningIndex * TUMBLER_CARD_HEIGHT_PX,
    'finalTranslateY must align the winning card directly at TUMBLER_CENTER_OFFSET_PX (76px reticle center)'
  );
  assert(
    track.highSpeedTranslateY > track.finalTranslateY &&
      track.initialTranslateY > track.highSpeedTranslateY,
    'Vertical reel strip must scroll downward monotonically from initial -> highSpeed -> final'
  );

  const schedule = buildDeceleratingSchedule(25, TUMBLER_TOTAL_DURATION_MS);
  assert(schedule[schedule.length - 1] === 5000, 'Total tumbler duration must be 5000ms (5.0s)');

  assert(
    RANK_SEVERITY_DESCRIPTIONS.B === 'TIER B // SEVERE MANDATE',
    `Expected strictly "TIER B // SEVERE MANDATE", got "${RANK_SEVERITY_DESCRIPTIONS.B}"`
  );
  assert(
    RANK_SEVERITY_DESCRIPTIONS.C === 'TIER C // STRICT DOCTRINE',
    `Expected strictly "TIER C // STRICT DOCTRINE", got "${RANK_SEVERITY_DESCRIPTIONS.C}"`
  );

  let completedSummary                    = null;
  let abortedCount = 0;

  const controller = new SequentialRollController({
    onStateChange: () => {},
    onAbortRun: () => {
      abortedCount++;
    },
    onCompleteRun: (summary) => {
      completedSummary = summary;
    },
    rng: () => 0.99,
  });

  const testBundle = createDefaultSeedBundle();

  controller.startSequence(testBundle, false);
  const snap = controller.getSnapshot();
  assert(snap.stage === 'READY', `Expected stage READY on mandate arrival, got ${snap.stage}`);

  const readyHtml = controller.renderStageMarkup();
  assert(
    readyHtml.includes('<span>PULL LEVER</span>') && !readyHtml.includes('INITIATE DRAW'),
    'Lever button must strictly display "PULL LEVER"'
  );
  assert(
    readyHtml.includes('<span>Forfeit</span>') && !readyHtml.includes('Abort Run / Forfeit'),
    'Abort button must strictly display "Forfeit"'
  );
  assert(
    !readyHtml.includes('SYS.TUMBLER') &&
      !readyHtml.includes('NO REROLLS PERMITTED') &&
      !readyHtml.includes('Candidates in Pool)'),
    'Purged strings must not appear in stage markup'
  );
  assert(
    readyHtml.includes('tgm-tumbler-viewport') && readyHtml.includes('TARGET &gt; ]'),
    'Stage markup must render enclosed tumbler viewport and central [ < TARGET > ] reticle'
  );
  assert(
    readyHtml.includes('MANDATE DECLARATIONS (7)') && !readyHtml.includes('UNIFORM ODDS'),
    'Lower-left candidate panel must display MANDATE DECLARATIONS (N) without redundant UNIFORM ODDS tag'
  );
  assert(
    readyHtml.includes('<span>SEALED MANDATES</span>') &&
      !readyHtml.includes('SEALED MANDATES LEDGER'),
    'Right-hand sequence panel must strictly display "SEALED MANDATES" without "LEDGER"'
  );

  controller.initiateCategoryRoll(true);
  controller.advanceToNextStep(true);
  controller.advanceToNextStep(true);
  controller.advanceToNextStep(true);
  controller.advanceToNextStep(true);

  const finalLandedHtml = controller.renderStageMarkup();
  assert(
    finalLandedHtml.includes('PROCEED TO FINAL VERDICT'),
    'Final category button must display "PROCEED TO FINAL VERDICT"'
  );

  controller.advanceToNextStep(true);
  assert(controller.getSnapshot().stage === 'COMPLETE', 'Stage must be COMPLETE');
  assert(completedSummary !== null, 'completedSummary must be populated');

  const highRankDossierHtml = renderResultsDossierMarkup(completedSummary );
  assert(
    highRankDossierHtml.includes('ARBITER FINAL VERDICT'),
    'Dossier must display "ARBITER FINAL VERDICT" header'
  );
  assert(
    highRankDossierHtml.includes('/ 7.00 SEVERITY') &&
      !highRankDossierHtml.includes('MAXIMUM SEVERITY'),
    'Dossier must display "/ 7.00 SEVERITY" without "MAXIMUM SEVERITY"'
  );
  assert(
    highRankDossierHtml.includes('[ ! ] S-TIER CONDITION ACTIVE') &&
      !highRankDossierHtml.includes('clamped') &&
      !highRankDossierHtml.includes('elevated minimum'),
    'When rawRank is already B/A/S, banner must only show "[ ! ] S-TIER CONDITION ACTIVE" without mentioning clamping'
  );
  assert(
    !highRankDossierHtml.includes('EPHEMERAL RUN DOSSIER //') &&
      !highRankDossierHtml.includes('All parameters below are non-negotiable'),
    'Purged dossier strings must not appear in rendered dossier markup'
  );

  const clampedSummary = createRunSummary(testBundle, [
    { categoryId: 'c1', categoryName: 'Cat 1', selectedOption: { id: 'o1', label: 'Easy 1', rank: 'F' } },
    { categoryId: 'c2', categoryName: 'Cat 2', selectedOption: { id: 'o2', label: 'Easy 2', rank: 'F' } },
    { categoryId: 'c3', categoryName: 'Cat 3', selectedOption: { id: 'o3', label: 'Easy 3', rank: 'F' } },
    { categoryId: 'c4', categoryName: 'Cat 4', selectedOption: { id: 'o4', label: 'Apex Hazard', rank: 'S' } },
  ]);
  assert(clampedSummary.rawRank === 'D', `Expected rawRank D (mean 2.5 -> 3), got ${clampedSummary.rawRank}`);
  assert(clampedSummary.overallRank === 'B', 'Single S-rank with three F-ranks must elevate overallRank to B');
  assert(clampedSummary.wasClampedToB === true, 'wasClampedToB must be true');

  const clampedDossierHtml = renderResultsDossierMarkup(clampedSummary);
  assert(
    clampedDossierHtml.includes(
      '[ ! ] HAZARD OVERRIDE: S-Tier condition elevated minimum run rating to B.'
    ),
    'Clamped dossier must display "[ ! ] HAZARD OVERRIDE: S-Tier condition elevated minimum run rating to B."'
  );

  const noHazardSummary = createRunSummary(testBundle, [
    { categoryId: 'c1', categoryName: 'Cat 1', selectedOption: { id: 'o1', label: 'Mod 1', rank: 'C' } },
    { categoryId: 'c2', categoryName: 'Cat 2', selectedOption: { id: 'o2', label: 'Mod 2', rank: 'B' } },
  ]);
  const noHazardHtml = renderResultsDossierMarkup(noHazardSummary);
  assert(
    !noHazardHtml.includes('data-role="hazard-outlier-banner"'),
    'No warning banner should render when no S-rank option was rolled'
  );

  const markdown = formatRunDossierMarkdown(clampedSummary);
  assert(
    markdown.includes('# THE GAME MASTER // ARBITER FINAL VERDICT'),
    'Markdown export must include main header'
  );
  assert(
    markdown.includes('[ ! ] HAZARD OVERRIDE: S-Tier condition elevated minimum run rating to B.'),
    'Markdown export for clamped run must include HAZARD OVERRIDE callout'
  );

  controller.startSequence(testBundle, false);
  controller.abortSequence();
  assert(abortedCount === 1, 'Abort callback must fire');
}

runPhase3And4Verification();
console.log('Phase 3 Overhaul & Phase 4 Dossier verification passed: All assertions succeeded.');
