import { createReadStream, cpSync, existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'

/**
 * Optional camera support (src/camera/) imports the camera application in place from
 * ../CAMERA/web — it is never copied into this repository. Override the location with
 * MEMORIA_CAMERA_WEB if the two projects are not side by side.
 */
const here = path.dirname(fileURLToPath(import.meta.url))
const CAMERA_WEB = path.resolve(here, process.env.MEMORIA_CAMERA_WEB ?? '../CAMERA/web')
const CAMERA_PUBLIC = path.join(CAMERA_WEB, 'public')

/** The MediaPipe runtime and face model, as the camera app's `npm run setup:assets` placed them. */
const CAMERA_ASSETS: Record<string, string> = {
  'mediapipe/wasm/': path.join(CAMERA_PUBLIC, 'mediapipe', 'wasm'),
  'models/face_landmarker.task': path.join(CAMERA_PUBLIC, 'models', 'face_landmarker.task')
}
const TYPES: Record<string, string> = { '.wasm': 'application/wasm', '.js': 'text/javascript', '.task': 'application/octet-stream' }

/**
 * Serves those two paths from the camera app in `vite dev`, so they are fetched only when
 * a person turns the camera on. A build copies them into dist/ only when asked
 * (MEMORIA_CAMERA_ASSETS=1): they are ~38 MB, and a deploy without camera support needs none.
 */
function cameraAssets(): Plugin {
  const resolveAsset = (urlPath: string): string | null => {
    const rel = decodeURIComponent(urlPath.split('?')[0]).replace(/^\/+/, '')
    for (const [prefix, target] of Object.entries(CAMERA_ASSETS)) {
      if (prefix.endsWith('/') ? rel.startsWith(prefix) : rel === prefix) {
        const file = prefix.endsWith('/') ? path.resolve(target, rel.slice(prefix.length)) : target
        // Only files directly inside the asset directory — no traversal.
        if (prefix.endsWith('/') && path.dirname(file) !== target) return null
        return existsSync(file) && statSync(file).isFile() ? file : null
      }
    }
    return null
  }
  return {
    name: 'memoria-camera-assets',
    configureServer(server) {
      if (!existsSync(CAMERA_ASSETS['models/face_landmarker.task'])) {
        server.config.logger.warn(
          `[camera] face model not found in ${CAMERA_PUBLIC} — run \`npm run setup:assets\` in CAMERA/web ` +
            'to use camera support. The game itself is unaffected.'
        )
      }
      server.middlewares.use((req, res, next) => {
        const file = req.url ? resolveAsset(req.url) : null
        if (!file) return next()
        res.setHeader('Content-Type', TYPES[path.extname(file)] ?? 'application/octet-stream')
        res.setHeader('Cache-Control', 'no-cache')
        createReadStream(file).pipe(res)
      })
    },
    writeBundle(options) {
      if (process.env.MEMORIA_CAMERA_ASSETS !== '1') return
      const out = options.dir ?? path.join(here, 'dist')
      for (const [prefix, source] of Object.entries(CAMERA_ASSETS)) {
        if (!existsSync(source)) {
          this.warn(`camera asset missing, not copied: ${source}`)
          continue
        }
        cpSync(source, path.join(out, prefix), { recursive: true })
      }
    }
  }
}

export default defineConfig({
  base: './',
  build: { target: 'es2022', sourcemap: false },
  // The camera app's vision worker is an ES module: MediaPipe's WASM loader is imported
  // from inside it.
  worker: { format: 'es' },
  server: {
    // Serve this project plus the camera app's sources (and their node_modules, for
    // @mediapipe/tasks-vision). Nothing else outside this folder.
    fs: { allow: [here, CAMERA_WEB] }
  },
  plugins: [cameraAssets()]
})
