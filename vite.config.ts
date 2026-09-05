import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { offlinePlugin } from "./scripts/offline-plugin.ts";

export default defineConfig({
  plugins: [react(), tailwindcss(), offlinePlugin()],
});
