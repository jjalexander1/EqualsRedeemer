import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

const scrypt = promisify(crypto.scrypt)

const DEFAULT_USERNAME = process.env.INPLAY_USERNAME || 'jja'
const DEFAULT_PASSWORD = process.env.INPLAY_INITIAL_PASSWORD || 'password'
const DATA_DIR = process.env.INPLAY_DATA_DIR || path.join(process.cwd(), 'data')
const USER_FILE = process.env.INPLAY_USER_FILE || path.join(DATA_DIR, 'inplay-user.json')

let cachedUser = null

async function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const key = await scrypt(password, salt, 64)
  return `scrypt:${salt}:${key.toString('hex')}`
}

async function verifyPassword(password, storedHash) {
  const [scheme, salt, hashHex] = String(storedHash || '').split(':')
  if (scheme !== 'scrypt' || !salt || !hashHex) {
    return false
  }

  const expected = Buffer.from(hashHex, 'hex')
  const actual = await scrypt(password, salt, expected.length)
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual)
}

async function readUserFile() {
  try {
    const raw = await fs.readFile(USER_FILE, 'utf8')
    return JSON.parse(raw)
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error
    }
    return null
  }
}

async function writeUserFile(user) {
  await fs.mkdir(path.dirname(USER_FILE), { recursive: true })
  await fs.writeFile(USER_FILE, `${JSON.stringify(user, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  })
}

export async function ensureUser() {
  if (cachedUser) {
    return cachedUser
  }

  const existing = await readUserFile()
  if (existing?.username && existing?.passwordHash) {
    cachedUser = existing
    return cachedUser
  }

  cachedUser = {
    username: DEFAULT_USERNAME,
    passwordHash: await hashPassword(DEFAULT_PASSWORD),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  await writeUserFile(cachedUser)
  return cachedUser
}

export async function verifyCredentials(username, password) {
  const user = await ensureUser()
  if (String(username || '') !== user.username) {
    await hashPassword(String(password || ''))
    return null
  }

  const valid = await verifyPassword(String(password || ''), user.passwordHash)
  return valid ? { username: user.username } : null
}

export async function changePassword(currentPassword, newPassword) {
  const user = await ensureUser()
  const currentValid = await verifyPassword(String(currentPassword || ''), user.passwordHash)
  if (!currentValid) {
    const error = new Error('Current password is incorrect.')
    error.statusCode = 400
    throw error
  }

  if (String(newPassword || '').length < 8) {
    const error = new Error('New password must be at least 8 characters.')
    error.statusCode = 400
    throw error
  }

  cachedUser = {
    ...user,
    passwordHash: await hashPassword(String(newPassword)),
    updatedAt: new Date().toISOString(),
  }
  await writeUserFile(cachedUser)
  return { username: cachedUser.username }
}

