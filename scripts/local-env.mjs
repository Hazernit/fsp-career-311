import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const toolDirectory = resolve(projectRoot, ".wrangler");
const defaults = {
  CLOUDFLARE_CF_FETCH_ENABLED: "false",
  WRANGLER_SEND_METRICS: "false",
  WRANGLER_WRITE_LOGS: "false",
  WRANGLER_LOG_PATH: resolve(toolDirectory, "logs"),
  WRANGLER_REGISTRY_PATH: resolve(toolDirectory, "dev-registry"),
  MINIFLARE_REGISTRY_PATH: resolve(toolDirectory, "registry"),
};

for (const [key, value] of Object.entries(defaults)) {
  process.env[key] ||= value;
}
for (const key of ["WRANGLER_LOG_PATH", "WRANGLER_REGISTRY_PATH", "MINIFLARE_REGISTRY_PATH"]) {
  mkdirSync(process.env[key], { recursive: true });
}
process.chdir(projectRoot);
