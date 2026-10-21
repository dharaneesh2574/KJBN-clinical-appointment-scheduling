import { readFile, access } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { root, reportFailure } from "./process.mjs";

const readmeHeadings = [
  "1. Title and one-liner",
  "2. Live links",
  "3. Tech stack",
  "4. Architecture",
  "5. Running locally",
  "5a. Deployment",
  "6. Running tests and coverage",
  "7. API overview",
  "8. Business rules and assumptions",
  "9. Error handling and logging",
  "10. Reviewer aids",
  "11. Known limitations",
  "12. AI and third-party usage",
];
const submissionHeadings = [
  "A. What I built",
  "B. Three design decisions",
  "C. The hardest part",
  "D. How I handle failure",
  "E. Milestone log",
  "F. If I had two more days",
  "G. Self-assessment",
];
const rubric = [
  ["Business logic correctness", 25],
  ["Code clarity and structure", 14],
  ["Error and exception handling", 10],
  ["Logging and observability", 8],
  ["Data modelling and persistence", 9],
  ["API design", 8],
  ["UI usability", 6],
  ["Testing", 7],
  ["Deployment and operability", 5],
  ["Git hygiene", 4],
  ["Documentation and write-up", 4],
];
const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};
const words = (text) => text.trim().split(/\s+/).filter(Boolean).length;
const headings = (text) =>
  [
    ...text
      .replace(/^```[^\n]*\n[\s\S]*?^```[ \t]*$/gm, "")
      .matchAll(/^#{1,2} (.+)$/gm),
  ].map((match) => match[1]);

try {
  const readme = await readFile(resolve(root, "README.md"), "utf8");
  const submission = await readFile(resolve(root, "SUBMISSION.md"), "utf8");
  check(
    JSON.stringify(headings(readme)) === JSON.stringify(readmeHeadings),
    "README headings/order must match the assignment",
  );
  check(
    JSON.stringify(headings(submission)) === JSON.stringify(submissionHeadings),
    "SUBMISSION headings/order must match the assignment",
  );
  const sections = submission.split(/^#{1,2} [A-G]\. .+$/m).slice(1);
  if (sections.length === 7) {
    const [built, decisions, hardest, failure, milestones, next, assessment] =
      sections;
    check(
      (built.match(/[.!?](?:\s|$)/g) ?? []).length <= 5,
      "A must have at most five sentences",
    );
    const entries = decisions.split(/^\d+\. /m).slice(1);
    check(entries.length === 3, "B must contain three design decisions");
    for (const [index, entry] of entries.entries()) {
      check(
        words(entry) >= 65 && words(entry) <= 100,
        `Decision ${index + 1} must be approximately 80 words`,
      );
      for (const label of [
        "Decision:",
        "Alternative considered:",
        "Why I chose this:",
        "What it cost me:",
      ])
        check(entry.includes(label), `Decision ${index + 1} lacks ${label}`);
    }
    check(words(hardest) <= 150, "C exceeds 150 words");
    check(words(failure) <= 150, "D exceeds 150 words");
    check(
      [...milestones.matchAll(/^\| M[0-6] \|/gm)].length === 7,
      "E requires seven milestone rows",
    );
    for (let index = 0; index <= 6; index++)
      check(
        [...milestones.matchAll(new RegExp(`^\\| M${index} \\|`, "gm"))]
          .length === 1,
        `E requires exactly one M${index} row`,
      );
    check(
      [...next.matchAll(/^\d+\. /gm)].length === 5,
      "F requires five ordered next steps",
    );
    const rows = assessment
      .split("\n")
      .filter((line) => line.startsWith("| "))
      .map((line) =>
        line
          .split("|")
          .slice(1, -1)
          .map((cell) => cell.trim()),
      )
      .filter((cells) => !cells.every((cell) => /^:?-+:?$/.test(cell)));
    check(
      rows.length === 12,
      "G requires exactly eleven rubric rows plus a header",
    );
    for (const [name, weight] of rubric) {
      const row = rows.find((cells) => cells[0] === name);
      check(
        row?.[1] === String(weight) &&
          /^[1-5]$/.test(row?.[2] ?? "") &&
          Boolean(row?.[3]),
        `Invalid rubric row: ${name}`,
      );
    }
  }
  check(
    words(submission) <= 900,
    "SUBMISSION exceeds the 900-word two-page-equivalent budget",
  );
  for (const hash of new Set(
    [...submission.matchAll(/`([a-f0-9]{7,40})`/g)].map((match) => match[1]),
  )) {
    try {
      execFileSync("git", ["cat-file", "-e", `${hash}^{commit}`], {
        cwd: root,
        stdio: "ignore",
      });
    } catch {
      failures.push(`Submission references an absent commit: ${hash}`);
    }
  }
  const promptLog = await readFile(resolve(root, "PROMPTS.md"), "utf8");
  const promptNumbers = [...promptLog.matchAll(/^## (\d+)\. /gm)].map((match) =>
    Number(match[1]),
  );
  check(
    promptNumbers.every((value, index) => value === index + 1),
    "PROMPTS entries must be consecutive and ordered",
  );
  check(
    promptLog.includes("complete the m6 milestone"),
    "PROMPTS must disclose the M6 request",
  );
  const files = [
    "README.md",
    "SUBMISSION.md",
    "docs/deployment.md",
    "docs/m6-verification.md",
    "docs/reviewer-checklist.md",
  ];
  for (const file of files) {
    const text = await readFile(resolve(root, file), "utf8");
    for (const link of text.matchAll(/!?\[[^\]]*\]\(([^)\s]+)\)/g)) {
      const target = link[1];
      if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("#"))
        continue;
      const path = decodeURIComponent(target.split("#")[0]);
      try {
        await access(resolve(root, dirname(file), path));
      } catch {
        failures.push(`Broken local link in ${file}: ${path}`);
      }
    }
  }
  if (failures.length) throw new Error(failures.join("\n"));
  process.stdout.write(
    `Documentation checks passed: required headings, limits, milestones, rubric, prompt order, commit references and local links (${words(submission)} submission words).\n`,
  );
} catch (error) {
  reportFailure(error);
}
