import { loadEnvConfig } from '@next/env';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

loadEnvConfig(process.cwd(), true);

// Each simulator/device uses a different hostname for the same local service.
// A fixed Auth.js URL would redirect Android/LAN clients to their own localhost.
const child = spawn(process.execPath, [
  resolve('node_modules/next/dist/bin/next'), 'dev', '-H', '0.0.0.0', '-p', '3000',
], {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'development', AUTH_URL: '', NEXTAUTH_URL: '' },
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => child.kill(signal));
}
child.on('error', (error) => {
  console.error(`Local mobile Web server could not start: ${error.message}`);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 0;
});
