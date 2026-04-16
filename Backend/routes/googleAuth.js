import express from 'express'
import passport from 'passport'
import jwt from 'jsonwebtoken'
import { normalizeRole } from '../utils/roles.js'

const router = express.Router()

// GET /auth/google - avvia il flusso OAuth con Google
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
)

// GET /auth/google/callback - Google rimanda qui dopo il login
router.get('/google/callback', (req, res, next) => {
  passport.authenticate('google', { session: false }, (err, user, info) => {
    if (err) {
      const msg = encodeURIComponent('Errore autenticazione Google')
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=${msg}`)
    }

    if (!user) {
      const msg = encodeURIComponent(
        info?.message || 'Login Google non consentito per utenti non registrati'
      )
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=${msg}`)
    }

    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        nome: user.nome,
        cognome: user.cognome,
        role: normalizeRole(user.role)
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    // Reindirizza al frontend passando il token nell'URL
    return res.redirect(`${process.env.FRONTEND_URL}?token=${token}`)
  })(req, res, next)
})

export default router
