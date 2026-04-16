import passport from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import Author from '../models/Author.js'
import { sendWelcomeEmail } from '../services/email.js'

const normalizeEmail = (email = '') => String(email).trim().toLowerCase()
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Cerca per googleId
        const email = normalizeEmail(profile.emails?.[0]?.value || '')
        let author = await Author.findOne({ googleId: profile.id })

        // Se non esiste per googleId, cerca per email
        if (!author) {
          author = await Author.findOne({ email })
        }

        // Se non esiste ancora, crea un nuovo autore
        if (!author) {
          author = new Author({
            googleId: profile.id,
            nome: profile.name.givenName || profile.displayName,
            cognome: profile.name.familyName || '',
            email,
            avatar: profile.photos[0]?.value || '',
            emailVerified: true  // Google garantisce già la verifica dell'email
          })
          await author.save()
          void sendWelcomeEmail(author)
        } else {
          // Account esistente: aggiorna googleId se mancante, e segna emailVerified = true
          let dirty = false
          if (!author.googleId) { author.googleId = profile.id; dirty = true }
          if (!author.emailVerified) { author.emailVerified = true; dirty = true }
          if (dirty) await author.save()
        }

        // Blocca il login se l'account è bloccato
        if (author.blocked) {
          const isPermanent = !author.blockedUntil
          const isStillBlocked = isPermanent || new Date(author.blockedUntil) > new Date()
          if (isStillBlocked) {
            return done(null, false, { message: 'Account bloccato. Contatta un amministratore.' })
          }
        }

        done(null, author)
      } catch (err) {
        done(err, null)
      }
    }
  )
)

export default passport
