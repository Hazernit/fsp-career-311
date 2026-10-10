import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import './local-env.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const configPath = resolve(root, 'dist/server/wrangler.json');
const config = JSON.parse(readFileSync(configPath, 'utf8'));
for (const binding of config.d1_databases ?? []) binding.migrations_dir = resolve(root, 'drizzle');
const runtimeConfig = resolve(root, 'dist/server/local.wrangler.json');
writeFileSync(runtimeConfig, JSON.stringify(config, null, 2));
const state = process.env.FSP_DATA_DIR || resolve(root, '.wrangler/state');
const cli = resolve(root, 'node_modules/wrangler/bin/wrangler.js');
const result = spawnSync(process.execPath, [cli, 'd1', 'migrations', 'apply', 'DB', '--local', '--config', runtimeConfig, '--persist-to', state], {
  cwd: root, stdio: ['ignore', 'inherit', 'inherit'], env: { ...process.env, WRANGLER_SEND_METRICS: 'false', CLOUDFLARE_CF_FETCH_ENABLED: 'false', WRANGLER_LOG_PATH: resolve(root, '.wrangler/logs') },
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
