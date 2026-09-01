# Chapter Diff

Chapter Diff compares the note you are currently editing with any past Git
commit, side by side, with inline diff highlighting — the "Working
Tree/Live" comparison familiar from IDEs like Visual Studio, brought into
Obsidian.

It is designed for long-form writing: keep drafting in your normal editor
tab while a panel next to it shows exactly what changed since an earlier
commit of the same chapter.

## Requirements

- A desktop vault that is (or lives inside) a Git working tree — for
  example one already versioned with [obsidian-git](https://github.com/vinzent03/obsidian-git).
- `git` installed and available on your system `PATH`. Chapter Diff shells
  out to your system Git; it does not bundle or depend on obsidian-git's
  internals.
- Desktop only. Reading arbitrary commits requires Node's `child_process`,
  which is not available on mobile.

## Usage

1. Open the note you want to compare.
2. Run **Chapter Diff: Compare current file with a past revision** from the
   Command Palette.
3. Pick a commit from the file's history.
4. A new pane opens to the side showing that commit's content on the left
   and the file's current content on the right, with changes highlighted.
5. Keep writing in your normal editor tab — the diff panel refreshes
   automatically as you save or edit.
6. Use the panel's toolbar to switch to a different revision or force a
   refresh.

## How it works

Chapter Diff does not read or write Git state itself beyond `git log` and
`git show` for the active file — it never stages, commits, or pushes
anything. The "current" side of the comparison is read directly from the
Obsidian vault, not from Git, so it always reflects unsaved edits exactly
as your normal editor tab does.

## Development

```bash
pnpm install
pnpm dev     # watch build
pnpm build   # type-check + production build
pnpm test    # unit tests
pnpm lint    # eslint
```

Symlink (or copy) `main.js`, `manifest.json`, and `styles.css` into
`<vault>/.obsidian/plugins/chapter-diff/` to test in a real vault.
