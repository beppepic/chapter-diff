import { simpleGit } from "simple-git";

export interface CommitInfo {
  hash: string;
  shortHash: string;
  date: string;
  message: string;
}

const RECORD_SEP = "\x1e";
const UNIT_SEP = "\x1f";

/**
 * Walks up from `startPath` to find the root of the Git repository it
 * belongs to, or null when `startPath` is not inside a Git working tree.
 */
export async function findRepoRoot(startPath: string): Promise<string | null> {
  try {
    const git = simpleGit(startPath);
    const root = await git.revparse(["--show-toplevel"]);
    return root.trim();
  } catch {
    return null;
  }
}

/**
 * Parses the `%H\x1f%h\x1f%ad\x1f%s\x1e`-formatted output of `git log`
 * used by {@link getFileHistory} into structured commit records.
 */
export function parseLogOutput(output: string): CommitInfo[] {
  return output
    .split(RECORD_SEP)
    .map((record) => record.trim())
    .filter((record) => record.length > 0)
    .map((record) => {
      const [hash, shortHash, date, message] = record.split(UNIT_SEP);
      return { hash, shortHash, date, message } as CommitInfo;
    });
}

/**
 * Returns the commit history for a single file, newest first, following
 * renames. `relPath` must be relative to `repoRoot` and use forward slashes.
 */
export async function getFileHistory(
  repoRoot: string,
  relPath: string,
  maxCount = 200,
): Promise<CommitInfo[]> {
  const git = simpleGit(repoRoot);
  const format = `%H${UNIT_SEP}%h${UNIT_SEP}%ad${UNIT_SEP}%s${RECORD_SEP}`;
  const output = await git.raw([
    "log",
    "--follow",
    `--max-count=${maxCount}`,
    "--date=format:%Y-%m-%d %H:%M",
    `--pretty=format:${format}`,
    "--",
    relPath,
  ]);

  return parseLogOutput(output);
}

/**
 * Reads the content of a file as it existed at a given revision.
 * Throws if the path did not exist under that name at that revision
 * (this can happen across a rename when history was followed).
 */
export async function getFileAtRevision(
  repoRoot: string,
  relPath: string,
  hash: string,
): Promise<string> {
  const git = simpleGit(repoRoot);
  return git.show([`${hash}:${relPath}`]);
}
