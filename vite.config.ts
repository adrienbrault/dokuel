import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { serviceWorkerPlugin } from "./scripts/vite-sw-plugin.ts";

export default defineConfig({
  plugins: [react(), tailwindcss(), serviceWorkerPlugin()],
});
