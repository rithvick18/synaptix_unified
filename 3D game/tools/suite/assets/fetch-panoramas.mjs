#!/usr/bin/env node
/**
 * Vendors a 360° photograph for a photo room (src/suite/environments/shells/photo.ts) into
 * public/suite/assets/panoramas/. Run once by a developer; the app never downloads a
 * panorama at runtime.
 *
 *   node tools/suite/assets/fetch-panoramas.mjs <polyhaven-id> [--name=<name>] [--width=3840]
 *   node tools/suite/assets/fetch-panoramas.mjs --hdr=<file.hdr> [--display=<file.jpg|png|webp>]
 *        --name=<name> --title="<title>" --author="<name>[, <name>]" --license=<SPDX id>
 *        --url=<source page> [--exposure=<stops>] [--width=3840]
 *
 * Every panorama becomes two files:
 *   <name>.webp     the backdrop the room is drawn on: an already tone-mapped equirectangular
 *                   image, <width> × <width>/2. The default 3840 × 1920 is seen at about one
 *                   texel per screen pixel at a 70° field of view on an 800 px tall view, and
 *                   is 28 MB on the GPU without mipmaps (it needs none at that scale), which
 *                   leaves about 18 MB of the suite's 48 MB for the objects
 *   <name>_1k.hdr   the light the objects are lit by: the same place in linear radiance,
 *                   1024 × 512, prefiltered at runtime (PMREM) into the scene's environment
 *
 * From Poly Haven it takes the 1k .hdr and the full-size tonemapped JPG, as published.
 * From a local file (a panorama from another site, with its licence given on the command
 * line) it needs a Radiance .hdr of any size, which is resized to 1k; the backdrop is the
 * given `--display` image, or else the .hdr itself tone-mapped with the renderer's own ACES
 * curve (so objects and photograph share one tone curve) at `--exposure` stops, or at an
 * automatic exposure that puts the image's log-average at mid grey. OpenEXR is not read:
 * convert it to .hdr first.
 *
 * Provenance goes to panoramas/sources.json; list the files in ATTRIBUTION.md by hand.
 * Needs `cwebp` and python3 with Pillow and NumPy.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const OUT = path.join(ROOT, 'public', 'suite', 'assets', 'panoramas')
const LIGHTING_WIDTH = 1024

/**
 * Image work, in Python because Pillow and NumPy are there: resizing an 8k–16k JPEG (with
 * the decoder's own DCT downscaling first, so it never holds the full image), and reading,
 * resizing, tone-mapping and writing Radiance RGBE files.
 */
