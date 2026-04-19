import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const userId = formData.get('userId') as string | null

    if (!file || !userId) {
      return NextResponse.json({ error: 'Missing file or userId' }, { status: 400 })
    }

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!
    const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET!

    // ── Step A: Upload to Cloudinary ─────────────────────────────────────────
    const cloudForm = new FormData()
    cloudForm.append('file', file)
    cloudForm.append('upload_preset', uploadPreset)
    cloudForm.append('folder', 'leadershiptap/profiles')

    const cloudRes = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      { method: 'POST', body: cloudForm },
    )

    if (!cloudRes.ok) {
      const err = await cloudRes.text()
      console.error('[upload-photo] Cloudinary error:', err)
      return NextResponse.json({ error: 'Image upload failed' }, { status: 500 })
    }

    const cloudData = await cloudRes.json()
    const publicUrl = cloudData.secure_url as string
    console.log('[upload-photo] Cloudinary URL:', publicUrl)

    // ── Step B: PATCH Airtable Profile Photo with the public URL ─────────────
    const baseId = process.env.AIRTABLE_BASE_ID!
    const token = process.env.AIRTABLE_API_KEY!

    const airtableRes = await fetch(
      `https://api.airtable.com/v0/${baseId}/Users/${userId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: {
            'Profile Photo': [{ url: publicUrl }],
          },
        }),
      },
    )

    if (!airtableRes.ok) {
      const err = await airtableRes.text()
      console.error('[upload-photo] Airtable PATCH error:', airtableRes.status, err)
      return NextResponse.json({ error: `Airtable update failed: ${err}` }, { status: 500 })
    }

    console.log('[upload-photo] Success for userId:', userId)
    return NextResponse.json({ success: true, url: publicUrl })
  } catch (err) {
    console.error('[upload-photo] Unexpected error:', err)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
