import path from 'node:path'
import { defineConfig } from 'vite'
import { arrow } from '@arrow-js/vite-plugin-arrow'

const clientInputs = {
  app: path.resolve(__dirname, 'index.html'),
  benchmarks: path.resolve(__dirname, 'benchmarks/index.html'),
  benchmarks_creating: path.resolve(__dirname, 'benchmarks/creating.html'),
  benchmarks_textNodes: path.resolve(__dirname, 'benchmarks/textNodes.html'),
  demos_calculator: path.resolve(__dirname, 'demos/calculator.html'),
  demos_carousel: path.resolve(__dirname, 'demos/carousel.html'),
  demos_component_stability: path.resolve(
    __dirname,
    'demos/component-stability.html'
  ),
  demos_dropdowns: path.resolve(__dirname, 'demos/dropdowns.html'),
  demos_fast_text: path.resolve(__dirname, 'demos/fast-text.html'),
  demos_tabs: path.resolve(__dirname, 'demos/tabs.html'),
  play: path.resolve(__dirname, 'play/index.html'),
  play_preview: path.resolve(__dirname, 'play/preview.html'),
}

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [arrow()],
  server: {
    host: '127.0.0.1',
    port: 4173,
  },
  build: {
    outDir: isSsrBuild ? 'dist/server' : 'dist/client',
    emptyOutDir: !isSsrBuild,
    rollupOptions: {
      input: isSsrBuild
        ? path.resolve(__dirname, 'src/entry-server.js')
        : clientInputs,
      output: isSsrBuild
        ? {
            entryFileNames: 'entry-server.js',
          }
        : undefined,
    },
  },
}))
