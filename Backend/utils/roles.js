export const ROLES = {
  USER: 'user',
  ADMIN: 'admin',
  SUPERADMIN: 'superadmin'
}

export const isPrivilegedRole = (role = '') =>
  role === ROLES.ADMIN || role === ROLES.SUPERADMIN

export const isSuperAdminRole = (role = '') => role === ROLES.SUPERADMIN

export const normalizeRole = (role = '') => {
  if (role === ROLES.SUPERADMIN) return ROLES.SUPERADMIN
  if (role === ROLES.ADMIN) return ROLES.ADMIN
  return ROLES.USER
}

export const parseRole = (role = '') => {
  const cleaned = String(role).trim().toLowerCase()
  if (cleaned === ROLES.USER) return ROLES.USER
  if (cleaned === ROLES.ADMIN) return ROLES.ADMIN
  if (cleaned === ROLES.SUPERADMIN) return ROLES.SUPERADMIN
  return null
}
