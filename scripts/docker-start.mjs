import { spawn, spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import './local-env.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const migrations = spawnSync(process.execPath, [resolve(root, 'scripts/local-db.mjs')], { stdio: 'inherit', cwd: root, env: process.env });
if (migrations.status !== 0) process.exit(migrations.status ?? 1);
const child = spawn(process.execPath, [resolve(root, 'node_modules/wrangler/bin/wrangler.js'), 'dev', '--config', resolve(root, 'dist/server/local.wrangler.json'), '--local', '--persist-to', process.env.FSP_DATA_DIR || '/data', '--ip', '0.0.0.0', '--port', '8080', '--inspector-port', '0', '--var', `DEMO_MODE:${process.env.DEMO_MODE || 'true'}`], {
  cwd: root, stdio: 'inherit', env: { ...process.env, WRANGLER_SEND_METRICS: 'false', CLOUDFLARE_CF_FETCH_ENABLED: 'false', WRANGLER_LOG_PATH: resolve(root, '.wrangler/logs') },
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code) => process.exit(code ?? 1));
