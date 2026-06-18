'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Pencil, Undo2, Trash2, X, Hand, Eraser } from 'lucide-react'
import InkCanvas, { type InkTool } from '@/components/ink/InkCanvas'
import { saveInkNoteAction } from '../../../actions'

interface Props {
  subjectPersonId: string
  subjectName: string
}

const COLORS: Array<{ value: string; label: string; swatch: string }> = [
  { value: '#0f172a', label: 'Black',  swatch: 'bg-slate-900' },
  { value: '#1d4ed8', label: 'Blue',   swatch: 'bg-blue-700' },
  { value: '#be123c', label: 'Red',    swatch: 'bg-rose-700' },
  { value: '#15803d', label: 'Green',  swatch: 'bg-emerald-700' },
]

// `size` is the perfect-freehand polygon outline width baseline. Tuned down
// after live testing — handwriting on iPad with Pencil felt too marker-like.
// Medium now lands close to a 0.4mm gel pen at default pressure.
const WIDTHS: Array<{ value: number; label: string; dot: string }> = [
  { value: 1.8, label: 'Fine',   dot: 'w-1 h-1' },
  { value: 3,   label: 'Medium', dot: 'w-1.5 h-1.5' },
  { value: 5,   label: 'Bold',   dot: 'w-2.5 h-2.5' },
]

// Eraser hit-radius in CSS pixels. Bigger than pen widths because the eraser
// removes whole strokes — coaches want quick, deliberate cleanup, not pixel
// surgery.
const ERASER_SIZES: Array<{ value: number; label: string; dot: string }> = [
  { value: 10, label: 'Small',  dot: 'w-2 h-2' },
  { value: 18, label: 'Medium', dot: 'w-3 h-3' },
  { value: 32, label: 'Large',  dot: 'w-4 h-4' },
]

/**
 * Ink note screen — full-viewport canvas with toolbar. Designed for iPad +
 * Apple Pencil but accepts mouse and finger input as a fallback.
 *
 * Save flow:
 *   1. Rasterize the canvas to a PNG blob.
 *   2. POST it to /api/upload-image (Cloudinary).
 *   3. Call saveInkNoteAction with the resulting URL.
 *   4. Redirect back to the client profile so the new note is visible.
 */