const PY = String.raw`
import sys, json, numpy as np
from PIL import Image
Image.MAX_IMAGE_PIXELS = None

def read_hdr(path):
    data = open(path, 'rb').read()
    pos = 0
    while True:
        end = data.index(b'\n', pos)
        line = data[pos:end].strip(); pos = end + 1
        if line.startswith(b'-Y') or line.startswith(b'+Y'):
            parts = line.split()
            if parts[0] != b'-Y' or parts[2] != b'+X': raise SystemExit('only -Y h +X w .hdr files are supported')
            h, w = int(parts[1]), int(parts[3]); break
    out = np.zeros((h, w, 4), np.uint8)
    buf = np.frombuffer(data, np.uint8, offset=pos)
    i = 0
    for y in range(h):
        if w >= 8 and w < 32768 and buf[i] == 2 and buf[i + 1] == 2 and not (buf[i + 2] & 0x80):
            i += 4
            for c in range(4):
                x = 0
                while x < w:
                    n = int(buf[i]); i += 1
                    if n > 128:
                        n -= 128; out[y, x:x + n, c] = buf[i]; i += 1
                    else:
                        out[y, x:x + n, c] = buf[i:i + n]; i += n
                    x += n
        else:
            out[y] = buf[i:i + w * 4].reshape(w, 4); i += w * 4
    e = out[..., 3].astype(np.int32)
    scale = np.where(e > 0, np.ldexp(1.0, e - 136), 0.0)
    return out[..., :3].astype(np.float32) * scale[..., None].astype(np.float32)

def write_hdr(path, rgb):
    h, w, _ = rgb.shape
    m = rgb.max(axis=2)
    mant, ex = np.frexp(m)
    scale = np.where(m > 1e-32, mant * 256.0 / np.maximum(m, 1e-32), 0.0)
    rgbe = np.zeros((h, w, 4), np.uint8)
    rgbe[..., :3] = np.clip(rgb * scale[..., None], 0, 255).astype(np.uint8)
    rgbe[..., 3] = np.where(m > 1e-32, ex + 128, 0).astype(np.uint8)
    with open(path, 'wb') as f:
        f.write(b'#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y %d +X %d\n' % (h, w))
        for y in range(h):
            f.write(bytes([2, 2, w >> 8, w & 255]))
            for c in range(4):
                row = rgbe[y, :, c]; x = 0; lit = bytearray()
                def flush():
                    while lit:
                        chunk = lit[:128]; f.write(bytes([len(chunk)]) + bytes(chunk)); del lit[:128]
                while x < w:
                    run = 1
                    while x + run < w and run < 127 and row[x + run] == row[x]: run += 1
                    if run >= 4:
                        flush(); f.write(bytes([128 + run, int(row[x])])); x += run
                    else:
                        lit.append(int(row[x])); x += 1
                flush()

def resize_float(rgb, w, h):
    chans = [np.asarray(Image.fromarray(np.ascontiguousarray(rgb[..., c], np.float32)).resize((w, h), Image.BOX)) for c in range(3)]
    return np.stack(chans, axis=2)

def aces(x):
    # three.js ACESFilmicToneMapping (src/renderers/shaders/ShaderChunk/tonemapping_pars_fragment)
    inp = np.array([[0.59719, 0.35458, 0.04823], [0.07600, 0.90834, 0.01566], [0.02840, 0.13383, 0.83777]], np.float32)
    outp = np.array([[1.60475, -0.53108, -0.07367], [-0.10208, 1.10813, -0.00605], [-0.00327, -0.07276, 1.07602]], np.float32)
    v = (x / 0.6) @ inp.T
    v = (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.4329510) + 0.238081)
    return np.clip(v @ outp.T, 0, 1)

def srgb(x):
    return np.where(x <= 0.0031308, x * 12.92, 1.055 * np.power(np.maximum(x, 0), 1 / 2.4) - 0.055)

cmd = sys.argv[1]
if cmd == 'display':
    src, dst, w = sys.argv[2], sys.argv[3], int(sys.argv[4])
    im = Image.open(src)
    if abs(im.size[0] / im.size[1] - 2) > 0.01: raise SystemExit(f'{src}: {im.size[0]}×{im.size[1]} is not a 2:1 equirectangular image')
    im.draft('RGB', (w, w // 2))
    im.convert('RGB').resize((w, w // 2), Image.LANCZOS).save(dst)
    print(json.dumps({'source': list(Image.open(src).size)}))
elif cmd == 'lighting':
    src, dst = sys.argv[2], sys.argv[3]
    rgb = read_hdr(src)
    h, w, _ = rgb.shape
    if abs(w / h - 2) > 0.01: raise SystemExit(f'{src}: {w}×{h} is not a 2:1 equirectangular image')
    write_hdr(dst, rgb if w == ${LIGHTING_WIDTH} else resize_float(rgb, ${LIGHTING_WIDTH}, ${LIGHTING_WIDTH / 2}))
    print(json.dumps({'source': [w, h]}))
elif cmd == 'tonemap':
    src, dst, w, stops = sys.argv[2], sys.argv[3], int(sys.argv[4]), sys.argv[5]
    rgb = read_hdr(src)
    small = resize_float(rgb, w, w // 2)
    lum = 0.2126 * small[..., 0] + 0.7152 * small[..., 1] + 0.0722 * small[..., 2]
    auto = 0.18 / float(np.exp(np.mean(np.log(np.maximum(lum, 1e-6)))))
    exposure = auto if stops == 'auto' else 2.0 ** float(stops)
    out = (srgb(aces(small * exposure)) * 255 + 0.5).astype(np.uint8)
    Image.fromarray(out).save(dst)
    print(json.dumps({'exposure': exposure, 'stops': float(np.log2(exposure))}))
`

function py(...args) {
  return JSON.parse(execFileSync('python3', ['-c', PY, ...args], { stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 1 << 24 }).toString().trim().split('\n').pop())
}

