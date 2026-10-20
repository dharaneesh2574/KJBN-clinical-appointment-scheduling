import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { root, run, reportFailure } from "./process.mjs";
import { checkReadiness } from "./check-readiness.mjs";

const coverage = process.argv.includes("--coverage");
const compose = [
  "compose",
  "--project-name",
  "kjbn-clinic-verify",
  "-f",
  "docker-compose.verify.yml",
];
const container = "kjbn-clinic-verify-runner";
try {
  if (process.argv.slice(2).some((value) => value !== "--coverage"))
    throw new Error("Usage: npm test OR npm run coverage");
  await run("npm", ["--prefix", "frontend", "run", "lint"]);
  await run("npm", ["--prefix", "frontend", "run", "build"]);
  await run("docker", [...compose, "build", "tests"]);
  await run("docker", [
    ...compose,
    "up",
    "--wait",
    "--wait-timeout",
    "90",
    "db",
  ]);
  await run("docker", [
    ...compose,
    "run",
    "--rm",
    "tests",
    "npx",
    "eslint",
    "{src,apps,libs,test}/**/*.ts",
  ]);
  await run("docker", [
    ...compose,
    "run",
    "--name",
    container,
    "tests",
    "npm",
    "run",
    coverage ? "test:cov:all" : "test:all",
  ]);
  if (coverage) {
    await mkdir(resolve(root, "backend/coverage"), { recursive: true });
    await run("docker", [
      "cp",
      `${container}:/app/coverage/all`,
      resolve(root, "backend/coverage/"),
    ]);
  }
  // Reset only this disposable project, giving hosted startup a fresh database.
  await run("docker", [...compose, "down", "--volumes", "--remove-orphans"]);
  await checkReadiness(compose);
  await run("npm", ["--prefix", "frontend", "run", "test:e2e"]);
  process.stdout.write(
    "All required checks passed: builds, lint, rules, API, PostgreSQL concurrency, browser workflows.\n",
  );
} catch (error) {
  reportFailure(error);
} finally {
  try {
    await run("docker", [...compose, "down", "--volumes", "--remove-orphans"]);
  } catch (error) {
    reportFailure(error);
  }
}
