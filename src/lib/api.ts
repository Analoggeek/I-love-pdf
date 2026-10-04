export type ApiError = { code: string; message: string }

export class ApiRequestError extends Error {
  code: string
  status: number
  constructor(message: string, code = 'REQUEST_FAILED', status = 0) {
    super(message)
    this.name = 'ApiRequestError'
    this.code = code
    this.status = status
  }
}

export async function apiRequest<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    const headers = new Headers(init.headers)
    const isMultipart = typeof FormData !== 'undefined' && init.body instanceof FormData
    if (!isMultipart && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
    response = await fetch(path, {
      ...init,
      credentials: 'same-origin',
      headers,
    })
  } catch {
    throw new ApiRequestError('The service could not be reached. Check your connection and try again.', 'NETWORK_ERROR')
  }
  const data = await response.json().catch(() => null)
  if (!response.ok || data?.success === false) {
    const error: ApiError = data?.error || { code: 'REQUEST_FAILED', message: response.status === 404 ? 'This API is not connected in the current deployment.' : 'The request could not be completed.' }
    throw new ApiRequestError(error.message, error.code, response.status)
  }
  return data as T
}

export function reportToolUse(toolId: string, filename?: string, status = 'completed') {
  const payload = { toolId, filename: filename?.replace(/[\r\n]/g, '').slice(0, 200), status }
  // Tool analytics are sent only after the user has opted into analytics.
  if (localStorage.getItem('a1pt-consent') !== 'analytics') return
  void apiRequest('/api/analytics', { method: 'POST', body: JSON.stringify({ event: 'tool_use', consent: 'analytics', ...payload }) }).catch(() => undefined)
}

export async function saveHistory(toolId: string, filename: string) {
  try {
    await apiRequest('/api/user/history', { method: 'POST', body: JSON.stringify({ toolId, filename: filename.slice(0, 200), status: 'completed' }) })
  } catch {
    // History is an optional account feature; local PDF processing still succeeds if the API is offline.
  }
}