async function download(url, file) {
  const response = await fetch(url, { headers: { 'User-Agent': 'memoria-suite-assets' } })
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`)
  writeFileSync(file, Buffer.from(await response.arrayBuffer()))
}

function webp(png, file, quality) {
  // -sharp_yuv keeps thin lines (picture rails, window bars) from bleeding colour.
  execFileSync('cwebp', ['-quiet', '-q', String(quality), '-m', '6', '-sharp_yuv', png, '-o', file])
}

function parseArgs(argv) {
  const flags = {}
  const rest = []
  for (const a of argv) {
    if (a.startsWith('--')) {
      const [k, ...v] = a.slice(2).split('=')
      flags[k] = v.length ? v.join('=') : 'true'
    } else rest.push(a)
  }
  return { flags, rest }
}

async function main() {
  const { flags, rest } = parseArgs(process.argv.slice(2))
  const width = Number(flags.width ?? 3840)
  if (!(width >= 1024 && width <= 8192 && width % 2 === 0)) throw new Error('--width must be an even number from 1024 to 8192')
  const quality = Number(flags.quality ?? 82)
  const today = new Date().toISOString().slice(0, 10)
  mkdirSync(OUT, { recursive: true })
  const tmp = mkdtempSync(path.join(tmpdir(), 'suite-pano-'))
  try {
    let entry
    const polyhaven = rest[0]
    if (polyhaven) {
      const name = flags.name ?? polyhaven.replace(/_/g, '-')
      const info = await (await fetch(`https://api.polyhaven.com/info/${polyhaven}`)).json()
      if (info.type !== 0) throw new Error(`${polyhaven} is not a Poly Haven HDRI`)
      const files = await (await fetch(`https://api.polyhaven.com/files/${polyhaven}`)).json()
      const hdrUrl = files.hdri['1k'].hdr.url
      const jpgUrl = files.tonemapped?.url
      if (!jpgUrl) throw new Error(`${polyhaven} has no tonemapped JPG`)
      const hdr = path.join(tmp, 'lighting.hdr'), jpg = path.join(tmp, 'display.jpg'), png = path.join(tmp, 'display.png')
      await download(hdrUrl, hdr)
      await download(jpgUrl, jpg)
      const shown = py('display', jpg, png, String(width))
      webp(png, path.join(OUT, `${name}.webp`), quality)
      const lit = py('lighting', hdr, path.join(OUT, `${name}_1k.hdr`))
      entry = {
        name,
        source: `polyhaven:${polyhaven}`,
        title: info.name,
        authors: Object.keys(info.authors ?? {}),
        license: 'CC0-1.0',
        page: `https://polyhaven.com/a/${polyhaven}`,
        taken: info.date_taken ? new Date(info.date_taken * 1000).toISOString().slice(0, 10) : undefined,
        retrieved: today,
        downloads: { display: jpgUrl, lighting: hdrUrl },
        modified: `tonemapped JPG (${shown.source.join('×')}) resized to ${width}×${width / 2} and re-encoded to WebP (cwebp -q ${quality}); 1k .hdr ${lit.source[0] === LIGHTING_WIDTH ? 'unchanged' : 'resized to 1024×512'}`
      }
    } else {
      for (const need of ['hdr', 'name', 'title', 'author', 'license', 'url']) {
        if (!flags[need]) throw new Error(`a local panorama needs --${need}=… (see the comment at the top of this file)`)
      }
      if (!/^[a-z0-9-]+$/.test(flags.name)) throw new Error('--name must be lower-case letters, digits and hyphens')
      const name = flags.name
      const png = path.join(tmp, 'display.png')
      let how
      if (flags.display) {
        const shown = py('display', path.resolve(flags.display), png, String(width))
        how = `given display image (${shown.source.join('×')}) resized to ${width}×${width / 2} and re-encoded to WebP (cwebp -q ${quality})`
      } else {
        const toned = py('tonemap', path.resolve(flags.hdr), png, String(width), flags.exposure ?? 'auto')
        how = `.hdr tone-mapped with three.js ACES at ${toned.stops.toFixed(2)} stops, ${width}×${width / 2}, WebP (cwebp -q ${quality})`
      }
      webp(png, path.join(OUT, `${name}.webp`), quality)
      const lit = py('lighting', path.resolve(flags.hdr), path.join(OUT, `${name}_1k.hdr`))
      entry = {
        name,
        source: `file:${path.basename(flags.hdr)}`,
        title: flags.title,
        authors: flags.author.split(',').map((s) => s.trim()).filter(Boolean),
        license: flags.license,
        page: flags.url,
        retrieved: today,
        modified: `${how}; .hdr (${lit.source.join('×')}) ${lit.source[0] === LIGHTING_WIDTH ? 'unchanged' : 'resized to 1024×512'}`
      }
    }
    const display = path.join(OUT, `${entry.name}.webp`), lighting = path.join(OUT, `${entry.name}_1k.hdr`)
    entry.files = {
      display: { file: `panoramas/${entry.name}.webp`, px: [width, width / 2], bytes: statSync(display).size },
      lighting: { file: `panoramas/${entry.name}_1k.hdr`, px: [LIGHTING_WIDTH, LIGHTING_WIDTH / 2], bytes: statSync(lighting).size }
    }
    const sourcesFile = path.join(OUT, 'sources.json')
    const previous = existsSync(sourcesFile) ? JSON.parse(readFileSync(sourcesFile, 'utf8')).panoramas : []
    const panoramas = [...previous.filter((p) => p.name !== entry.name), entry].sort((a, b) => a.name.localeCompare(b.name))
    writeFileSync(sourcesFile, JSON.stringify({ panoramas }, null, 2) + '\n')
    console.log(`  ${entry.name}: ${entry.files.display.file} ${(entry.files.display.bytes / 1024).toFixed(0)} KB, ${entry.files.lighting.file} ${(entry.files.lighting.bytes / 1024).toFixed(0)} KB`)
    console.log(`  add both files to public/suite/assets/ATTRIBUTION.md (${entry.title}, ${entry.authors.join(', ')}, ${entry.license}, ${entry.page})`)
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

if (!existsSync(path.join(ROOT, 'package.json'))) throw new Error('run from the 3D game project')
await main()
