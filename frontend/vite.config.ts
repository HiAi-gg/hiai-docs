import { sveltekit } from "@sveltejs/kit/vite";
import { paraglide } from "@inlang/paraglide-sveltekit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    tailwindcss(),
    paraglide({
      project: "./project.inlang",
      outdir: "./src/lib/paraglide",
    }),
    sveltekit(),
  ],
  server: {
    port: 50701,
    host: true,
    // strictPort: vite's default silently picks the next free port,
    // which would leave http://localhost:50701 serving the stale
    // build (held by a previous container) while the new server
    // runs on 5173. Fail loudly instead.
    strictPort: true,
  },
});
