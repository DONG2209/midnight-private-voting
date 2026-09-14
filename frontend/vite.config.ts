import { defineConfig } from 'vite';
import topLevelAwait from 'vite-plugin-top-level-await';
import wasm from 'vite-plugin-wasm';

// `@midnight-ntwrk/compact-runtime` depends on a wasm-bindgen module
// (`@midnightntwrk/onchain-runtime-v4`) built with the "ESM integration for
// Wasm" proposal, which Rollup/Vite don't parse natively yet. These two
// plugins are the standard fix: `vite-plugin-wasm` teaches Vite/Rollup to
// load `.wasm` as an ES module, and `vite-plugin-top-level-await` supports
// the top-level `await` its instantiation glue code uses.
export default defineConfig({
  plugins: [wasm(), topLevelAwait()],
  // Relative asset URLs, so the build works when hosted under any subpath
  // (a GitHub Pages project site, a preview URL, etc.), not just at a
  // domain's root.
  base: './',
  server: { port: 5173 },
  build: { target: 'esnext' },
});
