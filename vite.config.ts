import vinext from "vinext";
import {cloudflare} from "@cloudflare/vite-plugin";
import {defineConfig} from "vite";

export default defineConfig({
  plugins: [
    vinext(),
    cloudflare({
      viteEnvironment: {name: "rsc", childEnvironments: ["ssr"]},
      inspectorPort: false,
      config: {
        main: "vinext/server/fetch-handler",
        compatibility_date: "2026-05-15",
        compatibility_flags: ["nodejs_compat"],
        d1_databases: [
          {
            binding: "DB",
            database_name: "arranjos-produtivos-db",
            database_id: "d1838f2f-c289-488f-a11e-eb98aae40325",
          },
        ],
        kv_namespaces: [
          {
            binding: "BUCKET",
            id: "5d783cee280041479384c63c53b7c7ea",
          },
        ],
      },
    }),
  ],
});
