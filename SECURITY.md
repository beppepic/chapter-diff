# Security policy

## Reporting a vulnerability

Please report suspected vulnerabilities privately through GitHub's
**Security → Report a vulnerability** form for this repository. Do not
include sensitive details in a public issue.

Chapter Diff runs locally and makes no network requests. It shells out to
the system `git` binary only to run read-only `git log` and `git show`
commands scoped to the active file, and never stages, commits, pushes, or
otherwise modifies repository state.
