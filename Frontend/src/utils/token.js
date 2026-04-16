export const getTokenPayload = () => {
  const token = localStorage.getItem('token')
  if (!token) return null
  try {
    return JSON.parse(atob(token.split('.')[1]))
  } catch {
    return null
  }
}

export const isAdmin = () => {
  const role = getTokenPayload()?.role
  return role === 'admin' || role === 'superadmin'
}

export const isSuperAdmin = () => getTokenPayload()?.role === 'superadmin'

export const getDisplayName = () => {
  const p = getTokenPayload()
  if (!p) return ''
  return `${p.nome || ''} ${p.cognome || ''}`.trim()
}
