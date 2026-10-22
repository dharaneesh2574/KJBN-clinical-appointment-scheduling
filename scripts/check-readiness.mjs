import { run } from "./process.mjs";

export async function checkReadiness(compose) {
  const check = async (expected) => {
    // Runs inside the isolated API container. No host ports or clinic data.
    const script = `
      const live = await fetch('http://127.0.0.1:3000/health/live');
      const ready = await fetch('http://127.0.0.1:3000/health/ready');
      const body = await ready.json();
      if (live.status !== 200 || ready.status !== ${expected}) throw new Error('Health status mismatch');
      if (ready.status === 503 && (body.code !== 'DATABASE_UNAVAILABLE' || typeof body.requestId !== 'string')) throw new Error('Unsafe readiness response');
      console.log('Liveness 200; readiness ' + ready.status);
    `;
    await run("docker", [
      ...compose,
      "exec",
      "-T",
      "api",
      "node",
      "--input-type=module",
      "-e",
      script,
    ]);
  };
  await run("docker", [
    ...compose,
    "up",
    "--build",
    "--wait",
    "--wait-timeout",
    "120",
    "api",
  ]);
  await check(200);
  // Re-running hosted startup must preserve the fictional catalog.
  await run("docker", [...compose, "restart", "api"]);
  await run("docker", [
    ...compose,
    "up",
    "--no-recreate",
    "--wait",
    "--wait-timeout",
    "120",
    "api",
  ]);
  await check(200);
  try {
    await run("docker", [...compose, "stop", "db"]);
    await check(503);
  } finally {
    await run("docker", [
      ...compose,
      "up",
      "--wait",
      "--wait-timeout",
      "90",
      "db",
    ]);
  }
  // The test DB is tmpfs: stopping it discards its schema. Hosted startup
  // must restore committed migrations before readiness can recover.
  await run("docker", [...compose, "restart", "api"]);
  await run("docker", [
    ...compose,
    "up",
    "--no-recreate",
    "--wait",
    "--wait-timeout",
    "120",
    "api",
  ]);
  await check(200);
}
