import { access, copyFile } from "node:fs/promises";
import { constants } from "node:fs";
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
    await copyFile(
      resolve(root, ".env.example"),
      envFile,
      constants.COPYFILE_EXCL,
    );
    process.stdout.write(
      "Created .env with fictional local development settings.\n",
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
