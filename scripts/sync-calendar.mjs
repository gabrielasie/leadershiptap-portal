import https from 'https'

const secret = process.env.SYNC_SECRET
const host = process.env.SYNC_HOST || 'portal-leadershiptap.com'

const options = {
  hostname: host,
  path: '/api/calendar/sync',
  method: 'POST',
  headers: {
    'x-sync-secret': secret,
    'Content-Type': 'application/json',
  },
}

const req = https.request(options, (res) => {
  let data = ''
  res.on('data', chunk => data += chunk)
  res.on('end', () => {
    console.log('[sync] status:', res.statusCode)
    console.log('[sync] response:', data)
    process.exit(res.statusCode === 200 ? 0 : 1)
  })
})

req.on('error', (e) => {
  console.error('[sync] error:', e.message)
  process.exit(1)
})

req.end()
