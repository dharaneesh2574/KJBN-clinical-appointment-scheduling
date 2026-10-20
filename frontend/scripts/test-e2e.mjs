import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
const frontend = fileURLToPath(new URL("../", import.meta.url));
const compose = [
  "compose",
  "--project-name",
  "kjbn-clinic-ui-tests",
  "-f",
  "../docker-compose.ui-test.yml",
];
function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: frontend, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code, signal) =>
      code === 0
        ? resolve()
        : reject(new Error(`${command} exited ${code ?? signal}`)),
    );
  });
}
try {
  await run("docker", [
    ...compose,
    "up",
    "--build",
    "--wait",
    "--wait-timeout",
    "120",
    "api",
  ]);
  await run(process.execPath, [
    "node_modules/@playwright/test/cli.js",
    "test",
    ...process.argv.slice(2),
  ]);
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : "UI tests failed"}\n`,
  );
  process.exitCode = 1;
} finally {
  try {
    await run("docker", [...compose, "down", "--volumes"]);
  } catch {
    process.stderr.write(
      "Could not stop the isolated UI-test stack. Run docker compose --project-name kjbn-clinic-ui-tests -f docker-compose.ui-test.yml down --volumes from the repository root.\n",
    );
    process.exitCode = 1;
  }
}
