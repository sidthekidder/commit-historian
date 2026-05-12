#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, relative } from "node:path";
import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

const HELP = `commit-historian — narrate the story of a file in your git repo.

Usage:
  commit-historian <path>                Tell the story of <path>.
  commit-historian <path> --since v1.0   Limit to commits after a ref/date.
  commit-historian <path> --short        Skip patches; metadata only (cheaper, faster).
  commit-historian <path> --model <id>   Override model (default: claude-sonnet-4-6).
  commit-historian <path> --dry-run      Print the prompt that would be sent and exit.
  commit-historian --help                Show this help.

Env:
  ANTHROPIC_API_KEY    Required.

Examples:
  commit-historian src/auth/middleware.ts
  commit-historian README.md --since 2024-01-01 --short
`;

// Hard caps to keep the prompt sane even on a 1M-context model.
const MAX_LOG_CHARS = 250_000;

function parseArgs(argv) {
  const args = { path: null, since: null, short: false, dryRun: false, model: "claude-sonnet-4-6", help: false };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") args.help = true;
    else if (a === "--short") args.short = true;
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--since") args.since = argv[++i];
    else if (a === "--model") args.model = argv[++i];
    else if (a.startsWith("--")) die(`Unknown flag: ${a}`);
    else rest.push(a);
  }
  if (rest.length > 1) die(`Expected one path, got ${rest.length}: ${rest.join(", ")}`);
  args.path = rest[0] ?? null;
  return args;
}

function die(msg, code = 1) {
  process.stderr.write(`commit-historian: ${msg}\n`);
  process.exit(code);
}

function git(args, { allowFail = false } = {}) {
  const r = spawnSync("git", args, { encoding: "utf8", maxBuffer: 1024 * 1024 * 256 });
  if (r.status !== 0 && !allowFail) die(`git ${args.join(" ")}\n${r.stderr.trim()}`);
  return r.stdout;
}

function ensureGitRepo() {
  const r = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], { encoding: "utf8" });
  if (r.status !== 0) die("Not inside a git repository.");
}

function resolveTrackedPath(input) {
  const abs = resolve(process.cwd(), input);
  const repoRoot = git(["rev-parse", "--show-toplevel"]).trim();
  const rel = relative(repoRoot, abs);
  // file may have been deleted; check both fs and git history
  const everTracked = git(["log", "--all", "--oneline", "--", rel], { allowFail: true }).trim();
  if (!everTracked && !existsSync(abs)) {
    die(`No git history found for "${input}" (resolved as ${rel}).`);
  }
  return { rel, repoRoot };
}

function collectHistory(relPath, { since, short }) {
  const range = since ? [`${since}..HEAD`] : [];
  const fmt = "----COMMIT----%n%H%n%an <%ae>%n%ad%n%s%n%b%n----END-MSG----";
  const baseArgs = ["log", "--follow", `--format=${fmt}`, "--date=short", ...range];
  const metaOnly = git([...baseArgs, "--shortstat", "--", relPath]);
  if (short) return { text: metaOnly, truncated: false, mode: "short" };
  const withPatch = git([...baseArgs, "-p", "--", relPath]);
  if (withPatch.length <= MAX_LOG_CHARS) return { text: withPatch, truncated: false, mode: "full" };
  // Too big: keep metadata for all commits + patches for the most recent that fit.
  const head = withPatch.slice(0, MAX_LOG_CHARS);
  const tail = `\n\n[…truncated ${withPatch.length - MAX_LOG_CHARS} chars of older patches; metadata above is complete…]\n\n${metaOnly}`;
  return { text: head + tail, truncated: true, mode: "mixed" };
}

const SYSTEM_PROMPT = `You're a snarky code archaeologist writing the file's obituary while it's still alive. Tone: dry, specific, slightly mean, occasionally fond. Think engineer venting on Slack, not LinkedIn post.

Rules:
- 120 words max. Hard ceiling. Shorter is better.
- No headers. No bullet lists unless genuinely funnier. Just prose.
- Cite real short SHAs in backticks (\`a1b2c3d\`). Never invent them. Name authors when it lands.
- Punch at specifics: the doomed refactor, the TODO that outlived three engineers, the suspiciously named variable, the Friday-at-5pm commit.
- Surface drama: reverts, things removed and added back, dormant years, the commit message that gave up halfway through.

Banned forever: "journey", "evolved over time", "various improvements", "robust", "comprehensive", "stands as a testament", taglines in bold, em-dash sandwiches, three-act structure, motivational closers, emojis.

If the history is thin, say so in one line and stop. Don't pad.`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.path) {
    process.stdout.write(HELP);
    process.exit(args.help ? 0 : 1);
  }
  ensureGitRepo();
  const { rel } = resolveTrackedPath(args.path);
  const history = collectHistory(rel, { since: args.since, short: args.short });

  if (!history.text.trim()) {
    die(`No commits found for "${rel}"${args.since ? ` since ${args.since}` : ""}.`);
  }

  const userPrompt = `File: \`${rel}\`
Mode: ${history.mode}${history.truncated ? " (truncated)" : ""}
${args.since ? `Since: ${args.since}\n` : ""}
Git log follows. Each commit begins with "----COMMIT----" and contains: full SHA, author, date, subject, body, and (when present) the patch.

${history.text}`;

  if (args.dryRun) {
    process.stderr.write(`# dry-run: ${userPrompt.length} chars in prompt, model=${args.model}, mode=${history.mode}\n\n`);
    process.stdout.write(`---SYSTEM---\n${SYSTEM_PROMPT}\n\n---USER---\n${userPrompt}\n`);
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    die("ANTHROPIC_API_KEY is not set. Get one at https://console.anthropic.com/");
  }

  const { textStream } = streamText({
    model: anthropic(args.model),
    system: SYSTEM_PROMPT,
    prompt: userPrompt,
    temperature: 0.85,
  });

  for await (const chunk of textStream) process.stdout.write(chunk);
  process.stdout.write("\n");
}

main().catch((err) => die(err?.message ?? String(err)));
