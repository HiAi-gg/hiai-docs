import adapter from "@sveltejs/adapter-node";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import { fileURLToPath } from "node:url";

const hiaiUiDist = fileURLToPath(
  new URL("./node_modules/@hiai-gg/hiai-ui/dist", import.meta.url),
);

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: [vitePreprocess()],
  kit: {
    adapter: adapter(),
    // The framework-neutral VitePWA plugin owns the only worker build and
    // hooks.client.ts owns the only registration at `/sw.js`.
    serviceWorker: {
      register: false,
    },
    // All browser API mutations go through our same-origin `/api` proxy and
    // are protected by the backend's signed CSRF token middleware. Keeping
    // SvelteKit's independent origin check enabled here makes multipart
    // imports fail before they reach that middleware whenever adapter-node is
    // deployed behind a port-mapping or reverse proxy (the internal request
    // origin then differs from the public browser origin). Disable only the
    // duplicate framework check; the backend remains the CSRF authority.
    csrf: {
      trustedOrigins: ["*"],
    },
    // hiai-ui@0.0.8 exposes component directories through a wildcard export,
    // but TypeScript cannot resolve directory indexes from that map. Keep the
    // compatibility alias in SvelteKit (the canonical alias surface) rather
    // than overriding generated paths in tsconfig.json.
    alias: {
      "@hiai-gg/hiai-ui": `${hiaiUiDist}/index.js`,
      "@hiai-gg/hiai-ui/*": `${hiaiUiDist}/*`,
    },
  },
};

export default config;
