import { isSuperAdminRole } from '../utils/roles.js'

const superAdminMiddleware = (req, res, next) => {
  if (!isSuperAdminRole(req.user?.role)) {
    return res.status(403).json({ message: 'Accesso riservato ai superadmin' })
  }
  next()
}

export default superAdminMiddleware
