import crypto from 'node:crypto'

const SESSION_COOKIE = 'inplay_session'
const SESSION_TTL_MS = Number(process.env.INPLAY_SESSION_TTL_MS || 1000 * 60 * 60 * 12)
const COOKIE_SECURE =
  process.env.INPLAY_COOKIE_SECURE === 'true' ||
  (process.env.NODE_ENV === 'production' && process.env.INPLAY_COOKIE_SECURE !== 'false')

const sessions = new Map()

function parseCookies(header) {
  return Object.fromEntries(
    String(header || '')
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf('=')
        if (index === -1) {
          return [part, '']
        }
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))]
      }),
  )
}

function pruneExpiredSessions() {
  const now = Date.now()
  for (const [token, session] of sessions.entries()) {
    if (session.expiresAt <= now) {
      sessions.delete(token)
    }
  }
}

function cookieOptions(maxAge = SESSION_TTL_MS) {
  return {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: 'lax',
    path: '/',
    maxAge,
  }
}

export function createSession(res, username) {
  pruneExpiredSessions()
  const token = crypto.randomBytes(32).toString('base64url')
  const session = {
    username,
    csrfToken: crypto.randomBytes(24).toString('base64url'),
    expiresAt: Date.now() + SESSION_TTL_MS,
  }
  sessions.set(token, session)
  res.cookie(SESSION_COOKIE, token, cookieOptions())
  return session
}

export function clearSession(req, res) {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE]
  if (token) {
    sessions.delete(token)
  }
  res.clearCookie(SESSION_COOKIE, cookieOptions(0))
}

export function getSession(req) {
  pruneExpiredSessions()
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE]
  if (!token) {
    return null
  }

  const session = sessions.get(token)
  if (!session || session.expiresAt <= Date.now()) {
    sessions.delete(token)
    return null
  }

  session.expiresAt = Date.now() + SESSION_TTL_MS
  return session
}

export function requireAuth(req, res, next) {
  const session = getSession(req)
  if (!session) {
    if ((req.originalUrl || req.path).startsWith('/api/')) {
      return res.status(401).json({ error: 'Authentication required.' })
    }
    return res.redirect(`/login?next=${encodeURIComponent(req.originalUrl || '/inplay')}`)
  }

  req.session = session
  return next()
}

export function requireCsrf(req, res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next()
  }

  const session = req.session || getSession(req)
  if (!session || req.get('x-csrf-token') !== session.csrfToken) {
    return res.status(403).json({ error: 'Invalid CSRF token.' })
  }

  return next()
}
