/**
 * Renders a note's body as plain text + inline ink images. Ink notes are
 * stored as standard markdown image syntax:
 *
 *   Optional caption text on top
 *
 *   ![Ink note](https://res.cloudinary.com/.../ink-note.png)
 *
 * The display layer extracts each ![]( ) image, renders an <img> for it, and
 * shows whatever text remains as plain paragraph text. We deliberately do NOT
 * pull in a markdown parser — these notes only contain text + image syntax,
 * and the regex stays auditable.
 */

interface Props {
  content: string
  /** Tailwind classes applied to the wrapping text block. */
  className?: string
  /** Limit ink image height so it doesn't dominate small note cards. */
  imageMaxHeightClass?: string
}

const IMG_RE = /!\[([^\]]*)\]\(([^)\s]+)\)/g

interface Segment {
  kind: 'text' | 'image'
  value: string   // text content or image URL
  alt?: string
}

function parse(content: string): Segment[] {
  const segments: Segment[] = []
  let lastIndex = 0
  for (const match of content.matchAll(IMG_RE)) {
    const idx = match.index ?? 0
    if (idx > lastIndex) {
      segments.push({ kind: 'text', value: content.slice(lastIndex, idx) })
    }
    segments.push({ kind: 'image', value: match[2], alt: match[1] || 'Ink note' })
    lastIndex = idx + match[0].length
  }
  if (lastIndex < content.length) {
    segments.push({ kind: 'text', value: content.slice(lastIndex) })
  }
  return segments
}

export default function NoteBody({
  content,
  className = 'text-sm text-slate-700 whitespace-pre-wrap leading-relaxed',
  imageMaxHeightClass = 'max-h-80',
}: Props) {
  const segments = parse(content)
  return (
    <div className="space-y-2">
      {segments.map((seg, i) => {
        if (seg.kind === 'image') {
          return (
            <img
              key={i}
              src={seg.value}
              alt={seg.alt ?? 'Ink note'}
              className={`block w-full object-contain rounded-md border border-slate-200 bg-white ${imageMaxHeightClass}`}
              loading="lazy"
            />
          )
        }
        const trimmed = seg.value.replace(/^\n+|\n+$/g, '')
        if (trimmed.length === 0) return null
        return (
          <p key={i} className={className}>
            {trimmed}
          </p>
        )
      })}
    </div>
  )
}

/**
 * Lightweight helper for surfaces that only need a one-line preview (e.g.
 * dashboard rollups). Strips markdown image syntax so previews don't show a
 * raw URL, and replaces them with a [ink] sentinel the caller can style.
 */
export function previewText(content: string, maxLength = 120): string {
  const stripped = content.replace(IMG_RE, '[ink]').trim()
  if (stripped.length <= maxLength) return stripped
  return stripped.slice(0, maxLength).trimEnd() + '…'
}
