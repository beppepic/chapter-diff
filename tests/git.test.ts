import { describe, expect, it } from "vitest";
import { parseLogOutput } from "../src/git";

describe("parseLogOutput", () => {
  it("parses multiple records separated by the record separator", () => {
    const output =
      "aaa111\x1faaa\x1f2026-08-20 10:00\x1fSecond draft\x1e" +
      "bbb222\x1fbbb\x1f2026-08-01 09:30\x1fFirst draft\x1e";

    expect(parseLogOutput(output)).toEqual([
      { hash: "aaa111", shortHash: "aaa", date: "2026-08-20 10:00", message: "Second draft" },
      { hash: "bbb222", shortHash: "bbb", date: "2026-08-01 09:30", message: "First draft" },
    ]);
  });

  it("returns an empty array for empty output", () => {
    expect(parseLogOutput("")).toEqual([]);
  });

  it("preserves commit messages that contain the unit separator's neighbors", () => {
    const output = "abc\x1fabc\x1f2026-01-01 00:00\x1fFix: chapter 3 — pacing & tone\x1e";
    expect(parseLogOutput(output)).toEqual([
      {
        hash: "abc",
        shortHash: "abc",
        date: "2026-01-01 00:00",
        message: "Fix: chapter 3 — pacing & tone",
      },
    ]);
  });
});
