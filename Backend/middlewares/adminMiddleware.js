import { isPrivilegedRole } from '../utils/roles.js'

const adminMiddleware = (req, res, next) => {
  if (!isPrivilegedRole(req.user?.role)) {
    return res.status(403).json({ message: 'Accesso riservato agli amministratori' })
  }
  next()
}

export default adminMiddleware
