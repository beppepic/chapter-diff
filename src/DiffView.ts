import { ItemView, Notice, TFile, setIcon } from "obsidian";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { MergeView } from "@codemirror/merge";
import { CommitInfo, getFileAtRevision, getFileHistory } from "./git";
import { CommitPickerModal } from "./CommitPickerModal";

export const CHAPTER_DIFF_VIEW_TYPE = "chapter-diff-view";

const REFRESH_DELAY_MS = 400;

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

export class DiffView extends ItemView {
  private target: DiffTarget | null = null;
  private mergeView: MergeView | null = null;
  private headerEl!: HTMLElement;
  private mergeContainerEl!: HTMLElement;
  private refreshTimer: number | null = null;

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
          this.scheduleRefresh();
        }
      }),
    );

    this.registerEvent(
      this.app.workspace.on("editor-change", (_editor, info) => {
        if (this.target && info.file && info.file.path === this.target.file.path) {
          this.scheduleRefresh();
        }
      }),
    );
  }

  async onClose(): Promise<void> {
    this.mergeView?.destroy();
    this.mergeView = null;
    if (this.refreshTimer !== null) {
      window.clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  async setTarget(target: DiffTarget): Promise<void> {
    this.target = target;
    await this.render();
    this.app.workspace.requestSaveLayout();
  }

  private async changeRevision(commit: CommitInfo): Promise<void> {
    if (!this.target) return;
    this.target = { ...this.target, commit };
    await this.render();
  }

  private scheduleRefresh(): void {
    if (this.refreshTimer !== null) window.clearTimeout(this.refreshTimer);
    this.refreshTimer = window.setTimeout(() => {
      this.refreshTimer = null;
      void this.render();
    }, REFRESH_DELAY_MS);
  }

  private async openRevisionPicker(): Promise<void> {
    if (!this.target) return;
    const { repoRoot, relPath } = this.target;
    let history: CommitInfo[];
    try {
      history = await getFileHistory(repoRoot, relPath);
    } catch (error) {
      new Notice("Chapter Diff: failed to read commit history.");
      console.error(error);
      return;
    }
    if (history.length === 0) {
      new Notice("Chapter Diff: no commit history for this file.");
      return;
    }
    new CommitPickerModal(this.app, history, (commit) => void this.changeRevision(commit)).open();
  }

  private renderHeader(): void {
    if (!this.target) return;
    const { file, commit } = this.target;
    this.headerEl.empty();

    const info = this.headerEl.createDiv({ cls: "chapter-diff-header-info" });
    info.createEl("span", { cls: "chapter-diff-file", text: file.basename });
    info.createEl("span", {
      cls: "chapter-diff-commit",
      text: `${commit.shortHash} · ${commit.date} · ${commit.message}`,
    });

    const actions = this.headerEl.createDiv({ cls: "chapter-diff-header-actions" });

    const revisionBtn = actions.createEl("button", { cls: "chapter-diff-btn" });
    setIcon(revisionBtn, "history");
    revisionBtn.setAttribute("aria-label", "Change revision");
    revisionBtn.addEventListener("click", () => void this.openRevisionPicker());

    const refreshBtn = actions.createEl("button", { cls: "chapter-diff-btn" });
    setIcon(refreshBtn, "refresh-cw");
    refreshBtn.setAttribute("aria-label", "Refresh");
    refreshBtn.addEventListener("click", () => void this.render());
  }

  private renderMerge(oldText: string, newText: string): void {
    this.mergeView?.destroy();
    this.mergeContainerEl.empty();

    this.mergeView = new MergeView({
      a: { doc: oldText, extensions: readOnlyExtensions() },
      b: { doc: newText, extensions: readOnlyExtensions() },
      parent: this.mergeContainerEl,
      highlightChanges: true,
      gutter: true,
      collapseUnchanged: { margin: 3, minSize: 6 },
    });
  }

  private async render(): Promise<void> {
    if (!this.target) return;
    const { file, repoRoot, relPath, commit } = this.target;

    let oldText: string;
    try {
      oldText = await getFileAtRevision(repoRoot, relPath, commit.hash);
    } catch (error) {
      new Notice(`Chapter Diff: could not read "${file.basename}" at ${commit.shortHash}.`);
      console.error(error);
      return;
    }

    const newText = await this.app.vault.cachedRead(file);

    this.renderHeader();
    this.renderMerge(oldText, newText);
  }
}
