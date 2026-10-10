import vinext from "vinext";
import { defineConfig } from "vite";
import "./scripts/local-env.mjs";

const localBindingConfig = {
  main: "./build/worker.ts",
  compatibility_flags: ["nodejs_compat"],
  d1_databases: [
    {
      binding: "DB",
      // Preserve the existing local database identity and persisted user data.
      database_name: "site-creator-d1",
      database_id: "00000000-0000-4000-8000-000000000000",
    },
  ],
};

export default defineConfig(async () => {
  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: process.platform === "darwin"
      ? { watch: { useFsEvents: false, usePolling: true } }
      : {},
    plugins: [
      vinext(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
        config: localBindingConfig,
      }),
    ],
  };
});
