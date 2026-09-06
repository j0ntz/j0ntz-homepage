#!/usr/bin/env node
// Design lint for docs/design-system.md. No dependencies.
//
// Usage:
//   node scripts/design-check.mjs            scan the working tree
//   node scripts/design-check.mjs <files...> scan only those files
//
// Exits 0 when clean, 1 with one `path:line: rule: detail` finding per line
// when anything on the contract's forbidden list is present, 2 on a usage or
// I/O error.
//
// Rules (all case-insensitive):
//   font          a forbidden font family anywhere
//   literal-color a hex, hsl, or rgb literal in a component file (see
//                 isComponentFile); app/globals.css is the only token source
//   hue           purple, violet, or indigo by name, or a hex or hsl literal
//                 whose hue falls in 250 to 290
//   background    #000 or #fff (short or long) as a background, including
//                 bg-black, bg-white, and the bracketed Tailwind forms
//   utility       rounded-2xl, shadow-lg, backdrop-blur, bg-gradient-to and
//                 the Tailwind 4 gradient spellings, and any Tailwind palette
//                 color utility (bg-zinc-50, text-blue-500, ...)
//   copy          a word or phrase from docs/data-banned-words.txt in app/,
//                 components/, or content/
//
// Tree scan scope: every text file in the working tree except docs/ (the
// contract and the research quote the forbidden list on purpose), .claude/
// (agent instructions do the same), this script, lockfiles, and binaries.
// Files named on the command line are checked as given, exclusions aside.

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const bannedWordsPath = join(repoRoot, "docs", "data-banned-words.txt");

const excludedPrefixes = ["docs/", ".claude/", ".git/", "node_modules/", ".next/", "out/", "build/", "coverage/", ".vercel/"];
const excludedFiles = new Set(["scripts/design-check.mjs", "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lockb"]);
const binaryExtensions = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".ico", ".woff", ".woff2", ".ttf", ".otf", ".pdf", ".zip", ".mp4", ".webm"]);

const copyScopes = ["app/", "components/", "content/"];
const componentScopes = ["app/", "components/", "lib/", "hooks/"];
const tokenSource = "app/globals.css";

// A name boundary that treats `_` and `-` as separators, so Geist_Mono and
// bg-indigo-500 are caught where \b would let them through.
const before = "(?<![a-z0-9])";
const after = "(?![a-z0-9])";

