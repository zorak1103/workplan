# Transfer checklist

For finishing the plugin on another machine and publishing it. The package is a zip of the tracked
files, without `.git`.

## What the package contains

The plugin (manifest, skills, agents, hook, scripts, reference files), the tests, the licence
template, `.gitignore`, `.gitattributes`, the marketplace manifest and this documentation. It does
not contain a git history, tool leftovers, or anything from the conversation that produced it.
The decisions from that conversation are in [decisions.md](decisions.md), the remaining work in
[development.md](development.md).

## 1. Unpack and check the environment

```bash
node --version      # 16 or later for the scripts, 21 or later for the quoted test glob
git --version
claude --version    # developed against 2.1.312
```

## 2. Prove the package is intact

From the unpacked directory (`<plugin-dir>`):

```bash
node --test "test/**/*.test.mjs"        # expect: all tests pass (94 when this was written)
claude plugin validate . --strict        # expect: Validation passed
```

Redirect the long test output to a file and read the summary. If a test fails on the new machine
and not on the old one, suspect the Node version first (see [troubleshooting.md](troubleshooting.md)).

## 3. Create the repository

```bash
git init
git config user.name  "<name for this repository>"
git config user.email "<address for this repository>"
git add -A
git status                                # check what goes in before committing
git commit -m "feat: initial import of the workplan plugin"
```

Set the identity before the first commit; it becomes part of the history.

## 4. Fill the placeholders

| File | Placeholder |
|---|---|
| `LICENSE` | holder `zorak1103` (MIT licence, year 2026): filled |
| `.claude-plugin/plugin.json` | `author` filled; `version` and the description if they should differ |
| `.claude-plugin/marketplace.json` | `owner` filled; `name` and both descriptions if they should differ |
| `README.md` | install line filled with `zorak1103/workplan` |
| everywhere | the name `workplan`, if you rename it; the list is in [development.md](development.md) |

## 5. Acceptance run in a live session

This closes the "not yet verified" items. Use a scratch git repository so nothing real is touched.
Mark each line only after you saw the result.

```bash
mkdir scratch && cd scratch && git init
claude --plugin-dir <plugin-dir>
```

| # | Do | Expect |
|---|---|---|
| 1 | check the skill list | `/workplan:create`, `review`, `execute`, `close` are offered |
| 2 | `/workplan:create` for a small invented task | a "Setup" question; after confirming, `.workplans/` exists and `.git/info/exclude` contains `/.workplans/` |
| 3 | answer the questions | a document under `.workplans/`, validated by `validate-workplan.mjs` without errors, summary in English |
| 4 | `/workplan:review` | three critics run in parallel; one consolidated list; nothing written to the document |
| 5 | `/workplan:execute --amend` with one accepted finding | the finding appears in `## Addenda`, no status changed |
| 6 | `/workplan:execute` on a `Plan` phase | the phase's complexity is named first; only that phase is read; status becomes `Done`; the skill stops and names the next phase |
| 7 | say "create a workplan for X" without the slash command | one confirmation prompt appears before the skill starts (the entry hook) |
| 8 | try `set-phase-status.mjs --status Erledigt` | refused, nothing changed |
| 9 | finish all phases, then `/workplan:close` | harvest questions one at a time, closing sentence appended, delete only after your explicit yes |
| 10 | run a short `brainstorming` session to an approved design, then `/workplan:create --from-design <design>` | no repeated questions about goals; the design's claims about the code are checked; the preamble names the design; the design file is unchanged |

If step 7 shows no prompt, capture a payload as described in
[troubleshooting.md](troubleshooting.md) and compare it with the hook tests.

If step 10 works, add the hand-over rule from
[brainstorming-integration.md](brainstorming-integration.md) to your instructions.

## 6. Publish

Push the repository, then on any machine:

```bash
claude plugin marketplace add <git-url-of-the-repository>
claude plugin install workplan@workplan-marketplace
claude plugin list
```

Verify as in [installation.md](installation.md). Then update the README install line and tag a
release (`claude plugin tag` creates a `{name}--v{version}` tag).

## 7. Only for a public plugin directory

`claude plugin validate . --profile directory` lists what a public directory refuses. At the time
of writing these are a `README.md` in the plugin folder of at least 40 words (present now that the
README is `README.md`; the validator only advises adding the install line),
a licence (present once the holder is filled in) and, as advice, a square PNG icon of 512 to
2048 px. A private marketplace needs none of these.
