import {
  type Category,
  type GameBundle,
  type Option,
  type Rank,
  type RunSummary,
  VALID_RANKS,
  deleteBundle,
  exportBundlesToJSON,
  getAllBundles,
  getBundleById,
  importBundlesFromJSON,
  saveBundle,
} from '../core/index.ts';
import { Icons } from './icons.ts';
import { formatRunDossierMarkdown, renderResultsDossierMarkup } from './dossier.ts';
import { SequentialRollController } from './roll-engine.ts';
import {
  type BundleValidationReport,
  computeBundleMetrics,
  evaluateBundleGuardrails,
} from './validation.ts';

export type ViewMode = 'LIBRARY' | 'EDITOR' | 'ROLL_SEQUENCE' | 'VERDICT_HANDOFF';

export interface StatusBanner {
  type: 'info' | 'success' | 'error';
  message: string;
}

export type BeginSequenceCallback = (bundle: GameBundle) => void;
export type SequenceCompleteCallback = (summary: RunSummary) => void;

function generateId(prefix: string): string {
  const randomPart = Math.random().toString(36).substring(2, 9);
  const timePart = Date.now().toString(36).slice(-4);
  return `${prefix}-${timePart}-${randomPart}`;
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export class GameMasterUIController {
  private readonly root: HTMLElement;
  private viewMode: ViewMode = 'LIBRARY';
  private bundles: GameBundle[] = [];

  private draftBundle: GameBundle | null = null;
  private isCreatingNew = false;
  private showValidationErrors = false;

  private pendingDeleteBundle: GameBundle | null = null;
  private importModalOpen = false;
  private importDraftText = '';
  private importErrorMessage: string | null = null;
  private statusBanner: StatusBanner | null = null;
  private statusTimeoutId: number | null = null;

  private onBeginSequenceCallback?: BeginSequenceCallback;
  private onSequenceCompleteCallback?: SequenceCompleteCallback;
  private readonly rollController: SequentialRollController;
  private completedRunSummary: RunSummary | null = null;
  private dossierCopyConfirmed = false;
  private copyResetTimeoutId: number | null = null;

  constructor(
    rootElement: HTMLElement,
    onBeginSequence?: BeginSequenceCallback,
    onSequenceComplete?: SequenceCompleteCallback
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
      onCompleteRun: (summary: RunSummary) => {
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

  public init(): void {
    this.refreshBundles();
    this.bindRootDelegation();
    this.render();
  }

  public setBeginSequenceHandler(handler: BeginSequenceCallback): void {
    this.onBeginSequenceCallback = handler;
  }

  public setSequenceCompleteHandler(handler: SequenceCompleteCallback): void {
    this.onSequenceCompleteCallback = handler;
  }

  public getRollController(): SequentialRollController {
    return this.rollController;
  }

  public refreshBundles(): void {
    this.bundles = getAllBundles();
  }

  private setStatusBanner(type: StatusBanner['type'], message: string, autoClearMs = 5000): void {
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

  private renderStatusBannerOnly(): void {
    const slot = this.root.querySelector<HTMLElement>('[data-role="status-banner-slot"]');
    if (slot) {
      slot.innerHTML = this.renderStatusBannerMarkup();
    }
  }

  private handleCreateNewBundle(): void {
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

  private handleEditBundle(bundleId: string): void {
    const existing = getBundleById(bundleId);
    if (!existing) {
      this.setStatusBanner('error', 'Target game could not be found in storage.');
      return;
    }

    this.isCreatingNew = false;
    this.showValidationErrors = false;
    this.draftBundle = JSON.parse(JSON.stringify(existing)) as GameBundle;
    this.viewMode = 'EDITOR';
    this.render();
  }

  private handleDuplicateBundle(bundleId: string): void {
    const existing = getBundleById(bundleId);
    if (!existing) {
      this.setStatusBanner('error', 'Cannot duplicate: source game not found.');
      return;
    }

    const now = Date.now();
    const clonedCategories: Category[] = existing.categories.map((cat) => ({
      id: generateId('cat'),
      name: cat.name,
      options: cat.options.map((opt) => ({
        id: generateId('opt'),
        label: opt.label,
        rank: opt.rank,
      })),
    }));

    const duplicated: GameBundle = {
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

  private handleRequestDeleteBundle(bundleId: string): void {
    const target = this.bundles.find((b) => b.id === bundleId) || null;
    if (!target) {
      return;
    }
    this.pendingDeleteBundle = target;
    this.render();
  }

  private handleConfirmDeleteBundle(): void {
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

  private handleBeginSequence(bundleId: string): void {
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
    this.rollController.startSequence(target);
  }

  private handleExportLibrary(): void {
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

  private handleOpenImportModal(): void {
    this.importModalOpen = true;
    this.importDraftText = '';
    this.importErrorMessage = null;
    this.render();
  }

  private handleCloseImportModal(): void {
    this.importModalOpen = false;
    this.importDraftText = '';
    this.importErrorMessage = null;
    this.render();
  }

  private handleExecuteImport(): void {
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

  private handleCancelEdit(): void {
    this.draftBundle = null;
    this.isCreatingNew = false;
    this.showValidationErrors = false;
    this.viewMode = 'LIBRARY';
    this.render();
  }

  private handleSaveDraftBundle(): void {
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

  private handleAddCategory(): void {
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

  private handleDeleteCategory(categoryId: string): void {
    if (!this.draftBundle) {
      return;
    }
    this.draftBundle.categories = this.draftBundle.categories.filter((c) => c.id !== categoryId);
    this.render();
  }

  private handleAddOption(categoryId: string): void {
    if (!this.draftBundle) {
      return;
    }
    const cat = this.draftBundle.categories.find((c) => c.id === categoryId);
    if (!cat) {
      return;
    }

    const quickInput = this.root.querySelector<HTMLInputElement>(
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

    const updatedQuickInput = this.root.querySelector<HTMLInputElement>(
      `input[data-action="quick-add-input"][data-category-id="${categoryId}"]`
    );
    if (updatedQuickInput) {
      updatedQuickInput.focus();
    }
  }

  private handleDeleteOption(categoryId: string, optionId: string): void {
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

  private handleSetOptionRank(categoryId: string, optionId: string, rank: Rank): void {
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

    const selectorGroup = this.root.querySelector<HTMLElement>(
      `[data-role="rank-selector"][data-category-id="${categoryId}"][data-option-id="${optionId}"]`
    );
    if (selectorGroup) {
      const buttons = selectorGroup.querySelectorAll<HTMLButtonElement>('button[data-rank]');
      buttons.forEach((btn) => {
        const isSelected = btn.getAttribute('data-rank') === rank;
        btn.classList.toggle('is-active', isSelected);
        btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
      });
    } else {
      this.render();
    }
  }

  private bindRootDelegation(): void {
    this.root.addEventListener('click', (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }

      const actionEl = target.closest<HTMLElement>('[data-action]');
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
          const fileInput = this.root.querySelector<HTMLInputElement>('#tgm-import-file-input');
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
          const rankAttr = actionEl.getAttribute('data-rank') as Rank | null;
          if (rankAttr && (VALID_RANKS as readonly string[]).includes(rankAttr)) {
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

    this.root.addEventListener('input', (event: Event) => {
      const target = event.target as HTMLInputElement | HTMLTextAreaElement | null;
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

    this.root.addEventListener('keydown', (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
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
      window.addEventListener('keydown', (event: KeyboardEvent) => {
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

    this.root.addEventListener('change', (event: Event) => {
      const target = event.target as HTMLInputElement | null;
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

  private refreshEditorValidationOutlines(): void {
    if (!this.draftBundle) {
      return;
    }
    const report = evaluateBundleGuardrails(this.draftBundle);

    const saveBtn = this.root.querySelector<HTMLButtonElement>('[data-action="save-bundle"]');
    if (saveBtn) {
      saveBtn.classList.toggle('is-guardrail-blocked', !report.isValid);
    }

    const bannerSlot = this.root.querySelector<HTMLElement>('[data-role="editor-validation-slot"]');
    if (bannerSlot) {
      bannerSlot.innerHTML = this.renderEditorValidationSummary(report);
    }
  }

  public render(): void {
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

  private renderGlobalFooter(): string {
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

  private renderGlobalHeader(): string {
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

  private renderStatusBannerMarkup(): string {
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

  private renderLibraryView(): string {
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

  private renderBundleCard(bundle: GameBundle): string {
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

  private renderEditorView(): string {
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

  private renderEditorValidationSummary(report: BundleValidationReport): string {
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

  private renderCategoryEditorBlock(
    category: Category,
    index: number,
    report: BundleValidationReport
  ): string {
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

  private renderOptionEditorRow(
    categoryId: string,
    option: Option,
    optIndex: number,
    isLabelEmpty: boolean
  ): string {
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

  private renderRankSelector(categoryId: string, optionId: string, activeRank: Rank): string {
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

  private renderDeleteConfirmationModal(): string {
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

  private renderImportModal(): string {
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

  private handleCopyRunDossier(): void {
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

  private fallbackCopyText(text: string): void {
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

  private renderVerdictHandoffView(): string {
    if (!this.completedRunSummary) {
      return '';
    }
    return renderResultsDossierMarkup(this.completedRunSummary, this.dossierCopyConfirmed);
  }
}
