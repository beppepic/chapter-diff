import { App, FuzzySuggestModal } from "obsidian";
import type { CommitInfo } from "./git";

export class CommitPickerModal extends FuzzySuggestModal<CommitInfo> {
  constructor(
    app: App,
    private readonly commits: CommitInfo[],
    private readonly onChoose: (commit: CommitInfo) => void,
  ) {
    super(app);
    this.setPlaceholder("Compare the current file with…");
  }

  getItems(): CommitInfo[] {
    return this.commits;
  }

  getItemText(commit: CommitInfo): string {
    return `${commit.shortHash}  ${commit.date}  ${commit.message}`;
  }

  onChooseItem(commit: CommitInfo): void {
    this.onChoose(commit);
  }
}
