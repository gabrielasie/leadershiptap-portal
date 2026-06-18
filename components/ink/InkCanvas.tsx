'use client'

import { useEffect, useRef } from 'react'
import { getStroke } from 'perfect-freehand'

interface InkPoint {
  x: number          // CSS pixels relative to canvas
  y: number
  pressure: number   // 0..1
}

interface Stroke {
  points: InkPoint[]
  color: string
  size: number       // perfect-freehand "size" — visual stroke width baseline
}

export type InkTool = 'pen' | 'eraser'

interface Props {
  /** Drawing color. Defaults to slate-900-ish ink. */
  color?: string
  /** Stroke size baseline (perfect-freehand `size`). */
  width?: number
  /** Active tool: 'pen' draws, 'eraser' removes whole strokes on contact. */
  tool?: InkTool
  /** Eraser hit radius in CSS pixels (only used when tool === 'eraser'). */
  eraserSize?: number
  /**
   * When true, only Pointer Events with pointerType==='pen' or 'mouse' draw —
   * touches are ignored so the palm doesn't smear ink on iPad. Default true.
   */
  penOnly?: boolean
  onStrokesChange?: (strokeCount: number) => void
  canvasRef?: React.RefObject<HTMLCanvasElement | null>
  controlsRef?: React.MutableRefObject<{
    undo: () => void
    clear: () => void
    isEmpty: () => boolean
  } | null>
  className?: string
}

// ── perfect-freehand options ──────────────────────────────────────────────────
//
// Two presets: LIVE is used while the stroke is in progress (lower smoothing
// = ink hugs the pen tip with less perceived lag, cheaper to recompute every
// frame). FINAL is used once on commit so the saved/displayed stroke gets the
// full smoothing pass.

const STROKE_OPTS_LIVE = {
  thinning: 0.5,
  smoothing: 0.18,   // light smoothing so ink follows the pen tip closely
  streamline: 0.22,  // minimal lerp so the line doesn't trail behind
  easing: (t: number) => t,
  start: { taper: 0, cap: true },
  end:   { taper: 0, cap: true },
  last: false,       // critical: this is the in-progress preview
}

const STROKE_OPTS_FINAL = {
  thinning: 0.5,
  smoothing: 0.42,
  streamline: 0.32,
  easing: (t: number) => t,
  start: { taper: 0, cap: true },
  end:   { taper: 0, cap: true },
  last: true,        // tell perfect-freehand this is the final pass
}

/**
 * Converts a perfect-freehand outline polygon to a Path2D for fast canvas fill.
 * The polygon is a closed loop around the centerline, so we just lineTo each
 * vertex and close.
 */
function polygonToPath(points: number[][]): Path2D {
  const path = new Path2D()
  if (points.length < 2) return path
  const [first, ...rest] = points
  path.moveTo(first[0], first[1])
  for (const [x, y] of rest) path.lineTo(x, y)
  path.closePath()
  return path
}

/**
 * Canvas-based ink surface. Captures stylus input via Pointer Events (Apple
 * Pencil reports pointerType='pen' with real pressure on iPadOS Safari) and
 * renders pressure-aware strokes via perfect-freehand.
 *
 * Rendering strategy: two-layer caching.
 *   - committed strokes are baked to an offscreen canvas once when they're
 *     finished. On every frame we blit that cache to the visible canvas in
 *     one drawImage call (O(1) regardless of stroke count).
 *   - the in-progress stroke is re-rendered each frame on top.
 *   - rAF batches updates to the display's refresh rate, so a high-frequency
 *     pen (the iPad Pro hits 240Hz) doesn't trigger 240 redraws/sec.
 *
 * Palm rejection: when penOnly is true (default), touch pointers are dropped
 * entirely. If a pen event arrives while a touch stroke is mid-flight, the
 * touch stroke is abandoned and the pen takes over.
 */
