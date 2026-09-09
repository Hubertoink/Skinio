import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [
    react(),
    {
      name: "dev-refresh-csp",
      apply: "serve",
      // React Fast Refresh injects a local inline preamble in development only.
      // Packaged builds keep the strict script-src 'self' policy from index.html.
      transformIndexHtml(html) {
        return html.replace(
          "script-src 'self';",
          "script-src 'self' 'unsafe-inline';",
        );
      },
    },
  ],
  base: "./",
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
});
