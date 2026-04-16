export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

export const getAuthToken = () => localStorage.getItem('token')

export const setAuthToken = (token) => {
  localStorage.setItem('token', token)
  window.dispatchEvent(new Event('auth-changed'))
}

export const clearAuthToken = () => {
  localStorage.removeItem('token')
  window.dispatchEvent(new Event('auth-changed'))
}

export const getAuthHeader = () => {
  const token = getAuthToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export const redirectToGoogleAuth = () => {
  window.location.href = `${API_BASE_URL}/auth/google`
}

// Wrapper fetch che intercetta qualsiasi 401 (account eliminato, bloccato o token scaduto)
// e fa kick-out. Usa res.clone() per non consumare il body originale.
export const authedFetch = async (url, options = {}) => {
  const res = await fetch(url, {
    ...options,
    headers: { ...getAuthHeader(), ...options.headers }
  })
  if (res.status === 401) {
    const data = await res.clone().json().catch(() => ({}))
    const code = data.code || 'TOKEN_EXPIRED'
    clearAuthToken()
    window.dispatchEvent(new CustomEvent('auth-kick', { detail: { code } }))
  }
  return res
}
