import { NextRequest, NextResponse } from 'next/server'

/**
 * Generic image upload to Cloudinary. Unlike /api/upload-photo, this route
 * does NOT touch Airtable — it just returns the public URL so the caller can
 * embed it wherever it wants (e.g. inside a Note's body for ink-handwritten
 * notes).
 *
 * Request: multipart/form-data with:
 *   - file: image blob
 *   - folder (optional): Cloudinary folder, defaults to "leadershiptap/misc"
 *
 * Response: { success: true, url: string } or { success: false, error: string }
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const folderInput = formData.get('folder')
    const folder =
      typeof folderInput === 'string' && folderInput.trim().length > 0
        ? folderInput.trim()
        : 'leadershiptap/misc'

    if (!file) {
      return NextResponse.json({ success: false, error: 'Missing file' }, { status: 400 })
    }

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
    const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET
    if (!cloudName || !uploadPreset) {
      return NextResponse.json(
        { success: false, error: 'Cloudinary not configured' },
        { status: 500 },
      )
    }

    const cloudForm = new FormData()
    cloudForm.append('file', file)
    cloudForm.append('upload_preset', uploadPreset)
    cloudForm.append('folder', folder)

    const cloudRes = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      { method: 'POST', body: cloudForm },
    )

    if (!cloudRes.ok) {
      const err = await cloudRes.text()
      console.error('[upload-image] Cloudinary error:', err)
      return NextResponse.json(
        { success: false, error: 'Image upload failed' },
        { status: 500 },
      )
    }

    const cloudData = await cloudRes.json()
    const publicUrl = cloudData.secure_url as string
    return NextResponse.json({ success: true, url: publicUrl })
  } catch (err) {
    console.error('[upload-image] Unexpected error:', err)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
