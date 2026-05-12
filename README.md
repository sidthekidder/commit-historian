# commit-historian

> Point it at any file in your git repo. Get a short, vivid narrative of how it came to be.

<p align="center">
  <img src="./assets/demo.svg" alt="commit-historian example output" width="720"/>
</p>

`commit-historian` is a CLI code archaeologist. It feeds a file's `git log` (with patches) to Claude and asks for a story — with real commit SHAs as anchors — so you can read the *why* behind code, not just the *what*.

<sub>The image above is an illustrative example. Drop in a real capture from your repo after running it.</sub>

```bash
$ commit-historian src/auth/middleware.ts

Born `a1b2c3d` on a Sunday afternoon as 20 lines wrapped around
`jsonwebtoken`, with the kind of confidence that only comes from
not having a refresh flow yet. The Stripe outage three months
later disagreed.

Rap sheet:
- `e4f5a6b` bolted on retry-aware refresh in a panic. Commit
  message: "fix prod (will clean up tmrw)". It is now 2026.
- `b7c8d9e` added rate limiting that immediately rate-limited the
  health check. Reverted in `c8d9e0f`, re-added wrong in `d0e1f2a`.
- `f0a1b2c` forked the session types into a private file because
  "the upstream types are stupid". Lived in exile for two months
  before `d3e4f5a` reunited them, types stupid as ever.
- The TODO from `c5d6e7f` to "revoke on logout" survived four
  refactors and three engineers. `9a8b7c6` finally did it, with
  no fanfare and a one-word commit message ("fine.").

Current state: 280 lines, technically owned by the platform team,
spiritually owned by whoever last got paged at 3am. Still imports
`jsonwebtoken`. Still has a Sunday-afternoon comment from 2024
apologising for things that have since been fixed and broken twice.
```

## Install

```bash
npx commit-historian <path>
# or globally
npm i -g commit-historian
```

## Usage

```bash
commit-historian <path>                  # full history with patches
commit-historian <path> --short          # metadata only, faster + cheaper
commit-historian <path> --since v1.0     # limit to a ref or date
commit-historian <path> --model <id>     # override model
commit-historian <path> --dry-run        # print the prompt; no API call
```

Requires `ANTHROPIC_API_KEY` in your environment. Defaults to
`claude-sonnet-4-6`.

## Why

`git log` answers *what changed*. `git blame` answers *who*. Neither
answers *why this file is shaped the way it is* — which is the actual
question when you join a project, audit a module, or onboard onto a
team's code. `commit-historian` does that, with citations.

## How it works

1. Resolves the file inside your repo (follows renames).
2. Runs `git log --follow -p --date=short` and caps the patch payload.
3. Streams the log to Claude with a strict system prompt: anchor every
   claim to a real short SHA, surface tensions and reverts, keep it
   under ~450 words.
4. Streams the markdown narrative to stdout.

No data leaves your machine except the git log you pass to Anthropic's
API.

## License

MIT
