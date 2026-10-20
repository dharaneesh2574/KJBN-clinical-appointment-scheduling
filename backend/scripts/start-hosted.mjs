import { spawn } from 'node:child_process';

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code) =>
      code === 0 ? resolve() : reject(new Error('Startup step failed')),
    );
  });
}

try {
  const seed = process.env.SEED_DEMO_DATA ?? 'false';
  if (!['true', 'false'].includes(seed))
    throw new Error('Invalid seed setting');
  if (!process.env.DATABASE_URL) throw new Error('Missing database setting');
  // Free hosting has no pre-deploy job. Apply committed migrations before serving.
  // A failed migration or explicit seed stops startup; never use db push/reset.
  await run('npm', ['run', 'prisma:deploy']);
  if (seed === 'true') await run('npm', ['run', 'prisma:seed']);
  const server = spawn(process.execPath, ['dist/main.js'], {
    stdio: 'inherit',
  });
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.on(signal, () => server.kill(signal));
  server.once('error', () => {
    process.stderr.write('API process failed to start.\n');
    process.exitCode = 1;
  });
  server.once('exit', (code, signal) => {
    process.exitCode =
      code ?? (signal === 'SIGTERM' || signal === 'SIGINT' ? 0 : 1);
  });
} catch {
  process.stderr.write(
    'Hosted startup failed. Check configuration, migrations and seed conflicts.\n',
  );
  process.exitCode = 1;
}
