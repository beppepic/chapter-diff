import { ItemView, MarkdownView, Notice, TFile, setIcon } from "obsidian";
import { EditorState, Transaction } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { MergeView } from "@codemirror/merge";
import { CommitInfo, getFileAtRevision, getFileHistory } from "./git";
import { CommitPickerModal } from "./CommitPickerModal";

export const CHAPTER_DIFF_VIEW_TYPE = "chapter-diff-view";

const REFRESH_DELAY_MS = 400;
const SAVE_DELAY_MS = 1000;

export interface DiffTarget {
  file: TFile;
  repoRoot: string;
  relPath: string;
  commit: CommitInfo;
}

function readOnlyExtensions() {
  return [
    EditorView.lineWrapping,
    EditorView.editable.of(false),
    EditorState.readOnly.of(true),
    EditorView.theme({
      "&": { height: "100%" },
      ".cm-scroller": { overflow: "auto" },
    }),
  ];
}

function editableExtensions(onChange: (text: string) => void) {
  return [
    EditorView.lineWrapping,
    EditorView.updateListener.of((update) => {
      if (
        update.docChanged &&
        !update.transactions.some((transaction) => transaction.annotation(Transaction.remote))
      ) {
        onChange(update.state.doc.toString());
      }
    }),
    EditorView.theme({
      "&": { height: "100%" },
      ".cm-scroller": { overflow: "auto" },
    }),
  ];
}

export class DiffView extends ItemView {
  private target: DiffTarget | null = null;
  private mergeView: MergeView | null = null;
  private headerEl!: HTMLElement;
  private mergeContainerEl!: HTMLElement;
  private refreshTimer: number | null = null;
  private saveTimer: number | null = null;
  private pendingSave: { file: TFile; text: string } | null = null;
  private ignoreNextModification = false;
  private refreshing = false;

  getViewType(): string {
    return CHAPTER_DIFF_VIEW_TYPE;
  }

  getDisplayText(): string {
    return this.target ? `Diff: ${this.target.file.basename}` : "Chapter Diff";
  }

  getIcon(): string {
    return "git-compare";
  }

