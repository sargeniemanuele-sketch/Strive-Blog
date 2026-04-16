import express from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'
import Author from '../models/Author.js'
import { handleRouteError, sendValidationError } from '../utils/errorHandling.js'
import { validateLoginInput } from '../utils/validation.js'
import { loginRateLimiter } from '../middlewares/rateLimiters.js'
import { normalizeRole } from '../utils/roles.js'

const router = express.Router()

// POST /login
router.post('/', loginRateLimiter, async (req, res) => {
  try {
    const { errors, sanitized } = validateLoginInput(req.body)
    if (errors.length) {
      return sendValidationError(res, errors)
    }

    const { email, password } = sanitized

    const author = await Author.findOne({ email })
    if (!author) {
      return res.status(401).json({ message: 'Credenziali non valide' })
    }

    if (!author.password) {
      return res.status(401).json({ message: 'Account registrato con Google. Usa il login con Google.' })
    }

    const isValid = await bcrypt.compare(password, author.password)
    if (!isValid) return res.status(401).json({ message: 'Credenziali errate' })

    if (author.blocked) {
      const isTemporaryBlockExpired =
        author.blockedUntil && new Date(author.blockedUntil) <= new Date()

      if (isTemporaryBlockExpired) {
        author.blocked = false
        author.blockedUntil = null
        await author.save()
      } else {
        const msg = author.blockedUntil
          ? `Account bloccato fino al ${new Date(author.blockedUntil).toLocaleDateString('it-IT')}`
          : 'Account bloccato permanentemente'
        return res.status(403).json({ message: msg })
      }
    }

    const token = jwt.sign(
      {
        id: author._id,
        email: author.email,
        nome: author.nome,
        cognome: author.cognome,
        role: normalizeRole(author.role)
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    res.json({ token })
  } catch (err) {
    handleRouteError(res, err)
  }
})

export default router
