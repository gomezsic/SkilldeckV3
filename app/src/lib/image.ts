/** Foto dei documenti: si rimpiccioliscono e si alleggeriscono nel browser prima di caricarle. I PDF passano così come sono. */
const MAX_SIDE = 1600
const TARGET_BYTES = 600 * 1024

function load(src: Blob | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image(); const url = typeof src === 'string' ? src : URL.createObjectURL(src)
    img.onload = () => { if (typeof src !== 'string') URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { if (typeof src !== 'string') URL.revokeObjectURL(url); reject(new Error('Non riusciamo a leggere questa immagine: prova con un\'altra foto.')) }
    img.src = url
  })
}
async function toJpeg(canvas: HTMLCanvasElement, name: string): Promise<File> {
  let quality = 0.82; let blob: Blob | null = null
  for (let i = 0; i < 6; i++) {
    blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', quality))
    if (blob && blob.size <= TARGET_BYTES) break
    quality -= 0.1
    if (quality < 0.3) break
  }
  canvas.width = 0; canvas.height = 0 // libera memoria, importante sui telefoni
  if (!blob) throw new Error('Non siamo riusciti a preparare la foto: riprova.')
  return new File([blob], `${name.replace(/\.[^.]+$/, '')}.jpg`, { type: 'image/jpeg', lastModified: Date.now() })
}

/** Alleggerisce una foto. Se non è un'immagine o è già leggera, la restituisce com'è. */
export async function lighten(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.size <= TARGET_BYTES) return file
  try {
    const img = await load(file)
    const ratio = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * ratio); canvas.height = Math.round(img.naturalHeight * ratio)
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
    const out = await toJpeg(canvas, file.name)
    return out.size < file.size ? out : file
  } catch { return file }
}

export interface Area { x: number; y: number; width: number; height: number }
/** Ritaglia (e ruota) la foto sull'area scelta, poi la alleggerisce. */
export async function cropImage(src: string, area: Area, rotation: number, name: string, maxSide = MAX_SIDE): Promise<File> {
  const img = await load(src)
  const rad = (rotation * Math.PI) / 180
  const sin = Math.abs(Math.sin(rad)), cos = Math.abs(Math.cos(rad))
  const bw = img.naturalWidth * cos + img.naturalHeight * sin, bh = img.naturalWidth * sin + img.naturalHeight * cos
  const rotated = document.createElement('canvas'); rotated.width = bw; rotated.height = bh
  const rc = rotated.getContext('2d')!
  rc.translate(bw / 2, bh / 2); rc.rotate(rad); rc.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2)
  const ratio = Math.min(1, maxSide / Math.max(area.width, area.height))
  const out = document.createElement('canvas'); out.width = Math.round(area.width * ratio); out.height = Math.round(area.height * ratio)
  out.getContext('2d')!.drawImage(rotated, area.x, area.y, area.width, area.height, 0, 0, out.width, out.height)
  rotated.width = 0; rotated.height = 0
  return toJpeg(out, name)
}
