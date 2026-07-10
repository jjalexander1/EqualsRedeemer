import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import inplayRoutes from './inplay/routes.js'
import { changePassword, ensureUser, verifyCredentials } from './auth/passwordStore.js'
import { clearSession, createSession, getSession, requireAuth, requireCsrf } from './auth/sessions.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const distDir = path.join(rootDir, 'dist')
const port = Number(process.env.PORT || 3000)

const app = express()

app.set('trust proxy', 1)
app.disable('x-powered-by')
app.use(express.json({ limit: '1mb' }))

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'same-origin')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  next()
})

app.get('/healthz', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/session', (req, res) => {
  const session = getSession(req)
  res.json({
    authenticated: Boolean(session),
    username: session?.username || null,
    csrfToken: session?.csrfToken || null,
  })
})

app.post('/api/login', async (req, res, next) => {
  try {
    const user = await verifyCredentials(req.body.username, req.body.password)
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password.' })
    }

    const session = createSession(res, user.username)
    return res.json({
      authenticated: true,
      username: user.username,
      csrfToken: session.csrfToken,
    })
  } catch (error) {
    next(error)
  }
})

app.post('/api/logout', requireAuth, requireCsrf, (req, res) => {
  clearSession(req, res)
  res.json({ ok: true })
})

app.post('/api/password', requireAuth, requireCsrf, async (req, res, next) => {
  try {
    const user = await changePassword(req.body.currentPassword, req.body.newPassword)
    res.json({ ok: true, username: user.username })
  } catch (error) {
    next(error)
  }
})

app.use('/api/inplay', requireAuth, requireCsrf, inplayRoutes)

app.get('/login', (_req, res) => {
  res.type('html').send(loginPage())
})

app.use(express.static(distDir, { index: false }))

app.get('/inplay', requireAuth, (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'))
})

app.get('/inplay/*splat', requireAuth, (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'))
})

app.get('*splat', (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'))
})

app.use((error, _req, res, next) => {
  void next
  const statusCode = error.statusCode || 500
  const message = statusCode >= 500 ? 'Unexpected server error.' : error.message
  if (statusCode >= 500) {
    console.error(error)
  }
  res.status(statusCode).json({ error: message })
})

await ensureUser()

app.listen(port, () => {
  console.log(`EqualsRedeemer server listening on port ${port}`)
})

function loginPage() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Inplay Tool Login</title>
    <style>
      :root { color: #101827; background: #eef2f6; font-family: Arial, Helvetica, sans-serif; }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: linear-gradient(145deg, #e9edf3, #f8fafc); }
      main { width: min(420px, calc(100vw - 32px)); background: #fff; border: 1px solid #d9e2ec; border-radius: 8px; box-shadow: 0 18px 55px rgba(18, 28, 45, 0.14); padding: 28px; }
      h1 { margin: 0 0 8px; font-size: 1.65rem; line-height: 1.1; }
      p { margin: 0 0 22px; color: #526071; line-height: 1.5; }
      label { display: block; margin: 0 0 6px; color: #334155; font-weight: 700; font-size: 0.88rem; }
      input { width: 100%; height: 42px; margin: 0 0 14px; border: 1px solid #cbd5e1; border-radius: 6px; padding: 0 12px; font: inherit; }
      button { width: 100%; height: 44px; border: 0; border-radius: 6px; background: #102033; color: #fff; font-weight: 800; cursor: pointer; }
      button:disabled { opacity: 0.6; cursor: wait; }
      .error { min-height: 20px; margin-top: 12px; color: #b42318; font-weight: 700; font-size: 0.9rem; }
    </style>
  </head>
  <body>
    <main>
      <h1>Inplay Tool</h1>
      <p>Sign in to continue.</p>
      <form id="login-form">
        <label for="username">Username</label>
        <input id="username" name="username" autocomplete="username" required autofocus />
        <label for="password">Password</label>
        <input id="password" name="password" type="password" autocomplete="current-password" required />
        <button type="submit">Sign in</button>
        <div class="error" id="error" role="alert"></div>
      </form>
    </main>
    <script>
      const form = document.getElementById('login-form')
      const error = document.getElementById('error')
      const button = form.querySelector('button')
      form.addEventListener('submit', async (event) => {
        event.preventDefault()
        error.textContent = ''
        button.disabled = true
        const body = {
          username: form.username.value,
          password: form.password.value,
        }
        const response = await fetch('/api/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        })
        button.disabled = false
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}))
          error.textContent = payload.error || 'Login failed.'
          return
        }
        const params = new URLSearchParams(window.location.search)
        window.location.href = params.get('next') || '/inplay'
      })
    </script>
  </body>
</html>`
}