const fontPattern = new RegExp(`${before}(inter|roboto|open[\\s_-]?sans|poppins|geist|space[\\s_-]?grotesk)${after}`, "gi");
const hueNamePattern = new RegExp(`${before}(purple|violet|indigo)${after}`, "gi");
const hexPattern = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![\w-])/gi;
const hslPattern = /\bhsla?\(\s*(-?\d+(?:\.\d+)?)(deg|turn|rad|grad)?\b[^)]*\)/gi;
const rgbPattern = /\brgba?\([^)]*\)/gi;
const backgroundPatterns = [
  /\bbackground(?:-color)?\s*:[^;{}]*#(?:000000|000|ffffff|fff)(?![\w-])/gi,
  /(?<![\w-])bg-\[#(?:000000|000|ffffff|fff)\]/gi,
  /(?<![\w-])bg-(?:black|white)(?![\w-])/gi,
];
const utilityPatterns = [
  /(?<![\w-])(?:rounded-2xl|shadow-lg|backdrop-blur|bg-gradient-to|bg-linear-to|bg-conic)(?![a-z0-9])/g,
  /(?<![\w-])(?:bg|text|border|from|to|via|ring|fill|stroke|outline|decoration|accent|caret|divide|placeholder|shadow|inset-ring|ring-offset)-(?:(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}|black|white)(?![\w-])/g,
];

const hueLow = 250;
const hueHigh = 290;

main();

function main() {
  const args = process.argv.slice(2);
  const files = args.length > 0 ? args.map(toRepoPath) : listTree();
  const bannedPhrases = loadBannedPhrases();
  const findings = [];
  for (const file of files) {
    if (excludedFiles.has(file) || binaryExtensions.has(extensionOf(file))) continue;
    let text;
    try {
      const buffer = readFileSync(join(repoRoot, file));
      if (buffer.subarray(0, 4096).includes(0)) continue;
      text = buffer.toString("utf8");
    } catch (error) {
      process.stderr.write(`design-check: cannot read ${file}: ${errorMessage(error)}\n`);
      process.exit(2);
    }
    findings.push(...checkFile(file, text, bannedPhrases));
  }
  for (const finding of findings) {
    process.stdout.write(`${finding.file}:${finding.line}: ${finding.rule}: ${finding.detail}\n`);
  }
  if (findings.length > 0) {
    process.stdout.write(`design-check: ${findings.length} finding${findings.length === 1 ? "" : "s"} in ${countFiles(findings)} file${countFiles(findings) === 1 ? "" : "s"}\n`);
    process.exit(1);
  }
  process.stdout.write(`design-check: clean (${files.length} files)\n`);
}

function checkFile(file, text, bannedPhrases) {
  const findings = [];
  const inCopyScope = startsWithAny(file, copyScopes);
  const literalColorsForbidden = isComponentFile(file);
  const lines = text.split(/\r?\n/);
  lines.forEach((lineText, index) => {
    const line = index + 1;
    const add = (rule, detail) => findings.push({ file, line, rule, detail });

    for (const match of lineText.matchAll(fontPattern)) {
      add("font", `forbidden font family "${match[1]}"`);
    }

    for (const match of lineText.matchAll(hueNamePattern)) {
      add("hue", `hue name "${match[1]}"`);
    }
    for (const match of lineText.matchAll(hexPattern)) {
      const hue = hexHue(match[0]);
      if (hue != null && hue >= hueLow && hue <= hueHigh) {
        add("hue", `${match[0]} has hue ${Math.round(hue)} (${hueLow} to ${hueHigh} is forbidden)`);
      }
      if (literalColorsForbidden) add("literal-color", `${match[0]} in a component file; use a token from ${tokenSource}`);
    }
    for (const match of lineText.matchAll(hslPattern)) {
      const hue = normalizeHue(Number(match[1]), match[2]);
      if (hue >= hueLow && hue <= hueHigh) {
        add("hue", `${match[0]} has hue ${Math.round(hue)} (${hueLow} to ${hueHigh} is forbidden)`);
      }
      if (literalColorsForbidden) add("literal-color", `${match[0]} in a component file; use a token from ${tokenSource}`);
    }
    if (literalColorsForbidden) {
      for (const match of lineText.matchAll(rgbPattern)) {
        add("literal-color", `${match[0]} in a component file; use a token from ${tokenSource}`);
      }
    }

    for (const pattern of backgroundPatterns) {
      for (const match of lineText.matchAll(pattern)) {
        add("background", `pure black or white background "${match[0].trim()}"`);
      }
    }

    for (const pattern of utilityPatterns) {
      for (const match of lineText.matchAll(pattern)) {
        add("utility", `forbidden utility "${match[0]}"`);
      }
    }

    if (inCopyScope) {
      for (const { phrase, pattern } of bannedPhrases) {
        if (pattern.test(lineText)) add("copy", `banned word "${phrase}"`);
        pattern.lastIndex = 0;
      }
    }
  });
  return findings;
}

function isComponentFile(file) {
  if (file === tokenSource) return false;
  return startsWithAny(file, componentScopes) || /\.(tsx|jsx)$/.test(file);
}

function loadBannedPhrases() {
  let text;
  try {
    text = readFileSync(bannedWordsPath, "utf8");
  } catch (error) {
    process.stderr.write(`design-check: cannot read ${relative(repoRoot, bannedWordsPath)}: ${errorMessage(error)}\n`);
    process.exit(2);
  }
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"))
    .map((phrase) => {
      const body = phrase
        .split(/[\s-]+/)
        .map(escapeRegExp)
        .join("[\\s-]+");
      return { phrase, pattern: new RegExp(`${before}${body}${after}`, "gi") };
    });
}

function listTree() {
  let entries;
  try {
    const output = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    entries = output.split("\0").filter((entry) => entry !== "");
  } catch {
    entries = walk(repoRoot);
  }
  return entries.filter((file) => !startsWithAny(file, excludedPrefixes) && isRegularFile(file));
}

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name);
    const file = toRepoPath(absolute);
    if (entry.isDirectory()) {
      if (!startsWithAny(`${file}/`, excludedPrefixes)) files.push(...walk(absolute));
    } else if (entry.isFile()) {
      files.push(file);
    }
  }
  return files;
}

function isRegularFile(file) {
  try {
    return statSync(join(repoRoot, file)).isFile();
  } catch {
    return false;
  }
}

function toRepoPath(input) {
  return relative(repoRoot, resolve(input)).split(sep).join("/");
}

function startsWithAny(file, prefixes) {
  return prefixes.some((prefix) => file.startsWith(prefix));
}

function extensionOf(file) {
  const dot = file.lastIndexOf(".");
  return dot === -1 ? "" : file.slice(dot).toLowerCase();
}

function countFiles(findings) {
  return new Set(findings.map((finding) => finding.file)).size;
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

// Hue in degrees for a #rgb, #rgba, #rrggbb, or #rrggbbaa literal, or null
// when the color is achromatic (no hue to speak of).
function hexHue(literal) {
  let hex = literal.slice(1);
  if (hex.length === 3 || hex.length === 4) {
    hex = hex
      .split("")
      .map((char) => char + char)
      .join("");
  }
  const red = parseInt(hex.slice(0, 2), 16) / 255;
  const green = parseInt(hex.slice(2, 4), 16) / 255;
  const blue = parseInt(hex.slice(4, 6), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  if (max === min) return null;
  const delta = max - min;
  let hue;
  if (max === red) hue = ((green - blue) / delta) % 6;
  else if (max === green) hue = (blue - red) / delta + 2;
  else hue = (red - green) / delta + 4;
  return normalizeHue(hue * 60, "deg");
}

function normalizeHue(value, unit) {
  let degrees = value;
  if (unit === "turn") degrees = value * 360;
  else if (unit === "rad") degrees = (value * 180) / Math.PI;
  else if (unit === "grad") degrees = value * 0.9;
  return ((degrees % 360) + 360) % 360;
}
