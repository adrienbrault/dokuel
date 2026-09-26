import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { webAnalyticsTags } from "./src/lib/web-analytics.ts";

/**
 * Cloudflare Web Analytics beacon, injected only when the build has
 * VITE_CF_BEACON_TOKEN (set in the Cloudflare Pages project settings).
 */
function webAnalytics(token: string | undefined): Plugin {
  return {
    name: "dokuel-web-analytics",
    transformIndexHtml: () => webAnalyticsTags(token),
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  return {
    plugins: [react(), tailwindcss(), webAnalytics(env.VITE_CF_BEACON_TOKEN)],
  };
});
