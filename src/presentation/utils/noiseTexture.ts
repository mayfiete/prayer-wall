/** Global cache: seed → PNG data URL. Each unique seed is generated once. */
const cache = new Map<number, string>()

function hash(x: number, y: number, seed: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + seed) >>> 0
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0
  return (h ^ (h >>> 16)) / 4294967296
}

function smooth(t: number) {
  return t * t * (3 - 2 * t)
}

function valueNoise(px: number, py: number, seed: number): number {
  const ix = Math.floor(px)
  const iy = Math.floor(py)
  const sx = smooth(px - ix)
  const sy = smooth(py - iy)
  return (
    hash(ix,     iy,     seed) * (1 - sx) * (1 - sy) +
    hash(ix + 1, iy,     seed) * sx       * (1 - sy) +
    hash(ix,     iy + 1, seed) * (1 - sx) * sy       +
    hash(ix + 1, iy + 1, seed) * sx       * sy
  )
}

/** Fractal Brownian Motion — sums noise across multiple octaves. */
function fbm(px: number, py: number, seed: number, octaves = 5): number {
  let v = 0
  let amp = 0.5
  let freq = 1
  for (let i = 0; i < octaves; i++) {
    v += valueNoise(px * freq, py * freq, seed + i * 113) * amp
    amp *= 0.5
    freq *= 2
  }
  return v
}

/**
 * Returns a PNG data URL of a grayscale FBM noise tile.
 * Results are cached globally — each seed is only ever computed once.
 */
export function generateNoiseTexture(seed: number, size = 64): string {
  const cached = cache.get(seed)
  if (cached) return cached

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(size, size)

  const scale = 4 / size

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = Math.round(fbm(x * scale, y * scale, seed) * 255)
      const i = (y * size + x) * 4
      img.data[i]     = v
      img.data[i + 1] = v
      img.data[i + 2] = v
      img.data[i + 3] = 255
    }
  }

  ctx.putImageData(img, 0, 0)
  const url = canvas.toDataURL('image/png')
  cache.set(seed, url)
  return url
}
