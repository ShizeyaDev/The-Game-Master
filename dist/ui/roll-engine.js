import {

  createConstrainedRollResults,
  createUnconstrainedRollResults,
  createRunSummary,
  cryptoRandomOrMathRandom,
  evaluateRunDifficulty,
  getConstraintViolations,
  rankToNumber,
} from '../core/index.js';
import { Icons } from './icons.js';

export const TUMBLER_CARD_HEIGHT_PX = 76;
export const TUMBLER_VIEWPORT_HEIGHT_PX = 228;
export const TUMBLER_CENTER_OFFSET_PX = 76;
export const TUMBLER_HIGH_SPEED_MS = 2500;
export const TUMBLER_DECEL_MS = 2300;
export const TUMBLER_TOTAL_DURATION_MS = 5000;
export const DEFAULT_MINIMUM_SEVERITY_ATTEMPTS = 10000;

function calculateSeverityUpperBound(bundle            , bypassConstraints         )         {
  const rankLimits = bypassConstraints ? [] : bundle.constraints?.rankLimits ?? [];
  if (rankLimits.length === 0) {
    return (
      bundle.categories.reduce(
        (total, category) =>
          total + Math.max(...category.options.map((option) => rankToNumber(option.rank))),
        0
      ) / bundle.categories.length
    );
  }

  // Dynamic programming produces an upper bound that respects every global rank cap.
  // Forbidden combinations and numeric constraints can only lower this value further.
  let states = new Map                ([
    [rankLimits.map(() => 0).join(','), 0],
  ]);

  for (const category of bundle.categories) {
    const nextStates = new Map                ();
    const distinctRanks = [...new Set(category.options.map((option) => option.rank))];
    for (const [stateKey, total] of states) {
      const counts = stateKey.split(',').map(Number);
      for (const rank of distinctRanks) {
        const nextCounts = counts.map(
          (count, index) => count + (rankLimits[index].ranks.includes(rank) ? 1 : 0)
        );
        if (nextCounts.some((count, index) => count > rankLimits[index].max)) {
          continue;
        }
        const nextKey = nextCounts.join(',');
        const nextTotal = total + rankToNumber(rank);
        if (nextTotal > (nextStates.get(nextKey) ?? Number.NEGATIVE_INFINITY)) {
          nextStates.set(nextKey, nextTotal);
        }
      }
    }
    states = nextStates;
  }

  if (states.size === 0) {
    return 0;
  }
  const maximumTotal = Math.max(...states.values());
  return maximumTotal / bundle.categories.length;
}

export const RANK_SEVERITY_DESCRIPTIONS                                 = {
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

export function buildTumblerReelTrack(
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

export function buildDeceleratingSchedule(
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

export class SequentialRollController {
          stage                  = 'IDLE';
          bundle                    = null;
          currentCategoryIndex = 0;
          landedOption                = null;
          results               = [];
          plannedResults               = [];
          constraintsBypassed = false;
          minimumSeverityRequested                = null;
          severityGenerationAttempts = 1;
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

         startSequence(
    bundle            ,
    immediateResolveForTests = false,
    bypassConstraints = false,
    fastMode = false,
    minimumSeverity                = null
  )       {
    const nextBundle = JSON.parse(JSON.stringify(bundle))              ;
    const effectiveBypassConstraints = bypassConstraints || minimumSeverity !== null;
    const { results: nextPlan, attempts } = this.createPlan(
      nextBundle,
      effectiveBypassConstraints,
      minimumSeverity
    );

    this.clearTimers();
    this.bundle = nextBundle;
    this.currentCategoryIndex = 0;
    this.results = [];
    this.plannedResults = nextPlan;
    this.constraintsBypassed = effectiveBypassConstraints;
    this.minimumSeverityRequested = minimumSeverity;
    this.severityGenerationAttempts = attempts;
    this.landedOption = null;
    this.activeReelTrack = null;

    if (fastMode) {
      this.results = [...nextPlan];
      this.currentCategoryIndex = Math.max(0, nextBundle.categories.length - 1);
      this.landedOption = nextPlan[nextPlan.length - 1]?.selectedOption ?? null;
      this.completeRun();
      return;
    }

    this.prepareCategoryReadyState();

    if (immediateResolveForTests) {
      this.initiateCategoryRoll(true);
    }
  }

          createPlan(
    bundle            ,
    bypassConstraints         ,
    minimumSeverity
  )                                              {
    const createCandidate = () =>
      bypassConstraints
        ? createUnconstrainedRollResults(bundle, this.rng)
        : createConstrainedRollResults(bundle, this.rng);

    if (minimumSeverity === null) {
      return { results: createCandidate(), attempts: 1 };
    }
    if (!Number.isFinite(minimumSeverity) || minimumSeverity < 1 || minimumSeverity > 7) {
      throw new Error('Minimum severity must be a number from 1.00 to 7.00.');
    }

    const theoreticalMaximum = calculateSeverityUpperBound(bundle, bypassConstraints);
    if (theoreticalMaximum < minimumSeverity) {
      throw new Error(
        `Minimum severity ${minimumSeverity.toFixed(2)} is impossible for this option pool. ` +
          `The theoretical maximum is ${theoreticalMaximum.toFixed(2)}.`
      );
    }

    for (let attempt = 1; attempt <= DEFAULT_MINIMUM_SEVERITY_ATTEMPTS; attempt++) {
      const candidate = createCandidate();
      if (evaluateRunDifficulty(candidate).numericalScore >= minimumSeverity) {
        return { results: candidate, attempts: attempt };
      }
    }

    throw new Error(
      `Unable to reach minimum severity ${minimumSeverity.toFixed(2)} after ` +
        `${DEFAULT_MINIMUM_SEVERITY_ATTEMPTS.toLocaleString('en-US')} valid rolls. ` +
        'Lower the target or adjust the option ranks and playability guardrails.'
    );
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
      this.completeRun();
      return;
    }

    this.currentCategoryIndex += 1;
    this.landedOption = null;
    this.prepareCategoryReadyState();

    if (immediateResolveForTests) {
      this.initiateCategoryRoll(true);
    }
  }

          completeRun()       {
    if (!this.bundle) {
      return;
    }

    this.clearTimers();
    this.stage = 'COMPLETE';
    const constraintWarnings = this.constraintsBypassed
      ? getConstraintViolations(this.bundle, this.results)
      : [];
    const summary = createRunSummary(this.bundle, this.results, Date.now(), {
      constraintsBypassed: this.constraintsBypassed,
      constraintWarnings,
      minimumSeverityRequested: this.minimumSeverityRequested,
      severityGenerationAttempts: this.severityGenerationAttempts,
    });
    this.onCompleteRun(summary);
  }

         abortSequence()       {
    this.clearTimers();
    this.stage = 'IDLE';
    this.bundle = null;
    this.currentCategoryIndex = 0;
    this.landedOption = null;
    this.results = [];
    this.plannedResults = [];
    this.constraintsBypassed = false;
    this.minimumSeverityRequested = null;
    this.severityGenerationAttempts = 1;
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
