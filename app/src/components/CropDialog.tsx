import { useEffect, useState } from 'react'
import Cropper from 'react-easy-crop'
import { type Area, cropImage } from '../lib/image'
import { Button } from './ui'

const PRESETS = [
  { id: 'card', label: 'Tessera', ratio: 85.6 / 53.98 },
  { id: 'a4', label: 'Foglio A4', ratio: 210 / 297 },
  { id: 'a4l', label: 'A4 orizzontale', ratio: 297 / 210 },
  { id: 'square', label: 'Quadrato', ratio: 1 },
]
/** Inquadra il documento: formato, zoom, rotazione. Restituisce la foto ritagliata e già alleggerita. */
export default function CropDialog({ file, square, onDone, onCancel }: { file: File; square?: boolean; onDone: (f: File) => void; onCancel: () => void }) {
  const [src, setSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 }); const [zoom, setZoom] = useState(1); const [rotation, setRotation] = useState(0)
  const [preset, setPreset] = useState(square ? 'square' : 'card')
  const [area, setArea] = useState<Area | null>(null)
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null)
  useEffect(() => { const u = URL.createObjectURL(file); setSrc(u); return () => URL.revokeObjectURL(u) }, [file])
  const ratio = PRESETS.find((p) => p.id === preset)!.ratio

  const confirm = async () => {
    if (!src || !area) return
    setBusy(true); setError(null)
    try { onDone(await cropImage(src, area, rotation, file.name, square ? 800 : undefined)) }
    catch (e) { setError(e instanceof Error ? e.message : 'Non siamo riusciti a ritagliare la foto: riprova.') }
    setBusy(false)
  }
  return (
    <div role="dialog" aria-modal="true" aria-label="Ritaglia la foto" className="fixed inset-0 z-50 flex flex-col bg-ink/95 text-white">
      <div className="px-4 pt-4 text-sm">
        <p className="font-semibold">Inquadra {square ? 'il viso' : 'il documento'} nel riquadro</p>
        <p className="text-white/70">Sposta con il dito, poi usa zoom e rotazione qui sotto.</p>
      </div>
      {!square && (
        <div className="flex gap-2 overflow-x-auto px-4 pt-3">
          {PRESETS.map((p) => <button key={p.id} type="button" aria-pressed={preset === p.id} onClick={() => setPreset(p.id)} className={`h-10 shrink-0 rounded-lg px-3 text-sm font-medium ${preset === p.id ? 'bg-white text-ink' : 'bg-white/15'}`}>{p.label}</button>)}
        </div>
      )}
      <div className="relative mt-3 min-h-0 flex-1">
        {src && <Cropper image={src} crop={crop} zoom={zoom} rotation={rotation} aspect={ratio} cropShape={square ? 'round' : 'rect'} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={(_, px) => setArea(px)} />}
      </div>
      <div className="space-y-3 bg-ink px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <label className="flex items-center gap-3 text-sm"><span className="w-20">Zoom</span><input type="range" min={1} max={4} step={0.05} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1" /></label>
        <label className="flex items-center gap-3 text-sm"><span className="w-20">Rotazione</span><input type="range" min={-180} max={180} step={1} value={rotation} onChange={(e) => setRotation(Number(e.target.value))} className="flex-1" />
          <button type="button" className="rounded-lg bg-white/15 px-3 py-2 text-xs font-semibold" onClick={() => setRotation((r) => (r + 90 > 180 ? r - 270 : r + 90))}>Gira di 90°</button></label>
        {error && <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>Annulla</Button>
          <Button type="button" className="!bg-white !text-ink" disabled={busy || !area} onClick={() => void confirm()}>{busy ? 'Preparo…' : 'Usa questa foto'}</Button>
        </div>
      </div>
    </div>
  )
}