export default function InkNoteComposer({ subjectPersonId, subjectName }: Props) {
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const controlsRef = useRef<{ undo: () => void; clear: () => void; isEmpty: () => boolean } | null>(null)

  const [color, setColor] = useState(COLORS[0].value)
  const [width, setWidth] = useState(WIDTHS[1].value)
  const [tool, setTool] = useState<InkTool>('pen')
  const [eraserSize, setEraserSize] = useState(ERASER_SIZES[1].value)
  // Default ON for palm rejection on iPad. Coaches drawing with the Pencil
  // get clean strokes; desktop users on a mouse can leave it on (mouse is
  // still accepted) or toggle it off to test with a finger.
  const [penOnly, setPenOnly] = useState(true)
  const [strokeCount, setStrokeCount] = useState(0)
  const [caption, setCaption] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSave = strokeCount > 0 && !saving

  async function handleSave() {
    if (!canvasRef.current) return
    setSaving(true)
    setError(null)

    try {
      // Rasterize to PNG. The canvas already includes the DPR-scaled bitmap.
      const blob = await new Promise<Blob | null>((resolve) => {
        canvasRef.current!.toBlob((b) => resolve(b), 'image/png', 0.92)
      })
      if (!blob) {
        setError('Could not export the canvas. Try again.')
        setSaving(false)
        return
      }

      const fd = new FormData()
      fd.append('file', new File([blob], `ink-note-${Date.now()}.png`, { type: 'image/png' }))
      fd.append('folder', 'leadershiptap/ink-notes')

      const uploadRes = await fetch('/api/upload-image', { method: 'POST', body: fd })
      const uploadJson = await uploadRes.json()
      if (!uploadJson.success) {
        setError(`Upload failed: ${uploadJson.error ?? 'unknown error'}`)
        setSaving(false)
        return
      }

      const result = await saveInkNoteAction(subjectPersonId, uploadJson.url, caption)
      if ('error' in result) {
        setError(result.error)
        setSaving(false)
        return
      }

      toast.success('Ink note saved')
      router.push(`/users/${subjectPersonId}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSaving(false)
    }
  }

  function handleCancel() {
    if (strokeCount > 0 && !confirm('Discard this ink note?')) return
    router.push(`/users/${subjectPersonId}`)
  }

  return (
    // h-[100dvh] uses the dynamic viewport height so iOS Safari's URL bar
    // doesn't eat the bottom toolbar when it's visible.
    <div className="flex flex-col h-[100dvh] bg-slate-50">
      {/* Top toolbar */}
      <header className="flex items-center gap-2 px-3 py-2 bg-white border-b border-slate-200 flex-shrink-0">
        <button
          onClick={handleCancel}
          aria-label="Close"
          className="p-2 rounded-md text-slate-500 hover:bg-slate-100"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-slate-400 leading-none">Ink note for</p>
          <p className="text-sm font-semibold text-slate-900 truncate leading-tight">{subjectName}</p>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => controlsRef.current?.undo()}
            disabled={strokeCount === 0}
            aria-label="Undo"
            title="Undo"
            className="p-2 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Undo2 className="h-5 w-5" />
          </button>
          <button
            onClick={() => controlsRef.current?.clear()}
            disabled={strokeCount === 0}
            aria-label="Clear"
            title="Clear"
            className="p-2 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Trash2 className="h-5 w-5" />
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="ml-1 px-4 h-9 rounded-md bg-[hsl(213,70%,30%)] text-white text-sm font-medium hover:bg-[hsl(213,70%,25%)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </header>

      {/* Tool + settings strip */}
      <div className="flex items-center gap-3 px-3 py-2 bg-white border-b border-slate-100 flex-shrink-0 overflow-x-auto">
        {/* Pen / Eraser segmented toggle */}
        <div className="inline-flex rounded-md border border-slate-200 overflow-hidden flex-shrink-0">
          <button
            onClick={() => setTool('pen')}
            aria-pressed={tool === 'pen'}
            className={`flex items-center gap-1.5 px-2.5 h-8 text-xs font-medium transition-colors ${
              tool === 'pen'
                ? 'bg-[hsl(213,70%,30%)] text-white'
                : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Pencil className="h-3.5 w-3.5" />
            Pen
          </button>
          <button
            onClick={() => setTool('eraser')}
            aria-pressed={tool === 'eraser'}
            className={`flex items-center gap-1.5 px-2.5 h-8 text-xs font-medium border-l border-slate-200 transition-colors ${
              tool === 'eraser'
                ? 'bg-rose-600 text-white border-rose-600'
                : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Eraser className="h-3.5 w-3.5" />
            Eraser
          </button>
        </div>

        <div className="h-5 w-px bg-slate-200 mx-1" />

        {/* Pen-mode controls: color + width */}
        {tool === 'pen' && (
          <>
            <span className="text-xs font-medium text-slate-500">Color</span>
            <div className="flex items-center gap-1">
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setColor(c.value)}
                  aria-label={c.label}
                  title={c.label}
                  className={`w-6 h-6 rounded-full ${c.swatch} ring-offset-1 transition-shadow ${
                    color === c.value ? 'ring-2 ring-slate-900' : 'ring-1 ring-slate-200'
                  }`}
                />
              ))}
            </div>

            <div className="h-5 w-px bg-slate-200 mx-1" />

            <span className="text-xs font-medium text-slate-500">Size</span>
            <div className="flex items-center gap-1">
              {WIDTHS.map((w) => (
                <button
                  key={w.value}
                  onClick={() => setWidth(w.value)}
                  aria-label={w.label}
                  title={w.label}
                  className={`w-8 h-8 rounded-md flex items-center justify-center border transition-colors ${
                    width === w.value
                      ? 'border-slate-900 bg-slate-100'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span className={`rounded-full bg-slate-900 ${w.dot}`} />
                </button>
              ))}
            </div>
          </>
        )}

        {/* Eraser-mode controls: size only */}
        {tool === 'eraser' && (
          <>
            <span className="text-xs font-medium text-slate-500">Eraser size</span>
            <div className="flex items-center gap-1">
              {ERASER_SIZES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setEraserSize(s.value)}
                  aria-label={s.label}
                  title={s.label}
                  className={`w-8 h-8 rounded-md flex items-center justify-center border transition-colors ${
                    eraserSize === s.value
                      ? 'border-rose-600 bg-rose-50'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span className={`rounded-full bg-rose-600 ${s.dot}`} />
                </button>
              ))}
            </div>
          </>
        )}

        <div className="h-5 w-px bg-slate-200 mx-1" />

        <button
          onClick={() => setPenOnly((v) => !v)}
          className={`flex items-center gap-1.5 px-2.5 h-8 rounded-md text-xs font-medium border transition-colors flex-shrink-0 ${
            penOnly
              ? 'border-[hsl(213,70%,30%)] bg-[hsl(213,60%,94%)] text-[hsl(213,70%,30%)]'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
          title="Ignore touch input so your palm doesn't draw on the page"
        >
          <Hand className="h-3.5 w-3.5" />
          Pen only
        </button>
      </div>

      {/* Canvas — fills remaining vertical space */}
      <div className="flex-1 min-h-0 p-3">
        <div className="w-full h-full rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
          <InkCanvas
            color={color}
            width={width}
            tool={tool}
            eraserSize={eraserSize}
            penOnly={penOnly}
            canvasRef={canvasRef}
            controlsRef={controlsRef}
            onStrokesChange={setStrokeCount}
            className="w-full h-full"
          />
        </div>
      </div>

      {/* Caption + status */}
      <footer className="px-3 pb-3 pt-1 flex-shrink-0 space-y-2 bg-slate-50">
        <input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Optional caption (typed or Scribble)…"
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[hsl(213,70%,30%)]"
          disabled={saving}
        />
        {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
      </footer>
    </div>
  )
}
