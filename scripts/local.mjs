import { access, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { root, run, reportFailure } from "./process.mjs";

try {
  if (process.argv.slice(2).some((value) => value !== "--seed"))
    throw new Error("Usage: npm run dev [-- --seed]");
  const envFile = resolve(root, process.env.COMPOSE_ENV_FILE ?? ".env");
  try {
    await access(envFile);
  } catch {
    // Only initialize the default local configuration. Never overwrite an env file.
    if (process.env.COMPOSE_ENV_FILE)
      throw new Error("COMPOSE_ENV_FILE does not exist");
    await writeFile(
      envFile,
      `POSTGRES_PASSWORD=${randomBytes(32).toString("hex")}\n`,
      { flag: "wx", mode: 0o600 },
    );
    process.stdout.write(
      "Created private .env with a random local database password.\n",
    );
  }
  const compose = [
    "compose",
    "--env-file",
    envFile,
    "-f",
    "docker-compose.yml",
  ];
  await run("docker", [
    ...compose,
    "up",
    "--build",
    "--wait",
    "--wait-timeout",
    "180",
  ]);
  if (process.argv.includes("--seed"))
    await run("docker", [
      ...compose,
      "exec",
      "-T",
      "backend",
      "npm",
      "run",
      "prisma:seed",
    ]);
  process.stdout.write(
    "Clinic is ready. Default UI: http://localhost:8080; API docs: http://localhost:3000/docs\n",
  );
} catch (error) {
  reportFailure(error);
}
