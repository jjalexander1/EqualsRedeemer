export async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...options,
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.csrfToken ? { 'x-csrf-token': options.csrfToken } : {}),
      ...(options.headers || {}),
    },
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(payload.error || `Request failed with ${response.status}`)
    error.status = response.status
    error.payload = payload
    throw error
  }
  return payload
}

export function formatNumber(value, digits = 2) {
  const number = Number(value)
  if (!Number.isFinite(number)) {
    return '-'
  }
  return number.toFixed(digits)
}

export function defaultSinceDate() {
  const date = new Date()
  date.setDate(date.getDate() - 13)
  return date.toISOString().slice(0, 10)
}

