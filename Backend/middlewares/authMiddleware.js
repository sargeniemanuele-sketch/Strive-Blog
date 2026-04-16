import jwt from 'jsonwebtoken'
import Author from '../models/Author.js'

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token mancante' })
  }

  const token = authHeader.split(' ')[1]

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    // Verifica che l'account esista ancora e non sia bloccato
    const author = await Author.findById(decoded.id).select('blocked blockedUntil').lean()

    if (!author) {
      return res.status(401).json({ message: 'Account non trovato o eliminato', code: 'ACCOUNT_DELETED' })
    }

    if (author.blocked) {
      const isPermanent = !author.blockedUntil
      const isStillBlocked = isPermanent || new Date(author.blockedUntil) > new Date()
      if (isStillBlocked) {
        return res.status(401).json({ message: 'Account bloccato', code: 'ACCOUNT_BLOCKED' })
      }
    }

    req.user = decoded
    next()
  } catch (err) {
    res.status(401).json({ message: 'Token non valido' })
  }
}

export default authMiddleware
