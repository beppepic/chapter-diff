# Changelog

All notable changes to Chapter Diff are documented in this file.

## 0.2.0 — 2026-09-01

- Made the Working Tree column editable and automatically saved changes back
  to the note, matching Obsidian Git's editable diff workflow while allowing
  any historical revision on the left.
- Kept external note edits synchronized without rebuilding the entire diff
  view or moving the cursor.

## 0.1.0 — 2026-09-01

- Initial release.
- **Compare current file with a past revision** command with a commit
  picker built from the file's full Git history.
- Side-by-side inline diff view (CodeMirror merge view) comparing a chosen
  commit against the live vault content of the note.
- Auto-refreshing right-hand pane as the note is edited or saved.
- Revision-aware file lookup across Git renames.