  async onOpen(): Promise<void> {
    const container = this.contentEl;
    container.empty();
    container.addClass("chapter-diff-view");

    this.headerEl = container.createDiv({ cls: "chapter-diff-header" });
    this.mergeContainerEl = container.createDiv({ cls: "chapter-diff-merge" });

    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (this.target && file.path === this.target.file.path) {
          if (this.ignoreNextModification) {
            this.ignoreNextModification = false;
          } else {
            this.scheduleWorkingTreeRefresh();
          }
        }
      }),
    );

    this.registerEvent(
      this.app.workspace.on("editor-change", (_editor, info) => {
        if (this.target && info.file && info.file.path === this.target.file.path) {
          this.scheduleWorkingTreeRefresh();
        }
      }),
    );
  }

  async onClose(): Promise<void> {
    await this.flushPendingSave();
    this.mergeView?.destroy();
    this.mergeView = null;
    if (this.refreshTimer !== null) {
      window.clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
  }

  async setTarget(target: DiffTarget): Promise<void> {
    await this.flushPendingSave();
    this.target = target;
    await this.render();
    this.app.workspace.requestSaveLayout();
  }

  private async changeRevision(commit: CommitInfo): Promise<void> {
    if (!this.target) return;
    await this.flushPendingSave();
    this.target = { ...this.target, commit };
    await this.render();
  }

  private scheduleWorkingTreeRefresh(): void {
    if (this.refreshTimer !== null) window.clearTimeout(this.refreshTimer);
    this.refreshTimer = window.setTimeout(() => {
      this.refreshTimer = null;
      void this.refreshWorkingTree();
    }, REFRESH_DELAY_MS);
  }

  private scheduleSave(text: string): void {
    if (!this.target) return;
    this.pendingSave = { file: this.target.file, text };
    if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      void this.flushPendingSave();
    }, SAVE_DELAY_MS);
  }

  private async flushPendingSave(): Promise<void> {
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }

    const pending = this.pendingSave;
    this.pendingSave = null;
    if (!pending) return;

    try {
      this.ignoreNextModification = true;
      await this.app.vault.adapter.write(pending.file.path, pending.text);
    } catch (error) {
      this.ignoreNextModification = false;
      new Notice(`Chapter Diff: could not save "${pending.file.basename}".`);
      console.error(error);
    }
  }

  private async openRevisionPicker(): Promise<void> {
    if (!this.target) return;
    const { repoRoot, relPath } = this.target;
    let history: CommitInfo[];
    try {
      history = await getFileHistory(repoRoot, relPath);
    } catch (error) {
      new Notice("Chapter diff: failed to read commit history.");
      console.error(error);
      return;
    }
    if (history.length === 0) {
      new Notice("Chapter diff: no commit history for this file.");
      return;
    }
    new CommitPickerModal(this.app, history, (commit) => void this.changeRevision(commit)).open();
  }

  private renderHeader(): void {
    if (!this.target) return;
    const { file, commit } = this.target;
    this.headerEl.empty();

    const info = this.headerEl.createDiv({ cls: "chapter-diff-header-info" });
    info.createSpan({ cls: "chapter-diff-file", text: file.basename });
    info.createSpan({
      cls: "chapter-diff-commit",
      text: `${commit.shortHash} · ${commit.date} · ${commit.message}`,
    });
    info.createSpan({
      cls: "chapter-diff-mode",
      text: "Selected revision (read-only)  ←  →  Working Tree (editable)",
    });

    const actions = this.headerEl.createDiv({ cls: "chapter-diff-header-actions" });

    const revisionBtn = actions.createEl("button", { cls: "chapter-diff-btn" });
    setIcon(revisionBtn, "history");
    revisionBtn.setAttribute("aria-label", "Change revision");
    revisionBtn.addEventListener("click", () => void this.openRevisionPicker());

    const refreshBtn = actions.createEl("button", { cls: "chapter-diff-btn" });
    setIcon(refreshBtn, "refresh-cw");
    refreshBtn.setAttribute("aria-label", "Refresh");
    refreshBtn.addEventListener("click", () => {
      void this.flushPendingSave().then(() => this.render());
    });
  }

  private renderMerge(oldText: string, newText: string): void {
    this.mergeView?.destroy();
    this.mergeContainerEl.empty();

    this.mergeView = new MergeView({
      a: { doc: oldText, extensions: readOnlyExtensions() },
      b: {
        doc: newText,
        extensions: editableExtensions((text) => this.scheduleSave(text)),
      },
      parent: this.mergeContainerEl,
      highlightChanges: true,
      gutter: true,
      collapseUnchanged: { margin: 4, minSize: 6 },
      diffConfig: { scanLimit: 1000 },
    });
  }

  private async refreshWorkingTree(): Promise<void> {
    if (!this.target || !this.mergeView || this.refreshing || this.pendingSave) return;

    this.refreshing = true;
    try {
      const newText = await this.readCurrentText(this.target.file);
      const editor = this.mergeView.b;
      if (newText !== editor.state.doc.toString()) {
        editor.dispatch({
          changes: { from: 0, to: editor.state.doc.length, insert: newText },
          annotations: Transaction.remote.of(true),
        });
      }
    } catch (error) {
      console.error(error);
    } finally {
      this.refreshing = false;
    }
  }

  private async readCurrentText(file: TFile): Promise<string> {
    const editorLeaf = this.app.workspace.getLeavesOfType("markdown").find((leaf) => {
      const view = leaf.view;
      return view instanceof MarkdownView && view.file?.path === file.path;
    });

    if (editorLeaf?.view instanceof MarkdownView) {
      return editorLeaf.view.editor.getValue();
    }

    return this.app.vault.cachedRead(file);
  }

  private async render(): Promise<void> {
    if (!this.target) return;
    const { file, repoRoot, commit } = this.target;

    let oldText: string;
    try {
      oldText = await getFileAtRevision(repoRoot, commit.path, commit.hash);
    } catch (error) {
      new Notice(`Chapter Diff: could not read "${file.basename}" at ${commit.shortHash}.`);
      console.error(error);
      return;
    }

    const newText = await this.readCurrentText(file);

    this.renderHeader();
    this.renderMerge(oldText, newText);
  }
}
