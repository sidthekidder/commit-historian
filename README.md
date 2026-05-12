# commit-historian

> Point it at any file in your git repo. Get a short, vivid narrative of how it came to be.

<p align="center">
  <img src="https://raw.githubusercontent.com/sidthekidder/commit-historian/main/assets/demo.svg" alt="commit-historian example output" width="720"/>
</p>

`commit-historian` is a CLI code archaeologist. It feeds a file's `git log` (with patches) to Claude and asks for a story — with real commit SHAs as anchors — so you can read the *why* behind code, not just the *what*.

<sub>Image above is an illustrative example. Replace with a real capture from your repo after running it.</sub>

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
