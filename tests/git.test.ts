import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { getFileAtRevision, getFileHistory, parseLogOutput } from "../src/git";

function git(cwd: string, ...args: string[]): void {
  execFileSync("git", args, { cwd, stdio: "ignore" });
}

describe("parseLogOutput", () => {
  it("parses multiple records separated by the record separator", () => {
    const output =
      "\x1eaaa111\x1faaa\x1f2026-08-20 10:00\x1fSecond draft\0\nM\0Chapters/01.md\0\0" +
      "\x1ebbb222\x1fbbb\x1f2026-08-01 09:30\x1fFirst draft\0\nA\0Chapters/01.md\0";

    expect(parseLogOutput(output)).toEqual([
      {
        hash: "aaa111",
        shortHash: "aaa",
        date: "2026-08-20 10:00",
        message: "Second draft",
        path: "Chapters/01.md",
      },
      {
        hash: "bbb222",
        shortHash: "bbb",
        date: "2026-08-01 09:30",
        message: "First draft",
        path: "Chapters/01.md",
      },
    ]);
  });

  it("returns an empty array for empty output", () => {
    expect(parseLogOutput("")).toEqual([]);
  });

  it("preserves commit messages that contain the unit separator's neighbors", () => {
    const output =
      "\x1eabc\x1fabc\x1f2026-01-01 00:00\x1fFix: chapter 3 — pacing & tone\0\nM\0Chapter 3.md\0";
    expect(parseLogOutput(output)).toEqual([
      {
        hash: "abc",
        shortHash: "abc",
        date: "2026-01-01 00:00",
        message: "Fix: chapter 3 — pacing & tone",
        path: "Chapter 3.md",
      },
    ]);
  });

  it("uses the path that existed at each revision across a rename", () => {
    const output =
      "\x1enewhash\x1fnew\x1f2026-02-02 12:00\x1fRename chapter\0\nR100\0Old.md\0New.md\0\0" +
      "\x1eoldhash\x1fold\x1f2026-01-01 12:00\x1fDraft\0\nA\0Old.md\0";

    expect(parseLogOutput(output).map(({ hash, path }) => ({ hash, path }))).toEqual([
      { hash: "newhash", path: "New.md" },
      { hash: "oldhash", path: "Old.md" },
    ]);
  });

  it("omits revisions where the file was deleted", () => {
    const output = "\x1edead\x1fdead\x1f2026-03-01 12:00\x1fDelete draft\0\nD\0Draft.md\0";
    expect(parseLogOutput(output)).toEqual([]);
  });

  it("reads file content across an actual Git rename", async () => {
    const repo = await mkdtemp(path.join(tmpdir(), "chapter-diff-"));

    try {
      git(repo, "init", "--quiet");
      git(repo, "config", "user.email", "chapter-diff@example.com");
      git(repo, "config", "user.name", "Chapter Diff Tests");

      await mkdir(path.join(repo, "Old"));
      await writeFile(path.join(repo, "Old", "Draft.md"), "one\ntwo\nthree\nfour\n");
      git(repo, "add", ".");
      git(repo, "commit", "--quiet", "-m", "Add draft");

      await mkdir(path.join(repo, "New"));
      git(repo, "mv", "Old/Draft.md", "New/Chapter.md");
      await writeFile(path.join(repo, "New", "Chapter.md"), "one\ntwo\nthree\nfour\nfive\n");
      git(repo, "commit", "--quiet", "-am", "Rename draft");

      const history = await getFileHistory(repo, "New/Chapter.md");
      expect(history.map((commit) => commit.path)).toEqual([
        "New/Chapter.md",
        "Old/Draft.md",
      ]);
      await expect(
        getFileAtRevision(repo, history[1]!.path, history[1]!.hash),
      ).resolves.toBe("one\ntwo\nthree\nfour\n");
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });
});
