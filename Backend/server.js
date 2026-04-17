import 'dotenv/config'
import express from 'express'
import mongoose from 'mongoose'
import cors from 'cors'
import helmet from 'helmet'
import cron from 'node-cron'
import passport from './config/passport.js'

import authRouter from './routes/auth.js'
import googleAuthRouter from './routes/googleAuth.js'
import authorsRouter from './routes/authors.js'
import blogPostsRouter from './routes/blogPosts.js'
import authMiddleware from './middlewares/authMiddleware.js'
import Author from './models/Author.js'
import { handleRouteError } from './utils/errorHandling.js'
import { normalizeRole } from './utils/roles.js'

const app = express()
const port = Number.parseInt(process.env.PORT, 10) || 3000

// Security headers — CSP disabilitata perché questo è un API server puro (nessuna pagina HTML).
// Gli altri header di helmet (X-Frame-Options, X-Content-Type-Options, HSTS…) restano attivi.
app.use(helmet({ contentSecurityPolicy: false }))
app.use(cors({ origin: process.env.FRONTEND_URL }))
app.use(express.json())
app.use(passport.initialize())

// Rotte pubbliche (lettura libera)
app.use('/login', authRouter)
app.use('/auth', googleAuthRouter)
app.use('/authors', authorsRouter)
app.use('/blogPosts', blogPostsRouter)

// Da qui in poi tutto richiede autenticazione
app.use(authMiddleware)

// GET /me - protetta
app.get('/me', async (req, res) => {
  try {
    const author = await Author.findById(req.user.id)
    if (!author) return res.status(404).json({ message: 'Utente non trovato' })
    author.role = normalizeRole(author.role)
    res.json(author) // toJSON transform rimuove automaticamente i campi sensibili
  } catch (err) {
    handleRouteError(res, err)
  }
})

// ─── Cron: eliminazione account non verificati dopo 24 ore ───────────────────
// Gira ogni ora
cron.schedule('0 * * * *', async () => {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const result = await Author.deleteMany({
      emailVerified: false,
      googleId: { $exists: false },
      createdAt: { $lt: cutoff }
    })
    if (result.deletedCount > 0) {
      console.log(`[cron] Eliminati ${result.deletedCount} account non verificati (> 7 giorni)`)
    }
  } catch (err) {
    console.error('[cron] Errore pulizia account non verificati:', err.message)
  }
})

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connesso a MongoDB')
    app.listen(port, () => {
      console.log(`Server in ascolto sulla porta ${port}`)
    })
  })
  .catch((err) => {
    console.error('Errore di connessione a MongoDB:', err)
  })
