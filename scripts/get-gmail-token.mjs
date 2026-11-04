// One-time helper: sign in to the tracker Gmail account and print a refresh token
// for the GitHub Actions mail poller.
//
// Usage:  node scripts/get-gmail-token.mjs ~/Downloads/client_secret_XXXX.json
//
// Run it yourself in a terminal. The token it prints is a secret: paste it into
// GitHub Actions secrets and don't commit it or share it.

import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'
import { exec } from 'node:child_process'

const SCOPE = 'https://www.googleapis.com/auth/gmail.modify' // read, send, label. No delete.

const file = process.argv[2]
if (!file) {
  console.error('Usage: node scripts/get-gmail-token.mjs <path to client_secret JSON>')
  process.exit(1)
}
const creds = JSON.parse(readFileSync(file, 'utf8')).installed
if (!creds) {
  console.error('That JSON is not a "Desktop app" OAuth client. Create a Desktop app client and download its JSON.')
  process.exit(1)
}

const state = randomBytes(16).toString('hex')

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1')
  if (url.pathname !== '/') return res.end()
  const code = url.searchParams.get('code')
  if (url.searchParams.get('state') !== state || !code) {
    res.end('Sign-in failed or was cancelled. Check the terminal.')
    console.error('Error:', url.searchParams.get('error') ?? 'state mismatch')
    return finish(1)
  }

  const redirectUri = `http://127.0.0.1:${server.address().port}`
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: creds.client_id,
      client_secret: creds.client_secret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  const tokens = await tokenRes.json()
  if (!tokens.refresh_token) {
    res.end('No refresh token returned. Check the terminal.')
    console.error('No refresh token in the response:', tokens)
    return finish(1)
  }

  // Prove the token works by asking which mailbox it belongs to.
  const profile = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  }).then((r) => r.json())

  res.end('Done. You can close this tab and go back to the terminal.')
  console.log(`\nSigned in as: ${profile.emailAddress}  (${profile.messagesTotal} messages)\n`)
  console.log('Add these as secrets in cylinder-tracker-data → Settings → Secrets and variables → Actions:\n')
  console.log(`GMAIL_ADDRESS        ${profile.emailAddress}`)
  console.log(`GMAIL_CLIENT_ID      ${creds.client_id}`)
  console.log(`GMAIL_CLIENT_SECRET  ${creds.client_secret}`)
  console.log(`GMAIL_REFRESH_TOKEN  ${tokens.refresh_token}\n`)
  finish(0)
})

function finish(code) {
  server.close()
  process.exit(code)
}

server.listen(0, '127.0.0.1', () => {
  const redirectUri = `http://127.0.0.1:${server.address().port}`
  const authUrl =
    'https://accounts.google.com/o/oauth2/v2/auth?' +
    new URLSearchParams({
      client_id: creds.client_id,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPE,
      access_type: 'offline',
      prompt: 'consent', // forces Google to return a refresh token
      state,
    })
  console.log('Opening your browser. Sign in as the TRACKER account (cylindertracker1@gmail.com).')
  console.log('If it does not open, paste this into a browser:\n\n' + authUrl + '\n')
  exec(`open "${authUrl}"`)
})
