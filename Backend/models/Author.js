import mongoose from 'mongoose'

const authorSchema = new mongoose.Schema({
  // Dati personali
  nome: { type: String, required: true },
  cognome: { type: String, default: '' },
  email: { type: String, required: true, unique: true },
  dataDiNascita: { type: String, default: '' },
  // Profilo
  avatar: { type: String, default: '' },
  bio: { type: String, default: '', trim: true, maxlength: 280 },
  // Ruolo e stato
  role: { type: String, enum: ['user', 'admin', 'superadmin'], default: 'user' },
  blocked: { type: Boolean, default: false },
  blockedUntil: { type: Date, default: null },
  // Auth — Google OAuth
  googleId: { type: String },
  // Auth — password locale
  password: { type: String },
  pendingPasswordHash: { type: String, default: '' },
  passwordChangeTokenHash: { type: String, default: '' },
  passwordChangeExpiresAt: { type: Date, default: null },
  // Verifica email
  emailVerified: { type: Boolean, default: false },
  emailVerificationToken: { type: String, default: '' },
  emailVerificationExpiresAt: { type: Date, default: null }
})

authorSchema.set('timestamps', true)

// Rimuove automaticamente i campi sensibili da tutte le risposte JSON
authorSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.password
    delete ret.emailVerificationToken
    delete ret.emailVerificationExpiresAt
    delete ret.pendingPasswordHash
    delete ret.passwordChangeTokenHash
    delete ret.passwordChangeExpiresAt
    return ret
  }
})

export default mongoose.model('Author', authorSchema)
