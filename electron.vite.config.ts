import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

// CSP injectée uniquement dans le build de production : en dev, le préambule
// de React Fast Refresh est un script inline qu'une CSP stricte bloquerait.
const csp = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:"
].join('; ')

const injectCsp = {
  name: 'inject-csp',
  apply: 'build' as const,
  transformIndexHtml: (html: string): string =>
    html.replace('<!--csp-->', `<meta http-equiv="Content-Security-Policy" content="${csp}" />`)
}

export default defineConfig({
  // Mode live (dev) : la lib reste hors du bundle, chargée à la demande par src/main/live.ts.
  main: { build: { rollupOptions: { external: ['tiktok-live-connector'] } } },
  preload: {},
  renderer: {
    resolve: {
      alias: { '@renderer': resolve('src/renderer/src') }
    },
    plugins: [react(), injectCsp]
  }
})
