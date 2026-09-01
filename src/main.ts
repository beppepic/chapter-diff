import { FileSystemAdapter, Notice, Plugin, TFile, WorkspaceLeaf } from "obsidian";
import path from "node:path";
import { CommitInfo, findRepoRoot, getFileHistory } from "./git";
import { CommitPickerModal } from "./CommitPickerModal";
import { CHAPTER_DIFF_VIEW_TYPE, DiffTarget, DiffView } from "./DiffView";

export default class ChapterDiffPlugin extends Plugin {
  async onload(): Promise<void> {
    this.registerView(CHAPTER_DIFF_VIEW_TYPE, (leaf) => new DiffView(leaf));

    this.addCommand({
      id: "compare-with-revision",
      name: "Compare current file with a past revision",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file) return false;
        if (!checking) void this.compareActiveFile(file);
        return true;
      },
    });
  }

  private async compareActiveFile(file: TFile): Promise<void> {
    const sourceLeaf = this.app.workspace.getLeaf(false);
    const adapter = this.app.vault.adapter;
    if (!(adapter instanceof FileSystemAdapter)) {
      new Notice("Chapter diff requires a local vault on the desktop.");
      return;
    }

    const absoluteFilePath = adapter.getFullPath(file.path);
    const repoRoot = await findRepoRoot(path.dirname(absoluteFilePath));
    if (!repoRoot) {
      new Notice("Chapter diff: this file is not inside a Git repository.");
      return;
    }

    const relPath = path.relative(repoRoot, absoluteFilePath).split(path.sep).join("/");

    let history: CommitInfo[];
    try {
      history = await getFileHistory(repoRoot, relPath);
    } catch (error) {
      new Notice("Chapter diff: failed to read commit history.");
      console.error(error);
      return;
    }
    if (history.length === 0) {
      new Notice("Chapter diff: no commits found for this file.");
      return;
    }

    new CommitPickerModal(this.app, history, (commit) => {
      void this.openDiffView({ file, repoRoot, relPath, commit }, sourceLeaf);
    }).open();
  }

  private async openDiffView(target: DiffTarget, leaf: WorkspaceLeaf): Promise<void> {
    await leaf.setViewState({ type: CHAPTER_DIFF_VIEW_TYPE, active: true });
    await this.app.workspace.revealLeaf(leaf);

    const view = leaf.view;
    if (view instanceof DiffView) {
      await view.setTarget(target);
    }
  }
}
