# Changelog

All notable changes to Chapter Diff are documented in this file.

## 0.3.1 — 2026-09-01

- Matched Obsidian Git's split diff highlighting more closely with subtle
  line tints and translucent word-level red and green highlights.
- Removed custom typography, spacing, and gutter overrides so the diff uses
  Obsidian's native editor presentation.

## 0.3.0 — 2026-09-01

- Opened Chapter Diff in the note's existing tab, with navigation back to the
  note, instead of creating a side split.
- Matched Obsidian Git's diff presentation with editor typography, line
  numbers, red and green change highlighting, and a compact toolbar.
- Styled collapsed unchanged ranges as clickable purple-accented bars that
  report how many lines are hidden.

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