export default function InkCanvas({
  color = '#0f172a',
  width = 4,
  tool = 'pen',
  eraserSize = 16,
  penOnly = true,
  onStrokesChange,
  canvasRef,
  controlsRef,
  className,
}: Props) {
  const localCanvasRef = useRef<HTMLCanvasElement>(null)
  const ref = canvasRef ?? localCanvasRef
  const containerRef = useRef<HTMLDivElement>(null)

  // Cache canvas — holds the rasterized result of every committed stroke.
  // Same size as the visible canvas (including DPR).
  const cacheRef = useRef<HTMLCanvasElement | null>(null)

  const strokesRef = useRef<Stroke[]>([])
  /**
   * Index into strokesRef.current of the first stroke that hasn't been baked
   * into the cache canvas yet. paint() renders [bakedCount..length) live on
   * top of the cache, which lets us defer bakeStroke off the critical path
   * after pointerup without showing a blank where the just-committed stroke
   * should be.
   */
  const bakedCountRef = useRef(0)
  const currentRef = useRef<Stroke | null>(null)
  const activePointerRef = useRef<number | null>(null)
  const activeKindRef = useRef<'pen' | 'mouse' | 'touch' | null>(null)
  const rafRef = useRef<number | null>(null)
  const dirtyRef = useRef(false)
  const lastNotifiedStrokeCountRef = useRef(0)

  // Latest props captured in refs so the native event listeners attached in
  // the mount effect always see fresh values without needing to re-attach.
  const colorRef = useRef(color)
  const widthRef = useRef(width)
  const penOnlyRef = useRef(penOnly)
  const toolRef = useRef<InkTool>(tool)
  const eraserSizeRef = useRef(eraserSize)
  // Eraser cursor position (CSS px) — rendered as a ring overlay so the user
  // sees their target. null when not erasing or pointer not over canvas.
  const eraserCursorRef = useRef<{ x: number; y: number } | null>(null)
  useEffect(() => { colorRef.current = color }, [color])
  useEffect(() => { widthRef.current = width }, [width])
  useEffect(() => { penOnlyRef.current = penOnly }, [penOnly])
  useEffect(() => { toolRef.current = tool }, [tool])
  useEffect(() => { eraserSizeRef.current = eraserSize }, [eraserSize])

  // ── Geometry helpers ───────────────────────────────────────────────────────

  function getDpr() {
    return Math.max(1, window.devicePixelRatio || 1)
  }

  function resize() {
    const canvas = ref.current
    const container = containerRef.current
    if (!canvas || !container) return
    const dpr = getDpr()
    const rect = container.getBoundingClientRect()
    const w = Math.max(1, Math.round(rect.width * dpr))
    const h = Math.max(1, Math.round(rect.height * dpr))

    canvas.width = w
    canvas.height = h
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height}px`

    if (!cacheRef.current) cacheRef.current = document.createElement('canvas')
    cacheRef.current.width = w
    cacheRef.current.height = h

    repaintCache()
    requestRender()
  }

  /** Re-rasterize every committed stroke onto the cache canvas. */
  function repaintCache() {
    const cache = cacheRef.current
    if (!cache) return
    const ctx = cache.getContext('2d')
    if (!ctx) return
    const dpr = getDpr()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, cache.width, cache.height)
    ctx.scale(dpr, dpr)
    for (const stroke of strokesRef.current) renderStroke(ctx, stroke, 'final')
    bakedCountRef.current = strokesRef.current.length
  }

  /** Bake every stroke past bakedCountRef onto the cache. Idempotent. */
  function bakePending() {
    const cache = cacheRef.current
    if (!cache) return
    const ctx = cache.getContext('2d')
    if (!ctx) return
    const dpr = getDpr()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(dpr, dpr)
    for (let i = bakedCountRef.current; i < strokesRef.current.length; i++) {
      renderStroke(ctx, strokesRef.current[i], 'final')
    }
    bakedCountRef.current = strokesRef.current.length
  }

  /**
   * Notifies the parent of a stroke-count change ONLY when the count actually
   * crossed a meaningful boundary for the parent's UI (currently just empty
   * vs non-empty). Avoids triggering a parent re-render on every stroke,
   * which was a measurable source of inter-stroke latency.
   */
  function maybeNotifyStrokeCount() {
    const next = strokesRef.current.length
    const prev = lastNotifiedStrokeCountRef.current
    if (next === prev) return
    // Parent only cares about empty/non-empty for now. If a future caller
    // needs exact counts we can drop this short-circuit.
    const emptyChanged = (next === 0) !== (prev === 0)
    lastNotifiedStrokeCountRef.current = next
    if (emptyChanged) onStrokesChange?.(next)
  }

  function renderStroke(
    ctx: CanvasRenderingContext2D,
    stroke: Stroke,
    mode: 'live' | 'final',
  ) {
    const raw = stroke.points.map(
      (p) => [p.x, p.y, p.pressure] as [number, number, number],
    )
    const opts = mode === 'live' ? STROKE_OPTS_LIVE : STROKE_OPTS_FINAL
    const outline = getStroke(raw, { ...opts, size: stroke.size })
    if (outline.length < 2) return
    ctx.fillStyle = stroke.color
    ctx.fill(polygonToPath(outline))
  }

  /** Render the on-screen canvas from cache + the in-progress stroke. */
  function paint() {
    const canvas = ref.current
    const cache = cacheRef.current
    if (!canvas || !cache) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(cache, 0, 0)
    const dpr = getDpr()
    ctx.scale(dpr, dpr)
    // Render strokes that have been committed but not yet baked — bake is
    // deferred to rAF so pointerup returns instantly. Without this loop those
    // strokes would visually disappear in the gap between pen-up and bake.
    for (let i = bakedCountRef.current; i < strokesRef.current.length; i++) {
      renderStroke(ctx, strokesRef.current[i], 'final')
    }
    if (currentRef.current) {
      renderStroke(ctx, currentRef.current, 'live')
    }
    // Eraser ring overlay so the user sees exactly which area will be erased.
    const cursor = eraserCursorRef.current
    if (toolRef.current === 'eraser' && cursor) {
      const r = eraserSizeRef.current
      ctx.save()
      ctx.beginPath()
      ctx.arc(cursor.x, cursor.y, r, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(244, 63, 94, 0.10)'   // rose-500 @ 10%
      ctx.fill()
      ctx.lineWidth = 1.2
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.55)' // rose-500 @ 55%
      ctx.stroke()
      ctx.restore()
    }
  }

  /**
   * Object eraser: remove any stroke that intersects the disk centered at
   * (x, y) with radius eraserSize. We test each stroke's points against the
   * radius padded by the stroke's own half-width so thick strokes register
   * a hit when the eraser merely brushes their edge.
   *
   * Returns true if anything was removed (caller repaints the cache).
   */
  function eraseAt(x: number, y: number): boolean {
    const r = eraserSizeRef.current
    const strokes = strokesRef.current
    if (strokes.length === 0) return false
    let changed = false
    const remaining: Stroke[] = []
    for (const stroke of strokes) {
      const hitRadius = r + stroke.size * 0.5
      const r2 = hitRadius * hitRadius
      let hit = false
      for (const p of stroke.points) {
        const dx = p.x - x
        const dy = p.y - y
        if (dx * dx + dy * dy < r2) {
          hit = true
          break
        }
      }
      if (hit) {
        changed = true
      } else {
        remaining.push(stroke)
      }
    }
    if (changed) {
      strokesRef.current = remaining
      repaintCache()
      onStrokesChange?.(strokesRef.current.length)
    }
    return changed
  }

  function requestRender() {
    if (dirtyRef.current) return
    dirtyRef.current = true
    rafRef.current = requestAnimationFrame(() => {
      dirtyRef.current = false
      paint()
    })
  }

  // ── Pointer event plumbing ─────────────────────────────────────────────────

  function eventToPoint(e: PointerEvent): InkPoint {
    const canvas = ref.current!
    const rect = canvas.getBoundingClientRect()
    const isPen = e.pointerType === 'pen'
    const raw = e.pressure
    // Mouse reports pressure 0.5 when the button is down. Touch may report 0.
    // Coerce non-pen sources to a stable mid-pressure so the ink isn't
    // invisible or weirdly tapered when typed-in.
    const pressure = isPen ? (raw > 0 ? raw : 0.5) : 0.55
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, pressure }
  }

  function shouldAccept(kind: string): boolean {
    if (!penOnlyRef.current) return true
    return kind !== 'touch'
  }

  function handleDown(e: PointerEvent) {
    if (!shouldAccept(e.pointerType)) return

    // Pen always beats an in-progress touch stroke (Apple Pencil priority).
    if (
      activePointerRef.current !== null &&
      activeKindRef.current !== 'pen' &&
      e.pointerType === 'pen'
    ) {
      currentRef.current = null
      activePointerRef.current = null
      activeKindRef.current = null
    }

    if (activePointerRef.current !== null) return

    activePointerRef.current = e.pointerId
    activeKindRef.current = e.pointerType as 'pen' | 'mouse' | 'touch'
    ref.current?.setPointerCapture(e.pointerId)

    if (toolRef.current === 'eraser') {
      const canvas = ref.current!
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      eraserCursorRef.current = { x, y }
      eraseAt(x, y)
      paint()
      return
    }

    currentRef.current = {
      points: [eventToPoint(e)],
      color: colorRef.current,
      size: widthRef.current,
    }
    paint()
  }

  function handleMove(e: PointerEvent) {
    if (activePointerRef.current !== e.pointerId) return

    if (toolRef.current === 'eraser') {
      const canvas = ref.current!
      const rect = canvas.getBoundingClientRect()
      const coalesced = e.getCoalescedEvents?.() ?? []
      const points = coalesced.length > 0 ? coalesced : [e]
      for (const sub of points) {
        const x = sub.clientX - rect.left
        const y = sub.clientY - rect.top
        eraserCursorRef.current = { x, y }
        eraseAt(x, y)
      }
      paint()
      return
    }

    const cur = currentRef.current
    if (!cur) return
    // High-frequency Pencil samples arrive in batches via getCoalescedEvents.
    const coalesced = e.getCoalescedEvents?.() ?? []
    if (coalesced.length > 0) {
      for (const sub of coalesced) cur.points.push(eventToPoint(sub))
    } else {
      cur.points.push(eventToPoint(e))
    }
    // Paint synchronously: rAF added up to one frame of latency before the
    // new point reached the screen, which is what made fast handwriting feel
    // like the ink was chasing the pen. The browser still composites at
    // vsync, so painting more often than that doesn't actually flash to the
    // user — but it removes the rAF dispatch delay.
    paint()
  }

  function commitStroke() {
    const cur = currentRef.current
    if (cur && cur.points.length > 0) {
      strokesRef.current.push(cur)
    }
    currentRef.current = null
    activePointerRef.current = null
    activeKindRef.current = null
    // Paint immediately so the just-finished stroke stays visible; the
    // un-baked render path in paint() handles drawing it from strokesRef.
    paint()
    // Defer the expensive bake AND the parent state update so this handler
    // returns in well under 1ms — that's what lets the next pointerdown fire
    // without queueing behind us, eliminating the inter-letter latency.
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      bakePending()
      maybeNotifyStrokeCount()
    })
  }

  function handleUp(e: PointerEvent) {
    if (activePointerRef.current !== e.pointerId) return
    ref.current?.releasePointerCapture(e.pointerId)
    if (toolRef.current === 'eraser') {
      eraserCursorRef.current = null
      activePointerRef.current = null
      activeKindRef.current = null
      paint()
      return
    }
    commitStroke()
  }

  function handleCancel(e: PointerEvent) {
    if (activePointerRef.current !== e.pointerId) return
    if (toolRef.current === 'eraser') {
      eraserCursorRef.current = null
      activePointerRef.current = null
      activeKindRef.current = null
      paint()
      return
    }
    commitStroke()
  }

  // ── Mount: attach NATIVE listeners (avoids React synthetic event overhead) ─

  useEffect(() => {
    resize()
    const obs = new ResizeObserver(() => resize())
    if (containerRef.current) obs.observe(containerRef.current)

    const canvas = ref.current
    if (!canvas) return () => obs.disconnect()

    const down = (e: PointerEvent) => handleDown(e)
    const move = (e: PointerEvent) => handleMove(e)
    const up = (e: PointerEvent) => handleUp(e)
    const cancel = (e: PointerEvent) => handleCancel(e)

    // passive:false because we may want to preventDefault on touch in some
    // browsers; touch-action: none on the element already covers iOS though.
    canvas.addEventListener('pointerdown', down, { passive: false })
    canvas.addEventListener('pointermove', move, { passive: true })
    canvas.addEventListener('pointerup', up, { passive: true })
    canvas.addEventListener('pointercancel', cancel, { passive: true })
    canvas.addEventListener('pointerleave', cancel, { passive: true })

    return () => {
      obs.disconnect()
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerup', up)
      canvas.removeEventListener('pointercancel', cancel)
      canvas.removeEventListener('pointerleave', cancel)
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Imperative handle for parent toolbar (undo / clear).
  useEffect(() => {
    if (!controlsRef) return
    controlsRef.current = {
      undo: () => {
        if (strokesRef.current.length === 0) return
        strokesRef.current.pop()
        repaintCache()
        paint()
        maybeNotifyStrokeCount()
      },
      clear: () => {
        if (strokesRef.current.length === 0 && currentRef.current === null) return
        strokesRef.current = []
        currentRef.current = null
        activePointerRef.current = null
        activeKindRef.current = null
        repaintCache()
        paint()
        maybeNotifyStrokeCount()
      },
      isEmpty: () => strokesRef.current.length === 0 && currentRef.current === null,
    }
  }, [controlsRef, onStrokesChange])

  return (
    <div ref={containerRef} className={`relative bg-white ${className ?? ''}`}>
      <canvas
        ref={ref}
        // touch-action: none keeps the browser from stealing the gesture for
        // scroll/zoom while the user is drawing.
        className="block w-full h-full touch-none select-none cursor-crosshair"
      />
    </div>
  )
}
